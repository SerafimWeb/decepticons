import * as THREE from 'three';
import { GLOW, PALETTE } from '../core/palette';
import type { MechBase } from '../entities/MechBase';
import { Android } from '../entities/Android';
import { ANDROID_STATS, COLOSSUS_BOSS_STATS, ehManifestante, ehTita, MANIFESTANTE_STATS, VECTOR09_STATS, type ChassisId } from '../entities/chassis';
import { armaDoBot, statsDoBot, TITA_RESPAWN_S } from './titaBot';
import { BLUEPRINT_BY_CHASSIS } from '../entities/blueprintByChassis';
import { ImportedMech } from '../entities/ImportedMech';
import type { MechRig } from '../entities/MechBase';
import { aplicarMascaraDoChefe } from '../entities/mascaraDoChefe';
import { COLOSSUS_01_BLUEPRINT } from '../entities/mechBlueprint';
import { Vector09 } from '../entities/Vector09';
import type { ParticleSystem } from '../fx/ParticleSystem';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PERSONA_LABELS, type Difficulty, type Persona } from '../core/Settings';
import { ANDROID_PROFILE, BOSS_PROFILE, BOT_SKILL_NORMAL, BOT_SKILLS, BotController, type BotSkill, type SquadOrder, MECH_PROFILE, PERSONAS } from './BotController';
import { escolherRearguarda } from './tatica';
import { parametrosDaTatica, type TaticaId } from './taticas';
import type { CombatSystem } from './CombatSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { BarrageSystem } from './BarrageSystem';
import type { CruiseSystem } from './CruiseSystem';
import type { GrenadeSystem } from './GrenadeSystem';
import type { RocketSystem } from './RocketSystem';
import { applySpread, spreadAt, type Spread } from './spread';
import { weapon, type Tier, type WeaponId, type WeaponStats } from './weapons';
import { REPAIR_RATE } from './repair';
import { TechnicianController } from './TechnicianController';
import type { Respawner } from './Respawner';
import { defaultPower, poweredStats, type PowerSpec } from '../tuning/power';
import { BOT_NAMES } from '../core/botNames';
import { wrapAngle } from './steer';
import type { CerebroDoChefe } from './CerebroDoChefe';
import type { MapId } from '../environment/Bunker';
import { exigirChefe } from '../environment/mapasSobDemanda';

export const BOT_RESPAWN_S = 4;
/** IA rebelde: vermelho, com visor e tiros vermelhos (o jogador é amarelo com verde neon). */
const BOT_PAINT = PALETTE.enemyPaint;
const MUZZLE_COLOR = GLOW.enemyMuzzle;

const pick = (list: readonly string[], i: number, prefix: string) => list[i] ?? `${prefix}-${String(i + 1).padStart(2, '0')}`;
/** O diretor redistribui as vagas de ataque a cada tanto (não a cada tick: 5 vezes por segundo basta). */
const DIRECTOR_INTERVAL_S = 0.2;
/** Turno de quem tem a vaga: passado isto, a vaga vai para quem está esperando (revezam). */
const TURN_S = 7;
/** Custo de uma vaga: um Mech conta 1, um andróide conta ½ (é fraco). */
const ANDROID_COST = 0.5;
/**
 * Cerco (11/10): quem espera a vaga vai para o flanco do alvo, a este ângulo (~100°) da frente dele (para onde o
 * torso aponta); o segundo do mesmo lado vai mais para trás, de `FLANK_STEP_RAD` em `FLANK_STEP_RAD`, até as costas.
 */
const FLANK_RAD = 1.75;
const FLANK_STEP_RAD = 0.8;
/** Perto da frente do alvo (menos que isto), o lado do flanco vai para o lado com menos gente. */
const FLANK_TIE_RAD = 0.5;
/** Rádio do clã: alcance do aviso de contato entre companheiros (m). */
export const RADIO_RANGE = 80;
/** Aviso de rádio na tela: no máximo um a cada tanto por time (não vira ruído). */
const RADIO_CALLOUT_S = 8;

const _muzzle = new THREE.Vector3();
const _blastDir = new THREE.Vector3();
const _blastSpread: Spread = { x: 0, y: 0 };

/**
 * O que um robô do esquadrão tem de próprio (P91, `sim/esquadrao.ts`): o corpo (os números do chassi e a silhueta), a arma principal e a
 * dificuldade. Ausente = o padrão do clã. Quem monta é a partida; o que a IA faz com a arma (a distância de tiro) está em `BotController`.
 */
export interface BotKit {
  chassi?: ChassisId;
  /** Troca a arma principal (a secundária sai: o bot só atira a principal). */
  arma?: { id: WeaponId; tier: Tier } | null;
  /** A arma da mão esquerda (P108 b): o bot passa a atirá-la também, com a cadência dela. Ausente = só a principal, como sempre. */
  secundaria?: { id: WeaponId; tier: Tier } | null;
  dificuldade?: Difficulty | null;
}

/** Os lançadores da partida que os bots usam para as armas explosivas da mão esquerda (P160 parte 4). */
export interface BotLaunchers {
  rockets: RocketSystem;
  grenades: GrenadeSystem;
  cruise: CruiseSystem;
  barrage: BarrageSystem;
}

