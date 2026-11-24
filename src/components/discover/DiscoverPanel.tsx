'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { buildRecommendationRequest, FAVOURITES_SHOWN, rankFavourites } from '@/lib/favourites';
import { loadAllPlays, type LibraryMode } from '@/lib/libraryData';
import type { PlayerCountChoice, RecommendationMode } from '@/lib/recommendationRequest';
// Type-only import: none of the server code ends up in the browser bundle.
import type { VerifiedSuggestion } from '@/lib/verifySuggestions';
import type { BoardGame, PlaySession } from '@/types/types';
import { ClockIcon, DumbbellIcon, SparklesIcon, UsersIcon } from '@/components/ui/Icons';

interface DiscoverPanelProps {
  games: BoardGame[];
  libraryMode: LibraryMode;
  isOnline: boolean;
  /** Adds the BGG game to the Wanted list. Resolves true when it was saved. */
  onAddToWanted: (bggId: number) => Promise<boolean>;
}

const PLAYER_OPTIONS: { value: PlayerCountChoice; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6+' },
];

const MODE_OPTIONS: { value: RecommendationMode; label: string }[] = [
  { value: 'similar', label: 'More like my favourites' },
  { value: 'different', label: 'Something different' },
];

// Shown while waiting; the request usually takes 10–20 seconds.
const LOADING_STEPS: { fromSecond: number; text: string }[] = [
  { fromSecond: 0, text: 'Reading your favourite games…' },
  { fromSecond: 2, text: 'Asking the AI for ideas…' },
  { fromSecond: 9, text: 'Checking the ideas on BoardGameGeek…' },
  { fromSecond: 20, text: 'Almost there…' },
];

const chipClass = (isActive: boolean) =>
  `h-9 px-3 rounded-xl text-xs font-bold transition-colors ${
    isActive
      ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-md'
      : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-surface-elevated)]'
  }`;

type AddState = 'adding' | 'added' | 'failed';

