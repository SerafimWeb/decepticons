# ESTADO ATUAL — Cyber-Mech Protocol

**Status:** 🟡 EM DESENVOLVIMENTO: single-player jogável contra bots, no ar em https://www.selvamkt.com.br/cybermech/
**Última atualização:** 2026-09-24 (tarde)
**Iteração atual:** Fase 3 (Vitrine e polimento): som, celular, kill feed e o site com o case; depois a Fase 4 (multiplayer)

---

## ÚLTIMA SESSÃO FEZ (24/09)
> As sessões anteriores estão no `HISTORICO_DE_DECISOES.md` (cofre) e nas entregas dos bastidores.
- **Site em duas páginas (Claude, pedido do dono: "virar um case de desenvolvimento do game"):**
  - `/cybermech/` é a landing do jogo: capa, galeria, o que tem no jogo (seção VITRINE do `GAME_DESIGN`), ficha do Vector-09, controles, sem pay-to-win, o que está sendo construído.
  - `/cybermech/bastidores/` é o case: equipe (entregas e linhas por agente, das etiquetas dos PRs), como um pedido vira jogo, Protocolo Serafim UM, evolução (testes e linhas por merge, lidos do git), mapa da campanha, frentes, diário de decisões e entregas.
  - **Capturas automáticas:** o deploy entra no jogo headless, joga ~20 s e fotografa as três câmeras. As fotos viram a capa, a galeria e a prévia do link.
  - Conferido em produção (PR #19): capturas feitas pelo runner do CI, entregas lidas do GitHub.
- **Celular (Gemini, PR #17):** controles de toque no ar; ainda não conferidos num celular real
- **Planejamento reorganizado (pedido do dono):** nova **Fase 3: Vitrine e polimento** (som, celular, kill feed, site com o case, foguetes, draw calls). O multiplayer passou a ser a Fase 4. Fases 0, 1 e 2 fechadas
- **Gestão no GitHub (Claude):** cada PR ganha sozinho as etiquetas da frente (pelos arquivos) e do agente (pelo branch): `.github/labeler.yml` + workflow `etiquetas.yml`. Os 17 PRs antigos foram etiquetados. Modelo de PR (o que muda, custo de CPU, como testar no site) e notas de versão agrupadas por frente (`.github/release.yml`)
- **Acentos quebrados no site corrigidos (Claude):** a página saía sem `<!doctype>` e `<meta charset>`; o check agora reprova charset errado, modo quirks e o codinome interno na página pública
- **Som (Gemini, PR #15):** efeitos sintetizados na Web Audio API, sem arquivos: tiro, impacto, explosão com volume por distância, dash, pouso, parte destruída e chiado do Blind Mode
- **Tela de configurações (Gemini) e estande de calibração do mouse (Claude):** no ar. A escala da sensibilidade mudou: 1,00x ≈ 25 cm por volta a 800 DPI
- **Regra 13:** agente termina com PR → CI verde → merge, e o merge publica o site sozinho

## PENDENTE
- [ ] **Gemini:** atualizar o `STATUS_REAL` e o `ROADMAP` quando entregar (o PR #17 entrou sem mexer neles; o Claude marcou como PARCIAL)
- [ ] **Gemini:** o kill feed está no branch `gemini/killfeed-dano` sem PR; abrir o PR (regra 13) depois de juntar a `main`
- [ ] **Dono:** testar no site as configurações, a calibração do mouse, o som e os controles de toque num celular
- [ ] Fase 3: foguetes (arma secundária), draw calls por Mech (~34 cada), volume e mixagem nas configurações
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12, painel de debug, Blind Mode, tela de configurações e som). Costuma esquecer o PR: conferir se o branch virou PR.
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, cada agente na sua pasta (regra 12), PR com CI verde e merge pelo próprio agente (regra 13). As etiquetas do PR dizem a frente e o agente.
**Merge nesta fase:** o dono autorizou merge direto com CI verde. A revisão cruzada acontece depois.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | Site no ar (landing + bastidores). Próximo, a escolher pelo dono: foguetes, draw calls ou volume/mixagem |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Kill feed (branch sem PR); celular (PR #17) e som no ar |
| **Codex** | a combinar | Ao voltar: revisão cruzada dos PRs mergeados desde o #12 |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois junta a `main` e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| Hospedagem do servidor | Recomendação em `DEPLOY.md`. Decidir na Fase 4 (multiplayer). |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. |

## BLOQUEIOS
- Nenhum.

## PRÓXIMA SESSÃO COMEÇA COM
Gemini: juntar a `main` no kill feed e mergear (regra 13). Claude: conferir o site publicado e seguir para foguetes ou draw calls. Dono: testar o som, as configurações e a calibração no site.
