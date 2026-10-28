import type { MechBase } from '../entities/MechBase';
import type { BotController } from './BotController';
import { wrapAngle } from './steer';

/**
 * O CÉREBRO DO TIME (ordem P269, 28/10/2026: "os bots precisam ser mais estratégicos… combinar ataques e defesas, como se
 * se comunicassem"). Um por lado (inimigos, aliados), dentro do `BotSystem`. Cada bot já luta bem sozinho (`BotController`);
 * o que faltava era **combinar**: este módulo escolhe um plano para o time, dá a cada um a sua **tarefa** e **anuncia** o
 * que está fazendo (a coordenação que o jogador não percebe não existe: o rádio é o que a faz valer).
 *
 * Planos desta etapa:
 * - **PINÇA**: com 2+ bots engajados no mesmo alvo, o de arma mais longa **fixa** de frente e os de arma mais curta vão
 *   aos **flancos** (de lados opostos), sem atirar. Quando todos estão em posição, o fixador dá o sinal ("VAI!") e todos
 *   abrem fogo juntos por `GOLPE_S`, com uma vaga de ataque extra por flanqueador (o diretor soma `bonusVagas` ao teto).
 *   Depois a pinça esfria (`PINCA_ESFRIA_S`) e o diretor volta a mandar. A dificuldade escala o plano
 *   (`BotSkill.coordenacao`): fácil não faz pinça, normal usa 1 flanqueador, difícil usa 2.
 * - **REAGRUPAR**: bots em patrulha, espalhados demais e sem combate, se juntam em volta do mais central e saem juntos
 *   para o mesmo ponto da rota (em vez de cada um vagar sozinho e chegar ao alvo em fila).
 *
 * Regras da casa: **G1/G2** (decide dentro do tick, sem sorteio: a ordem é a da lista e o desempate é o índice),
 * **G4** (os vetores são os mesmos de sempre: nada se aloca), custo: roda a 2 Hz, ≤ 32 × 32 contas e **nenhum raio**
 * (usa só o que a percepção de cada bot já viu).
 */

/** O que o time diz no rádio (o texto está em `radioFalas.ts`; aqui só o tipo, sem string na simulação). */
export type Fala = 'pinca' | 'posicao' | 'vai' | 'reagrupar';

/** O que o cérebro precisa de cada bot: o Mech, o nome (para o rádio) e o cérebro de combate. O `Fighter` do `BotSystem` já serve. */
export interface MembroDoTime {
  readonly bot: { readonly mech: MechBase; readonly name: string };
  readonly brain: BotController;
}

/** O time pensa a este ritmo (s): 2 vezes por segundo bastam para um plano que dura segundos. */
const PLANEJA_S = 0.5;
/** Flanco da pinça: este ângulo (~100°) da frente do alvo, o mesmo do cerco do diretor. */
const FLANCO_RAD = 1.75;
/** Perto da frente do alvo (menos que isto), o lado do flanqueador é o oposto ao do fixador. */
const FLANCO_EMPATE_RAD = 0.5;
/** Quanto a pinça espera os flanqueadores chegarem (s); passado isto, sem ninguém em posição, ela se desfaz. */
const MONTAGEM_MAX_S = 7;
/** Quanto dura o golpe: todos atiram juntos (s). */
const GOLPE_S = 5;
/** Intervalo até a próxima pinça, depois de um golpe (s): a coordenação forte vem em ondas, não o tempo todo. */
const PINCA_ESFRIA_S = [20, 20, 14] as const;
/** Intervalo até tentar de novo depois de uma pinça que se desfez (s). */
const PINCA_DESFEITA_S = 8;
/** No máximo uma fala a cada tanto (s): o sinal "VAI!" passa sempre. */
const FALA_QUIETA_S = 1.2;

/** Reagrupar: só com este número de bots de patrulha. */
const REAGRUPA_MIN = 3;
/** Reagrupar: o mais distante do centro do time está a mais que isto (m). */
const REAGRUPA_DISPERSAO_M = 55;
/** Reagrupar: todos a menos que isto (m) do ponto = juntos. */
const REAGRUPA_JUNTOS_M = 20;
/** Reagrupar: desiste depois de tanto tempo (s). */
const REAGRUPA_MAX_S = 14;
/** Intervalo até o próximo reagrupamento (s). */
const REAGRUPA_ESFRIA_S = 30;

type Fase = 'livre' | 'montando' | 'golpe' | 'reagrupando';

const SEM_RESERVA: ReadonlySet<MechBase> = new Set();

