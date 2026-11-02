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
// 16 (12/10): o míssil teleguiado entra em `NET_WEAPONS` (o lançamento é um evento de tiro como o dos foguetes; a curva é só do servidor); um cliente da versão 15 recusaria o tiro como evento ruim.
// 17 (12/10): a montagem ganha o layout de gatilhos (Ataque 1 e Ataque 2: `L1` é o último grupo da chave v2 do JOIN e do roster, `hangar/loadout.ts`); um servidor da versão 16 não reconheceria a chave e recusaria a montagem.
// 18 (15/10): o lançador de mísseis leve (`swarm`), o míssil cruzador (`cruise`) e o raio laser (`laser`) entram em `NET_WEAPONS` (um evento de tiro por míssil e por pulso de feixe, 7 bytes cada); o canhão de cerco (`siege`) também, porque o evento dele saía com índice -1 e o leitor da versão 17 recusava o pacote inteiro. Um cliente da versão 17 recusaria o tiro como evento ruim.
// 19 (16/10): o lança-granadas (`grenade`, P160) entra em `NET_WEAPONS`; o evento de tiro leva a direção até a mira (como o do cruzador) e o cliente refaz o arco. Um cliente da versão 18 recusaria o tiro como evento ruim.
// 20 (17/10): o arpão magnético (`harpoon`, P77) entra em `NET_WEAPONS` (o disparo é um evento de tiro por ombro; o puxão é só do servidor e chega pelo estado dos robôs); um cliente da versão 19 recusaria o tiro como evento ruim.
// 21 (19/10): a conexão leva o mapa da sala (`&mapa=`, P218 etapa O1, `shared/net/mapa.ts`); um servidor da versão 20 ignoraria o pedido e poria o jogador na Cidade Neon enquanto o cliente monta outro chão.
// 22 (22/10): o lançador de gás (`gas`, P243) entra em `NET_WEAPONS` (a nuvem é um evento de tiro, igual ao canhão sônico); um cliente da versão 21 recusaria o tiro como evento ruim.
// 23 (23/10): a sala online aceita o modo Sobrevivência (`&modo=survival`, P243): o 8 de Janeiro em coop. Dois eventos novos (figurante morreu/fugiu da multidão, nunca a posição dela: G11) e a unidade `faxineiro`
// entram no catálogo (`UNIT_KINDS`); um cliente da versão 22 recusaria o evento como ruim e desenharia o faxineiro como andróide de combate. Mensagem nova `JANEIRO_MULTIDAO`: quem entra no meio da missão recebe o
// estado compacto da multidão (mortos e fugas); um servidor da versão 22 não a manda, e o jogador vê quem já morreu ou fugiu ainda de pé até o próximo evento dele.
// 24 (28/10): a Cidade Neon ganha a praça urbana (P268, `environment/ArenaUrbana.ts`): nove prédios, cinco contêineres, o playground e dois quiosques que quebram (ids 6 e 7 depois das seis barricadas de sempre).
// Não muda mensagem nenhuma, mas muda o chão que os dois lados simulam: um cliente da versão 23 preveria o Mech atravessando um prédio que o servidor da 24 trata como sólido (o jogador "puxado de volta"
// a cada passo) e não entenderia o `PROP_BROKEN` de um quiosque. Recusar a conexão e pedir para recarregar é o que o contador de versão existe para fazer.
// 25 (01/11, P305): a cor do casco vai na montagem (o sufixo `.P<n>` da chave, `hangar/loadout.ts`), no JOIN e no roster; o teto da chave sobe para 128 caracteres (BUILD_MAX), porque a montagem mais cheia já passava de 80 (o Colossus com os 5 botões no 2 e a visão mede 94, e com a cor 97).
// Um servidor da versão 24 recusaria a montagem pintada e não lê a chave maior; sem a subida, o jogador veria a cor de outro piloto como montagem inválida.
export const PROTOCOL_VERSION = 25;

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
/**
 * Os robôs de combate que o esquadrão do dono pode pôr numa sala online (P273, 29/10: "será q precisamos manter o limite de 3 mechs e 3 androides?"): até 6 Mechs e 6 andróides.
 * Os Mechs de fora cedem a vaga a quem entra (humanos + Mechs de fora nunca passam de `ROOM_SIZE`); os andróides e o técnico ficam sempre.
 */
export const ROOM_BOT_MECHS = 6;
export const ROOM_BOT_ANDROIDS = 6;
/**
 * Unidades numa sala cheia: 8 Mechs (humanos + bots), os andróides e o técnico, no pior caso de qualquer número de humanos (de 1 a 8: 14 ou 15). É **exatamente o que cabe nos 8 KB/s por jogador**
 * (G11, `unitsWithinBudget`): medido em 29/10, o servidor gasta 0,3 a 0,8 ms por tick com até 26 unidades e a GPU integrada (Vega 11) desenha 13 robôs tão bem quanto 7;
 * o que limita é a banda. Passar daqui pede mandar só a mudança (delta) ou subir a meta de banda, e isso é decisão do dono (`CAPACIDADE.md`).
 */
export const ROOM_UNITS = ROOM_SIZE + ROOM_BOT_ANDROIDS + 1;
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

/**
 * Reinício do servidor com gente jogando (P204). Antes de cortar, o servidor manda o aviso `AVISO` e espera `REINICIO_AVISO_S`
 * (dá tempo de terminar o que se faz); corta com o código `CLOSE_REINICIO` (4000 a 4999 é da aplicação) e o motivo do corte é o
 * tempo previsto de volta, em segundos. Sem ninguém na sala, reinicia na hora. `REINICIO_VOLTA_EM_S` é o que o jogador lê como
 * "volta em cerca de": medido nos deploys de 18/10, o servidor levou de 16 a 50 s para religar (a tela continua tentando se passar).
 */
export const CLOSE_REINICIO = 4010;
export const REINICIO_AVISO_S = 10;
export const REINICIO_VOLTA_EM_S = 60;

/** Apelido: até 16 caracteres. Montagem (`loadoutKey`): até 128 (`BUILD_MAX`). Código da sala: até 12. */
export const NAME_MAX = 16;
/**
 * O tamanho máximo da montagem no JOIN e no roster (a chave de texto de `hangar/loadout.ts`). 128 desde a versão 25 (P305). Medido: a pior montagem válida
 * (Colossus-01, os cinco botões no 2, visão, railgun, cor 6) tem 97 caracteres. Acima do teto o `Writer` corta o texto em silêncio, então o teto tem folga.
 */
export const BUILD_MAX = 128;
export const ROOM_MAX = 12;
