# DIVERSÃO, COMPETIÇÃO E VIRALIDADE — a tese

> **Pedido do dono (2026-09-28):** *"quero que você pense como vamos tornar o jogo mais divertido, a
> experiência mais prazerosa, mais competitivo, quais os diferenciais que devemos explorar pra tornar o jogo
> mais viral. Se o que está faltando são outros mechs com outras especificações, se são desafios e missões na
> fase, se são novas armas e combinações… pra que seja um jogo de estratégia e também de rushar… que vai
> valorizar jogadores técnicos e com visão de jogo."*
>
> **O que isto é:** análise e recomendação, com números lidos do código da `main` em 28/09. **O que isto não é:**
> escopo aprovado. Nada aqui está no jogo, nada entra sem a decisão do dono — e valem as regras de sempre: ficha
> antes do código, teste por regra (G14), nada que se compre ganha partida.
>
> Isto olha o mesmo assunto do `METAGAME.md` § 7 (a pauta do especialista) **pelo outro lado**: não "que módulos
> existem no gênero", e sim **onde essa diversão encosta no jogo que já está no ar, e qual peça falta para ela
> acontecer**. Liga com `VISAO.md` (o norte), `GAME_DESIGN.md` (o que o jogo é) e `ESTADO_ATUAL.md` (o que está no ar).

---

## 1. As três perguntas que vieram juntas

Divertido, competitivo e viral não são a mesma pergunta, não têm o mesmo custo nem o mesmo dono. Separá-las é o
primeiro passo para não gastar em uma o orçamento da outra.

| Pergunta | O que responde de verdade | Custo típico | Onde dói se errar |
|---|---|---|---|
| "mais divertido" | **decisão com consequência legível** | design + pouco código | virar catálogo de coisas |
| "mais competitivo" | **informação, simetria e prova de habilidade** | médio (HUD/rede) | virar sorte de sala |
| "mais viral" | **o clipe e o motivo de mandar** | baixo a médio (visual/telas) | virar feature que ninguém mostra |

## 2. O que o jogo já tem de raro (e não se estraga)

| O que já existe | Hoje, no código | Por que é raro num shooter de navegador |
|---|---|---|
| **Dano por parte com efeito** | 6 partes (`NET_PARTS`); Vector-09: torso 300, pernas 150, cabeça 100; andróide 32 (2 tiros de plasma) | a luta é uma **negociação**: mirar na perna muda o resto do combate |
| **Calor compartilhado** | ~15 tiros segurando, trava de ~2 s, superaquecido anda a 75% | a agressão tem preço — rajada rende mais que gatilho preso |
| **Cenário e terreno que acabam** | barricadas → destroços; zonas de cura (20 hp/s) e resfriamento (0,35/s) | obriga a lutar por lugar, não só por mira |
| **Câmera tática** | 3 câmeras: `tps`, `fps`, `tactical` | um "posto de comando" já existe de graça |
| **Peso e inércia por chassi** | Vector-09 9 m/s; A-1 10,5 m/s com dash de 1,4 s (contra 3 s do Mech) | fazer o leve e o pesado serem **sentidos** |
| **Rodada de 5 min, respawn de 3 s, sem conta** | `Round`: 300 s + 10 s de intervalo | é o pitch: clicar no link e estar jogando |
| **Conteúdo é parâmetro, não arte** | 4 armas × 3 níveis e 2 chassis em tabelas (`weapons.ts`, `chassis.ts`) | é o que torna "novidade toda semana" possível para este estúdio |

**A tese em uma frase:** o diferencial do CYBERMECH **não é catálogo, é consequência** — não importa só o que
você tem, e sim **o que a sua escolha custa** (calor, peso, perna quebrada, cobertura que sumiu). Feature que
**aprofundar consequência** vale mais que feature que **some item**.

## 3. O filtro: três perguntas para toda feature nova

Uma feature só é "diversão" se marcar pelo menos uma caixa:

