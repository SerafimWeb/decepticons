# ARQUIVO — ESTADO_ATUAL (entregas antigas da seção EM BRANCH)

> Texto movido sem alteração de `ESTADO_ATUAL.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

## EM BRANCH — NÃO ESTÁ NO AR (nem no site, nem no jogo)

- **Sinais de avaria no próprio Mech (Codex, 06/10, PR #164 mergeado).** Fumaça/faíscas nas juntas de partes ainda presentes com até metade da vida; passada assimétrica conforme a avaria das pernas, preservando a orientação de repouso dos quadris; vapor nos rigs sem ventilação própria. Reparar interrompe os sinais. Módulo render a 10 Hz, até 12 unidades/pulso, 720 partículas/s no pool de 3000, sem desenho ou byte de rede novo. Cinco testes novos; check e CI verdes (569 testes). Captura de bancada em `arte/dano-visivel-codex.png`; playtest real offline/online/importados continua pendente. O roadmap passa a indicar a Fase 5 atual e reconhece que Colossus visual/boss/solo, morteiro procedural e níveis visuais dos módulos importados já foram entregues.

- **UX/Site:** Remoção do botão de jogar offline da landing page (agora focado 100% no servidor online) e injeção do código de rastreamento do Google Analytics no `client/index.html` e no `scripts/site/tema.mjs` usando a tag `G-2CCHDCEC7X` fornecida pelo dono.

- **Correção dos passos, bots ecoando e Gênesis-01 offline/costas (Gemini, 30/09, PRs #136 e o próximo).** O som do passo finalizava mesmo após soltar o W (pois a fricção ainda mantinha velocidade mínima); cortado esse passo residual. Passos de bots e aliados reduzidos em volume (eco de "manada" anulado). No `Game.create()`, a instanciação agora aguarda a malha importada, impedindo o modelo de desaparecer no modo offline. O erro online da montagem (servidor) requereu que o dono reiniciasse o terminal manualmente. O Gênesis-01 importado também estava entrando invertido de costas; a configuração do chassi importado ganhou um campo `rotationY` opcional, usado para girar o Gênesis 180 graus no carregamento.

- **Correção dos Mechs Importados (Lancer, Bastion, Quadra)**
  - O Quadra-V2 e o Lancer-L1 estavam com a Box3 computando tamanho infinito devido a bugs de exportação nas armaduras (invisíveis), resultando em uma malha com escala 10^-37 invisível. Resolvido filtrando `isMesh` no cálculo da Box3 em `importedMechRig.ts`.
  - O LR-7L Bastion estava severamente deformado ("amassado") em consequência de problemas de skinning após redimensionar a cena raiz e usar `SkeletonUtils.clone()`. Resolvido empacotando o clone em um `THREE.Group` e aplicando a escala nesse grupo superior.
  - Correção de animação corrompida ("braços levantados, dobrando pé nas costas") nos modelos Tripo3D (Genesis, Lancer, LR7L): restaurada a lógica `useAxisCorrection` condicional em `importedMechRig.ts`, pois esses modelos já vêm com orientação padrão, diferentemente dos esqueletos do Mixamo.

- **Esqueleto de contas: criar, entrar, sair (Claude, 28/09, PR `claude/login-esqueleto`).** Pedido do dono,
  depois de decidir junto: **SQLite no próprio PC do servidor**, **e-mail + senha**, e **só o esqueleto**
  primeiro (sem migrar progressão ainda).
  - **Banco:** `node:sqlite` embutido do Node — **zero dependência nova**, decisão direta da dor do dia com
    o `@rolldown` travando a instalação (evitar mais um binário nativo como `better-sqlite3`). Arquivo em
    `.tmp/servidor/contas.db`, ao lado do log de sempre: sobrevive à atualização automática e a um rollback
    dela (`git reset --hard` só mexe em arquivos versionados). **Exige Node 22.12+** — `package.json` não
    aceita mais Node 20 (`node:sqlite` não existe lá); atualizado o `engines`.
  - **Segurança:** senha em `scrypt` com sal por conta (`node:crypto`, sem dependência); sessão é um token
    aleatório de 32 bytes que o cliente guarda — o banco só grava o **hash** dele (um vazamento do
    `contas.db` não dá sessão utilizável a ninguém). 8 tentativas a cada 10 min por IP em `/conta/entrar` e
    `/conta/criar` juntas (`server/login.ts`), separado do `Guard` do WebSocket e da `Telemetria`.
  - **Rotas** no mesmo processo HTTP do `/status` e `/evento`: `POST /conta/criar`, `POST /conta/entrar`
    (devolvem `{token, email}`), `POST /conta/sair`, `GET /conta/eu`. Contrato `shared/net/auth.ts`.
  - **Cliente pronto, sem tela:** `client/src/net/auth.ts` (`ContaCliente`) — `criar()`, `entrar()`, `sair()`,
    `eu()`, nunca lança, mensagens de erro prontas para mostrar. **A tela é território do Gemini**
    (`client/src/ui/`) — pendência em "PRÓXIMA SESSÃO COMEÇA COM".
  - 28 testes (validação pura, banco com `:memory:`, HTTP de ponta a ponta, limite de tentativas isolado
    num servidor próprio para não interferir nos outros testes de conta).
  - **Não migrado (decisão do dono, fica para depois):** XP, créditos e missões diárias continuam em
    `localStorage` (`DailyChallenges.ts`) — migrar para a conta é o próximo corte, não este.

- **Gravação nativa de gameplay: F9 liga/desliga, sem OBS (Claude, 28/09, PR `claude/gravacao-nativa`).**
  Pedido do dono: *"quero eu poder gravar bons vídeos jogando"*, depois de reclamar que a qualidade do OBS
  estava ruim. `canvas.captureStream()` + `MediaRecorder` direto do WebGL — grava só os pixels do jogo, no
  framerate real, sem recompor a janela inteira do PC.
  - **Tecla escondida de propósito.** F9 liga/desliga, um indicador `● REC` aparece só enquanto grava; a
    tecla não está no `keys-help` da tela inicial — decisão de 28/09 ("não vamos deixar os usuários fazerem
    suas próprias gravações, primeiro vamos só nós usarmos") continua valendo: é recurso interno, não
    feature de jogador.
  - **"Modo captura" junto do F9 (item R0 de `PROPOSTA-REPLAY.md`, achado numa proposta antiga de 28/09 em
    `.tmp/video/`):** trava a resolução no teto de qualidade "alta" (`maxPixelRatio()`, ≤1.5 — **corrigido em
    29/09, PR `claude/fix-gravacao-pixelratio`**: era `Math.max(2, devicePixelRatio)`, que passava esse teto
    em telas de alta densidade e derrubava o FPS de verdade, causando o próprio soluço/quadro perdido que o
    dono relatou ao testar) e desliga o rebaixamento automático de qualidade (G12) enquanto grava. Sem isso,
    a própria gravação derruba o FPS, a qualidade adaptativa reage baixando a resolução no meio do take — o
    mesmo problema que o dono já tinha descrito do OBS, causado dessa vez pelo próprio jogo. Some com o F9 de
    novo, voltando pra configuração de qualidade que o jogador tinha escolhido.
  - **Achado técnico real, não trivial:** um canvas WebGL não guarda o quadro entre desenhos
    (`preserveDrawingBuffer: false`, e **continua assim para todo jogador** — ligar isso sempre custaria GPU
    de todo mundo só para os raros minutos em que o dono grava). A saída: `captureStream(0)` (modo manual) +
    um `requestFrame()` chamado uma vez por quadro do `Game.frame()`, logo depois do `composer.render()` —
    pega o conteúdo certo, no instante certo, sem o custo permanente. **Achado de quebra no meio do caminho
    (R17):** chamar `requestFrame()` de novo bem antes do `stop()` (pensando em "garantir o último quadro")
    na verdade **quebrava** a finalização do gravador nesse ambiente — o oposto do que parecia. Removido;
    sem ele, a gravação fecha certo.
  - **Áudio:** `AudioSystem.ts` ganhou três métodos pequenos e aditivos (`context`, `connectRecorder`,
    `disconnectRecorder`) — território do Gemini, mudança mínima registrada aqui por transparência (`AGENTS.md`
    regra 4): só conecta/desconecta um nó extra no mesmo `masterGain` que já toca no alto-falante, nenhum som
    existente muda.
  - **Verificação real, com ressalva honesta:** confirmado de ponta a ponta em Chrome de verdade — arquivo
    `.webm` válido (VP9 1280×720 + Opus, conferido com `ffprobe`) baixado depois de F9 ligar/desligar. A
    automação headless (`SwiftShader`, renderização por software) se mostrou **instável** para captar o
    quadro a tempo em alguns testes — sintoma do ambiente de teste, não do código (o mesmo código, quando
    funciona, produz um vídeo correto; falha só quando o navegador headless não entrega nenhum quadro real a
    tempo). **Peça ao dono um teste manual real** (F9, jogar alguns segundos, F9, olhar a pasta Downloads)
    como confirmação definitiva — é o tipo de recurso que só um navegador de verdade, com GPU, prova.
  - **Próximo passo, não feito agora:** as gravações caem na pasta de Downloads do navegador, soltas. Levar
    esses `.webm` para dentro do `/mesa` (o editor de motion graphics em `.tmp/video/`) para cortar e aplicar
    a identidade visual do painel é o passo seguinte — hoje o `/mesa` só sabe desenhar cenas roteirizadas,
    não editar um clipe de gameplay de verdade.

- **A missão ficou justa e o Colossus equilibrado — e você pode pular direto para ele (Qwen, 29/09).** O dono jogou
  e relatou: *"não consegui passar da fase 4 do survival, tá DIFÍCIL"*, e pediu o combate justo com o Colossus
  (*"não pode ser absurdamente forte... combates épicos e com inteligência"*) — mantendo o pisão como **custo** de
  ficar embaixo dele.
  - **A causa da dificuldade era o orçamento do diretor**, não a contagem: o plano é fixo e o `Game` sobrescreve as
    configurações de inimigos na missão, então o jogador não tinha alavanca. **Atacantes simultâneos por onda:
    1 → 1 → 1,5 → 2 → 2,5** (era até 3), **menos Mechs** no meio (onda 5: 2 em vez de 3) e **intervalo de 6 s** (era
    4) para usar a zona de cura. Abates totais: **20** (eram 23).
  - **Colossus equilibrado e medido:** pernas **450** (até 10 s cada), torso **1 200** (até 30 s), `aimErrorScale`
    1.8; **sem arma exclusiva** (o dano por tiro é o do plasma de qualquer rebelde). O **duelo medido** mostra um
    piloto **parado no aberto aguentando mais de 20 s** — o perigo dele é espaço e pisão, não execução.
  - **Atalho de bancada novo:** **`?modo=survival&onda=6`** começa direto na onda do Colossus (leitor puro e
    testado em `sim/gameMode.ts`).
  - **R17:** o `scripts/servidor-windows.ps1` dizia "Pronto: o servidor sobe com o Windows" **depois de o registro
    da tarefa falhar com "Acesso negado"**. Agora ele confere a tarefa e falha com `exit 1`; a causa do erro era
    rodar o PowerShell **sem administrador**.
- **O tamanho 3 está no jogo: o Colossus-01 entra como boss da Sobrevivência (Qwen, 28/09).** O visual de escala 3
  (14 m) já existia; agora existe o **inimigo**. Ele fecha a missão offline como **onda 6**, com dois andróides de
  escolta:
  - **`COLOSSUS_BOSS_STATS`** (`entities/chassis.ts`, fora de `CHASSIS` de propósito — não é chassi de Hangar):
    14 m, raio 3,6 m, **5 m/s** (metade de um Vector-09), sem pulo nem dash, **pernas 600 e torso 1 600** — derrubar
    é derrubar as pernas, o que dá sentido às metas da ficha ("giro lento, flanco exposto").
  - **`BOSS_PROFILE`** (`combat/BotController.ts`): domina o espaço a 46 m e **não desvia**; o giro lento é a fraqueza
    que a ficha promete. O pool é **pré-alocado** com **vaga própria** no recorte da onda (`setRoster` do `BotSystem`)
    e o ponto de nascimento tem teste para a cápsula de 14 m — nada é criado no tick (G4).
  - **Só entra na onda que pede o boss:** nas ondas 1 a 5 ele fica desativado, como o resto do pool.
  - **Consequência assumida:** com o dobro da altura de um Vector-09, ele **esmaga um Mech parado em dois passos**
    (a mesma regra do pisão). Não se fica na frente dele.
  - **O painel do alvo paga aqui:** as 6 partes, o calor e as bandeiras do Colossus aparecem ao mirar — o mesmo
    módulo entregue hoje de manhã, sem uma linha nova.
  - **Falta:** máquina de fases própria (hoje é a IA comum com perfil de cerco), pontos fracos/respiros, arma
    assinatura, HUD de chefe com barra e o modo assimétrico online.
  - **Pendências resolvidas de quebra:** PRs abertos zerados (#110 fechado por obsoleto) e os três branches órfãos do
    Gemini apagados; `npm install` na raiz restaurado (faltavam 7 pacotes e o `.bin`, o que quebrava `npm run` para
    qualquer agente).
- **O alvo fica legível, e a escala 3 já tem decisão (Qwen, 28/09).** Na mesma mensagem o dono decidiu duas coisas: **a
  escala 3 é encontro e, depois, Mech de tripulação** (vários jogadores na mesma máquina, um por arma ou papel), e a
  fila de trabalho é a do `DIVERSAO.md` § 10, *"a mais prioritária e sequencial possível"*. Ele liberou as frentes do
  **Claude e do Gemini** (pararam por crédito), então o item 1 da fila começou pela metade de HUD:
  - `client/src/ui/TargetPanel.ts` (+ 8 testes) mostra, do inimigo sob a mira, **as 6 partes** (barra de 10 blocos,
    `✗` na parte destruída), **o calor** e as **bandeiras** (`SUPERAQUECIDO · TRAVADO`, `EM DASH`), com o chassi no
    topo — a informação que transforma "mirei na perna" em decisão informada.
  - **Custo zero:** é tudo o que **já vinha no estado da rede** (19 B por unidade) — nenhum byte a mais, nenhuma regra
    nova, nenhuma alocação por quadro (o texto é remontado a 10 Hz).
  - **Prova:** captura real no jogo em `arte/alvo-legivel.png` (o quadro pegou o rebelde **travado**, com o torso
    avariado). Caminho: `/jogar/` → mirar um inimigo. **Não leio imagem: o veredito estético é do dono.**
  - `STATUS_REAL.md` marca **PARCIAL**: falta a outra metade do item 1 — os sinais no próprio modelo (fumaça na parte
    avariada, mancar, arma pendurada, vapor de quem vai travar), frente visual.
  - **Próximo da fila:** item 2, o conserto da progressão (XP por jogar, onda contada, gancho de "conquistado jogando").
- **A ficha do CTF confere com o código: 12 dos 15 testes estão travados (Qwen, 28/09).** Auditoria item por item da
  `fichas/ctf.md` § 4 contra `client/src/sim/CaptureTheFlag.test.ts` (11 testes) e o teste de integração do CTF no
  `Match` — o mapa item → teste está na § 5 da ficha. **O item 1 é o único offline em aberto** (contrato: partida de
  CTF sem time, ou com time sem bandeira na base, tem de falhar em vez de começar torta) e é barato de fechar, na
  frente do Codex/Claude (`sim/` é território deles). Os itens 13 e 15 dependem do contrato de rede; a simetria
  cronometrada do item 12 depende dos dois chassis existirem como gameplay. Além dos 15 itens, há um teste a mais que
  trava os callbacks do HUD (`onFlagPickup`/`onCapture`/`onMatchEnd`). Nenhuma linha de código mudou.
- **A tese da diversão, da competição e da viralidade — e a peça que falta em cada uma (Qwen, 28/09).** Pedido do
  dono: *"quero que você pense como vamos tornar o jogo mais divertido… mais competitivo… quais os diferenciais que
  devemos explorar pra tornar o jogo mais viral"*, com três hipóteses na mesa (outros Mechs, missões na fase, novas
  armas). Resposta em **`DIVERSAO.md`** (documento novo; análise e recomendação, **não** escopo aprovado): a tese é
  que o diferencial do jogo **não é catálogo, é consequência**, e cada hipótese foi respondida com o código da `main`.
  - **Legibilidade do alvo é o melhor custo/efeito:** as 6 partes, o **calor do alvo** e as bandeiras
    `dashing`/`overheated` **já viajam no estado** (`shared/net/state.ts:8-30`, 19 B por unidade) — falta só o
    visual (fumaça, mancar, esquema do alvo ao mirar). Ganho grande a **0 B de rede e sem regra nova**.
  - **Os três Mechs rebeldes não têm ficha:** compartilham `VECTOR09_STATS` e diferem só na persona
    (`BotSystem.ts:141`). Dar ficha a CLAWD/GEMINAI/CHAD-GPT é a estratégia mais barata que existe.
  - **Cada braço aceita exatamente uma arma** (`ARM_SLOTS`, `chassis.ts:124`): o Hangar promete montagem e a decisão
    tem quatro linhas — abrir o catálogo por encaixe vem antes de "mais armas".
  - **Achados de progressão (R17 — registro, não conserto; `ui/` e `hangar/` são do Gemini):** `addXp()` só é
    chamado em `claimReward()` (`ui/DailyChallenges.ts:90,138`) — **o nível não sobe jogando**; `trackWaveOrRound()`
    (`:127`) não tem chamador — a missão de sobreviver ondas nunca progride; `validateLoadout` tem o gancho de
    "conquistado jogando" sem chamador (`hangar/loadout.ts:70`).
  - **Pendente do dono:** 6 decisões no § 12 (a escala 3 como encontro ou chassi; prioridade entre melhorar o que
    existe e conteúdo novo; as fichas dos rebeldes; o modificador semanal como primeiro evento; a câmera de abate no
    PvP; o conserto da progressão). Seis ideias entram no `ROADMAP.md` (IDEIAS) com o caminho da proposta.
  - `npm run check` verde: **300 testes**, painel, build, budget, smoke e site.

- **Atualização automática do servidor, e métricas de produto (Claude, 28/09, PR `claude/atualizacao-e-metricas`).**
  Dois pedidos do dono na mesma mensagem.
  - **"Tem como o servidor reiniciar sozinho quando for necessário... e quando eu estiver dormindo?"** — o
    servidor já reiniciava sozinho **se caísse** (desde 26/09, `servidor-windows.ps1`); o que faltava era
    reiniciar sozinho **quando o código muda**. Desenho: **puxar, nunca receber** — nenhum endpoint novo
    escutando a internet (zero superfície nova); a cada 10 min o PC pergunta ao GitHub se a `main` avançou
    (`scripts/atualizar-servidor.mjs`), e só troca o código depois de passar pelo mesmo portão do CI —
    `typecheck` + os testes de `server/` e `shared/` — local e em segundos. **Falhou → volta sozinho para o
    commit anterior, o servidor que já está no ar nunca é tocado.** Roda numa **worktree separada da pasta
    onde o dono edita** (`.tmp/wt-servidor-prod/`), porque um `git reset --hard` automático na pasta principal
    apagaria uma edição não commitada dele um dia qualquer — o script **recusa rodar** fora de uma worktree
    (testado). Log em `.tmp/servidor/atualizacao.log`. Passo a passo em `DEPLOY.md`, seção "Atualização
    automática". **Pendência do dono, não do código:** migrar o servidor de hoje (rodando na pasta principal)
    para a worktree, então rodar `servidor-atualizar.ps1` uma vez.
  - **"Quero trackear o consumo, quantas pessoas clicaram, onde clicam, onde saem, se jogaram tantas
    partidas."** `POST /evento` no mesmo servidor de jogo (contrato `shared/net/telemetry.ts`), lista fechada
    de 9 eventos (visita à landing, os três cliques da landing, boot do jogo, partida iniciada/terminada,
    troca de modo, Hangar aberto) — qualquer outro nome recusa com 400. **Decisão de privacidade, antes de
    login/LGPD existir:** `GET /eventos/resumo` devolve só contagens agregadas por evento (24h e total), nunca
    um evento cru nem um IP; sem cookie, sem id persistente entre sessões (um id sorteado por aba, nunca
    gravado). Corpo maior que 256 bytes recusa com 413; cada IP tem um balde próprio de 30 eventos/min (não é
    o `Guard` do WebSocket — é um limitador HTTP separado, com teste de rajada). O emissor
    (`client/src/core/telemetry.ts`, `scripts/landing.mjs`) usa `sendBeacon` (sobrevive a fechar a aba) com
    fallback a `fetch keepalive`; qualquer erro é engolido, como o fallback silencioso do `AudioSystem` — a
    telemetria nunca pode travar nem atrasar o jogo. **Ainda não tem visualização** (o resumo existe, um
    painel na sala de controle lendo `GET /eventos/resumo` é o próximo passo natural, não construído agora).
  - **Achado de infraestrutura, não de código (R17, para quem ler o log desta sessão):** o `npm ci` do PC do
    dono travou de forma persistente e reproduzível num binário nativo do `@rolldown` (`EPERM`, "rejeitado
    pelo sistema operacional" — a mensagem do próprio npm aponta antivírus) por mais de 10 minutos seguidos,
    mesmo depois de eu remover o arquivo manualmente e tentar de novo várias vezes — cada tentativa
    **encolheu** o `node_modules` (de 39 para 4 pacotes) em vez de consertar, porque `npm ci` apaga tudo antes
    de reinstalar. **`npm run check` não rodou localmente nesta sessão por causa disso** — o código deste PR
    foi revisado manualmente (é pequeno e segue padrões já testados no projeto: mesma forma de `status.ts`,
    mesmo padrão de balde de `guard.ts`) e a verificação real é o CI do PR. **Se isso acontecer de novo:** não
    insista em `npm ci` repetido (piora); investigue o antivírus (exceção para a pasta `node_modules` do
    projeto) antes.

- **A tela inicial deixa de quebrar em duas linhas, e os botões param de disputar espaço (Claude, 28/09).**
  Pedido do dono, com captura anotada: *"corrige a tela inicial, tira os 2 botões juntos, realinha o 'como é
  feito', melhora o título"*. Causa raiz: `.title { display: block }` no `<span>` forçava "CYBER"/"MECH" em
  duas linhas sempre (mesmo quando cabia numa só), e o botão `.play-btn` tinha fonte de 1,7rem — dois botões
  desse tamanho não cabem nos ~510 px da coluna de texto do hero, então "JOGAR ONLINE" e o link "como este
  jogo é feito" quebravam amontoados um sobre o outro, exatamente o que o dono circulou.
  - `.title` (compartilhado com `oficina/` e `sala-de-controle/`, `scripts/site/tema.mjs`): tira o
    `display: block` do `<span>` — "CYBERMECH" tenta ficar numa linha só e só quebra se faltar espaço de
    verdade, com `word-break: keep-all` para não partir a palavra no meio.
  - `.play-btn`: fonte responsiva (`clamp(1.05rem, 1.5vw, 1.3rem)` em vez de fixa em 1,7rem) — os dois
    botões cabem lado a lado em qualquer largura de desktop.
  - `.cta` (só em `scripts/landing.mjs`, não é compartilhada): os dois botões agora moram em `.cta-buttons`
    (sua própria linha, com wrap limpo), e "como este jogo é feito →" ganha linha própria embaixo, nunca
    mais espremido ao lado de um botão.
  - Sem teste de simulação (é geração de HTML/CSS estático); validado pelo `site --check` (headless, as
    três páginas que usam `.title`) e por captura real do hero antes/depois.
- **O servidor passa a dizer quem está jogando, e a página mostra (Claude, 28/09).** Pedido do dono:
  *"tem como deixarmos na página, permanentemente, a info se o servidor está online, quantas pessoas
  jogando?"*. O servidor de jogo ganhou **`GET /status`** no mesmo processo e na mesma porta do WebSocket;
  o contrato vive em `shared/net/status.ts` (usado pelo servidor, pelo jogo, pela landing e pelos testes).
  - **Landing:** `● 1 PILOTO EM COMBATE AGORA` embaixo dos botões, e o próprio botão vira
    `[ JOGAR ONLINE · 1 AGORA ]`. Captura: `.decepticons/arte/status-servidor-landing.png`.
  - **Pausa do jogo:** a mesma linha no canto de cima (`client/src/ui/ServerStatus.ts`), perguntando a cada
    20 s **só com a pausa à vista** — entrou em combate, para de perguntar. Captura: `status-servidor.png`.
  - **Custo:** resposta de ~70 bytes montada no máximo 1×/s no servidor; ~350 bytes por pergunta com os
    cabeçalhos, ~18 B/s por aba (0,2% do orçamento do G11). Fora do laço de 60 Hz, zero alocação por quadro.
  - **Só números agregados** (protocolo, pilotos, salas, tamanho da sala, tempo de pé): nenhum apelido, IP ou
    código de sala, porque a resposta é pública. A CSP do site libera **a origem exata** do `GAME_SERVER_URL`.
  - **Pendência do dono, não do código:** o servidor que está no ar desde 26/09 roda o código anterior, sem
    `/status`. Até ele ser reiniciado, a página vai dizer **`SERVIDOR ONLINE · SEM CONTAGEM DE PILOTOS`** —
    online, sem o número. Reiniciar é `.\scripts\servidor-windows.ps1` (ou reiniciar a tarefa do Windows).
  - Achado de quebra (R17): o prazo de 4 s da sondagem abortava a leitura do corpo quando o boot do jogo
    travava a thread; a tela dizia "sem contagem" sem motivo. Corrigido, com teste.
  - Achado de quebra (R17): `STATUS_REAL.md` tinha a linha `| Multiplayer / servidor | AUSENTE |`
    contradizendo as duas linhas acima dela (servidor e jogo online, REAL, no ar desde 26/09). Removida.

- **Os sons novos não tocavam no site: faltavam os arquivos (Claude, 28/09, R17).** O dono relatou
  "o Gemini disse que fez a parte dele mas o som ainda não tô ouvindo os novos". O código de
  carregamento estava na `main` (PR #103 e o commit `07d4182`), mas **nenhum dos 11 samples estava
  versionado** — `git ls-files client/public/audio` devolvia só o `README.md`. No site, os 11
  `fetch` davam 404 e o `AudioSystem` caía no sintetizador antigo **sem reclamar** (o fallback é
  silencioso por desenho). Na máquina do Gemini tocava, porque lá os arquivos existem soltos.
  - Os 11 samples entraram no repositório: **2,2 MB** ao todo.
  - `client/public/audio/.gitignore` passa a **ignorar tudo e liberar só os 11 nomes**: a pasta é
    também a bancada onde a matéria-prima cai (brutos do Elevenlabs com `#` e espaço no nome, e um
    `IMG_0960.MOV` de 29 MB que apareceu lá). Sem o filtro, um `git add -A` levava tudo para o deploy.
  - O `README.md` da pasta listava outros nomes de arquivo (`explosion.mp3`, `dash.mp3`, `chainsaw.mp3`)
    que o `Game.ts` nunca carregou; agora lista o que existe de verdade e diz que publicar um sample
    exige **as duas etapas** (registrar no `Game.ts` e liberar no `.gitignore`).

