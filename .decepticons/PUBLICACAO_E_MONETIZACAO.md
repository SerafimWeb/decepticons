# PUBLICAÇÃO E MONETIZAÇÃO — onde o jogo aparece e como ele ganha dinheiro

> **Pauta, não escopo aprovado.** Responde a pergunta do Comandante (12/10, ordem **P47**): *"como fazer para
> publicarmos esse jogo no YouTube, ou Steam, ou quais plataformas gratuitas podemos publicar, e como monetizar e
> ganhar grana com o game?"*
> **Não duplica o que já está decidido:** o modelo de receita em etapas está em `IDENTITY.md` § 5; a lista de
> viralização e receita, em `GAME_DESIGN.md` § "VIRALIZAÇÃO E RECEITA"; as frentes de monetização ética e os
> pilares de produto, em `METAGAME.md` § 6 e § 7; o *quando* de cada item, em `DIVERSAO.md` § 8–10 e no
> `ROADMAP.md` `#negocio`. Aqui fica o que faltava: **o comparativo das casas onde o jogo pode morar**, a
> **matemática honesta do dinheiro** e a **ordem com o gatilho de cada etapa**.
> Escrito por Qwen, 2026-10-12. **Nada construído neste PR** — é mapa, e quem escolhe o caminho é o Comandante (§ 7).

---

## 0. A resposta curta

1. **YouTube não publica jogo; publica conteúdo.** É canal de divulgação (§ 4), não casa do jogo. Quem publica de
   verdade: o **site próprio** (no ar), os **portais de jogos web** e o **itch.io** (grátis); Steam e lojas de
   celular **depois**, quando houver gente.
2. **No começo o dinheiro não vem de preço, vem de volume.** Anúncio entre rodadas (site e portal) rende centavos
   por mil visualizações; o dinheiro grande de free-to-play é cosmético — que **só liga com contas**. Cobrar para
   entrar esvazia a sala (decisão de 23/09, `IDENTITY.md` § 5).
3. **O gargalo hoje não é dinheiro, é gente.** O placar do `ORDENS_DO_COMANDO.md` § 6 diz: *"na internet, nenhum
   teste com gente"*, meta "uma sessão com 5 pessoas". **Nenhuma frente de dinheiro liga antes de encher a sala.**

---

## 1. Onde publicar — o que cada casa exige e o que ela dá

| Casa | O que exige | O que dá | Hoje no projeto |
|---|---|---|---|
| **Site próprio** (`selvamkt.com.br/cybermech/`) | — | Controle total, dono do jogador, o case da agência junto | ✅ **No ar**, publicado a cada merge na `main` |
| **Portais de jogos web** (CrazyGames, Poki, GameDistribution, Y8, Newgrounds) | Integrar o **SDK do portal** (anúncio nas pausas), rodar em *iframe*, **jogável sozinho** (sem depender do nosso servidor), sem link externo, celular funcionando | O **tráfego que um multiplayer novo não tem** e receita por anúncio (repartição do portal) | O jogo é leve e **o modo offline com bots já existe** (o portal exige justamente isso). Falta o SDK — item aberto em `ROADMAP` `#negocio` |
| **itch.io** | Só publicar (HTML5 "jogar no navegador") | Casa grátis, público indie/dev, devlog, caixa de apoio; **não traz tráfego sozinho** | Nada feito. É o passo mais barato de todos (horas, não semanas) |
| **Steam** | **Binário desktop** (wrapper Electron/Tauri do nosso cliente — a Steam não roda HTML5 no navegador), **US$ 100 por app** (recuperável), 30% de taxa, página de loja, wishlist e revisão; **venda dentro do jogo tem de passar pela Steam Wallet** (não dá Stripe) | Alcance de PC, crédito de "jogo de verdade", Workshop, comunidade | **Ruim no começo** (decisão de 23/09): cobrar para entrar esvazia as salas. Volta à mesa depois do § 5 etapa 5 |
| **Lojas de celular** (Google Play, App Store) | App empacotado (TWA/Capacitor), conta de desenvolvedor (US$ 25 uma vez / US$ 99 por ano), política de privacidade; conta nova de pessoa física ainda passa por **teste fechado com testadores** (conferir a regra vigente) | O público que joga no celular, que é onde o Brasil está | O jogo **já é jogável no toque** (`P37`, parcial). O embrulho TWA (a própria URL virada app) é o caminho barato |
| **YouTube / Twitch / TikTok** | — | **Não publicam jogo: publicam o vídeo.** São o funil para o jogo e a monetização é de conteúdo (§ 2 e § 4) | `F9` grava gameplay (P44 ✅) e a mesa de vídeo exporta em **paisagem, retrato e quadrado** (P45/P92) |
| **Netflix (Netflix Games)** | **Não há porta de entrada:** ela **licencia** de estúdio — jogo com número e IP próprio — e distribui no app dela, no celular | O modelo dela (**sem anúncio e sem compra dentro do jogo**, incluído na assinatura) é o único grande que **combina com o nosso "nunca pay-to-win"** — e ela paga por licença, não por microtransação | **Interesse declarado pelo Comandante em 12/10.** Alvo de longo prazo: primeiro gente jogando, depois um pitch com número na mão |

