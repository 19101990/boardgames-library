import type { BoardGame, Expansion, PlaySession } from '@/types/types';

// Demo data lives in its own IndexedDB database so it can never overwrite or mix with
// the real collection's offline cache (boardgames-library-offline).
// public/offline-game.js reads this database too; keep store names in sync with it.
const DATABASE_NAME = 'boardgames-library-demo';
const DATABASE_VERSION = 1;
const GAMES_STORE = 'games';
const EXPANSIONS_STORE = 'expansions';
const PLAYS_STORE = 'plays';
const META_STORE = 'meta';
const SEED_URL = '/demo/seed.json';
const SEED_META_KEY = 'seed';
/**
 * Must match schema_version in public/demo/seed.json. When the seed changes, bump both:
 * browsers holding an older demo then replace it (and the visitor's demo edits) once.
 */
const CURRENT_SEED_VERSION = 2;

interface DemoSeed {
  schema_version: number;
  games: BoardGame[];
  expansions: Expansion[];
  plays: PlaySession[];
}

interface SeedMeta {
  key: typeof SEED_META_KEY;
  schema_version: number;
  seeded_at: string;
}

export interface DemoGameDetails {
  game: BoardGame | null;
  expansions: Expansion[];
  plays: PlaySession[];
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Browser storage is unavailable, so the demo cannot be loaded.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore(GAMES_STORE, { keyPath: 'id' });
      database
        .createObjectStore(EXPANSIONS_STORE, { keyPath: 'id' })
        .createIndex('game_id', 'game_id', { unique: false });
      database
        .createObjectStore(PLAYS_STORE, { keyPath: 'id' })
        .createIndex('game_id', 'game_id', { unique: false });
      database.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open demo storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Demo storage request failed.'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Demo storage transaction was aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Demo storage transaction failed.'));
  });
}

async function readSeedMeta(database: IDBDatabase): Promise<SeedMeta | undefined> {
  const transaction = database.transaction(META_STORE, 'readonly');
  return requestResult(transaction.objectStore(META_STORE).get(SEED_META_KEY) as IDBRequest<SeedMeta | undefined>);
}

async function fetchSeed(): Promise<DemoSeed> {
  const response = await fetch(SEED_URL);
  if (!response.ok) throw new Error(`Could not download the demo data (HTTP ${response.status}).`);
  const seed = (await response.json()) as DemoSeed;
  if (!Array.isArray(seed.games) || !Array.isArray(seed.expansions) || !Array.isArray(seed.plays)) {
    throw new Error('The demo data file is not in the expected format.');
  }
  return seed;
}

async function writeSeed(database: IDBDatabase, seed: DemoSeed): Promise<void> {
  const stores = [GAMES_STORE, EXPANSIONS_STORE, PLAYS_STORE, META_STORE];
  const transaction = database.transaction(stores, 'readwrite');
  const done = waitForTransaction(transaction);

  for (const name of [GAMES_STORE, EXPANSIONS_STORE, PLAYS_STORE]) transaction.objectStore(name).clear();
  seed.games.forEach((game) => transaction.objectStore(GAMES_STORE).put(game));
  seed.expansions.forEach((expansion) => transaction.objectStore(EXPANSIONS_STORE).put(expansion));
  seed.plays.forEach((play) => transaction.objectStore(PLAYS_STORE).put(play));
  const meta: SeedMeta = {
    key: SEED_META_KEY,
    schema_version: seed.schema_version,
    seeded_at: new Date().toISOString(),
  };
  transaction.objectStore(META_STORE).put(meta);

  await done;
}

let seedingPromise: Promise<void> | null = null;

/**
 * Fills demo storage from /demo/seed.json the first time the demo is opened on this device,
 * and replaces it once when the seed version is newer. After that the demo works offline
 * from IndexedDB alone.
 */
export function ensureDemoSeeded(): Promise<void> {
  seedingPromise ??= (async () => {
    const database = await openDatabase();
    try {
      const meta = await readSeedMeta(database);
      if (meta && meta.schema_version >= CURRENT_SEED_VERSION) return;

      if (meta) {
        // An older demo is stored. Replace it when we can; if the new seed can't be
        // downloaded (e.g. offline), keep the old demo rather than show an error.
        try {
          await writeSeed(database, await fetchSeed());
        } catch (error) {
          console.warn('Could not update the demo data; keeping the stored version.', error);
        }
        return;
      }

      await writeSeed(database, await fetchSeed());
    } finally {
      database.close();
    }
  })().catch((error: unknown) => {
    seedingPromise = null; // allow a retry, e.g. after reconnecting
    throw error;
  });
  return seedingPromise;
}

