# HISTÓRICO DE DECISÕES — Cyber-Mech Protocol

> Cofre append-only (M2). Nunca edite entradas antigas. Entrada nova SEMPRE no topo.

## [2026-09-24] Volume nas configurações
**Decisão (Gemini):** Adicionado campo de volume (0 a 1) nas configurações, acessível pelo menu e sincronizado com o ganho mestre do `AudioSystem` na inicialização e atualização das configurações.

## [2026-09-24] Paleta âmbar industrial: sai o azul e o roxo
**Pedido do dono:** "azul e roxo é a assinatura de feito com IA, temos que mudar isso também".
**Decisão (Claude, dentro da identidade que o dono já aprovou no site):** o jogo passa a usar o âmbar industrial do site (terminal de fósforo, aço, luz de sódio).
- **Arena:** contornos em âmbar, branco quente e laranja de sódio; chão de aço com grade âmbar; luz quente; balizas vermelhas.
- **Mechs:** jogador laranja-ferrugem com visor âmbar; inimigos verde-oliva com visor vermelho.
- **Tiros:** do jogador em âmbar, do inimigo em vermelho, para saber de onde vem cada tiro.
- **Interface:** tokens com nome de papel (`--accent` âmbar, `--hot` laranja, `--alert` vermelho, `--ink` branco quente); a mira fica vermelha sobre o inimigo; fundos azul-marinho viraram marrom-escuro.
- **Site:** o ciano secundário virou branco quente (links, fase atual); o Gemini deixou de ser azul nos cartões.
- **Regra nova (IDENTITY):** cor nova entra primeiro no `core/palette.ts` / `:root`; nada de azul nem roxo.
**Custo de CPU:** nenhum (só troca de cor; os materiais são os mesmos).
**Quem decidiu:** dono (sair do azul/roxo); Claude (paleta, a ajustar com o olho do dono).

## [2026-09-24] Toque: botões em arco, editor de controles e mira sem "falha"
**Relato do dono (terceiro teste no celular):** "a mira ainda não tá boa, meio falha; os botões num shape meio quadrado não pegam bem meu dedo; poderia ser mais livre o centro do tiro, para segurar com mais conforto, pois assim tenho que segurar bem na ponta".
**Causas:**
- A grade 3×2 colada no canto obrigava o polegar a ir até a ponta do celular.
- O ganho da mira vinha da velocidade crua de cada evento de toque. Os eventos chegam em intervalos irregulares, então o ganho oscilava de um evento para o outro: a mesma arrastada girava diferente.
- A fricção e o puxão da mira assistida continuavam agindo quando o jogador tentava tirar a mira do alvo, e a mira parecia brigar com o dedo.
**Decisão (Claude):**
- **Arco:** botões redondos em arco em volta do polegar (`ui/touchLayout.ts`), com FOGO a ~20% da borda direita. Posições em fração da tela, testadas sem sobreposição em 7 telas (640×360 a 1180×820) e 3 tamanhos.
- **Editor:** "Ajustar controles" na pausa (só no toque). Arrasta cada botão, muda o tamanho (70%–140%), volta ao padrão. Fica salvo no aparelho, numa chave própria (`cybermech.touch.v1`) e validado, sem mexer no contrato de configurações que o Gemini estava editando.
- **Mira:** velocidade do dedo com média exponencial; ganho máximo de 2,2× para 1,6×.
- **Ajuda que solta:** puxar a mira para longe do alvo desliga fricção e puxão por 0,35 s (`movingAway`, testado). O tiro automático continua.
**Custo de CPU:** nenhum por quadro além do que já existia; o editor só age com o jogo parado.
**Quem decidiu:** dono (relato); Claude (desenho).

