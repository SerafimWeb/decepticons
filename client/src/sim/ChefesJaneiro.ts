import { blocosDaPraca, PRACA_LIMITES } from '../environment/PracaLayout';

/** Encontro satírico fictício, em duas etapas. Tudo decidido no tick fixo; render apenas lê. */
export const CACETETE = { alcance: 9, dano: 75, intervalo: 1.2, aviso: 1.05 } as const;
export const CHEFES_JANEIRO = [
  { id: 'trampado', nome: 'TRAMPADO', vida: 720, escala: 3, velocidade: 3.2, dano: 28, raio: 7, x: 80, z: 28 },
  { id: 'evil', nome: 'EVIL', vida: 1100, escala: 3.6, velocidade: 3.9, dano: 36, raio: 8.5, x: 88, z: -28 },
] as const;
export interface AlvoJaneiro { alive: boolean; simPosition: { x: number; y: number; z: number }; yaw: number }

export class ChefeJaneiro {
  x: number; z: number; yaw = 0; vida: number;
  estado: 'espera' | 'caca' | 'aviso' | 'golpe' | 'vencido' = 'espera';
  relogio = 0; avisoX = 0; avisoZ = 0; passos = 0; flash = 0;
  constructor(readonly config: typeof CHEFES_JANEIRO[number]) {
    this.x = config.x; this.z = config.z; this.vida = config.vida;
  }
  get vivo(): boolean { return this.estado !== 'espera' && this.estado !== 'vencido'; }
  reset(): void {
    this.x = this.config.x; this.z = this.config.z; this.vida = this.config.vida;
    this.estado = 'espera'; this.relogio = this.passos = this.flash = this.yaw = 0;
  }
}

export class ChefesJaneiro {
  readonly chefes = CHEFES_JANEIRO.map((c) => new ChefeJaneiro(c));
  habilitado = true;
  armaPermitida = true;
  conquistado = false;
  golpePendente = false;
  recarga = 0;
  golpeFx = 0;
  golpeX = 0; golpeZ = 0; golpeYaw = 0;
  tick = 0;
  private intervalo = 0;
  private readonly paredes = blocosDaPraca().filter((b) => b.solid && b.h > 0.5 && b.y + b.h / 2 > 0.6 && b.kind !== 'pavimento');
  aoAcertar: ((indice: number, dano: number, x: number, z: number) => void) | null = null;
  aoGolpear: ((x: number, y: number, z: number, yaw: number) => void) | null = null;
  aoConquistar: (() => void) | null = null;

  get restantes(): number { return this.habilitado ? this.chefes.reduce((n, c) => n + (c.estado === 'vencido' ? 0 : 1), 0) : 0; }
  get ativo(): ChefeJaneiro | undefined { return this.chefes.find((c) => c.vivo); }

  reiniciar(): void {
    for (const c of this.chefes) c.reset();
    this.tick = this.intervalo = this.recarga = this.golpeFx = 0;
    this.golpePendente = false;
    // Conquista permanece nesta sessão; armazenamento local é responsabilidade do cliente.
  }

  private livre(x: number, z: number, raio: number): boolean {
    if (x < PRACA_LIMITES.minX + raio || x > PRACA_LIMITES.maxX - raio || Math.abs(z) > PRACA_LIMITES.maxZ - raio) return false;
    for (const b of this.paredes) if (Math.abs(x - b.x) < b.w / 2 + raio && Math.abs(z - b.z) < b.d / 2 + raio) return false;
    return true;
  }

