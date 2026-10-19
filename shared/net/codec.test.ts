import { describe, expect, it } from 'vitest';
import { downloadPerSecond, snapshotBytes, unitsWithinBudget, uploadPerSecond } from './budget';
import { fromAngle, Reader, toAngle, toFrac, Writer } from './codec';
import { DOWNLOAD_BUDGET, INPUT_HZ, INPUTS_PER_PACKET, MAX_INPUTS_PER_PACKET, NO_UNIT, PROTOCOL_VERSION, ROOM_UNITS, UPLOAD_BUDGET, WIRE_OVERHEAD } from './constants';
import { EVENT, EVENT_BYTES, type EventKind } from './events';
import { INPUT_BYTES, newNetInput, type NetInput } from './input';
import {
  decodeAviso,
  decodeEvents,
  decodeInputs,
  decodeJoin,
  decodePing,
  decodePong,
  decodeReject,
  decodeRoster,
  decodeSnapshot,
  decodeWelcome,
  encodeAviso,
  encodeEvents,
  encodeInputs,
  encodeJoin,
  encodePing,
  encodePong,
  encodeReject,
  encodeRoster,
  encodeSnapshot,
  encodeWelcome,
  EVENTS_HEADER_BYTES,
  messageType,
  MSG,
  newEventBatch,
  newInputPacket,
  newSnapshot,
  sanitizeName,
  SNAPSHOT_HEADER_BYTES,
} from './messages';
import { NET_PARTS, UNIT_BYTES, UNIT_FX_BYTES } from './state';

const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const copy = (v: Uint8Array) => new Uint8Array(v);

function input(tick: number, o: Partial<NetInput> = {}): NetInput {
  return { ...newNetInput(), tick, ...o };
}

/** Uma sala cheia de `n` unidades em movimento, com partes avariadas. */
function fullSnapshot(n: number) {
  const s = newSnapshot();
  s.tick = 123456;
  s.ack = 123450;
  s.count = n;
  for (let i = 0; i < n; i++) {
    const u = s.units[i]!;
    u.id = i;
    u.x = -99.87 + i * 12.345;
    u.y = i * 0.37;
    u.z = 88.12 - i * 9.9;
    u.yaw = -3 + i * 0.4;
    u.pitch = -0.6 + i * 0.07;
    NET_PARTS.forEach((p, k) => (u.parts[p] = ((i + k) % 7) / 6));
    u.parts.head = i % 2 ? 0 : 0.001; // arrancada e um fio de vida
    u.heat = (i % 10) / 9;
    u.alive = i % 3 !== 0;
    u.grounded = i % 2 === 0;
    u.dashing = i % 4 === 0;
    u.overheated = i % 5 === 0;
    u.charging = i % 3 === 0;
  }
  return s;
}

describe('rede: codec e quantização', () => {
  it('escritor e leitor: números com e sem sinal voltam iguais; ler além do fim marca a mensagem como ruim', () => {
    const w = new Writer(64);
    const bytes = copy(w.reset().u8(250).i8(-100).u16(65000).i16(-32000).u32(4_000_000_000).str('Ação', 16).done());
    const r = new Reader().set(bytes);
    expect([r.u8(), r.i8(), r.u16(), r.i16(), r.u32(), r.str(16)]).toEqual([250, -100, 65000, -32000, 4_000_000_000, 'Ação']);
    expect(r.clean).toBe(true);
    r.u8();
    expect(r.bad).toBe(true);
    // Texto maior que o permitido é mensagem ruim.
    expect(new Reader().set(bytes.subarray(10)).str(2)).toBe('');
  });

  it('ângulos voltam no mesmo lado (-π a π) com erro menor que 0,01°; fração com um fio de vida não vira zero', () => {
    for (const a of [-Math.PI + 0.001, -1, 0, 0.5, 3, 7, -9]) expect(angleDiff(fromAngle(toAngle(a)), a)).toBeLessThan(0.0002);
    expect(toFrac(0.0001)).toBe(1);
    expect(toFrac(0)).toBe(0);
    expect(toFrac(Number.NaN)).toBe(0);
  });
});

