import { describe, expect, it } from 'vitest';
import type { Narracao, Sotaque } from './falas';
import { Narrador, type PlayerDeVoz } from './Narrador';

/** Um player de mentira: guarda o que foi pedido e tocado; `prontos` são os clipes que já "baixaram". */
function montar(opcoes: { narracao: Narracao; geradas?: string[]; prontos?: string[]; duracao?: number; sorteio?: number; reserva?: boolean }) {
  const pedidos: string[] = [];
  const tocados: string[] = [];
  const reservas: string[] = [];
  const prontos = new Set(opcoes.prontos ?? []);
  const geradas = new Set(opcoes.geradas ?? []);
  let agora = 0;
  let narracao = opcoes.narracao;
  const player: PlayerDeVoz = {
    pronto: (n) => prontos.has(n),
    pedir: (n, url) => { pedidos.push(`${n} <- ${url}`); },
    tocar: (n) => { tocados.push(n); return opcoes.duracao ?? 1; },
  };
  const narrador = new Narrador({
    player,
    narracao: () => narracao,
    gerada: (s: Sotaque, chave: string) => geradas.has(`${s}/${chave}`),
    base: '/jogar/',
    agora: () => agora,
    sorteio: () => opcoes.sorteio ?? 0,
    reserva: opcoes.reserva === false ? undefined : (t) => { reservas.push(t); return true; },
  });
  return {
    narrador, pedidos, tocados, reservas, prontos,
    passa: (s: number) => { agora += s; },
    escolhe: (n: Narracao) => { narracao = n; },
  };
}

describe('Narrador (P146)', () => {
  it('sem narrador (off) não fala nada, nem pela reserva', () => {
    const t = montar({ narracao: 'off', geradas: ['br/combate'], prontos: ['br/combate'] });
    expect(t.narrador.dizer('combate', 3)).toBe(false);
    expect(t.tocados).toEqual([]);
    expect(t.reservas).toEqual([]);
  });

  it('toca o clipe do sotaque escolhido quando está pronto', () => {
    const t = montar({ narracao: 'ru', geradas: ['ru/combate'], prontos: ['ru/combate'] });
    expect(t.narrador.dizer('combate', 3)).toBe(true);
    expect(t.tocados).toEqual(['ru/combate']);
    expect(t.reservas).toEqual([]);
  });

  it('fala desconhecida não toca', () => {
    const t = montar({ narracao: 'br', geradas: ['br/combate'], prontos: ['br/combate'] });
    expect(t.narrador.dizer('nao_existe', 3)).toBe(false);
  });

  it('sem clipe gerado: português cai na voz do navegador (sem pedir arquivo, sem 404)', () => {
    const t = montar({ narracao: 'br' });
    expect(t.narrador.dizer('rodada_2', 3)).toBe(true);
    expect(t.reservas).toEqual(['Rodada dois']);
    expect(t.pedidos).toEqual([]);
  });

  it('sem clipe gerado e com sotaque estrangeiro: fica mudo (a voz do navegador não tem sotaque) e não pede arquivo', () => {
    const t = montar({ narracao: 'cn' });
    expect(t.narrador.dizer('combate', 3)).toBe(false);
    expect(t.reservas).toEqual([]);
    expect(t.pedidos).toEqual([]);
  });

  it('clipe gerado mas ainda baixando: pede o arquivo e, em português, usa a reserva desta vez (só na abertura da rodada)', () => {
    const t = montar({ narracao: 'br', geradas: ['br/rodada_2'] });
    expect(t.narrador.dizer('rodada_2', 3)).toBe(true);
    expect(t.pedidos).toEqual(['br/rodada_2 <- /jogar/audio/vozes/br/rodada_2.mp3']);
    expect(t.reservas).toEqual(['Rodada dois']);
  });

  it('abate, morte e missão sem clipe ficam MUDOS (a voz robótica do navegador não anuncia o que antes era silêncio)', () => {
    const t = montar({ narracao: 'br', geradas: ['br/voce_morreu'] });
    for (const chave of ['voce_morreu', 'abate_3', 'estacao_segura', 'rede_caiu', 'hostis_chegando']) expect(t.narrador.dizer(chave, 3), chave).toBe(false);
    expect(t.reservas).toEqual([]);
    const mix = montar({ narracao: 'mix' });
    expect(mix.narrador.dizer('abate_2', 2)).toBe(false);
    expect(mix.reservas).toEqual([]);
  });

  it('enquanto uma fala toca, só entra outra de prioridade MAIOR; passado o tempo, qualquer uma', () => {
    const t = montar({ narracao: 'en', geradas: ['en/combate', 'en/abate_2', 'en/voce_morreu'], prontos: ['en/combate', 'en/abate_2', 'en/voce_morreu'], duracao: 2 });
    expect(t.narrador.dizer('combate', 3)).toBe(true);
    t.passa(0.5);
    expect(t.narrador.dizer('abate_2', 2)).toBe(false); // menos importante: espera
    expect(t.narrador.dizer('voce_morreu', 3)).toBe(false); // igual: não interrompe
    t.passa(2);
    expect(t.narrador.dizer('abate_2', 2)).toBe(true); // acabou
    expect(t.tocados).toEqual(['en/combate', 'en/abate_2']);
  });

  it('a mesma fala não repete em menos de 1,2 s', () => {
    const t = montar({ narracao: 'en', geradas: ['en/abate_2'], prontos: ['en/abate_2'], duracao: 0.3 });
    expect(t.narrador.dizer('abate_2', 2)).toBe(true);
    t.passa(0.5);
    expect(t.narrador.dizer('abate_2', 2)).toBe(false);
    t.passa(1);
    expect(t.narrador.dizer('abate_2', 2)).toBe(true);
  });

  it('no modo mistura sorteia só entre os sotaques cujo clipe está pronto', () => {
    const geradas = ['br/combate', 'en/combate', 'ru/combate', 'cn/combate'];
    const prontos = ['en/combate', 'cn/combate'];
    const primeiro = montar({ narracao: 'mix', geradas, prontos, sorteio: 0 });
    primeiro.narrador.dizer('combate', 3);
    expect(primeiro.tocados).toEqual(['en/combate']);
    const ultimo = montar({ narracao: 'mix', geradas, prontos, sorteio: 0.99 });
    ultimo.narrador.dizer('combate', 3);
    expect(ultimo.tocados).toEqual(['cn/combate']);
  });

  it('preparar() pede só o núcleo que já foi gerado, só dos sotaques escolhidos', () => {
    const t = montar({ narracao: 'ru', geradas: ['ru/combate', 'ru/rodada_1', 'ru/rodada_7', 'en/combate'] });
    t.narrador.preparar();
    // rodada_7 não é do núcleo; en/combate não é o sotaque escolhido
    expect(t.pedidos.sort()).toEqual([
      'ru/combate <- /jogar/audio/vozes/ru/combate.mp3',
      'ru/rodada_1 <- /jogar/audio/vozes/ru/rodada_1.mp3',
    ]);
    const mudo = montar({ narracao: 'off', geradas: ['br/combate'] });
    mudo.narrador.preparar();
    expect(mudo.pedidos).toEqual([]);
  });

  it('a escolha do jogador vale na hora (sem recriar o narrador)', () => {
    const t = montar({ narracao: 'br', geradas: ['br/combate', 'cn/combate'], prontos: ['br/combate', 'cn/combate'], duracao: 0.2 });
    t.narrador.dizer('combate', 3);
    t.passa(2);
    t.escolhe('cn');
    t.narrador.dizer('combate', 3);
    expect(t.tocados).toEqual(['br/combate', 'cn/combate']);
  });
});
