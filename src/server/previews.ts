// src/server/previews.ts
import https from "node:https";
import { Router } from "express";
import { z } from "zod";
import { validateOutboundUrl } from "./network.js";
import { assert } from "./errors.js";
import { channelAccess } from "./access.js";
import { authorize } from "./auth.js";
export function imageMime(bytes: Buffer) {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString()))
    return "image/gif";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function publicFetch(raw: string, max = 524288) {
  const address = await validateOutboundUrl(raw);
  return new Promise<{ bytes: Buffer; type: string }>((resolve, reject) => {
    const request = https.get(
      new URL(raw),
      {
        family: 4,
        headers: {
          "User-Agent": "Liora-LinkPreview/0.2.1",
          Accept: "text/html,image/png,image/jpeg,image/gif,image/webp",
        },
        lookup: (_host, _opts, cb) => cb(null, address, 4),
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(Error("Cette ressource ne fournit pas d’aperçu direct."));
          return;
        }
        const buffers: Buffer[] = [];
        let size = 0;
        response.on("data", (c: Buffer) => {
          size += c.length;
          if (size > max) request.destroy(Error("Aperçu trop volumineux."));
          else buffers.push(c);
        });
        response.on("end", () =>
          resolve({
            bytes: Buffer.concat(buffers),
            type: String(response.headers["content-type"] || ""),
          }),
        );
        response.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => request.destroy(Error("Délai total dépassé.")),
      5000,
    );
    request.on("close", () => clearTimeout(deadline));
    request.setTimeout(5000, () =>
      request.destroy(Error("Le site ne répond pas.")),
    );
    request.on("error", reject);
  });
}
const text = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
export function extractPreview(html: string, url: string) {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))
      attrs[match[1].toLowerCase()] = match[2];
    const key = attrs.property || attrs.name;
    if (key) meta[key.toLowerCase()] = attrs.content || "";
  }
  return {
    url,
    host: new URL(url).hostname,
    title: text(
      meta["og:title"] ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
        new URL(url).hostname,
    ).slice(0, 200),
    description: text(meta["og:description"] || meta.description || "").slice(
      0,
      500,
    ),
  };
}
export const previewRouter = Router({ mergeParams: true });
previewRouter.get("/link-preview", async (req, res) => {
  await authorize(req.actor, z.uuid().parse(req.workspaceId), "VIEW_CHANNEL");
  const url = z.url().max(2000).parse(req.query.url);
  const r = await publicFetch(url);
  assert(
    r.type.toLowerCase().includes("text/html"),
    400,
    "NO_PREVIEW",
    "Ce lien ne propose pas de page HTML.",
  );
  res.json({ data: extractPreview(r.bytes.toString("utf8"), url) });
});
previewRouter.get("/channels/:id/media", async (req, res) => {
  await channelAccess(
    req.actor,
    z.uuid().parse(req.workspaceId),
    z.uuid().parse(req.params.id),
  );
  const url = z.url().max(2000).parse(req.query.url);
  const r = await publicFetch(url, 3_000_000);
  const mime = imageMime(r.bytes);
  assert(
    mime,
    400,
    "INVALID_IMAGE",
    "Seules les images PNG, JPEG, WebP et GIF sont acceptées.",
  );
  res.type(mime).send(r.bytes);
});
