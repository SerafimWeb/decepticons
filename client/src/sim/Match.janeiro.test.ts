import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/Settings';
import type { MechInput } from '../entities/MechBase';
import { Vector09 } from '../entities/Vector09';
import { carregarMapaSeFor } from '../environment/mapasSobDemanda';
import { PRACA_PREDIOS } from '../environment/PracaLayout';
import { weapon } from '../combat/weapons';
import type { ParticleSystem } from '../fx/ParticleSystem';
import { FIXED_DT, PhysicsWorld } from '../physics/PhysicsWorld';
import { Match } from './Match';
import { INTEGRIDADE_MAX } from './MissaoJaneiro';
import type { MissionStats } from './SurvivalWaves';

const IDLE: MechInput = { moveX: 0, moveZ: 0, moveYaw: 0, yaw: 0, jump: false, dash: false };
const NO_FX = { burst: () => {} } as unknown as ParticleSystem;
const SEM_INIMIGOS = { ...DEFAULT_SETTINGS, enemyMechs: 0, enemyAndroids: 0, technician: false };
const abertas: PhysicsWorld[] = [];

/** A missão do 8 DE JANEIRO (P217, passo 5), sem tela: a multidão contra os três prédios; o jogador nasce na Praça. */
async function partida(mode: 'survival' | 'deathmatch' = 'survival') {
  const physics = await PhysicsWorld.create();
  abertas.push(physics);
  const match = new Match({ physics, scene: new THREE.Scene(), map: 'janeiro', mode, particles: NO_FX, foes: SEM_INIMIGOS, debris: false, allies: false });
  const fins: { sobreviveu: boolean; stats: MissionStats }[] = [];
  match.onMissionEnd = (sobreviveu, _onda, stats) => fins.push({ sobreviveu, stats });
  const player = new Vector09();
  match.addPlayer(player, 'VOCÊ');
  const entrada: MechInput = { ...IDLE };
  match.pilots.push({ fixedUpdate: (dt) => player.fixedUpdate({ ...entrada }, dt) });
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / FIXED_DT); i++) match.step(FIXED_DT);
  };
  return { match, player, run, fins, entrada };
}

/** Este figurante fugiu (por tiro, susto ou por conta própria)? `fugiuNoTick` devolve -1 para quem não fugiu. */
const fugiu = (m: Match['multidao'], i: number): boolean => m!.fugiuNoTick(i) >= 0;

/** O primeiro figurante que está na Praça no tick `t`, e onde (null se não há). */
function umFigurante(match: Match, t: number): { i: number; x: number; z: number } | null {
  const m = match.multidao!;
  const p = { x: 0, z: 0 };
  for (let i = 0; i < m.total; i++) if (m.posicao(i, t, p)) return { i, x: p.x, z: p.z };
  return null;
}

