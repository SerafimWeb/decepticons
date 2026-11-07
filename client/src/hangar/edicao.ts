import { ehModulo } from '../combat/modulos';
import { EXTRA_SLOTS } from '../combat/encaixesExtras';
import { BOTAO_SLOTS, botoesDoPreset, hasShoulderSlot, isMetalShield, SLOT_MOUNT, temEncaixeExtra, type ArmSlot, type ArmSpec, type BotaoSlot, type LoadoutSpec, type PresetDeBotao } from './loadout';
import type { Tier } from '../combat/weapons';

/**
 * As edições do rascunho do Hangar (P319, passo 1): funções puras, sem DOM, que a tela chama a cada clique. Toda edição devolve uma montagem **normalizada**: a versão e os botões
 * sempre combinam com o conteúdo, então uma edição nunca deixa o APLICAR recusar por uma regra que o jogador não viu (antes, trocar o módulo de uma montagem com botão escolhido
 * a rebaixava para a versão 2 e a validação recusava com "botões só na versão 4").
 */

/** Cópia profunda da montagem: todo campo (a cor do casco, os botões, o módulo, o layout e os encaixes extras) vai junto. Copiar campo a campo já deixou a cor comprada de fora. */
export function copySpec(spec: LoadoutSpec): LoadoutSpec {
  return structuredClone(spec);
}

const levaArma = (a: ArmSpec | null | undefined): boolean => a != null && !isMetalShield(a);

/**
 * O encaixe existe no chassi **e** leva arma nesta montagem (o escudo metálico não é arma). É o mesmo critério que `validateLoadout` aplica aos botões, mas lido da montagem,
 * sem exigir que ela esteja válida: no meio de uma edição a carga pode estourar, e o botão escolhido não deve sumir por isso.
 */
export function encaixeComArma(spec: LoadoutSpec, slot: BotaoSlot): boolean {
  if (slot === 'rightHand') return levaArma(spec.right);
  if (slot === 'leftHand') return levaArma(spec.left);
  if (slot === 'back') return temEncaixeExtra(spec.chassis, 'back') && levaArma(spec.back);
  // O ombro é um encaixe extra (Onça) ou, no Marauder, o lançador duplo dos dois lados.
  if (temEncaixeExtra(spec.chassis, slot)) return levaArma(spec[slot]);
  return hasShoulderSlot(spec.chassis) && levaArma(spec.shoulders);
}

/**
 * A montagem coerente: botão só em encaixe que leva arma (esvaziou o encaixe, o botão dele sai); sem botão nenhum, a chave deixa de ser a versão 4; com botão, é a 4; módulo ou
 * layout pedem a versão 2 ou mais, e a versão 2 ou mais sempre tem o campo `module`. Idempotente.
 */
export function normalizar(spec: LoadoutSpec): LoadoutSpec {
  const out = copySpec(spec);
  if (out.layout === 0) delete out.layout;
  const vivos: Partial<Record<BotaoSlot, 1 | 2>> = {};
  for (const slot of BOTAO_SLOTS) {
    const botao = out.botoes?.[slot];
    if ((botao === 1 || botao === 2) && encaixeComArma(out, slot)) vivos[slot] = botao;
  }
  if (Object.keys(vivos).length > 0) out.botoes = vivos;
  else delete out.botoes;
  if (out.botoes) out.v = 4;
  else if (out.v === 4) out.v = EXTRA_SLOTS.some((slot) => out[slot]) ? 3 : 2; // a 4 só existe para carregar botões
  else if (out.v === 1 && (out.module != null || (out.layout ?? 0) > 0)) out.v = 2;
  if (out.v !== 1 && out.module === undefined) out.module = null;
  return out;
}

/** Troca a arma de um encaixe (`null` esvazia). */
export function trocarArma(spec: LoadoutSpec, slot: ArmSlot, arma: ArmSpec | null): LoadoutSpec {
  return normalizar({ ...spec, [slot]: arma });
}

/** Troca o nível de potência da arma do encaixe (encaixe vazio: nada muda). */
export function trocarNivel(spec: LoadoutSpec, slot: ArmSlot, nivel: Tier): LoadoutSpec {
  const arma = spec[slot];
  return trocarArma(spec, slot, arma ? { ...arma, tier: nivel } : null);
}

/** Troca o módulo extra (texto desconhecido ou vazio = sem módulo). */
export function trocarModulo(spec: LoadoutSpec, modulo: string): LoadoutSpec {
  return normalizar({ ...spec, module: ehModulo(modulo) ? modulo : null });
}

/** Troca o layout de gatilhos do chassi (0 = o padrão). */
export function trocarLayout(spec: LoadoutSpec, layout: number): LoadoutSpec {
  return normalizar({ ...spec, layout });
}

/** Manda o encaixe da ranhura para o botão 1 ou 2. Os ombros do Marauder são uma ranhura só (`shoulders`): o botão vale para os dois lados. */
export function escolherBotao(spec: LoadoutSpec, slot: ArmSlot, botao: 1 | 2): LoadoutSpec {
  const mounts = slot === 'shoulders' ? ['rightShoulder', 'leftShoulder'] : [SLOT_MOUNT[slot]];
  const botoes: Partial<Record<BotaoSlot, 1 | 2>> = { ...spec.botoes };
  for (const mount of mounts) if ((BOTAO_SLOTS as readonly string[]).includes(mount)) botoes[mount as BotaoSlot] = botao;
  return normalizar({ ...spec, botoes });
}

/** Aplica um preset de botões sobre as armas do rascunho (`padrao` volta ao desenho do chassi). */
export function aplicarPreset(spec: LoadoutSpec, preset: PresetDeBotao): LoadoutSpec {
  return normalizar({ ...spec, botoes: botoesDoPreset(spec, preset) });
}