/** O alvo em que este bot está engajado de verdade (à vista, atacando ou perseguindo, livre para receber uma tarefa), ou null. */
function engajado(m: MembroDoTime, reservas: ReadonlySet<MechBase>): MechBase | null {
  const b = m.brain;
  const alvo = b.currentTarget;
  if (!alvo?.alive || !m.bot.mech.alive || reservas.has(m.bot.mech)) return null;
  if (b.tarefa !== 'nenhuma' || b.rearguard || b.plantador || b.order !== 'follow' || b.profile.melee || b.profile.steady) return null;
  if (!b.seesTarget || (b.state !== 'attack' && b.state !== 'chase')) return null;
  return alvo;
}

/** Desvio do bot em relação à frente do alvo, em radianos (0 = na frente; sinal = o lado). Mesma convenção do cerco do diretor (0 = +Z). */
function desvioDaFrente(m: MembroDoTime, alvo: MechBase, frente: number): number {
  const me = m.bot.mech.simPosition;
  const tp = alvo.simPosition;
  return wrapAngle(Math.atan2(me.x - tp.x, me.z - tp.z) - frente);
}

const alcance = (m: MembroDoTime): number => m.bot.mech.loadout.primary.optimalRange;

const dist2 = (m: MembroDoTime, alvo: MechBase): number => {
  const a = m.bot.mech.simPosition;
  const b = alvo.simPosition;
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
};

export class CerebroDoTime {
  /** O que o time diz (o `BotSystem` repassa à partida, que repassa à tela). Sem ouvinte, o time só age. */
  onFala?: (from: string, fala: Fala, alvo: MechBase | null) => void;
  /** Vagas de ataque extras enquanto a pinça golpeia (o diretor do `BotSystem` soma ao teto). */
  bonusVagas = 0;
  /**
   * O flanqueador segura o fogo até o sinal? Sim para os inimigos (é a emboscada que o jogador sente). Não para os aliados do jogador: eles flanqueiam atirando,
   * porque um aliado calado a caminho do flanco enquanto o jogador apanha é pior que nenhuma pinça. O `BotSystem` desliga isto no time de escolta.
   */
  segurarFogo = true;
  /** A pinça pode ser desligada à parte (a bancada mede cada plano sozinho). */
  pinca = true;

  private fase: Fase = 'livre';
  private timer = PLANEJA_S;
  private tempo = 0;
  private esfriaPinca = 0;
  private esfriaReagrupa = 0;
  private quieta = 0;
  private alvo: MechBase | null = null;
  private fixador: MembroDoTime | null = null;
  private readonly flancos: (MembroDoTime | null)[] = [null, null];
  private nivel = 1;
  private posicaoDita = false;
  private pivo: MembroDoTime | null = null;
  /** Quem está no plano (pinça: os engajados no alvo; reagrupar: os de patrulha): o mesmo array de sempre. */
  private readonly grupo: MembroDoTime[] = [];
  private reservas: ReadonlySet<MechBase> = SEM_RESERVA;

  /** A fase de hoje (testes e painel de depuração). */
  get plano(): Fase {
    return this.fase;
  }

  /**
   * Um tick fixo. `ligado` = a coordenação está ligada (o interruptor `ia:time`): desligada, o cérebro solta qualquer tarefa e o time
   * volta a lutar como antes. `reservas` = os Mechs retirados da sala (não entram em plano nenhum).
   */
  planejar(dt: number, membros: readonly MembroDoTime[], ligado: boolean, reservas: ReadonlySet<MechBase> = SEM_RESERVA): void {
    this.esfriaPinca -= dt;
    this.esfriaReagrupa -= dt;
    this.quieta -= dt;
    this.tempo += dt;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = PLANEJA_S;
    this.reservas = reservas;
    if (!ligado) {
      if (this.fase !== 'livre') this.soltar(0);
      return;
    }
    switch (this.fase) {
      case 'livre':
        if (this.pinca && this.esfriaPinca <= 0 && this.acharPinca(membros)) break;
        if (this.esfriaReagrupa <= 0) this.acharReagrupar(membros);
        break;
      case 'montando':
        this.montar();
        break;
      case 'golpe':
        this.golpear();
        break;
      case 'reagrupando':
        this.reagrupar();
        break;
    }
  }

  /** Diz no rádio. Devolve se a fala saiu (o limite de ritmo derruba a que vem logo depois de outra, menos o sinal). */
  private dizer(m: MembroDoTime, fala: Fala, alvo: MechBase | null): boolean {
    if (this.quieta > 0 && fala !== 'vai') return false;
    this.quieta = FALA_QUIETA_S;
    this.onFala?.(m.bot.name, fala, alvo);
    return true;
  }

  /** Desfaz o plano atual: solta a tarefa de todo mundo e descansa `esfria` segundos antes da próxima pinça. */
  private soltar(esfria: number): void {
    for (const m of this.grupo) m.brain.largarTarefa();
    this.grupo.length = 0;
    this.flancos[0] = this.flancos[1] = null;
    this.fixador = this.pivo = this.alvo = null;
    this.bonusVagas = 0;
    this.fase = 'livre';
    this.esfriaPinca = Math.max(this.esfriaPinca, esfria);
  }

