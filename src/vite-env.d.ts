/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the AnnealMusic backend API (empty ⇒ pure-client build). */
  readonly VITE_API_BASE?: string;
  /** Whether the build target is a mobile web bundle. */
  readonly VITE_MOBILE?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
