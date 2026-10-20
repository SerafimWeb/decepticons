# O CAMINHO ATÉ O LANÇAMENTO — 2 a 3 missões prontas, offline e online, co-op ou competitivo (19/10/2026, P224)

> **A ordem do Comandante (19/10):** *"QUERO CONCLUIR O PROJETO!!! ou pelo menos concluir até um certo ponto, suficiente pra lançar com **2 ou 3 missões finalizadas disponíveis no offline e no online**, que possam ser jogadas **co-op ou competitivo**."* Este documento **substitui o escopo de 18/10** (`LANCAMENTO.md` § 1: só Cidade Neon e Estação dos Cabos, só Deathmatch online) **no que ele diz sobre missões**; o que `LANCAMENTO.md` diz sobre **segurança, privilégio, auditoria, servidor e política continua valendo** (§ 5 abaixo).
> **Honestidade (R13):** os estados abaixo vêm de `STATUS_REAL.md`, do código e dos testes de hoje; os **tamanhos são estimativas** (um "PR" é uma entrega de ~400 linhas, regra 19-e); **não vi** nenhuma missão ser jogada por dois humanos ao mesmo tempo num servidor de verdade.

## 1. O que existe hoje, por missão e por modo

| Missão (mapa) | Offline | Online hoje | O que falta para o online |
|---|---|---|---|
| **CIDADE NEON** | **Deathmatch, Sobrevivência (6 ondas, o chefe Colossus, o transformador do banco), Bandeira (CTF), Domínio**: REAIS | **só o Deathmatch** (humanos + bots, qualquer mapa: etapa O1, 19/10) | Sobrevivência, Bandeira e Domínio **não viajam na rede** (`MULTIPLAYER.md` § 12: O2 a O4) |
| **ESTAÇÃO DOS CABOS** (a Praia) | **Deathmatch e a Sobrevivência com objetivo** (os cabos, as duas portas do prédio, os manifestantes, o quadro de luz, o dia que vira noite): REAIS | só o Deathmatch | a Sobrevivência online (O4) |
| **TERRAS RARAS** (a Amazônia) | **Deathmatch e a missão do rio** (o Draga-01, os geradores do escudo, a escotilha, o posto avançado, o objetivo na tela): REAIS | só o Deathmatch | a missão online (O4) e o chefe na rede |
| **8 DE JANEIRO** (a Praça) | só o **mapa** (Deathmatch): a **missão não existe** | o mapa no Deathmatch | tudo (§ 3) |
| **BUNKER** | Deathmatch | Deathmatch | nada (treino); fica fechado |

**Competitivo online que já existe:** o **Deathmatch** (todos contra todos + bots) nos quatro mapas. **Co-op online que já existe:** nenhum (os humanos de uma sala jogam contra os bots do Deathmatch, mas não há missão com objetivo). **Times na sala (dois amigos do mesmo lado):** não existe (P81, congelado).

## 2. A proposta: as 3 missões do lançamento e o jeito mais curto de chegar nelas

**Princípio:** o que já é REAL offline vira online **por um único caminho** (a sala do servidor roda o mesmo `Match` em modo missão e manda ao cliente só o que a tela precisa), em vez de refazer cada missão. Por isso **a primeira peça é a Sobrevivência online (O4)**: ela destrava as três missões de uma vez.

| # | Missão do lançamento | Por quê | Modo online |
|---|---|---|---|
| **1** | **ESTAÇÃO DOS CABOS: a defesa da estação** | a mais completa (objetivo, portas, cabos, dia e noite); já é **livre** no escopo de 18/10 | **Co-op** (2 a 4 pilotos contra as ondas) |
| **2** | **CIDADE NEON: a Sobrevivência com o chefe + o Deathmatch e a Bandeira** | a base do jogo; dá o **competitivo** (Bandeira 2v2, Deathmatch) e o co-op | **Co-op** (ondas e chefe) **e competitivo** (Deathmatch hoje; Bandeira depois) |
| **3** | **8 DE JANEIRO: a defesa dos três poderes (não letal)** *ou* **TERRAS RARAS** | a mais **nova e mais viva** (a multidão, as armas não letais), mas com **risco jurídico e de plataforma** (a ficha de cenário, § 9); a TERRAS RARAS é a alternativa **pronta** | **Co-op** |

