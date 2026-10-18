# LADO E PEDAGOGIA — "de que lado você joga?" e como ensinar sem sermão (P179)

> **Ordem do Comandante (17/10):** *"devemos perguntar se quer jogar pelos aliados antimperialistas, lutando pela justiça social e redistribuição das riquezas, ou se quer fazer campanha para fortalecer o desmatamento, imperialismo e fascismo das elites burguesas. Não temos problema de mapear o nazifascismo (e devemos explicar o que são e como se manifestam, a rede de mentiras, os interesses obtusos por trás das elites, a manutenção do medo, etc) como o maior problema que estamos enfrentando na geopolítica global atualmente (mesmo que não fiquemos citando toda hora, acho importante que pelo menos SUTILMENTE E ELEGANTEMENTE, pedagogicamente mostremos nosso posicionamento político SIM: queremos proteger os direitos dos povos CONTRA a opressão e hegemonia norte-americana; mostrar as violências e mentiras que a mídia comprada pelo capitalismo e a favor dele, mostrar as incoerências do conservadorismo, entre outras problemáticas."*
> **Estado:** desenho escrito por Claude em 17/10. O seletor de lado (camada 1) e o Arquivo (camada 2) estão no jogo; o resto é plano. **Nada do que dependa de fato entra no jogo sem fonte** (§ 5).

## 1. O que isto fixa, em três frases

1. **O jogo pergunta o lado.** Aliança (os povos e a soberania) ou Consórcio (as elites e a extração).
2. **O jogo explica** o que é o fascismo, como ele se manifesta e como funciona a máquina de mentiras e de medo por trás dele, **no ritmo de quem joga**, não em palestra.
3. **O posicionamento é do jogo e é claro** (contra a opressão e a hegemonia imperialista, a favor dos povos), mas o jeito é **sutil, elegante e pedagógico**: o jogador conclui, o jogo mostra.

## 2. O que já está fixado (não se reabre aqui)

| Fixado em | O quê |
|---|---|
| `UNIVERSO.md` § 2-A | somos os **ALIADOS** (o campo anti-imperialista, o BRICS, o Brasil no centro); a guerra é **cognitiva** (desinformação para entregar o país); o tom é **teatral** ("florear" é pedido); **nomes: arquétipos fictícios** (o Império do Norte, o Clã do Mito, o Banco Vorcaris) |
| `CAMPANHAS_E_CHEFES.md` § 0 | o sentido do jogo (P166): lutar contra a hegemonia e contra a **manipulação da opinião pública**; **a regra de redação: sátira exagera, fato é fato** (toda afirmação factual leva fonte em `fichas/`; o que não tem fonte é sátira, dita como sátira) |
| `IDENTITY.md` § 3 | verde = o jogador, vermelho = as IAs: o código inteiro assume. O lado **não** troca as cores do combate |

## 3. A pergunta do lado

### 3.1 As duas respostas

| | **ALIANÇA** (padrão) | **CONSÓRCIO** |
|---|---|---|
| **Quem é** | os povos, a SERAFIM, a Guarda da Floresta, o campo anti-imperialista | as elites extrativistas, as big techs, os "contratos de segurança" |
| **O que busca** | justiça social, redistribuição das riquezas, soberania, os direitos dos povos | a "campanha" do lucro: extração sem limite, desmatamento, hegemonia, o medo como governo |
| **Como o jogo fala dele** | com respeito e sem eufemismo | **com a voz da própria propaganda** (eufemismos: "desenvolvimento", "segurança jurídica", "ordem"), e o jogo mostra **por baixo** o que cada eufemismo esconde |
| **Tom** | direto, de quem protege | **sátira corporativa**: o jogador ouve o discurso e vê o custo |

### 3.2 Quando perguntar (a trava: "nada de porta")

O Comandante já decidiu (15/10, P133) que o primeiro acesso **cai numa partida**, sem formulário. A pergunta do lado **não** é uma porta:

1. **Depois da primeira rodada** (o jogador já jogou e, se gostou, quer ir além): um painel "ESCOLHA SEU LADO", **uma vez**, fácil de fechar (o padrão fica Aliança).
2. **A qualquer hora**, no console completo e na pausa: o selo **LADO** (muda a escolha; pisca discreto enquanto não há escolha). *É o que está no ar; a pergunta automática depois da primeira rodada é a decisão § 7.6.*
3. **No começo de uma campanha** (a Amazônia, `CAMPANHAS_E_CHEFES.md`): onde o lado **muda o que se faz** (§ 3.3).

