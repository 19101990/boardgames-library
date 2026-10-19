'use client';

interface FilterSortSheetProps {
  isOpen: boolean;
  onClose: () => void;
  players: string;
  setPlayers: (val: string) => void;
  playTime: string;
  setPlayTime: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  onReset: () => void;
  totalResults: number;
}

export function FilterSortSheet({
  isOpen,
  onClose,
  players,
  setPlayers,
  playTime,
  setPlayTime,
  sortBy,
  setSortBy,
  onReset,
  totalResults,
}: FilterSortSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      {/* Tap backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-up Container */}
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-[#090c19] border-t border-[#1e2646] p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Grab Handle */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#27325c]" />

        {/* Title Bar */}
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-xl font-black tracking-tight text-white">Filter & sort</h2>
          <button
            onClick={onReset}
            className="text-xs font-bold text-[#38e1ff] hover:underline"
          >
            Reset
          </button>
        </div>

        <div className="space-y-5">
          {/* Players */}
          <div>
            <label className="text-xs font-semibold text-[#8ba2c4] mb-2 block">
              Players
            </label>
            <div className="flex flex-wrap gap-2">
              {['Any', '1', '2', '3', '4', '5', '6+'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPlayers(opt)}
                  className={`h-9 min-w-[42px] px-3 rounded-xl text-xs font-bold transition-colors ${
                    players === opt
                      ? 'bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30'
                      : 'bg-[#151c36] text-[#8ba2c4] border border-[#212c54]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Play time */}
          <div>
            <label className="text-xs font-semibold text-[#8ba2c4] mb-2 block">
              Play time
            </label>
            <div className="flex flex-wrap gap-2">
              {['Any', 'Under 30', '30–60', '60+'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPlayTime(opt)}
                  className={`h-9 px-4 rounded-xl text-xs font-bold transition-colors ${
                    playTime === opt
                      ? 'bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30'
                      : 'bg-[#151c36] text-[#8ba2c4] border border-[#212c54]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Sort by */}
          <div>
            <label className="text-xs font-semibold text-[#8ba2c4] mb-2 block">
              Sort by
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'title', label: 'A–Z' },
                { id: 'rating', label: 'Top rated' },
                { id: 'weight', label: 'Lightest' },
                { id: 'newest', label: 'Newest' },
                { id: 'shortest', label: 'Shortest' },
                { id: 'language', label: 'Language' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-colors ${
                    sortBy === opt.id
                      ? 'bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30'
                      : 'bg-[#151c36] text-[#8ba2c4] border border-[#212c54]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action CTA Button */}
          <button
            onClick={onClose}
            className="w-full mt-2 h-12 rounded-2xl bg-[#38e1ff] text-black font-black text-sm tracking-wide shadow-lg shadow-[#38e1ff]/30 active:scale-[0.98] transition-transform"
          >
            Show {totalResults} games
          </button>
        </div>
      </div>
    </div>
  );
}