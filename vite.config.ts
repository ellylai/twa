import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Add this proxy
    proxy: {
      // Proxy all requests starting with /api
      '/api': {
        target: 'http://localhost:3001', // Your Python server
        changeOrigin: true,
      }
    }
  }
})