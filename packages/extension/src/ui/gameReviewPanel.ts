import {
  buildCommentSlice,
  classificationGlyph,
  countJudgements,
  DASHBOARD_CLASSES,
  formatSanWithGlyph,
  formatMoveEvalAfter,
  isOnlyMove,
  MOVE_CLASS_LABEL_PT,
  selectCriticalMoments,
  tokenizeEngineLine,
  type CriticalMoment,
  type CommentSlice,
  type GameReview,
  type JudgementCounts,
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
import {
  CommentProxyError,
  isCommentProxyConfigured,
  requestComment,
} from "../commentProxy.ts";
import { fenAtPly, renderChessBoard, uciSquares } from "./chessBoard.ts";
import { previewEngineLineMove } from "./engineLinePreview.ts";
import { renderEvalGraph } from "./evalGraph.ts";
import {
  moveListRows,
  type MoveListFilter,
} from "./moveListRows.ts";

const CLASS_CSS: Record<MoveClass, string> = {
  brilliant: "move-brilliant",
  great: "move-great",
  best: "move-best",
  mistake: "move-mistake",
  miss: "move-miss",
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
  boardFlip: HTMLButtonElement;
  plyLabel: HTMLElement;
  criticalMomentsBlock: HTMLElement;
  criticalMomentsList: HTMLElement;
  commentSliceBlock: HTMLElement;
  commentSliceEmpty: HTMLElement;
  commentSliceBody: HTMLElement;
  commentSliceButton: HTMLButtonElement;
  commentSliceProxyHint: HTMLElement;
  commentSliceAi: HTMLElement;
  moveListFilterToolbar: HTMLElement;
  moveListFilterLabel: HTMLElement;
  moveListClearFilter: HTMLButtonElement;
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
  const boardFlip = root.querySelector("#board-flip");

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
  if (!(boardFlip instanceof HTMLButtonElement)) {
    throw new Error("Missing #board-flip");
  }

  const commentSliceButton = root.querySelector("#comment-slice-button");
  if (!(commentSliceButton instanceof HTMLButtonElement)) {
    throw new Error("Missing #comment-slice-button");
  }

  const moveListClearFilter = root.querySelector("#move-list-clear-filter");
  if (!(moveListClearFilter instanceof HTMLButtonElement)) {
    throw new Error("Missing #move-list-clear-filter");
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
    boardFlip,
    plyLabel: requireEl("#ply-label"),
    criticalMomentsBlock: requireEl("#critical-moments"),
    criticalMomentsList: requireEl("#critical-moments-list"),
    commentSliceBlock: requireEl("#comment-slice"),
    commentSliceEmpty: requireEl("#comment-slice-empty"),
    commentSliceBody: requireEl("#comment-slice-body"),
    commentSliceButton,
    commentSliceProxyHint: requireEl("#comment-slice-proxy-hint"),
    commentSliceAi: requireEl("#comment-slice-ai"),
    moveListFilterToolbar: requireEl("#move-list-filter-toolbar"),
    moveListFilterLabel: requireEl("#move-list-filter-label"),
    moveListClearFilter,
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
  private flipped = false;
  private classPlies = new Map<string, number[]>();
  private judgementCycleIndex = new Map<string, number>();
  private moveListFilter: MoveListFilter = null;
  private enginePreviewIndex: number | null = null;
  private commentInFlight = false;
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
    el.boardFlip.addEventListener("click", () => this.toggleBoardFlip());
    el.moveListClearFilter.addEventListener("click", () => this.clearMoveListFilter());
    el.commentSliceButton.addEventListener("click", () => this.onCommentClick());
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
    this.enginePreviewIndex = null;
    this.moveListFilter = null;
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
    this.enginePreviewIndex = null;
    this.moveListFilter = null;
    this.judgementCycleIndex.clear();
    this.classPlies = buildClassPlies(review.moves);
    this.el.presetSelect.disabled = false;
    this.el.progressBlock.hidden = true;
    this.el.analyzeButton.hidden = true;
    this.el.reanalyzeButton.hidden = false;
    this.el.resultsBlock.hidden = false;
    this.renderSummary();
    this.renderCriticalMoments();
    this.renderMoveList();
    this.updateMoveListFilterToolbar();
    this.updateDashboardPressedState();
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
    this.renderClassDashboard(countJudgements(this.review.moves));
  }

  private renderClassDashboard(judgements: JudgementsByColor): void {
    const container = this.el.summaryJudgements;
    container.replaceChildren();
    container.className = "judgements class-dashboard";

    const frag = document.createDocumentFragment();
    for (const classification of DASHBOARD_CLASSES) {
      frag.appendChild(this.classDashboardRow(classification, judgements));
    }
    container.appendChild(frag);
  }

  private classDashboardRow(
    classification: keyof JudgementCounts,
    judgements: JudgementsByColor,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = `class-dashboard-row ${CLASS_CSS[classification]}`;

    const whiteCount = judgements.white[classification];
    const blackCount = judgements.black[classification];

    row.append(
      this.classCountButton("white", classification, whiteCount),
      this.classDashboardGlyph(classification),
      this.classDashboardLabel(classification),
      this.classCountButton("black", classification, blackCount),
    );
    return row;
  }

  private classDashboardGlyph(classification: keyof JudgementCounts): HTMLElement {
    const glyph = document.createElement("span");
    glyph.className = "class-dashboard-glyph";
    glyph.textContent = classificationGlyph(classification);
    return glyph;
  }

  private classDashboardLabel(classification: keyof JudgementCounts): HTMLElement {
    const label = document.createElement("span");
    label.className = "class-dashboard-label";
    label.textContent = MOVE_CLASS_LABEL_PT[classification];
    return label;
  }

  private classCountButton(
    color: PlayerColor,
    classification: keyof JudgementCounts,
    count: number,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `class-dashboard-count ${CLASS_CSS[classification]}`;
    btn.dataset.color = color;
    btn.dataset.classification = classification;
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = String(count);
    btn.disabled = count === 0;
    btn.setAttribute(
      "aria-label",
      `${colorLabelPt(color)}: ${count} ${MOVE_CLASS_LABEL_PT[classification]}`,
    );
    btn.addEventListener("click", () => this.onClassCountClick(color, classification));
    return btn;
  }

  private onClassCountClick(
    color: PlayerColor,
    classification: keyof JudgementCounts,
  ): void {
    this.moveListFilter = { color, classification };
    const key = classPliesKey(color, classification);
    const plies = this.classPlies.get(key) ?? [];
    if (plies.length === 0) {
      return;
    }
    const index = this.judgementCycleIndex.get(key) ?? 0;
    const ply = plies[index];
    if (ply === undefined) {
      return;
    }
    this.goToPly(ply);
    this.judgementCycleIndex.set(key, (index + 1) % plies.length);
    this.renderMoveList();
    this.updateMoveListFilterToolbar();
    this.updateDashboardPressedState();
    this.highlightActiveMove();
  }

  private clearMoveListFilter(): void {
    this.moveListFilter = null;
    this.renderMoveList();
    this.updateMoveListFilterToolbar();
    this.updateDashboardPressedState();
    this.highlightActiveMove();
  }

  private updateMoveListFilterToolbar(): void {
    if (!this.moveListFilter) {
      this.el.moveListFilterToolbar.hidden = true;
      return;
    }
    const { color, classification } = this.moveListFilter;
    this.el.moveListFilterToolbar.hidden = false;
    this.el.moveListFilterLabel.textContent =
      `${MOVE_CLASS_LABEL_PT[classification]} · ${colorLabelPt(color)}`;
  }

  private updateDashboardPressedState(): void {
    for (const btn of Array.from(
      this.el.summaryJudgements.querySelectorAll<HTMLButtonElement>(
        ".class-dashboard-count",
      ),
    )) {
      const color = btn.dataset.color;
      const classification = btn.dataset.classification;
      const pressed =
        this.moveListFilter !== null &&
        color === this.moveListFilter.color &&
        classification === this.moveListFilter.classification;
      btn.setAttribute("aria-pressed", String(pressed));
      btn.classList.toggle("class-dashboard-count-active", pressed);
    }
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
    const sanWithGlyph = formatSanWithGlyph(moment.san, moment.classification);
    main.innerHTML =
      `<span class="critical-moment-move">${escapeHtml(formatMoveRef(moment.ply, moment.color, sanWithGlyph))}</span>` +
      `<span class="critical-moment-color">${escapeHtml(colorLabelPt(moment.color))}</span>`;

    const meta = document.createElement("span");
    meta.className = "critical-moment-meta";
    const evalLabel =
      moment.evalBefore !== undefined
        ? `${moment.evalBefore} → ${moment.evalAfter}`
        : moment.evalAfter;
    meta.innerHTML =
      `<span class="critical-moment-class">${escapeHtml(MOVE_CLASS_LABEL_PT[moment.classification])}</span>` +
      `<span class="critical-moment-eval">${escapeHtml(evalLabel)}</span>`;

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
    const rows = moveListRows(this.review.moves, this.moveListFilter);
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
    btn.title = move.classificationLabel;
    const onlyMoveBadge = isOnlyMove(move)
      ? `<span class="move-only-badge" title="Lance único">Único</span>`
      : "";
    const evalLabel = formatMoveEvalAfter(move);
    btn.innerHTML =
      `<span class="move-main">${renderSanWithGlyph(move.san, move.classification)}${onlyMoveBadge}</span>` +
      `<span class="move-eval">${escapeHtml(evalLabel)}</span>`;
    if (ply === this.currentPly) {
      btn.classList.add("move-active");
    }
    btn.addEventListener("click", () => this.goToPly(ply));
    td.appendChild(btn);
    return td;
  }

  private toggleBoardFlip(): void {
    this.flipped = !this.flipped;
    this.el.boardFlip.setAttribute("aria-pressed", String(this.flipped));
    this.refreshView();
  }

  private refreshView(): void {
    if (!this.game) {
      return;
    }

    let fen: string;
    let highlight: { from?: string; to?: string } | undefined;

    const previewBoard = this.resolveEnginePreviewBoard();
    if (this.enginePreviewIndex !== null && !previewBoard) {
      this.enginePreviewIndex = null;
    }

    if (previewBoard) {
      fen = previewBoard.fen;
      highlight = previewBoard.highlight;
    } else {
      const fensAfter = this.game.moves.map((m) => m.fenAfter);
      fen = fenAtPly(this.game.initialFen, fensAfter, this.currentPly);
      const move =
        this.currentPly >= 0 ? this.game.moves[this.currentPly] : undefined;
      highlight = move ? uciSquares(move.uci) ?? undefined : undefined;
    }

    renderChessBoard(this.el.boardHost, fen, highlight ?? undefined, this.flipped);
    if (this.review) {
      renderEvalGraph(this.el.evalCanvas, this.review.graph, this.currentPly);
    }
    this.updateNav();
    this.renderCommentSlice();
    this.highlightActiveMove();
  }

  private resolveEnginePreviewBoard(): {
    fen: string;
    highlight: { from: string; to: string };
  } | null {
    if (
      this.enginePreviewIndex === null ||
      !this.game ||
      this.currentPly < 0 ||
      !this.review
    ) {
      return null;
    }

    const slice = buildCommentSlice(this.review, this.currentPly);
    const sans = engineLineSans(slice);
    if (sans.length === 0) {
      return null;
    }

    const fenBefore = this.game.moves[this.currentPly]?.fenBefore;
    if (!fenBefore) {
      return null;
    }

    return previewEngineLineMove(
      fenBefore,
      sans,
      this.enginePreviewIndex,
    );
  }

  private clearEnginePreview(): void {
    if (this.enginePreviewIndex !== null) {
      this.enginePreviewIndex = null;
    }
  }

  private onEngineSanClick(index: number): void {
    if (!this.game || this.currentPly < 0 || !this.review) {
      return;
    }

    const slice = buildCommentSlice(this.review, this.currentPly);
    const sans = engineLineSans(slice);
    const fenBefore = this.game.moves[this.currentPly]?.fenBefore;
    if (!fenBefore || sans.length === 0) {
      return;
    }

    const preview = previewEngineLineMove(fenBefore, sans, index);
    if (!preview) {
      return;
    }

    if (this.enginePreviewIndex === index) {
      this.enginePreviewIndex = null;
    } else {
      this.enginePreviewIndex = index;
    }
    this.refreshView();
  }

  private renderCommentSlice(): void {
    const {
      commentSliceEmpty,
      commentSliceBody,
      commentSliceButton,
      commentSliceProxyHint,
      commentSliceAi,
    } = this.el;

    if (!this.review || this.currentPly < 0) {
      commentSliceEmpty.hidden = false;
      commentSliceEmpty.textContent = "Selecione um lance";
      commentSliceBody.hidden = true;
      commentSliceBody.replaceChildren();
      commentSliceButton.disabled = true;
      commentSliceButton.title = "";
      commentSliceProxyHint.hidden = true;
      commentSliceAi.hidden = true;
      commentSliceAi.replaceChildren();
      commentSliceAi.className = "";
      return;
    }

    const slice = buildCommentSlice(this.review, this.currentPly);
    if (!slice) {
      commentSliceEmpty.hidden = false;
      commentSliceEmpty.textContent = "Selecione um lance";
      commentSliceBody.hidden = true;
      commentSliceBody.replaceChildren();
      commentSliceButton.disabled = true;
      commentSliceButton.title = "";
      commentSliceProxyHint.hidden = true;
      commentSliceAi.hidden = true;
      commentSliceAi.replaceChildren();
      commentSliceAi.className = "";
      return;
    }

    commentSliceEmpty.hidden = true;
    commentSliceBody.hidden = false;
    commentSliceBody.replaceChildren();

    const accuracyLabel =
      slice.accuracy === null
        ? "—"
        : `${slice.accuracy.toFixed(1)}%`;
    const sanWithGlyph = formatSanWithGlyph(slice.san, slice.classification);
    const evalLabel =
      slice.evalBefore !== undefined
        ? `${slice.evalBefore} → ${slice.evalAfter}`
        : slice.evalAfter;

    const headerBtn = document.createElement("button");
    headerBtn.type = "button";
    headerBtn.className = `comment-slice-header ${CLASS_CSS[slice.classification]}`;
    const headerSan = document.createElement("span");
    headerSan.className = "comment-slice-san";
    headerSan.textContent = formatMoveRef(slice.ply, slice.color, sanWithGlyph);
    headerBtn.appendChild(headerSan);
    headerBtn.addEventListener("click", () => {
      this.clearEnginePreview();
      this.refreshView();
    });

    const judgementEl = document.createElement("p");
    judgementEl.className = "comment-slice-judgement";
    judgementEl.appendChild(this.renderJudgement(slice));
    if (slice.onlyMove) {
      judgementEl.append(document.createTextNode(" · Lance único"));
    }

    const motorLine = this.renderMotorLine(slice);
    const children: Node[] = [
      headerBtn,
      judgementEl,
      this.renderCommentMetricLine("Eval", evalLabel),
      this.renderCommentMetricLine("Precisão", accuracyLabel),
    ];
    if (motorLine) {
      children.splice(2, 0, motorLine);
    }
    commentSliceBody.append(...children);

    const proxyConfigured = isCommentProxyConfigured();
    commentSliceProxyHint.hidden = proxyConfigured;
    commentSliceButton.textContent = "Comentar";
    commentSliceButton.disabled = !proxyConfigured || this.commentInFlight;
    commentSliceButton.title = proxyConfigured ? "" : "Proxy não configurado";

    if (!this.commentInFlight) {
      commentSliceAi.hidden = true;
      commentSliceAi.replaceChildren();
      commentSliceAi.className = "";
    }
  }

  private async onCommentClick(): Promise<void> {
    if (
      this.commentInFlight ||
      !this.review ||
      this.currentPly < 0 ||
      !isCommentProxyConfigured()
    ) {
      return;
    }

    const slice = buildCommentSlice(this.review, this.currentPly);
    if (!slice) {
      return;
    }

    const { commentSliceButton, commentSliceAi } = this.el;
    this.commentInFlight = true;
    commentSliceButton.disabled = true;
    commentSliceAi.hidden = false;
    commentSliceAi.textContent = "Comentando…";
    commentSliceAi.className = "comment-slice-ai-loading";

    try {
      const comment = await requestComment(slice);
      commentSliceAi.textContent = comment;
      commentSliceAi.className = "";
    } catch (error) {
      const message =
        error instanceof CommentProxyError
          ? error.message
          : "Não foi possível obter o comentário.";
      commentSliceAi.textContent = message;
      commentSliceAi.className = "comment-slice-ai-error";
    } finally {
      this.commentInFlight = false;
      commentSliceButton.disabled = !isCommentProxyConfigured();
      commentSliceButton.title = isCommentProxyConfigured()
        ? ""
        : "Proxy não configurado";
    }
  }

  private renderJudgement(slice: CommentSlice): DocumentFragment {
    const frag = document.createDocumentFragment();
    const { classification, bestSan } = slice;
    const bestIndex = bestSan !== undefined ? 0 : null;

    const appendText = (text: string): void => {
      frag.append(document.createTextNode(text));
    };

    switch (classification) {
      case "brilliant":
        appendText("Lance brilhante.");
        break;
      case "great":
        appendText("Ótimo lance.");
        break;
      case "best":
        appendText("Melhor lance.");
        break;
      case "mistake":
        if (bestSan) {
          appendText("Erro. Melhor era ");
          frag.appendChild(this.createEngineSanButton(bestSan, bestIndex ?? 0));
          appendText(".");
        } else {
          appendText("Erro.");
        }
        break;
      case "miss":
        if (bestSan) {
          appendText("Miss. Melhor era ");
          frag.appendChild(this.createEngineSanButton(bestSan, bestIndex ?? 0));
          appendText(".");
        } else {
          appendText("Miss.");
        }
        break;
      case "blunder":
        if (bestSan) {
          appendText("Blunder. Melhor era ");
          frag.appendChild(this.createEngineSanButton(bestSan, bestIndex ?? 0));
          appendText(".");
        } else {
          appendText("Blunder.");
        }
        break;
      case "forced":
        appendText("Lance forçado.");
        break;
    }

    return frag;
  }

  private renderMotorLine(slice: CommentSlice): HTMLElement | null {
    const sans = engineLineSans(slice);
    if (sans.length === 0) {
      return null;
    }

    const line = document.createElement("div");
    line.className = "comment-slice-line comment-slice-secondary";

    const label = document.createElement("span");
    label.className = "comment-slice-muted";
    label.textContent = "Motor";

    const value = document.createElement("span");
    value.className = "comment-slice-motor-value";

    const tokens = tokenizeEngineLine(sans, slice.ply, slice.color);
    for (const token of tokens) {
      if (token.kind === "num") {
        const num = document.createElement("span");
        num.className = "comment-engine-num";
        num.textContent = token.text;
        value.appendChild(num);
      } else {
        value.appendChild(this.createEngineSanButton(token.san, token.index));
      }
    }

    line.append(label, value);
    return line;
  }

  private renderCommentMetricLine(
    labelText: string,
    valueText: string,
  ): HTMLElement {
    const line = document.createElement("div");
    line.className = "comment-slice-line comment-slice-secondary";

    const label = document.createElement("span");
    label.className = "comment-slice-muted";
    label.textContent = labelText;

    const value = document.createElement("span");
    value.textContent = valueText;

    line.append(label, value);
    return line;
  }

  private createEngineSanButton(san: string, index: number): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "comment-engine-san";
    btn.textContent = san;
    const pressed = this.enginePreviewIndex === index;
    btn.setAttribute("aria-pressed", String(pressed));
    btn.classList.toggle("comment-engine-san-active", pressed);
    btn.addEventListener("click", () => this.onEngineSanClick(index));
    return btn;
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

    if (
      this.enginePreviewIndex !== null &&
      this.review &&
      this.currentPly >= 0
    ) {
      const slice = buildCommentSlice(this.review, this.currentPly);
      const sans = engineLineSans(slice);
      if (slice && sans.length > 0) {
        this.el.plyLabel.textContent =
          `Motor · ${formatEnginePreviewLabel(
            sans,
            slice.ply,
            slice.color,
            this.enginePreviewIndex,
          )}`;
        return;
      }
      this.el.plyLabel.textContent = "Linha do motor";
      return;
    }

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
    this.clearEnginePreview();
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

function engineLineSans(slice: CommentSlice | null): string[] {
  if (!slice?.engineLine) {
    return [];
  }
  return slice.engineLine.split(" ").filter((san) => san.length > 0);
}

function formatEnginePreviewLabel(
  sans: readonly string[],
  ply: number,
  color: PlayerColor,
  index: number,
): string {
  const tokens = tokenizeEngineLine(sans, ply, color);
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.kind === "san" && token.index > index) {
      break;
    }
    parts.push(token.kind === "num" ? token.text : token.san);
    if (token.kind === "san" && token.index === index) {
      break;
    }
  }
  return parts.join(" ");
}

