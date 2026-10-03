// src/server/personal.ts
import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "./db.js";
import { assert } from "./errors.js";
import { rateLimit } from "express-rate-limit";
import { PlaceSearch } from "./place-search.js";
const placeSearch = new PlaceSearch();
export const personalRouter = Router();
personalRouter.use(["/friends/:id/messages", "/places"], (req, _res, next) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  next();
});
async function friend(actor: string, id: string, send = false) {
  const [row] = await query(
    `SELECT u.preferences FROM users u JOIN friendships f ON (f.user_a=$1 AND f.user_b=u.id) OR (f.user_b=$1 AND f.user_a=u.id) WHERE u.id=$2 AND NOT u.disabled`,
    [actor, id],
  );
  assert(
    row,
    403,
    "FRIEND_REQUIRED",
    "Cette conversation est réservée à vos amis.",
  );
  if (send)
    assert(
      row.preferences.dmPolicy !== "nobody",
      403,
      "DM_POLICY",
      "Cet ami a désactivé la réception de messages privés.",
    );
}
personalRouter.get("/friends/:id/messages", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    actor = req.actor.id;
  await friend(actor, id);
  const before = req.query.before ? z.uuid().parse(req.query.before) : null;
  const rows = await query(
    `SELECT id,sender_id,recipient_id,content,created_at,read_at FROM friend_messages WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)) AND ($3::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM friend_messages WHERE id=$3 AND ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)))) ORDER BY created_at DESC,id DESC LIMIT 51`,
    [actor, id, before],
  );
  const more = rows.length > 50,
    page = rows.slice(0, 50);
  res.json({ data: page.reverse(), nextCursor: more ? page[0].id : null });
});
personalRouter.post("/friends/:id/messages", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await friend(req.actor.id, id, true);
  const b = z
    .object({
      content: z.string().trim().min(1).max(8000),
      client_id: z.uuid(),
    })
    .strict()
    .parse(req.body);
  const [row] = await query(
    `INSERT INTO friend_messages(sender_id,recipient_id,content,client_id) VALUES($1,$2,$3,$4) ON CONFLICT(sender_id,client_id) DO UPDATE SET client_id=friend_messages.client_id RETURNING *`,
    [req.actor.id, id, b.content, b.client_id],
  );
  assert(
    row.recipient_id === id && row.content === b.content,
    409,
    "CLIENT_ID_CONFLICT",
    "Identifiant d’envoi déjà utilisé pour un autre message.",
  );
  res.status(201).json({ data: row });
});
personalRouter.post("/friends/:id/messages/read", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await friend(req.actor.id, id);
  const b = z.object({ through: z.uuid() }).strict().parse(req.body);
  await query(
    `UPDATE friend_messages SET read_at=now() WHERE recipient_id=$1 AND sender_id=$2 AND read_at IS NULL AND (created_at,id)<=(SELECT created_at,id FROM friend_messages WHERE id=$3 AND recipient_id=$1 AND sender_id=$2)`,
    [req.actor.id, id, b.through],
  );
  res.json({ ok: true });
});
personalRouter.get("/places/categories", async (_req, res) =>
  res.json({
    data: await query(
      "SELECT key,name FROM place_categories WHERE enabled ORDER BY name",
    ),
  }),
);
personalRouter.get(
  "/places/search",
  rateLimit({
    windowMs: 60000,
    limit: 12,
    keyGenerator: (req) => req.actor.id,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: {
          code: "PLACE_SEARCH_RATE_LIMITED",
          message:
            "Vous avez lancé beaucoup de recherches. Réessayez dans une minute.",
        },
      }),
  }),
  async (req, res) => {
    const b = z
      .object({
        q: z.string().trim().max(120).default(""),
        latitude: z.coerce.number().min(-85).max(85),
        longitude: z.coerce.number().min(-180).max(180),
        nearby: z.enum(["1"]).optional(),
      })
      .strict()
      .parse(req.query);
    res.json(
      await placeSearch.search(b.q, b.latitude, b.longitude, b.nearby === "1"),
    );
  },
);
personalRouter.get("/places", async (req, res) => {
  const q = z
    .object({
      south: z.coerce.number().min(-85).max(85),
      north: z.coerce.number().min(-85).max(85),
      west: z.coerce.number().min(-180).max(180),
      east: z.coerce.number().min(-180).max(180),
      q: z.string().max(100).default(""),
      after: z.uuid().optional(),
    })
    .parse(req.query);
  assert(q.south <= q.north, 400, "INVALID_BOUNDS", "Zone de carte invalide.");
  const rows = await query(
    `SELECT p.*,e.state,e.visibility,e.visited_on,e.notes FROM places p LEFT JOIN place_entries e ON e.place_id=p.id AND e.user_id=$1 WHERE latitude BETWEEN $2 AND $3 AND (CASE WHEN $4::double precision<=$5::double precision THEN longitude BETWEEN $4::double precision AND $5::double precision ELSE longitude>=$4::double precision OR longitude<=$5::double precision END) AND (p.name ILIKE '%'||$6||'%' OR p.address ILIKE '%'||$6||'%') AND ($7::uuid IS NULL OR p.id>$7) ORDER BY p.id LIMIT 201`,
    [req.actor.id, q.south, q.north, q.west, q.east, q.q, q.after || null],
  );
  res.json({
    data: rows.slice(0, 200),
    nextCursor: rows.length > 200 ? rows[199].id : null,
  });
});
personalRouter.get("/places/mine", async (req, res) =>
  res.json({
    data: await query(
      `SELECT p.*,e.state,e.visibility,e.visited_on,e.notes FROM place_entries e JOIN places p ON p.id=e.place_id WHERE e.user_id=$1 ORDER BY e.updated_at DESC LIMIT 1000`,
      [req.actor.id],
    ),
  }),
);
const entry = z
  .object({
    state: z.enum(["wishlist", "visited"]),
    visibility: z.enum(["private", "friends", "community"]).default("private"),
    visited_on: z.iso.date().nullable().default(null),
    notes: z.string().max(2000).default(""),
  })
  .strict();
