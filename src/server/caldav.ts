// src/server/caldav.ts
import express, { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { query, transaction, type DB } from "./db.js";
import { hash, token } from "./crypto.js";
import { authorize } from "./auth.js";
import { granted, visibleChannel } from "./access.js";
import { humanWorkspace, targetAccess } from "./experience-access.js";
import { emit } from "./events.js";
import { assert, HttpError } from "./errors.js";
import { calendarReminderAt } from "./calendar.js";
import { nextOccurrence } from "../shared/schedule.js";
import { etag, eventIcal, noteIcal, parseEventIcal, xml } from "./ical.js";

export const calendarCredentialsRouter = Router();
calendarCredentialsRouter.use("/calendar-sync", (req, _res, next) => {
  assert(
    req.actor.kind === "human",
    403,
    "HUMAN_REQUIRED",
    "Compte humain requis.",
  );
  next();
});
calendarCredentialsRouter.get("/calendar-sync", async (req, res) => {
  res.json({
    data: await query(
      "SELECT id,name,created_at,last_used_at FROM calendar_credentials WHERE user_id=$1 ORDER BY created_at DESC",
      [req.actor.id],
    ),
    server_url: new URL("/dav/", process.env.APP_URL).toString(),
    username: req.actor.id,
  });
});
calendarCredentialsRouter.post("/calendar-sync", async (req, res) => {
  const { name } = z
    .object({ name: z.string().trim().min(1).max(80) })
    .strict()
    .parse(req.body);
  const password = token();
  const data = await transaction(async (db) => {
    await query(
      "SELECT id FROM users WHERE id=$1 FOR UPDATE",
      [req.actor.id],
      db,
    );
    const [n] = await query(
      "SELECT count(*)::int n FROM calendar_credentials WHERE user_id=$1",
      [req.actor.id],
      db,
    );
    assert(
      n.n < 10,
      409,
      "CREDENTIAL_LIMIT",
      "Dix appareils maximum. Révoquez un ancien accès.",
    );
    const [data] = await query(
      "INSERT INTO calendar_credentials(user_id,name,password_hash) VALUES($1,$2,$3) RETURNING id,name,created_at,last_used_at",
      [req.actor.id, name, hash(password)],
      db,
    );
    return data;
  });
  res.status(201).json({ data, password });
});
calendarCredentialsRouter.delete("/calendar-sync/:id", async (req, res) => {
  await query("DELETE FROM calendar_credentials WHERE id=$1 AND user_id=$2", [
    z.uuid().parse(req.params.id),
    req.actor.id,
  ]);
  res.json({ ok: true });
});
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  processEntities: false,
});
function parseXml(body: unknown) {
  const text = typeof body === "string" ? body : "";
  if (!text.trim()) return {};
  assert(
    !/<!DOCTYPE|<!ENTITY/i.test(text) && XMLValidator.validate(text) === true,
    400,
    "INVALID_XML",
    "XML invalide.",
  );
  return parser.parse(text) as Record<string, any>;
}
function response(
  href: string,
  props: Record<string, string>,
  wanted: string[] | null,
) {
  const names = wanted || Object.keys(props),
    good = names.filter((k) => k in props),
    missing = names.filter((k) => !(k in props));
  const qualified = (key: string) =>
    key === "getctag"
      ? "CS"
      : key.startsWith("calendar-") ||
          key.startsWith("supported-calendar") ||
          key === "max-resource-size"
        ? "C"
        : "D";
  const prop = (key: string, value: string) =>
    `<${qualified(key)}:${key}>${value}</${qualified(key)}:${key}>`;
  return `<D:response><D:href>${xml(href)}</D:href>${good.length ? `<D:propstat><D:prop>${good.map((k) => prop(k, props[k])).join("")}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>` : ""}${missing.length ? `<D:propstat><D:prop>${missing.map((k) => prop(k, "")).join("")}</D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat>` : ""}</D:response>`;
}
const multistatus = (responses: string[]) =>
  `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">${responses.join("")}</D:multistatus>`;
const href = (path: string) => `<D:href>${xml(path)}</D:href>`;
const privileges = (write: boolean) =>
  `<D:privilege><D:read/></D:privilege>${write ? "<D:privilege><D:write/></D:privilege><D:privilege><D:bind/></D:privilege><D:privilege><D:unbind/></D:privilege>" : ""}`;
const reportSet =
  "<D:supported-report><D:report><C:calendar-query/></D:report></D:supported-report><D:supported-report><D:report><C:calendar-multiget/></D:report></D:supported-report>";
