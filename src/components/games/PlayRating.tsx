'use client';

import { StarIcon } from '@/components/ui/Icons';
import { isValidPlayRatingValue, type PlayRatingAspectConfig } from '@/lib/playRatings';

const SCALE_VALUES = [1, 2, 3, 4, 5] as const;

interface PlayRatingInputProps {
  aspect: PlayRatingAspectConfig;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/**
 * Optional 1–5 picker for one aspect. Quality aspects use stars; intensity aspects
 * use dots with low/high labels. Tapping the selected value again clears it.
 */
export function PlayRatingInput({ aspect, value, onChange, disabled = false }: PlayRatingInputProps) {
  const isIntensity = aspect.kind === 'intensity';

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1" role="radiogroup" aria-label={aspect.label}>
        {SCALE_VALUES.map((step) => {
          const isFilled = value !== null && step <= value;
          const isSelected = value === step;
          const stepLabel = isIntensity && aspect.scaleLabels
            ? `${step} of 5${step === 1 ? ` (${aspect.scaleLabels.low})` : step === 5 ? ` (${aspect.scaleLabels.high})` : ''}`
            : `${step} star${step === 1 ? '' : 's'}`;

          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${stepLabel}${isSelected ? ', tap to clear' : ''}`}
              disabled={disabled}
              onClick={() => onChange(isSelected ? null : step)}
              className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
            >
              {isIntensity ? (
                <span
                  aria-hidden="true"
                  className={`block w-3.5 h-3.5 rounded-full border-2 ${
                    isFilled
                      ? 'bg-[#0e8396] border-[#0e8396] dark:bg-[#38e1ff] dark:border-[#38e1ff]'
                      : 'border-[#8b9bb5] dark:border-[#55698a]'
                  }`}
                />
              ) : (
                <StarIcon
                  size={20}
                  aria-hidden="true"
                  fill={isFilled ? 'currentColor' : 'none'}
                  className={isFilled ? 'text-[#f5a524]' : 'text-[#8b9bb5] dark:text-[#55698a]'}
                />
              )}
            </button>
          );
        })}
      </div>
      {isIntensity && aspect.scaleLabels && (
        <div
          aria-hidden="true"
          className="flex w-[11rem] justify-between px-2 text-[10px] text-[#8b9bb5] dark:text-[#55698a]"
        >
          <span>{aspect.scaleLabels.low}</span>
          <span>{aspect.scaleLabels.high}</span>
        </div>
      )}
    </div>
  );
}

/** Compact read-only star display (used for overall enjoyment). Renders nothing when unrated. */
export function PlayRatingDisplay({ value }: { value?: number | null }) {
  if (!isValidPlayRatingValue(value)) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} of 5 stars`} title={`${value} / 5`}>
      {SCALE_VALUES.map((star) => (
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