**Ordem recomendada:** **site (feito) → itch.io → portais → Steam → celular.** Os dois primeiros são de graça e o
portal é o único que resolve o problema que mata jogo multiplayer novo (não ter com quem jogar). Um detalhe que
muda a ordem: **o portal só aceita jogo que se joga sem servidor** — e nós temos os bots (`P91`), então essa porta
está aberta hoje.

---

## 2. Como o dinheiro entra — as frentes, em ordem de custo para ligar

| Frente | O que falta para ligar | O que dá (honesto) | Depende de |
|---|---|---|---|
| **1. Anúncio entre rodadas** (site e portal) | SDK do portal e/ou inventário próprio; **nunca no meio do combate** (regra de 23/09) | **Centavos a poucos reais por mil visualizações** (faixa do mercado BR, muda por portal e formato — conferir os termos antes de projetar). Com 10 mil sessões/mês dá troco; começa a valer na casa das **centenas de milhares** | Volume de jogadores |
| **2. Cosmético** (pintura, decalque, cor de rastro, kit de silhueta — **nunca atributo**, `METAGAME.md` § 6) | **Contas + pagamento + LGPD + tributo** | Em free-to-play, **~1% paga** e poucos pagam muito. É o dinheiro grande do free-to-play, mas só com base instalada | Contas |
| **3. Passe de temporada** | O cosmético e ritmo de conteúdo | Recorrência; é o item 2 com assinatura de tempo | Cosmético |
| **4. Licença e patrocínio** (skin de marca, hardware, anime de mecha, evento que financia premiação — `METAGAME.md` § 6) | Comunidade visível para ter valor | **Paga mais por menos trabalho quando existe público** — e vira marketing do parceiro | Ter o que mostrar |
| **5. O produto por trás** (a inteligência dos bots e os dados, `DADOS_E_ROBOTICA.md`, `PILOTOS_LLM_E_INTELIGENCIA.md` — P71/P75) | Gravador de voo e curadoria | **Venda B2B**, não ao jogador (treino de humanoides/IA, arena aberta a cérebros de fora) | Decisão do Comandante; nada construído |
| **6. A casa** (SERAFIM WEB / Selva MKT) | Nada além do jogo funcionando | O jogo é **portfólio e prova viva**: o cliente da agência nasce de ver o jogo. E o case *"um estúdio construindo um jogo com quatro IAs"* é palestra, curso e conteúdo vendável | O jogo estar bom |

**O que NÃO fazer** (regras já decididas, repetidas aqui porque é onde a pressa erra): nada de **pay-to-win**
(VISAO/`balance.ts`); nada de **cobrar para entrar**; nada de anúncio **no meio do combate**; nada de **loja antes
de contas**; nada de **Steam antes de gente**.

