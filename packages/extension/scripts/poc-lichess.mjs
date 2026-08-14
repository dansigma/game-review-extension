#!/usr/bin/env node
/**
 * PoC 2 from Node: Lichess export JSON, no DOM scrape.
 */
const FINISHED_ID = process.argv[2] ?? "8fuPHGyu";

async function exportGame(id) {
  const response = await fetch(`https://lichess.org/game/export/${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${id}`);
  }
  return response.json();
}

function summarize(game) {
  const plyCount = game.moves
    ? game.moves.trim().split(/\s+/).filter(Boolean).length
    : 0;
  return {
    id: game.id,
    status: game.status,
    finished: game.status !== "started",
    variant: game.variant,
    plyCount,
    winner: game.winner ?? null,
    white: game.players?.white?.user?.name ?? null,
    black: game.players?.black?.user?.name ?? null,
  };
}

const finished = await exportGame(FINISHED_ID);
console.log("finished", summarize(finished));
if (finished.status === "started") {
  throw new Error(`Expected ${FINISHED_ID} to be finished`);
}

const tvResponse = await fetch("https://lichess.org/api/tv/channels");
if (!tvResponse.ok) {
  throw new Error(`TV HTTP ${tvResponse.status}`);
}
const tv = await tvResponse.json();
const liveId = tv.blitz?.gameId ?? tv.rapid?.gameId ?? tv.best?.gameId;
if (liveId) {
  const live = await exportGame(liveId);
  console.log("tv-live", summarize(live));
} else {
  console.log("tv-live", { skipped: true });
}

console.log("PoC 2 OK: export JSON works; status!==started means reviewable.");
