import { hash } from "@node-rs/argon2";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
const demoPassword = connectionString ? process.env.DEANERY_DEMO_PASSWORD : "DeaneryDemo2026";
if (!demoPassword) throw new Error("Set DEANERY_DEMO_PASSWORD to enable hosted demo accounts.");

const db = new pg.Client(connectionString ? { connectionString } : {
  host: process.env.POSTGRES_HOST ?? "127.0.0.1",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: "deanery",
  user: "deanery",
  password: process.env.POSTGRES_PASSWORD,
});

await db.connect();
try {
  await db.query("BEGIN");
  await db.query(`
    WITH demo_teacher AS (
      SELECT id FROM teacher WHERE name = 'Mikhail Lebedev'
    ), account AS (
      INSERT INTO app_user (login, password_hash)
      SELECT 'teacher-a', '!disabled' FROM demo_teacher
      ON CONFLICT (login) DO NOTHING
      RETURNING id
    )
    INSERT INTO teacher_account (user_id, teacher_id)
    SELECT account.id, demo_teacher.id FROM account CROSS JOIN demo_teacher
  `);
  const result = await db.query(
    "UPDATE app_user SET password_hash = $1 WHERE login IN ('student-a', 'student-b', 'student-c', 'staff-a', 'staff-b', 'teacher-a') AND password_hash = '!disabled'",
    [await hash(demoPassword)],
  );
  await db.query("COMMIT");
  console.log(`Enabled ${result.rowCount} demo accounts.`);
} finally {
  await db.end();
}
