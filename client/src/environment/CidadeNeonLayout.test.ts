import { describe, expect, it } from 'vitest';
import { ANUNCIOS, type IdDoAnuncio } from '../brand/anuncios';
import { BARRICADES_DA_ARENA, BUILDINGS_DA_ARENA, PLATAFORMA_DA_ARENA, SPAWN_POINTS } from './Arena';
import { BORDA_DA_PRACA, BRACO_DO_POSTE, COLUNAS_DE_GLIFOS, DESENHOS_DE_NEON, layoutDaCidade, pontosEscondidosDeQuemNasce, RUA, type TorreDaCidade } from './CidadeNeonLayout';
import { SERAFIM_TOWER } from './SerafimTower';

const cidade = layoutDaCidade();
/** A "distância quadrada" do centro: a praça e o anel da avenida são quadrados. */
const quadrada = (x: number, z: number): number => Math.max(Math.abs(x), Math.abs(z));
/** A posição ao longo do lado (norte e sul andam em x, leste e oeste em z), a mesma convenção do desenho do piso. */
const aoLongo = (x: number, z: number): { s: number; faixaDeLado: number } =>
  Math.abs(x) >= Math.abs(z) ? { s: z, faixaDeLado: -RUA.faixaDeLado } : { s: x, faixaDeLado: RUA.faixaDeLado };
const naFaixaDePedestre = (x: number, z: number, folga: number): boolean => {
  const { s, faixaDeLado } = aoLongo(x, z);
  return Math.abs(s - RUA.faixaDoMeio) < RUA.meiaFaixa + folga || Math.abs(s - faixaDeLado) < RUA.meiaFaixa + folga;
};
const dentro = (t: TorreDaCidade, x: number, z: number, folga = 0): boolean =>
  Math.abs(x - t.x) <= t.w / 2 + folga && Math.abs(z - t.z) <= t.d / 2 + folga;

