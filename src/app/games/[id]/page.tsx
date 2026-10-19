'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { INITIAL_GAMES } from '@/data/mockGames';
import Link from 'next/link';

export default function GameDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const game = INITIAL_GAMES.find((g) => g.id === id) || INITIAL_GAMES[0];
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

  return (
    <div className="min-h-screen bg-[#070913] text-white">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative">
        
        {/* Top Hero Poster */}
        <div className="relative aspect-[16/10] w-full bg-[#143b47] flex items-center justify-center overflow-hidden">
          <span className="text-9xl font-black text-[#326978]/60 select-none">
            {initial}
          </span>

          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white text-base active:scale-95"
          >
            ←
          </button>

          {/* BGG Rating Block */}
          <div className="absolute top-4 right-4 bg-[#ff336d] text-white px-3 py-1 rounded-xl flex flex-col items-center shadow-lg">
            <span className="text-lg font-black leading-none">
              {game.bgg_rating ? game.bgg_rating.toFixed(1) : '—'}
            </span>
            <span className="text-[9px] font-bold tracking-wider mt-0.5 uppercase opacity-90">
              BGG RATING
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6">
          {/* Tags */}
          <div className="flex gap-2 text-xs font-bold">
            <span className="bg-[#0e2730] text-[#38e1ff] px-2.5 py-1 rounded-lg border border-[#173e4d]">
              {game.categories?.[0] || 'Family'}
            </span>
            <span className="bg-[#12182c] text-[#8ba2c4] px-2.5 py-1 rounded-lg border border-[#1f294a]">
              In collection · EN
            </span>
          </div>

          {/* Title & Headline */}
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">
              {game.title}
            </h1>
            <p className="text-xs text-[#7e94b8] font-semibold mt-1">
              {game.year_published ?? '—'} · {game.min_players}–{game.max_players} players ·{' '}
              {game.min_playtime}–{game.max_playtime ?? game.min_playtime} min
            </p>
          </div>

          {/* Action Button: Log Play */}
          <button
            onClick={() => setIsLoggingPlay(true)}
            className="w-full h-12 rounded-2xl bg-[#38e1ff] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#38e1ff]/30 active:scale-[0.98] transition-transform"
          >
            <span>🎲</span>
            <span>Log a play</span>
          </button>

          {/* About Section */}
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white">About</h2>
            {/* <p className="text-xs text-[#9bb2d4] leading-relaxed">
              {game.description ||
                'A whodunit in the board game world. Gather your companions and test your wits with cards, mechanics, and clues.'}
            </p> */}
            <button className="text-xs font-bold text-[#38e1ff]">Read more</button>
            <p className="text-[10px] text-[#55698a] pt-1">
              Description from BoardGameGeek
            </p>
          </div>

          {/* 4 Stats Boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <span className="text-sm">👥</span>
              <div className="text-lg font-black text-white mt-1">
                {game.min_players}–{game.max_players}
              </div>
              <div className="text-[10px] text-[#6e82a3] font-bold">Players</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <span className="text-sm">⏱</span>
              <div className="text-lg font-black text-white mt-1">
                {game.min_playtime}–{game.max_playtime ?? game.min_playtime} min
              </div>
              <div className="text-[10px] text-[#6e82a3] font-bold">Play time</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <span className="text-sm">📅</span>
              <div className="text-lg font-black text-white mt-1">
                {game.year_published ?? '—'}
              </div>
              <div className="text-[10px] text-[#6e82a3] font-bold">Published</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0f1426] border border-[#1d2644]">
              <span className="text-sm">⚖</span>
              <div className="text-lg font-black text-white mt-1">
                {game.complexity_weight?.toFixed(1) ?? '1.2'} <span className="text-xs font-normal text-[#6e82a3]">/ 5</span>
              </div>
              <div className="text-[10px] text-[#6e82a3] font-bold">Light</div>
              <div className="w-full bg-[#1b2545] h-1 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#38e1ff] h-full"
                  style={{ width: `${((game.complexity_weight ?? 1.2) / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Mechanics */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2">Mechanics</h3>
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
            <h3 className="text-sm font-bold text-white mb-2">Themes</h3>
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
              <h3 className="text-sm font-bold text-white">Expansions</h3>
              <p className="text-xs text-[#6e82a3]">None listed</p>
            </div>
            <span className="text-[#6e82a3]">⌄</span>
          </div>

          {/* Plays Section */}
          <div className="border-t border-[#1a223d] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Plays</h3>
                <p className="text-xs text-[#6e82a3]">
                  {playCount > 0 ? `${playCount} logged` : 'Nothing logged'}
                </p>
              </div>
              <button
                onClick={() => setIsLoggingPlay(true)}
                className="h-8 px-3 rounded-xl bg-[#141b34] border border-[#202a4e] text-xs font-bold text-white flex items-center gap-1 active:scale-95"
              >
                + Log
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
                      className="w-7 h-7 rounded-full bg-[#1b2342] text-white flex items-center justify-center font-bold"
                    >
                      –
                    </button>
                    <span className="text-sm font-bold">{playerCount}</span>
                    <button
                      onClick={() => setPlayerCount(playerCount + 1)}
                      className="w-7 h-7 rounded-full bg-[#1b2342] text-white flex items-center justify-center font-bold"
                    >
                      +
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
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-[#8ba2c4]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePlay}
                    className="flex-1 py-2 rounded-xl bg-[#38e1ff] text-black text-xs font-bold shadow-md shadow-[#38e1ff]/30"
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
          <div className="pt-4 space-y-4">
            <button className="w-full h-11 rounded-2xl bg-[#0f1426] border border-[#1d2644] text-xs font-bold text-white flex items-center justify-center gap-2">
              <span>↻</span>
              <span>Refresh from BGG</span>
            </button>
            <button className="w-full text-center text-xs font-bold text-[#ff336d]">
              Remove game
            </button>
          </div>
        </div>

        {/* Floating Bottom Nav */}
        <nav className="fixed bottom-5 left-0 right-0 z-40 max-w-sm mx-auto px-4">
          <div className="bg-[#0b0f1e]/90 backdrop-blur-xl border border-[#1e2646] p-1.5 rounded-2xl flex items-center justify-between shadow-2xl">
            <Link
              href="/"
              className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold bg-[#38e1ff] text-black shadow-lg shadow-[#38e1ff]/30"
            >
              <span>📖</span>
              <span>Collection</span>
            </Link>
            <button className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#8ba2c4]">
              <span>♡</span>
              <span>Wanted</span>
            </button>
            <button className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#8ba2c4]">
              <span>⊕</span>
              <span>Add</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}