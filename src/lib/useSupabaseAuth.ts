'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let receivedAuthEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      if (isMounted) {
        setUser(session?.user ?? null);
        setErrorMessage(null);
        setIsLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted || receivedAuthEvent) return;
      if (error) {
        console.error('Could not restore Supabase session:', error);
        setErrorMessage(error.message);
      }
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    }).catch((error: unknown) => {
      if (!isMounted || receivedAuthEvent) return;
      console.error('Could not restore Supabase session:', error);
      setErrorMessage('Could not restore the login session.');
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, isLoading, errorMessage };
}
