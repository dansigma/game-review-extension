import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALGO_VERSION, type CommentSlice } from "@game-review/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommentProxyError,
  getCommentProxyBaseUrl,
  isCommentProxyConfigured,
  requestComment,
} from "../src/commentProxy.ts";

const SOURCE_PATH = resolve(import.meta.dirname, "../src/commentProxy.ts");

const SAMPLE_SLICE: CommentSlice = {
  gameId: "game-1",
  algoVersion: ALGO_VERSION,
  ply: 0,
  san: "e4",
  color: "white",
  classification: "best",
  epl: 0,
  accuracy: 99,
  playerWinPercentBefore: 50,
  playerWinPercentAfter: 49,
  playedIsBest: true,
  onlyMove: false,
  evalAfter: "0.0",
};

describe("commentProxy source hygiene", () => {
  it("does not mention openrouter in module source", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    expect(source.toLowerCase()).not.toContain("openrouter");
  });
});

describe("commentProxy configuration", () => {
  it("reports configured when VITE_COMMENT_PROXY_URL is set", () => {
    expect(isCommentProxyConfigured()).toBe(
      (import.meta.env.VITE_COMMENT_PROXY_URL?.trim() ?? "").length > 0,
    );
  });

  it("normalizes trailing slash from base URL", () => {
    const base = getCommentProxyBaseUrl();
    if (base) {
      expect(base.endsWith("/")).toBe(false);
    }
  });
});

describe("requestComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when proxy URL is unset", async () => {
    if (isCommentProxyConfigured()) {
      return;
    }
    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow(CommentProxyError);
    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow("Proxy não configurado");
  });

  it("POSTs slice JSON and returns comment", async () => {
    if (!isCommentProxyConfigured()) {
      return;
    }

    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<{ comment: string }> }>
    >(async () => ({
      ok: true,
      json: async () => ({ comment: "Lance sólido." }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const comment = await requestComment(SAMPLE_SLICE);
    expect(comment).toBe("Lance sólido.");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/comment");
    const body = JSON.parse(String(init?.body));
    expect(body.san).toBe("e4");
    expect(body).not.toHaveProperty("uci");
  });

  it("maps HTTP errors to Portuguese messages", async () => {
    if (!isCommentProxyConfigured()) {
      return;
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Campo proibido: uci." }),
      })),
    );

    await expect(requestComment(SAMPLE_SLICE)).rejects.toThrow("Campo proibido: uci.");
  });
});
