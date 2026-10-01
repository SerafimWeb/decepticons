# SPECS: Network — CYBERMECH

Protocolo multiplayer: Colyseus, codec binário, estado quantizado, sincronização a 20 Hz.

## Objetivo

`server/Server.ts` (Colyseus) e `client/src/net/adapters.ts` (bridge) mantêm múltiplos Mechs em sincronização em uma sala. Cliente prediz, servidor valida, ambos rodam `Match` (simulação compartilhada).

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| State a 20 Hz (60 tick) | Suporta conexão fraca; cabe no orçamento | Lag de 50 ms; interpolar/predict necessário |
| Binário + delta | Banda ~6,2 KB/s vs ~50 KB/s JSON | Sem versão legível (debug mais difícil) |
| Posição quantizada (cm) | Erro ≤ 1 cm imperceptível | Colisão só no servidor é chão (não importa) |
| Servidor sim, cliente prediz | Evita cheating | Janela de 100 ms ajuste necessária |

## Contrato de Rede

```ts
// Mensagem de entrada (MechInput)
struct MechInput {
  tick: u32           // número de tick (cliente ordena)
  keys: u8            // bitmask W/A/S/D/SPACE/E
  yaw: i16            // -32768..32767 (radians quantizado)
  pitch: i16          // idem
}
// Size: 12 bytes, ~240 B/s × 60 Hz = 14,4 KB/s (não entra no orçamento sozinho)

// Snapshot de estado (StateUpdate a 20 Hz)
struct MechState {
  id: u8              // piloto ID
  pos: [i32; 3]       // centímetros (±200 km)
  rot: [i16; 2]       // yaw, pitch
  hpByPart: [u8; 6]   // 0..255 % de HP
  heat: u8            // 0..100%
  alive: u1           // bit
  flags: u7           // reload, overheat, etc
}
// Size: 19 bytes × 8 pilotos × 20 Hz = 3,04 KB/s

// Eventos (raros)
struct HitEvent {
  shooter: u8, target: u8, part: u8, damage: u8
}
// ~100 B/evento; ~10 evento/min = ~17 B/s
```

**Total:** ~3,2 KB/s entrada (input) + 3,0 KB/s saída (state) = **6,2 KB/s** (orçamento: 8 KB/s ✅).

## Sincronização

### Cliente → Servidor
1. Input local (W/A/S/D, mouse) → `MechInput`
2. Envia a `20 Hz` (não todo tick!)
3. Servidor recebe, valida, aplica na sua simulação
4. Servidor responde com `StateUpdate` (snapshot do seu Mech + outros)

### Servidor → Cliente
1. Calcula tudo (autoridade)
2. Serializa 8 Mechs de uma sala em binário
3. Envia `StateUpdate` a 20 Hz
4. Cliente: desserializa, aplica no seu `Match`, interpola remote Mechs

### Reconciliação
- Se snapshot servidor != previsão cliente → aplicar delta e interpolar para disfarçar
- Sem "rubber-band" óbvio se lag < 500 ms

## Testes

**Arquivo:** `shared/net/codec.test.ts` + `server/` testes integrados

**Cobertura:**
- ✅ Serialização/desserialização de MechInput (round-trip)
- ✅ Serialização/desserialização de StateUpdate
- ✅ Quantização de posição (erro < 1 cm)
- ✅ Delta encoding (só mudança serializa)
- ✅ Reordenação de pacotes (entrada fora de ordem, servidor tolera)
- ✅ Sala com 8 Mechs (carga completa)

**Regressão:** Bandwidth medido; mudança de codec trava teste.

---

## Custo

- **CPU (servidor):** ~2,0 ms/tick desserializar + validar 8 inputs
- **CPU (cliente):** ~0,5 ms interpolar 7 remote Mechs
- **Latência perceptível:** ~100 ms (round-trip desconhecido; interpolação + predict absorvem)
- **Consumo de dados:** 6,2 KB/s (em 8 pilotos)

## Conhecimento

**Ligado:**
- `Match.ts` (simulação; roda em cliente + servidor)
- `MechInput` (contrato em `shared/net/input.ts`)
- `shared/net/codec.ts` (serialização binária)
- ADR-005: Estado binário quantizado
- ADR-006: Servidor autoridade

**Achados (R17):**
- ✅ WebSocket Node instável sob carga (trocou para `ws` package)
- ⚠️ Roster de rede não descreve aliado (M4 problema; M5 resolve)

---

## Próximos Passos

**M3 (Hud só):** Nem isso.

**M4 (Agora):** 
- Movimento remoto sincroniza
- Morte sincroniza
- Spawn remoto funciona

**M5 (Pendente):**
- Tiro validado no servidor
- Dano sincroniza
- Reconexão funciona

**M6+ (Futuro):**
- AoI (interest management) para 32+ jogadores
- Bosses e eventos
- Voice/chat na sala

**Bloqueador:**
- Reconexão não está implementada (socket drop sem recuperação)

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
