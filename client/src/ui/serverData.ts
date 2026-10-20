import type { AdminAmostra, AdminErro, Resultado, Veredito } from '../../../shared/net/admin';
import type { MotivoDeFalha } from '../net/admin';
import { mapaDaChave } from '../../../shared/net/mapa';
import { TEATROS } from './theater';

/** As contas e os textos da janela do servidor (P93), sem DOM: o que a tela desenha sai daqui e tem teste. */

/** "3 h 12 min", "45 min", "40 s". */
export function duracao(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** Número com vírgula decimal e as casas pedidas ("1,4"). */
export const num = (x: number, casas = 1): string => (Number.isFinite(x) ? x.toFixed(casas).replace('.', ',') : '—');

export interface CaminhoDoGrafico {
  /** O `d` da linha (`M x,y L x,y …`). */
  linha: string;
  /** O `d` da área sob a linha (fecha na base). */
  area: string;
  /** O teto do eixo vertical que valeu (para a legenda). */
  max: number;
  /** A altura (em y) de uma meta, se couber no eixo; `null` se passa do teto. */
  yDaMeta: number | null;
}

/**
 * Os pontos de um gráfico de linha numa caixa de `largura` × `altura` (y cresce para baixo). O eixo vai de 0 ao maior valor (ou ao `piso`, para
 * um gráfico quase vazio não parecer uma tempestade): sem valores, uma linha chata no chão. A meta (uma linha tracejada na tela) só aparece se
 * couber no eixo; o teto sobe para ela caber quando o dado chega perto.
 */
export function caminhoDoGrafico(valores: readonly number[], largura: number, altura: number, o: { piso?: number; meta?: number } = {}): CaminhoDoGrafico {
  const limpos = valores.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const maior = Math.max(0, ...limpos);
  const max = Math.max(o.piso ?? 1, maior * 1.1, o.meta !== undefined && maior >= o.meta * 0.4 ? o.meta * 1.2 : 0);
  const y = (v: number) => altura - (Math.min(v, max) / max) * altura;
  const n = limpos.length;
  const x = (i: number) => (n <= 1 ? largura : (i / (n - 1)) * largura);
  const pontos = (n ? limpos : [0, 0]).map((v, i) => `${(n ? x(i) : i * largura).toFixed(1)},${y(v).toFixed(1)}`);
  const linha = `M${pontos.join(' L')}`;
  const area = `${linha} L${largura.toFixed(1)},${altura} L0,${altura} Z`;
  return { linha, area, max, yDaMeta: o.meta !== undefined && o.meta <= max ? y(o.meta) : null };
}

/** Os valores de uma série do histórico, na ordem do tempo. */
export function serie(amostras: readonly AdminAmostra[], campo: Exclude<keyof AdminAmostra, 't'>): number[] {
  return amostras.map((a) => a[campo]);
}

/** O que a tela diz para cada motivo de uma chamada que não deu. */
export function textoDoMotivo(motivo: MotivoDeFalha, erro?: AdminErro): string {
  switch (motivo) {
    case 'sem-servidor':
      return 'Este jogo não sabe onde está o servidor (build offline).';
    case 'sem-token':
      return 'Falta o token do dono, ou o servidor não tem token configurado.';
    case 'token':
      return 'O servidor recusou o token. Confira o arquivo metricas-token.txt no PC do servidor.';
    case 'bloqueado':
      return 'Erros de token demais deste endereço: espere uns 10 minutos.';
    case 'fora-do-ar':
      return 'O servidor não respondeu. Ele está desligado, reiniciando ou o túnel caiu.';
    case 'resposta':
      return erro?.erro ?? 'O servidor respondeu, mas não é o painel: ele ainda roda uma versão sem as rotas (o atualizador religa com o código novo em até 10 minutos).';
    case 'recusado':
      return erro?.erro ?? 'O servidor recusou o pedido.';
  }
}

export const ROTULO_DO_VEREDITO: Readonly<Record<Veredito, string>> = { apto: 'APTO', atencao: 'ATENÇÃO', problema: 'PROBLEMA' };
export const SIMBOLO_DO_RESULTADO: Readonly<Record<Resultado, string>> = { ok: '✓', atencao: '!', falha: '✗' };

/** O texto de uma sala na tabela: "ARENA · 2 jogando · 5 bots · rodada 3, 2:00". */
/** O nome do mapa de uma sala pela chave dela (`ARENA@praia` → "ESTAÇÃO DOS CABOS"): o painel diz onde a sala está em vez de mostrar o sufixo cru. */
export function nomeDoMapa(chave: string): string {
  const mapa = mapaDaChave(chave);
  return TEATROS.find((t) => t.mapa === mapa)?.nome ?? mapa;
}

export function linhaDaSala(s: { codigo: string; jogadores: number; bots: number; rodada: number; restanteS: number; jogando: boolean }): string {
  const resto = s.jogando ? `${Math.floor(s.restanteS / 60)}:${String(s.restanteS % 60).padStart(2, '0')}` : 'intervalo';
  return `${s.codigo} · ${s.jogadores} jogando · ${s.bots} bots · rodada ${s.rodada}, ${resto}`;
}

/** Cor de um valor contra a meta: verde até a meta, laranja até 1,5×, vermelho acima. */
export function nivelContraMeta(valor: number, meta: number): 'ok' | 'atencao' | 'falha' {
  return valor <= meta ? 'ok' : valor <= meta * 1.5 ? 'atencao' : 'falha';
}

/** A frase do cartão "voltou": o servidor responde de novo, com o uptime menor que o de antes do pedido. */
export function voltou(antesUptimeS: number, depoisUptimeS: number | null): boolean {
  return depoisUptimeS !== null && depoisUptimeS < antesUptimeS;
}
