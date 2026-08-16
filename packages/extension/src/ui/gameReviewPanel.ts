import {
  buildCommentSlice,
  countJudgements,
  isOnlyMove,
  MOVE_CLASS_LABEL_PT,
  selectCriticalMoments,
  type CriticalMoment,
  type GameReview,
  type JudgementsByColor,
  type MoveClass,
  type NormalizedGame,
  type PlayerColor,
  type ReviewedMove,
} from "@game-review/core";
import {
  DEFAULT_ENGINE_PRESET,
  isEngineQualityPresetId,
  nodesForPreset,
  presetSelectLabel,
  type EngineQualityPresetId,
} from "../budgetDecision.ts";
import { formatAnalysisProgressLabel } from "../analysisEta.ts";
import { fenAtPly, renderChessBoard, uciSquares } from "./chessBoard.ts";
import { renderEvalGraph } from "./evalGraph.ts";

const CLASS_CSS: Record<MoveClass, string> = {
  best: "move-best",
  good: "move-good",
  inaccuracy: "move-inaccuracy",
  mistake: "move-mistake",
  blunder: "move-blunder",
  forced: "move-forced",
};

export interface GameReviewPanelElements {
  reviewSection: HTMLElement;
  presetSelect: HTMLSelectElement;
  analyzeButton: HTMLButtonElement;
  reanalyzeButton: HTMLButtonElement;
  progressBlock: HTMLElement;
  progressBar: HTMLProgressElement;
  progressLabel: HTMLElement;
  cancelButton: HTMLButtonElement;
  resultsBlock: HTMLElement;
  summaryResult: HTMLElement;
  summaryAccuracy: HTMLElement;
  summaryJudgements: HTMLElement;
  boardHost: HTMLElement;
  evalCanvas: HTMLCanvasElement;
  moveList: HTMLElement;
  navPrev: HTMLButtonElement;
  navNext: HTMLButtonElement;
  navStart: HTMLButtonElement;
  navEnd: HTMLButtonElement;
  plyLabel: HTMLElement;
  criticalMomentsBlock: HTMLElement;
  criticalMomentsList: HTMLElement;
  commentSliceBlock: HTMLElement;
  commentSliceEmpty: HTMLElement;
  commentSliceBody: HTMLElement;
  commentSliceButton: HTMLButtonElement;
}