describe('o entorno da Cidade Neon (P264, PR2)', () => {
  it('é sempre a mesma cidade (semente fixa, montada uma vez)', () => {
    expect(layoutDaCidade()).toBe(cidade);
  });

  it('tem cidade de verdade: três filas de torres, outdoors, letreiros, desenhos, postes e bueiros', () => {
    const porAnel = (a: number) => cidade.torres.filter((t) => t.anel === a && t.tipo === 0).length;
    expect(porAnel(1)).toBeGreaterThanOrEqual(36);
    expect(porAnel(2)).toBeGreaterThanOrEqual(24);
    expect(porAnel(3)).toBeGreaterThanOrEqual(40);
    expect(cidade.outdoors.length).toBeGreaterThanOrEqual(36);
    expect(cidade.letreiros.length).toBeGreaterThanOrEqual(30);
    expect(cidade.neons.length).toBeGreaterThanOrEqual(4);
    expect(cidade.postes.length).toBeGreaterThanOrEqual(20);
    expect(cidade.bueiros.filter((b) => !b.grelha).length).toBeGreaterThanOrEqual(6);
  });

  it('nada do entorno entra na praça jogável (a parede invisível fica em ±100 m)', () => {
    for (const t of cidade.torres) {
      // Uma caixa alinhada fica fora do quadrado se passa da borda em x ou em z.
      expect(Math.max(Math.abs(t.x) - t.w / 2, Math.abs(t.z) - t.d / 2), `torre em (${t.x.toFixed(1)}, ${t.z.toFixed(1)})`).toBeGreaterThan(BORDA_DA_PRACA);
    }
    for (const o of cidade.outdoors) expect(quadrada(o.x, o.z)).toBeGreaterThan(BORDA_DA_PRACA + 2);
    for (const n of cidade.neons) expect(quadrada(n.x, n.z)).toBeGreaterThan(BORDA_DA_PRACA + 2);
    // O letreiro de bandeira sai da parede para a calçada, mas para antes da borda.
    for (const l of cidade.letreiros) expect(quadrada(l.x, l.z) - l.largura / 2).toBeGreaterThan(BORDA_DA_PRACA);
  });

  it('as torres de uma mesma fila não se atravessam', () => {
    for (const anel of [1, 2] as const) {
      const fila = cidade.torres.filter((t) => t.anel === anel && t.tipo === 0);
      for (let i = 0; i < fila.length; i++) {
        for (let j = i + 1; j < fila.length; j++) {
          const a = fila[i]!;
          const b = fila[j]!;
          const cruza = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.01;
          expect(cruza, `fila ${anel}: (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) e (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`).toBe(false);
        }
      }
    }
  });

  it('as torres do fundo (3ª fila) ficam além das duas filas de dentro: nenhuma cruza outra (nas diagonais, um anel redondo cruzaria a 2ª fila)', () => {
    const dentroDeCasa = cidade.torres.filter((t) => t.anel < 3 && t.tipo === 0);
    for (const fundo of cidade.torres.filter((t) => t.anel === 3 && t.tipo === 0)) {
      for (const t of dentroDeCasa) {
        const cruza = Math.abs(fundo.x - t.x) < (fundo.w + t.w) / 2 && Math.abs(fundo.z - t.z) < (fundo.d + t.d) / 2;
        expect(cruza, `fundo (${fundo.x.toFixed(0)}, ${fundo.z.toFixed(0)}) × fila ${t.anel} (${t.x.toFixed(0)}, ${t.z.toFixed(0)})`).toBe(false);
      }
    }
  });

  it('cada outdoor está pregado numa fachada, inteiro: as duas bordas dele caem dentro da mesma torre, e ele é vertical (1:2) e não passa do teto', () => {
    const torres = cidade.torres.filter((t) => t.tipo === 0 && t.anel < 3);
    for (const o of cidade.outdoors) {
      // O plano olha para dentro (sen ry, cos ry); meio metro para fora entra na parede. A tangente da fachada é (cos ry, −sen ry).
      const px = o.x - Math.sin(o.ry) * 0.5;
      const pz = o.z - Math.cos(o.ry) * 0.5;
      const tx = Math.cos(o.ry) * (o.w / 2);
      const tz = -Math.sin(o.ry) * (o.w / 2);
      const dona = torres.find((d) => dentro(d, px + tx, pz + tz, 0.01) && dentro(d, px - tx, pz - tz, 0.01));
      expect(dona, `outdoor em (${o.x.toFixed(1)}, ${o.y.toFixed(1)}, ${o.z.toFixed(1)})`).toBeDefined();
      expect(o.y + o.h / 2).toBeLessThanOrEqual(dona!.h);
      expect(o.y - o.h / 2).toBeGreaterThan(4); // acima das lojas do térreo
      expect(o.h / o.w, 'na vertical: o dobro da largura').toBeCloseTo(2, 6);
      expect(o.w).toBeGreaterThanOrEqual(6.5);
    }
  });

  it('imponentes: o maior que a fachada comporta (a maioria passa de 9 m de largura e alguns de 18), e a segunda fila sobe acima do paredão da frente', () => {
    const larguras = cidade.outdoors.map((o) => o.w);
    expect(larguras.filter((w) => w >= 9).length).toBeGreaterThanOrEqual(cidade.outdoors.length * 0.6);
    expect(Math.max(...larguras)).toBeGreaterThanOrEqual(18);
    const torres = cidade.torres.filter((t) => t.tipo === 0 && t.anel === 2);
    const nasegunda = cidade.outdoors.filter((o) => Math.max(Math.abs(o.x), Math.abs(o.z)) > 140);
    expect(nasegunda.length).toBeGreaterThanOrEqual(8);
    for (const o of nasegunda) expect(o.y - o.h / 2, 'a segunda fila: o outdoor começa acima do paredão (46 m)').toBeGreaterThanOrEqual(45.9);
    expect(torres.length).toBeGreaterThan(0);
  });

  it('o prédio que hospeda outdoor não acende janela (temBanner); e só ele: nenhuma torre marcada fica sem outdoor, nenhum outdoor sem a torre marcada', () => {
    const corpos = cidade.torres.filter((t) => t.tipo === 0 && t.anel < 3);
    const marcados = corpos.filter((t) => t.temBanner);
    expect(marcados.length).toBe(cidade.outdoors.length);
    for (const o of cidade.outdoors) {
      const px = o.x - Math.sin(o.ry) * 0.5;
      const pz = o.z - Math.cos(o.ry) * 0.5;
      const dona = corpos.find((d) => dentro(d, px, pz, 0.01));
      expect(dona?.temBanner, `a dona do outdoor em (${o.x.toFixed(0)}, ${o.z.toFixed(0)}) tem de estar marcada`).toBe(true);
    }
    // O fundo (anel 3) e as antenas nunca hospedam; a coroa herda a marca do corpo (é o mesmo prédio).
    expect(cidade.torres.filter((t) => t.anel === 3 && t.temBanner)).toHaveLength(0);
    expect(cidade.torres.filter((t) => t.tipo === 2 && t.temBanner)).toHaveLength(0);
  });

  it('as duas logos planas: uma no norte, perto do eixo (a primeira coisa que o jogador vê ao nascer) e uma no oeste; e nenhuma outra', () => {
    const logos = cidade.outdoors.filter((o) => o.anuncio === 'logo');
    expect(logos).toHaveLength(2);
    const norte = logos.find((o) => Math.abs(o.ry) < 1e-9);
    const oeste = logos.find((o) => Math.abs(o.ry - Math.PI / 2) < 1e-9);
    expect(norte, 'a logo do norte').toBeDefined();
    expect(oeste, 'a logo do oeste').toBeDefined();
    expect(Math.abs(norte!.x), 'perto do eixo, na frente de quem nasce').toBeLessThan(45);
    expect(Math.abs(oeste!.z)).toBeLessThan(45);
    expect(norte!.w).toBeGreaterThanOrEqual(10); // um prédio de destaque
  });

  it('as duas logos aparecem inteiras para quem nasce (nenhum prédio da praça esconde o painel)', () => {
    for (const o of cidade.outdoors.filter((o) => o.anuncio === 'logo')) {
      expect(pontosEscondidosDeQuemNasce(o.x, o.y, o.z, o.ry, o.w, o.h), `a logo em (${o.x.toFixed(0)}, ${o.z.toFixed(0)}) está atrás de um prédio da praça`).toBe(0);
    }
  });

  it('os anúncios: o Olho do Pai domina, o bureau aparece, o que alterna aparece várias vezes, todos do catálogo, e dois iguais não ficam lado a lado', () => {
    const catalogo = new Set<IdDoAnuncio>(ANUNCIOS.map((a) => a.id));
    const contagem = new Map<IdDoAnuncio, number>();
    for (const o of cidade.outdoors) {
      expect(catalogo.has(o.anuncio), o.anuncio).toBe(true);
      contagem.set(o.anuncio, (contagem.get(o.anuncio) ?? 0) + 1);
    }
    for (const a of ANUNCIOS) expect(contagem.get(a.id) ?? 0, `${a.id} tem de aparecer`).toBeGreaterThanOrEqual(a.id === 'logo' ? 2 : 2);
    const semLogo = cidade.outdoors.filter((o) => o.anuncio !== 'logo');
    const doOdp = semLogo.filter((o) => o.anuncio.startsWith('odp-')).length;
    expect(doOdp / semLogo.length, 'o Olho do Pai é a maioria').toBeGreaterThan(0.6);
    expect(contagem.get('odp-familia') ?? 0, 'o que alterna').toBeGreaterThanOrEqual(3);
    // Vizinhos na mesma fila (mesma rotação, anel, ordem de geração): não repetem o anúncio (as logos, escolhidas à parte, podem).
    for (let i = 1; i < cidade.outdoors.length; i++) {
      const a = cidade.outdoors[i - 1]!;
      const b = cidade.outdoors[i]!;
      if (Math.abs(a.ry - b.ry) > 1e-9 || a.anuncio === 'logo' || b.anuncio === 'logo') continue;
      expect(b.anuncio === a.anuncio, `dois ${a.anuncio} lado a lado em (${a.x.toFixed(0)}, ${a.z.toFixed(0)}) e (${b.x.toFixed(0)}, ${b.z.toFixed(0)})`).toBe(false);
    }
  });

  it('nenhum outdoor encosta num letreiro de bandeira (os de quina ficam fora da largura do painel)', () => {
    for (const o of cidade.outdoors) {
      const nx = Math.sin(o.ry);
      const nz = Math.cos(o.ry);
      const tx = Math.cos(o.ry);
      const tz = -Math.sin(o.ry);
      for (const l of cidade.letreiros) {
        if (Math.abs(l.ry - o.ry) > 1e-9) continue;
        const dx = l.x - o.x;
        const dz = l.z - o.z;
        const ao = dx * tx + dz * tz; // ao longo da fachada
        const fora = dx * nx + dz * nz; // para fora da parede
        if (Math.abs(fora) > 4 || Math.abs(ao) > o.w / 2 + 0.5) continue; // outra fachada, ou fora da largura do painel
        const sobrepoeAltura = Math.abs(l.y - o.y) < l.altura / 2 + o.h / 2;
        expect(sobrepoeAltura, `letreiro em (${l.x.toFixed(0)}, ${l.y.toFixed(0)}, ${l.z.toFixed(0)}) dentro da largura do outdoor em (${o.x.toFixed(0)}, ${o.y.toFixed(0)}, ${o.z.toFixed(0)})`).toBe(false);
      }
    }
  });

  it('os índices dos atlas existem (`CidadeNeonArte.ts` desenha exatamente estes)', () => {
    for (const l of cidade.letreiros) expect(l.coluna).toBeLessThan(COLUNAS_DE_GLIFOS);
    for (const n of cidade.neons) expect(n.desenho).toBeLessThan(DESENHOS_DE_NEON);
  });

  it('os postes ficam na calçada da praça, com a cabeça sobre a avenida, longe das faixas de pedestre e de qualquer prédio', () => {
    for (const p of cidade.postes) {
      const onde = `poste em (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
      expect(quadrada(p.x, p.z), onde).toBeGreaterThan(RUA.calcadao);
      expect(quadrada(p.x, p.z), onde).toBeLessThan(RUA.meioFio);
      const cabeca = quadrada(p.x + p.fx * BRACO_DO_POSTE, p.z + p.fz * BRACO_DO_POSTE);
      expect(cabeca, onde).toBeGreaterThan(RUA.meioFio);
      expect(cabeca, onde).toBeLessThan(RUA.borda);
      expect(naFaixaDePedestre(p.x, p.z, 3), onde).toBe(false);
      // Fora do prédio Serafim (14 × 14 m em volta do centro dele) e dos prédios e da plataforma da praça.
      expect(Math.abs(p.x - SERAFIM_TOWER.x) < 8 && Math.abs(p.z - SERAFIM_TOWER.z) < 8, onde).toBe(false);
      for (const b of [...BUILDINGS_DA_ARENA, { ...PLATAFORMA_DA_ARENA }]) expect(Math.abs(p.x - b.x) < b.w / 2 + 1 && Math.abs(p.z - b.z) < b.d / 2 + 1, onde).toBe(false);
      // A rotação aponta o braço (+z local) para a avenida.
      expect(Math.sin(p.ry)).toBeCloseTo(p.fx, 6);
      expect(Math.cos(p.ry)).toBeCloseTo(p.fz, 6);
    }
  });

  it('as tampas de bueiro ficam numa pista da avenida e as grelhas na calçada das fachadas, nenhuma na faixa de pedestre', () => {
    for (const b of cidade.bueiros) {
      const q = quadrada(b.x, b.z);
      if (b.grelha) expect(q).toBeGreaterThan(RUA.borda);
      else {
        expect(q).toBeGreaterThan(RUA.meioFio + 0.9);
        expect(q).toBeLessThan(RUA.borda - 0.9);
        expect(naFaixaDePedestre(b.x, b.z, 0.9), `tampa em (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`).toBe(false);
      }
    }
  });

  it('a avenida não passa por cima de ponto de nascimento, barricada nem prédio da praça (o anel fica todo além deles)', () => {
    for (const [x, z] of SPAWN_POINTS) expect(quadrada(x, z)).toBeLessThan(RUA.calcadao);
    for (const b of [...BUILDINGS_DA_ARENA, ...BARRICADES_DA_ARENA]) expect(Math.max(Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2)).toBeLessThan(RUA.calcadao);
  });
});
