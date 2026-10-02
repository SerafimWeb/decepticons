# SPECS: Render — CYBERMECH

Sistema de renderização: Three.js, draw calls otimizados, qualidade adaptativa.

## Objetivo

`Game.ts` coordena Three.js com `InstancedMesh` e rig procedural. Meta: ≤10 draw calls por Mech em GPU integrada (foi 34 antes do PR #43). Sem WebGPU; WebGL2 é limite mínimo. Qualidade adaptativa (G12) rebaixa `pixelRatio` e desliga bloom se FPS < 50.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| InstancedMesh para bots | Um draw call para 3+ androides | Animação uniforme (todos pisam igual) |
| Rig procedural (não importado) | Geração rápida, customizável, zero asset | Limite visual (formas quadradas) |
| Bloom apenas em GPU alta | Efeito visual, mas caro | Sem bloom em móvel |
| Qualidade adaptativa (G12) | Suporta GPU integrada + tela 4K | Rebaixamento pode ser visível |
| Skybox neon + grid | Imersão Tron, fundo dinâmico | 2 draw calls adicionais (aceitável) |

## Contrato

```ts
// Quality.ts (G12)
class QualityManager {
  pixelRatio: number        // 0.5, 0.75, 1.0, 1.5, 2.0
  bloomEnabled: boolean
  setQuality(level: "low" | "medium" | "high" | "ultra"): void
  autoAdapt(fps: number): void  // < 50 FPS → rebaixa
}

// Render loop
class Game {
  fixedUpdate(dt: number): void  // 60 Hz tick, física
  update(dt: number): void       // render e efeitos
  render(): void                 // three.js.render()
}
```

## Custo

- **CPU:** Variável por cena
  - 1 Mech: ~2 ms (9 meshes, rig update, física)
  - 8 pilotos (3 Mechs + 3 androides): ~12 ms (draw calls, state update)
- **GPU:** Variável (pixelRatio)
  - Máximo: 1920×2K à 60 FPS (GPU integrada aguenta)
  - Mínimo: 960×1K (rebaixado)
- **Memória:** ~80 MB (texturas, geometrias, estados Three.js)
- **Render:** ~10 draw calls por Mech (meta G4)

## Testes

**Arquivo:** `client/src/core/Game.test.ts` (25+ casos)

**Cobertura:**
- ✅ Loop de 60 Hz fixo (sem deltaTime drift)
- ✅ Interpolação de remotos (~100 ms lag)
- ✅ Qualidade adaptativa (rebaixamento quando FPS cai)
- ✅ Draw calls contagem (< 50 para 8 pilotos)
- ✅ Rerender sem alocação (G4)
- ✅ Modo offline e online (mesma renderização)

**Regressão:** Draw calls medidos a cada build; mudança = investigar.

---

## Conhecimento

**Ligado:**
- `Three.js` (WebGL2, no browser e no Node.js headless)
- `PhysicsWorld.ts` (lê posição do Mech)
- `CameraRig.ts` (3 modos: 3ª, 1ª, tática)
- `MechBase.ts` (simMuzzle, rig rotation)
- `entities/meshKit.ts` (geometrias procedurais: cápsula, caixa, cone)
- ADR-002: Híbrido procedural + IA 3D (Gênesis-01 importado aguenta extra draw call)

**Achados (R17):**
- ✅ InstancedMesh não pode ser destruído (bots são estáticos, ok pra escala 1)
- ✅ Draw call reduzido com SkeletonUtils.clone + material compartilhado
- ✅ Bloom com rendertarget próprio, tira apenas quando qualidade cai (não tira memória)
- ⚠️ Importados com texture: CSP bloqueava blob: (corrigido em scripts/site.mjs)

---

## Próximos Passos

**Aberto:**
- WebGPU (quando Safari suportar)
- Instanced rendering para destroços
- Sombras em tempo real (caro, prioridade baixa)
- Reflexo em HUD (espelho de câmera, efeito especial)
- Post-processing: glitch, vinheta, motion blur

**Não é bloqueador:**
- Render está otimizado, aguenta 8 pilotos em GPU integrada

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
