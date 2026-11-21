// npm run db:setup
// Applies db/*.sql in name order, once each (tracked in schema_migrations), to DATABASE_URL,
// then enables the fictional demo logins. Uses only the pg driver, no psql.
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { hash } from "@node-rs/argon2";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL, e.g. postgres://deanery:deanery-local-only@127.0.0.1:5433/deanery");
  process.exit(1);
}
const demoPassword = process.env.DEANERY_DEMO_PASSWORD || "DeaneryDemo2026";

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  if (!applied.size) {
    const { rows: [legacy] } = await client.query("SELECT to_regclass('public.faculty') IS NOT NULL AS exists");
    if (legacy.exists) {
      throw new Error("This database already has tables but no schema_migrations. Use a fresh database " +
        "(locally: docker compose down -v && docker compose up -d db).");
    }
  }
  const files = (await readdir(path.join(root, "db")))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  let count = 0;
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(path.join(root, "db", name), "utf8");
    const ownTransaction = /^\s*BEGIN\s*;/im.test(sql);
    process.stdout.write(`apply ${name} ... `);
    if (ownTransaction) {
      // the file commits itself (Codex's 002); record it right after
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    } else {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    count++;
    console.log("ok");
  }
  console.log(count ? `Applied ${count} migration(s).` : "Schema is up to date.");

  // Codex's script: creates teacher-a and enables student-a/b/c, staff-a/b, teacher-a.
  const codex = spawnSync(process.execPath, [path.join(root, "scripts", "enable-demo.mjs")], {
    env: { ...process.env, DATABASE_URL: url, DEANERY_DEMO_PASSWORD: demoPassword },
    stdio: "inherit",
  });
  if (codex.status !== 0) throw new Error("scripts/enable-demo.mjs failed");

  // Our accounts for group 3МЭО-01.
  const ours = await client.query(
    `UPDATE app_user SET password_hash = $1
     WHERE login IN ('student.demo', 'student.demo2', 'dean.demo', 'teacher.demo') AND password_hash = '!disabled'`,
    [await hash(demoPassword)],
  );
  console.log(`Enabled ${ours.rowCount} 3МЭО-01 demo accounts.`);
} finally {
  await client.end();
}
