import { fromAngle, fromCm, fromPitch, toAngle, toCm, toPitch, type Reader, type Writer } from './codec';

/**
 * Eventos do servidor (acerto, parte arrancada, abate, explosão, barricada, tiro, renascimento): o que o cliente
 * transforma em efeito, som e placar (MULTIPLAYER.md, seção 9, item 2). Cada evento tem um formato fixo.
 */
export const NET_WEAPONS = ['plasma', 'rockets', 'blaster', 'chainsaw', 'shotgun', 'barrage', 'railgun', 'emp', 'arc', 'cryo', 'cannon', 'autocannon', 'sonic', 'seeker', 'swarm', 'cruise', 'laser', 'siege', 'grenade', 'harpoon', 'gas'] as const;
export type NetWeapon = (typeof NET_WEAPONS)[number];

export const EVENT = {
  HIT: 1,
  PART_LOST: 2,
  KILL: 3,
  EXPLOSION: 4,
  PROP_BROKEN: 5,
  SHOT: 6,
  SPAWN: 7,
  /** Rodada nova no servidor: barricadas voltam, destroços somem. Sem payload. */
  ARENA_RESET: 8,
  /** Um figurante da multidão do 8 DE JANEIRO (P243) morreu pela mão do jogador: nunca a posição dela (G11), só o índice (`amount`, até 1.500: `Multidao.total`). O cliente aplica no espelho (`Multidao.aplicarMorte`). */
  FIGURANTE_MORREU: 9,
  /** Um figurante fugiu por causa do jogador (tiro ou susto; a fuga por ter cumprido o tempo na fachada é determinística e não gera evento). Mesmo formato do `FIGURANTE_MORREU`. */
  FIGURANTE_FUGIU: 10,
} as const;
export type EventKind = (typeof EVENT)[keyof typeof EVENT];

/** Bytes de cada tipo de evento, com o byte do tipo. */
export const EVENT_BYTES: Record<EventKind, number> = { 1: 6, 2: 3, 3: 3, 4: 8, 5: 3, 6: 7, 7: 2, 8: 1, 9: 3, 10: 3 };

/** Um evento num objeto reutilizado. Os campos que valem dependem do tipo (ver cada um). */
export interface NetEvent {
  kind: EventKind;
  /** HIT e PART_LOST: quem levou. KILL: quem caiu. SHOT: quem atirou. SPAWN: quem nasceu. */
  unit: number;
  /** HIT: quem atirou. KILL: quem derrubou (`NO_UNIT` = ninguém). SHOT: de qual encaixe o tiro saiu (posição em `MOUNTS`, de 0 a 3). */
  other: number;
  /** HIT e PART_LOST: posição em `NET_PARTS`. SHOT: posição em `NET_WEAPONS`. */
  index: number;
  /** HIT: dano (inteiro, até 65535). EXPLOSION: raio (m, passo de 0,1). PROP_BROKEN: id da barricada. FIGURANTE_MORREU/FIGURANTE_FUGIU: índice do figurante na `Multidao` (até 1.500). */
  amount: number;
  /** EXPLOSION: onde (m). */
  x: number;
  y: number;
  z: number;
  /** SHOT: direção do tiro. */
  yaw: number;
  pitch: number;
}

export function newNetEvent(): NetEvent {
  return { kind: EVENT.HIT, unit: 0, other: 0, index: 0, amount: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
}

export function writeEvent(w: Writer, e: NetEvent): void {
  w.u8(e.kind);
  switch (e.kind) {
    case EVENT.HIT:
      w.u8(e.unit).u8(e.other).u8(e.index).u16(Math.min(65535, Math.max(0, Math.round(e.amount))));
      break;
    case EVENT.PART_LOST:
      w.u8(e.unit).u8(e.index);
      break;
    case EVENT.KILL:
      w.u8(e.unit).u8(e.other);
      break;
    case EVENT.EXPLOSION:
      w.i16(toCm(e.x)).i16(toCm(e.y)).i16(toCm(e.z)).u8(Math.min(255, Math.max(0, Math.round(e.amount * 10))));
      break;
    case EVENT.PROP_BROKEN:
      w.u16(e.amount);
      break;
    case EVENT.SHOT:
      // O encaixe vai nos 2 bits de cima do byte da arma (as armas cabem em 6 bits: até 64): o evento não cresce.
      w.u8(e.unit).u8((e.index & 63) | ((e.other & 3) << 6)).u16(toAngle(e.yaw)).i16(toPitch(e.pitch));
      break;
    case EVENT.SPAWN:
      w.u8(e.unit);
      break;
    case EVENT.ARENA_RESET:
      break;
    case EVENT.FIGURANTE_MORREU:
    case EVENT.FIGURANTE_FUGIU:
      w.u16(e.amount);
      break;
  }
}

/** Lê um evento para dentro de `out`. Tipo desconhecido, ou índice de parte ou arma fora da lista: evento ruim. */
export function readEvent(r: Reader, out: NetEvent, parts: number): void {
  const kind = r.u8();
  out.kind = kind as EventKind;
  switch (kind) {
    case EVENT.HIT:
      out.unit = r.u8();
      out.other = r.u8();
      out.index = r.u8();
      out.amount = r.u16();
      if (out.index >= parts) r.bad = true;
      break;
    case EVENT.PART_LOST:
      out.unit = r.u8();
      out.index = r.u8();
      if (out.index >= parts) r.bad = true;
      break;
    case EVENT.KILL:
      out.unit = r.u8();
      out.other = r.u8();
      break;
    case EVENT.EXPLOSION:
      out.x = fromCm(r.i16());
      out.y = fromCm(r.i16());
      out.z = fromCm(r.i16());
      out.amount = r.u8() / 10;
      break;
    case EVENT.PROP_BROKEN:
      out.amount = r.u16();
      break;
    case EVENT.SHOT:
      out.unit = r.u8();
      {
        const b = r.u8();
        out.index = b & 63;
        out.other = b >> 6;
      }
      out.yaw = fromAngle(r.u16());
      out.pitch = fromPitch(r.i16());
      if (out.index >= NET_WEAPONS.length) r.bad = true;
      break;
    case EVENT.SPAWN:
      out.unit = r.u8();
      break;
    case EVENT.ARENA_RESET:
      break;
    case EVENT.FIGURANTE_MORREU:
    case EVENT.FIGURANTE_FUGIU:
      out.amount = r.u16();
      break;
    default:
      r.bad = true;
  }
}
