import * as THREE from 'three';
import { serverHttpUrl } from '../../../shared/net/serverUrl';
import { lerConfigDeTelao, TELAO_PATH, TELOES_DA_ARENA, type ConfigDeTelao, type IdDeTelao } from '../../../shared/telao';
import { ARENA_TELAO_1, ARENA_TELAO_2 } from './ArenaLayout';

const ESPERA_MS = 4000;
/** Alcance em que o vídeo toca (m); além disso, pausa (G12: poupa decodificação — custo comparável a qualquer vídeo aberto, nunca a uma segunda câmera). */
export const ALCANCE_DO_TELAO = 70;
/** De quanto em quanto tempo decide tocar/pausar (s): não é por quadro (mesmo espírito do `k % N` de `fx/FireRingVisuals.ts`). */
const INTERVALO_DE_OBSERVACAO = 0.5;
/** A partir deste degrau de `Quality` (G12), os telões nunca decodificam vídeo: ficam na tela escura ("sem sinal"). */
export const TIER_SEM_VIDEO = 2;
/** Sem `canplay` em tanto tempo (ms), desiste e volta a "sem sinal": nunca fica esperando para sempre (o `npm run smoke` roda em SwiftShader, sem decodificar vídeo de verdade). */
const ESPERA_DO_VIDEO_MS = 4000;
/** A cor da tela sem sinal (mesmo espírito do "apagado" do `ArenaQuadro`/`BankSign`: escura, não preta — lê-se como painel desligado, não como buraco). */
const COR_SEM_SINAL = 0x0c1a14;

const LAYOUT: Readonly<Record<IdDeTelao, { x: number; y: number; z: number; ry: number; w: number; h: number }>> = {
  'arena:telao-1': ARENA_TELAO_1,
  'arena:telao-2': ARENA_TELAO_2,
};

/** A decisão pura de tocar ou não (testável sem THREE nem DOM): perto o bastante e a qualidade não caiu tanto a ponto de cortar vídeo. */
export function deveTocar(distancia: number, tier: number): boolean {
  return tier < TIER_SEM_VIDEO && distancia < ALCANCE_DO_TELAO;
}

interface Tela {
  readonly id: IdDeTelao;
  readonly material: THREE.MeshBasicMaterial;
  readonly posicao: THREE.Vector3;
  video: HTMLVideoElement | null;
  textura: THREE.VideoTexture | null;
  arquivo: string | null;
  tocando: boolean;
  esperaDoVideo: ReturnType<typeof setTimeout> | null;
}

/**
 * OS TELÕES DIEGÉTICOS DA CIDADE NEON (P246): dois painéis de vídeo encostados em fachadas (`ArenaLayout.ts`), tocando o arquivo que o Comandante escolheu no painel de admin
 * (`ui/TelaoPanel.ts` → `POST /admin/telao`). Sem vídeo atribuído, a tela fica escura ("sem sinal") — nunca pública, nunca mostra nada até ele escolher um vídeo.
 *
 * **Custo (G12):** só decodifica vídeo quem está perto e visível (`atualizar`, a cada 0,5 s, nunca por quadro) e nunca a partir do tier 2 de `Quality` (quando o bloom já caiu). Não é uma segunda
 * câmera nem um `RenderTarget`: é um `<video>` comum lido por `THREE.VideoTexture`, o mesmo custo de qualquer vídeo aberto no navegador. Módulo independente (G3); só existe na Cidade Neon
 * (`Arena.ts` só o constrói no ramo que já é exclusivo dela).
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
    return { id, material, posicao: new THREE.Vector3(p.x, p.y, p.z), video: null, textura: null, arquivo: null, tocando: false, esperaDoVideo: null };
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
      if (item) this.ligar(t, item.arquivo);
      else this.desligar(t);
    }
  }

  private ligar(t: Tela, arquivo: string): void {
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

  private desligar(t: Tela): void {
    if (t.esperaDoVideo) clearTimeout(t.esperaDoVideo);
    t.esperaDoVideo = null;
    t.video?.pause();
    t.video?.removeAttribute('src');
    t.video = null;
    t.textura?.dispose();
    t.textura = null;
    t.arquivo = null;
    t.tocando = false;
    t.material.map = null;
    t.material.color.set(COR_SEM_SINAL);
    t.material.needsUpdate = true;
  }

  /** Por quadro: decide tocar/pausar cada tela pela distância da câmera e pelo degrau de qualidade (G12). A decisão em si é a cada 0,5 s, não por quadro. */
  atualizar(dt: number, cameraPos: THREE.Vector3, tier: number): void {
    this.relogioDeObservacao += dt;
    if (this.relogioDeObservacao < INTERVALO_DE_OBSERVACAO) return;
    this.relogioDeObservacao = 0;
    for (const t of this.telas) {
      if (!t.video) continue;
      const perto = deveTocar(cameraPos.distanceTo(t.posicao), tier);
      if (perto && !t.tocando) {
        t.tocando = true;
        void t.video.play().catch(() => {
          t.tocando = false;
        });
      } else if (!perto && t.tocando) {
        t.video.pause();
        t.tocando = false;
      }
    }
  }

  dispose(): void {
    for (const t of this.telas) this.desligar(t);
  }
}
