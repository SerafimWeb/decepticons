import { Reader, fromFrac, toFrac, type Writer } from './codec';
import { BUILD_MAX, MAX_EVENTS, MAX_INPUTS_PER_PACKET, MAX_UNITS, NAME_MAX, ROOM_MAX } from './constants';
import { newNetEvent, readEvent, writeEvent, type NetEvent } from './events';
import { newNetInput, readInput, writeInput, type NetInput } from './input';
import { NET_PARTS, newUnitState, readUnit, writeUnit, type UnitState } from './state';

/**
 * Mensagens entre cliente e servidor (MULTIPLAYER.md, seção 5). O primeiro byte é o tipo. Codificar escreve no
 * `Writer` e devolve a vista dele; decodificar recusa (null ou false) qualquer mensagem mal formada, inteira.
 *
 * Cliente → servidor: JOIN (apelido e montagem), INPUT (comandos de 2 ticks, 30 vezes por segundo), PING, LEAVE.
 * Servidor → cliente: WELCOME (seu id, tick, sala), ROSTER (quem está na sala), SNAPSHOT (estado, 20 vezes por
 * segundo, com o último comando seu que o servidor já aplicou), EVENTS, PONG, REJECT.
 */
export const MSG = {
  JOIN: 1,
  INPUT: 2,
  PING: 3,
  LEAVE: 4,
  BANK: 5,
  /** O Comandante pede o mural de câmeras (`shared/net/mural.ts`), com o token do dono. */
  MURAL_PEDIR: 6,
  WELCOME: 10,
  ROSTER: 11,
  SNAPSHOT: 12,
  EVENTS: 13,
  PONG: 14,
  REJECT: 15,
  BANK_REPLY: 16,
  /** Um quadro do mural: todas as salas, só o que o radar precisa (`shared/net/mural.ts`). */
  MURAL: 17,
  /** O servidor avisa quem está na sala (hoje: que vai reiniciar). Cliente antigo ignora o tipo que não conhece: sem mudar o protocolo. */
  AVISO: 18,
  /** O estado compacto da multidão do 8 DE JANEIRO (P243): quem entra no meio da missão recebe quem já morreu e quem fugiu, para o espelho (`Multidao.aplicarEstado`) refazer o passado sem repetir os avisos. Só nesse mapa e modo. */
  JANEIRO_MULTIDAO: 19,
} as const;

/** Tipo da mensagem (primeiro byte); 0 se vazia. */
export function messageType(bytes: Uint8Array): number {
  return bytes.length ? bytes[0]! : 0;
}

/** Leitor da decodificação (um só: as mensagens são lidas uma de cada vez). */
const reader = new Reader();

// ---------- textos de fora ----------

/** Bytes de UTF-8 reservados para o apelido (acentos ocupam 2). */
const NAME_BYTES = NAME_MAX * 2;
const BUILD_RE = /^[A-Za-z0-9.-]{1,80}$/;
const ROOM_RE = /^[A-Z0-9-]{1,12}$/;

/** Apelido: só letras, números, espaço, ponto, hífen, sublinhado e o ponto do meio (CLAWD·BRABO); até 16; vazio vira PILOTO. */
export function sanitizeName(s: string): string {
  const clean = s
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._·-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return clean || 'PILOTO';
}

// ---------- cliente → servidor ----------

export interface JoinMsg {
  protocol: number;
  name: string;
  /** Montagem do Hangar em texto curto (`loadoutKey`); o servidor valida com `validateLoadout`. */
  build: string;
}

export function encodeJoin(w: Writer, m: JoinMsg): Uint8Array {
  return w.reset().u8(MSG.JOIN).u8(m.protocol).str(sanitizeName(m.name), NAME_BYTES).str(m.build, BUILD_MAX).done();
}

export function decodeJoin(bytes: Uint8Array): JoinMsg | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.JOIN) return null;
  const protocol = r.u8();
  const name = r.str(NAME_BYTES);
  const build = r.str(BUILD_MAX);
  if (!r.clean || !BUILD_RE.test(build)) return null;
  return { protocol, name: sanitizeName(name), build };
}

/** Pacote de comandos: ticks consecutivos a partir de `firstTick`. Objeto reutilizado (sem alocar por pacote). */
export interface InputPacket {
  count: number;
  inputs: NetInput[];
}

export function newInputPacket(): InputPacket {
  return { count: 0, inputs: Array.from({ length: MAX_INPUTS_PER_PACKET }, newNetInput) };
}

/** `inputs[0..count)` em ticks consecutivos (o primeiro tick viaja uma vez). */
export function encodeInputs(w: Writer, inputs: readonly NetInput[], count: number): Uint8Array {
  w.reset().u8(MSG.INPUT).u32(inputs[0]!.tick).u8(count);
  for (let i = 0; i < count; i++) writeInput(w, inputs[i]!);
  return w.done();
}

export function decodeInputs(bytes: Uint8Array, out: InputPacket): boolean {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.INPUT) return false;
  const first = r.u32();
  const count = r.u8();
  if (count < 1 || count > MAX_INPUTS_PER_PACKET) return false;
  for (let i = 0; i < count; i++) readInput(r, first + i, out.inputs[i]!);
  out.count = count;
  return r.clean;
}

