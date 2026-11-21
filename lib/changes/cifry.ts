// Write side for the «Большие цифры» UI. Every statement authorises inside SQL from the session token,
// like Codex's lib/changes: a row is touched only if it belongs to (or is in scope of) the signed-in user.
import { createHash } from "node:crypto";
import { db } from "../db";
import { digest } from "../dal/session";
import { teacherSections } from "../dal/teacher-grades";

const principal = `session.token_hash = $1 AND session.expires_at > now()`;

/** opening the inbox marks every notification of this student read */
export async function markAllRead(token: string) {
  const result = await db.query(
    `UPDATE notification SET read_at = now() FROM session
     WHERE ${principal} AND notification.student_id = session.user_id AND notification.read_at IS NULL`,
    [digest(token)],
  );
  return result.rowCount ?? 0;
}

/** Simulated plagiarism check: deterministic score from the work and the file name. No file is stored. */
export function fakeOriginality(workId: string, filename: string) {
  const h = createHash("sha256").update(workId + "\u0000" + filename.toLowerCase()).digest();
  return 60 + (h.readUInt32BE(0) % 35); // 60..94
}

export async function uploadPlagiarism(token: string, workId: string, filename: string) {
  const score = fakeOriginality(workId, filename);
  const { rows } = await db.query<{ originality: number; status: string; title: string }>(
    `UPDATE plagiarism_work w SET originality = $3,
       status = CASE WHEN $3 >= w.threshold THEN 'accepted' ELSE 'below' END,
       filename = $4, uploaded_at = now(), attempts = w.attempts + 1
     FROM session WHERE ${principal} AND w.student_id = session.user_id AND w.id = $2 AND w.status <> 'accepted'
     RETURNING w.originality, w.status, w.title`,
    [digest(token), workId, score, filename],
  );
  return rows[0] ?? null;
}

/** a student's question to the deanery; the idempotency key makes a double submit harmless */
export async function askQuestion(token: string, key: string, topic: string, body: string) {
  const { rows } = await db.query<{ ok: boolean }>(
    `WITH me AS (SELECT student.id FROM session JOIN student ON student.id = session.user_id WHERE ${principal}),
     added AS (
       INSERT INTO deanery_question (student_id, idempotency_key, topic, body)
       SELECT id, $2, $3, $4 FROM me ON CONFLICT (student_id, idempotency_key) DO NOTHING RETURNING id
     )
     SELECT EXISTS (SELECT 1 FROM me) AS ok`,
    [digest(token), key, topic, body],
  );
  return rows[0]?.ok ?? false;
}

/** staff answers a question of a student of their own faculty; the student gets a notification */
export async function answerQuestion(token: string, id: string, answer: string) {
  const { rows } = await db.query<{ visible: boolean; answered: boolean }>(
    `WITH target AS (
       SELECT q.id, q.student_id, staff.id AS staff_id FROM session JOIN staff ON staff.id = session.user_id
       JOIN programme ON programme.faculty_id = staff.faculty_id
       JOIN acad_group ON acad_group.programme_id = programme.id
       JOIN student ON student.group_id = acad_group.id
       JOIN deanery_question q ON q.student_id = student.id
       WHERE ${principal} AND q.id = $2
       FOR UPDATE OF q
     ), answered AS (
       UPDATE deanery_question q SET answer = $3, answered_by = target.staff_id, answered_at = now()
       FROM target WHERE q.id = target.id AND q.answer IS NULL
       RETURNING q.id, q.student_id, q.body
     ), event AS (
       INSERT INTO change_event (kind, entity_id, payload)
       SELECT 'question_answered', id, jsonb_build_object('question', body, 'answer', $3::text) FROM answered
       RETURNING id
     ), notified AS (
       INSERT INTO notification (change_event_id, student_id)
       SELECT event.id, answered.student_id FROM event CROSS JOIN answered
     )
     SELECT EXISTS (SELECT 1 FROM target) AS visible, EXISTS (SELECT 1 FROM answered) AS answered`,
    [digest(token), id, answer],
  );
  const r = rows[0];
  return !r?.visible ? "missing" : r.answered ? "ok" : "stale";
}

/**
 * A teacher records a new score for a student of a section they teach (Codex's teacherSections scope).
 * Like Codex's Excel import it adds a new attempt; the student is notified.
 */
export async function teacherSaveGrade(token: string, sectionId: string, studentId: string, score: number, note: string | null) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows: [scope] } = await client.query<{ user_id: string; course_id: string }>(
      `SELECT session.user_id, course.id AS course_id ${teacherSections}
       AND section.id = $2
       AND EXISTS (SELECT 1 FROM section_member m WHERE m.section_id = section.id AND m.student_id = $3)
       LIMIT 1`,
      [digest(token), sectionId, studentId],
    );
    if (!scope) {
      await client.query("ROLLBACK");
      return "missing" as const;
    }
    await client.query("SELECT 1 FROM enrolment WHERE student_id = $1 AND course_id = $2 FOR UPDATE", [studentId, scope.course_id]);
    const { rows: [attempt] } = await client.query<{ attempt_no: number }>(
      `INSERT INTO grade_attempt (student_id, course_id, attempt_no, score, assessed_on, recorded_by_teacher, note)
       SELECT $1, $2, COALESCE(max(attempt_no), 0) + 1, $3, (now() AT TIME ZONE 'Europe/Moscow')::date, $4, $5
       FROM grade_attempt WHERE student_id = $1 AND course_id = $2
       RETURNING attempt_no`,
      [studentId, scope.course_id, score, scope.user_id, note],
    );
    await client.query(
      `WITH event AS (
         INSERT INTO change_event (kind, entity_id, payload)
         SELECT 'grade_changed', id, jsonb_build_object('course', name, 'attempt', $2::int, 'score', $3::int,
           'corrected', false, 'note', $4::text)
         FROM course WHERE id = $1 RETURNING id
       )
       INSERT INTO notification (change_event_id, student_id) SELECT id, $5 FROM event`,
      [scope.course_id, attempt.attempt_no, score, note, studentId],
    );
    await client.query("COMMIT");
    return "ok" as const;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** the request id for (this student, idempotency key), to show the confirmation after Codex's submitRequest */
export async function requestIdByKey(token: string, key: string) {
  const { rows } = await db.query<{ id: string }>(
    `SELECT request.id FROM session JOIN request ON request.student_id = session.user_id
     WHERE ${principal} AND request.idempotency_key = $2`,
    [digest(token), key],
  );
  return rows[0]?.id ?? null;
}
