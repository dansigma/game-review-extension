import { type GameReview } from "@game-review/core";

export const REVIEW_CACHE_DB_NAME = "game-review-cache";
export const REVIEW_CACHE_DB_VERSION = 1;
export const REVIEW_CACHE_STORE = "reviews";

export interface ReviewCacheKeyParams {
  gameId: string;
  algoVersion: string;
  engineId: string;
  nodesPerPosition: number;
}

export interface ReviewCacheRecord {
  key: string;
  review: GameReview;
}

export interface ReviewCacheDeps {
  indexedDB: IDBFactory;
}

export function reviewCacheKey(params: ReviewCacheKeyParams): string {
  return `${params.gameId}|${params.algoVersion}|${params.engineId}|${params.nodesPerPosition}`;
}

function cacheParamsFromReview(review: GameReview): ReviewCacheKeyParams {
  return {
    gameId: review.gameId,
    algoVersion: review.algoVersion,
    engineId: review.engineId,
    nodesPerPosition: review.nodesPerPosition ?? 0,
  };
}

function isValidCacheHit(
  review: GameReview,
  params: ReviewCacheKeyParams,
): boolean {
  return (
    review.gameId === params.gameId &&
    review.algoVersion === params.algoVersion &&
    review.engineId === params.engineId &&
    review.nodesPerPosition === params.nodesPerPosition
  );
}

function openReviewCacheDb(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(REVIEW_CACHE_DB_NAME, REVIEW_CACHE_DB_VERSION);
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open review cache database"));
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(REVIEW_CACHE_STORE)) {
        db.createObjectStore(REVIEW_CACHE_STORE, { keyPath: "key" });
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
): Promise<ReviewCacheRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REVIEW_CACHE_STORE, "readonly");
    const store = tx.objectStore(REVIEW_CACHE_STORE);
    const request = store.get(key);
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read review cache"));
    };
    request.onsuccess = () => {
      resolve(request.result as ReviewCacheRecord | undefined);
    };
  });
}

function putRecord(db: IDBDatabase, record: ReviewCacheRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REVIEW_CACHE_STORE, "readwrite");
    const store = tx.objectStore(REVIEW_CACHE_STORE);
    const request = store.put(record);
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to write review cache"));
    };
    request.onsuccess = () => {
      resolve();
    };
  });
}

export async function getCachedReview(
  params: ReviewCacheKeyParams,
  deps: ReviewCacheDeps = { indexedDB: globalThis.indexedDB },
): Promise<GameReview | null> {
  const db = await openReviewCacheDb(deps.indexedDB);
  try {
    const record = await getRecord(db, reviewCacheKey(params));
    if (!record) {
      return null;
    }
    if (!isValidCacheHit(record.review, params)) {
      return null;
    }
    return record.review;
  } finally {
    db.close();
  }
}

export async function putCachedReview(
  review: GameReview,
  deps: ReviewCacheDeps = { indexedDB: globalThis.indexedDB },
): Promise<void> {
  const params = cacheParamsFromReview(review);
  const db = await openReviewCacheDb(deps.indexedDB);
  try {
    await putRecord(db, {
      key: reviewCacheKey(params),
      review,
    });
  } finally {
    db.close();
  }
}