export interface BotSystemOptions {
  /** Um pulso do raio laser de um bot (P175): a partida acha o primeiro alvo no feixe, dá o dano e acende o desenho (`Match.beamPulse`), o mesmo do jogador. Independe dos `launchers`. Sem ele, o bot com laser não atira. */
  pulso?: (mech: MechBase, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponStats) => void;
  /**
   * Os lançadores da partida (P160 parte 4): com eles, os Mechs bots lançam a arma **explosiva** da mão esquerda (o casulo de foguetes de fábrica do
   * Vector-09, o teleguiado, as granadas, o lançador leve, o cruzador, a chuva) em salvas (`BotController.useExplosives`). Sem eles, só a energia.
   */
  launchers?: BotLaunchers;
  /**
   * O corpo de malha importada de um chassi (Marauder, Lancer, Bastion...), se o cliente tem o arquivo pronto: o esquadrão (P91) escolhe o
   * chassi, e sem isto todo bot nascia como o Vector-09 com os números do chassi certo e a silhueta errada (achado do Comandante, 13/10).
   * O servidor não tem malha nenhuma e não passa isto: lá o corpo é só física e números.
   */
  rigDoChassi?: (chassi: ChassisId) => MechRig | null;
  scene: THREE.Scene;
  physics: PhysicsWorld;
  combat: CombatSystem;
  projectiles: ProjectileSystem;
  particles: ParticleSystem;
  respawner: Respawner;
  /** Desligado em missões com pool: a própria regra decide quando cada unidade volta. */
  respawn?: boolean;
  /** No CTF, cada defensor renasce na própria base em vez do ponto global mais distante. */
  respawnAtHome?: boolean;
  /** Jogadores que a equipe acompanha (lista viva, sem cópia por tick). */
  escort?: readonly MechBase[];
  /** Nomes na tela (padrão: os de `core/botNames.ts`; o time de aliados usa os nomes dos aliados). */
  names?: { mechs?: readonly string[]; androids?: readonly string[]; technicians?: readonly string[] };
  /**
   * Cor do casco e do visor (padrão: as de sempre, roxo/violeta — "IA rebelde"). Um segundo `BotSystem`
   * pode passar as cores do jogador aqui pra virar um time de aliados, visualmente diferente do inimigo
   * (senão o jogador não teria como distinguir quem atira nele de quem luta ao lado dele).
   */
  paint?: number;
  visor?: number;
  /** Onde cada Mech rebelde (escala 2) nasce (x, z): um por ponto. */
  spawns: readonly (readonly [number, number])[];
  /** A altura do chão em (x, z): cada bot nasce **no chão do ponto** em vez de em y = 0 (num mapa de relevo, como a Amazônia, y = 0 enterra o robô ou o faz cair do mundo: P180 parte D2). */
  alturaDoChao?: (x: number, z: number) => number;
  /** Todos os bots seguram o posto (`BotController.rearguard`): trocam tiro em volta do ponto de nascimento e não o largam para perseguir (a força de defesa da Amazônia, P180 parte D2). */
  defensores?: boolean;
  /** Todos os bots são **plantadores** (`BotController.plantador`): a ordem `hold` os prende ao ponto (a Resistência da Amazônia na escotilha do Draga, P180 parte E). */
  plantadores?: boolean;
  /** Onde cada andróide rebelde (escala 1) nasce (x, z): um por ponto. */
  androidSpawns?: readonly (readonly [number, number])[];
  /** O chefe da missão (o Colossus) veste a **máscara** (P165, `entities/mascaraDoChefe.ts`)? Padrão: sim; o `?mascara=0` do link a tira. Só o chefe: o Colossus do Hangar não. */
  mascaraDoChefe?: boolean;
  /** Onde nascem os **manifestantes** (P163, missão em ondas da praia): o vândalo humano que depreda os cabos e arromba as portas. Sem isto, não há manifestantes. */
  manifestanteSpawns?: readonly (readonly [number, number])[];
  /** Onde cada andróide técnico nasce (x, z): conserta os Mechs rebeldes, não atira. */
  technicianSpawns?: readonly (readonly [number, number])[];
  /** Onde o Colossus (escala 3) nasce (x, z): um só, com perfil de cerco. Sem isto, a missão não tem boss. */
  bossSpawn?: readonly [number, number];
  /** O chefe do mapa (o Draga-01 da Amazônia, P180 parte C): o mapa cujo chefe nasce no ponto dele. Vem do registro `mapasSobDemanda` (carregado antes de montar a partida). Sem isto, não há chefe de mapa. */
  chefeDoMapa?: MapId;
  /** O desenho do chefe do mapa (o cliente carrega antes; o servidor e os testes não passam: o corpo é só física e números). */
  visualDoChefe?: object | null;
  /** Onde o chefe do mapa nasce, se não for o ponto de largada do registro (o `?marcha=` do link: o Draga já andado). */
  chefeNascimento?: { x: number; z: number };
  /** Rota de patrulha (x, z). */
  waypoints: readonly (readonly [number, number])[];
  seed?: number;
  skill?: BotSkill;
  /** Personalidade de cada Mech rebelde, na ordem dos `spawns` (padrão: soldado). */
  personas?: readonly Persona[];
  /**
   * O kit de cada Mech, na ordem dos `spawns` (esquadrão, P91). Quando existe, o esquadrão diz a arma de cada um e o supressor
   * automático dos aliados (o de índice ímpar leva o EMP) deixa de valer: o aliado de EMP é uma escolha do esquadrão, não uma regra.
   */
  kits?: readonly (BotKit | undefined)[];
  /** O kit de cada andróide, na ordem dos `androidSpawns` (só a dificuldade vale). */
  androidKits?: readonly (BotKit | undefined)[];
  /** Potências do painel (por arma e por clã); sem isso, o padrão do jogo. */
  power?: PowerSpec;
  /** A **tática** do esquadrão aliado (ordem P122): a formação e o leash que ele obedece. Ausente = `centro`. */
  tatica?: TaticaId | null;
}

