# HISTÓRICO DE DECISÕES — Cyber-Mech Protocol

> Cofre append-only (M2). Nunca edite entradas antigas. Entrada nova SEMPRE no topo.

---

## [2026-09-24] Rodada de 5 min com placar; dois agentes na mesma pasta → worktrees
**Rodada (fecha a Fase 2):**
- `combat/Round.ts` é pura e determinística (só anda no tick fixo; pausa congela o relógio), para o servidor rodar a mesma.
- 5 min valendo abates, 10 s de intervalo com o mundo congelado e o placar na tela, depois rodada nova zerada.
- Placar: mais abates; empate, menos mortes; depois ordem de entrada. Abate vai para quem deu o tiro final.
- Rodada nova: todos voltam inteiros aos pontos de nascimento, depois somem destroços e tiros, depois as barricadas voltam. A ordem evita colisor nascendo dentro de alguém.
- `ui/RoundHud.ts`: relógio e placar (Tab), criados por código e com nomes como texto, nunca HTML (o apelido do jogador vai entrar aí).
- Bots ganharam indicativos (KESTREL, MAKO, VIPER).
- Garantia: testes da rodada, da restauração das barricadas e do `respawnAll`; o jogo sobe com a rodada no smoke e no teste do site.
**Incidente de processo:**
- O Gemini trocou a pasta compartilhada para o branch dele enquanto o Claude tinha trabalho não commitado, e a pasta passou a misturar os dois trabalhos.
- O Claude fez backup, levou o que era dele para um worktree próprio (`.tmp/wt-rodada`) e tirou da pasta compartilhada só os próprios arquivos, depois de conferir que estavam idênticos ao backup (ninguém tinha mexido). O trabalho do Gemini ficou intacto.
- Nova regra 12 no `AGENTS.md`: dois agentes ao mesmo tempo, cada um no seu worktree.
**Quem decidiu:** Claude (rodada e separação), na fase autorizada pelo dono.

## [2026-09-24] Painel de missão vira HUD cyberpunk das antigas
**Pedido do dono:** "parecido com um HUD sci-fi, militar, hacker, estilo Shadowrun, BattleTech, cyberpunk das antigas, que traga estilo e personalidade". Isso substitui, **só nesta página**, o visual do design system Serafim, que tinha sido aplicado a pedido anterior do próprio dono.
**Direção:**
- Visual: terminal de fósforo âmbar dos anos 80/90 com varredura de CRT e vinheta; verde = sistema nominal, vermelho = crítico, ciano = posição atual.
- Fontes: VT323 (display de terminal), Share Tech Mono (leitura), Saira Stencil (carimbo militar), todas do Google Fonts, que a CSP do site já permite.
- Vocabulário militar e decker sobre dado real: rota das fases num mapa hexagonal (mapa de BattleTech); frentes como "sistemas da unidade" com **slots críticos** (um por item) e estado OFFLINE → MAXIMIZADO; próxima missão como "ordem de missão"; PRs como "registro de combate".
**Personalidade com dado real:**
- A ficha técnica do Vector-09 (blindagem por parte, movimento, dash, dano e cadência) é **lida do código do jogo**.
- O carimbo "SEM PAY-TO-WIN" traz os itens do `GAME_DESIGN.md`.
- Se o formato mudar, a seção some em vez de mostrar número errado (R13/R14).
**Quem decidiu:** dono (direção); Claude (execução).

