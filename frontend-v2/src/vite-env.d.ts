/// <reference types="vite/client" />

// .env에 넣는 값 (frontend/.env.example 참고)
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_VWORLD_KEY: string
  readonly VITE_VWORLD_DOMAIN?: string // V-WORLD 인증키에 등록한 도메인 (기본 jbnu-nonstop.vercel.app)
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
