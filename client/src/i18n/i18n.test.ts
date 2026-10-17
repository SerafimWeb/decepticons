import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { WEAPON_IDS, weapon } from '../combat/weapons';
import { validarEmail, validarSenha } from '../../../shared/net/auth';
import { DICAS_DO_BOOT } from '../core/bootProgress';
import { DIFFICULTY_LABELS, KEY_ACTIONS, PERSONA_LABELS, QUALITY_LABELS } from '../core/Settings';
import { TEXTO_CONVIDADO, TEXTO_GUARDANDO, TEXTO_LOGADO } from '../ui/ContaSettings';
import { DICA_DA_ARMA } from '../ui/dicasDeArma';
import { IDIOMAS, carregarDicionario, idiomaInicial, idiomaValido, t, traduzir, type Dicionario } from './i18n';

const RAIZ = resolve(__dirname, '../..');
const LOCALES = resolve(RAIZ, 'public/locales');
const OUTRAS = IDIOMAS.filter((i) => i.id !== 'pt').map((i) => i.id);

const ler = (id: string): Dicionario => JSON.parse(readFileSync(resolve(LOCALES, `${id}.json`), 'utf8')) as Dicionario;
const LACUNA = /\{\d+\}/g;

describe('idiomaInicial: qual língua abrir', () => {
  it('o link manda mais que tudo, depois a escolha salva, depois o navegador', () => {
    expect(idiomaInicial('?lang=ja', 'en', 'fr-FR', false)).toBe('ja');
    expect(idiomaInicial('', 'es', 'fr-FR', false)).toBe('es');
    expect(idiomaInicial('', null, 'fr-FR', false)).toBe('fr');
    expect(idiomaInicial('', null, 'ru', false)).toBe('ru');
    expect(idiomaInicial('?lang=ZH-CN', null, undefined, false)).toBe('zh');
  });

  it('língua desconhecida ou ausente cai no português', () => {
    expect(idiomaInicial('?lang=klingon', 'xx', 'de-DE', false)).toBe('pt');
    expect(idiomaInicial('', null, undefined, false)).toBe('pt');
    expect(idiomaInicial('', null, 'pt-BR', false)).toBe('pt');
  });

  it('navegador de teste (webdriver) não detecta a língua: as bancadas comparam textos em português', () => {
    expect(idiomaInicial('', null, 'en-US', true)).toBe('pt');
    // mas a escolha explícita vale mesmo no teste
    expect(idiomaInicial('?lang=en', null, 'en-US', true)).toBe('en');
    expect(idiomaInicial('', 'ja', 'en-US', true)).toBe('ja');
  });

  it('idiomaValido só aceita as sete', () => {
    for (const i of IDIOMAS) expect(idiomaValido(i.id)).toBe(true);
    expect(idiomaValido('de')).toBe(false);
    expect(idiomaValido(null)).toBe(false);
    expect(idiomaValido('')).toBe(false);
  });
});