export function DiscoverPanel({ games, libraryMode, isOnline, onAddToWanted }: DiscoverPanelProps) {
  const [players, setPlayers] = useState<PlayerCountChoice>('any');
  const [mode, setMode] = useState<RecommendationMode>('similar');

  const [plays, setPlays] = useState<PlaySession[] | null>(null);
  const [playsError, setPlaysError] = useState<string | null>(null);
  const [playsReloadKey, setPlaysReloadKey] = useState(0);

  const [isRequesting, setIsRequesting] = useState(false);
  const [secondsWaiting, setSecondsWaiting] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [results, setResults] = useState<VerifiedSuggestion[] | null>(null);
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load every play once, to work out the favourites. (The page gives this panel a
  // key per library mode, so switching demo <-> signed in starts with fresh state.)
  useEffect(() => {
    let isCurrent = true;
    loadAllPlays(libraryMode)
      .then((loaded) => {
        if (isCurrent) setPlays(loaded);
      })
      .catch((error: unknown) => {
        if (isCurrent) setPlaysError(error instanceof Error ? error.message : 'Could not load your plays.');
      });
    return () => {
      isCurrent = false;
    };
  }, [libraryMode, playsReloadKey]);

  // Count seconds while waiting, to show the matching loading message.
  useEffect(() => {
    if (!isRequesting) return;
    const timer = setInterval(() => setSecondsWaiting((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [isRequesting]);

  const favourites = useMemo(
    () => (plays ? rankFavourites(games, plays, players) : []),
    [games, plays, players]
  );

  const handleDiscover = async () => {
    if (isRequesting || favourites.length === 0) return;
    setSecondsWaiting(0);
    setIsRequesting(true);
    setRequestError(null);
    setResults(null);
    setAddStates({});

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRecommendationRequest(games, favourites, players, mode)),
      });
      const body: { suggestions?: VerifiedSuggestion[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not get suggestions. Try again.');
      if (isMounted.current) setResults(body.suggestions ?? []);
    } catch (error) {
      if (isMounted.current) {
        setRequestError(
          error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'Could not reach the server. Check your connection and try again.'
        );
      }
    } finally {
      if (isMounted.current) setIsRequesting(false);
    }
  };

  const handleAdd = async (bggId: number) => {
    setAddStates((states) => ({ ...states, [bggId]: 'adding' }));
    let saved = false;
    try {
      saved = await onAddToWanted(bggId);
    } catch {
      saved = false;
    }
    if (isMounted.current) setAddStates((states) => ({ ...states, [bggId]: saved ? 'added' : 'failed' }));
  };

  if (!isOnline) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm font-bold">You’re offline.</p>
        <p className="text-xs text-[var(--text-muted)]">Discover needs an internet connection to ask the AI.</p>
      </div>
    );
  }

  const loadingText = [...LOADING_STEPS].reverse().find((step) => secondsWaiting >= step.fromSecond)?.text;

  return (
    // Phones: one column. Desktop (lg+): choices and results side by side, half and half.
    <div className="w-full space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      {/* Choices (stays in view while scrolling the results on desktop) */}
      <section
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
        className="rounded-3xl border p-4 space-y-4 md:p-5 lg:sticky lg:top-6"
      >
        <p className="text-sm text-[var(--text-muted)]">
          Get 5 game ideas based on the games you rated highest. The AI suggests them, then every idea is
          checked on BoardGameGeek.
        </p>

        <div>
          <p className="text-xs font-semibold mb-2 text-[var(--text-muted)]">Plays very well with</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Player count">
            {PLAYER_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={players === option.value}
                disabled={isRequesting}
                onClick={() => setPlayers(option.value)}
                className={`${chipClass(players === option.value)} min-w-[42px]`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold mb-2 text-[var(--text-muted)]">What kind of ideas</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Suggestion style">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                disabled={isRequesting}
                onClick={() => setMode(option.value)}
                className={chipClass(mode === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Which favourites will be sent */}
        <div className="text-xs text-[var(--text-muted)]">
          {playsError ? (
            <p>
              <span className="font-bold text-[#ff336d]">{playsError}</span>{' '}
              <button
                type="button"
                onClick={() => {
                  setPlaysError(null);
                  setPlaysReloadKey((key) => key + 1);
                }}
                className="font-bold text-[#0e8396] dark:text-[#38e1ff] hover:underline"
              >
                Retry
              </button>
            </p>
          ) : plays === null ? (
            <p>Loading your plays…</p>
          ) : favourites.length === 0 ? (
            <p>
              Rate the overall enjoyment of a few plays first. Suggestions are based on your highest-rated
              games.
            </p>
          ) : (
            <p>
              <span className="font-semibold">Based on: </span>
              {favourites
                .slice(0, FAVOURITES_SHOWN)
                .map((favourite) => `${favourite.game.title} (${favourite.averageRating.toFixed(1)}★)`)
                .join(', ')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDiscover}
          disabled={isRequesting || favourites.length === 0}
          className="w-full h-12 rounded-2xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black font-black text-sm tracking-wide shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 md:w-auto md:px-8 lg:w-full"
        >
          <SparklesIcon size={16} />
          {isRequesting ? 'Finding games…' : results ? 'Suggest again' : 'Suggest games'}
        </button>
      </section>

      {/* Loading / error / results */}
      <section aria-live="polite">
        {isRequesting ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
            <div className="w-7 h-7 border-2 border-current border-t-transparent rounded-full animate-spin text-[#0e8396] dark:text-[#38e1ff]" />
            <p className="text-xs font-semibold tracking-wide">{loadingText}</p>
            <p className="text-[11px]">This usually takes 10–20 seconds.</p>
          </div>
        ) : requestError ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-bold text-[#ff336d]">No suggestions this time</p>
            <p className="text-xs text-[var(--text-muted)]">{requestError}</p>
          </div>
        ) : results && results.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--text-muted)]">
            None of the AI’s ideas passed the BoardGameGeek checks this time. Try again, or pick a different
            player count.
          </p>
        ) : results ? (
          <div className="space-y-3">
            {results.length < 5 && (
              <p className="text-xs text-[var(--text-muted)]">
                Only {results.length} of the AI’s ideas passed the BoardGameGeek checks this time.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {results.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.bggId}
                  suggestion={suggestion}
                  addState={addStates[suggestion.bggId]}
                  onAdd={() => handleAdd(suggestion.bggId)}
                />
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-dim)]">
              Ideas by an AI model (Cloudflare Workers AI); titles, years, players and ratings come from
              BoardGameGeek. The “why” is the AI’s opinion and can be wrong.
            </p>
          </div>
        ) : (
          // Desktop only: fills the empty right column before the first search.
          <div
            style={{ borderColor: 'var(--border-surface-elevated)' }}
            className="hidden lg:flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed p-8 text-center text-[var(--text-muted)]"
          >
            <SparklesIcon size={28} className="text-[#0e8396] dark:text-[#38e1ff]" />
            <p className="text-sm font-semibold">Your 5 suggestions will appear here</p>
            <p className="text-xs">Pick a player count and style, then press “Suggest games”.</p>
          </div>
        )}
      </section>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: VerifiedSuggestion;
  addState: AddState | undefined;
  onAdd: () => void;
}

function SuggestionCard({ suggestion, addState, onAdd }: SuggestionCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = suggestion.image ?? suggestion.thumbnail;
  const { minPlayers, maxPlayers, minPlaytime, maxPlaytime } = suggestion;

  // Same structure as the collection's list card: picture on the left, details on the right.
  return (
    <article
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
      className="flex w-full overflow-hidden rounded-2xl border"
    >
      <div
        style={{ backgroundColor: 'var(--bg-hero)' }}
        className="relative w-36 min-h-[140px] shrink-0 flex items-center justify-center overflow-hidden"
      >
        {imageUrl && !imageFailed ? (
          <Image
            src={imageUrl}
            alt={suggestion.title}
            fill
            sizes="150px"
            className="object-cover opacity-90"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span style={{ color: 'var(--watermark)' }} className="font-display text-7xl font-bold select-none">
            {suggestion.title.charAt(0).toUpperCase()}
          </span>
        )}

        {suggestion.rating !== null && (
          <div className="absolute left-[5px] top-[5px] rounded-md bg-[#ff336d] px-1.5 py-0.5 text-center font-display text-xs font-black leading-tight text-white shadow-md md:left-2 md:top-2 md:px-2 md:py-1 md:text-sm">
            {suggestion.rating.toFixed(1)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 p-3.5 flex flex-col gap-2 text-left">
        <div>
          <h3 style={{ color: 'var(--text-primary)' }} className="font-display text-sm font-bold leading-snug">
            {suggestion.title}
          </h3>
          <div
            style={{ color: 'var(--text-muted)' }}
            className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium"
          >
            <span>{suggestion.year ?? '—'}</span>
            {minPlayers !== null && maxPlayers !== null && (
              <span className="flex items-center gap-1.5">
                <UsersIcon className="text-[#0e8396] dark:text-[#38e1ff] shrink-0" size={13} />
                {minPlayers === maxPlayers ? minPlayers : `${minPlayers}–${maxPlayers}`}
              </span>
            )}
            {minPlaytime !== null && (
              <span className="flex items-center gap-1.5">
                <ClockIcon className="text-[#0e8396] dark:text-[#38e1ff] shrink-0" size={13} />
                {maxPlaytime && maxPlaytime !== minPlaytime ? `${minPlaytime}–${maxPlaytime}` : minPlaytime} min
              </span>
            )}
            {suggestion.weight !== null && (
              <span className="flex items-center gap-1.5 text-[#0e8396] dark:text-[#38e1ff]">
                <DumbbellIcon className="shrink-0" size={13} />
                {suggestion.weight.toFixed(1)} / 5
              </span>
            )}
          </div>
        </div>

        <p style={{ color: 'var(--text-primary)' }} className="text-xs leading-relaxed">
          {suggestion.reason}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          {suggestion.isWanted ? (
            <span className="rounded-lg border border-[#a2d8e2] bg-[#d2eff4] px-2 py-1 text-[11px] font-semibold text-[#0e8396] dark:border-[#1f294a] dark:bg-[#12182c] dark:text-[#8ba2c4]">
              Already on your Wanted list
            </span>
          ) : addState === 'added' ? (
            <span className="text-xs font-bold text-[#0e8396] dark:text-[#38e1ff]">Added to Wanted ✓</span>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={addState === 'adding'}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {addState === 'adding' ? 'Adding…' : addState === 'failed' ? 'Retry adding' : 'Add to Wanted'}
            </button>
          )}
          <a
            href={`https://boardgamegeek.com/boardgame/${suggestion.bggId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[var(--text-muted)] hover:underline"
          >
            View on BGG ↗
          </a>
        </div>
      </div>
    </article>
  );
}