export function queryGameReviewPanel(root: ParentNode): GameReviewPanelElements {
  const requireEl = <T extends HTMLElement>(selector: string): T => {
    const el = root.querySelector(selector);
    if (!(el instanceof HTMLElement)) {
      throw new Error(`Missing element: ${selector}`);
    }
    return el as T;
  };

  const presetSelect = root.querySelector("#engine-quality-preset");
  const analyzeButton = root.querySelector("#analyze-game");
  const reanalyzeButton = root.querySelector("#reanalyze-game");
  const cancelButton = root.querySelector("#cancel-analysis");
  const progressBar = root.querySelector("#analysis-progress-bar");
  const navPrev = root.querySelector("#nav-prev");
  const navNext = root.querySelector("#nav-next");
  const navStart = root.querySelector("#nav-start");
  const navEnd = root.querySelector("#nav-end");

  if (!(presetSelect instanceof HTMLSelectElement)) {
    throw new Error("Missing #engine-quality-preset");
  }
  if (!(analyzeButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #analyze-game");
  }
  if (!(reanalyzeButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #reanalyze-game");
  }
  if (!(cancelButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #cancel-analysis");
  }
  if (!(progressBar instanceof HTMLProgressElement)) {
    throw new Error("Missing #analysis-progress-bar");
  }
  if (!(navPrev instanceof HTMLButtonElement)) {
    throw new Error("Missing #nav-prev");
  }
  if (!(navNext instanceof HTMLButtonElement)) {
    throw new Error("Missing #nav-next");
  }
  if (!(navStart instanceof HTMLButtonElement)) {
    throw new Error("Missing #nav-start");
  }
  if (!(navEnd instanceof HTMLButtonElement)) {
    throw new Error("Missing #nav-end");
  }

  const commentSliceButton = root.querySelector("#comment-slice-button");
  if (!(commentSliceButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #comment-slice-button");
  }

  const evalCanvas = root.querySelector("#eval-graph");
  if (!(evalCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing #eval-graph");
  }

  return {
    reviewSection: requireEl("#review-section"),
    presetSelect,
    analyzeButton,
    reanalyzeButton,
    progressBlock: requireEl("#analysis-progress"),
    progressBar,
    progressLabel: requireEl("#analysis-progress-label"),
    cancelButton,
    resultsBlock: requireEl("#review-results"),
    summaryResult: requireEl("#review-summary-result"),
    summaryAccuracy: requireEl("#review-summary-accuracy"),
    summaryJudgements: requireEl("#review-summary-judgements"),
    boardHost: requireEl("#board-host"),
    evalCanvas,
    moveList: requireEl("#move-list"),
    navPrev,
    navNext,
    navStart,
    navEnd,
    plyLabel: requireEl("#ply-label"),
    criticalMomentsBlock: requireEl("#critical-moments"),
    criticalMomentsList: requireEl("#critical-moments-list"),
    commentSliceBlock: requireEl("#comment-slice"),
    commentSliceEmpty: requireEl("#comment-slice-empty"),
    commentSliceBody: requireEl("#comment-slice-body"),
    commentSliceButton,
  };
}

const PRESET_IDS: EngineQualityPresetId[] = ["fast", "standard", "deep"];

function fillPresetSelect(select: HTMLSelectElement): void {
  const selected = isEngineQualityPresetId(select.value)
    ? select.value
    : DEFAULT_ENGINE_PRESET;
  select.replaceChildren();
  for (const id of PRESET_IDS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = presetSelectLabel(id);
    option.selected = id === selected;
    select.append(option);
  }
}

export class GameReviewPanel {
  private game: NormalizedGame | null = null;
  private review: GameReview | null = null;
  private currentPly = -1;
  private onAnalyze: (() => void) | null = null;
  private onReanalyze: (() => void) | null = null;
  private onCancel: (() => void) | null = null;
  private onPresetChange: (() => void) | null = null;

  constructor(private readonly el: GameReviewPanelElements) {
    fillPresetSelect(el.presetSelect);
    el.analyzeButton.addEventListener("click", () => this.onAnalyze?.());
    el.reanalyzeButton.addEventListener("click", () => this.onReanalyze?.());
    el.cancelButton.addEventListener("click", () => this.onCancel?.());
    el.presetSelect.addEventListener("change", () => this.onPresetChange?.());
    el.navPrev.addEventListener("click", () => this.step(-1));
    el.navNext.addEventListener("click", () => this.step(1));
    el.navStart.addEventListener("click", () => this.goToPly(-1));
    el.navEnd.addEventListener("click", () => {
      const max = (this.game?.moves.length ?? 1) - 1;
      this.goToPly(max);
    });
    el.evalCanvas.addEventListener("click", (event) => this.onGraphClick(event));
    window.addEventListener("resize", () => this.refreshView());
  }

  setHandlers(handlers: {
    onAnalyze: () => void;
    onReanalyze: () => void;
    onCancel: () => void;
    onPresetChange: () => void;
  }): void {
    this.onAnalyze = handlers.onAnalyze;
    this.onReanalyze = handlers.onReanalyze;
    this.onCancel = handlers.onCancel;
    this.onPresetChange = handlers.onPresetChange;
  }

  getReview(): GameReview | null {
    return this.review;
  }

  getPreset(): EngineQualityPresetId {
    const value = this.el.presetSelect.value;
    if (isEngineQualityPresetId(value)) {
      return value;
    }
    return DEFAULT_ENGINE_PRESET;
  }

  getNodesPerPosition(): number {
    return nodesForPreset(this.getPreset());
  }

  setGame(game: NormalizedGame | null): void {
    this.game = game;
    this.review = null;
    this.currentPly = -1;
    if (!game) {
      this.el.reviewSection.hidden = true;
      return;
    }
    this.el.reviewSection.hidden = false;
    this.el.presetSelect.disabled = false;
    this.el.analyzeButton.hidden = false;
    this.el.analyzeButton.disabled = false;
    this.el.reanalyzeButton.hidden = true;
    this.el.progressBlock.hidden = true;
    this.el.resultsBlock.hidden = true;
    this.el.moveList.replaceChildren();
    this.el.boardHost.replaceChildren();
  }

  showAnalyzing(done: number, total: number, remainingMs?: number | null): void {
    this.el.presetSelect.disabled = true;
    this.el.analyzeButton.hidden = true;
    this.el.reanalyzeButton.hidden = true;
    this.el.progressBlock.hidden = false;
    this.el.resultsBlock.hidden = true;
    this.el.progressBar.max = total;
    this.el.progressBar.value = done;
    this.el.progressLabel.textContent = formatAnalysisProgressLabel(
      done,
      total,
      remainingMs,
    );
  }

  showReview(review: GameReview, game: NormalizedGame): void {
    this.review = review;
    this.game = game;
    this.currentPly = -1;
    this.el.presetSelect.disabled = false;
    this.el.progressBlock.hidden = true;
    this.el.analyzeButton.hidden = true;
    this.el.reanalyzeButton.hidden = false;
    this.el.resultsBlock.hidden = false;
    this.renderSummary();
    this.renderCriticalMoments();
    this.renderMoveList();
    this.refreshView();
  }

  showAnalyzeReady(options?: { hideResults?: boolean }): void {
    this.el.presetSelect.disabled = false;
    this.el.progressBlock.hidden = true;
    this.el.analyzeButton.hidden = false;
    this.el.analyzeButton.disabled = false;
    this.el.reanalyzeButton.hidden = true;
    if (options?.hideResults) {
      this.review = null;
      this.el.resultsBlock.hidden = true;
      this.el.moveList.replaceChildren();
      this.el.boardHost.replaceChildren();
    }
  }

  private renderSummary(): void {
    if (!this.game || !this.review) {
      return;
    }
    const { white, black } = this.game.players;
    const resultLabel = formatResult(this.game.result);
    this.el.summaryResult.textContent = `${white.name} vs ${black.name} — ${resultLabel}`;
    this.el.summaryAccuracy.textContent =
      `Precisão: Brancas ${this.review.white.accuracy.toFixed(1)}% · ` +
      `Pretas ${this.review.black.accuracy.toFixed(1)}%`;
    this.el.summaryJudgements.textContent = formatJudgementSummary(
      countJudgements(this.review.moves),
    );
  }

  private renderCriticalMoments(): void {
    if (!this.review) {
      return;
    }
    const moments = selectCriticalMoments(this.review.moves);
    const list = this.el.criticalMomentsList;
    list.replaceChildren();

    if (moments.length === 0) {
      const empty = document.createElement("p");
      empty.className = "critical-moments-empty";
      empty.textContent = "Nenhum momento crítico nesta partida.";
      list.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const moment of moments) {
      frag.appendChild(this.criticalMomentItem(moment));
    }
    list.appendChild(frag);
  }

  private criticalMomentItem(moment: CriticalMoment): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `critical-moment-btn ${CLASS_CSS[moment.classification]}`;
    btn.dataset.ply = String(moment.ply);

    const main = document.createElement("span");
    main.className = "critical-moment-main";
    main.innerHTML =
      `<span class="critical-moment-move">${escapeHtml(formatMoveRef(moment.ply, moment.color, moment.san))}</span>` +
      `<span class="critical-moment-color">${escapeHtml(colorLabelPt(moment.color))}</span>`;

    const meta = document.createElement("span");
    meta.className = "critical-moment-meta";
    meta.innerHTML =
      `<span class="critical-moment-class">${escapeHtml(MOVE_CLASS_LABEL_PT[moment.classification])}</span>` +
      `<span class="critical-moment-stats">EPL ${moment.epl.toFixed(2)} · ${formatWinSwing(moment.winPercentSwing)}</span>`;

    btn.append(main, meta);
    btn.addEventListener("click", () => this.goToPly(moment.ply));
    if (moment.ply === this.currentPly) {
      btn.classList.add("critical-moment-active");
    }
    return btn;
  }

  private renderMoveList(): void {
    if (!this.review) {
      return;
    }
    const frag = document.createDocumentFragment();
    const rows = pairMoves(this.review.moves);
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.appendChild(this.moveCell(row.number, null, -1));
      tr.appendChild(this.moveCell(row.number, row.white, row.white?.ply ?? -1));
      tr.appendChild(this.moveCell(null, row.black, row.black?.ply ?? -1));
      frag.appendChild(tr);
    }
    this.el.moveList.replaceChildren(frag);
  }

  private moveCell(
    moveNumber: number | null,
    move: ReviewedMove | null,
    ply: number,
  ): HTMLTableCellElement {
    const td = document.createElement("td");
    if (moveNumber !== null && move === null) {
      td.className = "move-num";
      td.textContent = `${moveNumber}.`;
      return td;
    }
    if (!move) {
      td.className = "move-empty";
      return td;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `move-btn ${CLASS_CSS[move.classification]}`;
    btn.dataset.ply = String(ply);
    btn.title = MOVE_CLASS_LABEL_PT[move.classification];
    const onlyMoveBadge = isOnlyMove(move)
      ? `<span class="move-only-badge" title="Lance único">Único</span>`
      : "";
    btn.innerHTML =
      `<span class="move-san">${escapeHtml(move.san)}</span>` +
      onlyMoveBadge +
      `<span class="move-class">${escapeHtml(move.classificationLabel)}</span>`;
    if (ply === this.currentPly) {
      btn.classList.add("move-active");
    }
    btn.addEventListener("click", () => this.goToPly(ply));
    td.appendChild(btn);
    return td;
  }

  private refreshView(): void {
    if (!this.game) {
      return;
    }
    const fensAfter = this.game.moves.map((m) => m.fenAfter);
    const fen = fenAtPly(this.game.initialFen, fensAfter, this.currentPly);
    const move =
      this.currentPly >= 0 ? this.game.moves[this.currentPly] : undefined;
    const highlight = move ? uciSquares(move.uci) : null;
    renderChessBoard(this.el.boardHost, fen, highlight ?? undefined);
    if (this.review) {
      renderEvalGraph(this.el.evalCanvas, this.review.graph, this.currentPly);
    }
    this.updateNav();
    this.renderCommentSlice();
    this.highlightActiveMove();
  }

  private renderCommentSlice(): void {
    const { commentSliceEmpty, commentSliceBody, commentSliceButton } = this.el;

    if (!this.review || this.currentPly < 0) {
      commentSliceEmpty.hidden = false;
      commentSliceEmpty.textContent = "Selecione um lance";
      commentSliceBody.hidden = true;
      commentSliceBody.replaceChildren();
      commentSliceButton.disabled = true;
      return;
    }

    const slice = buildCommentSlice(this.review, this.currentPly);
    if (!slice) {
      commentSliceEmpty.hidden = false;
      commentSliceEmpty.textContent = "Selecione um lance";
      commentSliceBody.hidden = true;
      commentSliceBody.replaceChildren();
      commentSliceButton.disabled = true;
      return;
    }

    commentSliceEmpty.hidden = true;
    commentSliceBody.hidden = false;
    commentSliceBody.replaceChildren();

    const winSwing =
      slice.playerWinPercentBefore - slice.playerWinPercentAfter;
    const accuracyLabel =
      slice.accuracy === null
        ? "—"
        : `${slice.accuracy.toFixed(1)}%`;
    const bestLabel = slice.playedIsBest ? "Melhor lance" : "Não é o melhor";
    const onlyMoveLabel = slice.onlyMove ? " · Lance único" : "";

    commentSliceBody.innerHTML = [
      `<div class="comment-slice-line">` +
        `<span class="comment-slice-san">${escapeHtml(formatMoveRef(slice.ply, slice.color, slice.san))}</span>` +
        `<span>${escapeHtml(MOVE_CLASS_LABEL_PT[slice.classification])}</span>` +
        `</div>`,
      `<div class="comment-slice-line">` +
        `<span class="comment-slice-muted">EPL</span>` +
        `<span>${slice.epl.toFixed(2)}</span>` +
        `</div>`,
      `<div class="comment-slice-line">` +
        `<span class="comment-slice-muted">Win%</span>` +
        `<span>${formatWinPercent(slice.playerWinPercentBefore)} → ${formatWinPercent(slice.playerWinPercentAfter)} (${formatWinSwing(winSwing)})</span>` +
        `</div>`,
      `<div class="comment-slice-line">` +
        `<span class="comment-slice-muted">Precisão</span>` +
        `<span>${escapeHtml(accuracyLabel)}</span>` +
        `</div>`,
      `<div class="comment-slice-line">` +
        `<span class="comment-slice-muted">Motor</span>` +
        `<span>${escapeHtml(bestLabel)}${escapeHtml(onlyMoveLabel)}</span>` +
        `</div>`,
    ].join("");

    commentSliceButton.disabled = true;
  }

  private highlightActiveMove(): void {
    for (const btn of Array.from(
      this.el.moveList.querySelectorAll<HTMLButtonElement>(".move-btn"),
    )) {
      const ply = Number(btn.dataset.ply);
      btn.classList.toggle("move-active", ply === this.currentPly);
    }
    for (const btn of Array.from(
      this.el.criticalMomentsList.querySelectorAll<HTMLButtonElement>(
        ".critical-moment-btn",
      ),
    )) {
      const ply = Number(btn.dataset.ply);
      btn.classList.toggle("critical-moment-active", ply === this.currentPly);
    }
  }

  private updateNav(): void {
    const max = (this.game?.moves.length ?? 0) - 1;
    this.el.navPrev.disabled = this.currentPly <= -1;
    this.el.navNext.disabled = this.currentPly >= max;
    const reviewed =
      this.currentPly >= 0 ? this.review?.moves[this.currentPly] : undefined;
    const onlyMoveHint =
      reviewed && isOnlyMove(reviewed) ? " · Lance único" : "";
    const label =
      this.currentPly < 0
        ? "Posição inicial"
        : `Lance ${this.currentPly + 1} / ${max + 1}${onlyMoveHint}`;
    this.el.plyLabel.textContent = label;
  }

  private step(delta: number): void {
    this.goToPly(this.currentPly + delta);
  }

  private goToPly(ply: number): void {
    const max = (this.game?.moves.length ?? 0) - 1;
    this.currentPly = Math.max(-1, Math.min(max, ply));
    this.refreshView();
  }

  private onGraphClick(event: MouseEvent): void {
    if (!this.review || this.review.graph.length === 0) {
      return;
    }
    const rect = this.el.evalCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = x / rect.width;
    const maxPly = Math.max(...this.review.graph.map((p) => p.ply), 1);
    const targetPly = Math.round(ratio * (maxPly + 1)) - 1;
    this.goToPly(targetPly);
  }
}

interface MoveRow {
  number: number;
  white: ReviewedMove | null;
  black: ReviewedMove | null;
}

function pairMoves(moves: readonly ReviewedMove[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i] ?? null,
      black: moves[i + 1] ?? null,
    });
  }
  return rows;
}

function formatMoveRef(ply: number, color: PlayerColor, san: string): string {
  const moveNum = Math.floor(ply / 2) + 1;
  if (color === "white") {
    return `${moveNum}. ${san}`;
  }
  return `${moveNum}... ${san}`;
}

function colorLabelPt(color: PlayerColor): string {
  return color === "white" ? "Brancas" : "Pretas";
}

function formatJudgementLine(
  color: PlayerColor,
  counts: JudgementsByColor[PlayerColor],
): string {
  return (
    `${colorLabelPt(color)}: ${counts.inaccuracy} imprecisões · ` +
    `${counts.mistake} erros · ${counts.blunder} blunders`
  );
}

function formatJudgementSummary(judgements: JudgementsByColor): string {
  return [
    formatJudgementLine("white", judgements.white),
    formatJudgementLine("black", judgements.black),
  ].join("\n");
}

function formatWinSwing(swing: number): string {
  const rounded = Math.round(swing);
  if (rounded > 0) {
    return `−${rounded}% win`;
  }
  if (rounded < 0) {
    return `+${Math.abs(rounded)}% win`;
  }
  return "0% win";
}

function formatWinPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatResult(result: string): string {
  switch (result) {
    case "1-0":
      return "1-0 (Brancas)";
    case "0-1":
      return "0-1 (Pretas)";
    case "1/2-1/2":
      return "Empate";
    default:
      return result;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
