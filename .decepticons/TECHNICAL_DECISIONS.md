# DECISÕES TÉCNICAS — CYBERMECH

Architecture Decision Records (ADRs) de escolhas não-triviais. Versão breve; detalhe completo em `HISTORICO_DE_DECISOES.md`.

---

## ADR-001: Uma Simulação, Cliente + Servidor (G14)

**Data:** 2026-09-23 | **Status:** ✅ Aprovado e em produção

**Contexto:** Multiplayer exige que cliente e servidor rodem as mesmas regras de gameplay para poder reconectar, corrigir previsão e descartar input adulterado.

**Decisão:** `shared/` contém a simulação inteira (`Match.ts`, física, dano, spawn, eventos). Cliente e servidor importam e usam a mesma classe — sem duas implementações.

**Consequências:**
- ✅ Reconexão e previsão triviais; nenhum desvio.
- ✅ Um teste de regra (Node, sem WebGL) cobre cliente e servidor.
- ❌ Testes node-only crescem quando servidor adiciona estado novo (ex.: bosses, spawn progressivo).

**Referência:** `PROTOCOLO_UNIVERSAL.md` [G14].

---

## ADR-002: Híbrido Procedural + IA 3D (Pipeline de Mechs)

**Data:** 2026-09-29 | **Status:** ✅ Aprovado; GÊNESIS-01 v0 em produção

**Contexto:** Procedural puro (`meshKit.ts`) atinge teto visual (formas quadradas). Testes com tanque/barril revelaram limite estilístico, não de capacidade.

**Decisão:** Manter rig/animação/física procedurais. Trocar **geração de malha** por arquivo `.glb` importado (IA 3D: Tripo3D). Rig síncrono no construtor; asset assíncrono no boot.

**Consequências:**
- ✅ Sem reescrita de MechBase.ts, PhysicsWorld.ts ou rede.
- ✅ Gênesis-01 (3.3 MB) baixado sob demanda ao jogar; fallback para procedural.
- ❌ Mais assets na distribuição; orçamento precisa de decisão (delta encoding/Draco/host).
- ⚠️ CSP precisa liberar `blob:` (correção em scripts/site.mjs).

**Referência:** `HISTORICO_DE_DECISOES.md` [29/09, "Decisão revertida"].

---

## ADR-003: Característica Cinemática (sem RigidBody Dinâmico)

**Data:** 2026-09-23 | **Status:** ✅ Em produção

**Contexto:** Destroços (cosméticos) causam divergência entre cliente e servidor se ambos simularem dinamicamente.

**Decisão:** Mech = `KinematicCharacterController` (Rapier). Destroços = static mesh sem corpo (visual só). Rejeitar corpos dinâmicos do raycast e do controller.

**Consequências:**
- ✅ Determinismo garantido (nada afeta movimento além de input + física de chão).
- ✅ Destroços custam 0 na simulação; 0 B/s na rede.
- ❌ Mech remoto nunca roda o controller — só interpola snapshots (arquitetura assimétrica).
- ⚠️ Bug pendente: Mech parado afunda no chão sem limite (ADR futuro).

**Referência:** `PROTOCOLO_UNIVERSAL.md` [G6]; `HISTORICO_DE_DECISOES.md` [29/09, "afundamento real"].

---

## ADR-004: Calor Compartilhado (Dissipador Único)

**Data:** 2026-09-23 | **Status:** ✅ Em produção

**Contexto:** Plasma + foguetes em 2 braços independentes = combo derruba Mech em 0,9 s (tesourada indefensável).

**Decisão:** Um dissipador (`ChassisHeat`) para todas as armas. Disparar plasma + foguetes juntos supera limite de resfriamento antes de terminar.

**Consequências:**
- ✅ Nenhum combo trivial abaixo de 2,5 s.
- ✅ Rajadas rendem mais que gatilho preso (jogador escolhe timing).
- ✅ Realista (calor sai pelo casco, não por arma).
- ❌ MK III de ambos custa muita carga (força build direcionado).

**Referência:** `HANGAR.md` § 4; `combat/balance.ts` testes.

---

## ADR-005: Estado de Rede Binário + Quantizado (M2)

**Data:** 2026-09-23 | **Status:** ✅ Em produção

**Contexto:** Meta de banda: ≤8 KB/s por jogador em sala de 8. Estado contínuo = 19+ bytes × 60 Hz = impossível.

**Decisão:** Estado a 20 Hz (em vez de 60), binário (sem JSON), com delta (só mudança). Posição quantizada (cm), ângulos 16-bit.

