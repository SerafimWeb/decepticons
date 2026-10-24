import * as THREE from 'three';
import { serverHttpUrl } from '../../../shared/net/serverUrl';
import { lerConfigDeTelao, TELAO_PATH, TELOES_DA_ARENA, type ConfigDeTelao, type IdDeTelao } from '../../../shared/telao';
import { ARENA_TELAO_1, ARENA_TELAO_2 } from './ArenaLayout';

const ESPERA_MS = 4000;
/** Alcance em que a tela atualiza (m); além disso, pausa/para de redesenhar (G12: poupa decodificação de vídeo ou, no modo câmera, uma segunda renderização da cena). */
export const ALCANCE_DO_TELAO = 70;
/** De quanto em quanto tempo decide tocar/pausar ou redesenhar (s): não é por quadro (mesmo espírito do `k % N` de `fx/FireRingVisuals.ts`). No modo câmera, isto também é a taxa de atualização da imagem (~2 Hz: uma tela de fundo não precisa de 60 Hz para ler como "ao vivo"). */
const INTERVALO_DE_OBSERVACAO = 0.5;
/** A partir deste degrau de `Quality` (G12), os telões nunca decodificam vídeo nem redesenham a câmera: ficam na tela escura ("sem sinal"). */
export const TIER_SEM_VIDEO = 2;
/** Sem `canplay` em tanto tempo (ms), desiste e volta a "sem sinal": nunca fica esperando para sempre (o `npm run smoke` roda em SwiftShader, sem decodificar vídeo de verdade). */
const ESPERA_DO_VIDEO_MS = 4000;
/** A cor da tela sem sinal (mesmo espírito do "apagado" do `ArenaQuadro`/`BankSign`: escura, não preta — lê-se como painel desligado, não como buraco). */
const COR_SEM_SINAL = 0x0c1a14;
/** A altura do alvo de render da câmera ao vivo (px): baixa de propósito (G12) — é uma tela de fundo, não o jogo principal. A largura acompanha a proporção da tela. */
const ALTURA_DO_ALVO_DA_CAMERA = 180;

const LAYOUT: Readonly<Record<IdDeTelao, { x: number; y: number; z: number; ry: number; w: number; h: number }>> = {
  'arena:telao-1': ARENA_TELAO_1,
  'arena:telao-2': ARENA_TELAO_2,
};

/** A decisão pura de atualizar ou não (testável sem THREE nem DOM): perto o bastante e a qualidade não caiu tanto a ponto de cortar vídeo/câmera. */
export function deveAtualizarTela(distancia: number, tier: number): boolean {
  return tier < TIER_SEM_VIDEO && distancia < ALCANCE_DO_TELAO;
}

interface Tela {
  readonly id: IdDeTelao;
  readonly material: THREE.MeshBasicMaterial;
  readonly posicao: THREE.Vector3;
  video: HTMLVideoElement | null;
  textura: THREE.Texture | null;
  arquivo: string | null;
  /** Modo câmera ao vivo (P254): a câmera de segurança fixa da tela e onde ela desenha. `null` fora desse modo. */
  camera: THREE.PerspectiveCamera | null;
  alvo: THREE.WebGLRenderTarget | null;
  /** Vídeo tocando, ou (modo câmera) a tela está perto o bastante para valer a pena redesenhar. */
  tocando: boolean;
  esperaDoVideo: ReturnType<typeof setTimeout> | null;
}