## [2026-09-24] Bastidores mostram a atividade da equipe (só dados reais)
**Pedido do dono:** "deixa com cara de que está sendo feito por uma equipe, com várias entradas, requisições e commits", sem parecer narrativa.
**Decisão (Claude):** mostrar a atividade que já existe, sem inventar nada. Não precisa: são dezenas de commits e de entregas em dois dias.
- Cada commit é atribuído a quem o fez: a coautoria do Claude no próprio commit; senão, o agente do PR em que ele entrou (etiquetas); sem PR, "equipe".
- Merge de PR na linha principal = entrega; merge de integração = commit.
- Seção "Atividade": commits, entregas, decisões registradas e pedidos do dono atendidos (entradas do cofre que nasceram de pedido ou relato dele).
- Mapa de calor de commits por dia e hora (horário de Brasília) e fluxo dos últimos 40 commits e entregas, com hora, agente e hash.
- Cartões da equipe com commits por agente. A landing ganha um sinal de vida: "N commits e M entregas em D dias · último às HH:MM".
**Limite:** nome de autor do git e nome de conta não aparecem. Os assuntos dos commits são públicos a partir de agora: nada de dado interno neles (o check já reprova o codinome).
**Quem decidiu:** dono (pedido); Claude (fontes e forma).

## [2026-09-24] Foguetes no braço esquerdo; produção toda em código
**Pedido do dono:** "quero adicionar a arma esquerda" e "prefiro fazer tudo aqui no código, eu só orientando e as IAs fazendo".
**Foguetes (Claude):** módulo próprio (`combat/RocketSystem.ts`); a regra de área mora no `CombatSystem.explode`.
- 4 no carregador, recarga contínua de 1 a cada 2,2 s, intervalo de 0,3 s, 75 m/s: visível no ar, dá para desviar de longe.
- Explosão de 6 m: 75 no centro, cai em linha reta até zero na borda. A distância é medida até a superfície da cápsula.
- Acerta a parte mais perto, pela mesma regra de zonas do plasma: no pé, a perna; no peito, o torso. Tática nova: arrancar a perna de quem está atrás da barricada.
- Quem dispara não se fere (sem pulo de foguete por enquanto). Barricadas no raio levam dano.
- Braço esquerdo destruído = sem foguetes; morto, o carregador enche.
- Controles: botão direito ou Q (remapeável) no PC; FOGUETE no toque (segurar dispara no ritmo); PLACAR no toque segura o placar (o Tab do celular).
- Testes: 7 (dano em área, carregador, recarga, perna x cabeça, dono imune, foguete voando com física real).
**Produção (decisão do dono):** sem Unity (seria reescrever tudo e o download iria de ~1 MB para dezenas de MB) e sem modelagem manual. Mechs montados por código a partir de peças, som sintetizado; a variedade vem do Hangar. Registrado no GAME_DESIGN ("PRODUÇÃO: TUDO EM CÓDIGO").
**Divisão:** o Gemini pega som dos foguetes, volume e mixagem, e primeira partida guiada (um PR cada, depois deste merge).
**Custo de CPU:** por foguete em voo, um raycast por tick e 2 partículas; explosão = um laço pelos Mechs e pelas barricadas (evento, não por quadro).
**Quem decidiu:** dono (arma, produção em código); Claude (números e regras, a calibrar no playtest).

## [2026-09-24] Mira no celular: assistida, antecipada e com tiro automático
**Sintoma (dono, segundo teste no celular):** "a jogabilidade no celular tá estranha, tô com dificuldade de mirar e atirar".
**Causa:** com dois polegares, o direito mira ou aperta FOGO, nunca os dois. E o plasma (140 m/s) leva ~0,3 s a 40 m: um bot andando de lado a 16 m/s sai 5 m do lugar. No PC o jogador aprende a antecipar; no dedo, quase impossível.
**Decisão (Claude), só no modo toque, desligável na tela de configurações:**
- **Tiro automático:** atira quando a mira acende há 0,12 s (passar de raspão não dispara).
- **Mira assistida** (`player/AimAssist.ts`, funções puras testadas):
  - Fricção: o dedo fica até 55% mais lento num cone de ~6° em volta do inimigo.
  - Puxão leve no cone de ~5° e rastreio de 75% do movimento do alvo, só enquanto o jogador age (anda, mira ou atira). Parado, a mira nunca joga sozinha.
  - Antecipação: mira onde o inimigo vai estar quando o plasma chegar. O ponto de mira fica na distância do alvo, para o tiro que sai do canhão não errar por paralaxe.
  - Só com linha de visão até o corpo.
