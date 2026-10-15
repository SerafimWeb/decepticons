import * as THREE from 'three';
import { GLOW } from '../core/palette';
import { SHAPE } from '../fx/particleShapes';
import { caixasDoAdereco, DESTRUTIVEIS, type Adereco, type TipoDeAdereco } from './PraiaAderecos';
import { esconderFaixa, mostrarFaixa, type FaixaDeVertices } from './PraiaAderecosMalha';
import { mostrarSombrasDe, ocultarSombrasDe, restaurarSombras } from './PraiaSombras';
import type { AlvoExterno, CaixaAlvo, Destructibles, EfeitosDoAlvo } from './Destructibles';

/**
 * OS COQUEIROS (E OS ADEREÇOS PEQUENOS) QUE SE QUEBRAM A TIRO — P138, 15/10: "quero poder detonar os coqueiros, assim como os elementos menores
 * do cenário". A regra é a de sempre (\`Destructibles\`: vida, dano do tiro e da explosão, rodada nova restaura); aqui está o **desenho**:
 *  - a caixa-alvo é um **sensor** (o tiro acerta, o Mech atravessa: as vias livres da praia não mudam);
 *  - o adereço quebrado **some da malha fundida** sem refazê-la (os vértices dele descem para baixo do mundo: \`esconderFaixa\`), e
 *  - a **sombra assada** no chão some junto (\`ocultarSombrasDe\`: só a janela em volta, ~poucos ms);
 *  - saem os **destroços** (troncos e folhas de coqueiro, a lona do guarda-sol, as ripas do banco) e as partículas.
 * Os que têm luz (poste, semáforo, refletor) e a cobertura do pátio da estação **ficam de pé**: ver \`DESTRUTIVEIS\`.
 *
 * **Custo:** CPU zero por quadro (nada aqui roda fora do tiro); um sensor por caixa no Rapier (~330 estáticos, sem integração); ao quebrar, ~25
 * destroços físicos por coqueiro (o teto global do \`DebrisSystem\` segura) e uma janela de sombra recalculada. Nenhum desenho novo.
 */

const CIMA = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _tam = new THREE.Vector3();
const EIXO_Y = new THREE.Vector3(0, 1, 0);
const EIXO_Z = new THREE.Vector3(0, 0, 1);
const _giro = new THREE.Quaternion();
const _tomba = new THREE.Quaternion();

const MADEIRA = [new THREE.Color(0.42, 0.31, 0.21), new THREE.Color(0.34, 0.25, 0.17)] as const;
const FOLHAS = [new THREE.Color(0.1, 0.26, 0.09), new THREE.Color(0.22, 0.46, 0.14), new THREE.Color(0.34, 0.56, 0.18)] as const;
const LASCAS = new THREE.Color(0.9, 0.7, 0.4);
const VERDE_VIVO = new THREE.Color(0.35, 0.85, 0.2);
const LIXEIRA = [new THREE.Color(0.2, 0.5, 0.35), new THREE.Color(0.12, 0.14, 0.16)] as const;
const FERRO = [new THREE.Color(0.75, 0.76, 0.78), new THREE.Color(0.62, 0.6, 0.55)] as const;

/** Os adereços que se quebram: os tipos de \`DESTRUTIVEIS\`, menos os marcados \`solido: false\` (os de fora do mapa). */
export const ehDestrutivel = (a: Adereco): boolean => DESTRUTIVEIS[a.tipo] !== undefined && a.solido !== false;

/** O pó do chão no pé do que caiu. */
function poeira(efeitos: EfeitosDoAlvo, onde: THREE.Vector3, quanto: number): void {
  efeitos.particles.burst(onde, CIMA, { count: quanto, color: GLOW.dust, speed: 5, life: 1.8, size: 2, expansion: 1.2, spread: 2, gravity: 1, shape: SHAPE.puff });
}

/** O ponto do mundo de uma coordenada local do adereço (o giro e a escala aplicados): serve para pôr os destroços onde o tronco e a copa estavam. */
function noMundo(a: Adereco, lx: number, ly: number, lz: number, saida: THREE.Vector3): THREE.Vector3 {
  const e = a.escala ?? 1;
  const c = Math.cos(a.giro);
  const s = Math.sin(a.giro);
  return saida.set(a.x + e * (lx * c + lz * s), (a.y ?? 0) + e * ly, a.z + e * (-lx * s + lz * c));
}