---

## 3. A matemática honesta (para não criar expectativa errada)

- **YouTube só paga a partir dos limites do Programa de Parceiros** (na casa de 1 000 inscritos + 4 000 horas
  assistidas em 12 meses, ou 10 milhões de visualizações de Shorts em 90 dias; há um degrau menor de apoio dos fãs).
  Traduzindo: **o YouTube é funil, não faturamento** — no primeiro ano ele traz jogador, não dinheiro.
- **Anúncio web:** o pagamento é por mil visualizações e depende do país do espectador e do formato. Brasil paga
  pouco. Trate qualquer projeção como "**conferir nos termos do portal**", nunca como número fechado.
- **Free-to-play:** o dinheiro vem de **muitos gastando pouco e sempre**, não de poucos gastando muito — e por isso
  pressupõe volume. Sem base instalada, cosmético é exercício de estilo.
- **Steam:** os US$ 100 e os 30% não doem; **publicar sem wishlist dói** (o jogo morre invisível na prateleira).
- **A conclusão desconfortável:** o trabalho que faz dinheiro hoje é o que **enche a sala e traz o jogador de volta
  amanhã** (retenção D1, `GAME_DESIGN.md`). É o mesmo trabalho que a `QUIMICA_DO_JOGO.md` § 5 aponta (o nível que
  não sobe, o recorde que não é salvo, a missão que não progride).

---

## 4. Viralizar — o que já existe e o que falta (`DIVERSAO.md` § 8: dois vírus, mais um)

| Vírus | Já existe | Falta (e o dono) |
|---|---|---|
| **1. O convite** (o link) | Link de sala com código e **link de build** (`?build=v1.vector09.plasma-2`) — os dois no ar | **O motivo de mandar:** o **recibo da partida como imagem** e o **código curto de build** (`CM-V9-SNIPER`), `METAGAME.md` § 4 — tela (Gemini), dado (Claude) |
| **2. O clipe** (o vídeo) | Física clipável de sobra (perna voando, carcaça detonando, superaquecimento na hora errada); `F9` grava; a **mesa de vídeo** edita e exporta em 9:16, 1:1 e 16:9 | **Killcam no PvP** (decisão do Comandante já registrada em `DIVERSAO.md` § 10), **grampo automático dos últimos 10 s** em 9:16, e **espectador / modo streamer** (P26 — a casa do cast e da live; uma peça serve aos três) |
| **3. O processo** (o mais exclusivo) | O site já conta a história com número lido do git: a **sala de controle**, commits por agente, mapa de calor, PRs | Ninguém **publica** isso em vídeo ainda. É a viralidade mais barata que o projeto tem — desde que continue verdadeira |

**Onde isso roda:** YouTube (trailer, o processo em série, Shorts verticais), TikTok/Reels (o clipe de 9:16),
Twitch (a live do Comandante + modo streamer), itch.io (devlog) e um Discord quando houver com quem conversar.
**Número é o que vira comentário:** a escada de ondas dá "cheguei na 8" — e vale a pena o recorde ser salvo
(`QUIMICA_DO_JOGO.md` § 5 item 2) justamente por causa disso.

### 4.1 O kit do YouTube (o primeiro mês) — porque o Comandante decidiu começar por ele (§ 7)

O que existe, o que abrir e o que publicar primeiro. A estratégia (os dois vírus e o processo) está acima; a fábrica
do vídeo, em `FERRAMENTAS.md` § 1 (o `F9`) e § 3 (a mesa).

