/**
 * Contas de piloto: SQLite no próprio PC do servidor (dono, 28/09: escolheu isso a caminhos gerenciados
 * de nuvem — "gratuito, sem serviço novo, cabe no orçamento do projeto"). `node:sqlite` embutido do Node
 * (>=22.5): **zero dependência nova** — depois da dor de hoje com o binário nativo do `@rolldown` travando
 * a instalação, evitar mais um binário nativo (`better-sqlite3` faria o mesmo) é a decisão certa aqui.
 *
 * **Aviso (R13, para não afirmar mais do que existe):** `node:sqlite` é experimental na versão do Node do
 * projeto — a API pode mudar em versões futuras do Node. Por isso toda a leitura/escrita do banco passa por
 * este arquivo só, atrás de funções com nome em português (não o SQL cru espalhado pelo código): trocar de
 * banco depois (Postgres, se crescer) é mudar só aqui.
 *
 * **Senha:** nunca gravada em texto — `scrypt` (do próprio `node:crypto`, sem dependência) com um sal
 * aleatório de 16 bytes por conta. **Sessão:** o token que o cliente guarda é aleatório (32 bytes); o banco
 * grava só o hash SHA-256 dele — um vazamento do arquivo `contas.db` não dá sessão utilizável a ninguém.
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { diaDe } from './telemetria';
import { POLITICA_VERSAO, type DadosDaConta } from '../shared/net/auth';

const scrypt = promisify(scryptCb);

/** 30 dias: uma sessão de jogo casual não deveria pedir senha de novo toda semana. */
const SESSAO_DIAS = 30;
/** Quantas sessões abertas uma conta mantém (dez aparelhos e navegadores). */
export const SESSOES_MAX = 10;
const SAL_BYTES = 16;
const HASH_BYTES = 64;
const TOKEN_BYTES = 32;

export interface Conta {
  id: number;
  email: string;
  is_admin: boolean;
  /** A pessoa deixa o jogo registrar a atividade da conta (dias, minutos, abates, mortes)? Padrão sim; ela pode desligar (LGPD art. 18 § 2, oposição). */
  medir: boolean;
}

/** O que uma partida de um piloto com conta soma ao dia dele (os números que o navegador declarou: métrica de produto, nunca placar nem recompensa). */
export interface PartidaDaConta {
  segundos: number;
  abates: number;
  mortes: number;
}

/** Quantos pilotos da coorte voltaram: `coorte` entrou naquele dia, `voltaram` apareceu de novo N dias depois. */
export interface Retencao {
  coorte: number;
  voltaram: number;
}

/** O que o dono vê dos pilotos com conta (P185): só contagens, nunca e-mail nem identificador. */
export interface MetricasUsuarios {
  /** O primeiro dia medido: antes dele não se sabe quem voltou (as contas mais velhas ficam fora da retenção). */
  desde: string | null;
  contas: number;
  /** Contas criadas por dia (os últimos 30). */
  novasPorDia: Record<string, number>;
  /** Pilotos com conta que abriram o jogo (entraram) hoje, nos últimos 7 e nos últimos 30 dias. */
  ativos: { dia: number; semana: number; mes: number };
  /** Os que de fato jogaram uma rodada (a visita sem partida não conta). */
  jogaram: { dia: number; semana: number; mes: number };
  /** Minutos jogados por piloto que jogou, nos últimos 30 dias. */
  minutosPorJogador: number;
  retencao: { d1: Retencao; d7: Retencao };
  /** O dia a dia (os últimos 14): quem entrou, quem jogou, os minutos e as rodadas. */
  porDia: { dia: string; ativos: number; jogaram: number; minutos: number; partidas: number; abates: number; mortes: number }[];
}

