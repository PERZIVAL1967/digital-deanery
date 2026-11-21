import { db } from "../db";
import { requestScope } from "../dal/requests";
import { digest } from "../dal/session";
import { transitions, type Mode, type Status } from "../request-types";
import type { PoolClient } from "pg";

async function record(client: PoolClient, row: {
  id: string; student_id: string; version: number; status: Status; actor_id: string;
}, before: Status | null, message: string) {
  await client.query(
    "INSERT INTO request_event (request_id,version,actor_id,status,message) VALUES ($1,$2,$3,$4,$5)",
    [row.id, row.version, row.actor_id, row.status, message],
  );
  await client.query(
    `WITH event AS (
       INSERT INTO change_event (kind,entity_id,payload)
       VALUES ('request_status',$1,jsonb_build_object('before',$2::text,'after',$3::text,'reason',$4::text))
       RETURNING id
     )
     INSERT INTO notification (change_event_id,student_id) SELECT id,$5 FROM event`,
    [row.id, before, row.status, message, row.student_id],
  );
}

async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function submitRequest(token: string, key: string, kind: string, message: string) {
  return transaction(async (client) => {
    const { rows: [row] } = await client.query(
      `INSERT INTO request (student_id,idempotency_key,kind,message)
       SELECT student.id,$2,$3,$4 FROM session JOIN student ON student.id = session.user_id
       WHERE token_hash = $1 AND expires_at > now()
       ON CONFLICT (student_id,idempotency_key) DO NOTHING
       RETURNING id,student_id,version,status,student_id AS actor_id`,
      [digest(token), key, kind, message],
    );
    if (row) await record(client, row, null, message);
  });
}

export async function transitionRequest(token: string, mode: Mode, id: string,
  version: number, next: Status, message: string) {
  return transaction(async (client) => {
    const { rows: [row] } = await client.query(
      `SELECT request.*, session.user_id AS actor_id ${requestScope}
       AND request.id = $3 FOR UPDATE OF request`,
      [digest(token), mode, id],
    );
    if (!row) return "missing";
    const allowed = transitions[mode][row.status as Status];
    if (row.version !== version || !allowed?.includes(next)) return "conflict";
    await client.query("UPDATE request SET status = $2, version = version + 1 WHERE id = $1", [id,next]);
    await record(client, { ...row, version: version + 1, status: next }, row.status, message);
    return "ok";
  });
}
