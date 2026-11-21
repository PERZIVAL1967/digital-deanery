// Read model of the teacher's cabinet. Every query starts from the session: `tme` is the signed-in teacher,
// `mine` the sections they teach (any non-cancelled class of theirs, Codex's teacherSections rule).
import { db } from "../db";
import { digest } from "./session";
import { sectionTitle } from "./staff";

export const teacherScope = `
  tme AS (SELECT teacher_account.user_id, teacher_account.teacher_id FROM session
          JOIN teacher_account ON teacher_account.user_id = session.user_id
          WHERE session.token_hash = $1 AND session.expires_at > now()),
  mine AS (SELECT DISTINCT section.id FROM tme JOIN class_occurrence o ON o.teacher_id = tme.teacher_id AND o.status <> 'cancelled'
           JOIN section ON section.id = o.section_id)`;

const q = async <T extends object>(sql: string, token: string, args: unknown[] = []) =>
  (await db.query<T & Record<string, unknown>>(sql, [digest(token), ...args])).rows as T[];

export type TClass = { id: string; section_id: string; course: string; section: string; kind: string; room: string; original_room: string | null;
  starts_at: Date; ends_at: Date; original_start: Date | null; status: "scheduled" | "moved" | "cancelled"; is_exam: boolean;
  students: number; marked: number; absent: number };

const classSelect = `
  SELECT o.id, section.id AS section_id, course.name AS course, ${sectionTitle()} AS section, section.kind, room.name AS room,
    old.name AS original_room, lower(o.slot) AS starts_at, upper(o.slot) AS ends_at, lower(o.original_slot) AS original_start, o.status, o.is_exam,
    (SELECT count(*)::int FROM section_member m WHERE m.section_id = section.id) AS students,
    (SELECT count(*)::int FROM attendance a WHERE a.occurrence_id = o.id) AS marked,
    (SELECT count(*)::int FROM attendance a WHERE a.occurrence_id = o.id AND a.status = 'absent') AS absent
  FROM tme JOIN class_occurrence o ON o.teacher_id = tme.teacher_id
  JOIN section ON section.id = o.section_id LEFT JOIN acad_group sg ON sg.id = section.group_id
  JOIN course ON course.id = section.course_id JOIN room ON room.id = o.room_id LEFT JOIN room old ON old.id = o.original_room_id`;

/** my classes that overlap [from, to) */
export async function myClasses(token: string, from: string, to: string) {
  return q<TClass>(`WITH ${teacherScope} ${classSelect}
    WHERE o.slot && tstzrange($2::timestamptz, $3::timestamptz, '[)') ORDER BY lower(o.slot), o.id`, token, [from, to]);
}

export async function myClass(token: string, id: string) {
  return (await q<TClass>(`WITH ${teacherScope} ${classSelect} WHERE o.id = $2`, token, [id]))[0] ?? null;
}

export type RosterRow = { student_id: string; name: string; status: string | null; excused: boolean; absences: number };

/** the roster of my class with today's marks; total unexcused absences of each student in this course */
export async function classRoster(token: string, id: string) {
  return q<RosterRow>(
    `WITH ${teacherScope}
     SELECT student.id AS student_id, student.name, a.status, COALESCE(a.excused, false) AS excused,
       (SELECT count(*)::int FROM attendance a2 JOIN class_occurrence o2 ON o2.id = a2.occurrence_id JOIN section s2 ON s2.id = o2.section_id
         WHERE a2.student_id = student.id AND s2.course_id = section.course_id AND a2.status = 'absent' AND NOT a2.excused) AS absences
     FROM tme JOIN class_occurrence o ON o.teacher_id = tme.teacher_id AND o.id = $2
     JOIN section ON section.id = o.section_id JOIN section_member m ON m.section_id = section.id
     JOIN student ON student.id = m.student_id LEFT JOIN attendance a ON a.occurrence_id = o.id AND a.student_id = student.id
     ORDER BY student.name, student.id`, token, [id]);
}

export type MySection = { id: string; course_id: string; course: string; title: string; kind: string; students: number };

export async function mySections(token: string) {
  return q<MySection>(
    `WITH ${teacherScope}
     SELECT section.id, course.id AS course_id, course.name AS course, ${sectionTitle()} AS title, section.kind,
       (SELECT count(*)::int FROM section_member m WHERE m.section_id = section.id) AS students
     FROM mine JOIN section ON section.id = mine.id LEFT JOIN acad_group sg ON sg.id = section.group_id
     JOIN course ON course.id = section.course_id
     ORDER BY course.name, (section.kind = 'lecture') DESC, sg.name, section.lang_no`, token);
}

