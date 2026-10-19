export interface AparelhoDeMic {
  id: string;
  nome: string;
}

/**
 * Os microfones que o navegador lista (P212). Sem permissão os nomes vêm vazios: vira "Microfone 1", "Microfone 2"… (`nomeGenerico` faz o texto). Fora os apelidos "default" e "communications"
 * do Chrome (o "Padrão do sistema" já é a primeira opção da lista). Módulo mínimo e estático: as Configurações o usam ao abrir; o resto do teste é pedaço sob demanda.
 */
export function listarAparelhos(todos: readonly { kind: string; deviceId: string; label: string }[], nomeGenerico: (n: number) => string): AparelhoDeMic[] {
  const mics = todos.filter((d) => d.kind === 'audioinput' && d.deviceId !== '' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  return mics.map((d, i) => ({ id: d.deviceId, nome: d.label.trim() || nomeGenerico(i + 1) }));
}
