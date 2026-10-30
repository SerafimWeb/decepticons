import * as THREE from 'three';

/**
 * A FASE ESCURA (ordem P281/P282, Comandante, 29/10): *"quero jogar na fase escura e ver só os olhos, os fogos, os rastros e explosões, e que isso reflita nos objetos e mechs"*.
 *
 * Só **desenho** (a regra, que muda o jogo, mora em `combat/visaoNoturna.ts`). Recebe a **escuridão** (0 = dia, 1 = apagão total) e se o Mech do jogador **enxerga no escuro**, e muda a cena:
 *
 *  - **as luzes do dia** (hemisfério, sol e contraluz, e qualquer outra luz da cena) caem para um fio: sem visão noturna, 4% (só a silhueta contra o brilho); com visão noturna, 55%, tingidas de verde
 *    (é o que os óculos fazem: o mundo inteiro aparece, mas verde e achatado, e a névoa o limita);
 *  - **o reflexo do ambiente** (`scene.environment`, o que faz o metal dos Mechs brilhar sem luz nenhuma) cai junto com as luzes: sem isso o Mech continuava aceso no escuro;
 *  - **o céu e a névoa** escurecem juntos (a névoa fica verde-escura nos óculos e mais densa: o alcance dos óculos acaba);
 *  - o que **brilha por conta própria** não escurece, porque é emissivo ou aditivo: os **olhos** dos robôs (o visor), os **rastros** dos tiros, o **fogo** e as **explosões**;
 *  - e esse brilho **reflete nas coisas**: um punhado de **luzes pontuais** (um pool fixo, {@link LUZES_DO_PULSO}) acende por uma fração de segundo na boca de cada tiro e no estouro de cada
 *    explosão, e ilumina o que está perto: o chão, as caixas, os Mechs.
 *
 * **Custo (G4/G5):** nenhuma alocação por quadro. As cores e intensidades de fábrica são guardadas uma vez; recalcular só acontece quando a escuridão muda (a cada quadro é uma comparação).
 * As {@link LUZES_DO_PULSO} luzes pontuais só entram na cena **na primeira vez que a escuridão passa de {@link ESCURIDAO_QUE_LIGA_AS_LUZES}** e ficam (o número de luzes de uma cena não pode
 * mudar sem o three recompilar todos os shaders: entrar na hora do primeiro escurecer paga esse tranco uma vez, longe do tiroteio), com intensidade zero quando ninguém atirou.
 * De dia, e para quem nunca liga a fase escura, o custo é zero: nem as luzes existem.
 */

/** Quanto das luzes do dia sobra no escuro total a quem não enxerga: só a silhueta. */
export const PISO_DA_LUZ_SEM_VISAO = 0.04;
/** Quanto sobra a quem tem visão noturna: os óculos ampliam a luz que resta. */
export const PISO_DA_LUZ_COM_VISAO = 0.55;
/** O céu (o fundo da cena) no escuro total, sem e com os óculos. */
export const CEU_SEM_VISAO = 0.03;
export const CEU_COM_VISAO = 0.2;
/** O quanto a névoa engrossa nos óculos no escuro total (o alcance deles acaba mais perto). */
export const NEVOA_DOS_OCULOS = 1.6;
/** O tom dos óculos: as luzes da cena viram isto. */
const VERDE_DOS_OCULOS = new THREE.Color(0.5, 1, 0.62);
/** A cor da névoa no escuro total: quase preta, e esverdeada nos óculos. */
const NEVOA_ESCURA = new THREE.Color(0.006, 0.008, 0.012);
const NEVOA_DOS_OCULOS_COR = new THREE.Color(0.012, 0.05, 0.02);

/** Quantas luzes pontuais o pulso dos tiros e das explosões usa (um pool fixo). */
export const LUZES_DO_PULSO = 3;
/** A cor do clarão da boca de um tiro (quente) e a do estouro de uma explosão (laranja). */
const COR_DO_CLARAO = new THREE.Color(1, 0.72, 0.38);
const COR_DA_EXPLOSAO = new THREE.Color(1, 0.5, 0.18);
/** A partir de que escuridão as luzes pontuais entram na cena. */
export const ESCURIDAO_QUE_LIGA_AS_LUZES = 0.02;
/** A variação mínima de escuridão que refaz as cores da cena (menos que isso ninguém vê). */
const PASSO = 0.004;

