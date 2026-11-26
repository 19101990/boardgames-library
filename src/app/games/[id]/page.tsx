'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';
import { AuthControl } from '@/components/auth/AuthControl';
import { MoveToCollectionSheet } from '@/components/games/MoveToCollectionSheet';
import { PlayRatingDisplay, PlayRatingInput } from '@/components/games/PlayRating';
import { PLAY_RATING_ASPECTS, sanitizePlayRatings } from '@/lib/playRatings';
import { cacheGameDetails, removeCachedGame } from '@/lib/offlineGameStore';
import {
  deletePlay,
  getLibraryMode,
  loadGameDetails,
  moveGameToCollection,
  removeGame,
  savePlay,
  setExpansionOwned,
} from '@/lib/libraryData';
import { DemoNotice } from '@/components/demo/DemoNotice';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { BoardGame, Expansion, PlayRatings, PlaySession } from '@/types/types';
import {
  UsersIcon,
  ClockIcon,
  CalendarIcon,
  DumbbellIcon,
  ArrowLeftIcon,
  DiceIcon,
  ChevronDownIcon,
  PlusIcon,
  MinusIcon,
  BookIcon,
  SunIcon,
  MoonIcon,
} from '@/components/ui/Icons';

export default function GameDetailPage() {
  const { user, isLoading: isAuthLoading, errorMessage: authError } = useSupabaseAuth();
  const libraryMode = getLibraryMode(isAuthLoading, Boolean(user));
  const isDemo = libraryMode === 'demo';
  const { isOnline, setIsOnline } = useOnlineStatus();
  // Signed in: the owner's real plays. Signed out: the demo's sample plays.
  const canViewPlays = libraryMode !== null;
  // Live changes go to Supabase and need a connection; demo changes are stored on this device and work offline.
  const canEdit = libraryMode === 'demo' || (libraryMode === 'live' && isOnline);
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [game, setGame] = useState<BoardGame | null>(null);
  const [expansions, setExpansions] = useState<Expansion[]>([]);
  const [plays, setPlays] = useState<PlaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [isMoveToCollectionOpen, setIsMoveToCollectionOpen] = useState(false);
  const [hasCachedDetailLists, setHasCachedDetailLists] = useState(false);
  const [offlineCacheMiss, setOfflineCacheMiss] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Expansions section accordion state
  const [isExpansionsOpen, setIsExpansionsOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  // Play logging form state
  const [isLoggingPlay, setIsLoggingPlay] = useState(false);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [isSavingPlay, setIsSavingPlay] = useState(false);
  const [playDate, setPlayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [playerCount, setPlayerCount] = useState(2);
  const [playNotes, setPlayNotes] = useState('');
  const [playRatings, setPlayRatings] = useState<PlayRatings>({});

  // On phones the form opens below the visible screen, so the button seemed to do nothing.
  // Each open bumps this counter; the effect below then scrolls the form into view.
  const playFormRef = useRef<HTMLDivElement>(null);
  const [playFormScrollRequest, setPlayFormScrollRequest] = useState(0);

  useEffect(() => {
    const form = playFormRef.current;
    if (playFormScrollRequest === 0 || !form) return;
    // Only scroll when the form's top isn't comfortably on screen (desktop usually already shows it).
    const { top } = form.getBoundingClientRect();
    if (top >= 0 && top <= window.innerHeight * 0.6) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [playFormScrollRequest]);

  // Load the game with its expansions and plays: real data (signed in) or demo data (signed out).
  const fetchGameDetails = useCallback(async () => {
    if (!rawId || !libraryMode) return; // wait until the login state is known
    setIsLoading(true);
    setOfflineCacheMiss(false);
    if (libraryMode !== 'live') {
      setIsLoggingPlay(false);
      setEditingPlayId(null);
    }

    const result = await loadGameDetails(libraryMode, rawId);
    setGame(result.game);
    setExpansions(result.expansions);
    setPlays(result.plays);
    setHasCachedDetailLists(result.hasCachedDetailLists);
    setOfflineCacheMiss(result.offlineCacheMiss);
    if (result.game) setPlayerCount(result.game.min_players || 2);
    if (result.isOffline !== undefined) setIsOnline(!result.isOffline);
    setIsLoading(false);
  }, [libraryMode, rawId, setIsOnline]);

  useEffect(() => {
    fetchGameDetails();
  }, [fetchGameDetails, isOnline]);

  // Insert or update a play record in Supabase
  /** Checked right before each change, since the connection can drop after rendering. */
  const canChangeNow = () =>
    libraryMode === 'demo' || (libraryMode === 'live' && isOnline && navigator.onLine);

  /** Keeps the real collection's offline cache in step. Demo data never goes into that cache. */
  const updateOfflineCache = (
    updatedGame: BoardGame,
    updatedExpansions: Expansion[],
    updatedPlays: PlaySession[]
  ) => {
    if (libraryMode !== 'live') return;
    void cacheGameDetails(updatedGame, updatedExpansions, updatedPlays, hasCachedDetailLists).catch(
      (cacheError: unknown) => {
        console.error('Could not update saved game details:', cacheError);
      }
    );
  };

  const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

  // Create or update a play
  const handleSavePlay = async () => {
    if (!game || !libraryMode || !canChangeNow()) return;
    setIsSavingPlay(true);

    const existingPlay = editingPlayId ? plays.find((play) => play.id === editingPlayId) ?? null : null;
    try {
      const savedPlay = await savePlay(libraryMode, game.id, existingPlay, {
        play_date: playDate,
        player_count: playerCount,
        notes: playNotes.trim() || null,
        ratings: sanitizePlayRatings(playRatings),
      });
      const updatedPlays = (
        existingPlay ? plays.map((play) => (play.id === savedPlay.id ? savedPlay : play)) : [savedPlay, ...plays]
      ).sort((a, b) => b.play_date.localeCompare(a.play_date));
      setPlays(updatedPlays);
      updateOfflineCache(game, expansions, updatedPlays);
      setIsLoggingPlay(false);
      setEditingPlayId(null);
      setPlayNotes('');
      setPlayRatings({});
    } catch (error) {
      alert(`Could not ${existingPlay ? 'update' : 'save'} play session: ${errorText(error)}`);
    } finally {
      setIsSavingPlay(false);
    }
  };

  const logPlayDisabledReason = !libraryMode
    ? 'Checking login status'
    : !canEdit
      ? 'Connect to log a play'
      : undefined;

  const handleStartNewPlay = () => {
    if (!canEdit || !game) return;
    setEditingPlayId(null);
    setPlayDate(new Date().toISOString().split('T')[0]);
    setPlayerCount(game.min_players || 2);
    setPlayNotes('');
    setPlayRatings({});
    setIsLoggingPlay(true);
    setPlayFormScrollRequest((count) => count + 1);
  };

  const handleEditPlay = (play: PlaySession) => {
    setEditingPlayId(play.id);
    setPlayDate(play.play_date);
    setPlayerCount(play.player_count);
    setPlayNotes(play.notes ?? '');
    setPlayRatings(sanitizePlayRatings(play.ratings) ?? {});
    setIsLoggingPlay(true);
    setPlayFormScrollRequest((count) => count + 1);
  };

  // Toggle expansion ownership
  const handleToggleExpansion = async (expansion: Expansion) => {
    if (!game || !libraryMode || !canChangeNow()) return;
    const updatedStatus = !expansion.is_owned;
    const updatedExpansions = expansions.map((item) =>
      item.id === expansion.id ? { ...item, is_owned: updatedStatus } : item
    );

    // Optimistic UI update
    setExpansions(updatedExpansions);

    try {
      await setExpansionOwned(libraryMode, expansion, updatedStatus);
      updateOfflineCache(game, updatedExpansions, plays);
    } catch (error) {
      alert(`Could not update expansion: ${errorText(error)}`);
      // Revert on error
      setExpansions((prev) =>
        prev.map((e) => (e.id === expansion.id ? { ...e, is_owned: expansion.is_owned } : e))
      );
    }
  };

  // Delete a play session
  const handleDeletePlay = async (playId: string) => {
    if (!game || !libraryMode || !canChangeNow()) return;
    try {
      await deletePlay(libraryMode, playId);
      const updatedPlays = plays.filter((play) => play.id !== playId);
      setPlays(updatedPlays);
      updateOfflineCache(game, expansions, updatedPlays);
    } catch (error) {
      alert(`Could not delete play: ${errorText(error)}`);
    }
  };

  // Remove game from library (in the demo, its plays and expansions go with it)
  const handleRemoveGame = async () => {
    if (!game || !libraryMode || !canChangeNow()) return;
    const listName = game.status === 'wishlist' ? 'wanted list' : isDemo ? 'demo collection' : 'library';
    const playsNote =
      isDemo && plays.length > 0
        ? ` This also deletes its ${plays.length} logged play${plays.length === 1 ? '' : 's'}.`
        : '';
    const confirmed = window.confirm(`Remove "${game.title}" from your ${listName}?${playsNote}`);
    if (!confirmed) return;

    try {
      await removeGame(libraryMode, game.id);
      if (libraryMode === 'live') {
        void removeCachedGame(game.id).catch((cacheError: unknown) => {
          console.error('Could not remove the deleted game from offline storage:', cacheError);
        });
      }
      router.push('/');
    } catch (error) {
      alert(`Could not remove game: ${errorText(error)}`);
    }
  };

  const handleMoveToCollection = async (_gameId: string, language: string) => {
    if (!game || !libraryMode || !canChangeNow()) return;

    try {
      const updatedGame = await moveGameToCollection(libraryMode, game, language);
      setGame(updatedGame);
      updateOfflineCache(updatedGame, expansions, plays);
    } catch (error) {
      alert(`Could not add game to collection: ${errorText(error)}`);
    }
  };

  const getWeightLabel = (w?: number | null) => {
    if (!w) return 'Light';
    if (w < 2.0) return 'Light';
    if (w < 3.0) return 'Medium Light';
    if (w < 3.8) return 'Medium Heavy';
    return 'Heavy';
  };

  if (isLoading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-app)' }} className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin text-[#0e8396] dark:text-[#38e1ff]" />
      </div>
    );
  }

  if (!game) {
    return (
      <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} className="min-h-screen p-6 text-center flex flex-col items-center justify-center gap-4">
        <p className="text-sm font-semibold">
          {offlineCacheMiss
            ? 'This game has not been saved for offline viewing. Open it while online first.'
            : 'Game not found.'}
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black"
        >
          Back to collection
        </Link>
      </div>
    );
  }

  const initial = game.title.charAt(0).toUpperCase();
  const ratingText = game.rating ?? game.bgg_rating ? (game.rating ?? game.bgg_rating)?.toFixed(1) : '—';
  const weightValue = game.weight ?? game.complexity_weight ?? 1.5;
  const ownedExpansionsCount = expansions.filter((e) => e.is_owned).length;
  const statusBlock = (
    <div className="flex flex-wrap gap-2 text-xs font-semibold lg:col-start-3 lg:justify-self-end">
      <span className="game-category-badge bg-[#d2eff4] text-[#0e8396] px-2 py-1 rounded-md border border-[#a2d8e2]">
        {game.categories?.[0] || 'Base game'}
      </span>
      <span className="bg-[#e2e8f0] text-[#475569] dark:bg-[#12182c] dark:text-[#8ba2c4] px-2 py-1 rounded-md border border-[#cbd5e1] dark:border-[#1f294a]">
        {game.status === 'owned' ? `In collection · ${game.language || 'EN'}` : 'Wanted'}
      </span>
    </div>
  );
  const titleBlock = (
    <div className="lg:col-span-2">
      <div>
        <h1 className="font-display text-3xl font-black leading-tight">
          {game.title}
        </h1>
        <p className="text-xs text-[#536482] dark:text-[#7e94b8] font-medium mt-1.5 italic">
          {game.year_published ?? '—'} · {game.min_players === game.max_players ? game.min_players : `${game.min_players}–${game.max_players}`} players ·{' '}
          {game.max_playtime && game.max_playtime !== game.min_playtime
            ? `${game.min_playtime}–${game.max_playtime} min`
            : `${game.min_playtime ?? 30} min`}
        </p>
      </div>
    </div>
  );
  const actionButton = game.status === 'owned' ? (
    <button
      disabled={!canEdit}
      title={logPlayDisabledReason}
      onClick={handleStartNewPlay}
      className="w-full h-12 rounded-2xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black font-display font-black text-sm flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <DiceIcon size={18} />
      <span>Log a play</span>
    </button>
  ) : null;
  const descriptionBlock = game.description ? (
    <div className="space-y-1.5">
      <h2 className="font-display text-lg font-bold">About</h2>
      <p className={`text-xs text-[#536482] dark:text-[#9bb2d4] leading-relaxed ${isDescriptionExpanded ? '' : 'line-clamp-4'}`}>
        {game.description}
      </p>
      <button
        type="button"
        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
        aria-expanded={isDescriptionExpanded}
        className="text-xs font-bold text-[#0e8396] dark:text-[#38e1ff] hover:underline"
      >
        {isDescriptionExpanded ? 'Read less' : 'Read more'}
      </button>
      <p className="text-[10px] text-[#8b9bb5] dark:text-[#55698a] pt-1">
        Description from BoardGameGeek
      </p>
    </div>
  ) : null;
  const coreInfo = (
    <div className="grid grid-cols-2 gap-3">
      <div
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
        className="p-3.5 rounded-2xl border shadow-sm"
      >
        <UsersIcon size={18} className="text-[#0e8396] dark:text-[#38e1ff]" />
        <div className="font-display text-2xl font-black mt-1.5">
          {game.min_players === game.max_players ? game.min_players : `${game.min_players}–${game.max_players}`}
        </div>
        <div className="text-[11px] text-[#536482] dark:text-[#6e82a3] font-medium mt-0.5">Players</div>
      </div>

      <div
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
        className="p-3.5 rounded-2xl border shadow-sm"
      >
        <ClockIcon size={18} className="text-[#0e8396] dark:text-[#38e1ff]" />
        <div className="font-display text-2xl font-black mt-1.5">
          {game.max_playtime && game.max_playtime !== game.min_playtime
            ? `${game.min_playtime}–${game.max_playtime}m`
            : `${game.min_playtime ?? 30}m`}
        </div>
        <div className="text-[11px] text-[#536482] dark:text-[#6e82a3] font-medium mt-0.5">Play time</div>
      </div>

      <div
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
        className="p-3.5 rounded-2xl border shadow-sm"
      >
        <CalendarIcon size={18} className="text-[#0e8396] dark:text-[#38e1ff]" />
        <div className="font-display text-2xl font-black mt-1.5">
          {game.year_published ?? '—'}
        </div>
        <div className="text-[11px] text-[#536482] dark:text-[#6e82a3] font-medium mt-0.5">Published</div>
      </div>

      <div
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
        className="p-3.5 rounded-2xl border shadow-sm"
      >
        <DumbbellIcon size={18} className="text-[#0e8396] dark:text-[#38e1ff]" />
        <div className="font-display text-2xl font-black mt-1.5">
          {weightValue.toFixed(1)}{' '}
          <span className="text-xs font-normal text-[#6e82a3]">/ 5</span>
        </div>
        <div className="text-[11px] text-[#536482] dark:text-[#6e82a3] font-medium mt-0.5">
          {getWeightLabel(weightValue)}
        </div>
        <div className="w-full bg-[#cbd5e1] dark:bg-[#1b2545] h-1 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-[#0e8396] dark:bg-[#38e1ff] h-full rounded-full"
            style={{ width: `${Math.min(100, (weightValue / 5) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} className="min-h-screen">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-10 relative lg:max-w-[1680px] lg:px-9">
        <header className="hidden items-center justify-between py-4 lg:flex">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-surface-elevated)] bg-[var(--bg-surface-elevated)] px-4 text-sm font-bold transition-transform active:scale-95"
          >
            <ArrowLeftIcon size={16} />
            <span>To collection</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              title="Toggle Theme"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-surface-elevated)',
                color: 'var(--text-primary)',
              }}
              className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
            >
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <AuthControl user={user} isLoading={isAuthLoading} authError={authError} />
          </div>
        </header>

        <div className="hidden lg:grid lg:grid-cols-3 lg:items-start lg:gap-8 lg:mb-2">
          {titleBlock}
          {statusBlock}
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(280px,0.81fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-8">
        {/* Top Hero Poster */}
        <div
          className="relative h-[50vh] w-full bg-[var(--bg-hero)] flex items-center justify-center overflow-hidden lg:h-auto lg:aspect-[3/4] lg:items-start lg:justify-start lg:bg-transparent"
        >
          {game.image_url && !imgError ? (
            <Image
              src={game.image_url}
              alt={game.title}
              fill
              priority
              sizes="(min-width: 1024px) 25vw, 100vw"
              className="object-cover opacity-90 lg:object-contain lg:object-top"
              onError={() => setImgError(true)}
            />
          ) : (
            <span
              style={{ color: 'var(--watermark)' }}
              className="font-display text-9xl font-bold select-none"
            >
              {initial}
            </span>
          )}

          {/* Back Button */}
          <button
            onClick={() => router.back()}
            aria-label="Go Back"
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform lg:hidden"
          >
            <ArrowLeftIcon size={18} />
          </button>

          <div className="absolute top-4 right-4 z-10 flex items-center gap-2.5 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              title="Toggle Theme"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-surface-elevated)',
                color: 'var(--text-primary)',
              }}
              className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
            >
              {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <AuthControl user={user} isLoading={isAuthLoading} authError={authError} />
          </div>

          {/* Rating Badge */}
          <div className="absolute bottom-[10px] left-[10px] bg-[#ff336d] text-white px-2.5 py-1.5 rounded-lg flex flex-col items-center shadow-lg lg:bottom-auto lg:left-auto lg:right-4 lg:top-4">
            <span className="font-display text-2xl font-black leading-none">
              {ratingText}
            </span>
            <span className="text-[9px] font-bold tracking-wider mt-1 uppercase opacity-95">
              BGG RATING
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6 lg:col-start-2 lg:col-span-2 lg:p-0 lg:space-y-8">
          {isDemo && <DemoNotice />}
          {!isOnline && !isDemo && (
            <p className="rounded-xl border border-[var(--border-surface)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
              Offline — showing saved game information. It may be out of date; changes are unavailable.
            </p>
          )}

          <div className="space-y-6 lg:hidden">
            {statusBlock}
            {titleBlock}
            {actionButton}
            {descriptionBlock}
            {coreInfo}
          </div>

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
            <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
              <div className="hidden lg:block">{descriptionBlock}</div>
              <div className="hidden lg:block">{coreInfo}</div>
              {game.status === 'owned' && libraryMode !== null && (
                <button
                  onClick={handleRemoveGame}
                  disabled={!canEdit}
                  className="hidden w-full py-2 text-center text-xs font-bold text-[#ff336d] hover:underline disabled:opacity-50 disabled:no-underline lg:block"
                >
                  Remove game
                </button>
              )}
            </div>
            <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">

          {/* Expansions Section */}
          <div className="border-t border-[var(--border-surface)] pt-4">
            <button
              onClick={() => setIsExpansionsOpen(!isExpansionsOpen)}
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div>
                <h3 className="font-display text-base font-bold">Expansions</h3>
                <p className="text-xs text-[#536482] dark:text-[#6e82a3] mt-0.5">
                  {!isOnline && !hasCachedDetailLists
                    ? 'Expansion information not saved offline'
                    : expansions.length > 0
                    ? `${ownedExpansionsCount} of ${expansions.length} owned`
                    : 'None listed'}
                </p>
              </div>
              <ChevronDownIcon
                size={20}
                className={`text-[#536482] transition-transform duration-200 ${
                  isExpansionsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isExpansionsOpen && (
              <div className="mt-3 space-y-2 pt-2 animate-in fade-in duration-150">
                {expansions.length === 0 ? (
                  <p className="text-xs italic text-[var(--text-muted)] py-2">
                    {!isOnline && !hasCachedDetailLists
                      ? 'Open this game online to save its expansion information.'
                      : 'No expansions cataloged for this title yet.'}
                  </p>
                ) : (
                  expansions.map((exp) => (
                    <div
                      key={exp.id}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-surface)',
                      }}
                      className="p-3 rounded-2xl border flex items-center justify-between"
                    >
                      <span className="text-xs font-semibold">{exp.title}</span>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => handleToggleExpansion(exp)}
                          aria-label={
                            exp.is_owned
                              ? `Mark ${exp.title} as not owned`
                              : `Mark ${exp.title} as owned`
                          }
                          aria-pressed={exp.is_owned}
                          className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 transition-transform active:scale-95 ${
                            exp.is_owned
                              ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black border-transparent text-[11px] font-bold'
                              : 'bg-[var(--bg-surface-elevated)] border-[var(--border-surface-elevated)] text-[var(--text-muted)]'
                          }`}
                        >
                          {exp.is_owned ? 'Owned' : <PlusIcon size={16} />}
                        </button>
                      ) : exp.is_owned ? (
                        <span className="rounded-md border border-transparent bg-[#0e8396] px-1.5 py-1 text-[11px] font-bold text-white dark:bg-[#38e1ff] dark:text-black">
                          Owned
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Plays Section */}
          {game.status === 'owned' && (
            <div className="border-t border-[var(--border-surface)] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold">Plays</h3>
                <p className="text-xs text-[#536482] dark:text-[#6e82a3] mt-0.5">
                  {!canViewPlays
                    ? 'Owner access only'
                    : !isOnline && !hasCachedDetailLists
                    ? 'Play history not saved offline'
                    : plays.length > 0
                      ? `${plays.length} logged`
                      : 'Nothing logged'}
                </p>
              </div>
              {game.status === 'owned' && (
                <button
                  disabled={!canEdit}
                  title={logPlayDisabledReason}
                  onClick={handleStartNewPlay}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-surface-elevated)',
                  }}
                  className="h-8 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusIcon size={13} />
                  <span>Log</span>
                </button>
              )}
            </div>

            {/* In-Card Play Logging Form */}
            {isLoggingPlay && canViewPlays && (
              <div
                ref={playFormRef}
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
                className="scroll-mt-4 p-4 rounded-2xl border space-y-3.5 shadow-md animate-in fade-in duration-150"
              >
                <div>
                  <label className="text-[11px] font-semibold text-[#536482] dark:text-[#8ba2c4] mb-1 block">
                    Date
                  </label>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={playDate}
                    onChange={(e) => setPlayDate(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                    }}
                    className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#536482] dark:text-[#8ba2c4]">
                    Players
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      disabled={!canEdit}
                      onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 disabled:opacity-40"
                    >
                      <MinusIcon size={14} />
                    </button>
                    <span className="font-display text-lg font-bold">{playerCount}</span>
                    <button
                      disabled={!canEdit}
                      onClick={() => setPlayerCount(playerCount + 1)}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 disabled:opacity-40"
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#536482] dark:text-[#8ba2c4]">
                    Ratings <span className="font-normal opacity-80">(all optional)</span>
                  </p>
                  {PLAY_RATING_ASPECTS.map((aspect) => (
                    <div key={aspect.key} className="flex items-start justify-between gap-3">
                      <span className="pt-2 text-[11px] font-medium text-[#536482] dark:text-[#8ba2c4]">
                        {aspect.label}
                      </span>
                      <PlayRatingInput
                        aspect={aspect}
                        value={playRatings[aspect.key] ?? null}
                        onChange={(value) =>
                          setPlayRatings((current) => {
                            const next = { ...current };
                            if (value === null) delete next[aspect.key];
                            else next[aspect.key] = value;
                            return next;
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#536482] dark:text-[#8ba2c4] mb-1 block">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    disabled={!canEdit}
                    placeholder="Who won, scores, house rules..."
                    value={playNotes}
                    onChange={(e) => setPlayNotes(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                    }}
                    className="w-full border rounded-xl p-2.5 text-xs placeholder-[#8b9bb5] focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsLoggingPlay(false);
                      setEditingPlayId(null);
                    }}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-surface-elevated)',
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-[#536482] dark:text-[#8ba2c4] border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePlay}
                    disabled={isSavingPlay || !canEdit}
                    className="flex-1 py-2.5 rounded-xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black text-xs font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {isSavingPlay ? 'Saving...' : editingPlayId ? 'Save changes' : 'Save play'}
                  </button>
                </div>
              </div>
            )}

            {/* List of Previous Play Sessions */}
            {!canViewPlays ? (
              <p className="text-xs italic text-[#8b9bb5] dark:text-[#55698a]">
                Play history is available to the collection owner after signing in.
              </p>
            ) : plays.length === 0 && !isLoggingPlay ? (
              <p className="text-xs italic text-[#8b9bb5] dark:text-[#55698a]">
                {!isOnline && !hasCachedDetailLists
                  ? 'Open this game online to save its play history.'
                  : 'No plays logged yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {plays.map((play) => (
                  <div
                    key={play.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-surface)',
                    }}
                    className="p-3 rounded-2xl border flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{play.play_date} · {play.player_count} players</span>
                        <PlayRatingDisplay value={play.ratings?.overall} />
                      </div>
                      {play.notes && (
                        <p className="text-[11px] text-[#536482] dark:text-[#8ba2c4] mt-0.5 font-medium">
                          {play.notes}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditPlay(play)}
                          className="text-[#0e8396] dark:text-[#38e1ff] text-xs font-bold hover:underline px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePlay(play.id)}
                          className="text-[#ff336d] text-xs font-bold hover:underline px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

              <div className="hidden lg:block">{actionButton}</div>

          {/* Mechanics */}
          {game.mechanics && game.mechanics.length > 0 && (
            <div>
              <h3 className="font-display text-base font-bold mb-2.5">Mechanics</h3>
              <div className="flex flex-wrap gap-2">
                {game.mechanics.map((m) => (
                  <span
                    key={m}
                    className="game-mechanic-badge bg-[#e2f4f7] text-[#0e8396] text-xs font-semibold px-2 py-1 rounded-lg border border-[#b2e3ec]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {game.categories && game.categories.length > 0 && (
            <div>
              <h3 className="font-display text-base font-bold mb-2.5">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {game.categories.map((c) => (
                  <span
                    key={c}
                    className="game-category-badge bg-[#fde8ef] text-[#d91c5c] text-xs font-semibold px-2 py-1 rounded-lg border border-[#f5b8cc]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
            </div>
          </div>

          {/* Footer Management Actions */}
          <div className={`pt-2 space-y-3 ${game.status === 'owned' ? 'lg:hidden' : ''}`}>
            {game.status === 'wishlist' ? (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-surface)',
                }}
                className="p-4 rounded-2xl border space-y-3"
              >
                <div>
                  <h3 className="font-display text-base font-bold">Wanted</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Add this game to your collection or remove it from your wanted list.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoveToCollectionOpen(true)}
                  disabled={!canEdit}
                  className="w-full h-11 rounded-xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookIcon size={15} />
                  <span>Add to Collection</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveGame}
                  disabled={!canEdit}
                  className="w-full py-2 text-center text-xs font-bold text-[#ff336d] hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Remove from Wanted
                </button>
                {libraryMode === 'live' && !isOnline && (
                  <p className="text-center text-[11px] text-[var(--text-muted)]">
                    Connect to manage your wanted list.
                  </p>
                )}
              </div>
            ) : libraryMode !== null && (
              <button
                onClick={handleRemoveGame}
                disabled={!canEdit}
              className="w-full text-center text-xs font-bold text-[#ff336d] py-2 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Remove game
              </button>
            )}
          </div>
        </div>
        </div>

      </div>
      <MoveToCollectionSheet
        game={game?.status === 'wishlist' ? game : null}
        isOpen={isMoveToCollectionOpen}
        onClose={() => setIsMoveToCollectionOpen(false)}
        onMoveToCollection={handleMoveToCollection}
        onRemoveFromWanted={handleRemoveGame}
        canManage={libraryMode !== null}
        isOnline={canEdit}
        showRemoveFromWanted={false}
      />
    </div>
  );
}