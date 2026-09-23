# ROADMAP — Cyber-Mech Protocol

> Visão macro. O detalhe da semana fica em `ESTADO_ATUAL.md`; o estado real das features, em `STATUS_REAL.md`;
> o porquê de cada fase, em `GAME_DESIGN.md`.

---

## ✅ FASE 0 — Protótipo single-player (concluída em 2026-09-23)
- [x] Vector-09: movimento, pulo duplo, dash, canhão de plasma
- [x] 3 câmeras (3ª, 1ª, tática)
- [x] Arena com barricadas destrutíveis e destroços (só cosméticos)
- [x] Loop de 60 Hz fixo com render interpolado
- [x] Protocolo Serafim UM: memória, hooks, smoke, budget, CI, Vitest
- [x] Game design v1 + princípios G11–G14
- [x] Engasgo da corrida corrigido com teste

## 🟢 FASE 1 — Multiplayer autoritativo (atual)
- [ ] Separar `MechBase` em simulação (sem render) e visual (rig, animação, interpolação)
- [ ] Criar `shared/` com a simulação, `MechInput` e o validador de input (G7); `tsconfig` cobrindo `client/`, `shared/`, `server/`
- [ ] `server/` com Colyseus: `ArenaRoom` para 8, simulação a 60 Hz, estado a 20 Hz com delta (G11)
- [ ] Cliente: prediction + reconciliação do Mech local; Mechs remotos interpolam
- [ ] Entrada pelo link com código da sala + apelido (sem lobby)
- [ ] Reconexão automática e aviso "reconectando…" (G13)
- [ ] Decidir se o tiro atravessa destroços (o servidor não terá destroços)
- [ ] Medir banda por sala e tick do servidor contra as metas do G11 e do G14
- [ ] Prova R16: 2+ clientes reais com latência simulada; playtest pelo PC de casa + Cloudflare Tunnel

## 🟡 FASE 2 — Combate (o diferencial)
- [ ] Hitbox por parte e dano modular (perna = lento, cabeça = cego, braço = sem arma)
- [ ] Morte, respawn rápido, rodada de 5 min com placar e reinício automático
- [ ] Qualidade adaptativa (G12) e painel de debug leve (tick, banda, draw calls)

## 🟠 FASE 3 — Lançamento e viralização
- [ ] Modo streamer: sala de código fixo, câmera de espectador, HUD que some com uma tecla
- [ ] Deploy: cliente na Hostinger (ou no portal) + servidor na Oracle Always Free São Paulo (ver `DEPLOY.md`)
- [ ] SDK do portal (CrazyGames/Poki), anúncio só entre rodadas
- [ ] Métrica: D1 e rodadas por sessão

## 🔴 FASE 4 — Monetização e conteúdo
- [ ] Contas + cosméticos (nunca atributo de combate) + pagamento + LGPD
- [ ] Colossus-01 (demolição no dash) e Ferret-X (gancho + sucata)
- [ ] Mais arenas, áudio, passe de temporada (se houver tração)
