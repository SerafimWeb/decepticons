import * as THREE from 'three';
import { ABERTURA_DA_MISSAO } from '../environment/JaneiroJogo';
import { CameraPath } from '../camera/CameraPath';
import { CutsceneDirector } from '../camera/CutsceneDirector';

/**
 * A CUTSCENE-PILOTO DO 8 DE JANEIRO (P245): prova de conceito de uma câmera cinematográfica por trajetória, para gravar
 * em vídeo com `scripts/cutscene.mjs` (não é gameplay: não entra no pacote de partida — `main.ts` não a importa, só o
 * `Game` por `import()` quando o link pede `?cutscene=janeiro-abertura`, G3/G5). Mostra a Esplanada de onde a multidão
 * vem, a fachada do Congresso e a Praça entre os três poderes, com a mesma legenda 🟢 que já está na missão
 * (`ABERTURA_DA_MISSAO`, de `JaneiroJogo.ts`) — **nenhum fato novo**: só uma câmera melhor para o que já foi revisado.
 *
 * **Limite honesto (R13):** a trajetória é desenhada à mão (não evita atravessar geometria, como o `KillCam` faz por
 * raycast); é um roteiro fixo de ~24 s, não um sistema geral de cutscenes por missão. Som: nenhum (a legenda é só
 * texto); narração por voz é passo seguinte, se o Comandante aprovar o custo do `npm run vozes` (ElevenLabs) ou gravar
 * ele mesmo pelo Estúdio.
 */

const CSS = `
#cutscene-janeiro { position: fixed; inset: 0; pointer-events: none; z-index: 500; }
#cutscene-janeiro .cj-barra { position: absolute; left: 0; right: 0; height: 9vh; background: #000; opacity: 0; transition: opacity 1.2s ease; }
#cutscene-janeiro .cj-barra.cj-topo { top: 0; }
#cutscene-janeiro .cj-barra.cj-fundo { bottom: 0; }
#cutscene-janeiro.cj-ativa .cj-barra { opacity: 1; }
#cutscene-janeiro .cj-legenda { position: absolute; left: 50%; bottom: 14vh; transform: translateX(-50%); width: min(680px, 86vw); text-align: center;
  font-size: 14px; line-height: 1.6; letter-spacing: 1.3px; text-transform: uppercase; color: var(--ink, #eef2e8); text-shadow: 0 1px 3px #000; opacity: 0; transition: opacity 1.4s ease; }
#cutscene-janeiro .cj-legenda.cj-visivel { opacity: 1; }
#cutscene-janeiro .cj-pular { position: absolute; right: 18px; bottom: 18px; font-size: 11px; letter-spacing: 1.5px; color: var(--muted, #7f9c86); text-shadow: 0 1px 2px #000; opacity: 0; transition: opacity 1s ease 1s; }
#cutscene-janeiro.cj-ativa .cj-pular { opacity: 0.85; }
`;

/** Quando a legenda aparece e some (s), dentro da duração total da trajetória. */
const LEGENDA_DE_S = 2;
const LEGENDA_ATE_S = -3; // negativo: segundos antes do fim
/** O mesmo clique que ligou a cutscene (ex.: o "clique para jogar" da missão) não pode pulá-la de propósito. */
const PULAR_APOS_MS = 600;

/** A trajetória da câmera: da Esplanada (de onde a multidão vem) ao Congresso e à Praça entre os três poderes.
 *  Coordenadas no mesmo sistema de `PracaLayout.ts` (x leste, z sul, y para cima); ajustável sem mexer no mapa. */
