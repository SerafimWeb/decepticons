import { join } from 'node:path';
import { normalizarRegras, REGRAS_PADRAO, type RegrasOnline } from '../shared/regras';
import { gravarJson, lerJson } from './metricas';

export const REGRAS_ARQUIVO = 'regras-online.json';

/**
 * Onde o servidor guarda as regras dos bots das salas online (P199): em memória e no arquivo `regras-online.json` da pasta de dados (sobrevive ao reinício). Sem arquivo valem os padrões de iniciante
 * (`REGRAS_PADRAO`). Quem grava é o dono (`POST /admin/regras/gravar`); ao gravar, o servidor avisa as salas de pé (`aoMudar`).
 */
export class ArmazemDeRegras {
  private regras: RegrasOnline;
  private readonly arquivo: string | null;
  private readonly ouvintes = new Set<(r: RegrasOnline) => void>();

  constructor(dirDados: string | null, inicial: RegrasOnline = REGRAS_PADRAO) {
    this.arquivo = dirDados ? join(dirDados, REGRAS_ARQUIVO) : null;
    const lido = this.arquivo ? lerJson(this.arquivo) : null;
    this.regras = lido ? normalizarRegras(lido) : { ...inicial };
  }

  atual(): RegrasOnline {
    return this.regras;
  }

  /** Troca as regras (o que vier fora dos limites é puxado para eles), grava no arquivo e avisa as salas. */
  gravar(x: unknown): RegrasOnline {
    this.regras = normalizarRegras(x);
    if (this.arquivo) gravarJson(this.arquivo, this.regras);
    for (const fn of this.ouvintes) fn(this.regras);
    return this.regras;
  }

  aoMudar(fn: (r: RegrasOnline) => void): void {
    this.ouvintes.add(fn);
  }
}
