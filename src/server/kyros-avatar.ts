// src/server/kyros-avatar.ts
import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { getKyrosConfig } from "./kyros.js";
import { imageMime, publicFetch } from "./previews.js";
export async function fetchKyrosAvatar(raw: string) {
  const url = new URL(raw),
    trusted = new URL(getKyrosConfig().baseUrl);
  let bytes: Buffer;
  if (url.origin !== trusted.origin)
    bytes = (await publicFetch(raw, 2_000_000)).bytes;
  else {
    // The operator's configured Kyros origin is trusted, including local deployments. Pin DNS and refuse redirects.
    const address = await lookup(url.hostname, { family: 4 });
    bytes = await new Promise<Buffer>((resolve, reject) => {
      const request = (url.protocol === "https:" ? https : http).get(
        url,
        {
          lookup: (_h, _o, cb) => cb(null, address.address, 4),
          headers: { accept: "image/png,image/jpeg,image/webp,image/gif" },
        },
        (response) => {
          if (response.statusCode !== 200) {
            response.resume();
            reject(Error("Avatar unavailable"));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2_000_000) request.destroy(Error("Image too large"));
            else chunks.push(chunk);
          });
          response.on("error", reject);
          response.on("end", () => resolve(Buffer.concat(chunks)));
        },
      );
      const timer = setTimeout(() => request.destroy(Error("timeout")), 5000);
      request.on("close", () => clearTimeout(timer));
      request.on("error", reject);
    });
  }
  const mime = imageMime(bytes);
  if (!mime) throw Error("Unsupported avatar");
  return { bytes, mime };
}
