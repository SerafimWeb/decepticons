import { PRAIA_CABOS_X } from '../environment/PraiaLayout';

/**
 * OS CABOS DE DADOS (ordens P162 e P163, **Capítulo 1: CABOS ABERTOS**, `CAMPANHAS_E_CHEFES.md` § 0): a segunda coisa que a missão em ondas da praia
 * **defende**, ao lado da rede da estação (`NucleoDaEstacao.ts`). Os três cabos que vêm do mar passam por **um ponto de conexão cada** (a caixa de emenda
 * no pátio). Quem controla o ponto controla o que corre pelo cabo:
 *
 *  - **Injeção.** O **andróide** rebelde que **se liga** a um ponto "injeta" conteúdo na rede (desinformação, manipulação). A barra de **injeção** do cabo
 *    sobe com cada andróide ligado (até três juntos: um sozinho leva 40 s, três levam ~13 s). Cheia, o cabo está **TOMADO** e **drena a rede da estação**
 *    sem parar. Sem andróide ligado, a injeção recua devagar; com um **defensor** (o jogador ou um aliado) perto, recua três vezes mais rápido. Um cabo
 *    tomado só se **libera** com defensor perto e nenhum andróide ligado ("liberar o acesso e a programação orgânica da rede").
 *  - **Dano e reparo.** O rebelde **pesado** (o Mech, o Colossus) perto do ponto **depreda** o cabo (o mesmo mecanismo de destruição dos coqueiros, só que por
 *    presença). Vida zero = **CORTADO**: também drena a rede. Os defensores perto **consertam** (o andróide aliado conserta em dobro: é o papel dele), desde que
 *    nenhum depredador esteja em cima; o cabo volta a funcionar com 25% de vida.
 *
 * Regra **pura** (G1/G2, G14): só números, sem relógio, sorteio nem tela — roda igual no cliente e no servidor, e o teste de simulação a cobra. O custo é
 * uma conta por cabo por tick; quem chama conta quem está perto (um laço sobre ≤ 8 rebeldes e os defensores) sem alocar.
 */

/** Os números do capítulo (linhas de tabela: o Comandante ajusta jogando; os testes cobram a **estrutura**, não o gosto). */
export const CABOS = {
  /** A vida de cada cabo. */
  vidaMax: 400,
  /** Quanto cada andróide ligado soma à injeção por segundo (1/40: um andróide sozinho leva 40 s). */
  injecaoPorAndroidePorS: 1 / 40,
  /** Quantos andróides ligados contam ao mesmo tempo (o resto só faz companhia). */
  maxLigados: 3,
  /** O quanto a injeção recua por segundo quando ninguém está ligado (1/25: 25 s para zerar sozinha). */
  decaiPorS: 1 / 25,
  /** Com um defensor perto, a injeção recua nesta vez mais rápido. */
  fatorDeDefensor: 3,
  /** Liberar um cabo **tomado**: quanto cada defensor perto (sem andróide ligado) tira da injeção por segundo (1/12: ~12 s para um defensor). */
  liberacaoPorDefensorPorS: 1 / 12,
  /** Dano por segundo por ponto de peso do depredador no cabo (o Mech vale 1: 67 s para cortar um cabo). */
  danoPorPesoPorS: 6,
  /** Conserto por segundo por defensor. */
  reparoPorDefensorPorS: 10,
  /** Quantos defensores contam ao consertar ao mesmo tempo. */
  maxReparadores: 2,
  /** Um cabo cortado volta a funcionar quando chega a esta fração da vida. */
  voltaEm: 0.25,
  /** O que cada cabo **tomado** drena da rede da estação por segundo (três tomados: 30 por segundo, ~33 s até a estação cair sozinha). */
  drenoTomadoPorS: 10,
  /** O que cada cabo **cortado** drena por segundo. */
  drenoCortadoPorS: 8,
  /** A que distância do ponto um andróide conta como ligado (m). */
  raioDaConexao: 4.5,
  /** A que distância do ponto um depredador conta como estando em cima do cabo (m). */
  raioDeDano: 7,
  /** A que distância do ponto um defensor conta como perto (m). */
  raioDeReparo: 6,
} as const;

/** O z dos pontos de conexão: no pátio, entre a escotilha (z 16) e a fachada da estação (z ~50), onde o cabo já é desenho no chão. */
export const Z_DOS_PONTOS = 40;

/** Os pontos de conexão: um por cabo, no x do cabo (`PRAIA_CABOS_X`). */
export const PONTOS_DOS_CABOS: readonly { readonly x: number; readonly z: number }[] = PRAIA_CABOS_X.map((x) => ({ x, z: Z_DOS_PONTOS }));

export type EstadoDoCabo = 'livre' | 'injetando' | 'tomado' | 'cortado';

/** Os estados em número, para o HUD e para o shader (0 livre, 1 injetando, 2 tomado, 3 cortado). */
export const CODIGO_DO_ESTADO: Readonly<Record<EstadoDoCabo, number>> = { livre: 0, injetando: 1, tomado: 2, cortado: 3 };

/** O andróide (o que se liga ao cabo e conserta)? O nome vem do piloto: `ANDR-…`. */
export function ehAndroide(nome: string): boolean {
  return nome.startsWith('ANDR');
}

