import { describe, expect, it } from 'vitest';
import { Writer } from './codec';
import { MAX_UNITS, ROOM_MAX } from './constants';
import { MSG } from './messages';
import { decodeMural, decodeMuralPedido, encodeMural, encodeMuralPedido, MURAL_SALAS_MAX, MURAL_TOKEN_MAX, newMuralSala, type MuralSala } from './mural';

const w = new Writer(4096);

function sala(codigo: string, tipos: Array<'human' | 'mech' | 'android' | 'technician'>, extra: Partial<MuralSala> = {}): MuralSala {
  const s = newMuralSala();
  s.codigo = codigo;
  s.jogadores = tipos.filter((t) => t === 'human').length;
  s.rodada = 3;
  s.restanteS = 125;
  s.jogando = true;
  tipos.forEach((tipo, i) => {
    const u = s.unidades[i]!;
    u.tipo = tipo;
    u.x = -40 + i * 7.5;
    u.z = 22.25 - i * 3;
    u.yaw = i * 0.5 - 1;
    u.vida = 1 - i * 0.1;
    u.viva = i % 2 === 0;
  });
  s.n = tipos.length;
  return Object.assign(s, extra);
}

describe('o mural de câmeras: o contrato', () => {
  it('o pedido leva o token e volta igual; token vazio, grande demais ou mensagem torta não valem', () => {
    const token = 'a'.repeat(48);
    expect(decodeMuralPedido(encodeMuralPedido(w, token))).toBe(token);
    expect(decodeMuralPedido(encodeMuralPedido(w, ''))).toBeNull();
    // O escritor corta o token no máximo; um pedido forjado maior que isso é recusado pelo leitor.
    const forjado = new Uint8Array([MSG.MURAL_PEDIR, MURAL_TOKEN_MAX + 1, ...new Uint8Array(MURAL_TOKEN_MAX + 1).fill(97)]);
    expect(decodeMuralPedido(forjado)).toBeNull();
    expect(decodeMuralPedido(new Uint8Array([MSG.MURAL_PEDIR]))).toBeNull();
    expect(decodeMuralPedido(new Uint8Array([MSG.JOIN, 1, 97]))).toBeNull();
    expect(decodeMuralPedido(new Uint8Array(0))).toBeNull();
    // Sobra no fim: mensagem suja.
    const base = [...encodeMuralPedido(w, 'abc')];
    expect(decodeMuralPedido(new Uint8Array([...base, 0]))).toBeNull();
  });

  it('um quadro com duas salas volta como saiu: tipo, posição, ângulo, vida, viva e a sala', () => {
    const salas = [sala('ARENA', ['human', 'mech', 'android', 'technician']), sala('K7Q2', ['human', 'human'], { jogando: false, rodada: 9, restanteS: 0 })];
    const lido = decodeMural(encodeMural(w, salas, 2))!;
    expect(lido).toHaveLength(2);
    expect(lido[0]).toMatchObject({ codigo: 'ARENA', jogadores: 1, rodada: 3, restanteS: 125, jogando: true, n: 4 });
    expect(lido[1]).toMatchObject({ codigo: 'K7Q2', jogadores: 2, rodada: 9, restanteS: 0, jogando: false, n: 2 });
    expect(lido[0]!.unidades.map((u) => u.tipo)).toEqual(['human', 'mech', 'android', 'technician']);
    expect(lido[0]!.unidades.map((u) => u.viva)).toEqual([true, false, true, false]);
    const u = lido[0]!.unidades[2]!;
    expect(u.x).toBeCloseTo(-25, 2); // centímetro: erro de até 0,5 cm
    expect(u.z).toBeCloseTo(16.25, 2);
    expect(u.yaw).toBeCloseTo(0, 3); // -1 + 2 * 0,5, no passo de 16 bits
    expect(u.vida).toBeCloseTo(0.8, 2);
  });

  it('lê só o que as `n` salas dizem: o resto do vetor reaproveitado (do quadro anterior) não vaza', () => {
    const salas = [sala('A', ['human', 'mech']), sala('B', ['mech'])];
    const bytes = [...encodeMural(w, salas, 1)];
    const lido = decodeMural(new Uint8Array(bytes))!;
    expect(lido.map((s) => s.codigo)).toEqual(['A']);
    // E só as `n` unidades de uma sala: um quadro novo, menor, não leva as unidades de antes.
    const s = sala('A', ['human', 'mech', 'android']);
    s.n = 1;
    expect(decodeMural(encodeMural(w, [s], 1))![0]!.unidades).toHaveLength(1);
  });

  it('o tamanho cabe na meta: 8 bytes por unidade, uma sala cheia (12) a 4 Hz fica perto de 0,5 KB/s', () => {
    const cheia = sala('ARENA', Array.from({ length: 12 }, (_, i) => (i < 8 ? 'human' : 'mech')));
    const bytes = encodeMural(w, [cheia], 1).length;
    expect(bytes).toBeLessThanOrEqual(2 + (1 + 5) + 2 + 1 + 1 + 1 + 1 + 12 * 8);
    expect((bytes * 4) / 1024).toBeLessThan(0.6);
    // O pior quadro possível (8 salas de 32 unidades) cabe no buffer do servidor (4096).
    const pior = Array.from({ length: MURAL_SALAS_MAX }, (_, i) => sala(`SALA-${i}`.padEnd(ROOM_MAX, 'X'), Array.from({ length: MAX_UNITS }, () => 'mech')));
    expect(encodeMural(w, pior, MURAL_SALAS_MAX).length).toBeLessThan(4096);
  });

  it('corta no teto de salas ao escrever e recusa ao ler um quadro que passa dele', () => {
    const muitas = Array.from({ length: MURAL_SALAS_MAX + 3 }, (_, i) => sala(`S${i}`, ['mech']));
    expect(decodeMural(encodeMural(w, muitas, muitas.length))).toHaveLength(MURAL_SALAS_MAX);
    const forjado = new Uint8Array([MSG.MURAL, MURAL_SALAS_MAX + 1]);
    expect(decodeMural(forjado)).toBeNull();
  });

  it('mensagem torta nunca vira quadro: cortada, com unidade demais, com tipo impossível ou com sobra', () => {
    const bom = [...encodeMural(w, [sala('ARENA', ['human', 'mech'])], 1)];
    expect(decodeMural(new Uint8Array(bom))).not.toBeNull();
    for (let corte = 1; corte < bom.length; corte++) expect(decodeMural(new Uint8Array(bom.slice(0, corte))), `cortada em ${corte}`).toBeNull();
    expect(decodeMural(new Uint8Array([...bom, 7]))).toBeNull();
    // Unidades demais para uma sala (o byte de contagem acima de MAX_UNITS).
    const demais = [...bom];
    demais[2 + 1 + 5 + 1 + 1 + 2 + 1] = MAX_UNITS + 1; // [tipo][nSalas][len=5]['ARENA'][jogadores][rodada][u16][jogando][n]
    expect(decodeMural(new Uint8Array(demais))).toBeNull();
    expect(decodeMural(new Uint8Array(0))).toBeNull();
    expect(decodeMural(new Uint8Array([MSG.SNAPSHOT, 0]))).toBeNull();
  });

  it('número estragado não passa: NaN e infinito viram zero, e a posição fora da arena é presa no que cabe', () => {
    const s = sala('ARENA', ['human']);
    s.unidades[0]!.x = Number.NaN;
    s.unidades[0]!.z = Number.POSITIVE_INFINITY;
    s.unidades[0]!.vida = Number.NaN;
    const u = decodeMural(encodeMural(w, [s], 1))![0]!.unidades[0]!;
    expect([u.x, u.z, u.vida]).toEqual([0, 0, 0]);
    s.unidades[0]!.x = 9999;
    expect(decodeMural(encodeMural(w, [s], 1))![0]!.unidades[0]!.x).toBeCloseTo(327.67, 2);
  });
});
