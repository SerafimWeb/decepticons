import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Drone, DroneRole, DroneState } from '../combat/DroneSystem';
import type { MechBase } from '../entities/MechBase';
import type { Occluder } from '../environment/Arena';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { DEFAULT_FIXED_CAMERAS, SpectatorCam } from './SpectatorCam';

function makeMech(x = 10, z = -10, alive = true): MechBase {
  return {
    position: new THREE.Vector3(x, 0, z),
    yaw: 0,
    alive,
    stats: { height: 5.3 },
    collider: {},
  } as unknown as MechBase;
}

function makeDrone(role: DroneRole = 'patrulha', state: DroneState = 'voo', index = 0): Drone {
  return {
    role,
    index,
    state,
    pos: new THREE.Vector3(10, 40, -15),
    prev: new THREE.Vector3(10, 40, -15),
    vel: new THREE.Vector3(2, 0, -5),
    hp: 60,
    timer: 0,
    orbit: 0,
    target: null,
    servicing: false,
    diving: false,
    yaw: 0.5,
    body: null,
    collider: null,
  };
}

const CLEAR_WORLD = { raycast: () => null } as unknown as PhysicsWorld;

describe('SpectatorCam', () => {
  it('contém as câmeras fixas padrão incluindo Topo do Prédio Serafim e Porta do Banco', () => {
    const ids = DEFAULT_FIXED_CAMERAS.map((c) => c.id);
    expect(ids).toContain('serafim_topo');
    expect(ids).toContain('banco_porta');

    const serafim = DEFAULT_FIXED_CAMERAS.find((c) => c.id === 'serafim_topo')!;
    expect(serafim.position.y).toBeGreaterThan(50);
    expect(serafim.label).toContain('SERAFIM');

    const banco = DEFAULT_FIXED_CAMERAS.find((c) => c.id === 'banco_porta')!;
    expect(banco.position.x).toBeCloseTo(-28, 0);
    expect(banco.label).toContain('BANCO');
  });

  it('alterna ordenadamente entre câmeras fixas, drones e mechs vivos', () => {
    const camera = new THREE.PerspectiveCamera();
    const drones = [makeDrone('patrulha', 'voo', 0), makeDrone('kamikaze', 'abatido', 1), makeDrone('conserto', 'pouso', 2)];
    const mechs = [makeMech(15, 20, true), makeMech(-30, 40, false), makeMech(0, -25, true)];
    const spectator = new SpectatorCam(camera, CLEAR_WORLD, [], {
      getDrones: () => drones,
      getDynamicMechs: () => mechs,
      getMechName: (m) => (m === mechs[0] ? 'ROBÔ ALFA' : 'ROBÔ GAMA'),
    });

    spectator.start(0);
    expect(spectator.active).toBe(true);
    expect(spectator.overridesRig).toBe(true);

    const targets = spectator.getTargets();
    // 5 fixas + 2 drones ativos (o abatido é ignorado) + 2 mechs vivos (o morto é ignorado) = 9
    expect(targets.length).toBe(9);
    expect(spectator.currentTargetLabel).toBe(DEFAULT_FIXED_CAMERAS[0]!.label);

    // Avança pelas 5 fixas
    for (let i = 0; i < 5; i++) spectator.nextTarget();
    // Próximo é o primeiro drone ativo
    expect(spectator.currentTargetLabel).toContain('DRONE SERAFIM (PATRULHA)');

    spectator.nextTarget();
    expect(spectator.currentTargetLabel).toContain('DRONE SERAFIM (CONSERTO)');

    spectator.nextTarget();
    expect(spectator.currentTargetLabel).toBe('ROBÔ ALFA');

    spectator.prevTarget();
    expect(spectator.currentTargetLabel).toContain('DRONE SERAFIM (CONSERTO)');
  });

  it('posiciona a câmera no ponto fixo e olha para o alvo com suavização', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    const spectator = new SpectatorCam(camera, CLEAR_WORLD);

    spectator.start(0); // Topo do Serafim
    for (let i = 0; i < 90; i++) spectator.update(1 / 60);

    const targetPos = DEFAULT_FIXED_CAMERAS[0]!.position;
    expect(camera.position.distanceTo(targetPos)).toBeLessThan(0.1);

    const lookDir = camera.getWorldDirection(new THREE.Vector3());
    const expectedDir = new THREE.Vector3()
      .copy(DEFAULT_FIXED_CAMERAS[0]!.lookAt)
      .sub(targetPos)
      .normalize();
    expect(lookDir.dot(expectedDir)).toBeGreaterThan(0.99);
  });

  it('segue o drone selecionado e avança automaticamente se for abatido', () => {
    const camera = new THREE.PerspectiveCamera();
    const drone = makeDrone('patrulha', 'voo', 0);
    const spectator = new SpectatorCam(camera, CLEAR_WORLD, [], {
      getDrones: () => [drone],
    });

    // Inicia no alvo do drone (índice 5: após as 5 fixas)
    spectator.start(5);
    expect(spectator.currentTargetLabel).toContain('DRONE SERAFIM (PATRULHA)');

    for (let i = 0; i < 60; i++) spectator.update(1 / 60);
    expect(camera.position.y).toBeGreaterThan(drone.pos.y);

    // Drone é abatido em combate
    drone.state = 'abatido';
    spectator.update(1 / 60);

    // Deve avançar para o próximo alvo válido
    expect(spectator.currentTargetLabel).toBe(DEFAULT_FIXED_CAMERAS[0]!.label);
  });

  it('evita colisão de parede ao seguir um drone', () => {
    const camera = new THREE.PerspectiveCamera();
    const drone = makeDrone('patrulha', 'voo', 0);
    const blockedWorld = {
      raycast() {
        return { distance: 1.2 };
      },
    } as unknown as PhysicsWorld;

    const spectator = new SpectatorCam(camera, blockedWorld, [], {
      getDrones: () => [drone],
    });

    spectator.start(5);
    for (let i = 0; i < 60; i++) spectator.update(1 / 60);

    const dist = camera.position.distanceTo(drone.pos);
    expect(dist).toBeLessThan(3.0);
  });

  it('segue o mech selecionado e avança automaticamente se o mech for destruído', () => {
    const camera = new THREE.PerspectiveCamera();
    const mech = makeMech(10, 10, true);
    const spectator = new SpectatorCam(camera, CLEAR_WORLD, [], {
      getDynamicMechs: () => [mech],
      getMechName: () => 'MECH SEGUIDO',
    });

    // Inicia no alvo do mech (índice 5: após as 5 fixas)
    spectator.start(5);
    expect(spectator.currentTargetLabel).toBe('MECH SEGUIDO');

    for (let i = 0; i < 60; i++) spectator.update(1 / 60);
    expect(camera.position.y).toBeGreaterThan(mech.position.y + 2);

    // O Mech morre durante a partida
    (mech as { alive: boolean }).alive = false;
    spectator.update(1 / 60);

    // Avança para o próximo alvo válido (retorna às fixas)
    expect(spectator.currentTargetLabel).toBe(DEFAULT_FIXED_CAMERAS[0]!.label);
  });

  it('evita colisão de parede ao seguir um Mech', () => {
    const camera = new THREE.PerspectiveCamera();
    const mech = makeMech(5, -5, true);
    const blockedWorld = {
      raycast() {
        return { distance: 1.5 };
      },
    } as unknown as PhysicsWorld;

    const spectator = new SpectatorCam(camera, blockedWorld, [], {
      getDynamicMechs: () => [mech],
    });

    spectator.start(5);
    for (let i = 0; i < 60; i++) spectator.update(1 / 60);

    // Distância da câmera ao centro do mech deve ser contida pelo raycast hit
    const dist = camera.position.distanceTo(mech.position);
    expect(dist).toBeLessThan(3.5);
  });

  it('torna prédios oclusores translúcidos e restaura ao cancelar', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(20, 20, 20);
    const material = new THREE.MeshStandardMaterial({ transparent: true });
    const occluder = {
      box: new THREE.Box3(new THREE.Vector3(5, 0, 5), new THREE.Vector3(15, 30, 15)),
      material,
    } satisfies Occluder;

    const spectator = new SpectatorCam(camera, CLEAR_WORLD, [occluder]);
    spectator.start(0);

    // Atualiza com câmera atrás do occluder olhando para (0, 4, 0)
    for (let i = 0; i < 60; i++) spectator.update(1 / 60);

    spectator.cancel();
    expect(spectator.active).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
  });

  it('libera (release) com transição suave até a posição normal da câmera', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 0);
    const spectator = new SpectatorCam(camera, CLEAR_WORLD);

    spectator.start(0);
    for (let i = 0; i < 30; i++) spectator.update(1 / 60);

    spectator.release();
    expect(spectator.overridesRig).toBe(false);
    expect(spectator.active).toBe(true);

    const normalPose = new THREE.Vector3(2, 4, 6);
    for (let i = 0; i < 30; i++) {
      camera.position.copy(normalPose);
      spectator.update(1 / 60);
    }

    expect(spectator.active).toBe(false);
    expect(camera.position.distanceTo(normalPose)).toBeLessThan(1e-4);
  });
});

