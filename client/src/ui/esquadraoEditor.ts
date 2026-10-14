import { TIERS, weapon, type Tier, type WeaponId } from '../combat/weapons';
import { DIFFICULTY_LABELS, PERSONA_LABELS, type EnemyNames, type Persona } from '../core/Settings';
import { CHASSIS, ehTita } from '../entities/chassis';
import type { MapId } from '../environment/Bunker';
import {
  type BotSpec,
  chaveDoEsquadrao,
  type EsquadraoSpec,
  ESQUADRAO_VERSAO,
  esquadraoPadrao,
  excessosDoEsquadrao,
  type LadoDoBot,
  type Limites,
  limitesDoMapa,
  nivelDeCarga,
  type NivelDeCarga,
  nomePadraoDoBot,
  PAPEIS_DO_LADO,
  type PapelDoBot,
  type Resumo,
  resumoDoEsquadrao,
  sanearBot,
  sanearEsquadrao,
} from '../sim/esquadrao';

/**
 * O modelo do editor do esquadrão (P91, fase 1C): o que a janela do console faz com a lista de robôs, sem DOM. Cada operação passa pelo
 * contrato (`sim/esquadrao.ts`), então nenhum estado inválido chega à tela: o limite do mapa recusa o robô que não cabe, trocar o chassi
 * larga a arma que ele não aceita, e o que a janela mostra e salva é sempre um esquadrão que a partida monta. A tela só desenha e chama isto.
 */

export type Lado = LadoDoBot;
export const LADOS: readonly Lado[] = ['inimigo', 'aliado'];

/** Os esquadrões prontos, um clique (a ordem é a da fileira de botões). O padrão é o que as Configurações mandam (`esquadraoDeFoes`). */
export interface Predefinido {
  id: string;
  nome: string;
  /** Uma linha: o que o esquadrão é. */
  descricao: string;
  esquadrao: (padrao: () => EsquadraoSpec) => EsquadraoSpec;
}

const n = (vezes: number, bot: BotSpec): BotSpec[] => Array.from({ length: vezes }, () => ({ ...bot }));
const spec = (inimigos: BotSpec[], aliados: BotSpec[]): EsquadraoSpec => ({ v: ESQUADRAO_VERSAO, inimigos, aliados });

export const PREDEFINIDOS: readonly Predefinido[] = [
  { id: 'padrao', nome: 'PADRÃO', descricao: 'o jogo de sempre, como as Configurações mandam', esquadrao: (padrao) => padrao() },
  {
    id: 'batalhao',
    nome: 'BATALHÃO',
    descricao: '6 Mechs de jeitos diferentes, 4 andróides e o técnico contra você e 5 aliados',
    esquadrao: () =>
      spec(
        [{ papel: 'mech', persona: 'brabo' }, { papel: 'mech', persona: 'fujao' }, { papel: 'mech', persona: 'manso' }, ...n(3, { papel: 'mech' }), ...n(4, { papel: 'android' }), { papel: 'technician' }],
        [...n(4, { papel: 'mech' }), { papel: 'android' }],
      ),
  },
  {
    id: 'cerco',
    nome: 'CERCO',
    descricao: 'o teto: 24 inimigos contra você e 8 aliados',
    esquadrao: () => spec([...n(16, { papel: 'mech' }), ...n(6, { papel: 'android' }), ...n(2, { papel: 'technician' })], [...n(6, { papel: 'mech' }), ...n(2, { papel: 'android' })]),
  },
  {
    id: 'pesados',
    nome: 'PESADOS',
    descricao: 'Onça, Bastion e Marauder com canhão pesado, contra você e 3 escoteiros Arara com EMP',
    esquadrao: () =>
      spec(
        [
          { papel: 'mech', persona: 'brabo', chassi: 'onca', arma: { id: 'cannon', tier: 0 } },
          { papel: 'mech', persona: 'manso', chassi: 'onca', arma: { id: 'cannon', tier: 0 } },
          { papel: 'mech', persona: 'brabo', chassi: 'lr7lBastion', arma: { id: 'cannon', tier: 0 } },
          { papel: 'mech', chassi: 'lr7lBastion', arma: { id: 'cannon', tier: 1 } },
          { papel: 'mech', persona: 'brabo', chassi: 'marauder', arma: { id: 'blaster', tier: 1 } },
          { papel: 'mech', chassi: 'marauder' },
        ],
        n(3, { papel: 'mech', chassi: 'arara', arma: { id: 'emp', tier: 0 } }),
      ),
  },
  { id: 'duelo', nome: 'DUELO', descricao: 'um Mech difícil de escopeta contra você, sem aliados', esquadrao: () => spec([{ papel: 'mech', persona: 'brabo', chassi: 'quadraV2', arma: { id: 'shotgun', tier: 1 }, dificuldade: 'dificil' }], []) },
  { id: 'aliados', nome: 'SÓ ALIADOS', descricao: 'sem inimigos: você e 6 aliados, para ver o jogo andar', esquadrao: () => spec([], n(6, { papel: 'mech' })) },
];

