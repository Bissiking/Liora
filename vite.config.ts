// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "liora-offline-shell",
      async writeBundle(options, bundle) {
        const files = Object.keys(bundle)
          .filter((name) => /\.(js|css|woff2)$/.test(name))
          .map((name) => `/${name}`);
        const source = await readFile("public/sw.js", "utf8");
        const manifest = await readFile("public/manifest.webmanifest", "utf8");
        const buildId = createHash("sha256")
          .update(files.join("\n") + source + manifest)
          .digest("hex")
          .slice(0, 16);
        const precache = [
          "/",
          "/manifest.webmanifest",
          "/brand/icon.svg",
          "/brand/logo-dark.svg",
          "/brand/icon-192.png",
          "/brand/icon-512.png",
          ...files,
        ];
        const worker = source
          .replace("__BUILD_ID__", buildId)
          .replace("__PRECACHE__", JSON.stringify(precache));
        new Script(worker);
        await writeFile(`${options.dir}/sw.js`, worker);
      },
    },
  ],
  build: { outDir: "dist/client", assetsInlineLimit: 0 },
});
