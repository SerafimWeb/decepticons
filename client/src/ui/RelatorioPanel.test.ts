import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDIOMAS } from '../i18n/i18n';
import { arquivosParaTentar, CHAVES_JANEIRO, conteudoValido, formatarTempo, linhasDaPraca, linhasDoRelatorio, type ChavesDasLinhasJaneiro, type ConteudoDoRelatorio, type ResumoDaPraca, type ResumoDoRio } from './RelatorioPanel';

const RAIZ = resolve(__dirname, '../..');
const ler = (id: string): ConteudoDoRelatorio => JSON.parse(readFileSync(resolve(RAIZ, `public/relatorio/${id}.json`), 'utf8')) as ConteudoDoRelatorio;
const LINGUAS = IDIOMAS.map((i) => i.id);
const IDS = ['mercurio', 'garimpo', 'yanomami'];

const RESUMO: ResumoDoRio = { venceu: true, porDentro: true, geradoresCaidos: 3, geradoresTotal: 3, androidesVivos: 2, androidesTotal: 3, segundos: 754.9 };

describe('o Relatório de Consequências (P179, camada 3): que arquivo abrir e o que vale', () => {
  it('a língua primeiro, depois o inglês, depois o português (sem repetir)', () => {
    expect(arquivosParaTentar('ja')).toEqual(['ja', 'en', 'pt']);
    expect(arquivosParaTentar('en')).toEqual(['en', 'pt']);
    expect(arquivosParaTentar('pt')).toEqual(['pt']);
  });

  it('um JSON quebrado, vazio ou sem fonte não passa: todo fato leva a fonte com endereço https e o que ele não diz', () => {
    const bom = ler('pt');
    expect(conteudoValido(bom)).toBe(true);
    expect(conteudoValido(null)).toBe(false);
    expect(conteudoValido({})).toBe(false);
    expect(conteudoValido({ ...bom, fatos: [] })).toBe(false);
    expect(conteudoValido({ ...bom, ficcao: [] })).toBe(false);
    expect(conteudoValido({ ...bom, rotulos: { ...bom.rotulos, fonte: '' } })).toBe(false);
    expect(conteudoValido({ ...bom, linhas: { ...bom.linhas, tempo: ' ' } })).toBe(false);
    expect(conteudoValido({ ...bom, fatos: [{ ...bom.fatos[0]!, link: '' }] })).toBe(false);
    expect(conteudoValido({ ...bom, fatos: [{ ...bom.fatos[0]!, link: 'http://exemplo.org/x' }] })).toBe(false); // só https
    expect(conteudoValido({ ...bom, fatos: [{ ...bom.fatos[0]!, nota: '' }] })).toBe(false);
    expect(conteudoValido({ ...bom, fatos: [{ ...bom.fatos[0]!, quando: '' }] })).toBe(false);
  });
});

