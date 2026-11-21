// Read model for the «Большие цифры» student UI.
// Same rule as Codex's DAL: every query starts from the session token, so a student only ever
// reads rows tied to their own session (no id from the URL is trusted on its own).
import { db } from "../db";
import { digest } from "./session";
import { requestScope } from "./requests";
import type { Status } from "../request-types";

const principal = `session.token_hash = $1 AND session.expires_at > now()`;

export type StudentProfile = {
  id: string; name: string; login: string; group_name: string; programme: string; faculty: string;
  record_book: string | null; study_level: string | null; profile_name: string | null; study_form: string | null;
  admission_year: number | null; course_year: number | null; study_status: string | null;
  email: string | null; gender: string | null; birth_date: string | null; phone: string | null; address: string | null;
};

export async function studentProfile(token: string) {
  const { rows } = await db.query<StudentProfile>(
    `SELECT student.id, student.name, app_user.login, acad_group.name AS group_name, programme.name AS programme,
       faculty.name AS faculty, p.record_book, p.study_level, p.profile_name, p.study_form, p.admission_year,
       p.course_year, p.study_status, p.email, p.gender, to_char(p.birth_date, 'DD.MM.YYYY') AS birth_date, p.phone, p.address
     FROM session JOIN student ON student.id = session.user_id
     JOIN app_user ON app_user.id = student.id
     JOIN acad_group ON acad_group.id = student.group_id
     JOIN programme ON programme.id = acad_group.programme_id
     JOIN faculty ON faculty.id = programme.faculty_id
     LEFT JOIN student_profile p ON p.student_id = student.id
     WHERE ${principal}`,
    [digest(token)],
  );
  return rows[0] ?? null;
}

export type ClassRow = {
  id: string; status: "scheduled" | "moved" | "cancelled"; is_exam: boolean; course: string; kind: string;
  room: string; original_room: string | null; teacher: string; starts_at: Date; ends_at: Date;
  original_start: Date | null; original_end: Date | null; reason: string | null; group_name: string;
};

const classSelect = `
  SELECT occ.id, occ.status, occ.is_exam, course.name AS course, section.label AS kind,
    room.name AS room, old_room.name AS original_room, teacher.name AS teacher,
    lower(occ.slot) AS starts_at, upper(occ.slot) AS ends_at,
    lower(occ.original_slot) AS original_start, upper(occ.original_slot) AS original_end,
    (SELECT event.payload->>'reason' FROM change_event event
      WHERE event.kind = 'class_status' AND event.entity_id = occ.id
      ORDER BY event.created_at DESC LIMIT 1) AS reason,
    acad_group.name AS group_name
  FROM session
  JOIN student ON student.id = session.user_id
  JOIN acad_group ON acad_group.id = student.group_id
  JOIN section_member member ON member.student_id = student.id
  JOIN section ON section.id = member.section_id
  JOIN course ON course.id = section.course_id
  JOIN class_occurrence occ ON occ.section_id = section.id
  JOIN room ON room.id = occ.room_id
  LEFT JOIN room old_room ON old_room.id = occ.original_room_id
  JOIN teacher ON teacher.id = occ.teacher_id
  WHERE ${principal}`;

/** the student's classes that overlap [from, to) */
export async function classesBetween(token: string, from: string, to: string) {
  const { rows } = await db.query<ClassRow>(
    `${classSelect} AND occ.slot && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     ORDER BY lower(occ.slot), occ.id`,
    [digest(token), from, to],
  );
  return rows;
}

export async function classById(token: string, id: string) {
  const { rows } = await db.query<ClassRow>(`${classSelect} AND occ.id = $2`, [digest(token), id]);
  return rows[0] ?? null;
}

/** the next class that has not started yet and is not cancelled */
export async function nextClass(token: string) {
  const { rows } = await db.query<ClassRow>(
    `${classSelect} AND occ.status <> 'cancelled' AND lower(occ.slot) > now()
     ORDER BY lower(occ.slot), occ.id LIMIT 1`,
    [digest(token)],
  );
  return rows[0] ?? null;
}

