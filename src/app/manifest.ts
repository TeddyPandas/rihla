import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ziyara Fès 2026 — Suivi de Zikr',
    short_name: 'Ziyara Fès',
    description: 'Suivi collectif et hors-ligne des zikr pour la ziyara à Fès (19–27 déc. 2026)',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF7F0',
    theme_color: '#0E4D3E',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
