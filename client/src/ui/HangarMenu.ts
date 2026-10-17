import type { MountId } from '../combat/mounts';
import { CLASS_LABEL_PLURAL } from '../combat/weaponClass';
import { TIERS, weapon, WEAPON_IDS, type Loadout, type Tier, type WeaponId, type WeaponStats } from '../combat/weapons';
import { reloadWithout } from '../core/url';
import { CHASSIS, CHASSIS_SIZE, SHIELD_ARM, type ChassisId } from '../entities/chassis';
import { triggersOf } from '../entities/MechBase';
import { METAL_SHIELD_IDS, METAL_SHIELDS, METAL_SHIELD_TIERS, metalShieldMass, type MetalShieldId } from '../combat/MetalShield';
import type { DamageType } from '../combat/weapons';
import type { Hangar } from '../hangar/Hangar';
import { acceptsMetalShield, armGroups, armOptions, factorySpec, hasShoulderSlot, isMetalShield, layoutCount, loadoutKey, slotAttack, type ArmSlot, type LoadoutSpec } from '../hangar/loadout';
import { shoulderMounts } from '../combat/mounts';
import { PRESET_COUNT } from '../hangar/Hangar';
import { AdminPanel } from './AdminPanel';
import { WEAPON_HINT_NOVAS, WEAPON_ICON_NOVAS } from './weaponIconsNovas';
import { testAt, testFire, TEST_FIRE_S, type TestFire } from '../hangar/testFire';

/** O que a tela pede ao jogo: abrir e fechar o galpão 3D, mostrar a montagem, girar e aplicar na hora. */
export interface HangarPreview {
  open(): void;
  close(): void;
  show?(chassis: ChassisId, loadout: Loadout): void;
  rotate?(dx: number): void;
  /** Montagem do mesmo chassi aplicada: o jogo troca as armas (ou explica por que não) e devolve o aviso. */
  applied?(): string;
  /** Linha de estado do topo: "OFFLINE" ou a sala online. */
  status?(): string;
  credits?(): number;
  /** Teste de disparo: o galpão mostra o Mech atirando no alvo, no ritmo do teste. */
  test?(data: TestFire, mounts: readonly MountId[]): void;
  stopTest?(): void;
  /** Treino manual no galpão: recebe a arma selecionada, sem simular dano no jogo. */
  aimPractice?(weapon: WeaponStats): void;
  stopAimPractice?(): void;
  canAimPractice?(): boolean;
}

/** Os tiros do teste começam depois que o Mech vira para o alvo (s). */
const TEST_TURN_S = 0.5;

export const CHASSIS_LABEL: Record<ChassisId, { title: string; className: string; detail: string }> = {
  vector09: { title: 'VECTOR-09', className: 'MÉDIO · ASSALTO', detail: 'Equilíbrio entre alcance e mobilidade.' },
  android: { title: 'ANDRÓIDE A-1', className: 'LEVE · PILOTO', detail: 'Pequeno e ágil; vence no combate próximo.' },
  // Chassi solo do boss (29/09): mesmos números do encontro, sem balancear contra os bots de propósito.
  colossus01: { title: 'COLOSSUS-01', className: 'ESCALA 3 · CERCO', detail: 'Lento e blindado; devastador de perto.' },
  // O titã do dono (12/10): passo curto e joelho dobrado, o maior do jogo.
  colossusv4: { title: 'COLOSSUS-V4', className: 'ESCALA 4 · TITÃ', detail: 'O maior do jogo: passo curto, joelho dobrado e o canhão de cerco.' },
  // Arara Foundry (29/09): o par batedor/pesado da linha, ver .decepticons/VISAO.md § fabricantes. Os dois são Mechs (tamanho 2); "escala 1" é o andróide.
  arara: { title: 'ARARA-B1', className: 'ESCALA 2 · LEVE', detail: 'Rápido e frágil; vence pela mobilidade.' },
  onca: { title: 'ONÇA-B2', className: 'ESCALA 2 · PESADO', detail: 'Lento e blindado; segura posição.' },
  // Primeiro chassi de malha importada (30/09, pipeline híbrido) — ficha provisória, números do Vector-09.
  genesis01: { title: 'GÊNESIS-01', className: 'MÉDIO · ASSALTO', detail: 'Primeiro chassi de malha importada — ficha provisória.' },
  lancerL1: { title: 'LANCER-L1', className: 'MÉDIO · IMPORTADO', detail: 'Malha de Forge Systems.' },
  lr7lBastion: { title: 'LR-7L BASTION', className: 'PESADO · IMPORTADO', detail: 'Malha de Cybermech Industries.' },
  quadraV2: { title: 'QUADRA-V2', className: 'MÉDIO · IMPORTADO', detail: 'Malha de Vanta Works.' },
  marauder: { title: 'MARAUDER', className: 'MÉDIO · IMPORTADO', detail: 'Duas mãos armadas e lançadores nos ombros.' },
};
const SLOT_LABEL: Record<ArmSlot, string> = { right: 'BRAÇO DIREITO', left: 'BRAÇO ESQUERDO', shoulders: 'OMBROS' };
/** A chuva de mísseis, num Mech sem ombros, é um morteiro nas costas (o desenho do braço esquerdo troca o casulo por ele). */
const nasCostas = (id: string, slot: ArmSlot): boolean => id === 'barrage' && slot !== 'shoulders';
const SLOT_NUM: Record<ArmSlot, string> = { right: '01', left: '02', shoulders: '03' };
/** De onde o encaixe da tela atira (a tela de teste usa para desenhar o tiro). Nos ombros, os dois lançadores. */
function slotMounts(chassis: ChassisId, slot: ArmSlot, layout = 0): readonly MountId[] {
  if (slot === 'right') return ['rightHand'];
  if (slot === 'left') return ['leftHand'];
  return shoulderMounts(triggersOf(CHASSIS[chassis], layout));
}
const WEAPON_HINT: Record<WeaponId, string> = {
  railgun: 'Energia · segure 0,85 s para disparar · longo alcance · muito calor',
  emp: 'Energia · pulso lento · pouco dano e +20% de calor no alvo próximo · sem paralisia',
  plasma: 'Energia · dano cheio até 60 m · calor por disparo',
  rockets: 'Munição · explosão em área · recarga automática',
  seeker: 'Munição · guiado de médio alcance (Ataque 2; nos ombros, um míssil em cada) · TRAVA no inimigo mais centrado à frente (29°, até 110 m, à vista) e CURVA até ele; quem corre reto é perseguido, quem se abriga ou usa o dash ainda desvia · cada nível afina a curva e alarga a trava (MK III: 154 m) · explosão em área · recarga automática',
  swarm: 'Munição · leve · UM APERTO ESVAZIA o lançador: 8 mísseis (MK I), 16 (MK II) ou 32 (MK III), um a cada 0,07 s, com um desvio pequeno · 5 de dano e 2,2 m de explosão por míssil · só dispara com todos os tubos carregados · satura e força o inimigo a sair do lugar',
  harpoon: 'Energia · ombro · ARPÃO: prende o primeiro inimigo à vista (45 m) e o PUXA até você · o dash corta o cabo, parede também · 10 de dano · um aperto a cada 4 s',
  grenade: 'Munição · médio · lança-granadas: a granada sai em ARCO e cai no ponto da mira (até 80 m); passa por cima da cobertura · explode no robô, tabela na parede, crava no chão · 34 de dano, 5 m de explosão · 4 por carga',
  cruise: 'Munição · pesado · míssil cruzador: sobe em arco e MERGULHA no ponto da mira, até 420 m, por cima do cenário baixo · 90 de dano e 9 m de explosão · não guia: quem corre escapa · um por carga, 6 s de recarga · dois acertos nunca bastam',
  laser: 'Energia · feixe instantâneo em pulsos (6 de dano a cada 0,13 s), sem projétil para desviar · dano cheio até 180 m e 70% aos 360 m · segure a mira no alvo · o calor decide a duração do feixe (~6 s)',
  blaster: 'Energia · leve · alcance curto',
  shotgun: 'Energia · 9 balins num cone · dano alto de perto, espalha de longe (50 m)',
  barrage: 'Munição · sobe e cai em chuva de 8 bombas num círculo de 9 m · aviso no chão',
  chainsaw: 'Corpo a corpo · só corta encostado',
  arc: WEAPON_HINT_NOVAS.arc,
  cryo: WEAPON_HINT_NOVAS.cryo,
  flamer: WEAPON_HINT_NOVAS.flamer,
  rotary: WEAPON_HINT_NOVAS.rotary,
  sonic: 'Som · só nos ombros (Ataque 2), as duas bocas juntas · onda em cone de 22 m que EMPURRA · 20 de dano por boca, cheio até 10 m · a chapa Amortecedor segura 90% · cada nível +25% de alcance',
  cannon: 'Aço · um obus só, grande e lento (150 m/s) · 90 de dano, um a cada 2,6 s · 4 acertos (MK I) ou 3 (MK II e III) para um torso · só os pesados o carregam',
  siege: 'Tamanho 3 · o canhão do titã: SEGURE 3 s para carregar e solte um obus de 360 com 5 m de explosão · derruba um torso de Mech num tiro só · para o Colossus-V4 é arma LEVE · só gigantes o carregam',
  autocannon: 'Aço · projéteis em sequência firme, 5 por segundo · 10 de dano, preciso e rápido · esquenta menos que o plasma · sem espalhamento',
};

