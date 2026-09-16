// src/server/commands.ts
import { Router } from "express";
import { z } from "zod";
import { channelAccess } from "./access.js";
import { authorize } from "./auth.js";
import { query } from "./db.js";
import { assert } from "./errors.js";
export const commandRouter = Router({ mergeParams: true });
commandRouter.post("/commands", async (req, res) => {
  const w = z.uuid().parse(req.workspaceId),
    b = z
      .object({ channel_id: z.uuid(), command: z.string().trim().max(300) })
      .strict()
      .parse(req.body);
  await channelAccess(req.actor, w, b.channel_id);
  const [name, ...args] = b.command.split(/\s+/),
    q = args.join(" ");
  if (name === "/help" || name === "/aide")
    return res.json({
      title: "Commandes personnelles",
      lines: [
        "/aide — afficher cette liste",
        "/taches [texte] — chercher dans les tâches",
        "/statut — état de la supervision (selon vos droits)",
        "/salon — informations du salon",
        "Ces résultats sont privés : aucun message n’est envoyé.",
      ],
    });
  if (name === "/salon") {
    const c = await channelAccess(req.actor, w, b.channel_id);
    return res.json({
      title: c.name,
      lines: [
        c.description || "Aucune description",
        c.is_dm
          ? "Conversation privée"
          : c.is_private
            ? "Salon privé"
            : "Salon de l’espace",
      ],
    });
  }
  if (name === "/taches") {
    await authorize(req.actor, w, "VIEW_BOARD");
    const rows = await query(
      "SELECT title,priority FROM tasks WHERE workspace_id=$1 AND title ILIKE $2 ORDER BY updated_at DESC LIMIT 20",
      [w, `%${q.replace(/[%_\\]/g, "\\$&")}%`],
    );
    return res.json({
      title: "Tâches · 20 résultats maximum",
      lines: rows.map((t) => `${t.title} · ${t.priority}`),
    });
  }
  if (name === "/statut") {
    await authorize(req.actor, w, "VIEW_MONITORING");
    const rows = await query(
      "SELECT name,state FROM monitoring_targets WHERE workspace_id=$1 ORDER BY name",
      [w],
    );
    return res.json({
      title: "Supervision",
      lines: rows.map((t) => `${t.name} · ${t.state}`),
    });
  }
  assert(false, 400, "UNKNOWN_COMMAND", "Commande inconnue. Essayez /aide.");
});
