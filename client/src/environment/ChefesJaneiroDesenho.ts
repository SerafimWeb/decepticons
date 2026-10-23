import * as THREE from 'three';
import type { Match } from '../sim/Match';
import { CACETETE } from '../sim/ChefesJaneiro';
import { funcionalidadeVisivel } from '../core/Visibilidade';
import { geometriaCacetete, JANEIRO_CORES, modeloChefe } from './JaneiroModelos';

const PREMIO = 'cybermech.janeiro.cacetete';
const CSS = `
.janeiro-chefe {position:absolute;top:156px;left:50%;transform:translateX(-50%);width:min(410px,85vw);padding:10px 16px;background:linear-gradient(100deg,#171325e8,#090f19ec);border:1px solid #b581ea80;border-top:3px solid #b77eff;color:#eee7f6;text-align:center;pointer-events:none;font:12px Consolas,monospace;letter-spacing:2px}
.janeiro-chefe small {display:block;color:#b7a7cc;font-size:9px;margin-bottom:5px}.janeiro-chefe strong {font-size:18px}.janeiro-chefe .jc-vida {height:6px;background:#ffffff20;margin:8px 0}.janeiro-chefe i {display:block;height:100%;background:linear-gradient(90deg,#963bda,#dfbaff);transform-origin:left}.janeiro-chefe em {font:10px Consolas,monospace;color:#e3c966}
.janeiro-premio {position:absolute;right:22px;bottom:158px;max-width:240px;padding:12px 16px;border:1px solid #bd84ff80;background:#1b1230e8;color:#e9d7ff;font:11px Consolas,monospace;cursor:pointer;text-align:left;letter-spacing:1px}.janeiro-premio small {display:block;margin-top:6px;font-size:9px;color:#c0acd5}.janeiro-premio:disabled {opacity:.65;cursor:default}.janeiro-chefe[hidden],.janeiro-premio[hidden]{display:none}
@media(max-height:600px){.janeiro-chefe{top:134px;padding:5px 10px}.janeiro-chefe small{display:none}.janeiro-premio{bottom:105px;right:10px;padding:8px}}
`;

