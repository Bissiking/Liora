// scripts/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool, transaction } from "../src/server/db.js";
export async function migrate() {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(431001)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = (
        await db.query("SELECT checksum FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw Error(`Migration changed: ${name}`);
        continue;
      }
      await db.query(sql);
      await db.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      console.log(`Applied ${name}`);
    }
  });
}
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  await migrate();
  await pool.end();
}
