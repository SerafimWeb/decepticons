/**
 * AS TORRES DE VIGIA ARMADAS DA MARGEM (ordem P180, parte D2; `AMAZONIA.md` § 6, ato 1): as oito torres da margem fortificada passam a **atirar** em quem estiver ao alcance, atravessando o rio.
 * *"há uma enorme força de defesa deles"*: o jogador que atravessa o leito para chegar aos geradores leva fogo de cobertura. **Quem as alimenta é o gerador da CERCA**: derrubá-lo as deixa sem
 * energia ("derrubar o gerador da cerca abre a passagem", `fichas/cenario-amazonas.md`).
 *
 * Regra **pura** (G1/G2, G14): só números, sem relógio nem sorteio (o erro de mira sai de um gerador de números com semente). Uma torre espera, escolhe o alvo mais perto **à vista**, e solta uma
 * **rajada** de poucos tiros com um erro de mira deterministicamente espalhado; quem a roda (`Match`) responde `ve` (tem linha de visão?) e `atira` (solta o tiro). **Custo:** por tick, uma
 * distância por torre e por jogador; a linha de visão (um raio na física) só quando a torre está pronta para atirar (uma vez a cada ~2,4 s por torre). Nada aloca.
 */

export const TORRES_DE_VIGIA = {
  /** Até onde uma torre atira (m, na horizontal). */
  alcanceM: 170,
  /** Espera entre o fim de uma rajada e o começo da próxima (s). */
  esperaS: 2.4,
  /** Tiros por rajada e o intervalo entre eles (s). */
  tirosPorRajada: 4,
  entreTirosS: 0.16,
  /** O erro máximo de mira de cada tiro (rad por eixo: ~2°): a 150 m passa a 5 m do alvo de vez em quando. */
  erroMaximoRad: 0.035,
} as const;

/** O que uma torre precisa saber de um alvo (um Mech de jogador: o `Match` passa `players`). */
export interface AlvoDaTorre {
  readonly simPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly alive: boolean;
}

export interface PontoDaTorre {
  /** A boca da arma (x, y, z em metros). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class TorresDeVigia {
  /** As torres têm energia? (O `Match` liga isto ao gerador da CERCA.) Sem energia, ninguém atira e o que estava em curso para. */
  ativa = true;
  private readonly espera: number[];
  private readonly restam: number[];
  private readonly entre: number[];
  private readonly alvo: number[];
  private estado: number;
  /** Quantos tiros saíram desde o começo (testes e telemetria). */
  tiros = 0;

  constructor(
    readonly pontos: readonly PontoDaTorre[],
    seed = 1,
  ) {
    // Cada torre começa com uma espera diferente (as oito não disparam juntas): o intervalo, repartido pelo número delas.
    this.espera = pontos.map((_, i) => 0.6 + (TORRES_DE_VIGIA.esperaS * i) / Math.max(1, pontos.length));
    this.restam = pontos.map(() => 0);
    this.entre = pontos.map(() => 0);
    this.alvo = pontos.map(() => -1);
    this.estado = (seed * 2654435761) >>> 0 || 1;
  }

  /** O próximo número do gerador (0 a 1, com semente): o erro de mira de cada tiro. */
  private proximo(): number {
    this.estado = (Math.imul(this.estado, 1664525) + 1013904223) >>> 0;
    return this.estado / 4294967296;
  }

  /** Só desligar o poder: a rajada em curso acaba aqui (a torre sem energia não termina o que começou). */
  private parar(i: number): void {
    this.restam[i] = 0;
    this.alvo[i] = -1;
  }

  /**
   * Um tick. `ve(torre, alvo)`: há linha de visão da boca da torre ao alvo? (chamado só quando ela vai começar uma rajada.) `atira(torre, alvo, erroX, erroY)`: solte o tiro; os erros são
   * o desvio da mira em rad (já espalhado). O alvo some da rajada se morrer no meio (`alive`); a torre então espera.
   */
  fixedUpdate(
    dt: number,
    alvos: readonly AlvoDaTorre[],
    ve: (torre: number, alvo: number) => boolean,
    atira: (torre: number, alvo: number, erroX: number, erroY: number) => void,
  ): void {
    const n = this.pontos.length;
    for (let i = 0; i < n; i++) {
      if (!this.ativa) {
        this.parar(i);
        continue;
      }
      const p = this.pontos[i]!;
      // Rajada em curso: o próximo tiro quando o intervalo acabar; se o alvo morreu, a rajada para.
      if (this.restam[i]! > 0) {
        const a = alvos[this.alvo[i]!];
        if (!a || !a.alive) {
          this.parar(i);
          this.espera[i] = TORRES_DE_VIGIA.esperaS;
          continue;
        }
        this.entre[i]! -= dt;
        if (this.entre[i]! <= 0) {
          atira(i, this.alvo[i]!, (this.proximo() * 2 - 1) * TORRES_DE_VIGIA.erroMaximoRad, (this.proximo() * 2 - 1) * TORRES_DE_VIGIA.erroMaximoRad);
          this.tiros++;
          this.restam[i]!--;
          this.entre[i] = TORRES_DE_VIGIA.entreTirosS;
          if (this.restam[i] === 0) this.espera[i] = TORRES_DE_VIGIA.esperaS;
        }
        continue;
      }
      this.espera[i]! -= dt;
      if (this.espera[i]! > 0) continue;
      // Pronta: o alvo vivo mais perto, ao alcance e à vista.
      let melhor = -1;
      let menor = TORRES_DE_VIGIA.alcanceM * TORRES_DE_VIGIA.alcanceM;
      for (let j = 0; j < alvos.length; j++) {
        const a = alvos[j]!;
        if (!a.alive) continue;
        const dx = a.simPosition.x - p.x;
        const dz = a.simPosition.z - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < menor && ve(i, j)) {
          menor = d2;
          melhor = j;
        }
      }
      if (melhor < 0) {
        this.espera[i] = 0.4; // ninguém à vista: olha de novo daqui a pouco (a linha de visão custa um raio)
        continue;
      }
      this.alvo[i] = melhor;
      this.restam[i] = TORRES_DE_VIGIA.tirosPorRajada;
      this.entre[i] = 0;
    }
  }
}