- **Dedo:** 0,3°/px devagar (ajuste fino), até 2,2× num arrasto rápido.
- **Mira que acende e vibração:** a mira acende sobre um inimigo (no mouse, o que está sob a mira); vibração ao levar tiro e ao abater (só no toque).
**Medido:** partida emulada (844×390, toque), dedo varrendo sem tocar em FOGO. Antes: a mira acendia e nenhum tiro acertava. Depois: 4 acertos em ~6 s, nas 3 repetições.
**No caminho:** o primeiro teste "falhou" porque o `vite build` com caminho relativo gravou em `client/.tmp/` (a raiz do Vite é `client/`) e o teste rodou o build antigo. Build manual só com caminho absoluto.
**Justiça:** o mouse não tem assistência. No multiplayer, toque x mouse na mesma sala vira decisão em aberto (ESTADO).
**Custo de CPU:** por quadro, um laço pelos inimigos e no máximo um raio de linha de visão, só no toque; nada alocado. De quebra, o `raycast` parou de alocar dois vetores e um objeto por chamada (a mira chama todo quadro, cada projétil todo tick).
**Quem decidiu:** dono (pedido); Claude (desenho).

## [2026-09-24] Kill feed e indicador de dano integrados; indicador corrigido
**Integração (Claude):** o branch `gemini/killfeed-dano` estava pronto mas sem PR. Entrou por um branch de integração a partir da `main`, com o commit do Gemini preservado. O kill feed ajuda no celular: mostra quem abateu quem sem precisar do placar (Tab).
**Revisão cruzada:**
- Kill feed aprovado: pool fixo de 4, `textContent`, destaque do jogador.
- **Indicador de dano com bug:** errava o lado sempre que a câmera girava. O teste do Gemini supunha yaw 90° olhando para +X, mas no jogo a frente é (-sin yaw, 0, -cos yaw), ou seja, -X. Com a câmera virada, tiro de frente aparecia vindo de trás. Correção: relativo = ângulo do atirador **+** yaw. O teste novo usa a frente e a direita do próprio jogo em 5 ângulos.
- O kill feed ficava em cima do rótulo da câmera (`#mode`) e do botão de pausa do toque; foi reposicionado.
**Lição:** o teste tem que derivar a convenção do código do jogo, não de uma suposição. O teste antigo passava porque codificava o mesmo engano da função.
**Quem decidiu:** Claude (integração e correção).

