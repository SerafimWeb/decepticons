import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressoPiloto } from '../../../shared/net/auth';
import { CHAVE_TOKEN, ENVIO_APOS_MS, SessaoPiloto, chaveDoToken, type Armazem, type ProgressoLocal, type ServidorDeContas } from './sessao';

const CHAVE = 'cybermech.conta.token|https://jogo.exemplo';
const prog = (over: Partial<ProgressoPiloto> = {}): ProgressoPiloto => ({ apelido: 'EU', nivel: 2, xp: 100, creditos: 500, montagem: '', atualizadoEm: 0, ...over });

class ArmazemFalso implements Armazem {
  readonly dados = new Map<string, string>();
  getItem(k: string): string | null {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.dados.set(k, v);
  }
  removeItem(k: string): void {
    this.dados.delete(k);
  }
}

/** Um servidor de contas de mentira: uma conta só, com o progresso guardado e o registro das chamadas. */
function servidorFalso(inicial: { progresso: ProgressoPiloto | null; sessaoValida?: boolean; rede?: boolean; gravaOk?: boolean } = { progresso: null }) {
  const s = {
    progresso: inicial.progresso,
    sessaoValida: inicial.sessaoValida ?? true,
    rede: inicial.rede ?? true,
    gravaOk: inicial.gravaOk ?? true,
    chamadas: [] as string[],
    gravados: [] as ProgressoPiloto[],
    erroAoEntrar: null as string | null,
    medir: true,
    erroAoApagar: null as string | null,
    senhasDeApagar: [] as string[],
    dadosErro: null as string | null,
  };
  const api: ServidorDeContas = {
    async criar(email) {
      s.chamadas.push('criar');
      return s.erroAoEntrar ? { erro: s.erroAoEntrar } : { token: 'tk-novo', email };
    },
    async entrar(email) {
      s.chamadas.push('entrar');
      return s.erroAoEntrar ? { erro: s.erroAoEntrar } : { token: 'tk-entrou', email };
    },
    async sair() {
      s.chamadas.push('sair');
    },
    async eu() {
      s.chamadas.push('eu');
      return s.sessaoValida && s.rede ? { email: 'ana@x.com', is_admin: false, medir: s.medir } : null;
    },
    async dados() {
      s.chamadas.push('dados');
      return s.dadosErro ? { erro: s.dadosErro } : { json: '{"v":1}' };
    },
    async apagar(_t, senha) {
      s.chamadas.push('apagar');
      s.senhasDeApagar.push(senha);
      return s.erroAoApagar;
    },
    async medicao(_t, ativa) {
      s.chamadas.push('medicao');
      if (!s.rede) return null;
      s.medir = ativa;
      return ativa;
    },
    async lerProgresso() {
      s.chamadas.push('ler');
      return s.rede ? { progresso: s.progresso } : null;
    },
    async gravarProgresso(_t, p) {
      s.chamadas.push('gravar');
      if (!s.rede || !s.gravaOk) return false;
      s.progresso = p;
      s.gravados.push(p);
      return true;
    },
  };
  return { s, api };
}

/** O progresso do navegador: o que o jogo tem, o que a sessão lhe aplicou e o instante que ela passou. */
function localFalso(inicial: ProgressoPiloto | null) {
  const l = { atual: inicial, aplicados: [] as ProgressoPiloto[], quando: [] as number[] };
  const api: ProgressoLocal = {
    ler(quando) {
      l.quando.push(quando);
      return l.atual ? { ...l.atual, atualizadoEm: quando } : null;
    },
    aplicar(p) {
      l.aplicados.push(p);
      l.atual = p;
    },
  };
  return { l, api };
}

function montar(servidor = servidorFalso(), local = localFalso(prog()), armazem = new ArmazemFalso()) {
  let agora = 1000;
  const sessao = new SessaoPiloto(servidor.api, armazem, local.api, CHAVE, () => agora);
  return { sessao, servidor: servidor.s, local: local.l, armazem, tempo: (t: number) => (agora = t) };
}

describe('chaveDoToken: uma chave por servidor', () => {
  it('ws e http do mesmo servidor dão a mesma chave; servidores diferentes, chaves diferentes (um link de terceiros nunca recebe o token)', () => {
    expect(chaveDoToken('wss://jogo.exemplo')).toBe(chaveDoToken('https://jogo.exemplo'));
    expect(chaveDoToken('wss://jogo.exemplo')).toBe(`${CHAVE_TOKEN}|https://jogo.exemplo`);
    expect(chaveDoToken('wss://outro.exemplo')).not.toBe(chaveDoToken('wss://jogo.exemplo'));
  });

  it('sem servidor configurado a chave existe e é a do "nenhum"', () => {
    expect(chaveDoToken(undefined)).toBe(`${CHAVE_TOKEN}|`);
  });
});

