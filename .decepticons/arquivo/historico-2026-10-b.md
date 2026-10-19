# ARQUIVO — HISTORICO_DE_DECISOES (quinzena 2026-10-b)

> Texto movido sem alteração de `HISTORICO_DE_DECISOES.md` por `npm run arquivar`. Não editar: o vivo é o documento principal.

<!-- arquivo -->

## [2026-10-17] A Amazônia, parte C: o Draga-01 com corpo e a missão do rio (Claude, P180)

**Ordem:** "continua iterando até concluir essas pendências": o chefe de verdade, a marcha até a aldeia e o que o jogador faz.

**Decisões:**
1. **O Draga é um `MechBase`** (como o Colossus), não uma entidade nova: ganha de graça a cápsula, o character controller, o dano por parte, o calor, o canhão, o `crawls` e o registro no combate. O `MechBase` pede um rig de bípede, então o do Draga é de **nós vazios** e o desenho de quatro pernas (`WalkerVisual`) vai por cima, injetado como interface (`VisualDoDraga`): o servidor e os testes de regra nascem sem ele.
2. **Dois módulos de perna para quatro pernas:** cada módulo é **um lado**. O desenho mostra a perna da frente caindo de 100% a 50% da vida do módulo e a de trás de 50% a 0%; a velocidade segue a regra do `MechBase.mobility` (um lado caído 50%, os dois 30%). **Um sistema de dano novo para quatro pernas ficou de fora de propósito**: custaria mexer no HUD, na rede e em todos os testes de dano.
3. **A missão tem módulo próprio** (`MissaoDoRio`), **não reaproveita `SurvivalWaves`**: o fim é o do Draga (cai, ou cruza a linha da aldeia), e a Sobrevivência da Amazônia não tem ondas. O fim sai pelo mesmo `onMissionEnd` das ondas, então a tela de fim e a campanha já funcionam.
4. **A Sobrevivência na Amazônia é a missão do rio:** o link do seletor de mapas leva direto a ela (`modo=survival`); o Deathmatch do mapa é escolha do seletor de modo. A campanha aceita as duas etapas na Amazônia (e não a Bandeira).
5. **O Draga e o rio carregam sob demanda** (`ChefeCarregado`, `carregarChefeSeFor`): o corpo, o cérebro e o desenho só baixam para quem abre a missão. **O JS de partida ficou em 490,7 / 500 KB** (a parte C pagou ~2 KB de HUD, fases e a fiação do `Match`; antes de a dieta de JS da `main` entrar, a soma dava 499,2 e a folga era de 0,8 KB): **a parte D e a E devem manter o que é só da missão sob demanda**.
6. **`?marcha=0.8` é um recurso de teste e de jogo:** começa a missão com o Draga já andado (de 0 a 0,95). Sem ele o Comandante teria de esperar dez minutos para ver o fim; a mesma ideia do `?onda=` da Sobrevivência.
7. **Aviso:** a floresta densa (0,82 de densidade, árvores de até 29 m) **esconde o Draga (38 m) de quem está dentro dela**; ele aparece no rio e nas clareiras. Ficou assim por ser o ambiente; se o Comandante quiser, a margem do rio ganha uma faixa menos densa.

**Prova:** mutação à mão, 60 mutações, **59 pegas**. A que escapa é **equivalente** (o `depois >= antes` do aviso da marcha é redundante com o teste de cruzar a distância). Duas lições: (a) uma cápsula com raio maior que a metade da altura **trava o Rapier** (o teste do raio a pega por um limite, e o corredor de mutação precisa de um tempo máximo por rodada); (b) os dois testes que escaparam de primeira (o Draga seguir o rio e o mundo congelar no fim) só pegavam o número, não o efeito: agora o desvio máximo do eixo do rio na marcha toda é medido (5 m, teto 12) e a posição do Draga no fim.

**Por que registrar:** quem for fazer a defesa (D) e a invasão (E) precisa saber que o Draga é um `MechBase` com dois módulos de perna, que a missão tem módulo próprio e que **o pacote de partida tem 9,3 KB de folga (490,7 de 500)**.

## [2026-10-17] O atualizador do servidor passa a guardar o fim da saída quando a verificação falha (Claude)

**Problema:** a verificação (typecheck + testes de `server/` e `shared/`) reprovou seis vezes e a produção ficou 2,5 h no código velho; o log só dizia "FALHOU", porque a saída ia para o console de uma tarefa agendada. Descobri a causa (concorrência com o trabalho dos agentes) por silêncio e tentativa, não por evidência.

**Decisão:** gravar as **últimas 40 linhas** da saída do comando que falhou no `atualizacao.log` (`ultimasLinhas`, testado). **Não** mudei a política (continua uma tentativa por rodada, voltando ao código verificado se falhar), porque repetir ou esperar silêncio é um trade-off de operação que cabe a quem usa a máquina: com a saída no log, o próximo episódio mostra qual teste caiu e por quê.

## [2026-10-17] A porteira descarta o pico em vez de cortar a conexão (Claude, P184)

**Ordem:** "não tô conseguindo jogar online, dá erro e cai a conexão... não consigo jogar CONTRA meu outro PC usando VPNs diferentes".

**Diagnóstico (do `servidor.log`):** quatro "corte de ...: taxa alta demais", dois deles de IPs de VPN, com o servidor saudável; o `tickMs` (média móvel de 2%) em 298 e 1.093 ms, ou seja, travadas de segundos do laço; PC do servidor com ~400 MB livres de 6 GB.

