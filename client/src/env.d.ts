/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build do jogo (tag, commits desde ela e hash), passado pelo scripts/site.mjs; ausente em dev. */
  readonly VITE_BUILD?: string;
  /** Servidor público do multiplayer (wss://…), da variável GAME_SERVER_URL do GitHub; ausente = sem botão online. */
  readonly VITE_GAME_SERVER?: string;
  /** `1`: o site publicado aceita `?comandante=1` (enquanto se desenvolve). Ausente ou `0`: só a conta de administrador abre o modo Comandante (o lançamento). O `publicar-site` o liga, salvo `"comandantePorLink": false`. */
  readonly VITE_COMANDANTE_POR_LINK?: string;
}
