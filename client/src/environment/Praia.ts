import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { mulberry32 } from '../core/rng';
import { faseDoDia } from './CicloDoDia';
import { COR_DA_NEVOA, DIRECAO_DA_LUA, DIRECAO_DO_SOL, PraiaCeu } from './PraiaCeu';
import { criarChao } from './PraiaChao';
import { praiaAderecos } from './PraiaAderecos';
import { montarAderecosComFaixas } from './PraiaAderecosMalha';
import { ehDestrutivel, PraiaDestrutiveis } from './PraiaDestrutiveis';
import type { Destructibles } from './Destructibles';
import { PraiaCabosFx } from './PraiaCabosFx';
import { PraiaGente } from './PraiaGente';
import { PraiaPortas } from './PraiaPortas';
import { PraiaLuzes } from './PraiaLuzes';
import { PraiaZonas } from './PraiaZonas';
import { criarUniformes } from './PraiaUniformes';
import { SOMBRA_AREA, texturaDeSombras } from './PraiaSombras';
import { praiaColisores } from './PraiaColisores';
import { PRAIA_ESTACAO, PRAIA_FAROL, praiaBlocks, type BlocoDaPraia } from './PraiaLayout';
import { COR_DO_BLOCO, E_PISO, materialDoModo, materialSemLuz, MODO_DO_BLOCO, type ModoDeMaterial } from './PraiaMateriais';
import { PraiaMar } from './PraiaMar';
import { gradeDoTerreno, PRAIA_LIMITES } from './PraiaTerreno';
import { criarGaivotas } from './PraiaVida';

/**
 * A **PRAIA DOS CABOS** (ordens P126 e P127, Fortaleza · CE): o construtor do cenário. Lê o **layout em dado** (`PraiaLayout.ts`,
 * `PraiaAderecos.ts`, `PraiaTerreno.ts`) e monta a cena e os colisores estáticos. Sem luz nova além da identidade do fim de tarde
 * (uma direcional baixa fazendo o papel de sol, a hemisférica quente e a luz fria do céu) e **sem desenho por quadro**: o que se mexe
 * (mar, nuvens, palmas, velas, gaivotas, o feixe do farol) se mexe **na GPU**, num uniforme de tempo (G4/G12).
 *
 * **A identidade visual (o pedido do Comandante):** fim de tarde — o céu do azul ao rosado com o sol sobre o mar; areia branquinha contra
 * o mar azulzinho claro; a cidade costeira de prédios baixos e hotéis; coqueiros, barracas, jangadas. O mapa é UM desenho por material:
 * os blocos agrupam por tipo (11 desenhos) e os adereços viram malhas estáticas fundidas por material (`PraiaAderecosMalha.ts`, 6 desenhos).
 * O que é de acabamento entra por módulo próprio, ligado aqui (G3): a sombra assada (`PraiaSombras.ts`, lida pelo chão e pelos materiais),
 * a luz desenhada (`PraiaLuzes.ts`: halos, poças, feixes e holofotes), o chão das zonas de cura e resfriamento (`PraiaZonas.ts`) e a gente
 * e as pipas (`PraiaGente.ts`, evacuadas na missão). Veja `PraiaLayout.ts` para o desenho do mapa (a praia ao longo dos 640 m, o porto a
 * oeste, a Ponte Metálica no meio, a estação a leste).
 */

/** A densidade da névoa: o fim do mapa (a 600 m) some quase todo, e o horizonte do mar encontra o céu. */
const DENSIDADE_DA_NEVOA = 0.0024;

/**
 * As cores e intensidades do ciclo do dia (P161), do pôr do sol (começo da partida) à noite fechada. O céu **mais baixo** que antes de propósito: o Comandante achou o
 * cenário claro demais para a hora que o sol marca (16/10). Cada par é "começo" e "fim"; o `noite` de `CicloDoDia.ts` mistura os dois.
 */
