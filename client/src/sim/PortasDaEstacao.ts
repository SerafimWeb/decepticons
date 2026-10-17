import { ehAndroide } from './CabosDeDados';

/**
 * AS PORTAS DA ESTAÇÃO (ordens P163 e P162, **Capítulo 1, frente 2**: a invasão do prédio, `CAMPANHAS_E_CHEFES.md` § 0): o prédio tem **duas entradas**, a **principal** (a fachada
 * voltada para o pátio e o portão do mar) e a **dos fundos** (a fachada voltada para a rua de trás, onde os invasores chegam pelo portão de trás). Os manifestantes e as máquinas
 * **forçam as portas**; porta com a vida zerada está **ARROMBADA** e **drena a rede da estação** até alguém a recuperar. Quem defende as duas ao mesmo tempo precisa se dividir:
 * é o "mais possibilidades de ataque e vulnerabilidade" que o Comandante pediu.
 *
 *  - **Arrombar.** Todo rebelde a menos de 7 m da porta a força, cada um com o seu peso (`pesoNaPorta`): o Mech vale 1, o manifestante 1 (em grupo, com extintor e barra), o
 *    andróide 0,4 e o Colossus 4. A porta aguenta 400 de vida (três manifestantes a arrombam em ~33 s).
 *  - **Recuperar.** O jogador e os aliados perto, **sem rebelde em cima**, consertam (8 por segundo, até dois: o andróide aliado vale dois). A porta volta a fechar com 30% da vida.
 *    Uma porta forçada **não se recompõe sozinha**: é preciso ir lá.
 *
 * Regra **pura** (G1/G2, G14): só números, sem relógio nem sorteio; roda igual no cliente e no servidor. Quem chama (`Match`) conta quem está perto, sem alocar.
 */

export const PORTAS = {
  vidaMax: 400,
  /** Dano por segundo por ponto de peso do invasor na porta. */
  danoPorPesoPorS: 4,
  reparoPorDefensorPorS: 8,
  maxReparadores: 2,
  /** A porta arrombada volta a fechar quando chega a esta fração da vida. */
  voltaEm: 0.3,
  /** O que cada porta **arrombada** drena da rede da estação por segundo (as duas: 24 por segundo, ~42 s até a estação cair sozinha). */
  drenoArrombadaPorS: 12,
  /** A que distância do ponto um rebelde conta como forçando a porta (m). */
  raioDeAtaque: 7,
  /** A que distância do ponto um defensor conta como perto (m). */
  raioDeReparo: 6,
} as const;

export interface PortaDaEstacao {
  readonly id: 'frente' | 'fundos';
  /** O nome que aparece no HUD e nos avisos. */
  readonly nome: string;
  /** Onde se força a porta: o chão logo fora da fachada do prédio (x, z). */
  readonly x: number;
  readonly z: number;
}

/** O prédio fica em (288, 64), com 40 m (x) por 28 m (z): a fachada sul está em z = 50 e a norte em z = 78. */
export const PORTAS_DA_ESTACAO: readonly PortaDaEstacao[] = [
  { id: 'frente', nome: 'ENTRADA PRINCIPAL', x: 288, z: 47.5 },
  { id: 'fundos', nome: 'ENTRADA DOS FUNDOS', x: 288, z: 80.5 },
];

export type EstadoDaPorta = 'fechada' | 'forcada' | 'arrombada';
/** Os estados em número, para o HUD e o desenho (0 fechada, 1 forçada, 2 arrombada). */
export const CODIGO_DO_ESTADO_DA_PORTA: Readonly<Record<EstadoDaPorta, number>> = { fechada: 0, forcada: 1, arrombada: 2 };

/** O peso de um rebelde forçando a porta: Mech 1, manifestante 1 (em grupo), andróide 0,4, Colossus 4. */
export function pesoNaPorta(nome: string): number {
  if (nome.startsWith('COLOSSUS')) return 4;
  if (ehAndroide(nome)) return 0.4;
  return 1; // o Mech e o manifestante
}

/** O ponto (x, z) está a menos de `raio` de alguma porta? Devolve a **mais perto** (0 ou 1) ou `-1`; num empate vale a de menor índice. Sem alocar. */
export function portaDoPonto(x: number, z: number, raio: number): number {
  let melhor = -1;
  let melhorD2 = raio * raio;
  for (let i = 0; i < PORTAS_DA_ESTACAO.length; i++) {
    const p = PORTAS_DA_ESTACAO[i]!;
    const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
    if (d2 < melhorD2) {
      melhorD2 = d2;
      melhor = i;
    }
  }
  return melhor;
}

export class PortasDaEstacao {
  readonly quantidade = PORTAS_DA_ESTACAO.length;
  /** A vida de cada porta (0 a `vidaMax`). */
  readonly vida: number[] = PORTAS_DA_ESTACAO.map(() => PORTAS.vidaMax);
  private readonly arrombadas: boolean[] = PORTAS_DA_ESTACAO.map(() => false);

  estado(i: number): EstadoDaPorta {
    if (this.arrombadas[i]) return 'arrombada';
    return this.vida[i]! < PORTAS.vidaMax ? 'forcada' : 'fechada';
  }

  fracaoDaVida(i: number): number {
    return this.vida[i]! / PORTAS.vidaMax;
  }

  /** Quantas portas estão arrombadas. */
  get arrombadasAgora(): number {
    let n = 0;
    for (let i = 0; i < this.quantidade; i++) if (this.arrombadas[i]) n++;
    return n;
  }

  /** O que as portas arrombadas drenam da rede da estação por segundo. */
  get drenoDaRedePorS(): number {
    return this.arrombadasAgora * PORTAS.drenoArrombadaPorS;
  }

  /** Um tick: por porta, o peso de quem a força (`atacantes`) e quantos defensores estão perto (`defensores`). */
  fixedUpdate(dt: number, atacantes: ArrayLike<number>, defensores: ArrayLike<number>): void {
    for (let i = 0; i < this.quantidade; i++) {
      const ataque = atacantes[i] ?? 0;
      const defesa = defensores[i] ?? 0;
      if (ataque > 0) {
        this.vida[i] = Math.max(0, this.vida[i]! - ataque * PORTAS.danoPorPesoPorS * dt);
        if (this.vida[i] <= 0) this.arrombadas[i] = true;
      } else if (defesa > 0 && this.vida[i]! < PORTAS.vidaMax) {
        this.vida[i] = Math.min(PORTAS.vidaMax, this.vida[i]! + Math.min(defesa, PORTAS.maxReparadores) * PORTAS.reparoPorDefensorPorS * dt);
        if (this.arrombadas[i] && this.vida[i]! >= PORTAS.voltaEm * PORTAS.vidaMax) this.arrombadas[i] = false;
      }
    }
  }

  /** Missão nova: as duas portas inteiras e fechadas. */
  reset(): void {
    for (let i = 0; i < this.quantidade; i++) {
      this.vida[i] = PORTAS.vidaMax;
      this.arrombadas[i] = false;
    }
  }
}
