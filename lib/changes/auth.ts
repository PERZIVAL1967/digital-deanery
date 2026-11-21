import { randomBytes } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { db } from "../db";
import { digest } from "../dal/session";

export async function signIn(login: string, password: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [login]);
    const attempts = await client.query<{ failures: number }>(
      "SELECT failures FROM login_attempt WHERE login = $1 AND window_start > now() - interval '15 minutes'",
      [login],
    );
    if ((attempts.rows[0]?.failures ?? 0) >= 5) {
      await client.query("ROLLBACK");
      return;
    }
    const { rows: [account] } = await client.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM app_user WHERE login = $1",
      [login],
    );
    const valid = account?.password_hash.startsWith("$argon2id$") &&
      await verify(account.password_hash, password);
    if (!valid) {
      await client.query(
        `INSERT INTO login_attempt VALUES ($1, 1, now())
         ON CONFLICT (login) DO UPDATE SET
           failures = CASE WHEN login_attempt.window_start > now() - interval '15 minutes'
                           THEN login_attempt.failures + 1 ELSE 1 END,
           window_start = CASE WHEN login_attempt.window_start > now() - interval '15 minutes'
                               THEN login_attempt.window_start ELSE now() END`,
        [login],
      );
      await client.query("COMMIT");
      return;
    }
    const token = randomBytes(32).toString("hex");
    await client.query("DELETE FROM login_attempt WHERE login = $1", [login]);
    await client.query(
      "INSERT INTO session VALUES ($1, $2, now() + interval '8 hours')",
      [digest(token), account.id],
    );
    await client.query("COMMIT");
    return token;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function signOut(token: string) {
  await db.query("DELETE FROM session WHERE token_hash = $1", [digest(token)]);
}
