'use client';

import { useState, useMemo, useEffect } from 'react';
import { INITIAL_GAMES } from '@/data/mockGames';
import { GameCard } from '@/components/games/GameCard';
import { FilterSortSheet } from '@/components/games/FilterSortSheet';
import {
  SunIcon,
  GridIcon,
  ListIcon,
  SearchIcon,
  SlidersIcon,
  BookIcon,
  HeartIcon,
  PlusCircleIcon,
} from '@/components/ui/Icons';

export default function CollectionPage() {
  const [games] = useState(INITIAL_GAMES);
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
        if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
        if (sortBy === 'weight') return (a.weight ?? 0) - (b.weight ?? 0);
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

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} className="min-h-screen">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative">
        
        {/* Top Header */}
        <header className="px-5 pt-7 pb-3">
          <p className="text-xs font-semibold italic text-[#0e8396] dark:text-[#38e1ff] tracking-wide">
            {ownedCount} games owned
          </p>
          <div className="flex items-center justify-between mt-1">
            <h1 className="font-display text-3xl font-black tracking-tight">
              Collection
            </h1>

            {/* Header Right Icon Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={toggleTheme}
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-surface-elevated)',
                  color: 'var(--text-primary)',
                }}
                className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
                title="Toggle Theme"
              >
                <SunIcon size={18} />
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
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
        </header>

        {/* Game List / Grid */}
        <main className="px-5 pt-3 flex-1">
          {filteredGames.length === 0 ? (
            <div className="py-24 text-center text-sm font-semibold text-[#536482]">
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

        {/* Bottom Floating Navigation Bar */}
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
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg'
                  : 'text-[#536482] dark:text-[#8ba2c4] hover:text-white'
              }`}
            >
              <BookIcon size={16} />
              <span>Collection</span>
            </button>

            <button
              onClick={() => setActiveTab('wanted')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'wanted'
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg'
                  : 'text-[#536482] dark:text-[#8ba2c4] hover:text-white'
              }`}
            >
              <HeartIcon size={16} />
              <span>Wanted</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg'
                  : 'text-[#536482] dark:text-[#8ba2c4] hover:text-white'
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