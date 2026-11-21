import { db } from "../db";
import { digest } from "../dal/session";

export async function saveGrade(token: string, studentId: string, courseId: string,
  attempt: number, version: number, score: number, reason: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows: [principal] } = await client.query<{ id: string }>(
      `SELECT staff.id FROM session JOIN staff ON staff.id = session.user_id
       JOIN course ON course.faculty_id = staff.faculty_id
       JOIN enrolment ON enrolment.course_id = course.id
       WHERE session.token_hash = $1 AND session.expires_at > now()
       AND enrolment.student_id = $2 AND course.id = $3 FOR UPDATE OF enrolment`,
      [digest(token), studentId, courseId],
    );
    let savedAttempt: number | undefined;
    if (principal && attempt === 0) {
      const result = await client.query<{ attempt_no: number }>(
        `INSERT INTO grade_attempt (student_id,course_id,attempt_no,score,assessed_on,recorded_by)
         SELECT $1,$2,COALESCE(max(attempt_no),0)+1,$3,(now() AT TIME ZONE 'Europe/Moscow')::date,$4
         FROM grade_attempt WHERE student_id=$1 AND course_id=$2
         HAVING COALESCE(max(attempt_no),0)=$5 RETURNING attempt_no`,
        [studentId, courseId, score, principal.id, version],
      );
      savedAttempt = result.rows[0]?.attempt_no;
    } else if (principal) {
      const result = await client.query<{ attempt_no: number }>(
        `INSERT INTO grade_correction (student_id,course_id,attempt_no,revision,score,reason,actor_id)
         SELECT attempt.student_id,attempt.course_id,attempt.attempt_no,$4+1,$5,$6,$7
         FROM grade_attempt attempt
         LEFT JOIN LATERAL (
           SELECT revision, score FROM grade_correction
           WHERE student_id=$1 AND course_id=$2 AND attempt_no=$3 ORDER BY revision DESC LIMIT 1
         ) latest ON true
         WHERE attempt.student_id=$1 AND attempt.course_id=$2 AND attempt.attempt_no=$3
           AND COALESCE(latest.revision,0)=$4 AND COALESCE(latest.score,attempt.score)<>$5 RETURNING attempt_no`,
        [studentId, courseId, attempt, version, score, reason, principal.id],
      );
      savedAttempt = result.rows[0]?.attempt_no;
    }
    if (savedAttempt !== undefined) {
      await client.query(
        `WITH event AS (
           INSERT INTO change_event (kind,entity_id,payload)
           SELECT 'grade_changed', id, jsonb_build_object('course',name,'attempt',$2::int,
             'score',$3::int,'corrected',$4::boolean)
           FROM course WHERE id=$1 RETURNING id
         )
         INSERT INTO notification (change_event_id,student_id) SELECT id,$5 FROM event`,
        [courseId, savedAttempt, score, attempt > 0, studentId],
      );
    }
    await client.query("COMMIT");
    return !principal ? "missing" : savedAttempt !== undefined ? "ok" : "stale";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
