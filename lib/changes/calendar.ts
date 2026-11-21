import { randomBytes } from "node:crypto";
import { db } from "../db";
import { digest } from "../dal/session";

export async function rotateCalendarToken(session: string) {
  const token = randomBytes(32).toString("hex");
  const result = await db.query(
    `INSERT INTO calendar_token (student_id, token_hash)
     SELECT student.id, $2 FROM session JOIN student ON student.id = session.user_id
     WHERE session.token_hash = $1 AND session.expires_at > now()
     ON CONFLICT (student_id) DO UPDATE SET token_hash = excluded.token_hash`,
    [digest(session), digest(token)],
  );
  return result.rowCount ? token : null;
}

export async function revokeCalendarToken(session: string) {
  await db.query(
    `DELETE FROM calendar_token USING session
     WHERE calendar_token.student_id = session.user_id
       AND session.token_hash = $1 AND session.expires_at > now()`,
    [digest(session)],
  );
}
