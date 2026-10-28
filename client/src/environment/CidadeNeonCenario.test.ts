import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { ANUNCIOS_QUE_ALTERNAM, PARAMETROS_PADRAO } from '../../../shared/outdoors';
import { SLIDE_DA_LOGO, SLIDES, SLIDES_QUE_ALTERNAM } from '../brand/anuncios';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Arena, PISO_DA_LUZ_DA_CIDADE } from './Arena';
import { CidadeNeonCenario } from './CidadeNeonCenario';
import { layoutDaCidade } from './CidadeNeonLayout';
import { HOLOGRAMA } from './HologramaSerafim';
import { SERAFIM_TOWER } from './SerafimTower';
import { Destructibles } from './Destructibles';
import { carregarCenarioDaCidade, cenarioDaCidadeCarregado } from './mapasSobDemanda';

const abertas: PhysicsWorld[] = [];
afterEach(() => {
  while (abertas.length) abertas.pop()!.world.free();
});

/** A Arena de sempre com a cidade em volta, montada no Node (sem canvas: a arte vira um pixel cinza e o resto monta igual). */
async function cidade(transformador = false) {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const scene = new THREE.Scene();
  const particles = { burst: () => {} } as never;
  const debris = { shatter: () => {} } as never;
  const arena = new Arena(scene, physics, new Destructibles(scene, physics, debris, particles), 'arena', { transformador });
  const vapor: unknown[] = [];
  const cenario = new CidadeNeonCenario(scene, arena, { burst: (...a: unknown[]) => vapor.push(a) } as never);
  return { scene, arena, cenario, vapor };
}

/** Os materiais da cidade (os que leem a luz dela). */
function materiaisDaCidade(scene: THREE.Scene): THREE.ShaderMaterial[] {
  const lista: THREE.ShaderMaterial[] = [];
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (m instanceof THREE.ShaderMaterial && m.uniforms.uLuz) lista.push(m);
  });
  return lista;
}

