# ARQUIVO — HISTORICO_DE_DECISOES (quinzena 2026-10-b)

> Texto movido sem alteração de `HISTORICO_DE_DECISOES.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

## [2026-10-16] O site ganha um sistema de design e fotos cinematográficas dos Mechs reais (Claude, P172)

**Ordem:** deixar a landing e as páginas "bem parecidas com as referências", com acabamento de portal de jogo, mais único.

**Decisões:**
1. **Um sistema de design permanente** (`DESIGN_SYSTEM_SITE.md` + `scripts/site/hud.mjs`), fonte única de paleta, fonte, botão e componente; página nova importa, não redefine. O documento vive em `.decepticons/` (e não em `docs/`, como pedia a orientação) porque é onde o projeto guarda a verdade (AGENTS.md).
2. **Imagem de Mech é do modelo real**, em foto de cena (`cena-cinematica.mjs`), e não recorte da arte conceitual: a orientação proíbe robô que não seja do universo do jogo, e o jogo já tem o Colossus-V4, o Marauder e o Vector-09. A arte conceitual do Comandante fica de referência (e nas ilustrações do esquadrão).
3. **O herói é foto, não 3D ao vivo:** o custo de CPU/GPU e de carga numa landing seria alto para o ganho; a foto sai do mesmo modelo e é regenerável em segundos.
4. **Mono fora, texto mínimo de 12 px:** a primeira versão usava mono pequeno por todo lado; a orientação (e o olho) pediram o contrário.
5. **Nada de recurso que o jogo não tem:** "Pilotos com personalidade" e "Rodadas de 5 minutos" das referências não entraram como estavam; os cartões saem da VITRINE do GAME_DESIGN.
6. **A comparação de tamanhos é a do Comandante** (durante a sessão): Andróide (1), Vector-09 (2) e Colossus-01 (3) lado a lado e o Colossus-V4 (4) por trás, escuro e na névoa, para mostrar as proporções sem roubar a cena; no lugar do Marauder, que ficou só no Hangar.
7. **Nunca dois CTAs de jogar juntos:** o do cabeçalho aparece depois do herói.

## [2026-10-16] Checkpoint das explosões e as lições do War Robots (Claude, P170 e P171)

**Decisões:**
1. **Checkpoint = tag + captura + bancada + regra** (`CHECKPOINTS.md`): o ponto que o Comandante aprova fica recuperável (`git checkout checkpoint/<nome> -- arquivo`) e tem um jeito barato de comparar (a bancada refaz as capturas em software). A regra é "não regredir", não "não mexer": melhorar vale.
2. **A reportagem vira metas, não promessa** (`LICOES_WAR_ROBOTS.md`): é comunicado da dona, em valor bruto e acumulado. O que se aproveita é o **mecanismo** (cadência de conteúdo, eventos, celular, retenção); o **pay-to-win** do War Robots continua fora (`GAME_DESIGN.md`).

## [2026-10-16] Cada arma tem a sua dica de primeiro uso (Claude, P160 parte 5)

**Situação:** havia uma dica só para as armas de munição, "FOGUETES: DANO EM ÁREA; EXPLODA NO PÉ DO INIMIGO", e ela aparecia para a granada, o enxame
e o cruzador também: no texto, a arma nova era o foguete (uma das causas de "parecem armas antigas", P152).

**Decisões:**
1. **Uma frase por arma, em dado** (`ui/dicasDeArma.ts`, `Record<WeaponId, …>`: o typecheck exige uma para toda arma nova) com os números **tirados da arma**
   (o enxame diz 8, 16 ou 32 mísseis conforme o nível; a granada, o alcance), para a dica nunca contradizer o jogo.
2. **Uma vez só, e não volta** (guardado no navegador, tolerante a falha). Com outra dica na tela, espera sem marcar. O foguete segue com a dica de sempre.
3. **A caixa da dica cresce com o texto** (até 90% da tela): as frases passam de 60 caracteres.

## [2026-10-16] Identidade editorial da landing e comunicação pública profissional (Codex, P169)

**Ordem:** evoluir a landing e o primeiro acesso pelas cinco referências fornecidas, mantendo números reais e usando os robôs do jogo nas imagens.

**Decisão:** preto mineral, amarelo de destaque, tipografia legível e composição industrial; fontes do sistema, com Azonix apenas na marca. A entrada principal abre o jogo solo sem depender da disponibilidade online; multiplayer permanece como operação explícita. A landing não antepõe uma segunda vinheta à vinheta existente no jogo.

**Conteúdo:** atributos e links de montagem vêm do catálogo do jogo; estatísticas extensas ficam na Oficina. Textos de apresentação usam vocabulário de produto e engenharia. A fila interna de decisões e trechos de trabalho em andamento ficam no painel local; os registros originais e as falas do dono não são reescritos.

**Imagens:** rigs reais, montados sem física, fotografados em cena promocional estática. Não são promessa de cenário jogável. Miniaturas de cenário vêm de capturas existentes, não de métricas nem jogadores fictícios. Arquivos versionados; a landing não depende de gerar arte durante o deploy.

**Custo:** nenhum custo no tick ou render do jogo; imagens JPEG, lazy loading abaixo da abertura, troca de câmera a cada 6 s suspensa com foco/hover/aba oculta/redução de movimento; consulta de status a cada 20 s conforme contrato, com cancelamento e sem sobreposição.

## [2026-10-16] Os rebeldes lançam a arma explosiva da mão esquerda (Claude, P160 parte 4)

**Situação:** o Vector-09 inimigo sai de fábrica com plasma e casulo de foguetes, mas o bot só atirava a arma principal: as explosões novas (P160 parte 1)
quase nunca vinham contra o jogador. O Comandante, 16/10: *"bote pra torar na iteração das armas"*.

**Decisões:**
1. **Salvas, não fogo contínuo:** dois tiros (o lançador leve solta o carregador), pausa de 7 s no normal (a fácil espera mais, a difícil menos, a
   personalidade agressiva encurta), carregador de verdade e nunca mais perto que 1,6 × o raio da explosão + 6 m. A salva que empaca (perdeu o alvo no
   meio) é cancelada — achado pelo teste: ela voltava 2 s depois furando a pausa.
2. **Mira no pé de onde o alvo vai estar**, com o erro da dificuldade em metros: a explosão pega quem fica parado, e quem se mexe desvia.
3. **Sorteio próprio** (`blastRand`, outra semente): a salva não mexe na sequência das outras decisões do bot.
4. **A partida padrão mudou** (a foto tick a tick do `esquadraoPadrao.test.ts` foi refeita, como o teste manda): medido em 90 s com o jogador parado,
   no offline padrão o jogador apanha **menos** (448 contra 1 178: os aliados também lançam e limpam os rebeldes antes) e vê 50 explosões em vez de 3; na
   Arena do servidor (3 contra 1) apanha 34% a mais. Desligar é `explosivos: false` na partida; um botão nas configurações fica para se o Comandante pedir.
5. **O esquadrão (P91) pode dar armas explosivas aos bots** (`armaExplosivaDoBot`): granadeiros, artilheiros de cruzador, enxames.

## [2026-10-16] O "Testar" do Hangar desenha com a camada de efeitos do jogo (Claude, P160 parte 3)

**Situação:** em 15/10 o Comandante disse das armas novas: *"selecionei e implementei elas mas parece que são armas antigas"*. O "Testar" do Hangar — o
primeiro lugar onde ele vê uma arma — desenhava todo tiro com o mesmo traço (ciano na energia, laranja na munição) e o mesmo clarão no alvo.

**Decisões:**
1. **O teste usa a mesma camada do jogo** (`WeaponFx`, `BeamVisuals`, as partículas de acerto de cada arma), num módulo próprio (`hangar/TestShots.ts`,
   G3), com a **trajetória da família**: reta na velocidade da arma, a salva com o desvio dela, os nove balins em cone, o arco do cruzador e o arco da
   granada. O Hangar não tem física: o tiro vai do cano ao ponto do alvo (só desenho).
2. **Achado e corrigido (R17):** o contador de dano do teste contava um balin por disparo da escopeta (`testAt`); agora conta os nove.

## [2026-10-16] O lança-granadas: o arco regula a carga para passar por cima da cobertura, e a rede manda a direção da mira (Claude, P160 parte 2b)

**Situação:** a P160 pede "balísticas" e "novos estilos, tipos, formas". Nenhuma arma do arsenal tinha gravidade.

**Decisões:**
1. **A granada cai no ponto da mira** (o lançador calcula a elevação), em vez de o jogador ter de adivinhar a queda: a mira de sempre continua valendo,
   e a mira prevista (o arco em pontinhos e o anel) mostra o que vai sair.
2. **Carga regulada em vez do "arco alto" de carga cheia:** com 42 m/s o arco alto para 29 m saía a 80°, subia 39 m e levava 3,9 s (a bancada mostrou);
   quando o arco baixo bate na cobertura, sai a **menor elevação de 35° a 75° que passa limpa**, com a velocidade que faz cair no ponto.
3. **A rede manda a direção da mira, não a de lançamento** (como o cruzador): a velocidade varia por tiro e o evento de 7 bytes não tem onde levá-la; o
   outro cliente acha o ponto da mira pelo raio e refaz a mesma conta (a escolha do arco só olha o cenário parado, igual nos dois lados).
4. **No chão crava, na parede tabela:** com quique de verdade no chão a granada caía 15 m além da mira; agora estoura a ~2 m, e tabelar na parede
   continua sendo o truque.
5. **34 de dano** (não 45): com 45 o MK III derrubava um torso em 3,7 s sozinho, contra a regra dos 4,5 s do Comandante (P111).
6. **Protocolo 19** (`grenade` no fim de `NET_WEAPONS`); o servidor reinicia sozinho a cada `main` nova (o atualizador do PC).

## [2026-10-16] A escopeta sai em balins, de dentro do ProjectileSystem (Claude, P160 parte 2a)

**Situação:** a escopeta era um projétil só de 52 que caía a 8% aos 45 m: uma "escopeta" sem chumbo. A ordem P160 pede balística e estilos de verdade.

**Decisões:**
1. **Os balins nascem no `ProjectileSystem.fire`**, não no `Armament`: os bots atiram direto pelo `ProjectileSystem` (`BotSystem`), e o desenho do tiro de
   outro jogador também; assim o servidor, os bots e o online saem iguais com **um** evento de tiro por disparo (não nove: a rede não muda).
2. **Desenho fixo, sem sorteio** (`spreadAt` com o número do balin, o 0 no centro): o servidor e o cliente desenham o mesmo cone (G1/G2).
3. **A queda vem da geometria:** 9 × 6 num cone de 3,4° (cada balin cai a 25% aos 50 m). De perto o disparo bate 54 (era 52) e o tempo para derrubar um
   torso não mudou (4,0 s MK I, 3,2 s MK II e III); entre 15 e 30 m a escopeta ficou mais forte que antes (32 aos 30 m, eram ~24) — proposta, o
   Comandante ajusta em Potências.
4. **Um disparo, um retorno:** os balins que acertam o mesmo alvo dentro de 0,04 s somam num número de dano (`DamageNumbers`, chave = o alvo) e o som de
   acerto toca uma vez por tick.

## [2026-10-16] A cara dos tiros: explosão com corpo, rastro em fita, clarão e marca por família de arma (Claude, P160)

**Situação:** o Comandante (16/10, P160) compara o jogo com jogos 3D feitos em uma semana e os acha "mil vezes melhores". O arsenal já tem 20 armas; o
que separava era a **sensação** de cada tiro: a explosão era só uma nuvem de pontos que somava luz (a "fumaça" também somava, então nunca
escurecia), o rastro de míssil era uma fila de pontinhos, o tiro de energia uma risca e o trilho uma linha de 1 px; nada ficava onde o tiro batia.

**Decisões:**
1. **Visual primeiro, regra intacta:** este PR não muda dano, alcance nem cadência de nenhuma arma (nenhum teste de equilíbrio mexeu). Balística e
   estilos novos (balins da escopeta, arco com gravidade) vêm num PR próprio, com teste de simulação.
2. **A simulação avisa, o cliente desenha:** os sistemas de tiro ganharam um campo opcional `fx` (`ShotFx`: `fired`, `flying`, `impact`, `landed`,
   `trail`). O servidor deixa vazio e não paga nada; com ele ligado, o rastro de partículas antigo do míssil e do obus sai (a fita o substitui) e a
   linha de 1 px do trilho virou o raio iônico no pool de feixes do laser.
3. **Fogo com mistura normal, não soma de luz:** a primeira versão somava luz e dez bolas de fogo sobrepostas viravam um borrão branco que cobria a
   tela (medido na bancada). Com mistura normal o laranja satura e o bloom acende só o miolo.
4. **Estilo low-poly mantido** (decisão de 07/10, `REFERENCIA_VISUAL.md`): bola de fogo e fumaça são poliedros de faces chapadas que fervem (a forma
   ondula no shader), não folhas de sprite.
5. **Marca só em superfície parada** (colisor sem corpo): num Mech a marca sairia andando. A rotatória marca a cada 3 acertos (20 tiros/s).
6. **A cara de cada arma é dado** (`fx/weaponLook.ts`), separado da força (`combat/weapons.ts`), para o Estúdio (P157) editar sem tocar na regra; a
   cor do inimigo continua de aviso (teste trava a cor igual à do jogador).
7. **O tranco da explosão escala com o tamanho** (`explosionShake`): o alcance era fixo em 40 m para qualquer explosão.

**Custo:** 0,45 ms por quadro sob carga extrema (170 fitas, 219 peças de explosão, 160 cartazes, 80 marcas); 9 desenhos para todos os efeitos da
cena; nada alocado por quadro. GPU real: 0 de 192 poses com NaN com os efeitos acesos (`varrer-nan.mjs --efeitos`). JS 472,3 KB de 500.

## [2026-10-16] Os cabos de dados são regra pura em `sim/`, o andróide rebelde "se liga" por proximidade, e a ficha de fatos mostra o quadro misto (Claude, P162, P163, P166)

**Situação:** o Comandante deu o capítulo 1: os cabos como pontos de invasão (o andróide se liga e injeta, os outros o protegem, nós o desligamos) e pediu os casos de privatização para a ficha de fatos.

**Decisões:**
1. **A regra dos cabos é módulo puro em `sim/` (`CabosDeDados`), sem relógio nem sorteio.** O `Match` só **conta quem está perto** de cada ponto e entrega os números; assim o teste cobra a regra sem montar o jogo, e o servidor roda a mesma quando a missão em ondas for para a rede.
2. **"Ligar-se" é estar parado perto do ponto, não uma animação nem uma ação.** Os andróides recebem a ordem `hold` do Domínio, aplicada **a cada segundo** (um por cabo, em rodízio), com o desconto do `escortSide × 6` que a ordem soma ao posto (senão metade dos andróides pararia no cabo vizinho). Um andróide que fica trocando tiro a mais de 4,5 m do ponto **não injeta**: a defesa do ponto é matar ou afastar o andróide.
3. **Quem depreda e quem se liga são papéis diferentes:** o andróide injeta (ataque à informação), o rebelde pesado depreda (ataque à infraestrutura). Cabo **tomado** e cabo **cortado** drenam a rede; **tomado só se libera com defensor perto**, de propósito: injeção não some sozinha, é preciso ir lá.
4. **O desempate de "qual cabo" é o de menor índice** (dois cabos a 3 m): a mesma posição dá sempre o mesmo cabo (o teste de partida pegou o caso de um jogador parado no meio de dois cabos).
5. **O dreno extra entra no núcleo como "peso equivalente" na pressão**, para o alerta do HUD acender também quando o dano vem dos cabos, sem tocar na regra dos invasores.
6. **A ficha de fatos mostra o quadro misto, não a tese.** O levantamento achou fatos fortes (a Enel e o apagão de 3,1 milhões de unidades; o Compaj; os inquéritos da PF e do Cade) e casos **em aberto** (a Sabesp subiu 6,11% a 6,5% no primeiro reajuste; a saúde não tem comparação com dado). O jogo mostra o que aconteceu, com fonte, e **não afirma** o que a fonte não diz (que a Petrobras "foi privatizada"; que o presídio privado é sempre pior; que a conta "subiu por causa" da venda). É mais forte contra quem desmente. **As fontes primárias ainda não foram lidas:** é o passo antes do texto final.

**Por que registrar:** quem for fazer a parte B (o manifestante, a segunda entrada), o porto ou a Colossus em fases precisa saber como o andróide "se liga", que o rebelde pesado depreda, e que nenhum cartão do jogo diz mais do que a ficha.

## [2026-10-16] O ciclo do dia é só luz, calculado do relógio da partida; o azimute do sol não muda; e o que a campanha não vai fazer (Claude, P161 a P166)

**Situação:** o Comandante achou a praia clara demais para a hora do sol e com a iluminação pública acesa de dia, e pediu que a partida **comece no pôr do sol e termine em noite** em 5 minutos, com as luzes acendendo. Na mesma mensagem respondeu o `CAMPANHAS_E_CHEFES.md` e deu a história da campanha.

**Decisões:**
1. **O ciclo é visual, nunca simulação (G1/G2):** o relógio vem da missão em ondas, da rodada de 5 minutos ou do relógio do mapa, e só muda luz, céu, mar e uniformes. Nenhuma regra de jogo lê a hora do dia (os bots não veem pior de noite): se um dia ler, vira módulo de `sim/` com teste.
2. **O azimute do sol é fixo; só a altura muda.** As sombras assadas no chão leem só o x e o z do sol; mudar o azimute exigiria assar de novo. O custo: a sombra não alonga com o pôr do sol (ela some quando o sol apaga).
3. **A luz pública liga por adereço, com um instante por adereço**, igual no bulbo, no halo, na poça e no feixe; a sinalização fica sempre ligada. Um único número (`lampadas`, 0 a 1) manda em tudo: o quadro de luz do porto (P164) vai ligar nele.
4. **`UniformesDaPraia` é o dono do sol, da lua, da névoa, da noite e das lâmpadas**, não constantes do módulo do céu. Regra aprendida: **`THREE.UniformsUtils.merge` clona cada uniforme**; o que se divide entre materiais entra depois dele, como o mesmo objeto (o mar lia uma cópia congelada do tempo e as ondas ficavam paradas).
5. **Sátira exagera, fato tem fonte na ficha.** O jogo vai ensinar (Estado provedor, privatização, laicidade, manipulação): toda afirmação factual leva fonte; sem fonte é sátira, dita como sátira.
6. **O que a campanha não faz:** criança com arma (nenhuma criança vira alvo ou arma) e personagem desenhado como evangélica (religião e quem a pratica ficam fora do alvo, a regra do `CAMPANHAS_E_CHEFES.md` § 2, que combina com o Estado laico que o Comandante defende); o rótulo "gado" fora do texto; "mulheres" fora do código do banco. **O que entra:** o manifestante dos eventos reais (Capitólio, 8 de janeiro), o manipulador/farsante como chefe e a máscara da Colossus V1 como skin de chefe, desligável (o risco jurídico e de plataforma está registrado).

**Por que registrar:** quem for construir a campanha precisa saber o que o Comandante ordenou, o que ficou de fora e por quê, e que o ciclo do dia é um número só que o quadro de luz vai ligar.

## [2026-10-16] Teste que roda `git` não pode herdar o ambiente do hook: um `git init` de teste corrompeu a config compartilhada (Claude, P155)

**Situação:** o teste das pendências do Estúdio (PR #339) cria um repositório de teste dentro de `.tmp/` e roda `git init`, `git config` e `git commit` nele. Rodando **dentro do hook de push** (que herda `GIT_DIR`, `GIT_INDEX_FILE`…), esses comandos agiram no repositório **de fora**: a `.git/config` compartilhada ficou com `core.bare = true` (o `git status` das worktrees passou a falhar e a principal virou "(bare)") e com um `[user]` falso (`t@t`). Os commits e o histórico não foram tocados; o dano ficou na config e foi desfeito à mão.

**Decisões:**
1. **Todo `git` filho de teste ou de ferramenta roda sem as variáveis `GIT_*`** (`ambienteSemGit`, em `scripts/estudio.mjs`). O `pendenciasDoGit` do Estúdio também, senão a lista de pendências mostrava `git: false` dentro do hook.
2. **O teste não usa `git config`:** a identidade vai por `-c user.email=… -c user.name=…` no próprio comando, e o `git -C <pasta>` fixa o alvo.
3. **O teto de busca do git (`GIT_CEILING_DIRECTORIES`) fica na pasta-mãe do repositório de teste:** se o `git init` falhar em silêncio, o comando seguinte falha em vez de achar o repositório de fora.
4. **Teste novo trava a causa:** roda o `pendenciasDoGit` com `GIT_DIR`, `GIT_INDEX_FILE` e `GIT_WORK_TREE` apontando para o lugar errado e exige a leitura certa (mutação à mão: sem o `env`, o teste falha). E o conjunto do Estúdio foi rodado com o ambiente do hook simulado, conferindo que a config compartilhada ficou **byte a byte igual**.

**Por que registrar:** o teste passava na máquina e só quebrava no hook, e o estrago era no repositório de todos os agentes. Quem escrever um teste que chame `git` precisa saber que o hook de commit e o de push herdam o ambiente. Se aparecer `bare = true` ou `[user] t@t` na `.git/config`: `git config --file .git/config core.bare false` e `--unset user.email` / `user.name`.

## [2026-10-16] A voz própria entra pelo Estúdio, convertida no servidor, tratada pelo mesmo motor e protegida do gerador (Claude, P151)

**Situação:** o Comandante achou o "Combate!" em português fraco e perguntou se devia gravar a própria voz. A resposta (sim) precisava virar um caminho de dois cliques, não um roteiro de arquivos.

**Decisões:**
1. **Gravar dentro do Estúdio, não largar arquivo numa pasta:** o microfone no navegador (permitido em `127.0.0.1`), com a fala escrita na tela, a intenção e um medidor de nível. Um roteiro de pastas e nomes de arquivo era um obstáculo para quem só quer gritar uma palavra.
2. **O servidor converte tudo para WAV mono 44,1 kHz:** o MediaRecorder do Chrome entrega webm **sem duração no cabeçalho**, e o que não tem duração não corta nem aparece na onda. Converter na entrada dá uma fonte limpa, e a tomada guarda a gravação intacta (dá para refazer o tratamento sem regravar).
3. **O mesmo motor de efeitos dos sons, com a interface como um componente do núcleo:** a prévia e o mp3 final continuam sendo a mesma cadeia; o que muda é o alvo de nível (-16 dB de média, para voz) e o limite de duração (8 s, não 4). A aba SONS passou a usar o mesmo componente, para as duas não divergirem.
4. **A voz do Comandante é protegida do gerador:** uma fala gravada por ele nunca é regerada pelo `npm run vozes`, nem com `--refazer`. Sem isso, o comando que ele mesmo vai rodar para gerar as falas restantes poderia pisar na gravação dele.
5. **A voz gerada fica guardada (`_elevenlabs/`) e dá para voltar:** gravar por cima não pode ser um caminho sem volta.
6. **O Voice Changer do ElevenLabs fica de fora:** gasta crédito por segundo, e o gasto de crédito é do `npm run vozes` (custo mostrado antes, chave só em variável de ambiente), não do Estúdio.

**Por que registrar:** quem for mexer no narrador precisa saber que a fala gravada vence a gerada, que existe a cópia da gerada, e por que o gerador pula certas falas.

## [2026-10-16] O Estúdio vira um hub de módulos; a prévia usa o mesmo motor do arquivo final; o Estúdio não publica (Claude, P155 a P157)

**Situação:** o Comandante quer um Estúdio ao lado da Mesa de vídeo: hoje de sons (importar e registrar, tom, velocidade, cortar, esticar, comprimir) e, no futuro, dos tiros, das armas e dos Mechs 3D.

**Decisões:**
1. **Hub com contrato, não uma ferramenta de som:** o núcleo guarda a segurança uma vez e cada módulo é dado + validador + prévia + processador. Quando vierem tiros e Mechs, entram no mesmo lugar, sem repetir a guarda.
2. **A prévia e o arquivo final são a mesma cadeia de ffmpeg** (`cadeiaBase`), e o volume é medido **depois** dos efeitos. Se a prévia fosse um aproximado no navegador, o Comandante ajustaria um som e o jogo tocaria outro. Esticar, comprimir e mudar o tom mudam a duração, então **a duração que vale é a de depois dos efeitos** (limite, fade, duração máxima da arma) e a cauda do eco é cortada nela.
3. **Importar já registra:** um arquivo que chega pelo Estúdio vira um clipe com nome único, entra no mapa, é processado e fica pronto, exatamente como o Claude faria, para não haver "arquivo solto" que o jogo não conhece. Arquivo que não é áudio é recusado sem deixar lixo.
4. **O Estúdio não publica:** commit, PR e merge ficam com o `npm run publicar` (o `check`, o `ESTADO_ATUAL`, o painel público sem o codinome). Um botão que os pulasse arriscaria a `main`; o Estúdio só mostra o que falta publicar e o que dizer ("publica os sons").
5. **Os testes cobram estrutura, nunca gosto**, e a **força** das armas (dano, alcance, recarga) fica **fora** do "gosto": é jogabilidade e continua com o relatório de equilíbrio e o teste de simulação (G14).
6. **Uma bancada nunca escreve na pasta real:** a primeira versão da bancada ponta a ponta importou o arquivo de teste para as referências do Comandante; ela passou a trabalhar numa cópia.

**Por que registrar:** quem for adicionar uma aba (vozes, tiros, Mechs) precisa do contrato do módulo e das razões das regras (prévia igual ao final, não publicar, estrutura e não gosto).
