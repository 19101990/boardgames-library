'use client';

import { useState } from 'react';
import { BoardGame } from '@/types/types';
import { BookIcon } from '@/components/ui/Icons';

interface MoveToCollectionSheetProps {
  game: BoardGame | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveToCollection: (gameId: string, language: string) => void;
  onRemoveFromWanted: (gameId: string) => void;
}

export function MoveToCollectionSheet({
  game,
  isOpen,
  onClose,
  onMoveToCollection,
  onRemoveFromWanted,
}: MoveToCollectionSheetProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<'EN' | 'DE' | 'PL' | 'Other'>('EN');

  if (!isOpen || !game) return null;

  const handleConfirmMove = () => {
    onMoveToCollection(game.id, selectedLanguage);
    onClose();
  };

  const handleConfirmRemove = () => {
    onRemoveFromWanted(game.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-surface)',
        }}
        className="relative z-10 w-full max-w-md rounded-t-3xl border-t p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-5"
      >
        {/* Handle indicator */}
        <div
          style={{ backgroundColor: 'var(--border-surface-elevated)' }}
          className="mx-auto h-1.5 w-12 rounded-full"
        />

        {/* Header & Game Title */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-[#0e8396] dark:text-[#38e1ff] uppercase tracking-wider">
              Move to collection
            </span>
            <h2 style={{ color: 'var(--text-primary)' }} className="text-xl font-black tracking-tight mt-0.5">
              {game.title}
            </h2>
            <p style={{ color: 'var(--text-muted)' }} className="text-xs font-medium mt-0.5">
              {game.year_published ?? '—'} · {game.min_players}–{game.max_players} players
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Language selector */}
        <div className="space-y-2">
          <label style={{ color: 'var(--text-muted)' }} className="text-xs font-semibold block">
            Language of your copy
          </label>
          <div className="flex gap-2">
            {(['EN', 'DE', 'PL', 'Other'] as const).map((lang) => {
              const isSelected = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
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

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleConfirmMove}
            className="w-full h-12 rounded-2xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black font-display font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform"
          >
            <BookIcon size={16} />
            <span>Add to Collection</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmRemove}
            className="w-full py-2.5 text-center text-xs font-bold text-[#ff336d] hover:underline"
          >
            Remove from Wanted
          </button>
        </div>
      </div>
    </div>
  );
}