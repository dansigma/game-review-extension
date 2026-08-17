import { describe, expect, it } from "vitest";
import {
  buildCommentBoardFacts,
  describeReplyCaptures,
  formatCommentBoardFacts,
} from "../src/commentBoardFacts.ts";

describe("describeReplyCaptures", () => {
  it("names the bishop victim on c8 for Nxc8, not a rook", () => {
    const fen = "2b1k3/8/3N4/8/8/8/8/4K3 w - - 0 1";
    const result = describeReplyCaptures(fen, "Nxc8");
    expect(result).toBeDefined();
    expect(result).toContain("bispo");
    expect(result).toContain("c8");
    expect(result).toContain("ganho de material");
    expect(result).not.toContain("torre");
  });

  it("reports check-only plies that do not capture", () => {
    const fen = "4k3/8/8/5N2/8/8/8/4K3 w - - 0 1";
    const result = describeReplyCaptures(fen, "Nd6+");
    expect(result).toBe("Nd6+ dá xeque e não captura peça");
  });

  it("joins check and capture facts across the reply line", () => {
    const fen = "2b1k3/8/8/5N2/8/8/8/4K3 w - - 0 1";
    const result = describeReplyCaptures(fen, "Nd6+ Ke7 Nxc8+");
    expect(result).toBeDefined();
    expect(result).toContain("Nd6+ dá xeque e não captura peça");
    expect(result).toContain("Nxc8+ captura o bispo preto em c8");
    expect(result).toContain("ganho de material");
    expect(result).not.toContain("torre");
  });

  it("returns undefined for invalid FEN", () => {
    expect(describeReplyCaptures("not-a-fen", "Nxc8")).toBeUndefined();
  });

  it("returns undefined when no capture or check facts apply", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    expect(describeReplyCaptures(fen, "Ke7")).toBeUndefined();
  });

  it("stops at the first illegal SAN without throwing", () => {
    const fen = "2b1k3/8/3N4/8/8/8/8/4K3 w - - 0 1";
    const result = describeReplyCaptures(fen, "Nxc8 Qh4");
    expect(result).toContain("Nxc8 captura o bispo preto em c8");
    expect(result).toContain("ganho de material");
  });

  it("reports a trade when the defender can recapture on the capture square", () => {
    const fen = "2bqk3/8/3N4/8/8/8/8/4K3 w - - 0 1";
    const result = describeReplyCaptures(fen, "Nxc8");
    expect(result).toBeDefined();
    expect(result).toContain("bispo");
    expect(result).toContain("c8");
    expect(result).toMatch(/NÃO é ganho de material|troca/);
    expect(result).not.toContain("peça desprotegida");
    expect(result).not.toContain("torre");
  });
});

const BASE_INPUT = {
  classification: "blunder" as const,
  evalBefore: "0.2",
  evalAfter: "-2.5",
  playerWinPercentBefore: 52.3,
  playerWinPercentAfter: 28.1,
};

describe("buildCommentBoardFacts", () => {
  it("includes gravidade with eval and win% labeled as tone-only", () => {
    const facts = buildCommentBoardFacts(BASE_INPUT);
    expect(facts.gravidade).toContain("Blunder");
    expect(facts.gravidade).toContain("0.2 → -2.5");
    expect(facts.gravidade).toContain("52.3% → 28.1%");
    expect(facts.gravidade).toContain("Números só para tom de voz");
  });

  it("describes bishop on c8 for Nxc8, not a rook", () => {
    const fen = "2b1k3/8/3N4/8/8/8/8/4K3 w - - 0 1";
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: fen,
      replyLine: "Nxc8",
    });
    expect(facts.tabuleiro).toContain("c8 bispo preto");
    expect(facts.tabuleiro).not.toContain("torre");
    expect(facts.filmeMotivo).toContain("Nxc8 toma bispo preto em c8");
    expect(facts.material).toBe("+peça");
  });

  it("marks recapture trades as material igual", () => {
    const fen = "2bqk3/8/3N4/8/8/8/8/4K3 w - - 0 1";
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: fen,
      replyLine: "Nxc8",
    });
    expect(facts.material).toBe("igual");
    expect(facts.filmeMotivo).toContain("Qxc8 recaptura");
  });

  it("adds recapture to the film when it is outside the reply line cap", () => {
    const fen = "2bqk3/8/3N4/8/8/8/8/4K3 w - - 0 1";
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: fen,
      replyLine: "Nxc8",
    });
    expect(facts.filmeMotivo).toContain("Qxc8 recaptura");
  });

  it("reports check-only plies in the MOTIVO film", () => {
    const fen = "4k3/8/8/5N2/8/8/8/4K3 w - - 0 1";
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: fen,
      replyLine: "Nd6+",
    });
    expect(facts.filmeMotivo).toBe("Nd6+ xeque");
  });

  it("includes king squares and castling rights", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: fen,
      replyLine: "e4",
    });
    expect(facts.tabuleiro).toMatch(/e1 rei branco/);
    expect(facts.tabuleiro).toMatch(/e8 rei preto/);
    expect(facts.direitosRei).toContain("roque antes do MOTIVO");
  });

  it("notes when a king move loses castling", () => {
    const fen = "4k2r/8/8/8/8/8/8/4K3 b k - 0 1";
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: fen,
      replyLine: "Kf8",
    });
    expect(facts.filmeMotivo).toContain("Kf8 perde o roque");
  });

  it("derives engine-line ideas without inventing plans", () => {
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      engineLine: "O-O Nc3 Rfd8",
    });
    expect(facts.ideiaMelhor).toContain("O-O: roque");
    expect(facts.ideiaMelhor).toContain("Nc3: desenvolve");
    expect(facts.ideiaMelhor).toContain("Rfd8");
  });

  it("returns undefined blocks via formatCommentBoardFacts when empty", () => {
    const formatted = formatCommentBoardFacts({ gravidade: "teste" });
    expect(formatted).toBe("Gravidade: teste");
  });

  it("handles invalid FEN without throwing", () => {
    const facts = buildCommentBoardFacts({
      ...BASE_INPUT,
      fenAfter: "not-a-fen",
      replyLine: "Nxc8",
    });
    expect(facts.gravidade).toBeDefined();
    expect(facts.tabuleiro).toBeUndefined();
    expect(facts.filmeMotivo).toBeUndefined();
  });
});
