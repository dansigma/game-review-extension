export const SUMMARY_CACHE_DB_NAME = "game-summary-cache";
export const SUMMARY_CACHE_DB_VERSION = 1;
export const SUMMARY_CACHE_STORE = "summaries";
export const SUMMARY_CACHE_VERSION = 2;

export type SummaryCacheSource = "llm" | "fallback";

export interface SummaryCacheRecord {
  key: string;
  text: string;
  source: SummaryCacheSource;
}

export interface SummaryCacheDeps {
  indexedDB: IDBFactory;
}

export function summaryCacheKey(gameId: string, algoVersion: string): string {
  return `${gameId}|${algoVersion}|${SUMMARY_CACHE_VERSION}`;
}

function openSummaryCacheDb(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SUMMARY_CACHE_DB_NAME, SUMMARY_CACHE_DB_VERSION);
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open summary cache database"));
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SUMMARY_CACHE_STORE)) {
        db.createObjectStore(SUMMARY_CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function getRecord(
  db: IDBDatabase,
  key: string,
): Promise<SummaryCacheRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_CACHE_STORE, "readonly");
    const store = tx.objectStore(SUMMARY_CACHE_STORE);
    const request = store.get(key);
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read summary cache"));
    };
    request.onsuccess = () => {
      resolve(request.result as SummaryCacheRecord | undefined);
    };
  });
}

function putRecord(db: IDBDatabase, record: SummaryCacheRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUMMARY_CACHE_STORE, "readwrite");
    const store = tx.objectStore(SUMMARY_CACHE_STORE);
    const request = store.put(record);
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to write summary cache"));
    };
    request.onsuccess = () => {
      resolve();
    };
  });
}

export async function getCachedSummary(
  key: string,
  deps: SummaryCacheDeps,
): Promise<SummaryCacheRecord | undefined> {
  const db = await openSummaryCacheDb(deps.indexedDB);
  try {
    return await getRecord(db, key);
  } finally {
    db.close();
  }
}

export async function putCachedSummary(
  key: string,
  text: string,
  source: SummaryCacheSource,
  deps: SummaryCacheDeps,
): Promise<void> {
  const db = await openSummaryCacheDb(deps.indexedDB);
  try {
    await putRecord(db, { key, text, source });
  } finally {
    db.close();
  }
}