const limitar = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** O quanto das luzes do dia resta (0 a 1) para uma escuridão e para quem enxerga ou não no escuro: dia = 1, escuro total = o piso. */
export function fatorDaLuz(escuridao: number, visaoNoturna: boolean): number {
  const e = limitar(escuridao, 0, 1);
  const piso = visaoNoturna ? PISO_DA_LUZ_COM_VISAO : PISO_DA_LUZ_SEM_VISAO;
  return 1 + (piso - 1) * e;
}

/** O quanto do céu resta (0 a 1). */
export function fatorDoCeu(escuridao: number, visaoNoturna: boolean): number {
  const e = limitar(escuridao, 0, 1);
  const piso = visaoNoturna ? CEU_COM_VISAO : CEU_SEM_VISAO;
  return 1 + (piso - 1) * e;
}

interface LuzGuardada {
  readonly luz: THREE.Light;
  readonly intensidade: number;
  readonly cor: THREE.Color;
}

interface Pulso {
  luz: THREE.PointLight;
  /** Segundos desde que acendeu; `duracao` ≤ 0 = livre. */
  t: number;
  duracao: number;
  pico: number;
}

const _cor = new THREE.Color();

export class FaseEscura {
  private readonly guardadas: LuzGuardada[] = [];
  private readonly pulsos: Pulso[] = [];
  private fogCor: THREE.Color | null = null;
  private fogCorBase = new THREE.Color();
  private fogDensidadeBase = 0;
  private fundoCor: THREE.Color | null = null;
  private fundoCorBase = new THREE.Color();
  private fundoBase = 1;
  private ambienteBase = 1;
  private escuridao = 0;
  private visao = false;
  private registrado = false;
  private poolNaCena = false;

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Guarda as luzes de fábrica da cena (as cores e intensidades do dia), a névoa e o céu. Chamar **depois** de montar o cenário (e antes da primeira `aplicar`); as luzes que entrarem depois
   * (o pool dos pulsos é a exceção, e não conta) ficam como estão.
   */
  registrar(): void {
    this.guardadas.length = 0;
    this.scene.traverse((o) => {
      const luz = o as THREE.Light;
      if (!luz.isLight || this.pulsos.some((p) => p.luz === luz)) return;
      this.guardadas.push({ luz, intensidade: luz.intensity, cor: luz.color.clone() });
    });
    const fog = this.scene.fog;
    if (fog) {
      this.fogCor = fog.color;
      this.fogCorBase.copy(fog.color);
      this.fogDensidadeBase = (fog as THREE.FogExp2).density ?? 0;
    }
    const fundo = this.scene.background;
    if (fundo instanceof THREE.Color) {
      this.fundoCor = fundo;
      this.fundoCorBase.copy(fundo);
    } else this.fundoBase = this.scene.backgroundIntensity;
    this.ambienteBase = this.scene.environmentIntensity;
    this.escuridao = 0;
    this.visao = false;
    this.registrado = true;
  }

  /** A escuridão aplicada agora (0 a 1). */
  get nivel(): number {
    return this.escuridao;
  }

  /**
   * Muda a cena para a `escuridao` (0 a 1) vista por quem `visaoNoturna` (ou não). Só refaz as cores quando a escuridão anda mais que {@link PASSO} ou os óculos mudam: uma comparação por
   * quadro quando nada mudou.
   */
  aplicar(escuridao: number, visaoNoturna: boolean): void {
    if (!this.registrado) return;
    const e = limitar(Number.isFinite(escuridao) ? escuridao : 0, 0, 1);
    // Nos extremos (dia cheio, escuro total) só vale o valor exato: a cena volta ao dia de fábrica, sem sobra de 0,3%.
    const extremo = e === 0 || e === 1;
    if (visaoNoturna === this.visao && (extremo ? e === this.escuridao : Math.abs(e - this.escuridao) < PASSO)) return;
    this.escuridao = e;
    this.visao = visaoNoturna;
    if (e > ESCURIDAO_QUE_LIGA_AS_LUZES) this.garantirPool();
    const f = fatorDaLuz(e, visaoNoturna);
    const tom = visaoNoturna ? e : 0;
    for (const g of this.guardadas) {
      g.luz.intensity = g.intensidade * f;
      g.luz.color.copy(g.cor).lerp(VERDE_DOS_OCULOS, tom);
    }
    this.scene.environmentIntensity = this.ambienteBase * f;
    const ceu = fatorDoCeu(e, visaoNoturna);
    if (this.fundoCor) this.fundoCor.copy(this.fundoCorBase).multiplyScalar(ceu);
    else this.scene.backgroundIntensity = this.fundoBase * ceu;
    if (this.fogCor) {
      _cor.copy(visaoNoturna ? NEVOA_DOS_OCULOS_COR : NEVOA_ESCURA);
      this.fogCor.copy(this.fogCorBase).lerp(_cor, e);
      const fog = this.scene.fog as THREE.FogExp2 | null;
      if (fog && this.fogDensidadeBase > 0) fog.density = this.fogDensidadeBase * (1 + (visaoNoturna ? NEVOA_DOS_OCULOS - 1 : 0) * e);
    }
  }

