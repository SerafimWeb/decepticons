import { afterEach, describe, expect, it } from 'vitest';
import { Contas } from './contas';

describe('Contas (SQLite embutido do Node)', () => {
  let contas: Contas;
  afterEach(() => contas?.close());
  const nova = () => (contas = new Contas(':memory:'));

  it('cria uma conta e autentica com a senha certa', async () => {
    nova();
    const r = await contas.criar('dan@x.com', 'senhasegura');
    expect(r.ok).toBe(true);
    const conta = await contas.autenticar('dan@x.com', 'senhasegura');
    expect(conta?.email).toBe('dan@x.com');
  });

  it('senha errada não autentica', async () => {
    nova();
    await contas.criar('dan@x.com', 'senhasegura');
    expect(await contas.autenticar('dan@x.com', 'senhaerrada')).toBeNull();
  });

  it('e-mail que não existe não autentica (e não lança)', async () => {
    nova();
    expect(await contas.autenticar('ninguem@x.com', 'qualquercoisa')).toBeNull();
  });

  it('não deixa criar duas contas com o mesmo e-mail', async () => {
    nova();
    await contas.criar('dan@x.com', 'senhasegura');
    const r = await contas.criar('dan@x.com', 'outrasenha');
    expect(r).toEqual({ ok: false, motivo: 'existe' });
  });

  it('a senha nunca fica em texto no banco', async () => {
    nova();
    await contas.criar('dan@x.com', 'senhasegura');
    // Acesso direto ao banco (só no teste) para confirmar que o valor gravado não é a senha crua.
    const row = (contas as unknown as { db: { prepare: (s: string) => { get: (e: string) => { hash: string } } } }).db
      .prepare('SELECT hash FROM contas WHERE email = ?')
      .get('dan@x.com');
    expect(row.hash).not.toContain('senhasegura');
    expect(row.hash).toMatch(/^[0-9a-f]+$/);
  });

  it('sessão: criar, validar e encerrar', async () => {
    nova();
    const r = await contas.criar('dan@x.com', 'senhasegura');
    if (!r.ok) throw new Error('deveria ter criado');
    const token = contas.criarSessao(r.conta.id);
    expect(contas.validarSessao(token)?.email).toBe('dan@x.com');
    contas.encerrarSessao(token);
    expect(contas.validarSessao(token)).toBeNull();
  });

  it('token inventado não valida nada', async () => {
    nova();
    expect(contas.validarSessao('token-que-nao-existe')).toBeNull();
  });

  it('encerrar uma sessão que não existe não lança (idempotente)', () => {
    nova();
    expect(() => contas.encerrarSessao('nada-aqui')).not.toThrow();
  });

  it('limparExpiradas tira só o que já venceu', async () => {
    nova();
    const r = await contas.criar('dan@x.com', 'senhasegura');
    if (!r.ok) throw new Error('deveria ter criado');
    const token = contas.criarSessao(r.conta.id);
    expect(contas.limparExpiradas()).toBe(0); // recém-criada, não venceu
    expect(contas.validarSessao(token)).not.toBeNull();
  });
});