/** Ícones de traço (24×24) de cada arma. */
const WEAPON_ICON: Record<WeaponId, string> = {
  railgun: '<path d="M3 8h17M3 16h17M5 8v8M10 10h11M10 14h11M21 8v8" />',
  emp: '<circle cx="10" cy="12" r="5" /><path d="M10 6v12M4 12h12M17 7l4 5-4 5" />',
  plasma: '<path d="M3 13h11l2-3h5v6h-5l-2-3" /><circle cx="7" cy="13" r="2.5" /><path d="M16 10v6" />',
  seeker: '<path d="M3 20c5 0 9-4 11-9" /><path d="M13 9l6-5 2 6-5 3z" /><path d="M4 14c2 0 3 1 3 3" /><circle cx="21" cy="3" r="1.2" />',
  swarm: '<rect x="3" y="6" width="13" height="12" rx="1" /><circle cx="6.5" cy="9.5" r="1" /><circle cx="10" cy="9.5" r="1" /><circle cx="13" cy="9.5" r="1" /><circle cx="6.5" cy="14.5" r="1" /><circle cx="10" cy="14.5" r="1" /><circle cx="13" cy="14.5" r="1" /><path d="M17 8h5M17 12h6M17 16h5" />',
  harpoon: '<path d="M3 21L13 11" /><path d="M12 6l6-3 3 3-3 6z" /><path d="M5 17c2 0 3 1 3 3" />',
  grenade: '<path d="M3 19Q9 5 15 11T21 17" /><circle cx="19" cy="18" r="2.5" /><path d="M4 21h6" />',
  cruise: '<path d="M3 21L14 10" /><path d="M13 7l4-4 4 1-1 4-4 4z" /><path d="M6 15H3V18M9 18V21H12" />',
  laser: '<rect x="2" y="9" width="9" height="6" rx="1" /><path d="M11 12h12" /><path d="M15 9l2 3-2 3" /><path d="M5 15v4h3v-4" />',
  rockets: '<rect x="4" y="6" width="14" height="12" rx="1" /><circle cx="8" cy="10" r="1.6" /><circle cx="14" cy="10" r="1.6" /><circle cx="8" cy="14" r="1.6" /><circle cx="14" cy="14" r="1.6" /><path d="M18 9h3v6h-3" />',
  blaster: '<path d="M4 9h13l2 2v2H9l-1 5H5l1-5H4z" /><path d="M17 11h4" />',
  barrage: '<rect x="3" y="15" width="15" height="4" rx="1" /><path d="M6 15l2-9M10 15l2-9M14 15l2-9" /><circle cx="8" cy="5" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="16" cy="5" r="1" />',
  shotgun: '<path d="M3 10h15M3 14h15" /><path d="M18 8l3 1v6l-3 1z" /><path d="M6 14v4h5v-4" />',
  arc: WEAPON_ICON_NOVAS.arc,
  cryo: WEAPON_ICON_NOVAS.cryo,
  flamer: WEAPON_ICON_NOVAS.flamer,
  rotary: WEAPON_ICON_NOVAS.rotary,
  sonic: '<rect x="2" y="9" width="5" height="6" rx="1" /><path d="M10 8a5 5 0 0 1 0 8M14 5a9 9 0 0 1 0 14M18 2a13 13 0 0 1 0 20" />',
  cannon: '<path d="M2 11h12v6H2z" /><path d="M14 12h6v4h-6z" /><path d="M20 11h2v6h-2" /><path d="M5 17v3h5v-3" /><circle cx="8" cy="14" r="1.2" />',
  siege: '<path d="M1 10h14v7H1z" /><path d="M15 11h7v5h-7z" /><path d="M22 10h3v7h-3" /><path d="M4 17v4h6v-4" /><circle cx="8" cy="13.5" r="1.4" />',
  autocannon: '<path d="M3 12h13v5H3z" /><path d="M16 13h5v3h-5z" /><path d="M6 12V8h6v4" /><path d="M7 17v3h4v-3" /><path d="M21 14h2" /><circle cx="20" cy="6" r="0.8" /><circle cx="17" cy="8" r="0.8" />',
  chainsaw: '<rect x="3" y="9" width="7" height="7" rx="1" /><path d="M10 10h9a2.5 2.5 0 0 1 0 5h-9" /><path d="M12 10l1-2M15 10l1-2M18 10l1-2M12 15l1 2M15 15l1 2M18 15l1 2" />',
};