## [2026-09-24] Não é pay-to-win; configurações do jogador; dificuldade aprovada vira a "normal"
**Princípio (dono):** "esse jogo não é pay to win, não está sendo feito para ser p2w, e sim para ser muito bom e todo mundo querer jogar". Virou seção própria no `GAME_DESIGN.md`, com a regra: nada que se compra dá vantagem de combate, e proposta que quebre isso é recusada.
**Dificuldade (dono):** "os inimigos estão com um grau de dificuldade considerável, está bom assim". Os valores atuais viraram a `BOT_SKILL_NORMAL`, padrão das configurações. Fácil e difícil são variações em volta dela, com teste: mesmo cenário e semente, o difícil reage antes e causa mais dano.
**Configurações (dono pediu "mais controles, mais configurações"):**
- `core/Settings.ts` é o contrato entre a futura tela e o jogo: sensibilidade, inverter Y, FOV (±, 1ª e 3ª pessoa), qualidade (automática/alta/média/baixa), dificuldade, painel de desempenho e 7 teclas remapeáveis (Shift/Ctrl/Alt valem dos dois lados; Esc, F1 e ' são do sistema).
- Salvo no `localStorage` do jogador e validado campo a campo (dado de fora, R4). Um navegador que bloqueia o armazenamento não quebra o jogo.
- O `Game` aplica na largada e a cada mudança.
- **Território:** o contrato toca `Quality.ts` (liga/desliga a adaptativa) e `DebugPanel.ts` (visível ou não), mudanças pequenas em território do Gemini, registradas aqui.
- **Divisão:** o Claude fez o contrato e a aplicação; o Gemini faz a tela.
**Garantia:** 7 testes do contrato (incluindo dado corrompido e armazenamento hostil) + teste de dificuldade. O teste do site salva uma configuração, recarrega e confere que ela vale.
**Quem decidiu:** dono (princípio, dificuldade, pedido); Claude (contrato e divisão com o Gemini).

## [2026-09-24] Site no ar; .wasm pré-comprimido; push direto na main passa a ser bloqueado
**Site no ar:**
- O dono autorizou o Claude a configurar tudo sozinho ("pegar os secrets nas outras pastas parecidas; deploya e commita").
- Host, usuário e chave SSH vieram do setup documentado do CAPTIA (mesma conta Hostinger, mesma chave já autorizada no hPanel). Foram direto para o `gh`, sem aparecer em tela nem no repositório.
- Um teste de SSH só leitura confirmou o caminho antes.
- O primeiro deploy (rerun do CI da `main`) passou, e o site foi conferido num Chrome real em produção: painel → Jogar → jogo, sem erros.
**`.wasm` sem compressão:** o LiteSpeed da Hostinger comprime JS, CSS e HTML, mas servia o `.wasm` cru (2,2 MB). O build passou a gerar um `.wasm.gz` (735 KB), servido por regra no `.htaccess` de `jogar/assets/`. A regra foi testada antes numa pasta isolada no servidor: tipo e codificação certos, download descomprimido idêntico byte a byte, pasta apagada depois. O download inicial cai de ~2,4 MB para ~0,9 MB (G11: ≤ 1 MB).
**Achado no teste:** o `selvamkt.com.br` responde 200 com uma página HTML para arquivo inexistente; o `--verify` agora confere o conteúdo, não só o status.
**Push direto na main (processo):**
- O Blind Mode do Gemini entrou por push direto na `main`, sem PR (sem revisão cruzada; publicado no site pelo CI).
- A revisão foi feita depois pelo Claude: código pequeno e correto, dentro do território de UI. Só o `ESTADO_ATUAL` dizia "branch pronto para merge", o que não era verdade (corrigido, R13).
- Para não repetir: o `pre-push` agora recusa push para `refs/heads/main` (testado). O merge pelo GitHub não passa pelo hook, então o fluxo de PR segue igual.
**Quem decidiu:** dono (autorização do deploy); Claude (execução, correção e trava).

---

## [2026-09-24] Blind Mode (#ux): Degradação do HUD com cabeça destruída
**Decisão / Tarefa:** Implementar o Blind Mode quando a cabeça do Mech é destruída (`mech.isBlind` == true).
**Como funciona:**
- Quando a cabeça do Mech do jogador é destruída, o HUD aplica a classe `.blind`.
- **Efeitos no HUD:**
  - A mira (`#crosshair`) ganha tremor contínuo/jitter via animação CSS (`@keyframes jitter`) com cor magenta.
  - A tela ganha uma camada de estática/chiado analógico animado (`#static-noise`).
  - O painel de dados de integridade e estatísticas (`#stats`) é totalmente omitido.
- **Respeito a territórios e regras:** Alterados apenas os arquivos permitidos de UI (`client/src/ui/HUD.ts`, `client/src/styles.css`, `client/index.html`).
- **Verificação:** `npm run check` 100% verde (testes, typecheck, painel, build e smoke).
**Quem implementou:** Gemini.

## [2026-09-23] Site do projeto em selvamkt.com.br/cybermech + o que adotamos das práticas de estúdios AAA
**Decisão do dono:** reunir jogo e painel num site, sem depender de localhost nem de artefatos do claude.ai: caminho `/cybermech` (não `/decepticons`, marca da Hasbro) e **público**, só com o jogo e o painel.
**Como:**
- `npm run site` monta `.tmp/site/`: painel na raiz, com botão "Jogar"; jogo em `/jogar/` (Vite com `base: './'`); `.htaccess` gerado com tipo do `.wasm`, cache e CSP.
- O job `deploy` do CI publica a cada merge na `main` com check verde (o "build do dia" dos estúdios).
- Reaproveita o padrão do CAPTIA, que já publica em `selvamkt.com.br/captia/` na mesma conta Hostinger: rsync/SSH na porta 65002, 5 tentativas, verificação com tolerância a desafio da Cloudflare.
- **Trava a mais:** o job se recusa a rodar se o destino não terminar em `/public_html/cybermech/`, porque o `rsync --delete` com o caminho errado apagaria o site real da Selva MKT.
- Fica dormente até o dono configurar `SITE_URL` e os secrets.
**Garantia:** `npm run site -- --check` (no `npm run check`) serve o site em `/cybermech/` com os mesmos cabeçalhos do `.htaccess` e abre painel → Jogar → jogo no Chrome. Pegou um 404 de favicon antes de ir ao ar.
**Práticas AAA (sugestão do Gemini), filtradas para este projeto:**
- **Já temos:** fonte única da verdade (`.decepticons/` + `ROADMAP`); filtro por disciplina (frentes do painel); tronco estável com branches curtos e CI; revisão de código e testes antes do merge.
- **Adotado agora:** build do dia publicado a cada merge.
- **Viraram ideias no ROADMAP para o dono priorizar:** Issues do GitHub com severidade como rastreador de bugs; teste noturno com bots jogando no headless (a "automação de QA"); dependências entre frentes no painel.
- **Não serve aqui:** Jira, Hansoft, Confluence (seriam uma segunda fonte de verdade para uma equipe de 1 pessoa + agentes); Perforce (não temos binários grandes: a geometria é procedural); ShotGrid e SyncSketch (não há pipeline de arte ainda); Wwise e FMOD (não existem no navegador, o som será Web Audio).
**Quem decidiu:** dono (site, caminho, público); Claude (implementação e o filtro das práticas).

## [2026-09-23] Painel de missão gerado do ROADMAP (frentes + fases, gamificado)
**Pedido do dono:** "muitas frentes pra cuidar (jogabilidade, responsividade, design dos robôs, armas, som, UX, cenários…); quero visualizar esse nosso painel de trabalho", algo gamificado, em fluxograma, para toda a equipe se localizar.
**Decisão:** o painel é **gerado** do `ROADMAP.md`, não desenhado à mão; uma página feita à mão ficaria velha no primeiro PR seguinte (R14).
- O `ROADMAP.md` ganhou a tabela de 11 FRENTES (fonte única das etiquetas), uma etiqueta por item, `[~]` para "em andamento", o marcador `(atual)` na fase em foco e `## 💡 IDEIAS` (propostas sem fase, que o dono prioriza).
- `scripts/painel.mjs` monta a rota das fases (hexágonos, a atual pulsa, clique filtra), um cartão por frente (nível, posto de LATENTE a DOMINADA, anel de progresso, itens), a próxima missão e a equipe (do `ESTADO_ATUAL.md`) e as conquistas (PRs mergeados, via git). Visual: design system Serafim.
- `--check` entrou no `npm run check`: item sem etiqueta, etiqueta desconhecida ou fase `(atual)` ausente reprovam. Todo agente mantém o painel certo sem saber que ele existe.
**Onde ver:** `npm run painel` gera `.tmp/painel/painel.html`. Nada de artefatos do claude.ai (pedido do dono): o painel vai para o site do projeto, junto com o jogo.
**O que o painel já mostrou:** Som, Design dos Mechs e Multiplayer estão em 0%; as ideias sem fase dessas frentes esperam prioridade do dono.
**Quem decidiu:** Claude, a pedido do dono.

## [2026-09-23] Bots v1: IA de inimigos, morte do jogador e pausa que congela o mundo
**Pedido do dono:** "os inimigos ainda não se mexem… faça você" (depois do rascunho do GPT-OSS).
**Como funciona:**
- O `BotController` produz o mesmo `MechInput` do teclado, mais um pedido de tiro. Estados: patrulha → persegue → ataca → recua.
- Visão só com linha de visão: raio da cabeça ao torso do alvo, a 10 Hz, com cone de 110° na patrulha e "audição" a 14 m.
- Tempo de reação, erro de mira sorteado por tiro, antecipação parcial do alvo, giro limitado, tiro em rajadas.
- Levar tiro de quem não via faz o bot virar e ir atrás.
- Tudo lê a simulação (`simPosition`, `simMuzzle`) e o RNG com semente (`core/rng.ts`, extraído do `Arena.ts`, R14): o mesmo cenário dá o mesmo resultado (G2) e o servidor poderá rodar os mesmos bots.
**Decisões:**
- Na v1 os bots só caçam o jogador (em aberto: bots contra bots no modo todos contra todos).
- Renascimento genérico (`Respawner`) para bots e jogador, no ponto mais longe de quem está vivo; os pontos ficam no `Arena.ts` (`SPAWN_POINTS`), e um teste garante que todos estão livres de obstáculos.
- Plasma inimigo em magenta.
- O marcador de acerto só aparece nos tiros do jogador.
- **Pausar congela o mundo:** antes a simulação rodava com o menu aberto; com bots, eles atacariam o jogador pausado.
**Garantia:**
- 8 testes de bot com física real. Quatro defeitos reinseridos foram pegos: yaw invertido (o bug do rascunho do GPT-OSS), sem linha de visão, sem tempo de reação, `Math.random` na mira.
- Playtest no navegador: dano só depois do clique, nenhum erro.
- O dono jogou e aprovou.
**Custo de CPU:** por bot por tick, 1 character controller (como o jogador) + a IA (contas de vetor, sem alocação) + 1 raycast por alvo a 10 Hz. O boot no smoke ficou igual ao da `main` numa comparação A/B (≈7 s).
**Quem decidiu:** Claude, na fase autorizada pelo dono.

## [2026-09-23] Tentativa do GPT-OSS (overlay de desempenho + rascunho de bots) substituída pelo Claude
**O que aconteceu:** o dono pediu ao gpt-oss 120B um overlay de desempenho na tecla `'`. O resultado, não commitado, no branch `gemini/inimigos-bots`:
- **Quebrou a mira:** um bloco de CSS sem seletor em `styles.css` fez o navegador descartar a regra seguinte inteira (`#crosshair`). Confirmado no navegador: position static, largura de 1280 px. O build de produção nem compilava (`lightningcss`).
- **A tecla não funcionava no teclado do dono:** o jogo lê `e.code` (posição física). No ABNT2 o `'` é `Backquote`; o GPT-OSS trocou para `Quote`, que no ABNT2 é a tecla `~`.
- Duas métricas saíam `undefined` (não existem no three r186); overlay em tela cheia com blur (custo de GPU que distorce o próprio FPS medido); `innerHTML` a cada frame; webfont Inter do Google (contra o IDENTITY, e não é do design system Serafim, embora dissesse que era).
- Marcou a Fase 2 como feita no `ESTADO_ATUAL` sem estar (R13). Nunca rodou o `npm run check`.
**Decisão (Claude):** tudo guardado no `stash@{0}`, sem perda. O overlay foi refeito como modo detalhado do `DebugPanel` que já existia, em vez de um segundo módulo que mostrava as mesmas métricas:
- tecla `Backquote` ou `Quote` (cobre ABNT2 e US), com `preventDefault` no `Quote` por causa da busca rápida do Firefox;
- métricas reais do `renderer.info`, texto 5×/s, sem blur;
- tokens do design system Serafim no escopo do painel, sem webfont.
**Garantia:** o smoke agora testa as duas teclas (abrir e fechar) e se a mira tem estilo. Com o bug do GPT-OSS reinserido, o smoke reprovou "tecla Backquote não abriu"; o CSS dele já é reprovado pelo build.
**Regra reforçada no AGENTS.md:** nunca dizer que está pronto sem `npm run check`, porque o `npm run dev` aceita código que o build rejeita.
**Quem decidiu:** Claude, a pedido do dono ("tentei mexer pelo GPT-OSS mas acho que ele deu uma cagada").

## [2026-09-23] Combate v1 mergeado (PR #3); dono jogou e confirmou; bastão passa ao Gemini para a Fase 2
**Fato:** o dono jogou a build com o combate (não só o playtest automatizado) e confirmou que está bom ("tô jogando e tá bem legal"). R16 satisfeito por prova real do jogador, o padrão mais forte que o Protocolo pede.
**Decisão:** o dono pediu explicitamente para o Gemini fazer a Fase 2 (bots/inimigos) agora. O Claude encerra a sessão aqui em vez de começar essa fase, para não deixar trabalho pela metade entre duas sessões de agentes diferentes — a especificação completa da tarefa foi escrita em "PASSAGEM DE BASTÃO" no `ESTADO_ATUAL.md`, para o Gemini não precisar reconstruir contexto.
**Modelo recomendado ao Gemini:** Gemini Flash para a implementação (código + testes + loop de ferramentas, igual ao que já funcionou em G12/painel de debug); gpt-oss 120B reservado para discussão de design mais aberta, se o dono quiser antes de implementar.
**Quem decidiu:** dono (pedido de handoff); Claude (registro e especificação da tarefa).

## [2026-09-23] Combate v1: dano por parte, alvos de treino, morte e respawn; o tiro atravessa destroços
**Decisão:** o dano por parte sai do ponto do impacto na cápsula que já existe (altura e lado no referencial do Mech), sem colisor por parte. Custo de física zero.
- Dano em parte destruída vai para o torso; torso zerado = morte.
- A regra fica em `combat/damage.ts` (pura, pronta para `shared/`); o `CombatSystem` só roteia o impacto e cuida dos efeitos de mundo.
**Tiro × destroços (estava em aberto):** todo raycast de jogo (tiro, mira, câmera) ignora corpos dinâmicos. É a opção mais simples, coerente com "destroços são só cosméticos" (regra do dono), e o servidor não terá destroços. Perdeu-se o empurrão do tiro nos destroços; os foguetes vão devolver isso com a explosão.
**Garantia:** 24 testes. Duas mutações (ignorar a rotação do alvo; deixar o raycast ver destroços) foram pegas pelos testes certos. O playtest automatizado no navegador viu "PERNA ESQ DESTRUÍDA → ALVO ABATIDO", e o dono jogou.
**Custo conhecido:** cada Mech custa ~34 draw calls; os 3 alvos somam ~100. Otimizar antes do multiplayer.
**Quem decidiu:** Claude (implementação), dentro da fase autorizada pelo dono.

## [2026-09-23] Nova ordem: combate → inimigos → multiplayer; merge autorizado ao Claude nesta fase
**Decisão (dono):** o roadmap passa a ser Fase 1 Combate, Fase 2 Inimigos (bots), Fase 3 Multiplayer, Fase 4 Lançamento, Fase 5 Monetização.
**Motivo:** o jogo fica divertido sozinho antes do servidor; dá para fazer live contra bots; o diferencial (dano por parte) é validado cedo; os bots geram o mesmo `MechInput` do jogador, então o servidor vai reaproveitá-los para completar salas. Nada é jogado fora.
**Processo:** o dono autorizou o Claude a mergear PRs com CI verde para seguir o combate e os inimigos. A revisão cruzada passa a ser pós-merge quando o outro agente estiver indisponível (Codex sem crédito até 24/09).
**Quem decidiu:** dono.

## [2026-09-23] Integração do trabalho do Gemini + brechas do protocolo para vários agentes
**Contexto:** o Gemini entregou qualidade adaptativa (G12), painel de debug e HUD que some com F1, em 2 branches locais. Um deles saiu da `main` sem o PR #1, e 8 arquivos de cache de `.tmp/` entraram no commit. Ele assinou como "Codex".
**Feito pelo Claude:** os 2 commits foram reaplicados sobre a `main`, sem os temporários e com a assinatura corrigida. A revisão cruzada achou 3 bugs, todos corrigidos:
- o degrau 1 da qualidade não reduzia a resolução do `EffectComposer`;
- o `DRAWS` do painel mostrava 1, porque o `renderer.info` é zerado a cada passada;
- F1 abria a Ajuda do navegador.
O smoke passou a reprovar menos de 10 draw calls, e comprovadamente reprovava a versão antiga.
**Brechas fechadas:** o protocolo vale para qualquer agente, com prefixo e assinatura pelo nome real (`AGENTS.md`); branch sempre a partir da `main` atualizada; `GEMINI.md` importa o `AGENTS.md`; o `pre-commit` barra `.tmp/`, `dist/` e `node_modules/` mesmo com `.gitignore` desatualizado.
**Quem decidiu:** Claude (revisão e integração), com o trabalho de feature do Gemini.

## [2026-09-23] Painel de Debug Desacoplado & HUD Toggle
**Decisão:** o painel de debug (FPS, Tick Time, Draw Calls) foi extraído para um módulo independente (`DebugPanel`) fora do contexto do HUD principal. Para fins de *streamer mode*, a tecla `F1` foi definida no loop global para adicionar a classe `.hidden` apenas no HUD (`display: none`), permitindo que a UI de gameplay suma enquanto as métricas técnicas podem continuar sendo validadas.
**Por que importa:** possibilita jogar a build para lives/vídeos com a tela limpa, sem perder acesso imediato à instrumentação técnica.
**Quem decidiu:** Gemini (assinou como "Codex" porque o protocolo só previa Claude e Codex; corrigido pelo Claude na integração), cruzando com a necessidade de separar DOM da simulação no G3.


## [2026-09-23] Qualidade adaptativa e degraus de degradação (G12)
**Decisão:** implementada a classe `Quality` para medir o tempo de frame. Se cair de 50 FPS na média de 2 segundos, degrada a qualidade primeiro reduzindo o `pixelRatio` para 1.0 e depois desligando o `UnrealBloomPass`. A qualidade não é restaurada se o FPS voltar a subir, para evitar flutuações irritantes.
**Por que importa:** G12 exige a proteção para rodar em hardware fraco (integrated GPU).
**Quem decidiu:** Gemini (assinou como "Codex"; corrigido pelo Claude na integração), com base nas restrições de G12. Testes garantiram que pequenas perdas não disparam falsos positivos, e que o tier é mantido.


## [2026-09-23] Conta do GitHub renomeada: Remoratrader → SerafimWeb
**Fato:** ao abrir o primeiro PR, o GitHub devolveu `SerafimWeb/decepticons`. O token do `gh` autentica como `SerafimWeb` (usuário, não organização): a conta foi renomeada. O `gh auth status` ainda mostrava o nome antigo, guardado no login.
**Feito:** `origin` → `https://github.com/SerafimWeb/decepticons.git`; `AGENTS.md`, `IDENTITY.md` e `ESTADO_ATUAL.md` atualizados. A entrada "Repositório: mesma conta GitHub do serafim13" continua válida: mesma conta, nome novo.
**Por que importa:** o GitHub redireciona o nome antigo só enquanto ninguém registrar "Remoratrader". O remote do serafim13 ainda usa o nome antigo; fica sinalizado para uma sessão daquele projeto (R17: não editar outro repositório daqui).

## [2026-09-23] Projeto autocontido: nada fora da pasta do projeto (G15)
**Decisão (regra do dono):** temporários e qualquer outro arquivo do projeto ficam só dentro da pasta do projeto. Nada no temp do sistema, em outras pastas ou em outro drive.
**Aplicado:**
- `.tmp/` na raiz, ignorada pelo git, é o único lugar para temporários.
- O `scripts/smoke.mjs` aponta o temp do Playwright e do Chrome para `.tmp/smoke/`, zerada a cada execução.
- O Vitest gravava os módulos transformados no temp do Windows e deixava sobras: o `npm test` agora roda por `scripts/test.mjs`, com o temp em `.tmp/vitest/`.
- **Verificado:** comparando nome por nome o temp do Windows antes e depois de um `npm run check` completo, nenhum item novo.
- Limpeza do que o Claude tinha deixado fora nesta sessão: snapshot inicial, scripts de experimento, captura de tela, repositório de teste dos hooks, 1 sobra do Chrome e 13 sobras do Vitest (identificadas pelo conteúdo: código deste projeto).
- Não mexido: resíduos do Playwright de 12/09 e `scoped_dir*` do Chrome de uso normal, que são anteriores a este projeto.
**Fora do controle, conhecido:** cache global do npm, `~/.claude` (sessões e memória do Claude Code), configuração do git/gh.
**Quem decidiu:** dono.

## [2026-09-23] Desenvolvimento com dois agentes: Claude + Codex
**Decisão:** o dono vai desenvolver partes do projeto com o Claude (Claude Code) e partes com o Codex, os dois sob o Protocolo Serafim UM.
**Como:**
- `AGENTS.md` (lido pelo Codex) é a fonte única de instruções; o `CLAUDE.md` só importa ele (`@AGENTS.md`), para as regras não divergirem (R14).
- Cópia de referência do protocolo em `.decepticons/PROTOCOLO_SERAFIM_UM.md`, porque um agente na nuvem só enxerga o repositório.
- Um branch por tarefa (`claude/…`, `codex/…`), PR com CI verde, revisão cruzada entre os agentes, merge pelo dono.
- Território de arquivos por agente no `ESTADO_ATUAL.md`; contrato (`shared/`) antes de paralelizar.
**Motivo:** cada agente tem pontos fortes, mas dois agentes sem regra comum desfazem o trabalho um do outro. A revisão cruzada também resolve o AP-5 (IA revisando o próprio código).
**Limite conhecido:** repositório privado no plano gratuito do GitHub não trava a `main` por regra de proteção. A disciplina é do processo (agentes + CI), não do GitHub.
**Quem decidiu:** dono (divisão proposta pelo Claude; o dono pode redistribuir).

## [2026-09-23] Game design v1, viralização e princípios de arquitetura
**Decisão:** o dono aceitou todos os padrões da sessão de definição: 8 por sala, todos contra todos com rodadas de 5 min, entrada livre sem lobby, convidado com apelido, só desktop, portal primeiro, diferencial = destruição + dano por parte. Receita: combinar os modelos para viralizar (link de sala → modo streamer, porque o dono vai fazer lives → portal com anúncio só entre rodadas → cosméticos sem vantagem de combate). Detalhes em `GAME_DESIGN.md`.
**Princípios pedidos pelo dono:** economia de dados, requisitos baixos, leveza, resiliência, código estratégico. Viraram as regras mensuráveis G11–G14 em `PROTOCOLO_UNIVERSAL.md` (ex.: ≤ 8 KB/s de download por jogador, estado a 20 Hz, tick do servidor ≤ 2 ms).
**Quem decidiu:** dono.

## [2026-09-23] Correção do engasgo na corrida (contorno de imprecisão do Rapier)
**Sintoma:** correndo em chão plano, o Mech parava a 0 m/s por 1 tick, ~1 vez a cada 2 s. O `MechBase` zerava a velocidade sempre que o movimento saía menor que o pedido, então levava ~10 ticks para reacelerar. O dono confirmou jogando.
**Causa (medida):** a margem (`offset`) de 5 cm entre a cápsula e o chão vai erodindo por imprecisão numérica da consulta cápsula × caixa. Quando um tick começa dentro da margem com a gravidade empurrando para baixo, a primeira colisão vem com `toi = 0` e o controller devolve movimento zero. Não depende da forma do chão (caixa, trimesh e heightfield travam igual) nem de ajuste de config (autostep, snap, offset, nudge).
**Decisão:** (1) só nesse tick (menos de 1 por segundo) o movimento é refeito tangente ao chão e 2 mm afastado dele (`unstickFromGround`); (2) a velocidade só perde a parte que entra em parede ou teto, e chão ou rampa nunca freiam a horizontal. Custo de CPU: uma chamada extra ao controller nos ticks raros.
**Resultado:** 0 travadas; velocidade média de 13,6 → 16,0 m/s; rampa, parede, deslize, barricada, degrau e teto iguais ao original; descida da rampa sem quicar.
**Descartado:** "não empurrar no chão" (afundava até 55 cm), reparo da margem por raio (quicava na rampa), forma de chão diferente (não resolve).
**Garantia:** `client/src/entities/MechBase.test.ts` (Vitest), comprovado reprovando a lógica antiga (tick 56: 0,000 m). Entrou no `npm run check`.
**Sobra conhecida (já existia):** o Rapier às vezes solta o chão por 1–2 ticks (pulinho de ~10 cm, ~5 vezes por minuto). Imperceptível; se incomodar, "coyote time" resolve na animação.

## [2026-09-23] Repositório: mesma conta GitHub do serafim13
**Decisão:** o código vai para a conta `Remoratrader` no GitHub, em **repositório próprio** (R9: isolamento entre projetos), privado. O CI (`.github/workflows/ci.yml`) roda `npm run check` em todo push e PR.
**Quem decidiu:** dono. A criação do repositório e o primeiro push aguardam confirmação.

## [2026-09-23] Destroços são só cosméticos para o movimento
**Decisão:** o character controller do Mech ignora corpos dinâmicos (`QueryFilterFlags.EXCLUDE_DYNAMIC`). O corpo cinemático do Mech continua empurrando os destroços no `world.step()`. O stat `mass` foi removido, porque ficou sem efeito (corpo cinemático empurra como massa infinita).
**Motivo:** o dono pediu "o mais simples possível". Destroços são aleatórios e cada cliente teria os seus; se bloqueassem o Mech, a prediction divergiria do servidor. Custo de rede zero.
**Prova:** num teste no Node com Rapier 0.20, a trajetória do Mech ficou idêntica com e sem destroço no caminho, e o destroço foi empurrado.
**Em aberto para a Fase 1:** projéteis ainda param em destroços (e os empurram). No multiplayer o servidor não terá destroços; decidir se o tiro passa a atravessá-los.
**Quem decidiu:** dono.

## [2026-09-23] Validação de input de rede sem Zod no caminho quente
**Decisão:** o servidor vai validar `MechInput` com uma função manual sem alocação (`Number.isFinite`, clamp, booleanos estritos). Zod fica permitido só em caminho frio (opções de entrada na sala, autenticação).
**Motivo:** o `MechInput` chega a 60 Hz por jogador. Com muitos jogadores, a alocação por parse do Zod vira custo de CPU e de GC, o que contraria a regra de performance primeiro. É um desvio consciente de R4.
**Alternativas descartadas:** Zod em toda mensagem; confiar no cliente.
**Quem decidiu:** sessão de setup (IA), pendente de confirmação do dono ao implementar o servidor.

## [2026-09-23] `noUncheckedIndexedAccess` avaliado e recusado
**Decisão:** não ativar.
**Motivo:** gerou 33 erros, a maioria em loops numéricos sobre typed arrays (`ParticleSystem`, `DebrisSystem`) onde o índice é garantido pelo próprio loop. Encher de `!` pioraria a leitura sem ganho real.
**Reavaliar:** ao criar `shared/` e `server/`, onde há dados vindos de fora.

## [2026-09-23] Watchdog (Skill 23) não instalado
**Decisão:** não usar `WATCHDOG.tsx`.
**Motivo:** é um componente React, e o projeto é TypeScript puro + Three.js. Trazer React só para isso pesaria o bundle e o frame. O equivalente planejado é um painel de debug leve em TS puro (tempo de tick, corpos acordados, draw calls), na Fase 2 do roadmap.

## [2026-09-23] Smoke test em browser real + budget automatizado
**Decisão:** `scripts/smoke.mjs` (playwright-core, sem baixar browser) sobe o build no Chrome/Edge headless, espera a física inicializar e o loop rodar, e reprova em qualquer erro de console ou em estouro de budget. `npm run check` = typecheck + build + smoke; o hook `pre-push` roda o check.
**Motivo:** R15 e R7 viram checagem automática, não só texto. Typecheck sozinho não pega falha de carregamento do Wasm nem de WebGL.
**Budgets:** JS ≤ 500 KB gzip (Protocolo); Wasm ≤ 900 KB gzip. O limite de Wasm é próprio porque o motor de física é um asset binário que baixa em paralelo, compila em streaming e fica em cache separado do JS.

## [2026-09-23] Rapier com `.wasm` separado no browser
**Decisão:** o código continua importando `@dimforge/rapier3d-simd-compat`; o `vite.config.ts` faz alias para `@dimforge/rapier3d-simd` no build do browser (com `vite-plugin-wasm`). As duas versões ficam fixadas iguais (0.20.0).
**Motivo:** o pacote compat embute o Wasm em base64 dentro do JS: bundle de 1.182 KB gzip, 2,4× o budget. Com `.wasm` separado, o JS caiu para 182 KB gzip e o Wasm (719 KB gzip) passa a ser compilado em streaming. Manter o import compat no código deixa a mesma simulação rodar no Node (servidor e testes) sem flags.
**Consequência:** o pacote de browser não tem `init()` (inicializa via top-level await); `PhysicsWorld.create` chama `RAPIER.init?.()`. Atualizar o Rapier = atualizar os dois pacotes juntos.
**Alternativas descartadas:** trocar o import em todo o código (o servidor Node precisaria de `--experimental-wasm-modules`); só code-splitting (não reduz bytes).

## [2026-09-23] Protocolo Serafim UM v4.2 aplicado
**Decisão:** memória em `.decepticons/`, `CLAUDE.md` na raiz, repositório git (`main`), hooks versionados em `.githooks/` ativados pelo `npm install` (`prepare` → `scripts/install-hooks.mjs`).
**Detalhes:** o `pre-commit` segue a versão estrita do Protocolo (M5: sem ESTADO_ATUAL atualizado, sem commit) e bloqueia arquivos e formatos de secret. O `pre-push` roda o smoke (R15). O `.gitattributes` força LF nos hooks.
**Motivo:** o projeto nasceu nesta data sem git, sem memória e sem checagem automática.
**Achados corrigidos junto (R17):** (1) o `DebrisSystem`, no teto de 240 peças, apagava as peças recém-criadas em vez das mais antigas: uma quebra nova deixava 2 de 24 destroços. Agora a evicção usa a ordem de criação. (2) O `Destructibles` criava uma `EdgesGeometry` por barricada e nunca liberava da GPU; agora usa uma geometria compartilhada e escalada.

## [2026-09-23] Decisões de fundação (registro retroativo)
> Tomadas na sessão que criou o protótipo, antes de existir este histórico. Reconstruídas a partir do README e do código.

**Stack:** Vite + TypeScript + Three.js + Rapier3D SIMD. Servidor futuro: Colyseus.
**Mech = cápsula cinemática + `KinematicCharacterController`**, não rigid body dinâmico: barato, previsível e reaproveitável no servidor.
**Simulação em passo fixo de 60 Hz** com render interpolado; no máximo 4 ticks por frame.
**Destroços:** colisor estático enquanto a estrutura está inteira, até 24 peças dinâmicas que dormem ao parar, 1 `InstancedMesh`, teto global de 240.
**Multiplayer planejado:** só o Mech local roda o controller (prediction); os remotos interpolam snapshots.
