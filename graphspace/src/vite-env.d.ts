/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPECSPACE_RELEASE_COMMIT?: string;
  readonly VITE_SPECSPACE_RELEASE_CREATED_AT?: string;
  readonly VITE_SPECSPACE_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
