# SPECS: MechBase — CYBERMECH

Especificação técnica do controlador de movimento, animação e dano do Mech jogável.
> **Aviso (01/10):** os números de CPU, rede e memória desta ficha são estimativas de redação, sem medição no repositório que os sustente. Valem como ordem de grandeza até alguém medir; a verdade medida mora em `STATUS_REAL.md`, nos testes e em `ArenaRoom.tickMs`. Auditoria pendente.

## Objetivo

`MechBase.ts` é o motor de movimento do Mech: ele traduz `MechInput` (teclas, mouse) em movimento físico, animação de rig, orientação de armas e reação a dano. É o ponto de entrada que tudo o mais depende — jogador, bots, previsão de rede, câmera de abate.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Character controller cinemático | Destroços cosmético não derrubam | Remoto só interpola, sem controller |
| Rig procedural (não importado) | Rápido de gerar, sem asset | Limite visual: formas quadradas (pipeline híbrido resolvido) |
| Animação por `rotation`, sem IK | Simples, rápido | Quadrúpede exige redesenho |
| 6 partes com fracionamento de altura | Raycasts precisos, sem colisor extra | Importados sofrem (workaround: malha única com flash) |

## Contrato (API Pública)

### Entrada

```ts
new MechBase(options: {
  stats: MechStats        // blindagem, velocidade, dash, dissipador
  position: Vector3       // onde nasce
  rig?: MechRig           // procedural ou importado
  onDamage?: (part, damage) => void  // callback de dano
})

// Cada tick:
mech.fixedUpdate(dt: number, input: MechInput, world: PhysicsWorld)
mech.update(dt: number, camera: Camera)  // render e animação
```

### Saída

- `mech.simPosition` — posição simulada (autoridade)
- `mech.getWitness()` — snapshots para rede
- `mech.parts[6]` — HP de cada parte
- `mech.heat` — calor atual (0..1+)
- `mech.alive` — se está vivo

## Custo

- **CPU:** ~0,2 ms/tick em 60 Hz (3 Mechs = 0,6 ms)
  - Raycast (patrulha, piso) — mais caro com 3 Mechs + 3 andróides
  - Rig update — 9 rotações por frame
  - Zero alocação no caminho quente (G4)
- **Memória:** ~18 KB por Mech (rig, buffers, estado)
- **Rede:** 19 bytes/s × 20 Hz (posição, yaw, pitch, vida 6 partes, calor, flags)
- **Render:** 9 draw calls por Mech (procedural); +1 se importado (vapor de calor)

## Testes

**Arquivo:** `client/src/entities/MechBase.test.ts` (30+ testes)

**Cobertura:**
- ✅ Movimento básico (aceleração, dash, pulo duplo)
- ✅ Dano em cada parte (corpo inteiro, perna X, cabeça, etc)
- ✅ Morte e explosão
- ✅ Calor (aquecimento, trava, resfriamento)
- ✅ Estado de rede (witness, aplicar delta)
- ✅ Física real (PhysicsWorld)

**Regressão:** Nenhuma falha em 5 rodadas paralelas (G4).

---

## Conhecimento

**Ligado:**
- `MechInput` (contrato em `shared/net/input.ts`)
- `MechStats`, `CHASSIS` (em `entities/chassis.ts`)
- `PhysicsWorld` (Rapier em `physics/PhysicsWorld.ts`)
- `CombatSystem` (dano em `combat/damage.ts`)
- ADR-001: Uma simulação (G14)
- ADR-003: Característica cinemática (G6)

**Achados Reais (R17):**
- ⚠️ Mech parado afunda sem limite (FINDINGS.md)
- ⚠️ Importado sem texture (CSP bloqueava blob:)
- ✅ Rotação composta no apêndice (cauda corrigida)

---

## Próximos Passos

**Aberto:**
- Quadrúpede de verdade (pernas extras, IK)
- Braços assimétricos que disparando diferente
- Câmera de terceira pessoa no importado (escala diferente)

**Bloqueador:**
- Parado afunda no chão (travado no character controller do Rapier)

---

*Versão 1.0 | 2026-10-01 — Spec básica de referência*