/** O que impede de pôr mais um robô, em palavras (ou `null`: pode). Serve de dica no botão apagado. */
export type Motivo = string | null;

/** O texto que descreve um robô na lista e na ficha. */
export interface DescricaoDoBot {
  /** O nome que vai aparecer na partida (com a personalidade, como a etiqueta do robô). */
  nome: string;
  /** "MECH · brabo · ONÇA-B2 · Canhão pesado MK I". */
  linha: string;
}

const ROTULO_DO_PAPEL: Readonly<Record<PapelDoBot, string>> = { mech: 'MECH', android: 'ANDRÓIDE', technician: 'TÉCNICO' };
export const rotuloDoPapel = (p: PapelDoBot): string => ROTULO_DO_PAPEL[p];

/** A arma como o Hangar a escreve: "Canhão pesado MK II". */
export const nomeDaArma = (id: WeaponId, tier: Tier): string => `${weapon(id, tier).name} ${TIERS[tier]?.label ?? ''}`.trim();

/** Em que posição cada robô está entre os do mesmo papel (o nome padrão e o ponto de nascimento saem disso). */
export function indicesNoPapel(lista: readonly BotSpec[]): number[] {
  const vistos: Partial<Record<PapelDoBot, number>> = {};
  return lista.map((b) => {
    const i = vistos[b.papel] ?? 0;
    vistos[b.papel] = i + 1;
    return i;
  });
}

export function descreverBot(bot: BotSpec, lado: Lado, indiceNoPapel: number, nomes: EnemyNames): DescricaoDoBot {
  const base = bot.nome ?? nomePadraoDoBot(lado, bot.papel, indiceNoPapel, nomes);
  const persona: Persona = bot.persona ?? 'soldado';
  const nome = persona !== 'soldado' ? `${base}·${PERSONA_LABELS[persona].label.toUpperCase()}` : base;
  const partes: string[] = [ROTULO_DO_PAPEL[bot.papel]];
  if (bot.papel === 'mech') {
    if (persona !== 'soldado') partes.push(PERSONA_LABELS[persona].label.toLowerCase());
    if (bot.chassi) partes.push(CHASSIS[bot.chassi].name);
    if (bot.arma) partes.push(nomeDaArma(bot.arma.id, bot.arma.tier));
  }
  if (bot.dificuldade && bot.papel !== 'technician') partes.push(DIFFICULTY_LABELS[bot.dificuldade].toLowerCase());
  return { nome, linha: partes.join(' · ') };
}

export class EsquadraoEditor {
  private inimigos: BotSpec[];
  private aliados: BotSpec[];
  private readonly chaveInicial: string;

  constructor(
    inicial: EsquadraoSpec,
    /** O mapa define o teto (o Bunker tem 11 pontos livres). */
    private mapa: MapId = 'arena',
    /** O esquadrão que as Configurações mandam: o que o preset PADRÃO monta e o que "voltar ao padrão" devolve. */
    private readonly padrao: () => EsquadraoSpec = esquadraoPadrao,
  ) {
    const limpo = sanearEsquadrao(inicial, 'arena');
    this.inimigos = limpo.inimigos;
    this.aliados = limpo.aliados;
    this.chaveInicial = this.chave();
  }

  /** O esquadrão que a janela mostra agora (uma cópia: mexer nele não mexe no editor). */
  get esquadrao(): EsquadraoSpec {
    return { v: ESQUADRAO_VERSAO, inimigos: this.inimigos.map(copia), aliados: this.aliados.map(copia) };
  }

  lista(lado: Lado): readonly Readonly<BotSpec>[] {
    return lado === 'inimigo' ? this.inimigos : this.aliados;
  }

  private ref(lado: Lado): BotSpec[] {
    return lado === 'inimigo' ? this.inimigos : this.aliados;
  }

  setMapa(mapa: MapId): void {
    this.mapa = mapa;
  }

  get limites(): Limites {
    return limitesDoMapa(this.mapa);
  }

  get resumo(): Resumo {
    return resumoDoEsquadrao(this.esquadrao);
  }

  /** Quanto a partida pesa para a máquina, e como o jogo chama isso. */
  get carga(): { peso: number; nivel: NivelDeCarga; teto: number } {
    const peso = this.resumo.peso;
    // O peso do esquadrão cheio é o teto da barra: o que o mapa deixa pôr, todos Mechs.
    const lim = this.limites;
    return { peso, nivel: nivelDeCarga(peso), teto: lim.total };
  }

  /** O esquadrão passa do que o mapa comporta? (O que o editor deixa montar nunca passa; o do link ou do aparelho, em outro mapa, pode.) */
  get excessos(): string[] {
    return excessosDoEsquadrao(this.esquadrao, this.mapa);
  }

  chave(): string {
    return chaveDoEsquadrao(this.esquadrao);
  }

  /** Há mudança que a tela ainda não salvou? */
  get mudou(): boolean {
    return this.chave() !== this.chaveInicial;
  }

  /** O esquadrão é o que as Configurações mandam (então não há o que guardar à parte)? */
  get ehOPadrao(): boolean {
    return this.chave() === chaveDoEsquadrao(this.padrao());
  }