/** O ponto (x, z) está a menos de `raio` de algum ponto de conexão? Devolve o **mais perto** (0 a 2) ou `-1`; num empate exato vale o de menor índice. Sem alocar. */
export function caboDoPonto(x: number, z: number, raio: number): number {
  let melhor = -1;
  let melhorD2 = raio * raio;
  for (let i = 0; i < PONTOS_DOS_CABOS.length; i++) {
    const p = PONTOS_DOS_CABOS[i]!;
    const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
    if (d2 < melhorD2) {
      melhorD2 = d2;
      melhor = i;
    }
  }
  return melhor;
}

export class CabosDeDados {
  readonly quantidade = PONTOS_DOS_CABOS.length;
  /** A vida de cada cabo (0 a `vidaMax`). */
  readonly vida: number[] = PONTOS_DOS_CABOS.map(() => CABOS.vidaMax);
  /** A injeção de cada cabo (0 a 1). */
  readonly injecao: number[] = PONTOS_DOS_CABOS.map(() => 0);
  private readonly tomados: boolean[] = PONTOS_DOS_CABOS.map(() => false);
  private readonly cortados: boolean[] = PONTOS_DOS_CABOS.map(() => false);

  /** O estado do cabo `i`: cortado manda sobre tomado, que manda sobre injetando. */
  estado(i: number): EstadoDoCabo {
    if (this.cortados[i]) return 'cortado';
    if (this.tomados[i]) return 'tomado';
    return this.injecao[i]! > 0 ? 'injetando' : 'livre';
  }

  /** A vida do cabo `i` de 0 a 1. */
  fracaoDaVida(i: number): number {
    return this.vida[i]! / CABOS.vidaMax;
  }

  /** Quantos cabos estão tomados ou cortados (o que a missão perde). */
  get perdidos(): number {
    let n = 0;
    for (let i = 0; i < this.quantidade; i++) if (this.tomados[i] || this.cortados[i]) n++;
    return n;
  }

  /** O que os cabos drenam da rede da estação por segundo: cada cabo tomado e cada cabo cortado. */
  get drenoDaRedePorS(): number {
    let d = 0;
    for (let i = 0; i < this.quantidade; i++) {
      if (this.tomados[i]) d += CABOS.drenoTomadoPorS;
      if (this.cortados[i]) d += CABOS.drenoCortadoPorS;
    }
    return d;
  }

  /**
   * Um tick. Por cabo: `ligados` (andróides rebeldes ligados ao ponto), `depredadores` (a soma do peso dos rebeldes pesados em cima dele) e `defensores` (quem
   * está perto para consertar e liberar: o jogador e os aliados; o andróide aliado conta dois).
   */
  fixedUpdate(dt: number, ligados: ArrayLike<number>, depredadores: ArrayLike<number>, defensores: ArrayLike<number>): void {
    for (let i = 0; i < this.quantidade; i++) {
      const ligadosI = ligados[i] ?? 0;
      const depredadorI = depredadores[i] ?? 0;
      const defensorI = defensores[i] ?? 0;

      // O dano e o conserto da vida do cabo.
      if (depredadorI > 0) {
        this.vida[i] = Math.max(0, this.vida[i]! - depredadorI * CABOS.danoPorPesoPorS * dt);
        if (this.vida[i] <= 0) this.cortados[i] = true;
      } else if (defensorI > 0 && this.vida[i]! < CABOS.vidaMax) {
        this.vida[i] = Math.min(CABOS.vidaMax, this.vida[i]! + Math.min(defensorI, CABOS.maxReparadores) * CABOS.reparoPorDefensorPorS * dt);
        if (this.cortados[i] && this.vida[i]! >= CABOS.voltaEm * CABOS.vidaMax) this.cortados[i] = false;
      }

      // A injeção. Um cabo cortado não carrega dado: ninguém injeta por ele, e o que tinha recua.
      const injeta = ligadosI > 0 && !this.cortados[i];
      if (injeta) {
        if (!this.tomados[i]) {
          this.injecao[i] = Math.min(1, this.injecao[i]! + Math.min(ligadosI, CABOS.maxLigados) * CABOS.injecaoPorAndroidePorS * dt);
          if (this.injecao[i]! >= 1) this.tomados[i] = true;
        }
      } else if (this.tomados[i]) {
        // Tomado: só se libera com defensor perto (e sem andróide ligado, que é o caso aqui).
        if (defensorI > 0) {
          this.injecao[i] = Math.max(0, this.injecao[i]! - Math.min(defensorI, CABOS.maxReparadores) * CABOS.liberacaoPorDefensorPorS * dt);
          if (this.injecao[i]! <= 0) this.tomados[i] = false;
        }
      } else if (this.injecao[i]! > 0) {
        const taxa = CABOS.decaiPorS * (defensorI > 0 ? CABOS.fatorDeDefensor : 1);
        this.injecao[i] = Math.max(0, this.injecao[i]! - taxa * dt);
      }
    }
  }

  /** Missão nova: os três cabos inteiros e livres. */
  reset(): void {
    for (let i = 0; i < this.quantidade; i++) {
      this.vida[i] = CABOS.vidaMax;
      this.injecao[i] = 0;
      this.tomados[i] = false;
      this.cortados[i] = false;
    }
  }
}
