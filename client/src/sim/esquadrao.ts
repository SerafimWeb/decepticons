import { weapon, type Tier, type WeaponId } from '../combat/weapons';
import { NAME_MAX } from '../core/botNames';
import { DEFAULT_SETTINGS, type Difficulty, type EnemyNames, type Persona } from '../core/Settings';
import { ARM_SLOTS, CHASSIS, type ChassisId } from '../entities/chassis';
import type { MapId } from '../environment/Bunker';
import type { Foes } from './Match';
import { ALLY_COUNT, capacidadeDoMapa, type Contagem, nascimentosDoEsquadrao, type Ponto } from './nascimentos';

/**
 * O esquadrão (12/10, P91: "quero poder adicionar mais bots e aliados, além dos 3 do padrão"): quem está na partida, um por um, em dois
 * lados. É o contrato (AGENTS, regra 5: o contrato entra antes da tela) que o `Match` lê para montar os robôs, o editor do console escreve
 * e o link `?esquadrao=` carrega. Só dados e conta: sem Three.js nem DOM, roda igual no navegador, nos testes e no servidor.
 *
 * - **O padrão é o jogo de hoje.** `esquadraoDeFoes` traduz as configurações antigas (`enemyMechs`, `enemyAndroids`, `technician`,
 *   personalidades) no esquadrão equivalente, e `esquadraoPadrao.test.ts` prova, com fotos da partida tick a tick, que montá-lo dá a
 *   mesma partida. Os nomes que o jogador pôs em Configurações > Nomes continuam valendo para quem não tem nome próprio.
 * - **Nada é confiado.** O que vem do aparelho, do link ou da rede passa por `sanearEsquadrao` (que corta o que não cabe) ou por
 *   `lerChaveDoEsquadrao` (que recusa o texto inteiro se algo estiver errado: nada é aplicado pela metade).
 * - **O teto é a CPU, explicada.** Cada robô a mais custa um controlador de personagem e uma IA por tick (G4/G5: nada é criado no tick);
 *   `LIMITES_DO_ESQUADRAO` é o que a medição de `esquadrao.custo.test.ts` aguenta, e o editor mostra o peso do esquadrão contra ele.
 */

export const ESQUADRAO_VERSAO = 1;
/** Parâmetro do link que leva o esquadrão a outro aparelho: `?esquadrao=q1.m:pb,m,a,a,t.m,m`. */
export const PARAM_DO_ESQUADRAO = 'esquadrao';

/** O corpo do robô: o Mech (escala 2), o andróide de motosserra (escala 1) ou o técnico (andróide que conserta, sem arma). */
export type PapelDoBot = 'mech' | 'android' | 'technician';
export const PAPEIS: readonly PapelDoBot[] = ['mech', 'android', 'technician'];
export type LadoDoBot = 'inimigo' | 'aliado';

/** A arma principal de um Mech do esquadrão (nível incluído). */
export interface ArmaDoBot {
  id: WeaponId;
  tier: Tier;
}

/**
 * Um robô do esquadrão. Tudo é opcional menos o papel: ausente = o padrão do papel (Mech Vector-09 soldado com as armas de fábrica,
 * o nome da lista de Configurações, a dificuldade da partida). Persona, chassi e arma só existem no Mech.
 */
export interface BotSpec {
  papel: PapelDoBot;
  /** Apelido na tela e no placar (até `NAME_MAX` letras). */
  nome?: string;
  /** Como pilota (`combat/BotController.ts`, `PERSONAS`). Padrão: soldado. */
  persona?: Persona;
  /** O corpo (vida, passo, dash). Padrão: Vector-09. Só os de `CHASSIS_DOS_BOTS`. */
  chassi?: ChassisId;
  /** A arma principal (a do botão principal). Padrão: a de fábrica do chassi. Só as de `armasDoBot`. */
  arma?: ArmaDoBot;
  /** Dificuldade própria. Padrão: a da partida (Configurações). */
  dificuldade?: Difficulty;
}

