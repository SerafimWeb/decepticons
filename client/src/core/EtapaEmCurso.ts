import type { MapId } from '../environment/Bunker';
import { campanhaDoLink, FATOS_ZERADOS, objetivoDaEtapa, proximaEtapa, resultadoDaEtapa, tituloDaEtapa, type CampanhaSpec, type EtapaDaCampanha, type FatosDaEtapa, type ResultadoDaEtapa } from '../sim/campanha';
import type { GameMode } from '../sim/gameMode';

/**
 * A etapa da campanha que está sendo jogada (fase 4B): guarda o que o jogo viu (`FatosDaEtapa`) e deixa a conta com `resultadoDaEtapa`, que mora no contrato.
 * Não conhece Three.js nem DOM: o `Game` só avisa (um abate, o fim da Sobrevivência, o fim da Bandeira) e pergunta o resultado. Custo: um inteiro somado por abate.
 *
 * **Uma vez decidida, a etapa não muda mais**: avisos que chegam depois (o último inimigo cai e a onda acaba no mesmo tick) não desfazem a vitória nem a derrota.
 */
export class EtapaEmCurso {
  readonly etapa: EtapaDaCampanha;
  private fatos: { abates: number; sobrevivencia: FatosDaEtapa['sobrevivencia']; ctf: FatosDaEtapa['ctf'] } = { ...FATOS_ZERADOS };

  /** `n` conta de 1 (como o `?etapa=`). */
  constructor(
    readonly campanha: CampanhaSpec,
    readonly n: number,
  ) {
    const etapa = campanha.etapas[n - 1];
    if (!etapa) throw new Error(`a campanha não tem a etapa ${n}`);
    this.etapa = etapa;
  }

  /**
   * A etapa do link, **se** ela é a partida que está aberta: o link carrega o modo e o mapa da etapa, mas quem troca o modo depois pelo seletor do menu mantém o
   * `?campanha=`, e contar abates de um Deathmatch como se fosse a Sobrevivência da etapa seria mentir ao jogador. Online, nunca (o servidor manda os inimigos).
   */
  static doLink(search: string, mapa: MapId, modo: GameMode, online: boolean): EtapaEmCurso | null {
    if (online) return null;
    const l = campanhaDoLink(search);
    if (!l) return null;
    const e = l.campanha.etapas[l.etapa - 1]!;
    return e.mapa === mapa && e.modo === modo ? new EtapaEmCurso(l.campanha, l.etapa) : null;
  }

  get total(): number {
    return this.campanha.etapas.length;
  }
  get titulo(): string {
    return tituloDaEtapa(this.etapa);
  }
  get objetivo(): string {
    return objetivoDaEtapa(this.etapa);
  }
  /** A meta de abates (só o Deathmatch tem), ou `null`. */
  get meta(): number | null {
    return this.etapa.modo === 'deathmatch' ? (this.etapa.abates ?? null) : null;
  }
  get abates(): number {
    return this.fatos.abates;
  }
  get resultado(): ResultadoDaEtapa {
    return resultadoDaEtapa(this.etapa, this.fatos);
  }
  /** A etapa seguinte (de 1), ou `null` se esta é a última. */
  get proxima(): number | null {
    return proximaEtapa(this.campanha, this.n);
  }

  /** O jogador abateu um robô. Devolve o resultado depois dele. */
  abate(): ResultadoDaEtapa {
    if (this.resultado === 'em-curso') this.fatos.abates++;
    return this.resultado;
  }

  /** A Sobrevivência acabou (`survived`: o jogador limpou as ondas). */
  fimDaSobrevivencia(survived: boolean): ResultadoDaEtapa {
    if (this.resultado === 'em-curso') this.fatos.sobrevivencia = survived ? 'completed' : 'failed';
    return this.resultado;
  }

  /** A partida de bandeira acabou. O jogador é sempre o time azul (`Match.addPlayer`); `null` = empate. */
  fimDaBandeira(vencedor: 'blue' | 'red' | null): ResultadoDaEtapa {
    if (this.resultado === 'em-curso') this.fatos.ctf = vencedor === 'blue' ? 'vitoria' : vencedor === 'red' ? 'derrota' : 'empate';
    return this.resultado;
  }
}
