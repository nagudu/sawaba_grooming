import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
// PWA note: manifest (public/manifest.webmanifest) and service worker
// (public/sw.js) are plain static files — no plugin needed. workbox-build
// cannot generate a SW on machine paths containing apostrophes (this
// project lives under "Halifa Shu'aibu"), so public/sw.js is hand-written.
export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, resolve(process.cwd(), 'backend'), '')
  const backendPort = Number(process.env.PORT || backendEnv.PORT) || 5001
  const backendTarget = `http://127.0.0.1:${backendPort}`

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Build output and QA scratch live inside the project root, so chokidar
      // watches them by default. Every `npm run build` then fires a burst of HMR
      // updates and even full page reloads (deploy/spa/index.html) in a running
      // dev server. None of it affects the app, so ignore it outright.
      watch: {
        ignored: [
          '**/dist/**',
          '**/deploy/**',
          '**/.freebuff/**',
          '**/node_modules/**',
          '**/backend/uploads/**',
          '**/.git/**',
        ],
      },
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        // Locally uploaded images live on the backend (offline-first storage)
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
