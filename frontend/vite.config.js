import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // In development, proxy API calls to backend
        '/auth': 'http://localhost:3001',
        '/health': 'http://localhost:3001',
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
        },
      }
    },
    build: {
      outDir: '../backend/public',
      emptyOutDir: true,
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        }
      }
    },
    base: '/', // Use absolute paths for assets
  }
})
