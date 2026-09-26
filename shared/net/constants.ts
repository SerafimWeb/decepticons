/**
 * Ritmos e tetos da rede (metas do G11 a G14 e do MULTIPLAYER.md). Fonte única para o servidor, o cliente, os
 * testes de tamanho e o site. Sem nenhuma dependência: o servidor importa direto.
 */

/** Versão do protocolo: cliente e servidor de versões diferentes não conversam (o servidor recusa). */
export const PROTOCOL_VERSION = 1;

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
/** Unidades numa sala cheia: os 8 Mechs, até 3 andróides e o técnico (os limites das configurações). */
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
/** Moldura do WebSocket e do Colyseus sobre cada mensagem (~20%). */
export const WIRE_OVERHEAD = 1.2;

/** Apelido: até 16 caracteres. Montagem (`loadoutKey`): até 48. Código da sala: até 12. */
export const NAME_MAX = 16;
export const BUILD_MAX = 48;
export const ROOM_MAX = 12;
