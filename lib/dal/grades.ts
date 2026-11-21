import { db } from "../db";
import { digest } from "./session";

export async function gradeRoster(token: string) {
  const { rows } = await db.query<{
    student_id: string; course_id: string; student_name: string; course_name: string;
    attempts: { number: number; score: number; revision: number }[];
  }>(
    `SELECT student.id AS student_id, course.id AS course_id,
       student.name AS student_name, course.name AS course_name,
       COALESCE(jsonb_agg(jsonb_build_object('number', attempt.attempt_no,
         'score', COALESCE(correction.score, attempt.score),
         'revision', COALESCE(correction.revision, 0)) ORDER BY attempt.attempt_no)
         FILTER (WHERE attempt.attempt_no IS NOT NULL), '[]'::jsonb) AS attempts
     FROM session JOIN staff ON staff.id = session.user_id
     JOIN course ON course.faculty_id = staff.faculty_id
     JOIN enrolment ON enrolment.course_id = course.id
     JOIN student ON student.id = enrolment.student_id
     LEFT JOIN grade_attempt attempt ON attempt.student_id = student.id AND attempt.course_id = course.id
     LEFT JOIN LATERAL (
       SELECT score, revision FROM grade_correction
       WHERE student_id = attempt.student_id AND course_id = attempt.course_id AND attempt_no = attempt.attempt_no
       ORDER BY revision DESC LIMIT 1
     ) correction ON true
     WHERE session.token_hash = $1 AND session.expires_at > now()
     GROUP BY student.id, course.id ORDER BY course.name, student.name, student.id`,
    [digest(token)],
  );
  return rows;
}