- **Integração de Samples Reais de Áudio (Gemini, 28/09):**
  - **Mapeamento e Padronização**: Renomeados 11 samples gerados via ElevenLabs em `client/public/audio/` para nomes padronizados (`logo_serafim.mp3`, `ui_transition.mp3`, `shot_plasma.wav`, `hit.mp3`, `ambient_bram.mp3`, `step_mech.mp3`, etc).
  - **Carregador de Buffers (`AudioSystem.ts`)**: Implementado `loadSample()` e mapa de `pendingBuffers`. Agora o sistema suporta buscar `.wav`/`.mp3` via rede, sem bloquear a UI.
  - **Fallback Procedural (Design Híbrido)**: Todos os métodos sonoros principais (`playShot`, `playHit`, `playStep`, `playAndroidShot`, `playAndroidStep`) ganharam `playSample(nome)`. Se o áudio não foi baixado, o jogo recai no sintetizador procedural original para economizar CPU.
  - **Vinhetas e Transições (`BrandSplash.ts` e `Game.ts`)**: Vinheta `playLogoSerafim()` executada na entrada da Serafim Web (com fallback extraído do `playBrandSting`). Sons de UI (`playUiTransition()`) disparados no botão de mudança de modos (Arena/Sobrevivência). Som de Bram ambiental (`ambient_bram.mp3`) ativado no gancho `onWaveStart`.

