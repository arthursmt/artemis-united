import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin pro browser -> cookie de sessão (sem Domain setado, ver
    // apps/api/src/auth/cookies.ts) funciona sem CORS. Só dev-server; produção
    // precisa de outra estratégia (fora de escopo desta etapa).
    proxy: {
      '/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
