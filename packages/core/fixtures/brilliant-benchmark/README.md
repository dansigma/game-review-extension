# Brilliant Benchmark — Chessigma 100

Source: https://www.chessigma.com/benchmarks/brilliant/data
Retrieval date: 2026-08-21

Attribution: dataset compiled by Chessigma from chess.com games; labels are chess.com Game Review's stored calls.

## Format

Public JSON array of 100 items, each `{ pgn, ply }`:

- `pgn` — full PGN with headers and clock annotations (`[%clk ...]`), as exported by chess.com.
- `ply` — 1-based halfmove count from the initial position that chess.com's Game Review labeled "brilliant". Ply 1 = White's first move, ply 2 = Black's first move, etc. Our harness converts to 0-based index as `ply - 1` when aligning to `NormalizedMove.ply` (which is 0-based).

## Benchmark page

https://www.chessigma.com/benchmarks/brilliant

Reference range over free tools (as published on the benchmark page): recall 23–93/100, precision 51–95%, incorrect brilliant calls per 1,000 ordinary moves 0.7–4.2.

## Baseline vs production — reduced-config disclaimer

> **Reduced-config baseline — not production-equivalent.** The published baseline in `results.md`/`results.json` used Stockfish 16 binary at 50,000 nodes/position, single pass, no pass-2. Production (`reviewGameWithEngine` in `packages/extension/src/reviewWithEngine.ts`) uses sf_18 WASM (`MVP_ENGINE_ID=\"sf_18\"`) at 400,000 nodes (`MVP_NODES_PER_POSITION`) plus pass-2 critical-moment re-analysis (`selectCriticalMoments`/`pass2EvalIndexes`). The benchmark reuses the same `classifyMove`/`reviewGame` gating as production, but the 3/100 recall measures the reduced config, not extension production performance.

Deviations recorded in `results.md` Notes: (1) engine version Stockfish 16 binary vs sf_18 WASM, (2) 50k single-pass vs 400k + pass-2, (3) missing `selectCriticalMoments`/`pass2EvalIndexes` refinement.

## Usage

- Fixture is committed verbatim; do not edit.
- Evaluation harness: `npm run eval:benchmark` (see `packages/benchmark/` or `scripts/benchmark/`).
- Results: `packages/core/fixtures/brilliant-benchmark/results.json` + `results.md`.