/** days (YYYY-MM-DD, Moscow) in [from, to) that have a changed or cancelled class */
export async function changedDays(token: string, from: string, to: string) {
  const { rows } = await db.query<{ day: string }>(
    `SELECT DISTINCT to_char(lower(occ.slot) AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD') AS day
     FROM session JOIN section_member member ON member.student_id = session.user_id
     JOIN class_occurrence occ ON occ.section_id = member.section_id
     WHERE ${principal} AND occ.status <> 'scheduled'
       AND occ.slot && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
    [digest(token), from, to],
  );
  return new Set(rows.map((r) => r.day));
}

export type GradeRow = { course_id: string; course: string; assessment_kind: "credit" | "exam"; score: number; note: string | null; assessed_on: string; attempts: number };

/** latest score per course (Codex's corrections applied) */
export async function grades(token: string) {
  const { rows } = await db.query<GradeRow>(
    `SELECT course.id AS course_id, course.name AS course, course.assessment_kind,
       latest.score, latest.note, to_char(latest.assessed_on, 'YYYY-MM-DD') AS assessed_on, latest.attempts
     FROM session JOIN enrolment ON enrolment.student_id = session.user_id
     JOIN course ON course.id = enrolment.course_id
     JOIN LATERAL (
       SELECT COALESCE((SELECT c.score FROM grade_correction c
                 WHERE c.student_id = a.student_id AND c.course_id = a.course_id AND c.attempt_no = a.attempt_no
                 ORDER BY c.revision DESC LIMIT 1), a.score) AS score,
         a.note, a.assessed_on, count(*) OVER () AS attempts
       FROM grade_attempt a WHERE a.student_id = enrolment.student_id AND a.course_id = enrolment.course_id
       ORDER BY a.attempt_no DESC LIMIT 1
     ) latest ON true
     WHERE ${principal}
     ORDER BY latest.score DESC, course.name`,
    [digest(token)],
  );
  return rows.map((r) => ({ ...r, attempts: Number(r.attempts) }));
}

export type ExamRow = { id: string; course: string; assessment_kind: "credit" | "exam"; room: string; starts_at: Date; status: string };

export async function exams(token: string) {
  const { rows } = await db.query<ExamRow>(
    `SELECT occ.id, course.name AS course, course.assessment_kind, room.name AS room, lower(occ.slot) AS starts_at, occ.status
     FROM session JOIN section_member member ON member.student_id = session.user_id
     JOIN section ON section.id = member.section_id
     JOIN course ON course.id = section.course_id
     JOIN class_occurrence occ ON occ.section_id = section.id AND occ.is_exam
     JOIN room ON room.id = occ.room_id
     WHERE ${principal} AND upper(occ.slot) > now()
     ORDER BY lower(occ.slot), occ.id`,
    [digest(token)],
  );
  return rows;
}

export type PlagRow = { id: string; title: string; deadline: string; threshold: number; originality: number | null;
  status: "waiting" | "accepted" | "below"; filename: string | null; days_left: number };

export async function plagiarismWorks(token: string) {
  const { rows } = await db.query<PlagRow>(
    `SELECT w.id, w.title, to_char(w.deadline, 'YYYY-MM-DD') AS deadline, w.threshold, w.originality, w.status, w.filename,
       w.deadline - (now() AT TIME ZONE 'Europe/Moscow')::date AS days_left
     FROM session JOIN plagiarism_work w ON w.student_id = session.user_id
     WHERE ${principal}
     ORDER BY (w.status = 'waiting') DESC, w.deadline, w.id`,
    [digest(token)],
  );
  return rows;
}

export async function documents(token: string) {
  const { rows } = await db.query<{ id: string; title: string; issued_on: string; kind: string; file_format: string; generated_id: string | null }>(
    `SELECT d.id, d.title, to_char(d.issued_on, 'YYYY-MM-DD') AS issued_on, d.kind, d.file_format, d.generated_id
     FROM session JOIN issued_document d ON d.student_id = session.user_id
     WHERE ${principal} ORDER BY d.issued_on DESC, d.id`,
    [digest(token)],
  );
  return rows;
}

/** Moodle deadlines and the assignments the student's teachers set in the app (source 'teacher') */
export async function moodleTasks(token: string) {
  const { rows } = await db.query<{ id: string; course: string; title: string; due_on: string; days_left: number; source: "moodle" | "teacher"; plagiarism: boolean }>(
    `SELECT * FROM (
       SELECT t.id, course.name AS course, t.title, to_char(t.due_on, 'YYYY-MM-DD') AS due_on,
         t.due_on - (now() AT TIME ZONE 'Europe/Moscow')::date AS days_left, 'moodle' AS source, false AS plagiarism
       FROM session JOIN enrolment ON enrolment.student_id = session.user_id
       JOIN moodle_task t ON t.course_id = enrolment.course_id
       JOIN course ON course.id = t.course_id
       WHERE ${principal} AND t.due_on >= (now() AT TIME ZONE 'Europe/Moscow')::date
       UNION ALL
       SELECT x.id, course.name, x.title, to_char(x.due_on, 'YYYY-MM-DD'), x.due_on - (now() AT TIME ZONE 'Europe/Moscow')::date, 'teacher', x.plagiarism
       FROM session JOIN section_member m ON m.student_id = session.user_id
       JOIN assignment x ON x.section_id = m.section_id JOIN section ON section.id = x.section_id JOIN course ON course.id = section.course_id
       WHERE ${principal} AND x.due_on >= (now() AT TIME ZONE 'Europe/Moscow')::date
     ) d ORDER BY d.due_on, d.id`,
    [digest(token)],
  );
  return rows;
}

export type QuestionRow = { id: string; topic: string; body: string; created_at: Date; answer: string | null; answered_at: Date | null };

export async function questions(token: string) {
  const { rows } = await db.query<QuestionRow>(
    `SELECT q.id, q.topic, q.body, q.created_at, q.answer, q.answered_at
     FROM session JOIN deanery_question q ON q.student_id = session.user_id
     WHERE ${principal} ORDER BY q.created_at, q.id`,
    [digest(token)],
  );
  return rows;
}

export type Notice = {
  id: string; entity_id: string; created_at: Date; read_at: Date | null;
  kind: "request_status" | "class_status" | "announcement" | "grade_changed" | "question_answered"
    | "assignment" | "group_message" | "record_changed" | "resit_assigned";
  payload: Record<string, string | number | boolean | null>;
  request_kind: string | null;
};

// the student's own submission also creates a request_status event (before = null): not news to them
const visibleNotice = `event.kind IN ('request_status','class_status','announcement','grade_changed','question_answered',
    'assignment','group_message','record_changed','resit_assigned')
  AND NOT (event.kind = 'request_status' AND event.payload->>'before' IS NULL)`;

export async function notifications(token: string) {
  const { rows } = await db.query<Notice>(
    `SELECT notification.id, notification.read_at, event.entity_id, event.created_at, event.kind, event.payload,
       request.kind AS request_kind
     FROM session JOIN notification ON notification.student_id = session.user_id
     JOIN change_event event ON event.id = notification.change_event_id
     LEFT JOIN request ON event.kind = 'request_status' AND request.id = event.entity_id
     WHERE ${principal} AND ${visibleNotice}
     ORDER BY event.created_at DESC, notification.id DESC LIMIT 50`,
    [digest(token)],
  );
  return rows;
}

export async function unreadCount(token: string) {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM session JOIN notification ON notification.student_id = session.user_id
     JOIN change_event event ON event.id = notification.change_event_id
     WHERE ${principal} AND notification.read_at IS NULL AND ${visibleNotice}`,
    [digest(token)],
  );
  return rows[0]?.n ?? 0;
}

