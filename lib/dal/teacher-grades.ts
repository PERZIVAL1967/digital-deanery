import { db } from "../db";
import { digest } from "./session";

export const teacherSections = `
  FROM session
  JOIN teacher_account ON teacher_account.user_id = session.user_id
  JOIN class_occurrence ON class_occurrence.teacher_id = teacher_account.teacher_id
  JOIN section ON section.id = class_occurrence.section_id
  JOIN course ON course.id = section.course_id
  WHERE session.token_hash = $1 AND session.expires_at > now()
    AND class_occurrence.status <> 'cancelled'`;

export async function importSections(token: string) {
  return (await db.query<{ id: string; course: string; label: string }>(
    `SELECT DISTINCT section.id, course.name AS course, section.label ${teacherSections}
     ORDER BY course, section.label, section.id`, [digest(token)],
  )).rows;
}

export async function importRoster(token: string, section: string) {
  return (await db.query<{ login: string; name: string }>(
    `SELECT app_user.login, student.name FROM section_member
     JOIN student ON student.id = section_member.student_id
     JOIN app_user ON app_user.id = student.id
     WHERE section_member.section_id = $2 AND EXISTS (
       SELECT 1 ${teacherSections} AND section.id = $2
     ) ORDER BY app_user.login`, [digest(token), section],
  )).rows;
}
