import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Whisper Transcriber · AIEH',
        short_name: 'Whisper',
        description: 'Trascrizione audio privata con OpenAI Whisper.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0d0f',
        theme_color: '#0b0d0f',
        lang: 'it',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
