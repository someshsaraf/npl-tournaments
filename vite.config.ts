import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { SITE_BACKGROUND_URL, siteNames } from './src/data/site.js'

// In dev, the API/realtime server (server/index.ts) runs separately on
// PORT (default 8787); Vite forwards these paths to it. `npm run dev` starts both.
const apiTarget = `http://localhost:${process.env.PORT || 8787}`

/**
 * Dev only: fill in the society name the way the server does for the built
 * site (server/site.ts). The production build keeps the __SOCIETY_NAME__
 * placeholder, which the server replaces on every request.
 */
function devSiteConfig(): Plugin {
  return {
    name: 'dev-site-config',
    apply: 'serve',
    transformIndexHtml(html) {
      const env = loadEnv('development', process.cwd(), '')
      const names = siteNames(env.SOCIETY_NAME, env.SOCIETY_SHORT_NAME, env.LEAGUE_NAME)
      const { name } = names
      // The background route answers 404 when none is chosen; the page copes.
      const site = JSON.stringify({ ...names, background: SITE_BACKGROUND_URL }).replace(/</g, '\\u003c')
      return html
        .replace(/__SOCIETY_NAME__/g, name.replace(/[<>&"]/g, ''))
        .replace('</head>', `<script>window.__SITE__=${site}</script>\n</head>`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devSiteConfig()],
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
