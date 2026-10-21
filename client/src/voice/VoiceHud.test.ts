import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarDicionario, IDIOMAS, traduzir, type Dicionario } from '../i18n/i18n';
import { estadoDoBotao, GLIFO_DO_BOTAO, textoDeCanal, textoDeEstado, textoDeRede, VoiceHud, type VozParaHud } from './VoiceHud';
import { TEXTO_SEM_VOZ } from './VozNasConfiguracoes';

const RAIZ = resolve(__dirname, '../..');

const vozC = (o: Partial<VozParaHud> = {}): VozParaHud => ({ ...voz(), ...o });
const voz = (o: { estadoMic?: VozParaHud['estadoMic']; mode?: 'sempre' | 'ptt'; mudo?: boolean; apertada?: boolean; semConexao?: number; colegas?: number } = {}): VozParaHud => ({
  ativa: true,
  estadoMic: o.estadoMic ?? 'ativo',
  ligados: 0,
  semConexao: o.semConexao ?? 0,
  colegas: o.colegas ?? 1,
  falando: () => new Set<number>(),
  aoBotao: () => {},
  saudeDoMic: () => 'ok',
  nivelDoMic: 0,
  canal: null,
  alvo: null,
  temTimes: false,
  canaisDisponiveis: true,
  mic: { mode: o.mode ?? 'sempre', mudo: o.mudo ?? false, apertada: o.apertada ?? false, transmitindo: false },
});

describe('VoiceHud: o que o jogador lê (P205)', () => {
  it('cada estado do microfone tem o seu texto, com o nome da tecla', () => {
    expect(textoDeEstado(voz({ estadoMic: 'pedindo' }), 'T')).toBe('PEDINDO O MICROFONE…');
    expect(textoDeEstado(voz({ estadoMic: 'negado' }), 'T')).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
    expect(textoDeEstado(voz({ estadoMic: 'sem' }), 'T')).toBe('SÓ OUVINDO: SEM MICROFONE');
    expect(textoDeEstado(voz({ mode: 'sempre' }), 'T')).toBe('MICROFONE ABERTO: [T] MUDA');
    expect(textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'V')).toBe('MUDO: [V] ABRE');
    expect(textoDeEstado(voz({ mode: 'ptt' }), 'T')).toBe('SEGURE [T] PARA FALAR');
    expect(textoDeEstado(voz({ mode: 'ptt', apertada: true }), 'T')).toBe('FALANDO');
    // P237: o microfone abriu mas o som não chega: a tela diz (e a saúde manda sobre o modo)
    expect(textoDeEstado(voz({ mode: 'sempre' }), 'T', false, 'sem-som')).toBe('SEM SOM NO MICROFONE: CONFIRA O BOTÃO DE MUDO DO FONE E O WINDOWS');
    expect(textoDeEstado(voz({ mode: 'ptt' }), 'T', false, 'sem-entrega')).toBe('O NAVEGADOR PAROU DE RECEBER O MICROFONE: CONFIRA O FONE E O WINDOWS');
    expect(textoDeEstado(voz({ mode: 'sempre' }), 'T', false, 'ok')).toBe('MICROFONE ABERTO: [T] MUDA');
    // sem microfone a saúde não conta: o texto é o do estado do microfone
    expect(textoDeEstado(voz({ estadoMic: 'sem' }), 'T', false, 'sem-som')).toBe('SÓ OUVINDO: SEM MICROFONE');
    expect(textoDeEstado(voz({ estadoMic: 'negado' }), 'T', false, 'sem-entrega')).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
  });

  it('no toque o texto fala do botão da tela (sem tecla), em cada modo (P209)', () => {
    expect(textoDeEstado(voz({ mode: 'sempre' }), 'T', true)).toBe('MICROFONE ABERTO');
    expect(textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'T', true)).toBe('MUDO');
    expect(textoDeEstado(voz({ mode: 'ptt' }), 'T', true)).toBe('SEGURE O BOTÃO PARA FALAR');
    expect(textoDeEstado(voz({ mode: 'ptt', apertada: true }), 'T', true)).toBe('FALANDO');
    // sem microfone o texto é o do aparelho, no toque ou fora dele
    expect(textoDeEstado(voz({ estadoMic: 'negado' }), 'T', true)).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
    expect(textoDeEstado(voz({ estadoMic: 'pedindo' }), 'T', true)).toBe('PEDINDO O MICROFONE…');
    // nenhum texto do toque cita uma tecla
    for (const o of [{ mode: 'sempre' as const }, { mode: 'sempre' as const, mudo: true }, { mode: 'ptt' as const }]) expect(textoDeEstado(voz(o), 'T', true)).not.toContain('[');
  });

  it('o botão de microfone da tela: no ar, mudo, em espera (segurar solto), pedindo e sem microfone, cada um com o seu símbolo (P209)', () => {
    expect(estadoDoBotao(voz({ mode: 'sempre' }))).toBe('no-ar');
    expect(estadoDoBotao(voz({ mode: 'sempre', mudo: true }))).toBe('mudo');
    expect(estadoDoBotao(voz({ mode: 'ptt' }))).toBe('espera');
    expect(estadoDoBotao(voz({ mode: 'ptt', apertada: true }))).toBe('no-ar');
    expect(estadoDoBotao(voz({ estadoMic: 'pedindo' }))).toBe('pedindo');
    expect(estadoDoBotao(voz({ estadoMic: 'negado' }))).toBe('sem');
    expect(estadoDoBotao(voz({ estadoMic: 'sem', mode: 'ptt', apertada: true }))).toBe('sem');
    expect(new Set(Object.values(GLIFO_DO_BOTAO)).size).toBeGreaterThanOrEqual(4);
    expect(GLIFO_DO_BOTAO.mudo).not.toBe(GLIFO_DO_BOTAO['no-ar']);
  });

  it('o aviso de rede só aparece quando alguém não conectou', () => {
    expect(textoDeRede(voz())).toBe('');
    expect(textoDeRede(voz({ semConexao: 2 }))).toBe('2 SEM CONEXÃO');
  });

  it('sozinho na voz o indicador avisa que ninguém vai ouvir e manda testar o microfone (P212: o "MICROFONE ABERTO" sozinho enganava)', () => {
    expect(textoDeRede(voz({ colegas: 0 }))).toBe('NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES');
    expect(textoDeRede(voz({ colegas: 1 }))).toBe('');
    // a falha de rede tem prioridade sobre o aviso de estar sozinho
    expect(textoDeRede(voz({ colegas: 2, semConexao: 1 }))).toBe('1 SEM CONEXÃO');
    // P237: com gente na sala fora da voz o motivo é outro, e o texto antigo mandava a pessoa testar o microfone que estava bom
    expect(textoDeRede(voz({ colegas: 0 }), 0)).toBe('NINGUÉM MAIS NA VOZ: TESTE O MICROFONE EM CONFIGURAÇÕES');
    expect(textoDeRede(voz({ colegas: 0 }), 2)).toBe('NINGUÉM MAIS NA VOZ: 2 NA SALA SEM VOZ (PRECISAM DE CONTA DE MAIOR DE 18 ANOS E VOZ LIGADA)');
    expect(textoDeRede(voz({ colegas: 1 }), 1)).toBe('1 NA SALA SEM VOZ');
    expect(textoDeRede(voz({ colegas: 1 }), 0)).toBe('');
    expect(textoDeRede(voz({ semConexao: 2, colegas: 0 }), 3), 'a conexão que falhou vem antes').toBe('2 SEM CONEXÃO');
  });

  it('sem microfone o modo e o mudo não importam: o estado é o do aparelho', () => {
    expect(textoDeEstado(voz({ estadoMic: 'negado', mode: 'ptt', apertada: true }), 'T')).toBe('SÓ OUVINDO: MICROFONE RECUSADO');
    expect(textoDeEstado(voz({ estadoMic: 'sem', mudo: true }), 'T')).toBe('SÓ OUVINDO: SEM MICROFONE');
  });
});