export class ChefesJaneiroDesenho {
  readonly grupo = new THREE.Group();
  private readonly encontro;
  private readonly modelos = [modeloChefe('trampado'), modeloChefe('evil')];
  private readonly anel = new THREE.Mesh(new THREE.RingGeometry(0.91, 1, 64), new THREE.MeshBasicMaterial({ color: JANEIRO_CORES.roxo, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  private readonly disco = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: JANEIRO_CORES.roxo, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  private readonly arma = new THREE.Mesh(geometriaCacetete(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.12 }));
  private readonly particulas = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: JANEIRO_CORES.luz }), 40);
  private readonly pose = new THREE.Object3D();
  private readonly painel = document.createElement('div');
  private readonly nome = document.createElement('strong');
  private readonly barra = document.createElement('i');
  private readonly dica = document.createElement('em');
  private readonly botao = document.createElement('button');
  private readonly estilo = document.createElement('style');
  private ultimoTexto = '';
  private readonly conquistou;

  constructor(private readonly match: Match, hud: HTMLElement) {
    this.encontro = match.chefesJaneiro!;
    this.encontro.habilitado = funcionalidadeVisivel('fase:chefes-janeiro');
    this.encontro.armaPermitida = funcionalidadeVisivel('arma:cacetete-poder');
    try { this.encontro.conquistado = localStorage.getItem(PREMIO) === '1'; } catch { /* progresso em memória continua */ }
    this.conquistou = this.encontro.aoConquistar;
    this.encontro.aoConquistar = () => {
      this.conquistou?.();
      try { localStorage.setItem(PREMIO, '1'); } catch { /* armazenamento indisponível não tira o prêmio */ }
    };
    for (let i = 0; i < 2; i++) {
      const m = this.modelos[i]!; m.grupo.scale.setScalar(this.encontro.chefes[i]!.config.escala);
      this.grupo.add(m.grupo);
      const sombra = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x242031, transparent: true, opacity: 0.2, depthWrite: false }));
      sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.14; sombra.scale.set(0.72, 0.44, 1); m.grupo.add(sombra);
    }
    this.anel.rotation.x = this.disco.rotation.x = -Math.PI / 2;
    this.particulas.frustumCulled = false;
    this.grupo.add(this.anel, this.disco, this.arma, this.particulas);
    this.estilo.textContent = CSS; document.head.appendChild(this.estilo);
    this.painel.className = 'janeiro-chefe'; this.painel.dataset.func = 'fase:chefes-janeiro';
    const pequeno = document.createElement('small'); pequeno.textContent = 'ENCONTRO SATÍRICO · DEFENDA A PRAÇA';
    const fundo = document.createElement('div'); fundo.className = 'jc-vida'; fundo.appendChild(this.barra);
    this.painel.append(pequeno, this.nome, fundo, this.dica);
    this.botao.className = 'janeiro-premio'; this.botao.dataset.func = 'arma:cacetete-poder';
    this.botao.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.encontro.golpePendente = true; });
    hud.append(this.painel, this.botao);
  }

  atualizar(pedido: boolean): void {
    const e = this.encontro;
    e.habilitado = funcionalidadeVisivel('fase:chefes-janeiro');
    e.armaPermitida = funcionalidadeVisivel('arma:cacetete-poder');
    if (pedido && e.armaPermitida) e.golpePendente = true;
    const t = e.tick / 60;
    for (let i = 0; i < 2; i++) {
      const c = e.chefes[i]!, m = this.modelos[i]!;
      m.grupo.visible = e.habilitado && c.vivo;
      m.grupo.position.set(c.x, Math.abs(Math.sin(c.passos * 2.8)) * 0.08, c.z); m.grupo.rotation.y = c.yaw;
      m.material.emissive.setHex(c.flash > 0 ? 0x552a55 : 0x000000);
      for (let j = 0; j < 2; j++) {
        m.pernas[j]!.rotation.z = Math.sin(c.passos * 2.8) * (j === 0 ? 0.28 : -0.28);
        m.bracos[j]!.rotation.z = j === 0 && c.estado === 'aviso' ? -1.8 : j === 0 && c.estado === 'golpe' ? 0.8 * Math.max(0, c.relogio - 1.3) * 2 : Math.sin(c.passos * 2.8) * (j === 0 ? -0.17 : 0.17);
      }
    }
    const c = e.ativo;
    this.painel.hidden = !e.habilitado || this.match.missaoJaneiro!.terminou || e.tick < 1200 || !c;
    if (c) {
      this.nome.textContent = `${c.config.nome} · ${Math.ceil(c.vida)} / ${c.config.vida}`;
      this.barra.style.transform = `scaleX(${c.vida / c.config.vida})`;
      this.dica.textContent = c.estado === 'aviso' ? 'SAIA DO CÍRCULO · CACETADA A CAMINHO!' : c.estado === 'golpe' ? 'AGORA! ELE ESTÁ SE RECUPERANDO' : c.config.id === 'evil' ? 'CHEFE SUPERIOR · VENÇA PARA CONQUISTAR O CACETETE' : '1 / 2 · O TOPETE NÃO É UM ESCUDO';
    }
    const golpe = e.golpeFx > 0;
    const perigo = c && (c.estado === 'aviso' || (c.estado === 'golpe' && c.relogio > 1.3));
    this.anel.visible = this.disco.visible = !!(e.habilitado && (perigo || golpe));
    const raio = golpe ? CACETETE.alcance * (1 - e.golpeFx / 0.6) : c?.config.raio ?? 1;
    this.anel.position.set(golpe ? e.golpeX : c?.avisoX ?? 0, 0.19, golpe ? e.golpeZ : c?.avisoZ ?? 0);
    this.disco.position.copy(this.anel.position); this.anel.scale.setScalar(raio); this.disco.scale.setScalar(raio);
    this.anel.material.opacity = perigo && c?.estado === 'aviso' ? 0.6 + Math.sin(t * 20) * 0.25 : 0.8;
    this.particulas.visible = this.anel.visible;
    if (this.particulas.visible) {
      for (let k = 0; k < 40; k++) {
        const a = k * Math.PI * 2 / 40 + t * 1.4;
        const r = raio * (0.7 + (k % 3) * 0.12);
        this.pose.position.set(this.anel.position.x + Math.cos(a) * r, 0.3 + ((t * 2 + k * 0.31) % 1) * (golpe ? 3 : 1.4), this.anel.position.z + Math.sin(a) * r);
        this.pose.rotation.set(a, t * 3, a); this.pose.updateMatrix(); this.particulas.setMatrixAt(k, this.pose.matrix);
      }
      this.particulas.instanceMatrix.needsUpdate = true;
    }
    const jogador = this.match.players[0];
    this.arma.visible = e.conquistado && e.armaPermitida && !!jogador?.alive;
    if (jogador) {
      const p = jogador.simPosition, yaw = jogador.yaw;
      const a = golpe ? (1 - e.golpeFx / 0.45) * 2.6 - 1.3 : 0;
      this.arma.position.set(p.x + Math.cos(yaw) * 1.8, p.y + 2.2, p.z - Math.sin(yaw) * 1.8);
      this.arma.rotation.set(0, yaw, -0.4 - a); this.arma.scale.setScalar(1.6);
    }
    this.botao.hidden = !e.habilitado || !e.armaPermitida;
    this.botao.disabled = !e.conquistado || e.recarga > 0;
    const texto = e.conquistado ? e.recarga > 0 ? 'RECARREGANDO…' : '[ F ] CACETETE DE PODER' : 'PRÊMIO: CACETETE DE PODER';
    if (texto !== this.ultimoTexto) {
      this.ultimoTexto = texto; this.botao.textContent = texto;
      const sub = document.createElement('small'); sub.textContent = e.conquistado ? 'Conquistado! Dispersa a multidão e atinge rebeldes.' : 'Derrote Trampado e depois Evil.'; this.botao.appendChild(sub);
    }
  }

  dispose(): void {
    this.encontro.aoConquistar = this.conquistou;
    const materiais = new Set<THREE.Material>();
    this.grupo.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materiais.add(m); } });
    for (const m of materiais) m.dispose();
    this.particulas.dispose(); this.painel.remove(); this.botao.remove(); this.estilo.remove(); this.grupo.removeFromParent();
  }
}
