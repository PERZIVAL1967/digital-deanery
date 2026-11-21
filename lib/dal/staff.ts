// Read model of the dean's cabinet. Same rule as Codex's DAL: every query starts from the session token and
// reaches students only through the staff member's faculty (faculty -> programme -> group -> student).
import { db } from "../db";
import { digest } from "./session";

/** `me` = the signed-in staff member, `fs` = the students of their faculty (with group and поток) */
export const deanScope = `
  me AS (SELECT staff.id, staff.faculty_id FROM session JOIN staff ON staff.id = session.user_id
         WHERE session.token_hash = $1 AND session.expires_at > now()),
  fs AS (SELECT student.id, student.name, acad_group.id AS group_id, acad_group.name AS group_name, acad_group.stream_id
         FROM me JOIN programme ON programme.faculty_id = me.faculty_id
         JOIN acad_group ON acad_group.programme_id = programme.id
         JOIN student ON student.group_id = acad_group.id)`;

/** a readable name for a section: «Семинар 3МЭО-02», «Англ. 3МЭО-01/2», «Лекция, поток» */
export const sectionTitle = (s = "section", g = "sg") => `CASE ${s}.kind
  WHEN 'lecture' THEN 'Лекция, поток' WHEN 'elective' THEN 'По выбору, поток'
  WHEN 'language' THEN 'Англ. ' || ${g}.name || '/' || ${s}.lang_no
  ELSE 'Семинар ' || COALESCE(${g}.name, ${s}.label) END`;

export const OPEN_STATUSES = ["submitted", "in_review", "needs_info"];
export const SLA_DAYS = 3;
const q = async <T extends object>(sql: string, token: string, args: unknown[] = []) =>
  (await db.query<T & Record<string, unknown>>(sql, [digest(token), ...args])).rows as T[];

// ---------- home ----------
export type DeanHome = {
  waiting: number; overdue: number; teacherWaiting: number; oldest: { id: string; kind: string; name: string; group_name: string; created_at: Date; status: string }[];
  questions: number; oldestQuestion: Date | null; changesToday: number; notifiedToday: number; ready: number;
  proposals: number; debtors: number; resits: number; students: number; unread: number;
};

export async function deanHome(token: string): Promise<DeanHome | null> {
  const [row] = await q<Omit<DeanHome, "oldest">>(
    `WITH ${deanScope},
     reqs AS (SELECT request.* FROM fs JOIN request ON request.student_id = fs.id),
     today_ev AS (
       SELECT event.id FROM change_event event JOIN class_occurrence occ ON occ.id = event.entity_id
       JOIN section ON section.id = occ.section_id JOIN course ON course.id = section.course_id
       JOIN me ON me.faculty_id = course.faculty_id
       WHERE event.kind = 'class_status'
         AND (event.created_at AT TIME ZONE 'Europe/Moscow')::date = (now() AT TIME ZONE 'Europe/Moscow')::date)
     SELECT
       (SELECT count(*)::int FROM reqs WHERE status = ANY($2)) AS waiting,
       (SELECT count(*)::int FROM reqs WHERE status = ANY($2) AND created_at < now() - $3 * interval '1 day') AS overdue,
       (SELECT count(*)::int FROM teacher_request tr WHERE tr.status = 'open' AND EXISTS (
          SELECT 1 FROM teacher_account ta JOIN class_occurrence o ON o.teacher_id = ta.teacher_id
          JOIN section s ON s.id = o.section_id JOIN course c ON c.id = s.course_id JOIN me ON me.faculty_id = c.faculty_id
          WHERE ta.user_id = tr.author_id)) AS "teacherWaiting",
       (SELECT count(*)::int FROM fs JOIN deanery_question dq ON dq.student_id = fs.id WHERE dq.answer IS NULL) AS questions,
       (SELECT min(dq.created_at) FROM fs JOIN deanery_question dq ON dq.student_id = fs.id WHERE dq.answer IS NULL) AS "oldestQuestion",
       (SELECT count(*)::int FROM today_ev) AS "changesToday",
       (SELECT count(*)::int FROM notification n JOIN today_ev ON today_ev.id = n.change_event_id) AS "notifiedToday",
       (SELECT count(*)::int FROM reqs WHERE status = 'ready') AS ready,
       (SELECT count(*)::int FROM grade_proposal gp JOIN fs ON fs.id = gp.student_id WHERE gp.status = 'pending') AS proposals,
       (SELECT count(DISTINCT ga.student_id)::int FROM fs JOIN LATERAL (
          SELECT DISTINCT ON (a.course_id) a.student_id, COALESCE((SELECT c.score FROM grade_correction c WHERE c.student_id = a.student_id
            AND c.course_id = a.course_id AND c.attempt_no = a.attempt_no ORDER BY c.revision DESC LIMIT 1), a.score) AS score
          FROM grade_attempt a WHERE a.student_id = fs.id ORDER BY a.course_id, a.attempt_no DESC) ga ON ga.score < 50) AS debtors,
       (SELECT count(*)::int FROM resit JOIN fs ON fs.id = resit.student_id WHERE resit.status = 'scheduled') AS resits,
       (SELECT count(*)::int FROM fs) AS students,
       (SELECT count(*)::int FROM staff_notice n WHERE n.user_id = me.id AND n.read_at IS NULL) AS unread
     FROM me`, token, [OPEN_STATUSES, SLA_DAYS]);
  if (!row) return null;
  const oldest = await q<DeanHome["oldest"][number]>(
    `WITH ${deanScope}
     SELECT request.id, request.kind, fs.name, fs.group_name, request.created_at, request.status
     FROM fs JOIN request ON request.student_id = fs.id WHERE request.status = ANY($2)
     ORDER BY request.created_at, request.id LIMIT 4`, token, [OPEN_STATUSES]);
  return { ...row, oldest };
}

