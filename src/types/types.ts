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

export interface PlaySession {
  id: string;
  game_id: string;
  play_date: string;
  player_count: number;
  notes?: string | null;
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