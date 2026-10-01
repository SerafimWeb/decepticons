# SPECS: Combat — CYBERMECH

Sistema de armas, dano modular, calor e morte. Regras de equilíbrio e arbitragem de servidor.

## Objetivo

`CombatSystem.ts` e módulos de `combat/` traduzem ações do jogador (trigger) em dano, calor, knockback e reações do Mech. Servidor é autoridade final: valida disparos, calcula dano e sincroniza morte.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Dissipador único | Previne combo tesourada | Build de plasma+foguete caro (força especialização) |
| 3 níveis de arma | Escolha simples no Hangar | Limite visual em customização |
| Disparos 100% server-auth | Evita cheating | M5 só valida, cliente prediz; ajuste de latência necessário |
| Dano por parte | Mecânica profunda | 6 raycasts = ~0,6 ms overhead |
| Knockback simples (vel. fixa) | Previsível | Sem variação dramática entre armas |

## Contrato

```ts
combatSystem.fire(shooter: MechBase, weaponSlot: 0|1, dt: number)
  → { damage: number, heat: number, isValid: boolean }

damage.apply(target: MechBase, part: 0..5, amount: number)
  → { newHP, isAlive }

heat.tick(dt)  // dissipação passiva
  → { current, overheat: boolean }
```

## Custo

- **CPU:** ~0,8 ms/tick com 8 Mechs disparando (fire + raycast + dano)
  - `fire()` bitmask: ~0,1 ms
  - Raycast de dano: ~0,4 ms (6 raios por alvo)
  - Aplicar dano: ~0,3 ms (atualizar HP, efeitos)
- **Memória:** ~12 KB por Mech (parte HP, cooldowns, heat)
- **Rede:** 2 bytes evento "disparou + slot"; 1 byte dano aplicado (serializado)
- **Render:** +1 draw call por projétil (particulas, flash)

## Armas (Banco de Dados)

| Arma | Dano/Tiro | Cadência | Calor | Custo de Carga |
|---|---|---|---|---|
| Plasma MK I | 28 | 1,5 s | 0,10 | 1 |
| Plasma MK II | 34 | 1,0 s | 0,14 | 2 |
| Plasma MK III | 41 | 0,8 s | 0,17 | 3 |
| Foguete MK I | 46 | 2,0 s | 0,12 | 1 |
| Foguete MK II | 56 | 1,5 s | 0,15 | 2 |
| Foguete MK III | 68 | 1,2 s | 0,18 | 3 |
| Metralhadora MK I | 12 | 0,15 s | 0,06 | 1 |
| Metralhadora MK II | 15 | 0,12 s | 0,08 | 2 |
| Metralhadora MK III | 18 | 0,10 s | 0,10 | 3 |

**Meta de Equilíbrio:** Toda arma mata Mech de 180 HP em 2,5–3,0 s (playstyle varia; nenhuma é "errada").

## Testes

**Arquivo:** `client/src/combat/balance.test.ts` (80+ casos)

**Cobertura:**
- ✅ Dano por parte (cabeça 1.5x, corpo 1x, pernas 0.8x)
- ✅ Calor acumulado e dissipação
- ✅ Overheat (travamento temporário)
- ✅ Morte (queda com 0 HP)
- ✅ Knockback (impulso correto)
- ✅ Equilíbrio (nenhuma arma mata em < 2,5 s sozinha)

**Regressão:** Números de arma fixados; qualquer mudança trava teste.

---

## Conhecimento

**Ligado:**
- `MechBase.ts` (recebe dano, atualiza HP)
- `ProjectileSystem.ts` (visuais de bala)
- `RocketSystem.ts` (foguetes com física)
- `entities/chassis.ts` (HP e armadura)
- ADR-004: Dissipador único
- ADR-006: Server autoridade

**Achados (R17):**
- ✅ Combo plasma+foguete rendeu em 2,5 s (ajuste de calor resolveu)
- ⚠️ Knockback não funciona em remoto (M5; cliente prediz, servidor corrige)

---

## Próximos Passos

**Aberto:**
- M5: validação de tiro no servidor
- Dano crítico (bonus acertou cabeça)
- Armas especiais (sniper, EMP, suporte)
- Modo bossagro (dano progressivo contra IA)

**Bloqueador:**
- Servidor não valida tiro; M5 pendente

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