describe('o chat de voz nas seis línguas (P205)', () => {
  afterEach(() => carregarDicionario(null));

  const textosDoHud = [
    textoDeEstado(voz({ estadoMic: 'pedindo' }), 'T'),
    textoDeEstado(voz({ estadoMic: 'negado' }), 'T'),
    textoDeEstado(voz({ estadoMic: 'sem' }), 'T'),
    textoDeEstado(voz({ mode: 'sempre' }), 'T'),
    textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'T'),
    textoDeEstado(voz({ mode: 'ptt' }), 'T'),
    textoDeEstado(voz({ mode: 'ptt', apertada: true }), 'T'),
    textoDeEstado(voz({ mode: 'sempre' }), 'T', true),
    textoDeEstado(voz({ mode: 'sempre', mudo: true }), 'T', true),
    textoDeEstado(voz({ mode: 'ptt' }), 'T', true),
    textoDeRede(voz({ semConexao: 3 })),
    textoDeRede(voz({ colegas: 0 })),
    textoDeRede(voz({ colegas: 0 }), 2),
    textoDeEstado(voz(), 'T', false, 'sem-som'),
    textoDeEstado(voz(), 'T', false, 'sem-entrega'),
    'Ganho do microfone',
    textoDeCanal(vozC({ canal: 'time', temTimes: true }), undefined, { time: 'Y', privado: 'U', alvo: 'G' }),
    textoDeCanal(vozC({ canal: 'time', temTimes: false }), undefined, { time: 'Y', privado: 'U', alvo: 'G' }),
    textoDeCanal(vozC({ canal: 'privado' }), 'BRAVO', { time: 'Y', privado: 'U', alvo: 'G' }),
    textoDeCanal(vozC({ canal: 'privado' }), undefined, { time: 'Y', privado: 'U', alvo: 'G' }),
    textoDeCanal(vozC({ canal: null, colegas: 1 }), 'BRAVO', { time: 'Y', privado: 'U', alvo: 'G' }),
    'Chat de voz: falar só com o time',
    'Chat de voz: falar só com o jogador escolhido',
    'Chat de voz: trocar o jogador escolhido',
    'Sobe a sua voz para quem escuta, no teste e na gravação. Fones Bluetooth costumam pedir ganho; o teste do microfone sugere um valor.',
    textoDeRede(voz({ colegas: 1 }), 2),
    ...Object.values(TEXTO_SEM_VOZ),
    'Diagnóstico da voz',
    '[ VER E COPIAR ]',
    '[ COPIADO ]',
    'Se a voz não funciona entre dois jogadores: mostra o que está acontecendo e a causa mais provável.',
  ];

  for (const { id } of IDIOMAS.filter((i) => i.id !== 'pt')) {
    it(`${id}: todo texto do indicador está traduzido, e a tecla entra na frase`, () => {
      carregarDicionario(JSON.parse(readFileSync(resolve(RAIZ, `public/locales/${id}.json`), 'utf8')) as Dicionario);
      for (const texto of textosDoHud) expect(traduzir(texto), `${id}: "${texto}"`).not.toBe(texto);
      expect(traduzir('SEGURE [Y] PARA FALAR')).toContain('[Y]');
      expect(traduzir('3 SEM CONEXÃO')).toContain('3');
      expect(traduzir('2 NA SALA SEM VOZ')).toContain('2');
      expect(traduzir('NINGUÉM MAIS NA VOZ: 2 NA SALA SEM VOZ (PRECISAM DE CONTA DE MAIOR DE 18 ANOS E VOZ LIGADA)')).toContain('2');
    });
  }
});

