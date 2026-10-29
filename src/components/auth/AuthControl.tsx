'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogIn, LogOut, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthControlProps {
  user: User | null;
  isLoading: boolean;
  authError?: string | null;
}

export function AuthControl({ user, isLoading, authError }: AuthControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setPassword('');
      setIsOpen(false);
    } catch (error) {
      console.error('Supabase sign-in failed:', error);
      setErrorMessage('Could not sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Supabase sign-out failed:', error);
      setErrorMessage('Could not sign out. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
        aria-label={user ? 'Account and sign out' : 'Sign in'}
        aria-haspopup="dialog"
        title={user?.email ?? (isLoading ? 'Checking login status' : 'Sign in')}
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-surface-elevated)',
          color: 'var(--text-primary)',
        }}
        className="w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform"
      >
        {user ? <UserRound size={18} /> : <LogIn size={18} />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-surface)',
              color: 'var(--text-primary)',
            }}
            className="w-full max-w-sm rounded-3xl border p-6 shadow-2xl"
          >
            <h2 id="auth-dialog-title" className="font-display text-xl font-black">
              {user ? 'Your account' : 'Sign in'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {user ? 'Signed in with this Supabase account.' : 'Sign in to manage your collection.'}
            </p>

            {(errorMessage || authError) && (
              <p className="mt-4 text-xs font-semibold text-[#ff336d]" role="alert">
                {errorMessage ?? authError}
              </p>
            )}

            {user ? (
              <div className="mt-5 space-y-4">
                <p className="break-all text-sm font-semibold">{user.email}</p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-2xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"
                >
                  <LogOut size={15} />
                  {isSubmitting ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="mt-5 space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Email</span>
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[var(--border-surface-elevated)] bg-[var(--bg-surface-elevated)] px-3 text-sm focus:outline-none"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-xl border border-[var(--border-surface-elevated)] bg-[var(--bg-surface-elevated)] px-3 text-sm focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="w-full h-11 rounded-2xl bg-[#0e8396] text-white dark:bg-[#38e1ff] dark:text-black text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="mt-3 w-full py-2 text-xs font-semibold text-[var(--text-muted)] disabled:opacity-50"
            >
              Close
            </button>
          </section>
        </div>
      )}
    </>
  );
}