export async function getDemoGames(): Promise<BoardGame[]> {
  await ensureDemoSeeded();
  const database = await openDatabase();
  try {
    const transaction = database.transaction(GAMES_STORE, 'readonly');
    const games = await requestResult(transaction.objectStore(GAMES_STORE).getAll() as IDBRequest<BoardGame[]>);
    return games.sort((a, b) => a.title.localeCompare(b.title));
  } finally {
    database.close();
  }
}

/** Every demo play, for the AI recommender's favourites. */
export async function getAllDemoPlays(): Promise<PlaySession[]> {
  await ensureDemoSeeded();
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PLAYS_STORE, 'readonly');
    return await requestResult(transaction.objectStore(PLAYS_STORE).getAll() as IDBRequest<PlaySession[]>);
  } finally {
    database.close();
  }
}

// ---------- Writes (demo changes stay in this browser only) ----------

async function withWriteTransaction(
  storeNames: string[],
  work: (transaction: IDBTransaction) => void | Promise<void>
): Promise<void> {
  await ensureDemoSeeded();
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeNames, 'readwrite');
    const done = waitForTransaction(transaction);
    try {
      await work(transaction);
    } catch (error) {
      transaction.abort();
      await done.catch(() => undefined);
      throw error;
    }
    await done;
  } finally {
    database.close();
  }
}

export function newDemoId(prefix: string): string {
  const unique =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}

export function putDemoPlay(play: PlaySession): Promise<void> {
  return withWriteTransaction([PLAYS_STORE], (transaction) => {
    transaction.objectStore(PLAYS_STORE).put(play);
  });
}

export function deleteDemoPlay(playId: string): Promise<void> {
  return withWriteTransaction([PLAYS_STORE], (transaction) => {
    transaction.objectStore(PLAYS_STORE).delete(playId);
  });
}

export function putDemoExpansion(expansion: Expansion): Promise<void> {
  return withWriteTransaction([EXPANSIONS_STORE], (transaction) => {
    transaction.objectStore(EXPANSIONS_STORE).put(expansion);
  });
}

export function putDemoGame(game: BoardGame): Promise<void> {
  return withWriteTransaction([GAMES_STORE], (transaction) => {
    transaction.objectStore(GAMES_STORE).put(game);
  });
}

/** Adds a game and its expansions. Fails if a game with the same id is already in the demo. */
export function addDemoGame(game: BoardGame, expansions: Expansion[]): Promise<void> {
  return withWriteTransaction([GAMES_STORE, EXPANSIONS_STORE], async (transaction) => {
    const existing = await requestResult(transaction.objectStore(GAMES_STORE).getKey(game.id));
    if (existing !== undefined) {
      throw new Error(`"${game.title}" is already in the demo collection or wanted list.`);
    }
    transaction.objectStore(GAMES_STORE).add(game);
    expansions.forEach((expansion) => transaction.objectStore(EXPANSIONS_STORE).put(expansion));
  });
}

/** Removes a game together with its plays and expansions. */
export function deleteDemoGame(gameId: string): Promise<void> {
  return withWriteTransaction([GAMES_STORE, EXPANSIONS_STORE, PLAYS_STORE], async (transaction) => {
    transaction.objectStore(GAMES_STORE).delete(gameId);
    for (const storeName of [EXPANSIONS_STORE, PLAYS_STORE]) {
      const store = transaction.objectStore(storeName);
      const keys = await requestResult(store.index('game_id').getAllKeys(gameId));
      keys.forEach((key) => store.delete(key));
    }
  });
}

export async function getDemoGameDetails(gameId: string): Promise<DemoGameDetails> {
  await ensureDemoSeeded();
  const database = await openDatabase();
  try {
    const transaction = database.transaction([GAMES_STORE, EXPANSIONS_STORE, PLAYS_STORE], 'readonly');
    const [game, expansions, plays] = await Promise.all([
      requestResult(transaction.objectStore(GAMES_STORE).get(gameId) as IDBRequest<BoardGame | undefined>),
      requestResult(
        transaction.objectStore(EXPANSIONS_STORE).index('game_id').getAll(gameId) as IDBRequest<Expansion[]>
      ),
      requestResult(
        transaction.objectStore(PLAYS_STORE).index('game_id').getAll(gameId) as IDBRequest<PlaySession[]>
      ),
    ]);
    return {
      game: game ?? null,
      expansions: expansions.sort((a, b) => a.title.localeCompare(b.title)),
      plays: plays.sort((a, b) => b.play_date.localeCompare(a.play_date)),
    };
  } finally {
    database.close();
  }
}
