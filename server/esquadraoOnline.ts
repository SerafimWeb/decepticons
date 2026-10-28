import { join } from 'node:path';
import { esquadraoParaOnline, pareceEsquadrao } from '../client/src/sim/esquadraoOnline';
import type { EsquadraoSpec } from '../client/src/sim/esquadrao';
import { gravarJson, lerJson } from './metricas';

export const ESQUADRAO_ONLINE_ARQUIVO = 'esquadrao-online.json';

/**
 * Onde o servidor guarda o esquadrão das salas online (P270, `client/src/sim/esquadraoOnline.ts`): em memória e no arquivo `esquadrao-online.json` da pasta de dados (sobrevive ao reinício).
 * Sem arquivo, ou com o arquivo ruim, não há esquadrão salvo e valem as regras. Quem grava é o dono (`POST /admin/esquadrao/gravar`); a sala de pé não muda (os corpos nascem com a partida):
 * o esquadrão vale para as salas que abrirem depois. Sem pasta de dados (os testes), vale só a memória.
 */
export class ArmazemDoEsquadraoOnline {
  private esquadrao: EsquadraoSpec | null;
  private readonly arquivo: string | null;

  constructor(dirDados: string | null) {
    this.arquivo = dirDados ? join(dirDados, ESQUADRAO_ONLINE_ARQUIVO) : null;
    const lido = this.arquivo ? lerJson(this.arquivo) : null;
    this.esquadrao = pareceEsquadrao(lido) ? esquadraoParaOnline(lido) : null;
  }

  /** O esquadrão salvo, ou `null` (valem as regras). */
  atual(): EsquadraoSpec | null {
    return this.esquadrao;
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
    if (this.arquivo) gravarJson(this.arquivo, this.esquadrao);
    return true;
  }
}