/** Os destroços e as partículas de cada tipo, quando ele cai. */
function destrocos(a: Adereco, efeitos: EfeitosDoAlvo, dir: THREE.Vector3, force: number): void {
  const e = a.escala ?? 1;
  const { debris, particles } = efeitos;
  switch (a.tipo) {
    case 'palmeira': {
      // O tronco em três toras, a copa em lascas de palma (cada uma uma folha que cai e rodopia).
      debris.shatter(noMundo(a, 0.75, 5.25, 0, _p).clone(), _tam.set(1.0 * e, 10.2 * e, 1.0 * e), dir, force, MADEIRA);
      const copa = noMundo(a, 1.7, 10.1, 0, _p).clone();
      debris.shatter(copa, _tam.set(6.4 * e, 0.5 * e, 6.4 * e), dir, force * 0.7, FOLHAS);
      particles.burst(copa, CIMA, { count: 36, color: VERDE_VIVO, speed: 9, life: 1.7, size: 1.1, spread: 1.7, gravity: 5, shape: SHAPE.shard, spin: 6 });
      particles.burst(noMundo(a, 0.75, 4, 0, _p), CIMA, { count: 16, color: LASCAS, speed: 8, life: 1.0, size: 0.9, spread: 1.2, gravity: 8, shape: SHAPE.streak });
      poeira(efeitos, noMundo(a, 0, 0.4, 0, _p), 26);
      break;
    }
    case 'guardasol': {
      const lona = new THREE.Color(a.cor ?? 0xffffff);
      debris.shatter(noMundo(a, 0, 1.2, 0, _p).clone(), _tam.set(0.2, 2.3, 0.2), dir, force, FERRO);
      debris.shatter(noMundo(a, 0, 2.65, 0, _p).clone(), _tam.set(2.7 * e, 0.4, 2.7 * e), dir, force * 0.8, [lona, new THREE.Color(1, 1, 1)]);
      poeira(efeitos, noMundo(a, 0, 0.3, 0, _p), 12);
      break;
    }
    case 'banco':
      debris.shatter(noMundo(a, 0, 0.55, 0, _p).clone(), _tam.set(1.9, 1.0, 0.6), dir, force, MADEIRA);
      poeira(efeitos, noMundo(a, 0, 0.3, 0, _p), 10);
      break;
    case 'lixeira':
      debris.shatter(noMundo(a, 0, 0.5, 0, _p).clone(), _tam.set(0.8, 1.0, 0.8), dir, force, LIXEIRA);
      poeira(efeitos, noMundo(a, 0, 0.3, 0, _p), 8);
      break;
    case 'cadeira':
      debris.shatter(noMundo(a, 0, 0.45, 0, _p).clone(), _tam.set(0.8, 0.9, 1.8), dir, force, [new THREE.Color(a.cor ?? 0xffffff), FERRO[0]]);
      poeira(efeitos, noMundo(a, 0, 0.2, 0, _p), 6);
      break;
    default:
      break;
  }
}

/** O tranco de cada acerto que não quebrou: folhas caindo da copa, lascas do tronco, o que cada tipo solta. */
function acerto(a: Adereco, efeitos: EfeitosDoAlvo, caixa: CaixaAlvo, restante: number): void {
  const { particles } = efeitos;
  const quanto = Math.max(4, Math.round(10 * (1.2 - restante)));
  if (a.tipo === 'palmeira' && caixa.size.y < 4) particles.burst(caixa.center, CIMA, { count: quanto + 6, color: VERDE_VIVO, speed: 6, life: 1.5, size: 1, spread: 1.4, gravity: 5, shape: SHAPE.shard, spin: 6 });
  else particles.burst(caixa.center, CIMA, { count: quanto, color: LASCAS, speed: 7, life: 0.7, size: 0.8, spread: 1.3, gravity: 8, shape: SHAPE.streak });
}

/**
 * Registra no \`Destructibles\` todos os adereços da praia que se quebram e cuida do desenho de cada um. \`faixas\` vem de
 * \`montarAderecosComFaixas\` (onde, na malha fundida, ficam os vértices de cada adereço).
 */
export class PraiaDestrutiveis {
  /** Quantos alvos foram registrados, por tipo (para o teste e para o painel). */
  readonly porTipo = new Map<TipoDeAdereco, number>();
  readonly total: number;

  constructor(destructibles: Destructibles, aderecos: readonly Adereco[], faixas: ReadonlyMap<Adereco, readonly FaixaDeVertices[]>) {
    // Uma partida nova no mesmo processo: o chão volta ao do carregamento (a sombra assada é uma textura do processo).
    restaurarSombras();
    let total = 0;
    for (const a of aderecos) {
      if (!ehDestrutivel(a)) continue;
      const def = DESTRUTIVEIS[a.tipo]!;
      const minhas = faixas.get(a) ?? [];
      const caixas: CaixaAlvo[] = caixasDoAdereco(a).map((c) => ({
        center: new THREE.Vector3(c.x, c.y, c.z),
        size: new THREE.Vector3(c.w, c.h, c.d),
        // Primeiro a inclinação do tronco (o topo para +x local), depois o giro do coqueiro em Y.
        rotation: _giro.setFromAxisAngle(EIXO_Y, c.giro).multiply(_tomba.setFromAxisAngle(EIXO_Z, -c.inclina)).clone(),
      }));
      const alvo: AlvoExterno = {
        caixas,
        centro: new THREE.Vector3(a.x, (a.y ?? 0) + 3, a.z),
        hp: def.vida,
        peso: def.peso,
        quebrou: (efeitos, dir, force) => {
          for (const f of minhas) esconderFaixa(f);
          ocultarSombrasDe(a);
          destrocos(a, efeitos, dir, force);
        },
        voltou: () => {
          for (const f of minhas) mostrarFaixa(f);
          mostrarSombrasDe(a);
        },
        acertou: (efeitos, restante, caixa) => acerto(a, efeitos, caixa, restante),
      };
      destructibles.addExterno(alvo);
      this.porTipo.set(a.tipo, (this.porTipo.get(a.tipo) ?? 0) + 1);
      total++;
    }
    this.total = total;
  }
}
