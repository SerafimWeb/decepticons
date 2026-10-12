# SPECS: Hangar — CYBERMECH

Sistema de montagem de Mech: chassi, armas, módulos, carga, salvamento e link compartilhável.
> **Aviso (01/10):** os números de CPU, rede e memória desta ficha são estimativas de redação, sem medição no repositório que os sustente. Valem como ordem de grandeza até alguém medir; a verdade medida mora em `STATUS_REAL.md`, nos testes e em `ArenaRoom.tickMs`. Auditoria pendente.

## Objetivo

O Hangar (`client/src/hangar/`) é onde o jogador escolhe classe (Vector-09, Android, Colossus), armas em cada braço (3 níveis cada), módulos nos ombros e valida carga total. Montagem salva no navegador, compartilhável por link (`?build=v1.vector09.plasma-1.rockets-2`). Contrato puro em `shared/net/` sem dependência do cliente.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Carga por chassis | Cada classe tem peso máximo (Vector-09 11t) | Força especialização, não "all maxed" |
| 3 níveis de arma, mesma regra | Progressão clara, fácil escolher | Limite visual em quantidade |
| Montagem salva localStorage | Persiste entre abas e sessões | Não sincroniza cross-device (próxima: contas) |
| Link ?build= gerado no client | Compartilhável, sem servidor | URL longa, frágil a mudanças de schema |
| Hangar 3D com preview | Pedestal holográfico gira o Mech | +2 draw calls, não é crítico |

## Contrato (API Pública)

```ts
// Hangar/loadout.ts
interface LoadoutSpec {
  chassis: string           // "vector09", "android", "colossus-01"
  primary: WeaponSlot       // arma braço direito
  secondary: WeaponSlot     // arma braço esquerdo (ou melee)
  modules?: ModuleSlot[]    // ombros (futuro)
}

interface WeaponSlot {
  weapon: string            // "plasma", "rockets", "blaster"
  level: 1 | 2 | 3          // MK I/II/III
}

validateLoadout(spec: LoadoutSpec) → { valid: boolean; reason?: string; totalWeight: number }

// Hangar.ts (UI)
class Hangar {
  spec: LoadoutSpec
  save(slot: 1..4): void    // salva em localStorage
  load(slot: 1..4): void
  toLink(): string          // gera ?build=
  fromLink(link: string): boolean
}
```

## Custo

- **CPU:** Nenhum em gameplay (carregado, não rodando cada frame)
- **Memória:** ~2 KB por montagem (texto JSON serializado)
- **Rede:** 60 B em input (chassis + 2 slots + level); validação no servidor ~0,1 ms
- **Render:** Pedestal 3D adiciona 2 draw calls na tela de Hangar (não em partida)
- **Storage:** 4 montagens × 2 KB = 8 KB localStorage (limite navegador: 5–10 MB)

## Testes

**Arquivo:** `client/src/hangar/Hangar.test.ts` (40+ casos)

**Cobertura:**
- ✅ Validação de carga (não ultrapassar teto)
- ✅ Validação de arma (existe, tem nível)
- ✅ Save/load localStorage (4 slots)
- ✅ Link ?build= (encode/decode roundtrip)
- ✅ Compatibilidade cross-version (ignora campos novos)
- ✅ UI: seletor de chassis, armas, preview 3D

**Regressão:** Schema de montagem versionado; mudança de versão trava teste.

---

## Conhecimento

**Ligado:**
- `LoadoutSpec` + `validateLoadout` (contrato em `shared/net/hangar.ts`)
- `HangarScene.ts` (render 3D, pedestal)
- `HangarMenu.ts` (UI, seletores)
- `entities/chassis.ts` (números de chassis: peso, HP, velocidade)
- `combat/weapons.ts` (armas, níveis, dano)
- ADR-002: Híbrido procedural + IA 3D (Gênesis-01 importado)

**Achados (R17):**
- ✅ Link ?build= compartilhável; decodifica igual na entrada
- ⚠️ Mudança de arma sem reload vaza dano (M5 resolve com server auth)

---

## Próximos Passos

**Aberto:**
- Módulos nos ombros (planejado, slots vazios hoje)
- Cosmética (cor, decalque, pintura por parte — FASE 5)
- Sincronização com contas (localStorage → servidor)
- Teste de montagem contra alvo do Hangar (já implementado)

**Bloqueador:**
- Server-authority em tiro (M5; hoje cliente só prediz)

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
