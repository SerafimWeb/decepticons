import { lobMaxRange } from '../combat/lob';
import { CLASS_LABEL, classFor, WEAPON_CLASSES, WEAPON_FIT, type RobotSize, type WeaponClass } from '../combat/weaponClass';
import { DAMAGE_TYPE, type DamageType, fullReload, rangeBandOf, type RangeBand, weapon, WEAPON_IDS, type WeaponId, type WeaponStats } from '../combat/weapons';
import { ARM_SLOTS, CHASSIS, CHASSIS_PAPEL, CHASSIS_SIZE, type ChassisId } from '../entities/chassis';

/**
 * As fichas do ARSENAL (fase 4C, P27/P54: "as telas Arsenal e chassis"): o que o Comandante compara para decidir o que pôr no Hangar, no esquadrão e nos números do equilíbrio.
 * Só leitura e conta, **sem número copiado**: tudo sai de `weapon()` e de `CHASSIS`, então mudar o equilíbrio muda a ficha sozinho, e o teste confere que nenhuma arma ou chassi
 * ficou de fora. Sem Three.js nem DOM (a janela, `ArsenalPanel.ts`, só desenha).
 */

export const NATUREZA_ROTULO: Readonly<Record<DamageType, string>> = {
  termico: 'térmico',
  laser: 'laser',
  balistico: 'balístico',
  explosivo: 'explosivo',
  pulso: 'pulso',
  sonico: 'sônico',
  corte: 'corte',
  eletrico: 'elétrico',
  criogenico: 'criogênico',
};

/** O que o acerto faz com o alvo, no feminino/masculino que a frase pede ("deixa o alvo queimando"). */
const ESTADO_ROTULO: Readonly<Record<NonNullable<WeaponStats['inflicts']>, string>> = { burn: 'queimando (fogo)', shock: 'chocado (choque)', chill: 'gelado (gelo, e congela no terceiro acerto)' };

export interface FichaDaArma {
  id: WeaponId;
  nome: string;
  /** O porte da arma no tamanho para o qual foi feita (leve, média, pesada). */
  classe: WeaponClass;
  tamanho: RobotSize;
  natureza: DamageType;
  tipo: 'energia' | 'munição' | 'corpo a corpo';
  /** Dano por tiro (no centro da explosão, se houver). */
  dano: number;
  tirosPorSegundo: number;
  /** Dano por segundo do tiro simples (dano ÷ intervalo); `null` nas armas cuja conta não é essa (chuva, chamas, onda, rotatória, teleguiado). */
  danoPorSegundo: number | null;
  alcanceOtimo: number;
  alcanceMaximo: number;
  /** A faixa do alcance máximo: corpo a corpo, curto, médio ou longo (`rangeBandOf`). */
  faixa: RangeBand;
  /** Fração do dissipador que cada tiro gera. */
  calorPorTiro: number;
  /** Carga que ocupa no Hangar (t), no MK I. */
  massa: number;
  /** O que a faz diferente, em frases curtas (carga, giro, cone, estado, explosão...). */
  notas: string[];
  /** Os chassis que podem levá-la, em qualquer encaixe. */
  chassis: ChassisId[];
}

const fmt = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');

/** As frases que distinguem a arma: só o que ela tem de próprio (o resto está nas colunas). */
export function notasDaArma(w: WeaponStats): string[] {
  const n: string[] = [];
  if (w.chargeTime) n.push(`carrega ${fmt(w.chargeTime)} s antes do tiro`);
  if (w.spin) n.push('gira o cano: a cadência sobe com o tempo');
  if (w.flame) n.push('cone de fogo, com tanque de combustível');
  if (w.wave) n.push('onda em cone que empurra');
  if (w.guide) n.push('míssil teleguiado: trava no alvo à frente');
  if (w.salvo) n.push(`um aperto esvazia o lançador: ${w.magazine} mísseis em sequência (${w.magazine * (w.tierMagazine ?? 1)} e ${w.magazine * (w.tierMagazine ?? 1) ** 2} nos níveis), só dispara com todos os tubos carregados`);
  if (w.cruise) n.push('míssil cruzador: sobe em arco e mergulha no ponto da mira, passa por cima do cenário baixo, não guia');
  if (w.lob) n.push(`granada em arco com gravidade: cai no ponto da mira (até ${fmt(lobMaxRange(w.speed, w.lob.gravity))} m), sobe por cima da cobertura quando o arco baixo bate nela; explode no robô, tabela na parede e crava no chão (estoura ${fmt(w.lob.fuse)} s depois)`);
  if (w.beam) n.push('feixe instantâneo em pulsos: acerta na hora, o calor decide a duração');
  if (w.hook) n.push(`arpão: prende o primeiro inimigo à vista (até ${fmt(w.maxRange)} m) e o puxa a ${fmt(w.hook.pullSpeed)} m/s por até ${fmt(w.hook.hold)} s; o dash do alvo e a parede cortam o cabo, e robô de raio maior que ${fmt(w.hook.breakRadius)} m o arrebenta`);
  if (w.pellets) n.push(`${w.pellets.count} balins de ${w.damage} num cone de ${fmt((w.pellets.cone * 180) / Math.PI)}° (${w.pellets.count * w.damage} por disparo de perto; de longe o cone passa da largura de um Mech)`);
  if (w.barrage) n.push(`chuva de ${w.barrage.bombs} bombas`);
  if (w.blastRadius > 0 && !w.barrage) n.push(`explode num raio de ${fmt(w.blastRadius)} m`);
  if (w.inflicts) n.push(`deixa o alvo ${ESTADO_ROTULO[w.inflicts]}`);
  if (w.empHeat) n.push('esquenta o alvo no impacto');
  if (w.kind === 'ammo') n.push(w.salvo ? `os tubos voltam um a um, ${fmt(w.reload)} s cada, depois da salva (cheio em ${fmt(fullReload(w))} s)` : `munição: ${w.magazine} tiros, recarrega a cada ${fmt(w.reload)} s (cheio em ${fmt(fullReload(w))} s)`);
  if (w.tierRate) n.push('a cadência sobe com o nível');
  if (w.tierRange) n.push('o alcance sobe com o nível');
  if (w.tierGuide) n.push('a guiagem sobe com o nível (curva e alcance da trava)');
  return n;
}