**Decisão:** a porteira **descarta** a mensagem quando o balde esvazia e só **corta** quando o descarte vira abuso (`dropCut` = 600, caindo `msgs` por segundo); a folga subiu de 30 para 120. **Por quê:** o corte no primeiro excesso punia quem esperava o servidor (as mensagens de todos chegam juntas depois de uma travada), e o jogador de VPN, com mais jitter, caía primeiro. Descartar custa uma conta (nada é decodificado) e perder um pacote de entrada só faz a previsão se corrigir; a inundação de verdade ainda cai em instantes (mil mensagens de uma vez cortam em ~700).

**Não resolvido por código:** o túnel da Cloudflare cai com a VPN do PC do servidor (502), e o PC do servidor é o mesmo da bancada de trabalho (memória). Está no `DEPLOY.md` § 4b.

**Prova:** testes do balde e do servidor de verdade; mutação à mão, 7 de 7.

## [2026-10-17] Auditar o idioma também por modo de jogo, e deixar o arpão do Onça para o Comandante (Claude, P173/P181)

**Decisões:**
1. **A auditoria de idioma roda em cada modo** (`?lang=ja&modo=…`, jogando alguns segundos), não só nas telas do console: a missão da praia tinha dezenas de textos em português que nenhuma tela de menu mostra. A Amazônia fica de fora (outra sessão).
2. **Constantes viram chave inteira** ("CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM"), **o que tem número vira padrão** ("CABO {0} TOMADO · …"): a tradução da frase inteira sai melhor que parte a parte; a composição `{0} · {1}` fica para o que o código cola.
3. **Ombros no Onça não entram sem o olho do Comandante:** o encaixe de ombro do Marauder é medido no desenho importado; o Onça é procedural, então precisaria de encaixe, boca e lançador desenhados. Hoje o arpão é do Marauder (que puxa qualquer médio e mais leve); o Onça (raio 1,6) seria o melhor usuário, mas é decisão visual dele.

## [2026-10-17] Cópia de segurança do banco de contas dentro da pasta do projeto (Claude, P183)

**Pergunta do Comandante:** onde ficam os logins sem Supabase? A resposta honesta incluía um achado: **o `contas.db` era um arquivo só, no PC do servidor, sem nenhuma cópia.**

**Decisões:**
1. **Cópia diária consistente (`VACUUM INTO`), as últimas 14, na pasta `backups/` ao lado do banco**, feita pelo próprio servidor (ao subir e a cada 6 h). Não depende de tarefa agendada nem de script externo: se o servidor roda, a cópia roda.
2. **Dentro da pasta do projeto, por G15 (regra do dono):** o projeto não grava fora dela. **Consequência dita em voz alta:** a cópia não protege de o disco morrer; levar `backups/` para fora é decisão e ação do dono (`Copy-Item`), não do código.
3. **Falha na cópia só registra:** o jogo e as contas não caem por causa de um backup que falhou.
4. **Nada de Supabase por causa disto:** o SQLite no PC continua sendo a decisão do dono (28/09); a troca de banco (Postgres, se crescer) continua sendo mudar só o `server/contas.ts`.

## [2026-10-17] Os painéis opcionais do console saem do JS de partida (Claude, R7)

**Problema:** o teto de 500 KB gzip do JS de partida estava em 499,7 KB. Cada PR que somava um módulo (o `‹ valor ›`, o Arquivo, o idioma do Hangar) empurrava o total para o limite e travava o `npm run check`; a saída honesta era emagrecer, não subir o teto (R7 é do protocolo).

**Decisão:** o que só abre por clique **não entra no download de partida**. O Esquadrão, as Campanhas, o Arsenal, o Servidor do dono e as Câmeras viram pedaços sob demanda (`import()` + `sobDemanda`), no modelo que o `orcamentoDeJs.mjs` (P180) já previa para as fases. Partida: **499,7 → 486,2 KB**. **O custo:** o primeiro clique de cada painel espera o pedaço (<7 KB gzip, uma requisição); sem rede o painel não abre e o jogo avisa no console.

**Regra que fica:** tela ou painel opcional = `import()`; texto estático longo = JSON em `public/`. **O que não foi feito e por quê:** o Hangar (`HangarMenu` + `HangarScene`, ~43 KB minificados) segue no pacote de partida: o `Game` o aquece no boot para o primeiro "H" não engasgar, e tirá-lo muda essa experiência; fica como a próxima alavanca, decisão de quem mede a sensação.

## [2026-10-17] A Amazônia, parte B: o rio e o mapa (Claude, P180)

**Ordem:** "continua iterando até concluir essas pendências": o cenário do rio, bem maior que o que temos, eficiente, com o rio limpo acima do Draga e envenenado depois dele.

**Decisões:**
1. **O terreno é uma função pura única** (`alturaDoTerreno`), lida pela malha e pelo colisor de altura: o que se vê é o que se pisa (G14), e a grade é uma só para os dois. **24 pedaços de 300 m, um nível de detalhe só** (o plano falava em três; com o alcance de 1.500 m o terreno inteiro dá ≤ 120 mil triângulos, e níveis a mais custariam emenda e código sem ganho medido). Encosta máxima de 0,50, medida na grade inteira.
2. **O rio é o termômetro por UM uniforme** (a frente): o shader da água, o do chão, o da folhagem e o das estruturas leem o mesmo número; `limpezaDoRio` é a mesma conta em JS (pura, testada) e em GLSL (a string é travada por teste). A banda do veneno é de 70 m de cada lado (não é uma parede).
3. **A floresta tem dois níveis por pedaço de 300 m** (a árvore de 52 triângulos até 260 m, o bloco de 10 até 1.050 m) e **rareia em volta da mina e da planta** (o desmatamento é a história da fase).
4. **Mapas grandes carregam sob demanda** (`mapasSobDemanda.ts`): o registro é o único que o pacote de partida enxerga. O `ServerPanel` também passou a ser sob demanda para devolver folga ao teto de partida (**497,2 / 500 KB**): é a mesma política de dois tetos da parte A (o Comandante pode vetar).
5. **O Draga na Amazônia anda rio acima a 2,6 m/s e para a 240 m da aldeia** (~9 minutos): a frente do rio vai com ele. Responde, para esta fase, a decisão em aberto 0 do `AMAZONIA.md` (a Draga **anda desde o começo**); o Comandante ainda pode mudar.
6. **A câmera do mapa:** a do jogo (800 m) cortava o mapa de 2.400 m e deixava o céu preto; o mapa agora traz o `alcanceDaCamera` (1.500 m) e o domo de 1.200 m cabe dentro dele. **Lição:** **a bancada tinha a câmera dela e não via o que o jogo via**; o céu preto só apareceu no jogo real. Agora a bancada usa o mesmo alcance, e `medicoes/amazonia-jogo.mjs` fotografa o jogo.