/** Planta em traço de cada chassi (60×84), no cartão do painel da esquerda. */
const CHASSIS_ICON: Record<ChassisId, string> = {
  vector09:
    '<rect x="24" y="4" width="12" height="10" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" /><path d="M2 44h4M54 44h4" />',
  android:
    '<rect x="26" y="4" width="8" height="9" /><rect x="22" y="15" width="16" height="22" /><rect x="15" y="17" width="5" height="20" /><rect x="40" y="17" width="5" height="20" /><rect x="23" y="39" width="6" height="30" /><rect x="31" y="39" width="6" height="30" /><path d="M20 72h10M30 72h10M45 30h10" />',
  // Base bem mais larga e pernas grossas (escala 3): a planta lê "pesado e lento" ao lado das outras duas.
  colossus01:
    '<rect x="22" y="2" width="16" height="10" /><rect x="10" y="14" width="40" height="26" /><rect x="1" y="16" width="10" height="24" /><rect x="49" y="16" width="10" height="24" /><rect x="12" y="42" width="14" height="28" /><rect x="34" y="42" width="14" height="28" /><path d="M8 74h18M34 74h18" /><path d="M0 44h2M58 44h2" />',
  // Titã (escala 4): a planta mais larga do jogo, ombros maciços e pernas em coluna — peso e passo curto.
  colossusv4:
    '<rect x="20" y="0" width="20" height="12" /><rect x="6" y="12" width="48" height="30" /><rect x="0" y="14" width="8" height="28" /><rect x="52" y="14" width="8" height="28" /><rect x="10" y="42" width="18" height="30" /><rect x="32" y="42" width="18" height="30" /><path d="M6 76h20M34 76h20" />',
  // Pernas longas e afiladas: a planta lê "leve e rápido".
  arara:
    '<rect x="26" y="2" width="8" height="8" /><rect x="20" y="12" width="20" height="20" /><rect x="12" y="14" width="6" height="18" /><rect x="42" y="14" width="6" height="18" /><path d="M22 34l-4 16l4 20M38 34l4 16l-4 20" /><path d="M14 70h12M34 70h12" />',
  // Torso largo, pernas curtas e grossas: escala 2, sem chegar no exagero do Colossus.
  onca:
    '<rect x="22" y="6" width="16" height="8" /><rect x="12" y="16" width="36" height="30" /><rect x="2" y="18" width="12" height="26" /><rect x="46" y="18" width="12" height="26" /><rect x="16" y="48" width="12" height="22" /><rect x="32" y="48" width="12" height="22" /><path d="M10 72h20M30 72h20" />',
  // Provisório (30/09): silhueta genérica de bípede médio até o chassi ganhar planta própria.
  genesis01:
    '<path d="M22 4l8-3l8 3l-2 10h-12z" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" />',
  lancerL1:
    '<path d="M22 4l8-3l8 3l-2 10h-12z" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" />',
  lr7lBastion:
    '<path d="M22 4l8-3l8 3l-2 10h-12z" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" />',
  quadraV2:
    '<path d="M22 4l8-3l8 3l-2 10h-12z" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" />',
  marauder:
    '<path d="M22 4l8-3l8 3l-2 10h-12z" /><rect x="16" y="16" width="28" height="24" /><rect x="6" y="18" width="9" height="22" /><rect x="45" y="18" width="9" height="22" /><rect x="18" y="42" width="10" height="26" /><rect x="32" y="42" width="10" height="26" /><path d="M14 72h16M30 72h16" />',
};

/** Leituras de cada arma, como barras: o máximo é o maior valor do arsenal no MK III. */
interface StatRow {
  key: string;
  label: string;
  unit: string;
  get(w: WeaponStats): number;
  digits: number;
  /** Maior é pior (calor, carga): a seta de melhora inverte. */
  lowerIsBetter?: boolean;
}
const STATS: StatRow[] = [
  { key: 'dmg', label: 'DANO', unit: '', get: (w) => w.damage, digits: 0 },
  { key: 'rate', label: 'CADÊNCIA', unit: '/s', get: (w) => 1 / (w.fireInterval + (w.chargeTime ?? 0)), digits: 1 },
  { key: 'heat', label: 'CALOR', unit: '%/s', get: (w) => (w.heatPerShot / (w.fireInterval + (w.chargeTime ?? 0))) * 100, digits: 0, lowerIsBetter: true },
  { key: 'range', label: 'ALCANCE', unit: ' m', get: (w) => w.maxRange, digits: 0 },
  { key: 'mass', label: 'CARGA', unit: ' t', get: (w) => w.mass, digits: 1, lowerIsBetter: true },
];
const STAT_MAX: Record<string, number> = Object.fromEntries(STATS.map((s) => [s.key, Math.max(...WEAPON_IDS.map((id) => s.get(weapon(id, 2))))]));

const mountCopies = (slot: ArmSlot, chassis: ChassisId, layout = 0): number => slot === 'shoulders' ? shoulderMounts(triggersOf(CHASSIS[chassis], layout)).length : 1;

const num = (x: number, digits: number) => x.toFixed(digits).replace('.', ',');

type Tab = 'chassi' | 'armas' | 'numeros';

/**
 * Hangar 2.0, camada 2 (Claude, 26/09; a primeira versão foi do Codex): a interface holográfica sobre o galpão 3D,
 * no desenho da imagem de referência do dono (\`.tmp/arte/hangar-referencia.png\`).
 * - Topo: marca, carga, piloto e o modo (offline ou a sala online).
 * - Esquerda: o chassi, com a planta de cada robô em traço, e as leituras dele.
 * - Direita: o console "caminhos de montagem" (armas; blindagem e módulos em breve), os dois braços, o nível de
 *   potência e as barras de cada arma, a nova contra a atual.
 * - Embaixo: as leituras da simulação (carga, calor, tempo para derrubar, dano) e o link da montagem.
 * - No Mech: marcadores dos braços presos a eles, que acompanham o giro do pedestal.
 * - No celular: o galpão ocupa a tela e os painéis viram abas embaixo.
 * Só consulta o contrato (\`Hangar\`) e nunca participa do tick de combate.
 */
export class HangarMenu {
  private readonly root: HTMLDivElement;
  private readonly pauseOverlay = document.getElementById('overlay');
  private draft: LoadoutSpec;
  private selectedSlot: ArmSlot = 'right';
  private tab: Tab = 'armas';
  private message = '';
  private messageKind: 'info' | 'error' = 'info';
  private readonly hotRight: HTMLElement;
  private readonly hotLeft: HTMLElement;
  /** Teste de disparo em andamento (os números da tela saem dele). */
  private testing: TestFire | null = null;
  private aimTraining = false;
  private readonly adminPanel: AdminPanel;
  private unlockedMechs: Set<ChassisId> = new Set();
  private previewChassis: ChassisId | null = null;

  get isAimTraining(): boolean {
    return this.aimTraining;
  }