  // ------------------------------------------------------------------------------------------------------ PINÇA

  /** Procura 2+ bots engajados no mesmo alvo e, achando, monta a pinça. Devolve se montou. */
  private acharPinca(membros: readonly MembroDoTime[]): boolean {
    const reservas = this.reservas;
    let alvo: MechBase | null = null;
    let melhor = 0;
    for (const a of membros) {
      const t = engajado(a, reservas);
      if (!t) continue;
      let n = 0;
      for (const b of membros) if (engajado(b, reservas) === t) n++;
      if (n > melhor) {
        melhor = n;
        alvo = t;
      }
    }
    if (!alvo || melhor < 2) return false;
    const g = this.grupo;
    g.length = 0;
    for (const b of membros) if (engajado(b, reservas) === alvo) g.push(b);

    // O fixador: arma mais longa; empate, o mais perto do alvo; empate, o primeiro da lista.
    let fix = g[0]!;
    for (const m of g) {
      if (alcance(m) > alcance(fix) || (alcance(m) === alcance(fix) && dist2(m, alvo) < dist2(fix, alvo))) fix = m;
    }
    const nivel = Math.min(2, Math.max(0, Math.floor(fix.brain.skill.coordenacao ?? 1)));
    if (nivel < 1) {
      g.length = 0;
      return false;
    }
    // Os flanqueadores: arma mais curta primeiro (é quem rende de perto); empate, o mais perto.
    const quantos = Math.min(nivel, g.length - 1);
    this.flancos[0] = this.flancos[1] = null;
    for (let k = 0; k < quantos; k++) {
      let pick: MembroDoTime | null = null;
      for (const m of g) {
        if (m === fix || m === this.flancos[0]) continue;
        if (!pick || alcance(m) < alcance(pick) || (alcance(m) === alcance(pick) && dist2(m, alvo) < dist2(pick, alvo))) pick = m;
      }
      this.flancos[k] = pick;
    }

    // Lados opostos: o primeiro flanqueador vai para o lado contrário ao do fixador; o segundo, para o outro.
    const frente = Math.atan2(-Math.sin(alvo.yaw), -Math.cos(alvo.yaw));
    const offFix = desvioDaFrente(fix, alvo, frente);
    const ladoFix = Math.abs(offFix) < FLANCO_EMPATE_RAD ? 0 : Math.sign(offFix);
    const f0 = this.flancos[0]!;
    const off0 = desvioDaFrente(f0, alvo, frente);
    const lado0 = ladoFix !== 0 ? -ladoFix : Math.abs(off0) < FLANCO_EMPATE_RAD ? 1 : Math.sign(off0);
    for (let k = 0; k < quantos; k++) {
      const b = this.flancos[k]!.brain;
      b.tarefa = 'flanco';
      b.tarefaBearing = frente + (k === 0 ? lado0 : -lado0) * FLANCO_RAD;
      b.segurarFogo = this.segurarFogo;
      b.golpe = false;
    }
    this.fixador = fix;
    this.alvo = alvo;
    this.nivel = nivel;
    this.posicaoDita = false;
    // Só quem recebeu tarefa precisa ser solto depois.
    g.length = 0;
    for (let k = 0; k < quantos; k++) g.push(this.flancos[k]!);
    this.fase = 'montando';
    this.tempo = 0;
    this.dizer(f0, 'pinca', alvo);
    return true;
  }

  /** Espera os flanqueadores chegarem: todos em posição = golpe; o tempo acabou com alguém em posição = golpe; senão, desfaz. */
  private montar(): void {
    const alvo = this.alvo;
    const fix = this.fixador;
    if (!alvo?.alive || !fix?.bot.mech.alive || fix.brain.currentTarget !== alvo) {
      this.soltar(PINCA_DESFEITA_S);
      return;
    }
    let vivos = 0;
    let prontos = 0;
    let primeiro: MembroDoTime | null = null;
    for (let k = 0; k < 2; k++) {
      const f = this.flancos[k];
      if (!f) continue;
      if (!f.bot.mech.alive || f.brain.tarefa !== 'flanco' || f.brain.currentTarget !== alvo) {
        f.brain.largarTarefa();
        this.flancos[k] = null;
        continue;
      }
      vivos++;
      if (f.brain.noFlanco) {
        prontos++;
        primeiro ??= f;
      }
    }
    if (vivos === 0) {
      this.soltar(PINCA_DESFEITA_S);
      return;
    }
    const vaiAgora = prontos === vivos || (this.tempo >= MONTAGEM_MAX_S && prontos > 0);
    if (vaiAgora) {
      this.golpe(fix, alvo, vivos);
      return;
    }
    // O primeiro a chegar avisa; o sinal só vem quando os outros chegarem (ou o tempo acabar).
    if (primeiro && !this.posicaoDita) this.posicaoDita = this.dizer(primeiro, 'posicao', alvo);
    if (this.tempo >= MONTAGEM_MAX_S) this.soltar(PINCA_DESFEITA_S);
  }

