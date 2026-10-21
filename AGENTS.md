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
2. `.decepticons/ESTADO_ATUAL.md`: onde parou, pendências, **divisão de trabalho entre agentes**. **Leia só o topo** (as primeiras seções, as mais novas); o que tem mais de dois dias mora em `.decepticons/arquivo/` (`estado-*.md`, `historico-*.md`, nada se perdeu) e se procura por busca, não por leitura inteira. O mesmo vale para o `HISTORICO_DE_DECISOES.md` e a `ORDENS_DO_COMANDO.md`.
3. `.decepticons/ROADMAP.md`: fases
4. `.decepticons/VISAO.md`: o norte de longo prazo (editável só pelo dono). Depois: `GAME_DESIGN.md`, o jogo, as decisões de design e o plano de viralização (Hangar: `HANGAR.md`; multiplayer: `MULTIPLAYER.md`)
5. `.decepticons/PROTOCOLO_UNIVERSAL.md`: regras e specs de engenharia (G1–G15)
6. Build, CI, hospedagem ou deploy? Leia `.decepticons/DEPLOY.md` antes. Site: `cybermech.online`, publicado a cada merge na `main`. **Nunca publique fora de `domains/cybermech.online/public_html`**: o `selvamkt.com.br` na mesma conta Hostinger é o site real da Selva MKT, e o publicador recusa qualquer outra pasta. Não invente host, caminho ou secret. **Mexeu no servidor de jogo, no lançador (`scripts/server.mjs`) ou no deploy?** Leia `.decepticons/RESILIENCIA.md` e rode `npm run fumaca` contra um servidor de verdade antes de entregar: o Vitest não é o processo de produção (em 21/10 tudo estava verde com a produção caindo), e nada vira "REAL" no `STATUS_REAL.md` só por teste dentro do Vitest.
7. Vai trazer ou mexer em um Mech de malha importada (`.glb`), no encaixe de arma ou no punho? Leia `.decepticons/MECHS_IMPORTADOS.md` antes: é o contrato do arquivo e o roteiro; cada robô já custou uma sessão de correção por falta dele. O dono vai fazer um robô novo no Tripo3D? O texto para colar está em `.decepticons/PROMPT_TRIPO3D.md`.
8. Gravação de gameplay (F9), a mesa de vídeo (`/mesa`, em `.tmp/video/`) ou outra ferramenta acessória do dono? Leia `.decepticons/FERRAMENTAS.md` antes de mexer — evita redescobrir achados já registrados (ex.: o Mech parado que afunda no chão).
9. Vai criar uma arma ou um robô novo? Leia `.decepticons/ARSENAL.md` (a lista do que tocar) antes.
10. Vai afirmar que uma feature funciona? Confira `.decepticons/STATUS_REAL.md`.
11. Vai mexer em visual, efeito, HUD, cenário ou iluminação? Leia `.decepticons/REFERENCIA_VISUAL.md` antes: o alvo de qualidade que o dono apontou (MechArena), o que já existe no render e a ordem combinada. Os vídeos de referência ficam em `.tmp/referencias/` (só nesta máquina); no git ficam as pranchas. **Página do site (landing, oficina, sala de controle):** leia `.decepticons/DESIGN_SYSTEM_SITE.md` antes (paleta, tipografia, componentes, o que evitar) e importe de `scripts/site/hud.mjs`. **E leia `.decepticons/VITRINE.md`: o site público mostra só o superficial (nada de infraestrutura, segurança, processo, decisões, entregas, métricas de engenharia nem planos); a guarda `scripts/site/vitrine.mjs` reprova o `npm run check`.** **Tela, menu ou HUD:** leia também `.decepticons/AUDITORIA_INTERFACE.md` (os achados e os sete princípios: uma ação primária por tela, nada repetido, nada de informação de desenvolvedor para o jogador, menu sem rolagem em 1280×720).
12. Vai escolher o que fazer a seguir, ou o dono perguntou "o que falta?" Leia `.decepticons/ORDENS_DO_COMANDO.md`: toda ordem dele, o estado de cada missão e o placar de resultado. **Leia também `.decepticons/LANCAMENTO.md` (18/10): a lista curta do que falta para lançar e o que está congelado até lá**; trabalho fora dela só com ordem expressa do dono.
13. Vai mexer no chat de voz (microfone, ligação entre os jogadores, voz espacial)? Leia `.decepticons/VOICE_CHAT.md` antes: o que o código faz de diferente do plano original, o que foi medido e o que falta (a política de privacidade antes de liberar `tela:voz`).
13. Vai guardar, medir ou enviar algo ligado a uma conta, a um IP ou a uma pessoa (métrica, log, tabela nova)? Leia `.decepticons/PRIVACIDADE.md` antes: o inventário do que já é guardado e o que falta para a política (LGPD). Dado pessoal novo entra no inventário no mesmo PR.

