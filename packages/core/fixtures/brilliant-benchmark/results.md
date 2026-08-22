# Brilliant Benchmark Results

> **Reduced-config baseline — not production-equivalent.** This run used a Stockfish 16 binary at 50,000 nodes/position, single pass, no pass-2. Production (`reviewGameWithEngine` in `packages/extension/src/reviewWithEngine.ts`) uses sf_18 WASM at 400,000 nodes plus pass-2 critical-moment re-analysis (`selectCriticalMoments`/`pass2EvalIndexes`). The 3/100 recall below measures this reduced config, not the extension's production performance.

- Engine: `/tmp/stockfish/stockfish-ubuntu-x86-64-avx2` (`sf_16_nodes_50k`) — Stockfish 16 binary (production uses sf_18 WASM)
- Nodes per position: 50000 single-pass, no pass-2 (production: 400,000 nodes + pass-2 refinement)
- Dataset: chessigma-100 (100 games, 7552 plies)
- Generated: 2026-08-22T00:09:45.160Z
- Wall-clock: 1146.9s (~19.1 min)

## Global metrics

| Metric | Value |
|---|---|
| Recall — reduced-config baseline, not production-equivalent (TP/100) | 3/100 = 3.0% |
| Precision (TP/(TP+FP)) | 3/6 = 50.0% |
| FP per 1000 ordinary moves | 0.40 |
| TP | 3 |
| FN | 97 |
| FP | 3 |
| Reference range (free tools, Chessigma) | recall 23–93/100, precision 51–95%, FP/1000 0.7–4.2 |

## Per-miss table (FN)

