# SIG-697 — Futuro: resumo LLM da partida

## Status

**DONE**

## Branch + commit

- Branch: `daniloalves/sig-697-futuro-resumo-llm-da-partida`
- Commit: `46ac288`

## Summary

Added a post-analysis game summary (3–5 PT-BR sentences) with one LLM call per `gameId|algoVersion`, template fallback, IndexedDB cache, and Side Panel UI block `#review-game-summary` shown only after Stockfish completes.

## Files changed

### Core (`packages/core`)
- `src/gameSummarySlice.ts` — `GameSummarySlice`, `buildGameSummarySlice`
- `src/fallbackGameSummary.ts` — deterministic PT-BR fallback
- `src/index.ts` — exports
- `tests/gameSummarySlice.test.ts`

### Comment proxy (`packages/comment-proxy`)
- `src/parseGameSummarySlice.ts` — validation + leaky-key rejection
- `src/buildSummaryPrompt.ts` — kid-coach summary prompt
- `src/summaryOpenrouter.ts` — OpenRouter call for summaries
- `src/openrouter.ts` — generalized `requestOpenRouterText` (comment path unchanged)
- `src/buildPrompt.ts` — export `SHARED_BASE`
- `src/index.ts` — `POST /summary`
- `tests/summaryProxy.test.ts`
- `README.md`

### Extension (`packages/extension`)
- `src/commentProxy.ts` — `requestGameSummary`, `summaryEndpoint`
- `src/summaryCache.ts` — separate IndexedDB cache (`gameId|algoVersion`)
- `src/ui/gameReviewPanel.ts` — load/cache/render summary in `showReview` only
- `sidepanel.html` — `#review-game-summary` + styles
- `tests/gameSummary.test.ts`

## Tests

```bash
npm test
npm run typecheck
```

**Result:** all passed (373 tests across core/extension/comment-proxy; typecheck clean).

## Self-review checklist

- [x] `/comment` unchanged behavior; `/summary` is separate route
- [x] No summary request during `showAnalyzing` / Stockfish
- [x] `OPENROUTER_API_KEY` stays on Worker only
- [x] Summary payload has no UCI/FEN/PV (validated client + server)
- [x] ReviewEngine / classification untouched
- [x] Core remains host-agnostic (`noChrome.test.ts` passes)
- [x] Fallback labeled `Texto automático (sem IA)` like move comments

## Concerns

None.
