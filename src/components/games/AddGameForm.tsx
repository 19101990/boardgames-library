'use client';

import { useState } from 'react';
import { BookIcon, HeartIcon, CloudDownloadIcon } from '@/components/ui/Icons';
import { BoardGame } from '@/types/types';

interface AddGameFormProps {
  onAddGame: (game: Partial<BoardGame>, targetStatus: 'owned' | 'wishlist') => void;
}

export function AddGameForm({ onAddGame }: AddGameFormProps) {
  const [title, setTitle] = useState('');
  const [yearPublished, setYearPublished] = useState('');
  const [targetStatus, setTargetStatus] = useState<'owned' | 'wishlist'>('owned');
  const [language, setLanguage] = useState<'EN' | 'DE' | 'PL' | 'Other'>('EN');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedMetadata, setFetchedMetadata] = useState<Partial<BoardGame> | null>(null);

  const canFetch = title.trim().length > 0;
  const canSubmit = title.trim().length > 0;

  const handleFetchBgg = async () => {
    if (!canFetch) return;
    setIsFetching(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      setFetchedMetadata({
        min_players: 1,
        max_players: 4,
        min_playtime: 30,
        max_playtime: 60,
        bgg_rating: 7.5,
        complexity_weight: 2.2,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const newGame: Partial<BoardGame> & { language?: string } = {
      id: slug || `game-${Date.now()}`,
      title: title.trim(),
      year_published: yearPublished ? parseInt(yearPublished, 10) : undefined,
      status: targetStatus,
      language: targetStatus === 'owned' ? language : undefined,
      play_count: 0,
      categories: ['Family'],
      mechanics: ['Hand Management'],
      min_players: fetchedMetadata?.min_players ?? 1,
      max_players: fetchedMetadata?.max_players ?? 4,
      min_playtime: fetchedMetadata?.min_playtime ?? 30,
      max_playtime: fetchedMetadata?.max_playtime ?? 60,
      bgg_rating: fetchedMetadata?.bgg_rating ?? 7.0,
      complexity_weight: fetchedMetadata?.complexity_weight ?? 1.5,
    };

    onAddGame(newGame as BoardGame, targetStatus);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-1">
      {/* Title */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--text-muted)] block">
          Title
        </label>
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-surface-elevated)',
          }}
          className="h-13 rounded-2xl border px-4 flex items-center shadow-inner"
        >
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wingspan"
            className="w-full bg-transparent text-sm font-medium focus:outline-none placeholder-[var(--text-dim)]"
          />
        </div>
      </div>

      {/* Year published */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--text-muted)] block">
          Year published
        </label>
        <div
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-surface-elevated)',
          }}
          className="h-13 rounded-2xl border px-4 flex items-center shadow-inner"
        >
          <input
            type="number"
            value={yearPublished}
            onChange={(e) => setYearPublished(e.target.value)}
            placeholder="e.g. 2019"
            className="w-full bg-transparent text-sm font-medium focus:outline-none placeholder-[var(--text-dim)]"
          />
        </div>
      </div>

      {/* Fetch from BGG Button */}
      <button
        type="button"
        onClick={handleFetchBgg}
        disabled={!canFetch || isFetching}
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-surface-elevated)',
        }}
        className="w-full h-12 rounded-2xl border flex items-center justify-center gap-2.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-[0.99] disabled:opacity-50"
      >
        <CloudDownloadIcon size={16} />
        <span>{isFetching ? 'Fetching data...' : 'Fetch from BoardGameGeek'}</span>
      </button>

      {/* Add to: Collection vs Wanted */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-[var(--text-muted)] block">
          Add to
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTargetStatus('owned')}
            className={`h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all border ${
              targetStatus === 'owned'
                ? 'bg-[#0e8396] text-white border-transparent dark:bg-[#38e1ff] dark:text-black shadow-md'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-surface-elevated)] text-[var(--text-muted)]'
            }`}
          >
            <BookIcon size={15} />
            <span>Collection</span>
          </button>

          <button
            type="button"
            onClick={() => setTargetStatus('wishlist')}
            className={`h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all border ${
              targetStatus === 'wishlist'
                ? 'bg-[#0e8396] text-white border-transparent dark:bg-[#38e1ff] dark:text-black shadow-md'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-surface-elevated)] text-[var(--text-muted)]'
            }`}
          >
            <HeartIcon size={15} />
            <span>Wanted</span>
          </button>
        </div>
      </div>

      {/* Language of the copy - only visible when adding to Collection */}
      {targetStatus === 'owned' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <label className="text-xs font-semibold text-[var(--text-muted)] block">
            Language of your copy
          </label>
          <div className="flex gap-2">
            {(['EN', 'DE', 'PL', 'Other'] as const).map((lang) => {
              const isSelected = language === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 h-11 rounded-2xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-[#0e8396] text-white border-transparent dark:bg-[#38e1ff] dark:text-black shadow-md'
                      : 'bg-[var(--bg-surface-elevated)] border-[var(--border-surface-elevated)] text-[var(--text-muted)]'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full h-12 rounded-2xl font-display font-black text-xs tracking-wider uppercase transition-all shadow-lg active:scale-[0.99] ${
            canSubmit
              ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-[#0e8396]/20 dark:shadow-[#38e1ff]/20'
              : 'bg-[#92b8c5] text-white/80 dark:bg-[#1a3848] dark:text-white/40 cursor-not-allowed'
          }`}
        >
          {targetStatus === 'owned' ? 'Add to Collection' : 'Add to Wanted'}
        </button>
      </div>
    </form>
  );
}