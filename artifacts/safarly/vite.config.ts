import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT ?? 5173);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

/**
 * Optional dev-only proxy to the API server, so `fetch("/api/...")` works
 * without configuring VITE_API_URL or hitting CORS. Off by default because the
 * app's lib/auth-api.ts and lib/vision-api.ts already call an absolute URL
 * (default http://localhost:8080) directly — the api-server's CORS config
 * already allows any http://localhost:<port> origin in dev, credentials
 * included, so nothing requires the proxy to work.
 *
 * Set VITE_USE_API_PROXY=true if you'd rather route through it (e.g. to avoid
 * CORS entirely, or when testing from a device where localhost:8080 isn't
 * reachable but the Vite dev server is proxied through something else) — then
 * also set VITE_API_URL="" so the client library calls relative /api paths.
 */
const useApiProxy = process.env.VITE_USE_API_PROXY === 'true';
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

/**
 * PWA / installable-app config.
 *
 * The offline story this buys: the whole app shell plus every lazy route chunk
 * is precached at install time, and the POI/dish/phrase datasets are plain
 * imports so they are already inside those chunks. A traveller who opens the
 * app once before flying keeps their itinerary, the dialect phrasebook and the
 * destination browser after landing with no roaming data. What does NOT survive
 * going offline is anything that needs the API — trip enrichment, the
 * Concierge, Live Lens vision — and map tiles beyond the ones already panned
 * over. That split is deliberate: those routes already degrade gracefully (see
 * "Trip enrichment" and "Dialect coach" in CLAUDE.md), so leaving them
 * uncached fails the same way it already does rather than serving a stale lie.
 */
const pwa = VitePWA({
  registerType: 'prompt',
  // Registration is done by hand in `components/PWAProvider.tsx` so the update
  // and offline-ready states can drive real UI instead of a silent swap.
  injectRegister: null,

  manifest: {
    id: basePath,
    name: 'Safarly — Travel Companion',
    short_name: 'Safarly',
    description:
      'Plan Saudi trips, browse destinations, scan menus with Live Lens, and learn local dialect phrases.',
    start_url: basePath,
    scope: basePath,
    display: 'standalone',
    // No `orientation` lock on purpose: the itinerary map and the 2030 Vision
    // page both read better in landscape, and locking portrait would also
    // fight tablet installs.
    background_color: '#0A0E16',
    theme_color: '#0A0E16',
    lang: 'en',
    dir: 'ltr',
    categories: ['travel', 'navigation', 'lifestyle'],
    icons: [
      { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: 'icons/pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Long-press shortcuts on the home-screen icon. These mirror BottomNav
    // rather than the full Navbar — the same four things a traveller reaches
    // for mid-trip.
    shortcuts: [
      { name: 'Plan a trip', short_name: 'Plan', url: `${basePath}planner`.replace('//', '/') },
      { name: 'My itinerary', short_name: 'Itinerary', url: `${basePath}itinerary`.replace('//', '/') },
      { name: 'Live Lens', short_name: 'Lens', url: `${basePath}lens`.replace('//', '/') },
      { name: 'Dialect coach', short_name: 'Dialect', url: `${basePath}dialect`.replace('//', '/') },
    ],
  },

  workbox: {
    // Precache the shell and every route chunk. woff2 is listed even though the
    // fonts are currently loaded from Google's CDN (and handled by the runtime
    // rule below) so self-hosting them later doesn't silently drop them.
    globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
    navigateFallback: `${basePath}index.html`.replace('//', '/'),
    // The SPA fallback must never swallow an API call. Same reasoning as the
    // `_redirects` rewrite, which has the same blind spot on the host side.
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
    // Leaflet is the single biggest chunk in the build and sits comfortably
    // under this; the ceiling is here to make a runaway bundle fail loudly at
    // build time rather than quietly stop being available offline.
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

    runtimeCaching: [
      {
        // Google Fonts stylesheet — revalidate so a font-stack change lands,
        // but never block first paint on the network.
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-stylesheets' },
      },
      {
        // The font files themselves are immutable and versioned in the URL.
        urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
          // Font requests are opaque cross-origin responses (status 0); without
          // this they would never be considered cacheable.
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // OSM raster tiles for the itinerary map. Capped hard: a few days of
        // panning around 16 cities would otherwise grow without bound, and the
        // OSM tile usage policy expects clients to cache rather than re-fetch.
        urlPattern: ({ url }) => /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'osm-tiles',
          expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },

  // Off in dev: a service worker caching a Vite dev server is a debugging trap,
  // and every PWA surface here can be exercised against `pnpm run serve`.
  devOptions: { enabled: false },
});

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: useApiProxy
      ? {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
          },
        }
      : undefined,
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
