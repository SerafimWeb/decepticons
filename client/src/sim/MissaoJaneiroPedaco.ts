/**
 * O PEDAÇO SOB DEMANDA DA MISSÃO DO 8 DE JANEIRO (P217): a multidão (`Multidao`) e a regra (`MissaoJaneiro`) só baixam para quem abre a Praça. O `Match` os recebe por
 * `mapasSobDemanda.exigirMissaoJaneiro()` (carregado junto com o mapa por `carregarMapaSeFor('janeiro')`, no cliente, no servidor e nos testes); o pacote de partida (o teto de 500 KB,
 * `npm run peso`) não paga por eles na Cidade Neon. Este arquivo só reexporta: quem o importa de verdade é `mapasSobDemanda.ts`, por `import()`.
 */
export { Multidao } from './Multidao';
export * from './MissaoJaneiro';
export * from './ChefePneu';
