import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(root, "src/content/lichessGameCta.ts"),
      name: "GameReviewCta",
      formats: ["iife"],
      fileName: () => "content/lichessGameCta.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: "assert-content-script-iife",
      closeBundle() {
        const file = resolve(root, "dist/content/lichessGameCta.js");
        const source = readFileSync(file, "utf8");
        if (/^\s*import\b/m.test(source) || /\bfrom\s*["']\.\.\//.test(source)) {
          throw new Error(
            "content/lichessGameCta.js must be a classic IIFE. Chrome content scripts cannot load ESM imports.",
          );
        }
      },
    },
  ],
});