export function encodePing(w: Writer, clientTime: number): Uint8Array {
  return w.reset().u8(MSG.PING).u32(clientTime >>> 0).done();
}

/** Hora do cliente (ms) de volta, ou null. */
export function decodePing(bytes: Uint8Array): number | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.PING) return null;
  const t = r.u32();
  return r.clean ? t : null;
}

export function encodeLeave(w: Writer): Uint8Array {
  return w.reset().u8(MSG.LEAVE).done();
}

// ---------- servidor → cliente ----------

export interface WelcomeMsg {
  protocol: number;
  /** O id da sua unidade nos estados e eventos. */
  id: number;
  tick: number;
  simHz: number;
  snapshotHz: number;
  /** Código da sala (`/jogar/?sala=K7Q2`). */
  room: string;
}

export function encodeWelcome(w: Writer, m: WelcomeMsg): Uint8Array {
  return w.reset().u8(MSG.WELCOME).u8(m.protocol).u8(m.id).u32(m.tick).u8(m.simHz).u8(m.snapshotHz).str(m.room, ROOM_MAX).done();
}

export function decodeWelcome(bytes: Uint8Array): WelcomeMsg | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.WELCOME) return null;
  const m = { protocol: r.u8(), id: r.u8(), tick: r.u32(), simHz: r.u8(), snapshotHz: r.u8(), room: r.str(ROOM_MAX) };
  return r.clean && ROOM_RE.test(m.room) ? m : null;
}

/** `faxineiro` no fim da lista (P243): os índices antigos não mudam (a versão do protocolo já barra um cliente velho antes do roster). */
export const UNIT_KINDS = ['human', 'mech', 'android', 'technician', 'faxineiro'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

/** Quem está na sala: vai na entrada e quando alguém entra ou sai (não a cada tick). */
export interface RosterEntry {
  id: number;
  /** Humano ou bot (Mech rebelde, andróide, técnico). */
  kind: UnitKind;
  name: string;
  /** Montagem (`loadoutKey`): chassi e armas, para desenhar o robô. */
  build: string;
}

export function encodeRoster(w: Writer, entries: readonly RosterEntry[]): Uint8Array {
  w.reset().u8(MSG.ROSTER).u8(entries.length);
  for (const e of entries) w.u8(e.id).u8(UNIT_KINDS.indexOf(e.kind)).str(sanitizeName(e.name), NAME_BYTES).str(e.build, BUILD_MAX);
  return w.done();
}

export function decodeRoster(bytes: Uint8Array): RosterEntry[] | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.ROSTER) return null;
  const n = r.u8();
  if (n > MAX_UNITS) return null;
  const out: RosterEntry[] = [];
  for (let i = 0; i < n && !r.bad; i++) {
    const id = r.u8();
    const kind = UNIT_KINDS[r.u8()];
    const name = r.str(NAME_BYTES);
    const build = r.str(BUILD_MAX);
    if (!kind || !BUILD_RE.test(build)) return null;
    out.push({ id, kind, name: sanitizeName(name), build });
  }
  return r.clean ? out : null;
}

/** Estado da sala num tick. `ack` = o último tick de comando seu que o servidor já aplicou (reconciliação, M4). */
export interface Snapshot {
  tick: number;
  ack: number;
  /** Energia do destinatário; os outros precisam apenas da flag visual. */
  energy?: number;
  count: number;
  units: UnitState[];
}

export function newSnapshot(): Snapshot {
  return { tick: 0, ack: 0, count: 0, units: Array.from({ length: MAX_UNITS }, newUnitState) };
}

/** Bytes do cabeçalho do estado: tipo, tick, ack, quantidade e energia do destinatário. */
export const SNAPSHOT_HEADER_BYTES = 11;

export function encodeSnapshot(w: Writer, s: Snapshot): Uint8Array {
  w.reset().u8(MSG.SNAPSHOT).u32(s.tick).u32(s.ack).u8(s.count).u8(toFrac(s.energy ?? 0));
  for (let i = 0; i < s.count; i++) writeUnit(w, s.units[i]!);
  return w.done();
}

export function decodeSnapshot(bytes: Uint8Array, out: Snapshot): boolean {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.SNAPSHOT) return false;
  out.tick = r.u32();
  out.ack = r.u32();
  const n = r.u8();
  out.energy = fromFrac(r.u8());
  if (n > MAX_UNITS) return false;
  for (let i = 0; i < n; i++) readUnit(r, out.units[i]!);
  out.count = n;
  return r.clean;
}

/** Eventos de um tick (ou de vários, juntos no mesmo pacote do estado). */
export interface EventBatch {
  tick: number;
  count: number;
  list: NetEvent[];
}

export function newEventBatch(): EventBatch {
  return { tick: 0, count: 0, list: Array.from({ length: MAX_EVENTS }, newNetEvent) };
}

/** Bytes do cabeçalho de eventos: tipo, tick, quantidade. */
export const EVENTS_HEADER_BYTES = 6;