/**
 * A visão aérea do WARGAME (P291): a primeira posição do episódio dá a volta devagar no centro, olhando para ele; a troca automática passa de alvo a cada N segundos.
 */
describe('SpectatorCam no WARGAME (P291): visão aérea e troca automática', () => {
  const orbita = { center: new THREE.Vector3(0, 0, 0), raio: 80, altura: 40, velocidade: 0.05 };

  it('com órbita, a visão aérea é o alvo 0 e o primeiro do episódio; sem órbita, não existe', () => {
    const com = new SpectatorCam(new THREE.PerspectiveCamera(), CLEAR_WORLD, [], { orbit: orbita });
    com.start(0);
    expect(com.getTargets()[0]!.kind).toBe('orbit');
    expect(com.currentIndex).toBe(0);
    expect(com.goToOrbit()).toBe(true);
    const sem = new SpectatorCam(new THREE.PerspectiveCamera(), CLEAR_WORLD, []);
    expect(sem.getTargets().some((t) => t.kind === 'orbit')).toBe(false);
    expect(sem.goToOrbit()).toBe(false);
  });

  it('a câmera aérea fica na altura e no raio da órbita, olhando para o centro, e anda em volta', () => {
    const camera = new THREE.PerspectiveCamera();
    const spectator = new SpectatorCam(camera, CLEAR_WORLD, [], { orbit: orbita });
    spectator.start(0);
    for (let i = 0; i < 600; i++) spectator.update(1 / 60); // 10 s de órbita, com a suavização já assentada
    const p = camera.position;
    expect(p.y).toBeCloseTo(orbita.altura, 0);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(orbita.raio, 0);
    const antes = p.clone();
    for (let i = 0; i < 300; i++) spectator.update(1 / 60);
    expect(camera.position.distanceTo(antes)).toBeGreaterThan(5); // o ângulo andou: não é uma câmera parada
    // olha para o centro: a direção da câmera aponta para dentro da arena
    const olhar = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const paraCentro = new THREE.Vector3(-p.x, -p.y, -p.z).normalize();
    expect(olhar.dot(paraCentro)).toBeGreaterThan(0.9);
  });

  it('a troca automática passa ao próximo alvo depois de N segundos, e para quando desligada (0)', () => {
    const spectator = new SpectatorCam(new THREE.PerspectiveCamera(), CLEAR_WORLD, [], { orbit: orbita });
    spectator.start(0);
    spectator.setAutoCycle(20);
    expect(spectator.autoCycleS).toBe(20);
    for (let i = 0; i < 19 * 60; i++) spectator.update(1 / 60);
    expect(spectator.currentIndex).toBe(0); // 19 s: ainda na órbita
    for (let i = 0; i < 2 * 60; i++) spectator.update(1 / 60);
    expect(spectator.currentIndex).toBe(1); // passou dos 20 s
    spectator.setAutoCycle(0);
    for (let i = 0; i < 60 * 60; i++) spectator.update(1 / 60);
    expect(spectator.currentIndex).toBe(1); // desligada: não troca mais
  });

  it('trocar à mão zera o relógio da troca automática (o alvo novo tem os seus 20 s inteiros)', () => {
    const spectator = new SpectatorCam(new THREE.PerspectiveCamera(), CLEAR_WORLD, [], { orbit: orbita });
    spectator.start(0);
    spectator.setAutoCycle(20);
    for (let i = 0; i < 15 * 60; i++) spectator.update(1 / 60);
    spectator.nextTarget();
    for (let i = 0; i < 15 * 60; i++) spectator.update(1 / 60);
    expect(spectator.currentIndex).toBe(1); // 15 s no alvo novo: ainda não passou dos 20 s
  });
});
