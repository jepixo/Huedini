/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  // add any other custom env vars you use
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
