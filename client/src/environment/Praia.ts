import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { mulberry32 } from '../core/rng';
import { COR_DA_NEVOA, DIRECAO_DO_SOL, PraiaCeu } from './PraiaCeu';
import { criarChao } from './PraiaChao';
import { praiaAderecos, type Adereco, type TipoDeAdereco } from './PraiaAderecos';
import { praiaColisores } from './PraiaColisores';
import { camadasDoTipo } from './PraiaGeometrias';
import { PRAIA_ESTACAO, PRAIA_FAROL, praiaBlocks, type BlocoDaPraia } from './PraiaLayout';
import { COR_DO_BLOCO, E_PISO, materialDoModo, materialSemLuz, MODO_DO_BLOCO, type ModoDeMaterial } from './PraiaMateriais';
import { PraiaMar } from './PraiaMar';
import { gradeDoTerreno, NIVEL_DO_MAR, PRAIA_LIMITES } from './PraiaTerreno';
import { criarGaivotas, materialDaCamada } from './PraiaVida';

/**
 * A **PRAIA DOS CABOS** (ordens P126 e P127, Fortaleza · CE): o construtor do cenário. Lê o **layout em dado** (`PraiaLayout.ts`,
 * `PraiaAderecos.ts`, `PraiaTerreno.ts`) e monta a cena e os colisores estáticos. Sem luz nova além da identidade do fim de tarde
 * (uma direcional baixa fazendo o papel de sol, a hemisférica quente e a luz fria do céu) e **sem desenho por quadro**: o que se mexe
 * (mar, nuvens, palmas, velas, gaivotas, o feixe do farol) se mexe **na GPU**, num uniforme de tempo (G4/G12).
 *
 * **A identidade visual (o pedido do Comandante):** fim de tarde — o céu do azul ao rosado com o sol sobre o mar; areia branquinha contra
 * o mar azulzinho claro; a cidade costeira de prédios baixos e hotéis; coqueiros, barracas, jangadas. O mapa é UM desenho por material:
 * os blocos agrupam por tipo (11 desenhos) e cada adereço é uma malha instanciada (uma por camada). Veja `PraiaLayout.ts` para o desenho
 * do mapa (a praia ao longo dos 640 m, o porto a oeste, a Ponte Metálica no meio, a estação a leste).
 */

/** A densidade da névoa: o fim do mapa (a 600 m) some quase todo, e o horizonte do mar encontra o céu. */
const DENSIDADE_DA_NEVOA = 0.0024;

const _pos = new THREE.Vector3();
const _esc = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _qx = new THREE.Quaternion();
const _qz = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const EIXO_X = new THREE.Vector3(1, 0, 0);
const EIXO_Y = new THREE.Vector3(0, 1, 0);
const EIXO_Z = new THREE.Vector3(0, 0, 1);

