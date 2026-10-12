import { CHASSIS, CHASSIS_PAPEL, type ChassisId } from '../entities/chassis';
import { METAL_SHIELDS } from '../combat/MetalShield';
import type { ShieldId } from '../combat/EnergyShield';
import { TIERS, weapon, type WeaponId } from '../combat/weapons';
import type { Persona } from '../core/Settings';
import type { MechPart } from '../entities/MechBase';
import { hasShoulderSlot, isMetalShield, validateLoadout, type ArmSpec, type LoadoutSpec } from '../hangar/loadout';

/**
 * O que os monitores do console de comando mostram, sem tela (dá para testar no Node): a ficha do seu Mech, a escalação da partida
 * e o modo Comandante. O desenho mora em `CommandConsole.ts`.
 */

// ─── Modo Comandante (as telas de administração) ──────────────────────────────────────────────────────────────────────────

/** Onde o navegador lembra que o modo Comandante está ligado. */
export const COMANDANTE_KEY = 'cybermech.comandante.v1';

/**
 * Liga com `?comandante=1` (ou `?admin=1`) e desliga com `=0`; sem o parâmetro, vale o que o navegador lembra. **Não é segurança:**
 * só mostra os monitores de ajuste do jogo, que não mexem em servidor nem em dado de ninguém (tudo ali já existia nas Configurações).
 * O que pedir proteção de verdade (o servidor) entra com token, no servidor (`PAINEL_ADMIN.md`, etapa E).
 */
export function lerModoComandante(search: string, lembrado: string | null): { ligado: boolean; gravar: '1' | 'apagar' | null } {
  const p = new URLSearchParams(search);
  const v = p.get('comandante') ?? p.get('admin');
  if (v === '1' || v === 'sim') return { ligado: true, gravar: '1' };
  if (v === '0' || v === 'nao' || v === 'não') return { ligado: false, gravar: 'apagar' };
  return { ligado: lembrado === '1', gravar: null };
}

// ─── Ficha do seu Mech ────────────────────────────────────────────────────────────────────────────────────────────────────

export const MODULO_NOME: Readonly<Record<ShieldId, string>> = { frontal: 'Barreira frontal', sphere: 'Esfera de energia', fire: 'Anel de fogo' };

export interface Medida {
  valor: number;
  /** Referência da barra: o maior valor entre os chassis de combate (o Colossus, de escala 3, fica fora para não achatar os outros). */
  ref: number;
}

export interface FichaMech {
  chassi: ChassisId;
  papel: string;
  /** Vida do tronco: quando ele cai, o Mech cai. */
  vida: Medida;
  /** Velocidade no chão, em m/s. */
  velocidade: Medida;
  /** Carga das armas: ocupada e o limite do chassi, em t. */
  carga: { usada: number; limite: number };
  armas: { encaixe: 'DIR' | 'ESQ' | 'OMB' | 'MÓD'; nome: string }[];
}

const COMBATE = (Object.keys(CHASSIS) as ChassisId[]).filter((id) => id !== 'colossus01');
const REF_VIDA = Math.max(...COMBATE.map((id) => CHASSIS[id].maxModuleHealth.torso));
const REF_VELOCIDADE = Math.max(...COMBATE.map((id) => CHASSIS[id].moveSpeed));

function nomeDoBraco(a: ArmSpec): string {
  const nivel = TIERS[a.tier]?.label ?? 'MK I';
  return isMetalShield(a) ? `${METAL_SHIELDS[a.id].name} ${nivel}` : `${weapon(a.id as WeaponId, a.tier).name} ${nivel}`;
}

export function fichaDoMech(spec: LoadoutSpec): FichaMech {
  const stats = CHASSIS[spec.chassis] ?? CHASSIS.vector09;
  const check = validateLoadout(spec);
  const armas: FichaMech['armas'] = [{ encaixe: 'DIR', nome: nomeDoBraco(spec.right) }];
  if (spec.left) armas.push({ encaixe: 'ESQ', nome: nomeDoBraco(spec.left) });
  if (spec.shoulders && hasShoulderSlot(spec.chassis)) armas.push({ encaixe: 'OMB', nome: nomeDoBraco(spec.shoulders) });
  if (spec.module) armas.push({ encaixe: 'MÓD', nome: MODULO_NOME[spec.module] });
  return {
    chassi: spec.chassis,
    papel: CHASSIS_PAPEL[spec.chassis] ?? '',
    vida: { valor: stats.maxModuleHealth.torso, ref: REF_VIDA },
    velocidade: { valor: stats.moveSpeed, ref: REF_VELOCIDADE },
    carga: { usada: check.mass, limite: check.capacity },
    armas,
  };
}

// ─── Escalação da partida ─────────────────────────────────────────────────────────────────────────────────────────────────

export type TipoPiloto = 'mech' | 'android' | 'tecnico' | 'chefe' | 'aliado';

export interface PilotoNaPartida {
  nome: string;
  tipo: TipoPiloto;
  persona?: Persona;
}

const TIPO_NOME: Readonly<Record<TipoPiloto, [string, string]>> = {
  mech: ['MECH', 'MECHS'],
  android: ['ANDRÓIDE', 'ANDRÓIDES'],
  tecnico: ['TÉCNICO', 'TÉCNICOS'],
  chefe: ['CHEFE', 'CHEFES'],
  aliado: ['ALIADO', 'ALIADOS'],
};

