import { describe, expect, it } from "vitest";
import { extractGameId } from "../src/lichessExport.ts";

describe("extractGameId", () => {
  it("accepts a bare 8-character id", () => {
    expect(extractGameId("8fuPHGyu")).toBe("8fuPHGyu");
  });

  it("reads the id from a finished-game URL", () => {
    expect(extractGameId("https://lichess.org/8fuPHGyu")).toBe("8fuPHGyu");
  });

  it("reads the id from a URL with color and ply", () => {
    expect(extractGameId("https://lichess.org/8fuPHGyu/white#12")).toBe("8fuPHGyu");
  });
});