1. **Cria escolha?** existem dois lados defensáveis naquele momento?
2. **Torna a consequência visível?** o jogador **vê** que a escolha dele importou?
3. **Encurta o ciclo?** decisão → consequência em segundos, não em minutos.

| Feature | Cria escolha | Consequência visível | Ciclo curto |
|---|---|---|---|
| Dano por parte (hoje) | ✅ qual parte mirar | ⚠️ **parcial** — o efeito existe, a leitura não (§ 7) | ✅ |
| Calor (hoje) | ✅ atirar agora ou na hora certa | ✅ barra e trava | ✅ |
| Ondas (hoje) | ⚠️ onde me posiciono | ✅ briefing e HUD | ✅ |
| "Mais uma arma igual às outras" | ❌ | ❌ | ❌ |

Se não marcar nenhuma, é enfeite — e enfeite não é proibido, só não se chama de diversão nem se prioriza como ela.

## 4. As três hipóteses do dono, respondidas

**(a) "Outros Mechs com outras especificações" — sim, e é a resposta mais barata que existe hoje.**
Achado do inventário (verificado na `main` hoje): os três Mechs rebeldes **compartilham os números do Vector-09 do
jogador** — `BotSystem.ts:141` monta todos com `poweredStats(VECTOR09_STATS, …)`. A diferença entre CLAWD, GEMINAI
e CHAD-GPT é **só a persona do bot**. O jogo anuncia três IAs rebeldes; o jogador enfrenta o **mesmo Mech três
vezes**, com nomes trocados.
Dar ficha própria a cada um (o CLAWD atirando longe e com pouco erro; o GEMINAI lento e muito blindado; o CHAD-GPT
rápido e frágil, que avança) entrega as duas coisas que a estratégia pede **sem mecânica nova**: **reconhecimento**
("sei o que vem") e **contra-jogo** ("sei o que fazer"). Custo: números e metas de TTK por teste (Claude), silhueta
(Codex), ficha (Qwen).
**A escala 3 (Colossus-01) é outra conversa:** não é "mais um inimigo", é **encontro** — o alvo que precisa de dois
pilotos e vinte segundos de fogo. É a âncora natural do co-op e da onda-chefe; solta num deathmatch 1v1, vira
frustração (e o teto de corpos vivos já é apertado: 3 Mechs + 3 andróides).

**(b) "Desafios e missões na fase" — sim: é a espinha da retenção e a mais barata agora.**
Ondas já existem (5 ondas, briefing de 3 s, intervalo de 4 s, resumo). **Missão é a mesma casca com um objetivo e um
jeito de perder** — escolta, defesa, invasão. A primeira que eu faria **reusa o que já está no jogo**: escoltar ou
defender o técnico ENTRÓPICO (que já conserta 8 hp/s a 7 m e já é alvo prioritário) ou a base de recarga do drone.
Custo: regra no `Match` (Claude, com teste) + briefing/HUD (Gemini). **Zero arte nova.**
E as missões fazem o que o deathmatch não faz: **forçam variação de montagem** — que é o que dá vida ao Hangar.

**(c) "Novas armas e combinações" — é o ponto mais fraco hoje, e o problema não é a quantidade.**
Fato: cada chassi tem 2 encaixes e **exatamente uma arma por encaixe** (`ARM_SLOTS`, `chassis.ts:124`):
`vector09 = plasma + foguetes`, `android = blaster + motosserra`. O jogador escolhe o **nível** (MK I/II/III)
respeitando a carga, e pode esvaziar o braço esquerdo. O Hangar promete montagem; a decisão real tem **quatro linhas**.
Antes de "mais armas", **abra o catálogo por encaixe** (2–3 opções por braço, com a carga como preço) — aí a montagem
vira decisão, e as armas novas entram por **célula vazia da grade** (§ 5), não por catálogo.

## 5. A grade de situações (onde arma nova vale e onde é ruído)

