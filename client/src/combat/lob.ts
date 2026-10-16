import * as THREE from 'three';

/**
 * A conta do arco do lança-granadas (P160 parte 2b): só geometria, sem 3D nem física (G1/G2: o servidor e o cliente fazem a mesma conta).
 *
 * Um tiro com velocidade `speed` e gravidade `g` sai de `from` e cai em `to` por **dois** arcos: o **baixo** (rápido, quase reto) e o **alto** (lento,
 * passa por cima do que estiver no caminho). Fora do alcance (`speed² / g` no plano), sai a 45°, o mais longe possível, na direção do alvo.
 */

const _flat = new THREE.Vector3();

/**
 * A direção de lançamento (unitária, em `out`) para sair de `from` e cair em `to`. `high` escolhe o arco alto. Devolve `false` se `to` está fora do
 * alcance (então `out` é o tiro de 45° na direção do alvo).
 */
export function lobDirection(from: THREE.Vector3, to: THREE.Vector3, speed: number, g: number, high: boolean, out: THREE.Vector3): boolean {
  _flat.set(to.x - from.x, 0, to.z - from.z);
  const d = _flat.length();
  const h = to.y - from.y;
  if (d < 1e-3) {
    // Alvo bem em cima ou bem embaixo: sai reto para ele.
    out.set(0, Math.sign(h) || -1, 0);
    return true;
  }
  _flat.multiplyScalar(1 / d);
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
  if (disc < 0) {
    const c = Math.SQRT1_2;
    out.set(_flat.x * c, c, _flat.z * c);
    return false;
  }
  const root = Math.sqrt(disc);
  const tan = (v2 + (high ? root : -root)) / (g * d);
  const cos = 1 / Math.sqrt(1 + tan * tan);
  out.set(_flat.x * cos, tan * cos, _flat.z * cos);
  return true;
}

/** Onde o tiro está `t` segundos depois de sair de `from` com a direção `dir` (unitária), em `out`. */
export function lobPoint(from: THREE.Vector3, dir: THREE.Vector3, speed: number, g: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(from.x + dir.x * speed * t, from.y + dir.y * speed * t - 0.5 * g * t * t, from.z + dir.z * speed * t);
}

/** Quanto tempo o tiro leva para andar a distância no plano até `to` (s); `Infinity` se ele sai na vertical. */
export function lobFlightTime(from: THREE.Vector3, to: THREE.Vector3, dir: THREE.Vector3, speed: number): number {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const horizontal = Math.hypot(dir.x, dir.z) * speed;
  return horizontal > 1e-6 ? d / horizontal : Infinity;
}

/** O alcance máximo no plano (m): o tiro de 45°. */
export function lobMaxRange(speed: number, g: number): number {
  return (speed * speed) / g;
}

/**
 * A velocidade de lançamento para sair de `from` com a elevação `angle` (rad) e cair em `to` (a "carga" do morteiro); `NaN` se nenhuma velocidade faz
 * esse ângulo chegar lá (o alvo está acima da reta do ângulo).
 */
export function lobSpeedFor(from: THREE.Vector3, to: THREE.Vector3, angle: number, g: number): number {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const h = to.y - from.y;
  const c = Math.cos(angle);
  const den = 2 * c * c * (d * Math.tan(angle) - h);
  if (!(den > 1e-9) || d < 1e-3) return NaN;
  return Math.sqrt((g * d * d) / den);
}

/** A direção (unitária, em `out`) com a elevação `angle` (rad) rumo a `to` no plano. */
export function lobAngleDirection(from: THREE.Vector3, to: THREE.Vector3, angle: number, out: THREE.Vector3): THREE.Vector3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  const c = Math.cos(angle);
  if (d < 1e-3) return out.set(0, 1, 0);
  return out.set((dx / d) * c, Math.sin(angle), (dz / d) * c);
}
