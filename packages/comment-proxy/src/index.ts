import { parseCommentSlice } from "./parseCommentSlice.ts";
import { parseGameSummarySlice } from "./parseGameSummarySlice.ts";
import { requestOpenRouterComment, type OpenRouterEnv } from "./openrouter.ts";
import { requestOpenRouterSummary } from "./summaryOpenrouter.ts";

export interface Env extends OpenRouterEnv {
  /** Static shared token — set via `wrangler secret put PROXY_AUTH_TOKEN`. Unset = fail-closed 503. */
  PROXY_AUTH_TOKEN?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

/** Max request body size before parsing — two-layer cap (see SIG-701). */
const MAX_BODY_BYTES = 16_384;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  if (origin.startsWith("chrome-extension://")) {
    return true;
  }
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): HeadersInit {
  if (!isAllowedOrigin(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(
  status: number,
  body: Record<string, string>,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin) },
  });
}

/**
 * Fail-closed static-token auth. Returns false when the token is unset
 * (misconfiguration — no access) or when the presented header mismatches.
 */
function authOk(request: Request, env: Env): boolean {
  const expected = env.PROXY_AUTH_TOKEN?.trim();
  if (!expected) return false; // fail-closed: unset = no access
  const got = request.headers.get("X-Auth-Token") ?? "";
  const a = new TextEncoder().encode(got);
  const b = new TextEncoder().encode(expected);
  if (a.byteLength !== b.byteLength) return false; // length guard for timingSafeEqual
  if (typeof crypto !== "undefined" && typeof crypto.subtle?.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  // Fallback for runtimes without subtle.timingSafeEqual (Node tests):
  // constant-time byte comparison.
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/** 413 pre-parse size gate — never read an oversized body into memory. */
function isBodyTooLarge(request: Request): boolean {
  const raw = request.headers.get("content-length");
  if (raw === null) {
    return false; // chunked/unknown — handled post-parse
  }
  const length = Number(raw);
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

async function handleComment(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido." }, origin);
  }

  const bodyBytes = JSON.stringify(body);
  if (bodyBytes.length > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "Corpo grande demais." }, origin);
  }

  const parsed = parseCommentSlice(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error }, origin);
  }

  const result = await requestOpenRouterComment(
    parsed.slice,
    env,
    undefined,
    request.signal,
  );
  if (!result.ok) {
    return jsonResponse(result.status, { error: result.message }, origin);
  }

  return jsonResponse(200, { comment: result.comment }, origin);
}

async function handleSummary(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido." }, origin);
  }

  const bodyBytes = JSON.stringify(body);
  if (bodyBytes.length > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "Corpo grande demais." }, origin);
  }

  const parsed = parseGameSummarySlice(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error }, origin);
  }

  const result = await requestOpenRouterSummary(
    parsed.slice,
    env,
    undefined,
    request.signal,
  );
  if (!result.ok) {
    return jsonResponse(result.status, { error: result.message }, origin);
  }

  return jsonResponse(200, { summary: result.comment }, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Método não permitido." }, origin);
    }

    // Auth gate — AFTER method/path routing, BEFORE any body parsing.
    // Never read a body from an unauthenticated request.
    const tokenConfigured = (env.PROXY_AUTH_TOKEN?.trim() ?? "") !== "";
    if (!authOk(request, env)) {
      return tokenConfigured
        ? jsonResponse(401, { error: "Não autorizado." }, origin)
        : jsonResponse(503, { error: "auth não configurado." }, origin);
    }

    if (isBodyTooLarge(request)) {
      return jsonResponse(413, { error: "Corpo grande demais." }, origin);
    }

    if (url.pathname === "/" || url.pathname === "/comment") {
      return handleComment(request, env);
    }

    if (url.pathname === "/summary") {
      return handleSummary(request, env);
    }

    return jsonResponse(404, { error: "Não encontrado." }, origin);
  },
};
