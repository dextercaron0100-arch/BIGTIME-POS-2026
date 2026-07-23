import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          router: ['react-router-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
          table: ['@tanstack/react-table'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
