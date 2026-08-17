# Game Review (extensão)

Extensão Chrome MV3 para revisar partidas **depois que terminam**. Motor local: Stockfish 18 (`sf_18`, NNUE completo) via `@lichess-org/stockfish-web`. Licença do produto: **GPL-3.0-only** (Stockfish). O pacote `stockfish-web` é AGPL-3.0-or-later.

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

**Cancelar análise:** use **Cancelar** durante a análise. Fechar o Side Panel **não** cancela. Análise interrompida não é salva no cache.

**Partidas ao vivo:** partidas com `status === started` são rejeitadas — análise só pós-jogo.

## Cache IndexedDB (MVP)

Reabrir a mesma partida finalizada (Lichess ou PGN colado) não reexecuta o Stockfish se o cache acertar. A chave inclui:

- `gameId`
- `algoVersion` (`lila-v5`)
- `engineId` (`sf_18`)
- `nodesPerPosition` (`400000`)

Formato: `gameId|algoVersion|engineId|nodesPerPosition`. Mudar `ALGO_VERSION` invalida entradas antigas.

## Orçamento do motor (SIG-652)

Padrão: `go nodes 400000`, MultiPV=2, Threads=2, `sf_18` (NNUE completo) no documento offscreen.
Presets: Rápido 80k, Padrão 400k, Profundo 1,5M. WASM com 1 thread não reproduz bitwise o fishnet do Lichess (~1,5M nodes, nativo). A análise roda em um documento offscreen: fechar o Side Panel **não** cancela; o botão **Cancelar** cancela. Cache continua no IndexedDB.

## Precisão (`lila-v5`)

Win% usa a curva logística do Lichess (`0.00368208`); mates convertem para cp antes da logística. Precisão de lance e partida segue o código do Lichess (`AccuracyPercent.scala`):

- Lance: curva `103.1668… * exp(-0.04354… * winDiff) - 3.1669…` com bônus +1 de incerteza
- Partida: média ponderada por volatilidade (desvio padrão populacional das janelas de Win%) + média harmônica, por cor
- Classes: Brilliant / Great / Best / Erro / Miss / Blunder (limiares EPL 0,02 qualidade / 0,05 Best / 0,15 Erro; Miss/Brilliant/Great com regras adicionais)
- Hopeless (win% ≤ 10) → Forced, mas a precisão **ainda é calculada** e entra no agregado

## Licenças

- Extensão e `packages/core`: **GPL-3.0-only**
- Motor embutido: Stockfish (GPL) via `@lichess-org/stockfish-web` (AGPL-3.0-or-later)
- Peças do tabuleiro: set **Cburnett** (Wikimedia), GPL / CC BY-SA 3.0. Não é chessground.

## Fora do MVP

Sem conta, sem backend, sem Chess.com, sem engine em partida ao vivo, sem importar várias partidas de um único arquivo PGN. Não é fork de Pawn Appétit nem de chess.com.puter.
