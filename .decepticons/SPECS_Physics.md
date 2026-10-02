# SPECS: Physics — CYBERMECH

Sistema determinístico de movimento, colisão e gravidade. Roda a 60 Hz fixo no cliente e servidor.
> **Aviso (01/10):** os números de CPU, rede e memória desta ficha são estimativas de redação, sem medição no repositório que os sustente. Valem como ordem de grandeza até alguém medir; a verdade medida mora em `STATUS_REAL.md`, nos testes e em `ArenaRoom.tickMs`. Auditoria pendente.

## Objetivo

`PhysicsWorld.ts` encapsula Rapier3D com SIMD Wasm. É responsável por integração de movimento (character controller), raycast de piso, detecção de colisão com destruíves e garantir que cliente e servidor divergem zero em input idêntico.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Rapier3D com SIMD + compat shim | Determinístico, rápido; shim abstrai browser vs Node | +1,2 MB Wasm; compat não testada em mobile |
| 60 Hz fixo, tick sem wait | Previsível; cliente absorve FPS variável | Frame rate alto demanda GPU |
| Character controller cinemático | Sem destroços cosmético derrubando | Afundamento em parado (workaround: bots movem) |
| Raycast simples, sem cache | Uma linha para cada raio | ~1,8 ms/tick com 3 Mechs + 3 destroços |

## Contrato

```ts
new PhysicsWorld({
  gravityY: number        // típico -30
  timestep: number        // 1/60
  deterministic: boolean  // true em cliente+servidor
})

// Cada fixedUpdate (tick):
world.step(dt)
world.raycast(origin, direction) → { point, distance, hit }
world.getMechs() → MechBase[]  // corpos simulados
```

## Custo

- **CPU:** ~1,8 ms/tick em 60 Hz (60 Mechs = 1,8 ms; 3 Mechs = 0,09 ms)
  - Raycast é o caro: ~0,6 ms com 3 Mechs
  - Step do Rapier: ~0,2 ms
- **Memória:** ~8 KB por Mech (ColliderHandle, RigidBodyHandle)
- **Rede:** Nada (determinístico, sem sync de estado de physics)
- **Render:** Nenhum draw call; cliente lê posição de MechBase.simPosition

## Testes

**Arquivo:** `.test.ts` integrado em MechBase.test.ts (vê movimento real)

**Cobertura:**
- ✅ Pulo (aceleração vertical, cai com gravidade)
- ✅ Salto duplo (impulso, máx altura)
- ✅ Dash (movimento horizontal instantâneo)
- ✅ Piso (raycast detecta chão)
- ✅ Determinismo (mesmos números em 100 ticks)

**Regressão:** Nenhuma falha em sandbox headless.

---

## Conhecimento

**Ligado:**
- `MechBase.ts` (consome input, retorna posição)
- `shared/physics/` (tipos, constantes)
- ADR-003: Característica cinemática (G6)
- FINDINGS.md: Parado afunda

**Achados (R17):**
- ⚠️ Raycast com muitos corpos diverge ordem interna (tratado: sem sync de destroços)

---

## Próximos Passos

**Aberto:**
- Otimização de raycast (spatial hashing ou grid)
- Parado afunda (reescrever unstickFromGround)
- Teste de determinismo com 32+ Mechs (sim. servidor)

**Bloqueador:**
- Parado afunda no chão (FINDINGS.md; pendente isolamento)

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