| Função × alcance | encostado | curto | médio | longo |
|---|---|---|---|---|
| **Dano direto** | motosserra (1,2 m; 20 dps) | blaster (25→120 m) | plasma (60→200 m, cai a 40%) | **vazio** |
| **Área** | — | — | foguetes (40; explosão de 6 m) | foguetes (cheio a 225 m) |
| **Controle** (freia, empurra, cega, apaga calor) | **vazio** | **vazio** | **vazio** | **vazio** |
| **Suporte** (para o jogador) | **vazio** | **vazio** | **vazio** | **vazio** |

Três leituras:
- **Precisão é um buraco real:** o plasma perde força exatamente depois dos 60 m — o espaço onde um rifle de precisão
  viveria já está desenhado no balanceamento, e ele tem contra-jogo natural (sofre encostado).
- **Controle é o buraco mais valioso:** é a arma que **pune quem se esconde e desmancha o bolo de Mechs** — dá
  estratégia sem inflar dano, que é o jeito barato de mexer no meta.
- **Suporte é o que faz o time existir:** hoje o único suporte é a IA técnica e as zonas.

Guardrail: **uma arma por célula**, com contra-jogo e passando nas metas de TTK. Duas armas novas na mesma célula é
ruído — e ruído desequilibra.

## 6. Estratégia e rush no mesmo round: os dois relógios

O rush já está pronto (dash, pulo duplo, respawn de 3 s, rodada de 5 min, pisão, bandeira). A estratégia falta por
dois motivos claros: **falta objetivo** e **falta informação**.

| Relógio | O que é | Hoje |
|---|---|---|
| Curto (3–10 s) | dash, canto, quem atira primeiro, o pisão | ✅ pronto |
| Longo (30 s–5 min) | calor, partes, cobertura que acaba, zona disputada, bandeira | ⚠️ existe na mecânica, não no **plano** |

**Informação como recurso é a resposta ao "jogadores com visão de jogo".** O jogo já tem a câmera tática — hoje ela
é só uma câmera. Com o estado do time e do inimigo à vista, ela vira **posto de comando**; o drone de reconhecimento
(`METAGAME.md` § 8) é o **olho** que a alimenta, e o técnico é o efeito visível dela. Três pedidos do dono — drone,
técnico e visão de jogo — viram **uma mecânica só**: ver o campo → decidir → mandar.
O item mais barato desta frente inteira: **marcador de alvo** (uma tecla, um evento no fio, **0 B/s** de estado). Um
4v4 com marcador é outro jogo.

**O que mata a estratégia** (guardrail): TTK curto demais com visão longa — se quem vê primeiro sempre ganha, nenhuma
decisão sobrevive ao primeiro contato. A proteção já está no código (calor e partes alongam a luta) e nas metas de TTK
travadas por teste. Nada de mecânica de um-tiro-uma-morte.

## 7. Competitivo: valorizar o jogador técnico é **mostrar** o que ele fez

A habilidade que o jogo já premia: escolher a parte (perna = lento, braço = sem arma, cabeça = cego), administrar o
calor, o dash na hora certa, antecipar a queda do plasma depois dos 60 m, pisar no andróide. **O que falta não é
skill — é leitura.**

**1. Legibilidade do alvo — a melhor razão custo/efeito deste documento.**
A informação **já viaja no fio**: cada unidade leva 19 bytes com as **6 partes**, o **calor** e as bandeiras
`dashing`/`overheated` (`shared/net/state.ts:8-30`). **Nada muda no protocolo** — falta só o **visual**: fumaça e
faísca na parte avariada, o Mech que manca visto de longe, a arma destruída pendurada, o vapor de quem vai travar, e
um **esquema do alvo** ao mirar (a leitura de "ele está sem o braço direito e prestes a superaquecer: é agora").
Custo: FX (Codex) + HUD (Gemini). **0 B a mais na rede, 0 regra nova** — e melhora todo o jogo que já existe.

