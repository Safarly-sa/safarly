import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
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