/** Um elemento de mentira: o mínimo que o HUD usa (o teste roda no Node, sem DOM). */
function el(): Record<string, any> {
  const e: Record<string, any> = {
    className: '',
    hidden: false,
    textContent: '',
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
    classList: { toggle() {}, add() {}, remove() {} },
    append(...c: unknown[]) {
      e.children.push(...c);
    },
    setAttribute() {},
    addEventListener() {},
    setPointerCapture() {},
    remove() {},
  };
  e.ownerDocument = { body: { append() {} } };
  return e;
}

describe('VoiceHud: o desenho (P237): a saúde do microfone chega à tela', () => {
  afterEach(() => vi.unstubAllGlobals());

  function hud(o: { saude?: 'ok' | 'sem-som' | 'sem-entrega'; nivel?: number; transmitindo?: boolean; estadoMic?: VozParaHud['estadoMic'] } = {}) {
    vi.stubGlobal('document', { createElement: () => el() });
    const v: VozParaHud = {
      ...voz({ estadoMic: o.estadoMic }),
      saudeDoMic: () => o.saude ?? 'ok',
      nivelDoMic: o.nivel ?? 0,
      mic: { mode: 'sempre', mudo: false, apertada: false, transmitindo: o.transmitindo ?? true },
    };
    const h = new VoiceHud(el() as unknown as HTMLElement, v, () => undefined, () => 'T');
    h.atualizar(1000);
    const interno = h as unknown as { el: Record<string, any>; estado: Record<string, any>; nivelBarra: Record<string, any> };
    return { texto: interno.estado.textContent as string, classe: interno.el.className as string, barra: interno.nivelBarra.style.width as string | undefined };
  }

  it('microfone aberto e saudável: o texto de sempre, sem alerta', () => {
    const h = hud({ saude: 'ok' });
    expect(h.texto).toBe('MICROFONE ABERTO: [T] MUDA');
    expect(h.classe).toBe('voz-hud voz-no-ar');
  });

  it('silêncio total: o HUD diz "sem som no microfone" e acende o alerta', () => {
    const h = hud({ saude: 'sem-som' });
    expect(h.texto).toBe('SEM SOM NO MICROFONE: CONFIRA O BOTÃO DE MUDO DO FONE E O WINDOWS');
    expect(h.classe).toContain('voz-alerta');
  });

  it('o navegador parou de receber o microfone: outra frase, o mesmo alerta', () => {
    const h = hud({ saude: 'sem-entrega' });
    expect(h.texto).toBe('O NAVEGADOR PAROU DE RECEBER O MICROFONE: CONFIRA O FONE E O WINDOWS');
    expect(h.classe).toContain('voz-alerta');
  });

  it('a barra do nível anda de 5 em 5 por cento e fica em 0 sem microfone', () => {
    expect(hud({ nivel: 0.1 }).barra).toBe('65%'); // −20 dBFS = 66,7%: arredonda a 65
    expect(hud({ nivel: 1 }).barra).toBe('100%');
    expect(hud({ nivel: 0 }).barra).toBe('0%');
    expect(hud({ nivel: 0.5, estadoMic: 'sem' }).barra, 'sem microfone a barra não mostra nível').toBe('0%');
  });
});

