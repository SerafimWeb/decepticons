/**
 * Painel "seu algoz" (frente 3 da P109, referência no MechArena §6.1): ao morrer, a tela diz **quem** te matou, em que
 * robô, com quanta vida ele ficou e **com que armas** — a informação que transforma a morte em aprendizado ("foi o
 * canhão pesado de longe; da próxima, chego por trás"). Convive com o contador de renascimento e com a câmera de abate.
 *
 * O dado todo já existe no cliente (o matador é um `MechBase` vivo): nada de rede, nada novo por tick. A leitura é
 * separada em `algozViewOf` (puro, testável) e o DOM mora em `AlgozPanel` (escreve só quando muda).
 */

/** O que a leitura precisa de um Mech (o matador offline; no online entra quando a sala é ligada). */
export interface AlgozMechLike {
  stats: { name: string; maxModuleHealth: { torso: number } };
  modules: { torso: number };
  loadout: {
    primary: { name: string; damage?: number };
    secondary?: { name: string; damage?: number } | null;
    offhand?: { name: string; damage?: number } | null;
    metalShield?: unknown;
  };
}

/** A leitura pronta para a tela. */
export interface AlgozView {
  nome: string;
  chassi: string;
  /** Vida do torso com que o matador ficou (é o que decide a morte dele, `combat/damage.ts`). */
  torso: number;
  torsoMax: number;
  /** As armas do matador, já em texto ("CANHÃO PESADO · 90"); sem repetir quando as duas mãos levam a mesma. */
  armas: readonly string[];
}

/** Monta a leitura do algoz: nome, chassi, a vida do torso e as armas com o dano. */
export function algozViewOf(mech: AlgozMechLike, nome: string): AlgozView {
  const armas: string[] = [];
  const add = (w: { name: string; damage?: number } | null | undefined) => {
    if (!w) return;
    const linha = `${w.name.toUpperCase()} · ${Math.round(w.damage ?? 0)}`;
    if (!armas.includes(linha)) armas.push(linha);
  };
  add(mech.loadout.primary);
  add(mech.loadout.offhand);
  add(mech.loadout.secondary);
  if (mech.loadout.metalShield) armas.push('ESCUDO FÍSICO');
  return {
    nome: nome.toUpperCase(),
    chassi: mech.stats.name,
    torso: mech.modules.torso,
    torsoMax: mech.stats.maxModuleHealth.torso || 1,
    armas,
  };
}

const $ = (id: string) => document.getElementById(id)!;

export class AlgozPanel {
  private readonly root: HTMLElement;
  private readonly nome: HTMLElement;
  private readonly chassi: HTMLElement;
  private readonly barra: HTMLElement;
  private readonly vida: HTMLElement;
  private readonly armas: HTMLElement;
  private shown = '';

  constructor(root: HTMLElement = $('algoz-panel')) {
    this.root = root;
    const mk = (cls: string, tag = 'div', parent: HTMLElement = root) => {
      const el = document.createElement(tag);
      el.className = cls;
      parent.appendChild(el);
      return el;
    };
    mk('ag-titulo').textContent = 'SEU ALGOZ';
    this.nome = mk('ag-nome');
    this.chassi = mk('ag-chassi');
    const vidaBox = mk('ag-vida-box');
    this.barra = mk('ag-barra', 'div', vidaBox);
    this.vida = mk('ag-vida', 'span', vidaBox);
    this.armas = mk('ag-armas', 'ul');
    this.hide();
  }

  /** Mostra o algoz; só escreve no DOM quando o conteúdo muda. */
  show(v: AlgozView): void {
    const texto = `${v.nome}|${v.chassi}|${v.torso}|${v.torsoMax}|${v.armas.join(',')}`;
    if (texto === this.shown) return;
    this.shown = texto;
    this.nome.textContent = v.nome;
    this.chassi.textContent = v.chassi;
    const f = Math.max(0, Math.min(1, v.torso / v.torsoMax));
    this.barra.style.transform = `scaleX(${Math.round(f * 50) / 50})`;
    this.barra.dataset.tom = f <= 0.25 ? 'critico' : f <= 0.5 ? 'atencao' : 'ok';
    this.vida.textContent = `${Math.round(v.torso)} / ${Math.round(v.torsoMax)}`;
    this.armas.replaceChildren(...v.armas.map((a) => {
      const li = document.createElement('li');
      li.textContent = a;
      return li;
    }));
    this.root.hidden = false;
  }

  hide(): void {
    if (this.shown === '') return;
    this.shown = '';
    this.root.hidden = true;
  }
}
