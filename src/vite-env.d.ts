/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the AnnealMusic backend API (empty ⇒ pure-client build). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
