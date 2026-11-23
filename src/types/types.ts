export type GameStatus = 'owned' | 'wishlist';

export type GameLanguage = 'EN' | 'DE' | 'PL' | 'Other';

export interface Expansion {
  id: string;
  game_id: string;
  title: string;
  bgg_id?: number | null;
  is_owned: boolean;
  created_at?: string;
}

export interface BggExpansion {
  bgg_id: number;
  title: string;
}

export type NewBoardGame = Partial<BoardGame> & {
  bgg_expansions?: BggExpansion[];
};

export type PlayRatingAspect =
  | 'overall' // overall enjoyment, more = better
  | 'pacing' // length / pacing fit, more = better fit
  | 'energy_fit' // energy / mood fit, more = better fit
  | 'interaction' // player interaction, more = more interaction
  | 'teach_effort'; // teach / rules effort, more = harder

/** Optional 1–5 ratings for one play session; separate from the game's BGG rating. */
export type PlayRatings = Partial<Record<PlayRatingAspect, number>>;

export interface PlaySession {
  id: string;
  game_id: string;
  play_date: string;
  player_count: number;
  notes?: string | null;
  ratings?: PlayRatings | null;
  created_at?: string;
}

export interface BoardGame {
  id: string; // Slug identifier (e.g., 'viticulture')
  bgg_id?: number | null;
  title: string;
  year_published?: number | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  image?: string | null;
  thumbnail?: string | null;
  min_players: number;
  max_players: number;
  min_playtime?: number | null;
  max_playtime?: number | null;

  // Rating & Complexity (with optional aliases for BGG compatibility)
  rating?: number | null;
  user_rating?: number | null;
  bgg_rating?: number | null;
  weight?: number | null;
  complexity_weight?: number | null;

  description?: string | null;
  categories?: string[];
  mechanics?: string[];
  status: GameStatus;
  language?: GameLanguage | string | null;

  // Joined relational data
  plays?: PlaySession[];
  expansions?: Expansion[];
  play_count?: number;

  created_at?: string;
  updated_at?: string;
}