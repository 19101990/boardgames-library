'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Could not register the service worker:', error);
    });
  }, []);

  return null;
}