/** Rádio do clã, para a tela: `from` avistou `target` (primeiro contato; no máximo um aviso a cada `RADIO_CALLOUT_S`). */
export type RadioCallout = (from: string, target: MechBase) => void;

/** Lugar de um cérebro de combate na fila do diretor: chave de ordem e o lado do cerco (+1/−1, 0 = sem flanco). */
interface Fighter {
  bot: Bot;
  brain: BotController;
  key: number;
  side: number;
}

interface Bot {
  mech: MechBase;
  brain: BotController | TechnicianController | CerebroDoChefe;
  name: string;
  home: THREE.Vector3;
  /** A dificuldade é do robô (esquadrão): a das configurações não a troca. */
  ownSkill?: boolean;
  /** Feixe de conserto (só técnicos): 2 pontos atualizados no render, sem alocar. */
  beam?: THREE.Line;
  /** A defesa (P180 parte D2): segundos que ainda fica acordada (um alvo chegou perto ou ela levou dano); zero = dorme. */
  vigia?: number;
  /** A vida somada da última vez que olhou, para saber se levou dano. */
  vidaVista?: number;
}

/** Até onde (m) um alvo acorda a defesa: além do alcance das torres e de qualquer arma do jogador de fábrica. */
const ACORDA_ATE_M = 420;
/** Quanto a defesa fica acordada depois do último motivo (s). */
const ACORDADA_S = 6;

const BEAM_COLOR = new THREE.Color(PALETTE.fluo).multiplyScalar(3);
const _beamTo = new THREE.Vector3();

/**
 * Mechs inimigos: um Vector-09 violeta por ponto de nascimento, cada um com o seu
 * `BotController`. No tick: o cérebro decide, o Mech simula, e o tiro sai da boca do canhão
 * calculada da simulação. Custo por bot: 1 character controller por tick + a IA (ver BotController).
 */
export class BotSystem {
  /** Quem os bots caçam (hoje: só o jogador). */
  targets: readonly MechBase[] = [];
  readonly mechs: readonly MechBase[];
  private readonly bots: Bot[] = [];
  /** Reservas retiradas da sala quando entram humanos; não renascem durante a reserva. */
  private readonly reserves = new Set<MechBase>();
  /** O Colossus (escala 3), quando a missão tem boss: guardado à parte para o recorte de onda contá-lo. */
  private bossMech: MechBase | null = null;
  /**
   * Vaga de ataque: quantos podem atacar o mesmo alvo ao mesmo tempo (Mech conta 1, andróide ½). Os
   * outros esperam afastados, sem atirar, e revezam a cada turno (dono, 25/09: "eles são muitos e me
   * juntam"). Técnica clássica de jogos de tiro: pressão constante, sem todo mundo de uma vez.
   */
  maxAttackers = Infinity;
  order: SquadOrder = 'follow';
  private pendingOrder: SquadOrder | null = null;
  private orderTarget: MechBase | null = null;
  private readonly orderPoint = new THREE.Vector3();
  /** UI apenas enfileira; ordens são aplicadas dentro do tick. */
  queueOrder(order: SquadOrder, point: Readonly<THREE.Vector3>, target: MechBase | null = null): boolean {
    if (!this.o.escort || (order === 'focus' && (!target?.alive || !this.targets.includes(target)))) return false;
    this.pendingOrder = order;
    this.orderPoint.copy(point);
    this.orderTarget = target;
    return true;
  }
  private directorTimer = 0;
  /** Cérebros de combate (o diretor só olha para eles) e a fila ordenada, reaproveitados: sem alocar. */
  private readonly fighters: Fighter[] = [];
  private readonly cand: Fighter[] = [];
  /** Aviso de rádio na tela (o `Game` liga; o servidor não). */
  onRadio?: RadioCallout;
  private radioQuiet = 0;
  private readonly projectiles: ProjectileSystem;
  private readonly combat: CombatSystem;
  private readonly particles: ParticleSystem;
  /** Ritmo do conserto do técnico (potência do clã; 1 = padrão). */
  private readonly repairScale: number;

