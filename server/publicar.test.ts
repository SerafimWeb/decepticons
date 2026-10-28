import { describe, expect, it } from 'vitest';
import { esconder, falhouPorAutenticacao, gh, tokenDoGit } from '../scripts/ghSeguro.mjs';
import { ambienteDoPush, publicar, type RespostaComando } from '../scripts/publicar.mjs';

/**
 * O envio automático (10/10): `gh` que cai para a credencial do Git quando o token morre, e o `npm run publicar` que faz o ritual da regra 13
 * com as travas que custaram caro (mergear sem CI verde, apagar o branch de um PR que não mergeou).
 */
const ok = (stdout = ''): RespostaComando => ({ status: 0, stdout, stderr: '' });
const erro = (stderr: string): RespostaComando => ({ status: 1, stdout: '', stderr });

interface Cenario {
  branch?: string;
  solto?: string;
  atras?: string;
  mergeFalha?: boolean;
  pushStatus?: number;
  prExistente?: number;
  checksNaoAparecem?: boolean;
  ci?: string;
  /** O que cada leitura do check devolve, em ordem ('' = leitura vazia); a última se repete. */
  ciSequencia?: string[];
  estado?: string;
  mergeou?: boolean;
  /** Em qual chamada de `gh pr merge` o merge de fato sai (o GitHub às vezes só aceita na 2ª). */
  mergeNaTentativa?: number;
  apagarFalha?: boolean;
  /** O estado do PR quando o script o lê, antes de mergear (padrão OPEN). MERGED = o PR foi mergeado por fora enquanto o script esperava o CI (28/10, #474). */
  estadoDoPr?: 'OPEN' | 'MERGED' | 'CLOSED';
  /** O branch remoto já não existe quando o script tenta apagá-lo (o merge pelo botão do GitHub o apaga). */
  branchJaApagado?: boolean;
}

function palco(c: Cenario = {}) {
  const { branch = 'claude/tarefa', solto = '', atras = '0', mergeFalha = false, pushStatus = 0, prExistente = 0, checksNaoAparecem = false, ci = 'pass', estado = 'CLEAN', mergeou = true, apagarFalha = false } = c;
  const chamadas: string[] = [];
  const log: string[] = [];
  let mergeChamado = false;
  let mergesChamados = 0;
  let ultimoCi = ci;
  const git = (args: string[]): RespostaComando => {
    const a = args.join(' ');
    chamadas.push(`git ${a}`);
    if (a === 'branch --show-current') return ok(branch + '\n');
    if (a === 'status --porcelain') return ok(solto);
    if (a.startsWith('fetch')) return ok();
    if (a.startsWith('rev-list --count')) return ok(atras + '\n');
    if (a.startsWith('merge origin/main')) return mergeFalha ? erro('conflito') : ok();
    if (a.startsWith('diff --name-only')) return ok('.decepticons/ESTADO_ATUAL.md\n');
    throw new Error(`git inesperado: ${a}`);
  };
  const ghFake = (args: string[]): RespostaComando => {
    const a = args.join(' ');
    chamadas.push(`gh ${a}`);
    if (a.startsWith('pr list')) return ok(prExistente ? `${prExistente}\n` : '\n');
    if (a.startsWith('pr create')) return ok('https://github.com/SerafimWeb/decepticons/pull/77\n');
    if (a === 'pr checks 77 --watch') return ok();
    if (a === 'pr checks 77' || a === `pr checks ${prExistente}`) {
      // `ciSequencia`: o que cada leitura do check devolve, na ordem ('' = leitura vazia); a última se repete.
      if (c.ciSequencia?.length) ultimoCi = c.ciSequencia.length > 1 ? c.ciSequencia.shift()! : c.ciSequencia[0]!;
      return ok(checksNaoAparecem ? 'etiquetas\tpass\t6s\n' : ultimoCi === '' ? '' : `check\t${ultimoCi}\t3m40s\netiquetas\tpass\t6s\n`);
    }
    if (a.startsWith('pr view') && a.includes('state,mergeStateStatus')) return ok(JSON.stringify({ state: c.estadoDoPr ?? 'OPEN', mergeStateStatus: (c.estadoDoPr ?? 'OPEN') === 'OPEN' ? estado : 'UNKNOWN' }));
    if (a.startsWith('pr merge')) {
      mergeChamado = true;
      mergesChamados++;
      return ok();
    }
    if (a.startsWith('pr view') && a.includes('state,mergeCommit') && c.estadoDoPr && c.estadoDoPr !== 'OPEN') {
      return ok(JSON.stringify({ state: c.estadoDoPr, mergeCommit: c.estadoDoPr === 'MERGED' ? { oid: 'abcdef1234567' } : null }));
    }
    if (a.startsWith('pr view') && a.includes('state,mergeCommit')) return ok(JSON.stringify({ state: mergeChamado && mergeou && mergesChamados >= (c.mergeNaTentativa ?? 1) ? 'MERGED' : 'OPEN', mergeCommit: { oid: 'abcdef1234567' } }));
    if (a.startsWith('repo view')) return ok('SerafimWeb/decepticons\n');
    if (a.startsWith('api -X DELETE')) return apagarFalha ? erro('403') : c.branchJaApagado ? erro('gh: Reference does not exist (HTTP 422)') : ok();
    if (a.startsWith('run list')) return ok(JSON.stringify([{ status: 'in_progress', conclusion: '', workflowName: 'CI' }]));
    throw new Error(`gh inesperado: ${a}`);
  };
  const ops = {
    git,
    gh: ghFake,
    empurrar: (b: string) => {
      chamadas.push(`push ${b}`);
      return pushStatus;
    },
    dormir: async () => {
      chamadas.push('dormir');
    },
    log: (l: string) => log.push(l),
  };
  const sem = () => chamadas.filter((x) => x !== 'dormir');
  return { ops, chamadas, log, sem };
}