describe('criar e entrar: o convidado vira conta sem perder nada', () => {
  it('conta nova (a conta ainda não guardou nada): guarda o token, manda o progresso do navegador e fica sincronizado', async () => {
    const { sessao, servidor, local, armazem } = montar();
    expect(await sessao.criar('ana@x.com', 'senhasegura')).toBeNull();
    expect(sessao.estado).toEqual({ email: 'ana@x.com', sincronizado: true, medir: true });
    expect(armazem.getItem(CHAVE)).toBe('tk-novo');
    expect(servidor.gravados).toHaveLength(1);
    expect(servidor.gravados[0]).toMatchObject({ nivel: 2, xp: 100, creditos: 500, apelido: 'EU' });
    expect(local.aplicados).toHaveLength(0); // o navegador já tinha tudo
  });

  it('erro do servidor: devolve a mensagem, não guarda token, não mexe no progresso e segue convidado', async () => {
    const { sessao, servidor, local, armazem } = montar();
    servidor.erroAoEntrar = 'e-mail ou senha incorretos';
    expect(await sessao.entrar('ana@x.com', 'errada123')).toBe('e-mail ou senha incorretos');
    expect(sessao.estado).toEqual({ email: null, sincronizado: false, medir: true });
    expect(armazem.getItem(CHAVE)).toBeNull();
    expect(servidor.chamadas).toEqual(['entrar']);
    expect(local.aplicados).toHaveLength(0);
  });

  it('a conta tinha mais progresso (aparelho novo): o navegador recebe o da conta e nada é mandado de volta', async () => {
    const conta = prog({ nivel: 7, xp: 40, creditos: 9000, apelido: 'ANA', montagem: '{"chassis":"marauder"}' });
    const { sessao, servidor, local } = montar(servidorFalso({ progresso: conta }), localFalso(prog({ nivel: 1, xp: 0, creditos: 500, apelido: '' })));
    await sessao.entrar('ana@x.com', 'senhasegura');
    expect(local.aplicados).toHaveLength(1);
    expect(local.aplicados[0]).toMatchObject({ nivel: 7, xp: 40, creditos: 9000, apelido: 'ANA', montagem: '{"chassis":"marauder"}' });
    expect(servidor.gravados).toHaveLength(0);
    expect(sessao.estado.sincronizado).toBe(true);
  });

  it('o navegador tinha mais (jogou como convidado): a conta recebe o do navegador e o navegador não muda', async () => {
    const { sessao, servidor, local } = montar(servidorFalso({ progresso: prog({ nivel: 2, xp: 0, creditos: 100 }) }), localFalso(prog({ nivel: 5, xp: 300, creditos: 1200 })));
    await sessao.entrar('ana@x.com', 'senhasegura');
    expect(local.aplicados).toHaveLength(0);
    expect(servidor.gravados[0]).toMatchObject({ nivel: 5, xp: 300, creditos: 1200 });
  });

  it('o vencedor sem apelido ou montagem herda os do outro (nada se perde na junção)', async () => {
    const { sessao, servidor, local } = montar(
      servidorFalso({ progresso: prog({ nivel: 2, apelido: 'ANA', montagem: '{"a":1}' }) }),
      localFalso(prog({ nivel: 9, apelido: '', montagem: '' })),
    );
    await sessao.entrar('ana@x.com', 'senhasegura');
    expect(servidor.gravados[0]).toMatchObject({ nivel: 9, apelido: 'ANA', montagem: '{"a":1}' });
    expect(local.aplicados[0]).toMatchObject({ nivel: 9, apelido: 'ANA', montagem: '{"a":1}' });
  });

  it('a mesma coisa dos dois lados: nada é aplicado nem mandado', async () => {
    const igual = prog();
    const { sessao, servidor, local } = montar(servidorFalso({ progresso: igual }), localFalso(igual));
    await sessao.entrar('ana@x.com', 'senhasegura');
    expect(local.aplicados).toHaveLength(0);
    expect(servidor.gravados).toHaveLength(0);
    expect(sessao.estado.sincronizado).toBe(true);
  });
});