  podeAdicionar(lado: Lado, papel: PapelDoBot): Motivo {
    if (!PAPEIS_DO_LADO[lado].includes(papel)) return 'o aliado não tem técnico';
    const lim = this.limites;
    const r = this.resumo;
    if (papel === 'technician' && r.tecnicos >= lim.tecnicos) return `no máximo ${lim.tecnicos} técnicos`;
    const doLado = lado === 'inimigo' ? r.inimigos : r.aliados;
    const teto = lado === 'inimigo' ? lim.inimigos : lim.aliados;
    if (doLado >= teto) return `no máximo ${teto} ${lado === 'inimigo' ? 'inimigos' : 'aliados'} neste mapa`;
    if (r.total >= lim.total) return `no máximo ${lim.total} robôs no total neste mapa`;
    return null;
  }

  /** Põe um robô no fim da lista do lado. Devolve o lugar dele, ou -1 se não cabe. */
  adicionar(lado: Lado, papel: PapelDoBot, base: Partial<BotSpec> = {}): number {
    if (this.podeAdicionar(lado, papel) !== null) return -1;
    const bot = sanearBot({ ...base, papel }, lado);
    if (!bot) return -1;
    this.ref(lado).push(bot);
    return this.ref(lado).length - 1;
  }

  remover(lado: Lado, i: number): void {
    const l = this.ref(lado);
    if (i >= 0 && i < l.length) l.splice(i, 1);
  }

  /** Copia o robô logo depois dele (sem o apelido: dois robôs com o mesmo nome confundem o placar). Devolve o lugar da cópia, ou -1. */
  duplicar(lado: Lado, i: number): number {
    const original = this.ref(lado)[i];
    if (!original || this.podeAdicionar(lado, original.papel) !== null) return -1;
    const { nome: _nome, ...resto } = copia(original);
    this.ref(lado).splice(i + 1, 0, resto);
    return i + 1;
  }

  /**
   * Muda campos de um robô. Um campo com `undefined` volta ao padrão. O robô passa pelo contrato de novo: trocar o chassi larga a arma que
   * ele não aceita, e persona, chassi e arma de quem não é Mech não pegam.
   */
  editar(lado: Lado, i: number, mudanca: { nome?: string | undefined; persona?: Persona | undefined; chassi?: BotSpec['chassi']; arma?: BotSpec['arma']; dificuldade?: BotSpec['dificuldade'] }): string | null {
    const l = this.ref(lado);
    const atual = l[i];
    if (!atual) return null;
    const novo = sanearBot({ ...atual, ...mudanca }, lado);
    if (!novo) return null;
    // O titã (P108) tem teto por mapa (nenhum no Bunker): trocar para um titã sem vaga é recusado com o motivo, e o robô fica como estava.
    const virouTita = !!novo.chassi && ehTita(novo.chassi) && !(atual.chassi && ehTita(atual.chassi));
    if (virouTita && lado === 'inimigo') {
      const lim = this.limites.titas;
      const jaTem = l.filter((b) => b.papel === 'mech' && !!b.chassi && ehTita(b.chassi)).length;
      if (lim === 0) return 'Este mapa não comporta titãs (o Bunker é apertado demais): escolha a Cidade Neon.';
      if (jaTem >= lim) return `Já há ${jaTem} titã${jaTem === 1 ? '' : 's'}: o teto é ${lim}. Troque um deles antes.`;
    }
    l[i] = novo;
    return null;
  }

  /** Troca o nível da arma sem mudar qual é (a ficha tem um seletor de nível). */
  editarNivel(lado: Lado, i: number, tier: Tier): void {
    const atual = this.ref(lado)[i];
    if (atual?.arma) this.editar(lado, i, { arma: { id: atual.arma.id, tier } });
  }

  limparLado(lado: Lado): void {
    this.ref(lado).length = 0;
  }

  /**
   * Troca o esquadrão inteiro por um dos prontos, cortado no que o mapa comporta. Devolve quantos robôs o corte tirou (0 = coube inteiro),
   * ou `null` se o preset não existe.
   */
  usarPredefinido(id: string): number | null {
    const p = PREDEFINIDOS.find((x) => x.id === id);
    if (!p) return null;
    const pronto = p.esquadrao(this.padrao);
    const limpo = sanearEsquadrao(pronto, this.mapa);
    this.inimigos = limpo.inimigos;
    this.aliados = limpo.aliados;
    return pronto.inimigos.length + pronto.aliados.length - limpo.inimigos.length - limpo.aliados.length;
  }

  /** Os nomes que cada robô vai ter na partida, na ordem de cada lado. */
  descricoes(lado: Lado, nomes: EnemyNames): DescricaoDoBot[] {
    const l = this.ref(lado);
    const indices = indicesNoPapel(l);
    return l.map((b, k) => descreverBot(b, lado, indices[k]!, nomes));
  }
}

function copia(b: BotSpec): BotSpec {
  return { ...b, ...(b.arma ? { arma: { ...b.arma } } : {}) };
}