export type RequestRow = { id: string; kind: string; status: Status; version: number; message: string;
  created_at: Date; name: string; last_note: string | null; updated_at: Date };

/** Codex's requestScope: a student sees only their own requests, staff only their faculty's */
export async function requestList(token: string, mode: "student" | "staff", id?: string) {
  const { rows } = await db.query<RequestRow>(
    `SELECT request.id, request.kind, request.status, request.version, request.message, request.created_at, student.name,
       (SELECT e.message FROM request_event e WHERE e.request_id = request.id AND e.version > 0
         ORDER BY e.version DESC LIMIT 1) AS last_note,
       COALESCE((SELECT max(e.created_at) FROM request_event e WHERE e.request_id = request.id), request.created_at) AS updated_at
     ${requestScope} AND ($3::uuid IS NULL OR request.id = $3)
     ORDER BY request.created_at DESC, request.id`,
    [digest(token), mode, id ?? null],
  );
  return rows;
}

export async function requestHistory(token: string, mode: "student" | "staff", id: string) {
  const { rows } = await db.query<{ status: Status; message: string; version: number; created_at: Date }>(
    `SELECT e.status, e.message, e.version, e.created_at FROM request_event e
     WHERE e.request_id IN (SELECT request.id ${requestScope} AND request.id = $3)
     ORDER BY e.version`,
    [digest(token), mode, id],
  );
  return rows;
}

