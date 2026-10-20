import type { ModoMic } from './MicController';
import type { VoiceChat } from './VoiceChat';

/** O que o HUD precisa saber do chat de voz (o `VoiceChat` serve; o teste passa um falso). */
export type VozParaHud = Pick<VoiceChat, 'ativa' | 'estadoMic' | 'ligados' | 'semConexao' | 'colegas' | 'falando' | 'aoBotao'> & { readonly mic: Pick<VoiceChat['mic'], 'mode' | 'mudo' | 'apertada' | 'transmitindo'> };

/**
 * A linha de estado, a partir do que o jogador precisa saber: o microfone está aberto, mudo, pedindo, ou não existe. Texto puro, sem DOM (testável). Cada texto é uma chave do
 * dicionário de idiomas (`public/locales`), com o nome da tecla na lacuna `{0}`: o teste `VoiceHud.test.ts` confere que os seis idiomas têm todas. No **toque** (P209) não há tecla:
 * o texto fala do botão de microfone da tela.
 */
export function textoDeEstado(v: VozParaHud, tecla: string, toque = false): string {
  switch (v.estadoMic) {
    case 'pedindo':
      return 'PEDINDO O MICROFONE…';
    case 'negado':
      return 'SÓ OUVINDO: MICROFONE RECUSADO';
    case 'sem':
      return 'SÓ OUVINDO: SEM MICROFONE';
    default: {
      const modo: ModoMic = v.mic.mode;
      if (modo === 'ptt') return v.mic.apertada ? 'FALANDO' : toque ? 'SEGURE O BOTÃO PARA FALAR' : `SEGURE [${tecla}] PARA FALAR`;
      if (toque) return v.mic.mudo ? 'MUDO' : 'MICROFONE ABERTO';
      return v.mic.mudo ? `MUDO: [${tecla}] ABRE` : `MICROFONE ABERTO: [${tecla}] MUDA`;
    }
  }
}

/**
 * A linha de baixo: quem a rede não deixou ligar, ou, **sozinho na voz**, o aviso de que ninguém vai ouvir (e onde testar o microfone). Sem ele o indicador dizia "MICROFONE ABERTO" a quem estava só na sala
 * e a pessoa achava que o microfone não funcionava (P212).
 */
export function textoDeRede(v: VozParaHud, foraDaVoz = 0): string {
  if (v.semConexao > 0) return `${v.semConexao} SEM CONEXÃO`;
  // Sozinho na voz mas com gente na sala: o motivo é outro (a outra pessoa é convidado, menor ou desligou a voz), e dizer "teste o microfone" mandava a pessoa atrás do problema errado (P234).
  if (v.colegas === 0) return foraDaVoz > 0 ? `NINGUÉM MAIS NA VOZ: ${foraDaVoz} NA SALA SEM VOZ (PRECISAM DE CONTA DE MAIOR DE 18 ANOS E VOZ LIGADA)` : 'NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES';
  return foraDaVoz > 0 ? `${foraDaVoz} NA SALA SEM VOZ` : '';
}

/** O estado do botão de microfone da tela de toque: no ar (transmitindo), mudo, em espera (o "segurar" solto), pedindo o microfone ao navegador, ou sem microfone. */
export type EstadoDoBotao = 'no-ar' | 'mudo' | 'espera' | 'pedindo' | 'sem';

export function estadoDoBotao(v: VozParaHud): EstadoDoBotao {
  if (v.estadoMic === 'pedindo') return 'pedindo';
  if (v.estadoMic !== 'ativo') return 'sem';
  if (v.mic.mode === 'ptt') return v.mic.apertada ? 'no-ar' : 'espera';
  return v.mic.mudo ? 'mudo' : 'no-ar';
}

export const GLIFO_DO_BOTAO: Readonly<Record<EstadoDoBotao, string>> = Object.freeze({ 'no-ar': '🎙', mudo: '🔇', espera: '🎙', pedindo: '…', sem: '🚫' });