  constructor(
    private readonly hangar: Hangar,
    private readonly preview: HangarPreview,
    button = document.getElementById('btn-hangar'),
  ) {
    this.adminPanel = new AdminPanel((unlocked) => {
      this.unlockedMechs = unlocked;
      this.render();
    });
    this.adminPanel.loadConfig().then((unlocked) => {
      this.unlockedMechs = unlocked;
      if (this.isOpen) this.render();
    });
    this.draft = copySpec(hangar.current);
    this.root = document.createElement('div');
    this.root.id = 'hangar-modal';
    this.root.className = 'hangar-screen hidden';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Hangar de montagem');
    this.root.innerHTML = `
      <div class="hg-stage" aria-hidden="true">
        <button class="hg-hotspot" id="hg-hot-right" type="button" data-slot="right" tabindex="-1"><i></i><span><b>01</b> BRAÇO D</span></button>
        <button class="hg-hotspot" id="hg-hot-left" type="button" data-slot="left" tabindex="-1"><i></i><span><b>02</b> BRAÇO E</span></button>
        <div class="hg-caption"><b id="hangar-mech-title"></b><span id="hangar-mech-detail"></span><small>ARRASTE PARA GIRAR</small></div>
        <div class="hg-presets" id="hg-presets" aria-label="Montagens salvas nos atalhos 1 a 4"></div>
      </div>
      <div class="hg-aim-reticle" aria-hidden="true"><i></i></div>
      <div class="hg-test" id="hg-test" hidden>
        <div class="hg-test-head"><em id="hg-test-title">TESTE DE DISPARO</em><b id="hg-test-weapon"></b></div>
        <div class="hg-test-grid">
          <div><span>TEMPO</span><b id="hg-test-time"></b></div>
          <div><span id="hg-test-shots-label">TIROS</span><b id="hg-test-shots"></b></div>
          <div><span id="hg-test-dmg-label">DANO</span><b id="hg-test-dmg"></b></div>
        </div>
        <div class="hg-test-heat"><span id="hg-test-heat-label">CALOR</span><div class="hg-meter"><i id="hg-test-heatbar"></i></div><b id="hg-test-state"></b></div>
        <p id="hg-practice-help" hidden>MOVA A MIRA E SEGURE O BOTÃO ESQUERDO · ESC PARA SAIR</p>
        <button class="hg-btn" type="button" data-action="stop-test" id="hg-test-stop">PARAR</button>
      </div>
      <header class="hg-top">
        <div class="hg-brand"><svg class="hg-emblem" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 29 9v14l-13 7L3 23V9z" /><path d="M16 8 23 12v8l-7 4-7-4v-8z" /></svg><span><b>CYBERMECH</b><small>HANGAR · CENTRO DE MONTAGEM</small></span></div>
        <div class="hg-chips">
          <span class="hg-chip"><i>CRÉDITOS</i><b id="hg-top-credits"></b></span>
          <span class="hg-chip hg-mode"><em></em><b id="hg-top-mode"></b></span>
        </div>
        <button class="hg-btn hg-ghost" type="button" data-action="admin" style="padding: 0 12px; margin-right: 12px; border: 1px solid #444;" title="Painel Admin">⚙️</button>
        <button class="hg-close" type="button" data-action="close" aria-label="Voltar à pausa">×</button>
      </header>
      <aside class="hg-panel hg-chassis" data-tab="chassi">
        <div class="hg-head"><span>01</span> CHASSI</div>
        <div id="hangar-chassis-list" class="hg-chassis-list"></div>
        <dl class="hg-specs">
          <div><dt>ALTURA</dt><dd id="hangar-height"></dd></div>
          <div><dt>VELOCIDADE</dt><dd id="hangar-speed"></dd></div>
          <div><dt>BLINDAGEM · TORSO</dt><dd id="hangar-armor"></dd></div>
          <div><dt>DISSIPADOR</dt><dd id="hangar-cooling"></dd></div>
        </dl>
      </aside>
      <section class="hg-panel hg-console" data-tab="armas">
        <div class="hg-head"><span>02</span> MONTAGEM</div>
        <div id="hangar-slot-list" class="hg-slots"></div>
        <div id="hangar-layout" class="hg-layout" role="group" aria-label="Como os ataques se dividem"></div>
        <div id="hangar-weapon-editor" class="hg-editor"></div>
        <label class="hg-module"><span>MÓDULO EXTRA <i>(não ocupa os braços)</i></span><select id="hangar-module-select" aria-label="Módulo de energia"><option value="">Sem módulo</option><option value="frontal">Barreira frontal · 2,0 t · 5 s, 120°</option><option value="sphere">Esfera de energia · 4,0 t · 3,75 s, 360°</option><option value="fire">Anel de fogo · 3,0 t · 5 s, raio de 7 m</option></select><small>Ctrl liga e desliga. Os impactos gastam a energia. <b>Anel de fogo:</b> não segura tiro; queima os inimigos num raio de 7 m e esquenta todos ali, inclusive você; derrete o inimigo congelado.</small></label>
        <div class="hg-actions">
          <span id="hangar-message" role="status"></span>
          <button class="hg-btn hangar-apply" type="button" data-action="apply">APLICAR MONTAGEM ›</button>
        </div>
      </section>
      <footer class="hg-panel hg-readout" data-tab="numeros">
        <div class="hg-metric hg-load"><span>CARGA DO CHASSI</span><b id="hangar-mass-value"></b><div class="hg-meter"><i id="hangar-mass-fill"></i></div><small id="hangar-mass-caption"></small></div>
        <div class="hg-metric"><span>FERVE EM</span><b id="hangar-heat-value"></b><small>correndo e disparando tudo</small></div>
        <div class="hg-metric"><span>DERRUBA UM MECH EM</span><b id="hangar-ttk-value"></b><small>torso, acerto perfeito</small></div>
        <div class="hg-metric"><span>DANO EM 20 S</span><b id="hangar-damage-value"></b><small>com calor e recarga</small></div>
        <div class="hg-share"><input id="hangar-build-link" aria-label="Link da montagem" readonly><button type="button" data-action="copy">COPIAR LINK</button></div>
      </footer>
      <nav class="hg-tabs" aria-label="Painéis do Hangar">
        <button type="button" data-tab-btn="chassi">CHASSI</button>
        <button type="button" data-tab-btn="armas">ARMAS</button>
        <button type="button" data-tab-btn="numeros">NÚMEROS</button>
        <button class="hg-tab-apply" type="button" data-action="apply">APLICAR ›</button>
      </nav>`;
    document.body.append(this.root);
    this.hotRight = this.root.querySelector<HTMLElement>('#hg-hot-right')!;
    this.hotLeft = this.root.querySelector<HTMLElement>('#hg-hot-left')!;
    button?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.open();
    });
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('change', (event) => this.onChange(event));
    document.addEventListener('keydown', (event) => {
      if (!this.isOpen) return;
      if (event.key === 'Escape') {
        if (this.aimTraining) this.endAimPractice(true);
        else if (this.testing) this.endTest(true);
        else this.close();
        return;
      }
      if (this.aimTraining || this.testing) return;
      // 1 a 4 carregam a montagem do atalho (fora de campo de texto).
      const n = Number(event.key);
      if (n >= 1 && n <= PRESET_COUNT && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) this.loadPreset(n - 1);
    });
    // Arrastar no galpão (fora dos painéis) gira o Mech no pedestal, com mouse ou dedo.
    const stage = this.root.querySelector<HTMLElement>('.hg-stage')!;
    let lastX: number | null = null;
    stage.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('button')) return;
      lastX = e.clientX;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (lastX === null) return;
      this.preview.rotate?.(e.clientX - lastX);
      lastX = e.clientX;
    });
    const release = () => (lastX = null);
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    this.render();
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /**
   * Por quadro, com o Hangar aberto: os marcadores dos braços na posição da tela onde cada braço está (null = fora).
   * Nada alocado além do texto do estilo.
   */
  placeHotspots(right: { x: number; y: number } | null, left: { x: number; y: number } | null): void {
    const w = window.innerWidth;
    const place = (el: HTMLElement, p: { x: number; y: number } | null) => {
      el.hidden = p === null;
      if (!p) return;
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      // O rótulo aponta para fora do Mech, mas nunca sai da tela.
      // No computador, os painéis cobrem as laterais: o rótulo fica no vão entre eles.
      const minX = w > 900 ? 330 : 170;
      const maxX = w > 900 ? w - 470 : w - 170;
      let toLeft = p.x < w * 0.45;
      if (toLeft && p.x < minX) toLeft = false;
      else if (!toLeft && p.x > maxX) toLeft = true;
      el.classList.toggle('to-left', toLeft);
    };
    place(this.hotRight, right);
    place(this.hotLeft, left);
  }

  /**
   * Por quadro, com o Hangar aberto: o andamento do teste de disparo na cena (null = acabou ou não há teste). A tela
   * mostra tempo, tiros, dano e calor do próprio teste, no mesmo segundo do desenho.
   */
  testFrame(progress: { t: number; seconds: number } | null): void {
    const data = this.testing;
    if (!data) return;
    if (!progress) {
      this.endTest(false);
      return;
    }
    const t = Math.max(0, progress.t - TEST_TURN_S);
    const at = testAt(data, t);
    this.setText('hg-test-time', `${num(Math.min(t, data.seconds), 1)} / ${num(data.seconds, 0)} s`);
    this.setText('hg-test-shots', String(at.shots));
    this.setText('hg-test-dmg', String(at.damage));
    const bar = this.root.querySelector<HTMLElement>('#hg-test-heatbar')!;
    bar.style.width = `${Math.round(at.heat * 100)}%`;
    bar.classList.toggle('over', at.locked);
    this.setText('hg-test-state', at.locked ? 'SUPERAQUECEU: ARMAS TRAVADAS' : `${Math.round(at.heat * 100)}%`);
  }

  /** Atualiza a leitura do treino manual sem re-renderizar a tela a cada quadro. */
  aimPracticeFrame(seconds: number, shots: number, hits: number, accuracy: number, charge: number): void {
    if (!this.aimTraining) return;
    this.setText('hg-test-time', `${num(seconds, 1)} s`);
    this.setText('hg-test-shots', String(shots));
    this.setText('hg-test-dmg', String(hits));
    this.root.querySelector<HTMLElement>('#hg-test-heatbar')!.style.width = `${accuracy}%`;
    this.setText('hg-test-state', `${accuracy}%`);
    this.setText('hg-practice-help', charge > 0 ? `CARREGANDO · ${Math.round(charge * 100)}% · SEGURE O BOTÃO ESQUERDO` : 'MOVA A MIRA E SEGURE O BOTÃO ESQUERDO · ESC PARA SAIR');
  }

  private startTest(): void {
    const arm = this.draft[this.selectedSlot];
    if (!arm || isMetalShield(arm) || !this.hangar.check(this.draft).ok) return;
    const w = weapon(arm.id as WeaponId, arm.tier);
    const mounts = slotMounts(this.draft.chassis, this.selectedSlot, this.draft.layout ?? 0);
    const data = testFire(CHASSIS[this.draft.chassis], w, TEST_FIRE_S, mounts.length);
    this.testing = data;
    // Sem a animação de entrada: ela seguraria os painéis visíveis (o fim da animação vale mais que o estilo).
    this.root.classList.remove('hg-enter');
    this.root.classList.add('hg-testing');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = false;
    this.setText('hg-test-weapon', `${w.name.toUpperCase()} ${TIERS[w.tier]!.label}`);
    this.testFrame({ t: 0, seconds: data.seconds });
    this.preview.test?.(data, mounts);
  }

  private startAimPractice(): void {
    const arm = this.draft[this.selectedSlot];
    if (!arm || isMetalShield(arm) || !this.preview.aimPractice || !this.hangar.check(this.draft).ok) return;
    const selectedWeapon = weapon(arm.id as WeaponId, arm.tier);
    if (selectedWeapon.kind === 'melee') {
      this.message = 'O alvo móvel treina armas de tiro. Use TESTAR DISPARO para conferir a motosserra.';
      this.messageKind = 'info';
      this.renderMessage();
      return;
    }
    if (this.preview.canAimPractice && !this.preview.canAimPractice()) {
      this.message = 'O treino manual usa mouse e teclado. No toque, use TESTAR DISPARO.';
      this.messageKind = 'info';
      this.renderMessage();
      return;
    }
    this.aimTraining = true;
    this.root.classList.remove('hg-enter');
    this.root.classList.add('hg-testing', 'hg-aim-training');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = false;
    this.setText('hg-test-title', 'TREINO DE MIRA');
    this.setText('hg-test-weapon', `ALVO MÓVEL · ${this.selectedSlot === 'right' ? 'BRAÇO D' : this.selectedSlot === 'left' ? 'BRAÇO E' : 'OMBROS'}`);
    this.setText('hg-test-shots-label', 'DISPAROS');
    this.setText('hg-test-dmg-label', 'ACERTOS');
    this.setText('hg-test-heat-label', 'PRECISÃO');
    this.setText('hg-test-state', '0%');
    this.root.querySelector<HTMLElement>('#hg-practice-help')!.hidden = false;
    this.setText('hg-test-stop', 'ESC PARA SAIR');
    this.preview.aimPractice(selectedWeapon);
  }

  /** Chamado ao soltar Esc ou quando o navegador encerra o Pointer Lock. */
  endAimPractice(stopped: boolean): void {
    if (!this.aimTraining) return;
    this.aimTraining = false;
    this.preview.stopAimPractice?.();
    this.root.classList.remove('hg-testing', 'hg-aim-training');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = true;
    this.root.querySelector<HTMLElement>('#hg-practice-help')!.hidden = true;
    this.setText('hg-test-title', 'TESTE DE DISPARO');
    this.setText('hg-test-shots-label', 'TIROS');
    this.setText('hg-test-dmg-label', 'DANO');
    this.setText('hg-test-heat-label', 'CALOR');
    this.setText('hg-test-stop', 'PARAR');
    this.message = stopped ? 'Treino de mira encerrado.' : 'Treino encerrado: mouse liberado.';
    this.messageKind = 'info';
    this.renderMessage();
  }

  /** Fim do teste (acabou ou parou): os painéis voltam e o resumo fica na mensagem. */
  private endTest(stopped: boolean): void {
    const data = this.testing;
    if (!data) return;
    this.testing = null;
    if (stopped) this.preview.stopTest?.();
    this.root.classList.remove('hg-testing');
    this.root.querySelector<HTMLElement>('#hg-test')!.hidden = true;
    const heat = data.overheatAt === null ? 'sem ferver' : `ferveu em ${num(data.overheatAt, 1)} s`;
    this.message = stopped ? 'Teste interrompido.' : `Teste: ${data.shots.length} disparos e ${data.damage} de dano em ${num(data.seconds, 0)} s, ${heat}.`;
    this.messageKind = 'info';
    this.renderMessage();
  }

  /** Atalho cheio: carrega a montagem no rascunho (aplicar continua sendo do botão). */
  private loadPreset(index: number): void {
    const p = this.hangar.presets()[index];
    if (!p) return;
    this.draft = copySpec(p);
    this.selectedSlot = 'right';
    this.message = `Atalho ${index + 1} carregado: aplique para usar.`;
    this.messageKind = 'info';
    this.render();
  }

  private savePreset(index: number): void {
    const check = this.hangar.savePreset(index, this.draft);
    this.message = check.ok ? `Montagem salva no atalho ${index + 1}.` : check.detail;
    this.messageKind = check.ok ? 'info' : 'error';
    this.render();
  }

  private open(): void {
    this.draft = copySpec(this.hangar.current);
    this.message = '';
    this.root.classList.remove('hidden', 'hg-enter');
    void this.root.offsetWidth; // reinicia a animação de entrada
    this.root.classList.add('hg-enter');
    this.pauseOverlay?.classList.add('hidden');
    document.documentElement.classList.add('hangar-open');
    this.preview.open();
    this.render();
    this.root.querySelector<HTMLButtonElement>('.hangar-apply')?.focus({ preventScroll: true }); // sem isto o navegador rolava o painel até o botão, e o topo (os braços) abria cortado
  }

  private close(): void {
    this.endAimPractice(true);
    this.endTest(true);
    this.root.classList.add('hidden');
    this.pauseOverlay?.classList.remove('hidden');
    document.documentElement.classList.remove('hangar-open');
    this.preview.close();
  }

  private onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest<HTMLButtonElement>('[data-tab-btn]')?.dataset.tabBtn;
    if (tab === 'chassi' || tab === 'armas' || tab === 'numeros') {
      this.tab = tab;
      this.render();
      return;
    }
    const slot = target?.closest<HTMLButtonElement>('[data-slot]')?.dataset.slot;
    if (slot === 'right' || slot === 'left' || slot === 'shoulders') {
      this.selectedSlot = slot;
      this.tab = 'armas';
      this.message = '';
      this.render();
      return;
    }
    const chassisAttr = target?.closest<HTMLButtonElement>('[data-chassis]')?.dataset.chassis;
    const chassis = chassisAttr && chassisAttr in CHASSIS ? (chassisAttr as ChassisId) : null;
    const isLocked = target?.closest<HTMLButtonElement>('[data-locked]')?.dataset.locked;
    if (isLocked) {
      this.adminPanel.open();
      return;
    }
    if (chassis) {
      if (chassis !== this.draft.chassis) {
        this.draft = chassis === this.hangar.current.chassis ? copySpec(this.hangar.current) : factorySpec(chassis);
        this.selectedSlot = 'right';
        this.message = chassis === this.hangar.current.chassis ? '' : 'Piloto novo: aplique para trocar (a partida recomeça).';
        this.messageKind = 'info';
      }
      this.render();
      return;
    }
    const layoutAttr = target?.closest<HTMLButtonElement>('[data-layout]')?.dataset.layout;
    if (layoutAttr !== undefined) {
      const layout = Number(layoutAttr);
      if (Number.isInteger(layout) && layout >= 0 && layout < layoutCount(this.draft.chassis)) {
        // O layout só vive na versão 2 do texto da montagem (que também leva o módulo).
        this.draft = { ...this.draft, v: layout > 0 ? 2 : this.draft.v, module: layout > 0 ? (this.draft.module ?? null) : this.draft.module, layout };
        if (layout === 0) delete this.draft.layout;
        this.message = '';
      }
      this.render();
      return;
    }
    const tier = target?.closest<HTMLButtonElement>('[data-tier]')?.dataset.tier;
    if (tier === '0' || tier === '1' || tier === '2') {
      const selected = Number(tier) as Tier;
      this.draft = withArm(this.draft, this.selectedSlot, (arm) => (arm ? { ...arm, tier: selected } : null));
      this.message = '';
      this.render();
      return;
    }
    const load = target?.closest<HTMLButtonElement>('[data-preset-load]')?.dataset.presetLoad;
    if (load !== undefined) {
      const i = Number(load);
      if (this.hangar.presets()[i]) this.loadPreset(i);
      else this.savePreset(i);
      return;
    }
    const save = target?.closest<HTMLButtonElement>('[data-preset-save]')?.dataset.presetSave;
    if (save !== undefined) {
      this.savePreset(Number(save));
      return;
    }
    const action = target?.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (action === 'test') {
      event.stopPropagation();
      this.startTest();
      return;
    }
    if (action === 'aim-practice') {
      event.stopPropagation();
      this.startAimPractice();
      return;
    }
    if (action === 'stop-test') {
      event.stopPropagation();
      if (this.aimTraining) this.endAimPractice(true);
      else this.endTest(true);
      return;
    }
    if (action === 'admin') {
      event.stopPropagation();
      this.adminPanel.open();
      return;
    }
    if (action === 'close') {
      event.stopPropagation();
      this.close();
    } else if (action === 'apply') {
      event.stopPropagation();
      this.apply();
    } else if (action === 'copy') {
      event.stopPropagation();
      void this.copyLink();
    }
  }

  private onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id === 'hangar-module-select') { this.draft = { ...this.draft, v: 2, module: target.value === 'frontal' || target.value === 'sphere' || target.value === 'fire' ? target.value : null }; this.render(); return; }
    if (target.id !== 'hangar-weapon-select') return;
    const selected = target.value as WeaponId | MetalShieldId | '';
    this.draft = withArm(this.draft, this.selectedSlot, () => (selected ? { id: selected, tier: this.draft[this.selectedSlot]?.tier ?? 0 } : null));
    this.message = '';
    this.render();
  }

  private apply(): void {
    const previousChassis = this.hangar.current.chassis;
    const result = this.hangar.apply(this.draft);
    if (!result.ok) {
      this.message = result.detail;
      this.messageKind = 'error';
      this.render();
      return;
    }
    if (previousChassis !== this.draft.chassis) {
      this.message = 'Trocando piloto…';
      this.messageKind = 'info';
      this.renderMessage();
      reloadWithout('build');
      return;
    }
    this.message = this.preview.applied?.() ?? 'Montagem salva.';
    this.messageKind = 'info';
    this.render();
  }

  private async copyLink(): Promise<void> {
    const input = this.root.querySelector<HTMLInputElement>('#hangar-build-link')!;
    try {
      await navigator.clipboard.writeText(input.value);
      this.message = 'Link copiado: quem abrir entra com esta montagem.';
    } catch {
      input.focus();
      input.select();
      this.message = 'Link selecionado · copie com Ctrl+C.';
    }
    this.messageKind = 'info';
    this.renderMessage();
  }

  private render(): void {
    const spec = this.draft;
    const chassis = CHASSIS[spec.chassis];
    const label = CHASSIS_LABEL[spec.chassis];
    const moduleSelect = this.root.querySelector<HTMLSelectElement>('#hangar-module-select')!;
    moduleSelect.value = spec.module ?? ''; moduleSelect.disabled = spec.chassis === 'android';
    const report = this.hangar.report(spec);
    const current = this.hangar.current;
    this.root.dataset.tab = this.tab;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-tab-btn]')) b.classList.toggle('selected', b.dataset.tabBtn === this.tab);

    // O galpão 3D mostra a montagem do rascunho (a válida; fora da carga, as armas de fábrica do chassi).
    if (report.check.ok) this.preview.show?.(spec.chassis, report.check.loadout);
    else if (this.previewChassis !== spec.chassis) this.preview.show?.(spec.chassis, chassis.loadout);
    this.previewChassis = spec.chassis;

    this.setText('hg-top-credits', (this.preview.credits?.() ?? 0).toLocaleString('pt-BR') + ' ₵');
    this.setText('hg-top-mode', this.preview.status?.() ?? 'OFFLINE');
    this.setText('hangar-mech-title', label.title);
    this.setText('hangar-mech-detail', `${label.className} · ${label.detail}`);
    this.setText('hangar-height', `${num(chassis.height, 1)} m`);
    this.setText('hangar-speed', `${num(chassis.moveSpeed, 1)} m/s`);
    this.setText('hangar-armor', `${chassis.maxModuleHealth.torso} HP`);
    this.setText('hangar-cooling', `${Math.round(chassis.heatCooling * 100)}% / s`);

    const chassisList = this.root.querySelector<HTMLElement>('#hangar-chassis-list')!;
    const isOficina = new URLSearchParams(location.search).has('oficina');
    chassisList.innerHTML = (Object.keys(CHASSIS) as ChassisId[])
      .filter((id) => CHASSIS[id].status !== 'oficina' || isOficina || this.unlockedMechs.has(id) || true)
      .map((id) => {
        const c = CHASSIS[id];
        const l = CHASSIS_LABEL[id];
        const locked = c.status === 'oficina' && !isOficina && !this.unlockedMechs.has(id);
        const selected = id === spec.chassis;
        const inUse = id === current.chassis;
        return `<button class="hg-chassis-card${selected ? ' selected' : ''}${locked ? ' locked' : ''}" type="button" data-chassis="${id}" aria-pressed="${selected}" ${locked ? 'data-locked="true"' : ''}><svg viewBox="0 0 60 84" aria-hidden="true">${CHASSIS_ICON[id]}</svg><span><small>${l.className}</small><b>${l.title}</b><em>${locked ? '🔒 OFICINA (clique p/ admin)' : `${num(c.weaponCapacity, 0)} t de carga · ${num(c.height, 1)} m${inUse ? ' · EM USO' : ''}`}</em></span></button>`;
        return `<button class="hg-chassis-card${selected ? ' selected' : ''}" type="button" data-chassis="${id}" aria-pressed="${selected}"><svg viewBox="0 0 60 84" aria-hidden="true">${CHASSIS_ICON[id]}</svg><span><small>${l.className}</small><b>${l.title}</b><em>${num(c.weaponCapacity, 0)} t de carga · ${num(c.height, 1)} m${hasShoulderSlot(id) ? ' · OMBROS' : ''}${inUse ? ' · EM USO' : ''}</em></span></button>`;
      })
      .join('');

    const slotList = this.root.querySelector<HTMLElement>('#hangar-slot-list')!;
    const layoutBox = this.root.querySelector<HTMLElement>('#hangar-layout')!;
    const layouts = CHASSIS[spec.chassis].layouts;
    // Só os robôs com mais de um jeito de dividir os encaixes oferecem a escolha (Ataque 1 e Ataque 2: P95).
    layoutBox.hidden = !layouts || layouts.length < 2;
    layoutBox.innerHTML = layouts && layouts.length > 1
      ? '<span class="hg-layout-title">COMO OS ATAQUES SE DIVIDEM</span>' + layouts.map((l, i) => `<button type="button" class="hg-layout-btn${(spec.layout ?? 0) === i ? ' selected' : ''}" data-layout="${i}" aria-pressed="${(spec.layout ?? 0) === i}" title="${l.name}">${l.short}</button>`).join('')
      : '';
    const shield = SHIELD_ARM.includes(spec.chassis);
    const slots: readonly ArmSlot[] = hasShoulderSlot(spec.chassis) ? ['right', 'left', 'shoulders'] : ['right', 'left'];
    // Trocou de chassi para um sem ombros com os ombros escolhidos: volta ao braço direito.
    if (!slots.includes(this.selectedSlot)) this.selectedSlot = 'right';
    slotList.innerHTML = slots
      .map((slot) => {
        const arm = spec[slot] ?? null;
        const slotPlate = isMetalShield(arm) ? arm : null;
        const w = arm && !slotPlate ? weapon(arm.id as WeaponId, arm.tier) : null;
        const selected = slot === this.selectedSlot;
        const icon = w ? WEAPON_ICON[w.id] : slotPlate ? PLATE_ICON : '<path d="M6 12h12" />';
        const name = w?.name ?? (slotPlate ? METAL_SHIELDS[slotPlate.id].name : slot === 'left' && shield ? 'ESCUDO' : 'VAZIO');
        const info = w ? TIERS[w.tier]!.label + ' · ' + num(w.mass * mountCopies(slot, spec.chassis, spec.layout ?? 0), 1) + ' t' : slotPlate ? METAL_SHIELD_TIERS[slotPlate.tier].label + ' · ' + num(metalShieldMass(slotPlate.id, slotPlate.tier), 1) + ' t' : '—';
        return `<button class="hg-slot${selected ? ' selected' : ''}${w || slotPlate ? '' : ' empty'}" type="button" data-slot="${slot}" aria-pressed="${selected}"><b class="hg-slot-num">${SLOT_NUM[slot]}</b><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span><small>${SLOT_LABEL[slot]} · ATAQUE ${slotAttack(slot, spec.chassis, spec.layout ?? 0) ?? '—'}</small><b>${name}</b></span><em>${info}</em></button>`;
      })
      .join('');

    const arm = spec[this.selectedSlot] ?? null;
    const plate = isMetalShield(arm) ? arm : null;
    const w = arm && !plate ? weapon(arm.id as WeaponId, arm.tier) : null;
    const nowArm = current.chassis === spec.chassis ? (current[this.selectedSlot] ?? null) : null;
    const was = nowArm && !isMetalShield(nowArm) ? weapon(nowArm.id as WeaponId, nowArm.tier) : null;
    const plateOptions = this.selectedSlot === 'left' && acceptsMetalShield(spec.chassis)
      ? `<optgroup label="ESCUDO FÍSICO · Ataque 2 levanta">${METAL_SHIELD_IDS.map((id) => `<option value="${id}"${arm?.id === id ? ' selected' : ''}>${METAL_SHIELDS[id].name} · ${num(metalShieldMass(id, arm?.tier ?? 0), 1)} t</option>`).join('')}</optgroup>`
      : '';
    const option = (id: WeaponId): string => `<option value="${id}"${arm?.id === id ? ' selected' : ''}>${weapon(id).name} · ${num(weapon(id, arm?.tier ?? 0).mass * mountCopies(this.selectedSlot, spec.chassis, spec.layout ?? 0), 1)} t${nasCostas(id, this.selectedSlot) ? ' · morteiro nas costas' : ''}</option>`;
    // Leves, médias e pesadas (P82); no gigante tudo cai em LEVES, porque a pesada dos Mechs é a leve dele. O andróide (tamanho 1) não agrupa:
    // o grupo "pesadas" dele seria o blaster.
    const grupos = armGroups(this.selectedSlot, spec.chassis);
    const options = CHASSIS_SIZE[spec.chassis] < 2
      ? armOptions(this.selectedSlot, spec.chassis).map(option).join('')
      : grupos.map((g) => `<optgroup label="${CLASS_LABEL_PLURAL[g.cls]}">${g.ids.map(option).join('')}</optgroup>`).join('');
    const shieldArm = this.selectedSlot === 'left' && shield && !acceptsMetalShield(spec.chassis);
    const editor = this.root.querySelector<HTMLElement>('#hangar-weapon-editor')!;
    editor.innerHTML = `
      <label class="hg-label" for="hangar-weapon-select">${SLOT_LABEL[this.selectedSlot]} · ATAQUE ${slotAttack(this.selectedSlot, spec.chassis, spec.layout ?? 0) ?? '—'}</label>
      <select id="hangar-weapon-select"${shieldArm ? ' disabled' : ''}>${this.selectedSlot !== 'right' ? `<option value=""${arm ? '' : ' selected'}>${shieldArm ? 'ESCUDO (sem arma)' : 'VAZIO (menos carga)'}</option>` : ''}${options}${plateOptions}</select>
      <p class="hg-hint">${plate ? `${METAL_SHIELDS[plate.id].hint}. Segure o Ataque 2 (clique direito) para levantar a chapa: cobre a frente e anda mais devagar; abaixada, protege só o flanco esquerdo com metade da força. Sem energia: a chapa se desgasta e volta no conserto.` : w ? WEAPON_HINT[w.id] + (this.selectedSlot === 'shoulders' ? ' · um lançador em cada ombro: a carga conta duas vezes' : '') + (nasCostas(w.id, this.selectedSlot) ? ' · fica nas costas do Mech, apontando para cima; o antebraço fica liso' : '') + (CHASSIS_SIZE[spec.chassis] >= 3 ? ' · tamanho 3: o que é pesado nos Mechs comuns é leve para ele' : '') : shieldArm ? 'Este braço leva o escudo e não recebe arma. O escudo ainda não bloqueia dano.' : 'Encaixe vazio: sobra carga para o resto da montagem.'}</p>
${!report.check.ok ? '<p class="hg-load-warning">Ajuste a carga para aplicar ou testar. A prévia mantém a última montagem válida.</p>' : ''}
      ${["genesis01", "lancerL1", "lr7lBastion", "quadraV2"].includes(spec.chassis) ? '<p class="hg-hint">Arma integrada ao casco: a aparência deste robô ainda não muda com a seleção.</p>' : ''}<div class="hg-label">NÍVEL DE POTÊNCIA</div>
      <div class="hg-tiers">${TIERS.map((t, i) => { const copies = mountCopies(this.selectedSlot, spec.chassis, spec.layout ?? 0); const mass = plate ? metalShieldMass(plate.id, i as Tier) : arm ? weapon(arm.id as WeaponId, i as Tier).mass * copies : 0; const total = report.mass - (plate ? metalShieldMass(plate.id, plate.tier) : (w?.mass ?? 0) * copies) + mass; const excess = Math.max(0, total - report.capacity); const hint = excess > 1e-9 ? `EXCEDE ${num(excess, 1)} t` : `${num(report.capacity - total, 1)} t livres`; return `<button class="hg-tier${arm?.tier === i ? ' selected' : ''}${excess > 1e-9 ? ' over' : ''}" type="button" data-tier="${i}" aria-pressed="${arm?.tier === i}" title="${hint}"${arm ? '' : ' disabled'}><b>${t.label}</b><small>${i === 0 ? 'PADRÃO' : plate ? `+${Math.round((METAL_SHIELD_TIERS[i]!.integrity - 1) * 100)}% chapa` : `+${Math.round((t.damage - 1) * 100)}% dano`} · ${num(mass, 1)} t</small><small>${hint}</small></button>`; }).join('')}</div>
      <div class="hg-try">
      <button class="hg-test-btn" type="button" data-action="test"${w && report.check.ok ? '' : ' disabled'}>▶ TESTAR · 4 S</button>
      <button class="hg-practice-btn" type="button" data-action="aim-practice"${w && report.check.ok ? '' : ' disabled'}>◎ TREINO DE MIRA</button>
      </div>
      ${w ? `<div class="hg-bars">${STATS.map((s) => bar(s, w, was)).join('')}</div><p class="hg-legend"><i class="now"></i> esta montagem <i class="was"></i> a que está no Mech</p>` : plate ? plateBars(plate.id, plate.tier) : ''}`;

    const capPct = Math.min(100, (report.mass / report.capacity) * 100);
    const fill = this.root.querySelector<HTMLElement>('#hangar-mass-fill')!;
    fill.style.width = `${capPct}%`;
    const over = !report.check.ok && report.check.error === 'carga';
    fill.classList.toggle('over', over);
    this.setText('hangar-mass-value', `${num(report.mass, 1)} / ${num(report.capacity, 0)} t`);
    this.setText('hangar-mass-caption', over ? `EXCEDE ${num(report.mass - report.capacity, 1)} t · reduza o nível ou esvazie um encaixe` : `${num(Math.max(0, report.capacity - report.mass), 1)} t livres`);
    this.setText('hangar-heat-value', !report.check.ok ? '—' : report.overheatAt === null ? 'NÃO FERVE' : `${num(report.overheatAt, 1)} s`);
    this.setText('hangar-ttk-value', report.check.ok && Number.isFinite(report.ttkTorso) ? `${num(report.ttkTorso, 1)} s` : '—');
    this.setText('hangar-damage-value', report.check.ok ? `${Math.round(report.damage20)} HP` : '—');
    const shareUrl = new URL(location.href);
    shareUrl.searchParams.set('build', loadoutKey(spec));
    shareUrl.searchParams.delete('sala');
    this.root.querySelector<HTMLInputElement>('#hangar-build-link')!.value = shareUrl.toString();
    for (const apply of this.root.querySelectorAll<HTMLButtonElement>('[data-action="apply"]')) {
      apply.disabled = !report.check.ok;
      apply.title = report.check.ok ? 'Salvar e aplicar a montagem' : report.check.detail;
    }
    this.hotLeft.querySelector('span')!.innerHTML = `<b>02</b> ${isMetalShield(spec.left) || (!spec.left && shield) ? 'BRAÇO E · ESCUDO' : spec.left ? 'BRAÇO E' : 'BRAÇO E · VAZIO'}`;
    // Atalhos 1 a 4: vazio salva a montagem da tela; cheio carrega (e o SALVAR pequeno sobrescreve).
    const draftKey = loadoutKey(spec);
    this.root.querySelector<HTMLElement>('#hg-presets')!.innerHTML = this.hangar
      .presets()
      .map((p, i) => {
        const active = p !== null && loadoutKey(p) === draftKey;
        const label = p ? presetLabel(p) : '+ SALVAR';
        return `<div class="hg-preset${p ? '' : ' empty'}${active ? ' active' : ''}"><button type="button" data-preset-load="${i}" title="${p ? `Carregar o atalho ${i + 1} (tecla ${i + 1})` : 'Salvar esta montagem aqui'}"><b>${i + 1}</b><small>${label}</small></button>${p ? `<button class="hg-preset-save" type="button" data-preset-save="${i}" title="Salvar a montagem da tela neste atalho">SALVAR</button>` : ''}</div>`;
      })
      .join('');
    this.hotRight.classList.toggle('selected', this.selectedSlot === 'right');
    this.hotLeft.classList.toggle('selected', this.selectedSlot === 'left');
    this.renderMessage();
  }

  private renderMessage(): void {
    const node = this.root.querySelector<HTMLElement>('#hangar-message');
    if (!node) return;
    node.textContent = this.message;
    node.dataset.kind = this.messageKind;
  }

  private setText(id: string, text: string): void {
    const node = this.root.querySelector<HTMLElement>(`#${id}`);
    if (node) node.textContent = text;
  }
}