**Consequências:**
- ✅ ~6,2 KB/s na sala cheia (dentro do orçamento).
- ✅ Interpolação absorve 50 ms de lag; cliente-side prediction no resto.
- ❌ Sem história completa do estado; regressão impossível.
- ⚠️ Delta encoding não implementado (Fase 7 é AoI + delta).

**Referência:** `PROTOCOLO_UNIVERSAL.md` [G11]; `shared/net/codec.ts` testes.

---

## ADR-006: Servidor Autoritativo, Validação Manual

**Data:** 2026-09-23 | **Status:** ✅ Em produção

**Contexto:** Reconectar e evitar cheating exigem que servidor deciida dano/morte/objetivo.

**Decisão:** Cliente envia `MechInput` (bitmask de teclas + yaw/pitch). Servidor valida sem alocação, com função pura: `Number.isFinite`, clamp, rejeita se inválido.

**Consequências:**
- ✅ Nenhuma alocação por validação (G4).
- ✅ Fácil rastrear cheater (log de input rejeitado).
- ❌ Sem Zod/validador declarativo no caminho quente.
- ⚠️ Autoridade do servidor incompleta em M5 (tiro ainda client-side; precisa ser autorizado).

**Referência:** `PROTOCOLO_UNIVERSAL.md` [G7]; `server/` testes.

---

## ADR-007: Qualidade Adaptativa (G12)

**Data:** 2026-09-23 | **Status:** ✅ Em produção

**Contexto:** GPU integrada + WebGL2, sem WebGPU = múltiplos níveis de fallback.

**Decisão:** FPS < 50 por 2 s → reduz `pixelRatio`, depois desliga bloom. Nunca inverte em meio à partida. Gravação (F9) trava em máximo.

**Consequências:**
- ✅ Jogo não trava; degrada gracefully.
- ✅ Suporta GPU integrada + tela 4K.
- ❌ LCP não medido (métrica importante faltando).
- ⚠️ Rebaixamento automático pode ocorrer durante gameplay; o dono pode desligar.

**Referência:** `PROTOCOLO_UNIVERSAL.md` [G12]; `Quality.ts`.

---

## ADR-008: Contas SQLite Servidor, E-mail + Senha

**Data:** 2026-09-28 | **Status:** ✅ Implementado; UI pendente

**Contexto:** Dono pediu rastreamento de sessão; LGPD e persistência de progressão precisam de identidade.

**Decisão:** `node:sqlite` embutido (sem dependência binária nova como `better-sqlite3`), senha em scrypt, sessão como hash de token aleatório.

**Consequências:**
- ✅ Zero dependência extra (Node 22.12+).
- ✅ Segura: vazamento de DB não vira sessão utilizável.
- ✅ Portável para Supabase depois (sem mudar `Server.ts`).
- ❌ UI de login não existe ainda (Gemini, pendente).
- ⚠️ Progressão ainda em localStorage (próxima migração).

**Referência:** `server/contas.ts` + `shared/net/auth.ts` + testes.

---

## ADR-009: Gravação Nativa de Gameplay (F9)

**Data:** 2026-09-28 | **Status:** ✅ Em produção; UI escondida

**Contexto:** Dono quer vídeos bons para promover; OBS era pesado e fazia o FPS cair.

**Decisão:** `canvas.captureStream(0)` + `MediaRecorder` (VP9/Opus direto). F9 escondido de propósito (recurso interno, não feature de jogador).

**Consequências:**
- ✅ Vídeo nativo sem UI; sem recompor janela do PC.
- ✅ Áudio do próprio jogo já misturado.
- ✅ "Modo captura" trava resolução e desliga rebaixamento automático.
- ❌ Modo captura causa FPS cair se auto-rebaixamento não fosse desligado (achado real, corrigido).
- ⚠️ Headless Chromium (CI) instável para captar quadro (limite do SwiftShader, não do código).

**Referência:** `client/src/core/GameRecorder.ts`; `FERRAMENTAS.md`.

---

## Próximas ADRs para Escrever

- **ADR-010:** Mech parado afunda — correção do character controller (pendente de investigação)
- **ADR-011:** Mech de tripulação — arquitetura de múltiplos operadores (futuro)
- **ADR-012:** Interest Management (AoI) para 32+ jogadores (Fase 7)
- **ADR-013:** Pipeline híbrido — fluxo de novos chassis (decisão em aberto)

---

*Versão 1.0 | 2026-10-01*
