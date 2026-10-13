import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Caminhos relativos: o app funciona hospedado em qualquer pasta (ex.: GitHub Pages).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Torna o app instalável no celular e utilizável sem internet.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Controle de Gastos',
        short_name: 'Gastos',
        description: 'Controle de gastos e orçamento familiar',
        lang: 'pt-BR',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  server: { port: 5173 },
  test: { include: ['src/**/*.test.ts'] },
})
