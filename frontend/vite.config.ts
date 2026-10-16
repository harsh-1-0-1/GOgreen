import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)/,
              priority: 30,
            },
            {
              name: 'data-vendor',
              test: /node_modules[\\/](@tanstack|zustand)/,
              priority: 20,
            },
            {
              name: 'forms-vendor',
              test: /node_modules[\\/](react-hook-form|@hookform|zod)/,
              priority: 20,
            },
            {
              name: 'icons',
              test: /node_modules[\\/]lucide-react/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
    },
  },
})