export interface EsquadraoSpec {
  v: typeof ESQUADRAO_VERSAO;
  /** Quem caça o jogador e os aliados. */
  inimigos: BotSpec[];
  /** Quem escolta o jogador (só Arena e Bunker). Mech e andróide; sem técnico. */
  aliados: BotSpec[];
}

// ─── O que um robô do esquadrão pode ser ──────────────────────────────────────

/**
 * Os chassis que um bot pilota: os Mechs (tamanho 2). Ficam de fora o andróide (é um papel, não um chassi) e o Colossus (é o chefe da
 * Sobrevivência, com perfil de cerco próprio). Os de malha importada entram com o **corpo procedural do Vector-09** e os números do
 * próprio chassi: o servidor não carrega `.glb` (`MECHS_IMPORTADOS.md`), então o bot tem a vida e o passo do Lancer, mas a silhueta de um Mech médio.
 */
export const CHASSIS_DOS_BOTS: readonly ChassisId[] = (Object.keys(CHASSIS) as ChassisId[]).filter((id) => id !== 'android' && id !== 'colossus01');

export const ehChassiDoBot = (id: unknown): id is ChassisId => typeof id === 'string' && (CHASSIS_DOS_BOTS as readonly string[]).includes(id);

/**
 * O bot atira o projétil comum, a cadência da arma, sem segurar o gatilho: serve a arma de energia sem rotação de cano, chama, onda, carga
 * nem míssil guiado (`combat/weapons.ts`). As outras precisam de regras de gatilho que só o jogador usa (`Armament.ts`).
 */
export function armaServeAoBot(id: WeaponId): boolean {
  const w = weapon(id);
  return w.kind === 'energy' && !w.spin && !w.flame && !w.wave && !w.guide && !w.barrage && w.chargeTime === undefined;
}

/** As armas que cabem na mão principal do chassi e que o bot sabe usar, na ordem do catálogo. */
export function armasDoBot(chassi: ChassisId): readonly WeaponId[] {
  return ARM_SLOTS[chassi].right.filter(armaServeAoBot);
}

const TIERS: readonly Tier[] = [0, 1, 2];
const DIFICULDADES: readonly Difficulty[] = ['facil', 'normal', 'dificil'];
const PERSONAS: readonly Persona[] = ['soldado', 'brabo', 'manso', 'fujao'];

const ehPapel = (v: unknown): v is PapelDoBot => PAPEIS.includes(v as PapelDoBot);
const ehPersona = (v: unknown): v is Persona => PERSONAS.includes(v as Persona);
const ehDificuldade = (v: unknown): v is Difficulty => DIFICULDADES.includes(v as Difficulty);
const ehNivel = (v: unknown): v is Tier => TIERS.includes(v as Tier);

/** Quem pode estar de cada lado: o aliado não tem técnico (o conserto é dos rebeldes). */
export const PAPEIS_DO_LADO: Readonly<Record<LadoDoBot, readonly PapelDoBot[]>> = {
  inimigo: ['mech', 'android', 'technician'],
  aliado: ['mech', 'android'],
};

// ─── Teto e peso ──────────────────────────────────────────────────────────────

/**
 * Quantos robôs cabem (P91). Cada um é um controlador de personagem e uma IA por tick, mais uns 10 desenhos; medido no Node (sem GPU) com
 * o jogador parado e todos caçando-o: o tick vai de 0,55 ms no jogo de hoje (7 corpos) a 1,9 ms com 33 corpos, p95 abaixo de 4 ms, e a
 * parte de animação do desenho custa menos de 0,3 ms (`PAINEL_ADMIN.md` §8). A simulação sobra muito: o teto é a GPU e a leitura da
 * partida (32 robôs numa arena de 200 m já é tiroteio o tempo todo), e `esquadrao.custo.test.ts` guarda o orçamento de tick. Passar daqui
 * é recusado pelo editor e cortado por `sanearEsquadrao`.
 */
