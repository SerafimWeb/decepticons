# PILOTOS POR LLM E A INTELIGÊNCIA DOS BOTS COMO ATIVO

> Criado em 11/10/2026 (Qwen), a partir da ordem **P75** do Comandante: *"tornar nossas IAs mais inteligentes, para poder
> plugar uma API de LLMs diferentes como pilotos dos Mechs e dos andróides"* e *"produzir, cultivar e organizar a
> inteligência gerada nos bots em combate, para transformar isso num produto vendável"*.
> **Estado: plano. Nada construído.** É o companheiro de `DADOS_E_ROBOTICA.md` (P71, o produto de dados) e de
> `PAINEL_ADMIN.md` (P54, a ficha de cada bot). Não substitui nenhum dos dois: costura as duas pontas — **o piloto** (o
> cérebro que joga) e **o dado** (a inteligência que ele gera).

> **Decisões do Comandante (11/10/2026), logo depois deste plano:**
> 1. **Só as nossas IAs.** Nada de armazenar ou capturar dado de jogador que possa gerar problema de **LGPD**. O gravador
>    e o treino usam **apenas os bots** (o nosso código, a nossa IA). Isso **remove o portão de consentimento** da etapa
>    D0 do P71: não há dado pessoal a consentir (ver §5, §6 e §7).
> 2. **Vozes.** O Comandante tem **créditos no ElevenLabs** para as vozes do rádio, se for o caso (ver §3-B).

## 1. O que já existe (não se começa do zero)

- **P53 — "Dá para plugar LLMs (Groq, Gemini, DeepSeek) por API nos bots?"** Registrada em 25/09; respondida pelo Claude
  em 11/10: **dentro do tick, não**. Uma chamada de LLM leva de centenas de ms a segundos e o tick tem 16 ms; custa por
  chamada e por jogador; a resposta não se repete (quebraria o determinismo do G2 e a simulação única do servidor, G14);
  e a chave de API ficaria exposta no navegador. Onde faz sentido é **fora do tick**. O Comandante decidiu em 11/10
  (ordem P75) seguir por esses caminhos, gradualmente.
- **P74 — a inteligência dos bots em regras rápidas** (no ar, PR #235): rádio do clã (quem vê o alvo avisa os
  companheiros), caça pelo caminho projetado e varredura antes de desistir, leitura da mira do jogador, cerco pelos
  flancos e revide em quem atira. É o "reflexo" — rápido, determinístico, a 60 Hz. **É a base sobre a qual o LLM entra.**
- **P71 — o produto de dados** (`DADOS_E_ROBOTICA.md`, direção aprovada em 11/10): o corpo do Mech não transfere para um
  humanoide real, mas **a decisão transfere**; o formato é um **gravador de voo** no servidor; o caminho é D0 (gravador)
  → D1 (bot fantasma) → D2 (arena aberta a cérebros de fora) → D3 (robô real).
- **A ficção já é esta ideia.** Em `UNIVERSO.md` as IAs rebeldes **caçam computação**, cada bot é um *threat actor* com
  TTPs (MITRE ATT&CK) e o diretor de ataque já se chama **"o C2 das IAs"**. A "inteligência cultivada" já tem nome,
  vocabulário e lugar na marca.
