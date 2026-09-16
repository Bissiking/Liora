// src/server/network.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { assert } from "./errors.js";
export function privateAddress(ip: string) {
  if (isIP(ip) !== 4) return true;
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export async function validateOutboundUrl(raw: string) {
  const u = new URL(raw);
  assert(
    u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443"),
    400,
    "INVALID_DESTINATION",
    "Une URL HTTPS publique sans identifiants est requise.",
  );
  const addresses = (await lookup(u.hostname, { all: true })).filter(
    (a) => a.family === 4,
  );
  assert(
    addresses.length && addresses.every((a) => !privateAddress(a.address)),
    400,
    "PRIVATE_DESTINATION",
    "Les destinations privées sont interdites.",
  );
  return addresses[0].address;
}
