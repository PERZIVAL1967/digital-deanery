import { db } from "../db";
import { digest } from "./session";

type Attempt = { number: number; score: number; date: string };
type CourseResult = { id: string; name: string; credits: string; assessment_kind: "credit" | "exam"; attempts: Attempt[] };

export async function results(token: string) {
  const { rows } = await db.query<CourseResult>(
    `SELECT course.id, course.name, course.credits, course.assessment_kind,
       COALESCE(jsonb_agg(jsonb_build_object('number', attempt.attempt_no,
         'score', COALESCE(correction.score, attempt.score), 'date', attempt.assessed_on) ORDER BY attempt.attempt_no)
         FILTER (WHERE attempt.attempt_no IS NOT NULL), '[]'::jsonb) AS attempts
     FROM session JOIN enrolment ON enrolment.student_id = session.user_id
     JOIN course ON course.id = enrolment.course_id
     LEFT JOIN grade_attempt attempt ON attempt.student_id = enrolment.student_id
       AND attempt.course_id = enrolment.course_id
     LEFT JOIN LATERAL (
       SELECT score FROM grade_correction
       WHERE student_id = attempt.student_id AND course_id = attempt.course_id AND attempt_no = attempt.attempt_no
       ORDER BY revision DESC LIMIT 1
     ) correction ON true
     WHERE session.token_hash = $1 AND session.expires_at > now()
     GROUP BY course.id ORDER BY course.name, course.id`,
    [digest(token)],
  );
  return rows;
}

export async function studentSummary(token: string) {
  const { rows } = await db.query<{ unread: number; needs_info: number }>(
    `SELECT (SELECT count(*)::int FROM notification
         WHERE student_id = session.user_id AND read_at IS NULL) AS unread,
       (SELECT count(*)::int FROM request
         WHERE student_id = session.user_id AND status = 'needs_info') AS needs_info
     FROM session JOIN student ON student.id = session.user_id
     WHERE session.token_hash = $1 AND session.expires_at > now()`,
    [digest(token)],
  );
  return rows[0];
}


export async function upcomingExams(token: string) {
  const { rows } = await db.query<{
    id: string; course: string; section: string; room: string;
    starts_at: Date; ends_at: Date; status: "scheduled" | "moved" | "cancelled";
  }>(
    `SELECT occurrence.id, course.name AS course, section.label AS section,
       room.name AS room, lower(occurrence.slot) AS starts_at,
       upper(occurrence.slot) AS ends_at, occurrence.status
     FROM session
     JOIN section_member ON section_member.student_id = session.user_id
     JOIN section ON section.id = section_member.section_id
     JOIN course ON course.id = section.course_id
     JOIN class_occurrence occurrence ON occurrence.section_id = section.id
     JOIN room ON room.id = occurrence.room_id
     WHERE session.token_hash = $1 AND session.expires_at > now()
       AND occurrence.is_exam AND upper(occurrence.slot) > now()
     ORDER BY lower(occurrence.slot), occurrence.id`,
    [digest(token)],
  );
  return rows;
}
