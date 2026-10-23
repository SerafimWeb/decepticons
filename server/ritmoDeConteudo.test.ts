import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { WEAPON_IDS } from '../client/src/combat/weapons';
import { CHASSIS } from '../client/src/entities/chassis';
import { conteudoPorSemana } from '../scripts/site/dados.mjs';

/**
 * O ritmo de conteúdo da sala de controle (P175; `LICOES_WAR_ROBOTS.md` § 2.1: "contar conteúdo como se conta código"). Cada arma e cada chassi do jogo é uma unidade, na semana do merge que o
 * trouxe para a `main`. Os ids saem do código e as datas, do git: sem histórico (um clone raso) não há o que medir, e o teste não finge.
 */
const commits = (() => {
  try {
    return Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {
    return 0;
  }
})();
const comHistorico = commits > 200;

interface Unidade {
  id: string;
  tipo: 'arma' | 'chassi';
  data: string;
}
interface Semana {
  segunda: string;
  n: number;
  ids: string[];
}
interface Ritmo {
  unidades: Unidade[];
  semanas: Semana[];
  total: number;
  media4: number;
}
const ritmo = (hoje: string): Ritmo => conteudoPorSemana(new Date(`${hoje}T12:00:00Z`)) as Ritmo;

describe.skipIf(!comHistorico)('ritmo de conteúdo: armas e chassis por semana, do código e do git', () => {
  let r: Ritmo;
  // Uma busca no git por unidade (ids do código, datas da `main`): guardada na primeira chamada; com a máquina cheia leva mais de 30 s.
  // "hoje" é o dia real (não uma data presa no passado, P243): uma arma ou chassi commitado depois de uma data fixa cairia fora de toda semana gerada e os testes de baixo quebrariam sem ser bug nenhum.
  beforeAll(() => {
    r = ritmo(new Date().toISOString().slice(0, 10));
  }, 300_000);

  it('toda arma do catálogo conta uma vez, e nenhuma a mais (arma nova entra no ritmo sozinha)', () => {
    const armas = r.unidades.filter((u) => u.tipo === 'arma').map((u) => u.id);
    expect([...armas].sort()).toEqual([...WEAPON_IDS].sort());
  });

  it('os chassis contados são chassis do jogo, sem repetir; o Vector-09 e o Marauder estão lá', () => {
    const chassis = r.unidades.filter((u) => u.tipo === 'chassi').map((u) => u.id);
    expect(new Set(chassis).size).toBe(chassis.length);
    for (const id of chassis) expect(Object.keys(CHASSIS), id).toContain(id);
    expect(chassis).toEqual(expect.arrayContaining(['vector09', 'marauder']));
  });

  it('as semanas começam numa segunda-feira, são seguidas (sem buraco) e somam o total', () => {
    expect(r.semanas.length).toBeGreaterThan(3);
    for (let i = 0; i < r.semanas.length; i++) {
      const d = new Date(`${r.semanas[i]!.segunda}T12:00:00Z`);
      expect(d.getUTCDay(), r.semanas[i]!.segunda).toBe(1);
      if (i > 0) expect((d.getTime() - new Date(`${r.semanas[i - 1]!.segunda}T12:00:00Z`).getTime()) / 86_400_000).toBe(7);
      expect(r.semanas[i]!.n).toBe(r.semanas[i]!.ids.length);
    }
    expect(r.semanas.reduce((s, w) => s + w.n, 0)).toBe(r.total);
    expect(r.total).toBe(r.unidades.length);
  });

  it('cada unidade cai na semana da data dela', () => {
    for (const u of r.unidades) {
      const semana = r.semanas.find((w) => w.ids.includes(u.id));
      expect(semana, u.id).toBeDefined();
      const dias = (new Date(`${u.data}T12:00:00Z`).getTime() - new Date(`${semana!.segunda}T12:00:00Z`).getTime()) / 86_400_000;
      expect(dias, `${u.id} em ${u.data}`).toBeGreaterThanOrEqual(0);
      expect(dias, `${u.id} em ${u.data}`).toBeLessThan(7);
    }
  });

  it('o arpão (17/10) e o laser (15/10) caem na semana de 12/10, e a primeira onda de armas, na de 21/09', () => {
    const naSemana = (segunda: string) => r.semanas.find((w) => w.segunda === segunda)?.ids ?? [];
    expect(naSemana('2026-10-12')).toEqual(expect.arrayContaining(['laser', 'harpoon']));
    expect(naSemana('2026-09-21')).toEqual(expect.arrayContaining(['plasma', 'rockets']));
  });

  it('a média das últimas quatro semanas completas deixa a semana corrente de fora; meses depois, sem conteúdo novo, a média é zero e as semanas vazias aparecem', () => {
    const noMeio = ritmo('2026-10-17'); // sábado: a semana de 12/10 ainda corre
    const completas = noMeio.semanas.filter((w) => w.segunda < '2026-10-12').slice(-4);
    expect(noMeio.media4).toBeCloseTo(completas.reduce((s, w) => s + w.n, 0) / completas.length, 9);
    const longe = ritmo('2027-03-01');
    expect(longe.media4).toBe(0);
    expect(longe.semanas.at(-1)!.n).toBe(0);
    expect(longe.semanas.length).toBeGreaterThanOrEqual(noMeio.semanas.length + 19);
  });
});