  constructor(private readonly o: BotSystemOptions) {
    this.projectiles = o.projectiles;
    this.combat = o.combat;
    this.particles = o.particles;
    const waypoints = o.waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const seed = o.seed ?? 1;
    // A tática do esquadrão (P122): só vale no lado aliado (escolta); os rebeldes não têm tática do jogador.
    const tatica = parametrosDaTatica(o.escort ? o.tatica : null);
    const place = (mech: MechBase, [x, z]: readonly [number, number]) => {
      const y = o.alturaDoChao ? o.alturaDoChao(x, z) : 0;
      mech.spawn(o.physics, new THREE.Vector3(x, y, z));
      mech.applyFacing(Math.atan2(x, z), 0); // nasce olhando para o centro da arena
      o.scene.add(mech.root);
      o.combat.register(mech);
      return new THREE.Vector3(x, y, z);
    };
    const fighter = (mech: MechBase, p: readonly [number, number], name: string, i: number, android: boolean, kit?: BotKit) => {
      const home = place(mech, p);
      const persona = PERSONAS[(!android && o.personas?.[i]) || 'soldado'];
      const ownSkill = !!kit?.dificuldade;
      const skill = kit?.dificuldade ? BOT_SKILLS[kit.dificuldade] : o.skill ?? BOT_SKILL_NORMAL;
      // O titã (P108) luta como o chefe: de longe, sem correr, com o giro lento como fraqueza; e volta devagar depois de abatido.
      const titan = !android && !!kit?.chassi && ehTita(kit.chassi);
      const brain = new BotController(mech, o.physics, waypoints, seed * 1000 + i, skill, android ? ANDROID_PROFILE : titan ? BOSS_PROFILE : MECH_PROFILE, persona);
      brain.escortSide = i % 2 ? 1 : -1;
      if (o.escort) {
        brain.formationWidth = tatica.formacaoLargura; // a tática do jogador manda na formação aliada (ordem P122)
        brain.leash = tatica.leash;
      }
      brain.useSecondary = !!kit?.secundaria;
      // As armas explosivas da mão esquerda (P160 parte 4): o Mech bot lança a dele em salvas (o andróide e o titã seguem como estavam).
      brain.useExplosives = !!o.launchers && !android && !titan && mech.loadout.secondary?.kind === 'ammo';
      brain.home.copy(home);
      if (o.defensores) brain.rearguard = true;
      if (o.plantadores) brain.plantador = true;
      if (o.respawn !== false) {
        o.respawner.track(mech, titan ? TITA_RESPAWN_S : BOT_RESPAWN_S, () => {
          if (o.respawnAtHome) mech.respawn(home);
          brain.reset();
        });
      }
      this.bots.push({ mech, brain, name, home, ...(ownSkill ? { ownSkill } : {}) });
    };
    // No placar e no nome sobre a cabeça, o nome e a personalidade (CLAUDE·BRABO): o jogador aprende quem é quem.
    const mechName = (i: number) => {
      const persona = o.personas?.[i];
      const name = pick(o.names?.mechs ?? (o.escort ? BOT_NAMES.allies : BOT_NAMES.mechs), i, 'M');
      return persona && persona !== 'soldado' ? `${name}·${PERSONA_LABELS[persona].label.toUpperCase()}` : name;
    };
    // Potências: os números de cada clã são montados uma vez aqui (nada muda no tick).
    const power = o.power ?? defaultPower();
    const mechStats = poweredStats(VECTOR09_STATS, power, 'mechs');
    const androidStats = poweredStats(ANDROID_STATS, power, 'androids');
    this.repairScale = power.clans.technician.damage;
    const paint = o.paint ?? BOT_PAINT;
    const visor = o.visor ?? PALETTE.signal;
    const suppressionStats = o.escort ? poweredStats({ ...VECTOR09_STATS,
      loadout: { primary: weapon('emp'), secondary: null } }, power, 'mechs') : mechStats;
    // O corpo de cada Mech: sem kits, o de sempre (e o supressor nos aliados de índice ímpar); com kits, o que o esquadrão pediu.
    const statsDoMech = (i: number, kit: BotKit | undefined) => {
      if (!o.kits) return o.escort && i % 2 ? suppressionStats : mechStats;
      const base = kit?.chassi ? statsDoBot(kit.chassi) : VECTOR09_STATS;
      if (kit?.arma) {
        const { metalShield } = base.loadout;
        const secondary = kit.secundaria ? armaDoBot(kit.secundaria.id, kit.secundaria.tier, kit.chassi ?? 'vector09') : null;
        return poweredStats({ ...base, loadout: { ...(metalShield ? { metalShield } : {}), primary: armaDoBot(kit.arma.id, kit.arma.tier, kit.chassi ?? 'vector09'), secondary } }, power, 'mechs');
      }
      if (kit?.secundaria) {
        return poweredStats({ ...base, loadout: { ...base.loadout, secondary: armaDoBot(kit.secundaria.id, kit.secundaria.tier, kit.chassi ?? 'vector09') } }, power, 'mechs');
      }
      return kit?.chassi ? poweredStats(base, power, 'mechs') : mechStats;
    };
    o.spawns.forEach((p, i) => {
      const kit = o.kits?.[i];
      const stats = statsDoMech(i, kit);
      const rig = kit?.chassi ? o.rigDoChassi?.(kit.chassi) : null;
      fighter(rig ? new ImportedMech(stats, rig) : new Vector09({ paint, visor, stats, blueprint: kit?.chassi ? BLUEPRINT_BY_CHASSIS[kit.chassi] : undefined }), p, mechName(i), i, false, kit);
    });

    // Andróides: sementes depois das dos Mechs.
    (o.androidSpawns ?? []).forEach((p, i) => fighter(new Android({ stats: androidStats }), p, pick(o.names?.androids ?? BOT_NAMES.androids, i, 'A'), o.spawns.length + i, true, o.androidKits?.[i]));
    // Os manifestantes (P163): corpo de andróide, mais fraco, camisa amarela e bandeira; o cérebro é o do andróide (corpo a corpo). Sementes depois das dos andróides.
    const manifestanteStats = poweredStats(MANIFESTANTE_STATS, power, 'androids');
    (o.manifestanteSpawns ?? []).forEach((p, i) =>
      fighter(new Android({ paint: 0xf2c230, tool: 'bandeira', stats: manifestanteStats }), p, `MANIFESTANTE ${i + 1}`, o.spawns.length + (o.androidSpawns?.length ?? 0) + i, true),
    );
    // O Colossus (escala 3), quando a missão tem boss: nasce no ponto dedicado, com o perfil de cerco e sem
    // personalidade de piloto (não é um rebelde, é uma máquina). Entra no pool como os outros: nada é criado no tick.
    if (o.bossSpawn) {
      const boss = new Vector09({
        paint: BOT_PAINT,
        visor: PALETTE.signal,
        stats: poweredStats(COLOSSUS_BOSS_STATS, power, 'mechs'),
        blueprint: COLOSSUS_01_BLUEPRINT,
      });
      boss.crawls = true; // com as duas pernas caídas ele rasteja (a terceira fase, `sim/FasesDoChefe.ts`) em vez de virar uma torre imóvel
      if (o.mascaraDoChefe ?? true) aplicarMascaraDoChefe(boss.root);
      const home = place(boss, o.bossSpawn);
      const brain = new BotController(boss, o.physics, waypoints, seed * 1000 + 900, o.skill ?? BOT_SKILL_NORMAL, BOSS_PROFILE, PERSONAS.soldado);
      this.bots.push({ mech: boss, brain, name: 'COLOSSUS-01', home });
      this.bossMech = boss;
    }
    // O chefe do mapa (o Draga-01 da Amazônia, P180 parte C): corpo e cérebro vêm do registro sob demanda; ele marcha pelo leito do rio e atira, não caça nem foge.
    if (o.chefeDoMapa) {
      const chefe = exigirChefe(o.chefeDoMapa);
      const { mech: boss, brain } = chefe.criar({ physics: o.physics, visual: o.visualDoChefe ?? null, seed: seed * 1000 + 900, power });
      const nasce = o.chefeNascimento ?? chefe.nascimento;
      const home = place(boss, [nasce.x, nasce.z]);
      boss.applyFacing(chefe.nascimento.yaw, 0);
      brain.reset();
      this.bots.push({ mech: boss, brain, name: boss.stats.name, home });
      this.bossMech = boss;
    }
    // Técnicos: consertam os Mechs rebeldes; visor amarelo para o jogador achar e caçar primeiro.
    const allies = this.bots.filter((b) => b.mech instanceof Vector09).map((b) => b.mech);
    (o.technicianSpawns ?? []).forEach((p, i) => {
      const mech = new Android({ visor: PALETTE.fluo, tool: 'repair', stats: poweredStats(ANDROID_STATS, power, 'technician') });
      const home = place(mech, p);
      const brain = new TechnicianController(mech, allies);
      if (o.respawn !== false) o.respawner.track(mech, BOT_RESPAWN_S, () => brain.reset());
      const beam = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: BEAM_COLOR }));
      beam.visible = false;
      beam.frustumCulled = false;
      o.scene.add(beam);
      this.bots.push({ mech, brain, name: pick(o.names?.technicians ?? BOT_NAMES.technicians, i, 'T'), home, beam });
    });
    this.mechs = this.bots.map((b) => b.mech);
    for (const bot of this.bots) if (bot.brain instanceof BotController) this.fighters.push({ bot, brain: bot.brain, key: 0, side: 0 });
    // Tática de esquadrão (P119): com 3 ou mais lutadores e algum de arma de perto, o primeiro de arma de linha fica
    // de **retaguarda** — segura o setor de nascimento e troca tiro com quem chega, em vez de largar tudo para rushar.
    // No esquadrão aliado (escolta) não vale: lá a formação é a do líder, e um bot de guarda quebraria o comboio.
    if (!o.escort) {
      const idx = escolherRearguarda(this.fighters.map((f) => f.brain.papel));
      if (idx >= 0) this.fighters[idx]!.brain.rearguard = true;
    }
  }

  /** Só muda os bots que cruzam o limite; mantém a vida dos demais e os técnicos. */
  setMechCapacity(count: number): void {
    let index = 0;
    for (const { mech, brain, home } of this.bots) {
      if (!(brain instanceof BotController) || mech instanceof Android || mech === this.bossMech) continue;
      const enabled = index++ < Math.max(0, count);
      if (enabled === !this.reserves.has(mech)) continue;
      if (!enabled) {
        this.reserves.add(mech);
        this.o.respawner.untrack(mech);
        mech.deactivate();
      } else {
        this.reserves.delete(mech);
        mech.respawn(home);
        mech.applyFacing(Math.atan2(home.x, home.z), 0);
        brain.reset();
        if (this.o.respawn !== false) this.o.respawner.track(mech, BOT_RESPAWN_S, () => {
          if (this.o.respawnAtHome) mech.respawn(home);
          brain.reset();
        });
      }
    }
    this.directorTimer = 0;
  }

  /** O chefe da missão (o Colossus), se está em campo e vivo; senão `null`. O HUD e as regras do capítulo leem daqui. */
  get chefe(): MechBase | null {
    const b = this.bossMech;
    return b && b.alive && !this.reserves.has(b) ? b : null;
  }

  isReserved(mech: MechBase): boolean {
    return this.reserves.has(mech);
  }

  nameOf(mech: MechBase): string {
    return this.bots.find((b) => b.mech === mech)?.name ?? 'BOT';
  }

  /** Rodada nova: todos inteiros de volta ao ponto de nascimento, olhando o centro, cérebro zerado. */
  respawnAll(): void {
    for (const { mech, brain, home } of this.bots) {
      if (this.reserves.has(mech)) continue;
      mech.respawn(home);
      mech.applyFacing(Math.atan2(home.x, home.z), 0);
      brain.reset();
    }
  }

  /**
   * Ativa um recorte do pool por tipo e guarda o restante. Usado apenas entre ondas, nunca cria ou
   * remove objetos. Devolve quantos inimigos ficaram ativos para a regra conferir seu teto.
   */
  setRoster(mechCount: number, androidCount: number, bossCount = 0, manifestanteCount = 0): number {
    let mechs = 0;
    let androids = 0;
    let manifestantes = 0;
    let active = 0;
    for (const { mech, brain, home, beam } of this.bots) {
      if (!(brain instanceof BotController)) {
        mech.deactivate();
        if (beam) beam.visible = false;
        continue;
      }
      // O Colossus tem vaga própria: não é um Mech rebelde, e é a onda que decide se ele entra.
      const android = mech instanceof Android;
      const enabled = mech === this.bossMech
        ? bossCount > 0
        : android
          ? ehManifestante(mech.stats.name) ? manifestantes++ < manifestanteCount : androids++ < androidCount
          : mechs++ < mechCount;
      if (!enabled) {
        mech.deactivate();
        continue;
      }
      mech.respawn(home);
      mech.applyFacing(Math.atan2(home.x, home.z), 0);
      brain.reset();
      active++;
    }
    this.directorTimer = 0;
    return active;
  }

  /** Troca a personalidade de cada Mech rebelde, na ordem (vale a partir do próximo tick). */
  setPersonas(list: readonly Persona[]): void {
    let i = 0;
    for (const b of this.bots) {
      if (!(b.brain instanceof BotController) || b.mech instanceof Android) continue;
      b.brain.persona = PERSONAS[list[i++] ?? 'soldado'];
    }
  }

  /** Troca a dificuldade de todos os bots (vale a partir do próximo tick). */
  setSkill(skill: BotSkill): void {
    for (const b of this.bots) if (b.brain instanceof BotController && !b.ownSkill) b.brain.skill = skill;
  }

  /** Cérebro de combate de um bot (HUD de debug e testes); undefined para técnicos. */
  brainOf(mech: MechBase): BotController | undefined {
    const brain = this.bots.find((b) => b.mech === mech)?.brain;
    return brain instanceof BotController ? brain : undefined;
  }

  /** Cérebro de um técnico (testes); undefined para os de combate. */
  technicianOf(mech: MechBase): TechnicianController | undefined {
    const brain = this.bots.find((b) => b.mech === mech)?.brain;
    return brain instanceof TechnicianController ? brain : undefined;
  }

  /** Um bot levou tiro de um alvo que ele caça: se estava só patrulhando, vira e vai atrás. */
  /** Um bot lançou a arma explosiva da mão esquerda (o cliente toca o som do lançamento, mais baixo de longe). */
  onLaunch?: (mech: MechBase, w: WeaponStats) => void;

  /**
   * Um tiro da salva explosiva de `mech` (P160 parte 4), da boca da mão esquerda (`_muzzle`) até onde o cérebro mirou (`blastAim`), pelo mesmo sistema
   * do jogador: a granada em arco, o cruzador, a chuva, o lançador leve com o desvio da salva, o foguete e o teleguiado.
   */
  private launch(mech: MechBase, brain: BotController, w: WeaponStats): void {
    const l = this.o.launchers;
    if (!l) return;
    _blastDir.subVectors(brain.blastAim, _muzzle);
    if (_blastDir.lengthSq() < 1e-8) return;
    _blastDir.normalize();
    if (w.lob) l.grenades.fire(_muzzle, brain.blastAim, mech.collider, w);
    else if (w.cruise) l.cruise.fire(_muzzle, _blastDir, brain.blastAim, mech.collider, w);
    else if (w.barrage) l.barrage.fire(_muzzle, _blastDir, brain.blastAim, mech.collider, w);
    else l.rockets.fire(_muzzle, w.salvo ? applySpread(_blastDir, spreadAt(brain.blastShots++, w.salvo.cone, _blastSpread)) : _blastDir, mech.collider, w);
    this.onLaunch?.(mech, w);
  }

  /** Um pulso do laser de `mech` (P175), da boca (`_muzzle`, já posta por quem chamou) na direção que o cérebro mirou (`shotDir`, com o erro de mira da dificuldade). Sem a partida atrás (`pulso`), nada. */
  private pulse(mech: MechBase, brain: { readonly shotDir: THREE.Vector3 }, w: WeaponStats): void {
    this.o.pulso?.(mech, _muzzle, brain.shotDir, w);
  }

  onDamaged(mech: MechBase, shooter: MechBase | undefined): void {
    if (!shooter || !this.targets.includes(shooter)) return;
    this.brainOf(mech)?.alert(shooter);
  }

  /** Um companheiro pede ajuda: informação de impacto, sem conceder visão através de paredes. */
  defend(player: MechBase, shooter: MechBase | undefined): void {
    if (!shooter || !this.targets.includes(shooter)) return;
    for (const { bot, brain } of this.fighters) {
      if (bot.mech.alive && bot.mech.simPosition.distanceToSquared(player.simPosition) < 60 * 60) brain.alert(shooter);
    }
  }

  /**
   * Diretor de ataque: dá as vagas a quem quer atacar, nesta ordem: quem já tem a vaga e está no turno,
   * a prioridade da personalidade (o brabo primeiro), quem espera há mais tempo, e o mais perto do alvo.
   * Quem terminou o turno vai para o fim da fila. Determinístico (ordem
   * estável, sem sorteio); roda 5 vezes por segundo. Custo: um laço e uma ordenação de ≤ 7 bots.
   */
  private direct(dt: number): void {
    this.directorTimer -= dt;
    if (this.directorTimer > 0) return;
    this.directorTimer = DIRECTOR_INTERVAL_S;
    const cand = this.cand;
    cand.length = 0;
    for (const q of this.fighters) {
      const { brain } = q;
      const target = brain.currentTarget;
      q.side = 0;
      brain.hasFlank = false;
      if (!q.bot.mech.alive || !brain.wantsToken || !target) {
        brain.hasToken = false;
        brain.tokenHeld = 0;
        continue;
      }
      // 0 = no turno; 1 = esperando; 2 = o turno acabou: vai para o fim da fila (sem isso, o mais perto do
      // alvo, que é quem estava atacando, ganhava a vaga de novo e só largava quando superaquecia).
      const onTurn = !brain.hasToken ? 1 : brain.tokenHeld < TURN_S ? 0 : 2;
      const me = q.bot.mech.simPosition;
      const tp = target.simPosition;
      // Prioridade (passos de 1e4) > espera (passos de 100 a cada 0,2 s, até 99) > distância (até 99 m).
      const waited = Math.min(Math.round(brain.tokenWait / DIRECTOR_INTERVAL_S), 99);
      q.key = onTurn * 1e6 - brain.persona.priority * 1e4 - waited * 100 + Math.min(Math.hypot(me.x - tp.x, me.z - tp.z), 99);
      // Inserção ordenada (≤ 7 bots), no mesmo array de sempre: nada alocado.
      let i = cand.length;
      cand.push(q);
      while (i > 0 && cand[i - 1]!.key > q.key) {
        cand[i] = cand[i - 1]!;
        i--;
      }
      cand[i] = q;
    }
    let budget = this.maxAttackers;
    for (const q of cand) {
      const cost = q.bot.mech instanceof Android ? ANDROID_COST : 1;
      if (cost <= budget + 1e-9) {
        if (!q.brain.hasToken) q.brain.tokenHeld = 0;
        q.brain.hasToken = true;
        q.brain.tokenWait = 0;
        budget -= cost;
      } else {
        q.brain.hasToken = false;
        q.brain.tokenHeld = 0;
        q.brain.tokenWait += DIRECTOR_INTERVAL_S;
      }
    }
    this.surround();
  }

  /**
   * Cerco: cada um que espera a vaga ganha um flanco do alvo dele, a `FLANK_RAD` da frente do alvo (para onde o torso
   * dele aponta, o que qualquer piloto vê), do lado em que já está (perto da frente, do lado com menos gente); o
   * segundo do mesmo lado vai mais para trás. Quando a vaga passar, ele ataca de onde o alvo não está olhando.
   * A referência é a frente do alvo, não quem ataca: quem ataca anda de lado em volta dele e arrastaria o flanco junto.
   * Determinístico (ordem da fila); custo: ≤ 8 × 8 contas, 5 vezes por segundo.
   */
  private surround(): void {
    const cand = this.cand;
    for (const q of cand) {
      const brain = q.brain;
      if (brain.hasToken || brain.profile.steady || brain.profile.melee) continue;
      const target = brain.currentTarget;
      if (!target) continue;
      const tp = target.simPosition;
      // A frente do alvo é (-sen yaw, -cos yaw); a direção dela, na convenção do cerco (0 = +Z).
      const anchor = Math.atan2(-Math.sin(target.yaw), -Math.cos(target.yaw));
      const me = q.bot.mech.simPosition;
      const off = wrapAngle(Math.atan2(me.x - tp.x, me.z - tp.z) - anchor);
      let left = 0;
      let right = 0;
      for (const o of cand) {
        if (o === q) break;
        if (o.side !== 0 && o.brain.currentTarget === target) o.side > 0 ? left++ : right++;
      }
      q.side = Math.abs(off) < FLANK_TIE_RAD ? (left <= right ? 1 : -1) : Math.sign(off);
      const rank = q.side > 0 ? left : right;
      brain.flankBearing = anchor + q.side * Math.min(Math.PI, FLANK_RAD + rank * FLANK_STEP_RAD);
      brain.hasFlank = true;
    }
  }

  /**
   * Rádio do clã: quem está vendo o alvo passa a posição aos companheiros a até `RADIO_RANGE` (quem não vê ninguém vai
   * lá). O primeiro contato vira aviso na tela. Custo: ≤ 8 contas, no máximo a cada 1,5 s por bot.
   */
  private radio(from: Bot, brain: BotController): void {
    const target = brain.radioReport;
    brain.radioReport = null;
    if (!target?.alive) return;
    const p = from.mech.simPosition;
    for (const { bot, brain: mate } of this.fighters) {
      if (mate === brain || !bot.mech.alive || this.reserves.has(bot.mech)) continue;
      if (bot.mech.simPosition.distanceToSquared(p) > RADIO_RANGE * RADIO_RANGE) continue;
      mate.hear(target, target.simPosition);
    }
    if (!brain.radioContact) return;
    brain.radioContact = false;
    if (this.radioQuiet > 0) return;
    this.radioQuiet = RADIO_CALLOUT_S;
    this.onRadio?.(from.name, target);
  }

  /** O robô da defesa pode continuar parado neste tick? Sim se nenhum alvo está a `ACORDA_ATE_M` e ele não levou dano nos últimos `ACORDADA_S` s. */
  private dormindo(bot: Bot, dt: number): boolean {
    const m = bot.mech.modules;
    const vida = m.torso + m.head + m.leftArm + m.rightArm + m.leftLeg + m.rightLeg;
    if (bot.vidaVista !== undefined && vida < bot.vidaVista) bot.vigia = ACORDADA_S;
    bot.vidaVista = vida;
    const limite = ACORDA_ATE_M * ACORDA_ATE_M;
    for (const t of this.targets) if (t.alive && t.simPosition.distanceToSquared(bot.mech.simPosition) < limite) bot.vigia = ACORDADA_S;
    if ((bot.vigia ?? 0) <= 0) return true;
    bot.vigia! -= dt;
    return false;
  }

  fixedUpdate(dt: number): void {
    if (this.pendingOrder) {
      this.order = this.pendingOrder;
      this.pendingOrder = null;
      for (const { brain } of this.fighters) brain.receiveOrder(this.order, this.orderPoint, this.orderTarget);
    }
    let focusing = false;
    if (this.order === 'focus') for (const { brain } of this.fighters) if (brain.order === 'focus') focusing = true;
    if (this.order === 'focus' && (!this.orderTarget?.alive || !focusing)) {
      this.order = 'follow';
      for (const { brain } of this.fighters) brain.receiveOrder('follow', this.orderPoint, null);
    }
    this.direct(dt);
    this.radioQuiet -= dt;
    for (const bot of this.bots) {
      const { mech, brain } = bot;
      if (!mech.alive) continue;
      // A defesa dorme enquanto ninguém chega perto (zero CPU por tick: sem pensar, sem andar) e acorda com um alvo a ACORDA_ATE_M ou com dano.
      if (this.o.defensores && brain instanceof BotController && this.dormindo(bot, dt)) continue; // o chefe (o Draga) nunca dorme: a marcha dele é o relógio da missão
      if (brain instanceof BotController && this.o.escort) {
        let leader: MechBase | null = null;
        let distance = Infinity;
        for (const player of this.o.escort) {
          const d = player.simPosition.distanceToSquared(mech.simPosition);
          if (player.alive && d < distance) { leader = player; distance = d; }
        }
        brain.leader = leader;
      }
      const input = brain.think(dt, this.targets);
      if (brain instanceof BotController && brain.radioReport) this.radio(bot, brain);
      mech.guard(brain instanceof BotController && brain.wantsGuard);
      mech.fixedUpdate(input, dt);
      // Técnico no alcance: o conserto é regra do tick (quem escolhe o Mech é o cérebro).
      if (brain instanceof TechnicianController && brain.repairTarget) brain.repairTarget.repair(REPAIR_RATE * this.repairScale * dt);
      // A arma da mão esquerda (P108 b): sai da boca da mão esquerda, na direção da mira, com a cadência e o calor dela.
      if (brain instanceof BotController && brain.wantsToFireSecondary && mech.loadout.secondary) {
        const w2 = mech.loadout.secondary;
        mech.simMuzzle(_muzzle, 'leftHand');
        if (w2.kind === 'ammo') this.launch(mech, brain, w2);
        else if (w2.beam) this.pulse(mech, brain, w2);
        else {
          this.projectiles.fire(_muzzle, brain.shotDir, mech.collider, true, w2);
          this.particles.burst(_muzzle, brain.shotDir, { count: 6, color: MUZZLE_COLOR, speed: 10, life: 0.12, spread: 0.5, gravity: 0 });
        }
        mech.onFireMount('leftHand', w2);
      }
      if (!brain.wantsToFire) continue;
      // Motosserra: o corte é regra do combate (sem projétil).
      if (mech.loadout.primary.kind === 'melee') {
        const target = brain instanceof BotController ? brain.currentTarget : null;
        if (target) this.combat.melee(mech, target, mech.loadout.primary);
        mech.onFire();
        continue;
      }
      mech.simMuzzle(_muzzle);
      if (mech.loadout.primary.beam) {
        this.pulse(mech, brain, mech.loadout.primary);
        mech.onFire();
        continue;
      }
      this.projectiles.fire(_muzzle, brain.shotDir, mech.collider, true, mech.loadout.primary);
      this.particles.burst(_muzzle, brain.shotDir, { count: 8, color: MUZZLE_COLOR, speed: 10, life: 0.15, spread: 0.5, gravity: 0 });
      mech.onFire();
    }
  }

  render(dt: number, alpha: number): void {
    for (const { mech, brain, beam } of this.bots) {
      mech.render(dt, alpha);
      if (!beam) continue;
      const target = brain instanceof TechnicianController ? brain.repairTarget : null;
      beam.visible = !!target && mech.alive;
      if (!beam.visible || !target) continue;
      // Da ferramenta do técnico ao peito do Mech (posições de render; 6 números, sem alocar).
      const attr = beam.geometry.getAttribute('position') as THREE.BufferAttribute;
      mech.muzzleWorldPosition(_beamTo);
      attr.setXYZ(0, _beamTo.x, _beamTo.y, _beamTo.z);
      _beamTo.copy(target.position).y += target.stats.height * 0.55;
      attr.setXYZ(1, _beamTo.x, _beamTo.y, _beamTo.z);
      attr.needsUpdate = true;
    }
  }
}
