import { Writer } from './codec';
import { DOWNLOAD_BUDGET, INPUT_HZ, INPUTS_PER_PACKET, MAX_UNITS, SNAPSHOT_HZ, WIRE_OVERHEAD } from './constants';
import { EVENT, EVENT_BYTES, type EventKind } from './events';
import { newNetInput } from './input';
import { encodeInputs, encodeSnapshot, EVENTS_HEADER_BYTES, newSnapshot } from './messages';

/**
 * A conta da banda (G11), a partir do tamanho real das mensagens do codec: a mesma que os testes travam e que o site
 * mostra. Cenário de luta intensa, por segundo: 40 tiros, 20 acertos, 3 explosões, 2 partes arrancadas, 1 abate
 * e 1 renascimento. Roda fora do jogo (testes e site), então pode alocar.
 */
export const FIGHT_EVENTS_PER_SECOND: Partial<Record<EventKind, number>> = {
  [EVENT.SHOT]: 40,
  [EVENT.HIT]: 20,
  [EVENT.EXPLOSION]: 3,
  [EVENT.PART_LOST]: 2,
  [EVENT.KILL]: 1,
  [EVENT.SPAWN]: 1,
};

/** Bytes do estado de uma sala com `units` unidades (cada unidade tem tamanho fixo). */
export function snapshotBytes(units: number): number {
  const s = newSnapshot();
  s.count = units;
  return encodeSnapshot(new Writer(), s).length;
}

/** Download de um jogador por segundo, com a moldura: estado de `units` unidades a 20 Hz e os eventos da luta. */
export function downloadPerSecond(units: number): number {
  let events = 0;
  for (const [kind, n] of Object.entries(FIGHT_EVENTS_PER_SECOND)) events += EVENT_BYTES[Number(kind) as EventKind] * (n ?? 0);
  return (snapshotBytes(units) * SNAPSHOT_HZ + EVENTS_HEADER_BYTES * SNAPSHOT_HZ + events) * WIRE_OVERHEAD;
}

/** Upload de um jogador por segundo, com a moldura: pacotes de 2 comandos, 30 por segundo. */
export function uploadPerSecond(): number {
  const inputs = Array.from({ length: INPUTS_PER_PACKET }, newNetInput);
  return encodeInputs(new Writer(), inputs, INPUTS_PER_PACKET).length * INPUT_HZ * WIRE_OVERHEAD;
}

/** Quantas unidades cabem na meta de download mandando tudo a cada estado (acima disso, só com delta). */
export function unitsWithinBudget(): number {
  let n = 1;
  while (n < MAX_UNITS && downloadPerSecond(n + 1) < DOWNLOAD_BUDGET) n++;
  return n;
}
