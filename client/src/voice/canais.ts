/**
 * OS CANAIS DE VOZ (P237 PR 3, ordem do Comandante em 20/10: "eu quero poder escolher é: se falo só com meu time, se falo para todos ouvirem, ou se falo com um jogador escolhido!").
 * Três canais, escolhidos pela tecla que está apertada: **todos** (a tecla de sempre: aberto ou segurar), **time** (segurar a tecla do time) e **privado** (segurar a tecla do jogador escolhido).
 * Enquanto uma tecla de canal está apertada o áudio vai **só** a quem o canal permite, e não aos demais, mesmo com o microfone "sempre aberto". Regra pura, sem DOM e sem Web Audio (testável):
 * o `VoiceChat` abre ou fecha a porta de cada colega no `EnvioDeVoz` conforme `permite`.
 *
 * **Falha fechada:** na dúvida ninguém ouve. Sala sem times, jogador escolhido que saiu: a tecla do canal não fala com ninguém (nunca vira "todos" por engano: quem pediu "só o meu time" não pode ser
 * ouvido pela sala). **Limite honesto:** quem decide é o cliente de quem fala (o áudio vai direto de um navegador a outro, o servidor só repassa a sinalização): um cliente adulterado pode falar com
 * quem quiser. O servidor decide quem entra na voz (conta de maior de 18 anos), não quem ouve quem.
 */
export type Canal = 'todos' | 'time' | 'privado';

export interface RegrasDoCanal {
  /** O time de um colega, ou `null` quando a sala não tem times (hoje o servidor ainda não os atribui: o canal "time" fica fechado). */
  timeDe(id: number): number | null;
  /** O meu time (`null` = sem time). */
  meuTime: number | null;
  /** O jogador do canal privado (`null` = ninguém escolhido). */
  alvo: number | null;
}

/** Em qual canal estou falando agora: o privado vale mais que o do time, e o do time mais que o de todos (apertar uma tecla de canal tira a voz do canal aberto); `null` = calado. */
export function canalDe(todos: boolean, time: boolean, privado: boolean): Canal | null {
  if (privado) return 'privado';
  if (time) return 'time';
  return todos ? 'todos' : null;
}

/** O colega `id` ouve o que sai agora? `todos` (e ninguém falando, quando a faixa está desligada) deixa a porta aberta; `time` e `privado` só abrem para quem o canal escolhe. */
export function permite(canal: Canal | null, id: number, r: RegrasDoCanal): boolean {
  switch (canal) {
    case 'time':
      return r.meuTime !== null && r.timeDe(id) === r.meuTime;
    case 'privado':
      return r.alvo !== null && id === r.alvo;
    default:
      return true;
  }
}

/** O próximo alvo do canal privado entre os colegas na voz (em ordem de id, voltando ao primeiro): sem escolha, ou com o escolhido fora da lista, o primeiro; ninguém na voz, `null`. */
export function proximoAlvo(ids: readonly number[], atual: number | null): number | null {
  if (ids.length === 0) return null;
  const ordem = [...ids].sort((a, b) => a - b);
  const i = atual === null ? -1 : ordem.indexOf(atual);
  return ordem[(i + 1) % ordem.length] ?? null;
}
