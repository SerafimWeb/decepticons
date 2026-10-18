import { join } from 'node:path';
import { configVazia, lerConfig, normalizarItens, type ConfigDeVisibilidade, type EstadoDeVisibilidade } from '../shared/visibilidade';
import { gravarJson, lerJson } from './metricas';

export const VISIBILIDADE_ARQUIVO = 'visibilidade.json';

/**
 * Onde o servidor guarda o que o dono liberou ou restringiu (P191): uma configuração só, em memória e no arquivo `visibilidade.json` da pasta de dados (sobrevive ao reinício). Sem pasta de dados
 * (os testes), vale só a memória. Quem grava é o dono (`POST /admin/visibilidade`); quem lê é todo cliente (`GET /visibilidade`).
 */
export class ArmazemDeVisibilidade {
  private config: ConfigDeVisibilidade;
  private readonly arquivo: string | null;

  constructor(dirDados: string | null) {
    this.arquivo = dirDados ? join(dirDados, VISIBILIDADE_ARQUIVO) : null;
    this.config = this.arquivo ? lerConfig(lerJson(this.arquivo)) : configVazia();
  }

  atual(): ConfigDeVisibilidade {
    return this.config;
  }

  /** Troca as exceções (a lista inteira: o que não vier volta ao padrão do código). `null` se o formato é inválido. */
  gravar(itens: unknown): ConfigDeVisibilidade | null {
    const validos: Record<string, EstadoDeVisibilidade> | null = normalizarItens(itens);
    if (!validos) return null;
    this.config = { versao: this.config.versao + 1, itens: validos };
    if (this.arquivo) gravarJson(this.arquivo, this.config);
    return this.config;
  }
}
