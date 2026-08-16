#!/usr/bin/env node
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(root, "..");
const dest = join(pkgRoot, "public", "engine");
const NNUE_FILES = [
  "nn-c288c895ea92.nnue",
  "nn-37f18f62d772.nnue",
];
const NNUE_BASE_URL = "https://tests.stockfishchess.org/api/nn";

mkdirSync(dest, { recursive: true });

const pkgJson = require.resolve("@lichess-org/stockfish-web/package.json");
const stockfishDir = dirname(pkgJson);

const copied = [];
for (const name of ["sf_18.js", "sf_18.wasm"]) {
  const from = join(stockfishDir, name);
  const to = join(dest, name);
  if (!existsSync(from)) {
    console.error(`Missing ${name} in stockfish-web`);
    process.exit(1);
  }
  if (!existsSync(to)) {
    cpSync(from, to);
  }
  copied.push(name);
}

for (const nnue of NNUE_FILES) {
  const nnuePath = join(dest, nnue);
  if (!existsSync(nnuePath)) {
    console.log(`Downloading ${nnue}…`);
    const response = await fetch(`${NNUE_BASE_URL}/${nnue}`);
    if (!response.ok || !response.body) {
      console.error(`NNUE download failed for ${nnue}: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(nnuePath));
  }
}

writeFileSync(
  join(dest, "README.txt"),
  [
    "Stockfish 18 full NNUE WASM (sf_18).",
    "Source: @lichess-org/stockfish-web (AGPL-3.0-or-later). Stockfish itself is GPL-3.0.",
    `NNUE: ${NNUE_FILES.join(", ")}`,
    `Copied: ${copied.join(", ")}`,
  ].join("\n"),
  "utf8",
);

console.log(`Engine assets in ${dest}: ${copied.join(", ")}, ${NNUE_FILES.join(", ")}`);