export type NewsRow = { id: string; title: string; body: string; published_at: Date; author: string };

export async function news(token: string, id?: string) {
  const { rows } = await db.query<NewsRow>(
    `SELECT a.id, a.title, a.body, a.published_at, 'Деканат' AS author
     FROM session JOIN student ON student.id = session.user_id
     JOIN acad_group ON acad_group.id = student.group_id
     JOIN programme ON programme.id = acad_group.programme_id
     JOIN announcement a ON a.faculty_id = programme.faculty_id
     LEFT JOIN announcement_target t ON t.announcement_id = a.id
     WHERE ${principal} AND ($2::uuid IS NULL OR a.id = $2)
       AND (t.scope IS NULL OR t.scope = 'faculty' OR (t.scope = 'stream' AND t.target_id = acad_group.stream_id)
         OR (t.scope = 'group' AND t.target_id = acad_group.id)
         OR (t.scope = 'section' AND EXISTS (SELECT 1 FROM section_member m WHERE m.section_id = t.target_id AND m.student_id = student.id)))
     ORDER BY a.published_at DESC, a.id LIMIT 50`,
    [digest(token), id ?? null],
  );
  return rows;
}

export type AttendanceSummary = { marked: number; absent: number; excused: number; late: number;
  courses: { course: string; absent: number; excused: number }[] };

/** the student's attendance as the teachers marked it (the dean may excuse absences) */
export async function attendance(token: string): Promise<AttendanceSummary> {
  const { rows } = await db.query<{ course: string; marked: number; absent: number; excused: number; late: number }>(
    `SELECT course.name AS course, count(*)::int AS marked, count(*) FILTER (WHERE a.status = 'absent')::int AS absent,
       count(*) FILTER (WHERE a.status = 'absent' AND a.excused)::int AS excused, count(*) FILTER (WHERE a.status = 'late')::int AS late
     FROM session JOIN attendance a ON a.student_id = session.user_id JOIN class_occurrence o ON o.id = a.occurrence_id
     JOIN section ON section.id = o.section_id JOIN course ON course.id = section.course_id
     WHERE ${principal} GROUP BY course.name ORDER BY count(*) FILTER (WHERE a.status = 'absent') DESC, course.name`,
    [digest(token)],
  );
  const sum = (k: "marked" | "absent" | "excused" | "late") => rows.reduce((s, r) => s + r[k], 0);
  return { marked: sum("marked"), absent: sum("absent"), excused: sum("excused"), late: sum("late"),
    courses: rows.filter((r) => r.absent > 0).map((r) => ({ course: r.course, absent: r.absent, excused: r.excused })) };
}
