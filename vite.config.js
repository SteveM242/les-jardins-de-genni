import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // En développement, les appels /api (et les fichiers SEO) vont vers le serveur Express.
    proxy: {
      '/api': 'http://localhost:4173',
      '/robots.txt': 'http://localhost:4173',
      '/sitemap.xml': 'http://localhost:4173',
    },
  },
})
