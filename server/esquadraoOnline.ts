import { join } from 'node:path';
import type { MapaOnline } from '../shared/net/mapa';
import { chaveDoEsquadraoOnline, esquadraoParaOnline, pareceEsquadrao } from '../client/src/sim/esquadraoOnline';
import type { EsquadraoSpec } from '../client/src/sim/esquadrao';
import { gravarJson, lerJson } from './metricas';

export const ESQUADRAO_ONLINE_ARQUIVO = 'esquadrao-online.json';

/**
 * Onde o servidor guarda o esquadrão das salas online (P270, `client/src/sim/esquadraoOnline.ts`): em memória e no arquivo `esquadrao-online.json` da pasta de dados (sobrevive ao reinício).
 * Sem arquivo, ou com o arquivo ruim, não há esquadrão salvo e valem as regras. Quem grava é o dono (`POST /admin/esquadrao/gravar`); a sala de pé não muda (os corpos nascem com a partida):
 * o esquadrão vale para as salas que abrirem depois, e a sala de outro esquadrão fecha assim que esvazia (`chavePara`). Sem pasta de dados (os testes), vale só a memória.
 */
export class ArmazemDoEsquadraoOnline {
  private esquadrao: EsquadraoSpec | null;
  private readonly arquivo: string | null;
  /** A chave do esquadrão salvo para cada mapa, calculada uma vez por gravação (o laço do servidor a consulta a cada tick de sala vazia). */
  private readonly chaves = new Map<MapaOnline, string>();

  constructor(dirDados: string | null) {
    this.arquivo = dirDados ? join(dirDados, ESQUADRAO_ONLINE_ARQUIVO) : null;
    const lido = this.arquivo ? lerJson(this.arquivo) : null;
    this.esquadrao = pareceEsquadrao(lido) ? esquadraoParaOnline(lido) : null;
  }

  /** O esquadrão salvo, ou `null` (valem as regras). */
  atual(): EsquadraoSpec | null {
    return this.esquadrao;
  }

  /** A chave do esquadrão com que uma sala nova de `mapa` nasceria agora (`''` = valem as regras): a sala vazia de outra chave está desatualizada e fecha na hora. */
  chavePara(mapa: MapaOnline): string {
    let chave = this.chaves.get(mapa);
    if (chave === undefined) {
      chave = chaveDoEsquadraoOnline(this.esquadrao, mapa);
      this.chaves.set(mapa, chave);
    }
    return chave;
  }

  /**
   * Troca o esquadrão salvo: um esquadrão (limpo para o online) ou `null` para voltar às regras. Devolve `false` se o corpo não é nem um nem outro: nada muda.
   * Um esquadrão sem nenhum inimigo é válido (a sala só com gente).
   */
  gravar(corpo: unknown): boolean {
    const c = corpo as { esquadrao?: unknown } | null;
    if (typeof corpo !== 'object' || corpo === null || !('esquadrao' in c!)) return false;
    if (c!.esquadrao !== null && !pareceEsquadrao(c!.esquadrao)) return false;
    this.esquadrao = c!.esquadrao === null ? null : esquadraoParaOnline(c!.esquadrao);
    this.chaves.clear();
    if (this.arquivo) gravarJson(this.arquivo, this.esquadrao);
    return true;
  }
}