## [2026-09-24] Celular: controles de toque refeitos e testados no check
**Sintoma (dono, num Android deitado):** "não consegui jogar no celular: botões mal posicionados, um sobre o outro, muito grandes; o direcional ficou preso; não entrou no jogo, ficou na tela de config".
**Causas (PR #17):**
- As duas áreas de toque cobriam a tela inteira mesmo com o jogo pausado e davam `preventDefault` no `touchstart`, então o toque nunca chegava à tela de pausa e o jogo nunca começava.
- Os botões ficavam em posições percentuais soltas, e FOGO e PULO se sobrepunham.
- O modo toque era decidido por `navigator.maxTouchPoints > 0`, o que tiraria o Pointer Lock de qualquer notebook com tela de toque.
**Correção (Claude, a pedido do dono; território do Gemini, registrado no ESTADO):**
- Controles só com o jogo rodando e no modo toque.
- O modo toque vem de `(hover: none) and (pointer: coarse)` e é confirmado pelo ponteiro que inicia a partida.
- Pointer Events com captura; direcional analógico com zona morta (`stickVector`, 4 testes); FOGO que mira junto.
- Grade 2×2 no canto com tamanhos em `vmin`; pausa no `click`, para o mesmo toque não retomar o jogo.
- Tela cheia deitado onde o navegador deixa; pausa ao trocar de app; sem câmera tática no toque (ela mira pelo cursor).
- Tela de pausa com instruções de toque e que cabe na altura do celular deitado.
**Trava:** o `site.mjs --check` joga num celular emulado (844×390, toque) e reprova se o toque não começar a partida, se o direcional não andar, se FOGO não segurar com o outro polegar no direcional ou se a pausa falhar.
**Site:** "Dan" no lugar de "diretor"; sem "feito em público" (o dono não fará lives por enquanto).
**Custo de CPU:** nenhum por quadro; só eventos de ponteiro, sem alocação por movimento.
**Quem decidiu:** dono (pedido, textos); Claude (desenho dos controles).

## [2026-09-24] Landing do jogo, bastidores como case e capturas automáticas
**Pedido do dono:** melhorar a página e "virar um case de desenvolvimento do game". Escolhas dele: **jogo + bastidores** e **bastidores às claras**.
**O que foi feito:**
- `/cybermech/` vira landing para jogador (`scripts/landing.mjs`). `/cybermech/bastidores/` vira o case (`scripts/painel.mjs`).
- Os dados das páginas ficam num módulo só (`scripts/site/dados.mjs`) e o visual num tema comum (`scripts/site/tema.mjs`).
- Nada na página é digitado à mão: destaques da seção VITRINE do `GAME_DESIGN`, entregas e autoria das etiquetas dos PRs, evolução por `git grep` em cada merge, diário dos títulos do HISTORICO. O `--check` reprova a VITRINE vazia.
- **Capturas automáticas:** o deploy entra no jogo headless (SwiftShader), clica no título da pausa (não nos botões), anda, atira e fotografa as três câmeras. JPEG de ~60 KB cada. Viram capa, galeria e og:image. Falha não derruba o site (a landing sai sem imagens e o log avisa), para uma foto não segurar uma entrega.
**Por que capturar no deploy e não versionar imagens:** a imagem nunca fica velha e não pesa no repositório. O `--check` fica rápido (as capturas custam ~30 s, só no deploy).
**Gráfico:** dois gráficos de uma série (testes; linhas), nunca dois eixos. Degraus, porque o valor muda a cada entrega. Dica ao passar o mouse e tabela para quem não enxerga o gráfico.
**Público vs. interno:** os bastidores publicam títulos do HISTORICO (menos os de conta e acesso), divisão de trabalho e pendências do ESTADO, ROADMAP e números. Nunca secrets nem dados do servidor (DEPLOY.md).
**GAME_DESIGN:** a plataforma passa a "desktop primeiro; celular em construção", porque o dono pediu a versão para celular ao Gemini. O toque gera o mesmo `MechInput`.
**Quem decidiu:** dono (páginas, bastidores às claras); Claude (desenho, capturas, fontes de dados).

## [2026-09-24] Planejamento reorganizado, gestão no GitHub e o site como case
**Pedido do dono:** "reorganizar o planejamento; melhorar a página /cybermech/; implementar as melhores ferramentas de gestão e criação, para virar um case de desenvolvimento do game".
**Escolhas do dono (perguntadas):**
1. Páginas: **jogo + bastidores**. `/cybermech/` vira a landing do jogo; o case vai para `/cybermech/bastidores/`.
2. **Bastidores às claras:** o case mostra a equipe de IAs (Claude, Gemini, Codex) sob o Protocolo Serafim UM.
3. Gestão: **repositório como fonte única + GitHub automático**. Sem quadro paralelo (GitHub Projects, Notion, Trello), porque as IAs só enxergam o repositório e duas listas saem de sincronia.
**Fases:** nova **Fase 3: Vitrine e polimento** (som, celular, kill feed, site, foguetes, draw calls): é o que a equipe está fazendo de fato antes do multiplayer. O multiplayer vira a Fase 4, o lançamento a 5 e a monetização a 6. A ordem combate → inimigos → multiplayer continua.
**Gestão no GitHub:**
- Etiquetas `frente:*` (as 11 do ROADMAP) e `agente:*` postas sozinhas em cada PR (`actions/labeler`, por arquivos e por prefixo do branch). Os 17 PRs antigos foram etiquetados com as mesmas regras; os PRs #2 e #13 levam também `agente:gemini`, porque integraram trabalho dele.
- Modelo de PR com custo de CPU e "como testar no site".
- Notas de versão agrupadas por frente; uma versão `v0.<fase>.0` a cada fase fechada.
**De quebra (R17):** STATUS_REAL tinha o Blind Mode como AUSENTE (existe: `#hud.blind` + chiado) e duas linhas de áudio, uma REAL e outra AUSENTE.
**Quem decidiu:** dono (páginas, bastidores, gestão, reorganizar); Claude (desenho das fases e da automação).

## [2026-09-24] Página pública com acentos quebrados: causa e trava
**Sintoma (dono):** "a página está boa, mas com caracteres quebrados".
**Causa:** o `painel.mjs` gerava um fragmento (sem `<!doctype>`, `<meta charset>` nem `viewport`), herança de quando o painel era só local. O LiteSpeed manda `text/html` sem charset, então o navegador lia o UTF-8 como Windows-1252 e rodava em modo quirks. O teste local não pegava porque o servidor de teste mandava `charset=utf-8`.
**Correção:**
- O painel vira documento completo.
- O `.htaccess` ganha `AddDefaultCharset UTF-8`.
- O servidor de teste agora manda `text/html` sem charset, como o real.
- O `--check` reprova página fora de UTF-8 ou em modo quirks; o `--verify` do deploy reprova página sem doctype ou sem `<meta charset>` no início.
- O rodapé mostrava o codinome interno (`.decepticons/…`); o check agora reprova o codinome no painel público.
**Quem decidiu:** Claude (R17).
## [2026-09-24] Kill feed + Indicador de direção do dano (#ux)
**Decisão / Tarefa:** Criar o sistema de Kill Feed e o Indicador Direcional de Dano no HUD (`#ux`).
**Como funciona:**
- **KillFeed (`client/src/ui/KillFeed.ts`):**
  - Canto superior direito, exibe no máximo 4 linhas de abates (ex: `KESTREL ▸ VOCÊ` ou `JOGADOR DESTRUÍDO`).
  - Cada mensagem desaparece em 5 segundos.
  - Pool fixo de 4 elementos HTML reutilizados no construtor (atendendo à regra G4 de zero alocação DOM em execução/abate) e atualização dos nomes exclusivamente por `textContent`.
  - Destaque visual (classe `.highlight`) quando o jogador local está envolvido (como autor do abate ou vítima).
- **DamageIndicator (`client/src/ui/DamageIndicator.ts`):**
  - Arco vermelho animado via CSS (`@keyframes damageArcFade`) posicionado em volta do crosshair, sumindo em 1 s sem cálculos por frame no JS.
  - Função pura `calculateDamageAngle` que determina o ângulo exato (0 a 360°) da origem do tiro em relação ao `yaw` da câmera do jogador (frente = 0°, direita = 90°, trás = 180°, esquerda = 270°).
  - Testado unitariamente com 5 casos de teste cobrindo todas as orientações em `client/src/ui/DamageIndicator.test.ts`.
- **Fiação:** Conectado diretamente em `client/src/core/Game.ts` dentro de `this.combat.onMechHit` e `this.combat.onMechKilled`.
- **Verificação:** `npm run check` 100% verde (typecheck, 56 testes Vitest, painel, build e smoke).
**Quem implementou:** Gemini.

---

## [2026-09-24] Estande de calibração do mouse e nova escala de sensibilidade
**Pedido do dono:** "no jogo é muito rápido para fazer essa configuração fina".
**Decisão:** uma tela própria, com o jogo parado, que mede o giro de verdade.
- Faixa de bússola com o mouse preso nela, não no canvas: o jogo continua pausado.
- "Gravar 1 volta": o jogador faz o gesto que quer para 360° e o total de pontos do mouse vira a sensibilidade (`calibrateFromCounts`). Não precisa saber o DPI; gesto com menos de 300 pontos é recusado.
- DPI + cm/360 para quem traz a medida de outro jogo; ±1%/±10% para o ajuste fino.
- Entrada crua (`requestPointerLock({ unadjustedMovement: true })`) ligada por padrão: sem a aceleração do Windows, o mesmo gesto gira sempre o mesmo. Se o navegador recusar, cai para o modo normal.
**Escala nova:** 1,00x = 0,0008 rad por ponto (~25 cm por volta a 800 DPI, faixa comum em jogos de tiro); antes era 0,0022 (~9 cm, o "rápido demais"). Quem tinha salvo 1,00x fica ~2,75x mais lento. Aceito: a tela só foi ao ar hoje.
**Custo de CPU:** zero no jogo (a tela só existe com o jogo pausado); uma multiplicação a mais por evento de mouse.
**De quebra:** Esc durante o remapeamento de tecla cancela (nota da revisão cruzada do PR #13).
**Quem decidiu:** dono (pedido); Claude (desenho e escala).

## [2026-09-24] Tela de configurações do Gemini integrada; do PR ao site sem esperar (regra 13)
**Integração:** o Gemini terminou a tela (`ui/SettingsMenu.ts`) e empurrou o branch, mas não abriu PR, então nada chegava ao site. O branch dele saiu da `main` antes da rodada (PR #12), e `Game.ts`, `styles.css` e `ESTADO_ATUAL` conflitaram. O Claude juntou num branch de integração a partir da `main`, preservando o commit e a autoria do Gemini. Nos conflitos ficaram os dois lados; no ESTADO saíram as pendências que já estavam feitas.
**Revisão cruzada (Claude):** aprovada.
- Usa só o contrato, troca teclas em uso, recusa teclas do sistema, sliders seguem os `LIMITS`.
- A janela fica fora da tela de pausa, então clicar nos controles não retoma o jogo (conferido no `index.html`).
- Nota menor: durante o remapeamento, Esc pisca como erro em vez de cancelar.
**Processo (dono: "que as melhorias vão direto para o deploy, para testar em produção"):** regra 13 no `AGENTS.md`. Ao terminar, o agente abre o PR, espera o CI e faz o merge; o merge publica o site sozinho. A revisão cruzada vem depois.
**De quebra (R17):** a regra 12 estava partida ao meio no `AGENTS.md` (um `\n` do caminho do worktree tinha virado quebra de linha); corrigida.
**Quem decidiu:** dono (fluxo); Claude (integração, revisão).

## [2026-09-24] Tela de Configurações (#ux) sobre o contrato core/Settings.ts
**Decisão / Tarefa:** Criar a interface visual da tela de configurações integrada ao `core/Settings.ts`.
**Como funciona:**
- Criado o componente `SettingsMenu` em `client/src/ui/SettingsMenu.ts`.
- Adicionado o botão `[ CONFIGURAÇÕES ]` no overlay de pausa (`#overlay`) e a estrutura do modal `#settings-modal` no `client/index.html`.
- Estilizado no tema terminal/cyberpunk HUD em `client/src/styles.css`.
- **Funcionalidades da UI:**
  - Sliders para Sensibilidade e FOV offset.
  - Checkboxes para Inverter eixo Y e Painel de desempenho.
  - Selects para Qualidade gráfica e Dificuldade dos bots.
  - Remapeamento interativo de 7 teclas com suporte a swap automático entre ações e rejeição de `RESERVED_KEYS` (`Escape`, `F1`, `Backquote`, `Quote`).
  - Botão `[ RESTAURAR PADRÃO ]` que invoca `settings.reset()`.
- **Fiação:** Instanciado `new SettingsMenu(this.settings)` em `client/src/core/Game.ts`.
- **Validação:** `npm run check` 100% verde (typecheck, 45 testes do Vitest, painel, build e smoke).
**Quem implementou:** Gemini.

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