describe('rede: comandos do cliente (NetInput)', () => {
  it('2 ticks por pacote, 9 bytes cada: ida e volta com os eixos, os ângulos e os 4 botões', () => {
    const w = new Writer();
    const sent = [
      input(1000, { moveX: 1, moveZ: -0.5, moveYaw: 2.5, yaw: -2.9, pitch: 0.4, jump: true, fire: true }),
      input(1001, { moveX: 0, moveZ: 1, moveYaw: 2.5, yaw: -2.8, pitch: -1.5, dash: true, secondary: true }),
    ];
    const bytes = copy(encodeInputs(w, sent, 2));
    expect(bytes.length).toBe(6 + INPUT_BYTES * 2);
    const got = newInputPacket();
    expect(decodeInputs(bytes, got)).toBe(true);
    expect(got.count).toBe(2);
    for (let i = 0; i < 2; i++) {
      const a = sent[i]!;
      const b = got.inputs[i]!;
      expect(b.tick).toBe(a.tick);
      expect(Math.abs(b.moveX - a.moveX)).toBeLessThan(0.01);
      expect(Math.abs(b.moveZ - a.moveZ)).toBeLessThan(0.01);
      expect(angleDiff(b.yaw, a.yaw)).toBeLessThan(0.0002);
      expect(Math.abs(b.pitch - a.pitch)).toBeLessThan(0.0002);
      expect([b.jump, b.dash, b.fire, b.secondary]).toEqual([a.jump, a.dash, a.fire, a.secondary]);
    }
  });

  it('nada do cliente é confiado: eixo fora de -1 a 1 e NaN são contidos; pacote torto é recusado inteiro', () => {
    const w = new Writer();
    const got = newInputPacket();
    decodeInputs(copy(encodeInputs(w, [input(5, { moveX: 9, moveZ: Number.NaN, pitch: 4 })], 1)), got);
    expect(got.inputs[0]!.moveX).toBe(1);
    expect(got.inputs[0]!.moveZ).toBe(0);
    expect(got.inputs[0]!.pitch).toBeCloseTo(Math.PI / 2, 4);
    const ok = copy(encodeInputs(w, [input(5), input(6)], 2));
    expect(decodeInputs(ok.subarray(0, ok.length - 1), got)).toBe(false); // cortado
    expect(decodeInputs(new Uint8Array([...ok, 0]), got)).toBe(false); // sobra lixo
    const many = copy(ok);
    many[5] = MAX_INPUTS_PER_PACKET + 1; // quantidade impossível
    expect(decodeInputs(many, got)).toBe(false);
    const buttons = copy(ok);
    buttons[6 + 8] = 0xf0; // bits de botão que não existem
    expect(decodeInputs(buttons, got)).toBe(false);
  });
});

describe('rede: estado do servidor (UnitState)', () => {
  it('19 bytes por unidade; posição volta com erro de meio centímetro, vida e calor em 1/255, flags iguais', () => {
    const w = new Writer();
    const sent = fullSnapshot(16);
    const bytes = copy(encodeSnapshot(w, sent));
    expect(bytes.length).toBe(SNAPSHOT_HEADER_BYTES + 16 * UNIT_BYTES);
    const got = newSnapshot();
    expect(decodeSnapshot(bytes, got)).toBe(true);
    expect([got.tick, got.ack, got.count]).toEqual([sent.tick, sent.ack, 16]);
    for (let i = 0; i < 16; i++) {
      const a = sent.units[i]!;
      const b = got.units[i]!;
      expect(b.id).toBe(a.id);
      for (const k of ['x', 'y', 'z'] as const) expect(Math.abs(b[k] - a[k])).toBeLessThanOrEqual(0.005 + 1e-9);
      expect(angleDiff(b.yaw, a.yaw)).toBeLessThan(0.0002);
      for (const p of NET_PARTS) {
        expect(Math.abs(b.parts[p] - a.parts[p])).toBeLessThanOrEqual(1 / 255);
        expect(b.parts[p] > 0).toBe(a.parts[p] > 0); // arrancada continua arrancada; viva continua viva
      }
      expect(Math.abs(b.heat - a.heat)).toBeLessThanOrEqual(1 / 510 + 1e-9);
      expect([b.alive, b.grounded, b.dashing, b.overheated, b.charging]).toEqual([a.alive, a.grounded, a.dashing, a.overheated, a.charging]);
    }
  });

  it('o byte fx (fogo, choque, gelo, lança-chamas, rotatória) só viaja quando há algo ligado: +1 byte só nessas unidades, e volta igual', () => {
    const w = new Writer();
    const sem = fullSnapshot(6);
    const com = fullSnapshot(6);
    com.units[1]!.fx = 0b10100101;
    com.units[4]!.fx = 255;
    const a = encodeSnapshot(w, sem).length;
    const bytes = copy(encodeSnapshot(w, com));
    expect(bytes.length - a).toBe(2 * UNIT_FX_BYTES);
    const got = newSnapshot();
    expect(decodeSnapshot(bytes, got)).toBe(true);
    expect(got.units.slice(0, 6).map((u) => u.fx)).toEqual([0, 0b10100101, 0, 0, 255, 0]);
    // As unidades seguintes continuam alinhadas depois de uma que carrega o byte extra.
    expect(got.units[5]!.id).toBe(com.units[5]!.id);
    expect(Math.abs(got.units[5]!.x - com.units[5]!.x)).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(decodeSnapshot(bytes.subarray(0, bytes.length - 1), got)).toBe(false); // cortado no meio do byte extra
  });

  it('o pior caso (todas as unidades com algum estado) ainda cabe nos 8 KB/s, mas o caso comum não paga nada', () => {
    expect(downloadPerSecond(ROOM_UNITS, true)).toBeLessThan(DOWNLOAD_BUDGET);
    expect(downloadPerSecond(ROOM_UNITS, true) - downloadPerSecond(ROOM_UNITS)).toBeCloseTo(ROOM_UNITS * UNIT_FX_BYTES * 20 * WIRE_OVERHEAD, 0);
    expect(snapshotBytes(ROOM_UNITS)).toBe(SNAPSHOT_HEADER_BYTES + ROOM_UNITS * UNIT_BYTES);
  });

  it('sem alocação por pacote: o escritor devolve sempre uma vista do mesmo buffer', () => {
    const w = new Writer();
    const s = fullSnapshot(8);
    const a = encodeSnapshot(w, s);
    const b = encodeSnapshot(w, s);
    expect(b.buffer).toBe(a.buffer);
  });
});