/**
 * OS TELÕES DIEGÉTICOS DA CIDADE NEON (P246/P254): dois painéis encostados em fachadas (`ArenaLayout.ts`), com o que o Comandante escolheu no painel de admin (`ui/TelaoPanel.ts` →
 * `POST /admin/telao`): um **vídeo** de `ARQUIVOS_DE_TELAO`, a **câmera ao vivo** da própria partida, ou nada ("sem sinal" — nunca pública até ele escolher algo).
 *
 * **Custo, os dois modos (G12):** o **vídeo** só decodifica (`THREE.VideoTexture` sobre um `<video>` comum — o mesmo custo de qualquer vídeo aberto no navegador, não escala com a partida). A
 * **câmera ao vivo** é mais cara: redesenha a cena inteira (Mechs, bots, tiros, partículas) numa segunda câmera fixa, para um `WebGLRenderTarget` pequeno (sem passar pelo `composer`, sem bloom) —
 * isso **escala com o que está acontecendo na partida**, e por isso só roda para quem está perto (`deveAtualizarTela`) e numa taxa baixa (a cada ~0,5 s, nunca por quadro), nunca a partir do tier 2
 * de `Quality`. Nenhum dos dois pesa para quem não escolheu nada no painel. Módulo independente (G3); só existe na Cidade Neon (`Arena.ts` só o constrói no ramo que já é exclusivo dela).
 */
export class ArenaTelao {
  private readonly telas: Tela[];
  private relogioDeObservacao = 0;

  constructor(scene: THREE.Scene) {
    this.telas = TELOES_DA_ARENA.map((id) => this.construirTela(scene, id));
  }

