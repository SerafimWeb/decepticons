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
  if (v.estadoMic === 'negado') return 'O navegador bloqueou o microfone neste site: clique no cadeado ao lado do endereço, permita o microfone e recarregue.';
  if (v.estadoMic === 'sem') return 'O jogo não conseguiu abrir um microfone: confira o aparelho em Configurações > GRÁFICOS E SOM e use [ TESTAR ].';
  if (e.pilotos.length === 0) return 'Você está sozinho na sala: ninguém para ouvir. Entre com outra pessoa.';
  if (v.ligacoes.length === 0) return `Há ${e.pilotos.length} na sala, mas nenhum está na voz: a outra pessoa precisa de conta de maior de 18 anos com "Conversar por voz" ligado (convidado e menor não entram).`;
  const falhou = v.ligacoes.filter((l) => l.estado === 'falhou');
  if (falhou.length > 0) return 'A rede não deixou a conexão direta com um colega (firewall, roteador ou rede da empresa). O jogo ainda não tem servidor de retransmissão para esses casos.';
  const conectando = v.ligacoes.filter((l) => l.estado === 'conectando');
  if (conectando.length === v.ligacoes.length) return 'Conectando com os colegas: aguarde alguns segundos. Se ficar assim, a rede está bloqueando a conexão direta.';
  if (v.mudo) return 'O seu microfone está MUDO: aperte a tecla de voz (T) para abrir.';
  if (!v.transmitindo) return 'O seu microfone está em "segurar para falar": segure a tecla de voz (T) enquanto fala.';
  const semEnvio = v.ligacoes.filter((l) => l.estado === 'conectada' && l.enviados === 0);
  if (semEnvio.length === v.ligacoes.length) return 'Conectado, mas o seu microfone não enviou nenhum áudio: teste o aparelho em Configurações > GRÁFICOS E SOM (pode estar mudo no Windows).';
  const semRecebe = v.ligacoes.filter((l) => l.estado === 'conectada' && l.recebidos === 0 && l.enviados > 0);
  if (semRecebe.length > 0) return 'O seu áudio sai, mas nada chega de volta: o colega pode estar mudo, sem microfone ou com o som do jogo desligado.';
  return 'Tudo certo por aqui: a voz está ligada e o áudio está indo e vindo. Se mesmo assim não se ouvem, confira o volume da voz e o som do computador de quem escuta.';
}

export function formatarDiagnostico(e: EntradaDoDiagnostico): string {
  const v = e.voz;
  const L: string[] = [];
  L.push(`DIAGNÓSTICO DA VOZ · CYBERMECH · ${e.agora}`);
  L.push(`navegador: ${e.navegador}`);
  L.push(`sala online: ${sn(e.online)} · conta: ${e.eleg === 'liberada' ? 'maior de 18 anos' : e.eleg} · "Conversar por voz": ${sn(e.voiceOn)}`);
  if (!v) {
    L.push('voz: não carregada (a conta não pode usar a voz, ou ela está desligada, ou não há sala online)');
  } else {
    L.push(`voz: ${v.ativa ? 'na sala' : 'FORA da sala'} · eu = ${v.meuId >= 0 ? `#${v.meuId}` : '—'} · token da conta: ${sn(v.token)}`);
    L.push(
      `microfone: ${v.estadoMic} · aparelho: "${v.rotulo || '—'}" · ${v.taxa ? `${v.taxa} Hz` : '? Hz'} · eco/ruído/ganho do navegador: ${v.eco}/${v.ruido}/${v.ganho} · modo ${v.modo} · mudo ${sn(v.mudo)} · transmitindo ${sn(v.transmitindo)}`,
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
