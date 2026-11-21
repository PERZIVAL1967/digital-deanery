// Write side of the dean's cabinet. Every statement finds its target through the staff member's faculty in SQL
// (deanScope); a forged id from another faculty is "missing". Every edit of a student is logged
// (student_change_log / grade_change: who, when, old, new, reason) and the student is notified.
import type { PoolClient } from "pg";
import { db } from "../db";
import { digest } from "../dal/session";
import { deanScope, OPEN_STATUSES } from "../dal/staff";
import { notifyStudents } from "./teacher";
import { certificatePdf } from "../pdf";
import { parseMessage } from "../request-ui";
import { fmtDayMonth, today } from "../time";

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

/** the staff member and the student, if the student is in their faculty */
async function scopeStudent(c: PoolClient, token: string, student: string) {
  const { rows: [r] } = await c.query<{ staff_id: string; student_id: string; name: string; group_id: string; group_name: string; stream_id: string | null }>(
    `WITH ${deanScope} SELECT me.id AS staff_id, fs.id AS student_id, fs.name, fs.group_id, fs.group_name, fs.stream_id
     FROM me JOIN fs ON fs.id = $2`, [digest(token), student]);
  return r ?? null;
}

async function log(c: PoolClient, student: string, actor: string, field: string, oldV: string | null, newV: string | null, reason: string) {
  await c.query(`INSERT INTO student_change_log (student_id, actor_id, field, old_value, new_value, reason) VALUES ($1, $2, $3, $4, $5, $6)`,
    [student, actor, field, oldV, newV, reason]);
  await notifyStudents(c, "record_changed", student, { field, old: oldV, new: newV, reason }, [student]);
}

// ---------- the student card ----------

export async function excuseAbsence(token: string, student: string, occurrence: string, note: string) {
  return tx(async (c) => {
    const s = await scopeStudent(c, token, student);
    if (!s) return "missing" as const;
    const { rows: [a] } = await c.query<{ course: string; day: string }>(
      `UPDATE attendance a SET excused = true, excuse_note = $3 FROM class_occurrence o, section, course
       WHERE a.occurrence_id = $2 AND a.student_id = $1 AND a.status = 'absent' AND NOT a.excused
         AND o.id = a.occurrence_id AND section.id = o.section_id AND course.id = section.course_id
       RETURNING course.name AS course, to_char(lower(o.slot) AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD') AS day`, [student, occurrence, note]);
    if (!a) return "stale" as const;
    await log(c, student, s.staff_id, `Пропуск: ${a.course}, ${fmtDayMonth(a.day)}`, "без причины", "уважительная причина", note);
    return "ok" as const;
  });
}

// ---------- grades ----------
async function teachersOf(c: PoolClient, student: string, course: string) {
  const { rows } = await c.query<{ user_id: string }>(
    `SELECT DISTINCT ta.user_id FROM section_member m JOIN section s ON s.id = m.section_id AND s.course_id = $2
     JOIN class_occurrence o ON o.section_id = s.id JOIN teacher_account ta ON ta.teacher_id = o.teacher_id WHERE m.student_id = $1`, [student, course]);
  return rows.map((r) => r.user_id);
}

