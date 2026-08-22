import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAll } from "./evaluate.ts";
import type { BenchmarkGameInput } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const datasetPath = resolve(repoRoot, "packages/core/fixtures/brilliant-benchmark/chessigma-100.json");
const resultsJsonPath = resolve(repoRoot, "packages/core/fixtures/brilliant-benchmark/results.json");
const resultsMdPath = resolve(repoRoot, "packages/core/fixtures/brilliant-benchmark/results.md");

async function main() {
  const raw = readFileSync(datasetPath, "utf8");
  const dataset = JSON.parse(raw) as BenchmarkGameInput[];
  console.log(`Loaded ${dataset.length} games from ${datasetPath}`);
  // Sanity check ply indexing on first game
  const first = dataset[0];
  if (first) {
    // Parse first game quickly to show SAN at answer ply
    const { parsePgn } = await import("../../core/src/parsePgn.ts");
    const g = parsePgn(first.pgn);
    const idx = first.ply - 1;
    const move = g.moves[idx];
    console.log(`Sanity-check: game 0 answer ply ${first.ply} (1-based) => index ${idx} => SAN=${move?.san} UCI=${move?.uci} (total plies ${g.moves.length})`);
  }
  const start = Date.now();
  const results = await evaluateAll(dataset, {
    onProgress: (done, total) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`Progress ${done}/${total} elapsed ${elapsed}s`);
    },
  });
  console.log(
    `Done. Recall=${results.metrics.recall.toFixed(3)} Precision=${results.metrics.precision.toFixed(3)} FP/1000=${results.metrics.fpPer1000.toFixed(2)} TP=${results.metrics.tp} FP=${results.metrics.fp} FN=${results.metrics.fn} time=${(results.meta.wallClockMs / 1000).toFixed(1)}s`,
  );
  mkdirSync(dirname(resultsJsonPath), { recursive: true });
  writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Wrote ${resultsJsonPath}`);

  // Build human-readable results.md
  const lines: string[] = [];
  lines.push(`# Brilliant Benchmark Results`);
  lines.push(``);
  lines.push(`- Engine: \`${results.meta.enginePath}\` (\`${results.meta.engineId}\`)`);
  lines.push(`- Nodes per position: ${results.meta.nodesPerPosition} (MultiPV=${results.meta.multipv})`);
  lines.push(`- Dataset: ${results.meta.dataset} (100 games, ${results.metrics.totalPlies} plies)`);
  lines.push(`- Generated: ${results.meta.generatedAt}`);
  lines.push(`- Wall-clock: ${(results.meta.wallClockMs / 1000).toFixed(1)}s (~${(results.meta.wallClockMs / 60000).toFixed(1)} min)`);
  lines.push(``);
  lines.push(`## Global metrics`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Recall (TP/100) | ${results.metrics.tp}/100 = ${(results.metrics.recall * 100).toFixed(1)}% |`);
  lines.push(`| Precision (TP/(TP+FP)) | ${results.metrics.tp}/${results.metrics.tp + results.metrics.fp} = ${(results.metrics.precision * 100).toFixed(1)}% |`);
  lines.push(`| FP per 1000 ordinary moves | ${results.metrics.fpPer1000.toFixed(2)} |`);
  lines.push(`| TP | ${results.metrics.tp} |`);
  lines.push(`| FN | ${results.metrics.fn} |`);
  lines.push(`| FP | ${results.metrics.fp} |`);
  lines.push(`| Reference range (free tools, Chessigma) | recall 23–93/100, precision 51–95%, FP/1000 0.7–4.2 |`);
  lines.push(``);
  lines.push(`## Per-miss table (FN)`);
  lines.push(``);
  lines.push(`| Game | Answer ply (1-based) | Answer SAN | We classified as | FPs in game |`);
  lines.push(`|---|---|---|---|---|`);
  for (const g of results.perGame) {
    if (g.isFN) {
      const fps = g.falsePositives.length ? g.falsePositives.map((f) => `${f.ply}:${f.san}`).join(", ") : "—";
      lines.push(`| ${g.gameIndex} | ${g.answerPly} | ${g.answerSan ?? "?"} | ${g.ourClassificationAtAnswer ?? "error"} | ${fps} |`);
    }
  }
  lines.push(``);
  lines.push(`## Per-FP breakdown`);
  lines.push(``);
  for (const g of results.perGame) {
    if (g.falsePositives.length > 0) {
      lines.push(`- Game ${g.gameIndex} (answer ${g.answerPly}:${g.answerSan}): FP at ${g.falsePositives.map((f) => `${f.ply}:${f.san} (${f.classification})`).join(", ")}`);
    }
  }
  if (results.perGame.every((g) => g.falsePositives.length === 0)) lines.push(`(no false positives)`);
  lines.push(``);
  lines.push(`## Notes`);
  lines.push(``);
  lines.push(`- Ply indexing: dataset ply is 1-based halfmove; harness maps to 0-based \`NormalizedMove.ply\` as \`ply-1\`. Sanity-checked against first game in log.`);
  lines.push(`- Classification uses same \`classifyMove\` + \`reviewGame\` + sacrifice/only-move gating as production (via \`@game-review/core\`).`);
  lines.push(`- Engine budget capped at nodes=${results.meta.nodesPerPosition} to keep 100-game run under 60 min; deviation from production default (400k nodes) is recorded here.`);
  lines.push(``);
  writeFileSync(resultsMdPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${resultsMdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
