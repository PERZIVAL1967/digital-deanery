// Write side of the teacher's cabinet. Each statement re-checks in SQL that the class / section / resit belongs to
// the signed-in teacher; ids from forms are never trusted alone. Results: "ok", "missing" (not yours or no such row),
// or a domain answer ("reason", "pending", "stale").
import type { PoolClient } from "pg";
import { db } from "../db";
import { digest } from "../dal/session";
import { teacherScope } from "../dal/teacher";

async function tx<T>(run: (c: PoolClient) => Promise<T>) {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const r = await run(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** notify students: one change_event, one notification per student (same shape as Codex's notifications) */
export async function notifyStudents(c: PoolClient, kind: string, entity: string, payload: object, students: string[]) {
  if (!students.length) return;
  await c.query(
    `WITH ev AS (INSERT INTO change_event (kind, entity_id, payload) VALUES ($1, $2, $3) RETURNING id)
     INSERT INTO notification (change_event_id, student_id) SELECT ev.id, s FROM ev CROSS JOIN unnest($4::uuid[]) AS s ON CONFLICT DO NOTHING`,
    [kind, entity, JSON.stringify(payload), students]);
}

// ---------- attendance ----------
/** one tap: present / absent / late for a student of my class. A dean's excuse is kept if the status stays absent. */
export async function markAttendance(token: string, occurrence: string, student: string, status: "present" | "absent" | "late") {
  const { rowCount } = await db.query(
    `WITH ${teacherScope},
     target AS (SELECT o.id, m.student_id, tme.user_id FROM tme JOIN class_occurrence o ON o.teacher_id = tme.teacher_id AND o.id = $2
       AND o.status <> 'cancelled' JOIN section_member m ON m.section_id = o.section_id AND m.student_id = $3)
     INSERT INTO attendance (occurrence_id, student_id, status, marked_by, marked_at)
     SELECT id, student_id, $4, user_id, now() FROM target
     ON CONFLICT (occurrence_id, student_id) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, marked_at = now(),
       excused = attendance.excused AND excluded.status = 'absent'`,
    [digest(token), occurrence, student, status]);
  return rowCount ? "ok" : "missing";
}

/** everyone not marked yet is present */
export async function markRestPresent(token: string, occurrence: string) {
  const { rows } = await db.query<{ ok: boolean; n: number }>(
    `WITH ${teacherScope},
     occ AS (SELECT o.id, o.section_id, tme.user_id FROM tme JOIN class_occurrence o ON o.teacher_id = tme.teacher_id AND o.id = $2 AND o.status <> 'cancelled'),
     ins AS (INSERT INTO attendance (occurrence_id, student_id, status, marked_by)
       SELECT occ.id, m.student_id, 'present', occ.user_id FROM occ JOIN section_member m ON m.section_id = occ.section_id
       ON CONFLICT DO NOTHING RETURNING 1)
     SELECT EXISTS (SELECT 1 FROM occ) AS ok, (SELECT count(*)::int FROM ins) AS n`,
    [digest(token), occurrence]);
  return rows[0]?.ok ? "ok" : "missing";
}

// ---------- journal ----------
export async function addAssessment(token: string, section: string, title: string, day: string) {
  const { rowCount } = await db.query(
    `WITH ${teacherScope}
     INSERT INTO assessment (section_id, title, held_on, position, created_by)
     SELECT mine.id, $3, $4::date, (SELECT COALESCE(max(position), 0) + 1 FROM assessment WHERE section_id = mine.id), tme.user_id
     FROM mine CROSS JOIN tme WHERE mine.id = $2`,
    [digest(token), section, title, day]);
  return rowCount ? "ok" : "missing";
}

/**
 * A cell of the journal. Empty cell: the mark is published at once (a new grade attempt the student sees, notified).
 * A published cell: the change needs a reason and goes to the dean as a proposal (Codex's grade_correction on approval).
 */
export async function setMark(token: string, assessment: string, student: string, score: number, reason: string | null) {
  return tx(async (c) => {
    const { rows: [t] } = await c.query<{ user_id: string; course_id: string; course: string; title: string; old: number | null; attempt_no: number | null }>(
      `WITH ${teacherScope}
       SELECT tme.user_id, course.id AS course_id, course.name AS course, a.title, am.score AS old, am.attempt_no
       FROM tme CROSS JOIN mine JOIN assessment a ON a.section_id = mine.id AND a.id = $2
       JOIN section ON section.id = mine.id JOIN course ON course.id = section.course_id
       JOIN section_member m ON m.section_id = mine.id AND m.student_id = $3
       LEFT JOIN assessment_mark am ON am.assessment_id = a.id AND am.student_id = m.student_id
       FOR UPDATE OF a`, [digest(token), assessment, student]);
    if (!t) return "missing" as const;
    if (t.old === null) {
      await c.query("SELECT 1 FROM enrolment WHERE student_id = $1 AND course_id = $2 FOR UPDATE", [student, t.course_id]);
      const { rows: [att] } = await c.query<{ attempt_no: number }>(
        `INSERT INTO grade_attempt (student_id, course_id, attempt_no, score, assessed_on, recorded_by_teacher, note)
         SELECT $1, $2, COALESCE(max(attempt_no), 0) + 1, $3, (now() AT TIME ZONE 'Europe/Moscow')::date, $4, $5
         FROM grade_attempt WHERE student_id = $1 AND course_id = $2 RETURNING attempt_no`,
        [student, t.course_id, score, t.user_id, t.title.slice(0, 200)]);
      await c.query(`INSERT INTO assessment_mark (assessment_id, student_id, score, attempt_no, recorded_by) VALUES ($1, $2, $3, $4, $5)`,
        [assessment, student, score, att.attempt_no, t.user_id]);
      await notifyStudents(c, "grade_changed", t.course_id,
        { course: t.course, attempt: att.attempt_no, score, corrected: false, note: t.title }, [student]);
      return "ok" as const;
    }
    if (t.old === score) return "same" as const;
    if (!reason) return "reason" as const;
    const { rowCount } = await c.query(
      `INSERT INTO grade_proposal (assessment_id, student_id, old_score, new_score, reason, author_id)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [assessment, student, t.old, score, reason, t.user_id]);
    return rowCount ? "proposed" as const : "pending" as const;
  });
}

export async function readMyNotices(token: string) {
  await db.query(`UPDATE staff_notice n SET read_at = now() FROM session WHERE session.token_hash = $1 AND session.expires_at > now()
    AND n.user_id = session.user_id AND n.read_at IS NULL`, [digest(token)]);
}