export const LIMITES_DO_ESQUADRAO = {
  inimigos: 24,
  aliados: 12,
  tecnicos: 2,
  /** Inimigos e aliados juntos (mais o jogador: a sala inteira). */
  total: 32,
} as const;

/**
 * O quanto cada papel pesa na conta de carga, em "Mechs": o andróide é pequeno (cápsula e rig leves: ~1/3 dos triângulos de um Mech),
 * o técnico não atira. É o que o editor soma para dizer se a partida vai pesar (`nivelDeCarga`).
 */
export const PESO_DO_PAPEL: Readonly<Record<PapelDoBot, number>> = { mech: 1, android: 0.6, technician: 0.5 };

export type NivelDeCarga = 'leve' | 'media' | 'alta' | 'extrema';

/**
 * Como a partida pesa para a máquina, pelo peso do esquadrão: **leve** é o jogo de hoje (peso ~5, 6 robôs); **média** até 16; **alta** até 24;
 * **extrema** acima disso (até o teto). O desenho é o que pesa: ~10 malhas e uns 1.900 triângulos por Mech; em placa de vídeo integrada, a
 * qualidade adaptativa (`core/Quality.ts`) baixa a resolução antes de o jogo engasgar. A simulação, no Node, fica abaixo de 2 ms por tick em todos os níveis.
 */
export function nivelDeCarga(peso: number): NivelDeCarga {
  return peso <= 8 ? 'leve' : peso <= 16 ? 'media' : peso <= 24 ? 'alta' : 'extrema';
}

export interface Limites {
  inimigos: number;
  aliados: number;
  tecnicos: number;
  total: number;
}

/** Os limites no mapa: o menor entre o teto de CPU e o chão que o mapa tem (o Bunker tem 11 pontos livres). */
export function limitesDoMapa(mapa: MapId = 'arena'): Limites {
  const cap = capacidadeDoMapa(mapa);
  return {
    inimigos: Math.min(LIMITES_DO_ESQUADRAO.inimigos, cap.inimigos),
    aliados: Math.min(LIMITES_DO_ESQUADRAO.aliados, cap.aliados),
    tecnicos: LIMITES_DO_ESQUADRAO.tecnicos,
    total: Math.min(LIMITES_DO_ESQUADRAO.total, cap.total),
  };
}

export interface Resumo {
  mechs: number;
  androids: number;
  tecnicos: number;
  aliadosMechs: number;
  aliadosAndroids: number;
  inimigos: number;
  aliados: number;
  total: number;
  /** O peso de CPU do esquadrão, em "Mechs" (`PESO_DO_PAPEL`). */
  peso: number;
}

export function resumoDoEsquadrao(spec: EsquadraoSpec): Resumo {
  const conta = (lista: readonly BotSpec[], papel: PapelDoBot) => lista.filter((b) => b.papel === papel).length;
  const mechs = conta(spec.inimigos, 'mech');
  const androids = conta(spec.inimigos, 'android');
  const tecnicos = conta(spec.inimigos, 'technician');
  const aliadosMechs = conta(spec.aliados, 'mech');
  const aliadosAndroids = conta(spec.aliados, 'android');
  const peso = [...spec.inimigos, ...spec.aliados].reduce((soma, b) => soma + PESO_DO_PAPEL[b.papel], 0);
  return {
    mechs, androids, tecnicos, aliadosMechs, aliadosAndroids,
    inimigos: spec.inimigos.length,
    aliados: spec.aliados.length,
    total: spec.inimigos.length + spec.aliados.length,
    peso: Math.round(peso * 100) / 100,
  };
}

