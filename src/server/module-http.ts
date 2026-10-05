// src/server/module-http.ts
import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { privateAddress } from "./network.js";
import { assert } from "./errors.js";
export class ModuleHttpError extends Error {
  constructor(public status: number) {
    super(`Le module a répondu HTTP ${status}`);
  }
}
export async function moduleRequest(
  base: string,
  route: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    userToken?: string;
    userTokenHeader?: "x-dropit-user-token" | "x-braindump-user-token";
    allowPrivate?: boolean;
  } = {},
) {
  const url = new URL(base);
  assert(
    !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ["https:", "http:"].includes(url.protocol),
    400,
    "INVALID_URL",
    "URL de module invalide.",
  );
  const addresses = (await lookup(url.hostname, { all: true })).filter(
    (a) => a.family === 4,
  );
  assert(addresses.length, 400, "NO_ADDRESS", "Adresse IPv4 introuvable.");
  const loopback = addresses.every((a) => a.address.startsWith("127."));
  assert(
    url.protocol === "https:" || (options.allowPrivate && loopback),
    400,
    "HTTPS_REQUIRED",
    "HTTPS requis, sauf boucle locale explicitement autorisée.",
  );
  assert(
    addresses.every(
      (a) =>
        !a.address.startsWith("169.254.") &&
        !a.address.startsWith("0.") &&
        Number(a.address.split(".")[0]) < 224 &&
        (options.allowPrivate || !privateAddress(a.address)),
    ),
    400,
    "PRIVATE_DESTINATION",
    "Destination privée : autorisation explicite requise.",
  );
  url.pathname = url.pathname.replace(/\/$/, "") + route.split("?")[0];
  url.search = route.includes("?") ? route.slice(route.indexOf("?")) : "";
  const body =
    options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise<any>((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: options.method || (body ? "POST" : "GET"),
        family: 4,
        lookup: (_h, _o, cb) => cb(null, addresses[0].address, 4),
        headers: {
          accept: "application/json",
          "user-agent": "Liora/0.3.0",
          ...(body
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
          ...(options.key ? { authorization: `Bearer ${options.key}` } : {}),
          ...(options.userToken
            ? {
                [options.userTokenHeader || "x-dropit-user-token"]:
                  options.userToken,
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) req.destroy(Error("Réponse trop volumineuse"));
          else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            res.statusCode >= 300
          ) {
            reject(new ModuleHttpError(res.statusCode || 502));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(Error("Réponse JSON invalide"));
          }
        });
      },
    );
    const timer = setTimeout(
      () => req.destroy(Error("Le module ne répond pas")),
      8000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end(body);
  });
}
