import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { WEAPON_IDS, weapon } from '../combat/weapons';
import { validarEmail, validarSenha } from '../../../shared/net/auth';
import { DICAS_DO_BOOT } from '../core/bootProgress';
import { DIFFICULTY_LABELS, KEY_ACTIONS, PERSONA_LABELS, QUALITY_LABELS } from '../core/Settings';
import { TEXTO_CONVIDADO, TEXTO_GUARDANDO, TEXTO_IDADE_GUARDADA, TEXTO_LOGADO } from '../ui/ContaSettings';
import { TEXTO_DA_ELEGIBILIDADE, TEXTO_DO_BOTAO_DA_VOZ, TEXTO_DO_MENOR_SO_OUVE } from '../voice/VozNasConfiguracoes';
import { CUSTO_DO_CONSORCIO, LADOS, SELO_SEM_LADO, TEXTO_CONFIRMAR, TEXTO_CUSTO_RODAPE, TEXTO_CUSTO_TITULO, TEXTO_ELES_DIZEM, TEXTO_FECHAR, TEXTO_PERGUNTA, TEXTO_RODAPE, TEXTO_SEGUIR, TEXTO_SIGNIFICA, TEXTO_VOLTAR } from '../ui/LadoSelector';
import { DICA_DA_ARMA } from '../ui/dicasDeArma';
import { CARTAO_TEXTOS } from '../ui/CartaoDaRecompensa';
import { ROTULOS } from '../core/recompensaDaPartida';
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

  it('o padrão com mais texto fixo vence a composição genérica "{0} · {1}" (que só traduz as partes)', () => {
    carregarDicionario({ 'RODADA {0} · {1}': 'ROUND {0} · {1}', '{0} · {1}': '{0} · {1}', '{0} · {1} · {2}': '{0} · {1} · {2}', 'azul': 'blue', 'verde': 'green', 'ESCALA {0}': 'SCALE {0}' });
    expect(traduzir('RODADA 3 · azul')).toBe('ROUND 3 · blue'); // o específico, e a parte traduzida pelo que ela já sabe
    expect(traduzir('azul · verde')).toBe('blue · green'); // sem específico: a composição traduz cada parte
    expect(traduzir('ESCALA 3 · azul · verde')).toBe('SCALE 3 · blue · green'); // três partes, uma delas com lacuna: "ESCALA {0}" não engole a composição
    expect(traduzir('ESCALA 3')).toBe('SCALE 3'); // sozinha, a chave com lacuna segue valendo
    expect(traduzir('azul · fosforescente')).toBe('blue · fosforescente'); // o que não está no dicionário fica em português
  });

  it('um padrão dentro de uma parte da composição também se traduz (duas voltas): "MECH · {arma} MK I"', () => {
    carregarDicionario({ '{0} · {1}': '{0} · {1}', '{0} MK {1}': '{0} MK {1}', 'MECH': 'メック', 'Lançador': 'ランチャー' });
    expect(traduzir('MECH · Lançador MK I')).toBe('メック · ランチャー MK I');
    expect(traduzir('Lançador MK II')).toBe('ランチャー MK II');
    // uma terceira volta não existe: nada de recursão sem fim
    expect(traduzir('MECH · MECH · MECH')).toBe('メック · メック · メック');
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

  it('a idade e o chat de voz (P211): as três frases de quem não pode usar a voz, a confirmação e as mensagens do servidor (a criança lê isto no idioma dela)', () => {
    const textos = [
      ...Object.values(TEXTO_DA_ELEGIBILIDADE),
      ...Object.values(TEXTO_DO_BOTAO_DA_VOZ),
      TEXTO_DO_MENOR_SO_OUVE,
      'Conta de menor de 18 anos: o chat de voz só ouve (sem microfone). O áudio do jogo segue normal.',
      'Informe o mês e o ano de nascimento da sua conta. Quem tem menos de 18 anos só ouve o chat de voz, sem microfone. Só dá para informar uma vez.',
      TEXTO_IDADE_GUARDADA,
      'informe o mês e o ano de nascimento', 'o nascimento já foi informado e não muda', 'não deu para guardar'];
    expect(textos.filter((x) => !coberto(x))).toEqual([]);
  });

  it('o seletor de lado: a pergunta, as duas respostas, o selo e o painel do custo (a primeira pergunta política do jogo tem que estar nas sete línguas)', () => {
    const textos = [
      TEXTO_PERGUNTA, TEXTO_RODAPE, TEXTO_CONFIRMAR, TEXTO_FECHAR, TEXTO_CUSTO_TITULO, TEXTO_CUSTO_RODAPE, TEXTO_SEGUIR, TEXTO_VOLTAR, TEXTO_ELES_DIZEM, TEXTO_SIGNIFICA, SELO_SEM_LADO, 'LADO: ALIANÇA', 'LADO: CONSÓRCIO',
      ...LADOS.flatMap((l) => [l.nome, l.quem, l.busca]),
      ...CUSTO_DO_CONSORCIO.flat(),
    ];
    expect(textos.filter((t) => !coberto(t))).toEqual([]);
  });

  it('o cartão do fim da partida (P304): cada frase e cada linha do XP, com o número já preenchido como o jogo mostra', () => {
    const com = (modelo: string) => modelo.replace('{0}', '3').replace('{1}', '1000');
    const textos = [...Object.values(CARTAO_TEXTOS), ...Object.values(ROTULOS)].map(com).filter((x) => /\p{L}{3,}/u.test(x.replace(/XP/g, '')));
    expect(textos.length).toBeGreaterThan(10);
    expect(textos.filter((x) => !coberto(x))).toEqual([]);
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
    const FERRAMENTA_DO_DONO = /npm run|ligar-mesa|A mesa é local|Na pasta do projeto|ou dê dois cliques|token do dono|campanha de fábrica|Estado do servidor|Todas as armas e todos os chassis|Chassi, arma, personalidade|VISIBILIDADE ▸|O que os jogadores veem: liberar|TELÕES ▸|Qual vídeo toca em cada telão|WARGAME ▸|Monta um episódio de IA contra IA|OUTDOORS ▸|Quantos outdoors da marca aparecem|FASE ESCURA|Liga e desliga a fase escura/;
    const faltam = [...textos].filter((x) => /\p{L}{3,}/u.test(x) && !SO_EM_PORTUGUES.has(x) && !FERRAMENTA_DO_DONO.test(x) && !coberto(x));
    expect(faltam).toEqual([]);
  });

  it('o idioma e a conta estão no canto da primeira tela (e da pausa), não só dois níveis abaixo nas Configurações (P176: o Comandante não os achou)', () => {
    const html = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
    const overlay = html.indexOf('<div id="overlay"');
    const rapido = html.indexOf('id="idioma-rapido"');
    const conta = html.indexOf('id="btn-conta-rapido"');
    const topo = html.indexOf('<header class="cc-top');
    expect(overlay).toBeGreaterThan(0);
    for (const posicao of [rapido, conta]) {
      expect(posicao).toBeGreaterThan(overlay);
      expect(posicao).toBeLessThan(topo);
    }
    expect(html).toMatch(/<select id="idioma-rapido" data-i18n="nao"/); // os nomes das línguas nunca são traduzidos
    expect(html).toMatch(/id="btn-conta-rapido" data-settings-open="jogo" data-settings-foco="settings-conta"/);
    // o seletor das Configurações segue lá: os dois andam juntos
    expect(html).toMatch(/<select id="setting-idioma" data-i18n="nao"/);
  });
});

