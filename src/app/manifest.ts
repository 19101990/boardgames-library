import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Board Game Shelf',
    short_name: 'Game Shelf',
    description: 'Your personal board game collection and play tracker.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#070913',
    theme_color: '#070913',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
