import { Pool } from "pg";

export const db = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.POSTGRES_HOST ?? "127.0.0.1",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: "deanery",
  user: "deanery",
  password: process.env.POSTGRES_PASSWORD,
});