describe('a missão do 8 DE JANEIRO no Match (P217, passo 5): a multidão contra os três prédios', () => {
  beforeAll(async () => {
    await RAPIER.init();
    await carregarMapaSeFor('janeiro');
  });
  afterEach(() => {
    while (abertas.length) abertas.pop()!.world.free();
  });

  it('a missão existe só na Sobrevivência da Praça: sem ondas, sem núcleo, sem quadro de luz, sem rio e sem inimigos; no Deathmatch da Praça não existe', async () => {
    const { match } = await partida();
    expect(match.missaoJaneiro).not.toBeNull();
    expect(match.multidao).not.toBeNull();
    expect(match.waves).toBeNull();
    expect(match.nucleo).toBeNull();
    expect(match.quadro).toBeNull();
    expect(match.rio).toBeNull();
    expect(match.bots.mechs.filter((m) => m.alive)).toHaveLength(0);
    expect(match.missaoJaneiro!.predios).toBe(PRACA_PREDIOS.length);
    const dm = await partida('deathmatch');
    expect(dm.match.missaoJaneiro).toBeNull();
    expect(dm.match.multidao).toBeNull();
  });

  it('a multidão anda no relógio da missão: passados 20 s, já chegou gente à Praça; o relógio da missão e o tick contam juntos', async () => {
    const { match, run } = await partida();
    expect(match.tickDaMissao).toBe(0);
    run(20);
    expect(match.tickDaMissao).toBe(1200);
    expect(match.multidao!.nasceram).toBeGreaterThan(0);
    expect(match.multidao!.presentes).toBeGreaterThan(0);
    expect(match.missaoJaneiro!.tempoS).toBeCloseTo(20, 1);
  });

  it('G2: a mesma semente é a mesma multidão, no mesmo tick, em duas partidas', async () => {
    const a = await partida();
    const b = await partida();
    a.run(30);
    b.run(30);
    expect(b.match.multidao!.nasceram).toBe(a.match.multidao!.nasceram);
    expect(b.match.multidao!.presentes).toBe(a.match.multidao!.presentes);
    expect([...b.match.multidao!.contarNaFachada(1800)]).toEqual([...a.match.multidao!.contarNaFachada(1800)]);
  });

  it('o tiro do jogador acerta a multidão (e só o jogador): um tiro na linha de um figurante o derruba ou o faz fugir; o tiro hostil o atravessa', async () => {
    const { match, run } = await partida();
    run(20);
    const t = match.tickDaMissao;
    const alvo = umFigurante(match, t);
    expect(alvo).not.toBeNull();
    const m = match.multidao!;
    const w = weapon('rotary');
    const de = new THREE.Vector3(alvo!.x - 8, 1, alvo!.z);
    const dir = new THREE.Vector3(1, 0, 0);
    match.projectiles.fire(de, dir.clone(), undefined, true, w); // hostil: não vale
    for (let k = 0; k < 40; k++) match.step(FIXED_DT);
    expect(m.estaMorto(alvo!.i)).toBe(false);
    expect(fugiu(m, alvo!.i)).toBe(false);
    // o tiro do jogador, da mesma linha, acerta alguém na linha (o figurante já andou: mira onde ele está agora)
    const agora = match.tickDaMissao;
    const onde = umFigurante(match, agora)!;
    let acertou = false;
    for (let k = 0; k < 8 && !acertou; k++) {
      const antesMortos = m.eliminados;
      match.projectiles.fire(new THREE.Vector3(onde.x - 6, 1, onde.z), dir.clone(), undefined, false, w);
      for (let s = 0; s < 30; s++) match.step(FIXED_DT);
      acertou = m.eliminados > antesMortos || fugiu(m, onde.i);
    }
    expect(acertou).toBe(true);
  });

  it('a explosão do jogador derruba um aglomerado e assusta o resto (uma granada dentro da multidão)', async () => {
    const { match, run } = await partida();
    run(30);
    const m = match.multidao!;
    const t = match.tickDaMissao;
    const alvo = umFigurante(match, t)!;
    const antes = m.eliminados;
    const w = weapon('grenade');
    match.grenades.onExplode!(new THREE.Vector3(alvo.x, 0.5, alvo.z), new THREE.Vector3(0, 1, 0), undefined, w);
    expect(m.eliminados + (fugiu(m, alvo.i) ? 1 : 0)).toBeGreaterThan(antes);
  });

  it('a investida do Mech (o dash) leva quem está no caminho: a porrada da ficha, sem arma nova', async () => {
    const { match, player, run } = await partida();
    run(30);
    const m = match.multidao!;
    // o jogador nasce longe da multidão; leva-o até colar num figurante e investe
    const t = match.tickDaMissao;
    const alvo = umFigurante(match, t)!;
    player.respawn(new THREE.Vector3(alvo.x, 0, alvo.z));
    const antes = m.eliminados;
    Object.defineProperty(player, 'isDashing', { get: () => true, configurable: true });
    match.step(FIXED_DT);
    expect(m.eliminados).toBeGreaterThan(antes);
  });

  it('o jogador por perto assusta: quem está a menos de 6 m foge (e foge de verdade, rumo ao limite do mapa)', async () => {
    const { match, player, run } = await partida();
    run(30);
    const m = match.multidao!;
    const alvo = umFigurante(match, match.tickDaMissao)!;
    player.respawn(new THREE.Vector3(alvo.x, 0, alvo.z));
    for (let k = 0; k < 12; k++) match.step(FIXED_DT); // o susto é conferido de 6 em 6 ticks
    expect(fugiu(m, alvo.i)).toBe(true);
  });

  it('parado, o jogador perde a missão: a fachada e a sujeira derrubam um prédio, o fim sai uma vez pelo aviso de missão e o mundo congela', { timeout: 180_000 }, async () => {
    const { match, run, fins } = await partida();
    run(30);
    expect(fins).toHaveLength(0);
    expect(match.missaoJaneiro!.fase).toBe('em-curso');
    for (let s = 0; s < 300 && !match.missaoJaneiro!.terminou; s += 10) run(10);
    expect(match.missaoJaneiro!.terminou).toBe(true);
    expect(match.missaoJaneiro!.fase).toBe('derrota');
    expect(match.missaoJaneiro!.causa).toBe('predio');
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(false);
    expect(fins[0]!.stats.survivalSeconds).toBeGreaterThan(60);
    // parado, os prédios caem no meio da fase, não no começo nem no fim dela (medido em 20/10: 174 s de 300; o desgaste é palpite, a calibrar jogando)
    expect(fins[0]!.stats.survivalSeconds).toBeLessThan(240);
    const tick = match.tickDaMissao;
    run(5);
    expect(match.tickDaMissao).toBe(tick);
    expect(fins).toHaveLength(1);
  });

  it('um prédio a zero acaba a missão no mesmo tick, pelo aviso de missão (a derrota sai com os abates do momento)', async () => {
    const { match, run, fins } = await partida();
    run(5);
    match.missaoJaneiro!.integridade[1] = 0;
    run(0.1);
    expect(fins).toHaveLength(1);
    expect(fins[0]!.sobreviveu).toBe(false);
    expect(match.missaoJaneiro!.causa).toBe('predio');
  });

  it('o reinício da missão volta tudo: a multidão do zero, os prédios inteiros, o relógio e o placar zerados', async () => {
    const { match, run } = await partida();
    run(30);
    match.missaoJaneiro!.integridade[0] = 123;
    expect(match.multidao!.nasceram).toBeGreaterThan(0);
    match.restartMission();
    expect(match.tickDaMissao).toBe(0);
    expect(match.multidao!.nasceram).toBe(0);
    expect(match.multidao!.eliminados).toBe(0);
    expect(match.multidao!.faltamChegar).toBe(match.multidao!.total);
    expect([...match.missaoJaneiro!.integridade]).toEqual([INTEGRIDADE_MAX, INTEGRIDADE_MAX, INTEGRIDADE_MAX]);
    expect(match.missaoJaneiro!.tempoS).toBe(0);
    expect(match.missaoJaneiro!.fase).toBe('em-curso');
  });
});
