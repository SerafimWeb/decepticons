/**
 * A INVASÃO DO DRAGA-01 (ordem P180, parte E; `AMAZONIA.md` § 6, ato 3): *"invadir com andróides e destruir por dentro"*. Com o **escudo caído**, a **escotilha do casco** se abre (um ponto no flanco
 * do Draga, entre as pernas) e os **andróides da Resistência** vão até ela e **plantam a carga** no núcleo: a barra sobe com cada andróide junto da escotilha, como a injeção dos cabos
 * (`CabosDeDados.ts`), ao contrário (aqui o andróide está do **seu** lado). Cheia, a carga **detona**: o Draga cai por dentro, e a missão acaba em vitória (a mesma regra de sempre, `MissaoDoRio`).
 * É o **primeiro uso do andróide como ponta de lança** (P149: "lugares só de andróide e drone"). O outro caminho segue aberto: derrubar o tronco a tiro. O jogador escolhe (ou mistura).
 *
 * Regra **pura** (G1/G2, G14): só números, sem relógio, sorteio nem tela; roda igual no cliente e no servidor. Quem a alimenta (`Match`) diz se o escudo caiu e quantos andróides estão junto da
 * escotilha. **Custo:** uma soma por tick; o `Match` conta os andróides (≤ 3) e dá a ordem de ir à escotilha a cada segundo. Nada aloca.
 */

/** Os números da invasão (linhas de tabela: o Comandante ajusta jogando; os testes cobram a **estrutura**, não o gosto). */
export const INVASAO = {
  /** Quantos andróides a Resistência tem (o teste confere com os pontos de nascimento). */
  androides: 3,
  /** A distância do eixo do Draga ao ponto da escotilha, no flanco direito do casco (m): o raio do corpo (10 m) mais a folga para o andróide chegar. */
  ladoDaEscotilhaM: 13,
  /** A que distância da escotilha um andróide conta como junto dela (m): o Draga anda 2,6 m/s e o andróide a segue de trás, então a folga é larga (junto do casco, perto da escotilha). */
  raioDaEscotilhaM: 8,
  /** Quanto cada andróide junto da escotilha soma à carga por segundo (1/30: um sozinho leva 30 s; os três juntos, ~10 s). */
  cargaPorAndroidePorS: 1 / 30,
  /** Quantos andróides contam ao mesmo tempo (o resto só faz companhia). */
  maxPlantando: 3,
  /** O quanto a carga recua por segundo quando ninguém está junto (1/45: a tripulação a desarma devagar; 45 s para zerar sozinha). */
  decaiPorS: 1 / 45,
} as const;

/** O ponto (x, z) da escotilha, no flanco direito do casco (`yaw` é o do Mech: com ele olhando para -X, o flanco direito é o do lado sul). Escreve em `out` (sem alocar) e o devolve. */
export function escotilhaDoDraga(x: number, z: number, yaw: number, out: { x: number; z: number }): { x: number; z: number } {
  // O lado direito de quem olha para onde o Mech olha: (cos yaw, -sin yaw) (a frente é (-sin yaw, -cos yaw), como no `MechBase`).
  out.x = x + Math.cos(yaw) * INVASAO.ladoDaEscotilhaM;
  out.z = z - Math.sin(yaw) * INVASAO.ladoDaEscotilhaM;
  return out;
}

export class InvasaoDoDraga {
  /** A carga plantada (0 a 1). */
  carga = 0;
  /** A escotilha está aberta (o escudo caiu e o Draga segue de pé)? */
  aberta = false;
  /** Quantos andróides estão junto da escotilha agora (o que a barra conta; já limitado a `maxPlantando`). */
  plantando = 0;
  /** A carga detonou (uma vez; só o `reiniciar` a limpa). */
  detonou = false;
  private _abriuNoTick = false;
  private _detonouNoTick = false;

  /** A escotilha acabou de abrir neste tick: o aviso e a ordem aos andróides leem isto uma vez e limpam com `consumirAbertura`. */
  get abriuNoTick(): boolean {
    return this._abriuNoTick;
  }

  consumirAbertura(): boolean {
    const f = this._abriuNoTick;
    this._abriuNoTick = false;
    return f;
  }

  /** A carga detonou neste tick: a partida derruba o Draga e limpa com `consumirDetonacao`. */
  consumirDetonacao(): boolean {
    const f = this._detonouNoTick;
    this._detonouNoTick = false;
    return f;
  }

  /**
   * Um tick. `escudoCaiu`: nenhum gerador de pé. `draga`: o Draga segue de pé. `juntos`: quantos andróides da Resistência estão a `raioDaEscotilhaM` da escotilha. A escotilha **abre** quando o
   * escudo cai e **não fecha** (o escudo não volta); com o Draga caído, nada anda.
   */
  fixedUpdate(dt: number, escudoCaiu: boolean, draga: boolean, juntos: number): void {
    if (this.detonou || !draga) {
      this.plantando = 0;
      return;
    }
    if (!this.aberta && escudoCaiu) {
      this.aberta = true;
      this._abriuNoTick = true;
    }
    if (!this.aberta) {
      this.plantando = 0;
      return;
    }
    this.plantando = Math.max(0, Math.min(INVASAO.maxPlantando, Math.floor(juntos)));
    const ritmo = this.plantando > 0 ? this.plantando * INVASAO.cargaPorAndroidePorS : -INVASAO.decaiPorS;
    this.carga = Math.max(0, Math.min(1, this.carga + ritmo * dt));
    if (this.carga >= 1) {
      this.detonou = true;
      this._detonouNoTick = true;
    }
  }

  /** Rodada nova: a escotilha fecha e a carga some. */
  reiniciar(): void {
    this.carga = 0;
    this.aberta = false;
    this.plantando = 0;
    this.detonou = false;
    this._abriuNoTick = false;
    this._detonouNoTick = false;
  }
}

/** O aviso da tela quando a escotilha abre (`antes` e `depois`: aberta?). Sem mudança para aberta, `null`. */
export function avisoDaEscotilha(antes: boolean, depois: boolean): string | null {
  return !antes && depois ? 'ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM' : null;
}
