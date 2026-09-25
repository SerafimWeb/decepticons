# HISTÓRICO DE DECISÕES — CYBERMECH

> Cofre append-only (M2). Nunca edite entradas antigas. Entrada nova SEMPRE no topo.

## [2026-09-25] M1 do multiplayer: a partida sem tela
**Pedido do dono:** "quero aplicar o multiplayer; dá para criar o servidor no meu PC?"
**Decisão (Claude):**
- **`sim/Match.ts`** tem a partida inteira (arena, barricadas, Mechs, bots, projéteis, foguetes, dano, renascimento, rodadas) no tick fixo, sem WebGL nem DOM. As regras que estavam espalhadas no `Game.ts` (acerto → alerta do bot, abate → placar, explosão → dano em área, dash → demolição) foram para a partida; o `Game` só ouve eventos para tela, som e vibração. O servidor vai instanciar a mesma classe.
- **Pragmático:** a simulação continua usando o Three.js para matemática e grafo de cena (roda no Node sem WebGL, como os testes sempre rodaram). Tirar o Three.js do servidor só se a memória pedir.
- **Servidor sem destroços** (`debris: false`): não vão pela rede e custam CPU.
- **Achado:** destroços no mesmo mundo físico mudam a ordem interna do Rapier e a partida diverge depois do primeiro estilhaço (e com `Math.random`, entre execuções). O servidor, sem destroços, é determinístico (testado); o cliente corrige pela reconciliação (M4); plano B registrado: mundo físico só para os destroços.
- **Medido:** 0,74 ms por tick em média com a sala cheia (meta de 2 ms, G14).
**Custo de CPU:** nenhum a mais no cliente (a mesma ordem de tick de antes).
**Quem decidiu:** Claude.