### 3.3 O que o lado muda, em camadas (cada uma é um PR e entrega algo sozinha)

| Camada | O que muda | Estado |
|---|---|---|
| **1 · o lado existe** | a escolha é guardada (`cybermech.lado.v1`), aparece no selo LADO do console e da pausa, e o painel do Consórcio mostra **o discurso e o custo** (sátira dos eufemismos). **Ainda não muda o combate nem os textos das missões** | **no jogo, como DEMO** (o seletor, as duas respostas e o painel do custo) |
| **2 · o Arquivo** | a tela opcional que ensina (§ 4) | **no jogo (17/10):** o chip ARQUIVO no console e na pausa; seis fichas em `client/public/arquivo/<língua>.json` (sete línguas); texto **a conferir por revisor humano** |
| **3 · o Relatório de Consequências** | o fim da missão mostra o que aconteceu com o rio, com os povos, com a água, com **números lidos de ficha** | plano |
| **4 · a campanha do Consórcio** | os **objetivos invertem**: na Amazônia, a Aliança **invade** a mineradora; o Consórcio **defende** o perímetro (mesmo mapa, outra missão) | plano (`fichas/cenario-amazonas.md`) |

### 3.5 A assimetria jogável dos lados (a ideia do Comandante de 17/10, P186): camada 5

**A ideia, nas palavras dele (resumo fiel):** na seleção do time o jogador escolhe **ALIADOS** (flexíveis e com benefícios técnicos no campo: o Hangar inteiro, **conquistam recursos**, e **a arma mais poderosa do jogo é deles**, que **se recarrega com os restos de batalha**, coletados e transformados em munição por **humanoides** de cada time) ou **CONSÓRCIO** (financiado por megacorporações, militares e elites: **chassis fechados e padronizados**, **sem trocar arma nem equipar**, poucos benefícios no campo, **recursos ilimitados**).

| | **ALIADOS** | **CONSÓRCIO** |
|---|---|---|
| **Máquina** | o Hangar aberto: qualquer chassi, qualquer arma, montagem salva | **uma lista curta de chassis padronizados**, cada um com a arma de fábrica; o Hangar fica trancado |
| **Recursos** | **conquistados** no campo (pontos, zonas, o que se coleta) | **ilimitados**: reposição e reaparecimento sem custo |
| **Munição** | a **melhor linha de armas**, que **se recarrega com os restos de batalha** (destroços); **humanoides** coletam e produzem a munição do time | munição de fábrica, sem coleta: simples e constante |
| **Benefícios no campo** | técnicos (flexibilidade, a arma que se recarrega) | poucos: a vantagem é **volume e reposição** |
| **Papel de equipe** | os humanoides (androides) viram **logística**: coletar destroços e produzir munição **é um trabalho de alguém do time** | os androides são **infantaria/ruído** (sem logística) |

**Por que a ideia é boa:** é uma **assimetria com identidade** (os povos são engenhosos e frágeis; as elites são padronizadas e fartas) que **ensina pela jogabilidade** o que o Arquivo ensina por texto (§ 4), e dá ao Aliado um papel de apoio que **ainda não existe** (os androides coletores). **O que ela exige que ainda não existe:** (1) **times na sala online** (P81: time no JOIN e no roster, fogo amigo, HUD de time); (2) **uma lista de chassis fechados** e o **Hangar trancado por lado** (o contrato do `loadout` já valida a montagem: a trava é uma regra a mais ali, no servidor); (3) **uma economia de recursos** (placar de recursos do time, o que se conquista, o que se gasta) e **a munição de destroços** (um tipo de arma com o carregador ligado a um **estoque do time**, e o androide coletor/fábrica); (4) **o equilíbrio**: a assimetria só vale se as duas pontas ganham partidas.