describe('rede: mensagens', () => {
  it('entrada: apelido limpo (sem símbolo, até 16), montagem só no formato do Hangar', () => {
    const w = new Writer();
    const join = decodeJoin(copy(encodeJoin(w, { protocol: PROTOCOL_VERSION, name: '  Dan <script>☢ Piloto-Chefe da Silva ', build: 'v1.vector09.plasma-2.rockets-0' })));
    expect(join).toEqual({ protocol: PROTOCOL_VERSION, name: 'Dan script Pilot', build: 'v1.vector09.plasma-2.rockets-0' });
    expect(sanitizeName('☢☢')).toBe('PILOTO');
    expect(sanitizeName('Mário São')).toBe('Mário São');
    expect(decodeJoin(copy(encodeJoin(w, { protocol: 1, name: 'x', build: 'DROP TABLE' })))).toBeNull();
  });

  it('boas-vindas, lista de jogadores, ping, pong e recusa: ida e volta', () => {
    const w = new Writer();
    const welcome = { protocol: 1, id: 3, tick: 99999, simHz: 60, snapshotHz: 20, room: 'K7Q2' };
    expect(decodeWelcome(copy(encodeWelcome(w, welcome)))).toEqual(welcome);
    expect(decodeWelcome(copy(encodeWelcome(w, { ...welcome, room: 'k7 q2' })))).toBeNull();
    const roster = [
      { id: 0, kind: 'human' as const, name: 'DAN', build: 'v1.vector09.plasma-0.rockets-0' },
      { id: 1, kind: 'mech' as const, name: 'CLAWD·BRABO', build: 'v1.vector09.plasma-0.rockets-0' },
      { id: 5, kind: 'technician' as const, name: 'ENTRÓPICO', build: 'v1.android.blaster-0.chainsaw-0' },
    ];
    expect(decodeRoster(copy(encodeRoster(w, roster)))).toEqual(roster.map((e) => ({ ...e, name: sanitizeName(e.name) })));
    expect(decodePing(copy(encodePing(w, 123456)))).toBe(123456);
    expect(decodePong(copy(encodePong(w, 123456, 777)))).toEqual({ clientTime: 123456, tick: 777 });
    expect(decodeReject(copy(encodeReject(w, 'cheia')))).toBe('cheia');
    expect(messageType(copy(encodePing(w, 1)))).toBe(MSG.PING);
  });

  it('aviso do servidor (P204): ida e volta, tempos limitados a 16 bits, tipo desconhecido e cauda sobrando recusam', () => {
    const w = new Writer();
    expect(decodeAviso(copy(encodeAviso(w, { tipo: 'reinicio', segundos: 10, voltaEmS: 60 })))).toEqual({ tipo: 'reinicio', segundos: 10, voltaEmS: 60 });
    expect(decodeAviso(copy(encodeAviso(w, { tipo: 'reinicio', segundos: 1e9, voltaEmS: -5 })))).toEqual({ tipo: 'reinicio', segundos: 0xffff, voltaEmS: 0 });
    const ruim = copy(encodeAviso(w, { tipo: 'reinicio', segundos: 1, voltaEmS: 1 }));
    ruim[1] = 9; // tipo que este cliente não conhece
    expect(decodeAviso(ruim)).toBeNull();
    const comCauda = new Uint8Array([...copy(encodeAviso(w, { tipo: 'reinicio', segundos: 1, voltaEmS: 1 })), 0]);
    expect(decodeAviso(comCauda)).toBeNull();
    expect(messageType(copy(encodeAviso(w, { tipo: 'reinicio', segundos: 1, voltaEmS: 1 })))).toBe(MSG.AVISO);
  });

  it('eventos: cada tipo no tamanho dele, ida e volta; tipo ou parte desconhecidos recusam o pacote', () => {
    const w = new Writer();
    const b = newEventBatch();
    b.tick = 4242;
    const kinds = Object.values(EVENT) as EventKind[];
    kinds.forEach((kind, i) => Object.assign(b.list[i]!, { kind, unit: 2, other: NO_UNIT, index: 1, amount: kind === EVENT.EXPLOSION ? 6 : 37, x: 10.5, y: 0.5, z: -20.25, yaw: 1.2, pitch: 0.1 }));
    b.count = kinds.length;
    const bytes = copy(encodeEvents(w, b));
    expect(bytes.length).toBe(EVENTS_HEADER_BYTES + kinds.reduce((sum, k) => sum + EVENT_BYTES[k], 0));
    const got = newEventBatch();
    expect(decodeEvents(bytes, got)).toBe(true);
    expect(got.count).toBe(kinds.length);
    const hit = got.list[0]!;
    expect([hit.kind, hit.unit, hit.other, hit.index, hit.amount]).toEqual([EVENT.HIT, 2, NO_UNIT, 1, 37]);
    const boom = got.list[kinds.indexOf(EVENT.EXPLOSION)]!;
    expect([boom.x, boom.y, boom.z, boom.amount]).toEqual([10.5, 0.5, -20.25, 6]);
    const bad = copy(bytes);
    bad[EVENTS_HEADER_BYTES] = 99;
    expect(decodeEvents(bad, got)).toBe(false);
    const badPart = copy(bytes);
    badPart[EVENTS_HEADER_BYTES + 3] = 6; // parte 6 não existe (são 0 a 5)
    expect(decodeEvents(badPart, got)).toBe(false);
  });
});