  avancar(dt: number, alvos: readonly AlvoJaneiro[]): void {
    if (!this.habilitado) { this.golpePendente = false; return; }
    this.tick++;
    this.recarga = Math.max(0, this.recarga - dt);
    this.golpeFx = Math.max(0, this.golpeFx - dt);
    if (this.golpePendente) {
      this.golpePendente = false;
      const a = alvos[0];
      if (this.conquistado && this.armaPermitida && this.recarga === 0 && a?.alive) {
        this.recarga = CACETETE.intervalo; this.golpeFx = 0.45;
        this.golpeX = a.simPosition.x; this.golpeZ = a.simPosition.z; this.golpeYaw = a.yaw;
        this.aoGolpear?.(this.golpeX, a.simPosition.y, this.golpeZ, this.golpeYaw);
      }
    }
    const primeiro = this.chefes[0]!;
    if (this.tick >= 1200 && primeiro.estado === 'espera') primeiro.estado = 'caca';
    if (primeiro.estado === 'vencido' && this.chefes[1]!.estado === 'espera') {
      this.intervalo += dt;
      if (this.intervalo >= 3) this.chefes[1]!.estado = 'caca';
    }
    const c = this.ativo;
    if (!c) return;
    c.flash = Math.max(0, c.flash - dt);
    let alvo = -1, perto = Infinity;
    for (let i = 0; i < alvos.length; i++) {
      const a = alvos[i]!;
      if (!a.alive) continue;
      const d = Math.hypot(a.simPosition.x - c.x, a.simPosition.z - c.z);
      if (d < perto) { perto = d; alvo = i; }
    }
    if (c.estado === 'aviso') {
      c.relogio -= dt;
      if (c.relogio <= 0) {
        c.estado = 'golpe'; c.relogio = 1.8;
        for (let i = 0; i < alvos.length; i++) {
          const a = alvos[i]!;
          if (a.alive && a.simPosition.y < 6 && Math.hypot(a.simPosition.x - c.avisoX, a.simPosition.z - c.avisoZ) < c.config.raio)
            this.aoAcertar?.(i, c.config.dano, c.x, c.z);
        }
      }
    } else if (c.estado === 'golpe') {
      c.relogio -= dt;
      if (c.relogio <= 0) c.estado = 'caca';
    } else if (alvo >= 0) {
      const a = alvos[alvo]!;
      const dx = a.simPosition.x - c.x, dz = a.simPosition.z - c.z;
      c.yaw = -Math.atan2(dz, dx);
      if (perto < c.config.raio + 2) {
        c.estado = 'aviso'; c.relogio = CACETETE.aviso;
        // Centro fixado na preparação: dá para ler e escapar, sem dano seguindo a mira.
        c.avisoX = c.x + dx * 0.4; c.avisoZ = c.z + dz * 0.4;
      } else {
        const passo = c.config.velocidade * dt;
        const nx = c.x + dx / perto * passo, nz = c.z + dz / perto * passo;
        const antesX = c.x, antesZ = c.z;
        if (this.livre(nx, c.z, 1.5)) c.x = nx;
        if (this.livre(c.x, nz, 1.5)) c.z = nz;
        c.passos += Math.hypot(c.x - antesX, c.z - antesZ);
      }
    }
  }

  private ferir(c: ChefeJaneiro, dano: number): void {
    if (!c.vivo || !Number.isFinite(dano) || dano <= 0) return;
    c.vida = Math.max(0, c.vida - dano); c.flash = 0.15;
    if (c.vida === 0) {
      c.estado = 'vencido';
      if (c.config.id === 'evil') { this.conquistado = true; this.aoConquistar?.(); }
    }
  }

  atirar(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, alcance: number, dano: number): boolean {
    const c = this.habilitado ? this.ativo : undefined;
    if (!c) return false;
    const raio = c.config.escala * 0.43, altura = c.config.escala * 2.3;
    const h2 = dx * dx + dz * dz, cx = c.x - ox, cz = c.z - oz;
    let a = 0, b = alcance;
    if (h2 > 1e-12) {
      const p = (cx * dx + cz * dz) / h2;
      const folga = raio * raio - (cx - dx * p) ** 2 - (cz - dz * p) ** 2;
      if (folga < 0) return false;
      const metade = Math.sqrt(folga / h2);
      a = Math.max(0, p - metade); b = Math.min(b, p + metade);
    } else if (cx * cx + cz * cz > raio * raio) return false;
    if (Math.abs(dy) > 1e-9) { const p = -oy / dy, q = (altura - oy) / dy; a = Math.max(a, Math.min(p, q)); b = Math.min(b, Math.max(p, q)); }
    else if (oy < 0 || oy > altura) return false;
    if (a > b) return false;
    this.ferir(c, dano); return true;
  }

  explodir(x: number, y: number, z: number, raio: number, dano: number): boolean {
    const c = this.habilitado ? this.ativo : undefined;
    if (!c) return false;
    const vertical = Math.max(0, y - c.config.escala * 2.3, -y);
    if (Math.hypot(c.x - x, c.z - z, vertical) > raio + c.config.escala * 0.43) return false;
    this.ferir(c, dano); return true;
  }
}
