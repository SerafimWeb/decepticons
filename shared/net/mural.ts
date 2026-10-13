import { fromAngle, fromCm, fromFrac, Reader, toAngle, toCm, toFrac, type Writer } from './codec';
import { MAX_UNITS, ROOM_MAX } from './constants';
import { MSG, UNIT_KINDS, messageType, type UnitKind } from './messages';

/**
 * O mural de câmeras (P88): **um canal só** por onde o Comandante vê todas as partidas ao mesmo tempo, em radares. É uma conexão WebSocket
 * própria (`/?mural=1`) que pede com o token do dono (o mesmo de `/admin/*`) e recebe, a `MURAL_HZ` por segundo, o que um radar precisa de
 * cada sala: quem é, onde está, para onde olha e se está vivo.
 *
 * **Por que não um observador por sala:** um estado de jogo inteiro custa uns 8 KB/s por sala (meta G11) e uma conexão por sala bate no teto
 * por IP; o mural custa 8 bytes por unidade a 4 Hz (~0,5 KB/s por sala cheia) e uma conexão só. Quem quiser a câmera 3D de uma sala
 * (`OBSERVAR`) é outra peça, uma sala por vez. **Observar não é jogar:** o mural não ocupa vaga, não aparece no placar nem na contagem do
 * `/status`, e não manda comando nenhum. **Observar não é gravar:** nada disto vai para disco.
 *
 * Mensagens novas, sem subir o `PROTOCOL_VERSION`: um cliente de jogo nunca manda `MURAL_PEDIR` e o servidor só manda `MURAL` a quem pediu
 * com o token, então cliente e servidor de versões diferentes continuam se entendendo.
 */
export const MURAL_HZ = 4;
/** Quantas salas cabem num quadro do mural (as com mais gente primeiro); o resto é cortado. */
export const MURAL_SALAS_MAX = 8;
/** O token do dono (hexadecimal de 48 caracteres, ou o que o dono pôs na variável): até este tamanho. */
export const MURAL_TOKEN_MAX = 80;
/** Fechamentos que o servidor usa e o cliente entende (códigos de aplicação, 4000 a 4999): token errado, IP bloqueado e porta desligada. */
export const MURAL_FECHOU = { token: 4003, bloqueado: 4004, desligado: 4005 } as const;

/** Uma unidade no radar: tipo, onde está (m), para onde olha (rad), a vida do tronco (0 a 1) e se está viva. */
export interface MuralUnidade {
  tipo: UnitKind;
  x: number;
  z: number;
  yaw: number;
  vida: number;
  viva: boolean;
}

/** Uma sala no mural. Só as primeiras `n` unidades valem (o servidor reaproveita o vetor a cada quadro: G4). */
export interface MuralSala {
  codigo: string;
  jogadores: number;
  rodada: number;
  restanteS: number;
  jogando: boolean;
  n: number;
  unidades: MuralUnidade[];
}

export const newMuralUnidade = (): MuralUnidade => ({ tipo: 'mech', x: 0, z: 0, yaw: 0, vida: 1, viva: true });

/** Uma sala vazia com o espaço das unidades já feito (o servidor cria `MURAL_SALAS_MAX` delas uma vez e reaproveita). */
export function newMuralSala(): MuralSala {
  return { codigo: '', jogadores: 0, rodada: 0, restanteS: 0, jogando: false, n: 0, unidades: Array.from({ length: MAX_UNITS }, newMuralUnidade) };
}

const VIVA = 4;
const reader = new Reader();

/** Cliente → servidor: o pedido do mural, com o token do dono (o token vai na mensagem, nunca no endereço, que costuma ir para o log). */
export function encodeMuralPedido(w: Writer, token: string): Uint8Array {
  return w.reset().u8(MSG.MURAL_PEDIR).str(token, MURAL_TOKEN_MAX).done();
}

export function decodeMuralPedido(bytes: Uint8Array): string | null {
  if (messageType(bytes) !== MSG.MURAL_PEDIR) return null;
  const r = reader.set(bytes);
  r.u8();
  const token = r.str(MURAL_TOKEN_MAX);
  return r.clean && token ? token : null;
}

/**
 * Servidor → cliente: as primeiras `n` salas do vetor. Sem alocação: escreve no buffer do `Writer`, que o servidor reaproveita.
 * Posição em centímetros (±327 m), ângulo em 16 bits, vida em 8 bits; o tipo e "viva" dividem um byte.
 */
export function encodeMural(w: Writer, salas: readonly MuralSala[], n: number): Uint8Array {
  const total = Math.min(n, MURAL_SALAS_MAX, salas.length);
  w.reset().u8(MSG.MURAL).u8(total);
  for (let i = 0; i < total; i++) {
    const s = salas[i]!;
    const un = Math.min(s.n, MAX_UNITS);
    w.str(s.codigo, ROOM_MAX).u8(s.jogadores).u8(Math.min(255, s.rodada)).u16(Math.min(65535, s.restanteS)).u8(s.jogando ? 1 : 0).u8(un);
    for (let j = 0; j < un; j++) {
      const u = s.unidades[j]!;
      w.u8(UNIT_KINDS.indexOf(u.tipo) | (u.viva ? VIVA : 0))
        .i16(toCm(u.x))
        .i16(toCm(u.z))
        .u16(toAngle(u.yaw))
        .u8(toFrac(u.vida));
    }
  }
  return w.done();
}

/** Lê um quadro do mural. Mensagem torta, sala demais ou unidade demais: `null` (nada é aceito pela metade). A resposta é nova (o cliente guarda). */
export function decodeMural(bytes: Uint8Array): MuralSala[] | null {
  if (messageType(bytes) !== MSG.MURAL) return null;
  const r = reader.set(bytes);
  r.u8();
  const total = r.u8();
  if (total > MURAL_SALAS_MAX) return null;
  const salas: MuralSala[] = [];
  for (let i = 0; i < total; i++) {
    const codigo = r.str(ROOM_MAX);
    const jogadores = r.u8();
    const rodada = r.u8();
    const restanteS = r.u16();
    const jogando = r.u8() === 1;
    const n = r.u8();
    if (r.bad || n > MAX_UNITS) return null;
    const unidades: MuralUnidade[] = [];
    for (let j = 0; j < n; j++) {
      const b = r.u8();
      const tipo = UNIT_KINDS[b & 3];
      const x = fromCm(r.i16());
      const z = fromCm(r.i16());
      const yaw = fromAngle(r.u16());
      const vida = fromFrac(r.u8());
      if (!tipo || r.bad) return null;
      unidades.push({ tipo, x, z, yaw, vida, viva: (b & VIVA) !== 0 });
    }
    salas.push({ codigo, jogadores, rodada, restanteS, jogando, n, unidades });
  }
  return r.clean ? salas : null;
}