describe('rede: orçamento de banda (G11)', () => {
  it('upload: comandos a 30 pacotes por segundo cabem em 2 KB/s com a moldura', () => {
    const packet = encodeInputs(new Writer(), [input(1), input(2)], INPUTS_PER_PACKET).length;
    expect(uploadPerSecond()).toBe(packet * INPUT_HZ * WIRE_OVERHEAD);
    expect(uploadPerSecond()).toBeLessThan(UPLOAD_BUDGET * 0.5);
  });

  it('o estado tem tamanho fixo: a conta da banda vale para qualquer luta (conteúdo não muda o tamanho)', () => {
    expect(encodeSnapshot(new Writer(), fullSnapshot(12)).length).toBe(snapshotBytes(12));
  });

  it('download: sala cheia (8 Mechs, 3 andróides e o técnico) a 20 Hz, numa luta intensa, cabe em 8 KB/s com folga', () => {
    expect(downloadPerSecond(ROOM_UNITS)).toBeLessThan(DOWNLOAD_BUDGET * 0.8);
  });

  it('o teto sem delta: até 15 unidades cabem mandando tudo a cada estado; acima, só com o delta (M7)', () => {
    expect(unitsWithinBudget()).toBe(15);
    expect(unitsWithinBudget()).toBeGreaterThanOrEqual(ROOM_UNITS + 3);
    expect(downloadPerSecond(16)).toBeGreaterThanOrEqual(DOWNLOAD_BUDGET);
  });
});
