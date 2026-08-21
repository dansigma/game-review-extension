import { parseCommentSlice } from "./parseCommentSlice.ts";
import { parseGameSummarySlice } from "./parseGameSummarySlice.ts";
import { requestOpenRouterComment, type OpenRouterEnv } from "./openrouter.ts";
import { requestOpenRouterSummary } from "./summaryOpenrouter.ts";

export interface RateLimitBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface Env extends OpenRouterEnv {
  AUTH_TOKEN?: string;
  RATE_LIMITER?: RateLimitBinding;
}
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

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
    "Access-Control-Allow-Headers": "Content-Type",
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

export function isAuthorized(request: Request, env: Env): boolean {
  const token = env.AUTH_TOKEN;
  if (typeof token !== "string" || token.length === 0) {
    return false;
  }
  const header = request.headers.get("X-Auth-Token") ?? "";
  if (header.length !== token.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= header.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

async function handleComment(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido." }, origin);
  }

  const parsed = parseCommentSlice(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error }, origin);
  }

  const result = await requestOpenRouterComment(parsed.slice, env);
  if (!result.ok) {
    const payload =
      result.status === 503
        ? { error: result.message }
        : { error: result.message };
    return jsonResponse(result.status, payload, origin);
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

  const parsed = parseGameSummarySlice(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error }, origin);
  }

  const result = await requestOpenRouterSummary(parsed.slice, env);
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

    if (!env.RATE_LIMITER) {
      return jsonResponse(500, { error: "Rate limiter não configurado." }, origin);
    }
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rateResult = await env.RATE_LIMITER.limit({ key: ip });
    if (!rateResult.success) {
      return jsonResponse(429, { error: "Muitas requisições. Tente novamente mais tarde." }, origin);
    }

    if (!isAuthorized(request, env)) {
      return jsonResponse(401, { error: "Não autorizado." }, origin);
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
