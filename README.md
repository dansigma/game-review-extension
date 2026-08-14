# Game Review (extensão)

Extensão Chrome MV3 para revisar partidas **depois que terminam**. Motor local: Stockfish 18 (`sf_18_smallnet`) via `@lichess-org/stockfish-web`. Licença do produto: **GPL-3.0-only** (Stockfish). O pacote `stockfish-web` é AGPL-3.0-or-later.

Arquitetura travada em [SIG-651](https://linear.app/sigmalabs/issue/SIG-651). Este repositório não reabre essas decisões.

## Pacotes

- `packages/core` — `NormalizedGame` + `ReviewEngine` (TypeScript puro, sem Chrome/DOM). SIG-653.
- `packages/extension` — shell MV3 + Side Panel. SIG-652.

Pipeline: `HostAdapter` → `Provider` → `NormalizedGame` → `EnginePort` → `ReviewEngine` → `GameReview` → IndexedDB + Side Panel.

## Desenvolvimento

```bash
npm install
npm test
npm run poc:lichess
npm run build:extension
```

### Carregar no Chrome (uso interno Lichess)

1. `npm run build:extension`
2. `chrome://extensions` → Modo do desenvolvedor → **Carregar sem compactação**
3. Selecione a pasta `packages/extension/dist`
4. Abra uma partida **finalizada** no Lichess e use o botão na página ou o ícone da extensão para abrir o Side Panel — **ou** cole/abra um PGN no Side Panel (sem aba do Lichess)

**Cancelar análise:** feche o Side Panel ou use **Cancelar** durante a análise. A análise interrompida não é salva no cache.

**Partidas ao vivo:** partidas com `status === started` são rejeitadas — análise só pós-jogo.

## Cache IndexedDB (MVP)

Reabrir a mesma partida finalizada (Lichess ou PGN colado) não reexecuta o Stockfish se o cache acertar. A chave inclui:

- `gameId`
- `algoVersion` (`epl-v1`)
- `engineId` (`sf_18_smallnet`)
- `nodesPerPosition` (`80000`)

Formato: `gameId|algoVersion|engineId|nodesPerPosition`. Mudar `ALGO_VERSION` invalida entradas antigas.

## Orçamento do motor (SIG-652)

MVP: `go nodes 80000`, MultiPV=2, Threads=1, `sf_18_smallnet` no Side Panel.
`go depth 16` é mais lento e imprevisível (Kiwipete ~525ms/pos no Node). Nodes cabe em ≤2 min para 40 e 80 plies. Fechar o painel cancela a análise; offscreen fica para depois.

## Precisão (`epl-v1`)

Win% usa a curva logística do Lichess (`0.00368208`). Precisão **não** usa `103.1668 * exp(...)`.

- Lance: `100 * (1 - EPL)^1.2`
- Partida: `0.5 * trimmedMean + 0.5 * harmonicMean`
- Classes: Best / Good / Imprecisão / Erro / Blunder
- Hopeless (win% ≤ 10) → Forced, fora da precisão

## Licenças

- Extensão e `packages/core`: **GPL-3.0-only**
- Motor embutido: Stockfish (GPL) via `@lichess-org/stockfish-web` (AGPL-3.0-or-later)
- Peças do tabuleiro: set **Cburnett** (Wikimedia), GPL / CC BY-SA 3.0. Não é chessground.

## Fora do MVP

Sem conta, sem backend, sem Chess.com, sem Brilliant, sem engine em partida ao vivo, sem importar várias partidas de um único arquivo PGN. Não é fork de Pawn Appétit nem de chess.com.puter.
