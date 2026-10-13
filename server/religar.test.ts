import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { soltarAjudanteDeReinicio } from './religar';

const SCRIPTS = resolve(import.meta.dirname, '..', 'scripts');

/** Um `spawn` falso: guarda o que foi pedido e devolve um filho que sabe `on` e `unref`. */
function falso() {
  const chamadas: Array<{ cmd: string; args: string[]; opcoes: Record<string, unknown> }> = [];
  const filho = Object.assign(new EventEmitter(), { unref: vi.fn() });
  const spawn = ((cmd: string, args: string[], opcoes: Record<string, unknown>) => {
    chamadas.push({ cmd, args, opcoes });
    return filho;
  }) as never;
  return { spawn, chamadas, filho };
}

describe('o ajudante que religa o servidor depois de um REINICIAR (o Agendador não religa quem sai com código ≠ 0)', () => {
  it('sob a tarefa do Windows, solta um PowerShell separado, sem janela, que sobrevive à saída, com o script, a porta e (se houver) a tarefa', () => {
    const f = falso();
    const log = vi.fn();
    expect(soltarAjudanteDeReinicio({ supervisionado: true, porta: 2567, scripts: SCRIPTS, plataforma: 'win32', spawn: f.spawn, log })).toBe(true);
    expect(f.chamadas).toHaveLength(1);
    const { cmd, args, opcoes } = f.chamadas[0]!;
    expect(cmd).toBe('powershell.exe');
    expect(args).toEqual(['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve(SCRIPTS, 'religar-servidor.ps1'), '-Porta', '2567']);
    expect(opcoes).toMatchObject({ detached: true, stdio: 'ignore', windowsHide: true });
    expect(f.filho.unref).toHaveBeenCalledTimes(1); // sem isto o servidor esperaria o ajudante para sair
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/ajudante de reinício solto/));
    const outra = falso();
    soltarAjudanteDeReinicio({ supervisionado: true, porta: 3000, scripts: SCRIPTS, tarefa: 'OUTRA TAREFA', plataforma: 'win32', spawn: outra.spawn });
    expect(outra.chamadas[0]!.args.slice(-4)).toEqual(['-Porta', '3000', '-Tarefa', 'OUTRA TAREFA']);
  });

  it('rodando à mão (sem tarefa) ou fora do Windows, não solta nada: não há tarefa para ligar', () => {
    const f = falso();
    expect(soltarAjudanteDeReinicio({ supervisionado: false, porta: 2567, scripts: SCRIPTS, plataforma: 'win32', spawn: f.spawn })).toBe(false);
    expect(soltarAjudanteDeReinicio({ supervisionado: true, porta: 2567, scripts: SCRIPTS, plataforma: 'linux', spawn: f.spawn })).toBe(false);
    expect(soltarAjudanteDeReinicio({ supervisionado: true, porta: 2567, scripts: SCRIPTS, plataforma: 'darwin', spawn: f.spawn })).toBe(false);
    expect(f.chamadas).toHaveLength(0);
  });

  it('se não conseguir abrir o PowerShell (lança, ou o filho avisa erro depois), diz no log e não derruba o reinício', () => {
    const log = vi.fn();
    const lanca = (() => {
      throw new Error('powershell.exe não existe');
    }) as never;
    expect(soltarAjudanteDeReinicio({ supervisionado: true, porta: 2567, scripts: SCRIPTS, plataforma: 'win32', spawn: lanca, log })).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/não consegui soltar o ajudante.*powershell\.exe não existe/));
    const f = falso();
    expect(soltarAjudanteDeReinicio({ supervisionado: true, porta: 2567, scripts: SCRIPTS, plataforma: 'win32', spawn: f.spawn, log })).toBe(true);
    expect(() => f.filho.emit('error', new Error('EACCES'))).not.toThrow(); // sem ouvinte, um 'error' derrubaria o processo
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/o ajudante de reinício não abriu: EACCES/));
  });
});

describe('o contrato dos scripts do ajudante (um erro de digitação aqui só aparece com o servidor fora do ar)', () => {
  const ler = (nome: string) => readFileSync(resolve(SCRIPTS, nome), 'utf8');

  it('religar-servidor.ps1 aceita os mesmos parâmetros que o servidor passa, espera a porta livre, liga pelo ligar-servidor.ps1 e registra em religar.log', () => {
    const s = ler('religar-servidor.ps1');
    expect(s).toMatch(/param\(\[string\]\$Tarefa = 'CYBERMECH servidor', \[int\]\$Porta = 2567\)/);
    expect(s).toMatch(/Get-NetTCPConnection -LocalPort \$Porta -State Listen/);
    expect(s).toMatch(/ligar-servidor\.ps1" -Tarefa \$Tarefa -Porta \$Porta/);
    expect(s).toContain("'religar.log'");
    expect(s).toContain('CYBERMECH_DADOS');
    expect(s.charCodeAt(0), 'com BOM, como os outros scripts (o PowerShell 5.1 lê os acentos)').toBe(0xfeff);
  });

  it('o ligar-servidor.ps1 que ele chama tem os mesmos parâmetros', () => {
    expect(ler('ligar-servidor.ps1')).toMatch(/param\(\[string\]\$Tarefa = 'CYBERMECH servidor', \[int\]\$Porta = 2567\)/);
  });

  it('o main.ts solta o ajudante no gancho de reinício, antes de fechar e sair', () => {
    const main = readFileSync(resolve(import.meta.dirname, 'main.ts'), 'utf8');
    const gancho = main.slice(main.indexOf('aoReiniciar:'), main.indexOf('log: (line)'));
    expect(gancho).toContain('soltarAjudanteDeReinicio(');
    expect(gancho.indexOf('soltarAjudanteDeReinicio(')).toBeLessThan(gancho.indexOf('process.exit(CODIGO_REINICIO)'));
  });
});
