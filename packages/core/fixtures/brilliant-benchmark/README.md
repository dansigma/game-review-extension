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

## Usage

- Fixture is committed verbatim; do not edit.
- Evaluation harness: `npm run eval:benchmark` (see `packages/benchmark/` or `scripts/benchmark/`).
- Results: `packages/core/fixtures/brilliant-benchmark/results.json` + `results.md`.
