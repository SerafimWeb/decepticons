import { describe, expect, it } from 'vitest';
import { CACETETE, ChefesJaneiro, type AlvoJaneiro } from './ChefesJaneiro';

const alvo = (x = 65, z = 30): AlvoJaneiro => ({ alive: true, simPosition: { x, y: 0, z }, yaw: 0 });
const andar = (c: ChefesJaneiro, n: number, a: AlvoJaneiro[] = []) => { for (let i = 0; i < n; i++) c.avancar(1 / 60, a); };
const vencer = (c: ChefesJaneiro) => { const b = c.ativo!; expect(c.atirar(b.x - 5, 3, b.z, 1, 0, 0, 10, b.vida)).toBe(true); };

describe('P250: Trampado, Evil e o cacetete conquistado', () => {
  it('nasce aos 20 s, espera 3 s entre chefes e só entrega o prêmio após Evil', () => {
    const c = new ChefesJaneiro(); let premios = 0; c.aoConquistar = () => premios++;
    andar(c, 1199); expect(c.ativo).toBeUndefined(); expect(c.restantes).toBe(2);
    andar(c, 1); expect(c.ativo?.config.id).toBe('trampado');
    vencer(c); expect(c.restantes).toBe(1); expect(c.conquistado).toBe(false);
    andar(c, 179); expect(c.ativo).toBeUndefined(); andar(c, 2);
    expect(c.ativo?.config.id).toBe('evil'); vencer(c);
    expect(c.restantes).toBe(0); expect(c.conquistado).toBe(true); expect(premios).toBe(1);
    andar(c, 300); expect(premios).toBe(1);
  });
  it('prepara a cacetada, fixa o aviso e acerta uma única vez; fugir do círculo evita o dano', () => {
    const c = new ChefesJaneiro(), a = alvo(77, 30); let dano = 0;
    c.aoAcertar = (_i, d) => dano += d;
    andar(c, 1200, [a]); expect(c.ativo?.estado).toBe('aviso'); expect(dano).toBe(0);
    andar(c, 30, [a]); expect(dano).toBe(0);
    andar(c, 40, [a]); expect(dano).toBe(28);
    andar(c, 60, [a]); expect(dano).toBe(28);
    const d = new ChefesJaneiro(); let atingido = false; d.aoAcertar = () => atingido = true;
    andar(d, 1200, [a]); a.simPosition.x = 50; andar(d, 70, [a]); expect(atingido).toBe(false);
  });
  it('não ataca quem morreu ou saltou acima do golpe', () => {
    for (const morto of [true, false]) {
      const c = new ChefesJaneiro(), a = alvo(77, 30); let hits = 0; c.aoAcertar = () => hits++;
      andar(c, 1200, [a]); if (morto) a.alive = false; else a.simPosition.y = 8;
      andar(c, 120, [a]); expect(hits).toBe(0);
    }
  });
  it('tiro tem limite de altura, alcance e dano válido; tiro acima e explosão longe não acertam', () => {
    const c = new ChefesJaneiro(); andar(c, 1200); const b = c.ativo!;
    expect(c.atirar(b.x - 5, 20, b.z, 1, 0, 0, 10, 100)).toBe(false);
    expect(c.atirar(b.x - 5, 2, b.z, 1, 0, 0, 1, 100)).toBe(false);
    expect(c.explodir(b.x, 40, b.z, 2, 100)).toBe(false);
    c.atirar(b.x - 5, 2, b.z, 1, 0, 0, 10, NaN); expect(b.vida).toBe(b.config.vida);
    c.atirar(b.x, 10, b.z, 0, -1, 0, 12, 50); expect(b.vida).toBe(b.config.vida - 50);
  });
  it('recompensa exige conquista, permissão, jogador vivo e recarga; o render só enfileira', () => {
    const c = new ChefesJaneiro(), a = alvo(); let golpes = 0; c.aoGolpear = () => golpes++;
    c.golpePendente = true; andar(c, 1, [a]); expect(golpes).toBe(0);
    c.conquistado = true; c.armaPermitida = false; c.golpePendente = true; andar(c, 1, [a]); expect(golpes).toBe(0);
    c.armaPermitida = true; c.golpePendente = true; expect(golpes).toBe(0); andar(c, 1, [a]); expect(golpes).toBe(1);
    c.golpePendente = true; andar(c, 1, [a]); expect(golpes).toBe(1);
    andar(c, Math.ceil(CACETETE.intervalo * 60)); c.golpePendente = true; a.alive = false; andar(c, 1, [a]); expect(golpes).toBe(1);
    a.alive = true; c.golpePendente = true; andar(c, 1, [a]); expect(golpes).toBe(2);
  });
  it('reinicia o encontro sem duplicar chefes e preserva o troféu já conquistado', () => {
    const c = new ChefesJaneiro(), ref = c.chefes[0]; andar(c, 1200); vencer(c); c.conquistado = true;
    c.golpePendente = true; c.reiniciar();
    expect(c.chefes[0]).toBe(ref); expect(c.restantes).toBe(2); expect(c.ativo).toBeUndefined(); expect(c.conquistado).toBe(true); expect(c.golpePendente).toBe(false);
  });
  it('desligar o encontro o retira da vitória e impede dano e recompensa', () => {
    const c = new ChefesJaneiro(); c.habilitado = false; andar(c, 1800, [alvo()]);
    expect(c.restantes).toBe(0); expect(c.ativo).toBeUndefined(); expect(c.explodir(80, 0, 28, 100, 9999)).toBe(false);
  });
  it('movimento determinístico não atravessa o monumento da Praça', () => {
    const a = new ChefesJaneiro(), b = new ChefesJaneiro(), p = alvo(65, -30);
    andar(a, 3000, [p]); andar(b, 3000, [p]);
    expect(a.ativo?.x).toBe(b.ativo?.x); expect(a.ativo?.z).toBe(b.ativo?.z);
    const c = a.ativo!; expect(Math.abs(c.x - 70) < 4.5 && Math.abs(c.z) < 4.5).toBe(false);
  });
});