// ---------- requests ----------
export type StaffRequestRow = { id: string; kind: string; status: string; created_at: Date; name: string; group_name: string;
  student_id: string; overdue: boolean; has_pdf: boolean };

export async function staffRequests(token: string) {
  return q<StaffRequestRow>(
    `WITH ${deanScope}
     SELECT request.id, request.kind, request.status, request.created_at, fs.name, fs.group_name, fs.id AS student_id,
       (request.status = ANY($2) AND request.created_at < now() - $3 * interval '1 day') AS overdue,
       EXISTS (SELECT 1 FROM generated_document g WHERE g.request_id = request.id) AS has_pdf
     FROM fs JOIN request ON request.student_id = fs.id
     ORDER BY (request.status = ANY($2)) DESC, request.created_at, request.id`, token, [OPEN_STATUSES, SLA_DAYS]);
}

export async function requestExtras(token: string, id: string) {
  const [row] = await q<{ student_id: string; group_name: string; document_id: string | null; number: string | null }>(
    `WITH ${deanScope}
     SELECT fs.id AS student_id, fs.group_name, g.id AS document_id, g.number
     FROM fs JOIN request ON request.student_id = fs.id LEFT JOIN generated_document g ON g.request_id = request.id
     WHERE request.id = $2`, token, [id]);
  return row ?? null;
}

// ---------- students ----------
export type StudentListRow = { id: string; name: string; group_name: string; status: string | null; avg: number | null;
  debts: number; absences: number; login: string };

const studentStats = `
  (SELECT round(avg(x.score))::int FROM latest x WHERE x.student_id = fs.id) AS avg,
  (SELECT count(*)::int FROM latest x WHERE x.student_id = fs.id AND x.score < 50) AS debts,
  (SELECT count(*)::int FROM attendance at WHERE at.student_id = fs.id AND at.status = 'absent' AND NOT at.excused) AS absences`;
const latestCte = `latest AS (
  SELECT DISTINCT ON (a.student_id, a.course_id) a.student_id, a.course_id,
    COALESCE((SELECT c.score FROM grade_correction c WHERE c.student_id = a.student_id AND c.course_id = a.course_id
      AND c.attempt_no = a.attempt_no ORDER BY c.revision DESC LIMIT 1), a.score) AS score
  FROM grade_attempt a JOIN fs ON fs.id = a.student_id ORDER BY a.student_id, a.course_id, a.attempt_no DESC)`;

export async function searchStudents(token: string, text: string, group: string | null) {
  return q<StudentListRow>(
    `WITH ${deanScope}, ${latestCte}
     SELECT fs.id, fs.name, fs.group_name, p.study_status AS status, app_user.login, ${studentStats}
     FROM fs JOIN app_user ON app_user.id = fs.id LEFT JOIN student_profile p ON p.student_id = fs.id
     WHERE ($2 = '' OR fs.name ILIKE '%' || $2 || '%' OR app_user.login ILIKE '%' || $2 || '%' OR p.record_book ILIKE '%' || $2 || '%')
       AND ($3::uuid IS NULL OR fs.group_id = $3)
     ORDER BY fs.group_name, fs.name LIMIT 120`, token, [text, group]);
}