  private construirTela(scene: THREE.Scene, id: IdDeTelao): Tela {
    const p = LAYOUT[id];
    const grupo = new THREE.Group();
    grupo.position.set(p.x, p.y, p.z);
    grupo.rotation.y = p.ry;
    const fundo = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.4, p.h + 0.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.25, roughness: 0.8 }));
    const material = new THREE.MeshBasicMaterial({ color: COR_SEM_SINAL });
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), material);
    tela.position.z = 0.07;
    const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(p.w, p.h)), new THREE.LineBasicMaterial({ color: 0x3a4a44 }));
    arestas.position.z = 0.075;
    grupo.add(fundo, tela, arestas);
    scene.add(grupo);
    return { id, material, posicao: new THREE.Vector3(p.x, p.y, p.z), video: null, textura: null, arquivo: null, camera: null, alvo: null, tocando: false, esperaDoVideo: null };
  }

  /** Busca a configuração do servidor uma vez (nunca lança, nunca trava o jogo): sem rede, ou sem nada atribuído, as telas ficam sem sinal. */
  async carregar(gameServer: string | undefined | null, buscar: typeof fetch = (...a) => fetch(...a)): Promise<void> {
    const url = serverHttpUrl(gameServer, TELAO_PATH);
    if (!url) return;
    try {
      const res = await buscar(url, { cache: 'no-store', mode: 'cors', signal: AbortSignal.timeout(ESPERA_MS) });
      if (!res.ok) return;
      this.aplicar(lerConfigDeTelao(await res.json()));
    } catch {
      /* sem rede: sem sinal */
    }
  }

  private aplicar(config: ConfigDeTelao): void {
    for (const t of this.telas) {
      const item = config.itens[t.id];
      if (item?.tipo === 'video') this.ligarVideo(t, item.arquivo);
      else if (item?.tipo === 'camera') this.ligarCamera(t);
      else this.desligar(t);
    }
  }

  private ligarVideo(t: Tela, arquivo: string): void {
    if (t.arquivo === arquivo) return;
    this.desligar(t);
    const video = document.createElement('video');
    video.src = `/telao/${arquivo}`;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    t.video = video;
    t.arquivo = arquivo;
    const textura = new THREE.VideoTexture(video);
    textura.colorSpace = THREE.SRGBColorSpace;
    t.textura = textura;
    t.material.map = textura;
    t.material.color.set(0xffffff);
    t.material.needsUpdate = true;
    t.esperaDoVideo = setTimeout(() => {
      if (video.readyState < 2) this.desligar(t);
    }, ESPERA_DO_VIDEO_MS);
    video.addEventListener(
      'canplay',
      () => {
        if (t.esperaDoVideo) clearTimeout(t.esperaDoVideo);
        t.esperaDoVideo = null;
      },
      { once: true },
    );
  }

  /** A câmera de segurança da tela (P254): fixa, no lugar da tela, olhando para o meio da arena — nunca segue ninguém (zero lógica por quadro além da distância/tier já existentes). */
  private ligarCamera(t: Tela): void {
    if (t.camera) return;
    this.desligar(t);
    const p = LAYOUT[t.id];
    const camera = new THREE.PerspectiveCamera(55, p.w / p.h, 0.5, 200);
    camera.position.set(p.x, p.y, p.z);
    camera.lookAt(0, Math.max(2, p.y * 0.4), 0);
    const altura = ALTURA_DO_ALVO_DA_CAMERA;
    const largura = Math.round(altura * (p.w / p.h));
    const alvo = new THREE.WebGLRenderTarget(largura, altura, { depthBuffer: true });
    alvo.texture.colorSpace = THREE.SRGBColorSpace;
    t.camera = camera;
    t.alvo = alvo;
    t.textura = alvo.texture;
    t.material.map = alvo.texture;
    t.material.color.set(0xffffff);
    t.material.needsUpdate = true;
  }

  private desligar(t: Tela): void {
    if (t.esperaDoVideo) clearTimeout(t.esperaDoVideo);
    t.esperaDoVideo = null;
    if (t.video) {
      t.video.pause();
      t.video.removeAttribute('src');
      t.video = null;
      t.textura?.dispose();
    }
    if (t.alvo) {
      t.alvo.dispose(); // descarta o alvo e a textura dele junto (mesmo padrão de `fx/FrameCopyPass.ts`)
      t.alvo = null;
      t.camera = null;
    }
    t.textura = null;
    t.arquivo = null;
    t.tocando = false;
    t.material.map = null;
    t.material.color.set(COR_SEM_SINAL);
    t.material.needsUpdate = true;
  }

  /** A cada ~0,5 s (nunca por quadro): decide tocar/pausar vídeo, ou se a câmera daquela tela vale a pena redesenhar, pela distância da câmera principal e pelo degrau de qualidade (G12). */
  atualizar(dt: number, cameraPos: THREE.Vector3, tier: number): void {
    this.relogioDeObservacao += dt;
    if (this.relogioDeObservacao < INTERVALO_DE_OBSERVACAO) return;
    this.relogioDeObservacao = 0;
    for (const t of this.telas) {
      if (!t.video && !t.camera) continue;
      const perto = deveAtualizarTela(cameraPos.distanceTo(t.posicao), tier);
      if (t.video) {
        if (perto && !t.tocando) {
          t.tocando = true;
          void t.video.play().catch(() => {
            t.tocando = false;
          });
        } else if (!perto && t.tocando) {
          t.video.pause();
          t.tocando = false;
        }
      } else {
        t.tocando = perto;
      }
    }
  }

  /**
   * Redesenha as telas em modo câmera que estão perto (`atualizar` já decidiu `tocando`), fora do `composer` (sem bloom: mais barato). Chamar em `Game.ts` **antes** de `renderer.info.reset()` e
   * `composer.render(dt)`: o alvo de render de cada telão é o seu próprio `WebGLRenderTarget` (nunca o canvas principal), então a ordem não muda o que o jogador vê — só evita que os desenhos
   * extras entrem na contagem que o painel de depuração mostra para o quadro principal. Sem nenhuma tela em modo câmera perto, não desenha nada (early return antes de qualquer `setRenderTarget`).
   */
  renderizarCameras(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    let desenhou = false;
    for (const t of this.telas) {
      if (!t.camera || !t.alvo || !t.tocando) continue;
      renderer.setRenderTarget(t.alvo);
      renderer.render(scene, t.camera);
      desenhou = true;
    }
    if (desenhou) renderer.setRenderTarget(null);
  }

  dispose(): void {
    for (const t of this.telas) this.desligar(t);
  }
}