export class Praia {
  /** O uniforme de tempo (a única coisa que muda por quadro): mar, nuvens, palmas, velas, gaivotas e o feixe do farol leem dele. */
  private readonly tempo = { value: 0 };
  private feixeDoFarol: THREE.Object3D | null = null;
  /** 1 = céu e mar com todo o detalhe (nuvens, ruído da água); 0 = qualidade baixa: só o degradê e as ondas (G12). */
  private readonly detalhe = { value: 1 };

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    scene.fog = new THREE.FogExp2(COR_DA_NEVOA, DENSIDADE_DA_NEVOA);
    this.luzes(scene);
    new PraiaCeu(scene, this.tempo, this.detalhe);
    new PraiaMar(scene, this.tempo, this.detalhe);
    criarChao(scene);
    this.fisica(physics);
    this.blocos(scene);
    this.aderecos(scene);
    this.horizonte(scene);
    this.feixes(scene);
    criarGaivotas(scene, this.tempo);
  }

  /** Por quadro: só o tempo (um número) e o giro do feixe do farol. Chamado pelo `Arena.update`. */
  update(elapsed: number): void {
    this.tempo.value = elapsed;
    if (this.feixeDoFarol) this.feixeDoFarol.rotation.y = elapsed * 0.55;
  }

  /** Liga ou desliga o detalhe caro do céu e do mar (as nuvens e o ruído da água): a qualidade baixa e o rebaixamento automático desligam. */
  setDetalhe(alto: boolean): void {
    this.detalhe.value = alto ? 1 : 0;
  }

  /** As luzes do fim de tarde: o céu quente, o sol baixo sobre o mar e a luz fria que vem de dentro (do lado oposto ao sol). */
  private luzes(scene: THREE.Scene): void {
    scene.add(new THREE.HemisphereLight(0xffe4cc, 0xb99a70, 0.8));
    const sol = new THREE.DirectionalLight(0xffb878, 1.9);
    sol.position.copy(DIRECAO_DO_SOL).multiplyScalar(220);
    scene.add(sol);
    const frio = new THREE.DirectionalLight(0x9db8e8, 0.5);
    frio.position.set(70, 60, 120);
    scene.add(frio);
  }

  /** A física: o chão (UM colisor de altura), as paredes do mapa e as caixas sólidas (`praiaColisores`). */
  private fisica(physics: PhysicsWorld): void {
    const { minX, maxX, minZ, maxZ } = PRAIA_LIMITES;
    const g = gradeDoTerreno(minX, maxX, minZ, maxZ);
    physics.addStaticHeightfield(g.celulasX, g.celulasZ, g.alturas, { x: maxX - minX, z: maxZ - minZ }, { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 });
    for (const c of praiaColisores()) {
      _qy.setFromAxisAngle(EIXO_Y, c.giro ?? 0);
      _qx.setFromAxisAngle(EIXO_X, c.rx ?? 0);
      _qz.setFromAxisAngle(EIXO_Z, c.rz ?? 0);
      _quat.copy(_qy).multiply(_qz).multiply(_qx);
      const gira = !!(c.giro || c.rx || c.rz);
      physics.addStaticBox(new THREE.Vector3(c.x, c.y, c.z), new THREE.Vector3(c.w, c.h, c.d), gira ? _quat.clone() : undefined);
    }
    // As paredes do mapa: o limite de 640 × 240 m (o jogador não cai fora dele).
    const t = 3;
    const h = 90;
    const comp = maxX - minX;
    const larg = maxZ - minZ;
    for (const [x, z, w, d] of [
      [0, minZ - t / 2, comp + t * 2, t],
      [0, maxZ + t / 2, comp + t * 2, t],
      [minX - t / 2, 0, t, larg],
      [maxX + t / 2, 0, t, larg],
    ] as const) physics.addStaticBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
  }

  /** Os blocos do layout: um `InstancedMesh` por material (cada tipo com o desenho certo no shader). */
  private blocos(scene: THREE.Scene): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const grupos = new Map<string, BlocoDaPraia[]>();
    for (const b of praiaBlocks()) {
      const chave = b.kind === 'marca' || b.kind === 'luz' || b.kind === 'cabo' ? b.kind : MODO_DO_BLOCO[b.kind];
      const lista = grupos.get(chave) ?? [];
      lista.push(b);
      grupos.set(chave, lista);
    }
    for (const [chave, lista] of grupos) {
      const semLuz = chave === 'marca' || chave === 'luz' || chave === 'cabo';
      const material = semLuz ? materialSemLuz(chave as 'marca' | 'luz' | 'cabo', this.tempo) : materialDoModo(chave as ModoDeMaterial, this.tempo, lista.some((b) => E_PISO.has(b.kind)));
      const malha = new THREE.InstancedMesh(geo, material, lista.length);
      lista.forEach((b, i) => {
        _pos.set(b.x, b.y, b.z);
        _esc.set(b.w, b.h, b.d);
        _qx.setFromAxisAngle(EIXO_X, b.rx ?? 0);
        _qz.setFromAxisAngle(EIXO_Z, b.rz ?? 0);
        _quat.copy(_qz).multiply(_qx);
        malha.setMatrixAt(i, _mat.compose(_pos, _quat, _esc));
        const cor = new THREE.Color(b.cor ?? COR_DO_BLOCO[b.kind]);
        if (b.kind === 'luz') cor.multiplyScalar(b.brilho ?? 3);
        malha.setColorAt(i, cor);
      });
      malha.computeBoundingSphere();
      scene.add(malha);
    }
  }

  /** Os adereços: cada tipo vira um `InstancedMesh` por camada (a mesma geometria para todas as instâncias). */
  private aderecos(scene: THREE.Scene): void {
    const porTipo = new Map<TipoDeAdereco, Adereco[]>();
    for (const a of praiaAderecos()) {
      const lista = porTipo.get(a.tipo) ?? [];
      lista.push(a);
      porTipo.set(a.tipo, lista);
    }
    const sobreAAgua = new Set<TipoDeAdereco>(['boia', 'barco']);
    for (const [tipo, lista] of porTipo) {
      for (const camada of camadasDoTipo(tipo)) {
        const material = materialDaCamada(camada.material, this.tempo, camada.material === 'brilho' && (tipo === 'antena' || tipo === 'boia'));
        const malha = new THREE.InstancedMesh(camada.geo, material, lista.length);
        lista.forEach((a, i) => {
          _pos.set(a.x, (a.y ?? 0) + (sobreAAgua.has(a.tipo) ? NIVEL_DO_MAR : 0), a.z);
          const e = a.escala ?? 1;
          _quat.setFromAxisAngle(EIXO_Y, a.giro);
          malha.setMatrixAt(i, _mat.compose(_pos, _quat, _esc.set(e, e, e)));
          if (camada.tinta) malha.setColorAt(i, new THREE.Color(a.cor ?? 0xffffff));
        });
        malha.computeBoundingSphere();
        scene.add(malha);
      }
    }
  }

  /** O horizonte da cidade: torres longe, atrás da cidade e nas pontas da orla (só desenho, na névoa). */
  private horizonte(scene: THREE.Scene): void {
    const rand = mulberry32(4417);
    const lista: { x: number; z: number; w: number; d: number; h: number; cor: number }[] = [];
    const pasteis = [0xf2e6d0, 0xe8cfa6, 0xdde6ea, 0xf4d8c6, 0xeadfc8, 0xcfdccf];
    for (let i = 0; i < 70; i++) {
      lista.push({ x: -440 + rand() * 880, z: 140 + rand() * 150, w: 18 + rand() * 24, d: 18 + rand() * 22, h: 36 + rand() * 90, cor: pasteis[Math.floor(rand() * pasteis.length)]! });
    }
    // A orla segue além das pontas do mapa (leste e oeste): os hotéis continuam, em fila.
    for (let i = 0; i < 12; i++) {
      for (const lado of [-1, 1]) lista.push({ x: lado * (350 + rand() * 90), z: 50 + rand() * 110, w: 22 + rand() * 14, d: 22 + rand() * 14, h: 26 + rand() * 60, cor: pasteis[Math.floor(rand() * pasteis.length)]! });
    }
    const malha = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materialDoModo('predio', this.tempo, false), lista.length);
    lista.forEach((b, i) => {
      malha.setMatrixAt(i, _mat.compose(_pos.set(b.x, b.h / 2, b.z), _quat.identity(), _esc.set(b.w, b.h, b.d)));
      malha.setColorAt(i, new THREE.Color(b.cor));
    });
    malha.computeBoundingSphere();
    scene.add(malha);
  }

  /**
   * Os dois feixes de luz: o **da estação** (uma coluna ciano que sobe do prédio e marca o objetivo de qualquer ponto da orla, no
   * vocabulário neon do jogo) e o **do farol** (um leque quente que gira). Aditivos, sem escrever profundidade: dois desenhos.
   */
  private feixes(scene: THREE.Scene): void {
    const coluna = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 4.2, 150, 16, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uTempo: this.tempo },
        vertexShader: 'varying float vAlt; void main(){ vAlt = position.y / 150.0 + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying float vAlt; uniform float uTempo; void main(){ float a = pow(1.0 - vAlt, 1.6) * (0.5 + 0.08 * sin(uTempo * 2.0)) ; gl_FragColor = vec4(vec3(0.25, 1.0, 1.0) * 1.5, a); }',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    coluna.position.set(PRAIA_ESTACAO.x, 16.4 + 75, PRAIA_ESTACAO.z);
    coluna.frustumCulled = false;
    scene.add(coluna);

    // O feixe do farol: um cone deitado (a ponta no lampião, abrindo 140 m), que gira em torno do eixo da torre.
    const cone = new THREE.ConeGeometry(11, 150, 12, 1, true);
    cone.translate(0, -75, 0); // a ponta na origem
    cone.rotateZ(Math.PI / 2); // deitado, abrindo para +x
    const feixe = new THREE.Mesh(
      cone,
      new THREE.ShaderMaterial({
        vertexShader: 'varying float vD; void main(){ vD = position.x / 150.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying float vD; void main(){ float a = (1.0 - vD) * 0.22; gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * 1.6, a); }',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    feixe.frustumCulled = false;
    const raiz = new THREE.Group();
    raiz.position.set(PRAIA_FAROL.x, 36, PRAIA_FAROL.z);
    raiz.add(feixe);
    scene.add(raiz);
    this.feixeDoFarol = raiz;
  }
}