/** O esquadrão cabe nos limites do mapa? Devolve o que passou, por lado, para o editor dizer (vazio = cabe). */
export function excessosDoEsquadrao(spec: EsquadraoSpec, mapa: MapId = 'arena'): string[] {
  const lim = limitesDoMapa(mapa);
  const r = resumoDoEsquadrao(spec);
  const out: string[] = [];
  if (r.inimigos > lim.inimigos) out.push(`inimigos: ${r.inimigos} de no máximo ${lim.inimigos}`);
  if (r.aliados > lim.aliados) out.push(`aliados: ${r.aliados} de no máximo ${lim.aliados}`);
  if (r.tecnicos > lim.tecnicos) out.push(`técnicos: ${r.tecnicos} de no máximo ${lim.tecnicos}`);
  if (r.total > lim.total) out.push(`no total: ${r.total} de no máximo ${lim.total}`);
  return out;
}

// ─── Limpar o que vem de fora ─────────────────────────────────────────────────

/**
 * Um nome da tela: sem tags nem quebras, cabe em `NAME_MAX`. Vazio ou inválido vira `undefined` (o nome padrão do lugar). Igual ao de
 * Configurações > Nomes, e sem deixar meio emoji no fim quando o corte cai no meio dele.
 */
export function limparNome(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).replace(/[\uD800-\uDBFF]$/, '');
  return s || undefined;
}

/**
 * Um robô limpo e **canônico**: só os campos que o papel tem, nenhum no valor padrão (o Mech soldado de Vector-09 é só `{ papel: 'mech' }`).
 * Dois robôs iguais saem iguais, e é o que torna o link do esquadrão estável. Devolve `null` se nem o papel existe ou não é do lado.
 */
export function sanearBot(raw: unknown, lado: LadoDoBot = 'inimigo'): BotSpec | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!ehPapel(r.papel) || !PAPEIS_DO_LADO[lado].includes(r.papel)) return null;
  const bot: BotSpec = { papel: r.papel };
  const nome = limparNome(r.nome);
  if (nome) bot.nome = nome;
  if (ehDificuldade(r.dificuldade) && r.papel !== 'technician') bot.dificuldade = r.dificuldade;
  if (r.papel !== 'mech') return bot;
  if (ehPersona(r.persona) && r.persona !== 'soldado') bot.persona = r.persona;
  const chassi = ehChassiDoBot(r.chassi) ? r.chassi : 'vector09';
  if (chassi !== 'vector09') bot.chassi = chassi;
  const a = r.arma as Partial<ArmaDoBot> | null | undefined;
  if (a && typeof a === 'object' && typeof a.id === 'string' && ehNivel(a.tier) && (armasDoBot(chassi) as readonly string[]).includes(a.id)) {
    bot.arma = { id: a.id, tier: a.tier };
  }
  return bot;
}

const lista = (raw: unknown, lado: LadoDoBot): BotSpec[] =>
  (Array.isArray(raw) ? raw : []).flatMap((b) => {
    const bot = sanearBot(b, lado);
    return bot ? [bot] : [];
  });

/**
 * Um esquadrão válido a partir de qualquer coisa (armazenamento, link, rede): cada robô limpo (`sanearBot`), o que passa do limite do mapa
 * cortado do fim (aliados primeiro, depois inimigos, até caber), e o que não é esquadrão vira o padrão. Nunca lança.
 */
export function sanearEsquadrao(raw: unknown, mapa: MapId = 'arena'): EsquadraoSpec {
  if (typeof raw !== 'object' || raw === null || (raw as { v?: unknown }).v !== ESQUADRAO_VERSAO) return esquadraoPadrao();
  const r = raw as Record<string, unknown>;
  const lim = limitesDoMapa(mapa);
  let tecnicos = 0;
  const inimigos = lista(r.inimigos, 'inimigo')
    .filter((b) => b.papel !== 'technician' || ++tecnicos <= lim.tecnicos)
    .slice(0, lim.inimigos);
  const aliados = lista(r.aliados, 'aliado').slice(0, lim.aliados);
  while (inimigos.length + aliados.length > lim.total) {
    if (aliados.length > 0) aliados.pop();
    else inimigos.pop();
  }
  return { v: ESQUADRAO_VERSAO, inimigos, aliados };
}

// ─── O padrão: o jogo de hoje ─────────────────────────────────────────────────

