import { parseCommentSlice } from "./parseCommentSlice.ts";
import { requestOpenRouterComment, type OpenRouterEnv } from "./openrouter.ts";

export interface Env extends OpenRouterEnv {}

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

    if (url.pathname === "/" || url.pathname === "/comment") {
      return handleComment(request, env);
    }

    return jsonResponse(404, { error: "Não encontrado." }, origin);
  },
};
