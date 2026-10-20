import type { IdadeDaConta } from '../../../shared/net/auth';

/**
 * Quem pode usar o chat de voz (P211, ordem do Comandante em 19/10: "menores de 18 anos NÃO TÊM ACESSO ao microfone nem aos áudios dos outros jogadores, apenas o áudio do jogo").
 * Só conta de maior de 18 anos: convidado (sem conta), conta sem idade informada e conta de menor ficam sem o microfone e sem a voz dos outros. O servidor decide de verdade
 * (`server/voz.ts` confere o token da sessão); isto só diz à tela o que mostrar. Sem DOM, sem custo.
 */
export type ElegibilidadeDaVoz = 'liberada' | 'convidado' | 'sem-idade' | 'menor';

export function elegibilidadeDaVoz(logado: boolean, idade: IdadeDaConta): ElegibilidadeDaVoz {
  if (!logado) return 'convidado';
  return idade === 'adulto' ? 'liberada' : idade;
}

/** A frase de cada caso (em português; o tradutor de DOM cuida das outras línguas). */
export const TEXTO_DA_ELEGIBILIDADE: Record<Exclude<ElegibilidadeDaVoz, 'liberada'>, string> = {
  convidado: 'O chat de voz é só para quem tem conta e é maior de 18 anos. Crie uma conta na aba JOGO e informe o mês e o ano de nascimento.',
  'sem-idade': 'Informe o mês e o ano de nascimento da sua conta (aba JOGO) para liberar o chat de voz. Ele é só para maiores de 18 anos.',
  menor: 'O chat de voz não está disponível para contas de menores de 18 anos: sem microfone e sem a voz dos outros jogadores. O áudio do jogo segue normal.',
};

/**
 * O chat de voz liga? As três condições juntas: o jogador quer (Configurações), o Comandante liberou a funcionalidade (`tela:voz`) **e a conta é de maior de 18 anos** (P211).
 * Qualquer `idade` que não seja `adulto` (inclusive a sessão ainda não restaurada, `undefined`) mantém a voz desligada: na dúvida, desligada.
 */
export function vozDeveLigar(querOJogador: boolean, liberadaPeloDono: boolean, idade: IdadeDaConta | undefined): boolean {
  return querOJogador && liberadaPeloDono && idade === 'adulto';
}

/**
 * O botão que leva direto ao que falta (P226: o Comandante abriu a voz, só viu uma frase e não achou o formulário, no fim de outra aba): convidado cria a conta, conta sem idade informa a idade.
 * O menor não tem botão (não há o que fazer) e quem já pode usar a voz também não.
 */
export const TEXTO_DO_BOTAO_DA_VOZ: Partial<Record<ElegibilidadeDaVoz, string>> = {
  convidado: '[ CRIAR CONTA ]',
  'sem-idade': '[ INFORMAR MINHA IDADE ]',
};
