import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Don't throw on aborted connections — user switching modes mid-request
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return
            console.error('Proxy error:', err.message)
          })
        },
      },
    },
  },
})
