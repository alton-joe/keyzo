import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The SPA talks to the ASP.NET Core API through a dev proxy (no CORS needed locally).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5080', changeOrigin: true },
    },
  },
})
