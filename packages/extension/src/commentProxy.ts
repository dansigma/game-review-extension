import type { CommentSlice, GameSummarySlice } from "@game-review/core";

export const COMMENT_PROXY_TIMEOUT_MS = 20_000;

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

function commentEndpoint(baseUrl: string): string {
  const path = baseUrl.endsWith("/comment") ? baseUrl : `${baseUrl}/comment`;
  return path;
}

export function summaryEndpoint(baseUrl: string): string {
  const path = baseUrl.endsWith("/summary") ? baseUrl : `${baseUrl}/summary`;
  return path;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMMENT_PROXY_TIMEOUT_MS,
  );

  try {
    const response = await fetch(commentEndpoint(baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMMENT_PROXY_TIMEOUT_MS,
  );

  try {
    const response = await fetch(summaryEndpoint(baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
