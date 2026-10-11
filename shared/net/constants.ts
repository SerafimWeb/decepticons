/**
 * Ritmos e tetos da rede (metas do G11 a G14 e do MULTIPLAYER.md). Fonte única para o servidor, o cliente, os
 * testes de tamanho e o site. Sem nenhuma dependência: o servidor importa direto.
 */

/**
 * Versão do protocolo: cliente e servidor de versões diferentes não conversam (o servidor recusa).
 * 2 (03/10): a escopeta entra em `NET_WEAPONS`; um cliente da versão 1 recusaria o tiro dela como evento ruim.
 * 3 (04/10): a chuva de mísseis entra em `NET_WEAPONS`, pelo mesmo motivo.
 */
// 5 (06/10): módulo de energia, comando de escudo e energia do destinatário em 1 byte adicional por snapshot.
// 6 (06/10): catálogo inclui esfera; servidores antigos não validam esse módulo. Pacote mantém o tamanho.
// 7 (09/10): byte `fx` por unidade (fogo, choque, gelo; lança-chamas ligado; rotatória girando), presente só quando há algo ligado (bit das flags); +1 byte por unidade no pior caso.
// 8 (09/10): a metralhadora rotatória entra no catálogo de armas (montagem `rotary` no JOIN e na lista de jogadores); o tiro dela não vira evento (bandeira `fx`).
// 9 (09/10): a arma elétrica entra em `NET_WEAPONS` (o tiro dela é evento de tiro como o do plasma); um cliente da versão 8 recusaria o tiro como evento ruim.
// 10 (11/10): a arma de gelo entra em `NET_WEAPONS` (o tiro dela é evento de tiro como o do plasma); um cliente da versão 9 recusaria o tiro como evento ruim.
// 11 (11/10): o lança-chamas entra no catálogo de montagens (`flamer` no JOIN e no roster); o fluxo dele não vira evento (bandeira `flaming` do byte `fx`, que já existia) e o dano do cone é só do servidor. Um servidor antigo recusaria a montagem.
// 12 (11/10): o canhão pesado e o canhão automático entram em `NET_WEAPONS` (o tiro deles é evento de tiro como o do plasma); um cliente da versão 11 recusaria o tiro como evento ruim.
// 13 (11/10): o anel de fogo entra no catálogo de módulos de escudo (`fire` na montagem, no JOIN e no roster); o pulso é só do servidor e o desenho vem da bandeira de escudo ligado que já existia. Um servidor antigo recusaria a montagem.
// 14 (11/10): o evento de tiro diz de qual encaixe o tiro saiu (os 2 bits de cima do byte da arma, que cabe em 6 bits; o evento não cresce). Antes o outro jogador desenhava todo tiro da mão direita, e o Marauder (duas mãos, dois ombros) parecia atirar só por ela. Um cliente da versão 13 leria o encaixe como arma inválida.
// 15 (11/10): o canhão sônico entra em `NET_WEAPONS` (a onda é um evento de tiro, com o encaixe do ombro de onde saiu); um cliente da versão 14 recusaria o tiro como evento ruim.
export const PROTOCOL_VERSION = 15;

/** Tick fixo da simulação, igual no cliente e no servidor (G1). */
export const SIM_HZ = 60;
/** Estado do servidor para cada cliente (G11). */
export const SNAPSHOT_HZ = 20;
/** Pacotes de comando do cliente: 2 ticks por pacote. */
export const INPUT_HZ = 30;
export const INPUTS_PER_PACKET = SIM_HZ / INPUT_HZ;
/** Um pacote atrasado pode trazer mais ticks; acima disto, a mensagem é recusada. */
export const MAX_INPUTS_PER_PACKET = 8;

/** Mechs numa sala (humanos + bots completando). */
export const ROOM_SIZE = 8;
/** Unidades numa sala cheia: 8 Mechs (humanos + bots), até 3 andróides e o técnico. */
export const ROOM_UNITS = ROOM_SIZE + 3 + 1;
/** Teto de unidades num estado (Mechs, andróides, técnico): o id cabe em 1 byte e o buffer é fixo. */
export const MAX_UNITS = 32;
/** Teto de eventos num pacote de eventos. */
export const MAX_EVENTS = 64;
/** Id de "ninguém" (evento sem autor, como dano de explosão de barricada). */
export const NO_UNIT = 255;

/** Metas de banda por jogador (G11), em bytes por segundo. */
export const DOWNLOAD_BUDGET = 8 * 1024;
export const UPLOAD_BUDGET = 2 * 1024;
/** Moldura do WebSocket, TCP e TLS sobre cada mensagem (~20%). */
export const WIRE_OVERHEAD = 1.2;

/** Apelido: até 16 caracteres. Montagem (`loadoutKey`): até 80. Código da sala: até 12. */
export const NAME_MAX = 16;
export const BUILD_MAX = 80;
export const ROOM_MAX = 12;
