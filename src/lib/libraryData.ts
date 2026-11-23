import { supabase } from '@/lib/supabase';
import {
  cacheGameDetails,
  cacheGames,
  getCachedGameDetails,
  getCachedGames,
  isNetworkError,
} from '@/lib/offlineGameStore';
import { getDemoGameDetails, getDemoGames } from '@/lib/demoStore';
import type { BoardGame, Expansion, PlaySession } from '@/types/types';

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

/** Decides which data a page shows. null while the login state is still being restored. */
export function getLibraryMode(isAuthLoading: boolean, isSignedIn: boolean): LibraryMode | null {
  if (isAuthLoading) return null;
  return isSignedIn ? 'live' : 'demo';
}