async function saveEntry(
  actor: string,
  id: string,
  b: z.infer<typeof entry>,
  db: Parameters<typeof query>[2],
) {
  await query(
    `INSERT INTO place_entries(user_id,place_id,state,visibility,visited_on,notes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,place_id) DO UPDATE SET state=EXCLUDED.state,visibility=EXCLUDED.visibility,visited_on=EXCLUDED.visited_on,notes=EXCLUDED.notes,updated_at=now()`,
    [
      actor,
      id,
      b.state,
      b.visibility,
      b.state === "visited" ? b.visited_on : null,
      b.notes,
    ],
    db,
  );
}
personalRouter.post("/places", async (req, res) => {
  const b = z
    .object({
      category: z.string().max(60),
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(300).default(""),
      latitude: z.number().min(-85).max(85),
      longitude: z.number().min(-180).max(180),
      entry,
    })
    .strict()
    .parse(req.body);
  const [category] = await query(
    "SELECT key FROM place_categories WHERE key=$1 AND enabled",
    [b.category],
  );
  assert(category, 400, "INVALID_CATEGORY", "Type de lieu indisponible.");
  const row = await transaction(async (db) => {
    const [p] = await query(
      `INSERT INTO places(category,name,address,latitude,longitude,created_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(category,latitude,longitude) DO UPDATE SET category=places.category RETURNING *`,
      [
        b.category,
        b.name,
        b.address,
        Number(b.latitude.toFixed(6)),
        Number(b.longitude.toFixed(6)),
        req.actor.id,
      ],
      db,
    );
    await saveEntry(req.actor.id, p.id, b.entry, db);
    return p;
  });
  res.status(201).json({ data: row });
});
personalRouter.put("/places/:id/entry", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    b = entry.parse(req.body);
  const [p] = await query("SELECT id FROM places WHERE id=$1", [id]);
  assert(p, 404, "NOT_FOUND", "Lieu introuvable.");
  await transaction((db) => saveEntry(req.actor.id, id, b, db));
  res.json({ ok: true });
});
personalRouter.delete("/places/:id/entry", async (req, res) => {
  await query("DELETE FROM place_entries WHERE user_id=$1 AND place_id=$2", [
    req.actor.id,
    z.uuid().parse(req.params.id),
  ]);
  res.json({ ok: true });
});
personalRouter.get("/places/:id/visitors", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  res.json({
    data: await query(
      `SELECT u.id,u.name,u.avatar FROM place_entries e JOIN users u ON u.id=e.user_id WHERE e.place_id=$2 AND e.state='visited' AND NOT u.disabled AND (e.user_id=$1 OR e.visibility='community' OR (e.visibility='friends' AND EXISTS(SELECT 1 FROM friendships f WHERE (f.user_a=$1 AND f.user_b=e.user_id) OR (f.user_b=$1 AND f.user_a=e.user_id)))) ORDER BY u.name,u.id LIMIT 100`,
      [req.actor.id, id],
    ),
  });
});