function chassisQueLevam(id: WeaponId): ChassisId[] {
  return (Object.keys(CHASSIS) as ChassisId[]).filter((c) => {
    const s = ARM_SLOTS[c];
    return s.right.includes(id) || s.left.includes(id) || (s.shoulders?.includes(id) ?? false);
  });
}

/** Uma ficha por arma do catálogo, da leve para a pesada e, dentro da classe, pelo nome. */
export function fichasDasArmas(): FichaDaArma[] {
  const fichas = WEAPON_IDS.map((id): FichaDaArma => {
    const w = weapon(id);
    const fit = WEAPON_FIT[id];
    const simples = !w.spin && !w.flame && !w.wave && !w.guide && !w.barrage && !w.salvo && !w.cruise && !w.lob && !w.hook && w.kind !== 'melee';
    return {
      id,
      nome: w.name,
      classe: fit.class,
      tamanho: fit.size,
      natureza: DAMAGE_TYPE[id],
      tipo: w.kind === 'energy' ? 'energia' : w.kind === 'ammo' ? 'munição' : 'corpo a corpo',
      dano: w.damage,
      tirosPorSegundo: Math.round((1 / w.fireInterval) * 100) / 100,
      danoPorSegundo: simples ? Math.round(((w.damage * (w.pellets?.count ?? 1)) / w.fireInterval) * 10) / 10 : null,
      alcanceOtimo: w.optimalRange,
      alcanceMaximo: w.maxRange,
      faixa: rangeBandOf(w),
      calorPorTiro: w.heatPerShot,
      massa: w.mass,
      notas: notasDaArma(w),
      chassis: chassisQueLevam(id),
    };
  });
  return fichas.sort((a, b) => WEAPON_CLASSES.indexOf(a.classe) - WEAPON_CLASSES.indexOf(b.classe) || a.tamanho - b.tamanho || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export interface FichaDoChassi {
  id: ChassisId;
  nome: string;
  tamanho: RobotSize;
  /** O papel numa frase (`CHASSIS_PAPEL`). */
  papel: string;
  vidaDoTorso: number;
  vidaTotal: number;
  velocidade: number;
  pula: boolean;
  dash: boolean;
  /** A carga que o Hangar deixa (t). */
  carga: number;
  /** Quantas armas há em cada encaixe, e quais (nomes). */
  direita: string[];
  esquerda: string[];
  ombros: string[];
  /** Quantos layouts de ataque (1 = só o padrão). */
  layouts: number;
  /** A arma de fábrica da mão direita. */
  armaDeFabrica: string;
  /** É um chassi que o bot pode pilotar (o esquadrão oferece)? Os titãs só do lado dos inimigos. */
  bot: boolean;
}

/** Uma ficha por chassi do catálogo, do menor para o maior e, dentro do tamanho, pelo nome. */
export function fichasDosChassis(botsPodem: readonly ChassisId[] = []): FichaDoChassi[] {
  const nomes = (ids: readonly WeaponId[] | undefined): string[] => (ids ?? []).map((i) => weapon(i).name);
  const fichas = (Object.keys(CHASSIS) as ChassisId[]).map((id): FichaDoChassi => {
    const c = CHASSIS[id];
    const slots = ARM_SLOTS[id];
    const m = c.maxModuleHealth;
    return {
      id,
      nome: c.name,
      tamanho: CHASSIS_SIZE[id],
      papel: CHASSIS_PAPEL[id],
      vidaDoTorso: m.torso,
      vidaTotal: m.torso + m.head + m.leftArm + m.rightArm + m.leftLeg + m.rightLeg,
      velocidade: c.moveSpeed,
      pula: c.maxJumps > 0,
      dash: c.dashSpeed > 0,
      carga: c.weaponCapacity,
      direita: nomes(slots.right),
      esquerda: nomes(slots.left),
      ombros: nomes(slots.shoulders),
      layouts: c.layouts?.length ?? 1,
      armaDeFabrica: c.loadout.primary.name,
      bot: botsPodem.includes(id),
    };
  });
  return fichas.sort((a, b) => a.tamanho - b.tamanho || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** O rótulo da classe de uma arma para a tela ("MÉDIA"); em robô de outro tamanho a mesma arma tem outra classe (`classFor`). */
export const rotuloDaClasse = (c: WeaponClass): string => CLASS_LABEL[c];

/** A classe que a arma tem NESTE tamanho de robô, ou `null` se não cabe (a regra "a pesada de um tamanho é a leve do seguinte"). */
export const classeNoTamanho = (id: WeaponId, tamanho: RobotSize): WeaponClass | null => classFor(id, tamanho);