/**
 * O esquadrão que as configurações antigas descrevem: os Mechs rebeldes (o pool de `enemyMechs` menos as vagas dos aliados, que o jogo
 * sempre deu a eles para não passar de 8 na sala, G11), os andróides, o técnico, e os aliados da escolta (o segundo e os de índice ímpar
 * levam o lançador EMP, o supressor). `aliados` é quantos há: `ALLY_COUNT` na Arena offline, 0 no servidor.
 */
export function esquadraoDeFoes(foes: Foes, aliados: number = ALLY_COUNT): EsquadraoSpec {
  const mechs = Math.max(0, foes.enemyMechs - aliados);
  const inimigos: BotSpec[] = [
    ...Array.from({ length: mechs }, (_, i): BotSpec => {
      const persona = foes.enemyPersonas[i];
      return persona && persona !== 'soldado' ? { papel: 'mech', persona } : { papel: 'mech' };
    }),
    ...Array.from({ length: foes.enemyAndroids }, (): BotSpec => ({ papel: 'android' })),
    ...(foes.technician ? [{ papel: 'technician' } as BotSpec] : []),
  ];
  const escolta = Array.from({ length: aliados }, (_, i): BotSpec => (i % 2 ? { papel: 'mech', arma: { id: 'emp', tier: 0 } } : { papel: 'mech' }));
  return { v: ESQUADRAO_VERSAO, inimigos, aliados: escolta };
}

/** O esquadrão de fábrica: 1 Mech brabo, 2 andróides e o técnico contra o jogador e 2 aliados. */
export function esquadraoPadrao(): EsquadraoSpec {
  return esquadraoDeFoes(DEFAULT_SETTINGS);
}

// ─── O link: ?esquadrao=q1.m:pb,m,a,a,t.m,m ───────────────────────────────────

const LETRA_DO_PAPEL: Readonly<Record<PapelDoBot, string>> = { mech: 'm', android: 'a', technician: 't' };
const LETRA_DA_PERSONA: Readonly<Record<Persona, string>> = { soldado: 's', brabo: 'b', manso: 'm', fujao: 'f' };
const LETRA_DA_DIFICULDADE: Readonly<Record<Difficulty, string>> = { facil: 'f', normal: 'n', dificil: 'd' };
const deLetra = <T extends string>(tabela: Readonly<Record<T, string>>, letra: string): T | undefined =>
  (Object.keys(tabela) as T[]).find((k) => tabela[k] === letra);