describe('a cidade em volta da Cidade Neon (P264, PR2)', () => {
  it('troca a grade Tron pela rua desenhada e põe a cidade na cena', async () => {
    const { scene, arena } = await cidade();
    expect(arena.grade!.visible).toBe(false);
    expect((arena.chao!.material as THREE.Material).customProgramCacheKey()).toBe('cybermech-rua-v1');
    const nomes = new Set<string>();
    scene.traverse((o) => nomes.add(o.name));
    for (const n of ['cidade-torres', 'cidade-outdoors', 'cidade-outdoors-paineis', 'cidade-outdoors-brilho', 'cidade-letreiros', 'cidade-neons', 'cidade-postes', 'cidade-chao-molhado', 'cidade-holograma']) expect(nomes.has(n), n).toBe(true);
  });

  it('a luz da cidade inteira cai com o transformador do banco e volta com ele', async () => {
    const { arena, cenario } = await cidade(true);
    arena.registraLuzes(cenario.luzes);
    const luz = cenario.luzes[0]!;
    arena.setEnergia(0);
    expect(luz.r).toBeCloseTo(PISO_DA_LUZ_DA_CIDADE, 6);
    expect(luz.b).toBeCloseTo(PISO_DA_LUZ_DA_CIDADE, 6);
    arena.setEnergia(1);
    expect(luz.r).toBeCloseTo(1, 6);
  });

  it('todo material da cidade lê a mesma luz e o mesmo relógio (o mesmo objeto, não uma cópia)', async () => {
    const { scene, cenario } = await cidade();
    const materiais = materiaisDaCidade(scene);
    // torres, outdoors, letreiros, desenhos, a luz dos postes, o rastro do reflexo e a poça de luz
    expect(materiais.length).toBeGreaterThanOrEqual(7);
    for (const m of materiais) expect(m.uniforms.uLuz!.value).toBe(cenario.luzes[0]);
    const relogio = materiais[0]!.uniforms.uTempo!;
    for (const m of materiais) expect(m.uniforms.uTempo).toBe(relogio);
    cenario.update(0.5);
    expect(relogio.value).toBeCloseTo(0.5, 6);
  });

  it('os bueiros soltam vapor no ParticleSystem da cena, cada um no seu tempo', async () => {
    const { cenario, vapor } = await cidade();
    for (let i = 0; i < 240; i++) cenario.update(1 / 60); // 4 s
    expect(vapor.length).toBeGreaterThanOrEqual(12);
  });

  it('a qualidade baixa tira o chão molhado, a grade de LEDs e o brilho dos outdoors e metade das fatias do holograma, e a alta os devolve', async () => {
    const { scene, cenario } = await cidade();
    const chao = scene.getObjectByName('cidade-chao-molhado')!;
    const brilho = scene.getObjectByName('cidade-outdoors-brilho')!;
    const painel = (scene.getObjectByName('cidade-outdoors-paineis') as THREE.Mesh).material as THREE.ShaderMaterial;
    const fatias = scene.getObjectByName('cidade-holograma-fatias') as THREE.InstancedMesh;
    const total = fatias.count;
    cenario.setDetalhe(false);
    expect(chao.visible).toBe(false);
    expect(brilho.visible).toBe(false);
    expect(painel.uniforms.uDetalhe!.value).toBe(0);
    expect(fatias.count).toBe(Math.ceil(total / 2));
    cenario.setDetalhe(true);
    expect(chao.visible).toBe(true);
    expect(brilho.visible).toBe(true);
    expect(painel.uniforms.uDetalhe!.value).toBe(1);
    expect(fatias.count).toBe(total);
  });

  it('os outdoors: os painéis são UMA malha só (todos alternam entre as mesmas dez imagens) e a configuração padrão deixa no ar só parte deles', async () => {
    const { scene } = await cidade();
    const layout = layoutDaCidade();
    const painel = scene.getObjectByName('cidade-outdoors-paineis') as THREE.InstancedMesh;
    const brilho = scene.getObjectByName('cidade-outdoors-brilho') as THREE.InstancedMesh;
    expect(layout.outdoors.length).toBeGreaterThan(PARAMETROS_PADRAO.quantidade);
    expect(painel.count).toBe(PARAMETROS_PADRAO.quantidade);
    expect(brilho.count).toBe(PARAMETROS_PADRAO.quantidade);
    const material = painel.material as THREE.ShaderMaterial;
    const texturas = SLIDES.map((_, i) => material.uniforms[`uImagem${i}`]!.value);
    expect(new Set(texturas).size, 'uma textura por imagem').toBe(SLIDES.length);
    expect(material.uniforms.uPeriodo!.value).toBe(PARAMETROS_PADRAO.periodo);
    expect(material.uniforms.uCicloN!.value).toBe(SLIDES_QUE_ALTERNAM);
    expect(scene.getObjectByName('cidade-outdoor-odp-olho'), 'não há mais uma malha por anúncio').toBeUndefined();
  });

  it('a quantidade manda: as logos planas são as últimas a sair do ar, depois os maiores; com 0 não sobra nenhum, e o prédio de um outdoor que saiu volta a acender as janelas', async () => {
    const { scene, cenario } = await cidade();
    const layout = layoutDaCidade();
    const painel = scene.getObjectByName('cidade-outdoors-paineis') as THREE.InstancedMesh;
    const torres = scene.getObjectByName('cidade-torres') as THREE.InstancedMesh;
    const hospedeirosNoAr = (): number => {
      const dados = torres.geometry.getAttribute('aTorre') as THREE.InstancedBufferAttribute;
      let n = 0;
      for (let i = 0; i < dados.count; i++) if (dados.getY(i) === 0 && dados.getW(i) === 1) n++; // só os corpos (tipo 0)
      return n;
    };
    const fixas = (n: number): number => {
      const a = painel.geometry.getAttribute('aAnuncio') as THREE.InstancedBufferAttribute;
      let c = 0;
      for (let i = 0; i < n; i++) if (a.getY(i) === SLIDE_DA_LOGO) c++;
      return c;
    };
    for (const q of [0, 1, 2, 10, layout.outdoors.length]) {
      cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: q });
      expect(painel.count, `quantidade ${q}`).toBe(q);
      expect(hospedeirosNoAr(), `prédios sem janela com ${q} outdoors`).toBe(q);
    }
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 2 });
    expect(fixas(2), 'as duas logos são as duas últimas a sair').toBe(2);
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 999 });
    expect(painel.count, 'não passa do que o layout tem').toBe(layout.outdoors.length);
  });

  it('a coroa e a antena herdam o que o corpo do prédio faz: com o outdoor no ar, sem janelas; com ele fora, janelas acesas de novo', async () => {
    const { scene, cenario } = await cidade();
    const layout = layoutDaCidade();
    const torres = scene.getObjectByName('cidade-torres') as THREE.InstancedMesh;
    const dados = torres.geometry.getAttribute('aTorre') as THREE.InstancedBufferAttribute;
    // A ordem das instâncias é a da lista por anel (estável); recalcula-a aqui para achar a instância de cada torre.
    const instancia = layout.torres.map((_, i) => i).sort((x, y) => layout.torres[x]!.anel - layout.torres[y]!.anel);
    const corpoDe: number[] = [];
    layout.torres.forEach((t, i) => corpoDe.push(t.tipo === 0 ? i : corpoDe[i - 1]!));
    const semJanela = (i: number): boolean => dados.getW(instancia.indexOf(i)) === 1;
    const coroas = layout.torres.map((_, i) => i).filter((i) => layout.torres[i]!.tipo !== 0 && layout.torres[corpoDe[i]!]!.temBanner);
    expect(coroas.length, 'há coroas ou antenas sobre prédios com outdoor').toBeGreaterThan(0);
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 999 });
    for (const i of coroas) expect(semJanela(i), `a coroa/antena ${i} sobre um prédio com outdoor no ar`).toBe(true);
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 0 });
    for (const i of coroas) expect(semJanela(i), `a coroa/antena ${i} depois que o outdoor saiu`).toBe(false);
    // E o que nunca teve outdoor nunca fica sem janela.
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 999 });
    layout.torres.forEach((_, i) => {
      if (!layout.torres[corpoDe[i]!]!.temBanner) expect(semJanela(i), `torre ${i} sem outdoor`).toBe(false);
    });
  });

  it('o período e os anúncios desligados chegam ao shader: o anel só tem as imagens dos anúncios que ficaram, e cada outdoor começa numa delas', async () => {
    const { scene, cenario } = await cidade();
    const painel = scene.getObjectByName('cidade-outdoors-paineis') as THREE.InstancedMesh;
    const u = (painel.material as THREE.ShaderMaterial).uniforms;
    cenario.aplicarOutdoors({ quantidade: 30, periodo: 15, desligados: ['odp-ping', 'swb'] });
    expect(u.uPeriodo!.value).toBe(15);
    const n = u.uCicloN!.value as number;
    const anel = (u.uCiclo!.value as number[]).slice(0, n);
    expect(n).toBe(SLIDES_QUE_ALTERNAM - 2);
    expect(anel.every((i) => i >= 0 && i < SLIDES_QUE_ALTERNAM), 'só imagens que alternam (a logo fica de fora)').toBe(true);
    expect(anel.map((i) => SLIDES[i]!.anuncio).filter((a) => a === 'odp-ping' || a === 'swb')).toHaveLength(0);
    expect(new Set(anel).size, 'sem repetir imagem').toBe(n);
    const a = painel.geometry.getAttribute('aAnuncio') as THREE.InstancedBufferAttribute;
    for (let i = 0; i < painel.count; i++) if (a.getY(i) < 0) expect(a.getX(i), 'começa dentro do anel').toBeLessThan(n);
  });

  it('o reflexo no chão acompanha: um outdoor que saiu do ar deixa de refletir, e a cor segue a imagem de agora (o mesmo anel dos painéis)', async () => {
    const { scene, cenario } = await cidade();
    const chao = scene.getObjectByName('cidade-chao-molhado')!;
    const rastro = chao.children[0] as THREE.Mesh;
    const a = rastro.geometry.getAttribute('aAnuncio') as THREE.InstancedBufferAttribute;
    const doOutdoor = (): number[] => {
      const r: number[] = [];
      for (let i = 0; i < a.count; i++) if (a.getY(i) > -1.5) r.push(i); // −2 = não é outdoor
      return r;
    };
    const fontes = doOutdoor();
    expect(fontes.length).toBeGreaterThan(0);
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 0 });
    expect(fontes.every((i) => a.getW(i) === 0), 'nenhum outdoor no ar, nenhum reflexo').toBe(true);
    cenario.aplicarOutdoors({ ...PARAMETROS_PADRAO, quantidade: 999 });
    expect(fontes.every((i) => a.getW(i) === 1)).toBe(true);
    const uRastro = (rastro.material as THREE.ShaderMaterial).uniforms;
    const uPainel = ((scene.getObjectByName('cidade-outdoors-paineis') as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
    for (const nome of ['uCiclo', 'uCicloN', 'uPeriodo', 'uCores']) expect(uRastro[nome], `${nome}: o mesmo objeto nos dois`).toBe(uPainel[nome]);
  });

  it('carregarOutdoors aplica o que o servidor devolve, ignora lixo e não lança sem rede', async () => {
    const { scene, cenario } = await cidade();
    const painel = scene.getObjectByName('cidade-outdoors-paineis') as THREE.InstancedMesh;
    const resposta = (corpo: unknown, ok = true) => (async () => ({ ok, json: async () => corpo }) as unknown as Response) as typeof fetch;
    await cenario.carregarOutdoors('ws://127.0.0.1:0', resposta({ versao: 3, quantidade: 7, periodo: 20, desligados: ['odp-sos'] }));
    expect(painel.count).toBe(7);
    expect(cenario.outdoorsDaVez()).toEqual({ quantidade: 7, periodo: 20, desligados: ['odp-sos'] });
    await cenario.carregarOutdoors('ws://127.0.0.1:0', resposta('lixo')); // formato torto: o padrão do código
    expect(cenario.outdoorsDaVez().quantidade).toBe(PARAMETROS_PADRAO.quantidade);
    await cenario.carregarOutdoors('ws://127.0.0.1:0', resposta({ quantidade: 3 }, false)); // servidor com erro: não mexe
    expect(cenario.outdoorsDaVez().quantidade).toBe(PARAMETROS_PADRAO.quantidade);
    await expect(
      cenario.carregarOutdoors('ws://127.0.0.1:0', (async () => {
        throw new Error('sem rede');
      }) as typeof fetch),
    ).resolves.toBeUndefined();
    await expect(cenario.carregarOutdoors(undefined)).resolves.toBeUndefined();
  });

  it('o catálogo e o contrato dos outdoors andam juntos: os anúncios que o painel liga e desliga são exatamente os do catálogo que alternam', () => {
    const doCatalogo = [...new Set(SLIDES.slice(0, SLIDES_QUE_ALTERNAM).map((s) => s.anuncio))];
    expect([...ANUNCIOS_QUE_ALTERNAM].sort()).toEqual([...doCatalogo].sort());
    expect(SLIDES[SLIDE_DA_LOGO]!.anuncio).toBe('logo');
    expect(SLIDES.length, 'cada imagem é um amostrador no shader: o WebGL2 garante 16').toBeLessThanOrEqual(16);
  });

  it('o holograma flutua sobre o prédio Serafim (no ar, acima do teto, centrado nele), gira e balança sozinho', async () => {
    const { scene, cenario } = await cidade();
    const h = scene.getObjectByName('cidade-holograma')!;
    expect(h.position.x).toBe(SERAFIM_TOWER.x);
    expect(h.position.z).toBe(SERAFIM_TOWER.z);
    expect(h.position.y - HOLOGRAMA.tamanho / 2, 'a base do holograma fica acima do teto do prédio').toBeGreaterThan(SERAFIM_TOWER.height);
    const antes = h.rotation.y;
    cenario.update(1);
    expect(h.rotation.y).toBeCloseTo(antes + HOLOGRAMA.giro, 6);
    cenario.update(1);
    expect(h.rotation.y).toBeGreaterThan(antes + HOLOGRAMA.giro);
    expect(h.position.y).not.toBe(HOLOGRAMA.y); // o balanço
    expect(scene.getObjectByName('cidade-holograma-anel')).toBeDefined();
    expect(scene.getObjectByName('cidade-holograma-feixe')).toBeDefined();
  });

  it('o holograma desenha menos camadas quando a câmera está perto (custo de preenchimento) e todas quando está longe, sem mudar o brilho total', async () => {
    const { scene, cenario } = await cidade();
    const fatias = scene.getObjectByName('cidade-holograma-fatias') as THREE.InstancedMesh;
    const material = fatias.material as THREE.ShaderMaterial;
    const alfaCheio = material.uniforms.uAlfa!.value as number;
    const total = fatias.count;
    cenario.update(1 / 60, new THREE.Vector3(HOLOGRAMA.x, 4, HOLOGRAMA.z + 26)); // de baixo dele, no chão
    expect(fatias.count).toBeLessThan(total / 2);
    expect(material.uniforms.uFatias!.value, 'o shader espalha as camadas pelo número de agora').toBe(fatias.count);
    expect((material.uniforms.uAlfa!.value as number) * fatias.count, 'a soma do brilho não muda').toBeCloseTo(alfaCheio * total, 6);
    cenario.update(1 / 60, new THREE.Vector3(HOLOGRAMA.x - 400, 4, HOLOGRAMA.z)); // de longe
    expect(fatias.count).toBe(total);
    expect(material.uniforms.uAlfa!.value).toBeCloseTo(alfaCheio, 6);
    // Na qualidade baixa a rampa vale do mesmo jeito, sobre a metade.
    cenario.setDetalhe(false);
    expect(fatias.count).toBe(Math.ceil(total / 2));
  });

  it('o pedaço sob demanda entrega a fábrica da cidade', async () => {
    await carregarCenarioDaCidade();
    expect(cenarioDaCidadeCarregado()?.construir).toBeTypeOf('function');
  });
});