const CEU_DIA = new THREE.Color(0xffbfa0);
const CEU_NOITE = new THREE.Color(0x6a82c8);
const CHAO_DIA = new THREE.Color(0x5f4a44);
const CHAO_NOITE = new THREE.Color(0x1b2238);
const SOL_ALTO = new THREE.Color(0xff7a40);
const SOL_BAIXO = new THREE.Color(0xff4a1c);
/** A névoa passa por um crepúsculo roxo no meio do caminho (a cor do horizonte do céu da noite é a mesma). */
const NEVOA_CREPUSCULO = new THREE.Color(0x5b3b66);
const NEVOA_NOITE = new THREE.Color(0x0a1226);
const HEMISFERICA_DIA = 0.34;
const HEMISFERICA_NOITE = 0.2;
const SOL_INTENSIDADE = 1.1;
const LUA_INTENSIDADE_DIA = 0.22;
const LUA_INTENSIDADE_NOITE = 0.5;
/** A luz de ambiente (o reflexo neutro que o `Game` põe na cena, 0,25): de noite cai a um terço, senão a areia vira neve sob a lua. */
const AMBIENTE_DIA = 0.25;
const AMBIENTE_NOITE = 0.08;
/** A luz do sol fica um palmo acima do disco: com a luz rente ao horizonte as faces de cima ficariam sem sol direto e o mapa viraria silhueta. */
const LUZ_ACIMA_DO_DISCO = 0.1;

/** O azimute do sol e da lua (o que **não** muda no ciclo: só a altura muda, e é por isso que as sombras assadas no chão continuam valendo). */
const HORIZONTAL_DO_SOL = new THREE.Vector2(DIRECAO_DO_SOL.x, DIRECAO_DO_SOL.z).normalize();
const HORIZONTAL_DA_LUA = new THREE.Vector2(DIRECAO_DA_LUA.x, DIRECAO_DA_LUA.z).normalize();

/** Escreve em `saida` o vetor unitário de azimute `horizontal` e altura `y` (sem alocar). */
function direcaoComAltura(horizontal: THREE.Vector2, y: number, saida: THREE.Vector3): THREE.Vector3 {
  const k = Math.sqrt(Math.max(0, 1 - y * y));
  return saida.set(horizontal.x * k, y, horizontal.y * k);
}

