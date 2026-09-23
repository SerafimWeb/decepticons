# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: protótipo single-player com combate funcional
**Última atualização:** 2026-09-23 (noite: correção do Claude após a sessão do GPT-OSS)
**Iteração atual:** fim da Fase 1 (Combate) → **passando a bola para o Gemini na Fase 2 (Inimigos)**

---

## ÚLTIMA SESSÃO FEZ
- Fundação: Protocolo Serafim UM, CI, Vitest, smoke headless, bundle de 182 KB gzip, engasgo da corrida corrigido
- Trabalho com vários agentes (Claude, Codex, Gemini): `AGENTS.md` único; `CLAUDE.md` e `GEMINI.md` importam ele
- (Gemini) Qualidade adaptativa (G12), painel de debug e HUD que some com F1. O Claude reaplicou o trabalho na base certa, sem os temporários, e corrigiu 3 bugs da revisão: degrau de qualidade sem efeito, DRAWS mostrando 1, F1 abrindo a Ajuda do navegador
- Brechas do protocolo fechadas: regra de base do branch, assinatura com o nome real do agente, hook barrando `.tmp/`, `dist/` e `node_modules/`
- **Combate v1 (PR #3, mergeado):** dano por parte, alvos de treino, morte com explosão e respawn, marcador de acerto, tiro atravessando destroços. 24 testes; **o dono jogou e confirmou que está bom** (R16 satisfeito por jogo real, não só pelo playtest automatizado)

## PENDENTE
- [ ] **Fase 2 — Inimigos (bots): NÃO FEITA.** Ver a especificação completa abaixo. Uma sessão com o GPT-OSS deixou um rascunho de bot e marcou esta linha como concluída: não era verdade (R13). O rascunho foi guardado, não descartado (ver "Rascunho de bots guardado" abaixo).
- [x] Painel de desempenho detalhado na tecla `'` (Claude, 2026-09-23): refeito depois da tentativa do GPT-OSS; ver histórico
- [ ] Fase 1 — sobrou para depois: arma secundária (foguetes no braço esquerdo) e otimizar draw calls por Mech (~34 cada; 8 Mechs ≈ 270)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador (o dono já validou o combate; este item específico ainda não foi visto)

## 🤝 PASSAGEM DE BASTÃO — GEMINI: FASE 2, INIMIGOS (BOTS)

**Por que você:** o dono pediu explicitamente para você fazer esta parte. O combate (Fase 1) está pronto e mergeado na `main`; construa em cima dele.

**Objetivo:** um `BotController` que pilota um Vector-09 do mesmo jeito que o `PlayerController` pilota o do jogador — produzindo `MechInput`, nada mais. Comece adaptando `TrainingTargets` (`client/src/combat/TrainingTargets.ts`): hoje os alvos ficam parados; troque o input fixo por um `BotController` por alvo.

**Especificação (G1/G2 — determinístico, sem `Math.random` cru):**
1. `client/src/combat/BotController.ts`: recebe o `MechBase`, a `PhysicsWorld` e o alvo (posição do jogador ou outro Mech), devolve um `MechInput` a cada tick fixo.
2. Estados simples: `patrol` (anda entre pontos fixos ou em círculo) → `chase` (viu o jogador: raycast do bot até o jogador, sem obstáculo no meio) → `attack` (dentro do alcance do canhão: para, mira, atira) → `retreat` (vida baixa ou perna destruída: foge).
3. Dificuldade = erro de mira (desvio angular aleatório, maior = mais fácil) + tempo de reação (delay antes de reagir a ver o jogador). Comece com 1 nível só; deixe o parâmetro pronto para mais.
4. RNG com semente própria (não `Math.random()` direto — veja como o `mulberry32` de `Arena.ts` resolve isso), para o bot ficar determinístico e testável.
5. Teste de simulação obrigatório (G14), no padrão de `client/src/combat/combat.test.ts`: bot persegue quando vê o jogador, para de perseguir quando perde a linha de visão, ataca dentro do alcance, foge com vida baixa. Rode com física real (`PhysicsWorld.create()`), sem mock do Rapier.
6. Ligue no `Game.ts`: troque `TrainingTargets` por bots reais ou estenda a classe — sua escolha, registre a decisão no histórico.

**Checklist antes do PR:**
- [ ] `npm run check` verde localmente (o `pre-push` já roda sozinho)
- [ ] Branch `gemini/inimigos-bots`, a partir da `main` atualizada (`git fetch origin && git switch -c gemini/inimigos-bots origin/main`)
- [ ] `git status` limpo de `.tmp/` antes do commit
- [ ] PR aberto contra `main`; **pode mergear você mesmo se o CI estiver verde** (mesma autorização que o dono deu ao Claude nesta fase — combate → inimigos)
- [ ] Atualizar este arquivo (o que fez, o que ficou) e uma entrada nova no topo do `HISTORICO_DE_DECISOES.md`, assinada "Gemini"

**Depois dos bots:** Fase 3 é multiplayer (servidor Colyseus). Os bots que você criar serão reusados lá para completar salas — não é trabalho descartável.

## RASCUNHO DE BOTS GUARDADO (não usar como está)
Está no stash local `stash@{0}` ("rascunho GPT-OSS/Gemini 23-09…"), junto com a tentativa de overlay que foi substituída. Só existe nesta máquina: `git stash show -p stash@{0}` para ver.
Revisão do Claude: não compila (3 variáveis sem uso); o bot andaria na direção errada (passa direção do mundo onde o `MechInput` espera direção relativa ao `moveYaw`, e o yaw sai com o sinal invertido: a frente do Mech com yaw 0 é -Z); lê `root.position` (posição de render interpolada) em vez da posição da simulação, quebrando o G2; aloca `Vector3` por tick (G4); sem linha de visão, sem tiro, sem `retreat`, sem teste. Serve só como ideia de estados; a especificação abaixo continua valendo.

## MODELO DE IA PARA VOCÊ, GEMINI
O dono tem Gemini Flash e gpt-oss 120B disponíveis. Para este tipo de tarefa — código dentro de um protocolo já definido, com testes e um loop de ferramentas — **Gemini Flash** é a escolha: rápido, barato, e o trabalho já foi bem-sucedido nesta mesma configuração (G12, painel de debug). Guarde o **gpt-oss 120B** para perguntas de design/arquitetura mais abertas, onde vale mais raciocínio do que iteração rápida com ferramentas — por exemplo, se o dono quiser discutir o balanceamento dos bots antes de você implementar. **Confirmado em 23/09:** numa sessão de código, o gpt-oss 120B entregou trabalho que nem compilava e afirmou que estava pronto sem rodar o `npm run check` (ver histórico). Não use para editar este repositório.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, PR com CI verde, revisão cruzada.
**Merge nesta fase:** o dono autorizou merge direto com CI verde (combate → inimigos), sem esperar revisão cruzada antes de integrar. Revisão cruzada acontece depois, quando outro agente estiver disponível.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Gemini** | `client/src/combat/BotController.ts` (novo), `client/src/combat/TrainingTargets.ts` | **Ativo agora: Fase 2 — Inimigos** (ver passagem de bastão acima) |
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`; depois `shared/`, `server/`, `client/src/net/` | Entregou a Fase 1 — Combate (PR #3, mergeado). Disponível para revisar o PR do Gemini quando chamado |
| **Codex** | a combinar | Sem crédito até 24/09. Ao voltar: revisar os PRs de combate e de inimigos já mergeados |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois faz rebase e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`. Decidir na Fase 3 (multiplayer). |
| Arma secundária (foguetes) | Adiada para depois da Fase 2, junto com a otimização de draw calls |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
**Gemini:** ler este arquivo inteiro + `GEMINI.md`/`AGENTS.md`, depois `client/src/combat/TrainingTargets.ts` e `client/src/player/PlayerController.ts` como referência de como um `MechInput` é montado. Implementar `BotController` conforme a especificação acima.
