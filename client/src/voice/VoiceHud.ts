import type { ModoMic } from './MicController';
import type { VoiceChat } from './VoiceChat';

/** O que o HUD precisa saber do chat de voz (o `VoiceChat` serve; o teste passa um falso). */
export type VozParaHud = Pick<VoiceChat, 'ativa' | 'estadoMic' | 'ligados' | 'semConexao' | 'falando'> & { readonly mic: Pick<VoiceChat['mic'], 'mode' | 'mudo' | 'apertada' | 'transmitindo'> };

/**
 * A linha de estado, a partir do que o jogador precisa saber: o microfone está aberto, mudo, pedindo, ou não existe. Texto puro, sem DOM (testável). Cada texto é uma chave do
 * dicionário de idiomas (`public/locales`), com o nome da tecla na lacuna `{0}`: o teste `VoiceHud.test.ts` confere que os seis idiomas têm todas.
 */
export function textoDeEstado(v: VozParaHud, tecla: string): string {
  switch (v.estadoMic) {
    case 'pedindo':
      return 'PEDINDO O MICROFONE…';
    case 'negado':
      return 'SÓ OUVINDO: MICROFONE RECUSADO';
    case 'sem':
      return 'SÓ OUVINDO: SEM MICROFONE';
    default: {
      const modo: ModoMic = v.mic.mode;
      if (modo === 'ptt') return v.mic.apertada ? 'FALANDO' : `SEGURE [${tecla}] PARA FALAR`;
      return v.mic.mudo ? `MUDO: [${tecla}] ABRE` : `MICROFONE ABERTO: [${tecla}] MUDA`;
    }
  }
}

/** Quem a rede não deixou ligar (vazio se todos ligaram). */
export function textoDeRede(v: VozParaHud): string {
  return v.semConexao > 0 ? `${v.semConexao} SEM CONEXÃO` : '';
}

/**
 * O indicador do chat de voz (P205), no canto inferior esquerdo: uma linha com o estado do seu microfone, a de quem a rede não deixou ligar e, embaixo, quem está falando. Só aparece
 * com a voz ativa. Redesenha a ~10 Hz e só mexe no DOM quando o texto muda (G4: nada criado por quadro).
 */
export class VoiceHud {
  private readonly el = document.createElement('div');
  private readonly estado = document.createElement('div');
  private readonly rede = document.createElement('div');
  private readonly fala = document.createElement('div');
  private proximo = 0;
  private textoEstado = '';
  private textoRede = '';
  private textoFala = '';
  private classe = '';

  constructor(
    parent: HTMLElement,
    private readonly voz: VozParaHud,
    private readonly nomeDe: (id: number) => string | undefined,
    private readonly tecla: () => string,
  ) {
    this.el.className = 'voz-hud';
    this.el.hidden = true;
    this.estado.className = 'voz-estado';
    this.rede.className = 'voz-rede';
    this.fala.className = 'voz-fala';
    this.el.append(this.estado, this.rede, this.fala);
    parent.append(this.el);
  }

  /** Chamar a cada quadro; ele mesmo limita a 10 Hz. */
  atualizar(agora: number): void {
    if (agora < this.proximo) return;
    this.proximo = agora + 100;
    const ativa = this.voz.ativa;
    if (this.el.hidden === ativa) this.el.hidden = !ativa;
    if (!ativa) return;
    const estado = textoDeEstado(this.voz, this.tecla());
    if (estado !== this.textoEstado) this.estado.textContent = this.textoEstado = estado;
    const rede = textoDeRede(this.voz);
    if (rede !== this.textoRede) this.rede.textContent = this.textoRede = rede;
    // O microfone aberto e transmitindo acende; mudo ou sem microfone apaga.
    const classe = this.voz.mic.transmitindo ? 'voz-hud voz-no-ar' : 'voz-hud';
    if (classe !== this.classe) this.el.className = this.classe = classe;
    let falando = '';
    for (const id of this.voz.falando(agora)) {
      falando += (falando ? ', ' : '▶ ') + (this.nomeDe(id) ?? `#${id}`);
      if (falando.length > 60) break;
    }
    if (falando !== this.textoFala) this.fala.textContent = this.textoFala = falando;
  }

  dispose(): void {
    this.el.remove();
  }
}
