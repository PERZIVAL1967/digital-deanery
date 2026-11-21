import { createHash } from "node:crypto";
import { db } from "../db";
import { digest } from "../dal/session";
import { teacherSections } from "../dal/teacher-grades";

export type Mark = { login: string; score: number };

export async function importMarks(token: string, section: string, marks: Mark[]) {
  const fingerprint = createHash("sha256").update(JSON.stringify(
    marks.map(({ login, score }) => [login, score]).sort(),
  )).digest("hex");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const principal = await client.query<{ user_id: string; course_id: string }>(
      `SELECT session.user_id, course.id AS course_id ${teacherSections}
       AND section.id = $2 LIMIT 1`, [digest(token), section],
    );
    const actor = principal.rows[0];
    if (!actor) return "scope";

    const roster = await client.query<{ login: string; student_id: string }>(
      `SELECT app_user.login, enrolment.student_id FROM section_member
       JOIN enrolment USING (student_id, course_id)
       JOIN app_user ON app_user.id = enrolment.student_id
       WHERE section_id = $1 AND app_user.login = ANY($2::text[])
       ORDER BY enrolment.student_id FOR UPDATE OF enrolment`,
      [section, marks.map(({ login }) => login)],
    );
    if (roster.rows.length !== marks.length) return "roster";

    const batch = await client.query(
      `INSERT INTO grade_import (section_id,fingerprint,imported_by) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`, [section, fingerprint, actor.user_id],
    );
    if (!batch.rowCount) return "duplicate";

    const scores = new Map(marks.map(({ login, score }) => [login, score]));
    await client.query(
      `WITH incoming AS (
         SELECT * FROM unnest($1::uuid[], $2::int[]) AS marks(student_id, score)
       ), attempts AS (
         INSERT INTO grade_attempt (student_id,course_id,attempt_no,score,assessed_on,recorded_by_teacher)
         SELECT incoming.student_id,$3,COALESCE(max(previous.attempt_no),0)+1,
                incoming.score,(now() AT TIME ZONE 'Europe/Moscow')::date,$4
         FROM incoming LEFT JOIN grade_attempt previous
           ON previous.student_id = incoming.student_id AND previous.course_id = $3
         GROUP BY incoming.student_id,incoming.score
         RETURNING student_id,attempt_no,score
       ), events AS (
         SELECT gen_random_uuid() AS id, student_id, attempt_no, score FROM attempts
       ), inserted AS (
         INSERT INTO change_event (id,kind,entity_id,payload)
         SELECT events.id,'grade_changed',course.id,jsonb_build_object(
           'course',course.name,'attempt',attempt_no,'score',score,'corrected',false)
         FROM events CROSS JOIN course WHERE course.id = $3
         RETURNING id
       )
       INSERT INTO notification (change_event_id,student_id)
       SELECT inserted.id,events.student_id FROM inserted JOIN events USING (id)`,
      [roster.rows.map(({ student_id }) => student_id),
        roster.rows.map(({ login }) => scores.get(login)), actor.course_id, actor.user_id],
    );
    await client.query("COMMIT");
    return "ok";
  } finally {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}