/** Soma `n` dias a um AAAA-MM-DD (aritmética de calendário, sem fuso: o dia já é o de Brasília). */
export function diaMais(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Atividade mais antiga guardada (um dia por conta por dia de uso: sem poda a tabela cresceria para sempre). */
const ATIVIDADE_DIAS = 400;

export class Contas {
  private readonly db: DatabaseSync;

  constructor(caminho: string) {
    this.db = new DatabaseSync(caminho);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        hash TEXT NOT NULL,
        sal TEXT NOT NULL,
        criada_em TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sessoes (
        token_hash TEXT PRIMARY KEY,
        conta_id INTEGER NOT NULL REFERENCES contas(id),
        criada_em TEXT NOT NULL,
        expira_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes(conta_id);
      CREATE TABLE IF NOT EXISTS progresso (
        conta_id INTEGER PRIMARY KEY REFERENCES contas(id),
        json TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS configuracoes_globais (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS atividade (
        conta_id INTEGER NOT NULL REFERENCES contas(id),
        dia TEXT NOT NULL,
        segundos INTEGER NOT NULL DEFAULT 0,
        partidas INTEGER NOT NULL DEFAULT 0,
        abates INTEGER NOT NULL DEFAULT 0,
        mortes INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (conta_id, dia)
      );
      CREATE INDEX IF NOT EXISTS atividade_dia ON atividade(dia);
    `);
    
    // Migração de schema em tempo real: garante que contas criadas antes da tabela
    // ganhar a coluna is_admin não quebrem o sistema (para SQLite existente).
    try {
      this.db.exec(`ALTER TABLE contas ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;`);
    } catch {
      // Falha silenciosamente se a coluna já existir (comportamento esperado na 2ª vez).
    }
    // P187 (LGPD): o aceite da política (quando e qual versão) e a escolha de medir ou não a atividade. Contas de antes ficam sem aceite (nulo) e com a medição ligada.
    for (const coluna of ['aceite_em TEXT', 'aceite_versao TEXT', 'medir INTEGER NOT NULL DEFAULT 1']) {
      try {
        this.db.exec(`ALTER TABLE contas ADD COLUMN ${coluna};`);
      } catch {
        // já existe
      }
    }
  }

  close(): void {
    this.db.close();
  }

  /** Uma cópia consistente do banco inteiro em `caminho` (que não pode existir): o `VACUUM INTO` do SQLite não pega o banco no meio de uma escrita (`server/backupContas.ts`). */
  copiarPara(caminho: string): void {
    this.db.exec(`VACUUM INTO '${caminho.replace(/'/g, "''")}'`);
  }

  /** Cria a conta. `'existe'` se o e-mail já está cadastrado (mensagem que a UI pode mostrar direto —
   * diferente da mensagem de login, que nunca diz se o e-mail existe). */
  async criar(email: string, senha: string, now = Date.now(), aceiteVersao: string | null = null): Promise<{ ok: true; conta: Conta } | { ok: false; motivo: 'existe' }> {
    const ja = this.db.prepare('SELECT id FROM contas WHERE email = ?').get(email);
    if (ja) return { ok: false, motivo: 'existe' };
    const sal = randomBytes(SAL_BYTES);
    const hash = (await scrypt(senha, sal, HASH_BYTES)) as Buffer;
    const agora = new Date(now).toISOString();
    const r = this.db
      .prepare('INSERT INTO contas (email, hash, sal, criada_em, is_admin, aceite_em, aceite_versao) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(email, hash.toString('hex'), sal.toString('hex'), agora, aceiteVersao ? agora : null, aceiteVersao);
    return { ok: true, conta: { id: Number(r.lastInsertRowid), email, is_admin: false, medir: true } };
  }

  /** Confere e-mail + senha. Tempo de resposta parecido para "não existe" e "senha errada" (ainda calcula
   * um scrypt mesmo sem conta, com sal fixo) — não elimina timing attack por completo, mas encarece. */
  async autenticar(email: string, senha: string): Promise<Conta | null> {
    const row = this.db.prepare('SELECT id, hash, sal, is_admin, medir FROM contas WHERE email = ?').get(email) as
      | { id: number; hash: string; sal: string; is_admin: number; medir: number }
      | undefined;
    const sal = row ? Buffer.from(row.sal, 'hex') : randomBytes(SAL_BYTES);
    const calculado = (await scrypt(senha, sal, HASH_BYTES)) as Buffer;
    if (!row) return null;
    const guardado = Buffer.from(row.hash, 'hex');
    if (guardado.length !== calculado.length || !timingSafeEqual(guardado, calculado)) return null;
    return { id: row.id, email, is_admin: row.is_admin === 1, medir: row.medir !== 0 };
  }

  /** O progresso que o navegador do piloto mandou da última vez (JSON já validado por quem gravou), ou `null` se a conta ainda não guardou nada. */
  lerProgresso(contaId: number): string | null {
    const row = this.db.prepare('SELECT json FROM progresso WHERE conta_id = ?').get(contaId) as { json: string } | undefined;
    return row ? row.json : null;
  }

  /** Guarda (substituindo) o progresso da conta: `json` é o `ProgressoPiloto` já validado e normalizado. Uma linha por conta. */
  gravarProgresso(contaId: number, json: string): void {
    this.db
      .prepare('INSERT INTO progresso (conta_id, json, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(conta_id) DO UPDATE SET json = excluded.json, atualizado_em = excluded.atualizado_em')
      .run(contaId, json, new Date().toISOString());
  }

  /** Nova sessão para a conta; devolve o token de verdade (só existe em memória — o banco guarda o hash). */
  criarSessao(contaId: number, now = Date.now()): string {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const agora = new Date(now);
    const expira = new Date(agora.getTime() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
    this.db
      .prepare('INSERT INTO sessoes (token_hash, conta_id, criada_em, expira_em) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), contaId, agora.toISOString(), expira.toISOString());
    this.registrarVisita(contaId, agora.getTime());
    // Teto de sessões por conta (P192): as mais velhas saem. Sem ele, login repetido (script, aparelhos esquecidos) acumularia linhas sem fim.
    this.db
      .prepare('DELETE FROM sessoes WHERE conta_id = ? AND token_hash NOT IN (SELECT token_hash FROM sessoes WHERE conta_id = ? ORDER BY criada_em DESC, rowid DESC LIMIT ?)')
      .run(contaId, contaId, SESSOES_MAX);
    return token;
  }

  /** A conta dona do token, se a sessão existir e não tiver expirado. */
  validarSessao(token: string): Conta | null {
    const row = this.db
      .prepare('SELECT c.id as id, c.email as email, c.is_admin as is_admin, c.medir as medir, s.expira_em as expira_em FROM sessoes s JOIN contas c ON c.id = s.conta_id WHERE s.token_hash = ?')
      .get(hashToken(token)) as { id: number; email: string; is_admin: number; medir: number; expira_em: string } | undefined;
    if (!row) return null;
    if (new Date(row.expira_em).getTime() < Date.now()) return null;
    return { id: row.id, email: row.email, is_admin: row.is_admin === 1, medir: row.medir !== 0 };
  }

  /**
   * Promove ou rebaixa um administrador (P192). **Só a ferramenta do dono, no PC do servidor (`npm run admin`), chama isto**: nenhuma rota HTTP promove ninguém (o privilégio mais alto só se concede com
   * acesso ao arquivo do banco). Devolve a conta (`null` = e-mail sem conta). Efeito imediato: a sessão já aberta passa a valer como admin (ou deixa de valer).
   */
  definirAdmin(email: string, admin: boolean): { id: number; email: string; is_admin: boolean } | null {
    const l = this.db.prepare('SELECT id FROM contas WHERE email = ?').get(email) as { id: number } | undefined;
    if (!l) return null;
    this.db.prepare('UPDATE contas SET is_admin = ? WHERE id = ?').run(admin ? 1 : 0, l.id);
    return { id: l.id, email, is_admin: admin };
  }

  /** Quem é administrador hoje (a ferramenta do dono lista; o painel nunca mostra e-mail). */
  listarAdmins(): { id: number; email: string }[] {
    return (this.db.prepare('SELECT id, email FROM contas WHERE is_admin = 1 ORDER BY id').all() as { id: number; email: string }[]).map((l) => ({ id: Number(l.id), email: l.email }));
  }

  /** Quantas contas existem (o painel do servidor mostra; nunca quem são). */
  total(): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM contas').get() as { n: number }).n);
  }

  /** Encerra a sessão (o `POST /conta/sair`). Idempotente: token que não existe não é erro. */
  encerrarSessao(token: string): void {
    this.db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
  }

  /** Sessões vencidas juntam sem limpeza (nenhum dado sensível nelas — só o hash — mas não custa varrer).
   * Chamado de vez em quando pelo servidor, nunca no laço de 60 Hz. A atividade de mais de 400 dias também sai. */
  limparExpiradas(now = Date.now()): number {
    const r = this.db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(new Date(now).toISOString());
    this.db.prepare('DELETE FROM atividade WHERE dia < ?').run(diaMais(diaDe(now), -ATIVIDADE_DIAS));
    return Number(r.changes);
  }

  /** O piloto abriu o jogo com a conta hoje (entrou, criou a conta ou voltou com a sessão guardada). Uma linha por conta por dia; repetir no mesmo dia não faz nada. */
  registrarVisita(contaId: number, now = Date.now()): void {
    if (!this.mede(contaId)) return;
    this.db.prepare('INSERT OR IGNORE INTO atividade (conta_id, dia) VALUES (?, ?)').run(contaId, diaDe(now));
  }

  /** A conta deixa a atividade ser registrada? (Conta que não existe mais: não.) */
  private mede(contaId: number): boolean {
    const l = this.db.prepare('SELECT medir FROM contas WHERE id = ?').get(contaId) as { medir: number } | undefined;
    return !!l && l.medir !== 0;
  }

  /**
   * Liga ou desliga o registro da atividade da conta (LGPD art. 18 § 2: a pessoa pode se opor). **Desligar também apaga o que já foi registrado** (não adianta parar de medir e
   * guardar o passado). Ligar de novo recomeça do zero.
   */
  definirMedicao(contaId: number, medir: boolean): void {
    this.db.prepare('UPDATE contas SET medir = ? WHERE id = ?').run(medir ? 1 : 0, contaId);
    if (!medir) this.db.prepare('DELETE FROM atividade WHERE conta_id = ?').run(contaId);
  }

  /**
   * Apaga a conta e **tudo** que está ligado a ela (LGPD art. 18 VI): a atividade, o progresso, as sessões e a própria conta, numa transação só (ou vai tudo ou não vai nada).
   * As cópias de segurança do banco (`backupContas.ts`) levam até 14 dias para esquecer a conta: a política de privacidade diz isso. `false` = a conta não existia.
   */
  apagarConta(contaId: number): boolean {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM atividade WHERE conta_id = ?').run(contaId);
      this.db.prepare('DELETE FROM progresso WHERE conta_id = ?').run(contaId);
      this.db.prepare('DELETE FROM sessoes WHERE conta_id = ?').run(contaId);
      const r = this.db.prepare('DELETE FROM contas WHERE id = ?').run(contaId);
      this.db.exec('COMMIT');
      return Number(r.changes) > 0;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /**
   * Tudo que o servidor guarda desta conta (LGPD art. 18 II e V: acesso e portabilidade), num JSON que a pessoa baixa. **Sem** o hash da senha, o sal nem os hashes das sessões (são
   * segredos do servidor, não dados da pessoa). `null` = a conta não existe.
   */
  exportarDados(contaId: number, now = Date.now()): DadosDaConta | null {
    const c = this.db.prepare('SELECT email, criada_em, is_admin, medir, aceite_em, aceite_versao FROM contas WHERE id = ?').get(contaId) as
      | { email: string; criada_em: string; is_admin: number; medir: number; aceite_em: string | null; aceite_versao: string | null }
      | undefined;
    if (!c) return null;
    const progresso = this.lerProgresso(contaId);
    const atividade = (this.db.prepare('SELECT dia, segundos, partidas, abates, mortes FROM atividade WHERE conta_id = ? ORDER BY dia').all(contaId) as DadosDaConta['atividade']).map((l) => ({
      dia: l.dia,
      segundos: Number(l.segundos),
      partidas: Number(l.partidas),
      abates: Number(l.abates),
      mortes: Number(l.mortes),
    }));
    const sessoes = (this.db.prepare('SELECT criada_em, expira_em FROM sessoes WHERE conta_id = ? ORDER BY criada_em').all(contaId) as { criada_em: string; expira_em: string }[]).map((s) => ({
      criadaEm: s.criada_em,
      venceEm: s.expira_em,
    }));
    return {
      v: 1,
      geradoEm: new Date(now).toISOString(),
      nota: `Tudo o que o servidor do CYBERMECH guarda sobre esta conta (política de ${POLITICA_VERSAO}). Não inclui o hash da senha nem os segredos das sessões, que não são dados seus. O que o jogo guarda só no seu navegador (apelido, configurações) está no seu aparelho. Quem joga sem conta não tem nada aqui.`,
      conta: { email: c.email, criadaEm: c.criada_em, aceiteEm: c.aceite_em, aceiteVersao: c.aceite_versao, medirAtividade: c.medir !== 0, administrador: c.is_admin === 1 },
      progresso: progresso ? (JSON.parse(progresso) as unknown) : null,
      atividade,
      sessoes,
    };
  }

  /** Uma rodada do piloto com conta: soma ao dia dele (a visita do dia nasce junto). */
  registrarPartida(contaId: number, p: PartidaDaConta, now = Date.now()): void {
    if (!this.mede(contaId)) return;
    this.db
      .prepare(
        `INSERT INTO atividade (conta_id, dia, segundos, partidas, abates, mortes) VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(conta_id, dia) DO UPDATE SET segundos = segundos + excluded.segundos, partidas = partidas + 1, abates = abates + excluded.abates, mortes = mortes + excluded.mortes`,
      )
      .run(contaId, diaDe(now), Math.round(p.segundos), Math.round(p.abates), Math.round(p.mortes));
  }

  /** Os números do dono sobre os pilotos com conta (P185). Leitura leve (alguns índices, meses de dados): só a porta privada `/metricas` chama, nunca o laço de 60 Hz. */
  metricasUsuarios(now = Date.now()): MetricasUsuarios {
    const hoje = diaDe(now);
    const n = (sql: string, ...args: (string | number)[]): number => Number((this.db.prepare(sql).get(...args) as { n: number | null }).n ?? 0);
    const desde = (this.db.prepare('SELECT MIN(dia) AS d FROM atividade').get() as { d: string | null }).d;
    const quantos = (dias: number, soJogaram: boolean): number =>
      n(
        `SELECT COUNT(DISTINCT conta_id) AS n FROM atividade WHERE dia > ? AND dia <= ?${soJogaram ? ' AND partidas > 0' : ''}`,
        diaMais(hoje, -dias),
        hoje,
      );
    const novasPorDia: Record<string, number> = {};
    for (const l of this.db
      .prepare(`SELECT date(criada_em, '-3 hours') AS dia, COUNT(*) AS n FROM contas GROUP BY dia HAVING dia > ? ORDER BY dia`)
      .all(diaMais(hoje, -30)) as { dia: string; n: number }[])
      novasPorDia[l.dia] = Number(l.n);
    const segundos30 = n('SELECT SUM(segundos) AS n FROM atividade WHERE dia > ? AND dia <= ?', diaMais(hoje, -30), hoje);
    const jogaram30 = quantos(30, true);
    // Retenção clássica: dos que criaram a conta no dia X, quantos abriram o jogo de novo no dia X+N. Só entram as contas criadas depois de a medição começar
    // (antes disso não havia como saber quem voltou) e as coortes cujo dia X+N já passou.
    const retencao = (dias: number): Retencao => {
      if (!desde) return { coorte: 0, voltaram: 0 };
      const l = this.db
        .prepare(
          `SELECT COUNT(*) AS coorte, COALESCE(SUM(EXISTS (SELECT 1 FROM atividade a WHERE a.conta_id = c.id AND a.dia = date(c.dia0, ?))), 0) AS voltaram
           FROM (SELECT id, date(criada_em, '-3 hours') AS dia0 FROM contas) c WHERE c.dia0 >= ? AND c.dia0 > ? AND c.dia0 <= ?`,
        )
        .get(`+${dias} days`, desde, diaMais(hoje, -30), diaMais(hoje, -dias)) as { coorte: number; voltaram: number };
      return { coorte: Number(l.coorte), voltaram: Number(l.voltaram) };
    };
    const porDia = (
      this.db
        .prepare(
          `SELECT dia, COUNT(*) AS ativos, SUM(partidas > 0) AS jogaram, SUM(segundos) AS segundos, SUM(partidas) AS partidas, SUM(abates) AS abates, SUM(mortes) AS mortes
           FROM atividade WHERE dia > ? AND dia <= ? GROUP BY dia ORDER BY dia`,
        )
        .all(diaMais(hoje, -14), hoje) as { dia: string; ativos: number; jogaram: number; segundos: number; partidas: number; abates: number; mortes: number }[]
    ).map((l) => ({
      dia: l.dia,
      ativos: Number(l.ativos),
      jogaram: Number(l.jogaram),
      minutos: Math.round(Number(l.segundos) / 60),
      partidas: Number(l.partidas),
      abates: Number(l.abates),
      mortes: Number(l.mortes),
    }));
    return {
      desde,
      contas: this.total(),
      novasPorDia,
      ativos: { dia: quantos(1, false), semana: quantos(7, false), mes: quantos(30, false) },
      jogaram: { dia: quantos(1, true), semana: quantos(7, true), mes: jogaram30 },
      minutosPorJogador: jogaram30 ? Math.round((segundos30 / 60 / jogaram30) * 10) / 10 : 0,
      retencao: { d1: retencao(1), d7: retencao(7) },
      porDia,
    };
  }

  /** Lê uma configuração global pela chave (retorna o valor gravado ou nulo) */
  getConfig(chave: string): string | null {
    const row = this.db.prepare('SELECT valor FROM configuracoes_globais WHERE chave = ?').get(chave) as { valor: string } | undefined;
    return row ? row.valor : null;
  }

  /** Salva/Atualiza uma configuração global (ex: 'mechs_oficina', '["quadraV2"]') */
  setConfig(chave: string, valor: string): void {
    this.db.prepare('INSERT INTO configuracoes_globais (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(chave, valor);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
