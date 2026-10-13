import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linhaDoAjudante, rodarComando, soltarAjudanteDeReinicio, type ResultadoDoComando, type RodarComando } from './religar';

const SCRIPTS = resolve(import.meta.dirname, '..', 'scripts');
const AGORA = () => new Date('2026-10-12T23:30:00.000Z');

/** Um `rodar` falso: guarda o que foi pedido e responde na ordem dada. */
function falso(...respostas: Array<Partial<ResultadoDoComando>>) {
  const chamadas: Array<{ arquivo: string; args: string[]; esperaMs: number }> = [];
  const rodar: RodarComando = async (arquivo, args, esperaMs) => {
    chamadas.push({ arquivo, args, esperaMs });
    const r = respostas.shift() ?? { codigo: 0 };
    return { codigo: r.codigo === undefined ? 0 : r.codigo, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  };
  return { rodar, chamadas };
}

const base = (extra: Partial<Parameters<typeof soltarAjudanteDeReinicio>[0]> = {}) => ({ supervisionado: true, porta: 2567, scripts: SCRIPTS, plataforma: 'win32' as const, agora: AGORA, ...extra });

describe('o ajudante que religa o servidor depois de um REINICIAR (o Agendador não religa quem sai com código ≠ 0)', () => {
  it('sob a tarefa do Windows, pede ao WMI que crie o ajudante (fora da árvore do servidor) com o script, a porta e (se houver) a tarefa', async () => {
    const f = falso({ codigo: 0, stdout: '4321\r\n' });
    const logs: string[] = [];
    expect(await soltarAjudanteDeReinicio(base({ rodar: f.rodar, log: (l) => logs.push(l) }))).toBe('wmi');
    expect(f.chamadas).toHaveLength(1); // o plano B só entra se o WMI falhar
    const { arquivo, args, esperaMs } = f.chamadas[0]!;
    expect(arquivo).toBe('powershell.exe');
    expect(args.slice(0, 5)).toEqual(['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command']);
    const ps = args[5]!;
    expect(ps).toContain('Invoke-CimMethod -ClassName Win32_Process -MethodName Create');
    expect(ps).toContain(`-File "${resolve(SCRIPTS, 'religar-servidor.ps1')}" -Porta 2567`);
    expect(ps).not.toContain('-Tarefa');
    expect(ps).not.toContain('-Dados'); // sem pasta de dados informada, o script usa a dele
    expect(esperaMs).toBeGreaterThanOrEqual(10_000); // o PowerShell do WMI leva 1 a 3 s para subir
    expect(logs.join('\n')).toMatch(/lançado pelo WMI \(PID 4321\)/);
    const com = falso();
    await soltarAjudanteDeReinicio(base({ rodar: com.rodar, porta: 3000, tarefa: 'OUTRA TAREFA', dados: 'D:\\dados do servidor' }));
    // O processo do WMI não herda o ambiente: a pasta de dados vai na linha de comando.
    expect(com.chamadas[0]!.args[5]).toContain('-Porta 3000 -Dados "D:\\dados do servidor" -Tarefa "OUTRA TAREFA"');
  });

  it('a linha do ajudante vira um literal do PowerShell seguro: aspas simples no caminho são dobradas, e nada escapa da string', async () => {
    expect(linhaDoAjudante({ scripts: SCRIPTS, porta: 2567 })).toMatch(/^powershell\.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ".*religar-servidor\.ps1" -Porta 2567$/);
    const f = falso();
    await soltarAjudanteDeReinicio(base({ rodar: f.rodar, scripts: "D:\\o'neil\\scripts" }));
    const ps = f.chamadas[0]!.args[5]!;
    expect(ps).toContain("o''neil"); // a aspa simples do caminho foi dobrada
    expect(ps).toMatch(/CommandLine = '[^']*(?:''[^']*)*'/); // o literal fecha direito
  });

  it('o WMI falhou (código ≠ 0 ou não abriu): aciona a tarefa do atualizador, que religa o servidor que não responde, e diz isso', async () => {
    const f = falso({ codigo: 3, stderr: 'Win32_Process.Create devolveu 2' }, { codigo: 0 });
    const logs: string[] = [];
    expect(await soltarAjudanteDeReinicio(base({ rodar: f.rodar, log: (l) => logs.push(l) }))).toBe('atualizador');
    expect(f.chamadas.map((c) => c.arquivo)).toEqual(['powershell.exe', 'schtasks.exe']);
    expect(f.chamadas[1]!.args).toEqual(['/Run', '/TN', 'CYBERMECH atualizar']);
    expect(logs.join('\n')).toMatch(/o WMI não lançou o ajudante \(código 3\).*devolveu 2/s);
    expect(logs.join('\n')).toMatch(/acionei a tarefa "CYBERMECH atualizar"/);
    const nao = falso({ codigo: null, stderr: 'spawn powershell.exe ENOENT' }, { codigo: 0 });
    expect(await soltarAjudanteDeReinicio(base({ rodar: nao.rodar, tarefaDoAtualizador: 'OUTRA' }))).toBe('atualizador');
    expect(nao.chamadas[1]!.args).toEqual(['/Run', '/TN', 'OUTRA']);
  });

  it('nenhum dos dois deu: devolve null e diz que o vigia do atualizador (10 min) é o que resta; nunca lança', async () => {
    const f = falso({ codigo: null, stderr: 'estourou o tempo' }, { codigo: 1, stderr: 'ERRO: acesso negado' });
    const logs: string[] = [];
    expect(await soltarAjudanteDeReinicio(base({ rodar: f.rodar, log: (l) => logs.push(l) }))).toBeNull();
    expect(logs.join('\n')).toMatch(/não consegui acionar a tarefa.*acesso negado.*a cada 10 min/s);
    const lanca: RodarComando = async () => {
      throw new Error('explodiu');
    };
    // Até um `rodar` que lança vira falha, não derruba o reinício.
    expect(await soltarAjudanteDeReinicio(base({ rodar: lanca }))).toBeNull();
  });

  it('o `rodarComando` de verdade: devolve o código de saída, a saída, e nunca lança (programa que não existe e tempo estourado viram null)', async () => {
    const ok = await rodarComando(process.execPath, ['-e', 'console.log("oi"); console.error("aviso")'], 15_000);
    expect(ok).toMatchObject({ codigo: 0, stdout: expect.stringContaining('oi'), stderr: expect.stringContaining('aviso') });
    expect((await rodarComando(process.execPath, ['-e', 'process.exit(5)'], 15_000)).codigo).toBe(5);
    const naoExiste = await rodarComando('programa-que-nao-existe-12345', [], 5_000);
    expect(naoExiste.codigo).toBeNull();
    expect(naoExiste.stderr).toMatch(/ENOENT|nao-existe/);
    const demora = await rodarComando(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], 400);
    expect(demora.codigo).toBeNull(); // estourou o tempo: foi morto
  });

  it('rodando à mão (sem tarefa) ou fora do Windows, não faz nada: não há tarefa para ligar', async () => {
    const f = falso();
    expect(await soltarAjudanteDeReinicio(base({ rodar: f.rodar, supervisionado: false }))).toBeNull();
    expect(await soltarAjudanteDeReinicio(base({ rodar: f.rodar, plataforma: 'linux' as never }))).toBeNull();
    expect(await soltarAjudanteDeReinicio(base({ rodar: f.rodar, plataforma: 'darwin' as never }))).toBeNull();
    expect(f.chamadas).toHaveLength(0);
  });

  it('cada passo vai para o religar.log na pasta de dados, com a hora, para a próxima falha dizer onde parou', async () => {
    const dados = resolve('.tmp', 'religar-teste');
    rmSync(dados, { recursive: true, force: true });
    mkdirSync(dados, { recursive: true });
    try {
      await soltarAjudanteDeReinicio(base({ rodar: falso({ codigo: 3, stderr: 'ruim' }, { codigo: 0 }).rodar, dados }));
      const linhas = readFileSync(resolve(dados, 'religar.log'), 'utf8').trim().split('\n');
      expect(linhas).toHaveLength(2);
      expect(linhas[0]).toMatch(/^\[2026-10-12T23:30:00\.000Z\] servidor: o WMI não lançou o ajudante \(código 3\): ruim$/);
      expect(linhas[1]).toMatch(/^\[2026-10-12T23:30:00\.000Z\] servidor: acionei a tarefa "CYBERMECH atualizar"/);
      // Pasta que não existe: o log do arquivo falha em silêncio, o religamento segue.
      await expect(soltarAjudanteDeReinicio(base({ rodar: falso().rodar, dados: resolve(dados, 'nao-existe') }))).resolves.toBe('wmi');
    } finally {
      rmSync(dados, { recursive: true, force: true });
    }
  });
});

describe('o contrato dos scripts do ajudante (um erro de digitação aqui só aparece com o servidor fora do ar)', () => {
  const ler = (nome: string) => readFileSync(resolve(SCRIPTS, nome), 'utf8');

  it('religar-servidor.ps1 aceita os mesmos parâmetros que o servidor passa, espera a porta livre, liga pelo ligar-servidor.ps1 e registra em religar.log', () => {
    const s = ler('religar-servidor.ps1');
    expect(s).toMatch(/param\(\[string\]\$Tarefa = 'CYBERMECH servidor', \[int\]\$Porta = 2567, \[string\]\$Dados\)/);
    expect(s).toMatch(/Get-NetTCPConnection -LocalPort \$Porta -State Listen/);
    expect(s).toMatch(/ligar-servidor\.ps1" -Tarefa \$Tarefa -Porta \$Porta/);
    expect(s).toContain("'religar.log'");
    expect(s).toContain('CYBERMECH_DADOS');
    expect(s.charCodeAt(0), 'com BOM, como os outros scripts (o PowerShell 5.1 lê os acentos)').toBe(0xfeff);
  });

  it('o ligar-servidor.ps1 que ele chama tem os mesmos parâmetros', () => {
    expect(ler('ligar-servidor.ps1')).toMatch(/param\(\[string\]\$Tarefa = 'CYBERMECH servidor', \[int\]\$Porta = 2567\)/);
  });

  it('o main.ts lança o ajudante e SÓ DEPOIS fecha o servidor e sai', () => {
    const main = readFileSync(resolve(import.meta.dirname, 'main.ts'), 'utf8');
    const gancho = main.slice(main.indexOf('aoReiniciar:'), main.indexOf('log: (line)'));
    const lancar = gancho.indexOf('soltarAjudanteDeReinicio(');
    expect(lancar).toBeGreaterThan(-1);
    expect(lancar).toBeLessThan(gancho.indexOf('server.close()'));
    expect(gancho.indexOf('server.close()')).toBeLessThan(gancho.indexOf('process.exit(CODIGO_REINICIO)', gancho.indexOf('.finally(')));
    expect(gancho, 'a pasta de dados para o religar.log').toContain('dados: pastaDados(');
  });
});
