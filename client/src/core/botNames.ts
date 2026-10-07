/**
 * Nomes padrão das IAs, dos aliados e do técnico, na ordem em que entram na arena. São paródias das IAs de verdade
 * (dono, 25/09: "chad-gpt, geminai, kuen, dipsik: nomes meio engraçados, que as pessoas entendam a alusão"), no lugar
 * das marcas registradas. Viram o padrão de `GameSettings.names`: o jogador troca cada um em Configurações > Inimigos.
 * Fica fora do combate e das configurações de propósito: os dois importam daqui, e nenhum importa o outro.
 */
export const BOT_NAMES = {
  mechs: ['CLAWD', 'GEMINAI', 'CHAD-GPT'],
  androids: ['KUEN', 'DIPSIK', 'MISTRAU'],
  technicians: ['ENTRÓPICO'],
  allies: ['ESCOLTA·PLASMA', 'SUPRESSOR·EMP'],
} as const;

/** Tamanho máximo de um nome (cabe na etiqueta sobre o robô). */
export const NAME_MAX = 16;