function trajetoriaDaAbertura(): CameraPath {
  return new CameraPath([
    { t: 0, position: { x: -128, y: 30, z: 0 }, lookAt: { x: -96, y: 4, z: 0 }, fov: 58 }, // a Esplanada: os ônibus e os bueiros ao fundo
    { t: 6, position: { x: -58, y: 20, z: 20 }, lookAt: { x: -34, y: 2, z: 0 }, fov: 52 }, // avançando sobre a linha de gradis
    { t: 11, position: { x: -4, y: 32, z: 46 }, lookAt: { x: 18, y: 18, z: 0 }, fov: 48 }, // subindo diante da fachada do Congresso
    { t: 16, position: { x: 50, y: 44, z: -58 }, lookAt: { x: 30, y: 24, z: 0 }, fov: 46 }, // sobrevoando as torres e a cúpula
    { t: 20, position: { x: 98, y: 34, z: 62 }, lookAt: { x: 68, y: 8, z: 0 }, fov: 50 }, // descendo sobre a Praça, entre Planalto e Supremo
    { t: 24, position: { x: 54, y: 20, z: 96 }, lookAt: { x: 70, y: 6, z: 0 }, fov: 44 }, // o plano final: o monumento, os três prédios de pé
  ]);
}

export class CutsceneJaneiro {
  private readonly diretor: CutsceneDirector;
  private readonly root: HTMLDivElement;
  private readonly legenda: HTMLDivElement;
  private readonly estilo: HTMLStyleElement;
  private readonly aoPular: (e: Event) => void;
  private ligadaEm = 0;
  private elapsed = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.diretor = new CutsceneDirector(camera, trajetoriaDaAbertura());

    this.estilo = document.createElement('style');
    this.estilo.textContent = CSS;
    document.head.appendChild(this.estilo);

    this.root = document.createElement('div');
    this.root.id = 'cutscene-janeiro';
    const topo = document.createElement('div');
    topo.className = 'cj-barra cj-topo';
    const fundo = document.createElement('div');
    fundo.className = 'cj-barra cj-fundo';
    this.legenda = document.createElement('div');
    this.legenda.className = 'cj-legenda';
    this.legenda.textContent = ABERTURA_DA_MISSAO;
    const pular = document.createElement('div');
    pular.className = 'cj-pular';
    pular.textContent = '[ clique ou ESC para pular ]';
    this.root.append(topo, fundo, this.legenda, pular);
    document.body.appendChild(this.root);

    // O mesmo clique que abriu a missão não pode pular a cutscene (PULAR_APOS_MS); captura antes do jogo tratar o clique (mira, tiro).
    this.aoPular = (): void => {
      if (this.diretor.overridesRig && performance.now() - this.ligadaEm > PULAR_APOS_MS) this.diretor.pular();
    };
    window.addEventListener('pointerdown', this.aoPular, true);
    window.addEventListener('keydown', this.aoPular, true);
  }

  get overridesRig(): boolean {
    return this.diretor.overridesRig;
  }

  get done(): boolean {
    return this.diretor.done;
  }

  /** Para o script de captura saber quando parar de gravar (`window.__cutscene.done`). */
  get progress(): number {
    return this.diretor.progress;
  }

  start(): void {
    this.elapsed = 0;
    this.ligadaEm = performance.now();
    this.diretor.start();
    this.root.classList.add('cj-ativa');
    // Sinal simples para `scripts/cutscene.mjs` (Playwright) saber quando parar de gravar, sem depender de timing de frame.
    (window as unknown as Record<string, unknown>).__cutsceneTerminou = false;
  }

  update(dt: number): void {
    this.diretor.update(dt);
    this.elapsed += dt;
    const duracao = 24; // igual ao `t` do último quadro-chave de `trajetoriaDaAbertura`
    const fimDaLegenda = LEGENDA_ATE_S >= 0 ? LEGENDA_ATE_S : duracao + LEGENDA_ATE_S;
    const visivel = this.elapsed >= LEGENDA_DE_S && this.elapsed <= fimDaLegenda;
    this.legenda.classList.toggle('cj-visivel', visivel);
    if (this.diretor.done) {
      this.root.classList.remove('cj-ativa');
      (window as unknown as Record<string, unknown>).__cutsceneTerminou = true;
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.aoPular, true);
    window.removeEventListener('keydown', this.aoPular, true);
    this.root.remove();
    this.estilo.remove();
  }
}