const _corDaNevoaDia = new THREE.Color(COR_DA_NEVOA);
const _ajusteDaLua = new THREE.Vector3(30, 70, 120);
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
  /**
   * Os uniformes que a praia inteira divide (`PraiaUniformes.ts`): o **tempo** (a única coisa que muda por quadro: o mar, as nuvens, as palmas, as
   * velas, as gaivotas e o feixe do farol leem dele), o **detalhe** (qualidade baixa, G12), a vida do **núcleo** da estação e a **sombra** assada.
   */
  private readonly u = criarUniformes();
  private feixeDoFarol: THREE.Object3D | null = null;
  /** As três luzes da cena (a luz do céu, a do sol e a fria da lua) e a névoa: o ciclo do dia muda a cor e a intensidade delas (`setProgressoDoDia`). */
  private readonly luzDoCeu = new THREE.HemisphereLight(CEU_DIA, CHAO_DIA, HEMISFERICA_DIA);
  private readonly luzDoSol = new THREE.DirectionalLight(SOL_ALTO, SOL_INTENSIDADE);
  private readonly luzDaLua = new THREE.DirectionalLight(0xa4bfff, LUA_INTENSIDADE_DIA);
  private readonly nevoaDaCena: THREE.FogExp2;
  private readonly cena: THREE.Scene;
  /** O progresso (0 a 1) que a cena mostra agora; `-1` = nunca aplicado. */
  private progressoDoDia = -1;
  /** Os letreiros de dados dos cabos (P162); `null` sem DOM (servidor, testes). */
  private readonly cabosFx: PraiaCabosFx | null;
  /** O que a missão diz dos três cabos (estado 0 a 3 e injeção 0 a 1), reaproveitado a cada quadro (G4). */
  private readonly cabosEstado = [0, 0, 0];
  private readonly cabosInjecao = [0, 0, 0];
  /** As duas portas do prédio da estação (P163): o desenho e o estado (0 fechada, 1 forçada, 2 arrombada) e a vida de cada uma. */
  private readonly portasVisual: PraiaPortas;
  private readonly portasEstado = [0, 0];
  private readonly portasVida = [1, 1];
  private readonly vetor = new THREE.Vector3();
  /** Os brilhos desenhados: halos, poças de luz, feixes e os holofotes que giram (`PraiaLuzes.ts`). */
  private readonly brilhos: PraiaLuzes;
  /** O chão das quatro zonas de cura e de resfriamento (`PraiaZonas.ts`). */
  private readonly zonas: PraiaZonas;
  /** Quem passeia, pedala, nada e solta pipa na orla (`PraiaGente.ts`); evacuada na missão em ondas. */
  private readonly gente: PraiaGente;

  /** Os coqueiros e os adereços pequenos que se quebram a tiro (P138); `null` sem `Destructibles` (a bancada, os testes de cenário). */
  readonly destrutiveis: PraiaDestrutiveis | null;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, destructibles?: Destructibles) {
    this.cena = scene;
    this.nevoaDaCena = new THREE.FogExp2(COR_DA_NEVOA, DENSIDADE_DA_NEVOA);
    scene.fog = this.nevoaDaCena;
    scene.add(this.luzDoCeu, this.luzDoSol, this.luzDaLua);
    // A sombra do sol assada no chão (uma vez por processo): o terreno e os pisos leem a mesma textura.
    this.u.sombra.value = texturaDeSombras();
    this.u.sombraArea.value.set(SOMBRA_AREA.minX, SOMBRA_AREA.minZ, 1 / SOMBRA_AREA.tamX, 1 / SOMBRA_AREA.tamZ);
    new PraiaCeu(scene, this.u);
    new PraiaMar(scene, this.u);
    criarChao(scene, this.u);
    this.fisica(physics);
    this.blocos(scene);
    const aderecos = praiaAderecos();
    const montados = montarAderecosComFaixas(scene, this.u, aderecos, destructibles ? ehDestrutivel : undefined);
    this.destrutiveis = destructibles ? new PraiaDestrutiveis(destructibles, aderecos, montados.faixas) : null;
    this.brilhos = new PraiaLuzes(scene, this.u, aderecos);
    this.zonas = new PraiaZonas(scene, this.u);
    this.gente = new PraiaGente(scene, this.u.tempo);
    this.cabosFx = PraiaCabosFx.criar(scene);
    this.portasVisual = new PraiaPortas(scene);
    this.horizonte(scene);
    this.feixes(scene);
    criarGaivotas(scene, this.u.tempo);
    this.setProgressoDoDia(0); // o começo da partida: o pôr do sol, a cidade ainda de dia
  }

  /** Por quadro: só o tempo (um número) e o giro do feixe do farol. Chamado pelo `Arena.update`. */
  update(elapsed: number): void {
    this.u.tempo.value = elapsed;
    if (this.feixeDoFarol) this.feixeDoFarol.rotation.y = elapsed * 0.55;
    this.brilhos.update(elapsed);
    this.cabosFx?.atualiza(elapsed, this.cabosEstado, this.cabosInjecao);
    this.portasVisual.atualiza(elapsed, this.portasEstado, this.portasVida);
  }

  /** As duas portas do prédio (P163, `PortasDaEstacao`): por porta, o estado (0 fechada, 1 forçada, 2 arrombada) e a vida (0 a 1). Sem alocar. */
  setPortas(estado: ArrayLike<number>, vida: ArrayLike<number>): void {
    for (let i = 0; i < 2; i++) {
      this.portasEstado[i] = estado[i] ?? 0;
      this.portasVida[i] = vida[i] ?? 1;
    }
  }

  /**
   * Os três cabos de dados (P162, `CabosDeDados`): por cabo, o estado (0 livre, 1 injetando, 2 tomado, 3 cortado), a vida e a injeção (0 a 1). O brilho do cabo (shader)
   * e o letreiro de dados leem daqui. Sem alocar.
   */
  setCabos(estado: ArrayLike<number>, vida: ArrayLike<number>, injecao: ArrayLike<number>): void {
    for (let i = 0; i < 3; i++) {
      this.cabosEstado[i] = estado[i] ?? 0;
      this.cabosInjecao[i] = injecao[i] ?? 0;
    }
    this.u.cabosInj.value.set(this.cabosInjecao[0]!, this.cabosInjecao[1]!, this.cabosInjecao[2]!);
    this.u.cabosVida.value.set(vida[0] ?? 1, vida[1] ?? 1, vida[2] ?? 1);
  }

  /** O núcleo da estação mudou (0 a 1): o centro de dados apaga as janelas e o alarme vira vermelho conforme a rede cai. */
  setNucleo(fracao: number): void {
    this.u.nucleo.value = Math.max(0, Math.min(1, fracao));
  }

  /** `false`: a orla está evacuada (a missão em ondas da estação): ninguém passeia, pedala ou nada, e o céu fica sem pipa. */
  setCivis(visivel: boolean): void {
    this.gente.setCivis(visivel);
  }

  /** Liga ou desliga o detalhe caro do céu e do mar (as nuvens e o ruído da água): a qualidade baixa e o rebaixamento automático desligam. */
  setDetalhe(alto: boolean): void {
    this.u.detalhe.value = alto ? 1 : 0;
    this.brilhos.setDetalhe(alto);
    this.zonas.setDetalhe(alto);
  }

  /**
   * O ciclo do dia (P161): `progresso` de 0 (o pôr do sol, a cidade ainda de dia) a 1 (a noite fechada, as luzes acesas), calculado do relógio da partida por quem
   * chama (`Game.ts`). Muda a altura do sol e da lua, as três luzes, a névoa e os uniformes que o céu, o mar, as fachadas e as lâmpadas desenhadas leem. Sem alocar;
   * valor igual ao já aplicado não faz nada (tempo parado, pausa, intervalo entre rodadas).
   */
  setProgressoDoDia(progresso: number): void {
    const p = Math.min(1, Math.max(0, Number.isFinite(progresso) ? progresso : 0));
    if (Math.abs(p - this.progressoDoDia) < 0.0002) return;
    this.progressoDoDia = p;
    const f = faseDoDia(p);
    const u = this.u;
    direcaoComAltura(HORIZONTAL_DO_SOL, f.solAltura, u.solDir.value);
    direcaoComAltura(HORIZONTAL_DA_LUA, f.luaAltura, u.luaDir.value);
    u.noite.value = f.noite;
    u.lampadas.value = f.lampadas;
    // A névoa e o horizonte do céu são a mesma cor: do rosa do pôr do sol ao roxo do crepúsculo e ao azul-noite.
    if (f.noite < 0.5) u.nevoa.value.lerpColors(_corDaNevoaDia, NEVOA_CREPUSCULO, f.noite * 2);
    else u.nevoa.value.lerpColors(NEVOA_CREPUSCULO, NEVOA_NOITE, (f.noite - 0.5) * 2);
    this.nevoaDaCena.color.copy(u.nevoa.value);
    // A luz do céu fica azul e um pouco mais baixa; o sol esmaece e avermelha até sumir; a lua sobe de intensidade.
    this.luzDoCeu.color.lerpColors(CEU_DIA, CEU_NOITE, f.noite);
    this.luzDoCeu.groundColor.lerpColors(CHAO_DIA, CHAO_NOITE, f.noite);
    this.luzDoCeu.intensity = HEMISFERICA_DIA + (HEMISFERICA_NOITE - HEMISFERICA_DIA) * f.noite;
    this.luzDoSol.color.lerpColors(SOL_ALTO, SOL_BAIXO, f.noite);
    this.luzDoSol.intensity = SOL_INTENSIDADE * f.luzDoSol;
    this.luzDoSol.position.copy(direcaoComAltura(HORIZONTAL_DO_SOL, f.solAltura + LUZ_ACIMA_DO_DISCO, this.vetor)).multiplyScalar(220);
    this.cena.environmentIntensity = AMBIENTE_DIA + (AMBIENTE_NOITE - AMBIENTE_DIA) * f.noite;
    this.luzDaLua.intensity = LUA_INTENSIDADE_DIA + (LUA_INTENSIDADE_NOITE - LUA_INTENSIDADE_DIA) * f.noite;
    this.luzDaLua.position.copy(direcaoComAltura(HORIZONTAL_DA_LUA, f.luaAltura, this.vetor)).multiplyScalar(220).add(_ajusteDaLua);
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
      const material = semLuz ? materialSemLuz(chave as 'marca' | 'luz' | 'cabo', this.u) : materialDoModo(chave as ModoDeMaterial, this.u, lista.some((b) => E_PISO.has(b.kind)));
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
    const malha = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materialDoModo('predio', this.u, false), lista.length);
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
        uniforms: { uTempo: this.u.tempo, uNucleo: this.u.nucleo },
        vertexShader: 'varying float vAlt; void main(){ vAlt = position.y / 150.0 + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        // A coluna é ciano com a rede inteira e vira vermelha (e mais forte, como alarme) quando o núcleo cai.
        fragmentShader: 'varying float vAlt; uniform float uTempo; uniform float uNucleo; void main(){ float a = pow(clamp(1.0 - vAlt, 0.0, 1.0), 1.6) * (0.5 + 0.08 * sin(uTempo * 2.0) + (1.0 - uNucleo) * 0.25); vec3 c = mix(vec3(1.5, 0.2, 0.15), vec3(0.4, 1.5, 1.5), smoothstep(0.25, 0.65, uNucleo)); gl_FragColor = vec4(c, a); }',
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
        uniforms: { uLampadas: this.u.lampadas },
        vertexShader: 'varying float vD; void main(){ vD = position.x / 150.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        // O farol só acende com as lâmpadas da cidade (P161): de dia o leque nem aparece.
        fragmentShader: 'varying float vD; uniform float uLampadas; void main(){ float a = (1.0 - vD) * 0.09 * smoothstep(0.35, 0.8, uLampadas); gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * 1.6, a); }',
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
