'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';
import { AuthControl } from '@/components/auth/AuthControl';
import { MoveToCollectionSheet } from '@/components/games/MoveToCollectionSheet';
import {
  cacheGameDetails,
  getCachedGameDetails,
  isNetworkError,
  removeCachedGame,
} from '@/lib/offlineGameStore';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { BoardGame, Expansion, PlaySession } from '@/types/types';
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
  const canViewPlays = Boolean(user) && !isAuthLoading;
  const { isOnline, setIsOnline } = useOnlineStatus();
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

  // Fetch game, expansions, and plays from Supabase
  const fetchGameDetails = useCallback(async () => {
    if (!rawId) return;
    setIsLoading(true);
    setOfflineCacheMiss(false);
    if (!canViewPlays) {
      setPlays([]);
      setIsLoggingPlay(false);
      setEditingPlayId(null);
    }

    const loadCachedDetails = async () => {
      try {
        const cached = await getCachedGameDetails(rawId);
        setGame(cached.game);
        setExpansions(cached.expansions);
        setPlays(canViewPlays ? cached.plays : []);
        setHasCachedDetailLists(cached.hasCachedDetails);
        setOfflineCacheMiss(!cached.game);
        if (cached.game) setPlayerCount(cached.game.min_players || 2);
      } catch (error) {
        console.error('Could not load saved game details:', error);
        setGame(null);
        setExpansions([]);
        setPlays([]);
        setHasCachedDetailLists(false);
        setOfflineCacheMiss(true);
      }
    };

    try {
      if (!navigator.onLine) {
        setIsOnline(false);
        await loadCachedDetails();
        return;
      }

      // 1. Fetch Game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', rawId)
        .single();

      if (gameError || !gameData) {
        console.error('Error fetching game:', gameError);
        if (isNetworkError(gameError)) {
          setIsOnline(false);
          await loadCachedDetails();
        } else {
          setGame(null);
          setExpansions([]);
          setPlays([]);
          setHasCachedDetailLists(false);
        }
        return;
      }

      setGame(gameData as BoardGame);
      setIsOnline(true);
      setPlayerCount(gameData.min_players || 2);

      const [expansionsResult, playsResult] = await Promise.all([
        supabase
          .from('expansions')
          .select('*')
          .eq('game_id', rawId)
          .order('title', { ascending: true }),
        canViewPlays
          ? supabase
              .from('plays')
              .select('*')
              .eq('game_id', rawId)
              .order('play_date', { ascending: false })
          : Promise.resolve(null),
      ]);

      if (expansionsResult.error || playsResult?.error) {
        const requestError = expansionsResult.error ?? playsResult?.error;
        console.error('Could not fetch game history:', requestError);

        if (isNetworkError(requestError)) {
          setIsOnline(false);
          await loadCachedDetails();
          setGame(gameData as BoardGame);
          return;
        }
      }

      const expansions = (expansionsResult.data ?? []) as Expansion[];
      const plays = (playsResult?.data ?? []) as PlaySession[];
      setExpansions(expansions);
      setPlays(plays);
      setHasCachedDetailLists(!expansionsResult.error && !playsResult?.error);
      if (canViewPlays && !expansionsResult.error && !playsResult?.error) {
        void cacheGameDetails(gameData as BoardGame, expansions, plays).catch((cacheError: unknown) => {
          console.error('Could not save game details for offline use:', cacheError);
        });
      }
    } catch (err) {
      console.error('Failed to load game details:', err);
      if (isNetworkError(err)) {
        setIsOnline(false);
        await loadCachedDetails();
      }
    } finally {
      setIsLoading(false);
    }
  }, [canViewPlays, rawId, setIsOnline]);

  useEffect(() => {
    fetchGameDetails();
  }, [fetchGameDetails, isOnline]);

  // Insert or update a play record in Supabase
  const handleSavePlay = async () => {
    if (!game || !user || !isOnline || !navigator.onLine) return;
    setIsSavingPlay(true);

    const playChanges = {
      game_id: game.id,
      play_date: playDate,
      player_count: playerCount,
      notes: playNotes.trim() || null,
    };

    const result = editingPlayId
      ? await supabase
          .from('plays')
          .update(playChanges)
          .eq('id', editingPlayId)
          .eq('game_id', game.id)
          .select()
          .single()
      : await supabase.from('plays').insert([playChanges]).select().single();

    if (result.error) {
      console.error('Error saving play:', result.error);
      alert(`Could not ${editingPlayId ? 'update' : 'save'} play session: ${result.error.message}`);
    } else if (result.data) {
      const savedPlay = result.data as PlaySession;
      const updatedPlays = editingPlayId
        ? plays
            .map((play) => (play.id === savedPlay.id ? savedPlay : play))
            .sort((a, b) => b.play_date.localeCompare(a.play_date))
        : [savedPlay, ...plays];
      setPlays(updatedPlays);
      void cacheGameDetails(game, expansions, updatedPlays, hasCachedDetailLists).catch((cacheError: unknown) => {
        console.error('Could not update saved game history:', cacheError);
      });
      setIsLoggingPlay(false);
      setEditingPlayId(null);
      setPlayNotes('');
    }
    setIsSavingPlay(false);
  };

  const handleEditPlay = (play: PlaySession) => {
    setEditingPlayId(play.id);
    setPlayDate(play.play_date);
    setPlayerCount(play.player_count);
    setPlayNotes(play.notes ?? '');
    setIsLoggingPlay(true);
  };

  // Toggle expansion ownership in Supabase
  const handleToggleExpansion = async (expansion: Expansion) => {
    if (!game || !user || !isOnline || !navigator.onLine) return;
    const updatedStatus = !expansion.is_owned;
    const updatedExpansions = expansions.map((item) =>
      item.id === expansion.id ? { ...item, is_owned: updatedStatus } : item
    );

    // Optimistic UI update
    setExpansions(updatedExpansions);

    const { error } = await supabase
      .from('expansions')
      .update({ is_owned: updatedStatus })
      .eq('id', expansion.id);

    if (error) {
      console.error('Error updating expansion:', error);
      alert(`Could not update expansion: ${error.message}`);
      // Revert on error
      setExpansions((prev) =>
        prev.map((e) => (e.id === expansion.id ? { ...e, is_owned: expansion.is_owned } : e))
      );
    } else {
      void cacheGameDetails(game, updatedExpansions, plays, hasCachedDetailLists).catch((cacheError: unknown) => {
        console.error('Could not update saved expansion details:', cacheError);
      });
    }
  };

  // Delete a play session
  const handleDeletePlay = async (playId: string) => {
    if (!game || !user || !isOnline || !navigator.onLine) return;
    const { error } = await supabase.from('plays').delete().eq('id', playId);
    if (!error) {
      const updatedPlays = plays.filter((play) => play.id !== playId);
      setPlays(updatedPlays);
      void cacheGameDetails(game, expansions, updatedPlays, hasCachedDetailLists).catch((cacheError: unknown) => {
        console.error('Could not update saved game history:', cacheError);
      });
    } else {
      console.error('Error deleting play:', error);
      alert(`Could not delete play: ${error.message}`);
    }
  };

  // Remove game from library
  const handleRemoveGame = async () => {
    if (!game || !user || !isOnline || !navigator.onLine) return;
    const confirmed = window.confirm(
      game.status === 'wishlist'
        ? `Remove "${game.title}" from your wanted list?`
        : `Remove "${game.title}" from your library?`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('games').delete().eq('id', game.id);
    if (!error) {
      void removeCachedGame(game.id).catch((cacheError: unknown) => {
        console.error('Could not remove the deleted game from offline storage:', cacheError);
      });
      router.push('/');
    } else {
      console.error('Error deleting game:', error);
      alert('Could not remove game.');
    }
  };

  const handleMoveToCollection = async (gameId: string, language: string) => {
    if (!game || !user || !isOnline || !navigator.onLine) return;

    const { error } = await supabase
      .from('games')
      .update({ status: 'owned', language })
      .eq('id', gameId);

    if (error) {
      console.error('Error moving game to collection:', error);
      alert(`Could not add game to collection: ${error.message}`);
      return;
    }

    const updatedGame = { ...game, status: 'owned' as const, language };
    setGame(updatedGame);
    void cacheGameDetails(updatedGame, expansions, plays, hasCachedDetailLists).catch((cacheError: unknown) => {
      console.error('Could not update saved game status:', cacheError);
    });
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
      disabled={!canViewPlays || !isOnline}
      title={!canViewPlays ? 'Sign in to log a play' : !isOnline ? 'Connect to log a play' : undefined}
      onClick={() => {
        if (!canViewPlays) return;
        setEditingPlayId(null);
        setPlayDate(new Date().toISOString().split('T')[0]);
        setPlayerCount(game.min_players || 2);
        setPlayNotes('');
        setIsLoggingPlay(true);
      }}
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
          {!isOnline && (
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
              {game.status === 'owned' && user && (
                <button
                  onClick={handleRemoveGame}
                  disabled={!isOnline}
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
                      {user && isOnline ? (
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
                  disabled={!canViewPlays || !isOnline}
                  title={!canViewPlays ? 'Sign in to log a play' : !isOnline ? 'Connect to log a play' : undefined}
                  onClick={() => {
                    if (canViewPlays) setIsLoggingPlay(true);
                  }}
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
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
                className="p-4 rounded-2xl border space-y-3.5 shadow-md animate-in fade-in duration-150"
              >
                <div>
                  <label className="text-[11px] font-semibold text-[#536482] dark:text-[#8ba2c4] mb-1 block">
                    Date
                  </label>
                  <input
                    type="date"
                    disabled={!isOnline}
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
                      disabled={!isOnline}
                      onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 disabled:opacity-40"
                    >
                      <MinusIcon size={14} />
                    </button>
                    <span className="font-display text-lg font-bold">{playerCount}</span>
                    <button
                      disabled={!isOnline}
                      onClick={() => setPlayerCount(playerCount + 1)}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95 disabled:opacity-40"
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#536482] dark:text-[#8ba2c4] mb-1 block">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isOnline}
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
                    disabled={isSavingPlay || !isOnline}
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
                      <div className="font-bold">
                        {play.play_date} · {play.player_count} players
                      </div>
                      {play.notes && (
                        <p className="text-[11px] text-[#536482] dark:text-[#8ba2c4] mt-0.5 font-medium">
                          {play.notes}
                        </p>
                      )}
                    </div>
                    {user && isOnline && (
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
                  disabled={!user || isAuthLoading || !isOnline}
                  className="w-full h-11 rounded-xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookIcon size={15} />
                  <span>Add to Collection</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveGame}
                  disabled={!user || isAuthLoading || !isOnline}
                  className="w-full py-2 text-center text-xs font-bold text-[#ff336d] hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Remove from Wanted
                </button>
                {!user && (
                  <p className="text-center text-[11px] text-[var(--text-muted)]">
                    Sign in to manage your wanted list.
                  </p>
                )}
              </div>
            ) : user && (
              <button
                onClick={handleRemoveGame}
                disabled={!isOnline}
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
        canManage={Boolean(user) && !isAuthLoading}
        isOnline={isOnline}
        showRemoveFromWanted={false}
      />
    </div>
  );
}