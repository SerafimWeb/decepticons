import { describe, expect, it } from 'vitest';
import { newMuralSala, type MuralSala } from '../../../shared/net/mural';
import type { EstadoDoMural } from '../net/mural';
import { linhaDoCartao, ordenarSalas, quadroDaSala, tempoDaRodada, textoDoEstado, totais } from './cameraData';

function sala(codigo: string, unidades: Array<[tipo: 'human' | 'mech' | 'android' | 'technician', viva: boolean]>, extra: Partial<MuralSala> = {}): MuralSala {
  const s = newMuralSala();
  s.codigo = codigo;
  s.jogadores = unidades.filter(([t]) => t === 'human').length;
  s.rodada = 2;
  s.restanteS = 95;
  s.jogando = true;
  unidades.forEach(([tipo, viva], i) => {
    const u = s.unidades[i]!;
    u.tipo = tipo;
    u.viva = viva;
    u.x = i * 10;
    u.z = -i * 5;
    u.yaw = 0.5 * i;
  });
  s.n = unidades.length;
  return Object.assign(s, extra);
}

describe('as câmeras ao vivo: as contas da tela', () => {
  it('o radar de uma sala: pilotos vão para `jogadores` (com o ângulo), Mechs são vermelhos grandes, andróides e técnicos pequenos; os mortos somem', () => {
    const q = quadroDaSala(sala('ARENA', [['human', true], ['mech', true], ['android', true], ['technician', true], ['mech', false], ['human', false]]), [{ x0: 0, z0: 0, x1: 5, z1: 5 }], 100);
    expect(q.mapa).toBe('arena');
    expect(q.meia).toBe(100);
    expect(q.caixas).toHaveLength(1);
    expect(q.voce).toBeNull();
    expect(q.jogadores).toEqual([{ x: 0, z: -0, yaw: 0 }]);
    expect(q.inimigos.map((i) => i.grande)).toEqual([true, false, false]);
    expect(q.inimigos[0]).toMatchObject({ x: 10, z: -5 });
    expect(q.aliados).toEqual([]);
  });

  it('só olha as `n` primeiras unidades (o vetor do servidor é reaproveitado, o resto é sobra do quadro anterior)', () => {
    const s = sala('A', [['human', true], ['mech', true]]);
    s.unidades[5]!.tipo = 'mech';
    s.unidades[5]!.viva = true;
    expect(quadroDaSala(s, [], 100).inimigos).toHaveLength(1);
  });

  it('o tempo da rodada: minutos e segundos, ou "intervalo" entre as rodadas', () => {
    expect(tempoDaRodada(95, true)).toBe('1:35');
    expect(tempoDaRodada(5, true)).toBe('0:05');
    expect(tempoDaRodada(0, true)).toBe('0:00');
    expect(tempoDaRodada(-3, true)).toBe('0:00');
    expect(tempoDaRodada(95, false)).toBe('intervalo');
  });

  it('o cartão diz o código e uma linha com pilotos, IAs vivas, rodada e tempo (singular e plural)', () => {
    expect(linhaDoCartao(sala('ARENA', [['human', true], ['human', true], ['mech', true], ['android', true], ['android', false]]))).toEqual({
      titulo: 'ARENA',
      detalhe: '2 pilotos · 2 IAs · rodada 2, 1:35',
    });
    expect(linhaDoCartao(sala('K7Q2', [['human', true], ['mech', true]], { jogando: false })).detalhe).toBe('1 piloto · 1 IA · rodada 2, intervalo');
    expect(linhaDoCartao(sala('X', [['human', true]])).detalhe).toMatch(/^1 piloto · 0 IAs/);
  });

  it('as salas com mais gente vêm primeiro, o empate se desfaz pelo código, e o vetor de quem chama não é mexido', () => {
    const a = sala('B', [['human', true]]);
    const b = sala('C', [['human', true], ['human', true]]);
    const c = sala('A', [['human', true]]);
    const entrada = [a, b, c];
    expect(ordenarSalas(entrada).map((s) => s.codigo)).toEqual(['C', 'A', 'B']);
    expect(entrada.map((s) => s.codigo)).toEqual(['B', 'C', 'A']);
  });

  it('o total do cabeçalho soma as salas e os pilotos', () => {
    expect(totais([])).toEqual({ salas: 0, pilotos: 0 });
    expect(totais([sala('A', [['human', true]]), sala('B', [['human', true], ['human', true]])])).toEqual({ salas: 2, pilotos: 3 });
  });

  it('cada estado da conexão tem o seu selo e a sua frase; só falta de token e token recusado oferecem abrir o servidor', () => {
    const todos: EstadoDoMural[] = ['sem-servidor', 'sem-token', 'parado', 'conectando', 'ao-vivo', 'caiu', 'token', 'bloqueado', 'desligado'];
    for (const e of todos) {
      const t = textoDoEstado(e);
      expect(t.chip.length, e).toBeGreaterThan(3);
      if (e !== 'ao-vivo') expect(t.frase!.length, e).toBeGreaterThan(15);
    }
    expect(textoDoEstado('ao-vivo')).toMatchObject({ chip: 'AO VIVO', tom: 'ok', frase: null });
    expect(todos.filter((e) => textoDoEstado(e).pedeToken)).toEqual(['sem-token', 'token']);
    expect(textoDoEstado('token').frase).toMatch(/metricas-token\.txt/);
    expect(textoDoEstado('bloqueado').frase).toMatch(/10 minutos/);
    expect(textoDoEstado('caiu').tom).toBe('espera');
    expect(textoDoEstado('sem-servidor').tom).toBe('erro');
  });
});