/**
 * O indicador do chat de voz (P205), no canto inferior esquerdo: uma linha com o estado do seu microfone, a de quem a rede não deixou ligar e, embaixo, quem está falando. Só aparece
 * com a voz ativa. Redesenha a ~10 Hz e só mexe no DOM quando o texto muda (G4: nada criado por quadro).
 *
 * **No celular (P209)** não existe a tecla T: o HUD cria também um **botão de microfone** (canto de cima, sob PAUSA e PLACAR), que o CSS só mostra no modo toque com o jogo rodando. Tocar
 * alterna o mudo (modo "sempre aberto"); no modo "segurar para falar", vale enquanto o dedo estiver nele; sem microfone, tocar pede o microfone de novo.
 */
export class VoiceHud {
  private readonly el = document.createElement('div');
  private readonly estado = document.createElement('div');
  private readonly rede = document.createElement('div');
  private readonly fala = document.createElement('div');
  private readonly botao = document.createElement('button');
  private proximo = 0;
  private textoEstado = '';
  private textoRede = '';
  private textoFala = '';
  private classe = '';
  private estadoBotao = '';
  private dedo: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly voz: VozParaHud,
    private readonly nomeDe: (id: number) => string | undefined,
    private readonly tecla: () => string,
    private readonly toque: () => boolean = () => false,
    /** Quantas pessoas da sala estão fora da voz (o jogo conta: pilotos menos os que estão na voz comigo). */
    private readonly foraDaVoz: () => number = () => 0,
  ) {
    this.el.className = 'voz-hud';
    this.el.hidden = true;
    this.estado.className = 'voz-estado';
    this.rede.className = 'voz-rede';
    this.fala.className = 'voz-fala';
    this.el.append(this.estado, this.rede, this.fala);
    parent.append(this.el);

    // O botão fica no `body`, depois da camada de toque (`#touch-controls`): o CSS o mostra só ao lado dela e acima dela (z-index), senão a zona de mira engoliria o toque.
    this.botao.type = 'button';
    this.botao.className = 'voz-mic';
    this.botao.setAttribute('aria-label', 'Microfone');
    this.botao.addEventListener('contextmenu', (e) => e.preventDefault());
    this.botao.addEventListener('pointerdown', (e) => {
      if (this.dedo !== null) return;
      e.preventDefault();
      this.botao.setPointerCapture(e.pointerId);
      this.dedo = e.pointerId;
      this.botao.classList.add('pressed');
      this.voz.aoBotao(true);
    });
    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== this.dedo) return;
      this.dedo = null;
      this.botao.classList.remove('pressed');
      this.voz.aoBotao(false);
    };
    this.botao.addEventListener('pointerup', soltar);
    this.botao.addEventListener('pointercancel', soltar);
    parent.ownerDocument.body.append(this.botao);
  }

  /** Chamar a cada quadro; ele mesmo limita a 10 Hz. */
  atualizar(agora: number): void {
    if (agora < this.proximo) return;
    this.proximo = agora + 100;
    const ativa = this.voz.ativa;
    if (this.el.hidden === ativa) this.el.hidden = !ativa;
    this.botao.classList.toggle('ativo', ativa);
    if (!ativa) return;
    const estado = textoDeEstado(this.voz, this.tecla(), this.toque());
    if (estado !== this.textoEstado) this.estado.textContent = this.textoEstado = estado;
    const rede = textoDeRede(this.voz, this.foraDaVoz());
    if (rede !== this.textoRede) this.rede.textContent = this.textoRede = rede;
    // O microfone aberto e transmitindo acende; mudo ou sem microfone apaga.
    const classe = this.voz.mic.transmitindo ? 'voz-hud voz-no-ar' : 'voz-hud';
    if (classe !== this.classe) this.el.className = this.classe = classe;
    const eb = estadoDoBotao(this.voz);
    if (eb !== this.estadoBotao) {
      this.estadoBotao = eb;
      this.botao.dataset.estado = eb;
      this.botao.textContent = GLIFO_DO_BOTAO[eb];
    }
    let falando = '';
    for (const id of this.voz.falando(agora)) {
      falando += (falando ? ', ' : '▶ ') + (this.nomeDe(id) ?? `#${id}`);
      if (falando.length > 60) break;
    }
    if (falando !== this.textoFala) this.fala.textContent = this.textoFala = falando;
  }

  dispose(): void {
    this.el.remove();
    this.botao.remove();
  }
}