export async function facultyGroups(token: string) {
  return q<{ id: string; name: string; stream: string | null; students: number }>(
    `WITH ${deanScope}
     SELECT acad_group.id, acad_group.name, stream.name AS stream,
       (SELECT count(*)::int FROM student WHERE student.group_id = acad_group.id) AS students
     FROM me JOIN programme ON programme.faculty_id = me.faculty_id JOIN acad_group ON acad_group.programme_id = programme.id
     LEFT JOIN stream ON stream.id = acad_group.stream_id ORDER BY acad_group.name`, token);
}

export type StudentCard = {
  id: string; name: string; login: string; group_id: string; group_name: string; stream: string | null; faculty: string;
  record_book: string | null; study_status: string | null; course_year: number | null; email: string | null; phone: string | null;
  address: string | null; birth_date: string | null; study_form: string | null;
};

export async function studentCard(token: string, id: string) {
  const [card] = await q<StudentCard>(
    `WITH ${deanScope}
     SELECT fs.id, fs.name, app_user.login, fs.group_id, fs.group_name, stream.name AS stream, faculty.name AS faculty,
       p.record_book, p.study_status, p.course_year, p.email, p.phone, p.address, to_char(p.birth_date, 'DD.MM.YYYY') AS birth_date, p.study_form
     FROM fs JOIN app_user ON app_user.id = fs.id JOIN me ON true JOIN faculty ON faculty.id = me.faculty_id
     LEFT JOIN stream ON stream.id = fs.stream_id LEFT JOIN student_profile p ON p.student_id = fs.id
     WHERE fs.id = $2`, token, [id]);
  if (!card) return null;
  const [grades, absences, requests, log, sections] = await Promise.all([
    q<{ course_id: string; course: string; assessment_kind: string; attempt_no: number; score: number; note: string | null; assessed_on: string; revision: number }>(
      `WITH ${deanScope}
       SELECT course.id AS course_id, course.name AS course, course.assessment_kind, a.attempt_no, a.note,
         to_char(a.assessed_on, 'YYYY-MM-DD') AS assessed_on,
         COALESCE(c.score, a.score) AS score, COALESCE(c.revision, 0) AS revision
       FROM fs JOIN LATERAL (SELECT DISTINCT ON (ga.course_id) ga.* FROM grade_attempt ga WHERE ga.student_id = fs.id
         ORDER BY ga.course_id, ga.attempt_no DESC) a ON true
       JOIN course ON course.id = a.course_id
       LEFT JOIN LATERAL (SELECT gc.score, gc.revision FROM grade_correction gc WHERE gc.student_id = a.student_id AND gc.course_id = a.course_id
         AND gc.attempt_no = a.attempt_no ORDER BY gc.revision DESC LIMIT 1) c ON true
       WHERE fs.id = $2 ORDER BY course.name`, token, [id]),
    q<{ occurrence_id: string; course: string; starts_at: Date; status: string; excused: boolean; excuse_note: string | null }>(
      `WITH ${deanScope}
       SELECT at.occurrence_id, course.name AS course, lower(occ.slot) AS starts_at, at.status, at.excused, at.excuse_note
       FROM fs JOIN attendance at ON at.student_id = fs.id JOIN class_occurrence occ ON occ.id = at.occurrence_id
       JOIN section ON section.id = occ.section_id JOIN course ON course.id = section.course_id
       WHERE fs.id = $2 AND at.status <> 'present' ORDER BY lower(occ.slot) DESC`, token, [id]),
    q<{ id: string; kind: string; status: string; created_at: Date }>(
      `WITH ${deanScope}
       SELECT request.id, request.kind, request.status, request.created_at FROM fs JOIN request ON request.student_id = fs.id
       WHERE fs.id = $2 ORDER BY request.created_at DESC`, token, [id]),
    q<{ id: string; field: string; old_value: string | null; new_value: string | null; reason: string; created_at: Date; actor: string }>(
      `WITH ${deanScope}
       SELECT l.id, l.field, l.old_value, l.new_value, l.reason, l.created_at, COALESCE(staff.name, teacher.name, 'система') AS actor
       FROM fs JOIN student_change_log l ON l.student_id = fs.id LEFT JOIN staff ON staff.id = l.actor_id
       LEFT JOIN teacher_account ta ON ta.user_id = l.actor_id LEFT JOIN teacher ON teacher.id = ta.teacher_id
       WHERE fs.id = $2
       UNION ALL
       SELECT g.id, 'Оценка: ' || course.name, g.old_score::text, g.new_score::text, g.reason, g.created_at, COALESCE(staff.name, 'деканат')
       FROM fs JOIN grade_change g ON g.student_id = fs.id JOIN course ON course.id = g.course_id LEFT JOIN staff ON staff.id = g.actor_id
       WHERE fs.id = $2
       ORDER BY created_at DESC LIMIT 60`, token, [id]),
    q<{ section_id: string; course_id: string; course: string; kind: string; title: string }>(
      `WITH ${deanScope}
       SELECT section.id AS section_id, course.id AS course_id, course.name AS course, section.kind, ${sectionTitle()} AS title
       FROM fs JOIN section_member m ON m.student_id = fs.id JOIN section ON section.id = m.section_id
       LEFT JOIN acad_group sg ON sg.id = section.group_id JOIN course ON course.id = section.course_id
       WHERE fs.id = $2 ORDER BY section.kind, course.name`, token, [id]),
  ]);
  return { card, grades, absences, requests, log, sections };
}