describe('falha de rede nunca trava nem apaga nada', () => {
  it('sem rede na hora de sincronizar: entra, mas fica "não sincronizado", e nada é aplicado ou mandado', async () => {
    const { sessao, servidor, local } = montar(servidorFalso({ progresso: null, rede: false }));
    // `entrar` responde (o servidor falso responde), mas ler o progresso não: a sessão vale e o progresso local segue intacto.
    await sessao.entrar('ana@x.com', 'senhasegura');
    expect(sessao.estado).toEqual({ email: 'ana@x.com', sincronizado: false, medir: true });
    expect(local.aplicados).toHaveLength(0);
    expect(servidor.gravados).toHaveLength(0);
  });

  it('o servidor recusa gravar: fica "não sincronizado"; a próxima mudança tenta de novo', async () => {
    const { sessao, servidor } = montar(servidorFalso({ progresso: null, gravaOk: false }));
    await sessao.criar('ana@x.com', 'senhasegura');
    expect(sessao.estado.sincronizado).toBe(false);
    servidor.gravaOk = true;
    await sessao.sincronizar();
    expect(sessao.estado.sincronizado).toBe(true);
  });

  it('duas sincronizações juntas viram uma só ida ao servidor', async () => {
    const { sessao, servidor } = montar();
    await sessao.criar('ana@x.com', 'senhasegura');
    servidor.chamadas.length = 0;
    await Promise.all([sessao.sincronizar(), sessao.sincronizar(), sessao.sincronizar()]);
    expect(servidor.chamadas.filter((c) => c === 'ler')).toHaveLength(1);
  });

  it('armazenamento que lança (aba anônima) não quebra a sessão', async () => {
    const quebrado: Armazem = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    const { sessao } = montar(servidorFalso(), localFalso(prog()), quebrado as ArmazemFalso);
    expect(await sessao.criar('ana@x.com', 'senhasegura')).toBeNull();
    expect(sessao.estado.email).toBe('ana@x.com');
    expect(() => sessao.mudou()).not.toThrow();
    await expect(sessao.sair()).resolves.toBeUndefined();
  });
});

describe('restaurar: o jogo abriu', () => {
  it('sem token guardado: não pergunta nada ao servidor', async () => {
    const { sessao, servidor } = montar();
    await sessao.restaurar();
    expect(servidor.chamadas).toEqual([]);
    expect(sessao.estado.email).toBeNull();
  });

  it('token guardado que o servidor aceita: volta logado e sincroniza', async () => {
    const { sessao, servidor, armazem } = montar();
    armazem.setItem(CHAVE, 'tk-velho');
    await sessao.restaurar();
    expect(sessao.estado).toEqual({ email: 'ana@x.com', sincronizado: true, medir: true });
    expect(servidor.chamadas).toEqual(['eu', 'ler', 'gravar']);
  });

  it('token que o servidor não aceita (ou sem rede): segue como convidado, sem tocar no progresso, e o token fica (a rede pode voltar)', async () => {
    const { sessao, servidor, local, armazem } = montar(servidorFalso({ progresso: null, sessaoValida: false }));
    armazem.setItem(CHAVE, 'tk-velho');
    await sessao.restaurar();
    expect(sessao.estado.email).toBeNull();
    expect(local.aplicados).toHaveLength(0);
    expect(servidor.gravados).toHaveLength(0);
    expect(armazem.getItem(CHAVE)).toBe('tk-velho');
  });
});

