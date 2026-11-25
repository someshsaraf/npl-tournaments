import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, the API/realtime server (server/index.ts) runs separately on
// PORT (default 8787); Vite forwards these paths to it. `npm run dev` starts both.
const apiTarget = `http://localhost:${process.env.PORT || 8787}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': apiTarget,
      '/media': apiTarget,
      '/ws': { target: apiTarget, ws: true },
    },
    // kb/ (broadband firmware boilerplate) and .cursor/ (symlinks to an
    // external cursor-utilities checkout) both contain symlink loops that
    // crash Vite's file watcher (ELOOP / ENAMETOOLONG) unless excluded.
    // data/ is the local server's database + uploads.
    watch: {
      ignored: ['**/kb/**', '**/.cursor/**', '**/npl/**', '**/data/**'],
    },
  },
})
