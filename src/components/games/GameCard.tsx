'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BoardGame } from '@/types/types';

interface GameCardProps {
  game: BoardGame;
  viewMode: 'grid' | 'list';
}

export function GameCard({ game, viewMode }: GameCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = game.image || (game as unknown as { image?: string }).image;
  const initial = game.title.charAt(0).toUpperCase();

  // Score Badge
  const ratingText = game.bgg_rating ? game.bgg_rating.toFixed(1) : '—';

  // Language Tag deduction
  const language = (game as unknown as { language?: string }).language || 'EN';

  // Category fallback
  const category = game.categories?.[0] || 'Strategy';

  if (viewMode === 'list') {
    return (
      <Link
        href={`/games/${game.id}`}
        className="flex rounded-2xl bg-[#0f1426] border border-[#1d2644] overflow-hidden active:scale-[0.99] transition-transform shadow-lg shadow-black/40"
      >
        {/* Left Visual Banner */}
        <div className="relative w-36 min-h-[140px] bg-[#143b47] flex items-center justify-center shrink-0 overflow-hidden">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={game.title}
              fill
              sizes="150px"
              className="object-cover opacity-90"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-7xl font-black text-[#326978]/60 select-none">
              {initial}
            </span>
          )}

          {/* Rating Badge */}
          <div className="absolute top-2.5 left-2.5 bg-[#ff336d] text-white text-xs font-black px-2 py-0.5 rounded-lg shadow-md">
            {ratingText}
          </div>

          {/* Language Badge */}
          <div className="absolute bottom-2.5 right-2.5 bg-[#0a1020]/80 text-[#8ba2c4] text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 uppercase">
            {language}
          </div>
        </div>

        {/* Right Info Details */}
        <div className="flex-1 p-3.5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug">
              {game.title}
            </h3>
            <p className="text-xs text-[#6e82a3] mt-0.5 font-medium">
              {game.year_published ?? '—'} · {category}
            </p>
          </div>

          <div className="space-y-1 pt-2 text-xs text-[#9bb2d4] font-medium">
            <div className="flex items-center gap-1.5">
              <span>👥</span>
              <span>
                {game.min_players === game.max_players
                  ? game.min_players
                  : `${game.min_players}–${game.max_players}`}
              </span>
            </div>
            {game.min_playtime && (
              <div className="flex items-center gap-1.5">
                <span>⏱</span>
                <span>
                  {game.max_playtime && game.max_playtime !== game.min_playtime
                    ? `${game.min_playtime}–${game.max_playtime} min`
                    : `${game.min_playtime} min`}
                </span>
              </div>
            )}
            {game.complexity_weight != null && (
              <div className="flex items-center gap-1.5 text-[#38e1ff]">
                <span>⚖</span>
                <span>{game.complexity_weight.toFixed(1)} / 5</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Grid Mode (2 Columns)
  return (
    <Link
      href={`/games/${game.id}`}
      className="flex flex-col rounded-2xl bg-[#0f1426] border border-[#1d2644] overflow-hidden active:scale-[0.98] transition-transform shadow-lg shadow-black/40"
    >
      {/* Top Graphic Poster Box */}
      <div className="relative aspect-[4/3] w-full bg-[#143b47] flex items-center justify-center overflow-hidden">
        {imageUrl && !imgError ? (
          <Image
            src={imageUrl}
            alt={game.title}
            fill
            sizes="50vw"
            className="object-cover opacity-90"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-8xl font-black text-[#326978]/60 select-none">
            {initial}
          </span>
        )}

        {/* Rating Badge */}
        <div className="absolute top-2.5 left-2.5 bg-[#ff336d] text-white text-xs font-black px-2 py-0.5 rounded-lg shadow-md">
          {ratingText}
        </div>

        {/* Language Badge */}
        <div className="absolute bottom-2.5 right-2.5 bg-[#0a1020]/80 text-[#8ba2c4] text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 uppercase">
          {language}
        </div>
      </div>

      {/* Lower Details */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug">
            {game.title}
          </h3>
          <p className="text-[11px] text-[#6e82a3] mt-0.5 font-medium">
            {game.year_published ?? '—'} · {category}
          </p>
        </div>

        <div className="space-y-1 text-[11px] text-[#9bb2d4] font-medium border-t border-[#1a223d]/60 pt-2">
          <div className="flex items-center gap-1.5">
            <span>👥</span>
            <span>
              {game.min_players === game.max_players
                ? game.min_players
                : `${game.min_players}–${game.max_players}`}
            </span>
          </div>
          {game.min_playtime && (
            <div className="flex items-center gap-1.5">
              <span>⏱</span>
              <span>
                {game.max_playtime && game.max_playtime !== game.min_playtime
                  ? `${game.min_playtime}–${game.max_playtime} min`
                  : `${game.min_playtime} min`}
              </span>
            </div>
          )}
          {game.complexity_weight != null && (
            <div className="flex items-center gap-1.5 text-[#38e1ff]">
              <span>⚖</span>
              <span>{game.complexity_weight.toFixed(1)} / 5</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}