**2. Recibo da partida.** Precisão, partes destruídas, dano por unidade de calor, travamentos por superaquecimento,
"clutches", onda alcançada. É o instrumento do "quero melhorar" — e a matéria-prima do cartão compartilhável (§ 8).
Contadores (Claude, onde for regra) + tela (Gemini).

**3. Times e simetria.** O CTF 2v2 online já está na Fase 5; sem composição equilibrada, "competitivo" é sorte de sala.

**4. Fair-play como ativo.** Nada se compra: isso permite levar o jogo a sério (copa da comunidade, casters) — e é
marketing grátis.

Não fazer agora: MMR/ranqueada antes de ter gente (escada vazia envenena a partida). E a **câmera de abate no PvP** é
decisão do dono já registrada (28/09): minha leitura é **atrasar** a revelação alguns segundos, em vez de proibir.

## 8. Viral: dois vírus, mais um

**1) O convite (o link).** Já existe (sala com código, um clique). Falta **o motivo de mandar**: o **recibo da
partida** como imagem, com a sua build (tudo local, sem servidor), e o **código curto de build** (`CM-V9-SNIPER`) que
a pauta do especialista já pediu e para o qual o `?build=` já está pronto.

**2) O clipe (o vídeo).** O jogo já produz física clipável (perna voando, carcaça detonando, superaquecimento na hora
errada) e a **câmera de abate estreou em 28/09** — por enquanto só offline. Faltam: killcam no PvP (decisão do dono),
**grampo automático dos últimos 10 s** e **espectador/modo streamer** — que é o mesmo item do § 7 e da live do dono:
feito uma vez, serve aos três.
O formato mais assistível que este jogo tem de graça é o **fracasso dramático**: a onda 9 e o último Mech cai. A
escada de ondas dá número para comparar ("cheguei na 8") — e número é o que vira comentário.

**3) O processo — e é o mais exclusivo.** Este projeto publica como é feito; a sala de controle é um case. "Um estúdio
construindo um jogo com quatro IAs" tem público, e o site já conta isso com número lido do git. Não é feature de jogo,
mas é a viralidade mais barata que o projeto tem — desde que continue verdadeira.

## 9. Retenção (voltar amanhã sem virar segundo emprego) — e quatro achados de hoje

Em ordem de custo: **uma escada pessoal** (onda alcançada / melhor marca: o `waveReached` já existe, falta o recorde e
a comemoração) → **sinal de maestria** (precisão, pernas destruídas — precisa do recibo, § 7.2) → **modificador
semanal** (a novidade mais barata que existe: uma flag + uma linha de HUD; "sem foguetes", "calor dobrado", "caça ao
técnico" — força build diferente, rende conversa e cumpre o "novidade quase toda semana" da `VISAO.md` **sem arte
nova**) → **identidade** (cosmético; depende de contas: não é agora).

Achados verificados no código da `main` hoje — **bug de outra frente, não proposta minha** (R17: registro, não
corrijo; `ui/` e `hangar/` são território do Gemini):

| Achado | Efeito no jogador | Onde |
|---|---|---|
| `addXp()` só é chamado dentro de `claimReward()` | **o nível do piloto não sobe jogando** — só resgatando missão | `ui/DailyChallenges.ts:90,138` |
| `trackWaveOrRound()` não tem chamador em nenhum arquivo | a missão "sobreviver 3 ondas" **nunca progride** | `ui/DailyChallenges.ts:127` |
| `validateLoadout(spec, unlocked = () => true)` sem chamador | o gancho de "conquistado jogando" existe e não trava nada | `hangar/loadout.ts:70` |
| 500 ₵ iniciais sem nada para comprar | esperado sem contas — mas hoje o crédito é número morto na tela | `ui/DailyChallenges.ts` |

Os três primeiros são conserto pequeno e destravam a retenção que já deveria estar funcionando.

## 10. A ordem que eu recomendo (custo × efeito)

