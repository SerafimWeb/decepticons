import { caminhoDaFala, falaDe, SOTAQUES, type Narracao, type Sotaque } from './falas';

/**
 * O narrador (P146): diz as falas de partida ("Rodada um", "Combate!", "Killing frenzy!", "Você morreu") com a voz e o sotaque que o jogador escolheu.
 * Só da tela (G1/G2): nada daqui entra na simulação. **Não fala e não falha:** sem clipe gerado (o `npm run vozes` ainda não rodou para aquela fala), a fala
 * em português cai na voz sintetizada do navegador, e as outras só deixam a tela (o banner) falar sozinha.
 *
 * Custo: um teste de texto e uma consulta a um `Map` por fala (poucas por minuto); os clipes pequenos (~20 KB) são pedidos uma vez, só do(s) sotaque(s)
 * escolhido(s), e **só os que o manifesto `vozesGeradas.json` lista** (sem 404 à toa). Nada por quadro, nada por tick.
 */
export interface PlayerDeVoz {
  /** O clipe já está decodificado e pronto para tocar? */
  pronto(nome: string): boolean;
  /** Pede o clipe (uma vez só; um 404 não se repete). */
  pedir(nome: string, url: string): void;
  /** Toca o clipe com o ganho dado; devolve a duração em segundos (0 = não tocou). */
  tocar(nome: string, ganho: number): number;
}

export interface OpcoesDoNarrador {
  player: PlayerDeVoz;
  /** O que o jogador escolheu em Configurações > Áudio. */
  narracao: () => Narracao;
  /** Esta fala já foi gerada neste sotaque (está no manifesto `vozesGeradas.json`)? */
  gerada: (sotaque: Sotaque, chave: string) => boolean;
  /** A raiz do jogo (`/` ou `/jogar/`): é de onde os `.mp3` são pedidos. */
  base: string;
  /** Relógio em segundos (qualquer um que só cresça). */
  agora: () => number;
  /** Sorteio de 0 a 1 (a escolha do sotaque no modo mistura). */
  sorteio: () => number;
  /** Sem clipe: lê o texto em português na voz do navegador. Devolve se falou. */
  reserva?: (texto: string) => boolean;
  /** O equilíbrio da voz contra os efeitos (o volume do jogador é aplicado pelo mestre do `AudioSystem`). Padrão 1. */
  ganho?: number;
}

/** As falas que valem a pena já ter na mão quando a partida abre (o resto é pedido na primeira vez). */
const NUCLEO = ['combate', 'rodada_1', 'rodada_2', 'voce_morreu', 'abate_2', 'abate_3'] as const;
/** Entre duas falas da mesma chave: o abate duplo que vem duas vezes em 1 s não fala duas vezes. */
const INTERVALO_DA_MESMA_FALA_S = 1.2;
/** Quanto a voz sintetizada de reserva "ocupa" o narrador (não sabemos a duração dela). */
const OCUPACAO_DA_RESERVA_S = 1.2;

/**
 * Só a abertura da rodada tem voz de reserva (era assim antes do narrador: "Rodada N" e "Combate!" na voz do navegador). Abate, morte e missão **ficam mudos**
 * até o clipe existir: a voz robótica do navegador anunciando cada abate seria pior que o silêncio.
 */
const comReserva = (chave: string): boolean => chave === 'combate' || chave.startsWith('rodada_');

export class Narrador {
  private ocupadoAte = Number.NEGATIVE_INFINITY;
  private prioridadeAtual = 0;
  private readonly ultima = new Map<string, number>();

  constructor(private readonly o: OpcoesDoNarrador) {}

  /** Os sotaques que o jogador pode ouvir agora: um, ou todos no modo mistura (`off` = nenhum). */
  private sotaquesAtivos(): readonly Sotaque[] {
    const n = this.o.narracao();
    if (n === 'off') return [];
    return n === 'mix' ? SOTAQUES : [n];
  }

  private pedir(sotaque: Sotaque, chave: string): void {
    this.o.player.pedir(`${sotaque}/${chave}`, this.o.base + caminhoDaFala(sotaque, chave));
  }

  /** Pede os clipes do núcleo (os que já foram gerados) do(s) sotaque(s) escolhido(s). Chamar quando a partida abre e quando a escolha muda. */
  preparar(): void {
    for (const s of this.sotaquesAtivos()) {
      for (const chave of NUCLEO) if (this.o.gerada(s, chave)) this.pedir(s, chave);
    }
  }

  /**
   * Diz a fala `chave`. `prioridade` (1 a 3): enquanto uma fala toca, outra só entra se for mais importante (abate = 2; rodada, combate e morte = 3).
   * Devolve `true` se tocou um clipe ou falou pela reserva.
   */
  dizer(chave: string, prioridade = 1): boolean {
    const fala = falaDe(chave);
    const ativos = this.sotaquesAtivos();
    if (!fala || ativos.length === 0) return false;
    const agora = this.o.agora();
    if (agora < this.ocupadoAte && prioridade <= this.prioridadeAtual) return false;
    const ultima = this.ultima.get(chave);
    if (ultima !== undefined && agora - ultima < INTERVALO_DA_MESMA_FALA_S) return false;

    const comClipe = ativos.filter((s) => this.o.gerada(s, chave));
    if (comClipe.length > 0) {
      // No modo mistura, sorteia entre os sotaques que já têm o clipe pronto; sem nenhum pronto, entre os gerados (e já pede o clipe).
      const prontos = comClipe.filter((s) => this.o.player.pronto(`${s}/${chave}`));
      const entre = prontos.length > 0 ? prontos : comClipe;
      const sotaque = entre[Math.min(entre.length - 1, Math.floor(this.o.sorteio() * entre.length))]!;
      if (this.o.player.pronto(`${sotaque}/${chave}`)) {
        const duracao = this.o.player.tocar(`${sotaque}/${chave}`, this.o.ganho ?? 1);
        return duracao > 0 ? this.registrar(chave, agora, duracao, prioridade) : false;
      }
      this.pedir(sotaque, chave); // ainda baixando: esta vez cai na reserva (só português), a próxima sai com a voz
    }
    // A reserva só vale para o português (a voz do navegador fala pt-BR): sotaque estrangeiro sem clipe fica mudo.
    if (comReserva(chave) && ativos.includes('br') && this.o.reserva?.(fala.texto.br)) return this.registrar(chave, agora, OCUPACAO_DA_RESERVA_S, prioridade);
    return false;
  }

  private registrar(chave: string, agora: number, duracao: number, prioridade: number): true {
    this.ultima.set(chave, agora);
    this.ocupadoAte = agora + duracao;
    this.prioridadeAtual = prioridade;
    return true;
  }
}
