import { describe, expect, it } from 'vitest';
import { CHASSIS } from '../entities/chassis';
import { WEAPON_IDS } from '../combat/weapons';
import { ID_DE_FUNCIONALIDADE } from '../../../shared/visibilidade';
import { excecoes } from '../ui/VisibilidadePanel';
import { FUNCIONALIDADES, padraoDe } from './funcionalidades';
import { aplicarAoDom, sanearLink, Visibilidade, VISIBILIDADE_CACHE_KEY } from './Visibilidade';

describe('o catálogo de funcionalidades (P191)', () => {
  it('todo id é válido e único; todo robô e toda arma do jogo está no catálogo, já público (o padrão de hoje)', () => {
    const ids = FUNCIONALIDADES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(ID_DE_FUNCIONALIDADE.test(id), id).toBe(true);
    for (const c of Object.keys(CHASSIS)) expect(padraoDe(`chassi:${c.toLowerCase()}`), c).toBe('publico');
    for (const w of WEAPON_IDS) expect(padraoDe(`arma:${w}`), w).toBe('publico');
  });

  it('o que está em desenvolvimento nasce restrito (o LADO, o ARQUIVO e o RELATÓRIO); o que o catálogo não conhece nunca some do jogo', () => {
    for (const id of ['tela:lado', 'tela:arquivo', 'tela:relatorio']) expect(padraoDe(id), id).toBe('restrito');
    expect(padraoDe('coisa:que-nao-existe')).toBe('publico');
  });
});

describe('a visibilidade: o que o jogador vê e o que só o Comandante vê', () => {
  it('o jogador não vê o restrito; o Comandante vê tudo, com o selo de teste no restrito; "ver como jogador" esconde de novo', () => {
    const jogador = new Visibilidade(false);
    expect(jogador.visivel('tela:lado')).toBe(false);
    expect(jogador.visivel('tela:hangar')).toBe(true);
    const dono = new Visibilidade(true);
    expect(dono.visivel('tela:lado')).toBe(true);
    expect(dono.emTeste('tela:lado')).toBe(true);
    expect(dono.emTeste('tela:hangar')).toBe(false);
    dono.verComoJogador(true);
    expect(dono.visivel('tela:lado')).toBe(false);
  });

  it('a exceção do servidor vale sobre o padrão (liberar o que era restrito, segurar o que era público) e fica guardada no navegador', () => {
    const guardado = new Map<string, string>();
    const armazem = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v) };
    const v = new Visibilidade(false, armazem);
    let avisos = 0;
    v.aoMudar(() => avisos++);
    v.definir({ versao: 3, itens: { 'tela:lado': 'publico', 'mapa:amazonia': 'restrito' } });
    expect(v.visivel('tela:lado')).toBe(true);
    expect(v.visivel('mapa:amazonia')).toBe(false);
    expect(avisos).toBe(1);
    expect(guardado.has(VISIBILIDADE_CACHE_KEY)).toBe(true);
    // a próxima abertura, sem rede, lembra
    expect(new Visibilidade(false, armazem).visivel('mapa:amazonia')).toBe(false);
  });

  it('carregar do servidor: aplica a resposta; fora do ar, resposta torta ou sem servidor, o jogo segue com o que tinha (nunca lança)', async () => {
    const ok = (corpo: unknown, status = 200) => (async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;
    const v = new Visibilidade(false);
    expect(await v.carregar('ws://localhost:2567', ok({ protocol: 20, players: 0, visibilidade: { versao: 2, itens: { 'tela:lado': 'publico' } } }))).toBe(true);
    expect(v.visivel('tela:lado')).toBe(true);
    expect(await v.carregar('ws://localhost:2567', ok({}, 500))).toBe(false);
    expect(await v.carregar('ws://localhost:2567', ok({ protocol: 20, players: 0 }))).toBe(false); // servidor antigo: o /status sem o campo
    expect(await v.carregar('ws://localhost:2567', (async () => { throw new Error('rede'); }) as unknown as typeof fetch)).toBe(false);
    expect(await v.carregar(undefined, ok({}))).toBe(false);
    expect(v.visivel('tela:lado')).toBe(true); // a falha não apagou o que já valia
  });

  it('o link de uma fase ou de um modo restrito volta ao padrão para o jogador; o Comandante não é filtrado', () => {
    const v = new Visibilidade(false);
    v.definir({ versao: 1, itens: { 'mapa:amazonia': 'restrito', 'modo:ctf': 'restrito' } });
    expect(sanearLink('?mapa=amazonia&modo=survival&lang=en', v)).toBe('modo=survival&lang=en');
    expect(sanearLink('?modo=ctf', v)).toBe('');
    expect(sanearLink('?mapa=praia&modo=survival', v)).toBeNull();
    const dono = new Visibilidade(true);
    dono.definir({ versao: 1, itens: { 'mapa:amazonia': 'restrito' } });
    expect(sanearLink('?mapa=amazonia', dono)).toBeNull();
  });

  it('o DOM: o restrito some (func-oculta) para o jogador; para o Comandante aparece com o selo (func-teste)', () => {
    const elemento = (id: string) => {
      const classes = new Set<string>();
      return { dataset: { func: id }, classes, classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } };
    };
    const a = elemento('tela:lado');
    const b = elemento('tela:hangar');
    const raiz = { querySelectorAll: () => [a, b] } as unknown as ParentNode;
    aplicarAoDom(new Visibilidade(false), raiz);
    expect([a.classes.has('func-oculta'), b.classes.has('func-oculta')]).toEqual([true, false]);
    aplicarAoDom(new Visibilidade(true), raiz);
    expect([a.classes.has('func-oculta'), a.classes.has('func-teste'), b.classes.has('func-teste')]).toEqual([false, true, false]);
  });
});

describe('o painel: só as exceções ao padrão vão ao servidor', () => {
  it('o que está igual ao padrão do código não é enviado; o que difere é', () => {
    expect(excecoes({ 'tela:lado': 'restrito', 'tela:arquivo': 'publico', 'mapa:amazonia': 'restrito', 'tela:hangar': 'publico' })).toEqual({ 'tela:arquivo': 'publico', 'mapa:amazonia': 'restrito' });
  });
});
