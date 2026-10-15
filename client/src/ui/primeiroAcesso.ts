/**
 * O PRIMEIRO ACESSO (P133, decisão do Comandante em 15/10): *"o fluxo de primeiro acesso tem que ser chegando já numa partida, e se gostar,
 * vai continuar jogando e configurar pouco a pouco"*. Quem nunca jogou não vê o console inteiro (o mapa, o radar, os pilotos, a carreira, a
 * rede, as configurações: seis monitores e um seletor de operação, "o painel do mapa que assusta"); vê **o título, uma frase, o botão JOGAR e
 * "mais opções"**, com a cena da partida por trás. O resto (nome, robô, armas, mapa, configurações) vem depois, no ritmo dele: "MAIS OPÇÕES"
 * abre o console completo, e da segunda visita em diante ele já é o completo.
 *
 * Regra pura (G3): decide a partir do endereço e do armazenamento do navegador, sem tocar no DOM; o `CommandConsole` aplica.
 */

/** A marca de "já começou uma partida aqui" (ou já pediu o console inteiro). */
export const PRIMEIRA_KEY = 'cybermech.primeira.v1';

/**
 * O que o jogo só grava **depois que alguém jogou ou mexeu nele**: a progressão do piloto (grava ao fim de uma partida), as dicas já vistas, a
 * montagem do Hangar e as predefinições, o nome, a campanha, o esquadrão, as potências e o modo Comandante. Quem tem qualquer um destes **já
 * jogou antes** (o dono, os testadores): nunca cai na tela enxuta por engano. **As configurações (`cybermech.settings.v1`) não entram:** o
 * `SettingsStore` as grava em todo boot, então todo visitante as tem antes de o console nascer.
 */
export const SINAIS_DE_JOGO_ANTERIOR: readonly string[] = [
  'cybermech_pilot_progression',
  'cybermech.onboarding.v1',
  'cybermech.hangar.v1',
  'cybermech.hangar.presets.v1',
  'cybermech-name',
  'cybermech.campanhas.v1',
  'cybermech.esquadrao.v1',
  'cybermech.potencias.v1',
  'cybermech.comandante',
  'cybermech.comandante.v1',
  'cybermech.admin.token',
];

/** O pedaço do `Storage` que isto usa (e que o teste imita). */
export interface Armazem {
  getItem(chave: string): string | null;
}

/**
 * Esta visita é a primeira? `?console` (ou `?console=1`) força o console completo (para o dono e para os links de teste que querem a tela
 * toda); `?primeira` força a tela enxuta (para fotografar e testar); sem nenhum dos dois, vale o armazenamento: nenhuma marca e nenhum sinal
 * de jogo anterior = primeira visita. **Sem armazenamento** (navegador que bloqueia) conta como primeira: quem não guarda nada também não
 * vê o console inteiro a cada visita.
 */
export function ehPrimeiroAcesso(search: string, armazem: Armazem | null): boolean {
  const q = new URLSearchParams(search);
  if (q.has('console')) return false;
  if (q.has('primeira')) return true;
  try {
    if (!armazem) return true;
    if (armazem.getItem(PRIMEIRA_KEY)) return false;
    return !SINAIS_DE_JOGO_ANTERIOR.some((k) => armazem.getItem(k) !== null);
  } catch {
    return true;
  }
}