**Bugs achados pelos testes e consertados:** (a) `THREE.UniformsUtils.merge` copia o valor de cada uniforme: a água e a lagoa nunca leriam a frente nem o tempo (hoje os uniformes do mapa entram por referência, e um teste confere que são o mesmo objeto); (b) a chave da campanha só lia os mapas `a` e `b`, e o link da etapa só levava `mapa=` para o Bunker (uma etapa na Praia abria a Cidade Neon); agora lê `abpz` e leva o mapa de todos os que não são a Cidade Neon.

**Prova:** mutação à mão, 71 mutações, **69 pegas**; as 2 que escapam são equivalentes (a guarda de declive da floresta é redundante com a fórmula de densidade; a guarda do nascimento do jogador é redundante com a da aldeia). Elas ficam no código por segurança contra mudança futura de layout.

**Por que registrar:** quem for fazer o Draga com corpo (C), a defesa (D) ou a invasão (E) precisa saber que o rio lê UMA frente, que o mapa é sob demanda, que a câmera do mapa é maior e que o orçamento de contagem tem folga de 9% no pior ponto (a aldeia).

## [2026-10-17] O idioma se audita no navegador, e a composição "A · B" traduz parte a parte (Claude, P173)

**Problema:** o Comandante quer o jogo no idioma nativo de quem chega. O teste de cobertura (que lê o código) dava tudo verde, mas **o Hangar falava português em japonês**: o texto que o jogo monta (colando "MÉDIO", "ASSALTO" e a descrição com " · ") nunca é uma chave do dicionário, e o teste só olhava as partes.

**Decisões:**
1. **A auditoria de idioma é feita no navegador de verdade** (abre cada tela com `?lang=ja` e lista o texto sem tradução): o que o jogador lê é o que importa, não o que está no código. `.tmp/auditar-idioma.mjs` e `auditar-jogo.mjs` (locais) são o modelo; o **teste de cobertura agora exige que nada em português sobre** (só nomes próprios e unidades), não só que "mudou".
2. **Chaves de composição `{0} · {1}` e `{0} · {1} · {2}`** (as seis línguas): cada parte é traduzida pelo que o dicionário já sabe e a estrutura fica. Um texto composto novo não pede uma chave nova se as partes já têm.
3. **Duas regras no motor do tradutor:** o padrão com **mais texto fixo** vence (antes: o maior regex, que contava as lacunas), e uma **chave sem " · " não engole uma composição**. Sem a segunda regra, `ESCALA {0}` e `{0} aliados` pegavam "ESCALA 3 · CERCO · …" e deixavam o resto em português, com o teste (que só via "mudou") verde.
4. **As frases que o código cola caso a caso** (a dica da arma + o aviso dos ombros + o das costas…) **se traduzem pedaço por pedaço e se juntam** (`traduzir` no `HangarMenu`), em vez de uma chave por combinação possível.
5. **O que fica em português de propósito:** as telas do dono (Arsenal, Estúdio, Servidor), os rótulos de acessibilidade do mapa e os nomes próprios dos robôs.

## [2026-10-17] O Arquivo: conteúdo em JSON por língua, painel sob demanda, tudo opcional (Claude, P179 camada 2)

**Ordem:** mostrar o posicionamento do jogo *"SUTILMENTE E ELEGANTEMENTE, pedagogicamente"* e explicar o que é o fascismo, a rede de mentiras, os interesses das elites e a manutenção do medo.

