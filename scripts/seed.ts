// scripts/seed.ts
import { query, transaction, pool } from "../src/server/db.js";
import { permissions, memberPermissions } from "../src/shared/permissions.js";
export async function seed() {
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(431003)");
    const [existing] = await query(
      "SELECT id FROM workspaces WHERE name='LUMA'",
      [],
      db,
    );
    if (existing) return existing.id as string;
    const [w] = await query(
      "INSERT INTO workspaces(name,description) VALUES('LUMA','Les idées, les conversations et les projets de notre écosystème.') RETURNING id",
      [],
      db,
    );
    for (const [name, perms, owner] of [
      ["Owner", permissions, true],
      ["Admin", permissions, false],
      ["Moderator", [...memberPermissions, "MANAGE_MESSAGES"], false],
      ["Member", memberPermissions, false],
    ] as const)
      await query(
        "INSERT INTO roles(workspace_id,name,permissions,is_owner) VALUES($1,$2,$3,$4)",
        [w.id, name, [...perms], owner],
        db,
      );
    const cats: Record<string, string> = {};
    for (const [i, name] of ["GÉNÉRAL", "INFRA", "DEV"].entries()) {
      const [c] = await query(
        "INSERT INTO categories(workspace_id,name,position) VALUES($1,$2,$3) RETURNING id",
        [w.id, name, i],
        db,
      );
      cats[name] = c.id;
    }
    const [p] = await query(
      "INSERT INTO projects(workspace_id,name,description) VALUES($1,'Liora','Un point de rencontre pour tout LUMA.') RETURNING id",
      [w.id],
      db,
    );
    const channels: Record<string, string> = {};
    for (const [i, [name, cat, description, type]] of [
      ["general", "GÉNÉRAL", "Le point de rencontre de l’équipe.", "text"],
      ["argos", "INFRA", "Les signaux de notre infrastructure.", "monitoring"],
      ["alerts", "INFRA", "Incidents et rétablissements.", "announcement"],
      ["development", "DEV", "De l’idée à la prochaine version.", "project"],
    ].entries()) {
      const [c] = await query(
        "INSERT INTO channels(workspace_id,category_id,name,description,type,position) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [w.id, cats[cat], name, description, type, i],
        db,
      );
      channels[name] = c.id;
    }
    const [bot] = await query(
      "INSERT INTO technical_accounts(workspace_id,name,kind,description,revoked) VALUES($1,'Argos · démo','bot','Identité de démonstration sans jeton. Aucun statut réel.',true) RETURNING id",
      [w.id],
      db,
    );
    for (const [i, content] of [
      "Bienvenue dans Liora. Ici, une conversation peut devenir le prochain projet de LUMA.",
      "Cet espace contient des données de démonstration. Les signaux réels apparaîtront après la configuration des intégrations.",
      "Un premier board est prêt dans Projets. À vous de lui donner vie.",
    ].entries())
      await query(
        "INSERT INTO messages(workspace_id,channel_id,technical_id,content,created_at) VALUES($1,$2,$3,$4,now()-($5*interval '1 minute'))",
        [w.id, channels.general, bot.id, content, 30 - i * 5],
        db,
      );
    const [b] = await query(
      "INSERT INTO boards(workspace_id,project_id,name) VALUES($1,$2,'Les prochains pas') RETURNING id",
      [w.id, p.id],
      db,
    );
    for (const [i, name] of ["À explorer", "En cours", "Terminé"].entries()) {
      const [c] = await query(
        "INSERT INTO board_columns(workspace_id,board_id,name,position) VALUES($1,$2,$3,$4) RETURNING id",
        [w.id, b.id, name, i],
        db,
      );
      for (const title of i === 0
        ? ["Relier les alertes Argos", "Écrire le guide de l’équipe"]
        : i === 1
          ? ["Prendre en main Liora"]
          : ["Créer notre espace LUMA"])
        await query(
          "INSERT INTO tasks(workspace_id,column_id,title,tags,position) VALUES($1,$2,$3,$4,$5)",
          [w.id, c.id, title, ["démo"], i],
          db,
        );
    }
    await query(
      "INSERT INTO pages(workspace_id,project_id,title,blocks) VALUES($1,$2,$3,$4)",
      [
        w.id,
        p.id,
        "Bienvenue chez nous",
        JSON.stringify([
          { type: "heading", content: "Un endroit pour avancer ensemble." },
          {
            type: "text",
            content:
              "Discutez dans les salons, organisez les prochaines étapes dans le board et gardez vos décisions dans les pages.",
          },
          {
            type: "quote",
            content: "Une idée devient utile quand on lui donne une suite.",
          },
        ]),
      ],
      db,
    );
    await query(
      "INSERT INTO feature_flags(workspace_id,key) VALUES($1,'jellyfin.enabled'),($1,'media_requests.enabled')",
      [w.id],
      db,
    );
    for (const [name, kind, url] of [
      [
        "API Argos",
        "http",
        process.env.ARGOS_BASE_URL
          ? `${process.env.ARGOS_BASE_URL.replace(/\/$/, "")}/health/ready`
          : null,
      ],
      ["Serveur Argus", "http", process.env.ARGUS_HEALTH_URL || null],
      ["Heartbeat Argos", "heartbeat", null],
    ])
      await query(
        "INSERT INTO monitoring_targets(workspace_id,name,kind,url) VALUES($1,$2,$3,$4)",
        [w.id, name, kind, url],
        db,
      );
    return w.id as string;
  });
}
if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  console.log(`Seed LUMA: ${await seed()}`);
  await pool.end();
}
