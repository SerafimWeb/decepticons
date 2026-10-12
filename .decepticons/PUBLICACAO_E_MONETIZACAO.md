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

## 7. Decisão do Comandante (o que eu preciso dele)

1. **Nome:** AVARIA fica? Sem isso não há marca, domínio nem página de loja (e "avaria" é palavra comum: pode já
   ter dono).
2. **Primeiro destino externo:** **portal** (CrazyGames/Poki — traz gente) ou **itch.io** (grátis, rápido, sem
   tráfego)? Minha recomendação: **os dois**, itch.io primeiro por ser questão de horas.
3. **Autoriza contas + pagamento?** É o "sim" que liga o cosmético e o passe (§ 2), e traz LGPD e tributo junto.
4. **Killcam no PvP:** revelar (com atraso) ou não? É peça de clipe e de cast.
5. **Quem faz o vídeo:** o Comandante grava e a mesa edita, ou a equipe monta os cortes de 9:16 para ele publicar?

---

## 8. Ligado a

`IDENTITY.md` § 5 (modelo de receita) · `GAME_DESIGN.md` § "VIRALIZAÇÃO E RECEITA" · `METAGAME.md` § 3, § 4, § 6, § 7 ·
`DIVERSAO.md` § 8, § 9, § 10 · `QUIMICA_DO_JOGO.md` § 5 · `ROADMAP.md` `#negocio` · `ORDENS_DO_COMANDO.md`
(P47, P26, P44, P45, P92, P71/P75) · `CAPACIDADE.md` (quanto o servidor aguenta) · `DEPLOY.md` (como publica o site).
