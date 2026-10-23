import { join } from 'node:path';
import { ARQUIVOS_DE_TELAO, configVaziaDeTelao, lerConfigDeTelao, normalizarItensDeTelao, type ConfigDeTelao, type TelaoItem } from '../shared/telao';
import { gravarJson, lerJson } from './metricas';

export const TELAO_ARQUIVO = 'telao.json';

/**
 * Onde o servidor guarda o que o Comandante escolheu para os telões da Cidade Neon (P246): uma configuração só, em memória e no arquivo `telao.json` da pasta de dados (sobrevive ao reinício,
 * mesmo padrão de `ArmazemDeVisibilidade`). Sem pasta de dados (os testes), vale só a memória. Quem grava é o dono (`POST /admin/telao`); quem lê é todo cliente (`GET /telao`).
 */
export class ArmazemDeTelao {
  private config: ConfigDeTelao;
  private readonly arquivo: string | null;
  private readonly arquivosPermitidos: readonly string[];

  constructor(dirDados: string | null, arquivosPermitidos: readonly string[] = ARQUIVOS_DE_TELAO) {
    this.arquivosPermitidos = arquivosPermitidos;
    this.arquivo = dirDados ? join(dirDados, TELAO_ARQUIVO) : null;
    this.config = this.arquivo ? lerConfigDeTelao(lerJson(this.arquivo), arquivosPermitidos) : configVaziaDeTelao();
  }

  atual(): ConfigDeTelao {
    return this.config;
  }

  /** Troca os itens (a lista inteira: a tela que não vier fica sem sinal). `null` se o formato é inválido. */
  gravar(itens: unknown): ConfigDeTelao | null {
    const validos: Record<string, TelaoItem | null> | null = normalizarItensDeTelao(itens, this.arquivosPermitidos);
    if (!validos) return null;
    this.config = { versao: this.config.versao + 1, itens: validos };
    if (this.arquivo) gravarJson(this.arquivo, this.config);
    return this.config;
  }
}
