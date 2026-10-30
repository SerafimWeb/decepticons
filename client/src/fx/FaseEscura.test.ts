import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CEU_COM_VISAO,
  CEU_SEM_VISAO,
  ESCURIDAO_QUE_LIGA_AS_LUZES,
  FaseEscura,
  fatorDaLuz,
  fatorDoCeu,
  LUZES_DO_PULSO,
  NEVOA_DOS_OCULOS,
  PISO_DA_LUZ_COM_VISAO,
  PISO_DA_LUZ_SEM_VISAO,
} from './FaseEscura';

/** As luzes pontuais que estão na cena. */
const pontuais = (scene: THREE.Scene): THREE.PointLight[] => scene.children.filter((c): c is THREE.PointLight => c instanceof THREE.PointLight);

/** Uma cena como a da Cidade Neon: hemisfério, sol, contraluz, névoa exponencial e céu. */
function cena(fundo: 'cor' | 'textura' = 'textura') {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0x88aaff, 0x221133, 0.9);
  const sol = new THREE.DirectionalLight(0xffeeaa, 1.2);
  const rim = new THREE.DirectionalLight(0xff88cc, 0.6);
  scene.add(hemi, sol, rim);
  scene.fog = new THREE.FogExp2(0x303040, 0.0095);
  scene.environmentIntensity = 0.25;
  scene.background = fundo === 'cor' ? new THREE.Color(0x203060) : new THREE.Texture();
  return { scene, hemi, sol, rim };
}

describe('a conta do escuro (fx/FaseEscura): quanto resta das luzes e do céu', () => {
  it('dia = tudo; escuro total = o piso de quem enxerga ou não no escuro; entre os dois, uma rampa', () => {
    expect(fatorDaLuz(0, false)).toBe(1);
    expect(fatorDaLuz(0, true)).toBe(1);
    expect(fatorDaLuz(1, false)).toBeCloseTo(PISO_DA_LUZ_SEM_VISAO, 9);
    expect(fatorDaLuz(1, true)).toBeCloseTo(PISO_DA_LUZ_COM_VISAO, 9);
    expect(fatorDaLuz(0.5, false)).toBeCloseTo((1 + PISO_DA_LUZ_SEM_VISAO) / 2, 9);
    expect(fatorDoCeu(1, false)).toBeCloseTo(CEU_SEM_VISAO, 9);
    expect(fatorDoCeu(1, true)).toBeCloseTo(CEU_COM_VISAO, 9);
  });

  it('os óculos sempre enxergam mais que a vista nua, em qualquer escuridão', () => {
    for (let e = 0.1; e <= 1; e += 0.1) {
      expect(fatorDaLuz(e, true)).toBeGreaterThan(fatorDaLuz(e, false));
      expect(fatorDoCeu(e, true)).toBeGreaterThan(fatorDoCeu(e, false));
    }
  });

  it('valor torto não passa dos limites', () => {
    expect(fatorDaLuz(-4, false)).toBe(1);
    expect(fatorDaLuz(9, false)).toBeCloseTo(PISO_DA_LUZ_SEM_VISAO, 9);
  });
});

describe('a cena escura: as luzes do dia caem, os óculos tingem de verde, e o dia volta exato', () => {
  it('no escuro total sem óculos: as três luzes caem ao piso e o céu e a névoa escurecem', () => {
    const { scene, hemi, sol, rim } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(1, false);
    expect(hemi.intensity).toBeCloseTo(0.9 * PISO_DA_LUZ_SEM_VISAO, 9);
    expect(sol.intensity).toBeCloseTo(1.2 * PISO_DA_LUZ_SEM_VISAO, 9);
    expect(rim.intensity).toBeCloseTo(0.6 * PISO_DA_LUZ_SEM_VISAO, 9);
    expect(scene.backgroundIntensity).toBeCloseTo(CEU_SEM_VISAO, 9);
    // o reflexo do ambiente (a luz que faz o metal brilhar sem luz nenhuma) cai junto: sem isso o Mech seguia aceso no escuro
    expect(scene.environmentIntensity).toBeCloseTo(0.25 * PISO_DA_LUZ_SEM_VISAO, 9);
    expect(scene.fog!.color.r).toBeLessThan(0.05);
    expect(sol.color.getHex()).toBe(0xffeeaa); // sem óculos a cor não tinge
  });

  it('com os óculos: luz bem maior que a vista nua, tingida de verde, névoa mais densa e esverdeada', () => {
    const nua = cena();
    const comOculos = cena();
    const a = new FaseEscura(nua.scene);
    const b = new FaseEscura(comOculos.scene);
    a.registrar();
    b.registrar();
    a.aplicar(1, false);
    b.aplicar(1, true);
    expect(comOculos.sol.intensity).toBeGreaterThan(nua.sol.intensity * 5);
    expect(comOculos.sol.intensity).toBeCloseTo(1.2 * PISO_DA_LUZ_COM_VISAO, 9);
    const c = comOculos.sol.color;
    expect(c.g).toBeGreaterThan(c.r); // verde
    expect(c.g).toBeGreaterThan(c.b);
    const fog = comOculos.scene.fog as THREE.FogExp2;
    expect(fog.density).toBeCloseTo(0.0095 * NEVOA_DOS_OCULOS, 9);
    expect(fog.color.g).toBeGreaterThan(fog.color.r);
  });

  it('o céu de cor sólida também escurece (o de textura usa o brilho do fundo)', () => {
    const { scene } = cena('cor');
    const f = new FaseEscura(scene);
    f.registrar();
    const base = (scene.background as THREE.Color).clone();
    f.aplicar(1, false);
    expect((scene.background as THREE.Color).r).toBeCloseTo(base.r * CEU_SEM_VISAO, 9);
    f.aplicar(0, false);
    expect((scene.background as THREE.Color).getHex()).toBe(base.getHex());
  });

  it('voltar ao dia devolve exatamente as luzes, a névoa e o céu de fábrica', () => {
    const { scene, hemi, sol } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(1, true);
    f.aplicar(0, false);
    expect(hemi.intensity).toBe(0.9);
    expect(sol.intensity).toBe(1.2);
    expect(sol.color.getHex()).toBe(0xffeeaa);
    expect(scene.backgroundIntensity).toBe(1);
    expect(scene.environmentIntensity).toBe(0.25);
    expect((scene.fog as THREE.FogExp2).density).toBe(0.0095);
    expect(scene.fog!.color.getHex()).toBe(0x303040);
  });

  it('a escuridão vai e volta aos poucos: uma variação minúscula não refaz as cores, uma grande sim', () => {
    const { scene, sol } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(0.5, false);
    const antes = sol.intensity;
    f.aplicar(0.501, false); // abaixo do passo: nada muda
    expect(sol.intensity).toBe(antes);
    f.aplicar(0.6, false);
    expect(sol.intensity).toBeLessThan(antes);
  });

  it('antes de `registrar` não mexe em nada (a cena ainda não existe)', () => {
    const { scene, sol } = cena();
    const f = new FaseEscura(scene);
    f.aplicar(1, false);
    expect(sol.intensity).toBe(1.2);
  });

  it('número torto (NaN, infinito) cai no dia, nunca apaga a cena por engano', () => {
    const { scene, sol } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(Number.NaN, false);
    expect(sol.intensity).toBe(1.2);
    f.aplicar(Number.POSITIVE_INFINITY, false); // infinito também é "torto": dia, não apagão
    expect(sol.intensity).toBe(1.2);
    f.aplicar(7, false); // já um número finito além do limite vale o limite (escuro total)
    expect(sol.intensity).toBeCloseTo(1.2 * PISO_DA_LUZ_SEM_VISAO, 9);
  });
});

