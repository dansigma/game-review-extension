export type BackgroundRequest =
  | { type: "lichess-export"; gameId: string }
  | { type: "lichess-tv" }
  | { type: "open-review"; gameId: string }
  | { type: "get-active-game" };

export type BackgroundResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type ActiveGameData = {
  gameId: string;
};
