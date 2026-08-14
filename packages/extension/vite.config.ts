import { defineConfig } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  publicDir: "public",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(root, "sidepanel.html"),
        background: resolve(root, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [
    {
      name: "extension-static",
      closeBundle() {
        const dist = resolve(root, "dist");
        writeFileSync(
          resolve(dist, "manifest.json"),
          readFileSync(resolve(root, "manifest.json")),
        );
      },
    },
    {
      name: "inline-manifest-check",
      buildStart() {
        readFileSync(resolve(root, "manifest.json"), "utf8");
      },
    },
  ],
});
