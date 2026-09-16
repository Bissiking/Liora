// scripts/configure-monitoring.ts
import { query, transaction, pool } from "../src/server/db.js";
await transaction(async (db) => {
  const [w] = await query(
    "SELECT id FROM workspaces WHERE name='LUMA'",
    [],
    db,
  );
  if (!w) throw Error("Run db:seed before configuring monitoring");
  for (const [name, url] of [
    [
      "API Argos",
      process.env.ARGOS_BASE_URL
        ? `${process.env.ARGOS_BASE_URL.replace(/\/$/, "")}/health/ready`
        : null,
    ],
    ["Serveur Argus", process.env.ARGUS_HEALTH_URL || null],
  ]) {
    if (url && !["http:", "https:"].includes(new URL(url).protocol))
      throw Error("Monitoring URLs must use HTTP(S)");
    await query(
      "UPDATE monitoring_targets SET url=$3,state='unknown' WHERE workspace_id=$1 AND name=$2",
      [w.id, name, url],
      db,
    );
  }
  console.log("LUMA monitoring configuration updated.");
});
await pool.end();
