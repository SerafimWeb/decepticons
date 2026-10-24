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
import { INTEGRIDADE_MAX, PONTOS_DOS_FAXINEIROS, REBELDES_MAX, type SituacaoDaPraca } from './MissaoJaneiro';
import type { CausaDaFuga } from './Multidao';
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
    // sem rebelde nenhum: só os faxineiros (P243), sempre ativos, de fora do cronograma de ondas
    expect(match.rebeldesVivos).toBe(0);
    expect(match.bots.mechs.filter((m) => m.alive)).toHaveLength(PONTOS_DOS_FAXINEIROS.length);
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

  it('o canhão sônico (P242) dispersa a multidão sem matar: quem está no cone foge pela mesma causa de um susto, nunca de um tiro', async () => {
    const { match, player, run } = await partida();
    run(30);
    const m = match.multidao!;
    const fugas: Array<[number, CausaDaFuga]> = [];
    m.aoFugir = (i, causa) => fugas.push([i, causa]);
    const t = match.tickDaMissao;
    const alvo = umFigurante(match, t)!;
    const antesMortos = m.eliminados;
    const origem = new THREE.Vector3(alvo.x - 5, 1, alvo.z);
    const dir = new THREE.Vector3(1, 0, 0);
    match.waveCone(player, origem, dir, weapon('sonic'));
    expect(fugiu(m, alvo.i)).toBe(true);
    expect(fugas).toContainEqual([alvo.i, 'susto']);
    expect(m.eliminados).toBe(antesMortos);
  });

  it('chefes recebem tiros no Match, seguram a vitória e liberam um golpe utilizável na simulação', async () => {
    const { match, run, player } = await partida();
    run(20);
    const e = match.chefesJaneiro!;
    const c = e.ativo!;
    expect(c.config.id).toBe('trampado');
    expect(match.projectiles.contraMassa!(c.x - 3, 3, c.z, 1, 0, 0, 5, c.vida)).toBe(true);
    expect(e.restantes).toBe(1);
    run(3.1);
    const evil = e.ativo!; expect(evil.config.id).toBe('evil');
    expect(match.projectiles.contraMassa!(evil.x - 3, 3, evil.z, 1, 0, 0, 5, evil.vida)).toBe(true);
    expect(e.conquistado).toBe(true); expect(e.restantes).toBe(0);
    player.respawn(new THREE.Vector3(66, 0, -12));
    e.golpePendente = true; run(0.02);
    expect(e.recarga).toBeGreaterThan(1);
    expect(e.golpeFx).toBeGreaterThan(0);
    match.restartMission(); expect(e.restantes).toBe(2); expect(e.conquistado).toBe(true);
  });

  it('cacetete confirma dano e abate, preserva faxineiro e não atravessa parede nem alcança do alto', async () => {
    for (const caso of ['livre', 'parede', 'alto']) {
      const { match, player } = await partida();
      player.respawn(new THREE.Vector3(66, caso === 'alto' ? 18 : 0, -12));
      match.bots.entrarAndroide(66, -18);
      const alvo = match.bots.mechs.find((m) => m.alive && match.bots.brainOf(m))!;
      const faxineiro = match.bots.mechs.find((m) => m.alive && !match.bots.brainOf(m))!;
      faxineiro.respawn(new THREE.Vector3(68, 0, -17));
      const vidaFaxina = faxineiro.modules.torso;
      // Acertar uma parte já destruída deve transferir o dano ao torso e confirmar o abate.
      alvo.modules.head = alvo.modules.leftArm = alvo.modules.rightArm = alvo.modules.leftLeg = alvo.modules.rightLeg = 0;
      alvo.modules.torso = 10;
      if (caso === 'parede') match.physics.addStaticBox(new THREE.Vector3(66, 3, -15), new THREE.Vector3(6, 8, 0.5));
      match.physics.step();
      let acertos = 0, abates = 0;
      match.onMechHit = (e) => { if (e.mech === alvo && e.shooter === player) acertos++; };
      match.onMechKilled = (m, _at, autor) => { if (m === alvo && autor === player) abates++; };
      match.chefesJaneiro!.aoGolpear!(66, caso === 'alto' ? 18 : 0, -12, 0);
      expect(acertos, caso).toBe(caso === 'livre' ? 1 : 0);
      expect(abates, caso).toBe(caso === 'livre' ? 1 : 0);
      expect(faxineiro.modules.torso).toBe(vidaFaxina);
    }
  });

  it('a cacetada do chefe também dispara dano e morte pelo sistema de combate', async () => {
    const { match, player } = await partida();
    player.respawn(new THREE.Vector3(66, 0, -12)); match.physics.step();
    let morreu = false, acertou = false;
    match.onMechKilled = (m) => { if (m === player) morreu = true; };
    match.onMechHit = (e) => { if (e.mech === player) acertou = true; };
    match.chefesJaneiro!.aoAcertar!(0, 5000, 62, -12);
    expect(acertou).toBe(true); expect(morreu).toBe(true);
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

  it('os androides rebeldes (o único inimigo que luta) entram no cronograma da multidão, um por vaga do pool, nunca mais que REBELDES_MAX vivos; a missão não termina com um por chegar', async () => {
    const { match, run } = await partida();
    const m = match.multidao!;
    expect(match.rebeldesVivos).toBe(0);
    const primeiro = Math.min(...m.androides.map((a) => a.tick));
    expect(m.androides.length).toBeGreaterThan(REBELDES_MAX); // o cronograma tem mais rebeldes que vagas: o resto espera
    run(primeiro / 60 - 2);
    expect(match.rebeldesVivos).toBe(0);
    run(4);
    expect(match.rebeldesVivos).toBeGreaterThanOrEqual(1);
    for (let s = 0; s < 6; s++) {
      run(10);
      expect(match.rebeldesVivos).toBeLessThanOrEqual(REBELDES_MAX);
      // os faxineiros (P243) somam à parte: sempre ativos, de fora da conta de rebeldes
      expect(match.bots.mechs.filter((b) => b.alive).length).toBe(match.rebeldesVivos + PONTOS_DOS_FAXINEIROS.length);
    }
    const situacao = (match as unknown as { situacaoDaPraca: SituacaoDaPraca }).situacaoDaPraca;
    expect(situacao.presentes).toBe(m.presentes + match.rebeldesVivos + match.chefesJaneiro!.restantes); // eles contam na Praça
    expect(situacao.faltamChegar).toBeGreaterThan(m.faltamChegar - 1); // e os agendados contam como por chegar
  });

  it('derrubar um androide rebelde conta no resultado e libera a vaga do pool para o próximo do cronograma', async () => {
    const { match, run } = await partida();
    const m = match.multidao!;
    run(Math.min(...m.androides.map((a) => a.tick)) / 60 + 3);
    const rebelde = match.bots.mechs.find((b) => b.alive)!;
    expect(rebelde).toBeDefined();
    // O nome de todo androide rebelde é "AI-5" (P251, ordem do Comandante): o modelo, igual em todos, nunca numerado.
    expect(match.bots.nameOf(rebelde)).toBe('AI-5');
    const antes = match.rebeldesVivos;
    rebelde.takeHit(new THREE.Vector3(rebelde.simPosition.x, rebelde.simPosition.y + 1, rebelde.simPosition.z), 1e6);
    run(0.1);
    expect(rebelde.alive).toBe(false);
    expect(match.missaoJaneiro!.resultado().rebeldes).toBeGreaterThanOrEqual(1);
    expect(match.rebeldesVivos).toBeLessThanOrEqual(antes);
  });

  it('o faxineiro (P243, agente de verdade) anda até a mesa suja do prédio dele e a limpa sozinho, sem conta abstrata', async () => {
    const { match, run } = await partida();
    const portasPredio0 = PONTOS_DOS_FAXINEIROS.filter((p) => p.predio === 0);
    expect(portasPredio0.length).toBe(2);
    const faxineiros = match.bots.mechs.filter((m) =>
      portasPredio0.some((d) => Math.abs(m.simPosition.x - d.x) < 0.01 && Math.abs(m.simPosition.z - d.z) < 0.01),
    );
    expect(faxineiros).toHaveLength(2);
    const homes = faxineiros.map((m) => m.simPosition.clone());
    // suja a primeira mesa livre do prédio 0, do mesmo jeito que alguém chegando à fachada sujaria
    let mesa = -1;
    for (let i = 0; mesa < 0; i++) mesa = match.missaoJaneiro!.aoChegar(i, 0);
    expect(match.missaoJaneiro!.mesaSuja(0, mesa)).toBe(true);
    run(1); // tempo de sobra para sair do posto rumo à mesa
    expect(faxineiros.some((m, i) => m.simPosition.distanceTo(homes[i]!) > 0.3)).toBe(true); // andou de verdade, não é conta abstrata
    for (let s = 0; s < 30 && match.missaoJaneiro!.mesaSuja(0, mesa); s++) run(1);
    expect(match.missaoJaneiro!.mesaSuja(0, mesa)).toBe(false);
    expect(match.missaoJaneiro!.mesasLimpas).toBeGreaterThanOrEqual(1);
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
    expect(match.rebeldesVivos).toBe(0);
    // os faxineiros (P243) não são do cronograma de ondas: o reinício não os mata, só os bots de combate ficam a zero
    expect(match.bots.mechs.filter((b) => b.alive).length).toBe(PONTOS_DOS_FAXINEIROS.length);
  });
});
