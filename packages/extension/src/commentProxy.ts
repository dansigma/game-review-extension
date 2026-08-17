import type { CommentSlice } from "@game-review/core";

const RAW_PROXY_URL = import.meta.env.VITE_COMMENT_PROXY_URL?.trim() ?? "";

export class CommentProxyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentProxyError";
  }
}

export function isCommentProxyConfigured(): boolean {
  return RAW_PROXY_URL.length > 0;
}

export function getCommentProxyBaseUrl(): string | null {
  if (!isCommentProxyConfigured()) {
    return null;
  }
  return RAW_PROXY_URL.replace(/\/+$/, "");
}

function commentEndpoint(baseUrl: string): string {
  const path = baseUrl.endsWith("/comment") ? baseUrl : `${baseUrl}/comment`;
  return path;
}

export async function requestComment(slice: CommentSlice): Promise<string> {
  const baseUrl = getCommentProxyBaseUrl();
  if (!baseUrl) {
    throw new CommentProxyError("Proxy não configurado.");
  }

  try {
    const response = await fetch(commentEndpoint(baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slice),
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
    return comment;
  } catch (error) {
    if (error instanceof CommentProxyError) {
      throw error;
    }
    throw new CommentProxyError("Falha de rede ao pedir comentário.");
  }
}
