import { supabase } from '@/lib/supabase';
import {
  cacheGameDetails,
  cacheGames,
  getCachedGameDetails,
  getCachedGames,
  isNetworkError,
} from '@/lib/offlineGameStore';
import {
  addDemoGame,
  deleteDemoGame,
  deleteDemoPlay,
  getAllDemoPlays,
  getDemoGameDetails,
  getDemoGames,
  newDemoId,
  putDemoExpansion,
  putDemoGame,
  putDemoPlay,
} from '@/lib/demoStore';
import type { BggExpansion, BoardGame, Expansion, PlayRatings, PlaySession } from '@/types/types';

/**
 * `live`: the owner's real collection from Supabase (signed in).
 * `demo`: sample data stored only in this browser (signed out). Never touches Supabase.
 */
export type LibraryMode = 'live' | 'demo';

export interface LibraryLoadResult {
  games: BoardGame[];
  errorMessage: string | null;
  /** true/false when the load learned the connection state; undefined when it did not. */
  isOffline?: boolean;
}

export interface GameDetailsLoadResult {
  game: BoardGame | null;
  expansions: Expansion[];
  plays: PlaySession[];
  hasCachedDetailLists: boolean;
  offlineCacheMiss: boolean;
  isOffline?: boolean;
}

// ---------- Collection ----------

async function loadCachedLibrary(): Promise<LibraryLoadResult> {
  try {
    const games = await getCachedGames();
    return {
      games,
      isOffline: true,
      errorMessage: games.length === 0 ? 'No saved library is available offline yet. Connect to load it.' : null,
    };
  } catch (error) {
    console.error('Could not load the saved library:', error);
    return { games: [], isOffline: true, errorMessage: 'Could not read the saved library on this device.' };
  }
}

async function loadLiveLibrary(): Promise<LibraryLoadResult> {
  if (!navigator.onLine) return loadCachedLibrary();

  try {
    const { data, error } = await supabase.from('games').select('*').order('title', { ascending: true });

    if (error) {
      console.error('Error fetching games from Supabase:', error);
      if (isNetworkError(error)) return loadCachedLibrary();
      return { games: [], errorMessage: error.message };
    }

    const games = (data ?? []) as BoardGame[];
    void cacheGames(games).catch((cacheError: unknown) => {
      console.error('Could not save the library for offline use:', cacheError);
    });
    return { games, isOffline: false, errorMessage: null };
  } catch (error) {
    console.error('Failed to fetch games:', error);
    if (isNetworkError(error)) return loadCachedLibrary();
    return { games: [], errorMessage: 'Could not load the library. Please try again.' };
  }
}

async function loadDemoLibrary(): Promise<LibraryLoadResult> {
  try {
    return { games: await getDemoGames(), errorMessage: null };
  } catch (error) {
    console.error('Could not load the demo collection:', error);
    return {
      games: [],
      errorMessage: navigator.onLine
        ? 'Could not load the demo collection. Please try again.'
        : 'The demo has not been loaded on this device yet. Connect to the internet to load it.',
    };
  }
}

export function loadLibrary(mode: LibraryMode): Promise<LibraryLoadResult> {
  return mode === 'demo' ? loadDemoLibrary() : loadLiveLibrary();
}

// ---------- Game details ----------

async function loadCachedGameDetails(gameId: string): Promise<GameDetailsLoadResult> {
  try {
    const cached = await getCachedGameDetails(gameId);
    return {
      game: cached.game,
      expansions: cached.expansions,
      plays: cached.plays,
      hasCachedDetailLists: cached.hasCachedDetails,
      offlineCacheMiss: !cached.game,
      isOffline: true,
    };
  } catch (error) {
    console.error('Could not load saved game details:', error);
    return { game: null, expansions: [], plays: [], hasCachedDetailLists: false, offlineCacheMiss: true, isOffline: true };
  }
}

const notFound: GameDetailsLoadResult = {
  game: null,
  expansions: [],
  plays: [],
  hasCachedDetailLists: false,
  offlineCacheMiss: false,
};

