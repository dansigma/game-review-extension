# Comment proxy (Cloudflare Worker)

Receives a `CommentSlice` JSON body from the extension and forwards a Portuguese prompt to OpenRouter. The OpenRouter API key must **only** live in Worker secrets.

## Endpoints

- `POST /comment` (or `POST /`) — per-move coach comment from a `CommentSlice`
- `POST /summary` — one game summary per analysis from a `GameSummarySlice` (result, accuracy, judgement counts, top critical moments; no UCI/FEN/PV)

## Secrets and vars

```bash
wrangler secret put OPENROUTER_API_KEY
```

Optional model override (default `openai/gpt-5.6-luna` in `wrangler.toml`):

```bash
wrangler secret put OPENROUTER_MODEL   # or set [vars] OPENROUTER_MODEL
```

Local dev: copy `.dev.vars.example` to `.dev.vars` and set `OPENROUTER_API_KEY`.

## Deploy

```bash
npx wrangler deploy
```

Set `VITE_COMMENT_PROXY_URL` to the deployed Worker URL when building the extension.