describe('a cobertura das telas avançadas (auditoria de 17/10: o Hangar falava português em japonês)', () => {
  const JA = ler('ja');
  /** Os nomes próprios que ficam como estão (marcas, fabricantes, apelidos dos bots). */
  const NOMES = /Forge Systems|Vanta Works|Cybermech Industries|CYBERMECH|CLAWD|BRABO|ESCOLTA|PLASMA|NEON|MK [I]+|Colossus-V4|Vector-09|COLOSSUS-01|VORCARIS|DAN|DRAGA(-01)?|Draga(-01)?|Ctrl|Shift/g;
  /** Traduzido de verdade: mudou, e não sobrou palavra em português (só nomes próprios e unidades). */
  const coberto = (texto: string): boolean => {
    carregarDicionario(JA);
    const feito = traduzir(texto);
    return feito !== texto && !/[A-Za-zÀ-ú]{4,}/.test(feito.replace(NOMES, ''));
  };
  const dicasDoHangar = JSON.parse(readFileSync(resolve(RAIZ, 'public/dicas-do-hangar.json'), 'utf8')) as Record<string, string>;

  it('a dica de uma linha de cada arma no Hangar, e as frases que o encaixe junta a ela', () => {
    const faltam = Object.entries(dicasDoHangar).filter(([, texto]) => !coberto(texto)).map(([id]) => id);
    expect(faltam).toEqual([]);
    for (const frase of ['· um lançador em cada ombro: a carga conta duas vezes', '· fica nas costas do Mech, apontando para cima; o antebraço fica liso', '· tamanho 3: o que é pesado nos Mechs comuns é leve para ele']) expect(coberto(frase), frase).toBe(true);
  });

  it('os textos compostos "A · B · C" do Hangar se traduzem parte a parte (o que o navegador mostra, não só o que está no código)', () => {
    const casos = [
      'MÉDIO · ASSALTO · Equilíbrio entre alcance e mobilidade.',
      'LEVE · PILOTO · Pequeno e ágil; vence no combate próximo.',
      'ESCALA 3 · CERCO · Lento e blindado; devastador de perto.',
      'ESCALA 4 · TITÃ · O maior do jogo: passo curto, joelho dobrado e o canhão de cerco.',
      'MÉDIO · IMPORTADO · Malha de Forge Systems.',
      '11 t de carga · 5,3 m · EM USO',
      '3 t de carga · 1,6 m',
      'PADRÃO · 3,0 t',
      '+20% dano · 4,5 t',
      '4,0 t livres',
      'EXCEDE 6,0 t',
      'HANGAR · CENTRO DE MONTAGEM',
      'BLINDAGEM · TORSO',
      'BRAÇO DIREITO · ATAQUE 1',
      'BRAÇOS 1 · OMBROS 2',
      'DIREITO 1 · ESQ. + OMBROS 2',
      'Lançador de mísseis leve · 2,0 t',
      'DANO EM 20 S',
    ];
    const faltam = casos.filter((c) => !coberto(c));
    expect(faltam).toEqual([]);
    carregarDicionario(JA);
    expect(traduzir('PADRÃO · 3,0 t')).not.toMatch(/[A-Za-zÀ-ú]{4,}/); // nada de português sobrando
    expect(traduzir('MÉDIO · ASSALTO · Equilíbrio entre alcance e mobilidade.')).not.toMatch(/ASSALTO|Equilíbrio/);
  });

  it('o HUD da partida e o painel de ordens aos aliados', () => {
    const casos = ['VISTA 3ª PESSOA  [V]', 'VISTA 1ª PESSOA  [V]', 'VISTA TÁTICA  [V]', '1 · Acompanhar', '2 · Foco', '3 · Defender', '2/2 aliados · Escolta', '1/2 aliados · Fogo concentrado', '2/2 aliados · Defesa de posição', 'Equipe: concentrar fogo', 'Equipe: defender esta posição', '◈ ESCOLTA·PLASMA: CONTATO ▸ CLAWD·BRABO'];
    expect(casos.filter((c) => !coberto(c))).toEqual([]);
  });

  it('os modos de jogo: a missão da praia (Cabos Abertos), a bandeira, o domínio, as conquistas, o briefing, o banco e o respawn', () => {
    const casos = [
      'PORTO', 'PONTE', 'ESTAÇÃO', 'REDE DA ESTAÇÃO', 'QUADRO DE LUZ DA CIDADE', 'CABO 1', 'CABO 3', 'ENTRADA PRINCIPAL', 'ENTRADA DOS FUNDOS', 'PORTA 2', 'TRANSFORMADOR · BANCO VORCARIS', 'ESTAÇÃO 64%',
      'VADEANDO · ANDA MAIS DEVAGAR', 'FUNDO · AFOGA EM 3.2 s · SAIA DO MAR', 'AFOGANDO · SAIA DO MAR', 'A ESTAÇÃO CAIU', 'ESTAÇÃO A 75% · EXPULSE OS INVASORES', 'INVASORES NA ESTAÇÃO · EXPULSE-OS',
      'CABO 2 TOMADO · A REDE ESTÁ SENDO ENVENENADA', 'CABO 2 CORTADO · CONSERTE', 'CABO 2 LIBERADO', 'CABO 2 · ANDRÓIDE LIGADO · INJETANDO DESINFORMAÇÃO', 'ENTRADA PRINCIPAL ARROMBADA · INVASORES DENTRO',
      'ENTRADA PRINCIPAL RECUPERADA', 'ENTRADA PRINCIPAL SOB ATAQUE', 'CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM', 'QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU', 'QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO',
      'OPERAÇÃO CABOS ABERTOS', 'Os cabos submarinos de Fortaleza trazem a internet para o país.', 'Forças hostis desembarcam pela orla para invadir a rede e plantar desinformação.',
      'Segure a ESTAÇÃO: expulse quem entrar nos muros e elimine as ondas. Rede caída, missão perdida.', 'COLOSSUS-01 · FASE 2 DE 3 · MANCA', 'PERNA ESQ', 'PERNA DIR', 'ANDA', 'RASTEJA', 'CAIU',
      'Ele vai cortar os cabos. Derrube as pernas.', 'Uma perna caiu: ele manca. Derrube a outra.', 'Rasteja e atira. Acabe com ele antes que o último cabo caia.',
      'BANDEIRA AZUL ROUBADA!', 'PONTO PARA O TIME VERMELHA!', '// PILOTO DAN', '// EM MOVIMENTO', '// CAPTURADA POR DAN', '// BANDEIRA ENTREGUE', '// RETORNADA À BASE', '// CAÍDA NO CAMPO DE BATALHA', 'DOMÍNIO ENCERRADO · VITÓRIA',
      'SOBREVIVENTE SÊNIOR', 'CAÇADOR DE IAs', 'Eliminou 8 ou mais robôs rebeldes', 'DEVASTADOR DE AÇO', 'Causou 1500+ de dano total', 'VETERANO DE ONDAS', 'Resistiu a 3 ou mais ondas',
      '// MISSÃO', 'NÍVEL DE AMEAÇA //', '[ INICIAR MISSÃO ]', 'V / V · SERVIÇOS AO PILOTO', 'BANCO VORCARIS', 'Digite seu código de autorização para receber créditos ou reforços.', 'CÓDIGO DE AUTORIZAÇÃO',
      'Digite o código', 'RESGATAR', 'VALIDANDO AUTORIZAÇÃO…', 'Sem resposta. Tente novamente quando houver conexão.', 'VOLTAR AO COMBATE', 'A arena continua ativa durante o atendimento.', 'Combate pausado durante o atendimento.',
      'ARRASTE OS BOTÕES', 'CABEÇA', '[ clique para tentar de novo ]', 'RENASCENDO EM 3.0 s', 'RENASCENDO EM 2.1 s · CÂMERA DE ABATE [V: SAIR]',
    ];
    expect(casos.filter((c) => !coberto(c))).toEqual([]);
  });

  it('a missão do rio na Amazônia: o escudo e os geradores, a aldeia, os dois lados e a barra do Draga', () => {
    const casos = [
      'TORRES DA MARGEM ARMADAS', 'TORRES DA MARGEM SEM ENERGIA', 'ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM', 'INVASÃO · CARGA 45% · 2 DE 3 DENTRO', 'ESCUDO DO DRAGA CAIU', 'GERADOR CAIU · RESTAM 2', 
      'DERRUBE OS GERADORES · 1 DE 3', 'DERRUBE O DRAGA-01', 'Siga o marcador: CERCA, a 320 m.', 'Siga os marcadores verdes.', 'Derrube o Draga a tiro.', 'A Resistência corre até a escotilha. Escolte-a ou derrube o Draga a tiro.', 'A Resistência planta a carga: 45%. Proteja-a ou derrube o Draga a tiro.', 'CERCA · 320 m', 'PLANTA · 90 m', 'CAVA · 560 m', 'ESCOTILHA · 40 m', 'AMAZÔNIA · TERRAS RARAS', 'ALDEIA · DRAGA A 760 m · 5 MIN', 'ALDEIA · DRAGA A 1.200 m · PARADO', 'LADO ESQ', 'LADO DIR', 'DRAGA-01 · FASE 1 DE 3 · ANDA', 'DRAGA-01 · FASE 3 DE 3 · RASTEJA',
      'Ele marcha para a aldeia. Derrube as pernas.', 'Um lado caiu: ele manca. Derrube o outro.', 'Rasteja e atira. Acabe com ele antes que chegue à aldeia.',
      'O DRAGA ESTÁ ÀS PORTAS DA ALDEIA', 'O DRAGA ESTÁ A 500 m DA ALDEIA', 'O RIO VIVE · DRAGA-01 DERRUBADO', 'A ALDEIA CAIU · O DRAGA-01 CHEGOU', 'O DRAGA-01 CAIU ANTES DE CHEGAR À ALDEIA', 'O DRAGA-01 ALCANÇOU A ALDEIA',
    ];
    expect(casos.filter((c) => !coberto(c))).toEqual([]);
  });

  it('o Esquadrão mostra o jeito de cada robô (brabo, soldado, manso, fujão) e a arma com o nível: tudo traduzido', () => {
    const casos = ['MECH · brabo', 'MECH · soldado', 'ANDRÓIDE · manso', 'MECH · fujao', 'Lançador EMP MK I', 'Canhão de plasma MK III', 'MECH · Lançador EMP MK I', 'Canhão de plasma MK I: dano 16, ótimo a 60 m, 4,5 tiros/s. O robô ataca de onde a arma rende.'];
    expect(casos.filter((c) => !coberto(c))).toEqual([]);
  });

  it('o Esquadrão e as Campanhas: os rótulos, os esquadrões prontos, as quantidades e o papel de cada chassi', () => {
    const casos = [
      'ESQUADRÃO', 'FICHA DO ROBÔ', 'Apelido', 'Personalidade', 'Chassi', 'Braço direito', 'Braço esquerdo', 'Costas', 'Ombro direito', 'Ombro esquerdo', 'Vazio', 'O titã luta com a arma de fábrica, como chefe: costas e ombros são só do Hangar.', 'Dificuldade', '[ DUPLICAR ]', '[ SALVAR E REINICIAR ]', 'PRONTOS', 'BATALHÃO', 'DUELO', 'SÓ ALIADOS', '+ ANDRÓIDE',
      '6 de 32 robôs · 4 contra você, 2 com você', 'Tirar CLAWD·BRABO',
      'Equilibrado: a referência. Nada excelente, nada fraco. Vida 300, 9 m/s.',
      'CAMPANHAS', 'DE FÁBRICA', 'OPERAÇÃO NEON', '1 etapa', '4 etapas', '1/8 etapas', 'CIDADE NEON · SOBREVIVÊNCIA', 'Limpe todas as ondas · 4 inimigos · 2 aliados', '1 etapa · o link leva 50 letras', '[ + NOVA CAMPANHA ]',
    ];
    expect(casos.filter((c) => !coberto(c))).toEqual([]);
  });
});
