/// <reference types="vite/client" />

declare module "*.wasm?url" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  /** Dropbox OAuth app key (client_id) — public, safe to embed in the built bundle. Never the app secret. */
  readonly VITE_DROPBOX_APP_KEY: string;
  /** Must exactly match a redirect URI registered in the Dropbox App Console. */
  readonly VITE_DROPBOX_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

