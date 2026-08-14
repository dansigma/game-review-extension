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
const SMALLNET_NNUE = "nn-4ca89e4b3abf.nnue";
const NNUE_URL = `https://tests.stockfishchess.org/api/nn/${SMALLNET_NNUE}`;

mkdirSync(dest, { recursive: true });

const pkgJson = require.resolve("@lichess-org/stockfish-web/package.json");
const stockfishDir = dirname(pkgJson);

const copied = [];
for (const name of ["sf_18_smallnet.js", "sf_18_smallnet.wasm"]) {
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

const nnuePath = join(dest, SMALLNET_NNUE);
if (!existsSync(nnuePath)) {
  console.log(`Downloading ${SMALLNET_NNUE}…`);
  const response = await fetch(NNUE_URL);
  if (!response.ok || !response.body) {
    console.error(`NNUE download failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(nnuePath));
}

writeFileSync(
  join(dest, "README.txt"),
  [
    "Stockfish 18 smallnet WASM + NNUE.",
    "Source: @lichess-org/stockfish-web (AGPL-3.0-or-later). Stockfish itself is GPL-3.0.",
    `NNUE: ${SMALLNET_NNUE}`,
    `Copied: ${copied.join(", ")}`,
  ].join("\n"),
  "utf8",
);

console.log(`Engine assets in ${dest}: ${copied.join(", ")}, ${SMALLNET_NNUE}`);
