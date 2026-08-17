declare module "*.svg?raw" {
  const source: string;
  export default source;
}

interface ImportMetaEnv {
  readonly VITE_COMMENT_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
