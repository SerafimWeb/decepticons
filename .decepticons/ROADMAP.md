# ROADMAP — Cyber-Mech Protocol

> Visão macro. O detalhe da semana fica em `ESTADO_ATUAL.md`; o estado real das features, em `STATUS_REAL.md`;
> o porquê de cada fase, em `GAME_DESIGN.md`.
> **Ordem decidida pelo dono em 2026-09-23:** combate → inimigos → multiplayer (ver histórico).

---

## ✅ FASE 0 — Fundação (concluída em 2026-09-23)
- [x] Vector-09: movimento, pulo duplo, dash, canhão de plasma
- [x] 3 câmeras (3ª, 1ª, tática)
- [x] Arena com barricadas destrutíveis e destroços (só cosméticos)
- [x] Loop de 60 Hz fixo com render interpolado
- [x] Protocolo Serafim UM: memória, hooks, smoke, budget, CI, Vitest
- [x] Game design v1 + princípios G11–G15
- [x] Engasgo da corrida corrigido com teste
- [x] (Gemini) Qualidade adaptativa (G12), painel de debug, HUD que some com F1

## 🟢 FASE 1 — Combate (atual)
- [x] Dano por parte: a parte sai da altura e do lado do impacto na cápsula (sem colisor extra); dano em parte destruída vai para o torso
- [x] Projéteis acertam Mechs; o tiro atravessa destroços (só cosméticos)
- [x] Efeitos: perna = lento, duas pernas = imóvel, braço direito = sem plasma, torso = morte (braço esquerdo = sem foguete: junto com os foguetes)
- [x] Morte com explosão (a carcaça vira destroço) e respawn
- [x] Alvos de treino (Mechs parados) para testar o combate antes dos bots
- [x] Feedback: marcador de acerto, parte destruída anunciada, flash de dano, peça arrancada vira destroço
- [ ] Arma secundária: foguetes no braço esquerdo (botão direito), dano em área
- [x] Testes de simulação para cada regra de dano (G14)
- [ ] Custo de render por Mech: ~34 draw calls cada (8 Mechs ≈ 270). Juntar a geometria por material antes do multiplayer (G5)

## 🟡 FASE 2 — Inimigos (bots)
- [x] `BotController`: gera o mesmo `MechInput` que o jogador (patrulha, persegue, atira, recua)
- [x] Visão por raycast, erro de mira e tempo de reação por dificuldade, RNG com semente (G2)
- [x] Jogador morre e renasce; renascimento longe dos inimigos (`Respawner`)
- [x] HUD do próprio Mech (6 partes), borda de dano, tela "ABATIDO", abates/mortes
- [ ] Blind Mode (cabeça destruída)
- [ ] Níveis de dificuldade (fácil/difícil) sobre o `BotSkill`
- [ ] Rodada de 5 min com placar e reinício automático

## 🟠 FASE 3 — Multiplayer autoritativo
- [ ] Separar `MechBase` em simulação (sem render) e visual; `shared/` com simulação, `MechInput` e validador (G7)
- [ ] `server/` com Colyseus: `ArenaRoom` para 8, simulação a 60 Hz, estado a 20 Hz com delta (G11); bots completam salas
- [ ] Cliente: prediction + reconciliação do Mech local; Mechs remotos interpolam
- [ ] Entrada pelo link com código da sala + apelido; reconexão automática (G13)
- [ ] Medir banda por sala e tick do servidor contra as metas do G11 e do G14
- [ ] Prova R16: 2+ clientes reais com latência simulada; playtest pelo PC de casa + Cloudflare Tunnel

## 🔵 FASE 4 — Lançamento e viralização
- [ ] Modo streamer: sala de código fixo, câmera de espectador
- [ ] Deploy: cliente na Hostinger (ou no portal) + servidor na Oracle Always Free São Paulo (ver `DEPLOY.md`)
- [ ] SDK do portal (CrazyGames/Poki), anúncio só entre rodadas
- [ ] Métrica: D1 e rodadas por sessão

## 🔴 FASE 5 — Monetização e conteúdo
- [ ] Contas + cosméticos (nunca atributo de combate) + pagamento + LGPD
- [ ] Colossus-01 (demolição no dash) e Ferret-X (gancho + sucata)
- [ ] Mais arenas, áudio, passe de temporada (se houver tração)
