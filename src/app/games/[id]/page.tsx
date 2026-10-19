'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { INITIAL_GAMES } from '@/data/mockGames';
import {
  UsersIcon,
  ClockIcon,
  CalendarIcon,
  DumbbellIcon,
  ArrowLeftIcon,
  DiceIcon,
  ChevronDownIcon,
  RefreshIcon,
  PlusIcon,
  MinusIcon,
  BookIcon,
  HeartIcon,
  PlusCircleIcon,
} from '@/components/ui/Icons';

export default function GameDetailPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const game =
    INITIAL_GAMES.find(
      (g) =>
        g.id === rawId ||
        g.id === rawId?.replace(/^game-/, '') ||
        String(g.bgg_id) === rawId
    ) || INITIAL_GAMES[0];

  const initial = game.title.charAt(0).toUpperCase();

  const [isLoggingPlay, setIsLoggingPlay] = useState(false);
  const [playDate, setPlayDate] = useState('2026-10-19');
  const [playerCount, setPlayerCount] = useState(2);
  const [playNotes, setPlayNotes] = useState('');
  const [playCount, setPlayCount] = useState(game.play_count ?? 0);

  const handleSavePlay = () => {
    setPlayCount((prev) => prev + 1);
    setIsLoggingPlay(false);
    setPlayNotes('');
  };

  const getWeightLabel = (w?: number) => {
    if (!w) return 'Light';
    if (w < 2.0) return 'Light';
    if (w < 3.0) return 'Medium Light';
    if (w < 3.8) return 'Medium Heavy';
    return 'Heavy';
  };

  return (
    <div className="min-h-screen bg-[#070913] text-white">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative">
        
        {/* Top Hero Poster */}
        <div className="relative aspect-[16/10] w-full bg-[#143b47] flex items-center justify-center overflow-hidden">
          <span className="font-display text-9xl font-bold text-[#38e1ff]/40 select-none">
            {initial}
          </span>

          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <ArrowLeftIcon size={18} />
          </button>

          {/* BGG Rating Block */}
          <div className="absolute top-4 right-4 bg-[#ff336d] text-white px-3.5 py-1.5 rounded-2xl flex flex-col items-center shadow-lg">
            <span className="font-display text-2xl font-black leading-none">
              {game.rating ?? game.bgg_rating ? (game.rating ?? game.bgg_rating)?.toFixed(1) : '—'}
            </span>
            <span className="text-[9px] font-bold tracking-wider mt-1 uppercase opacity-95">
              BGG RATING
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6">
          {/* Tags */}
          <div className="flex gap-2 text-xs font-semibold">
            <span className="bg-[#0e2730] text-[#38e1ff] px-2.5 py-1 rounded-lg border border-[#173e4d]">
              {game.categories?.[0] || 'Family'}
            </span>
            <span className="bg-[#12182c] text-[#8ba2c4] px-2.5 py-1 rounded-lg border border-[#1f294a]">
              In collection · {(game as unknown as { language?: string }).language || 'EN'}
            </span>
          </div>

          {/* Title & Headline */}
          <div>
            <h1 className="font-display text-3xl font-black text-white leading-tight">
              {game.title}
            </h1>
            <p className="text-xs text-[#7e94b8] font-medium mt-1.5 italic">
              {game.year_published ?? '—'} · {game.min_players}–{game.max_players} players ·{' '}
              {game.min_playtime}–{game.max_playtime ?? game.min_playtime} min
            </p>
          </div>

          {/* Action Button: Log Play */}
          <button
            onClick={() => setIsLoggingPlay(true)}
            className="w-full h-12 rounded-2xl bg-[#38e1ff] text-black font-display font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#38e1ff]/30 active:scale-[0.98] transition-transform"
          >
            <DiceIcon size={18} />
            <span>Log a play</span>
          </button>

          {/* About Section */}
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-bold text-white">About</h2>
            {/* <p className="text-xs text-[#9bb2d4] leading-relaxed">
              {game.description ||
                'A whodunit in the animal kingdom. Narrow down the culprit by eliminating suspects with cards and clues.'}
            </p> */}
            <button className="text-xs font-bold text-[#38e1ff] hover:underline">
              Read more
            </button>
            <p className="text-[10px] text-[#55698a] pt-1">
              Description from BoardGameGeek
            </p>
          </div>

          {/* 4 Stats Boxes */}
          <div className="grid grid-cols-2 gap-3">
            {/* Players */}
            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <UsersIcon size={18} className="text-[#38e1ff]" />
              <div className="font-display text-2xl font-black text-white mt-1.5">
                {game.min_players}–{game.max_players}
              </div>
              <div className="text-[11px] text-[#6e82a3] font-medium mt-0.5">Players</div>
            </div>

            {/* Play time */}
            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <ClockIcon size={18} className="text-[#38e1ff]" />
              <div className="font-display text-2xl font-black text-white mt-1.5">
                {game.min_playtime}–{game.max_playtime ?? game.min_playtime} min
              </div>
              <div className="text-[11px] text-[#6e82a3] font-medium mt-0.5">Play time</div>
            </div>

            {/* Published */}
            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <CalendarIcon size={18} className="text-[#38e1ff]" />
              <div className="font-display text-2xl font-black text-white mt-1.5">
                {game.year_published ?? '—'}
              </div>
              <div className="text-[11px] text-[#6e82a3] font-medium mt-0.5">Published</div>
            </div>

            {/* Complexity Weight */}
            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <DumbbellIcon size={18} className="text-[#38e1ff]" />
              <div className="font-display text-2xl font-black text-white mt-1.5">
                {(game.weight ?? game.complexity_weight ?? 1.2).toFixed(1)}{' '}
                <span className="text-xs font-normal text-[#6e82a3]">/ 5</span>
              </div>
              <div className="text-[11px] text-[#6e82a3] font-medium mt-0.5">
                {getWeightLabel(game.weight ?? game.complexity_weight)}
              </div>
              <div className="w-full bg-[#1b2545] h-1 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-[#38e1ff] h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (((game.weight ?? game.complexity_weight ?? 1.2) / 5) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Mechanics */}
          <div>
            <h3 className="font-display text-base font-bold text-white mb-2.5">
              Mechanics
            </h3>
            <div className="flex flex-wrap gap-2">
              {(game.mechanics || ['Deduction', 'Hand Management']).map((m) => (
                <span
                  key={m}
                  className="bg-[#0f2933] text-[#38e1ff] text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#184657]"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Themes */}
          <div>
            <h3 className="font-display text-base font-bold text-white mb-2.5">
              Themes
            </h3>
            <div className="flex flex-wrap gap-2">
              {['Animals', 'Mystery'].map((t) => (
                <span
                  key={t}
                  className="bg-[#2a1122] text-[#ff3388] text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#4d1f3d]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Expansions */}
          <div className="flex items-center justify-between border-t border-[#1a223d] pt-4">
            <div>
              <h3 className="font-display text-base font-bold text-white">Expansions</h3>
              <p className="text-xs text-[#6e82a3] mt-0.5">None listed</p>
            </div>
            <ChevronDownIcon size={20} className="text-[#6e82a3]" />
          </div>

          {/* Plays Section */}
          <div className="border-t border-[#1a223d] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-white">Plays</h3>
                <p className="text-xs text-[#6e82a3] mt-0.5">
                  {playCount > 0 ? `${playCount} logged` : 'Nothing logged'}
                </p>
              </div>
              <button
                onClick={() => setIsLoggingPlay(true)}
                className="h-8 px-3.5 rounded-xl bg-[#141b34] border border-[#202a4e] text-xs font-bold text-white flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <PlusIcon size={13} />
                <span>Log</span>
              </button>
            </div>

            {/* In-Card Play Logging Form */}
            {isLoggingPlay && (
              <div className="p-4 rounded-2xl bg-[#0f1426] border border-[#212c52] space-y-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-[#8ba2c4] mb-1 block">
                    Date
                  </label>
                  <input
                    type="date"
                    value={playDate}
                    onChange={(e) => setPlayDate(e.target.value)}
                    className="w-full bg-[#171e38] border border-[#243159] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#8ba2c4]">
                    Players
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                      className="w-8 h-8 rounded-xl bg-[#1b2342] text-white flex items-center justify-center font-bold active:scale-95"
                    >
                      <MinusIcon size={14} />
                    </button>
                    <span className="font-display text-lg font-bold">{playerCount}</span>
                    <button
                      onClick={() => setPlayerCount(playerCount + 1)}
                      className="w-8 h-8 rounded-xl bg-[#1b2342] text-white flex items-center justify-center font-bold active:scale-95"
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#8ba2c4] mb-1 block">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Who won, house rules, scores..."
                    value={playNotes}
                    onChange={(e) => setPlayNotes(e.target.value)}
                    className="w-full bg-[#171e38] border border-[#243159] rounded-xl p-2.5 text-xs text-white placeholder-[#55698a] focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setIsLoggingPlay(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#8ba2c4] bg-[#141a31] border border-[#212c52]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePlay}
                    className="flex-1 py-2.5 rounded-xl bg-[#38e1ff] text-black text-xs font-bold shadow-md shadow-[#38e1ff]/30 active:scale-95 transition-transform"
                  >
                    Save play
                  </button>
                </div>
              </div>
            )}

            {playCount === 0 && !isLoggingPlay && (
              <p className="text-xs italic text-[#55698a]">No plays logged yet.</p>
            )}
          </div>

          {/* Footer Management Actions */}
          <div className="pt-2 space-y-3">
            <button className="w-full h-11 rounded-2xl bg-[#0f1426] border border-[#1d2644] text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-98 transition-transform">
              <RefreshIcon size={15} />
              <span>Refresh from BGG</span>
            </button>
            <button className="w-full text-center text-xs font-bold text-[#ff336d] py-2 hover:underline">
              Remove game
            </button>
          </div>
        </div>

        {/* Floating Bottom Navigation */}
        <nav className="fixed bottom-5 left-0 right-0 z-40 max-w-sm mx-auto px-4">
          <div className="bg-[#0b0f1e]/90 backdrop-blur-xl border border-[#1e2646] p-1.5 rounded-2xl flex items-center justify-between shadow-2xl">
            <Link
              href="/"
              className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30"
            >
              <BookIcon size={16} />
              <span>Collection</span>
            </Link>
            <button className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#8ba2c4]">
              <HeartIcon size={16} />
              <span>Wanted</span>
            </button>
            <button className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#8ba2c4]">
              <PlusCircleIcon size={16} />
              <span>Add</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}