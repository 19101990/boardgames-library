'use client';

import { useState, useMemo } from 'react';
import { INITIAL_GAMES } from '@/data/mockGames';
import { GameCard } from '@/components/games/GameCard';
import { FilterSortSheet } from '@/components/games/FilterSortSheet';

export default function CollectionPage() {
  const [games] = useState(INITIAL_GAMES);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filters State
  const [players, setPlayers] = useState('Any');
  const [playTime, setPlayTime] = useState('Any');
  const [sortBy, setSortBy] = useState('title');
  const [activeTab, setActiveTab] = useState<'collection' | 'wanted' | 'add'>('collection');

  const filteredGames = useMemo(() => {
    return games
      .filter((g) => {
        // Tab filter
        if (activeTab === 'collection' && g.status !== 'owned') return false;
        if (activeTab === 'wanted' && g.status !== 'wishlist') return false;

        // Players filter
        if (players !== 'Any') {
          const num = parseInt(players, 10);
          if (players === '6+') {
            if (g.max_players < 6) return false;
          } else {
            if (g.min_players > num || g.max_players < num) return false;
          }
        }

        // Play time filter
        if (playTime === 'Under 30' && (g.min_playtime ?? 0) >= 30) return false;
        if (playTime === '30–60') {
          const t = g.min_playtime ?? 0;
          if (t < 30 || t > 60) return false;
        }
        if (playTime === '60+' && (g.max_playtime ?? g.min_playtime ?? 0) < 60) return false;

        // Search text
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
        if (sortBy === 'rating') return (b.bgg_rating ?? 0) - (a.bgg_rating ?? 0);
        if (sortBy === 'weight') return (a.complexity_weight ?? 0) - (b.complexity_weight ?? 0);
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
    <div className="min-h-screen bg-[#070913] text-white">
      {/* 430px Mobile Container */}
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative">
        
        {/* Top Header */}
        <header className="px-5 pt-7 pb-3">
          <p className="text-xs font-semibold italic text-[#38e1ff] tracking-wide">
            {ownedCount} games owned
          </p>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-3xl font-black tracking-tight text-white">
              Collection
            </h1>

            {/* Header Right Icon Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                className="w-10 h-10 rounded-2xl bg-[#141b34] border border-[#202a4e] flex items-center justify-center text-[#9bb2d4] active:scale-95 transition-transform"
                title="Theme"
              >
                ☼
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="w-10 h-10 rounded-2xl bg-[#141b34] border border-[#202a4e] flex items-center justify-center text-[#9bb2d4] active:scale-95 transition-transform text-sm"
                title="Toggle View Mode"
              >
                {viewMode === 'grid' ? '☵' : '⊞'}
              </button>
            </div>
          </div>

          {/* Search + Filter Row */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="flex-1 relative flex items-center h-12 bg-[#141a31] border border-[#202a4e] rounded-2xl px-3.5">
              <span className="text-[#62779c] mr-2.5 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Title, mechanic, theme"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-[#62779c] focus:outline-none font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-[#62779c] px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Sheet Trigger */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="w-12 h-12 rounded-2xl bg-[#141b34] border border-[#202a4e] flex items-center justify-center text-[#9bb2d4] active:scale-95 transition-transform"
            >
              ⚙
            </button>
          </div>
        </header>

        {/* Game List / Grid */}
        <main className="px-5 pt-3 flex-1">
          {filteredGames.length === 0 ? (
            <div className="py-24 text-center text-sm font-semibold text-[#62779c]">
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
          <div className="bg-[#0b0f1e]/90 backdrop-blur-xl border border-[#1e2646] p-1.5 rounded-2xl flex items-center justify-between shadow-2xl shadow-black/80">
            <button
              onClick={() => setActiveTab('collection')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'collection'
                  ? 'bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30'
                  : 'text-[#8ba2c4] hover:text-white'
              }`}
            >
              <span>📖</span>
              <span>Collection</span>
            </button>

            <button
              onClick={() => setActiveTab('wanted')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'wanted'
                  ? 'bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30'
                  : 'text-[#8ba2c4] hover:text-white'
              }`}
            >
              <span>♡</span>
              <span>Wanted</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30'
                  : 'text-[#8ba2c4] hover:text-white'
              }`}
            >
              <span>⊕</span>
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
        />
      </div>
    </div>
  );
}