export type Journal = {
  section: MySection;
  assessments: { id: string; title: string; held_on: string; assignment: boolean }[];
  students: { id: string; name: string; login: string; absences: number }[];
  marks: Record<string, number>; // `${assessment}|${student}` -> score
  pending: Record<string, number>; // proposals waiting for the dean
};

/** the grid of one of my sections: students x assessments. null if the section is not mine (no hint it exists) */
export async function journal(token: string, sectionId: string): Promise<Journal | null> {
  const section = (await mySections(token)).find((s) => s.id === sectionId);
  if (!section) return null;
  const [assessments, students, marks, pending] = await Promise.all([
    q<Journal["assessments"][number]>(
      `WITH ${teacherScope}
       SELECT a.id, a.title, to_char(a.held_on, 'YYYY-MM-DD') AS held_on, EXISTS (SELECT 1 FROM assignment x WHERE x.assessment_id = a.id) AS assignment
       FROM mine JOIN assessment a ON a.section_id = mine.id WHERE mine.id = $2 ORDER BY a.held_on, a.position, a.created_at`, token, [sectionId]),
    q<Journal["students"][number]>(
      `WITH ${teacherScope}
       SELECT student.id, student.name, app_user.login,
         (SELECT count(*)::int FROM attendance a2 JOIN class_occurrence o2 ON o2.id = a2.occurrence_id
           WHERE a2.student_id = student.id AND o2.section_id = mine.id AND a2.status = 'absent' AND NOT a2.excused) AS absences
       FROM mine JOIN section_member m ON m.section_id = mine.id JOIN student ON student.id = m.student_id
       JOIN app_user ON app_user.id = student.id WHERE mine.id = $2 ORDER BY student.name, student.id`, token, [sectionId]),
    q<{ k: string; score: number }>(
      `WITH ${teacherScope}
       SELECT am.assessment_id || '|' || am.student_id AS k, am.score FROM mine JOIN assessment a ON a.section_id = mine.id
       JOIN assessment_mark am ON am.assessment_id = a.id WHERE mine.id = $2`, token, [sectionId]),
    q<{ k: string; score: number }>(
      `WITH ${teacherScope}
       SELECT gp.assessment_id || '|' || gp.student_id AS k, gp.new_score AS score FROM mine JOIN assessment a ON a.section_id = mine.id
       JOIN grade_proposal gp ON gp.assessment_id = a.id AND gp.status = 'pending' WHERE mine.id = $2`, token, [sectionId]),
  ]);
  return { section, assessments, students, marks: Object.fromEntries(marks.map((m) => [m.k, m.score])),
    pending: Object.fromEntries(pending.map((m) => [m.k, m.score])) };
}

export async function myNotices(token: string) {
  return q<{ id: string; kind: string; payload: Record<string, string | number | null>; created_at: Date; read_at: Date | null }>(
    `WITH ${teacherScope}
     SELECT n.id, n.kind, n.payload, n.created_at, n.read_at FROM tme JOIN staff_notice n ON n.user_id = tme.user_id
     ORDER BY n.created_at DESC LIMIT 40`, token);
}

/** numbers of the teacher's home */
export async function teacherHomeCounts(token: string) {
  const [row] = await q<{ to_mark: number; absent_today: number; unread: number; resits: number; sections: number }>(
    `WITH ${teacherScope}
     SELECT
       (SELECT count(*)::int FROM mine JOIN assignment x ON x.section_id = mine.id JOIN plagiarism_work w ON w.assignment_id = x.id
         WHERE w.uploaded_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assessment_mark am WHERE am.assessment_id = x.assessment_id AND am.student_id = w.student_id)) AS to_mark,
       (SELECT count(*)::int FROM tme t2 JOIN class_occurrence o ON o.teacher_id = t2.teacher_id JOIN attendance a ON a.occurrence_id = o.id
         WHERE a.status = 'absent' AND (lower(o.slot) AT TIME ZONE 'Europe/Moscow')::date = (now() AT TIME ZONE 'Europe/Moscow')::date) AS absent_today,
       (SELECT count(*)::int FROM tme t3 JOIN staff_notice n ON n.user_id = t3.user_id WHERE n.read_at IS NULL) AS unread,
       (SELECT count(*)::int FROM tme t4 JOIN resit r ON r.examiner_id = t4.teacher_id WHERE r.status = 'scheduled') AS resits,
       (SELECT count(*)::int FROM mine) AS sections
     FROM tme`, token);
  return row ?? null;
}
