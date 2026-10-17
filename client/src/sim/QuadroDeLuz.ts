import { PRAIA_QUADRO_DE_LUZ } from '../environment/PraiaLayout';

/**
 * O QUADRO DE LUZ DA CIDADE (ordem P164, **Capítulo 1, frente 3**: o porto, `CAMPANHAS_E_CHEFES.md` § 0): *"no porto, tem que ter um botão ou chave ou sistema que devemos
 * proteger, para acender as luzes da cidade; um tipo de circuito que podemos repetir nas diferentes fases (interatividade do cenário com o jogo)"*. É o armário de força que alimenta
 * a iluminação pública da orla, na ponta oeste do cais, **a mais de 500 m da estação**: defender a estação e defender o quadro são duas frentes que o jogador não cobre juntas.
 *
 *  - **Sabotar.** A partir da onda 2, **um andróide rebelde** (o saboteiro) vai ao quadro. Todo rebelde a menos de 7 m o depreda, com o peso de \`pesoDoInvasor\`; o quadro aguenta 240 de vida
 *    (um andróide sozinho leva 80 s, e a viagem do jogador da estação até lá, uns 40).
 *  - **A cidade apaga.** A energia da cidade é a vida do quadro (de 0 a 1): **as luzes da cidade caem junto** (a luz acesa de noite vem do ciclo do dia, \`CicloDoDia.ts\`; a energia a multiplica).
 *    Com o quadro **apagado** (vida zero) a cidade fica no escuro e **as zonas de cura e de resfriamento deixam de funcionar**: defender o quadro vale a vida do jogador.
 *  - **Recuperar.** O jogador e os aliados perto, **sem rebelde em cima**, consertam (8 por segundo, até dois: o andróide aliado vale dois). O quadro volta a ligar com 25% da vida.
 *    Um quadro sabotado **não se recompõe sozinho**.
 *
 * Regra **pura** (G1/G2, G14): só números, sem relógio nem sorteio; roda igual no cliente e no servidor. Quem chama (\`Match\`) conta quem está perto, sem alocar. O circuito é **repetível**:
 * a mesma regra com outra peça serve ao quadro do banco, ao transformador do datacenter e a qualquer fase que pedir "uma coisa para proteger que muda o cenário". **Cada instância tem o seu
 * lugar e a sua vida** (\`new QuadroDeLuz(ponto, vidaMax)\`): o do porto da praia é o padrão; o **transformador do Banco Vorcaris** da Cidade Neon (P164, parte E) é o segundo.
 */

export const QUADRO = {
  vidaMax: 240,
  /** Dano por segundo por ponto de peso do invasor no quadro. */
  danoPorPesoPorS: 6,
  reparoPorDefensorPorS: 8,
  maxReparadores: 2,
  /** O quadro apagado volta a ligar quando chega a esta fração da vida. */
  voltaEm: 0.25,
  /** A que distância do quadro um rebelde conta como depredando (m). */
  raioDeAtaque: 7,
  /** A que distância um defensor conta como perto (m). */
  raioDeReparo: 6,
} as const;

export type EstadoDoQuadro = 'ligado' | 'sabotado' | 'apagado';
/** Os estados em número, para o HUD e o desenho (0 ligado, 1 sabotado, 2 apagado). */
export const CODIGO_DO_ESTADO_DO_QUADRO: Readonly<Record<EstadoDoQuadro, number>> = { ligado: 0, sabotado: 1, apagado: 2 };

/** Onde o quadro fica no mapa (x, z em metros). */
export interface PontoDoQuadro {
  readonly x: number;
  readonly z: number;
}

/** O ponto (x, z) está a menos de `raio` do quadro em `ponto` (o do porto da praia, se não vier outro)? */
export function pertoDoQuadro(x: number, z: number, raio: number, ponto: PontoDoQuadro = PRAIA_QUADRO_DE_LUZ): boolean {
  const dx = x - ponto.x;
  const dz = z - ponto.z;
  return dx * dx + dz * dz < raio * raio;
}

export class QuadroDeLuz {
  vida: number;
  private apagadoAgora = false;

  /** O lugar do quadro e a vida dele: o do porto da praia (240) é o padrão. */
  constructor(
    readonly ponto: PontoDoQuadro = PRAIA_QUADRO_DE_LUZ,
    readonly vidaMax: number = QUADRO.vidaMax,
  ) {
    this.vida = vidaMax;
  }

  /** O ponto (x, z) está a menos de `raio` deste quadro? */
  perto(x: number, z: number, raio: number): boolean {
    return pertoDoQuadro(x, z, raio, this.ponto);
  }

  /** O quadro está apagado (vida zerada e ainda não recuperado até `voltaEm`)? */
  get apagado(): boolean {
    return this.apagadoAgora;
  }

  estado(): EstadoDoQuadro {
    if (this.apagadoAgora) return 'apagado';
    return this.vida < this.vidaMax ? 'sabotado' : 'ligado';
  }

  /** A vida de 0 a 1. */
  get fracaoDaVida(): number {
    return this.vida / this.vidaMax;
  }

  /** A energia da cidade (0 a 1): a vida do quadro; **zero** enquanto ele está apagado. As luzes da cidade e as zonas leem daqui. */
  get energia(): number {
    return this.apagadoAgora ? 0 : this.vida / this.vidaMax;
  }

  /** Um tick: o peso de quem depreda o quadro (`atacantes`) e quantos defensores estão perto (`defensores`). */
  fixedUpdate(dt: number, atacantes: number, defensores: number): void {
    if (atacantes > 0) {
      this.vida = Math.max(0, this.vida - atacantes * QUADRO.danoPorPesoPorS * dt);
      if (this.vida <= 0) this.apagadoAgora = true;
    } else if (defensores > 0 && this.vida < this.vidaMax) {
      this.vida = Math.min(this.vidaMax, this.vida + Math.min(defensores, QUADRO.maxReparadores) * QUADRO.reparoPorDefensorPorS * dt);
      if (this.apagadoAgora && this.vida >= QUADRO.voltaEm * this.vidaMax) this.apagadoAgora = false;
    }
  }

  /** Missão nova: inteiro e ligado. */
  reset(): void {
    this.vida = this.vidaMax;
    this.apagadoAgora = false;
  }
}