describe('sair', () => {
  it('avisa o servidor, esquece o token e volta a convidado, e o progresso local FICA (o aparelho continua do piloto)', async () => {
    const { sessao, servidor, local, armazem } = montar();
    await sessao.criar('ana@x.com', 'senhasegura');
    await sessao.sair();
    expect(servidor.chamadas).toContain('sair');
    expect(armazem.getItem(CHAVE)).toBeNull();
    expect(sessao.estado).toEqual({ email: null, sincronizado: false, medir: true });
    expect(local.atual).toMatchObject({ nivel: 2, xp: 100, creditos: 500 });
  });

  it('cancela o envio que estava agendado (não manda progresso depois de sair)', async () => {
    vi.useFakeTimers();
    try {
      const { sessao, servidor } = montar();
      await sessao.criar('ana@x.com', 'senhasegura');
      servidor.gravados.length = 0;
      sessao.mudou();
      await sessao.sair();
      await vi.advanceTimersByTimeAsync(ENVIO_APOS_MS * 3);
      expect(servidor.gravados).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('mudou: cada mudança local vai para a conta, com calma', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sem sessão só marca o instante (vale na hora de entrar) e não agenda rede nenhuma', async () => {
    const { sessao, servidor, local, tempo } = montar();
    tempo(5555);
    sessao.mudou();
    await vi.advanceTimersByTimeAsync(ENVIO_APOS_MS * 2);
    expect(servidor.chamadas).toEqual([]);
    await sessao.criar('ana@x.com', 'senhasegura');
    expect(local.quando.at(-1)).toBe(5555); // o instante da última mudança, não o de agora
  });

  it('com sessão: espera 5 s de calma e manda; mudanças dentro da janela viram um envio só', async () => {
    const { sessao, servidor, local } = montar();
    await sessao.criar('ana@x.com', 'senhasegura');
    servidor.chamadas.length = 0;
    local.atual = prog({ nivel: 3, xp: 10 });
    sessao.mudou();
    await vi.advanceTimersByTimeAsync(ENVIO_APOS_MS - 1);
    expect(servidor.chamadas).toEqual([]);
    local.atual = prog({ nivel: 3, xp: 90 });
    sessao.mudou(); // reinicia a janela
    await vi.advanceTimersByTimeAsync(ENVIO_APOS_MS - 1);
    expect(servidor.chamadas).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(servidor.chamadas.filter((c) => c === 'gravar')).toHaveLength(1);
    expect(servidor.progresso).toMatchObject({ nivel: 3, xp: 90 });
  });

  it('enquanto há envio pendente o estado é "não sincronizado"', async () => {
    const { sessao } = montar();
    await sessao.criar('ana@x.com', 'senhasegura');
    expect(sessao.estado.sincronizado).toBe(true);
    sessao.mudou();
    expect(sessao.estado.sincronizado).toBe(false);
    await vi.advanceTimersByTimeAsync(ENVIO_APOS_MS + 1);
    expect(sessao.estado.sincronizado).toBe(true);
  });
});

describe('onMudou: a tela é avisada', () => {
  it('avisa ao entrar, ao sincronizar e ao sair', async () => {
    const { sessao } = montar();
    const vistos: Array<[string | null, boolean]> = [];
    sessao.onMudou = (e) => vistos.push([e.email, e.sincronizado]);
    await sessao.criar('ana@x.com', 'senhasegura');
    await sessao.sair();
    expect(vistos[0]).toEqual(['ana@x.com', false]);
    expect(vistos).toContainEqual(['ana@x.com', true]);
    expect(vistos.at(-1)).toEqual([null, false]);
  });
});

describe('os direitos do titular na sessão (P187, LGPD art. 18)', () => {
  it('baixar os dados: sem sessão não chama o servidor; com sessão devolve o JSON e um nome com a data', async () => {
    const { sessao, servidor, tempo } = montar();
    expect(await sessao.baixarDados()).toEqual({ erro: 'entre na conta primeiro' });
    expect(servidor.chamadas).toEqual([]);
    await sessao.criar('ana@x.com', 'senhasegura');
    tempo(Date.UTC(2026, 9, 18, 12));
    expect(await sessao.baixarDados()).toEqual({ json: '{"v":1}', nome: 'cybermech-meus-dados-2026-10-18.json' });
    servidor.dadosErro = 'não deu para baixar os dados';
    expect(await sessao.baixarDados()).toEqual({ erro: 'não deu para baixar os dados' });
  });

  it('apagar a conta: senha errada não esquece nada; senha certa esquece a sessão e o token, mas deixa o progresso do aparelho', async () => {
    const { sessao, servidor, local, armazem } = montar();
    expect(await sessao.apagarConta('senhasegura')).toBe('entre na conta primeiro');
    await sessao.criar('ana@x.com', 'senhasegura');
    servidor.erroAoApagar = 'senha incorreta';
    expect(await sessao.apagarConta('errada-errada')).toBe('senha incorreta');
    expect(sessao.estado.email).toBe('ana@x.com');
    expect(armazem.getItem(CHAVE)).toBe('tk-novo');
    servidor.erroAoApagar = null;
    expect(await sessao.apagarConta('senhasegura')).toBeNull();
    expect(servidor.senhasDeApagar).toEqual(['errada-errada', 'senhasegura']);
    expect(sessao.estado).toEqual({ email: null, sincronizado: false, medir: true });
    expect(armazem.getItem(CHAVE)).toBeNull();
    expect(local.atual).not.toBeNull(); // o progresso do navegador continua do aparelho
    expect(servidor.chamadas).not.toContain('sair'); // a conta já não existe: não há sessão a encerrar
  });

  it('a medição: guarda a escolha no servidor e na tela; sem rede nada muda; entrar de novo traz a escolha de volta', async () => {
    const { sessao, servidor } = montar();
    expect(await sessao.definirMedicao(false)).toBe(false); // sem sessão
    await sessao.criar('ana@x.com', 'senhasegura');
    expect(sessao.estado.medir).toBe(true);
    expect(await sessao.definirMedicao(false)).toBe(true);
    expect(sessao.estado.medir).toBe(false);
    expect(servidor.medir).toBe(false);
    servidor.rede = false;
    expect(await sessao.definirMedicao(true)).toBe(false);
    expect(sessao.estado.medir).toBe(false); // sem rede a escolha não mudou
    servidor.rede = true;
    await sessao.sair();
    expect(sessao.estado.medir).toBe(true); // convidado: padrão
    await sessao.restaurar(); // sem token guardado: nada
    const outro = montar();
    outro.servidor.medir = false;
    outro.armazem.setItem(CHAVE, 'tk-guardado');
    await outro.sessao.restaurar();
    expect(outro.sessao.estado.medir).toBe(false); // ao abrir o jogo em outro aparelho, a escolha da conta vale
  });
});