describe('traduzir: a tabela, as lacunas e o cache', () => {
  beforeEach(() => {
    carregarDicionario({
      'CALOR': 'HEAT',
      'ONDA {0}': 'WAVE {0}',
      'ONDA {0} ELIMINADA': 'WAVE {0} CLEARED',
      'DE {0} PARA {1}': 'TO {1} FROM {0}',
      'VENCEDOR: {0}': 'WINNER: {0}',
      'AZUL': 'BLUE',
      'faltam {0} · fim{1}': '{0} left · end{1}',
      '· +{0} pilotos': '· +{0} pilots',
      'Total (R$)': 'Total ($)',
    });
  });

  it('texto sem dicionário volta idêntico (português é o padrão)', () => {
    carregarDicionario(null);
    expect(traduzir('CALOR')).toBe('CALOR');
    expect(t('ONDA {0}', 3)).toBe('ONDA 3');
  });

  it('busca exata, preservando os espaços das pontas', () => {
    expect(traduzir('CALOR')).toBe('HEAT');
    expect(traduzir('  CALOR \n')).toBe('  HEAT \n');
  });

  it('o que não está na tabela fica em português, nunca vazio', () => {
    expect(traduzir('TEXTO NOVO')).toBe('TEXTO NOVO');
    expect(traduzir('')).toBe('');
    expect(traduzir('   ')).toBe('   ');
  });

  it('só número, tempo ou símbolo passa direto (o relógio muda todo segundo)', () => {
    expect(traduzir('00:42')).toBe('00:42');
    expect(traduzir('100%')).toBe('100%');
  });

  it('lacunas {n}: o jogo preenche, a tradução reordena', () => {
    expect(traduzir('ONDA 3')).toBe('WAVE 3');
    expect(traduzir('DE Rio PARA Fortaleza')).toBe('TO Fortaleza FROM Rio');
  });

  it('o padrão mais específico vence: "ONDA {0} ELIMINADA" antes de "ONDA {0}"', () => {
    expect(traduzir('ONDA 4 ELIMINADA')).toBe('WAVE 4 CLEARED');
    expect(traduzir('ONDA 4')).toBe('WAVE 4');
  });

  it('o que preenche a lacuna também é traduzido, com os espaços dele', () => {
    expect(traduzir('VENCEDOR: AZUL')).toBe('WINNER: BLUE');
    expect(traduzir('faltam 1:30 · fim · +3 pilotos')).toBe('1:30 left · end · +3 pilots');
    expect(traduzir('VENCEDOR: Maria')).toBe('WINNER: Maria');
  });

  it('caracteres especiais da chave não viram regex', () => {
    carregarDicionario({ 'Custa (R$ {0}) + taxa?': 'Costs ($ {0}) + fee?' });
    expect(traduzir('Custa (R$ 5) + taxa?')).toBe('Costs ($ 5) + fee?');
    expect(traduzir('Custa (R$ 5) + taxa')).toBe('Custa (R$ 5) + taxa');
  });

  it('trocar o dicionário limpa o cache (a língua anterior não vaza)', () => {
    expect(traduzir('CALOR')).toBe('HEAT');
    carregarDicionario({ 'CALOR': 'NAGREV' });
    expect(traduzir('CALOR')).toBe('NAGREV');
    carregarDicionario(null);
    expect(traduzir('CALOR')).toBe('CALOR');
  });

  it('valor vazio no dicionário é ignorado (cai no português)', () => {
    carregarDicionario({ 'CALOR': '' });
    expect(traduzir('CALOR')).toBe('CALOR');
  });

  it('t() monta a chave com os valores antes de traduzir', () => {
    expect(t('ONDA {0}', 7)).toBe('WAVE 7');
    expect(t('CALOR')).toBe('HEAT');
  });
});

describe('os dicionários (public/locales)', () => {
  it('existe um arquivo por língua, e só deles', () => {
    expect(readdirSync(LOCALES).sort()).toEqual(OUTRAS.map((i) => `${i}.json`).sort());
  });

  it('as seis línguas têm exatamente as mesmas chaves (ninguém fica para trás)', () => {
    const base = Object.keys(ler('en')).sort();
    expect(base.length).toBeGreaterThan(300);
    for (const id of OUTRAS) expect(Object.keys(ler(id)).sort(), id).toEqual(base);
  });

  it('nenhuma tradução vazia, e as lacunas {n} de cada uma são as da chave', () => {
    for (const id of OUTRAS) {
      for (const [chave, valor] of Object.entries(ler(id))) {
        expect(valor.trim(), `${id}: "${chave}"`).not.toBe('');
        expect((valor.match(LACUNA) ?? []).sort(), `${id}: lacunas de "${chave}"`).toEqual((chave.match(LACUNA) ?? []).sort());
      }
    }
  });

  it('nenhuma chave de dicionário começa ou termina com espaço (a busca é pelo texto sem as pontas)', () => {
    for (const chave of Object.keys(ler('en'))) expect(chave, chave).toBe(chave.trim());
  });

  it('cada língua usa a escrita dela (a tradução não é o português copiado)', () => {
    const marca: Record<string, RegExp> = { ja: /[぀-ヿ一-鿿]/, zh: /[一-鿿]/, ru: /[Ѐ-ӿ]/ };
    for (const [id, re] of Object.entries(marca)) {
      const valores = Object.values(ler(id));
      const certos = valores.filter((v) => re.test(v)).length;
      expect(certos / valores.length, id).toBeGreaterThan(0.9);
    }
  });
});

