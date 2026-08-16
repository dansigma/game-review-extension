import { describe, expect, it } from "vitest";
import { previewEngineLineMove } from "../src/ui/engineLinePreview.ts";

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("previewEngineLineMove", () => {
  it("returns FEN and highlight after first SAN", () => {
    const result = previewEngineLineMove(START_FEN, ["e4", "e5"], 0);

    expect(result).not.toBeNull();
    expect(result?.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    );
    expect(result?.highlight).toEqual({ from: "e2", to: "e4" });
  });

  it("returns FEN and highlight after second SAN", () => {
    const result = previewEngineLineMove(START_FEN, ["e4", "e5"], 1);

    expect(result).not.toBeNull();
    expect(result?.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );
    expect(result?.highlight).toEqual({ from: "e7", to: "e5" });
  });

  it("returns null for invalid SAN", () => {
    expect(previewEngineLineMove(START_FEN, ["Qh5", "e5"], 0)).toBeNull();
  });

  it("returns null for out-of-range index", () => {
    expect(previewEngineLineMove(START_FEN, ["e4"], 2)).toBeNull();
    expect(previewEngineLineMove(START_FEN, ["e4"], -1)).toBeNull();
  });
});