| Game | Answer ply (1-based) | Answer SAN | We classified as | FPs in game |
|---|---|---|---|---|
| 0 | 45 | hxg6 | best | — |
| 1 | 31 | f6 | great | — |
| 2 | 49 | Qd5 | great | — |
| 3 | 38 | Qxf2 | best | — |
| 4 | 25 | Nxg6 | opening | — |
| 5 | 81 | Qxc6+ | best | — |
| 6 | 21 | Qxb8+ | best | — |
| 7 | 74 | Rxf6 | great | — |
| 9 | 52 | Qc1+ | best | — |
| 10 | 49 | Bxf5+ | best | — |
| 11 | 23 | Nxc7+ | opening | — |
| 12 | 34 | Ba3 | best | — |
| 13 | 55 | Bxd5 | blunder | — |
| 14 | 27 | Nd5 | best | — |
| 15 | 30 | Ne4 | best | — |
| 16 | 18 | Nxd4 | opening | — |
| 17 | 91 | Bb6 | best | — |
| 18 | 50 | Rxb6 | best | — |
| 19 | 35 | Bxg4 | best | — |
| 20 | 48 | Bd3 | best | — |
| 21 | 23 | Nf6+ | best | — |
| 22 | 22 | Nxg4 | best | — |
| 23 | 37 | Nxc3 | best | — |
| 24 | 7 | Nxe5 | blunder | — |
| 25 | 25 | Nxc6 | inaccuracy | — |
| 26 | 11 | Bxf7+ | opening | — |
| 27 | 20 | Bc5 | opening | — |
| 28 | 51 | Bxd4 | great | — |
| 29 | 11 | Bxf7+ | opening | — |
| 30 | 31 | Qxd4 | best | — |
| 31 | 39 | Qf3 | best | — |
| 32 | 54 | Qe1+ | best | — |
| 33 | 41 | Bb4 | inaccuracy | — |
| 34 | 22 | Nxd5 | best | — |
| 35 | 18 | Bxh4 | opening | — |
| 36 | 52 | cxd2 | great | — |
| 37 | 23 | Bxb5 | best | — |
| 38 | 24 | Nxe5 | opening | — |
| 39 | 27 | Ne5 | best | — |
| 40 | 12 | Qxh6 | opening | — |
| 41 | 11 | Bxf7+ | opening | — |
| 42 | 32 | Bxc3 | best | — |
| 43 | 39 | Nxc6 | mistake | — |
| 44 | 39 | Bxg5 | best | — |
| 45 | 11 | Bxf7+ | opening | — |
| 46 | 20 | Qb6 | best | — |
| 47 | 46 | Rf1+ | great | — |
| 48 | 34 | Bxd4 | best | — |
| 49 | 59 | Bc7+ | great | — |
| 50 | 49 | Bg6+ | miss | — |
| 51 | 24 | Bg4 | best | — |
| 52 | 13 | Nxe5 | opening | — |
| 53 | 48 | Bxh2+ | great | — |
| 54 | 37 | Nxf6+ | best | — |
| 55 | 39 | h3 | inaccuracy | 94:Rxh4 |
| 56 | 22 | Nc2+ | opening | — |
| 57 | 15 | O-O | inaccuracy | — |
| 58 | 54 | Rxh2 | miss | — |
| 59 | 23 | Bxh6 | best | — |
| 60 | 33 | Qh5 | great | — |
| 61 | 38 | Qh6 | best | — |
| 62 | 32 | Bh3 | best | — |
| 63 | 79 | Qd8+ | best | — |
| 64 | 33 | Rxf6 | best | — |
| 65 | 13 | Bxf7+ | opening | — |
| 66 | 31 | c5 | best | — |
| 67 | 50 | Qb1 | mistake | — |
| 68 | 69 | Nxc4 | blunder | — |
| 69 | 72 | Qc1+ | best | — |
| 70 | 34 | Qxc5 | best | — |
| 71 | 11 | Bxf7+ | opening | — |
| 72 | 13 | Bxc4 | opening | — |
| 73 | 74 | Rxe3 | great | — |
| 74 | 23 | Bg5 | opening | — |
| 75 | 59 | fxg6 | best | — |
| 76 | 25 | Nxe6+ | opening | — |
| 79 | 51 | Qxe2 | great | — |
| 80 | 47 | c6 | best | — |
| 81 | 75 | Nxd5 | best | — |
| 82 | 31 | cxb6 | great | — |
| 83 | 39 | Nxf7 | best | — |
| 84 | 50 | Rxb4 | best | — |
| 85 | 23 | f5 | opening | 37:Rg4 |
| 86 | 50 | Qxe1+ | great | — |
| 87 | 62 | fxg5 | blunder | — |
| 88 | 35 | Bxh7+ | great | — |
| 89 | 12 | Nxd5 | opening | — |
| 90 | 32 | Rh6 | great | — |
| 91 | 64 | Rxf4 | blunder | — |
| 92 | 21 | exd5 | opening | — |
| 93 | 47 | Qxc5 | best | — |
| 94 | 41 | Bf6 | best | — |
| 95 | 100 | e1=Q+ | best | — |
| 96 | 56 | Rg6 | best | — |
| 97 | 26 | Bb7 | best | 70:Re3 |
| 98 | 53 | Kxf1 | best | — |
| 99 | 66 | Bxd4 | best | — |

## Per-FP breakdown

- Game 55 (answer 39:h3): FP at 94:Rxh4 (brilliant)
- Game 85 (answer 23:f5): FP at 37:Rg4 (brilliant)
- Game 97 (answer 26:Bb7): FP at 70:Re3 (brilliant)

## Notes

- Ply indexing: dataset ply is 1-based halfmove; harness maps to 0-based `NormalizedMove.ply` as `ply-1`. Sanity-checked against first game in log.
- Classification uses same `classifyMove` + `reviewGame` + sacrifice/only-move gating as production (via `@game-review/core`), but engine evaluation differs — see deviations above. The 3/100 recall quantifies the reduced-config baseline, not production.
- Deviations from production that affect the reported metrics: (1) engine version Stockfish 16 binary vs production sf_18 WASM (`MVP_ENGINE_ID=\"sf_18\"` in `packages/extension/src/budgetDecision.ts`), (2) node budget 50,000 single-pass vs production 400,000 (`MVP_NODES_PER_POSITION`), (3) no pass-2 critical-moment re-analysis (`selectCriticalMoments`/`pass2EvalIndexes` in `reviewGameWithEngine.ts` — skipped entirely). MultiPV=2 matches production.
