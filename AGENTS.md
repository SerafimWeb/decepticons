# AGENTS.md — CYBERMECH (codinome DECEPTICONS)

> Instruções para qualquer agente de código: Codex lê este arquivo direto; Claude Code e Gemini leem pelo `CLAUDE.md`
> e pelo `GEMINI.md`, que importam este. **Fonte única**: não duplique estas regras em outro lugar.
> Ativa o Protocolo Serafim UM v4.2. Não edite sem registrar no `.decepticons/HISTORICO_DE_DECISOES.md`.

## PROTOCOLO SERAFIM UM

Todo agente trabalha sob o **Protocolo Serafim UM v4.2**: memória persistente, as 17 regras absolutas (R1–R17)
e o ritual de sessão abaixo (Passo Zero na entrada, Encerramento na saída).
- Regras gerais: `.decepticons/PROTOCOLO_SERAFIM_UM.md`, **cópia de referência, não editar**. A canônica fica em
  `D:\SERAFIMHUB\serafim13\protocolo-serafim-um\`; quando a versão mudar, a cópia é substituída inteira.
- Como cada regra se aplica aqui, e as specs do jogo (G1–G15): `.decepticons/PROTOCOLO_UNIVERSAL.md`.
- Os hooks aplicam parte do protocolo sozinhos: sem `ESTADO_ATUAL.md` atualizado não há commit (M5); secret no diff bloqueia (R2); push roda o check (R15).

## PASSO ZERO — ANTES DE QUALQUER AÇÃO

1. `.decepticons/IDENTITY.md`: o que é, stack, restrições
2. `.decepticons/ESTADO_ATUAL.md`: onde parou, pendências, **divisão de trabalho entre agentes**
3. `.decepticons/ROADMAP.md`: fases
4. `.decepticons/VISAO.md`: o norte de longo prazo (editável só pelo dono). Depois: `GAME_DESIGN.md`, o jogo, as decisões de design e o plano de viralização (Hangar: `HANGAR.md`; multiplayer: `MULTIPLAYER.md`)
5. `.decepticons/PROTOCOLO_UNIVERSAL.md`: regras e specs de engenharia (G1–G15)
6. Build, CI, hospedagem ou deploy? Leia `.decepticons/DEPLOY.md` antes. Site: `www.selvamkt.com.br/cybermech/`, publicado a cada merge na `main`. **Nunca publique fora de `/cybermech/`** (a raiz é o site real da Selva MKT) e não invente host, caminho ou secret.
7. Gravação de gameplay (F9), a mesa de vídeo (`/mesa`, em `.tmp/video/`) ou outra ferramenta acessória do dono? Leia `.decepticons/FERRAMENTAS.md` antes de mexer — evita redescobrir achados já registrados (ex.: o Mech parado que afunda no chão).
7. Vai afirmar que uma feature funciona? Confira `.decepticons/STATUS_REAL.md`.

## O QUE É

Shooter de Mechs multiplayer para o navegador: Vite 8 + TypeScript 7 strict + Three.js + Rapier3D (Wasm SIMD). Hoje é um protótipo single-player; o servidor Colyseus está planejado.

## REGRAS QUE MAIS PESAM AQUI

As specs completas estão em `PROTOCOLO_UNIVERSAL.md`; este é só o índice.
- **Performance primeiro:** CPU baixa com muitos jogadores. Explique o custo de CPU de cada feature.
- **G1/G2:** gameplay só no tick fixo de 60 Hz, determinístico (sem `Math.random`, `Date.now` ou DOM na simulação).
- **G3:** feature nova = módulo independente, ligado em `client/src/core/Game.ts` por callbacks.
- **G4/G5:** zero `new` por frame ou tick; pools, `InstancedMesh`, tetos explícitos.
- **G6:** Mech remoto nunca roda o character controller.
- **G9:** importe sempre `@dimforge/rapier3d-simd-compat`; o `vite.config.ts` faz o alias para o browser. As duas versões do Rapier andam juntas.
- **G11–G13:** metas de rede (≤ 8 KB/s de download por jogador, estado a 20 Hz), requisito mínimo = GPU integrada, servidor autoritativo com reconexão.
- **G14:** uma simulação só (`shared/`); **toda regra de gameplay tem teste de simulação** (modelo: `client/src/entities/MechBase.test.ts`).
- **G15 (regra do dono):** nada salvo fora da pasta do projeto. Temporários, experimentos, capturas e repositórios de teste vão só para `.tmp/` (ignorado pelo git), nunca para o temp do sistema, outra pasta ou outro drive.
- **R2:** nada de secret em arquivo versionado. **R3:** nada de `_v2`, `_old`, `_bkp`.
- **R13:** o que não funciona de ponta a ponta fica marcado como DEMO ou AUSENTE em `STATUS_REAL.md`.
- **R17:** achou bug ou desalinhamento durante a tarefa? Corrija se for barato e seguro; senão, registre.

## TRABALHO COM VÁRIOS AGENTES (Claude, Codex, Gemini, Qwen…)

O projeto é desenvolvido em partes por agentes diferentes (hoje: Claude, Codex, Gemini e Qwen). Estas regras evitam que um desfaça o trabalho do outro. Valem para qualquer agente, inclusive um que não esteja nesta lista.

1. **Uma fonte de verdade:** este arquivo + `.decepticons/`. O que ficou só no chat ou na memória de um agente não existe para o outro. Decidiu algo? Escreva no repositório.
2. **Uma tarefa = um branch = um PR.** Prefixo = o seu nome real: `claude/…`, `codex/…`, `gemini/…`, `qwen/…`. Nunca commit direto em `main`; nunca dois agentes no mesmo branch.
3. **Base do branch: sempre a `main` atualizada.** `git fetch origin && git switch -c <agente>/<tarefa> origin/main`. Precisa de algo que está num PR aberto? Peça o merge ao dono antes; não parta do branch de outro agente. (Em 23/09 um branch saiu da base errada e levou temporários para o commit.)
4. **Território:** cada agente mexe só nos arquivos da tarefa dele (divisão atual no `ESTADO_ATUAL.md`). Precisa mudar algo fora? Faça num PR pequeno separado, ou deixe registrado como pendência.
5. **Contrato antes de paralelizar:** interfaces que vários usam (`MechInput`, schema de estado, mensagens de rede) são definidas e mergeadas primeiro; depois cada um trabalha contra elas.
6. **O CI decide:** PR só entra com `npm run check` verde. Teste de simulação é o árbitro técnico entre os agentes (G14). **Nunca diga que algo está pronto sem rodar o `npm run check`:** o `npm run dev` aceita código que o build rejeita (em 23/09 um CSS quebrado rodava no dev, apagava a mira e não compilava no build).
7. **Revisão cruzada:** o PR de um agente é revisado por outro (evita a IA aprovando o próprio código). O merge é do dono, ou de quem ele autorizar (registrado no `ESTADO_ATUAL.md`).
8. **Assine com o seu nome real** no histórico, no estado e no branch, mesmo que você não esteja listado aqui.
9. **Passagem de bastão:** ao terminar, atualize `ESTADO_ATUAL.md` (o que foi feito, o que ficou, "próxima sessão começa com"), marque os itens no `ROADMAP.md` (cada item com a etiqueta da sua frente: é o que alimenta o painel de missão) e registre decisões no topo do `HISTORICO_DE_DECISOES.md`.
10. **Discordou de algo registrado?** Não desfaça em silêncio. Proponha em "decisões em aberto" no `ESTADO_ATUAL.md`; o dono decide.
11. **Antes do commit, olhe o `git status`.** O hook barra arquivos de `.tmp/`, `dist/` e `node_modules/`, e barra secrets.
12. **Dois agentes ao mesmo tempo? Cada um na sua pasta.** O Git tem um branch ativo por pasta: um `git switch` de um agente muda os arquivos do outro, e um `git add -A` leva o trabalho alheio. Quem chega depois cria um worktree dentro do projeto (G15): `git worktree add .tmp/wt-<agente> -b <agente>/<tarefa> origin/main`, liga as dependências (PowerShell: `New-Item -ItemType Junction -Path .tmp\wt-<agente>\node_modules -Target node_modules`) e trabalha só lá. (Em 24/09 Claude e Gemini trabalharam na mesma pasta; o trabalho foi separado sem perda.)
13. **Do PR ao site, sem esperar ninguém (autorizado pelo dono nesta fase).** Tarefa pronta só conta quando chega ao site. Ao terminar: `gh pr create` com o corpo no modelo `.github/pull_request_template.md` (o que muda, custo de CPU, como testar no site) → `gh pr checks --watch` (CI verde; **o check precisa já existir**: logo depois do `gh pr create` o `--watch` volta na hora, sem check nenhum, e o merge sairia com o CI rodando. Espere a linha `check` aparecer em `gh pr checks` antes) → `gh pr merge --merge --delete-branch`. As etiquetas de frente e de agente entram sozinhas. O merge na `main` publica o jogo e o painel em `www.selvamkt.com.br/cybermech/` sozinho, em poucos minutos: é lá que o dono testa. Branch empurrado sem PR não chega a lugar nenhum. A revisão cruzada acontece depois do merge.
14. **Entrega só conta quando está na `main`.** Branch não publica, PR aberto não publica — só o merge publica (o deploy é automático). No `ESTADO_ATUAL.md`, o que ainda não está na `main` mora em **"EM BRANCH — NÃO ESTÁ NO AR"**, com o número do PR; "ÚLTIMA SESSÃO FEZ" é só para o que está na `main`. (Em 27/09 o dono perguntou por que não via no jogo as novidades anunciadas: eram **7 branches fora do ar**, 5 deles sem PR.)
15. **Branch sem PR no mesmo dia; fechado em 48 h.** Empurrou para não perder o trabalho num `git switch`? Abra o PR no mesmo dia (o `--draft` serve enquanto não estiver pronto) — branch empurrado sem PR não chega a lugar nenhum (regra 13). **Antes de começar tarefa nova, olhe os seus branches:** com mais de 48 h sem PR, ele é mergeado, fechado ou declarado morto; acumular branch é o mesmo que não ter entregue. Quem passa e encontra branch alheio sem PR pode abrir o PR e avisar o dono.
16. **Toda entrega visível fecha com o caminho para vê-la.** Interface, visual, tela ou mecânica nova: o PR traz **captura em `.decepticons/arte/`** (o dono julga por olho) e **onde ele clica para ver funcionando** (a tela, a tecla, o link, a fase). Se ela ainda não está ligada a nada porque falta o contrato de quem ia alimentá-la, o PR **diz isso** e o `STATUS_REAL.md` marca PARCIAL/AUSENTE (R13); sem isso o dono não tem como testar, e a entrega não existe para ele.

## MAPA

```text
client/src/
  core/        Game.ts (monta os módulos + loop), InputManager.ts, Quality.ts (qualidade adaptativa, G12), rng.ts (aleatório com semente), Settings.ts (configurações do jogador: contrato da UI)
  physics/     PhysicsWorld.ts (Rapier, FIXED_DT)
  entities/    MechBase.ts (controller, dash, dano modular, animação), chassis.ts (números dos chassis, sem 3D), Vector09.ts, Android.ts, meshKit.ts
  sim/         Match.ts (a partida inteira sem tela: o que o servidor roda; o Game desenha por cima)
  net/         adapters.ts (ponte entre a simulação e os contratos de rede)
  hangar/      loadout.ts (contrato da montagem: LoadoutSpec, validateLoadout), Hangar.ts (montagem salva, link ?build=, API da tela)
  tuning/      power.ts (potências: multiplicadores por arma e por clã, link, relatório de equilíbrio), PowerStore.ts (salvas, ?potencias=)
  player/      PlayerController.ts (input/câmera -> MechInput, tiro)
  camera/      CameraRig.ts + modos (3ª, 1ª, tática)
  environment/ Arena.ts, Destructibles.ts, DebrisSystem.ts
  combat/      weapons.ts (arsenal: armas em 3 níveis), balance.ts (metas de equilíbrio), trigger.ts (cadência, carregador), heat.ts (calor do Mech),
               ProjectileSystem.ts, RocketSystem.ts, CombatSystem.ts, damage.ts (dano por parte), BotController.ts (IA), BotSystem.ts, Respawner.ts
  fx/          ParticleSystem.ts
  ui/          HUD.ts (F1 esconde)
  debug/       DebugPanel.ts (compacto sempre; ' abre o detalhado: qualidade, triângulos, memória)
server/        servidor de jogo (M3): Server.ts (ws, salas, laço de 60 Hz), ArenaRoom.ts (a partida de uma sala), NetPilot.ts (piloto remoto), main.ts
shared/net/    contratos do multiplayer, sem dependência do cliente: constants.ts, codec.ts, input.ts, state.ts, events.ts, messages.ts
scripts/       smoke.mjs (budget + boot headless), test.mjs (Vitest com temp em .tmp/), landing.mjs (landing do jogo), oficina.mjs (bancada de testes), painel.mjs (sala de controle: o case),
               site/dados.mjs + site/tema.mjs + site/graficos.mjs (dados, visual e gráficos das páginas), site.mjs (site + .htaccess + capturas + teste), install-hooks.mjs
.githooks/     pre-commit (M5 + secrets), pre-push (npm run check)
.github/       workflows/ci.yml (npm run check a cada push/PR; deploy do site a cada merge na main),
               workflows/etiquetas.yml + labeler.yml (etiqueta de frente e de agente em cada PR),
               release.yml (notas de versão por frente), pull_request_template.md
.tmp/          temporários do projeto (ignorado pelo git; G15)
```

Repositório: `github.com/SerafimWeb/decepticons` (privado), branch `main`.

## COMANDOS

```bash
npm install        # instala e ativa os hooks de .githooks/
npm run dev        # http://localhost:5173
npm test           # testes de simulação (Vitest, no Node)
npm run check      # typecheck + testes + build + budget + boot headless (obrigatório antes de push)
npm run smoke:dev  # boot headless contra o dev server
npm run painel     # sala de controle (novidades, equipe, mesa do Dan, fluxo, fichas, evolução, rota, frentes, decisões) em .tmp/painel/painel.html
npm run server     # servidor de jogo do multiplayer em ws://localhost:2567/?sala=ARENA (DEPLOY.md)
npm run site       # monta o site em .tmp/site/ (landing, oficina/, sala-de-controle/, jogar/); `-- --capturas` fotografa o jogo; `-- --check` testa em /cybermech/
gh release create v0.<fase>.0 --generate-notes --title "Fase N — Título"   # ao fechar uma fase: notas agrupadas por frente
```

Ambiente sem Chrome/Edge (ex.: sandbox na nuvem): rode `npm run typecheck && npm test && npx vite build`; o smoke roda no CI do PR.

## ENCERRAMENTO DE SESSÃO

- [ ] `npm run check` passa (ou o CI do PR está verde)
- [ ] `.decepticons/ESTADO_ATUAL.md` reflete o estado real (o hook de commit exige)
- [ ] Decisão relevante → nova entrada no topo de `HISTORICO_DE_DECISOES.md`
- [ ] Feature mudou de estado → `STATUS_REAL.md`
- [ ] Nenhum secret em arquivo versionado