**Recomendação:** lançar com **1 + 2 + (TERRAS RARAS)** e **abrir o 8 DE JANEIRO depois da revisão jurídica**, como **a quarta missão** (anúncio). Se o Comandante quiser o 8 DE JANEIRO no lançamento, o caminho é o da § 3 e **a revisão de um advogado vem antes**.

### Os pacotes de trabalho (cada um ≈ 1 PR; a ordem importa)

| Pacote | O que entrega | Pronto quando | Quem |
|---|---|---|---|
| **A1. Co-op: humanos do mesmo lado** | numa sala de missão os pilotos são **aliados** (sem fogo amigo, a rodada vale para todos) | teste de sala: dois humanos não se ferem; um bot ferido por qualquer um deles conta | Claude |
| **A2. Sobrevivência online (O4a)** | a sala roda `Match` em modo `survival`; o servidor manda as **ondas** (número, restantes), o **fim** (vitória e derrota, com o placar) e os **bots da onda** no roster; o cliente mostra o HUD da missão e o painel do fim | dois navegadores jogam as seis ondas da Cidade Neon; o servidor sobrevive a uma sala cheia (G11: ≤ 8 KB/s por jogador, medido) | Claude |
| **A3. Os objetivos da missão na rede (O4b)** | os **cabos**, as **portas**, o **quadro de luz**, o **chefe** e o **dia/noite** da Estação dos Cabos e da Cidade Neon chegam ao cliente como eventos | a Estação dos Cabos jogada por dois navegadores até o fim | Claude |
| **A4. Bandeira online (O3)** | as duas bandeiras, os times e as capturas na sala | 2 contra 2 jogados até 3 capturas | Claude |
| **A5. Domínio online (O2)** (se couber) | os cinco pontos A a E na sala | opcional no lançamento | Claude |
| **A6. Campanha online (O5)** | **fora do lançamento** (a campanha é offline) | — | — |
| **A7. TERRAS RARAS online** | o Draga-01 e a defesa dele na rede (o chefe é o mais pesado) | uma sala da Terras Raras jogada por dois, medida no PC do servidor | Claude |

**Estimativa grossa:** A1 + A2 ≈ 2 a 3 PRs; A3 ≈ 2 PRs; A4 ≈ 2 PRs; A7 ≈ 2 PRs. **Total ≈ 9 a 11 PRs** para 3 missões co-op + a Bandeira competitiva + o Deathmatch, **sem** o 8 DE JANEIRO.

## 3. A missão do 8 DE JANEIRO (se entrar): o que falta

O **mapa** (compacto, com os saguões que o Mech não atravessa), a **multidão** (a simulação e o desenho) e a **ficha de fatos** existem. **Falta a missão** (`fichas/cenario-8-de-janeiro.md` § 6, passo 5):
1. **A multidão no jogo:** o `Match` cria a `Multidao`, a anda a cada tick, e **liga os efeitos das armas** (o tiro, a explosão, o susto por perto, o **canhão sônico**) a ela. *(≈ 1 PR)*
2. **A arma de gás** (a nova, não letal: uma nuvem que faz os humanos fugirem, e não afeta androide). É **uma arma de verdade** (`ARSENAL.md`: dados, regra no tick, Hangar, desenho, **rede**, protocolo +1). *(≈ 2 PRs)*
3. **A regra da missão** (`sim/MissaoJaneiro`): a integridade dos três prédios, a **sujeira nas mesas** e os androides faxineiros, os **androides rebeldes ("kids pretos")**, a vitória e a **nota por não letalidade** (expulsos × eliminados: o jogo mostra que a força é a última saída). *(≈ 2 PRs)*
4. **A tela da missão:** briefing, objetivo no topo, e o **Relatório de Consequências com os fatos e as fontes** (`fichas/fatos-8-de-janeiro.md` § 5). *(≈ 1 PR)*
5. **A missão online** (o co-op, depois do A2): o cronograma (semente) e os eventos `morreu`/`fugiu` (a multidão **não** manda posição: ficha de cenário § 3). *(≈ 1 PR)*
6. **Antes de liberar: a revisão jurídica** e a conferência humana dos fatos nos documentos primários (`fatos-8-de-janeiro.md`, cabeçalho). **Não é código e não anda sem o Comandante.**
**Total ≈ 7 PRs.**

