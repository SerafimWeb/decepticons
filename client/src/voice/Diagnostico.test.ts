import { describe, expect, it } from 'vitest';
import { concluirDiagnostico, type EntradaDoDiagnostico, formatarDiagnostico } from './Diagnostico';
import type { DiagnosticoDaVoz, DiagnosticoDeLigacao } from './VoiceChat';

const ligacao = (o: Partial<DiagnosticoDeLigacao> = {}): DiagnosticoDeLigacao => ({ id: 3, estado: 'conectada', conexao: 'connected', ice: 'connected', rota: 'host/udp → host', enviados: 4096, recebidos: 4096, perdidos: 0, nivel: 0.02, ...o });
const voz = (o: Partial<DiagnosticoDaVoz> = {}): DiagnosticoDaVoz => ({
  ativa: true,
  meuId: 1,
  token: true,
  estadoMic: 'ativo',
  rotulo: 'Fone (Captain 300)',
  taxa: 16000,
  eco: 'sim',
  ruido: 'sim',
  ganho: 'sim',
  modo: 'sempre',
  mudo: false,
  transmitindo: true,
  naLista: [3],
  ligacoes: [ligacao()],
  ajusteDeGanho: 1,
  viaWebAudio: true,
  saude: 'ok',
  nivel: 0.04,
  faixaMuda: false,
  reaberturas: 0,
  canal: 'todos',
  alvoPrivado: null,
  temTimes: false,
  canaisDisponiveis: true,
  ...o,
});
const entrada = (o: Partial<EntradaDoDiagnostico> = {}): EntradaDoDiagnostico => ({
  agora: '2026-10-20T20:00:00.000Z',
  navegador: 'Brave 155',
  online: true,
  eleg: 'liberada',
  motivo: null,
  voiceOn: true,
  pilotos: [{ id: 3, nome: 'BRAVO' }],
  voz: voz(),
  ...o,
});

describe('concluirDiagnostico (P237): a causa mais provável, na ordem em que ela costuma ser', () => {
  it('fora de uma sala online: a voz só existe online (o que o Comandante perguntou)', () => {
    expect(concluirDiagnostico(entrada({ online: false, voz: null }))).toContain('só existe online');
  });

  it('cada motivo da conta tem a sua frase, e vem antes de qualquer coisa de rede', () => {
    expect(concluirDiagnostico(entrada({ motivo: 'convidado', eleg: 'convidado', voz: null }))).toContain('convidado');
    expect(concluirDiagnostico(entrada({ motivo: 'sem-idade', eleg: 'sem-idade', voz: null }))).toContain('idade');
    expect(concluirDiagnostico(entrada({ motivo: 'menor', eleg: 'menor', voz: null }))).toContain('menor de 18');
    expect(concluirDiagnostico(entrada({ motivo: 'desligada', voz: null }))).toContain('Conversar por voz');
  });

  it('microfone: recusado pelo navegador e ausente têm frases diferentes', () => {
    expect(concluirDiagnostico(entrada({ voz: voz({ estadoMic: 'negado' }) }))).toContain('bloqueou o microfone');
    expect(concluirDiagnostico(entrada({ voz: voz({ estadoMic: 'sem' }) }))).toContain('não conseguiu abrir um microfone');
  });

  it('o microfone abre mas não chega som: silêncio total e faixa parada têm frases diferentes, e vêm antes de "sozinho" e de "rede"', () => {
    const semSom = concluirDiagnostico(entrada({ voz: voz({ saude: 'sem-som' }) }));
    expect(semSom).toContain('silêncio total');
    expect(semSom).toContain('botão de mudo do próprio fone');
    const parou = concluirDiagnostico(entrada({ voz: voz({ saude: 'sem-entrega', faixaMuda: true }) }));
    expect(parou).toContain('parou de entregar som');
    expect(parou).toContain('reabrir sozinho');
    // com o microfone mudo, nem "sozinho na sala" nem "rede" importam
    expect(concluirDiagnostico(entrada({ pilotos: [], voz: voz({ saude: 'sem-som', ligacoes: [] }) }))).toContain('silêncio total');
    expect(concluirDiagnostico(entrada({ voz: voz({ saude: 'sem-som', ligacoes: [ligacao({ estado: 'falhou' })] }) }))).toContain('silêncio total');
  });

  it('sozinho na sala; e com gente na sala mas ninguém na voz (o outro PC sem conta de adulto)', () => {
    expect(concluirDiagnostico(entrada({ pilotos: [], voz: voz({ ligacoes: [] }) }))).toContain('sozinho na sala');
    const c = concluirDiagnostico(entrada({ pilotos: [{ id: 3, nome: 'BRAVO' }], voz: voz({ ligacoes: [], naLista: [] }) }));
    expect(c).toContain('nenhum está na voz');
    expect(c).toContain('conta de maior de 18 anos');
  });

  it('rede: a ligação que falhou, e a que ainda está conectando', () => {
    expect(concluirDiagnostico(entrada({ voz: voz({ ligacoes: [ligacao({ estado: 'falhou' })] }) }))).toContain('servidor de retransmissão');
    expect(concluirDiagnostico(entrada({ voz: voz({ ligacoes: [ligacao({ estado: 'conectando' })] }) }))).toContain('Conectando');
  });

  it('o seu microfone: mudo, em "segurar para falar", e conectado mas sem enviar nada', () => {
    expect(concluirDiagnostico(entrada({ voz: voz({ mudo: true, transmitindo: false }) }))).toContain('MUDO');
    expect(concluirDiagnostico(entrada({ voz: voz({ modo: 'ptt', transmitindo: false }) }))).toContain('segurar para falar');
    expect(concluirDiagnostico(entrada({ voz: voz({ ligacoes: [ligacao({ enviados: 0, recebidos: 0 })] }) }))).toContain('não enviou nenhum áudio');
  });

  it('sai mas não chega nada de volta; e tudo certo quando o áudio vai e volta', () => {
    expect(concluirDiagnostico(entrada({ voz: voz({ ligacoes: [ligacao({ enviados: 9000, recebidos: 0 })] }) }))).toContain('nada chega de volta');
    expect(concluirDiagnostico(entrada())).toContain('Tudo certo');
  });
});

