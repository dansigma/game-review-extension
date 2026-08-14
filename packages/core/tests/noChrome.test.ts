import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTs(path));
    } else if (entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("core isolation", () => {
  it("never imports Chrome, DOM, or IndexedDB", () => {
    const banned =
      /\bchrome\b|\bindexedDB\b|\bdocument\b|\bwindow\b|\bHTMLElement\b/;
    for (const file of walkTs(srcDir)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(banned);
    }
  });
});