## 4. O que o Comandante ainda precisa pedir ou decidir (a lista curta)

1. **"Qual é a terceira missão do lançamento: TERRAS RARAS ou 8 DE JANEIRO?"** (recomendo TERRAS RARAS no lançamento e o 8 DE JANEIRO como anúncio, § 2).
2. **"Bandeira (competitivo) entra no lançamento?"** (recomendo sim; Domínio fica para depois).
3. **"Co-op de 2 a 4 pilotos por sala"?** (hoje a sala tem 8 vagas; recomendo missões de **até 4**, para a banda e para a dificuldade).
4. **"Onde o servidor de jogo mora?"** O PC de trabalho (6 GB) **não aguenta várias salas de missão** (a Terras Raras é a mais pesada). **Decidir antes do lançamento: uma VPS ou um PC dedicado** (`LANCAMENTO.md` § 2, item 8). *Custo: R$ de uma VPS pequena por mês.*
5. **"Convidar 5 a 10 pessoas para testar"** (`LANCAMENTO.md` item 9): só **depois** do A2.
6. **A revisão jurídica do 8 DE JANEIRO** e a **política de privacidade** (item 10): **um advogado**, de preferência antes do lançamento.
7. **Quando pedir cada coisa:** uma ordem por vez, na ordem dos pacotes (A1 → A2 → A3 → A4 → A7), cada uma com o "pronto quando" da tabela.

## 5. O que **não** é missão e bloqueia o lançamento (`LANCAMENTO.md` continua valendo)

| O quê | Estado | O que falta |
|---|---|---|
| **Acesso ao que é restrito** (o `?comandante=1`) | **hoje é só do navegador** (`consoleData.ts`: "não é segurança"); o **servidor não recusa** um mapa restrito (`?sala=X&mapa=janeiro` abre para qualquer um) | **mudar antes do lançamento**: o link só vale em `localhost` e no build de desenvolvimento; em produção o modo Comandante vem **da conta de administrador** (validada pelo servidor), e o servidor **recusa mapa restrito a quem não é admin**. *(o primeiro passo está neste PR)* |
| Auditoria de segurança, privilégio, auditoria interna | feitas em 18/10 (`AUDITORIA_SEGURANCA.md`, `GOVERNANCA.md`) | reler depois do A2 (rede nova) |
| Servidor fora do PC de trabalho | **aberto** (item 4 acima) | decisão do Comandante |
| O deploy do site | **travado 2 h em 19/10** (o teste do hook, sem `bash` no PATH da tarefa agendada): corrigido no PR do atualizador | conferir que o `publicar-site.log` volta a registrar |
| Voz pública sem mudo nem denúncia; chat de texto restrito | risco aberto (P205/P216) | mudo e denúncia antes de liberar o chat ao público |
| Idade e voz (P211) | feito | — |

## 6. Como saber que "concluímos"

A **definição de pronto do lançamento**: (1) as **3 missões jogadas até o fim por dois humanos em navegadores diferentes**, online, sem queda do servidor; (2) a **Bandeira 2v2** jogada; (3) a **banda** medida (≤ 8 KB/s por jogador) com a sala cheia; (4) **uma sessão de teste com gente de fora** (item 5); (5) o **link `?comandante=1` fechado em produção**; (6) a **política revisada**; (7) o **servidor num lugar que aguenta**. Cada item tem dono e "pronto quando" nas tabelas acima.
