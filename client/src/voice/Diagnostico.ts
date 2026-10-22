import { VOZ_SO_PARA_ADULTO_DECLARADO } from '../../../shared/net/auth';
import type { ElegibilidadeDaVoz, MotivoSemVoz } from './elegibilidade';
import type { DiagnosticoDaVoz } from './VoiceChat';

/**
 * O DIAGNÓSTICO DA VOZ (P237, ordem do Comandante em 20/10: o microfone funcionava no teste e a voz não chegava ao outro PC, e **nada na tela dizia por quê**). Junta num texto o que decide se a voz
 * funciona (a conta, a sala, o microfone, quem está na voz e por qual rota de rede cada ligação foi) e fecha com uma **CONCLUSÃO** em português: a causa mais provável e o que fazer. O botão das
 * Configurações mostra e copia o texto para o jogador colar numa conversa. Texto puro, sem DOM e sem custo (só roda quando alguém pede); pedaço sob demanda.
 */
export interface EntradaDoDiagnostico {
  /** A hora, ISO: sem ela o relatório colado numa conversa não diz de quando é. */
  agora: string;
  navegador: string;
  /** Está numa sala online agora? */
  online: boolean;
  /** O código da sala e o mapa (dois PCs só se ouvem na mesma sala e no mesmo mapa), ou `null` fora de uma sala. */
  sala: string | null;
  /** A conta, em palavras: `convidado`, `sem idade informada`, `menor de 18 anos (só ouve)` ou `maior de 18 anos`. */
  conta: string;
  eleg: ElegibilidadeDaVoz;
  motivo: MotivoSemVoz | null;
  voiceOn: boolean;
  /** As outras pessoas da sala (só as de verdade, não os bots). */
  pilotos: readonly { id: number; nome: string }[];
  /** `null` quando o pedaço da voz nem foi carregado (a voz não vale para esta conta ou está desligada). */
  voz: DiagnosticoDaVoz | null;
}

const KB = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
const sn = (b: boolean): string => (b ? 'sim' : 'não');

/** A causa mais provável, na ordem em que ela costuma ser: sala, conta, voz ligada, microfone, colegas, rede, áudio. Só uma frase, a mais importante. */
export function concluirDiagnostico(e: EntradaDoDiagnostico): string {
  if (!e.online) return 'Você não está numa sala online: a voz só existe online. Abra ONLINE e entre numa sala com outra pessoa.';
  if (e.motivo === 'convidado') return 'Você está como convidado: a voz é só para conta de maior de 18 anos. Crie uma conta em Configurações > JOGO.';
  if (e.motivo === 'sem-idade') return 'A sua conta não tem a idade informada: informe o mês e o ano de nascimento em Configurações > JOGO.';
  if (e.motivo === 'menor') return 'A conta é de menor de 18 anos: a voz fica desligada (só o áudio do jogo).';
  if (e.motivo === 'desligada') return 'A voz está desligada: marque "Conversar por voz" em Configurações > GRÁFICOS E SOM.';
  const v = e.voz;
  if (!v || !v.ativa) return 'A voz ainda não entrou na sala. Espere alguns segundos; se continuar, saia e entre de novo na sala.';
  // Quem só ouve (conta de menor, P241) não tem microfone: as conclusões do microfone não valem para ela.
  const fala = v.podeFalar;
  if (fala && v.estadoMic === 'negado') return 'O navegador bloqueou o microfone neste site: clique no cadeado ao lado do endereço, permita o microfone e recarregue.';
  if (fala && v.soMixagem) return 'O único aparelho de entrada que o navegador achou é a "Mixagem estéreo", que grava o som do computador e não a sua voz (o jogo a recusa para não mandar o som do PC aos outros). Ligue o microfone ou o fone e escolha-o em Configurações > GRÁFICOS E SOM.';
  if (fala && v.estadoMic === 'sem') return 'O jogo não conseguiu abrir um microfone: confira o aparelho em Configurações > GRÁFICOS E SOM e use [ TESTAR ].';
  // O microfone abre, mas não chega som (o que o Comandante viveu em 20/10): vem antes de "sozinho" e de "rede", porque com o microfone mudo nada mais adianta.
  if (fala && v.saude === 'sem-entrega') return 'O navegador diz que o microfone parou de entregar som (o fone Bluetooth caiu, o aparelho foi desligado ou outro programa o pegou): confira o fone e o teste de entrada do Windows. O jogo tenta reabrir sozinho.';
  if (fala && v.saude === 'sem-som') return 'O microfone está aberto mas entrega silêncio total há vários segundos: confira o botão de mudo do próprio fone, se o fone está no modo microfone (no Bluetooth, mãos-livres) e o teste do Windows (Configurações > Sistema > Som > Entrada).';
  if (e.pilotos.length === 0) return 'Você está sozinho na sala: ninguém para ouvir. Se a outra pessoa já entrou no jogo, vocês estão em salas ou mapas diferentes: compare a linha "sala online" deste relatório nos dois PCs (use o mesmo link, com o mesmo ?sala= e o mesmo mapa).';
  if (v.ligacoes.length === 0) return `Há ${e.pilotos.length} na sala, mas nenhum está na voz: a outra pessoa precisa estar com "Conversar por voz" ligado em Configurações${VOZ_SO_PARA_ADULTO_DECLARADO ? ' e ter conta de maior de 18 anos' : ''}.`;
  const falhou = v.ligacoes.filter((l) => l.estado === 'falhou');
  if (falhou.length > 0) return 'A rede não deixou a conexão direta com um colega (firewall, roteador ou rede da empresa). O jogo ainda não tem servidor de retransmissão para esses casos.';
  const conectando = v.ligacoes.filter((l) => l.estado === 'conectando');
  if (conectando.length === v.ligacoes.length) return 'Conectando com os colegas: aguarde alguns segundos. Se ficar assim, a rede está bloqueando a conexão direta.';
  if (fala && v.mudo) return 'O seu microfone está MUDO: aperte a tecla de voz (T) para abrir.';
  if (fala && !v.transmitindo) return 'O seu microfone está em "segurar para falar": segure a tecla de voz (T) enquanto fala.';
  const semEnvio = v.ligacoes.filter((l) => l.estado === 'conectada' && l.enviados === 0);
  if (fala && semEnvio.length === v.ligacoes.length) return 'Conectado, mas o seu microfone não enviou nenhum áudio: teste o aparelho em Configurações > GRÁFICOS E SOM (pode estar mudo no Windows).';
  if (!fala) return 'Conta de menor de 18 anos: o chat de voz só ouve, sem microfone. Está ligado com os colegas; se não os ouve, confira o volume da voz e o som do computador.';
  const semRecebe = v.ligacoes.filter((l) => l.estado === 'conectada' && l.recebidos === 0 && l.enviados > 0);
  if (semRecebe.length > 0) return 'O seu áudio sai, mas nada chega de volta: o colega pode estar mudo, sem microfone ou com o som do jogo desligado.';
  return 'Tudo certo por aqui: a voz está ligada e o áudio está indo e vindo. Se mesmo assim não se ouvem, confira o volume da voz e o som do computador de quem escuta.';
}

