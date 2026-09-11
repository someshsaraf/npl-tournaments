import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // kb/ (broadband firmware boilerplate) and .cursor/ (symlinks to an
    // external cursor-utilities checkout) both contain symlink loops that
    // crash Vite's file watcher (ELOOP / ENAMETOOLONG) unless excluded.
    watch: {
      ignored: ['**/kb/**', '**/.cursor/**', '**/npl/**'],
    },
  },
})