/** "1 MECH · 2 ANDRÓIDES · 1 TÉCNICO" (só os inimigos; os aliados têm a linha deles). Vazio: "NENHUM INIMIGO". */
export function contagemInimigos(lista: readonly PilotoNaPartida[]): string {
  const partes: string[] = [];
  for (const tipo of ['mech', 'android', 'tecnico', 'chefe'] as const) {
    const n = lista.filter((p) => p.tipo === tipo).length;
    if (n) partes.push(`${n} ${TIPO_NOME[tipo][n === 1 ? 0 : 1]}`);
  }
  return partes.length ? partes.join(' · ') : 'NENHUM INIMIGO';
}

/** Nível de ameaça de 1 a 5 para o mapa: quantos inimigos e quão difíceis (Mech vale 1; andróide e técnico, ½; o chefe, 3). */
export function nivelDeAmeaca(lista: readonly PilotoNaPartida[], dificuldade: 'facil' | 'normal' | 'dificil'): number {
  const peso = { mech: 1, android: 0.5, tecnico: 0.5, chefe: 3, aliado: 0 } as const;
  const soma = lista.reduce((s, p) => s + peso[p.tipo], 0) + (dificuldade === 'dificil' ? 1.5 : dificuldade === 'normal' ? 0.5 : 0);
  return Math.max(1, Math.min(5, Math.round(soma / 1.4)));
}

// ─── Leitura do jogo (o `Game.ts` só passa as referências) ────────────────────────────────────────────────────────────────

/** O pedaço de um Mech que o console lê (estrutural: os testes passam objetos simples). */
export interface MechLido {
  readonly stats: { readonly name: string; readonly maxModuleHealth: Readonly<Record<MechPart, number>> };
  readonly modules: Readonly<Record<MechPart, number>>;
}

/** O pedaço de um `BotSystem` que o console lê. */
export interface BotsLidos<M> {
  readonly mechs: readonly M[];
  nameOf(m: M): string;
  brainOf(m: M): { readonly persona: { readonly id: Persona } } | undefined;
  technicianOf(m: M): unknown;
}

/** Vida de cada parte, de 0 a 1 (parte arrancada = 0). */
export function fracoesDasPartes(m: MechLido): Record<MechPart, number> {
  const out = {} as Record<MechPart, number>;
  for (const p of Object.keys(m.stats.maxModuleHealth) as MechPart[]) {
    const max = m.stats.maxModuleHealth[p];
    out[p] = max > 0 ? Math.max(0, m.modules[p] / max) : 0;
  }
  return out;
}

/** Quem está na partida aberta, na ordem em que entrou: os inimigos (com a personalidade dos Mechs) e depois os aliados. */
export function escalacaoDaPartida<M extends MechLido>(inimigos: BotsLidos<M> | null, aliados: BotsLidos<M> | null): PilotoNaPartida[] {
  const out: PilotoNaPartida[] = [];
  for (const m of inimigos?.mechs ?? []) {
    const tipo: TipoPiloto = inimigos!.technicianOf(m)
      ? 'tecnico'
      : m.stats.name === 'COLOSSUS-01'
        ? 'chefe'
        : m.stats.name.startsWith('ANDRÓIDE')
          ? 'android'
          : 'mech';
    const persona = tipo === 'mech' ? inimigos!.brainOf(m)?.persona.id : undefined;
    out.push(persona ? { nome: inimigos!.nameOf(m), tipo, persona } : { nome: inimigos!.nameOf(m), tipo });
  }
  for (const m of aliados?.mechs ?? []) out.push({ nome: aliados!.nameOf(m), tipo: 'aliado' });
  return out;
}

// ─── Atalhos do console ───────────────────────────────────────────────────────────────────────────────────────────────────

export type AcaoDoConsole = 'combate' | 'hangar' | 'online' | 'zoom';

/**
 * O que cada tecla faz no console (só com a pausa à vista e nenhuma janela por cima): Enter põe em combate, H abre o Hangar, O entra
 * ou sai do online, Z troca o zoom do mapa. Recebe `KeyboardEvent.key` (a letra que está na tecla, qualquer que seja o teclado).
 * **Nenhuma destas teclas pode ser uma que o jogo já usa com a pausa à vista** (M e B abrem o briefing, C liga o CFTV, V e Q/E
 * valem no espectador): o teste confere contra as teclas padrão e essas.
 */
export function acaoDaTecla(key: string): AcaoDoConsole | null {
  switch (key.toLowerCase()) {
    case 'enter':
      return 'combate';
    case 'h':
      return 'hangar';
    case 'o':
      return 'online';
    case 'z':
      return 'zoom';
    default:
      return null;
  }
}

// ─── A mesa de vídeo ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Onde a mesa de vídeo atende quando está ligada (`npm run mesa`, `scripts/mesa.mjs`): só nesta máquina, nunca fora dela. */
export const MESA_URL = 'http://127.0.0.1:4199/.tmp/video/editor.html';
/** O comando que liga a mesa, na pasta do projeto. */
export const MESA_COMANDO = 'npm run mesa';

/**
 * A mesa está ligada? Um GET sem CORS: só diz se alguém atendeu (a resposta é opaca), e é tudo o que importa. Sob demanda (quando o Comandante clica no
 * item), nunca por conta própria: uma sondagem que falha escreve um erro de rede no console do navegador, e o smoke e o teste do site tratam erro de console
 * como falha. `buscar` e o tempo são injetáveis para o teste.
 */
export async function sondarMesa(buscar: typeof fetch = (...a) => fetch(...a), url: string = MESA_URL, ms = 1500): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    await buscar(url, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
