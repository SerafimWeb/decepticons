import type { Fala } from './CerebroDoTime';

/**
 * O que cada fala do cérebro do time diz na tela (ordem P269): curta, no tom do rádio de combate do feed ("◈ CLAWD: CONTATO ▸ VOCÊ"). A regra manda o **tipo** (`Fala`),
 * nunca o texto (a simulação não tem string); o `Game` junta `◈ NOME: TEXTO ▸ ALVO`. As traduções estão em `public/locales`, na forma `◈ {0}: TEXTO ▸ {1}`.
 */
export const FALA_TEXTO: Readonly<Record<Fala, string>> = {
  pinca: 'PINÇA PELO FLANCO',
  posicao: 'EM POSIÇÃO',
  vai: 'VAI! FOGO',
  reagrupar: 'REAGRUPAR',
};

/** Quem a fala aponta quando não há alvo (reagrupar: o time inteiro). */
export const FALA_SEM_ALVO = 'EQUIPE';
