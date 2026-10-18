import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { lerFimDoLog } from './admin';
import { arquivoDoRegistro, arquivosDoRegistro, REGISTRO_DIAS, REGISTRO_PASTA, Registro } from './registro';

/** O registro técnico do servidor (P187, LGPD): um arquivo por dia, apagado sozinho depois de 30 dias. */
describe('Registro: um arquivo por dia e a poda dos 30 dias', () => {
  const raiz = resolve('.tmp', `teste-registro-${process.pid}`);
  let pasta: string;
  let n = 0;
  beforeEach(() => {
    pasta = join(raiz, `t${n++}`);
    rmSync(pasta, { recursive: true, force: true });
  });
  afterAll(() => rmSync(raiz, { recursive: true, force: true }));
  /** 18/10/2026, 12:00 em Brasília (15:00 UTC). */
  const HOJE = Date.UTC(2026, 9, 18, 15, 0);
  const DIA = 86_400_000;
  const vazio = (nome: string) => writeFileSync(join(pasta, nome), 'x\n');

  it('escreve a linha no arquivo do dia de Brasília, com a hora na frente, e cria a pasta sozinho', () => {
    const r = new Registro(pasta, () => HOJE);
    r.escrever('[servidor] sala ARENA aberta');
    r.escrever('[servidor] outra');
    expect(arquivosDoRegistro(pasta)).toEqual([arquivoDoRegistro('2026-10-18')]);
    const linhas = readFileSync(join(pasta, 'servidor-2026-10-18.log'), 'utf8').trimEnd().split('\n');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatch(/^\d{2}:\d{2}:\d{2} \[servidor\] sala ARENA aberta$/);
  });

  it('a virada do dia é a de Brasília (às 03:00 UTC), não a do UTC', () => {
    const antes = new Registro(pasta, () => Date.parse('2026-10-18T02:59:59Z'));
    antes.escrever('a');
    const depois = new Registro(pasta, () => Date.parse('2026-10-18T03:00:00Z'));
    depois.escrever('b');
    expect(arquivosDoRegistro(pasta)).toEqual(['servidor-2026-10-17.log', 'servidor-2026-10-18.log']);
  });

  it('podar apaga os dias de mais de 30 dias (pelo dia do nome) e guarda os outros; o resto da pasta ninguém toca', () => {
    mkdirSync(pasta, { recursive: true });
    vazio('servidor-2026-09-17.log'); // 31 dias atrás: sai
    vazio('servidor-2026-09-18.log'); // 30 dias atrás: fica (o limite)
    vazio('servidor-2026-10-18.log');
    vazio('servidor-antigo.log'); // não é do registro
    vazio('leia-me.txt');
    const r = new Registro(pasta, () => HOJE);
    expect(r.podar()).toEqual(['servidor-2026-09-17.log']);
    expect(readdirSync(pasta).sort()).toEqual(['leia-me.txt', 'servidor-2026-09-18.log', 'servidor-2026-10-18.log', 'servidor-antigo.log']);
    expect(REGISTRO_DIAS).toBe(30);
    // com o tempo andando, o do limite também sai
    expect(new Registro(pasta, () => HOJE + DIA).podar()).toEqual(['servidor-2026-09-18.log']);
  });

  it('podar numa pasta que não existe devolve vazio, sem lançar', () => {
    expect(new Registro(join(pasta, 'nao-existe'), () => HOJE).podar()).toEqual([]);
  });

  it('nunca lança: com a "pasta" ocupada por um arquivo a linha se perde e o servidor segue', () => {
    mkdirSync(raiz, { recursive: true });
    const arquivo = join(raiz, 'sou-um-arquivo');
    writeFileSync(arquivo, 'x');
    const r = new Registro(join(arquivo, 'registro'), () => HOJE);
    expect(() => r.escrever('linha')).not.toThrow();
    expect(() => r.podar()).not.toThrow();
  });

  it('se a pasta some no meio, a próxima linha a recria', () => {
    const r = new Registro(pasta, () => HOJE);
    r.escrever('a');
    rmSync(pasta, { recursive: true, force: true });
    r.escrever('perdida'); // a escrita falha: não há pasta
    r.escrever('b');
    expect(existsSync(join(pasta, 'servidor-2026-10-18.log'))).toBe(true);
    expect(readFileSync(join(pasta, 'servidor-2026-10-18.log'), 'utf8')).toContain(' b');
  });

  it('o painel lê o fim do registro (hoje e, se hoje é curto, o dia anterior) em vez do servidor.log; sem registro, o servidor.log de antes', () => {
    const dados = join(pasta, 'dados');
    mkdirSync(join(dados, REGISTRO_PASTA), { recursive: true });
    writeFileSync(join(dados, 'servidor.log'), '[servidor] do log da tarefa\r\n');
    expect(lerFimDoLog(dados, ['memória']).linhas).toEqual(['[servidor] do log da tarefa']); // pasta do registro vazia: o log antigo
    writeFileSync(join(dados, REGISTRO_PASTA, 'servidor-2026-10-17.log'), '10:00:00 ontem 1\n10:00:01 ontem 2\n');
    writeFileSync(join(dados, REGISTRO_PASTA, 'servidor-2026-10-18.log'), '08:00:00 hoje 1\n');
    const l = lerFimDoLog(dados, ['memória']);
    expect(l.fonte).toBe('arquivo');
    expect(l.linhas).toEqual(['10:00:00 ontem 1', '10:00:01 ontem 2', '08:00:00 hoje 1']);
    expect(l.linhas.join('\n')).not.toContain('log da tarefa');
  });
});