export function encodeEvents(w: Writer, b: EventBatch): Uint8Array {
  w.reset().u8(MSG.EVENTS).u32(b.tick).u8(b.count);
  for (let i = 0; i < b.count; i++) writeEvent(w, b.list[i]!);
  return w.done();
}

export function decodeEvents(bytes: Uint8Array, out: EventBatch): boolean {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.EVENTS) return false;
  out.tick = r.u32();
  const n = r.u8();
  if (n > MAX_EVENTS) return false;
  for (let i = 0; i < n; i++) readEvent(r, out.list[i]!, NET_PARTS.length);
  out.count = n;
  return r.clean;
}

export function encodePong(w: Writer, clientTime: number, tick: number): Uint8Array {
  return w.reset().u8(MSG.PONG).u32(clientTime >>> 0).u32(tick).done();
}

export function decodePong(bytes: Uint8Array): { clientTime: number; tick: number } | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.PONG) return null;
  const m = { clientTime: r.u32(), tick: r.u32() };
  return r.clean ? m : null;
}

/** Por que o servidor recusou a entrada. `restrito` (P226): o mapa pedido ainda não foi liberado e a conta não é de administrador (sempre no fim da lista: os índices antigos não mudam). */
export const REJECT_REASONS = ['cheia', 'versao', 'montagem', 'mensagem', 'restrito'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export function encodeReject(w: Writer, reason: RejectReason): Uint8Array {
  return w.reset().u8(MSG.REJECT).u8(REJECT_REASONS.indexOf(reason)).done();
}

export function decodeReject(bytes: Uint8Array): RejectReason | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.REJECT) return null;
  const reason = REJECT_REASONS[r.u8()];
  return r.clean && reason ? reason : null;
}

// ---------- aviso do servidor ----------

/** O que o servidor avisa. `reinicio`: em `segundos` a conexão é cortada e ele volta em cerca de `voltaEmS`. */
export const AVISO_TIPOS = ['reinicio'] as const;
export type AvisoTipo = (typeof AVISO_TIPOS)[number];

export interface AvisoMsg {
  tipo: AvisoTipo;
  segundos: number;
  voltaEmS: number;
}

export function encodeAviso(w: Writer, m: AvisoMsg): Uint8Array {
  return w
    .reset()
    .u8(MSG.AVISO)
    .u8(AVISO_TIPOS.indexOf(m.tipo))
    .u16(Math.min(0xffff, Math.max(0, Math.round(m.segundos))))
    .u16(Math.min(0xffff, Math.max(0, Math.round(m.voltaEmS))))
    .done();
}

export function decodeAviso(bytes: Uint8Array): AvisoMsg | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.AVISO) return null;
  const tipo = AVISO_TIPOS[r.u8()];
  const m = { segundos: r.u16(), voltaEmS: r.u16() };
  return r.clean && tipo ? { tipo, ...m } : null;
}

// ---------- a multidão do 8 DE JANEIRO (P243): quem entra no meio recebe o passado ----------

/** Acima da cota da missão (`MissaoJaneiro.COTA_DA_MISSAO`, 1.500); além disto a mensagem é recusada. */
const MAX_FIGURANTES = 2000;

/** O estado compacto que `Multidao.exportarEstado()` devolve, em bytes crus (sem depender do tipo do cliente: `shared/net/` não importa o `sim/`). */
export interface JaneiroMultidaoMsg {
  /** `Multidao.total`: quantos figurantes o bitmask de `mortos` cobre. */
  total: number;
  /** Um bit por figurante (1 = morto), do índice 0 ao `total - 1`, em bytes (`Multidao.exportarEstado().mortos`). */
  mortos: Uint8Array;
  /** Pares (índice do figurante, tick da fuga) de quem fugiu pela mão do jogador (`Multidao.exportarEstado().fugas`, já em pares). */
  fugas: readonly number[];
}

export function encodeJaneiroMultidao(w: Writer, m: JaneiroMultidaoMsg): Uint8Array {
  w.reset().u8(MSG.JANEIRO_MULTIDAO).u16(m.total);
  const bytes = (m.total + 7) >> 3;
  for (let i = 0; i < bytes; i++) w.u8(m.mortos[i] ?? 0);
  w.u16(m.fugas.length / 2);
  for (let i = 0; i + 1 < m.fugas.length; i += 2) w.u16(m.fugas[i]!).u16(m.fugas[i + 1]!);
  return w.done();
}

export function decodeJaneiroMultidao(bytes: Uint8Array): JaneiroMultidaoMsg | null {
  const r = reader.set(bytes);
  if (r.u8() !== MSG.JANEIRO_MULTIDAO) return null;
  const total = r.u16();
  if (total > MAX_FIGURANTES) return null;
  const mortos = new Uint8Array((total + 7) >> 3);
  for (let i = 0; i < mortos.length; i++) mortos[i] = r.u8();
  const pares = r.u16();
  if (pares > MAX_FIGURANTES) return null;
  const fugas: number[] = [];
  for (let i = 0; i < pares; i++) fugas.push(r.u16(), r.u16());
  return r.clean ? { total, mortos, fugas } : null;
}