  /** O sinal: os flanqueadores podem atirar e o diretor abre uma vaga a mais para cada um. */
  private golpe(fixador: MembroDoTime, alvo: MechBase, vivos: number): void {
    for (const f of this.flancos) {
      if (!f) continue;
      f.brain.segurarFogo = false;
      f.brain.golpe = true;
    }
    this.bonusVagas = vivos;
    this.fase = 'golpe';
    this.tempo = 0;
    this.dizer(fixador, 'vai', alvo);
  }

  private golpear(): void {
    for (let k = 0; k < 2; k++) {
      const f = this.flancos[k];
      if (f && !f.bot.mech.alive) {
        f.brain.largarTarefa();
        this.flancos[k] = null;
      }
    }
    if (this.tempo >= GOLPE_S || !this.alvo?.alive) this.soltar(PINCA_ESFRIA_S[this.nivel] ?? PINCA_ESFRIA_S[1]);
  }

  // -------------------------------------------------------------------------------------------------- REAGRUPAR

  /** Time em patrulha e espalhado: junta em volta do bot mais central. Só com todos os elegíveis em patrulha (sem combate). */
  private acharReagrupar(membros: readonly MembroDoTime[]): void {
    const reservas = this.reservas;
    const g = this.grupo;
    g.length = 0;
    let cx = 0;
    let cz = 0;
    for (const m of membros) {
      const b = m.brain;
      if (!m.bot.mech.alive || reservas.has(m.bot.mech) || b.rearguard || b.plantador || b.order !== 'follow' || b.leader) continue;
      if (b.state !== 'patrol' || b.seesTarget || b.tarefa !== 'nenhuma') {
        g.length = 0;
        return;
      }
      g.push(m);
      cx += m.bot.mech.simPosition.x;
      cz += m.bot.mech.simPosition.z;
    }
    if (g.length < REAGRUPA_MIN) {
      g.length = 0;
      return;
    }
    cx /= g.length;
    cz /= g.length;
    let pivo = g[0]!;
    let menor = Infinity;
    let maior = 0;
    for (const m of g) {
      const d = (m.bot.mech.simPosition.x - cx) ** 2 + (m.bot.mech.simPosition.z - cz) ** 2;
      if (d < menor) {
        menor = d;
        pivo = m;
      }
      if (d > maior) maior = d;
    }
    if (maior < REAGRUPA_DISPERSAO_M * REAGRUPA_DISPERSAO_M) {
      g.length = 0;
      return;
    }
    for (const m of g) {
      m.brain.tarefa = 'reagrupar';
      m.brain.tarefaPonto.copy(pivo.bot.mech.simPosition);
    }
    this.pivo = pivo;
    this.fase = 'reagrupando';
    this.tempo = 0;
    this.dizer(pivo, 'reagrupar', null);
  }

  private reagrupar(): void {
    const pivo = this.pivo;
    if (!pivo?.bot.mech.alive) {
      this.soltar(0);
      this.esfriaReagrupa = REAGRUPA_ESFRIA_S;
      return;
    }
    let juntos = true;
    for (const m of this.grupo) {
      const b = m.brain;
      if (!m.bot.mech.alive) continue;
      // Alguém entrou em combate: o plano acaba (quem luta não espera ninguém).
      if (b.state !== 'patrol' || b.seesTarget) {
        this.soltar(0);
        this.esfriaReagrupa = REAGRUPA_ESFRIA_S;
        return;
      }
      if (dist2Pontos(m, pivo) > REAGRUPA_JUNTOS_M * REAGRUPA_JUNTOS_M) juntos = false;
    }
    if (juntos || this.tempo >= REAGRUPA_MAX_S) {
      // Saem juntos: todos para o mesmo ponto da rota, o que o pivô ia visitar.
      if (juntos) for (const m of this.grupo) m.brain.seguirRota(pivo.brain.rotaAtual);
      this.soltar(0);
      this.esfriaReagrupa = REAGRUPA_ESFRIA_S;
    }
  }
}

const dist2Pontos = (a: MembroDoTime, b: MembroDoTime): number => {
  const p = a.bot.mech.simPosition;
  const q = b.bot.mech.simPosition;
  return (p.x - q.x) ** 2 + (p.z - q.z) ** 2;
};