const OPC = { titulo: 'feat: tal coisa', corpo: '.tmp/pr.md' };

describe('publicar: o caminho feliz, na ordem da regra 13', () => {
  it('envia, abre o PR, espera o CI, mergeia e só então apaga o branch remoto', async () => {
    const p = palco();
    const r = await publicar(p.ops, OPC);
    expect(r).toEqual({ ok: true, pr: 77, merge: 'abcdef1234567' });
    const ordem = p.sem();
    const pos = (inicio: string) => {
      const i = ordem.findIndex((c) => c.startsWith(inicio));
      expect(i, `"${inicio}" não foi chamado; chamadas: ${ordem.join(' | ')}`).toBeGreaterThan(-1);
      return i;
    };
    expect(pos('push claude/tarefa')).toBeLessThan(pos('gh pr create'));
    expect(pos('gh pr create')).toBeLessThan(pos('gh pr checks 77 --watch'));
    expect(pos('gh pr checks 77 --watch')).toBeLessThan(pos('gh pr merge'));
    expect(pos('gh pr merge')).toBeLessThan(pos('gh api -X DELETE'));
    expect(p.sem().find((c) => c.startsWith('gh api -X DELETE'))).toBe('gh api -X DELETE repos/SerafimWeb/decepticons/git/refs/heads/claude/tarefa');
  });

  it('espera a linha "check" aparecer antes do --watch (senão o watch volta na hora e o merge sai com o CI rodando)', async () => {
    const p = palco();
    await publicar(p.ops, OPC);
    const iCheck = p.sem().findIndex((c) => c === 'gh pr checks 77');
    const iWatch = p.sem().findIndex((c) => c === 'gh pr checks 77 --watch');
    expect(iCheck).toBeGreaterThan(-1);
    expect(iCheck).toBeLessThan(iWatch);
  });

  it('reaproveita o PR que já existe em vez de abrir outro', async () => {
    const p = palco({ prExistente: 77 });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(true);
    expect(p.sem().some((c) => c.startsWith('gh pr create'))).toBe(false);
  });
});

