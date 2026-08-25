import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      workbox: {
        // Cache the static application shell for offline use. Vite's
        // production filenames are content-hashed, so changed JS/CSS files
        // receive new URLs automatically on each deployment.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],

        // Remove obsolete Workbox precache entries/caches after a new service
        // worker activates. This only manages the PWA's own precache; it does
        // not clear localStorage, IndexedDB, Firebase Auth, or user data.
        cleanupOutdatedCaches: true,

        // Let the newly activated worker take control of open tabs without
        // requiring a second navigation. Authentication and application state
        // remain outside the service-worker cache.
        clientsClaim: true,

        // Ensure client-side routing fallback works offline.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'ArchiWiki',
        short_name: 'ArchiWiki',
        description: 'An elegant, zero-knowledge encrypted Markdown note-taking PWA.',
        theme_color: '#F5F2EB',
        background_color: '#F5F2EB',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  }
});
