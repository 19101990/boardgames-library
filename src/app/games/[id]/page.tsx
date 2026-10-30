'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';
import { AuthControl } from '@/components/auth/AuthControl';
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
  HeartIcon,
  PlusCircleIcon,
} from '@/components/ui/Icons';

export default function GameDetailPage() {
  const { user, isLoading: isAuthLoading, errorMessage: authError } = useSupabaseAuth();
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [game, setGame] = useState<BoardGame | null>(null);
  const [expansions, setExpansions] = useState<Expansion[]>([]);
  const [plays, setPlays] = useState<PlaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  // Expansions section accordion state
  const [isExpansionsOpen, setIsExpansionsOpen] = useState(false);

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

    try {
      // 1. Fetch Game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', rawId)
        .single();

      if (gameError || !gameData) {
        console.error('Error fetching game:', gameError);
        setGame(null);
        setIsLoading(false);
        return;
      }

      setGame(gameData as BoardGame);
      setPlayerCount(gameData.min_players || 2);

      // 2. Fetch Expansions
      const { data: expansionsData } = await supabase
        .from('expansions')
        .select('*')
        .eq('game_id', rawId)
        .order('title', { ascending: true });

      if (expansionsData) {
        setExpansions(expansionsData as Expansion[]);
      }

      // 3. Fetch Plays
      const { data: playsData } = await supabase
        .from('plays')
        .select('*')
        .eq('game_id', rawId)
        .order('play_date', { ascending: false });

      if (playsData) {
        setPlays(playsData as PlaySession[]);
      }
    } catch (err) {
      console.error('Failed to load game details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchGameDetails();
  }, [fetchGameDetails]);

  // Insert or update a play record in Supabase
  const handleSavePlay = async () => {
    if (!game || !user) return;
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
      setPlays((prev) =>
        editingPlayId
          ? prev
              .map((play) => (play.id === savedPlay.id ? savedPlay : play))
              .sort((a, b) => b.play_date.localeCompare(a.play_date))
          : [savedPlay, ...prev]
      );
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
    if (!user) return;
    const updatedStatus = !expansion.is_owned;

    // Optimistic UI update
    setExpansions((prev) =>
      prev.map((e) => (e.id === expansion.id ? { ...e, is_owned: updatedStatus } : e))
    );

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
    }
  };

  // Delete a play session
  const handleDeletePlay = async (playId: string) => {
    if (!user) return;
    const { error } = await supabase.from('plays').delete().eq('id', playId);
    if (!error) {
      setPlays((prev) => prev.filter((p) => p.id !== playId));
    } else {
      console.error('Error deleting play:', error);
      alert(`Could not delete play: ${error.message}`);
    }
  };

  // Remove game from library
  const handleRemoveGame = async () => {
    if (!game || !user) return;
    const confirmed = window.confirm(`Remove "${game.title}" from your library?`);
    if (!confirmed) return;

    const { error } = await supabase.from('games').delete().eq('id', game.id);
    if (!error) {
      router.push('/');
    } else {
      console.error('Error deleting game:', error);
      alert('Could not remove game.');
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
        <p className="text-sm font-semibold">Game not found.</p>
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

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }} className="min-h-screen">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pb-28 relative">
        
        {/* Top Hero Poster */}
        <div
          style={{ backgroundColor: 'var(--bg-hero)' }}
          className="relative aspect-[16/10] w-full flex items-center justify-center overflow-hidden"
        >
          {game.image_url && !imgError ? (
            <Image
              src={game.image_url}
              alt={game.title}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-90"
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
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <ArrowLeftIcon size={18} />
          </button>

          <div className="absolute top-4 right-4 z-10">
            <AuthControl user={user} isLoading={isAuthLoading} authError={authError} />
          </div>

          {/* Rating Badge */}
          <div className="absolute top-16 right-4 bg-[#ff336d] text-white px-3.5 py-1.5 rounded-2xl flex flex-col items-center shadow-lg">
            <span className="font-display text-2xl font-black leading-none">
              {ratingText}
            </span>
            <span className="text-[9px] font-bold tracking-wider mt-1 uppercase opacity-95">
              BGG RATING
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6">
          {/* Status & Language Badges */}
          <div className="flex gap-2 text-xs font-semibold">
            <span className="game-category-badge bg-[#d2eff4] text-[#0e8396] px-2.5 py-1 rounded-lg border border-[#a2d8e2]">
              {game.categories?.[0] || 'Base game'}
            </span>
            <span className="bg-[#e2e8f0] text-[#475569] dark:bg-[#12182c] dark:text-[#8ba2c4] px-2.5 py-1 rounded-lg border border-[#cbd5e1] dark:border-[#1f294a]">
              {game.status === 'owned' ? `In collection · ${game.language || 'EN'}` : 'Wanted'}
            </span>
          </div>

          {/* Title & Metadata */}
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

          {/* Action Button: Log Play (Only when owned) */}
          {game.status === 'owned' && user && (
            <button
              onClick={() => {
                setEditingPlayId(null);
                setPlayDate(new Date().toISOString().split('T')[0]);
                setPlayerCount(game.min_players || 2);
                setPlayNotes('');
                setIsLoggingPlay(true);
              }}
              className="w-full h-12 rounded-2xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black font-display font-black text-sm flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] transition-transform"
            >
              <DiceIcon size={18} />
              <span>Log a play</span>
            </button>
          )}

          {/* Description / About */}
          {game.description && (
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-bold">About</h2>
              <p className="text-xs text-[#536482] dark:text-[#9bb2d4] leading-relaxed line-clamp-4">
                {game.description}
              </p>
              <p className="text-[10px] text-[#8b9bb5] dark:text-[#55698a] pt-1">
                Description from BoardGameGeek
              </p>
            </div>
          )}

          {/* 4 Stats Cards */}
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

          {/* Mechanics */}
          {game.mechanics && game.mechanics.length > 0 && (
            <div>
              <h3 className="font-display text-base font-bold mb-2.5">Mechanics</h3>
              <div className="flex flex-wrap gap-2">
                {game.mechanics.map((m) => (
                  <span
                    key={m}
                    className="game-mechanic-badge bg-[#e2f4f7] text-[#0e8396] text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#b2e3ec]"
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
                    className="game-category-badge bg-[#fde8ef] text-[#d91c5c] text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#f5b8cc]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Expansions Section */}
          <div className="border-t border-[var(--border-surface)] pt-4">
            <button
              onClick={() => setIsExpansionsOpen(!isExpansionsOpen)}
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div>
                <h3 className="font-display text-base font-bold">Expansions</h3>
                <p className="text-xs text-[#536482] dark:text-[#6e82a3] mt-0.5">
                  {expansions.length > 0
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
                    No expansions cataloged for this title yet.
                  </p>
                ) : (
                  expansions.map((exp) => (
                    <div
                      key={exp.id}
                      onClick={user ? () => handleToggleExpansion(exp) : undefined}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-surface)',
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-transform ${
                        user ? 'cursor-pointer active:scale-[0.99]' : ''
                      }`}
                    >
                      <span className="text-xs font-semibold">{exp.title}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                          exp.is_owned
                            ? 'bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black border-transparent'
                            : 'bg-[var(--bg-surface-elevated)] border-[var(--border-surface-elevated)] text-[var(--text-muted)]'
                        }`}
                      >
                        {exp.is_owned ? 'Owned' : 'Wanted'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Plays Section */}
          <div className="border-t border-[var(--border-surface)] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold">Plays</h3>
                <p className="text-xs text-[#536482] dark:text-[#6e82a3] mt-0.5">
                  {plays.length > 0 ? `${plays.length} logged` : 'Nothing logged'}
                </p>
              </div>
              {game.status === 'owned' && user && (
                <button
                  onClick={() => setIsLoggingPlay(true)}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-surface-elevated)',
                  }}
                  className="h-8 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <PlusIcon size={13} />
                  <span>Log</span>
                </button>
              )}
            </div>

            {/* In-Card Play Logging Form */}
            {isLoggingPlay && user && (
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
                      onClick={() => setPlayerCount(Math.max(1, playerCount - 1))}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95"
                    >
                      <MinusIcon size={14} />
                    </button>
                    <span className="font-display text-lg font-bold">{playerCount}</span>
                    <button
                      onClick={() => setPlayerCount(playerCount + 1)}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold active:scale-95"
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
                    disabled={isSavingPlay}
                    className="flex-1 py-2.5 rounded-xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black text-xs font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {isSavingPlay ? 'Saving...' : editingPlayId ? 'Save changes' : 'Save play'}
                  </button>
                </div>
              </div>
            )}

            {/* List of Previous Play Sessions */}
            {plays.length === 0 && !isLoggingPlay ? (
              <p className="text-xs italic text-[#8b9bb5] dark:text-[#55698a]">No plays logged yet.</p>
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
                    {user && (
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

          {/* Footer Management Actions */}
          <div className="pt-2 space-y-3">
            {user && (
              <button
                onClick={handleRemoveGame}
                className="w-full text-center text-xs font-bold text-[#ff336d] py-2 hover:underline"
              >
                Remove game
              </button>
            )}
          </div>
        </div>

        {/* Floating Bottom Navigation */}
        <nav className="fixed bottom-5 left-0 right-0 z-40 max-w-sm mx-auto px-4">
          <div
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-surface)' }}
            className="backdrop-blur-xl border p-1.5 rounded-2xl flex items-center justify-between shadow-2xl"
          >
            <Link
              href="/"
              className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black shadow-lg"
            >
              <BookIcon size={16} />
              <span>Collection</span>
            </Link>
            <Link
              href="/?tab=wanted"
              className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#536482] dark:text-[#8ba2c4] hover:text-white"
            >
              <HeartIcon size={16} />
              <span>Wanted</span>
            </Link>
            <Link
              href="/?tab=add"
              className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#536482] dark:text-[#8ba2c4] hover:text-white"
            >
              <PlusCircleIcon size={16} />
              <span>Add</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}