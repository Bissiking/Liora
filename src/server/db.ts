// src/server/db.ts
import "dotenv/config";
import pg, { type PoolClient, type QueryResultRow } from "pg";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 16,
  connectionTimeoutMillis: 5000,
});
pool.on("error", () =>
  console.error(
    JSON.stringify({
      level: "error",
      service: "database",
      message: "Idle database connection failed",
    }),
  ),
);
export type DB = Pick<PoolClient, "query">;
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
  db: DB = pool,
): Promise<T[]> {
  return (await db.query<T>(sql, values)).rows;
}
export async function transaction<T>(
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
