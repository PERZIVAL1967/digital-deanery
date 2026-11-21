import { db } from "../db";
import { digest } from "../dal/session";

export async function markRead(token: string, id: string) {
  const result = await db.query(
    `UPDATE notification SET read_at = COALESCE(read_at, now())
     FROM session WHERE session.token_hash = $1 AND session.expires_at > now()
       AND session.user_id = notification.student_id AND notification.id = $2`,
    [digest(token), id],
  );
  return result.rowCount === 1;
}
