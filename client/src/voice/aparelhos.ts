export interface AparelhoDeMic {
  id: string;
  nome: string;
}

/**
 * Os microfones que o navegador lista (P212). Sem permissão os nomes vêm vazios: vira "Microfone 1", "Microfone 2"… (`nomeGenerico` faz o texto). Fora os apelidos "default" e "communications"
 * do Chrome (o "Padrão do sistema" já é a primeira opção da lista). Módulo mínimo e estático: as Configurações o usam ao abrir; o resto do teste é pedaço sob demanda.
 */
/**
 * A "Mixagem estéreo" do Windows (e a "Stereo Mix", "What U Hear", o "loopback"…) **grava o som que o computador toca, não a voz**: aberta como microfone ela manda a música e a conversa dos outros programas
 * para a sala, ou silêncio (o Comandante a teve aberta no chat de voz em 21/10, nível 0,000). Nunca é um microfone do jogo.
 */
const MIXAGEM_DO_SISTEMA = /mixagem|stereo mix|st[eé]r[eé]o mix|mezcla est[eé]reo|what u hear|what you hear|wave out|loopback/i;

export function ehMixagemDoSistema(rotulo: string): boolean {
  return MIXAGEM_DO_SISTEMA.test(rotulo);
}

export function listarAparelhos(todos: readonly { kind: string; deviceId: string; label: string }[], nomeGenerico: (n: number) => string): AparelhoDeMic[] {
  const mics = todos.filter((d) => d.kind === 'audioinput' && d.deviceId !== '' && d.deviceId !== 'default' && d.deviceId !== 'communications' && !ehMixagemDoSistema(d.label));
  return mics.map((d, i) => ({ id: d.deviceId, nome: d.label.trim() || nomeGenerico(i + 1) }));
}