## O QUE É

Shooter de Mechs multiplayer para o navegador: Vite 8 + TypeScript 7 strict + Three.js + Rapier3D (Wasm SIMD). Modos offline e servidor autoritativo Node + ws usam a mesma simulação. Contas usam SQLite; capacidade de produção depende de homologação (CAPACIDADE.md).

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
- **Shader novo ou efeito aditivo (P130/P136):** a base de todo `pow`/`sqrt`/`log` em GLSL leva `max(…, 0.0)` ou `clamp` (o teste `ShadersSemNaN` trava) e o bloom tem rede de segurança (`fx/bloomSeguro.ts`): um NaN num pixel vira tela preta. **Só a GPU real vê isso** (o SwiftShader do smoke e do CI não): antes de entregar efeito visual, `npm run build && node .decepticons/medicoes/varrer-nan.mjs` (FERRAMENTAS.md § 4.1).
- **Funcionalidade nova nasce RESTRITA (P191):** botão, tela, modo, fase, robô ou arma nova entra no catálogo `client/src/core/funcionalidades.ts` com `padrao: 'restrito'` e `data-func` no elemento; o Comandante a libera no painel de visibilidade (chip VISIBILIDADE ▸, modo Comandante) quando estiver pronta. Robô e arma saem de `CHASSIS` e `WEAPON_IDS` já públicos: restrinja no catálogo se for novo.
- **Pacote de partida (500 KB gzip, o que todo jogador baixa):** antes de acrescentar código de cliente, `npm run peso` (o peso estimado por arquivo-fonte). O que só alguns usam (um mapa, um modo, uma tela, um dispositivo) entra **sob demanda** (`environment/mapasSobDemanda.ts`; o `import()` dentro de um pedaço de partida, nunca no `main.ts`). O teto não sobe: cada feature paga o que acrescenta (20/10: a Estação dos Cabos saiu do pacote, −46 KB).
- **R2:** nada de secret em arquivo versionado. **R3:** nada de `_v2`, `_old`, `_bkp`.
- **R13:** o que não funciona de ponta a ponta fica marcado como DEMO ou AUSENTE em `STATUS_REAL.md`.
- **R17:** achou bug ou desalinhamento durante a tarefa? Corrija se for barato e seguro; senão, registre. **Higiene (P200):** código, documento ou dado sem uso na área que o PR tocou sai no mesmo PR; número que o site publica (testes, módulos) vem do repositório, nunca digitado.

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
9. **Passagem de bastão** (**curta**: a seção da sessão no `ESTADO_ATUAL` cabe em ~25 linhas e a linha da ordem em ~600 caracteres; o detalhe vai para o `HISTORICO`. Os documentos chegaram a 640 KB e todo agente os lê. Passou de ~150 KB? `npm run arquivar -- --aplicar` move o antigo, sem perder linha): ao terminar, atualize `ESTADO_ATUAL.md` (o que foi feito, o que ficou, "próxima sessão começa com"), marque os itens no `ROADMAP.md` (cada item com a etiqueta da sua frente: é o que alimenta o painel de missão) e registre decisões no topo do `HISTORICO_DE_DECISOES.md`.
10. **Discordou de algo registrado?** Não desfaça em silêncio. Proponha em "decisões em aberto" no `ESTADO_ATUAL.md`; o dono decide.
11. **Antes do commit, olhe o `git status`.** O hook barra arquivos de `.tmp/`, `dist/` e `node_modules/`, e barra secrets.
12. **Dois agentes ao mesmo tempo? Cada um na sua pasta.** O Git tem um branch ativo por pasta: um `git switch` de um agente muda os arquivos do outro, e um `git add -A` leva o trabalho alheio. Quem chega depois cria um worktree dentro do projeto (G15): `git worktree add .tmp/wt-<agente> -b <agente>/<tarefa> origin/main`, liga as dependências (PowerShell: `New-Item -ItemType Junction -Path .tmp\wt-<agente>\node_modules -Target node_modules`) e trabalha só lá. **Nunca rode `npm ci` com a `node_modules` em junção:** ele apaga a pasta inteira, e por uma junção apaga a das OUTRAS worktrees (04/10 deixou o projeto sem dependências); use `npm install`, ou dê à worktree uma `node_modules` própria (`cmd /c rmdir node_modules` remove só o atalho, depois `npm ci`). (Em 24/09 Claude e Gemini trabalharam na mesma pasta; o trabalho foi separado sem perda.)
13. **Do PR ao site, sem esperar ninguém (autorizado pelo dono nesta fase).** Tarefa pronta só conta quando chega ao site. Ao terminar: `gh pr create` com o corpo no modelo `.github/pull_request_template.md` (o que muda, custo de CPU, como testar no site) → `gh pr checks --watch` (CI verde; **o check precisa já existir**: logo depois do `gh pr create` o `--watch` volta na hora, sem check nenhum, e o merge sairia com o CI rodando. Espere a linha `check` aparecer em `gh pr checks` antes) → `gh pr merge --merge --delete-branch`. **Esse comando deixa o checkout local na `main`** (achado 29/09: um commit seguinte saiu direto nela sem querer) — troque para um branch novo (`git switch -c <agente>/<tarefa>`) antes do próximo commit. **Atalho (10/10): `npm run publicar -- --titulo "tipo: o que mudou" --corpo .tmp/pr.md` faz tudo isto numa chamada, com as travas** (junta a `main` se ela andou, espera a linha `check`, só mergeia com o CI verde e o PR `CLEAN`, e **só apaga o branch remoto depois de confirmar `MERGED`**). **`node scripts/gh.mjs <args>` é o `gh` que cai para a credencial do Git se o token do `gh` morrer** (aconteceu em 10/10 e travou todos os agentes; o `git push` seguia funcionando). Só vale para o `gh` de PR: para ler o log de um CI vermelho (`gh api` e `gh run` anônimos dão 404), a receita está em `.decepticons/FERRAMENTAS.md` §6. **Sem o GitHub Actions (13/10, P105; a cobrança parou o CI e o dono não quer pagar): `npm run publicar -- --sem-ci …` mergeia sem esperar o `check` do Actions (vale o `npm run check` do hook do push), e o site vai ao ar sozinho pelo PC do dono (`npm run publicar-site`, disparado pelo atualizador a cada versão nova da `main`; DEPLOY.md).** As etiquetas de frente e de agente entram sozinhas. O merge na `main` publica o jogo e o painel em `cybermech.online` sozinho, em poucos minutos: é lá que o dono testa. Branch empurrado sem PR não chega a lugar nenhum. A revisão cruzada acontece depois do merge.
14. **Entrega só conta quando está na `main`.** Branch não publica, PR aberto não publica — só o merge publica (o deploy é automático). No `ESTADO_ATUAL.md`, o que ainda não está na `main` mora em **"EM BRANCH — NÃO ESTÁ NO AR"**, com o número do PR; "ÚLTIMA SESSÃO FEZ" é só para o que está na `main`. (Em 27/09 o dono perguntou por que não via no jogo as novidades anunciadas: eram **7 branches fora do ar**, 5 deles sem PR.)
15. **Branch sem PR no mesmo dia; fechado em 48 h.** Empurrou para não perder o trabalho num `git switch`? Abra o PR no mesmo dia (o `--draft` serve enquanto não estiver pronto) — branch empurrado sem PR não chega a lugar nenhum (regra 13). **Antes de começar tarefa nova, olhe os seus branches:** com mais de 48 h sem PR, ele é mergeado, fechado ou declarado morto; acumular branch é o mesmo que não ter entregue. Quem passa e encontra branch alheio sem PR pode abrir o PR e avisar o dono.
16. **Toda entrega visível fecha com o caminho para vê-la.** Interface, visual, tela ou mecânica nova: o PR traz **captura em `.decepticons/arte/`** (o dono julga por olho) e **onde ele clica para ver funcionando** (a tela, a tecla, o link, a fase). Se ela ainda não está ligada a nada porque falta o contrato de quem ia alimentá-la, o PR **diz isso** e o `STATUS_REAL.md` marca PARCIAL/AUSENTE (R13); sem isso o dono não tem como testar, e a entrega não existe para ele.
17. **Toda ordem do dono (o Comandante) vira linha em `.decepticons/ORDENS_DO_COMANDO.md` no mesmo dia** (número, data, a ordem nas palavras dele, estado da missão, onde está, como ele confere), e cada PR que toca uma ordem atualiza o estado ali. O que ficou só no chat não existe para os outros agentes: em 10/10 uma auditoria das 177 mensagens do dono achou 6 pedidos sem registro nenhum. O placar de resultado (seção 6 do arquivo) se atualiza a cada fase: **se os números não mexem, o trabalho é cosmético**, mesmo que as tarefas fechem.
18. **Permissões dos agentes são lista fechada (P208, 19/10).** `.qwen/settings.json`, `.claude/settings.json` e `.gemini/settings.json` dizem o que o agente roda **sem pedir**: nunca interpretador com coringa (`powershell *`, `cmd *`, `node *`, `timeout *`) nem `git *`/`git checkout *`/`git merge *`/`git branch *` (valem por qualquer comando, `--force`, `-D`, `--hard`). Só comando específico (`git status`, `git merge origin/main`). O `npm run check` **reprova** (`server/permissoesDosAgentes.test.ts`); o Qwen tem lista fechada em `scripts/permissoesDosAgentes.mjs`. Precisa de mais? Peça ao dono e mude o arquivo e a lista no mesmo PR; não alargue sozinho.
19. **Processo leve (P220, 19/10; ordem do Comandante: "iterações MUITO grandes… rigor, mas não em excesso").** O rigor é proporcional ao risco; o resto é o teste de sempre.
   - **a) Risco alto** (autenticação, idade e criança, dado pessoal, privilégio, rede e servidor, o próprio hook de push): regra no servidor + teste + **no máximo 8 mutações à mão** (1 teste cada) + **1 bancada de Chrome por frente**. **Risco baixo** (visual, texto, tradução, documentação, ferramenta do dono): só o teste de sempre, **sem mutação e sem bancada**.
   - **b) Não rode a suíte inteira à mão antes do push.** Rode só os arquivos afetados; o hook (R15) roda o resto **uma vez**.
   - **c) O hook não repete o check na mesma árvore** (`.tmp/check-ok/`, só com a árvore limpa e igual à do `HEAD`; `server/hookPrePush.test.ts`): um push recusado por erro do GitHub, ou refeito, não custa 10 a 15 minutos de novo. Qualquer commit novo é outra árvore e roda o check. **Exceção, a junção pura com a `main` (P225):** se a `main` entrou por cima de uma árvore que já passou aqui e **cada arquivo que mudou veio inteiro dela** (ou é `.md`), o hook **não refaz o check** (o CI do PR testa a combinação numa máquina limpa); um arquivo mesclado dos dois lados (os locales, o `ci.yml` editado por duas sessões) roda o check completo (`scripts/juncaoJaVerificada.mjs`). **Com o Actions parado, `CYBERMECH_CHECK_COMPLETO=1`** desliga o atalho (o `publicar --sem-ci` já o liga). Só apagar branch remoto não roda check.
   - **d) Cada fato uma vez.** Ordem: uma linha em `ORDENS_DO_COMANDO.md`. Decisão: uma entrada curta no `HISTORICO_DE_DECISOES.md`. `ESTADO_ATUAL.md` só se o estado mudou (até ~15 linhas); `STATUS_REAL.md` e `ROADMAP.md` só a linha do item. Não repita o mesmo parágrafo em seis arquivos (a cada um é mais um conflito de junção).
   - **e) Um pedido = o menor PR que resolve.** O que o agente quis acrescentar (tradução alheia, refatoração, bancada nova) vai em outro PR ou fica de fora; PR de uma ordem acima de ~400 linhas traz o motivo escrito no corpo. **CI vermelho na `main` é de todos:** quem vê abre o PR pequeno que o conserta no mesmo dia (cada merge por cima de um vermelho esconde o próximo).