function formatMoveRef(
  ply: number,
  color: PlayerColor,
  sanWithGlyph: string,
): string {
  const moveNum = Math.floor(ply / 2) + 1;
  if (color === "white") {
    return `${moveNum}. ${sanWithGlyph}`;
  }
  return `${moveNum}... ${sanWithGlyph}`;
}

function renderSanWithGlyph(san: string, classification: MoveClass): string {
  const glyph = classificationGlyph(classification);
  if (!glyph) {
    return `<span class="move-san">${escapeHtml(san)}</span>`;
  }
  return (
    `<span class="move-san">${escapeHtml(san)}` +
    `<span class="move-glyph">${escapeHtml(glyph)}</span></span>`
  );
}

function colorLabelPt(color: PlayerColor): string {
  return color === "white" ? "Brancas" : "Pretas";
}

function classPliesKey(
  color: PlayerColor,
  classification: keyof JudgementCounts,
): string {
  return `${color}:${classification}`;
}

function buildClassPlies(moves: readonly ReviewedMove[]): Map<string, number[]> {
  const plies = new Map<string, number[]>();
  for (const move of moves) {
    if (move.classification === "forced") {
      continue;
    }
    const classification = move.classification;
    const key = classPliesKey(move.color, classification);
    const list = plies.get(key) ?? [];
    list.push(move.ply);
    plies.set(key, list);
  }
  return plies;
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
