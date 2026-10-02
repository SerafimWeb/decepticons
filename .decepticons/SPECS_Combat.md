# SPECS: Combat — CYBERMECH

Sistema de armas, dano modular, calor e morte. Regras de equilíbrio e arbitragem de servidor.
> **Aviso (01/10):** os números de CPU, rede e memória desta ficha são estimativas de redação, sem medição no repositório que os sustente. Valem como ordem de grandeza até alguém medir; a verdade medida mora em `STATUS_REAL.md`, nos testes e em `ArenaRoom.tickMs`. Auditoria pendente.

## Objetivo

`CombatSystem.ts` e módulos de `combat/` traduzem ações do jogador (trigger) em dano, calor, knockback e reações do Mech. Servidor é autoridade final: valida disparos, calcula dano e sincroniza morte.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Dissipador único | Previne combo tesourada | Build de plasma+foguete caro (força especialização) |
| 3 níveis de arma | Escolha simples no Hangar | Limite visual em customização |
| Acerto decidido no servidor (projétil: raycast do segmento por tick; dano pela mesma `Match`) | Evita cheating | O cliente só vê o resultado (evento HIT); compensação de latência ainda ausente (`FINDINGS.md`) |
| Dano por parte | Mecânica profunda | A parte sai da altura e do lado do impacto na cápsula (`damage.ts`), sem raycast extra |
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

- **CPU (estimativa de redação, não medida):** ~0,8 ms/tick com 8 Mechs disparando (fire + raycast de projétil + dano)
  - Não há raycast por parte: o dano resolve a parte pela altura e pelo lado do impacto
  - Medição real do servidor: `ArenaRoom.tickMs` (média móvel; meta G14/MULTIPLAYER.md ≤ 2 ms por tick)
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
- Combo plasma+foguete em 2,5 s (ajuste de calor): sem teste ou medição que o sustente no repositório
- Knockback em Mech remoto: não verificado

---

## Próximos Passos

**Aberto:**
- M5: o cliente consumir `EVENT.HIT` (marcador e indicador de dano no online) e a compensação de latência
- Dano crítico (bonus acertou cabeça)
- Armas especiais (sniper, EMP, suporte)
- Jogadas de Mech: combos e ataques especiais por chassi (ideia do dono, 01/10; ver `ROADMAP.md` IDEIAS)

**Bloqueador:**
- Compensação de latência: precisa de decisão de projeto (`FINDINGS.md`, seção M5)

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