/** O nome vai em base64 de URL (letras, números, `-` e `_`): nenhum caractere do nome atrapalha os separadores `. , :`. */
function nomeParaTexto(nome: string): string {
  const bytes = new TextEncoder().encode(nome);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function textoParaNome(texto: string): string | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(texto)) return undefined;
  try {
    const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

function chaveDoBot(b: BotSpec): string {
  const campos = [LETRA_DO_PAPEL[b.papel]];
  if (b.persona) campos.push(`p${LETRA_DA_PERSONA[b.persona]}`);
  if (b.chassi) campos.push(`c${b.chassi}`);
  if (b.arma) campos.push(`w${b.arma.id}-${b.arma.tier}`);
  if (b.dificuldade) campos.push(`d${LETRA_DA_DIFICULDADE[b.dificuldade]}`);
  if (b.nome) campos.push(`n${nomeParaTexto(b.nome)}`);
  return campos.join(':');
}

/**
 * O esquadrão em texto curto, para link e para guardar: `q1.<inimigos>.<aliados>`, cada lado com os robôs separados por vírgula (`-` se
 * não tem ninguém) e cada robô com o papel (`m` Mech, `a` andróide, `t` técnico) e os campos que saem do padrão: `p` personalidade
 * (`b` brabo, `m` manso, `f` fujão), `c` chassi, `w` arma-nível, `d` dificuldade (`f` fácil, `d` difícil) e `n` nome. O padrão de hoje é `q1.m:pb,a,a,t.m,m:wemp-0`.
 */
export function chaveDoEsquadrao(spec: EsquadraoSpec): string {
  const lado = (l: readonly BotSpec[], ladoDoBot: LadoDoBot) => {
    const bots = l.flatMap((b) => {
      const limpo = sanearBot(b, ladoDoBot);
      return limpo ? [chaveDoBot(limpo)] : [];
    });
    return bots.length ? bots.join(',') : '-';
  };
  return `q${spec.v}.${lado(spec.inimigos, 'inimigo')}.${lado(spec.aliados, 'aliado')}`;
}

function lerBot(texto: string, lado: LadoDoBot): BotSpec | null {
  const [letra, ...campos] = texto.split(':');
  const papel = deLetra(LETRA_DO_PAPEL, letra ?? '');
  if (!papel) return null;
  const bruto: Record<string, unknown> = { papel };
  const vistos = new Set<string>();
  for (const campo of campos) {
    const tag = campo[0] ?? '';
    const valor = campo.slice(1);
    if (!tag || vistos.has(tag)) return null;
    vistos.add(tag);
    if (tag === 'p') {
      bruto.persona = deLetra(LETRA_DA_PERSONA, valor);
      if (!bruto.persona) return null;
    } else if (tag === 'c') {
      if (!ehChassiDoBot(valor)) return null;
      bruto.chassi = valor;
    } else if (tag === 'w') {
      const m = /^([a-z]+)-([0-2])$/.exec(valor);
      if (!m) return null;
      bruto.arma = { id: m[1], tier: Number(m[2]) };
    } else if (tag === 'd') {
      bruto.dificuldade = deLetra(LETRA_DA_DIFICULDADE, valor);
      if (!bruto.dificuldade) return null;
    } else if (tag === 'n') {
      const nome = textoParaNome(valor);
      if (!nome || limparNome(nome) !== nome) return null;
      bruto.nome = nome;
    } else return null;
  }
  // Persona, chassi e arma só existem no Mech; arma que não cabe no chassi ou que o bot não sabe usar recusa a chave.
  if (papel !== 'mech' && (bruto.persona || bruto.chassi || bruto.arma)) return null;
  if (papel === 'technician' && bruto.dificuldade) return null;
  const arma = bruto.arma as ArmaDoBot | undefined;
  if (arma && !(armasDoBot((bruto.chassi as ChassisId | undefined) ?? 'vector09') as readonly string[]).includes(arma.id)) return null;
  return sanearBot(bruto, lado);
}

/** O contrário de `chaveDoEsquadrao`. Texto que não é um esquadrão (ou passa do teto) vira `null`: nada é aplicado pela metade. */
export function lerChaveDoEsquadrao(chave: string): EsquadraoSpec | null {
  const partes = chave.trim().split('.');
  if (partes.length !== 3 || partes[0] !== `q${ESQUADRAO_VERSAO}`) return null;
  const lado = (texto: string, ladoDoBot: LadoDoBot): BotSpec[] | null => {
    if (texto === '-') return [];
    const out: BotSpec[] = [];
    for (const t of texto.split(',')) {
      const bot = lerBot(t, ladoDoBot);
      if (!bot) return null;
      out.push(bot);
    }
    return out;
  };
  const inimigos = lado(partes[1]!, 'inimigo');
  const aliados = lado(partes[2]!, 'aliado');
  if (!inimigos || !aliados) return null;
  const spec: EsquadraoSpec = { v: ESQUADRAO_VERSAO, inimigos, aliados };
  return excessosDoEsquadrao(spec).length ? null : spec;
}

/** O esquadrão do link (`?esquadrao=`), ou `null` se não há ou se o texto não vale. */
export function esquadraoDoLink(search: string): EsquadraoSpec | null {
  const chave = new URLSearchParams(search).get(PARAM_DO_ESQUADRAO);
  return chave ? lerChaveDoEsquadrao(chave) : null;
}

/** É o esquadrão de fábrica (nenhuma mudança a guardar)? */
export const ehOEsquadraoPadrao = (spec: EsquadraoSpec): boolean => chaveDoEsquadrao(spec) === chaveDoEsquadrao(esquadraoPadrao());

// ─── O plano: o que a partida monta ───────────────────────────────────────────

/** Um robô com tudo decidido: onde nasce, o nome que aparece, e o que o padrão preencheu. */
export interface SlotDoPlano {
  ponto: Ponto;
  nome: string;
  persona: Persona;
  chassi: ChassisId;
  /** `null` = a arma de fábrica do chassi. */
  arma: ArmaDoBot | null;
  /** `null` = a dificuldade da partida. */
  dificuldade: Difficulty | null;
}

export interface PlanoDoLado {
  mechs: SlotDoPlano[];
  androids: SlotDoPlano[];
  tecnicos: SlotDoPlano[];
}

export interface PlanoDoEsquadrao {
  inimigos: PlanoDoLado;
  aliados: PlanoDoLado;
}

/** Como o robô se chama quando ninguém deu nome: o da lista de Configurações e, passando dela, REBELDE-04, ANDRÓIDE-04… */
const ROTULO_DO_NOME: Readonly<Record<LadoDoBot, Readonly<Record<PapelDoBot, string>>>> = {
  inimigo: { mech: 'REBELDE', android: 'ANDRÓIDE', technician: 'TÉCNICO' },
  aliado: { mech: 'ALIADO', android: 'ESCUDEIRO', technician: 'TÉCNICO' },
};

export function nomePadraoDoBot(lado: LadoDoBot, papel: PapelDoBot, indice: number, nomes: EnemyNames): string {
  const lista: readonly string[] =
    lado === 'aliado' ? (papel === 'mech' ? nomes.allies : []) : papel === 'mech' ? nomes.mechs : papel === 'android' ? nomes.androids : nomes.technicians;
  return lista[indice] ?? `${ROTULO_DO_NOME[lado][papel]}-${String(indice + 1).padStart(2, '0')}`;
}

/**
 * Do esquadrão ao que a partida monta: cada robô com o ponto onde nasce (os fixos de hoje primeiro, depois os extras), o nome e o que
 * o padrão preencheu. Os robôs de cada papel ficam na ordem em que estão no esquadrão. Lança se o esquadrão não cabe no mapa:
 * quem chama passa por `sanearEsquadrao` antes.
 */
export function planejarEsquadrao(spec: EsquadraoSpec, mapa: MapId, nomes: EnemyNames): PlanoDoEsquadrao {
  const r = resumoDoEsquadrao(spec);
  const contagem: Contagem = { mechs: r.mechs, androids: r.androids, tecnicos: r.tecnicos, aliadosMechs: r.aliadosMechs, aliadosAndroids: r.aliadosAndroids };
  const pontos = nascimentosDoEsquadrao(contagem, mapa);
  const monta = (lado: LadoDoBot, bots: readonly BotSpec[], papel: PapelDoBot, locais: readonly Ponto[]): SlotDoPlano[] =>
    bots
      .filter((b) => b.papel === papel)
      .map((b, i) => ({
        ponto: locais[i]!,
        nome: b.nome ?? nomePadraoDoBot(lado, papel, i, nomes),
        persona: b.persona ?? 'soldado',
        chassi: b.chassi ?? 'vector09',
        arma: b.arma ?? null,
        dificuldade: b.dificuldade ?? null,
      }));
  return {
    inimigos: {
      mechs: monta('inimigo', spec.inimigos, 'mech', pontos.mechs),
      androids: monta('inimigo', spec.inimigos, 'android', pontos.androids),
      tecnicos: monta('inimigo', spec.inimigos, 'technician', pontos.tecnicos),
    },
    aliados: {
      mechs: monta('aliado', spec.aliados, 'mech', pontos.aliadosMechs),
      androids: monta('aliado', spec.aliados, 'android', pontos.aliadosAndroids),
      tecnicos: [],
    },
  };
}
