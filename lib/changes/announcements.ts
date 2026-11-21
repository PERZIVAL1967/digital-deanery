import { db } from "../db";
import { digest } from "../dal/session";

export async function publishAnnouncement(token: string, id: string, title: string, body: string) {
  const { rows: [result] } = await db.query<{ authorized: boolean }>(
    `WITH principal AS (
       SELECT staff.id, staff.faculty_id FROM session JOIN staff ON staff.id = session.user_id
       WHERE session.token_hash = $1 AND session.expires_at > now()
     ), published AS (
       INSERT INTO announcement (id,faculty_id,author_id,title,body)
       SELECT $2,faculty_id,id,$3,$4 FROM principal
       ON CONFLICT (id) DO NOTHING RETURNING id,faculty_id
     ), event AS (
       INSERT INTO change_event (kind,entity_id,payload)
       SELECT 'announcement', id,jsonb_build_object('title',$3::text,'body',$4::text) FROM published
       RETURNING id,entity_id
     ), notified AS (
       INSERT INTO notification (change_event_id,student_id)
       SELECT event.id,student.id FROM event JOIN published ON published.id=event.entity_id
       JOIN programme ON programme.faculty_id=published.faculty_id
       JOIN acad_group ON acad_group.programme_id=programme.id
       JOIN student ON student.group_id=acad_group.id
     )
     SELECT EXISTS (SELECT 1 FROM principal) AS authorized`,
    [digest(token), id, title, body],
  );
  return result.authorized;
}

export async function saveDeadline(token: string, id: string, courseId: string,
  version: number | null, title: string, due: string) {
  const { rows: [result] } = await db.query<{ allowed: boolean; saved: boolean }>(
    `WITH scope AS (
       SELECT course.id FROM session JOIN staff ON staff.id = session.user_id
       JOIN course ON course.faculty_id = staff.faculty_id
       WHERE session.token_hash = $1 AND session.expires_at > now() AND course.id = $3
     ), added AS (
       INSERT INTO deadline (id,course_id,title,due_at)
       SELECT $2,id,$5,$6 FROM scope WHERE $4::int IS NULL
       ON CONFLICT (id) DO NOTHING RETURNING id
     ), edited AS (
       UPDATE deadline SET title = $5, due_at = $6, version = version + 1
       WHERE id = $2 AND course_id IN (SELECT id FROM scope) AND version = $4
       RETURNING id
     )
     SELECT EXISTS (SELECT 1 FROM scope) AS allowed,
       EXISTS (SELECT 1 FROM added UNION ALL SELECT 1 FROM edited) AS saved`,
    [digest(token), id, courseId, version, title, due],
  );
  return !result.allowed ? "missing" : result.saved ? "ok" : "stale";
}