describe('formatarDiagnostico (P237): o relatório que o jogador copia e cola', () => {
  it('traz a hora, a conta, o microfone, cada ligação com a rota e a conclusão', () => {
    const texto = formatarDiagnostico(entrada());
    expect(texto).toContain('2026-10-20T20:00:00.000Z');
    expect(texto).toContain('Brave 155');
    expect(texto).toContain('conta: maior de 18 anos');
    expect(texto).toContain('aparelho: "Fone (Captain 300)"');
    expect(texto).toContain('16000 Hz');
    expect(texto).toContain('BRAVO: conectada');
    expect(texto).toContain('rota host/udp → host');
    expect(texto).toContain('enviou 4.0 KB');
    expect(texto).toContain('CONCLUSÃO: Tudo certo');
  });

  it('sem o pedaço da voz carregado, diz que não carregou e conclui pelo motivo da conta', () => {
    const texto = formatarDiagnostico(entrada({ voz: null, motivo: 'convidado', eleg: 'convidado' }));
    expect(texto).toContain('voz: não carregada');
    expect(texto).toContain('conta: convidado');
    expect(texto).toContain('CONCLUSÃO: Você está como convidado');
  });

  it('aponta quem da sala está FORA da voz, pelo nome', () => {
    const texto = formatarDiagnostico(entrada({ pilotos: [{ id: 3, nome: 'BRAVO' }, { id: 7, nome: 'CHARLIE' }], voz: voz() }));
    expect(texto).toContain('FORA da voz: CHARLIE');
    expect(texto).not.toContain('FORA da voz: BRAVO');
  });

  it('mostra o envio: o ganho, se vai por Web Audio ou pela faixa crua, o nível, a saúde e as reaberturas', () => {
    const texto = formatarDiagnostico(entrada({ voz: voz({ ajusteDeGanho: 2.5, nivel: 0.0712, saude: 'sem-som', faixaMuda: true, reaberturas: 3 }) }));
    expect(texto).toContain('ganho x2.5');
    expect(texto).toContain('por Web Audio');
    expect(texto).toContain('nível 0.071');
    expect(texto).toContain('saúde sem-som');
    expect(texto).toContain('faixa PARADA');
    expect(texto).toContain('reaberturas automáticas: 3');
    expect(formatarDiagnostico(entrada({ voz: voz({ viaWebAudio: false }) }))).toContain('faixa crua do navegador');
    expect(formatarDiagnostico(entrada())).not.toContain('reaberturas automáticas');
  });

  it('mostra os canais: em qual fala, o jogador escolhido (pelo nome), se a sala tem times e se os canais funcionam', () => {
    const base = formatarDiagnostico(entrada());
    expect(base).toContain('canais: falando para todos');
    expect(base).toContain('jogador escolhido: ninguém');
    expect(base).toContain('a sala NÃO tem times (o canal do time fica fechado)');
    expect(base).toContain('canais disponíveis');
    const privado = formatarDiagnostico(entrada({ voz: voz({ canal: 'privado', alvoPrivado: 3, temTimes: true }) }));
    expect(privado).toContain('falando só para o jogador escolhido');
    expect(privado).toContain('jogador escolhido: BRAVO');
    expect(privado).toContain('a sala tem times');
    expect(formatarDiagnostico(entrada({ voz: voz({ canal: 'time' }) }))).toContain('falando só para o time');
    expect(formatarDiagnostico(entrada({ voz: voz({ canal: null }) }))).toContain('falando em nenhum (calado)');
    expect(formatarDiagnostico(entrada({ voz: voz({ canaisDisponiveis: false }) }))).toContain('INDISPONÍVEIS (sem o envio por Web Audio)');
  });

  it('o nível de entrada só aparece quando o navegador o deu', () => {
    expect(formatarDiagnostico(entrada({ voz: voz({ ligacoes: [ligacao({ nivel: null })] }) }))).not.toContain('nível de entrada');
    expect(formatarDiagnostico(entrada())).toContain('nível de entrada 0.020');
  });
});