export function formatarDiagnostico(e: EntradaDoDiagnostico): string {
  const v = e.voz;
  const L: string[] = [];
  L.push(`DIAGNÓSTICO DA VOZ · CYBERMECH · ${e.agora}`);
  L.push(`navegador: ${e.navegador}`);
  L.push(`sala online: ${e.sala === null ? sn(e.online) : `sim (${e.sala})`} · conta: ${e.conta} · "Conversar por voz": ${sn(e.voiceOn)}`);
  if (!v) {
    L.push('voz: não carregada (a conta não pode usar a voz, ou ela está desligada, ou não há sala online)');
  } else {
    L.push(`voz: ${v.ativa ? 'na sala' : 'FORA da sala'} · eu = ${v.meuId >= 0 ? `#${v.meuId}` : '—'} · token da conta: ${sn(v.token)}`);
    L.push(
      `microfone: ${v.estadoMic} · aparelho: "${v.rotulo || '—'}" · ${v.taxa ? `${v.taxa} Hz` : '? Hz'} · eco/ruído/ganho do navegador: ${v.eco}/${v.ruido}/${v.ganho} · modo ${v.modo} · mudo ${sn(v.mudo)} · transmitindo ${sn(v.transmitindo)}`,
    );
    L.push(
      `envio: ganho x${v.ajusteDeGanho.toFixed(1)} · ${v.viaWebAudio ? 'por Web Audio' : 'faixa crua do navegador'} · nível ${v.nivel.toFixed(3)} · saúde ${v.saude}${v.faixaMuda ? ' · o navegador diz a faixa PARADA' : ''}${v.reaberturas > 0 ? ` · reaberturas automáticas: ${v.reaberturas}` : ''}`,
    );
    L.push(
      `canais: falando ${v.canal === null ? 'em nenhum (calado)' : v.canal === 'todos' ? 'para todos' : v.canal === 'time' ? 'só para o time' : 'só para o jogador escolhido'} · jogador escolhido: ${v.alvoPrivado === null ? 'ninguém' : (e.pilotos.find((p) => p.id === v.alvoPrivado)?.nome ?? `#${v.alvoPrivado}`)} · time: ${v.temTimes ? 'a sala tem times' : 'a sala NÃO tem times (o canal do time fica fechado)'} · canais ${v.canaisDisponiveis ? 'disponíveis' : 'INDISPONÍVEIS (sem o envio por Web Audio)'}`,
    );
    L.push(`na voz comigo: ${v.ligacoes.length} · ligados ${v.ligacoes.filter((l) => l.estado === 'conectada').length} · sem conexão ${v.ligacoes.filter((l) => l.estado === 'falhou').length}`);
    for (const l of v.ligacoes) {
      const nome = e.pilotos.find((p) => p.id === l.id)?.nome ?? `#${l.id}`;
      L.push(
        `  - ${nome}: ${l.estado} (conexão ${l.conexao || '?'}, ice ${l.ice || '?'}) · rota ${l.rota || '—'} · enviou ${KB(l.enviados)} · recebeu ${KB(l.recebidos)} · perdeu ${l.perdidos} pacote(s)${l.nivel === null ? '' : ` · nível de entrada ${l.nivel.toFixed(3)}`}`,
      );
    }
  }
  const fora = e.pilotos.filter((p) => !(v?.ligacoes.some((l) => l.id === p.id) ?? false) && !(v?.naLista.includes(p.id) ?? false));
  L.push(`na sala (sem contar você): ${e.pilotos.length}${e.pilotos.length ? ` — ${e.pilotos.map((p) => p.nome).join(', ')}` : ''}${fora.length ? ` · FORA da voz: ${fora.map((p) => p.nome).join(', ')}` : ''}`);
  L.push('');
  L.push(`CONCLUSÃO: ${concluirDiagnostico(e)}`);
  return L.join('\n');
}
