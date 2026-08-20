import type { CommentSlice, GameSummarySlice } from "@game-review/core";

export const COMMENT_PROXY_TIMEOUT_MS = 20_000;

/** Storage key for the shared proxy auth token (see SIG-701). */
export const COMMENT_PROXY_TOKEN_KEY = "commentProxyToken";

export class CommentProxyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentProxyError";
  }
}

export function proxyUrlFromEnv(): string {
  return import.meta.env.VITE_COMMENT_PROXY_URL?.trim() ?? "";
}

export function isCommentProxyConfigured(): boolean {
  return proxyUrlFromEnv().length > 0;
}

export function getCommentProxyBaseUrl(): string | null {
  const raw = proxyUrlFromEnv();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/+$/, "");
}

/** Reads the shared auth token from chrome.storage.local. */
export async function getCommentProxyToken(): Promise<string> {
  const stored = await chrome.storage.local.get(COMMENT_PROXY_TOKEN_KEY);
  const token = stored[COMMENT_PROXY_TOKEN_KEY];
  return typeof token === "string" ? token.trim() : "";
}

function commentEndpoint(baseUrl: string): string {
  const path = baseUrl.endsWith("/comment") ? baseUrl : `${baseUrl}/comment`;
  return path;
}

export function summaryEndpoint(baseUrl: string): string {
  if (baseUrl.endsWith("/summary")) {
    return baseUrl;
  }
  if (baseUrl.endsWith("/comment")) {
    return baseUrl.replace(/\/comment$/, "/summary");
  }
  return `${baseUrl}/summary`;
}

export function isCommentUsable(comment: string): boolean {
  return comment.trim().length >= 8;
}

export function isSummaryUsable(summary: string): boolean {
  return summary.trim().length >= 24;
}

export async function requestComment(slice: CommentSlice): Promise<string> {
  const baseUrl = getCommentProxyBaseUrl();
  if (!baseUrl) {
    throw new CommentProxyError("Proxy não configurado.");
  }

  const token = await getCommentProxyToken();
  if (!token) {
    throw new CommentProxyError(
      "Comentários IA não configurados (token ausente).",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMMENT_PROXY_TIMEOUT_MS,
  );

  try {
    const response = await fetch(commentEndpoint(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
      },
      body: JSON.stringify(slice),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = "Não foi possível obter o comentário.";
      try {
        const data = (await response.json()) as { error?: string };
        if (typeof data.error === "string" && data.error.length > 0) {
          message = data.error;
        }
      } catch {
        // keep generic message
      }
      throw new CommentProxyError(message);
    }

    const data = (await response.json()) as { comment?: string };
    const comment = data.comment?.trim();
    if (!comment) {
      throw new CommentProxyError("Resposta vazia do proxy.");
    }
    if (!isCommentUsable(comment)) {
      throw new CommentProxyError("Resposta vazia do proxy.");
    }
    return comment;
  } catch (error) {
    if (error instanceof CommentProxyError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CommentProxyError("Tempo esgotado ao pedir comentário.");
    }
    throw new CommentProxyError("Falha de rede ao pedir comentário.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestGameSummary(slice: GameSummarySlice): Promise<string> {
  const baseUrl = getCommentProxyBaseUrl();
  if (!baseUrl) {
    throw new CommentProxyError("Proxy não configurado.");
  }

  const token = await getCommentProxyToken();
  if (!token) {
    throw new CommentProxyError(
      "Comentários IA não configurados (token ausente).",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMMENT_PROXY_TIMEOUT_MS,
  );

  try {
    const response = await fetch(summaryEndpoint(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": token,
      },
      body: JSON.stringify(slice),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = "Não foi possível obter o resumo.";
      try {
        const data = (await response.json()) as { error?: string };
        if (typeof data.error === "string" && data.error.length > 0) {
          message = data.error;
        }
      } catch {
        // keep generic message
      }
      throw new CommentProxyError(message);
    }

    const data = (await response.json()) as { summary?: string };
    const summary = data.summary?.trim();
    if (!summary) {
      throw new CommentProxyError("Resposta vazia do proxy.");
    }
    if (!isSummaryUsable(summary)) {
      throw new CommentProxyError("Resposta vazia do proxy.");
    }
    return summary;
  } catch (error) {
    if (error instanceof CommentProxyError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CommentProxyError("Tempo esgotado ao pedir resumo.");
    }
    throw new CommentProxyError("Falha de rede ao pedir resumo.");
  } finally {
    clearTimeout(timeoutId);
  }
}