describe('o conteúdo do Relatório: os mesmos três fatos, com a mesma fonte, nas sete línguas', () => {
  it('há um arquivo por língua do jogo, todos válidos', () => {
    for (const id of LINGUAS) expect(conteudoValido(ler(id)), id).toBe(true);
  });

  it('os três fatos, na mesma ordem e com o MESMO endereço de fonte em todas as línguas (a tradução não troca de fonte nem inventa um fato)', () => {
    const base = ler('pt');
    expect(base.fatos.map((f) => f.id)).toEqual(IDS);
    for (const id of LINGUAS) {
      const c = ler(id);
      expect(c.fatos.map((f) => f.id), id).toEqual(IDS);
      c.fatos.forEach((f, i) => expect(f.link, `${id}/${f.id}`).toBe(base.fatos[i]!.link));
      expect(c.ficcao.length, id).toBe(base.ficcao.length);
    }
  });

  it('a regra "fato tem fonte": cada fonte do jogo está registrada na ficha de fatos (o endereço, a data e o que foi lido) e marcada como conferida na fonte', () => {
    const ficha = readFileSync(resolve(RAIZ, '../.decepticons/fichas/fatos-mineracao-amazonia.md'), 'utf8');
    for (const f of ler('pt').fatos) {
      expect(ficha, `a ficha não cita a fonte de ${f.id}`).toContain(f.link);
    }
    expect(ficha).toMatch(/🟢/);
  });

  it('os números dos fatos batem com o que foi lido na fonte (o texto em português é o que a ficha registra)', () => {
    const [mercurio, garimpo, yanomami] = ler('pt').fatos;
    expect(mercurio!.texto).toContain('200 pessoas');
    expect(mercurio!.texto).toContain('57,9%');
    expect(mercurio!.texto).toContain('6 µg/g');
    expect(garimpo!.texto).toContain('632%'); // o MapBiomas diz 632% (a ficha de 17/10 trazia 625%: corrigido na conferência)
    expect(garimpo!.texto).not.toContain('625');
    expect(garimpo!.texto).toContain('11.542');
    expect(yanomami!.texto).toContain('20 de janeiro de 2023');
    expect(yanomami!.fonte).toContain('nº 28');
    expect(yanomami!.texto).not.toMatch(/\b570\b|\b495\b|\b538\b/); // os números de mortes divergem entre as fontes: o jogo não os cita
  });

  it('cabe na tela sem rolagem em 1280×720: o texto de cada parte tem teto (as línguas de escrita latina e cirílica; as de ideograma são mais curtas)', () => {
    for (const id of LINGUAS) {
      const c = ler(id);
      for (const f of c.fatos) {
        const onde = `${id}/${f.id}`;
        expect(f.texto.length, onde).toBeLessThanOrEqual(620);
        expect(f.nota.length, onde).toBeLessThanOrEqual(240);
        expect(f.fonte.length, onde).toBeLessThanOrEqual(260);
        expect(f.quando.length, onde).toBeLessThanOrEqual(110);
      }
      for (const s of c.ficcao) expect(s.length, `${id}: ${s}`).toBeLessThanOrEqual(260);
    }
  });

  it('a honestidade do fim: em todas as línguas a ficção diz que o rio se curar em minutos é gesto de vitória, e há uma linha dizendo que o que não tem fonte é ficção', () => {
    for (const id of LINGUAS) {
      const c = ler(id);
      expect(c.ficcao.length, id).toBe(5);
      expect(c.ficcao[3], id).toMatch(/\d|minut|минут|分/);
    }
  });

  it('só arquétipos: nenhum nome de político ou bilionário vivo em nenhuma língua (decisão #9 do UNIVERSO.md)', () => {
    const proibidos = /trump|bolsonaro|lula\b|putin|biden|netanyahu|\bmusk|milei|zuckerberg|bezos/i;
    for (const id of LINGUAS) expect(readFileSync(resolve(RAIZ, `public/relatorio/${id}.json`), 'utf8'), id).not.toMatch(proibidos);
  });
});

describe('as linhas de "o que aconteceu"', () => {
  const m = ler('pt').linhas;

  it('vitória por dentro: o desfecho, a aldeia de pé, o rio limpo, os geradores, a Resistência e o tempo (m:ss)', () => {
    const l = linhasDoRelatorio(RESUMO, m);
    expect(l).toEqual([
      'O Draga-01 caiu por dentro: a carga plantada pelos andróides da Resistência o destruiu.',
      'A aldeia segue de pé.',
      'O rio volta a correr limpo, rio abaixo.',
      '3 de 3 geradores do escudo desmantelados.',
      '2 de 3 andróides da Resistência de pé.',
      'Tempo de missão: 12:34.',
    ]);
  });

  it('vitória a tiro troca só a linha do desfecho', () => {
    const l = linhasDoRelatorio({ ...RESUMO, porDentro: false }, m);
    expect(l[0]).toBe('O Draga-01 caiu a tiro, antes de chegar à aldeia.');
    expect(l[1]).toBe('A aldeia segue de pé.');
  });

  it('derrota: o Draga chega, a aldeia cai, o veneno segue rio abaixo (e a conta do que foi feito continua)', () => {
    const l = linhasDoRelatorio({ ...RESUMO, venceu: false, porDentro: false, geradoresCaidos: 1, androidesVivos: 0 }, m);
    expect(l.slice(0, 3)).toEqual(['O Draga-01 chegou à aldeia.', 'A aldeia caiu.', 'O veneno segue rio abaixo.']);
    expect(l[3]).toBe('1 de 3 geradores do escudo desmantelados.');
    expect(l[4]).toBe('0 de 3 andróides da Resistência de pé.');
  });

  it('o tempo: minutos e segundos, nunca negativo nem NaN', () => {
    expect(formatarTempo(0)).toBe('0:00');
    expect(formatarTempo(59.9)).toBe('0:59');
    expect(formatarTempo(600)).toBe('10:00');
    expect(formatarTempo(-5)).toBe('0:00');
    expect(formatarTempo(Number.NaN)).toBe('0:00');
  });

  it('todas as línguas preenchem os mesmos marcadores ({n}, {total}, {t}) das linhas de contagem', () => {
    for (const id of LINGUAS) {
      const c = ler(id).linhas;
      expect(c.geradores, id).toContain('{n}');
      expect(c.geradores, id).toContain('{total}');
      expect(c.resistencia, id).toContain('{n}');
      expect(c.resistencia, id).toContain('{total}');
      expect(c.tempo, id).toContain('{t}');
      expect(linhasDoRelatorio(RESUMO, c).join(' '), id).not.toMatch(/\{\w+\}/);
    }
  });
});

