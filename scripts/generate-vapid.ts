// scripts/generate-vapid.ts
import webpush from "web-push";
import { mkdir, writeFile } from "node:fs/promises";
const keys = webpush.generateVAPIDKeys();
await mkdir(".local", { recursive: true, mode: 0o700 });
await writeFile(
  ".local/vapid.env",
  `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:admin@example.com\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Clés créées dans .local/vapid.env (fichier privé). Renseignez le contact VAPID_SUBJECT puis ajoutez ces variables au déploiement. Les clés existantes ne sont jamais remplacées.",
);