| # | Item | O que destrava | Custo | Dono |
|---|---|---|---|---|
| 1 | **Legibilidade do alvo** (fumaça, mancar, esquema ao mirar, calor do alvo) | melhora o jogo que já existe, valoriza o técnico e a "visão de jogo" | FX + HUD, **0 B** | Codex + Gemini |
| 2 | **Consertar a progressão** (XP por jogar, onda contada, gancho com chamador) | retenção que já deveria funcionar | pequeno | Gemini |
| 3 | **Ficha própria dos 3 Mechs rebeldes** (longo / pesado / rápido) | reconhecimento + contra-jogo: a estratégia mais barata que existe | números + silhueta | Claude + Codex + Qwen |
| 4 | **Recibo da partida + cartão compartilhável** | "quero melhorar" + o motivo de mandar o link | telas, local | Gemini + Claude |
| 5 | **Marcador de alvo** (1 tecla, evento) | transforma 4v4 em jogo de time | 1 evento, **0 B/s** | Claude + Gemini |
| 6 | **Catálogo por encaixe** + uma arma por célula vazia (precisão, controle, suporte) | a montagem vira decisão | dados + ficha + metas | Claude + Qwen + Codex |
| 7 | **Missão em fases #1** (escolta/defesa do técnico) | a espinha da retenção, reusando o que existe | regra + HUD | Claude + Gemini |
| 8 | **Modificador semanal** | novidade barata que força build diferente | flag + linha de HUD | Claude + Gemini |
| 9 | **Espectador + killcam no PvP + grampo de 10 s** | o clipe e a live do dono | médio (decisão do dono) | Claude + Gemini |
| 10 | **Escala 3 como encontro cooperativo** | a âncora do co-op e da onda-chefe | grande (já em `codex/colossus-01`) | Codex + Claude |

Depois: contas/loja/cosméticos, MMR, veículos, mapas grandes.

**Como saber se funcionou** (medir, não achar): rodadas por sessão e volta no dia seguinte (as metas da `VISAO.md`);
**variedade de montagem** (quantas builds diferentes aparecem — mede se a decisão existe); **recorde de ondas** (mede a
escada); e o **painel de balanço** por arma/chassi que já está na pauta (mede se a arma nova desequilibrou).

## 11. O que não fazer agora

- **Não inflar vida/dano de inimigo** para "aumentar a dificuldade" — mais difícil é outro chassi, não mais HP
  (é a regra da ficha das ondas).
- **Não abrir loja nem conta** antes de haver retenção: sem gente voltando, vitrine vazia.
- **Não lançar arma sem contra-jogo** nem chassi sem papel: catálogo não é profundidade.
- **Não alongar a rodada:** 5 minutos é o diferencial, não um parâmetro.
- **Não deixar entrar mecânica de um-tiro-uma-morte:** ela apaga a negociação (calor e partes), que é o que o jogo
  tem de melhor.
- **Não publicar número que não sai do código** — a credibilidade do case é o ativo.

## 12. Perguntas para o dono

1. **Escala 3 (Colossus):** entra como **encontro** (onda-chefe/co-op) ou como **chassi jogável**? Muda o desenho
   inteiro — e o teto de corpos vivos.
2. **Prioridade:** "melhorar o que existe" (legibilidade + progressão) ou "conteúdo novo" (missão em fases)? Minha
   recomendação é a primeira: encarece menos e melhora tudo o que já está no ar.
3. **Abro as fichas dos três Mechs rebeldes** (CLAWD / GEMINAI / CHAD-GPT) como proposta, para o Codex desenhar e o
   Claude calibrar?
4. **Modificador semanal** pode ser o primeiro evento público do jogo?
5. **Câmera de abate no PvP:** liberar, atrasar alguns segundos ou manter offline? (já é pendência sua desde 28/09.)
6. **Autoriza o PR pequeno de conserto da progressão** (§ 9) na frente do Gemini?