describe('textoDeCanal (P237 PR 3): com quem se está falando', () => {
  const teclas = { time: 'Y', privado: 'U', alvo: 'G' };
  const v = (o: Partial<VozParaHud> = {}): VozParaHud => ({ ...voz(), ...o });

  it('falando só com o time: diz; sala sem times: diz que ninguém ouve (falha fechada)', () => {
    expect(textoDeCanal(v({ canal: 'time', temTimes: true }), undefined, teclas)).toBe('FALANDO SÓ PARA O TIME');
    expect(textoDeCanal(v({ canal: 'time', temTimes: false }), undefined, teclas)).toBe('SALA SEM TIMES: NINGUÉM OUVE O CANAL DO TIME');
  });

  it('falando só com um jogador: o nome dele; sem escolha, diz qual tecla escolhe', () => {
    expect(textoDeCanal(v({ canal: 'privado' }), 'BRAVO', teclas)).toBe('FALANDO SÓ PARA BRAVO');
    expect(textoDeCanal(v({ canal: 'privado' }), undefined, teclas)).toBe('SEM JOGADOR ESCOLHIDO: [G] ESCOLHE');
  });

  it('em "todos" ou calado, com colegas na voz: as teclas e o jogador escolhido; sem colegas ou sem canais, nada', () => {
    expect(textoDeCanal(v({ canal: 'todos', colegas: 2 }), 'BRAVO', teclas)).toBe('CANAIS [Y] TIME · [U] BRAVO · [G] TROCAR');
    expect(textoDeCanal(v({ canal: null, colegas: 1 }), undefined, teclas)).toBe('CANAIS [Y] TIME · [U] — · [G] TROCAR');
    expect(textoDeCanal(v({ canal: 'todos', colegas: 0 }), undefined, teclas)).toBe('');
    expect(textoDeCanal(v({ canal: 'todos', colegas: 2, canaisDisponiveis: false }), 'BRAVO', teclas)).toBe('');
  });

  it('as teclas que o jogador remapeou entram no texto', () => {
    expect(textoDeCanal(v({ canal: null, colegas: 1 }), 'BRAVO', { time: 'F', privado: 'R', alvo: 'X' })).toBe('CANAIS [F] TIME · [R] BRAVO · [X] TROCAR');
  });
});

describe('VoiceHud: os canais na tela (P237 PR 3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function hud(o: Partial<VozParaHud> = {}) {
    vi.stubGlobal('document', { createElement: () => el() });
    const v: VozParaHud = { ...voz(), ...o, mic: { mode: 'sempre', mudo: false, apertada: false, transmitindo: true } };
    const h = new VoiceHud(el() as unknown as HTMLElement, v, (id) => (id === 3 ? 'BRAVO' : undefined), () => 'T');
    h.atualizar(1000);
    const interno = h as unknown as { el: Record<string, any>; canal: Record<string, any> };
    return { classe: interno.el.className as string, canal: interno.canal.textContent as string };
  }

  it('falando só com o time: a linha e a borda do time acendem', () => {
    const h = hud({ canal: 'time', temTimes: true });
    expect(h.canal).toBe('FALANDO SÓ PARA O TIME');
    expect(h.classe).toContain('voz-no-time');
    expect(h.classe).not.toContain('voz-no-privado');
  });

  it('falando só com um jogador: o nome dele (do roster) e a borda do privado', () => {
    const h = hud({ canal: 'privado', alvo: 3 });
    expect(h.canal).toBe('FALANDO SÓ PARA BRAVO');
    expect(h.classe).toContain('voz-no-privado');
  });

  it('um alvo que o roster não conhece aparece pelo número', () => {
    expect(hud({ canal: 'privado', alvo: 9 }).canal).toBe('FALANDO SÓ PARA #9');
  });

  it('em "todos" nenhuma borda de canal, e com colegas a linha lembra as teclas', () => {
    const h = hud({ canal: 'todos', alvo: 3, colegas: 1 });
    expect(h.classe).not.toContain('voz-no-time');
    expect(h.classe).not.toContain('voz-no-privado');
    expect(h.canal).toBe('CANAIS [Y] TIME · [U] BRAVO · [G] TROCAR');
  });
});
