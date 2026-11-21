// Read model for the dean's office (staff) and teacher cabinets. Scoped by the session, like Codex's DAL.
import { db } from "../db";
import { digest } from "./session";
import { teacherSections } from "./teacher-grades";

const principal = `session.token_hash = $1 AND session.expires_at > now()`;

export type StaffClass = {
  id: string; version: number; status: "scheduled" | "moved" | "cancelled"; is_exam: boolean;
  course: string; kind: string; room: string; original_room: string | null; teacher: string;
  starts_at: Date; ends_at: Date; original_start: Date | null; students: number; groups: string | null;
};

/** classes of the staff member's faculty that overlap [from, to) */
export async function staffClasses(token: string, from: string, to: string) {
  const { rows } = await db.query<StaffClass>(
    `SELECT occ.id, occ.version, occ.status, occ.is_exam, course.name AS course, section.label AS kind,
       room.name AS room, old_room.name AS original_room, teacher.name AS teacher,
       lower(occ.slot) AS starts_at, upper(occ.slot) AS ends_at, lower(occ.original_slot) AS original_start,
       (SELECT count(*)::int FROM section_member m WHERE m.section_id = section.id) AS students,
       (SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name) FROM section_member m JOIN student st ON st.id = m.student_id
         JOIN acad_group g ON g.id = st.group_id WHERE m.section_id = section.id) AS groups
     FROM session JOIN staff ON staff.id = session.user_id
     JOIN course ON course.faculty_id = staff.faculty_id
     JOIN section ON section.course_id = course.id
     JOIN class_occurrence occ ON occ.section_id = section.id
     JOIN room ON room.id = occ.room_id
     LEFT JOIN room old_room ON old_room.id = occ.original_room_id
     JOIN teacher ON teacher.id = occ.teacher_id
     WHERE ${principal} AND occ.slot && tstzrange($2::timestamptz, $3::timestamptz, '[)')
     ORDER BY lower(occ.slot), occ.id`,
    [digest(token), from, to],
  );
  return rows;
}

export type StaffQuestion = { id: string; student: string; group_name: string; topic: string; body: string;
  created_at: Date; answer: string | null; answered_at: Date | null };

export async function staffQuestions(token: string) {
  const { rows } = await db.query<StaffQuestion>(
    `SELECT q.id, student.name AS student, acad_group.name AS group_name, q.topic, q.body, q.created_at, q.answer, q.answered_at
     FROM session JOIN staff ON staff.id = session.user_id
     JOIN programme ON programme.faculty_id = staff.faculty_id
     JOIN acad_group ON acad_group.programme_id = programme.id
     JOIN student ON student.group_id = acad_group.id
     JOIN deanery_question q ON q.student_id = student.id
     WHERE ${principal}
     ORDER BY (q.answer IS NULL) DESC, q.created_at DESC, q.id`,
    [digest(token)],
  );
  return rows;
}

export async function staffNews(token: string) {
  const { rows } = await db.query<{ id: string; title: string; body: string; published_at: Date }>(
    `SELECT a.id, a.title, a.body, a.published_at
     FROM session JOIN staff ON staff.id = session.user_id
     JOIN announcement a ON a.faculty_id = staff.faculty_id
     WHERE ${principal} ORDER BY a.published_at DESC, a.id LIMIT 50`,
    [digest(token)],
  );
  return rows;
}

export type TeacherRosterRow = {
  section_id: string; course_id: string; course: string; section: string; student_id: string;
  student: string; login: string; score: number | null; note: string | null; assessed_on: string | null;
};

/** every section the teacher teaches (Codex's teacherSections scope) with its roster and latest scores */
export async function teacherRoster(token: string) {
  const { rows } = await db.query<TeacherRosterRow>(
    `WITH mine AS (SELECT DISTINCT section.id, course.id AS course_id, course.name AS course, section.label ${teacherSections})
     SELECT mine.id AS section_id, mine.course_id, mine.course, mine.label AS section, student.id AS student_id,
       student.name AS student, app_user.login, latest.score, latest.note, to_char(latest.assessed_on, 'YYYY-MM-DD') AS assessed_on
     FROM mine JOIN section_member member ON member.section_id = mine.id
     JOIN student ON student.id = member.student_id
     JOIN app_user ON app_user.id = student.id
     LEFT JOIN LATERAL (
       SELECT COALESCE((SELECT c.score FROM grade_correction c
                 WHERE c.student_id = a.student_id AND c.course_id = a.course_id AND c.attempt_no = a.attempt_no
                 ORDER BY c.revision DESC LIMIT 1), a.score) AS score, a.note, a.assessed_on
       FROM grade_attempt a WHERE a.student_id = student.id AND a.course_id = mine.course_id
       ORDER BY a.attempt_no DESC LIMIT 1
     ) latest ON true
     ORDER BY mine.course, mine.label, student.name, student.id`,
    [digest(token)],
  );
  return rows;
}
