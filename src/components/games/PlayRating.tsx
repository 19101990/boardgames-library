'use client';

import { StarIcon } from '@/components/ui/Icons';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function isValidPlayRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

interface PlayRatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/** Optional 1–5 star picker. Tapping the selected star again clears the rating. */
export function PlayRatingInput({ value, onChange, disabled = false }: PlayRatingInputProps) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Play rating">
      {STAR_VALUES.map((star) => {
        const isFilled = value !== null && star <= value;
        const isSelected = value === star;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${star} star${star === 1 ? '' : 's'}${isSelected ? ' (tap to clear)' : ''}`}
            disabled={disabled}
            onClick={() => onChange(isSelected ? null : star)}
            className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <StarIcon
              size={20}
              fill={isFilled ? 'currentColor' : 'none'}
              className={isFilled ? 'text-[#f5a524]' : 'text-[#8b9bb5] dark:text-[#55698a]'}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Compact read-only star display for a logged play. Renders nothing when unrated. */
export function PlayRatingDisplay({ value }: { value?: number | null }) {
  if (!isValidPlayRating(value)) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} of 5 stars`} title={`${value} / 5`}>
      {STAR_VALUES.map((star) => (
        <StarIcon
          key={star}
          size={12}
          aria-hidden="true"
          fill={star <= value ? 'currentColor' : 'none'}
          className={star <= value ? 'text-[#f5a524]' : 'text-[#8b9bb5] dark:text-[#55698a]'}
        />
      ))}
    </span>
  );
}
