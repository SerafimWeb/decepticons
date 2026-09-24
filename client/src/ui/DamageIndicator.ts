import type { Vector3Like } from 'three';

/**
 * Calcula o ângulo em graus (0 a 360) para o indicador de dano em relação à visão do jogador.
 *
 * Convenção da câmera: a frente da câmera é (-sin(yaw), 0, -cos(yaw)).
 *  - 0° / 360° = tiro vindo da FRENTE (topo do indicador)
 *  - 90° = tiro vindo da DIREITA
 *  - 180° = tiro vindo de TRÁS (baixo do indicador)
 *  - 270° = tiro vindo da ESQUERDA
 */
export function calculateDamageAngle(
  playerPos: Vector3Like,
  shooterPos: Vector3Like,
  cameraYaw: number,
): number {
  // Vetor do jogador para o atirador
  const dx = shooterPos.x - playerPos.x;
  const dz = shooterPos.z - playerPos.z;

  // Ângulo do vetor até o atirador no espaço do mundo (Z-negativo é frente 0 rad no yaw 0)
  // atan2(dx, -dz) nos dá o yaw no mundo para onde o atirador está localizado.
  const shooterWorldAngle = Math.atan2(dx, -dz);

  // Ângulo relativo à direção de visão da câmera
  let relativeAngle = shooterWorldAngle - cameraYaw;

  // Converter para graus de 0 a 360
  let degrees = (relativeAngle * 180) / Math.PI;
  degrees = (degrees % 360 + 360) % 360;

  return degrees;
}

const $ = (id: string) => document.getElementById(id)!;

export class DamageIndicator {
  private readonly element: HTMLElement;

  constructor() {
    this.element = $('damage-indicator');
  }

  /**
   * Exibe o arco indicador de dano apontando na direção do atirador.
   */
  show(playerPos: Vector3Like, shooterPos: Vector3Like, cameraYaw: number): void {
    const angle = calculateDamageAngle(playerPos, shooterPos, cameraYaw);

    // Reinicia a animação CSS removendo e adicionando a classe em um reflow
    this.element.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    this.element.classList.remove('active');
    void this.element.offsetWidth; // Força reflow
    this.element.classList.add('active');
  }
}
