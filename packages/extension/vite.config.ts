import { defineConfig, loadEnv } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function proxyHostPermission(proxyUrl: string): string | null {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return `https://${parsed.host}/*`;
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const proxyUrl = env.VITE_COMMENT_PROXY_URL?.trim() ?? "";

  return {
    root,
    publicDir: "public",
    base: "./",
    envPrefix: "VITE_",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      modulePreload: false,
      rollupOptions: {
        input: {
          sidepanel: resolve(root, "sidepanel.html"),
          offscreen: resolve(root, "offscreen.html"),
          background: resolve(root, "src/background.ts"),
        },
        output: {
          entryFileNames: (chunk) => {
            if (chunk.name === "background") return "background.js";
            return "assets/[name].js";
          },
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
          const manifest = JSON.parse(
            readFileSync(resolve(root, "manifest.json"), "utf8"),
          ) as { host_permissions?: string[] };
          const permission = proxyHostPermission(proxyUrl);
          if (permission) {
            const existing = manifest.host_permissions ?? [];
            if (!existing.includes(permission)) {
              manifest.host_permissions = [...existing, permission];
            }
          }
          writeFileSync(
            resolve(dist, "manifest.json"),
            JSON.stringify(manifest, null, 2),
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
  };
});
