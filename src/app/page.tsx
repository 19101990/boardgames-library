'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GameCard } from '@/components/games/GameCard';
import { AddGameForm } from '@/components/games/AddGameForm';
import { FilterSortSheet } from '@/components/games/FilterSortSheet';
import { AuthControl } from '@/components/auth/AuthControl';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';
import {
  cacheGame,
  cacheGameDetails,
  cacheGames,
  getCachedGames,
  isNetworkError,
} from '@/lib/offlineGameStore';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { BoardGame, Expansion, NewBoardGame } from '@/types/types';
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
  RefreshIcon,
} from '@/components/ui/Icons';

export default function CollectionPage() {
  const { user, isLoading: isAuthLoading, errorMessage: authError } = useSupabaseAuth();
  const { isOnline, setIsOnline } = useOnlineStatus();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isRefreshingBgg, setIsRefreshingBgg] = useState(false);
  const [bggRefreshProgress, setBggRefreshProgress] = useState<string | null>(null);

  // Fetch games from Supabase
  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!navigator.onLine) {
      setIsOnline(false);
      try {
        const cachedGames = await getCachedGames();
        setGames(cachedGames);
        if (cachedGames.length === 0) {
          setErrorMessage('No saved library is available offline yet. Connect to load it.');
        }
      } catch (error) {
        console.error('Could not load the saved library:', error);
        setErrorMessage('Could not read the saved library on this device.');
      }
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('title', { ascending: true });

      if (error) {
        console.error('Error fetching games from Supabase:', error);
        if (isNetworkError(error)) {
          setIsOnline(false);
          const cachedGames = await getCachedGames();
          setGames(cachedGames);
          setErrorMessage(
            cachedGames.length === 0
              ? 'No saved library is available offline yet. Connect to load it.'
              : null
          );
        } else {
          setErrorMessage(error.message);
        }
      } else if (data) {
        const fetchedGames = data as BoardGame[];
        setGames(fetchedGames);
        setIsOnline(true);
        void cacheGames(fetchedGames).catch((cacheError: unknown) => {
          console.error('Could not save the library for offline use:', cacheError);
        });
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
      if (isNetworkError(error)) {
        setIsOnline(false);
        try {
          const cachedGames = await getCachedGames();
          setGames(cachedGames);
          setErrorMessage(
            cachedGames.length === 0
              ? 'No saved library is available offline yet. Connect to load it.'
              : null
          );
        } catch (cacheError) {
          console.error('Could not load the saved library:', cacheError);
          setErrorMessage('Could not read the saved library on this device.');
        }
      } else {
        setErrorMessage('Could not load the library. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setIsOnline]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames, isOnline]);

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
  const [sortBy, setSortBy] = useState('rating');
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
    setSortBy('rating');
    setSearch('');
  };

  const handleRefreshBgg = async () => {
    if (!user || !isOnline || !navigator.onLine || isRefreshingBgg) return;

    const linkedGames = games.filter((game) => game.bgg_id);
    const skippedCount = games.length - linkedGames.length;
    if (linkedGames.length === 0) {
      setBggRefreshProgress('No games are linked to BoardGameGeek.');
      return;
    }

    setIsRefreshingBgg(true);
    let updatedCount = 0;
    let failedCount = 0;
    let addedExpansionCount = 0;
    setBggRefreshProgress(`Refreshing 0 of ${linkedGames.length} BGG games...`);

    for (const [index, game] of linkedGames.entries()) {
      setBggRefreshProgress(`Refreshing ${index + 1} of ${linkedGames.length}: ${game.title}`);

      try {
        const response = await fetch(`/api/bgg?id=${game.bgg_id}`);
        const metadata: {
          title: string;
          year_published: number | null;
          min_players: number;
          max_players: number;
          min_playtime: number | null;
          max_playtime: number | null;
          bgg_rating: number | null;
          complexity_weight: number | null;
          description: string | null;
          image_url: string | null;
          thumbnail_url: string | null;
          categories: string[];
          mechanics: string[];
          expansions: { bgg_id: number; title: string }[];
          error?: string;
        } = await response.json();
        if (!response.ok) throw new Error(metadata.error ?? 'Could not load BGG game data.');

        const updatePayload = {
          title: metadata.title,
          year_published: metadata.year_published,
          min_players: metadata.min_players,
          max_players: metadata.max_players,
          min_playtime: metadata.min_playtime,
          max_playtime: metadata.max_playtime,
          rating: metadata.bgg_rating,
          weight: metadata.complexity_weight,
          description: metadata.description,
          image_url: metadata.image_url,
          thumbnail_url: metadata.thumbnail_url,
          categories: metadata.categories,
          mechanics: metadata.mechanics,
        };
        const { error } = await supabase.from('games').update(updatePayload).eq('id', game.id);
        if (error) throw new Error(error.message);

        const updatedGame = { ...game, ...updatePayload };
        setGames((previousGames) =>
          previousGames.map((previousGame) =>
            previousGame.id === game.id ? updatedGame : previousGame
          )
        );
        void cacheGame(updatedGame).catch((cacheError: unknown) => {
          console.error(`Could not cache refreshed game "${game.title}":`, cacheError);
        });
        updatedCount += 1;

        const { data: existingExpansions, error: existingError } = await supabase
          .from('expansions')
          .select('title')
          .eq('game_id', game.id);
        if (existingError) throw new Error(`Game updated, but expansions could not be checked: ${existingError.message}`);

        const existingTitles = new Set(
          (existingExpansions ?? []).map((expansion) => expansion.title.trim().toLowerCase())
        );
        const newExpansions = metadata.expansions.filter(
          (expansion) => !existingTitles.has(expansion.title.trim().toLowerCase())
        );
        if (newExpansions.length > 0) {
          const { error: expansionError } = await supabase.from('expansions').insert(
            newExpansions.map((expansion) => ({
              game_id: game.id,
              title: expansion.title,
              is_owned: false,
            }))
          );
          if (expansionError) throw new Error(`Game updated, but expansions could not be saved: ${expansionError.message}`);
          addedExpansionCount += newExpansions.length;
        }
      } catch (error) {
        failedCount += 1;
        console.error(`Could not refresh BGG data for "${game.title}":`, error);
      }

      if (index < linkedGames.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }

    setBggRefreshProgress(
      `Refresh complete: ${updatedCount} updated, ${failedCount} failed, ${addedExpansionCount} new expansions added, ${skippedCount} without a BGG ID skipped.`
    );
    setIsRefreshingBgg(false);
  };

  const ownedCount = games.filter((g) => g.status === 'owned').length;
  const wantedCount = games.filter((g) => g.status === 'wishlist').length;

  const handleAddNewGame = async (newGame: NewBoardGame, targetStatus: 'owned' | 'wishlist') => {
    if (!isOnline || !navigator.onLine) {
      alert('Connect to the internet before changing your library.');
      return;
    }
    if (!user) {
      alert('Please sign in before adding a game.');
      return;
    }

    // Optimistic UI update
    const optimisticGame = newGame as BoardGame;
    setGames((prev) => [optimisticGame, ...prev]);
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
      setGames((prev) => prev.filter((game) => game !== optimisticGame));
    } else {
      void cacheGame(payload as BoardGame).catch((cacheError: unknown) => {
        console.error('Could not save the new game for offline use:', cacheError);
      });

      if (newGame.bgg_expansions?.length) {
        const expansionRows = newGame.bgg_expansions.map((expansion) => ({
          game_id: newGame.id,
          title: expansion.title,
          is_owned: false,
        }));
        const { data: savedExpansions, error: expansionError } = await supabase
          .from('expansions')
          .insert(expansionRows)
          .select('*');

        if (expansionError) {
          console.error('Error inserting BGG expansions into Supabase:', expansionError);
          alert(`Game saved, but its expansions could not be saved: ${expansionError.message}`);
        } else {
          void cacheGameDetails(
            payload as BoardGame,
            (savedExpansions ?? []) as Expansion[],
            [],
          ).catch((cacheError: unknown) => {
            console.error('Could not save the new game expansions for offline use:', cacheError);
          });
        }
      }
    }
  };

  const renderNavigation = (isDesktop: boolean) => (
    <nav
      aria-label="Main navigation"
      className={isDesktop ? 'shrink-0' : 'fixed bottom-5 left-0 right-0 z-40 max-w-sm mx-auto px-4 md:hidden'}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-surface)',
        }}
        className="backdrop-blur-xl border p-1.5 rounded-2xl flex items-center justify-between shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setActiveTab('collection')}
          className={`${isDesktop ? '' : 'flex-1'} py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
            activeTab === 'collection'
              ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
              : 'text-[#536482] dark:text-[#8ba2c4]'
          }`}
        >
          <BookIcon size={16} />
          <span>Collection</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wanted')}
          className={`${isDesktop ? '' : 'flex-1'} py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
            activeTab === 'wanted'
              ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
              : 'text-[#536482] dark:text-[#8ba2c4]'
          }`}
        >
          <HeartIcon size={16} />
          <span>Wanted</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('add')}
          disabled={!user || isAuthLoading || !isOnline}
          title={!isOnline ? 'Connect to add games' : !user ? 'Sign in to add games' : 'Add a game'}
          className={`${isDesktop ? '' : 'flex-1'} py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
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
  );

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} className="min-h-screen">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative md:max-w-[1600px] md:pb-10">
        
        {/* Top Header */}
        <header className="px-5 pt-7 pb-3 md:px-8 md:pt-8 md:pb-5">
          {activeTab === 'add' ? (
            <div className="md:hidden">
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
            <div className="md:hidden">
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
                  {user && (
                    <button
                      type="button"
                      onClick={handleRefreshBgg}
                      disabled={!isOnline || isRefreshingBgg}
                      aria-label="Refresh all games from BoardGameGeek"
                      title="Refresh all games from BoardGameGeek"
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-surface-elevated)',
                        color: 'var(--text-primary)',
                      }}
                      className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <RefreshIcon size={18} className={isRefreshingBgg ? 'animate-spin' : ''} />
                    </button>
                  )}
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
                  className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform shrink-0"
                >
                  <SlidersIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  aria-label="Toggle View Mode"
                  title="Toggle View Mode"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform text-sm shrink-0"
                >
                  {viewMode === 'grid' ? <ListIcon size={18} /> : <GridIcon size={18} />}
                </button>
              </div>
            </div>
          )}

          <div className="hidden flex-col gap-4 md:flex">
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-[190px] shrink-0">
                <p className="text-xs font-semibold italic text-[#0e8396] dark:text-[#38e1ff] tracking-wide">
                  {activeTab === 'add'
                    ? 'Three quick steps'
                    : activeTab === 'wanted'
                      ? `${wantedCount} games wanted`
                      : `${ownedCount} games owned`}
                </p>
                <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
                  {activeTab === 'add' ? 'Add a game' : activeTab === 'wanted' ? 'Wanted' : 'Collection'}
                </h1>
              </div>
              {renderNavigation(true)}
            </div>

            <div className="flex items-center justify-between gap-4">
              {activeTab !== 'add' ? (
                <div className="flex min-w-0 max-w-[640px] flex-1 items-center gap-2.5">
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                    }}
                    className="flex h-12 min-w-0 flex-1 items-center rounded-2xl border px-3.5"
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
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch('')}
                        className="text-xs text-[#536482] dark:text-[#62779c] px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(true)}
                    aria-label="Open Filter and Sort Sheet"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-10 h-10 shrink-0 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <SlidersIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    aria-label="Toggle View Mode"
                    title="Toggle View Mode"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-10 h-10 shrink-0 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform text-sm"
                  >
                    {viewMode === 'grid' ? <ListIcon size={18} /> : <GridIcon size={18} />}
                  </button>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              <div className="flex shrink-0 items-center gap-2.5">
                <AuthControl user={user} isLoading={isAuthLoading} authError={authError} />
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Toggle Theme"
                  title="Toggle Theme"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-surface-elevated)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
                >
                  {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                </button>
                {activeTab !== 'add' && user && (
                  <button
                    type="button"
                    onClick={handleRefreshBgg}
                    disabled={!isOnline || isRefreshingBgg}
                    aria-label="Refresh all games from BoardGameGeek"
                    title="Refresh all games from BoardGameGeek"
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                    className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <RefreshIcon size={18} className={isRefreshingBgg ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {bggRefreshProgress && activeTab !== 'add' && (
            <p className="mt-3 text-xs text-[var(--text-muted)]" role="status" aria-live="polite">
              {bggRefreshProgress}
            </p>
          )}
        </header>

        {/* Content Body */}
        <main className="px-5 pt-3 flex-1 md:px-8 md:pt-5">
          {!isOnline && activeTab !== 'add' && (
            <p className="mb-3 rounded-xl border border-[var(--border-surface)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
              Offline — showing the saved library. Changes are unavailable.
            </p>
          )}
          {activeTab === 'add' ? (
            !isOnline ? (
              <div className="py-16 text-center space-y-3">
                <p className="text-sm font-bold">You’re offline.</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Connect to the internet to add games.
                </p>
              </div>
            ) : user ? (
              <div className="mx-auto w-full max-w-6xl">
                <AddGameForm onAddGame={handleAddNewGame} />
              </div>
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
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </main>

        {/* Floating Bottom Navigation Bar */}
        {renderNavigation(false)}

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

      </div>
    </div>
  );
}