  /** Acende uma luz pontual num ponto (a boca de um tiro, o estouro de uma explosão) por `duracaoS` segundos. Pool fixo: com todas acesas, a mais velha cede. Só tem efeito no escuro. */
  pulso(x: number, y: number, z: number, cor: THREE.Color, pico: number, alcance: number, duracaoS: number): void {
    if (!this.poolNaCena || this.escuridao <= ESCURIDAO_QUE_LIGA_AS_LUZES) return;
    let alvo: Pulso | null = null;
    for (const p of this.pulsos) {
      if (p.duracao <= 0) {
        alvo = p;
        break;
      }
      if (alvo === null || p.t / p.duracao > alvo.t / alvo.duracao) alvo = p;
    }
    if (!alvo) return;
    alvo.luz.position.set(x, y, z);
    alvo.luz.color.copy(cor);
    alvo.luz.distance = alcance;
    alvo.t = 0;
    alvo.duracao = duracaoS;
    alvo.pico = pico * this.escuridao;
    alvo.luz.intensity = alvo.pico;
  }

  /** O clarão da boca de um tiro: uma luz quente e curta (a boca acesa mostra o atirador e o que está em volta). */
  clarao(x: number, y: number, z: number): void {
    this.pulso(x, y, z, COR_DO_CLARAO, 150, 16, 0.09);
  }

  /** O estouro de uma explosão de escala `k` (1 = o foguete, `fx/explosionScale.ts`): luz laranja maior e mais demorada quanto maior a explosão. */
  explosao(x: number, y: number, z: number, k: number): void {
    const e = limitar(k, 0.2, 3);
    this.pulso(x, y, z, COR_DA_EXPLOSAO, 800 * e, 20 + 16 * e, 0.3 + 0.2 * e);
  }

  /** Um quadro: os pulsos apagam (queda quadrática: o clarão estala e some). */
  update(dt: number): void {
    for (const p of this.pulsos) {
      if (p.duracao <= 0) continue;
      p.t += dt;
      if (p.t >= p.duracao) {
        p.duracao = 0;
        p.luz.intensity = 0;
        continue;
      }
      const k = 1 - p.t / p.duracao;
      p.luz.intensity = p.pico * k * k;
    }
  }

  /** O pool de luzes pontuais entra na cena (uma vez só), com intensidade zero. */
  private garantirPool(): void {
    if (this.poolNaCena) return;
    for (let i = 0; i < LUZES_DO_PULSO; i++) {
      const luz = new THREE.PointLight(0xffffff, 0, 1, 2);
      luz.castShadow = false;
      this.scene.add(luz);
      this.pulsos.push({ luz, t: 0, duracao: 0, pico: 0 });
    }
    this.poolNaCena = true;
  }

  /** As luzes pontuais já estão na cena? (os testes e a bancada leem) */
  get luzesNaCena(): number {
    return this.poolNaCena ? this.pulsos.length : 0;
  }

  /** Devolve a cena ao dia (uma partida nova) e tira o pool. */
  dispose(): void {
    this.aplicar(0, false);
    for (const p of this.pulsos) this.scene.remove(p.luz);
    this.pulsos.length = 0;
    this.poolNaCena = false;
  }
}
