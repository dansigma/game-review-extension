# Comment proxy (Cloudflare Worker)

Receives a `CommentSlice` JSON body from the extension and forwards a Portuguese prompt to OpenRouter. The OpenRouter API key must **only** live in Worker secrets.

## Endpoints

- `POST /comment` (or `POST /`) — per-move coach comment from a `CommentSlice`
- `POST /summary` — one game summary per analysis from a `GameSummarySlice` (result, accuracy, judgement counts, top critical moments; no UCI/FEN/PV)

## Secrets and vars

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put AUTH_TOKEN
```

Optional model override (default `openai/gpt-5.6-luna` in `wrangler.toml`):

```bash
wrangler secret put OPENROUTER_MODEL   # or set [vars] OPENROUTER_MODEL
```

Local dev: copy `.dev.vars.example` to `.dev.vars` and set `OPENROUTER_API_KEY` and `AUTH_TOKEN`.

## Authentication

All `POST` requests to `/comment` and `/summary` require the header:

```
X-Auth-Token: <AUTH_TOKEN>
```

- If `AUTH_TOKEN` is not configured in the Worker (`env.AUTH_TOKEN` undefined), every request is rejected with `401 { "error": "Não autorizado." }` — fail-closed, the proxy never runs open by accident.
- Missing or wrong `X-Auth-Token` → `401 { "error": "Não autorizado." }` (timing-safe comparison).
- The extension reads `VITE_COMMENT_PROXY_TOKEN` (via `import.meta.env`, trimmed) and sends it as `X-Auth-Token` on both `requestComment()` and `requestGameSummary()` fetch calls. Empty token still sends the header; the server answers 401 and the existing error path handles it.

## Rate limiting

Uses the Workers built-in Rate Limiting binding declared in `wrangler.toml`:

```toml
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
```

- Key: client IP from the `CF-Connecting-IP` header.
- If `RATE_LIMITER` is not bound (`env.RATE_LIMITER` undefined) → `500 { "error": "Rate limiter não configurado." }` — fail-closed.
- When the limit is exceeded (`limit()` returns `{ success: false }`) → `429 { "error": "Muitas requisições. Tente novamente mais tarde." }`.
- Order in `fetch()`: `OPTIONS` preflight handling unchanged → non-`POST` `405` unchanged → rate limit (`429`) → auth (`401`) → route handlers. Auth is checked before JSON parsing and before any OpenRouter call.

## Deploy

```bash
npx wrangler deploy
```

Set `VITE_COMMENT_PROXY_URL` and `VITE_COMMENT_PROXY_TOKEN` to the deployed Worker URL/token when building the extension.
