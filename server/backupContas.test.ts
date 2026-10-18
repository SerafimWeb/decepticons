import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aposentar, BACKUPS_PASTA, fazerBackup, GUARDAR, nomeDoBackup } from './backupContas';
import { Contas } from './contas';
import { startServer } from './Server';

describe('a cópia de segurança das contas', () => {
  const pastas: string[] = [];
  const abertas: Contas[] = [];
  const pasta = (): string => {
    const p = mkdtempSync(join(tmpdir(), 'cybermech-backup-'));
    pastas.push(p);
    return p;
  };
  afterEach(() => {
    for (const c of abertas.splice(0)) c.close();
    for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
  });

  it('o nome é do dia (em UTC), então a rodada seguinte do mesmo dia troca a cópia pela mais nova', () => {
    expect(nomeDoBackup(new Date('2026-10-17T23:59:59Z'))).toBe('contas-2026-10-17.db');
    expect(nomeDoBackup(new Date('2026-10-18T00:00:01Z'))).toBe('contas-2026-10-18.db');
  });

  it('guarda as mais novas e aposenta as mais velhas, sem tocar em arquivo que não é cópia', () => {
    const nomes = ['contas-2026-10-01.db', 'contas-2026-10-03.db', 'contas-2026-10-02.db', 'LEIA-ME.txt', 'contas-antigo.db', 'contas-2026-10-04.db'];
    expect(aposentar(nomes, 2)).toEqual(['contas-2026-10-01.db', 'contas-2026-10-02.db']);
    expect(aposentar(nomes, 10)).toEqual([]);
    expect(aposentar([], 3)).toEqual([]);
    expect(GUARDAR).toBeGreaterThanOrEqual(7); // pelo menos uma semana: um erro percebido na segunda ainda tem a cópia de sexta
  });

  it('a cópia é um banco de verdade: abre e traz as contas, a senha e o progresso', async () => {
    const dados = pasta();
    const banco = new Contas(join(dados, 'contas.db'));
    abertas.push(banco);
    const r = await banco.criar('piloto@x.com', 'senhasegura');
    expect(r.ok).toBe(true);
    if (r.ok) banco.gravarProgresso(r.conta.id, '{"nivel":7}');
    const feito = fazerBackup(banco, dados, new Date('2026-10-17T12:00:00Z'));
    expect(feito.arquivo).toBe(join(dados, BACKUPS_PASTA, 'contas-2026-10-17.db'));
    const copia = new Contas(feito.arquivo);
    abertas.push(copia);
    expect(copia.total()).toBe(1);
    const conta = await copia.autenticar('piloto@x.com', 'senhasegura');
    expect(conta?.email).toBe('piloto@x.com');
    expect(copia.lerProgresso(conta!.id)).toBe('{"nivel":7}');
  });

  it('a segunda rodada do mesmo dia substitui a cópia (a mais nova vale), e passar do limite apaga a mais velha', async () => {
    const dados = pasta();
    const banco = new Contas(join(dados, 'contas.db'));
    abertas.push(banco);
    await banco.criar('a@x.com', 'senhasegura');
    fazerBackup(banco, dados, new Date('2026-10-17T06:00:00Z'), 2);
    await banco.criar('b@x.com', 'senhasegura');
    fazerBackup(banco, dados, new Date('2026-10-17T18:00:00Z'), 2);
    const mesmoDia = new Contas(join(dados, BACKUPS_PASTA, 'contas-2026-10-17.db'));
    expect(mesmoDia.total()).toBe(2);
    mesmoDia.close(); // no Windows um arquivo aberto não se apaga
    fazerBackup(banco, dados, new Date('2026-10-18T06:00:00Z'), 2);
    const r = fazerBackup(banco, dados, new Date('2026-10-19T06:00:00Z'), 2);
    expect(r.apagados).toEqual(['contas-2026-10-17.db']);
    expect(readdirSync(join(dados, BACKUPS_PASTA)).sort()).toEqual(['contas-2026-10-18.db', 'contas-2026-10-19.db']);
  });

  it('o servidor faz a cópia ao subir', async () => {
    const dados = pasta();
    const s = await startServer({ port: 0, host: '127.0.0.1', dbContas: join(dados, 'contas.db'), dirDados: dados, backupCadaMs: 3_600_000 });
    await s.close();
    const copias = readdirSync(join(dados, BACKUPS_PASTA));
    expect(copias).toHaveLength(1);
    expect(copias[0]).toMatch(/^contas-\d{4}-\d{2}-\d{2}\.db$/);
  });

  it('com o banco em memória (testes) o servidor sobe e fecha sem tentar copiar nada', async () => {
    const mem = await startServer({ port: 0, host: '127.0.0.1', dbContas: ':memory:' });
    await expect(mem.close()).resolves.toBeUndefined();
  });

  it('um nome de arquivo com apóstrofo não quebra o SQL da cópia', async () => {
    const dados = pasta();
    const banco = new Contas(join(dados, 'contas.db'));
    abertas.push(banco);
    writeFileSync(join(dados, 'x'), '');
    const estranho = join(dados, "o'piloto.db");
    banco.copiarPara(estranho);
    expect(existsSync(estranho)).toBe(true);
  });
});
