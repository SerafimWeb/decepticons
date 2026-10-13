import { campanhaDoLink } from '../sim/campanha';
import { ESQUADRAO_VERSAO, esquadraoDoLink, type EsquadraoSpec, chaveDoEsquadrao, esquadraoPadrao, PARAM_DO_ESQUADRAO, sanearEsquadrao } from '../sim/esquadrao';

/** Onde o esquadrão do Comandante fica salvo no aparelho. */
export const ESQUADRAO_STORAGE_KEY = 'cybermech.esquadrao.v1';
/** `?esquadrao=padrao` apaga o esquadrão salvo e volta ao das configurações. */
export const ESQUADRAO_PADRAO_NO_LINK = 'padrao';

/**
 * O esquadrão desta partida (P91): o salvo no aparelho, ou o de um link `?esquadrao=` (que passa a ser o salvo). Sem nenhum dos dois, `current` é
 * `null` e a partida sai das configurações de sempre (`Match` monta `esquadraoDeFoes`). Mudar vale ao reiniciar a partida: os robôs são
 * montados uma vez só (G4/G5). Mesmo desenho do `PowerStore`: o armazenamento é injetado, e um aparelho sem ele joga só com o link.
 */
export class EsquadraoStore {
  /** O esquadrão personalizado desta partida, ou `null` (nenhum: valem as configurações). */
  readonly current: EsquadraoSpec | null;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
    search = '',
  ) {
    const param = new URLSearchParams(search).get(PARAM_DO_ESQUADRAO);
    if (param === ESQUADRAO_PADRAO_NO_LINK) {
      this.current = null;
      this.save(null);
      return;
    }
    const doLink = esquadraoDoLink(search);
    this.current = doLink ?? this.read();
    // Numa etapa de campanha (`?campanha=…&etapa=N`) o esquadrão do link vale só para esta partida: guardá-lo trocaria, sem aviso, o esquadrão que o Comandante montou.
    if (doLink && campanhaDoLink(search) === null) this.save(doLink);
  }

  /** Há um esquadrão personalizado? (Conta como ajuda na telemetria: dá para deixar a partida mais fácil.) */
  get custom(): boolean {
    return this.current !== null;
  }

  /** O texto do link para levar este esquadrão a outro aparelho (o esquadrão de fábrica, se não há nenhum salvo). */
  key(spec: EsquadraoSpec = this.current ?? esquadraoPadrao()): string {
    return chaveDoEsquadrao(spec);
  }

  /** Salva para a próxima partida; `null` apaga (volta às configurações). */
  save(spec: EsquadraoSpec | null): void {
    try {
      if (spec === null) this.storage?.removeItem(ESQUADRAO_STORAGE_KEY);
      else this.storage?.setItem(ESQUADRAO_STORAGE_KEY, JSON.stringify(sanearEsquadrao(spec)));
    } catch {
      // Sem armazenamento (aba anônima bloqueada): vale só o link.
    }
  }

  private read(): EsquadraoSpec | null {
    try {
      const raw = this.storage?.getItem(ESQUADRAO_STORAGE_KEY);
      if (!raw) return null;
      const json: unknown = JSON.parse(raw);
      // Salvo adulterado, ou de outra versão do formato, é como não ter nada: sanearEsquadrao devolveria o padrão, e aqui "padrão" é "nenhum".
      return typeof json === 'object' && json !== null && (json as { v?: unknown }).v === ESQUADRAO_VERSAO ? sanearEsquadrao(json) : null;
    } catch {
      return null;
    }
  }
}
