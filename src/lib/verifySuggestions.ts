// Checks the AI's ideas against BoardGameGeek. The AI is good at taste but not at
// facts, so everything shown to the visitor (title, year, image, player counts)
// comes from BGG; the AI only contributes the idea and the "why".

import { fetchBggGameDetails, searchBggIds, type BggGameDetails } from '@/lib/bgg';
import type { PlayerCount, PlayerCountChoice, RecommendationRequest } from '@/lib/recommendationRequest';

export interface AiSuggestion {
  title: string;
  year: number;
  reason: string;
}

export interface VerifiedSuggestion {
  bggId: number;
  title: string;
  year: number | null;
  reason: string;
  image: string | null;
  thumbnail: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  rating: number | null;
  weight: number | null;
  /** Already on the visitor's Wanted list. */
  isWanted: boolean;
}

type DropReason = 'notOnBgg' | 'expansion' | 'owned' | 'duplicate' | 'playerCount' | 'tooManyWanted';

export interface VerificationResult {
  suggestions: VerifiedSuggestion[];
  /** Which AI ideas were removed and why (for the server log). */
  dropped: Partial<Record<DropReason, string[]>>;
}

export const RESULTS_TO_SHOW = 5;
const MAX_WANTED_IN_RESULTS = 2;
const MAX_CANDIDATES_PER_TITLE = 3;
/** Games with fewer BGG ratings are treated as a wrong match (a same-named obscure item). */
const MIN_USERS_RATED = 30;
/** "Plays very well with N" = at least 70% of voters call N Best or Recommended... */
const MIN_POSITIVE_SHARE = 0.7;
/** ...but only when enough people voted; otherwise supporting the count is enough. */
const MIN_PLAYER_COUNT_VOTES = 10;

/**
 * "Pax Pamir (Second Edition)" and "Pax Pamir: Second Edition" both become "pax pamir second edition".
 * A leading article is ignored too: "Isle of Cats" matches "The Isle of Cats".
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents: "Orléans" -> "orleans"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(the|a|an) /, '');
}

/** BGG IDs that could be the game the AI meant. */
async function findCandidateIds(title: string): Promise<number[]> {
  const exact = await searchBggIds(title, true);
  if (exact.length > 0) return exact.slice(0, MAX_CANDIDATES_PER_TITLE).map((match) => match.id);

  // Fallback for punctuation differences: search the part before ":" or "(" and
  // keep only results whose title is the same once punctuation is ignored.
  const shortQuery = title.split(/[:(–—]/)[0].trim();
  if (shortQuery.length < 2) return [];
  const wanted = normaliseTitle(title);
  const loose = await searchBggIds(shortQuery, false);
  return loose
    .filter((match) => normaliseTitle(match.name) === wanted)
    .slice(0, MAX_CANDIDATES_PER_TITLE)
    .map((match) => match.id);
}

function playsWellWithCount(game: BggGameDetails, players: PlayerCount): boolean {
  // players = 6 means "6 or more", so the game must support at least 6.
  if (game.minPlayers !== null && game.minPlayers > players) return false;
  if (game.maxPlayers !== null && game.maxPlayers < players) return false;

  const votes = game.playerCountVotes[String(players)];
  if (!votes) return true;
  const total = votes.best + votes.recommended + votes.notRecommended;
  if (total < MIN_PLAYER_COUNT_VOTES) return true;
  return (votes.best + votes.recommended) / total >= MIN_POSITIVE_SHARE;
}

/** Must play well at every chosen count (none chosen = any game passes). */
function playsWellWith(game: BggGameDetails, players: PlayerCountChoice): boolean {
  return players.every((count) => playsWellWithCount(game, count));
}

export async function verifySuggestions(
  aiSuggestions: AiSuggestion[],
  request: RecommendationRequest
): Promise<VerificationResult> {
  // 1. Search all titles on BGG at the same time.
  const searches = await Promise.allSettled(aiSuggestions.map((suggestion) => findCandidateIds(suggestion.title)));
  if (searches.length > 0 && searches.every((search) => search.status === 'rejected')) {
    throw new Error('BoardGameGeek could not be reached.');
  }
  const candidateIds = searches.map((search) => (search.status === 'fulfilled' ? search.value : []));

  // 2. One details request for every candidate (batched by 20 inside).
  const uniqueIds = [...new Set(candidateIds.flat())];
  const details = uniqueIds.length > 0 ? await fetchBggGameDetails(uniqueIds) : [];
  const detailsById = new Map(details.map((game) => [game.bggId, game]));

  // 3. Apply the rules in order. The AI's order is kept (it lists its best ideas first).
  const ownedIds = new Set(request.ownedBggIds);
  const ownedTitles = new Set(request.ownedTitles.map(normaliseTitle)); // for games added without a BGG ID
  const wantedIds = new Set(request.wantedBggIds);
  const seenIds = new Set<number>();
  const kept: VerifiedSuggestion[] = [];
  const dropped: VerificationResult['dropped'] = {};
  const drop = (reason: DropReason, title: string) => (dropped[reason] ??= []).push(title);

  aiSuggestions.forEach((suggestion, index) => {
    const matches = candidateIds[index]
      .map((id) => detailsById.get(id))
      .filter((game): game is BggGameDetails => game !== undefined);
    if (matches.length === 0) return drop('notOnBgg', suggestion.title);

    const baseGames = matches.filter((game) => game.type === 'boardgame');
    if (baseGames.length === 0) return drop('expansion', suggestion.title);

    // Several games can share a name; the most-rated one is the one the AI meant.
    const game = baseGames.reduce((best, candidate) => (candidate.usersRated > best.usersRated ? candidate : best));
    if (game.usersRated < MIN_USERS_RATED) return drop('notOnBgg', suggestion.title);

    if (ownedIds.has(game.bggId) || ownedTitles.has(normaliseTitle(game.title))) {
      return drop('owned', game.title);
    }
    if (seenIds.has(game.bggId)) return drop('duplicate', game.title);
    if (!playsWellWith(game, request.players)) return drop('playerCount', game.title);

    const isWanted = wantedIds.has(game.bggId);
    if (isWanted && kept.filter((item) => item.isWanted).length >= MAX_WANTED_IN_RESULTS) {
      return drop('tooManyWanted', game.title);
    }

    seenIds.add(game.bggId);
    kept.push({
      bggId: game.bggId,
      title: game.title,
      year: game.year,
      reason: suggestion.reason,
      image: game.image,
      thumbnail: game.thumbnail,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      minPlaytime: game.minPlaytime,
      maxPlaytime: game.maxPlaytime,
      rating: game.rating,
      weight: game.weight,
      isWanted,
    });
  });

  return { suggestions: kept.slice(0, RESULTS_TO_SHOW), dropped };
}
