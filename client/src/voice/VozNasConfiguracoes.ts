import type { ElegibilidadeDaVoz, MotivoSemVoz } from './elegibilidade';
import { listarAparelhos } from './aparelhos';

/**
 * A seção do chat de voz das Configurações que não precisa estar no pacote de partida: as frases do portão de idade, o botão que leva à conta e a lista de microfones. **Pedaço sob demanda**
 * (como o `MicTest`): o jogo o baixa em segundo plano logo depois de abrir, e as Configurações já o encontram pronto. O pacote de partida está colado no teto de 500 KB, então cada recurso
 * novo precisa nascer fora dele (P187). Nada aqui roda por quadro.
 */

/** O aviso curto no canto da tela de quem está numa sala online e **fora da voz** (P237): o motivo, para a pessoa não ficar muda sem saber por quê. */
export const TEXTO_SEM_VOZ: Readonly<Record<MotivoSemVoz, string>> = Object.freeze({
  convidado: 'VOZ: ENTRE COM UMA CONTA DE MAIOR DE 18 ANOS PARA FALAR E OUVIR',
  'sem-idade': 'VOZ: INFORME SUA IDADE EM CONFIGURAÇÕES > JOGO PARA FALAR E OUVIR',
  menor: 'VOZ DESLIGADA PARA MENORES DE 18 ANOS: SÓ O ÁUDIO DO JOGO',
  desligada: 'VOZ DESLIGADA: LIGUE "CONVERSAR POR VOZ" EM CONFIGURAÇÕES',
});

/** A frase de cada caso (em português; o tradutor de DOM cuida das outras línguas). */
export const TEXTO_DA_ELEGIBILIDADE: Record<Exclude<ElegibilidadeDaVoz, 'liberada'>, string> = {
  convidado: 'O chat de voz é só para quem tem conta e é maior de 18 anos. Crie uma conta na aba JOGO e informe o mês e o ano de nascimento.',
  'sem-idade': 'Informe o mês e o ano de nascimento da sua conta (aba JOGO) para liberar o chat de voz. Ele é só para maiores de 18 anos.',
  menor: 'O chat de voz não está disponível para contas de menores de 18 anos: sem microfone e sem a voz dos outros jogadores. O áudio do jogo segue normal.',
};

/**
 * O botão que leva direto ao que falta (P227: o Comandante abriu a voz, só viu uma frase e não achou o formulário, no fim de outra aba): convidado cria a conta, conta sem idade informa a idade.
 * O menor não tem botão (não há o que fazer) e quem já pode usar a voz também não.
 */
export const TEXTO_DO_BOTAO_DA_VOZ: Partial<Record<ElegibilidadeDaVoz, string>> = {
  convidado: '[ CRIAR CONTA ]',
  'sem-idade': '[ INFORMAR MINHA IDADE ]',
};

/**
 * Mostra, na seção do chat de voz, o que vale para esta conta (P211): liberada mostra os controles; as outras escondem os controles (nem o microfone, nem o teste dele), dizem o motivo e,
 * quando há o que fazer, põem o botão que leva até lá (o convidado já cai na aba CRIAR CONTA).
 */
export function mostrarElegibilidade(e: ElegibilidadeDaVoz, doc: Document = document): void {
  const liberada = e === 'liberada';
  const $ = (id: string) => doc.getElementById(id)!;
  $('voz-controles').hidden = !liberada;
  const aviso = $('voz-elegibilidade');
  aviso.hidden = liberada;
  aviso.textContent = liberada ? '' : TEXTO_DA_ELEGIBILIDADE[e];
  const botao = $('btn-voz-conta') as HTMLButtonElement;
  const texto = liberada ? undefined : TEXTO_DO_BOTAO_DA_VOZ[e];
  botao.hidden = !texto;
  botao.textContent = texto ?? '';
  if (e === 'convidado') botao.dataset.contaCriar = '1';
  else delete botao.dataset.contaCriar;
}

/** Os microfones da lista de escolha (com nome depois que o navegador deu a permissão); o salvo que sumiu continua escolhido, marcado como desconectado. */
export async function preencherAparelhos(sel: HTMLSelectElement, escolhido: string): Promise<void> {
  const todos = navigator.mediaDevices?.enumerateDevices ? await navigator.mediaDevices.enumerateDevices().catch(() => []) : [];
  const lista = listarAparelhos(todos, (n) => `Microfone ${n}`);
  sel.replaceChildren(new Option('Padrão do sistema', ''), ...lista.map((a) => new Option(a.nome, a.id)));
  if (escolhido && !lista.some((a) => a.id === escolhido)) sel.append(new Option('Aparelho salvo (desconectado)', escolhido));
  sel.value = escolhido;
}
