import { join } from 'node:path';
import { gravarJson, lerJson } from './metricas';

export const PRESENCA_ARQUIVO = 'presenca.json';
/** Quanto tempo uma visita fica guardada (o mesmo do registro técnico do servidor). Depois disso sai do arquivo, na próxima vez que o diário muda. */
export const PRESENCA_RETENCAO_DIAS = 30;
/** O teto de visitas guardadas: o diário não cresce sem limite se a sala encher de gente (as mais velhas saem primeiro). */
export const PRESENCA_MAX = 3000;
/** O mínimo entre duas gravações do arquivo (entrar e sair acontecem em rajada; o arquivo inteiro é regravado). */
const GRAVAR_NO_MAXIMO_A_CADA_MS = 5_000;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Uma entrada de alguém numa sala online (P275, ordem do Comandante em 29/10: "temos q registrar o login ou nick deles pra eu saber de fato quem e quando estava nas salas").
 * **Só o que responde "quem e quando":** o apelido (o que os outros jogadores já veem), a conta se o jogador estava logado (o número dela, nunca o e-mail: o painel monta um rótulo mascarado
 * na hora de mostrar), a sala, o mapa e a hora de entrar e de sair. **Nunca o IP nem o país** (os números por país são outro arquivo, agregados).
 */
export interface Visita {
  id: number;
  apelido: string;
  /** O número da conta, ou `null` (convidado). Apagar a conta apaga as visitas dela (LGPD art. 18, VI). */
  conta: number | null;
  /** O código que o jogador digitou (`ARENA`), sem o mapa. */
  sala: string;
  mapa: string;
  entrou: number;
  /** `null` = ainda na sala. */
  saiu: number | null;
}

interface Arquivo {
  v: 1;
  /** A última vez que o diário foi gravado: quem estava dentro quando o servidor caiu saiu, no máximo, nesta hora. */
  atualizadoEm: number;
  visitas: Visita[];
}

/**
 * O diário de presença: quem entrou nas salas e quando (P275). Em memória e no arquivo `presenca.json` da pasta de dados (sobrevive ao reinício); sem pasta (os testes), só a memória.
 * **Só o dono lê** (`GET /admin/presenca`, a chave de métricas). Guarda no máximo {@link PRESENCA_RETENCAO_DIAS} dias e {@link PRESENCA_MAX} visitas. Custo: uma inserção por entrada e uma
 * atualização por saída, fora do laço de 60 Hz; o arquivo é regravado no máximo a cada 5 s.
 */
export class DiarioDePresenca {
  private visitas: Visita[] = [];
  private readonly arquivo: string | null;
  /** A visita aberta de cada conexão (a chave é o objeto da conexão: some sozinha quando ela some). */
  private readonly abertas = new WeakMap<object, Visita>();
  private proximoId = 1;
  private sujo = false;
  private ultimaGravacao = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    dirDados: string | null,
    private readonly agora: () => number = Date.now,
  ) {
    this.arquivo = dirDados ? join(dirDados, PRESENCA_ARQUIVO) : null;
    const lido = this.arquivo ? lerJson(this.arquivo) : null;
    if (ehArquivo(lido)) {
      // Quem estava dentro quando o servidor caiu: saiu, no máximo, na última gravação.
      this.visitas = lido.visitas.map((v) => (v.saiu === null ? { ...v, saiu: Math.max(v.entrou, lido.atualizadoEm) } : v));
      this.proximoId = this.visitas.reduce((m, v) => Math.max(m, v.id), 0) + 1;
      this.podar();
    }
  }

  /** Alguém entrou numa sala. `conexao` é o objeto da conexão (para `saiu`). */
  entrou(conexao: object, quem: { apelido: string; conta: number | null; sala: string; mapa: string }): void {
    const v: Visita = { id: this.proximoId++, apelido: quem.apelido, conta: quem.conta, sala: quem.sala, mapa: quem.mapa, entrou: this.agora(), saiu: null };
    this.visitas.push(v);
    this.abertas.set(conexao, v);
    this.podar();
    this.marcar();
  }

  /** A conexão caiu ou saiu. Sem visita aberta, não faz nada. */
  saiu(conexao: object): void {
    const v = this.abertas.get(conexao);
    if (!v) return;
    this.abertas.delete(conexao);
    if (v.saiu !== null) return; // o servidor já encerrou o diário (`encerrar`)
    v.saiu = this.agora();
    this.marcar();
  }

  /** As visitas, **as mais novas primeiro** (cópias: quem chama não mexe no diário). */
  recentes(limite = 200): Visita[] {
    return this.visitas
      .slice(-Math.max(0, limite))
      .reverse()
      .map((v) => ({ ...v }));
  }

  /** As visitas de uma conta (o que ela recebe ao baixar os próprios dados), as mais novas primeiro. */
  daConta(contaId: number): Visita[] {
    return this.visitas
      .filter((v) => v.conta === contaId)
      .reverse()
      .map((v) => ({ ...v }));
  }

  /** Quem está dentro agora (as visitas sem saída). */
  dentroAgora(): number {
    let n = 0;
    for (const v of this.visitas) if (v.saiu === null) n++;
    return n;
  }

  /** Apaga as visitas de uma conta (a pessoa apagou a conta). Devolve quantas saíram. */
  apagarDaConta(contaId: number): number {
    const antes = this.visitas.length;
    this.visitas = this.visitas.filter((v) => v.conta !== contaId);
    const tiradas = antes - this.visitas.length;
    if (tiradas) this.marcar();
    return tiradas;
  }

  /** O servidor está fechando: quem ainda estava dentro sai agora, e o diário é gravado. */
  encerrar(): void {
    const t = this.agora();
    for (const v of this.visitas) if (v.saiu === null) v.saiu = t;
    this.sujo = true;
    this.fechar();
  }

  /** Grava já o que estiver pendente (o servidor fechando). */
  fechar(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.gravar();
  }

  private podar(): void {
    const corte = this.agora() - PRESENCA_RETENCAO_DIAS * DIA_MS;
    const dentro = this.visitas.filter((v) => (v.saiu ?? this.agora()) >= corte);
    this.visitas = dentro.length > PRESENCA_MAX ? dentro.slice(dentro.length - PRESENCA_MAX) : dentro;
  }

  private marcar(): void {
    this.sujo = true;
    if (!this.arquivo || this.timer) return;
    const espera = Math.max(0, this.ultimaGravacao + GRAVAR_NO_MAXIMO_A_CADA_MS - this.agora());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.gravar();
    }, espera);
    this.timer.unref?.();
  }

  private gravar(): void {
    if (!this.arquivo || !this.sujo) return;
    this.sujo = false;
    this.ultimaGravacao = this.agora();
    const dados: Arquivo = { v: 1, atualizadoEm: this.ultimaGravacao, visitas: this.visitas };
    gravarJson(this.arquivo, dados);
  }
}

const ehVisita = (x: unknown): x is Visita => {
  const v = x as Partial<Visita> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    Number.isInteger(v!.id) &&
    typeof v!.apelido === 'string' &&
    (v!.conta === null || Number.isInteger(v!.conta)) &&
    typeof v!.sala === 'string' &&
    typeof v!.mapa === 'string' &&
    Number.isFinite(v!.entrou) &&
    (v!.saiu === null || Number.isFinite(v!.saiu))
  );
};

const ehArquivo = (x: unknown): x is Arquivo => {
  const a = x as Partial<Arquivo> | null;
  return typeof x === 'object' && x !== null && a!.v === 1 && Number.isFinite(a!.atualizadoEm) && Array.isArray(a!.visitas) && a!.visitas.every(ehVisita);
};
