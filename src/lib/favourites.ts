// Code step 1 of the AI recommender, run in the browser: work out which games the
// visitor enjoyed most from their play ratings, and build the request for
// /api/recommendations. Plain arithmetic: no AI needed, same answer every time.

import {
  REQUEST_LIMITS,
  type FavouriteGame,
  type PlayerCountChoice,
  type RecommendationMode,
  type RecommendationRequest,
} from '@/lib/recommendationRequest';
import type { BoardGame, PlaySession } from '@/types/types';

const FAVOURITES_TO_SEND = 8;
const TAGS_TO_SEND = 6;

export interface RankedFavourite {
  game: BoardGame;
  averageRating: number;
  plays: number;
  playsAtPlayerCount: number;
}

function matchesPlayerCount(playerCount: number, players: PlayerCountChoice): boolean {
  if (players === 'any') return true;
  return players === 6 ? playerCount >= 6 : playerCount === players;
}

/**
 * Owned games with at least one "overall" rating, best first:
 * highest average overall rating, then most plays.
 */
export function rankFavourites(
  games: BoardGame[],
  plays: PlaySession[],
  players: PlayerCountChoice
): RankedFavourite[] {
  const playsByGame = new Map<string, PlaySession[]>();
  for (const play of plays) {
    const list = playsByGame.get(play.game_id) ?? [];
    list.push(play);
    playsByGame.set(play.game_id, list);
  }

  const ranked: RankedFavourite[] = [];
  for (const game of games) {
    if (game.status !== 'owned' || game.title.length > REQUEST_LIMITS.titleLength) continue;
    const gamePlays = playsByGame.get(game.id) ?? [];
    const ratings = gamePlays
      .map((play) => play.ratings?.overall)
      .filter((rating): rating is number => typeof rating === 'number' && rating >= 1 && rating <= 5);
    if (ratings.length === 0) continue;

    ranked.push({
      game,
      averageRating: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
      plays: gamePlays.length,
      playsAtPlayerCount: gamePlays.filter((play) => matchesPlayerCount(play.player_count, players)).length,
    });
  }

  return ranked.sort((a, b) => b.averageRating - a.averageRating || b.plays - a.plays);
}

/** Up to 6 short tags; anything the server would reject is left out. */
function tags(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= REQUEST_LIMITS.tagLength)
    .slice(0, TAGS_TO_SEND);
}

export function buildRecommendationRequest(
  games: BoardGame[],
  favourites: RankedFavourite[],
  players: PlayerCountChoice,
  mode: RecommendationMode
): RecommendationRequest {
  const owned = games.filter((game) => game.status === 'owned');
  const wanted = games.filter((game) => game.status === 'wishlist');
  const bggIds = (list: BoardGame[]) =>
    list
      .map((game) => game.bgg_id)
      .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
      .slice(0, REQUEST_LIMITS.bggIds);

  return {
    players,
    mode,
    favourites: favourites.slice(0, FAVOURITES_TO_SEND).map(
      (favourite): FavouriteGame => ({
        title: favourite.game.title,
        rating: Math.round(favourite.averageRating * 10) / 10,
        plays: favourite.plays,
        playsAtPlayerCount: players === 'any' ? undefined : favourite.playsAtPlayerCount,
        categories: tags(favourite.game.categories),
        mechanics: tags(favourite.game.mechanics),
      })
    ),
    ownedTitles: owned
      .map((game) => game.title)
      .filter((title) => title.length <= REQUEST_LIMITS.titleLength)
      .slice(0, REQUEST_LIMITS.ownedTitles),
    ownedBggIds: bggIds(owned),
    wantedBggIds: bggIds(wanted),
  };
}

export const FAVOURITES_SHOWN = FAVOURITES_TO_SEND;
