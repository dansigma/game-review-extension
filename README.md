# Game Review (extensão)

Extensão Chrome MV3 para revisar partidas **depois que terminam**. Motor local: Stockfish 18 (`sf_18_smallnet`) via `@lichess-org/stockfish-web`. Licença do produto: **GPL-3.0-only** (Stockfish). O pacote `stockfish-web` é AGPL-3.0-or-later.

Arquitetura travada em [SIG-651](https://linear.app/sigmalabs/issue/SIG-651). Este repositório não reabre essas decisões.

## Pacotes

- `packages/core` — `NormalizedGame` + `ReviewEngine` (TypeScript puro, sem Chrome/DOM). SIG-653.
- `packages/extension` — shell MV3 + PoCs do Side Panel. SIG-652.

Pipeline: `HostAdapter` → `Provider` → `NormalizedGame` → `EnginePort` → `ReviewEngine` → `GameReview`.

## Desenvolvimento

```bash
npm install
npm test
npm run poc:lichess
npm run build:extension
```

No Chrome: `chrome://extensions` → Developer mode → Load unpacked → `packages/extension/dist`. O ícone da extensão abre o Side Panel dos PoCs.

`npm run poc:budget` tenta o mesmo orçamento depth vs nodes em Node (WASM).

## Orçamento do motor (SIG-652)

MVP: `go nodes 80000`, MultiPV=2, Threads=1, `sf_18_smallnet` no Side Panel.
`go depth 16` é mais lento e imprevisível (Kiwipete ~525ms/pos no Node). Nodes cabe em ≤2 min para 40 e 80 plies. Fechar o painel cancela a análise; offscreen fica para depois.

## Precisão (`epl-v1`)

Win% usa a curva logística do Lichess (`0.00368208`). Precisão **não** usa `103.1668 * exp(...)`.

- Lance: `100 * (1 - EPL)^1.2`
- Partida: `0.5 * trimmedMean + 0.5 * harmonicMean`
- Classes: Best / Good / Imprecisão / Erro / Blunder
- Hopeless (win% ≤ 10) → Forced, fora da precisão

## Fora do MVP

Sem conta, sem backend, sem Chess.com, sem Brilliant, sem engine em partida ao vivo. Não é fork de Pawn Appétit nem de chess.com.puter.