**Os riscos (a franqueza que o Comandante pede):**
1. **Tamanho:** são três sistemas novos (times, economia, munição coletada) ao mesmo tempo, **antes do primeiro lançamento**. O online que existe (todos contra todos na mesma sala) já funciona; a assimetria é a **segunda onda**.
2. **Equilíbrio:** "ilimitado" contra "melhor arma" é a conta mais difícil do jogo; **sem medida de partida real** (e as métricas, P185) o número será chute. Recomendo **começar pelo Consórcio como o lado simples** e deixar a economia dos Aliados para depois.
3. **A tentação do "pay to win" invertido:** o lado com a melhor arma exige **mais coordenação** (a logística); isso precisa **ser divertido** (o papel do coletor), e não uma tarefa chata que o time empurra para o mais novo.
4. **Matchmaking:** lados assimétricos pedem **vagas por lado** (quantos Aliados e quantos do Consórcio na sala de 8) e uma regra para quando um lado está vazio (bots).

**A ordem que eu proponho (cada degrau entrega algo sozinho):**
1. **Times na sala online (P81)**, com o lado como **rótulo de time**: Aliados × Consórcio na mesma sala, cores e placar, **sem nada de economia**. É o que **destrava** o CTF 2v2 online e dá o contrato de rede de que o resto depende.
2. **O Consórcio padronizado:** a lista curta de chassis fechados e o Hangar trancado para ele (a regra no servidor, com teste). Aliados seguem como hoje.
3. **A munição de destroços** e o **androide coletor** (a arma que se recarrega, o estoque do time, a produção), com os recursos do Aliado.
4. **O equilíbrio com dados** (as métricas por lado, P185): corrigir os números com partidas reais.

**O nome "Consórcio" (o Comandante não tem certeza):** o texto do jogo (seis línguas, o Arquivo, os painéis) **já usa "Consórcio"**, então trocar depois custa uma rodada de tradução. Alternativas, todas arquétipos fictícios (a regra do § 3.4): **"o Conglomerado"** (mais seco, menos eufemístico), **"a Diretoria"** (sátira corporativa pura), **"o Protocolo"** (frio, militar: "Protocolo de Segurança"), **"o Contrato"** (os "contratos de segurança" do § 3.1). **Recomendação:** manter "Consórcio" no lançamento (já existe, funciona nas sete línguas) e **testar o nome com jogadores** antes de trocar; a troca é só texto e um arquivo de traduções.

### 3.4 As regras que protegem a ideia (e o produto)

