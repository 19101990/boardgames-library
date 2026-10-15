export type GameStatus = 'owned' | 'wishlist' | 'for_trade' | 'previously_owned';

export interface BoardGame {
    id: string;
    bgg_id: number;
    title: string;
    year_published?: number;
    thumbnail: string;
    image: string;
    min_players: number;
    max_players: number;
    min_playtime: number;
    max_playtime: number;
    complexity_weight?: number;
    bgg_rating?: number;
    user_rating?: number;
    status: GameStatus;
    categories: string[];
    mechanics: string[];
    play_count: number;
    created_at: string;
}

export interface PlaySession {
    id: string;
    game_id: string;
    game_title: string;
    played_at: string;
    notes?: string;
    created_at: string;
}