**Decisões:**
1. **Opcional, nunca porta:** o Arquivo mora num chip no console e na pausa; não abre sozinho, não interrompe partida (P133 e a regra 5 do `LADO_E_PEDAGOGIA.md` § 3.4). Quem quer aprender abre.
2. **Uma ficha, quatro partes:** o que é, como aparece, como se defender, a fonte. **A contramedida é a parte que ensina**: o jogador aprende a reconhecer e a agir, não a ouvir sermão. **A ficha 6 é sátira declarada e a tela diz**: a regra "sátira exagera, fato é fato" aparece para o jogador, não só no documento.
3. **Conteúdo em `public/arquivo/<língua>.json`, não em chave de dicionário:** cada língua é um arquivo que um revisor nativo edita inteiro, sem ficar espalhado em seis dicionários carregados no boot de todo jogador. Língua sem arquivo cai no inglês, depois no português.
4. **Painel como pedaço sob demanda (`import()`):** o JS de partida estava em 499,6 / 500 KB. O orçamento de dois tetos (`scripts/orcamentoDeJs.mjs`, P180) existe para isto: recurso opcional não pesa no download de quem não o usa. **Regra para os próximos: texto longo vai para JSON em `public/`, tela opcional vira `import()`.**
5. **Teste como trava de conteúdo:** nenhum nome de político ou bilionário vivo em nenhuma língua (arquétipos, decisão #9 do `UNIVERSO.md`), só as incoerências como sátira, toda ficha com fonte, o mesmo número de sinais em todas as línguas (a tradução não perde nem inventa um tema).

**O que a decisão não faz:** não revisa as fontes (citadas de memória; **revisor humano antes de ir ao ar**) e não traz casos reais (só com fonte dada pelo Comandante).

## [2026-10-17] O MULTI da primeira tela delega ao botão que já existe (Claude, P182)

**Ordem:** a anotação do Comandante, **MULTI** sobre o "2Players" dos jogos antigos.

**Decisões:**
1. **O botão verde é o SOLO; o MULTI é uma chapa embaixo, não um segundo botão primário.** Princípio de uma ação primária por tela (`AUDITORIA_INTERFACE.md`): a pergunta tem duas respostas, mas Enter continua sendo "jogar contra os bots" (o caminho de quem acabou de chegar). O MULTI é azul frio e só acende em dourado sob o mouse ou com o foco (a linha selecionada da referência).
2. **Delega, não duplica:** o clique chama o `#btn-online` do monitor da REDE (que abre o lobby). O estado (em sala ou não) vai em `data-online` no botão, porque o rótulo muda de língua. A regra de entrar online continua só no `OnlineSwitch`.
3. **Só na primeira tela:** no console completo o monitor da REDE já tem o botão (nada repetido), e sem servidor no build o par não existe (não há MULTI para oferecer).

## [2026-10-17] As dicas de arma do Hangar saem do pacote de JS para um JSON (Claude, P182)

**Problema:** o orçamento de JS (R7, 500 KB gzip) estava em 500,03 KB com o `‹ valor ›`; qualquer módulo novo, de qualquer agente, quebraria o `npm run check`. Subir o orçamento não era o caminho (R7 é do protocolo).

**Decisão:** as 22 dicas de uma linha das armas da tela do Hangar (3,5 KB de texto, `WEAPON_HINT` + `WEAPON_HINT_NOVAS`) moram em `client/public/dicas-do-hangar.json` e chegam por um `fetch` na primeira abertura do Hangar (`ui/dicasDoHangar.ts`; sem rede, a dica fica vazia e a próxima abertura tenta de novo). O pacote caiu para **498,49 KB** (folga de 1,5 KB). `dicasDoHangar.test.ts` guarda a regra que o `Record` do TypeScript dava: uma dica por arma do jogo, nenhuma repetida. **Quem for acrescentar texto estático longo ao pacote deve fazer o mesmo** (JSON em `public/`), e não gastar a folga.

**Achado (R17, ainda aberto):** essas 22 dicas **não estão nos dicionários das seis línguas** (a frase do Hangar é montada com sufixos, e a busca é pelo texto inteiro): o Hangar fala português em qualquer idioma. Agora que o texto é dado, o caminho é traduzir cada dica no arquivo; fica registrado no `ESTADO_ATUAL.md`.

## [2026-10-17] A Amazônia: o plano e o Draga-01 riggado (Claude, P180)

**Ordem:** a próxima fase no rio Amazonas (mineradora, rio envenenado, povos indígenas expulsos), com o modelo "heavy industrial walker" do Comandante, "eu não inseri o RIG: tenho que fazer ou você faz?", e o rio limpo a montante e envenenado a jusante.

**Decisões:**
1. **O rig é do Claude, por script de Blender reproduzível** (`scripts/blender/rig-walker.py`), não manual no Blender do Comandante: ele não precisa mexer, e o arquivo sai igual toda vez. O original em `MODELOS 3D` nunca é tocado.
2. **O Draga é quadrúpede e não segue o contrato do `MECHS_IMPORTADOS.md`** (11 ossos Mixamo, antebraço, encaixe de arma): ele ganha o próprio (18 ossos nomeados pelo papel: `fl_coxa`, `deck`, `radar`…). Forçar um quadrúpede num rig bípede seria mentira no código.
3. **Pele rígida por parte, não pele macia:** o arquivo é uma malha de 537 peças soltas de máquina; cada uma vai inteira a um osso (peso 1). A junta não amassa, o custo é o de um desenho e a classificação (por posição) se confere em foto.
4. **Cor nos vértices, sem textura:** o arquivo vinha cinza; um material só, cor por peça e sujeira para baixo. O download não cresce (984 KB) e o desenho segue sendo um.
5. **Marcha de quatro tempos, pisada de 75%:** uma máquina de 38 m não tira dois pés do chão sem parecer cair; o passo (5 m) casa com a velocidade para o pé não escorregar. É função pura (G14), testada sem navegador.
6. **O desenho é só do cliente:** o servidor nunca carrega `.glb` (G14). O Draga vai ser um chefe com **corpo na simulação** (cápsula e números próprios, como o Colossus) e o `WalkerVisual` segue a posição e o rumo dele; as pernas viram os módulos de dano da esquerda e da direita.
7. **O rio é o termômetro da fase:** a mecânica central pedida pelo Comandante vira uma função pura `limpezaDoRio(x)` e um uniforme no shader da água, sem custo por quadro (parte B).
8. **A vilã é arquétipo** (AURUM, Grupo Vorcaris), nunca empresa real; os fatos entram só com fonte (`fichas/fatos-mineracao-amazonia.md`, a escrever).
9. **O teto de JS passa a ser por fase (muda uma trava do projeto: o Comandante pode vetar).** O `smoke` somava **todo** o JS em 500 KB gzip, e a `main` já estava em ~499,8 KB: o Draga (2,4 KB) estourou o push (501,7 KB), e o mapa da Amazônia (dezenas de KB) estouraria de novo. Subir o teto mandaria o código da Amazônia a quem joga a Cidade Neon. **Agora são dois orçamentos** (`scripts/orcamentoDeJs.mjs`, testado em `server/orcamentoDeJs.test.ts`): **de partida** (o `index`, o que ele cita e os imports estáticos de cada um: o que todo jogador baixa; **o teto de 500 KB segue o mesmo**) e **sob demanda** (os pedaços que só um `import()` de dentro do jogo carrega: cada um até 150 KB gzip). O Draga entra como pedaço sob demanda (`WalkerDemo`, 2,4 KB), e o mapa da Amazônia vai pelo mesmo caminho. **Provado no build de produção:** sem `?walker` nada do Draga é baixado; com ele, o pedaço e o `.glb` chegam com 200. **Risco:** a classificação lê o código gerado (sem plugin); se o formato do pacote mudar, o teste do pedaço real (`WalkerDemo-*` fora da partida) acusa. **A folga da partida é de 0,1 KB**: o próximo código de uso geral volta a estourar; cabe ao Comandante decidir se o teto sobe ou se algo sai.

**Por que registrar:** quem for fazer o mapa, a defesa ou a invasão precisa saber que o Draga é quadrúpede de rig próprio, que o rio é o placar visível e que o desenho é só do cliente.

## [2026-10-17] A landing ganha idiomas com um módulo próprio, igual ao do jogo (Claude, P178)

**Ordem:** *"idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele"*.

**Decisões:**
1. **A faixa é a primeira coisa da página**, antes da navegação, com os nomes nativos (a pessoa acha a língua dela sem ler nenhuma outra): o visitante estrangeiro que não lê português precisa **reconhecer** a própria língua, não procurar a palavra "idioma". Enquanto ele não escolhe, a faixa fica realçada.
2. **Um módulo de JavaScript puro, não o do jogo:** a landing é uma página estática gerada por script, sem passar pelo build do Vite; trazer o tradutor em TypeScript pediria um segundo empacotamento. Em vez disso o módulo da landing é **a mesma conta, escrita à mão, e um teste os compara** (G14: uma regra só): se um dia divergirem, o `npm test` quebra.
3. **A mesma chave de armazenamento do jogo (`cybermech.lang`):** a landing e `/jogar/` são a mesma origem; quem escolhe na landing entra no jogo na língua dele sem pedir de novo.
4. **O dicionário é da landing, separado do do jogo:** os textos de marketing não pesam no jogo, e os do jogo não pesam na landing. As chaves que o gerador monta com número do código (`{0} de blindagem…`, `Tamanho {0} · {1} m`) são **padrões com lacuna**, para a landing não quebrar quando o número mudar.
5. **O teste da landing é um trinco, não uma trava dura:** 90% de cobertura (texto novo de outra sessão não derruba o `npm test` por uma frase), com a lista do que falta na mensagem de erro.
6. **Páginas internas (Oficina, Sala de controle) ficam em português:** são para a equipe e para quem acompanha o desenvolvimento; traduzi-las é decisão futura.

## [2026-10-17] O lado político entra pela pergunta, pelo custo e pela fonte; o arpão passa a obedecer ao peso (Claude, P179 e P181)

**Ordem:** *"devemos perguntar se quer jogar pelos aliados antimperialistas […] ou fazer campanha para fortalecer o desmatamento, imperialismo e fascismo das elites"*, ensinando o que é o fascismo e como a mentira e o medo funcionam, *"SUTILMENTE E ELEGANTEMENTE, pedagogicamente"*; e *"robôs mais pesados não podem ser puxados por robôs mais leves"*.

**Decisões:**
1. **A pergunta existe, mas não é uma porta.** O primeiro acesso segue caindo numa partida (P133); a pergunta mora num selo do console e da pausa. O padrão é a Aliança. A pergunta automática depois da primeira rodada fica como decisão dele (`LADO_E_PEDAGOGIA.md` § 7).
2. **Escolher o Consórcio nunca é premiado em silêncio:** o painel mostra **o discurso e o custo** (a sátira dos eufemismos) antes de valer, e, nas camadas seguintes, o fim de missão mostra o que a "operação segue" custou. Pedagogia por contraste, não sermão e não propaganda às avessas.
3. **Ensinar é uma ficha com fonte, não uma opinião do jogo:** o Arquivo parte de estudiosos conhecidos (Eco, Paxton, Stanley, Arendt, RAND), citados para um **revisor humano conferir** antes de ir ao ar; casos reais, números e nomes **só com fonte** (a regra "sátira exagera, fato é fato" de `CAMPANHAS_E_CHEFES.md`). Sem símbolos reais do nazismo ou do fascismo: o fascismo aparece **por mecanismo e por arquétipo**.
4. **A Amazônia é do Comandante no modelo e da Claude na lógica:** a ficha fixa o que a missão faz e os **nomes dos pontos** que o modelo precisa trazer, para ligar sem retrabalho (a lição do Bunker). Nada do modelo foi tocado.
5. **O peso do arpão é o raio da cápsula** (o mesmo número que já decide o empurrão): igual puxa igual, o mais leve não puxa o mais pesado. Foi o dado que já existia em todos os chassis; "peso" de verdade (massa) não existe no código, e criar um agora mexeria no Hangar. O custo: os chassis de malha importada com o mesmo raio contam como do mesmo peso.
6. **As capturas de jogos de terceiros não entram no git** (as dos jogos antigos ficam em `.tmp/referencias/`): o git guarda a leitura e o que levamos, não a arte.

## [2026-10-17] As outras fases: o circuito do quadro de luz se repete na Cidade Neon (Claude, P177, P164)

**Ordem:** "melhore as outras fases além da estação cabos" e, da P164, "um circuito que podemos repetir nas diferentes fases" e "chefes especiais com contexto em cada outra fase".

**Decisões:**
1. **A primeira "outra fase" é a Cidade Neon (a Arena), não o Bunker:** a missão padrão do jogo (`campanhaPadrao`) é a sobrevivência na Arena; o Bunker só tem Deathmatch. Melhorar o que a maioria joga primeiro.
2. **O circuito é a mesma classe, não uma cópia:** `QuadroDeLuz(ponto, vidaMax)` (o padrão é o do porto). Uma regra só (G14); o `Match` escolhe a instância por mapa. **O transformador tem 480 de vida** (o do porto, 240): é o coração da cidade, e o Colossus (peso 4) o apaga em ~20 s, o que dá ao jogador uma janela para derrubar as pernas dele.
3. **O Colossus vai ao transformador e é solto quando ele cai:** o contexto do chefe na Arena é "ele apaga a energia do banco". Sem o que depredar, volta ao comportamento normal (senão ficaria parado em cima de um quadro morto).
4. **Escurecer a cidade é mexer em cores, não em luzes:** as arestas, faixas e janelas são emissivas (não leem as luzes da cena), então a energia escala as cores registradas (`Arena.registraLuz`), só quando a energia muda. **O piso é 12%** para o jogador ainda ler os prédios. **A placa do banco cai junto** (é o transformador dele). Os LEDs da torre Serafim ficam de fora (a base do time tem os modos próprios).
5. **O HUD de missão reaproveita o `PraiaHud`** (modo `soMissao`) em vez de um segundo HUD: a célula do quadro, a barra do chefe e os avisos já existiam e ficam iguais; o que é só da praia é escondido por CSS e pulado no código. A regra dita do chefe vem de `regraDaFase(fase, alvo)`: na Cidade Neon não há cabos, e dizer "ele vai cortar os cabos" ali seria mentira.
6. **Nenhuma condição de derrota nova:** o transformador apagado derruba as zonas e a luz, não a missão (o núcleo da praia é que a perde). A missão padrão fica mais exigente; o equilíbrio jogando é pendência.

**Por que registrar:** quem for levar o circuito ao Bunker, à Bandeira e ao Domínio, ou equilibrar a missão, precisa saber que a instância é por mapa, que o escurecimento é de cores registradas e que o Colossus é solto quando o quadro cai.

## [2026-10-17] A Colossus em três fases, a barra do chefe e a máscara (Claude, P165, P147)

**Ordem:** a parte D do capítulo 1 ("CONTINUA SEGUINDO A PARTE B, C e a D") e a máscara da Colossus V1 só como chefe (P165).

**Decisões:**
1. **As fases saem do dano por parte que já existe**, não de um sistema novo: `faseDoChefe` lê a vida das pernas e do tronco (anda, manca, rasteja, caiu). Uma regra só (G14), pura e testável.
2. **Só o chefe rasteja** (`MechBase.crawls`, 30% da velocidade): num Mech comum, perna destruída segue como torre imóvel, que é a regra de equilíbrio de sempre. O rastejo é o que faz "pernas caídas" virar **outra luta** em vez de fim de luta.
3. **O alvo do titã é o cabo mais perto ainda de pé**, e com os três cortados a porta principal. **O jogador pode kitar** (afastar o titã dos cabos atirando e correndo): fica permitido, é estratégia, e o rastejo a 30% a torna viável.
4. **A máscara é 1,3× a cabeça e desligável (`?mascara=0`)**: a caricatura de figura pública é sátira política que o Comandante pediu, e o **risco jurídico e de plataforma** segue registrado (`CAMPANHAS_E_CHEFES.md` § 0). O botão de desligar é o que protege o jogo se uma loja reclamar. Só desenho: não toca colisão, vida nem arma.
5. **A barra do chefe diz a regra da fase numa linha**: o jogador entende o problema sem ler manual.

**Por que registrar:** quem for equilibrar o chefe (vida, 30% do rastejo, peso 4 nos cabos são linhas de tabela) ou levar a missão para a rede precisa saber que a fase é derivada do dano e que o rastejo é só do chefe.

## [2026-10-17] Entrega só conta quando o dono a acha: o idioma e a conta vão para o canto da primeira tela (Claude, P176)

**Ordem:** *"nao achei o arpao no hangar, nem a mudança das linguas, nem login"*.

**Decisões:**
1. **Antes de mexer, conferir o que um visitante vê** (navegador de verdade no site de produção, não o repositório): estava tudo no ar. O defeito era de **descoberta**, não de entrega. Registrado porque a regra 16 do `AGENTS.md` ("toda entrega visível fecha com o caminho para vê-la") foi cumprida no papel (o caminho estava no PR) e falhou na prática: o caminho tinha quatro passos, e o primeiro acesso é de propósito uma tela de uma ação só.
2. **Idioma e conta vão para o canto da primeira tela e da pausa, discretos** (um seletor e um botão pequenos): não quebram o princípio de "uma ação primária por tela" (`AUDITORIA_INTERFACE.md`), porque não competem com *CLIQUE PARA JOGAR*. O princípio "nada de porta" (`RANKING_E_LOGIN.md` § 1) segue: o botão **[ CONTA ]** só abre um bloco opcional.
3. **Dois seletores de idioma, uma escolha:** o conjunto de seletores é do módulo de idioma, então qualquer lugar novo que queira o seletor só chama `ligarSeletorIdioma`.
4. **O arpão não ganhou atalho:** só o Marauder tem ombros (regra de chassi, P77); mudar isso é decisão de design do Comandante, não conserto de visibilidade. Fica como falta declarada.

## [2026-10-17] Os bots atiram o laser e a cadência de conteúdo vira número no painel (Claude, P175)

**Ordem:** as pendências abertas recentes (a P160 deixou "os bots usarem as armas novas"; a P171 pediu "contar conteúdo como se conta código").

**Decisões:**
1. **O bot reaproveita `Match.beamPulse`, não ganha um raio próprio:** uma regra só (G14) para jogador e bot, e no servidor o pulso do bot já vira evento de tiro (`onBeam`). A opção é `pulso` do `BotSystem`, **separada dos `launchers`**: `explosivos: false` desliga o míssil, não o laser.
2. **O laser entra como arma de energia do bot, na cadência dela**, sem o "segurar o gatilho" do jogador: o calor e a pausa da IA já cortam a rajada. Não houve ajuste de equilíbrio (o dano por pulso, 6, cai com a distância e o bot erra a mira da dificuldade).
3. **O arpão não é arma de bot:** só há ombros no Marauder, e o bot não os tem. Fica declarado.
4. **O ritmo de conteúdo mede o que é inequívoco: arma e chassi** (ids do código, datas do git). Mapas, pilotos e eventos ainda não entram (não há lista no código para ler). A média usa as quatro **últimas semanas completas** (a corrente fica de fora: senão ela sempre puxaria a média para baixo).
5. **D7 e DAU/MAU não foram feitos de propósito:** exigem guardar um id por visitante, que é decisão de privacidade do Comandante (LGPD), não de engenharia.

## [2026-10-17] O login do jogador: a conta guarda o progresso do navegador, sem porta e sem id local (Claude, P174)

**Ordem:** *"concluamos sobre o LOGIN"* (camada C3 do `RANKING_E_LOGIN.md`).

**Decisões:**
1. **Sem "id local" aleatório, como o plano previa:** o navegador **já é** a fonte do que ele guardava (nível, créditos, apelido, montagem); a conta é uma **cópia** que o alcança. Um id a mais não resolveria nada e criaria um segundo estado para sincronizar.
2. **A junção é "quem tem mais progresso vence por inteiro"** (nível, depois XP; empate, o último a gravar), com o apelido e a montagem do outro cobrindo os vazios. Somar créditos dos dois lados dobraria o ganho de quem joga em dois aparelhos; o plano diz "não perde nada", e perder o ganho do lado menor é o preço de não permitir esse dobro. A regra é uma função pura testada.
3. **Rede nunca é requisito:** falha de rede não trava nem apaga nada, o token **não** é apagado quando o servidor não responde (sessão vencida e rede fora são indistinguíveis para o cliente), e **sair não apaga o progresso do aparelho**.
4. **O progresso da conta é conforto, não verdade:** não vale para ranking (G13: só o servidor autoritativo pontua o global); quem adulterar só adultera a própria conta. Por isso o servidor valida a **forma** e os limites, não a "legitimidade".
5. **Token por servidor** (como o do admin): um link com `?servidor=` de terceiros nunca recebe o token guardado.
6. **Só nas Configurações, por ora:** o princípio é "nada de porta" (`RANKING_E_LOGIN.md` § 1); o convite depois da primeira partida fica como próximo passo, para não ser feito sem o olho do Comandante.
7. **R17 (achado):** `/conta/eu` nunca respondeu ao preflight do CORS; corrigido junto, porque a rota nova depende da mesma coisa.

## [2026-10-17] O arpão magnético volta, refeito sobre a main de hoje (Claude, P77 parte 3)

**Ordem:** P77 (11/10): *"VARIAR as armas e tecnologias"* nos ombros; o arpão estava num porte de 12/10 que nunca entrou.

**Decisões:**
1. **Não cherry-pick:** o WIP de 12/10 conflitava em ~20 arquivos com a `main`; foi reaplicado à mão só o que valia (a regra `HookSystem`, o modelo) sobre a `main` de hoje, com os ganchos novos (`weaponLook`, `dicasDeArma`, `fireFeel`, `muzzleFx`, `impactFx`: tabelas que obrigam uma linha por arma).
2. **Tiro de varredura, não projétil:** um raio de 45 m (58,5 no MK III: a faixa curta não muda com o nível, `calibragem.test.ts`), como o laser; o cabo é estado do `HookSystem` (pool de 8), não uma entidade física. Barato (um raycast a cada 4 s) e determinístico.
3. **Só o servidor e o jogo offline puxam:** o cliente online só desenha o raio (G14); o puxão chega pelo estado do robô. Por isso o cabo preso de outro jogador **não** é desenhado no online (declarado como falta).
4. **O contrajogo faz parte da arma:** dash corta, parede solta, o Colossus arrebenta o cabo (`breakRadius`), o alvo que foge estoura (125% do alcance). Sem isso o arpão seria "perdeu o controle do robô"; com isso é uma troca (um aperto a cada 4 s por juntar o inimigo).
5. **Dano baixo de propósito (10, 2,5 por s):** o arpão junta, não mata; o valor está nas outras armas de ombro (sônica, fogo, granada, foguete).
6. **Protocolo 20, no fim de `NET_WEAPONS`** (índices antigos intactos); um cliente 19 recusaria o tiro.

## [2026-10-17] O jogo ganha sete línguas, com o português como texto de origem (Claude, P173)

**Ordem:** colocar já o inglês, o japonês, o espanhol, o francês, o chinês e o russo (resposta à P171 (b)).

**Decisões:**
1. **O português fica no código e no HTML; as outras línguas são dicionários JSON** em `client/public/locales/`. Nenhum módulo de interface sabe de idioma (G3), nenhuma chave artificial para manter, e o texto novo nasce em português como sempre. JSON em `public/` e não módulo, porque o teto de JS (500 KB gz, ~480 hoje) não comporta seis dicionários e porque só baixa quem escolheu a língua.
2. **Tradutor de DOM com observador, não `t()` em cada arquivo:** o jogo escreve texto em dezenas de lugares (`textContent`); o observador pega todos sem tocar neles, e a troca de língua é ao vivo (cada nó guarda o original). O custo é só fora do português. `t()` existe para o código que monta texto na mão.
3. **Chaves com lacuna `{n}`** para o que o jogo preenche (número, nome), a tradução reordena; o valor da lacuna também é traduzido (uma volta), para `VENCEDOR: AZUL` virar `WINNER: BLUE`.
4. **Detecção pela língua do navegador só fora de navegador de teste** (`navigator.webdriver`): o smoke e as bancadas comparam textos em português; a escolha explícita (`?lang=`, seletor) vale sempre. Quem tem o navegador em inglês já abre em inglês (o alvo da P171: EUA, Japão, Alemanha, Coreia, Reino Unido).
5. **A cobertura é do teste:** arma nova, rótulo novo de configuração ou texto novo no `index.html` sem tradução **quebram o `npm test`**; é o que impede o dicionário de apodrecer.
6. **Fora do alcance, declarado:** voz do narrador, canvas, fichas do Hangar, a landing; alemão e coreano (os outros mercados da reportagem) ficam como o próximo passo barato (é só um JSON novo).

## [2026-10-17] O porto: os rebeldes nascem nos contêineres, e o quadro de luz liga a cidade às zonas de cura (Claude, P163, P164)

**Situação:** o Comandante pediu que os inimigos saíssem dos contêineres do porto ("bem explícito") e um sistema no porto, a proteger, que acende as luzes da cidade, repetível nas outras fases.

**Decisões:**
1. **Os contêineres de desembarque ocupam vagas do pátio do cais, três em vez de quatro:** a fileira z = 0 tem o farol de 38 m do lado da boca, e a de trás (z = -64) tem as pernas do guindaste; a sonda do terreno e o teste de folga acharam os dois (os 6 pontos de nascimento antigos eram na areia, em chão plano; os novos são no cais, uma laje no nível do chão, e o teste de nascimento passou a medir a folga só em relação ao que passa da altura do joelho). Cada boca solta duas levas (os Mechs na porta, os andróides 3 m à frente).
2. **O nascimento mudou da areia (~200 m da estação) para o cais (>460 m):** é mudança de **ritmo** assumida: os manifestantes (que nascem na avenida e na rua dos fundos) chegam em poucos segundos e as máquinas ~45 s depois. O Colossus fica na avenida até a parte D.
3. **O quadro de luz fica a mais de 500 m da estação, de propósito:** defender os dois não cabe no mesmo jogador, e **o saboteiro** (o primeiro andróide vivo da onda 2 em diante) é o único rebelde que vai para lá. **Ele tem consequência real:** a energia multiplica as luzes (o ciclo do dia manda quantas acenderiam) e, **apagado, derruba as zonas de cura e de resfriamento** (`ZoneSystem.energizadas`): a luz da cidade é o que cura o jogador.
4. **O circuito é uma regra pura repetível** (`QuadroDeLuz`: vida, depredador, defensor, energia): o quadro do banco e o transformador do datacenter são a mesma regra com outra peça.
5. **Lição de teste:** `damage: false` no `Match` desliga também o `crush` (não mata ninguém); o dano de sobra para apagar o quadro precisa de um `dt` grande (um passo de 1 s a 10 de peso tira só 60 de 240); e a mutação "o saboteiro aparece já na onda 1" foi escrita por mim para provar que a onda 1 fica só nos cabos.

**Por que registrar:** quem fizer a parte D (a Colossus) precisa saber que o nascimento agora é no cais e o chefe ainda não, que o quadro liga a cidade às zonas, e que o ritmo das ondas mudou de propósito.

## [2026-10-17] O manifestante é um andróide mais fraco no mesmo pool, as portas são regra pura, e só a praia pede manifestantes (Claude, P163, P166)

**Situação:** o Comandante pediu a invasão do prédio por **duas entradas** e os manifestantes dos eventos reais como NPC.

**Decisões:**
1. **O manifestante é uma variante do `Android`** (`tool: 'bandeira'`, `MANIFESTANTE_STATS`), **não uma entidade nova nem uma multidão sem física**: reaproveita o cérebro corpo a corpo, o tiro, o dano por parte, o placar e os testes de partida. O preço, dito: o pool da missão soma **13 personagens**, mais que os **8 character controllers** que o G11 pede para uma sala. Vale **offline**; **a missão online terá de caber no teto** (ou o manifestante vira agente leve sem controller).
2. **Sem arma de fogo, sem rosto:** a "arma" é a pancada de bandeira (**metade** da motosserra, o mesmo `WeaponStats` com `damage: 2`), e o desenho é genérico (pele, boné e camisa amarela, bandeira verde com losango): ninguém é retratado.
3. **As portas são a mesma ideia dos cabos** (regra pura em `sim/`, o `Match` só conta quem está perto): vida, dano por presença com peso por tipo, conserto de quem defende, **dreno da rede quando arrombada**. Porta forçada **não se recompõe sozinha**, de propósito: é preciso ir lá.
4. **Cada vaga do pool de manifestantes tem o alvo dela** (a vaga decide o lado de onde nasce: avenida ou rua dos fundos), e não a posição de quem está vivo: o grupo dos fundos vai à porta dos fundos sempre, sem atravessar o complexo.
5. **O plano da onda só vale com o pool**: `totalDaOnda(plano, comManifestantes)`. A Arena e o Bunker têm o mesmo plano de ondas e **não** têm manifestantes; sem isto o `Match` da Arena lançava "Pool da missão não cobre o plano da onda" (o teste existente pegou).
6. **Lição de teste:** com o jogador longe, os rebeldes da onda zeram a rede da estação em ~48 s e a missão **acaba** (os bots são desativados) antes de uma porta ceder. Teste de porta mantém a rede cheia a cada segundo, e o dreno das portas é medido **sem os invasores** e **sem os cabos já tomados** (o primeiro teste dele passava só com o dreno dos invasores: a mutação "as portas não entram no dreno" escapou até ele ser reforçado).

**Por que registrar:** quem for fazer a parte C (o porto) e a D (a Colossus), ou levar a missão para a rede, precisa saber que o manifestante divide o pool dos andróides, quem decide o alvo de cada vaga e que o teto de personagens está estourado de propósito offline.

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