async function loadLiveGameDetails(gameId: string): Promise<GameDetailsLoadResult> {
  if (!navigator.onLine) return loadCachedGameDetails(gameId);

  try {
    const { data: gameData, error: gameError } = await supabase.from('games').select('*').eq('id', gameId).single();

    if (gameError || !gameData) {
      console.error('Error fetching game:', gameError);
      return isNetworkError(gameError) ? loadCachedGameDetails(gameId) : notFound;
    }

    const game = gameData as BoardGame;
    const [expansionsResult, playsResult] = await Promise.all([
      supabase.from('expansions').select('*').eq('game_id', gameId).order('title', { ascending: true }),
      supabase.from('plays').select('*').eq('game_id', gameId).order('play_date', { ascending: false }),
    ]);

    const requestError = expansionsResult.error ?? playsResult.error;
    if (requestError) {
      console.error('Could not fetch game history:', requestError);
      if (isNetworkError(requestError)) {
        const cached = await loadCachedGameDetails(gameId);
        return { ...cached, game, offlineCacheMiss: false };
      }
    }

    const expansions = (expansionsResult.data ?? []) as Expansion[];
    const plays = (playsResult.data ?? []) as PlaySession[];
    if (!requestError) {
      void cacheGameDetails(game, expansions, plays).catch((cacheError: unknown) => {
        console.error('Could not save game details for offline use:', cacheError);
      });
    }

    return {
      game,
      expansions,
      plays,
      hasCachedDetailLists: !requestError,
      offlineCacheMiss: false,
      isOffline: false,
    };
  } catch (error) {
    console.error('Failed to load game details:', error);
    return isNetworkError(error) ? loadCachedGameDetails(gameId) : notFound;
  }
}

async function loadDemoGameDetails(gameId: string): Promise<GameDetailsLoadResult> {
  try {
    const details = await getDemoGameDetails(gameId);
    return { ...details, hasCachedDetailLists: true, offlineCacheMiss: false };
  } catch (error) {
    console.error('Could not load demo game details:', error);
    // Demo not downloaded yet and no connection: reuse the "not saved offline" message.
    return { ...notFound, offlineCacheMiss: !navigator.onLine };
  }
}

export function loadGameDetails(mode: LibraryMode, gameId: string): Promise<GameDetailsLoadResult> {
  return mode === 'demo' ? loadDemoGameDetails(gameId) : loadLiveGameDetails(gameId);
}

// ---------- All plays (AI recommender) ----------

/**
 * Every play in the library, used to work out favourite games. Needs a connection in
 * live mode; the AI feature is online-only anyway. Throws a user-readable Error.
 */
export async function loadAllPlays(mode: LibraryMode): Promise<PlaySession[]> {
  if (mode === 'demo') return getAllDemoPlays();

  // Newest first. Supabase's API caps a response at its "Max rows" project setting
  // (1000 by default), so a very long history is cut to the most recent plays.
  const { data, error } = await supabase
    .from('plays')
    .select('*')
    .order('play_date', { ascending: false });
  if (error) {
    console.error('Error fetching plays:', error);
    throw new Error('Could not load your plays.');
  }
  return (data ?? []) as PlaySession[];
}

// ---------- Changes ----------
// Live: writes to Supabase (owner only, online). Demo: writes to this browser's demo storage only.
// All functions throw an Error with a user-readable message on failure.

export interface PlayChanges {
  play_date: string;
  player_count: number;
  notes: string | null;
  ratings: PlayRatings | null;
}

/** Creates a play (existingPlay = null) or updates existingPlay. */
export async function savePlay(
  mode: LibraryMode,
  gameId: string,
  existingPlay: PlaySession | null,
  changes: PlayChanges
): Promise<PlaySession> {
  if (mode === 'demo') {
    const play: PlaySession = {
      id: existingPlay?.id ?? newDemoId('demo-play'),
      game_id: gameId,
      ...changes,
      created_at: existingPlay?.created_at ?? new Date().toISOString(),
    };
    await putDemoPlay(play);
    return play;
  }

  const playId = existingPlay?.id ?? null;
  const playChanges = { game_id: gameId, ...changes };
  const result = playId
    ? await supabase.from('plays').update(playChanges).eq('id', playId).eq('game_id', gameId).select().single()
    : await supabase.from('plays').insert([playChanges]).select().single();
  if (result.error || !result.data) {
    console.error('Error saving play:', result.error);
    throw new Error(result.error?.message ?? 'The play was not saved.');
  }
  return result.data as PlaySession;
}