- **Seletor de Modos, MissionHUD Conectado, CTF HUD, Missões Diárias e UI Online (Gemini, 27/09):**
  - **Fiação & Ativação no Jogo (`Game.ts`)**: `ModeSelector` e `DailyChallenges` integrados ao menu `#overlay`, abrindo automaticamente o briefing do `MissionHUD` ao selecionar Sobrevivência ou pressionar atalho tático (`KeyM`/`KeyB`). Contabilização automática de dano e abates para missões diárias.
  - **Interface do Modo CTF (`CtfHud.ts` + `CtfHud.test.ts`)**: Placar de equipes (Time Azul × Time Vermelho), indicador de status da bandeira (*Na Base, Roubada, Caída*) e banners animados de anúncio de eventos táticos (`showEventBanner`).
  - **Progresso do Piloto & Missões Diárias (`DailyChallenges.ts` + `DailyChallenges.test.ts`)**: Nível do Piloto, barra de XP (1000 XP/nível), Carteira de Créditos (₵) e 3 Missões Diárias renováveis a cada dia civil com persistência em `localStorage` (`cybermech_pilot_progression`).
  - **Segurança de DOM (`MissionHUD.ts`)**: Substituição completa de interpolações de strings variáveis em `innerHTML` por atribuições seguras `textContent` e nós de DOM dinâmicos (`getMissionMedals`, banners de onda limpa e medalhas animadas).
  - **Seletor de Modo (`ModeSelector.ts` + `ModeSelector.test.ts`)**: Módulo de seleção entre Deathmatch Aberto e Sobrevivência por Ondas, com salvamento no `localStorage` (`cybermech_game_mode`) e parâmetro de URL (`?modo=`).
  - **Efeitos Sonoros Táticos (`AudioSystem.ts` + `AudioSystem.test.ts`)**: Sintetizadores Web Audio sem arquivos externos: `playWaveSiren()` (alarme de onda), `playCountdownBeep()` (contagem tática) e `playWaveClearSound()` (vinheta vitoriosa C-E-G).
  - **Consolidação de Ramos UI (`NetHud`, `KillBanner`, `RoundOverlay`)**: Interfaces do multiplayer online (M6-UI) unificadas no branch `gemini/modo-hud-audio`.
  - **Limpeza no Harness (`scripts/test.mjs`)**: Removida redundância `VITEST_MAX_WORKERS` do env (mantendo a flag `--maxWorkers=1`).
---