export const caldavRouter = Router();
caldavRouter.use(
  rateLimit({
    windowMs: 60000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
caldavRouter.use(express.text({ type: () => true, limit: "512kb" }));
caldavRouter.use(async (req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    DAV: "1, calendar-access",
    Allow: "OPTIONS, PROPFIND, REPORT, GET, HEAD, PUT, DELETE",
  });
  try {
    const configured = new URL(process.env.APP_URL || "http://localhost:4310");
    assert(
      configured.protocol === "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname),
      503,
      "HTTPS_REQUIRED",
      "CalDAV exige HTTPS.",
    );
    const basic = req.headers.authorization?.match(
      /^Basic ([A-Za-z0-9+/=]+)$/i,
    )?.[1];
    const raw = basic ? Buffer.from(basic, "base64").toString() : "";
    const split = raw.indexOf(":"),
      username = raw.slice(0, split),
      password = raw.slice(split + 1);
    assert(
      z.uuid().safeParse(username).success &&
        password.length >= 32 &&
        password.length <= 200,
      401,
      "INVALID_CREDENTIAL",
      "Identifiants CalDAV requis.",
    );
    const [c] = await query(
      "UPDATE calendar_credentials c SET last_used_at=now() FROM users u WHERE c.user_id=u.id AND c.user_id=$1 AND c.password_hash=$2 AND NOT u.disabled RETURNING c.user_id",
      [username, hash(password)],
    );
    assert(c, 401, "INVALID_CREDENTIAL", "Accès CalDAV révoqué ou invalide.");
    req.actor = { id: c.user_id, kind: "human" };
    next();
  } catch (e) {
    next(e);
  }
});
async function collections(req: Request) {
  const ws = await query(
    `SELECT w.id,w.name,r.permissions FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 AND m.state='active' AND 'VIEW_WORKSPACE'=ANY(r.permissions) ORDER BY w.name`,
    [req.actor.id],
  );
  return [
    { id: "notes", name: "Mes notes datées", write: false },
    ...ws.map((w) => ({
      id: w.id,
      name: w.name,
      write: w.permissions.includes("CREATE_CALENDAR_EVENT"),
    })),
  ];
}
async function resources(req: Request, id: string, db?: DB) {
  if (id === "notes")
    return (
      await query(
        "SELECT * FROM personal_notes WHERE user_id=$1 ORDER BY due_at,id LIMIT 2001",
        [req.actor.id],
        db,
      )
    ).map((row) => ({ row, path: row.id + ".ics", data: noteIcal(row) }));
  await authorize(req.actor, id, "VIEW_WORKSPACE");
  const perms = await granted(req.actor, id);
  const rows = await query(
    `SELECT e.* FROM calendar_events e WHERE e.workspace_id=$1 AND (e.channel_id IS NULL OR EXISTS(SELECT 1 FROM channels c WHERE c.id=e.channel_id AND ${visibleChannel()})) ORDER BY e.id LIMIT 2001`,
    [id, req.actor.id, perms],
    db,
  );
  return rows.map((row) => ({
    row,
    path: row.dav_href || row.id + ".ics",
    data: eventIcal(row),
  }));
}
caldavRouter.use(async (req, res, next) => {
  try {
    const principal = `/dav/principals/${req.actor.id}/`,
      home = `/dav/calendars/${req.actor.id}/`;
    const root = "/dav/";
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }
    const path = req.path;
    const common = {
      "current-user-principal": href(principal),
      "principal-URL": href(principal),
      "calendar-home-set": href(home),
      owner: href(principal),
    };
    const list = await collections(req);
    if (req.method === "PROPFIND") {
      assert(
        ["0", "1", undefined].includes(req.get("depth")),
        403,
        "FINITE_DEPTH",
        "Depth 0 ou 1 requis.",
      );
      const parsed = parseXml(req.body),
        wanted = parsed.propfind?.prop
          ? Object.keys(parsed.propfind.prop)
          : null;
      const result: string[] = [];
      if (
        path === "/" ||
        path === `/principals/${req.actor.id}/` ||
        path === `/calendars/${req.actor.id}/`
      ) {
        const current =
          path === "/"
            ? root
            : path.startsWith("/principals/")
              ? principal
              : home;
        result.push(
          response(
            current,
            {
              ...common,
              displayname: xml("Liora"),
              resourcetype: path.startsWith("/principals/")
                ? "<D:principal/>"
                : "<D:collection/>",
            },
            wanted,
          ),
        );
        if (path === "/" && req.get("depth") !== "0")
          result.push(
            response(
              home,
              {
                ...common,
                displayname: "Calendriers",
                resourcetype: "<D:collection/>",
              },
              wanted,
            ),
          );
        if (current === home && req.get("depth") !== "0")
          for (const c of list) {
            const items = await resources(req, c.id);
            assert(items.length <= 2000, 507, "LIMIT", "Trop de ressources.");
            const digest = etag(
              items.map((i) => i.path + etag(i.data)).join("|"),
            );
            result.push(
              response(
                home + c.id + "/",
                {
                  ...common,
                  displayname: xml(c.name),
                  resourcetype: "<D:collection/><C:calendar/>",
                  "calendar-description": xml(c.name),
                  "supported-calendar-component-set": '<C:comp name="VEVENT"/>',
                  "supported-calendar-data":
                    '<C:calendar-data content-type="text/calendar" version="2.0"/>',
                  "current-user-privilege-set": privileges(c.write),
                  "supported-report-set": reportSet,
                  "max-resource-size": "100000",
                  getctag: xml(digest),
                },
                wanted,
              ),
            );
          }
      } else {
        const match = path.match(/^\/calendars\/([^/]+)\/([^/]+)\/(.*)$/);
        assert(
          match &&
            match[1] === req.actor.id &&
            list.some((c) => c.id === match[2]),
          404,
          "NOT_FOUND",
          "Calendrier introuvable.",
        );
        const c = list.find((c) => c.id === match![2])!,
          items = await resources(req, c.id);
        assert(items.length <= 2000, 507, "LIMIT", "Trop de ressources.");
        if (!match![3]) {
          result.push(
            response(
              home + c.id + "/",
              {
                ...common,
                displayname: xml(c.name),
                resourcetype: "<D:collection/><C:calendar/>",
                "supported-calendar-component-set": '<C:comp name="VEVENT"/>',
                "current-user-privilege-set": privileges(c.write),
                "supported-report-set": reportSet,
                getctag: xml(
                  etag(items.map((i) => i.path + etag(i.data)).join("|")),
                ),
              },
              wanted,
            ),
          );
          if (req.get("depth") !== "0")
            for (const item of items)
              result.push(
                response(
                  home + c.id + "/" + encodeURIComponent(item.path),
                  {
                    getetag: xml(etag(item.data)),
                    getcontenttype: "text/calendar; charset=utf-8",
                    getcontentlength: String(Buffer.byteLength(item.data)),
                    resourcetype: "",
                  },
                  wanted,
                ),
              );
        } else {
          const item = items.find(
            (i) => i.path === decodeURIComponent(match![3]),
          );
          assert(item, 404, "NOT_FOUND", "Événement introuvable.");
          result.push(
            response(
              home + c.id + "/" + encodeURIComponent(item.path),
              {
                getetag: xml(etag(item.data)),
                getcontenttype: "text/calendar; charset=utf-8",
                resourcetype: "",
              },
              wanted,
            ),
          );
        }
      }
      res.status(207).type("application/xml").send(multistatus(result));
      return;
    }
    const match = path.match(/^\/calendars\/([^/]+)\/([^/]+)\/(.*)$/);
    assert(
      match && match[1] === req.actor.id && list.some((c) => c.id === match[2]),
      404,
      "NOT_FOUND",
      "Calendrier introuvable.",
    );
    const collection = match[2],
      name = decodeURIComponent(match[3]);
    if (req.method === "REPORT") {
      assert(!name, 405, "COLLECTION_REQUIRED", "Interrogez le calendrier.");
      const parsed = parseXml(req.body),
        report = parsed["calendar-multiget"] || parsed["calendar-query"];
      assert(report, 403, "SUPPORTED_REPORT", "Rapport non pris en charge.");
      const wanted = report.prop
        ? Object.keys(report.prop)
        : ["getetag", "calendar-data"];
      const items = await resources(req, collection);
      assert(items.length <= 2000, 507, "LIMIT", "Trop de ressources.");
      let selected = items;
      const missing: string[] = [];
      if (parsed["calendar-multiget"]) {
        const requested = Array.isArray(report.href)
          ? report.href
          : [report.href];
        assert(requested.length <= 2000, 413, "LIMIT", "Trop de ressources.");
        const paths = requested.map((h: any) => {
          assert(typeof h === "string", 400, "INVALID_XML", "Href invalide.");
          return new URL(h, process.env.APP_URL).pathname;
        });
        selected = items.filter((i) =>
          paths.includes(home + collection + "/" + encodeURIComponent(i.path)),
        );
        for (const p of paths)
          if (
            !selected.some(
              (i) => home + collection + "/" + encodeURIComponent(i.path) === p,
            )
          )
            missing.push(p);
      } else {
        const f = report.filter?.["comp-filter"];
        assert(
          !report.expand &&
            !report["calendar-data"]?.expand &&
            !report.prop?.["calendar-data"]?.expand,
          403,
          "UNSUPPORTED_FILTER",
          "Expansion non prise en charge.",
        );
        assert(
          !f || f["@_name"] === "VCALENDAR",
          403,
          "UNSUPPORTED_FILTER",
          "Filtre non pris en charge.",
        );
        const sub = f?.["comp-filter"];
        assert(
          !sub ||
            (!Array.isArray(sub) &&
              sub["@_name"] === "VEVENT" &&
              !sub["prop-filter"] &&
              !sub["comp-filter"] &&
              !sub["is-not-defined"]),
          403,
          "UNSUPPORTED_FILTER",
          "Filtre non pris en charge.",
        );
        const range = sub?.["time-range"];
        if (range) {
          const bound = (s: any) => {
            assert(
              typeof s === "string" && /^\d{8}T\d{6}Z$/.test(s),
              400,
              "INVALID_RANGE",
              "Période UTC invalide.",
            );
            return Date.parse(
              s.replace(
                /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
                "$1-$2-$3T$4:$5:$6Z",
              ),
            );
          };
          const from = range["@_start"] ? bound(range["@_start"]) : -Infinity,
            until = range["@_end"] ? bound(range["@_end"]) : Infinity;
          assert(from < until, 400, "INVALID_RANGE", "Période invalide.");
          selected = selected.filter((i) =>
            collection === "notes"
              ? Date.parse(i.row.due_at) >= from &&
                Date.parse(i.row.due_at) < until
              : i.row.recurrence !== "none"
                ? !Number.isFinite(from)
                  ? Date.parse(i.row.start_at) < until
                  : Date.parse(
                      nextOccurrence(
                        i.row.start_at,
                        i.row.recurrence,
                        i.row.timezone,
                        new Date(
                          from -
                            (i.row.end
                              ? Date.parse(i.row.end) -
                                Date.parse(i.row.start_at)
                              : 0) -
                            1,
                        ),
                      )!,
                    ) < until
                : Date.parse(i.row.start_at) < until &&
                  (i.row.end
                    ? Date.parse(i.row.end) > from
                    : Date.parse(i.row.start_at) >= from),
          );
        }
      }
      res
        .status(207)
        .type("application/xml")
        .send(
          multistatus([
            ...selected.map((i) =>
              response(
                home + collection + "/" + encodeURIComponent(i.path),
                {
                  getetag: xml(etag(i.data)),
                  "calendar-data": xml(i.data),
                  getcontenttype: "text/calendar; charset=utf-8",
                },
                wanted,
              ),
            ),
            ...missing.map(
              (p) =>
                `<D:response><D:href>${xml(p)}</D:href><D:status>HTTP/1.1 404 Not Found</D:status></D:response>`,
            ),
          ]),
        );
      return;
    }
    assert(
      name && /^[A-Za-z0-9_.@-]{1,180}\.ics$/.test(name),
      400,
      "INVALID_RESOURCE",
      "Nom de ressource invalide.",
    );
    if (req.method === "GET" || req.method === "HEAD") {
      const item = (await resources(req, collection)).find(
        (i) => i.path === name,
      );
      assert(item, 404, "NOT_FOUND", "Événement introuvable.");
      res.type("text/calendar").set("ETag", etag(item.data)).send(item.data);
      return;
    }
    assert(
      collection !== "notes",
      403,
      "READ_ONLY",
      "Les notes se modifient dans Liora ou BrainDump.",
    );
    assert(
      req.method === "PUT" || req.method === "DELETE",
      405,
      "METHOD_NOT_ALLOWED",
      "Méthode non prise en charge.",
    );
    await humanWorkspace(req.actor, collection);
    const input =
      req.method === "PUT" ? parseEventIcal(String(req.body)) : null;
    const result = await transaction(async (db) => {
      // Serialize create/update/delete and enforce the ETag within the same transaction.
      await query(
        "SELECT id FROM workspaces WHERE id=$1 FOR UPDATE",
        [collection],
        db,
      );
      const [credential] = await query(
        "SELECT c.id FROM calendar_credentials c JOIN users u ON u.id=c.user_id WHERE c.user_id=$1 AND c.password_hash=$2 AND NOT u.disabled FOR SHARE OF c",
        [
          req.actor.id,
          hash(
            Buffer.from(req.headers.authorization!.slice(6), "base64")
              .toString()
              .split(":")
              .slice(1)
              .join(":"),
          ),
        ],
        db,
      );
      assert(credential, 401, "REVOKED", "Accès révoqué.");
      const item = (await resources(req, collection, db)).find(
        (i) => i.path === name,
      );
      if (item) {
        assert(
          req.get("if-match") === etag(item.data),
          412,
          "ETAG_MISMATCH",
          "Événement modifié ; actualisez avant de réessayer.",
        );
        const original = await targetAccess(
          req.actor,
          collection,
          "event",
          item.row.id,
          db,
        );
        if (original.user_id !== req.actor.id)
          await authorize(req.actor, collection, "MANAGE_CALENDAR");
        if (input)
          assert(
            input.uid === (original.calendar_uid || original.id + "@liora"),
            409,
            "UID_MISMATCH",
            "L’UID ne peut pas changer.",
          );
      } else {
        assert(
          req.method === "PUT",
          404,
          "NOT_FOUND",
          "Événement introuvable.",
        );
        assert(
          !req.get("if-match"),
          412,
          "ETAG_MISMATCH",
          "Événement supprimé.",
        );
        await authorize(req.actor, collection, "CREATE_CALENDAR_EVENT");
      }
      if (req.method === "DELETE") {
        await query(
          "DELETE FROM calendar_events WHERE id=$1 AND workspace_id=$2",
          [item!.row.id, collection],
          db,
        );
        await emit(collection, "calendar.updated", req.actor.id, {}, db);
        return null;
      }
      if (item)
        assert(
          req.get("if-none-match") !== "*",
          412,
          "ALREADY_EXISTS",
          "Cette ressource existe déjà.",
        );
      const b = input!.values;
      const collision = await query(
        "SELECT id FROM calendar_events WHERE workspace_id=$1 AND COALESCE(calendar_uid,id::text||'@liora')=$2 AND ($3::uuid IS NULL OR id<>$3)",
        [collection, input!.uid, item?.row.id || null],
        db,
      );
      assert(
        !collision.length,
        409,
        "UID_EXISTS",
        "Cet événement existe déjà.",
      );
      let row;
      if (item) {
        [row] = await query(
          `UPDATE calendar_events SET title=$3,description=$4,start_at=$5,"end"=$6,timezone=$7,all_day=$8,recurrence=$9,reminder_minutes=$10,next_reminder_at=$11,reminder_initialized=true,calendar_uid=$12,dav_href=$13,dav_data=$14,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING *`,
          [
            item.row.id,
            collection,
            b.title,
            b.description,
            b.start_at,
            b.end_at,
            b.timezone,
            b.all_day,
            b.recurrence,
            b.reminder_minutes,
            calendarReminderAt(b),
            input!.uid,
            name,
            String(req.body),
          ],
          db,
        );
      } else {
        [row] = await query(
          `INSERT INTO calendar_events(workspace_id,user_id,title,description,start_at,"end",timezone,all_day,recurrence,reminder_minutes,next_reminder_at,reminder_initialized,calendar_uid,dav_href,dav_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14) RETURNING *`,
          [
            collection,
            req.actor.id,
            b.title,
            b.description,
            b.start_at,
            b.end_at,
            b.timezone,
            b.all_day,
            b.recurrence,
            b.reminder_minutes,
            calendarReminderAt(b),
            input!.uid,
            name,
            String(req.body),
          ],
          db,
        );
      }
      await emit(collection, "calendar.updated", req.actor.id, {}, db);
      return { row, created: !item };
    });
    if (!result) res.status(204).end();
    else
      res
        .status(result.created ? 201 : 204)
        .set("ETag", etag(eventIcal(result.row)))
        .end();
  } catch (e) {
    next(e);
  }
});
caldavRouter.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 401)
      res.set(
        "WWW-Authenticate",
        'Basic realm="Liora CalDAV", charset="UTF-8"',
      );
    res
      .status(status)
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="utf-8"?><D:error xmlns:D="DAV:"><D:responsedescription>${xml(error instanceof HttpError ? error.message : "Le calendrier est temporairement indisponible.")}</D:responsedescription></D:error>`,
      );
  },
);
