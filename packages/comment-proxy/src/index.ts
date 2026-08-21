import { parseCommentSlice } from "./parseCommentSlice.ts";
import { parseGameSummarySlice } from "./parseGameSummarySlice.ts";
import { requestOpenRouterComment, type OpenRouterEnv } from "./openrouter.ts";
import { requestOpenRouterSummary } from "./summaryOpenrouter.ts";

export interface Env extends OpenRouterEnv {
  COMMENT_PROXY_TOKEN?: string;
  ALLOWED_EXTENSION_ID?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function isAllowedOrigin(origin: string | null, env?: Env): boolean {
  if (!origin) {
    return false;
  }
  if (env?.ALLOWED_EXTENSION_ID) {
    const allowedOrigin = `chrome-extension://${env.ALLOWED_EXTENSION_ID}`;
    if (origin === allowedOrigin) {
      return true;
    }
    try {
      const url = new URL(origin);
      return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    } catch {
      return false;
    }
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

function corsHeaders(origin: string | null, env?: Env): HeadersInit {
  if (!isAllowedOrigin(origin, env)) {
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
  env?: Env,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin, env) },
  });
}

async function handleComment(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido." }, origin, env);
  }

  const parsed = parseCommentSlice(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error }, origin, env);
  }

  const result = await requestOpenRouterComment(parsed.slice, env);
  if (!result.ok) {
    const payload =
      result.status === 503
        ? { error: result.message }
        : { error: result.message };
    return jsonResponse(result.status, payload, origin, env);
  }

  return jsonResponse(200, { comment: result.comment }, origin, env);
}

async function handleSummary(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido." }, origin, env);
  }

  const parsed = parseGameSummarySlice(body);
  if (!parsed.ok) {
    return jsonResponse(400, { error: parsed.error }, origin, env);
  }

  const result = await requestOpenRouterSummary(parsed.slice, env);
  if (!result.ok) {
    return jsonResponse(result.status, { error: result.message }, origin, env);
  }

  return jsonResponse(200, { summary: result.comment }, origin, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin, env)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Método não permitido." }, origin, env);
    }

    if (!isAllowedOrigin(origin, env)) {
      return jsonResponse(403, { error: "Origem não permitida." }, origin, env);
    }

    if (env.COMMENT_PROXY_TOKEN) {
      const authToken = request.headers.get("X-Auth-Token");
      if (!authToken || authToken !== env.COMMENT_PROXY_TOKEN) {
        return jsonResponse(
          403,
          { error: "Token de autenticação ausente ou inválido." },
          origin,
          env,
        );
      }
    }

    if (url.pathname === "/" || url.pathname === "/comment") {
      return handleComment(request, env);
    }

    if (url.pathname === "/summary") {
      return handleSummary(request, env);
    }

    return jsonResponse(404, { error: "Não encontrado." }, origin, env);
  },
};