/** the course grade (latest attempt) set by the dean with a mandatory reason: Codex's grade_correction + our log */
export async function deanSetGrade(token: string, student: string, course: string, score: number, reason: string) {
  return tx(async (c) => {
    const s = await scopeStudent(c, token, student);
    if (!s) return "missing" as const;
    const { rows: [a] } = await c.query<{ attempt_no: number; score: number; revision: number; course: string }>(
      `SELECT a.attempt_no, COALESCE(gc.score, a.score) AS score, COALESCE(gc.revision, 0) AS revision, course.name AS course
       FROM grade_attempt a JOIN course ON course.id = a.course_id
       LEFT JOIN LATERAL (SELECT score, revision FROM grade_correction WHERE student_id = a.student_id AND course_id = a.course_id
         AND attempt_no = a.attempt_no ORDER BY revision DESC LIMIT 1) gc ON true
       WHERE a.student_id = $1 AND a.course_id = $2 ORDER BY a.attempt_no DESC LIMIT 1 FOR UPDATE OF a`, [student, course]);
    if (!a) return "missing" as const;
    if (a.score === score) return "same" as const;
    await c.query(`INSERT INTO grade_correction (student_id, course_id, attempt_no, revision, score, reason, actor_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [student, course, a.attempt_no, a.revision + 1, score, reason, s.staff_id]);
    await c.query(`INSERT INTO grade_change (student_id, course_id, attempt_no, old_score, new_score, reason, source, actor_id) VALUES ($1, $2, $3, $4, $5, $6, 'dean', $7)`,
      [student, course, a.attempt_no, a.score, score, reason, s.staff_id]);
    await c.query(`UPDATE assessment_mark am SET score = $3 FROM assessment x JOIN section s ON s.id = x.section_id
      WHERE am.assessment_id = x.id AND am.student_id = $1 AND s.course_id = $2 AND am.attempt_no = $4`, [student, course, score, a.attempt_no]);
    await notifyStudents(c, "grade_changed", course, { course: a.course, attempt: a.attempt_no, score, corrected: true, note: `исправлено деканатом: ${reason}` }, [student]);
    for (const u of await teachersOf(c, student, course)) {
      await c.query(`INSERT INTO staff_notice (user_id, kind, payload) VALUES ($1, 'grade_dean', $2)`,
        [u, JSON.stringify({ student: s.name, course: a.course, old: a.score, new: score, reason })]);
    }
    return "ok" as const;
  });
}

export async function publishTargeted(token: string, id: string, title: string, body: string, scope: string, target: string | null) {
  return tx(async (c) => {
    const { rows: [me] } = await c.query<{ id: string; faculty_id: string }>(
      `WITH ${deanScope} SELECT id, faculty_id FROM me`, [digest(token)]);
    if (!me) return "missing" as const;
    const { rows: students } = await c.query<{ id: string }>(
      `WITH ${deanScope}
       SELECT fs.id FROM fs WHERE $2 = 'faculty'
          OR ($2 = 'stream' AND fs.stream_id = $3::uuid) OR ($2 = 'group' AND fs.group_id = $3::uuid)
          OR ($2 = 'section' AND EXISTS (SELECT 1 FROM section_member m JOIN section s ON s.id = m.section_id
              JOIN course ON course.id = s.course_id JOIN me ON me.faculty_id = course.faculty_id WHERE m.section_id = $3::uuid AND m.student_id = fs.id))`,
      [digest(token), scope, target]);
    if (scope !== "faculty" && !students.length) return "missing" as const;
    const { rowCount } = await c.query("INSERT INTO announcement (id, faculty_id, author_id, title, body) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [id, me.faculty_id, me.id, title, body]);
    if (!rowCount) return "ok" as const; // double submit
    if (scope !== "faculty") await c.query("INSERT INTO announcement_target (announcement_id, scope, target_id) VALUES ($1, $2, $3)", [id, scope, target]);
    await notifyStudents(c, "announcement", id, { title, body }, students.map((s) => s.id));
    return "ok" as const;
  });
}

// ---------- one-tap certificate (bold idea) ----------
/**
 * «Справка об обучении» in one tap: the PDF is generated from the student's record, stored, added to the student's
 * documents, and the request moves to «Готова» (through «В работе» if it was new). The student is notified.
 */
export async function oneTapCertificate(token: string, requestId: string, pickup: string) {
  return tx(async (c) => {
    const { rows: [r] } = await c.query<{ staff_id: string; staff_user: string; student_id: string; status: string; version: number; kind: string; message: string;
      name: string; group_name: string; programme: string; faculty: string; record_book: string | null; study_level: string | null; profile_name: string | null;
      study_form: string | null; admission_year: number | null; course_year: number | null; study_status: string | null; birth: string | null; has_doc: boolean }>(
      `WITH ${deanScope}
       SELECT me.id AS staff_id, me.id AS staff_user, fs.id AS student_id, request.status, request.version, request.kind, request.message, fs.name, fs.group_name,
         programme.name AS programme, faculty.name AS faculty, p.record_book, p.study_level, p.profile_name, p.study_form, p.admission_year,
         p.course_year, p.study_status, to_char(p.birth_date, 'DD.MM.YYYY') AS birth,
         EXISTS (SELECT 1 FROM generated_document g WHERE g.request_id = request.id) AS has_doc
       FROM me JOIN fs ON true JOIN request ON request.student_id = fs.id AND request.id = $2
       JOIN acad_group ON acad_group.id = fs.group_id JOIN programme ON programme.id = acad_group.programme_id
       JOIN faculty ON faculty.id = programme.faculty_id LEFT JOIN student_profile p ON p.student_id = fs.id
       FOR UPDATE OF request`, [digest(token), requestId]);
    if (!r) return "missing" as const;
    if (r.kind !== "certificate") return "unsupported" as const;
    if (r.has_doc || !["submitted", "in_review"].includes(r.status)) return "stale" as const;
    const { rows: [{ n }] } = await c.query<{ n: string }>("SELECT nextval('generated_document_no')::text AS n");
    const number = `Д-${today().slice(0, 4)}/${n}`;
    const destination = parseMessage(r.message).find(([k]) => k === "Куда")?.[1] ?? null;
    const issued = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date());
    const pdf = await certificatePdf({ number, issuedOn: issued, name: r.name, birthDate: r.birth, courseYear: r.course_year, studyForm: r.study_form,
      level: r.study_level, programme: r.programme, profile: r.profile_name, faculty: r.faculty, group: r.group_name, recordBook: r.record_book,
      admissionYear: r.admission_year, status: r.study_status, destination });
    const { rows: [doc] } = await c.query<{ id: string }>(
      "INSERT INTO generated_document (request_id, student_id, number, pdf, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [requestId, r.student_id, number, pdf, r.staff_id]);
    await c.query(`INSERT INTO issued_document (student_id, title, issued_on, kind, generated_id) VALUES ($1, $2, (now() AT TIME ZONE 'Europe/Moscow')::date, 'certificate', $3)`,
      [r.student_id, `Справка об обучении № ${number}`, doc.id]);
    const steps = r.status === "submitted" ? ["in_review", "ready"] : ["ready"];
    let before = r.status, version = r.version;
    for (const next of steps) {
      version += 1;
      const msg = next === "ready" ? `Справка № ${number} готова. ${pickup}` : "Справка формируется автоматически.";
      await c.query("UPDATE request SET status = $2, version = $3 WHERE id = $1", [requestId, next, version]);
      await c.query("INSERT INTO request_event (request_id, version, actor_id, status, message) VALUES ($1, $2, $3, $4, $5)", [requestId, version, r.staff_id, next, msg]);
      if (next === "ready") await notifyStudents(c, "request_status", requestId, { before, after: next, reason: msg }, [r.student_id]);
      before = next;
    }
    return "ok" as const;
  });
}

export { OPEN_STATUSES };
