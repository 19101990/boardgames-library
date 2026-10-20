'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BoardGame } from '@/types/types';
import { UsersIcon, ClockIcon, DumbbellIcon } from '@/components/ui/Icons';

interface GameCardProps {
  game: BoardGame;
  viewMode: 'grid' | 'list';
}

export function GameCard({ game, viewMode }: GameCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = game.image || (game as unknown as { image?: string }).image;
  const initial = game.title.charAt(0).toUpperCase();

  const ratingText = game.bgg_rating ?? game.bgg_rating ? (game.bgg_rating ?? game.bgg_rating)?.toFixed(1) : '—';
  const language = (game as unknown as { language?: string }).language || 'EN';
  const category = game.categories?.[0] || 'Family';

  if (viewMode === 'list') {
    return (
      <Link
        href={`/games/${game.id}`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-surface)',
        }}
        className="flex rounded-2xl border overflow-hidden active:scale-[0.99] transition-all shadow-md shadow-black/5 dark:shadow-black/40"
      >
        {/* Left Visual Banner */}
        <div
          style={{ backgroundColor: 'var(--bg-hero)' }}
          className="relative w-36 min-h-[140px] flex items-center justify-center shrink-0 overflow-hidden"
        >
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
            <span
              style={{ color: 'var(--watermark)' }}
              className="font-display text-7xl font-bold select-none"
            >
              {initial}
            </span>
          )}

          {/* Rating Badge */}
          <div className="absolute top-2.5 left-2.5 bg-[#ff336d] text-white font-display text-xs font-bold px-2 py-0.5 rounded-lg shadow-md">
            {ratingText}
          </div>

          {/* Language Badge */}
          <div className="absolute bottom-2.5 right-2.5 bg-black/75 dark:bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 uppercase">
            {language}
          </div>
        </div>

        {/* Right Info Details */}
        <div className="flex-1 p-3.5 flex flex-col justify-between">
          <div>
            <h3
              style={{ color: 'var(--text-primary)' }}
              className="font-display text-sm font-bold line-clamp-2 leading-snug"
            >
              {game.title}
            </h3>
            <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-0.5 font-medium">
              {game.year_published ?? '—'} · {category}
            </p>
          </div>

          <div style={{ color: 'var(--text-muted)' }} className="space-y-1 pt-2 text-xs font-medium">
            <div className="flex items-center gap-2">
              <UsersIcon className="text-[#0e8396] dark:text-[#38e1ff] shrink-0" size={13} />
              <span>
                {game.min_players === game.max_players
                  ? game.min_players
                  : `${game.min_players}–${game.max_players}`}
              </span>
            </div>
            {game.min_playtime && (
              <div className="flex items-center gap-2">
                <ClockIcon className="text-[#0e8396] dark:text-[#38e1ff] shrink-0" size={13} />
                <span>
                  {game.max_playtime && game.max_playtime !== game.min_playtime
                    ? `${game.min_playtime}–${game.max_playtime} min`
                    : `${game.min_playtime} min`}
                </span>
              </div>
            )}
            {game.complexity_weight != null && (
              <div className="flex items-center gap-2 text-[#0e8396] dark:text-[#38e1ff]">
                <DumbbellIcon className="shrink-0" size={13} />
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
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-surface)',
      }}
      className="flex flex-col rounded-2xl border overflow-hidden active:scale-[0.98] transition-all shadow-md shadow-black/5 dark:shadow-black/40"
    >
      {/* Top Banner Box */}
      <div
        style={{ backgroundColor: 'var(--bg-hero)' }}
        className="relative aspect-[4/3] w-full flex items-center justify-center overflow-hidden"
      >
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
          <span
            style={{ color: 'var(--watermark)' }}
            className="font-display text-8xl font-bold select-none"
          >
            {initial}
          </span>
        )}

        {/* Rating Badge */}
        <div className="absolute top-2.5 left-2.5 bg-[#ff336d] text-white font-display text-xs font-bold px-2 py-0.5 rounded-lg shadow-md">
          {ratingText}
        </div>

        {/* Language Badge */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/75 dark:bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 uppercase">
          {language}
        </div>
      </div>

      {/* Lower Details */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <h3
            style={{ color: 'var(--text-primary)' }}
            className="font-display text-xs font-bold line-clamp-2 leading-snug"
          >
            {game.title}
          </h3>
          <p style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5 font-medium">
            {game.year_published ?? '—'} · {category}
          </p>
        </div>

        <div
          style={{ borderColor: 'var(--border-surface)', color: 'var(--text-muted)' }}
          className="space-y-1 text-[11px] font-medium border-t pt-2"
        >
          <div className="flex items-center gap-1.5">
            <UsersIcon className="text-[#0e8396] dark:text-[#38e1ff] shrink-0" size={12} />
            <span>
              {game.min_players === game.max_players
                ? game.min_players
                : `${game.min_players}–${game.max_players}`}
            </span>
          </div>
          {game.min_playtime && (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="text-[#0e8396] dark:text-[#38e1ff] shrink-0" size={12} />
              <span>
                {game.max_playtime && game.max_playtime !== game.min_playtime
                  ? `${game.min_playtime}–${game.max_playtime} min`
                  : `${game.min_playtime} min`}
              </span>
            </div>
          )}
          {game.complexity_weight != null && (
            <div className="flex items-center gap-1.5 text-[#0e8396] dark:text-[#38e1ff]">
              <DumbbellIcon className="shrink-0" size={12} />
              <span>{game.complexity_weight.toFixed(1)} / 5</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}