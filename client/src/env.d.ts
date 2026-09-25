/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build do jogo (tag, commits desde ela e hash), passado pelo scripts/site.mjs; ausente em dev. */
  readonly VITE_BUILD?: string;
}