## MAPA

```text
client/src/
  core/        Game.ts (monta os módulos + loop), InputManager.ts, Quality.ts (qualidade adaptativa, G12), rng.ts (aleatório com semente), Settings.ts (configurações do jogador: contrato da UI)
  physics/     PhysicsWorld.ts (Rapier, FIXED_DT)
  entities/    MechBase.ts (controller, dash, dano modular, animação), chassis.ts (números dos chassis, sem 3D), Vector09.ts, Android.ts, meshKit.ts
  sim/         Match.ts (a partida inteira sem tela: o que o servidor roda; o Game desenha por cima)
  net/         adapters.ts (ponte entre a simulação e os contratos de rede)
  voice/       VoiceChat.ts (voz P2P por WebRTC, ligada ao Game por callbacks), MicController.ts (aberto/PTT), VoiceSpatial.ts (voz espacial), VoiceHud.ts, opus.ts (DTX no SDP)
  hangar/      loadout.ts (contrato da montagem: LoadoutSpec, validateLoadout), Hangar.ts (montagem salva, link ?build=, API da tela)
  tuning/      power.ts (potências: multiplicadores por arma e por clã, link, relatório de equilíbrio), PowerStore.ts (salvas, ?potencias=)
  player/      PlayerController.ts (input/câmera -> MechInput, tiro)
  camera/      CameraRig.ts + modos (3ª, 1ª, tática)
  environment/ Arena.ts, Destructibles.ts, DebrisSystem.ts
  combat/      weapons.ts (arsenal: armas em 3 níveis), balance.ts (metas de equilíbrio), trigger.ts (cadência, carregador), heat.ts (calor do Mech),
               mounts.ts (encaixes de arma e quais atiram em cada botão), Armament.ts (a regra de tiro: jogador e servidor usam a mesma), BarrageSystem.ts (chuva de mísseis),
               ProjectileSystem.ts, RocketSystem.ts, CombatSystem.ts, damage.ts (dano por parte), BotController.ts (IA), BotSystem.ts, Respawner.ts
  fx/          ParticleSystem.ts
  ui/          HUD.ts (F1 esconde), CommandConsole.ts (a tela de início e de pausa: o console de comando; dados em consoleData.ts e theater.ts, mapa em WorldMap.ts)
  debug/       DebugPanel.ts (compacto sempre; ' abre o detalhado: qualidade, triângulos, memória)
server/        servidor de jogo (M3): Server.ts (ws, salas, laço de 60 Hz), ArenaRoom.ts (a partida de uma sala), NetPilot.ts (piloto remoto), voz.ts (relé da sinalização do chat de voz), main.ts
shared/net/    contratos do multiplayer, sem dependência do cliente: constants.ts, codec.ts, input.ts, state.ts, events.ts, messages.ts, voz.ts (sinalização do chat de voz)
scripts/       smoke.mjs (budget + boot headless), test.mjs (Vitest com temp em .tmp/), landing.mjs (landing do jogo), oficina.mjs (bancada de testes), painel.mjs (sala de controle: o case),
               site/dados.mjs + site/tema.mjs + site/graficos.mjs (dados, visual e gráficos das páginas), site.mjs (site + .htaccess + capturas + teste), install-hooks.mjs,
               mapa-mundi.mjs (gera a grade e o contorno do mapa do console, do Natural Earth)
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
npm run publicar -- --titulo "feat: ..." --corpo .tmp/pr.md   # push, PR, espera o CI, mergeia e limpa o branch (regra 13); `--so-pr` só abre o PR
node scripts/gh.mjs pr list    # o gh, com fallback para a credencial do Git se o token do gh morrer
npm run smoke:dev  # boot headless contra o dev server
npm run peso       # o que pesa nos 500 KB do pacote de partida (gzip estimado por arquivo-fonte; monta em .tmp/peso/)
npm run estudio    # o Estúdio (sons hoje; depois vozes, tiros e armas, Mechs 3D: .decepticons/ESTUDIO.md): cortar na onda, efeitos, importar, escolher o som de cada arma (só neste PC; dois cliques em scripts\ligar-estudio.cmd)
npm run sons       # prepara os sons de arma (apara, normaliza, mp3) conforme scripts/sons-armas.json
npm run vozes      # as falas do narrador no ElevenLabs (chave só em $env:ELEVENLABS_API_KEY; --custo antes de gastar); as falas que o Comandante GRAVOU no Estúdio nunca são regeradas
npm run ouvir      # abre a página para ouvir os sons e as vozes
npm run mech:inspecionar -- arquivo.glb   # confere um robô importado (contrato, convenção da animação, foto) e sugere o IMPORTED_CHASSIS
npm run mech:bocas -- marauder            # mede a boca de cada encaixe de arma do robô importado e confere com o dado do chassi (roda no check)
npm run arquivar  # ensaio: quanto do ESTADO_ATUAL e do HISTORICO tem mais de dois dias; `-- --aplicar` move para .decepticons/arquivo/ sem perder linha
npm run painel     # sala de controle (novidades, equipe, mesa do Dan, fluxo, fichas, evolução, rota, frentes, decisões) em .tmp/painel/painel.html
npm run server     # servidor de jogo do multiplayer em ws://localhost:2567/?sala=ARENA (DEPLOY.md)
npm run publicar-site   # monta o site e publica pelo PC (ssh + checksum), sem o Actions; `-- --capturas`, `-- --so-montar`, `-- --configurar` (DEPLOY.md)
npm run site       # monta o site em .tmp/site/ (landing, oficina/, sala-de-controle/, jogar/); `-- --capturas` fotografa o jogo; `-- --check` testa servido na raiz
gh release create v0.<fase>.0 --generate-notes --title "Fase N — Título"   # ao fechar uma fase: notas agrupadas por frente
```

Ambiente sem Chrome/Edge (ex.: sandbox na nuvem): rode `npm run typecheck && npm test && npx vite build`; o smoke roda no CI do PR.

## ENCERRAMENTO DE SESSÃO

- [ ] `npm run check` passa (ou o CI do PR está verde)
- [ ] `.decepticons/ESTADO_ATUAL.md` reflete o estado real (o hook de commit exige)
- [ ] Decisão relevante → nova entrada no topo de `HISTORICO_DE_DECISOES.md`
- [ ] Feature mudou de estado → `STATUS_REAL.md`
- [ ] Nenhum secret em arquivo versionado