1. **Escolher o Consórcio nunca é premiado em silêncio.** A vitória do Consórcio existe (o jogo não é manipulador às avessas), e **o custo também**: o Relatório de Consequências mostra o rio, as pessoas e o que o discurso escondia. É pedagogia por **contraste**.
2. **Violência é Mech × Mech e andróide**, como o jogo inteiro. **Nunca** cena de violência contra civis ou povos desarmados; o povo aparece **como protagonista** (a Guarda da Floresta defende; ninguém é só vítima passiva).
3. **Sem símbolos reais do nazismo ou do fascismo.** O fascismo aparece **por mecanismo e por arquétipo** (o culto ao líder, o inimigo inventado, a mentira como método), não por suástica: é mais inteligente (a gente mostra **como funciona**), e as lojas e algumas leis proíbem o uso desses símbolos. Conferir as regras do portal escolhido antes do lançamento (`UNIVERSO.md` § 6).
4. **Nomes: arquétipos fictícios** (decisão #9 do `UNIVERSO.md`, reconfirmada na P147): "o Consórcio", "o Império do Norte", "a Rede Verdade Plena" (a mídia). Se o Comandante quiser nomes reais no jogo, **a decisão é dele**, e a regra de fonte (§ 5) passa a pesar muito mais.
5. **Sutil quer dizer:** nenhuma partida é interrompida por sermão. O ensino mora **entre** as partidas (carregamento, rádio, fim de missão, Arquivo opcional).

## 4. O que ensinar: o Arquivo (camada 2)

Cada tema é uma **ficha curta com fonte** em três linhas: **o que é** (uma frase), **como aparece** (os sinais), **como se defender** (a *contramedida*, na língua de CTI do jogo: o jogador aprende a reconhecer e a agir). Seis temas para começar:

| # | Tema | O que a ficha mostra | Estado da ficha |
|---|---|---|---|
| 1 | **O fascismo: o que é e como se manifesta** | as características que os estudiosos descrevem (culto ao passado mítico, propaganda, desprezo pela verdade e pela ciência, o inimigo interno inventado, a hierarquia, a vitimização, a "lei e ordem", o ataque à imprensa e às universidades, a aliança com o grande capital) | `fichas/fascismo-e-propaganda.md` (escrita) |
| 2 | **A rede de mentiras** | a cadeia: quem paga → a agência → o influenciador → a rede de contas → a manchete; os sinais (origem, repetição coordenada, urgência emocional) | ficha com a cadeia (escrita); casos reais ficam **para o Comandante dar a fonte** |
| 3 | **Quem lucra** | os interesses por trás das elites (extração, rentismo, big tech, armas): "siga o dinheiro" | a estrutura está escrita; **os números pedem fonte** |
| 4 | **A manutenção do medo** | o inimigo interno fabricado, o pânico moral, a segurança como espetáculo, o desvio do olhar do bolso | escrita (mecanismo) |
| 5 | **A mídia comprada** | propriedade concentrada, publicidade como pressão, notícia × opinião × propaganda | mecanismo escrito; **casos nomeados só com fonte** |
| 6 | **As incoerências** | **sátira declarada**: os arquétipos (o "patriota" que vende o país, o "contra o Estado" que vive de isenção, o "defensor da vida" que corta a saúde) | sátira; **sem afirmação factual**, só o espelho |

**Como entregar, sem sermão:** (a) as **dicas do carregamento**, no formato "contramedida"; (b) o **rádio do SOC** (a voz da base nas missões); (c) o **fim de missão** (Relatório de Consequências); (d) o **Arquivo** na pausa, opcional; (e) os **chefes** como personificações (o Mito de Vidro já é um, P147/P166).

## 5. A regra de redação (a que já vale)

**Sátira exagera, fato é fato** (`CAMPANHAS_E_CHEFES.md` § 0). Toda afirmação factual do jogo (Arquivo, rádio, cartões, relatório) leva **uma fonte na ficha**; sem fonte, vira **sátira dita como sátira** ou não entra. As fichas ficam em `fichas/` e o teste de conteúdo (a fazer) confere que **todo texto de fato aponta uma ficha com fonte**. Os números de desmatamento, mercúrio e contaminação **não estão escritos aqui de propósito**: entram com a fonte (INPE/PRODES, MapBiomas, Fiocruz, ministérios) quando o Comandante autorizar a ficha.

## 6. A ordem de construção (um PR por degrau)

1. ✅ **O seletor de lado** (camada 1) e o painel de consequências do Consórcio (texto). *Entregue em 17/10, P179.*
2. ✅ **O Arquivo**: a tela e as seis fichas (§ 4). *Entregue em 17/10, P179. Os textos pedem revisão do Comandante e a conferência das fontes.*
3. **O Relatório de Consequências** no fim das missões.
4. **A campanha do Consórcio** na Amazônia (objetivos invertidos), depois que o cenário existir (`fichas/cenario-amazonas.md`).
5. **A assimetria jogável dos lados** (§ 3.5, P186): primeiro os times na sala online (P81), depois o Consórcio padronizado, depois a economia e a munição de destroços dos Aliados.

## 7. O que só o Comandante decide

1. **Os nomes reais no jogo** (ou só arquétipos: a recomendação). Muda o peso da regra de fonte e o risco nas lojas.
2. **O quanto o Consórcio é jogável:** só um capítulo (a Amazônia, invertida) ou uma campanha inteira? A recomendação: **um capítulo**, para o contraste valer sem virar um jogo de ser vilão.
3. **O Arquivo é opcional (recomendado) ou aparece sozinho** depois de cada missão? O princípio é "nada de porta".
4. **Quem revisa os textos de fato** (você, ou uma pessoa de fora do jogo) antes de irem ao ar: a regra de fonte exige **uma segunda leitura**.
6. **A pergunta automática depois da primeira rodada?** Hoje o selo só convida (nada de porta). Se o Comandante quiser a pergunta sozinha após a primeira rodada, é um PR pequeno (o gancho é o fim da rodada), com o custo de interromper a tela de fim de rodada.
5. **Onde o jogo publica** (portais têm regras para conteúdo político, `UNIVERSO.md` § 6): afeta quanto o posicionamento pode ser explícito **no produto** (a landing e o Arquivo podem ser mais diretos que a loja).
