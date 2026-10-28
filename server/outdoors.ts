import { join } from 'node:path';
import { configPadraoDeOutdoors, lerConfigDeOutdoors, normalizarParametros, type ConfigDeOutdoors } from '../shared/outdoors';
import { gravarJson, lerJson } from './metricas';

export const OUTDOORS_ARQUIVO = 'outdoors.json';

/**
 * Onde o servidor guarda o que o Comandante ajustou nos outdoors da Cidade Neon (P267): quantos aparecem, de quanto em quanto tempo trocam e quais anúncios entram na troca. Uma configuração só, em
 * memória e no arquivo `outdoors.json` da pasta de dados (sobrevive ao reinício, mesmo padrão de `ArmazemDeTelao`). Sem pasta de dados (os testes), vale só a memória. Quem grava é o dono
 * (`POST /admin/outdoors`); quem lê é todo cliente (`GET /outdoors`).
 */
export class ArmazemDeOutdoors {
  private config: ConfigDeOutdoors;
  private readonly arquivo: string | null;

  constructor(dirDados: string | null) {
    this.arquivo = dirDados ? join(dirDados, OUTDOORS_ARQUIVO) : null;
    this.config = this.arquivo ? lerConfigDeOutdoors(lerJson(this.arquivo)) : configPadraoDeOutdoors();
  }

  atual(): ConfigDeOutdoors {
    return this.config;
  }

  /** Troca os parâmetros (todos de uma vez). `null` se o formato é inválido; nada muda. */
  gravar(parametros: unknown): ConfigDeOutdoors | null {
    const validos = normalizarParametros(parametros);
    if (!validos) return null;
    this.config = { versao: this.config.versao + 1, ...validos };
    if (this.arquivo) gravarJson(this.arquivo, this.config);
    return this.config;
  }
}
