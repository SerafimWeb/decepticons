import { describe, expect, it } from 'vitest';
import { codificarEnviar, codificarReceber, lerEnviar, lerReceber, limparTexto, TEXTO, TEXTO_MAX_BYTES, TEXTO_MAX_CARACTERES } from '../shared/net/texto';
import { RelayDeTexto } from './texto';

describe('o texto do chat (P216): limpo no servidor e no cliente pela mesma regra', () => {
  it('sem controle, sem quebra de linha, sem inversão de direção; espaços juntos; no máximo 160 caracteres', () => {
    expect(limparTexto('  oi\n\ttudo   bem?  ')).toBe('oi tudo bem?');
    expect(limparTexto('a\u202Eb\u200Bc\u0000d')).toBe('a b c d'); // inverter a direção, largura zero e NUL viram espaço
    expect(limparTexto('\n\t \u2028')).toBe('');
    expect(Array.from(limparTexto('x'.repeat(500))).length).toBe(TEXTO_MAX_CARACTERES);
    expect(limparTexto('é ã ç 🎮')).toBe('é ã ç 🎮'); // acentos e emoji passam
  });

  it('o formato: [tipo][id][UTF-8]; o servidor lê limpo; lixo, vazio e UTF-8 torto não valem', () => {
    const b = codificarEnviar(5, 'olá, Dan')!;
    expect([b[0], b[1]]).toEqual([TEXTO.ENVIAR, 5]);
    expect(lerEnviar(b)).toEqual({ id: 5, texto: 'olá, Dan' });
    expect(codificarEnviar(5, ' \n ')).toBeNull(); // nada a mandar
    expect(lerEnviar(Uint8Array.of(TEXTO.ENVIAR, 1))).toBeNull(); // sem texto
    expect(lerEnviar(Uint8Array.of(TEXTO.ENVIAR, 1, 0xff, 0xfe))).toBeNull(); // UTF-8 torto
    expect(lerEnviar(Uint8Array.of(TEXTO.RECEBER, 1, 65))).toBeNull(); // o tipo errado
    expect(lerEnviar(new Uint8Array(3 + TEXTO_MAX_BYTES).fill(65).map((v, i) => (i === 0 ? TEXTO.ENVIAR : i === 1 ? 1 : v)))).toBeNull(); // grande demais
    const bruto = Uint8Array.of(TEXTO.ENVIAR, 2, ...new TextEncoder().encode('oi\u202E\n'));
    expect(lerEnviar(bruto)).toEqual({ id: 2, texto: 'oi' }); // o servidor limpa o que o cliente mandou sujo
    expect(lerReceber(codificarReceber(9, 'e aí'))).toEqual({ id: 9, texto: 'e aí' });
  });
});

describe('o relé do chat de texto: só repassa, com o remetente de verdade', () => {
  const sala = () => {
    const entregas: { para: number; bytes: Uint8Array }[] = [];
    let t = 0;
    const r = new RelayDeTexto<number>((para, bytes) => entregas.push({ para, bytes }), () => t);
    const achar = (id: number) => (id === 11 || id === 12 ? id * 100 : undefined); // pessoas 11 e 12 → conexões 1100 e 1200
    return { r, entregas, achar, avancar: (ms: number) => (t += ms) };
  };

  it('entrega ao destino com o id de quem mandou (o que o cliente diz que é não vale); a outra pessoa não recebe', () => {
    const { r, entregas, achar } = sala();
    expect(r.mensagem(1100, 11, codificarEnviar(12, 'oi, Bravo')!, achar)).toBe(true);
    expect(entregas).toHaveLength(1);
    expect(entregas[0]!.para).toBe(1200);
    expect(lerReceber(entregas[0]!.bytes)).toEqual({ id: 11, texto: 'oi, Bravo' }); // 11 é o id de verdade de quem mandou
  });

  it('descarta: destino que não existe (um bot, uma pessoa que saiu), mandar a si mesmo, mensagem torta', () => {
    const { r, entregas, achar } = sala();
    expect(r.mensagem(1100, 11, codificarEnviar(99, 'alô')!, achar)).toBe(false);
    expect(r.mensagem(1100, 11, codificarEnviar(11, 'eco')!, achar)).toBe(false);
    expect(r.mensagem(1100, 11, Uint8Array.of(TEXTO.ENVIAR, 12), achar)).toBe(false);
    expect(entregas).toHaveLength(0);
  });

  it('teto por jogador por janela: depois de 6 em 10 s o resto é cortado; a janela seguinte zera; sair da sala também', () => {
    const { r, entregas, achar, avancar } = sala();
    const manda = () => r.mensagem(1100, 11, codificarEnviar(12, 'spam')!, achar);
    for (let i = 0; i < 6; i++) expect(manda()).toBe(true);
    expect(manda()).toBe(false);
    expect(r.mensagem(1200, 12, codificarEnviar(11, 'ainda posso')!, achar)).toBe(true); // o teto é de quem manda, não da sala
    avancar(10_001);
    expect(manda()).toBe(true);
    for (let i = 0; i < 5; i++) manda();
    expect(manda()).toBe(false);
    r.sairDaSala(1100);
    expect(manda()).toBe(true);
    expect(entregas.length).toBe(6 + 1 + 6 + 1);
  });
});
