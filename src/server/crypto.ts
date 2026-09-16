// src/server/crypto.ts
import { createHash, randomBytes } from "node:crypto";
import { CompactEncrypt, compactDecrypt } from "jose";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw Error("SESSION_SECRET must contain at least 32 characters");
  return createHash("sha256").update(secret).digest();
}
export async function seal(value: unknown) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(value)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key());
}
export async function unseal<T>(value: string): Promise<T> {
  return JSON.parse(
    new TextDecoder().decode((await compactDecrypt(value, key())).plaintext),
  ) as T;
}