const lerJaneiro = (id: string): ConteudoDoRelatorio<ChavesDasLinhasJaneiro> => JSON.parse(readFileSync(resolve(RAIZ, `public/relatorio/janeiro/${id}.json`), 'utf8')) as ConteudoDoRelatorio<ChavesDasLinhasJaneiro>;
const FICHA_JANEIRO = readFileSync(resolve(RAIZ, '../.decepticons/fichas/fatos-8-de-janeiro.md'), 'utf8');
const PRACA: ResumoDaPraca = { missao: 'janeiro', venceu: true, causa: null, predio: null, expulsos: 120, eliminados: 14, rebeldes: 6, mesasLimpas: 9, naoLetalPct: 89.55, segundos: 301.4 };

describe('o Relatório da missão do 8 de Janeiro (P233): só o que a ficha de fatos libera, com a fonte', () => {
  it('o arquivo em português vale com as chaves da Praça e não vale com as do rio (e o do rio não vale com as da Praça)', () => {
    const praca = lerJaneiro('pt');
    expect(conteudoValido(praca, CHAVES_JANEIRO)).toBe(true);
    expect(conteudoValido(praca)).toBe(false);
    expect(conteudoValido(ler('pt'), CHAVES_JANEIRO)).toBe(false);
    expect(conteudoValido({ ...praca, linhas: { ...praca.linhas, naoLetal: '' } }, CHAVES_JANEIRO)).toBe(false);
    expect(conteudoValido({ ...praca, fatos: [{ ...praca.fatos[0]!, link: 'http://exemplo.org/x' }] }, CHAVES_JANEIRO)).toBe(false);
  });

  it('a regra "fato tem fonte": cada fonte está na ficha de fatos do 8 de janeiro, que a marca 🟢; todo fato diz o que não diz e quando', () => {
    const c = lerJaneiro('pt');
    expect(c.fatos.length).toBeGreaterThanOrEqual(3);
    for (const f of c.fatos) {
      expect(FICHA_JANEIRO, `a ficha não cita a fonte de ${f.id}`).toContain(f.link);
      expect(f.nota.length, f.id).toBeGreaterThan(20);
      expect(f.quando.length, f.id).toBeGreaterThan(5);
    }
    expect(FICHA_JANEIRO).toMatch(/🟢/);
  });

  it('só papéis: nenhuma pessoa real é nomeada nos textos (o endereço da fonte pode ter o nome na manchete; o texto não)', () => {
    const proibidos = /bolsonaro|lula\b|moraes|trump|putin|biden|netanyahu|\bmusk|milei|zuckerberg|bezos/i;
    const semEnderecos = JSON.stringify(lerJaneiro('pt')).replace(/https:\/\/[^"]+/g, '');
    expect(semEnderecos).not.toMatch(proibidos);
  });

  it('diz o que a ficha libera e nada além: "mais de 600" (sem o número exato no texto), "o golpe não se consumou", e NÃO afirma "os militares não aderiram"', () => {
    const [dia, danos, respons, trama] = lerJaneiro('pt').fatos;
    expect(dia!.texto).toContain('8 de janeiro de 2023');
    expect(dia!.texto).toContain('Decreto nº 11.377');
    expect(danos!.texto).toContain('R$ 30 milhões');
    expect(respons!.texto).toContain('mais de 600');
    expect(respons!.texto).not.toMatch(/\b(643|638)\b/); // o número exato muda a cada balanço: só na nota, com a data
    expect(respons!.nota).toContain('643');
    expect(trama!.texto).toContain('O golpe não se consumou');
    // "os militares não aderiram" só aparece entre aspas, na nota que o desmente
    expect(trama!.texto).not.toMatch(/não aderiram/);
    expect(trama!.nota).toContain('"os militares não aderiram"');
  });

  it('cabe na tela sem rolagem em 1280×720 (os mesmos tetos do Relatório do rio)', () => {
    const c = lerJaneiro('pt');
    for (const f of c.fatos) {
      expect(f.texto.length, f.id).toBeLessThanOrEqual(620);
      expect(f.nota.length, f.id).toBeLessThanOrEqual(240);
      expect(f.fonte.length, f.id).toBeLessThanOrEqual(260);
      expect(f.quando.length, f.id).toBeLessThanOrEqual(110);
    }
    for (const s of c.ficcao) expect(s.length, s).toBeLessThanOrEqual(260);
  });

  it('a ficção diz o que o jogo inventou: a multidão são tipos, a sujeira é humor, os números são do jogo, e o que não tem fonte fica de fora', () => {
    const ficcao = lerJaneiro('pt').ficcao.join(' ');
    expect(ficcao).toMatch(/caricaturas de tipos/);
    expect(ficcao).toMatch(/sujeira nas mesas é humor/);
    expect(ficcao).toMatch(/números da missão/);
    expect(ficcao).toMatch(/sem fonte|não tem fonte/);
  });

  it('as linhas de "o que aconteceu": vitória, derrota por prédio (com o nome), derrota por tempo; a nota não letal arredonda e o tempo é m:ss', () => {
    const m = lerJaneiro('pt').linhas;
    const venceu = linhasDaPraca(PRACA, m);
    expect(venceu[0]).toBe('Os três prédios seguem de pé e a Praça esvaziou.');
    expect(venceu).toContain('120 expulsos: fugiram do tiro ou do susto.');
    expect(venceu).toContain('14 eliminados.');
    expect(venceu).toContain('6 androides rebeldes derrubados.');
    expect(venceu).toContain('9 mesas limpas.');
    expect(venceu).toContain('90% dos que saíram da Praça foram expulsos, e não eliminados.');
    expect(venceu).toContain('Tempo de missão: 5:01.');
    const perdeu = linhasDaPraca({ ...PRACA, venceu: false, causa: 'predio', predio: 'LEGISLATIVO' }, m);
    expect(perdeu[0]).toBe('Um prédio caiu: LEGISLATIVO.');
    expect(linhasDaPraca({ ...PRACA, venceu: false, causa: 'tempo' }, m)[0]).toBe('O tempo acabou com gente na Praça.');
    expect(linhasDaPraca({ ...PRACA, segundos: Number.NaN }, m).at(-1)).toBe('Tempo de missão: 0:00.');
  });
});

describe('a ligação do Relatório (o que o navegador mostra)', () => {
  const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
  const game = readFileSync(resolve(RAIZ, 'src/core/Game.ts'), 'utf8');
  const css = readFileSync(resolve(RAIZ, 'src/styles.css'), 'utf8');

  it('o chip RELATÓRIO mora no console, escondido até a missão do rio acabar, e o Game baixa o painel só no clique (pedaço sob demanda, fora do JS de partida)', () => {
    expect(html).toMatch(/<button type="button" class="cc-chip cc-relatorio" id="cc-relatorio"[^>]*hidden>RELATÓRIO ▸<\/button>/);
    expect(game).toMatch(/getElementById\('cc-relatorio'\)\?\.addEventListener\('click'[\s\S]*import\('\.\.\/ui\/RelatorioPanel'\)\.then\(\(m\) => m\.abrirRelatorio\(resumo\)\)/);
    expect(game).not.toMatch(/^import (?!type).* from '\.\.\/ui\/RelatorioPanel'/m);
    expect(css).toMatch(/\.cc-relatorio\[hidden\] \{ display: none; \}/);
  });

  it('o resumo da Praça nasce no fim da missão do 8 de Janeiro, o chip abre o resumo que existir (o do rio ou o da Praça) e ele some quando a missão recomeça', () => {
    expect(game).toMatch(/this\.relatorioDaPraca = \{ missao: 'janeiro', venceu: survived[\s\S]*this\.mostrarChipDoRelatorio\(true\)/);
    expect(game).toMatch(/const resumo = this\.relatorioDoRio \?\? this\.relatorioDaPraca;/);
    expect(game).toMatch(/this\.relatorioDaPraca = null;\s*this\.relatorioDoRio = null;\s*this\.mostrarChipDoRelatorio\(false\)/);
  });

  it('o resumo nasce no fim da missão do rio e some quando ela recomeça (o chip acompanha)', () => {
    expect(game).toMatch(/this\.relatorioDoRio = \{[\s\S]*venceu: survived[\s\S]*porDentro: this\.match\.invasao\?\.detonou === true/);
    expect(game).toMatch(/this\.relatorioDoRio = null;\s*this\.mostrarChipDoRelatorio\(false\)/);
  });
});