## [2026-09-25] Correção: Mechs brancos depois da junção de malhas
**Achado (Claude, jogando o build para testar as setas):** o Vector-09 e os andróides apareciam brancos e brilhando. Na junção das malhas por articulação (PR #43, Codex), o uniforme do flash de dano começava com `new THREE.Color()`, que no Three.js é **branco**; o flash só é reescrito quando o Mech toma dano, então o casco inteiro brilhava branco até o primeiro tiro.
**Decisão:** a cor nasce preta (`new THREE.Color(0, 0, 0)`). Uma linha, no território do Codex (regra 4: correção pequena e segura; ele fica sabendo pela revisão cruzada).
**Lição para a revisão:** mudança visual de render pede captura de tela no PR (o check headless só confere que sobe, não a cor).

## [2026-09-25] Pendências do Gemini concluídas pelo Claude; tela do Hangar para o Codex
**Contexto:** o Gemini ficou sem crédito no dia com três entregas fora da `main`: setas de inimigos (PR #40, com conflito e a revisão pedindo ajustes), sons dos andróides (branch sem PR) e dicas da primeira partida (um commit depois do PR #32). O dono pediu: "veja se ele está indo bem e conclua as demandas que ele deixou abertas".
**Decisão (Claude):**
- **Portadas num branch do Claude** (regra 2: nunca dois agentes no mesmo branch), com os ajustes da revisão: setas sem alocação por quadro, DOM escrito só quando muda, escondidas com o jogador morto e só até 120 m; sons dos andróides com volume pela distância (antes tocavam alto do outro lado do mapa); dica de calor no primeiro "QUENTE" (e não no primeiro tiro), dica de foguetes no primeiro foguete, dica do arco vermelho mantida para tiro de Mech e a dos andróides para tiro de andróide; a contagem de dicas vistas segue a lista (era fixa em 4). O PR #40 foi fechado apontando para o novo.
- **Tela do Hangar passa para o Codex** hoje (o Gemini está sem crédito e a tela tem prévia 3D do Mech, que é território de render). Registrado na divisão de trabalho.
**Quem decidiu:** dono (concluir as pendências); Claude (como portar e a fila do Codex).

## [2026-09-25] Personalidades dos bots, vaga de ataque e inimigos configuráveis
**Pedido do dono:** "está muito difícil, eles são muitos e me juntam. Os bots estão com IA? Dá para integrar Groq, Gemini, DeepSeek por API? Eles pensam igual? Um mais brabo, outro mais manso, outro fujão que ataca na covardia. Quero poder configurar mais."
**Decisão (Claude):**
- **Sem modelo de linguagem no combate:** cada chamada leva 0,2–2 s e o bot decide 60 vezes por segundo; custaria por chamada e por jogador; não é reproduzível (quebra G1/G2, o servidor e os testes); e a chave de API ficaria exposta no navegador. A IA de jogo (estados, percepção, parâmetros) é o que os estúdios usam. Um modelo de linguagem faz sentido **entre rodadas**, no servidor: o "rádio" das IAs rebeldes provocando o jogador (ideia no ROADMAP).
- **Personalidades** (`PERSONAS` em `combat/BotController.ts`), por cima do tipo de robô e da dificuldade: **brabo** (chega a 55% da distância, quase não recua, só para de atirar superaquecido, rajadas 1,5×), **manso** (1,45× mais longe, recua com 55% do torso, esfria em 70%, atira 0,6×), **fujão** (espreita pelas costas; ataca quando o alvo está de costas, avariado ou superaquecido; visto de frente, foge com dash), **soldado** (o de antes).
- **Diretor de ataque** (`BotSystem`): vagas de ataque por alvo (Mech conta 1, andróide ½; padrão 2). Quem não tem vaga espera 1,4× mais longe, sem atirar. A vaga vai primeiro para quem já está no turno, depois pela personalidade (brabo antes), depois o mais perto; o turno dura 7 s e passa. Roda 5 vezes por segundo, sem alocar. É a técnica dos jogos de tiro para dar pressão constante sem todo mundo de uma vez.
- **Configurável** (`GameSettings`): Mechs (0–3), andróides (0–3) e técnico valem ao reiniciar; a personalidade de cada Mech e quantos atacam juntos valem na hora. **Padrão novo:** 3 Mechs (KESTREL brabo, MAKO soldado, VIPER fujão), 2 andróides (eram 3), técnico, 2 atacando juntos. O placar mostra a personalidade (KESTREL·BRABO).
- **De quebra (R17):** os testes com física passavam dos 5 s padrão do Vitest com a máquina ocupada e falhavam por tempo; o limite subiu para 30 s.
**Custo de CPU:** diretor a 5 Hz com ≤ 7 bots (um laço e uma inserção ordenada); a emboscada são duas contas de ângulo por tick. Nada alocado.
**Quem decidiu:** dono (personalidades, menos pressão, configurar); Claude (parâmetros, diretor, por que não usar modelo de linguagem no combate).

## [2026-09-25] Explosões com tamanho por partícula e teto fixo
**Motivo:** partículas do mesmo tamanho davam pouca leitura de profundidade em impactos e explosões, apesar do pool fixo.
**Decisão (Remoratrader/Codex):** manter um único `THREE.Points`, acrescentando `particleScale` e expansão ao longo da vida em typed arrays pré-alocados. Fogo, fumaça, poeira e faíscas usam tamanhos e curvas próprias; o sprite e o shader seguem o mesmo draw call.
- `MAX_PARTICLES = 3000` é o teto global; o construtor pode reduzi-lo, nunca aumentá-lo. Bursts são limitados ao tamanho do pool e substituem partículas mais antigas.
- O `update()` escreve apenas nos buffers existentes; não cria vetores, arrays, materiais ou geometria por quadro.
**Custo de CPU:** percorre no máximo 3000 slots por frame e atualiza posição, cor e tamanho no mesmo `THREE.Points`.
**Quem decidiu:** Remoratrader/Codex (acabamento dentro do território visual).

## [2026-09-25] Rig do Vector-09 reduzido para 9 draw calls
**Motivo:** o painel de desempenho mostrava cerca de 34 chamadas por Vector-09, acima do orçamento para a arena e as salas multiplayer.
**Decisão (Remoratrader/Codex):** fundir as malhas estáticas por pivô articulado ao construir o rig. Cada grupo articulado passa a desenhar uma geometria com cor, metal, rugosidade e emissão por vértice; emissão dinâmica do propulsor, flash de dano e visibilidade por parte seguem ativos.
- O Vector-09 cai de ~34 para 9 draw calls; cada grupo de articulação continua sendo ocultado independentemente quando sua parte é destruída.
- A combinação ocorre uma vez na construção do modelo. O loop de render não cria objetos nem buffers adicionais.
- No build atual, o painel marcou 99 draw calls para a cena inteira parada (inclui ambiente, partículas e demais Mechs); por isso o orçamento por rig foi conferido na estrutura de pivôs, não inferido do total da cena.
**Custo de CPU:** trabalho de geometria apenas na criação do rig; 9 submissões de desenho por Vector-09 em cada frame.
**Quem decidiu:** Remoratrader/Codex (otimização dentro do território de render).

## [2026-09-25] Plano do multiplayer
**Pedido do dono:** "já podemos começar a planejar o multiplayer? Ou ainda há tarefas anteriores?"
**Decisão (Claude):** plano em `MULTIPLAYER.md`.
- **Pré-requisitos:** separar simulação e render (`shared/`); draw calls por Mech ≤ 10 (Codex); FPS medido numa GPU integrada (dono); contratos de rede mergeados antes da rede (regra 5). A montagem já é validável no servidor (Hangar).
- **Arquitetura:** Colyseus, uma sala por partida, a mesma simulação a 60 Hz no servidor; estado a 20 Hz com delta; prediction e reconciliação do Mech local; remotos interpolam ~100 ms atrás sem character controller; tiros com compensação de latência até 150 ms; reconexão de 15 s.
- **Banda estimada:** ~18 B por Mech por snapshot → ~4 KB/s de download por jogador (meta de 8) e ~0,6 KB/s de upload (meta de 2). Medir na etapa M7.
- **Etapas M0–M8**, um PR cada; Gemini faz as telas do online contra os contratos, Codex o render.
**Custo:** nenhum agora (só documento).
**Quem decidiu:** Claude (arquitetura, etapas); o dono decide hospedagem, mira assistida no PvP, bots nas salas e o formato do código da sala.

## [2026-09-25] Contrato do Hangar: montagem, carga e link de build
**Pedido do dono:** seguir com o Hangar ("pode prosseguir").
**Decisão (Claude):**
- **Contrato antes da tela** (regra 5 do AGENTS): `LoadoutSpec` (só ids e níveis) e `validateLoadout` (regra pura, sem 3D) em `hangar/loadout.ts`. Nada vindo de armazenamento, link ou rede é confiado; os números saem sempre do catálogo.
- **Carga de armas de 11 t no Vector-09:** cabem 6 das 9 combinações; os dois braços no máximo, nunca. A carga que sobra vira blindagem numa próxima etapa (versão 2 do formato).
- **Os números dos chassis saíram dos arquivos de modelo** para `entities/chassis.ts`, sem Three.js: é o primeiro passo da separação simulação × render que o multiplayer pede, e o site ficou mais leve (não carrega mais o Three.js no build).
- **O Mech troca de armas no renascimento** (`MechBase.equip`, `PlayerController.rearm`), inteiro e frio; o jogo lê a montagem salva ao abrir.
- **Link de build** (`/jogar/?build=v1.vector09.plasma-2.rockets-0`): compartilhar montagem é viral e deixa o dono testar os níveis antes da tela existir. A landing ganhou a grade das 9 combinações, cada uma com link.
- **Progressão ainda não existe:** todos os níveis estão liberados para todo mundo, igual (sem pay-to-win). O contrato já aceita o filtro de nível bloqueado.
- **Achado:** com os dois braços, todas as montagens derrubam em 3,3–3,5 s (o calor do Mech limita). O nível pesa nas rajadas de uma arma só.
**Custo de CPU:** zero por tick; a validação roda ao abrir o jogo e ao aplicar.
**Quem decidiu:** Claude (formato, carga, onde aplicar); o dono decide a progressão e o segundo chassi.

## [2026-09-25] Gestão do projeto nos bastidores
**Pedido do dono:** "caprichar mais nos bastidores: introduzir as ferramentas de gerenciamento de projetos, gestão de entregas, planejamento, e mais elementos gráficos no roadmap (criativo e objetivo, gráficos que impactem e digam muito sobre o projeto)"; e antes: "tornar cada vez mais profissional, técnico e expert a forma como expomos nosso trabalho".
**Decisão (Claude):**
- **Quadro Agora / Próximo / Depois** (fase atual, próxima, demais) com um código por item (frente + posição na frente: CB-07, UX-12), a frente e o agente quando o item diz quem faz.
- **Burn-up** do escopo contra os feitos, com o histórico do ROADMAP lido do git (uma leitura por commit, um processo git só). Mostra também quanto o escopo cresceu.
- **Linha do tempo das fases** com as datas reais de início e fim; só a fase atual tem estimativa, pelo ritmo das últimas 72 h, marcada como estimativa. Fases futuras não têm data: os itens delas são grandes demais para prever pelo ritmo.
- **Matriz frentes × fases:** onde o esforço foi e o que vem.
- **Métricas DORA** (as quatro de entrega contínua da indústria): frequência de deploy, lead time do primeiro commit ao ar, taxa de falha de mudança e tempo de recuperação, lidas das execuções do CI na `main` e do git. O lead time sai do git (os commits de cada PR), porque a API do GitHub recusa a lista de commits de todos os PRs (limite de nós).
- **Achado:** `entregas()` caía em silêncio para o git quando a resposta do GitHub passava de 1 MB (limite padrão do Node); agora com buffer de 64 MB.
**Custo:** só no build do site (~1 s a mais). Nada no jogo.
**Quem decidiu:** dono (pedido); Claude (quais ferramentas e métricas).

## [2026-09-25] Calor completo do Mech e a Oficina (bancada de testes)
**Pedido do dono:** "investir no sistema de balanceamento, como uma oficina mecânica de alto padrão, para estudar e avaliar o desempenho dos robôs, armas e defesas: um jogo de estratégia realista e objetivo. Criticidade do calor: dano, correr sem parar, usar armas, pular, dash, tudo pode aumentar o calor, então eventualmente os mechs precisam PARAR pra resfriar; cada arma com seu coeficiente de calor".
**Decisão (Claude):**
- **Tudo esquenta o mesmo dissipador:** tiro (coeficiente de cada arma), corrida (15%/s na velocidade máxima, proporcional), pulo 5%, dash 12%, dano recebido 0,2% por ponto (sem segurar o resfriamento). Chassi esfria 60%/s; **parado, em dobro**.
- **Criticidade:** QUENTE a partir de 70% (aviso). Superaquecido em 100%: armas travadas, sem pulo nem dash, metade da velocidade; o resfriamento de emergência vai na metade, parado ou não, e andando a corrida ainda soma (~2,4 s parado, ~3 s andando para voltar a 35%).
- **Por que a corrida é 15%/s e não mais:** a 30%/s, quem atira andando (o normal num jogo de tiro) fervia em 1,3 s e passava 80% do tempo travado. A 15%/s ferve em 1,8 s segurando o gatilho, e em rajadas curtas parando na pausa nunca ferve.
- **Por que parado não esfria em dobro quando já superaqueceu:** senão o piloto "torre" (parado segurando o gatilho) voltava rápido demais e derrubava um Mech mais depressa que as metas de equilíbrio (combos abaixo de 2,5 s).
- **IA:** fervendo (≥ 90%) ou superaquecido, o bot para no lugar e esfria (estado `cool`), sem atirar; volta a 45%. Janela para o jogador punir.
- **Oficina** (`/cybermech/oficina/`, `scripts/oficina.mjs`): bancada gerada pela simulação do jogo (`combat/balance.ts → drill`: corrida, rajadas, pausas, dash, pulo). Mostra o calor de cada ação, seis exercícios de 20 s (dinamômetro), o placar de dano, o tempo para destruir cada parte, o dano pela distância e os chassis. Um teste confere que a bancada bate com o Mech de verdade (física, correndo e atirando).
- **Achado da bancada:** rajadas de 6 parando na pausa causam ~64% mais dano que correr com o gatilho apertado, e nunca fervem. Administrar o calor é a estratégia.
- **Gráficos** (`scripts/site/graficos.mjs`): uma série por gráfico (três cores em linhas não passaram no teste de daltonismo; viraram gráficos lado a lado na mesma escala), barras em HTML para o texto ficar legível no celular.
**Custo de CPU:** no jogo, uma multiplicação e uma soma por tick para a corrida; pulo, dash e dano são somas por evento. Nada alocado. A oficina roda só no build do site (~1 s).
**Quem decidiu:** dono (tudo esquenta, parar para esfriar, oficina); Claude (coeficientes, criticidade, bancada, gráficos).

## [2026-09-25] Arsenal em três níveis, dano calibrado, calor do Mech e o projeto do Hangar
**Pedido do dono:** "calibrar melhor o poder das armas pra ficarem mais realistas; padronizar com 3 níveis de poder em cada arma (pra quando tivermos upgrades); cálculos de dano realistas, sem apelação. O jogo tem que ser jogável e equilibrado: a diferença vem da técnica, das habilidades e da customização. Quero começar a projetar o HANGAR, e isso vai na página do jogo, onde está o roadmap".
**Decisão (Claude):**
- **Arma é dado** (`combat/weapons.ts`): dano, cadência, calor por tiro, carregador, velocidade, alcance ótimo e máximo, queda com a distância, raio de explosão e massa. O Mech carrega um `loadout` (braço direito: energia; esquerdo: munição), que é o encaixe do Hangar. Tabela montada uma vez: pedir uma arma no tick não aloca (G4).
- **Três níveis, uma regra só:** MK II = ×1,2 de dano, ×1,15 de calor, ×1,5 de massa; MK III = ×1,4, ×1,3, ×2. **Poder custa carga:** o dano por tonelada cai a cada nível, então subir de nível é escolha, não vantagem pura.
- **Metas de tempo para derrubar** (torso do Vector-09, todos os tiros no alvo; `combat/balance.ts` roda as regras do tick fixo), travadas por teste: plasma MK I entre 5 e 7,5 s (hoje 6,2 s; antes era ~2 s: apelação); nenhuma arma sozinha abaixo de 4,5 s; nenhum combo dos dois braços abaixo de 2,5 s; MK III 10–40% mais rápido que o MK I; mirar na perna rende.
- **Calor do Mech, não da arma:** com calor separado, plasma MK III + foguetes MK III derrubavam em 0,9 s. Com um dissipador só para o chassi (o que é também o mais realista), o combo trava o Mech antes e fica em ~3 s.
- **Números:** plasma 25 → 16 de dano, 0,18 → 0,22 s; dano cheio até 60 m, 40% a 200 m. Foguete 75 → 40 no centro, 15% de calor por disparo. Andróide com vida em escala (torso 50 → 32: continua caindo com 2 tiros de plasma). Técnico conserta 8/s (era 18), para não anular o novo dano.
- **Cadência exata (R17):** o tiro esperava ticks inteiros (0,18 s virava 0,2 s); agora a sobra do tick passa para o próximo tiro (`combat/trigger.ts`), sem acumular crédito com o gatilho solto.
- **Hangar em projeto:** especificação em `HANGAR.md` (contrato, chassis, carga, módulos, progressão, tela, rede, etapas); resumo público na seção HANGAR do `GAME_DESIGN`. Próximo passo é o contrato (`LoadoutSpec` + `validateLoadout`), antes da tela (regra 5 do AGENTS).
- **Página do jogo:** nova seção "Hangar" com a planta do Vector-09, o arsenal nos três níveis e as regras de equilíbrio. Os números saem do TypeScript do jogo, carregado pelo Vite no build do site (`dados.mjs → jogo()`), sem cópia nem regex; a ficha técnica passou a vir do mesmo lugar.
**Custo de CPU:** nenhum a mais por tick (a arma é um objeto congelado; a queda por distância é uma conta por impacto). O site leva ~2 s a mais no build para carregar os módulos do jogo.
**Quem decidiu:** dono (três níveis, equilíbrio, Hangar); Claude (regra dos níveis, metas, calor do Mech, números).

## [2026-09-25] Marca SERAFIM WEB: vinheta de abertura e assinatura discreta
**Pedido do dono:** "qualidade que deixe o jogo mais profissional, ar de grande estúdio; adicione sutilmente nossa marca SERAFIM WEB. No início, a nossa marca como antigamente nos games (SEGA, Konami, PlayStation), com som característico e a logo por 1 a 2 segundos; na página /cybermech/ também, como o efeito matrix de pontos verdes do site do serafim13".
**Decisão (Claude):**
- **Vinheta no jogo** (`brand/BrandSplash.ts` e `brand/sting.ts`): ~1,9 s, uma vez por carregamento, no primeiro "clique para jogar". O navegador não deixa tocar som antes de um gesto do jogador, por isso ela não abre sozinha ao carregar. Clique ou tecla pula (só depois de 0,35 s, para o clique de entrada não pular). A partida começa quando ela acaba, com o mouse já preso.
- **Som sintetizado** na Web Audio (sopro, impacto grave, acorde em cascata com eco, colchão), sem arquivo, pelo volume mestre das configurações.
- **Abertura da landing:** chuva de pontos verdes (o verde do jogo) num canvas 2D, com o emblema e o letreiro. Uma vez por sessão (`sessionStorage`), pula com qualquer gesto, não roda com "reduzir movimento" e sai do DOM no fim. As imagens só baixam quando ela roda. O check do site confere que ela roda e sai da frente do botão.
- **Assinatura discreta:** "um jogo SERAFIM WEB" na pausa, versão do build com © no canto (do `git describe`, via `VITE_BUILD`), "SERAFIM WEB apresenta" na landing, © nos rodapés, `<meta name="author">`. Nada no HUD de combate.
- **Arquivos:** emblema de `serafim13/vetorserafim.png` (240 px) e letreiro (fundo transparente, tirado por código), em WebP, ~56 KB juntos, em `client/public/brand/`.
**Custo de CPU:** zero durante a partida: a vinheta é animação CSS antes do jogo começar, e o som são ~12 nós do Web Audio que se desligam sozinhos. A chuva da landing é um canvas de ~2 s (~100–150 pontos por quadro) e depois some.
**Quem decidiu:** dono (marca, vinheta, efeito); Claude (duração, som, quando toca).

## [2026-09-25] Andróides mais chatos que perigosos; o técnico; funções da escala 1
**Pedido do dono:** "os andróides têm que ser mais fracos e tirar menos vida; mais massantes do que perigosos, rápidos mas fracos. Alguns são pra reparar os outros bots, coletar peças, entregar munição, fazer manutenção nos robôs maiores, e podem pilotar mechs (os humanoides vão poder fazer as mesmas ações que humanos, como pilotar as máquinas do hangar)". E: "manter o jogo leve para escalar com muitos jogadores; código limpo, arquitetura profissional".
**Decisão (Claude):**
- **Combate mais fraco:** torso 70 → 50 (2 tiros de plasma), dano por tiro 9 → 4, cadência 0,3 → 0,4 s, mira 2,2× mais solta (`BotProfile.aimErrorScale`). Continuam rápidos e desviando.
- **Técnico** (`combat/TechnicianController.ts`, visor amarelo, T-01):
  - Vai até o Mech rebelde mais avariado (reavalia a cada 0,5 s) e conserta 18 de vida/s na parte mais avariada que ainda existe (`combat/repair.ts`, regra pura). Parte arrancada não volta: isso fica para o coletor.
  - Foge com dash quando o jogador chega a 16 m; volta a trabalhar a 24 m. Não atira. É o alvo prioritário, e isso cria decisão tática.
- **Arquitetura:** os dois cérebros têm a mesma interface (think → MechInput, alert, reset). A direção comum (ângulos, giro, movimento no referencial do torso) saiu do BotController para `combat/steer.ts`, sem mudar comportamento (os testes dos bots passam iguais). O conserto é aplicado pelo BotSystem no tick fixo. O feixe é uma linha de 2 pontos por técnico, atualizada no render sem alocar.
- **Funções futuras** (GAME_DESIGN e ROADMAP): coletor (peças dos destroços reconstroem partes), logística (munição e foguetes) e piloto (andróide embarca em máquina vazia do hangar; matar o piloto desliga o Mech).
**Custo de CPU:** técnico = 1 character controller + um laço por ≤3 aliados e pelos alvos por tick, sem raycast. Arena com 8 unidades (7 bots + jogador), o tamanho de sala do G11.
**Quem decidiu:** dono (papéis, força); Claude (números, IA, arquitetura).

## [2026-09-25] Cidade estilo Tron
**Pedido do dono:** "os prédios podem ser coloridos: volte aquele ciano, o pink inicial, vermelho aceso, amarelo fluorescente; cores bem coloridas, estilo Tron, sci-fi moderno, espacial".
**Decisão (Claude):**
- **Cidade:** ciano, pink e amarelo fluorescente nos prédios; barricadas cada uma de uma cor neon; plataforma e borda em pink; grade do chão em ciano.
- **Horizonte:** faixas neon e luzes de topo em cores sorteadas (semente fixa: sempre a mesma cidade) e um céu de 900 estrelas.
- **Leitura de combate:** verde continua sendo do jogador e vermelho das IAs rebeldes, o que é do combate não some no meio das cores.
**Custo:** +2 draw calls no horizonte (faixas instanciadas e estrelas), tudo estático; nada por quadro. As cores por instância saem do mesmo sorteio com semente.
**Quem decidiu:** dono (direção); Claude (distribuição das cores).

## [2026-09-25] Tema "IAs rebeldes" e escala 1: andróides
**Pedido do dono:** "o tema é que temos que defender contra IAs rebeldes; pensar na escala dos robôs. Esse que você começou pode ser a escala 2; criar os proporcionais aos robôs autônomos de hoje (humanoides, quadrúpedes) como NPCs com IA. São pequenos, mas mais ágeis que os grandes. Esses seriam o perfil 1 de tamanho."
**Decisão (Claude):**
- **Escalas:** 1 = robôs autônomos (~2 m); 2 = Mechs (~5 m, o Vector-09); 3 = máquinas de cerco, no futuro. Registrado no GAME_DESIGN ("TEMA E ESCALAS").
- **Primeiro da escala 1: andróide rebelde** (`entities/Android.ts`), um humanoide gerado por código, sem copiar nenhuma marca real.
  - Frágil: 70 de torso, cai com 3 tiros de plasma.
  - Tiro fraco: 9 contra 25 do Mech.
  - Ágil: arrancada de 120 m/s² contra 70 do Mech, pulo duplo, dash a cada 1,4 s.
- **IA:** a mesma do Mech (BotController), com um **perfil de luta** por tipo (`BotProfile`). O Mech ataca a 38 m e anda de lado devagar. O andróide chega a 22 m, troca de lado a cada 0,35–0,9 s e desvia com dash em 35% das trocas. O sorteio do desvio só acontece para quem tem a chance, e os Mechs continuam com a mesma sequência de antes (determinismo e testes preservados).
- **Dano por arma:** `MechStats.weaponDamage`. Cada tiro leva o dano de quem atirou, e a ficha da landing lê daí.
- **Arena:** 3 Mechs + 3 andróides + o jogador. Teto: 7 character controllers.
**Custo de CPU:** +3 character controllers e +3 cérebros de IA por tick; ~16 draw calls por andróide (o Mech tem ~34). Dentro da meta de 8 por sala (G11).
**Próximo:** quadrúpede (cão-robô) na escala 1; afinar a animação de passo do andróide, que hoje herda a do Mech.
**Quem decidiu:** dono (tema, escalas, pedido); Claude (números e IA, a calibrar no playtest).

## [2026-09-25] CYBERMECH; paleta neon multicolorida
**Pedido do dono:** "mude o nome para CYBERMECH apenas, sem protocol" e "quero verde neon, vermelho, pode usar diversas cores, só não fica apenas em azul e roxo".
**Nome:** CYBERMECH no jogo (título e pausa), no site (landing, bastidores, prévia do link), nos documentos e no `package.json`. O caminho `/cybermech/` já servia. O codinome interno continua o do repositório. "Protocolo Serafim UM" não muda: é o protocolo de engenharia, não o jogo.
**Paleta (Claude):** o âmbar de ontem ficou monocromático. Agora é neon tático:
- **Verde neon** para o que é do jogador: HUD, mira, tiro, visor e título.
- **Vermelho** para as IAs rebeldes: Mechs vermelhos, visor e tiros.
- **Laranja e amarelo** para fogo, foguetes e perigo. O jogador tem pintura amarela de perigo.
- Prédios em verde, amarelo e branco, e grade verde no chão.
- Tudo continua saindo do `core/palette.ts` e dos tokens do `styles.css`: a troca foi de valores, não de código.
- O site do projeto fica no âmbar de terminal, que o dono já aprovou.
**Quem decidiu:** dono (nome, direção das cores); Claude (tons).

## [2026-09-24] Primeira partida guiada
**Decisão (Gemini):** Implementado `Onboarding.ts` que apresenta dicas contextuais sem cobrir a mira.
- Textos se adaptam para PC e Toque (ex: 'USE WASD...' x 'USE O POLEGAR ESQUERDO...').
- Gatilhos dinâmicos via `Game.ts` respondendo a movimento, inimigo na mira, dano recebido e disparos de arma.
- O componente usa `localStorage` para aparecer apenas na primeira vez.
- Estilo minimalista fixado acima dos comandos básicos e com `opacity` transitório.

## [2026-09-24] Calibragem do Vector-09: menos velocidade e calor na arma
**Pedido do dono:** "esse primeiro robô está muito rápido, e a sequência de tiro dele precisa dar um respiro; não dá pra ficar direto assim, pra não apelar tanto".
**Decisão (Claude):**
- **Movimento:** 16 → 12 m/s, aceleração no chão 95 → 70, no ar 28 → 22, dash 50 → 42 m/s, recarga do dash 2,5 → 3 s.
- **Tiro:** cadência 0,14 → 0,18 s (7 → 5,5 tiros/s), com **calor**, o clássico dos jogos de Mech (`combat/heat.ts`, regra do Mech, vale para bots).
  - Cada tiro soma 8,5%; ~12 seguidos superaquecem e a arma trava até voltar a 35%.
  - Só esfria 0,25 s depois do último tiro, a 60%/s; superaquecida, a metade.
  - Resultado (testado): segurar o gatilho rende ~2 tiros/s; rajadas de 5 com 1 s de pausa, ~2,6 tiros/s, sem travar. Antes do castigo de resfriamento, os dois davam quase o mesmo, e superaquecer não pesava.
- **HUD:** barra CALOR, vermelha perto do limite, piscando "SUPERAQUECIDO"; no toque o FOGO vira "QUENTE".
**Bug achado no caminho (R17):** o teste do bot que vê o jogador falhou com a velocidade nova. A causa era real: numa amostra, o raio de linha de visão passou direto por uma cápsula parada (erro numérico do Rapier), e isso zerava o tempo de reação do bot. Agora o bot só esquece o alvo depois de 2 falhas seguidas (0,2 s). O teste da rampa passou a medir o tempo pela velocidade do Mech.
**Custo de CPU:** desprezível (três somas por tick por Mech).
**Quem decidiu:** dono (pedido); Claude (números, a calibrar no playtest).
## [2026-09-24] Volume nas configurações
**Decisão (Gemini):** Adicionado campo de volume (0 a 1) nas configurações, acessível pelo menu e sincronizado com o ganho mestre do `AudioSystem` na inicialização e atualização das configurações.

## [2026-09-24] Som sintetizado para foguetes
**Decisão (Gemini):** Lançamento de foguetes agora toca um som sintetizado de curto decay (`AudioSystem.playRocketLaunch`) acionado a partir de `player.onRocket`, seguindo o conceito sem dependência de áudio externo. O impacto da explosão já usa o som de explosão genérico conforme o volume vs distância.

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
