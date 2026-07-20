import type { MetadataRoute } from 'next';

/** Installable tier only (no offline — deliberate; offline capture would mean
 *  local queueing + sync, a separate architecture decision). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PLOT',
    short_name: 'PLOT',
    description: 'Rapid capture, later organization.',
    start_url: '/',
    display: 'standalone',
    // light-theme tokens (background oklch(1 0 0), foreground oklch(0.145 0 0));
    // the standalone title bar follows the viewport themeColor at runtime
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