- **O contrato já reserva o lugar do piloto.** `PAINEL_ADMIN.md` já define `BotSpec.piloto` ("quem pilota: aparece no
  placar e nas mensagens").
- **A infraestrutura de vários provedores já existe no Protocolo.** `PROTOCOLO_SERAFIM_UM.md` — SKILL 16 (cadeia de
  *fallback* entre provedores: Groq → DeepSeek → OpenAI) e SKILL 17 (custo por chamada, por *feature* e por mês). É o
  molde pronto do que o Comandante chama de "API de LLMs diferentes". **Não editar** aquela cópia; reusar o padrão.

## 2. O limite que não se cruza

Tudo neste plano obedece a uma restrição dura, e vale escrevê-la antes das opções:

| Restrição | Por quê |
|---|---|
| **O LLM nunca decide dentro do tick** | O tick é 16,6 ms; a chamada leva 200 ms–2 s. Decidir a 60 Hz com API remota é impossível. |
| **A simulação tem de continuar determinística (G1/G2/G14)** | Servidor e cliente rodam a mesma simulação a partir de uma semente. Resposta de LLM não se repete — não pode entrar no tick. |
| **Custo por chamada** | Uma chamada por bot por segundo, multiplicada por jogadores e por sala, não fecha a conta. |
| **Nada de chave de API no navegador (R2)** | O cliente é público. Qualquer chamada de LLM sai do **servidor**, nunca do browser. |
| **Banda (G11)** | O teto é ≤ 8 KB/s de download por jogador; texto de LLM não pode virar estado de rede por tick. |

**Conclusão que organiza todo o resto:** o LLM não é o piloto dos reflexos. Ele é o **comandante**, o **rádio** e o
**professor** — três papéis, todos fora do tick. O reflexo (mirar, andar, recuar, atirar) continua nas regras rápidas do
`BotController`, que já são boas (P74).

## 3. Os três papéis do LLM (todos fora do tick)

| Papel | Onde roda | Cadência | Pode chegar atrasado? | Custo | O que entrega |
|---|---|---|---|---|---|
| **A · Comandante (o "C2")** | Servidor | 1 chamada por rodada | Não (decide antes da rodada começar) | Baixo | Estratégia, personalidades, quem ataca com quem, agressividade → um `BotSpec[]` |
| **B · Rádio / voz** | Servidor | Assíncrona | **Sim** (é texto; se atrasa, só aparece depois) | Baixo | As falas das IAs ("◈ CLAWD: CONTATO ▸ VOCÊ"), provocações, boletins — **texto por LLM e voz por ElevenLabs** |
| **C · Professor (destilação)** | Fora do jogo (offline) | Em lote | — | Computação de treino | Uma política pequena que joga a 10 Hz **dentro** do jogo (o "bot fantasma") |

### A · Comandante LLM (o "C2 das IAs") — entre rodadas

O LLM escolhe a **configuração** da próxima rodada e devolve um `BotSpec[]` (o contrato que o P54 já desenhou, com o
campo `piloto`). Como a configuração é **fixada antes** da rodada, a simulação segue determinística — o LLM decide uma
vez, não a cada tick. É exatamente o "C2" da ficção: cada clã de IAs com um cérebro diferente, e o Comandante podendo
escolher **qual LLM** comanda cada clã (Groq, DeepSeek, Gemini…). A infra de cadeia de provedores é a SKILL 16 do
Protocolo.

- **Custo de CPU no jogo:** zero por tick (a chamada acontece entre rodadas, no servidor).
- **Encaixe de produto:** "clãs de IAs" configuráveis; o painel admin ganha um seletor de provedor por clã.

### B · Rádio das IAs por LLM — texto e voz, assíncronos

As falas do rádio (o template já existe desde o P74). O LLM gera o **texto**; chegar atrasado não quebra nada, porque é
conteúdo, não regra. É o "pior caso" mais barato e o de resultado mais visível rápido. Já existe como ideia no
`ROADMAP` ("Rádio das IAs rebeldes: provocações geradas por modelo de linguagem no servidor, entre rodadas — nunca
decidindo o combate").

- **Voz (ElevenLabs — decisão do Comandante, 11/10):** ele tem **créditos no ElevenLabs** para as vozes. O texto do LLM
  vira áudio **no servidor** (nunca no cliente, R2) e o jogo toca. Cada IA rebelde pode ter a **sua voz própria**, que faz
  parte da "ficha de ameaça" (`UNIVERSO.md`). Para o custo não crescer a cada rodada, o normal é **pré-gerar e cachear**
  as falas repetidas (saudação, contato, abate, provocação) e deixar o LLM + TTS só para o texto novo.
  **Custo de CPU no jogo:** tocar um áudio já pronto (o mesmo caminho do `AudioSystem`), não gerar áudio.
- **Encaixe de produto:** personalidade das IAs + os "boletins de inteligência TLP:CLEAR" (`UNIVERSO.md`) — conteúdo de
  viralização com a voz da marca.

### C · Pilotos por LLM "de verdade" = destilação

É o único caminho que dá "LLMs diferentes como pilotos" **sem** quebrar o jogo. Dois níveis (`DADOS_E_ROBOTICA.md`, §4,
item 3): o **reflexo** continua em regras (60 Hz); o **tático** é *aprendido*. O LLM atua como **professor offline** —
gera decisões, rótulos e políticas — e o que roda no jogo é uma **rede pequena e determinística** (o bot fantasma), a
10 Hz, por microssegundos. O LLM não está no runtime; ele está no treino.

- **Custo de CPU no jogo:** uma rede pequena por bot a 10 Hz (microssegundos), não uma chamada de rede.
- **Encaixe de produto:** é o mesmo artefato do P71 (a política treinada) — o produto de dados e o "piloto" são a mesma
  coisa vista de dois ângulos.

## 4. "Cérebros de fora": a API de pilotos de verdade (etapa D2 do P71)

A forma mais direta de "plugar APIs de LLMs diferentes como pilotos" é a **arena aberta** (D2): qualquer agente —
um LLM, uma regra, uma política treinada — joga pelo **mesmo protocolo de comando** que um humano usa, os **9 bytes**
por tick de `shared/net/input.ts` (`moveX`, `moveZ`, `moveYaw`, `yaw`, `pitch`, `jump`, `dash`, `fire`, `secondary`).
O agente externo não toca a simulação: ele **manda comando**, como um jogador.

- Um LLM que responde em 300 ms joga mal num jogo a 60 Hz — e isso é **resultado válido**, não bug: mede-se quem decide
  bem, com que latência, e o ranking separa "cérebro" de "reflexo".
- Isso **é** a "API de pilotos": um contrato público de comando + um ranking. Vira plataforma (PvE, PvP de agentes,
  torneio de cérebros) e é o mesmo trilho que alimenta o dado do P71.
- **Anti-trapaça é pré-requisito** (`DADOS_E_ROBOTICA.md`, §7): partida com mira automática ou exploração de falha sai
  do conjunto.

## 5. Cultivar e organizar a inteligência (só as nossas IAs — sem LGPD)

**Decisão do Comandante (11/10): o gravador captura apenas as nossas IAs.** Nada de entrada, identidade ou telemetria de
jogador — nada que possa gerar problema de **LGPD**. O objeto do treino é **o bot** (o nosso código): a decisão dele, com
a observação dele, no combate dele. Isso é mais simples e mais seguro do que o plano original do P71, que mirava o
comportamento humano: aqui **não há dado pessoal a consentir**, e o portão de consentimento da etapa D0 cai (ver §7).

O bom é que isso é quase de graça: o `BotController` **já produz o mesmo `MechInput`** que um piloto (mesmo formato,
mesma função), e o estado que ele vê já sai codificado. O que falta é **decidir gravar** e fazer a curadoria.

**Cultivar** = transformar partidas **bot a bot** em conjuntos de treino (o "laboratório controlado" do P71 §2, agora sem
ninguém de fora):
- rotular cada episódio por **persona, dificuldade, semente, mapa, montagem** (tudo nosso, tudo reproduzível);
- capturar a **observação honesta** (só o que a amostra de visão/audição do bot viu — o P74 já usa isso): sem
  onisciência, o que se aprende roda num robô real;
- **nunca** gravar o lado humano: o conjunto de treino sai de **bot × bot** (ou só do lado do bot, sem o comando do
  jogador). Nenhum dado de pessoa entra no arquivo;
- filtrar trapaça e pesar o dado de modos sem renascimento (morrer no jogo custa segundos; num robô, o robô).

**Organizar** = dar forma ao ativo:
- um **catálogo de "cérebros"**: cada política treinada é um artefato versionado (o "piloto"), com ficha (de que
  partidas veio, o que faz bem, contra o que falha);
- a **ficha de ameaça** que o `UNIVERSO.md` já descreve (TTPs, IOCs, contramedidas) é a cara pública dessa organização —
  a mesma ideia vista pelo jogador.

## 6. O produto vendável — dois eixos

| Eixo | O que vende | Quem paga | Depende de |
|---|---|---|---|
| **Dentro do jogo** (plataforma) | A **arena aberta** a cérebros de fora (D2): qualquer LLM/agente joga pelo comando de 9 bytes, com ranking | Jogadores (diversão) e criadores (avaliar o próprio modelo) | D1 provar o pipeline |
| **Fora do jogo** (o dado e a política) | O **dataset honesto** (estado+ação+recompensa) **dos nossos bots** e a **política tática de alto nível** para robôs humanoides | Fabricantes, pesquisa, defesa **com humano no comando** | D0 (gravador; **dado só das nossas IAs, sem LGPD**) |

Os dois eixos são o mesmo motor: o gravador. Um entrega diversão, o outro entrega ativo. `DADOS_E_ROBOTICA.md` §7 fixa
as linhas que não se cruzam (nada de tiro autônomo em robô físico, nada de dado sem consentimento). O Comandante estreitou
o escopo em 11/10: **o dado é só das nossas IAs** (`bot × bot`), então o eixo de fora não depende de consentimento de
jogador.

## 7. Ordem gradual (o que fazer, com o gatilho de cada passo)

> Proposta de ordem "do mais barato e seguro para o mais valioso". Cada passo é um PR, com `npm run check` verde,
> evidência e linha nas `ORDENS_DO_COMANDO.md`.

| # | Passo | Papel | Gatilho para começar | Estado |
|---|---|---|---|---|
| 0 | Escrever este plano e registrar P75 | doc | Ordem do Comandante | **este PR** |
| 1 | **Rádio das IAs por LLM** (texto por LLM + voz por ElevenLabs, no servidor, entre rodadas) | B | Aprovado — mais barato e visível | a fazer |
| 2 | **Comandante LLM** entre rodadas → `BotSpec[]` | A | Depois do passo 1 (reusa a cadeia de provedores) | a fazer |
| 3 | **Gravador de voo** (D0 do P71), capturando **os bots** (a nossa IA) | dado | Aprovado — só as nossas IAs, sem dado de jogador (LGPD) | a fazer |
| 4 | **Bot fantasma** treinado com as partidas reais (D1) | C | Milhares de horas gravadas | a fazer |
| 5 | **Arena aberta a cérebros de fora** (D2), com ranking | plataforma | D1 provar o pipeline | a fazer |

O passo 1 é o próximo natural: **não toca o tick, não muda o balanceamento, roda no servidor e já dá conteúdo
visível**. Depois dele, o passo 2 destrava "escolher o LLM que comanda o clã".

## 8. Contratos e território (AGENTS.md, regras 4 e 5)

- **O "cérebro" mora em `combat/BotController.ts`/`BotSystem.ts`** — território do **Claude**. O gravador mora em
  `server/` — também do **Claude**.
- **Contrato novo (a definir antes de paralelizar):** um `BrainSpec` (provedor, modelo, temperatura, papel, teto de
  custo) e o `BotSpec[]` que o comandante devolve — em módulo sem tela, com validação e teste, no molde de
  `LoadoutSpec`/`PowerStore`. O `BotSpec.piloto` do `PAINEL_ADMIN.md` já é o começo.
- **Qwen (este agente):** papel transversal — este plano, o contrato em documento, a curadoria de dados como
  documentação e a **revisão independente** dos resultados. **Não** toca `sim/`, `combat/`, `entities/`, `physics/`,
  `player/`, `net/`, `server/`, `shared/` (regra do papel no `ESTADO_ATUAL.md`).
- Cada passo declara o **custo de CPU** (G1–G5): passos A/B são zero no tick; o passo 3 é copiar bytes já codificados
  para um buffer pré-alocado e gravar no fim da partida (perto de zero por tick).

## 9. Linhas que não cruzamos

- **Nada de comportamento de tiro num robô físico que decide sozinho usar força** (arma, produto controlado, linha
  vermelha da autonomia letal). Defesa aqui é simulação, treino de operadores, apoio à decisão e adversário
  imprevisível — **humano no comando** (`DADOS_E_ROBOTICA.md` §7).
- **Nada de chave de API no cliente** (R2); toda chamada de LLM sai do servidor.
- **O LLM não decide o combate** (nem dentro do tick, nem por atalho): ele decide **entre** rodadas, gera **texto** ou
  treina **offline**. O combate continua justo, determinístico e reproduzível.
- **Nada de dado de jogador** (decisão do Comandante, 11/10): o gravador e o treino usam **só as nossas IAs**; nenhum dado
  pessoal é capturado nem vendido. O objeto é o bot, não a pessoa.
- **Trapaça envenena o dado:** partida com mira automática ou exploração de falha sai do conjunto.

## 10. Decisões do Comandante (têm padrão; sem resposta, sigo o padrão)

1. **Ordem dos passos.** Padrão: **1 → 2 → 3 → 4 → 5** (rádio, comandante, gravador, fantasma, arena). Alternativa:
   começar pelo gravador (passo 3) se o produto de dados for prioridade agora.
2. **Qual LLM primeiro.** Padrão: **Groq** (menor latência) para o rádio e o comandante; depois DeepSeek/Gemini como
   *fallback* (SKILL 16). Você decide a lista.
3. **Dado: só as nossas IAs (resolvido em 11/10).** Nada de dado de jogador (LGPD). O gravador captura **apenas os bots**;
   o conjunto de treino sai de `bot × bot`. Sem portão de consentimento. Alternativa: nenhuma — é decisão do Comandante.
4. **Onde o comandante mora.** Padrão: **no servidor**, disparado entre rodadas; sem UI nova no começo (o painel admin,
   P54, mostra o `piloto` depois). Alternativa: botão no jogo para disparar/ver a escolha do comandante.
5. **A arena aberta (passo 5).** Padrão: **primeiro um modo de teste fechado** (agentes convidados), ranking privado,
   antes de qualquer coisa pública.
6. **Vozes (ElevenLabs).** Padrão: **voz por ElevenLabs** (créditos do Comandante), com as falas repetidas **pré-geradas e
   cacheadas** e cada IA com a sua voz. Alternativa: manter só o texto do rádio, sem áudio.