describe('a cobertura: o que o jogo mostra e o dicionário traduz', () => {
  // As seis línguas têm as mesmas chaves (teste acima); o japonês nunca escreve igual ao português, então serve de régua: se mudou, tem tradução.
  const JA = ler('ja');

  function coberto(texto: string): boolean {
    carregarDicionario(JA);
    return traduzir(texto) !== texto;
  }

  it('a dica de cada arma (uma por arma: arma nova sem tradução quebra aqui)', () => {
    const faltam: string[] = [];
    for (const id of WEAPON_IDS) {
      const texto = DICA_DA_ARMA[id](weapon(id, 0));
      if (!coberto(texto)) faltam.push(`${id}: ${texto}`);
    }
    expect(faltam).toEqual([]);
  });

  it('o nome de cada arma, em minúsculas de título e em caixa alta', () => {
    const faltam: string[] = [];
    for (const id of WEAPON_IDS) {
      const nome = weapon(id, 0).name;
      if (!coberto(nome)) faltam.push(nome);
      if (!coberto(nome.toUpperCase())) faltam.push(nome.toUpperCase());
    }
    expect(faltam).toEqual([]);
  });

  it('os rótulos de qualidade, dificuldade, teclas e personalidades das configurações', () => {
    const personas = Object.values(PERSONA_LABELS).flatMap((p) => [p.label, p.about]);
    const textos = [...Object.values(QUALITY_LABELS), ...Object.values(DIFFICULTY_LABELS), ...KEY_ACTIONS.map((k) => k.label), ...personas];
    const faltam = textos.filter((x) => !coberto(x));
    expect(faltam).toEqual([]);
  });

  it('a conta do piloto: as frases de estado e as mensagens de validação (a tela de login é a que o jogador novo lê para guardar o progresso)', () => {
    const textos = [TEXTO_CONVIDADO, TEXTO_LOGADO, TEXTO_GUARDANDO, validarEmail('x')!, validarSenha(1)!, validarSenha('curta')!, validarSenha('x'.repeat(100))!];
    expect(textos.filter((t) => !coberto(t))).toEqual([]);
  });

  it('as dicas da tela de carregamento (a primeira coisa que um jogador novo lê)', () => {
    expect(DICAS_DO_BOOT.filter((d) => !coberto(d))).toEqual([]);
  });

  it('os textos que o CSS escreve (content) têm as três variáveis em cada uma das seis línguas', () => {
    const css = readFileSync(resolve(RAIZ, 'src/styles.css'), 'utf8');
    for (const id of OUTRAS) {
      const bloco = new RegExp(String.raw`:root:lang\(${id}\)\s*\{([^}]*)\}`).exec(css)?.[1] ?? '';
      for (const v of ['--t-sem-sinal', '--t-inicializando', '--t-carregando']) expect(bloco, `${id} ${v}`).toContain(v);
    }
  });

  it('o index.html inteiro: todo texto e dica de ferramenta tem tradução, salvo as teclas, a marca e as ferramentas do dono', () => {
    const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
    const textos = new Set<string>();
    for (const m of html.matchAll(/>([^<>]+)</g)) textos.add(m[1]!.trim());
    for (const m of html.matchAll(/\b(?:title|aria-label|placeholder|alt)="([^"]+)"/g)) textos.add(m[1]!.trim());
    const SO_EM_PORTUGUES = new Set([
      'CYBERMECH', 'SHIFT', 'Shift', 'WASD', 'Esc', '[ Shift ]', '[ Ctrl ]',
    ]);
    const FERRAMENTA_DO_DONO = /npm run|ligar-mesa|A mesa é local|Na pasta do projeto|ou dê dois cliques|token do dono|campanha de fábrica|Estado do servidor|Todas as armas e todos os chassis|Chassi, arma, personalidade/;
    const faltam = [...textos].filter((x) => /\p{L}{3,}/u.test(x) && !SO_EM_PORTUGUES.has(x) && !FERRAMENTA_DO_DONO.test(x) && !coberto(x));
    expect(faltam).toEqual([]);
  });
});
