export type EngineCommand =
  | { type: "init"; assetBase: string }
  | { type: "uci"; command: string }
  | { type: "dispose" };

export type EngineEvent =
  | { type: "ready"; engineName: string; nnue?: string }
  | { type: "line"; line: string }
  | { type: "error"; message: string };

type StockfishFactory = (module?: {
  locateFile?: (file: string) => string;
}) => Promise<StockfishEngine>;

interface StockfishEngine {
  listen: ((line: string) => void) | null;
  onError: ((message: string) => void) | null;
  uci: (command: string) => void;
  getRecommendedNnue: (index: number) => string | undefined;
  setNnueBuffer: (data: Uint8Array, index?: number) => void;
}

let engine: StockfishEngine | undefined;

self.onmessage = async (event: MessageEvent<EngineCommand>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const assetBase = message.assetBase.endsWith("/")
        ? message.assetBase
        : `${message.assetBase}/`;
      const moduleUrl = `${assetBase}sf_18_smallnet.js`;
      const imported = (await import(/* @vite-ignore */ moduleUrl)) as {
        default: StockfishFactory;
      };
      engine = await imported.default({
        locateFile: (file: string) => `${assetBase}${file}`,
      });
      engine.listen = (line) => {
        post({ type: "line", line });
      };
      engine.onError = (msg) => {
        post({ type: "error", message: msg });
      };

      const nnueName = engine.getRecommendedNnue(0);
      if (nnueName) {
        const response = await fetch(`${assetBase}${nnueName}`);
        if (!response.ok) {
          throw new Error(`Failed to load NNUE ${nnueName}: ${response.status}`);
        }
        engine.setNnueBuffer(new Uint8Array(await response.arrayBuffer()), 0);
      }

      post({
        type: "ready",
        engineName: "sf_18_smallnet",
        nnue: nnueName,
      });
      return;
    }

    if (message.type === "uci") {
      if (!engine) {
        throw new Error("Engine is not initialized");
      }
      engine.uci(message.command);
      return;
    }

    if (message.type === "dispose") {
      engine?.uci("quit");
      engine = undefined;
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    post({ type: "error", message: errMessage });
  }
};

function post(event: EngineEvent): void {
  self.postMessage(event);
}
