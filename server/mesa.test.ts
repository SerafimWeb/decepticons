import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { ARQUIVO_DA_MESA, decidir, mensagem, PORTA_DA_MESA, portaEscutando, URL_DA_MESA } from '../scripts/mesa.mjs';

/**
 * `npm run mesa` (12/10): liga a mesa de vídeo local. A decisão é pura (o que existe na máquina, se a porta já está ocupada); a conversa com a porta
 * é testada com um servidor de verdade numa porta livre. O que não se testa aqui: subir o editor e abrir o navegador (é a mesa, fora do git).
 */
describe('npm run mesa: a decisão', () => {
  it('sem a mesa instalada, não há o que ligar (mesmo que a porta responda: é outro programa)', () => {
    expect(decidir({ existe: false, escutando: false })).toBe('sem-mesa');
    expect(decidir({ existe: false, escutando: true })).toBe('sem-mesa');
  });

  it('com a mesa instalada e a porta ocupada, ela já está ligada: só abre o navegador', () => {
    expect(decidir({ existe: true, escutando: true })).toBe('ja-ligada');
  });

  it('com a mesa instalada e a porta livre, liga', () => {
    expect(decidir({ existe: true, escutando: false })).toBe('ligar');
  });

  it('cada caso tem a sua mensagem, e as que levam ao navegador dizem o endereço', () => {
    expect(mensagem('sem-mesa')).toContain(ARQUIVO_DA_MESA);
    expect(mensagem('ja-ligada')).toContain(URL_DA_MESA);
    expect(mensagem('ligar')).toContain(URL_DA_MESA);
    expect(mensagem('ligar')).toMatch(/Ctrl\+C/);
  });

  it('o endereço é local (a mesa nunca escuta fora da máquina) e a porta é a de sempre', () => {
    expect(PORTA_DA_MESA).toBe(4199);
    expect(URL_DA_MESA).toBe('http://127.0.0.1:4199/.tmp/video/editor.html');
    expect(ARQUIVO_DA_MESA.replace(/\\/g, '/')).toBe('.tmp/video/servir.mjs');
  });
});

describe('npm run mesa: a porta', () => {
  it('uma porta com servidor responde "escutando"; uma porta livre, não', async () => {
    const srv = createServer();
    await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
    const porta = (srv.address() as { port: number }).port;
    expect(await portaEscutando(porta)).toBe(true);
    await new Promise<void>((ok) => srv.close(() => ok()));
    expect(await portaEscutando(porta)).toBe(false);
  });
});