describe('publicar: o que ele recusa', () => {
  it('na main (ou sem branch): não envia nada', async () => {
    for (const branch of ['main', 'master', '']) {
      const p = palco({ branch });
      const r = await publicar(p.ops, OPC);
      expect(r.ok).toBe(false);
      expect(p.sem().some((c) => c.startsWith('push'))).toBe(false);
    }
  });

  it('com mudança sem commit: recusa e diz quais; mudança só em .tmp/ não conta', async () => {
    const suja = palco({ solto: ' M client/src/core/Game.ts\n' });
    const r = await publicar(suja.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('Game.ts');
    expect(suja.sem().some((c) => c.startsWith('push'))).toBe(false);
    const limpa = palco({ solto: '?? .tmp/rascunho.md\n' });
    expect((await publicar(limpa.ops, OPC)).ok).toBe(true);
  });

  it('a main andou: junta antes de enviar; se der conflito, para sem enviar', async () => {
    const junta = palco({ atras: '2' });
    expect((await publicar(junta.ops, OPC)).ok).toBe(true);
    expect(junta.sem().findIndex((c) => c === 'git merge origin/main --no-edit')).toBeLessThan(junta.sem().findIndex((c) => c.startsWith('push')));
    const conflito = palco({ atras: '2', mergeFalha: true });
    const r = await publicar(conflito.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('ESTADO_ATUAL.md');
    expect(conflito.sem().some((c) => c.startsWith('push'))).toBe(false);
  });

  it('push recusado pelo hook (check falhou): não abre PR', async () => {
    const p = palco({ pushStatus: 1 });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(p.sem().some((c) => c.startsWith('gh pr create'))).toBe(false);
  });

  it('CI que não passou: NÃO mergeia e preserva o branch', async () => {
    const p = palco({ ci: 'fail' });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('fail');
    expect(p.sem().some((c) => c.startsWith('gh pr merge') || c.startsWith('gh api -X'))).toBe(false);
  });

  it('o --watch volta cedo, com o CI ainda pendente ou a leitura vazia (21/10, #436): espera o resultado em vez de reprovar um PR verde', async () => {
    const p = palco({ ciSequencia: ['pending', 'pending', '', 'pending', 'pass'] });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(true);
    expect(p.chamadas.filter((c) => c === 'dormir').length).toBeGreaterThanOrEqual(3);
    expect(p.sem().some((c) => c.startsWith('gh pr merge'))).toBe(true);
  });

  it('o CI que acaba vermelho depois de ficar pendente: não mergeia (a espera não vira "aprovado")', async () => {
    const p = palco({ ciSequencia: ['pending', 'pending', 'fail'] });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('fail');
    expect(p.sem().some((c) => c.startsWith('gh pr merge') || c.startsWith('gh api -X'))).toBe(false);
  });

  it('o CI que nunca sai do pendente: desiste no teto, sem mergear', async () => {
    const p = palco({ ciSequencia: ['pending'] });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('pending');
    expect(p.chamadas.filter((c) => c === 'dormir').length).toBeGreaterThanOrEqual(99);
    expect(p.sem().some((c) => c.startsWith('gh pr merge'))).toBe(false);
  });

  it('CI que nunca cria a linha "check" (PR em conflito não roda o CI): falha sem mergear', async () => {
    const p = palco({ checksNaoAparecem: true });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(p.chamadas.filter((c) => c === 'dormir').length).toBeGreaterThanOrEqual(39);
    expect(p.sem().some((c) => c.startsWith('gh pr merge'))).toBe(false);
  });

  it('PR sujo (conflito com a main): não mergeia e não apaga o branch', async () => {
    const p = palco({ estado: 'DIRTY' });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('DIRTY');
    expect(p.sem().some((c) => c.startsWith('gh pr merge') || c.startsWith('gh api -X'))).toBe(false);
  });

  it('o GitHub aceita o merge só na 2ª tentativa (11/10, #231): tenta de novo, espera entre as tentativas e só então apaga o branch', async () => {
    const p = palco({ mergeNaTentativa: 2 });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(true);
    expect(p.sem().filter((c) => c.startsWith('gh pr merge'))).toHaveLength(2);
    expect(p.chamadas.filter((c) => c === 'dormir').length).toBeGreaterThanOrEqual(1);
    expect(p.log.some((l) => l.includes('tentando de novo'))).toBe(true);
    expect(p.sem().some((c) => c.startsWith('gh api -X DELETE'))).toBe(true);
  });

  it('merge que NUNCA sai: tenta 4 vezes, falha, preserva o branch e não apaga nada', async () => {
    const p = palco({ mergeou: false });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(p.sem().filter((c) => c.startsWith('gh pr merge'))).toHaveLength(4);
    expect(p.sem().some((c) => c.startsWith('gh api -X DELETE'))).toBe(false);
  });

  it('merge que NÃO aconteceu (o erro de 10/10): não apaga o branch remoto', async () => {
    const p = palco({ mergeou: false });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('NÃO aconteceu');
    expect(p.sem().some((c) => c.startsWith('gh api -X'))).toBe(false);
  });

  it('sem título ou sem arquivo de descrição, não abre PR', async () => {
    const p = palco();
    const r = await publicar(p.ops, {});
    expect(r.ok).toBe(false);
    expect(p.sem().some((c) => c.startsWith('gh pr create'))).toBe(false);
  });

  it('--so-pr abre o PR e para: não espera o CI nem mergeia', async () => {
    const p = palco();
    const r = await publicar(p.ops, { ...OPC, soPr: true });
    expect(r).toEqual({ ok: true, pr: 77 });
    expect(p.sem().some((c) => c.startsWith('gh pr checks') || c.startsWith('gh pr merge'))).toBe(false);
  });

  it('branch que não pôde ser apagado: avisa, e o merge continua valendo', async () => {
    const p = palco({ apagarFalha: true });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(true);
    expect(p.log.join('\n')).toContain('não consegui apagar o branch remoto');
  });
});

describe('publicar: o PR mergeado por fora enquanto o script esperava o CI (28/10, #474)', () => {
  it('não é falha: não chama `pr merge`, devolve o merge e, com o MERGED confirmado, ainda apaga o branch', async () => {
    const p = palco({ estadoDoPr: 'MERGED' });
    const r = await publicar(p.ops, OPC);
    expect(r).toEqual({ ok: true, pr: 77, merge: 'abcdef1234567' });
    expect(p.sem().some((c) => c.startsWith('gh pr merge'))).toBe(false);
    expect(p.log.join('\n')).toContain('já estava mergeado');
    expect(p.sem().some((c) => c.startsWith('gh api -X DELETE'))).toBe(true);
  });

  it('não espera a mergeabilidade de um PR que já não está aberto (ela volta UNKNOWN para sempre): sem dormir à toa', async () => {
    const p = palco({ estadoDoPr: 'MERGED' });
    await publicar(p.ops, OPC);
    expect(p.chamadas.filter((c) => c === 'dormir')).toHaveLength(0);
  });

  it('PR fechado SEM merge continua sendo falha: não mergeia e não apaga o branch', async () => {
    const p = palco({ estadoDoPr: 'CLOSED' });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('não está aberto (CLOSED)');
    expect(p.sem().some((c) => c.startsWith('gh pr merge') || c.startsWith('gh api -X'))).toBe(false);
  });

  it('o branch remoto que o merge do GitHub já apagou: diz que já estava apagado, sem mandar apagar à mão', async () => {
    const p = palco({ estadoDoPr: 'MERGED', branchJaApagado: true });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(true);
    const saida = p.log.join('\n');
    expect(saida).toContain('já estava apagado');
    expect(saida).not.toContain('apague à mão');
  });
});

describe('publicar --sem-ci: o Actions sem cota ou sem pagamento (12/10) não trava o trabalho', () => {
  const SEM_CI = { ...OPC, semCi: true };

  it('não espera o CI nem olha o resultado dele: com o check "fail" por cobrança e o PR UNSTABLE, mergeia (a prova é o npm run check do hook do push) e só depois apaga o branch', async () => {
    const p = palco({ ci: 'fail', estado: 'UNSTABLE' });
    const r = await publicar(p.ops, SEM_CI);
    expect(r).toEqual({ ok: true, pr: 77, merge: 'abcdef1234567' });
    expect(p.sem().some((c) => c.startsWith('gh pr checks'))).toBe(false); // nem a linha "check", nem o --watch
    const ordem = p.sem();
    expect(ordem.findIndex((c) => c.startsWith('push '))).toBeLessThan(ordem.findIndex((c) => c.startsWith('gh pr create')));
    expect(ordem.findIndex((c) => c.startsWith('gh pr merge'))).toBeLessThan(ordem.findIndex((c) => c.startsWith('gh api -X DELETE')));
    expect(p.log.join('\n')).toMatch(/--sem-ci: não espero o CI/);
    expect(p.log.join('\n')).toMatch(/publicar-site/); // diz como o site vai ao ar sem o Actions
    expect(p.sem().some((c) => c.startsWith('gh run list'))).toBe(false); // não pergunta pelo deploy do Actions
  });

  it('o push recusado pelo hook (check local falhou) continua barrando tudo: sem --sem-ci que valha, sem push não há PR', async () => {
    const p = palco({ pushStatus: 1 });
    const r = await publicar(p.ops, SEM_CI);
    expect(r.ok).toBe(false);
    expect(p.sem().some((c) => c.startsWith('gh pr create'))).toBe(false);
  });

  it('conflito ou fora de dia com a main (DIRTY, BEHIND) continua recusado, e o branch fica; só CLEAN e UNSTABLE passam', async () => {
    for (const estado of ['DIRTY', 'BEHIND', 'BLOCKED_PELA_REVISAO']) {
      const p = palco({ estado });
      const r = await publicar(p.ops, SEM_CI);
      expect(r.ok, estado).toBe(false);
      expect(p.sem().some((c) => c.startsWith('gh pr merge')), estado).toBe(false);
      expect(p.sem().some((c) => c.startsWith('gh api -X DELETE')), estado).toBe(false);
    }
    expect((await publicar(palco({ estado: 'CLEAN' }).ops, SEM_CI)).ok).toBe(true);
  });

  it('SEM a opção, nada muda: o CI vermelho continua barrando o merge (e a frase sugere --sem-ci quando o Actions é que está parado)', async () => {
    const p = palco({ ci: 'fail', estado: 'UNSTABLE' });
    const r = await publicar(p.ops, OPC);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/--sem-ci/);
    expect(p.sem().some((c) => c.startsWith('gh pr merge'))).toBe(false);
    // E UNSTABLE sem a opção nunca passa, mesmo com o check "pass".
    expect((await publicar(palco({ ci: 'pass', estado: 'UNSTABLE' }).ops, OPC)).ok).toBe(false);
  });

  it('o merge que não saiu com --sem-ci também preserva o branch', async () => {
    const p = palco({ mergeou: false });
    const r = await publicar(p.ops, SEM_CI);
    expect(r.ok).toBe(false);
    expect(p.sem().some((c) => c.startsWith('gh api -X DELETE'))).toBe(false);
  });
});

describe('ghSeguro: cai para a credencial do Git só quando o token do gh morreu', () => {
  const TOKEN = 'gho_SEGREDO_QUE_NUNCA_PODE_APARECER';
  const mortoOuVivo = (vivo: boolean) => {
    const vistas: Array<{ args: string[]; token?: string }> = [];
    const executar = (args: string[], env: NodeJS.ProcessEnv) => {
      vistas.push({ args, token: env.GH_TOKEN });
      if (env.GH_TOKEN === TOKEN) return { status: 0, stdout: `ok ${TOKEN}`, stderr: `eco ${TOKEN}` };
      return vivo ? { status: 0, stdout: 'ok', stderr: '' } : { status: 1, stdout: '', stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with: gh auth login' };
    };
    return { executar, vistas };
  };

  it('token do gh vivo: usa o gh normal, sem tocar na credencial do Git', () => {
    const m = mortoOuVivo(true);
    let pediuToken = 0;
    const r = gh(['pr', 'list'], { executar: m.executar, token: () => (pediuToken++, TOKEN) });
    expect(r).toEqual({ status: 0, stdout: 'ok', stderr: '', viaGit: false });
    expect(pediuToken).toBe(0);
    expect(m.vistas).toHaveLength(1);
  });

  it('token do gh morto (HTTP 401): repete com GH_TOKEN da credencial do Git, e a saída sai SEM o token', () => {
    const m = mortoOuVivo(false);
    const r = gh(['pr', 'list'], { executar: m.executar, token: () => TOKEN, ambiente: {} }); // ambiente vazio: no GitHub Actions o GH_TOKEN já existe
    expect(r.viaGit).toBe(true);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('ok ***');
    expect(r.stderr).toBe('eco ***');
    expect(`${r.stdout}${r.stderr}`).not.toContain(TOKEN);
    expect(m.vistas.map((v) => v.token)).toEqual([undefined, TOKEN]); // o token só viaja no ambiente da segunda chamada
    expect(m.vistas.every((v) => !v.args.join(' ').includes(TOKEN))).toBe(true); // nunca em argumento de linha de comando
  });

  it('sem credencial do Git: devolve a falha original e marca semCredencial', () => {
    const m = mortoOuVivo(false);
    const r = gh(['pr', 'list'], { executar: m.executar, token: () => null });
    expect(r.status).toBe(1);
    expect(r.semCredencial).toBe(true);
    expect(r.viaGit).toBe(false);
  });

  it('falha que NÃO é de autenticação (PR inexistente, rede) não aciona o fallback', () => {
    let pediu = 0;
    const r = gh(['pr', 'view', '999'], { executar: () => ({ status: 1, stdout: '', stderr: 'GraphQL: Could not resolve to a PullRequest with the number of 999.' }), token: () => (pediu++, TOKEN) });
    expect(r.status).toBe(1);
    expect(r.viaGit).toBe(false);
    expect(pediu).toBe(0);
  });

  it('reconhece as mensagens de autenticação do gh e só quando o comando falhou', () => {
    expect(falhouPorAutenticacao({ status: 1, stderr: 'HTTP 401: Requires authentication' })).toBe(true);
    expect(falhouPorAutenticacao({ status: 1, stderr: 'The token in default is invalid.\nTo re-authenticate, run: gh auth login' })).toBe(true);
    expect(falhouPorAutenticacao({ status: 0, stdout: 'texto que cita gh auth login num PR' })).toBe(false);
    expect(falhouPorAutenticacao({ status: 1, stderr: 'HTTP 404: Not Found' })).toBe(false);
  });

  it('tokenDoGit lê o campo password do git credential fill, e devolve null se não houver', () => {
    const chamadas: Array<{ cmd: string; args: string[]; input?: string }> = [];
    const fake = (resposta: { status: number; stdout: string }) => (cmd: string, args: string[], op: { input?: string }) => {
      chamadas.push({ cmd, args, input: op.input });
      return resposta;
    };
    expect(tokenDoGit(fake({ status: 0, stdout: 'protocol=https\nhost=github.com\nusername=x\npassword=abc123\n' }))).toBe('abc123');
    expect(chamadas[0]).toMatchObject({ cmd: 'git', args: ['credential', 'fill'], input: 'protocol=https\nhost=github.com\n\n' });
    expect(tokenDoGit(fake({ status: 1, stdout: '' }))).toBeNull();
    expect(tokenDoGit(fake({ status: 0, stdout: 'protocol=https\nhost=github.com\n' }))).toBeNull();
  });

  it('esconder troca todas as ocorrências e aceita texto vazio', () => {
    expect(esconder('a TOK b TOK', 'TOK')).toBe('a *** b ***');
    expect(esconder(undefined, 'TOK')).toBe('');
    expect(esconder('sem token', null)).toBe('sem token');
  });
});

describe('o ambiente do push (P224): sem CI o hook não pode pular o check da junção', () => {
  it('com --sem-ci liga CYBERMECH_CHECK_COMPLETO; sem a opção não mexe no ambiente', () => {
    expect(ambienteDoPush(true, { A: '1' })).toEqual({ A: '1', CYBERMECH_CHECK_COMPLETO: '1' });
    expect(ambienteDoPush(false, { A: '1' })).toEqual({ A: '1' });
    expect(ambienteDoPush(false, { CYBERMECH_CHECK_COMPLETO: '1' }), 'quem já pediu o completo continua pedindo').toEqual({ CYBERMECH_CHECK_COMPLETO: '1' });
  });
});