/** Sigla curta de cada chassi, para caber no atalho do preset. */
const CHASSIS_SIGLA: Record<ChassisId, string> = { vector09: 'V09', android: 'A-1', colossus01: 'C01', colossusv4: 'C4', arara: 'B1', onca: 'B2', genesis01: 'G01', lancerL1: 'L01', lr7lBastion: 'LR7', quadraV2: 'QV2', marauder: 'MRD' };

/** Ícone da chapa do escudo físico no encaixe. */
const PLATE_ICON = '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />';

const DAMAGE_LABEL: Record<DamageType, string> = {
  termico: 'TÉRMICO', laser: 'LASER', balistico: 'BALÍSTICO', explosivo: 'EXPLOSIVO', pulso: 'PULSO', sonico: 'SÔNICO', corte: 'CORTE', eletrico: 'ELÉTRICO', criogenico: 'CRIOGÊNICO',
};

/** Quanto a chapa levantada segura de cada natureza de dano (com o bônus do nível). */
function plateBars(id: MetalShieldId, tier: Tier): string {
  const m = METAL_SHIELDS[id];
  const rows = (Object.keys(DAMAGE_LABEL) as DamageType[]).map((type) => {
    const v = Math.round(Math.min(0.95, m.resist[type] + METAL_SHIELD_TIERS[tier].resist) * 100);
    return `<div class="hg-bar"><span>${DAMAGE_LABEL[type]}</span><div class="hg-track"><i class="now" style="width:${v}%"></i></div><b>${v}%</b></div>`;
  });
  return `<div class="hg-bars">${rows.join('')}</div><p class="hg-legend">dano seguro com a chapa levantada · chapa de ${num(m.integrity * METAL_SHIELD_TIERS[tier].integrity, 1)}× a vida do braço</p>`;
}

