import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateAll, DATASET_REL } from "./evaluate.ts";
import { parsePgn } from "../../core/src/parsePgn.ts";
import type { BenchmarkGameInput } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const datasetPath = resolve(repoRoot, DATASET_REL);
const resultsJsonPath = resolve(repoRoot, "packages/core/fixtures/brilliant-benchmark/results.json");
const resultsMdPath = resolve(repoRoot, "packages/core/fixtures/brilliant-benchmark/results.md");

async function main() {
  const raw = readFileSync(datasetPath, "utf8");
  const dataset = JSON.parse(raw) as BenchmarkGameInput[];
  console.log(`Loaded ${dataset.length} games from ${datasetPath}`);
  // Sanity check ply indexing on first game
  const first = dataset[0];
  if (first) {
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
    `Done. Recall=${results.metrics.recall.toFixed(3)} Precision=${results.metrics.precision.toFixed(3)} FP/1000=${results.metrics.fpPer1000.toFixed(2)} TP=${results.metrics.tp} FP=${results.metrics.fp} FN=${results.metrics.fn} engineFailures=${results.metrics.engineFailures} time=${(results.meta.wallClockMs / 1000).toFixed(1)}s`,
  );
  mkdirSync(dirname(resultsJsonPath), { recursive: true });
  writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Wrote ${resultsJsonPath}`);

  // Build human-readable results.md
  const lines: string[] = [];
  lines.push(`# Brilliant Benchmark Results`);
  lines.push(``);
  lines.push(`> **Reduced-config baseline — not production-equivalent.** This run used a Stockfish 16 binary at 50,000 nodes/position, single pass, no pass-2. Production (\`reviewGameWithEngine\` in \`packages/extension/src/reviewWithEngine.ts\`) uses sf_18 WASM at 400,000 nodes plus pass-2 critical-moment re-analysis (\`selectCriticalMoments\`/\`pass2EvalIndexes\`). The 3/100 recall below measures this reduced config, not the extension's production performance.`);
  lines.push(``);
  lines.push(`- Engine: \`${results.meta.enginePath}\` (\`${results.meta.engineId}\`) — Stockfish 16 binary (production uses sf_18 WASM)`);
  lines.push(`- Nodes per position: ${results.meta.nodesPerPosition} single-pass, no pass-2 (production: 400,000 nodes + pass-2 refinement)`);
  lines.push(`- Dataset: ${results.meta.dataset} (100 games, ${results.metrics.totalPlies} plies)`);
  lines.push(`- Generated: ${results.meta.generatedAt}`);
  lines.push(`- Wall-clock: ${(results.meta.wallClockMs / 1000).toFixed(1)}s (~${(results.meta.wallClockMs / 60000).toFixed(1)} min)`);
  lines.push(``);
  lines.push(`## Global metrics`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Recall — reduced-config baseline, not production-equivalent (TP/100) | ${results.metrics.tp}/100 = ${(results.metrics.recall * 100).toFixed(1)}% |`);
  lines.push(`| Precision (TP/(TP+FP)) | ${results.metrics.tp}/${results.metrics.tp + results.metrics.fp} = ${(results.metrics.precision * 100).toFixed(1)}% |`);
  lines.push(`| FP per 1000 ordinary moves | ${results.metrics.fpPer1000.toFixed(2)} |`);
  lines.push(`| TP | ${results.metrics.tp} |`);
  lines.push(`| FN | ${results.metrics.fn} |`);
  lines.push(`| FP | ${results.metrics.fp} |`);
  if (results.metrics.engineFailures > 0) lines.push(`| Engine failures (excluded from recall) | ${results.metrics.engineFailures} |`);
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
  if (results.metrics.engineFailures > 0) {
    lines.push(`## Engine failures`);
    lines.push(``);
    for (const g of results.perGame) {
      if (g.engineFailure) lines.push(`- Game ${g.gameIndex} (answer ply ${g.answerPly}): ${g.error ?? "engine failure"}`);
    }
    lines.push(``);
  }
  lines.push(`## Notes`);
  lines.push(``);
  lines.push(`- Ply indexing: dataset ply is 1-based halfmove; harness maps to 0-based \`NormalizedMove.ply\` as \`ply-1\`. Sanity-checked against first game in log.`);
  lines.push(`- Classification uses same \`classifyMove\` + \`reviewGame\` + sacrifice/only-move gating as production (via \`@game-review/core\`), but engine evaluation differs — see deviations above. The 3/100 recall quantifies the reduced-config baseline, not production.`);
  lines.push(`- Deviations from production that affect the reported metrics: (1) engine version Stockfish 16 binary vs production sf_18 WASM (\`MVP_ENGINE_ID="sf_18"\` in \`packages/extension/src/budgetDecision.ts\`), (2) node budget 50,000 single-pass vs production 400,000 (\`MVP_NODES_PER_POSITION\`), (3) no pass-2 critical-moment re-analysis (\`selectCriticalMoments\`/\`pass2EvalIndexes\` in \`reviewGameWithEngine.ts\` — skipped entirely). MultiPV=2 matches production.`);
  lines.push(``);
  writeFileSync(resultsMdPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${resultsMdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