describe('as luzes dos tiros e das explosões: um pool fixo que só existe no escuro', () => {
  const laranja = new THREE.Color(1, 0.55, 0.2);

  it('de dia não há luz pontual nenhuma na cena: o custo é zero', () => {
    const { scene } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(0, false);
    f.pulso(0, 1, 0, laranja, 800, 30, 0.3);
    expect(f.luzesNaCena).toBe(0);
    expect(pontuais(scene)).toHaveLength(0);
  });

  it('o pool entra na cena na primeira vez que escurece (o número de luzes nunca muda depois) e fica', () => {
    const { scene } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(ESCURIDAO_QUE_LIGA_AS_LUZES / 2, false);
    expect(f.luzesNaCena).toBe(0);
    f.aplicar(0.3, false);
    expect(f.luzesNaCena).toBe(LUZES_DO_PULSO);
    const luzes = pontuais(scene);
    expect(luzes).toHaveLength(LUZES_DO_PULSO);
    f.aplicar(0, false);
    expect(pontuais(scene)).toHaveLength(LUZES_DO_PULSO); // não sai: mexer no número recompilaria os shaders
  });

  it('um pulso acende no ponto, na cor e no alcance pedidos, e apaga em queda até zero', () => {
    const { scene } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(1, false);
    f.pulso(4, 2, -7, laranja, 800, 30, 0.4);
    const luz = pontuais(scene)[0]!;
    expect(luz.position.toArray()).toEqual([4, 2, -7]);
    expect(luz.distance).toBe(30);
    expect(luz.intensity).toBeCloseTo(800, 9);
    f.update(0.2); // metade da vida: (1 - 0,5)^2 = 25%
    expect(luz.intensity).toBeCloseTo(200, 6);
    f.update(0.25);
    expect(luz.intensity).toBe(0);
  });

  it('o pico vale a escuridão: num entardecer a explosão ilumina menos que no apagão', () => {
    const noite = cena().scene;
    const entardecer = cena().scene;
    const a = new FaseEscura(noite);
    const b = new FaseEscura(entardecer);
    a.registrar();
    b.registrar();
    a.aplicar(1, false);
    b.aplicar(0.3, false);
    a.pulso(0, 1, 0, laranja, 1000, 30, 0.3);
    b.pulso(0, 1, 0, laranja, 1000, 30, 0.3);
    const pico = (s: THREE.Scene) => (pontuais(s)[0]!).intensity;
    expect(pico(noite)).toBeCloseTo(1000, 6);
    expect(pico(entardecer)).toBeCloseTo(300, 6);
  });

  it('com todas as luzes acesas, o pulso novo toma a vaga da mais velha (nunca passa do pool)', () => {
    const { scene } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(1, false);
    for (let i = 0; i < LUZES_DO_PULSO; i++) {
      f.pulso(i, 1, 0, laranja, 500, 20, 1);
      f.update(0.1);
    }
    f.pulso(99, 1, 0, laranja, 500, 20, 1);
    const xs = pontuais(scene).map((c) => c.position.x);
    expect(xs).toContain(99);
    expect(xs).not.toContain(0); // a mais velha cedeu
    expect(xs).toHaveLength(LUZES_DO_PULSO);
  });

  it('dispose devolve o dia de fábrica e tira o pool (partida nova)', () => {
    const { scene, sol } = cena();
    const f = new FaseEscura(scene);
    f.registrar();
    f.aplicar(1, false);
    expect(f.luzesNaCena).toBe(LUZES_DO_PULSO);
    f.dispose();
    expect(f.luzesNaCena).toBe(0);
    expect(sol.intensity).toBe(1.2);
    expect(pontuais(scene)).toHaveLength(0);
  });
});
