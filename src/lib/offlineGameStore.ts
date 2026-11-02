import type { BoardGame, Expansion, PlaySession } from '@/types/types';

const DATABASE_NAME = 'boardgames-library-offline';
const DATABASE_VERSION = 1;
const GAMES_STORE = 'games';
const GAME_DETAILS_STORE = 'game-details';

interface CachedGameDetails {
  game_id: string;
  expansions: Expansion[];
  plays: PlaySession[];
  cached_at: string;
  has_cached_details: boolean;
}

export interface OfflineGameDetails {
  game: BoardGame | null;
  expansions: Expansion[];
  plays: PlaySession[];
  hasCachedDetails: boolean;
}

export function isNetworkError(error: unknown): boolean {
  if ((typeof navigator !== 'undefined' && !navigator.onLine) || error instanceof TypeError) return true;
  if (!error || typeof error !== 'object' || !('message' in error)) return false;
  return /failed to fetch|network error|load failed|offline|connection refused/i.test(
    String(error.message)
  );
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Offline storage is unavailable in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore(GAMES_STORE, { keyPath: 'id' });
      database.createObjectStore(GAME_DETAILS_STORE, { keyPath: 'game_id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Offline storage transaction was aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Offline storage transaction failed.'));
  });
}

export async function cacheGames(games: BoardGame[]): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(GAMES_STORE, 'readwrite');
    const store = transaction.objectStore(GAMES_STORE);
    store.clear();
    for (const game of games) store.put(game);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function cacheGame(game: BoardGame): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(GAMES_STORE, 'readwrite');
    transaction.objectStore(GAMES_STORE).put(game);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function getCachedGames(): Promise<BoardGame[]> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(GAMES_STORE, 'readonly');
    const request = transaction.objectStore(GAMES_STORE).getAll() as IDBRequest<BoardGame[]>;
    const games = await new Promise<BoardGame[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not read saved games.'));
    });
    await waitForTransaction(transaction);
    return games;
  } finally {
    database.close();
  }
}

export async function removeCachedGame(gameId: string): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction([GAMES_STORE, GAME_DETAILS_STORE], 'readwrite');
    transaction.objectStore(GAMES_STORE).delete(gameId);
    transaction.objectStore(GAME_DETAILS_STORE).delete(gameId);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function cacheGameDetails(
  game: BoardGame,
  expansions: Expansion[],
  plays: PlaySession[],
  hasCachedDetails = true
): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction([GAMES_STORE, GAME_DETAILS_STORE], 'readwrite');
    transaction.objectStore(GAMES_STORE).put(game);
    transaction.objectStore(GAME_DETAILS_STORE).put({
      game_id: game.id,
      expansions,
      plays,
      cached_at: new Date().toISOString(),
      has_cached_details: hasCachedDetails,
    } satisfies CachedGameDetails);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function getCachedGameDetails(gameId: string): Promise<OfflineGameDetails> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction([GAMES_STORE, GAME_DETAILS_STORE], 'readonly');
    const gameRequest = transaction.objectStore(GAMES_STORE).get(gameId) as IDBRequest<BoardGame | undefined>;
    const detailsRequest = transaction.objectStore(GAME_DETAILS_STORE).get(gameId) as IDBRequest<
      CachedGameDetails | undefined
    >;

    const [game, details] = await Promise.all([
      new Promise<BoardGame | null>((resolve, reject) => {
        gameRequest.onsuccess = () => resolve(gameRequest.result ?? null);
        gameRequest.onerror = () =>
          reject(gameRequest.error ?? new Error('Could not read saved game details.'));
      }),
      new Promise<CachedGameDetails | null>((resolve, reject) => {
        detailsRequest.onsuccess = () => resolve(detailsRequest.result ?? null);
        detailsRequest.onerror = () =>
          reject(detailsRequest.error ?? new Error('Could not read saved play history.'));
      }),
    ]);

    await waitForTransaction(transaction);
    return {
      game,
      expansions: details?.expansions ?? [],
      plays: details?.plays ?? [],
      hasCachedDetails: details?.has_cached_details ?? false,
    };
  } finally {
    database.close();
  }
}