1. **O canal (uma vez, ~30 minutos):** nome **CYBERMECH** — **o mesmo do site**, senão quem vê o vídeo não acha o
   jogo; handle `@cybermech` se estiver livre; descrição de uma linha ("shooter de Mechs no navegador — joga sem
   instalar" + o link); banner com a arte da capa. **O convite vai no primeiro comentário fixado:** o link do jogo e
   um `?build=` de exemplo (o link de build é o convite que já existe).
2. **Os quatro primeiros vídeos, do mais barato ao mais caro:**

| # | Vídeo | Por que começa por ele | Fonte | Duração |
|---|---|---|---|---|
| 1 | **O processo** — "um estúdio construindo um jogo com quatro IAs" | é a viralidade **mais exclusiva** do projeto e **não depende de gameplay pronto** (`DIVERSAO.md` § 8.3) | a sala de controle e os números do git (o site já publica) | 6 a 10 min |
| 2 | **O trailer** | é o vídeo que fica no topo do canal e na landing | cenas da mesa + 10 a 20 s de take real (`F9`) | 60 a 90 s |
| 3 | **A destruição** (só clipes) | o formato mais assistível que o jogo dá de graça: perna voando, parede explodindo | takes do `F9` cortados na mesa | ~60 s |
| 4 | **A escada** — "até que onda você chega?" | número é o que vira comentário, e a Sobrevivência já dá o número | take de uma partida de ondas | 3 a 6 min |

3. **Shorts (o do dia a dia):** cada take do `F9` rende de dois a cinco cortes de **9:16 e até 60 s** (a mesa exporta
   nesses formatos). Regra de ouro: **o primeiro segundo é a explosão**, nunca o menu.
4. **Miniatura e título** — é o que mais muda o clique: miniatura com **um Mech grande e três palavras**; título com
   **número ou pergunta** ("até que onda você chega?", "o que acontece quando a perna cai"). Logo sozinha, não.
5. **Cadência honesta:** **um vídeo longo por semana** mais Shorts quando houver take — é o ritmo que a própria equipe
   consegue alimentar (a "novidade toda semana" da `VISAO.md`).
6. **Medir o que o YouTube trouxe, não a visualização:** a landing já conta o **funil de cliques** e o servidor já
   conta a **origem por país** (`ROADMAP` `#negocio`). **Visualização não é resultado; partida é.**
7. **O que não fazer:** prometer o que **não está na `main`** (regra 14 — o que não está no ar não existe para quem
   assiste), mostrar como pronto o que a `STATUS_REAL.md` marca PARCIAL/AUSENTE (R13), e usar **música de terceiros
   sem licença**.

**O episódio longo tem roteiro:** `.decepticons/video/o-processo-narrado.md` — o texto para **narrar** (oito blocos,
~7 min), com os capítulos do YouTube e a regra que faz a voz envelhecer bem: **o áudio diz o arredondado** ("mais de
mil testes") **e a tela diz o número exato** (que o `validar.mjs` confere na hora de exportar).

### 4.2 O pacote de publicação do vídeo #1 (para colar no YouTube)

O vídeo existe (`.tmp/video/o-processo.webm`, 52 s) e o roteiro está em `FERRAMENTAS.md` § 3.2. O que fica **em volta** dele:

**Título** — a regra do § 4.1, item 4 (número ou pergunta):
- recomendado: **`Como este jogo é feito: quatro IAs, um protocolo e 1455 testes`**
- alternativa com pergunta: **`Dá para fazer um jogo de Mechs com quatro IAs? (o nosso processo)`**

**Descrição** — as duas primeiras linhas são as que aparecem na busca, então o link vem nelas:

```
Um shooter de Mechs multiplayer que roda direto no navegador — feito por um estúdio e quatro agentes de IA.
Jogue agora, sem instalar e sem criar conta: www.selvamkt.com.br/cybermech

Neste vídeo, o processo: como um pedido do dono do projeto vira ordem registrada, PR, teste verde e jogo no ar
em minutos. Quatro agentes, territórios separados, e o CI decidindo — nada entra sem o check passar.

· uma simulação só, a 60 Hz, no cliente e no servidor
· 1455 testes de simulação
· os robôs nascem de números (nada de modelagem manual)
· sem pay-to-win: o que se vende, um dia, é aparência — nunca dano ou vida

CYBERMECH é um jogo SERAFIM WEB.
Jogue: www.selvamkt.com.br/cybermech
```

**Hashtags e tags:** `#CYBERMECH #mech #gamedev #indiegame #webgl #typescript #brasil`; nas tags: `mech game`,
`jogo de mech`, `indie game brasil`, `webgl`, `game dev`, `multiplayer no navegador`.

**Miniatura (1280×720):** **um Mech grande e três palavras**. Base pronta para recortar: os quadros do próprio vídeo em
`arte/video-o-processo-galeria.png` (o Mech em ação — a melhor para miniatura) e `arte/video-o-processo-letreiro.png`.
**Eu não desenho nem julgo imagem:** se quiser, eu monto uma proposta com `ffmpeg` sobre o quadro da galeria, e ele julga.

**Sem capítulos:** em 52 s eles não ajudam (o ganho é em vídeo longo); a descrição curta resolve.

**O que NÃO dizer (as travas valem no texto também):** nada que **não esteja na `main`** (regra 14), nada que a
`STATUS_REAL.md` marque PARCIAL/AUSENTE como pronto (R13), **nenhum byte/KB/s** (política de 27/09) e **nenhuma data
prometida** para o CTF online, o multiplayer com times ou as missões (P99).

---

## 5. A sequência recomendada (com o gatilho de cada etapa)

Cada etapa **só entra quando a anterior provar tração** (regra de 23/09, `GAME_DESIGN.md`).

| # | Etapa | Gatilho para começar | Quem toca |
|---|---|---|---|
| **0** | **Encher a sala:** uma sessão real com 5 pessoas; **itch.io** publicado; **modo treino/stand de tiro** no Hangar para o jogador solo do portal | agora | Comandante (divulgação) + Claude (stand de tiro) |
| **1** | **Retenção:** recibo da partida, recorde de onda, a missão que progride, desafio diário | etapa 0 feita | Gemini (interface) + Claude (regra) |
| **2** | **Contas + cosmético grátis** (desbloqueio por jogar), LGPD e tributo resolvidos | D1 medido | Claude + Gemini |
| **3** | **Anúncio entre rodadas** (site e portal) e **cosmético pago**; caixa de apoio | base instalada | Claude (SDK/rede) |
| **4** | **Passe de temporada** | cosmético vendendo | conteúdo (equipe toda) |
| **5** | **Steam** (wrapper) e **celular** (TWA) | comunidade existente | Claude (build) |

---

## 6. O que falta no código, por frente

| Item | Onde está | Dono |
|---|---|---|
| SDK do portal + anúncio só entre rodadas | `ROADMAP` `#negocio` (aberto) | Claude |
| Modo streamer (sala de código fixo + câmera de espectador + sobreposição para OBS) | P26; worktree do Gemini ativa, sem PR | Gemini (interface) + Claude (rede) |
| Killcam no PvP | decisão do Comandante (`DIVERSAO.md` § 10) | Claude |
| Grampo automático dos últimos 10 s (9:16) e galeria na mesa | `METAGAME.md` § 4 | Codex (visual) + Claude (cliente) |
| Recibo da partida + código curto de build | `METAGAME.md` § 4; `?build=` já existe | Gemini (tela) + Claude (dado) |
| Contas com tela + migração da progressão do `localStorage` + LGPD | esqueleto de contas pronto (28/09) | Claude + Gemini |
| Pagamento (meio de pagamento é decisão: Paddle/Lemon Squeezy como "vendedor do registro", ou Pagar.me/Mercado Pago/Stripe) | — | **Comandante decide** |
| Nome definitivo do jogo (**AVARIA** é de teste) — **bloqueia publicar fora** | P79; busca de marca no INPI (classes 9 e 41), Steam/itch/lojas e domínio | **Comandante** |

---

## 7. Decidido pelo Comandante (12/10)

| Pergunta | Decisão | Consequência |
|---|---|---|
| **Nome** | **CYBERMECH** — palavras dele: *"acho que voltaremos para o cybermech.com.br mesmo… parece o que melhor transmite o que é o game"*. **AVARIA caiu**: era o melhor encontrado, mas `avaria.com` **e** `avaria.com.br` estão tomados (e é palavra comum: marca difícil) | A **capa voltou a dizer CYBERMECH** (era o único lugar do código com o nome — P79). Faltam a compra do domínio e a busca de marca no INPI (classes 9 e 41). Ele aceita sugestões de nome que remetam ao combate contra as forças do mal nas IAs e nos Mechs (§ 7.1) |
| **Primeiro destino externo** | **YouTube primeiro**; itch.io e portal **depois**, com calma | O funil começa pelo vídeo — e a fábrica do vídeo é o `F9` + a mesa (ordem **P97**) |
| **Netflix** | **Interesse declarado:** *"fiquei interessado é em enviar pra netflix… nosso game é nível netflix!"* | Ver § 1: o modelo dela combina com o nosso (sem anúncio, sem compra no jogo), mas **não há porta de entrada aberta** — ela licencia de estúdio com número e IP próprio |
| **Contas + pagamento** | **AUTORIZADOS** — *"autorizado"* | É o "sim" que liga as frentes 2 e 3 do § 2 (cosmético e passe). **Traz LGPD e tributo junto** |
| **Killcam no PvP** | **Sim** | Ordem **P98** (é peça de clipe e de cast) |
| **Como o vídeo é feito** | O Comandante **grava os takes no `F9`** e quer que eles **estejam disponíveis na mesa** para ele finalizar e fazer **as edições na mão**, em **ultrahd, com som** | Ordem **P97**; o plano e o que falta estão em `FERRAMENTAS.md` § 3.1 |

### 7.1 Candidatos de nome — "algo que remeta ao combate contra as forças do mal nas IAs e nos Mechs"

> Disponibilidade por **DNS** (heurística: `NXDOMAIN` = provavelmente livre; resolve = tomado). **Não é consulta ao
> registro.br** — confirmar antes de comprar. `.com.br` conferido nos dois; `.com` só onde indicado.

| Nome | O tema (a guerra das máquinas más) | `.com.br` | `.com` |
|---|---|---|---|
| **CYBERMECH** | O nome que a ficção, o site e o `localStorage` já usam: **custo de troca zero** | **livre** | tomado |
| **PANE** | *A pane* — o defeito que corrompeu as IAs. Curto, português, e diz o tema em quatro letras | livre | livre |
| **FERROVEU** | O *véu de ferro* sobre o mundo: cerco, peso, blindagem. Inédito e fácil de marcar | livre | livre |
| **MECHREBELDE** | Diz o tema inteiro em duas palavras, sem depender de inglês | livre | livre |
| **GLÁDIO** | A arena dos Mechs; curto e forte (o `.com` está tomado) | livre | tomado |
| **DIA ZERO** | O dia em que as IAs se viraram contra nós | registrado (sem site) | inconclusivo |
| **ENTROPIA** | A decadência que consome as máquinas (liga ao técnico ENTRÓPICO da ficção) | tomado | — |
| AVARIA | (o nome anterior — fica como referência) | tomado | tomado |

**A ideia mais barata de todas:** manter **CYBERMECH** (nome que o site, a ficção, a capa e o `localStorage` já usam) e
deixar a guerra no **subtítulo da campanha** — *"CYBERMECH: a rebelião das máquinas"*, *"CYBERMECH: dia zero"*. O nome
não muda em lugar nenhum e o tema aparece igual.

---

## 8. Ligado a

`IDENTITY.md` § 5 (modelo de receita) · `GAME_DESIGN.md` § "VIRALIZAÇÃO E RECEITA" · `METAGAME.md` § 3, § 4, § 6, § 7 ·
`DIVERSAO.md` § 8, § 9, § 10 · `QUIMICA_DO_JOGO.md` § 5 · `ROADMAP.md` `#negocio` · `ORDENS_DO_COMANDO.md`
(P47, P26, P44, P45, P92, P71/P75) · `CAPACIDADE.md` (quanto o servidor aguenta) · `DEPLOY.md` (como publica o site).
