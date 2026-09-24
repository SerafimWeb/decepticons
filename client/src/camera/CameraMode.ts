import type RAPIER from '@dimforge/rapier3d-simd-compat';
import type * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { MechBase } from '../entities/MechBase';
import type { Occluder } from '../environment/Arena';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

export type CameraModeId = 'fps' | 'tps' | 'tactical';

/** Resultado de cada modo de câmera: para onde o Mech olha, anda e atira. */
export interface AimState {
  yaw: number; // direção do torso
  pitch: number; // inclinação dos braços
  moveYaw: number; // referencial do WASD
  point: THREE.Vector3; // ponto do mundo sob a mira
  /** Colisor sob a mira (null = céu ou fora de alcance): diz se há um Mech na mira. */
  target: RAPIER.Collider | null;
}

/** Estado de "olhar com o mouse" compartilhado entre 1ª e 3ª pessoa. */
export interface LookState {
  yaw: number;
  pitch: number;
}

export interface CameraContext {
  camera: THREE.PerspectiveCamera;
  physics: PhysicsWorld;
  input: InputManager;
  mech: MechBase;
  look: LookState;
  occluders: readonly Occluder[];
}

export interface CameraMode {
  readonly id: CameraModeId;
  readonly label: string;
  /** true = mouse capturado (mira por delta); false = cursor livre. */
  readonly pointerLock: boolean;
  readonly fov: number;
  /** FOV abre durante o dash (sensação de velocidade). */
  readonly dashFovKick: number;
  readonly pitchLimits: [number, number];
  enter?(): void;
  exit?(): void;
  onWheel?(deltaY: number): void;
  /** Posiciona a câmera e preenche `aim`. Roda na taxa do render. */
  update(dt: number, aim: AimState): void;
}
