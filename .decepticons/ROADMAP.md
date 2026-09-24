# ROADMAP — Cyber-Mech Protocol

> Visão macro. O detalhe da semana fica em `ESTADO_ATUAL.md`; o estado real das features, em `STATUS_REAL.md`;
> o porquê de cada fase, em `GAME_DESIGN.md`.
> **Ordem decidida pelo dono em 2026-09-23:** combate → inimigos → multiplayer (ver histórico).
>
> **Este arquivo alimenta o painel de missão** (`npm run painel`), e o `npm run check` reprova se ele sair do formato:
> - Fase: `## <emoji> FASE N — Título`; a fase em foco leva `(atual)` no título (só uma).
> - Item: `- [x]` feito, `- [~]` em andamento, `- [ ]` a fazer, terminando com **uma** etiqueta da tabela de frentes.
> - Ideias sem fase ficam em `## 💡 IDEIAS`, com o mesmo formato.

---

## FRENTES

| Etiqueta | Frente | O que cobre |
|---|---|---|
| `#jogabilidade` | Jogabilidade | movimento, câmeras, modos de jogo, sensação de controle |
| `#combate` | Combate e armas | dano, armas, projéteis, retorno de acerto |
| `#ia` | Inimigos e IA | bots, dificuldade, comportamento dos pilotos |
| `#mechs` | Design dos Mechs | classes de Mech, modelos, animação |
| `#cenarios` | Cenários | arenas, destruição, ambientação |
| `#ux` | Interface e experiência | HUD, menus, primeira partida |
| `#som` | Som | efeitos, música, mixagem |
| `#rede` | Multiplayer | servidor, salas, netcode |
| `#desempenho` | Desempenho e resposta | FPS, hardware fraco, tamanho do download |
| `#base` | Base técnica | protocolo, testes, CI, deploy |
| `#negocio` | Lançamento e negócio | viralização, portal, monetização |

---

## ✅ FASE 0 — Fundação
- [x] Vector-09: movimento, pulo duplo, dash, canhão de plasma #jogabilidade
- [x] 3 câmeras (3ª, 1ª, tática) #jogabilidade
- [x] Arena com barricadas destrutíveis e destroços (só cosméticos) #cenarios
- [x] Loop de 60 Hz fixo com render interpolado #base
- [x] Protocolo Serafim UM: memória, hooks, smoke, budget, CI, Vitest #base
- [x] Game design v1 + princípios G11–G15 #negocio
- [x] Engasgo da corrida corrigido com teste #jogabilidade
- [x] (Gemini) Qualidade adaptativa (G12), painel de debug, HUD que some com F1 #desempenho
- [x] Bundle de 1.182 → 188 KB gzip (Rapier com `.wasm` separado) #desempenho

## 🟢 FASE 1 — Combate
- [x] Dano por parte: a parte sai da altura e do lado do impacto na cápsula (sem colisor extra); dano em parte destruída vai para o torso #combate
- [x] Projéteis acertam Mechs; o tiro atravessa destroços (só cosméticos) #combate
- [x] Efeitos: perna = lento, duas pernas = imóvel, braço direito = sem plasma, torso = morte #combate
- [x] Morte com explosão (a carcaça vira destroço) e respawn #combate
- [x] Alvos de treino (Mechs parados) para testar o combate antes dos bots #ia
- [x] Retorno de acerto: marcador, parte destruída anunciada, flash de dano, peça arrancada vira destroço #combate
- [ ] Arma secundária: foguetes no braço esquerdo (botão direito), dano em área #combate
- [x] Testes de simulação para cada regra de dano (G14) #base
- [ ] Custo de render por Mech: ~34 draw calls cada. Juntar a geometria por material antes do multiplayer (G5) #desempenho

