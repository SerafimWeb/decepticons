import type { EtapaEmCurso } from '../core/EtapaEmCurso';
import { tituloDaCampanha } from './campanhaEditor';

/**
 * A campanha durante a partida (fase 4B): uma faixa pequena com a etapa e o objetivo, e o painel do fim da etapa com o próximo passo. Só texto e botões; a
 * conta de quem venceu é do `EtapaEmCurso`. Nada de `innerHTML` (o nome da campanha é texto do jogador).
 *
 * A faixa mora dentro do `#hud` (some com a pausa e com o F1, como o resto do HUD); o painel do fim fica por cima de tudo.
 *
 * Custo: zero por frame. A faixa só muda o texto quando um abate acontece (uma linha), e o painel só existe depois do fim da etapa.
 */

export type AcaoDoFim = 'proxima' | 'repetir' | 'sair';

export interface PainelDeFim {
  titulo: string;
  subtitulo: string;
  classe: 'vencida' | 'perdida' | 'completa';
  acoes: { id: AcaoDoFim; rotulo: string; primaria: boolean }[];
}

/** A faixa da etapa: "OPERAÇÃO NEON · ETAPA 2/4 · ABATA 12 ROBÔS · 5/12". */
export function textoDaFaixa(run: EtapaEmCurso): string {
  const partes = [tituloDaCampanha(run.campanha), `ETAPA ${run.n}/${run.total}`, run.objetivo.toLocaleUpperCase('pt-BR')];
  if (run.meta !== null) partes.push(`${Math.min(run.abates, run.meta)}/${run.meta}`);
  return partes.join(' · ');
}

/** O que o painel do fim diz e oferece, para cada desfecho. `null` enquanto a etapa segue. */
export function painelDeFim(run: EtapaEmCurso): PainelDeFim | null {
  const r = run.resultado;
  if (r === 'em-curso') return null;
  const sub = `${run.titulo} · ETAPA ${run.n} DE ${run.total}`;
  if (r === 'perdida') {
    return {
      titulo: 'ETAPA PERDIDA',
      subtitulo: sub,
      classe: 'perdida',
      acoes: [
        { id: 'repetir', rotulo: '[ TENTAR DE NOVO ]', primaria: true },
        { id: 'sair', rotulo: '[ SAIR DA CAMPANHA ]', primaria: false },
      ],
    };
  }
  if (run.proxima === null) {
    return { titulo: 'CAMPANHA CONCLUÍDA', subtitulo: `${tituloDaCampanha(run.campanha)} · ${run.total} ${run.total === 1 ? 'ETAPA' : 'ETAPAS'}`, classe: 'completa', acoes: [{ id: 'sair', rotulo: '[ VOLTAR AO CONSOLE ]', primaria: true }] };
  }
  return {
    titulo: 'ETAPA CONCLUÍDA',
    subtitulo: sub,
    classe: 'vencida',
    acoes: [
      { id: 'proxima', rotulo: `[ ETAPA ${run.proxima} ▶ ]`, primaria: true },
      { id: 'sair', rotulo: '[ SAIR DA CAMPANHA ]', primaria: false },
    ],
  };
}

export interface CampaignRunHudOptions {
  /** Abre a etapa dos botões (o `Game` navega para o link dela). */
  ir: (acao: 'proxima' | 'repetir') => void;
  /** Sai da campanha e volta ao jogo comum. */
  sair: () => void;
}

export class CampaignRunHud {
  private readonly faixa = document.createElement('div');
  private painel: HTMLElement | null = null;

  constructor(
    private readonly run: EtapaEmCurso,
    private readonly o: CampaignRunHudOptions,
    pai: HTMLElement = document.getElementById('hud') ?? document.body,
  ) {
    this.faixa.id = 'campanha-faixa';
    this.faixa.setAttribute('role', 'status');
    pai.append(this.faixa);
    this.atualizar();
  }

  /** Refaz o texto da faixa (um abate, o começo da etapa). */
  atualizar(): void {
    this.faixa.textContent = textoDaFaixa(this.run);
  }

  /** Mostra o painel do fim (uma vez); sem efeito enquanto a etapa segue. */
  fim(): void {
    const p = painelDeFim(this.run);
    if (!p || this.painel) return;
    this.faixa.hidden = true;
    const raiz = document.createElement('div');
    raiz.id = 'campanha-fim';
    raiz.className = `campanha-fim ${p.classe}`;
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-modal', 'true');
    raiz.setAttribute('aria-label', p.titulo);
    const caixa = document.createElement('div');
    caixa.className = 'campanha-fim-caixa';
    const h = document.createElement('h2');
    h.textContent = p.titulo;
    const sub = document.createElement('p');
    sub.textContent = p.subtitulo;
    const acoes = document.createElement('div');
    acoes.className = 'campanha-fim-acoes';
    for (const a of p.acoes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn-terminal${a.primaria ? ' primaria' : ''}`;
      b.textContent = a.rotulo;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (a.id === 'sair') this.o.sair();
        else this.o.ir(a.id);
      });
      acoes.append(b);
    }
    caixa.append(h, sub, acoes);
    raiz.append(caixa);
    // O clique no painel não pode "retomar a partida" por baixo (a pausa inteira é o botão de jogar).
    raiz.addEventListener('click', (e) => e.stopPropagation());
    document.body.append(raiz);
    this.painel = raiz;
    acoes.querySelector<HTMLElement>('.primaria')?.focus();
  }
}
