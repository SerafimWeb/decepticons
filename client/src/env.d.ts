/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build do jogo (tag, commits desde ela e hash), passado pelo scripts/site.mjs; ausente em dev. */
  readonly VITE_BUILD?: string;
  /** Servidor público do multiplayer (wss://…), da variável GAME_SERVER_URL do GitHub; ausente = sem botão online. */
  readonly VITE_GAME_SERVER?: string;
}