## 🟡 FASE 2 — Inimigos (atual)
- [x] `BotController`: gera o mesmo `MechInput` que o jogador (patrulha, persegue, atira, recua) #ia
- [x] Visão por raycast, erro de mira e tempo de reação por dificuldade, RNG com semente (G2) #ia
- [x] Jogador morre e renasce; renascimento longe dos inimigos (`Respawner`) #combate
- [x] HUD do próprio Mech (6 partes), borda de dano, tela "ABATIDO", abates/mortes #ux
- [x] Painel de missão do projeto, gerado deste arquivo #base
- [x] Site do projeto: jogo + painel em selvamkt.com.br/cybermech, publicado a cada merge ("build do dia") #base
- [ ] Rodada de 5 min com placar e reinício automático #jogabilidade
- [x] Blind Mode (cabeça destruída) #ux
- [x] Níveis de dificuldade: fácil, normal (a de hoje, aprovada pelo dono) e difícil, trocáveis durante a partida #ia
- [x] Configurações (contrato + aplicação no jogo): sensibilidade, inverter Y, campo de visão, qualidade, dificuldade, painel de desempenho, teclas remapeáveis; salvas no navegador #ux
- [ ] Tela de configurações (Gemini, sobre o contrato `core/Settings.ts`) #ux

## 🟠 FASE 3 — Multiplayer autoritativo
- [ ] Separar `MechBase` em simulação (sem render) e visual; `shared/` com simulação, `MechInput` e validador (G7) #rede
- [ ] `server/` com Colyseus: `ArenaRoom` para 8, simulação a 60 Hz, estado a 20 Hz com delta (G11); bots completam salas #rede
- [ ] Cliente: prediction + reconciliação do Mech local; Mechs remotos interpolam #rede
- [ ] Entrada pelo link com código da sala + apelido; reconexão automática (G13) #rede
- [ ] Medir banda por sala e tick do servidor contra as metas do G11 e do G14 #desempenho
- [ ] Prova R16: 2+ clientes reais com latência simulada; playtest pelo PC de casa + Cloudflare Tunnel #rede

## 🔵 FASE 4 — Lançamento e viralização
- [ ] Modo streamer: sala de código fixo, câmera de espectador #negocio
- [ ] Servidor de jogo no ar (Oracle Always Free São Paulo ou outro; ver `DEPLOY.md`) #base
- [ ] SDK do portal (CrazyGames/Poki), anúncio só entre rodadas #negocio
- [ ] Métrica: D1 e rodadas por sessão #negocio

## 🔴 FASE 5 — Monetização e conteúdo
- [ ] Contas + cosméticos (nunca atributo de combate) + pagamento + LGPD #negocio
- [ ] Colossus-01 (demolição no dash) e Ferret-X (gancho + sucata) #mechs
- [ ] Mais arenas #cenarios
- [ ] Passe de temporada (se houver tração) #negocio

## 💡 IDEIAS
> Sem fase ainda: o dono prioriza. Propostas do Claude em 2026-09-23, a partir das frentes citadas pelo dono.
- [ ] Efeitos sonoros: tiro, impacto, passos pesados, explosão (sintetizados, sem arquivos pesados) #som
- [ ] Música que acompanha a intensidade do combate #som
- [ ] Pilotos com personalidade: agressivo, franco-atirador, cauteloso #ia
- [ ] Bots contra bots no modo todos contra todos #ia
- [ ] Parte avariada solta faísca e fumaça antes de cair #mechs
- [ ] Pintura e decalques por jogador (base dos cosméticos) #mechs
- [ ] Prédios que desmoronam em partes, não só barricadas #cenarios
- [ ] Tela inicial com apelido e escolha de Mech #ux
- [ ] Suporte a controle (gamepad) #jogabilidade
- [ ] Volume e mixagem nas configurações (junto com o som) #som
- [ ] Recuo e tremor próprios de cada arma #jogabilidade
- [ ] Medir o FPS numa GPU integrada real (meta do G12) #desempenho
- [ ] Issues do GitHub como rastreador de bugs, com severidade (trava > bloqueia > grave > leve) e passos para reproduzir #base
- [ ] Teste noturno: bots jogando sozinhos no navegador headless para achar travamentos e erros #base
- [ ] Dependências no painel: mostrar o que trava o quê entre frentes #base