export async function deletePlay(mode: LibraryMode, playId: string): Promise<void> {
  if (mode === 'demo') return deleteDemoPlay(playId);

  const { error } = await supabase.from('plays').delete().eq('id', playId);
  if (error) {
    console.error('Error deleting play:', error);
    throw new Error(error.message);
  }
}

export async function setExpansionOwned(mode: LibraryMode, expansion: Expansion, isOwned: boolean): Promise<void> {
  if (mode === 'demo') return putDemoExpansion({ ...expansion, is_owned: isOwned });

  const { error } = await supabase.from('expansions').update({ is_owned: isOwned }).eq('id', expansion.id);
  if (error) {
    console.error('Error updating expansion:', error);
    throw new Error(error.message);
  }
}

/** Removes a game. In demo mode its plays and expansions are removed with it. */
export async function removeGame(mode: LibraryMode, gameId: string): Promise<void> {
  if (mode === 'demo') return deleteDemoGame(gameId);

  const { error } = await supabase.from('games').delete().eq('id', gameId);
  if (error) {
    console.error('Error deleting game:', error);
    throw new Error(error.message);
  }
}

export async function moveGameToCollection(mode: LibraryMode, game: BoardGame, language: string): Promise<BoardGame> {
  const updatedGame: BoardGame = { ...game, status: 'owned', language };
  if (mode === 'demo') {
    await putDemoGame(updatedGame);
    return updatedGame;
  }

  const { error } = await supabase.from('games').update({ status: 'owned', language }).eq('id', game.id);
  if (error) {
    console.error('Error moving game to collection:', error);
    throw new Error(error.message);
  }
  return updatedGame;
}

export interface AddGameResult {
  game: BoardGame;
  expansions: Expansion[];
  /** Set when the game was saved but its expansions were not (live mode only). */
  expansionError?: string;
}

/**
 * Adds a game (shaped like the Supabase games row) plus its BGG expansions, all not owned.
 * Demo games get a "demo-" id prefix so they can never collide with real records.
 */
export async function addGame(
  mode: LibraryMode,
  gameRow: BoardGame,
  bggExpansions: BggExpansion[]
): Promise<AddGameResult> {
  if (mode === 'demo') {
    const game: BoardGame = {
      ...gameRow,
      id: gameRow.id.startsWith('demo-') ? gameRow.id : `demo-${gameRow.id}`,
      created_at: new Date().toISOString(),
    };
    const expansions: Expansion[] = bggExpansions.map((expansion) => ({
      id: newDemoId('demo-exp'),
      game_id: game.id,
      bgg_id: expansion.bgg_id,
      title: expansion.title,
      is_owned: false,
    }));
    await addDemoGame(game, expansions);
    return { game, expansions };
  }

  const { error } = await supabase.from('games').insert([gameRow]);
  if (error) {
    console.error('Error inserting game into Supabase:', error);
    throw new Error(error.message);
  }
  if (bggExpansions.length === 0) return { game: gameRow, expansions: [] };

  const { data, error: expansionError } = await supabase
    .from('expansions')
    .insert(bggExpansions.map((expansion) => ({ game_id: gameRow.id, title: expansion.title, is_owned: false })))
    .select('*');
  if (expansionError) {
    console.error('Error inserting BGG expansions into Supabase:', expansionError);
    return { game: gameRow, expansions: [], expansionError: expansionError.message };
  }
  return { game: gameRow, expansions: (data ?? []) as Expansion[] };
}

/** Decides which data a page shows. null while the login state is still being restored. */
export function getLibraryMode(isAuthLoading: boolean, isSignedIn: boolean): LibraryMode | null {
  if (isAuthLoading) return null;
  return isSignedIn ? 'live' : 'demo';
}
