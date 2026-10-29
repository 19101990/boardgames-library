'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GameCard } from '@/components/games/GameCard';
import { AddGameForm } from '@/components/games/AddGameForm';
import { FilterSortSheet } from '@/components/games/FilterSortSheet';
import { MoveToCollectionSheet } from '@/components/games/MoveToCollectionSheet';
import { AuthControl } from '@/components/auth/AuthControl';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';
import { BoardGame } from '@/types/types';
import {
  SunIcon,
  MoonIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  SlidersIcon,
  BookIcon,
  HeartIcon,
  PlusCircleIcon,
} from '@/components/ui/Icons';

export default function CollectionPage() {
  const { user, isLoading: isAuthLoading, errorMessage: authError } = useSupabaseAuth();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Wanted modal state
  const [selectedWantedGame, setSelectedWantedGame] = useState<BoardGame | null>(null);

  // Fetch games from Supabase
  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching games from Supabase:', error);
      setErrorMessage(error.message);
    } else if (data) {
      setGames(data as BoardGame[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Sync theme state on mount
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  // Filters State
  const [players, setPlayers] = useState('Any');
  const [playTime, setPlayTime] = useState('Any');
  const [sortBy, setSortBy] = useState('title');
  const [activeTab, setActiveTab] = useState<'collection' | 'wanted' | 'add'>('collection');

  const filteredGames = useMemo(() => {
    return games
      .filter((g) => {
        if (activeTab === 'collection' && g.status !== 'owned') return false;
        if (activeTab === 'wanted' && g.status !== 'wishlist') return false;

        if (players !== 'Any') {
          const num = parseInt(players, 10);
          if (players === '6+') {
            if (g.max_players < 6) return false;
          } else {
            if (g.min_players > num || g.max_players < num) return false;
          }
        }

        if (playTime === 'Under 30' && (g.min_playtime ?? 0) >= 30) return false;
        if (playTime === '30–60') {
          const t = g.min_playtime ?? 0;
          if (t < 30 || t > 60) return false;
        }
        if (playTime === '60+' && (g.max_playtime ?? g.min_playtime ?? 0) < 60) return false;

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchTitle = g.title.toLowerCase().includes(q);
          const matchCategory = g.categories?.some((c) => c.toLowerCase().includes(q));
          const matchMechanic = g.mechanics?.some((m) => m.toLowerCase().includes(q));
          if (!matchTitle && !matchCategory && !matchMechanic) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'rating') return (b.rating ?? b.bgg_rating ?? 0) - (a.rating ?? a.bgg_rating ?? 0);
        if (sortBy === 'weight') return (a.weight ?? a.complexity_weight ?? 0) - (b.weight ?? b.complexity_weight ?? 0);
        if (sortBy === 'newest') return (b.year_published ?? 0) - (a.year_published ?? 0);
        if (sortBy === 'shortest') return (a.min_playtime ?? 0) - (b.min_playtime ?? 0);
        if (sortBy === 'language') {
          const lA = (a as unknown as { language?: string }).language || 'EN';
          const lB = (b as unknown as { language?: string }).language || 'EN';
          return lA.localeCompare(lB);
        }
        return 0;
      });
  }, [games, activeTab, players, playTime, sortBy, search]);

  const handleReset = () => {
    setPlayers('Any');
    setPlayTime('Any');
    setSortBy('title');
    setSearch('');
  };

  const ownedCount = games.filter((g) => g.status === 'owned').length;
  const wantedCount = games.filter((g) => g.status === 'wishlist').length;

  const handleAddNewGame = async (newGame: Partial<BoardGame>, targetStatus: 'owned' | 'wishlist') => {
    if (!user) {
      alert('Please sign in before adding a game.');
      return;
    }

    // Optimistic UI update
    setGames((prev) => [newGame as BoardGame, ...prev]);
    setActiveTab(targetStatus === 'owned' ? 'collection' : 'wanted');

    // Prepare payload matching the Supabase games table schema
    const payload = {
      id: newGame.id,
      title: newGame.title,
      bgg_id: newGame.bgg_id ?? null,
      year_published: newGame.year_published ?? null,
      image_url: newGame.image_url ?? null,
      thumbnail_url: newGame.thumbnail_url ?? null,
      description: newGame.description ?? null,
      min_players: newGame.min_players ?? 1,
      max_players: newGame.max_players ?? 4,
      min_playtime: newGame.min_playtime ?? 30,
      max_playtime: newGame.max_playtime ?? 60,
      rating: newGame.rating ?? newGame.bgg_rating ?? null,
      weight: newGame.weight ?? newGame.complexity_weight ?? null,
      categories: newGame.categories ?? [],
      mechanics: newGame.mechanics ?? [],
      status: targetStatus,
      language: targetStatus === 'owned' ? (newGame.language ?? 'EN') : null,
    };

    const { error } = await supabase.from('games').insert([payload]);

    if (error) {
      console.error('Error inserting game into Supabase:', error);
      alert(`Could not save "${newGame.title}" to database: ${error.message}`);
      // Revert optimistic update
      setGames((prev) => prev.filter((g) => g.id !== newGame.id));
    }
  };

  const handleMoveToCollection = async (gameId: string, language: string) => {
    if (!user) {
      alert('Please sign in before changing your collection.');
      return;
    }

    const previousGames = [...games];

    // Optimistic UI update
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, status: 'owned', language } : g))
    );
    setActiveTab('collection');

    // Persist to Supabase
    const { error } = await supabase
      .from('games')
      .update({ status: 'owned', language })
      .eq('id', gameId);

    if (error) {
      console.error('Error moving game to collection:', error);
      alert(`Failed to move game: ${error.message}`);
      // Revert on error
      setGames(previousGames);
    }
  };

  const handleRemoveFromWanted = async (gameId: string) => {
    if (!user) {
      alert('Please sign in before removing a game.');
      return;
    }

    const previousGames = [...games];

    // Optimistic UI update
    setGames((prev) => prev.filter((g) => g.id !== gameId));

    // Delete from Supabase
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (error) {
      console.error('Error removing game from wanted:', error);
      alert(`Failed to remove game: ${error.message}`);
      // Revert on error
      setGames(previousGames);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} className="min-h-screen">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative">
        
        {/* Top Header */}
        <header className="px-5 pt-7 pb-3">
          {activeTab === 'add' ? (
            <div>
              <p className="text-xs font-semibold italic text-[#0e8396] dark:text-[#38e1ff] tracking-wide">
                Three quick steps
              </p>
              <div className="flex items-center justify-between mt-1">
                <h1 className="font-display text-3xl font-black tracking-tight">
                  Add a game
                </h1>
                <div className="flex items-center gap-2.5">
                  <AuthControl user={user} isLoading={isAuthLoading} authError={authError} />
                  <button
                    type="button"
                    aria-label="Toggle Theme"
                    onClick={toggleTheme}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
                  >
                    {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold italic text-[#0e8396] dark:text-[#38e1ff] tracking-wide">
                {activeTab === 'wanted' ? `${wantedCount} games wanted` : `${ownedCount} games owned`}
              </p>
              <div className="flex items-center justify-between mt-1">
                <h1 className="font-display text-3xl font-black tracking-tight">
                  {activeTab === 'wanted' ? 'Wanted' : 'Collection'}
                </h1>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2.5">
                  <AuthControl user={user} isLoading={isAuthLoading} authError={authError} />
                  <button
                    onClick={toggleTheme}
                    aria-label="Toggle Theme"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
                    title="Toggle Theme"
                  >
                    {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                  </button>
                  <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    aria-label="Toggle View Mode"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform text-sm"
                    title="Toggle View Mode"
                  >
                    {viewMode === 'grid' ? <ListIcon size={18} /> : <GridIcon size={18} />}
                  </button>
                </div>
              </div>

              {/* Search + Filter Row */}
              <div className="flex items-center gap-2.5 mt-4">
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-surface-elevated)',
                  }}
                  className="flex-1 relative flex items-center h-12 border rounded-2xl px-3.5"
                >
                  <SearchIcon size={16} className="text-[#536482] dark:text-[#62779c] mr-2.5 shrink-0" />
                  <input
                    type="text"
                    placeholder="Title, mechanic, theme"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ color: 'var(--text-primary)' }}
                    className="w-full bg-transparent text-sm placeholder-[#536482] dark:placeholder-[#62779c] focus:outline-none font-medium"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="text-xs text-[#536482] dark:text-[#62779c] px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsFilterOpen(true)}
                  aria-label="Open Filter and Sort Sheet"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-12 h-12 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform shrink-0"
                >
                  <SlidersIcon size={18} />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Content Body */}
        <main className="px-5 pt-3 flex-1">
          {activeTab === 'add' ? (
            user ? (
              <AddGameForm onAddGame={handleAddNewGame} />
            ) : (
              <div className="py-16 text-center space-y-3">
                <p className="text-sm font-bold">Sign in to add games.</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Use the account icon above to sign in.
                </p>
              </div>
            )
          ) : isLoading ? (
            <div className="py-28 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <div className="w-7 h-7 border-2 border-current border-t-transparent rounded-full animate-spin text-[#0e8396] dark:text-[#38e1ff]" />
              <p className="text-xs font-semibold tracking-wide">Loading library...</p>
            </div>
          ) : errorMessage ? (
            <div className="py-20 text-center space-y-2">
              <p className="text-sm font-bold text-[#ff336d]">Failed to load games</p>
              <p className="text-xs text-[var(--text-muted)]">{errorMessage}</p>
              <button
                onClick={fetchGames}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--bg-surface-elevated)] border border-[var(--border-surface-elevated)]"
              >
                Retry
              </button>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="py-24 text-center text-sm font-semibold text-[#536482] dark:text-[#8ba2c4]">
              No games match your filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  viewMode="grid"
                  onCardClick={activeTab === 'wanted' && user ? (g) => setSelectedWantedGame(g) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  viewMode="list"
                  onCardClick={activeTab === 'wanted' && user ? (g) => setSelectedWantedGame(g) : undefined}
                />
              ))}
            </div>
          )}
        </main>

        {/* Floating Bottom Navigation Bar */}
        <nav className="fixed bottom-5 left-0 right-0 z-40 max-w-sm mx-auto px-4">
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-surface)',
            }}
            className="backdrop-blur-xl border p-1.5 rounded-2xl flex items-center justify-between shadow-2xl"
          >
            <button
              onClick={() => setActiveTab('collection')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'collection'
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
                  : 'text-[#536482] dark:text-[#8ba2c4]'
              }`}
            >
              <BookIcon size={16} />
              <span>Collection</span>
            </button>

            <button
              onClick={() => setActiveTab('wanted')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'wanted'
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
                  : 'text-[#536482] dark:text-[#8ba2c4]'
              }`}
            >
              <HeartIcon size={16} />
              <span>Wanted</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              disabled={!user || isAuthLoading}
              title={!user ? 'Sign in to add games' : 'Add a game'}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
                  : 'text-[#536482] dark:text-[#8ba2c4]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <PlusCircleIcon size={16} />
              <span>Add</span>
            </button>
          </div>
        </nav>

        {/* Filter and Sort Modal */}
        <FilterSortSheet
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          players={players}
          setPlayers={setPlayers}
          playTime={playTime}
          setPlayTime={setPlayTime}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onReset={handleReset}
          totalResults={filteredGames.length}
          isDark={isDark}
        />

        {/* Move from Wanted to Collection Sheet Modal */}
        <MoveToCollectionSheet
          game={selectedWantedGame}
          isOpen={!!selectedWantedGame}
          onClose={() => setSelectedWantedGame(null)}
          onMoveToCollection={handleMoveToCollection}
          onRemoveFromWanted={handleRemoveFromWanted}
          canManage={Boolean(user) && !isAuthLoading}
        />
      </div>
    </div>
  );
}