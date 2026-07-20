/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API server. See lib/auth-api.ts and lib/vision-api.ts. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