// ---------- news targets ----------
export async function newsTargets(token: string) {
  return q<{ scope: "stream" | "group" | "section"; id: string; title: string }>(
    `WITH ${deanScope}
     SELECT 'stream' AS scope, stream.id, 'Поток ' || stream.name AS title FROM me JOIN programme ON programme.faculty_id = me.faculty_id
       JOIN stream ON stream.programme_id = programme.id
     UNION ALL
     SELECT 'group', acad_group.id, 'Группа ' || acad_group.name FROM me JOIN programme ON programme.faculty_id = me.faculty_id
       JOIN acad_group ON acad_group.programme_id = programme.id
     UNION ALL
     SELECT 'section', section.id, 'Языковая группа ' || sg.name || '/' || section.lang_no FROM me JOIN course ON course.faculty_id = me.faculty_id
       JOIN section ON section.course_id = course.id AND section.kind = 'language' JOIN acad_group sg ON sg.id = section.group_id
     ORDER BY 1 DESC, 3`, token);
}

export async function staffNewsTargeted(token: string) {
  return q<{ id: string; title: string; body: string; published_at: Date; target: string | null }>(
    `WITH ${deanScope}
     SELECT a.id, a.title, a.body, a.published_at,
       CASE t.scope WHEN 'stream' THEN 'Поток ' || (SELECT name FROM stream WHERE id = t.target_id)
         WHEN 'group' THEN 'Группа ' || (SELECT name FROM acad_group WHERE id = t.target_id)
         WHEN 'section' THEN (SELECT 'Языковая группа ' || g.name || '/' || s.lang_no FROM section s JOIN acad_group g ON g.id = s.group_id WHERE s.id = t.target_id)
         ELSE NULL END AS target
     FROM me JOIN announcement a ON a.faculty_id = me.faculty_id LEFT JOIN announcement_target t ON t.announcement_id = a.id
     ORDER BY a.published_at DESC LIMIT 50`, token);
}

// ---------- the dean's own notices ----------
export async function myNotices(token: string) {
  return q<{ id: string; kind: string; payload: Record<string, string | number | null>; created_at: Date; read_at: Date | null }>(
    `SELECT n.id, n.kind, n.payload, n.created_at, n.read_at FROM session JOIN staff_notice n ON n.user_id = session.user_id
     WHERE session.token_hash = $1 AND session.expires_at > now() ORDER BY n.created_at DESC LIMIT 40`, token);
}

/** the generated PDF of a request, if the reader may see it: the student it belongs to, or staff of their faculty */
export async function documentPdf(token: string, id: string) {
  const { rows } = await db.query<{ pdf: Buffer; number: string }>(
    `SELECT g.pdf, g.number FROM session JOIN generated_document g ON g.id = $2
     JOIN student ON student.id = g.student_id JOIN acad_group ON acad_group.id = student.group_id
     JOIN programme ON programme.id = acad_group.programme_id
     WHERE session.token_hash = $1 AND session.expires_at > now()
       AND (session.user_id = g.student_id OR EXISTS (SELECT 1 FROM staff WHERE staff.id = session.user_id AND staff.faculty_id = programme.faculty_id))`,
    [digest(token), id]);
  return rows[0] ?? null;
}
