import { db } from "../db";
import { digest } from "./session";

export async function announcements(token: string, role: "student" | "staff") {
  const { rows } = await db.query<{ id: string; title: string; body: string; published_at: Date }>(
    `WITH scope AS (
       SELECT programme.faculty_id FROM session
       JOIN student ON student.id = session.user_id
       JOIN acad_group ON acad_group.id = student.group_id
       JOIN programme ON programme.id = acad_group.programme_id
       WHERE session.token_hash = $1 AND session.expires_at > now() AND $2 = 'student'
       UNION
       SELECT staff.faculty_id FROM session JOIN staff ON staff.id = session.user_id
       WHERE session.token_hash = $1 AND session.expires_at > now() AND $2 = 'staff'
     )
     SELECT id, title, body, published_at FROM announcement JOIN scope USING (faculty_id)
     ORDER BY published_at DESC, id LIMIT 50`,
    [digest(token), role],
  );
  return rows;
}

export async function deadlines(token: string) {
  const { rows } = await db.query<{ id: string; title: string; course: string; due_at: Date; days: number }>(
    `SELECT deadline.id, deadline.title, course.name AS course, deadline.due_at,
       (deadline.due_at AT TIME ZONE 'Europe/Moscow')::date -
       (now() AT TIME ZONE 'Europe/Moscow')::date AS days
     FROM session JOIN enrolment ON enrolment.student_id = session.user_id
     JOIN deadline ON deadline.course_id = enrolment.course_id
     JOIN course ON course.id = enrolment.course_id
     WHERE session.token_hash = $1 AND session.expires_at > now() AND deadline.due_at >= now()
     ORDER BY deadline.due_at, deadline.id LIMIT 50`,
    [digest(token)],
  );
  return rows;
}

export async function staffDeadlines(token: string) {
  const { rows } = await db.query<{
    course_id: string; course: string; id: string | null; title: string | null;
    due_local: string | null; version: number | null;
  }>(
    `SELECT course.id AS course_id, course.name AS course, deadline.id,
       deadline.title, deadline.version,
       to_char(deadline.due_at AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD"T"HH24:MI') AS due_local
     FROM session JOIN staff ON staff.id = session.user_id
     JOIN course ON course.faculty_id = staff.faculty_id
     LEFT JOIN deadline ON deadline.course_id = course.id
     WHERE session.token_hash = $1 AND session.expires_at > now()
     ORDER BY course.name, course.id, deadline.due_at, deadline.id`,
    [digest(token)],
  );
  return rows;
}
