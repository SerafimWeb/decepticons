# SPECS: HUD — CYBERMECH

Interface visual em partida: vida por parte, calor, armas, placar, indicadores de dano.

## Objetivo

`HUD.ts` renderiza o "cockpit" visual do piloto: as 6 partes do Mech com HP/armadura, barra de calor com trava visual, armas equipadas, contador de inimigos, kill feed, ping/FPS. Design cyberpunk anos 80 (Shadowrun, BattleTech). F1 esconde, ' abre painel de debug.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Sovrepositção de canvas 2D | Sem WebGL 3D, rápido em GPU fraca | Sincronizar coordenadas com viewport |
| Cantos arredondados em neon | Visual legalista, nostalgia | Mais drawcalls no canvas (não importa em 2D) |
| Atualização per-frame | Responsa ao estado ao vivo | CPU ~0,5 ms por frame |
| Indicadores de dano vermelhos | Clareza: atingiu de onde | Confuso em muitos tiros simultâneos |
| Kill feed + placar (Tab) | Standard competitivo | Texto rasterizado = mais texture bind |

## Contrato

```ts
// HUD.ts
class HUD {
  setMechState(parts: HP[6], heat: number, alive: boolean): void
  setWeapons(primary: Weapon, secondary: Weapon): void
  setEnemies(count: number, nearby: number): void
  kill(shooter: string, victim: string, weapon: string): void
  damage(position: Vector3): void  // direção do dano
  show(): void; hide(): void       // F1
}

// Input do estado
interface MechState {
  parts: [hp0, hp1, hp2, hp3, hp4, hp5]  // 0..1 fração de HP
  heat: number                            // 0..1+ (+1 = overheat)
  alive: boolean
}
```

## Custo

- **CPU:** ~0,5 ms por frame (canvas render, texto)
- **GPU:** ~1 MS (text rasterization no canvas 2D)
- **Memória:** ~50 KB (sprites, fontes, cache de texto)
- **Render:** 1 canvas full-screen + text textures (reutilizadas)

## Testes

**Arquivo:** `client/src/ui/HUD.test.ts` (20+ casos)

**Cobertura:**
- ✅ Renderização de 6 partes (layout certo)
- ✅ Calor (animação de pulsação)
- ✅ Kill feed (últimos 5, fade out)
- ✅ Indicador de dano (posição/ângulo correto)
- ✅ F1 toggle (visibilidade)
- ✅ Responsividade (resize viewport)

**Regressão:** Layout fixado em resolução 1920×1080; mudança = ajustar escala.

---

## Conhecimento

**Ligado:**
- `GameMode.ts` (state, HP, calor)
- `Match.ts` (kills, dano)
- `Nameplates.ts` (nomes inimigos, cores)
- `DebugPanel.ts` (painel oculto, FPS/CPU)
- ADR-007: Qualidade adaptativa (HUD não rebaixa, é crítico)

**Achados (R17):**
- ✅ Canvas text rasterizado uma vez, reutilizado (sem render por frame)
- ✅ Pulsação de calor feita com hue-shift, não redraw (GPU efficient)
- ⚠️ Indicador de dano em muitos tiros fica confuso (lição: limitar a 3 simultâneos)

---

## Próximos Passos

**Aberto:**
- Modo streamer (camera de espectador, overlay para OBS)
- Radar (mini-map de inimigos e aliados)
- Indicador de ammo/carregador de foguetes
- Menu pausado integrado (hoje separado)

**Não é bloqueador:**
- HUD em tela grande é responsivo (G12 adapta)

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