/** Rótulo curto de um atalho: chassi e nível de cada braço (ex.: "V09 · III / I"). */
function presetLabel(p: LoadoutSpec): string {
  const tier = (a: LoadoutSpec[ArmSlot]) => (a ? ['I', 'II', 'III'][a.tier] : '—');
  return `${CHASSIS_SIGLA[p.chassis]} · ${tier(p.right)} / ${tier(p.left)}${p.shoulders !== undefined ? ` / ${tier(p.shoulders)}` : ''}`;
}

/** Uma barra de leitura: o valor da arma escolhida e, por baixo, o da que está no Mech (se for outra). */
function bar(s: StatRow, w: WeaponStats, was: WeaponStats | null): string {
  const v = s.get(w);
  const max = STAT_MAX[s.key] || 1;
  const old = was ? s.get(was) : null;
  const delta = old === null ? 0 : v - old;
  const better = s.lowerIsBetter ? delta < 0 : delta > 0;
  const mark = Math.abs(delta) < 1e-6 ? '' : `<em class="${better ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}</em>`;
  return `<div class="hg-bar"><span>${s.label}</span><div class="hg-track"><i class="was" style="width:${old === null ? 0 : Math.min(100, (old / max) * 100)}%"></i><i class="now" style="width:${Math.min(100, (v / max) * 100)}%"></i></div><b>${num(v, s.digits)}${s.unit}</b>${mark}</div>`;
}

function copySpec(spec: LoadoutSpec): LoadoutSpec {
  const copy: LoadoutSpec = { v: spec.v, chassis: spec.chassis, right: { ...spec.right }, left: spec.left ? { ...spec.left } : null };
  if (spec.module !== undefined) copy.module = spec.module;
  if (spec.layout !== undefined) copy.layout = spec.layout;
  if (spec.shoulders !== undefined) copy.shoulders = spec.shoulders ? { ...spec.shoulders } : null;
  return copy;
}

function withArm(spec: LoadoutSpec, slot: ArmSlot, update: (arm: LoadoutSpec[ArmSlot]) => LoadoutSpec[ArmSlot]): LoadoutSpec {
  return { ...spec, [slot]: update(spec[slot]) };
}
