import { db } from "../db";
import { digest } from "./session";

export async function studentClassmates(token: string) {
  const result = await db.query<{ name: string }>(
    `SELECT peer.name
       FROM session
       JOIN student AS viewer ON viewer.id = session.user_id
       JOIN student AS peer ON peer.group_id = viewer.group_id AND peer.id <> viewer.id
      WHERE session.token_hash = $1 AND session.expires_at > now()
      ORDER BY peer.name, peer.id`,
    [digest(token)],
  );
  return result.rows.map(({ name }) => name);
}
