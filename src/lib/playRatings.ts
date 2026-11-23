import type { PlayRatingAspect, PlayRatings } from '@/types/types';

export interface PlayRatingAspectConfig {
  key: PlayRatingAspect;
  label: string;
  /**
   * `quality`: more is better (shown as stars).
   * `intensity`: more means "more of it", not better (shown as dots with scale labels).
   */
  kind: 'quality' | 'intensity';
  scaleLabels?: { low: string; high: string };
}

/** Display order for the log/edit play form. Keys must match the `plays.ratings` JSON keys. */
export const PLAY_RATING_ASPECTS: readonly PlayRatingAspectConfig[] = [
  { key: 'overall', label: 'Overall enjoyment', kind: 'quality' },
  { key: 'pacing', label: 'Length / pacing fit', kind: 'quality' },
  { key: 'energy_fit', label: 'Energy / mood fit', kind: 'quality' },
  {
    key: 'interaction',
    label: 'Player interaction',
    kind: 'intensity',
    scaleLabels: { low: 'Low', high: 'High' },
  },
  {
    key: 'teach_effort',
    label: 'Teach / rules effort',
    kind: 'intensity',
    scaleLabels: { low: 'Light', high: 'Heavy' },
  },
];

export function isValidPlayRatingValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Keeps only known aspects with whole-number values from 1 to 5.
 * Returns null when nothing valid is left, so unrated plays store `ratings = null`.
 */
export function sanitizePlayRatings(value: unknown): PlayRatings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: PlayRatings = {};
  for (const { key } of PLAY_RATING_ASPECTS) {
    const rating = source[key];
    if (isValidPlayRatingValue(rating)) result[key] = rating;
  }
  return Object.keys(result).length > 0 ? result : null;
}
