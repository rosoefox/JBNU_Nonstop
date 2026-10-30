import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 기존 화면(frontend, 5173)과 동시에 띄울 수 있게 다른 포트
  server: { port: 5174 },
})
