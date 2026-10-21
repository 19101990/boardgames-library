'use client';

import { useState, useMemo, useEffect } from 'react';
import { INITIAL_GAMES } from '@/data/mockGames';
import { GameCard } from '@/components/games/GameCard';
import { AddGameForm } from '@/components/games/AddGameForm';
import { FilterSortSheet } from '@/components/games/FilterSortSheet';
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
  const [games, setGames] = useState<BoardGame[]>(INITIAL_GAMES);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

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
        if (sortBy === 'rating') return (b.bgg_rating ?? b.bgg_rating ?? 0) - (a.bgg_rating ?? a.bgg_rating ?? 0);
        if (sortBy === 'weight') return (a.complexity_weight ?? a.complexity_weight ?? 0) - (b.complexity_weight ?? b.complexity_weight ?? 0);
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

  const handleAddNewGame = (newGame: Partial<BoardGame>, targetStatus: 'owned' | 'wishlist') => {
    setGames((prev) => [newGame as BoardGame, ...prev]);
    setActiveTab(targetStatus === 'owned' ? 'collection' : 'wanted');
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
                <button
                  onClick={toggleTheme}
                  aria-label="Toggle Theme"
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
          ) : (
            <div>
              <p className="text-xs font-semibold italic text-[#0e8396] dark:text-[#38e1ff] tracking-wide">
                {activeTab === 'wanted' ? `${wantedCount} games wanted` : `${ownedCount} games owned`}
              </p>
              <div className="flex items-center justify-between mt-1">
                <h1 className="font-display text-3xl font-black tracking-tight">
                  {activeTab === 'wanted' ? 'Wanted' : 'Collection'}
                </h1>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2.5">
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

                {/* Filter Sheet Trigger */}
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
            <AddGameForm onAddGame={handleAddNewGame} />
          ) : filteredGames.length === 0 ? (
            <div className="py-24 text-center text-sm font-semibold text-[#536482] dark:text-[#8ba2c4]">
              No games match your filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} viewMode="grid" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} viewMode="list" />
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
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
                  : 'text-[#536482] dark:text-[#8ba2c4]'
              }`}
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
      </div>
    </div>
  );
}