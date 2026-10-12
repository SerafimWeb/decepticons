# ARMAS DO BOTÃO 2 — ombros, costas, peito e tecnologias além da mão

> Aberto em 11/10/2026 (Claude), a pedido do Comandante (ordem **P77**): *"a maioria das armas que fizemos é para as mãos, temos que pensar as armas pro botão 2, seja nos
> ombros, costas, peitoral, etc, vamos VARIAR as armas e tecnologias. As armas de som combinam em ficar nos ombros."*
> Contrato de arma em geral: `ARSENAL.md`. O que é real hoje: `STATUS_REAL.md`. Este arquivo é o **mapa de ideias com o custo de cada uma**, para o Comandante escolher a ordem.

## 1. O que existe hoje (lido no código em 11/10)

| Lugar do corpo | Quem tem | O que leva | Observação |
|---|---|---|---|
| Mão direita (botão 1) | todos | arma de energia/aço/fogo | `ARM_SLOTS.right` |
| Mão esquerda (botão 2) | todos menos o Lancer | arma de energia ou foguete/chuva | `ARM_SLOTS.left`; no Marauder vira a 2ª mão do botão 1 |
| **Ombros** (botão 2) | **só o Marauder** | foguetes, chuva de mísseis, o **canhão sônico** e o **míssil teleguiado** | `ARM_SLOTS.marauder.shoulders`; as duas bocas disparam juntas |
| Costas | ninguém (a chuva de mísseis é *desenhada* nas costas, mas atira da mão) | — | `buildBackMortar` é só desenho |
| Peito / cabeça | ninguém | — | não existe encaixe |

Só há **dois botões** (1 e 2): uma arma por botão por lado. Variar as armas do botão 2 é, portanto, variar **o que** ele faz e **de onde** sai, não somar botões.

## 2. O que entrou em 11/10 (PR `claude/armas-de-ombro`)

- **Canhão sônico (`sonic`)**, a primeira arma só de ombro: um **pulso em cone de 52°**, de uma vez só, que **empurra** quem pega. 20 de dano por boca (cheio até 10 m, 35% aos 22 m), um aperto a cada 1,2 s, duas
  bocas (os dois ombros): 40 por aperto. Natureza `sonico` (a chapa Amortecedor segura 90%). Sobe de nível ganhando **alcance** (22 / 27,5 / 33 m). Não derruba sozinha (as duas bocas levam ~9 s num torso): o
  ponto dela é **tirar o inimigo do lugar**.
- **Empurrão no corpo (`MechBase.push`)**: velocidade externa que decai (e^-3,5), soma ao movimento sem passar pela aceleração (o piloto **não** cancela freando), teto de 12 m/s, e **o robô grande empurra
  menos** (resistência = 1,3 m ÷ raio, de 25% a 100%). É a base da "reação do inimigo ao ser atingido" (ordem P69), que ainda não está ligada a nenhum tiro comum.
- **O evento de tiro agora diz o encaixe** (protocolo 14), então o outro jogador vê a onda sair do ombro certo.

## 3. O contrato de uma arma de botão 2 (o que tocar)

1. **Dado:** `WeaponId`, entrada em `BASE` (`combat/weapons.ts`) em `WEAPON_FIT` (`combat/weaponClass.ts`: classe leve/média/pesada e o tamanho de robô, P82) e em `WEAPON_MOUNTS` (`combat/mountKinds.ts`: em quais tipos de encaixe ela cabe, P84); comportamento novo = campo opcional e tipado (`wave`, `flame`, `barrage`), nunca `if (id === …)`.
2. **Regra de tiro:** `combat/Armament.ts` (ramo do gatilho secundário) chama um método do `ShotSink`; o jogador (`PlayerController`) e o servidor (`NetPilot`) implementam, e **quem aplica a regra é a partida**
   (`Match.waveCone`, `flameCone`): mesma regra offline e no servidor (G14).
3. **Encaixe:** a arma entra em `ARM_SLOTS[chassi].shoulders` (ou `left`); a carga conta por encaixe (dois ombros pesam o dobro).
4. **Desenho:** modelo em `entities/weaponModels.ts` (`podModel` para ombro) e o fluxo/efeito em `fx/`.
5. **Rede:** `NET_WEAPONS` (**só no fim**) e `PROTOCOL_VERSION` + 1; o evento de tiro já leva o encaixe.
6. **Hangar:** `WEAPON_HINT`, `WEAPON_ICON`, mira (`WeaponReticle`), `FIRE_KICK`, `IMPACT_FX`, `MUZZLE_FX` (o `Record` quebra o typecheck se faltar).
7. **Equilíbrio:** bancada (`balance.ts`) e a meta de 2,5 s dos combos; mutação nos testes.

## 4. Catálogo de ideias (o que cada uma pede)

Legenda de custo: **P** = pequeno (só dado + regra + desenho, como o sônico), **M** = médio (um sistema novo), **G** = grande (infraestrutura nova: encaixe novo, estado novo, regra de lado).

| # | Arma / tecnologia | Onde | O que faz | Pede | Custo | Combina com |
|---|---|---|---|---|---|---|
| 1 | **Canhão sônico** | ombros | cone que empurra | — | ✅ feito | tirar do abrigo; empurrar para dentro do anel de fogo |
| 2 | **Míssil teleguiado** | ombros | ✅ **feito (12/10, protocolo 16):** trava no inimigo mais centrado à frente (29°, até 90 m, à vista) e curva até ele a 2,2 rad/s; sem alvo, voa reto | `RocketSystem.steer` + `Match.seekTarget` (determinístico, sem rig) | M | combinar com o sônico (empurra, o míssil acerta) |
| 3 | **Emissor ultrassônico** | ombros | zona de som que dura 4 s no chão e **desacelera** quem está dentro | zona dinâmica na partida (o `ZoneSystem` já existe com 2 tipos fixos) e um estado de lentidão (**os 8 bits do byte `fx` estão cheios**: pede protocolo) | G | tankar no meio do grupo; segurar quem foge do anel |
| 4 | **Drone de ombro** | ombros | solta um drone que ataca sozinho por 10 s | reaproveitar o `DroneSystem` (hoje só dos aliados da Serafim) | M | segurar flanco |
| 5 | **Lançador de minas** | costas | deixa minas no chão, detonam por proximidade | encaixe novo `back`, mina como entidade fixa na partida | G | cobrir a retirada; o aliado congelado como isca |
| 6 | **Propulsor de costas** | costas | impulso curto para cima/frente (calor) | encaixe `back` + regra de movimento (o dash já é impulso) | M | *rush* para dentro do grupo (combo do anel de fogo) |
| 7 | **Gerador de campo de reparo** | costas | cura os aliados num raio por alguns segundos (e gasta o dono) | **regra de lado** (`Match.sameSide`, já feita) e **times online** (P81) | G | o combo de equipe: curar o amigo que solta o anel |
| 8 | **Feixe térmico** | peito | feixe contínuo em linha, precisa de mira e esquenta | encaixe `chest`, regra de feixe (raio contínuo, já proposto em `ARSENAL.md`) | M | queimar e empurrar |
| 9 | **Arpão magnético** | ombro | prende e puxa o alvo (o cabo rompe se o alvo for pesado) | o `push` (feito) puxa; falta o cabo como entidade e a regra de ruptura | M | puxar o inimigo para dentro do anel de fogo |
| 10 | **Granada de fumaça** | costas | nuvem que quebra a mira e a linha de visão dos bots | nuvem como volume na partida, IA que respeita | M | fuga; cobrir quem solta o anel |
| 11 | **Marcador de alvo** | cabeça | marca um inimigo: a equipe vê e ele leva +10% | times online (P81) | G | jogo em equipe |

## 5. Ordem sugerida (o Comandante decide)

1. **Já entregue:** o canhão sônico e o empurrão (P77, 1ª parte).
2. **Em seguida, o que não pede infraestrutura nova:** o **míssil teleguiado** (#2) e o **arpão magnético** (#9, que usa o `push`): dois PRs médios, os dois nos ombros do Marauder.
3. **Ombros para mais robôs** (o pedido de "melhor aproveitamento dos slots"): hoje só o Marauder tem; o **Bastion e o Colossus** seriam os próximos, pedindo a medição das bocas (`npm run mech:bocas`) e a posição
   dos casulos no desenho (`shoulderPods`), um robô por PR.
4. **Os encaixes de costas e de peito** (#5, #6, #8): **infraestrutura** (`MOUNTS` cresce no fim, bocas por chassi, desenho, Hangar com mais uma linha de encaixes): um PR só para o contrato, depois as armas.
5. **O que depende dos times online (P81):** o gerador de reparo e o marcador de alvo; só valem quando duas pessoas puderem estar no mesmo lado numa sala.

## 6. Limites honestos

- **Só o Marauder** leva arma de ombro hoje: o canhão sônico, por enquanto, é dele.
- O **empurrão** vale na simulação do servidor e do jogo offline; o **jogador que leva o empurrão online** o vê pela correção suave do servidor (a previsão do cliente não conhece o empurrão), então ele "desliza" alguns centímetros
  depois do tiro, não no mesmo quadro.
- O **empurrão ainda não é a reação a tiros comuns** (ordem P69): só a onda sônica empurra.

## 7. Tipos de encaixe: braço, ombro, costas, peito e cabeça (resposta à ordem P84, 11/10)

> *"E como fica a diferença, se temos que diferenciar: armas para braços / armas para ombros / armas para costas (tipo lança-mísseis podem ficar nas costas ou ombros) / armas de peitoral? Os slots padrão nos mechs é geralmente isso: as armas ficam ou nos braços, ombros, cabeça do robô, etc."*

São **três perguntas separadas**. O jogo já responde uma e meia; esta seção diz como as três se combinam e o que falta.

1. **Onde a arma fica no corpo: o tipo de encaixe** (braço, ombro, costas, peito, cabeça). Cada **chassi** diz que encaixes tem; cada **arma** diz em quais tipos cabe (um lança-mísseis cabe em ombro e em costas; um canhão de trilho, só em braço).
2. **De que tamanho ela pode ser: a classe** (leve, média, pesada, `ARSENAL.md` § "Classes de arma"). Cada encaixe aceita **até** uma classe: a cabeça, só leve; o peito, até média; ombro, costas e braço, até pesada. Um robô gigante enxerga as pesadas dos Mechs como leves, então o mesmo encaixe dele aceita o que para um Mech seria pesado.
3. **Em que botão ela atira: o gatilho.** Hoje há **dois botões** (1 principal, 2 apoio), e é o que decide a leitura do jogo: o **botão 1** é a arma de mão; o **botão 2** é o **apoio**, que pode estar no **ombro ou nas costas** (o mesmo trabalho em dois lugares: um robô tem um ou o outro, ou os dois atirando juntos a mesma arma). **Peito e cabeça são "sistemas"** (feixe, marcador, sensor): não cabem em dois botões sem apertar o jogador, e pedem um **terceiro gatilho**.

| Tipo | Quem tem hoje | Aceita até | Atira no | Armas que cabem hoje | Ideias (§ 4) |
|---|---|---|---|---|---|
| **Braço** (mão) | todos (o Lancer só tem a direita, a esquerda é escudo) | pesada | botão 1 na direita, botão 2 na esquerda (no Marauder as duas mãos são botão 1) | plasma, blaster, escopeta, trilho, EMP, arco, gelo, automático, rotatória, lança-chamas, canhão pesado, foguetes e chuva (os dois só na esquerda), motosserra | — |
| **Ombro** | só o **Marauder** | pesada | botão 2 (as duas bocas juntas) | foguetes, chuva de mísseis, **canhão sônico** | míssil teleguiado, arpão, drone |
| **Costas** | ninguém (a chuva de mísseis é *desenhada* nas costas, mas atira da mão esquerda) | pesada | botão 2, alternativa ao ombro | — | minas, propulsor, gerador de reparo, fumaça |
| **Peito** | ninguém | média | terceiro gatilho (a decidir) | — | feixe térmico, projetor de escudo |
| **Cabeça** | ninguém | leve | terceiro gatilho (a decidir) | — | marcador de alvo, laser de ponto, sensor |

**Como um robô novo se declara** (o que o Comandante traz do Tripo3D vira dado assim): os encaixes que tem, a classe máxima de cada um, de onde cada tiro nasce (`muzzles`) e qual botão atira em cada grupo (`triggers`, `combat/mounts.ts`). Hoje isso está espalhado entre `ARM_SLOTS` (listas escritas à mão), `MOUNTS` (quatro bocas fixas: duas mãos e dois ombros) e o rig importado (`shoulderPods`). **O contrato que junta tudo está feito (`claude/tipos-de-encaixe`, sem mudar o jogo):** `combat/mountKinds.ts` (`WEAPON_MOUNTS`: cada arma declara os tipos de encaixe onde cabe, e arma nova que não declara não compila; `KIND_MAX_CLASS`: a classe máxima de cada tipo), `SLOT_KIND` em `entities/chassis.ts` (o tipo de cada ranhura do Hangar) e `mountKinds.test.ts`, que confere que **toda lista de todo chassi obedece** (a arma cabe no tipo da ranhura e a classe dela, na visão do chassi, não passa do que o tipo aceita). Costas, peito e cabeça ficam em `LIVE_KINDS` de fora: reservados.

**O que existe e o que não:** braço e ombro **existem** (e o ombro só no Marauder). **Costas, peito e cabeça não existem como encaixe**: criar um pede (a) um tipo novo em `MOUNTS` com a parte do corpo de que depende (`MOUNT_PART`), (b) a boca de cada robô, (c) o desenho no rig, (d) o **evento de tiro da rede** (hoje o encaixe cabe em 2 bits: 4 encaixes, e já estão usados; passar a 3 bits exige subir o protocolo), e (e) o terceiro gatilho para peito e cabeça (tecla e botão de toque, a decidir).

**Decisões que são do Comandante (nada disto trava o resto):**
- **Peito e cabeça num terceiro botão?** Proposta: uma tecla de "sistema" (ex.: F) e um botão de toque, para o que não é arma de combate direto (feixe, marcador).
- **Ombro e costas são o mesmo botão 2** (um ou outro, ou os dois juntos) ou duas armas diferentes? Proposta: o mesmo botão e a mesma arma, para não pedir mais um botão.
- **Quais robôs ganham ombros primeiro?** Proposta: a **Onça** (pesada, procedural) e, depois, os importados que o Comandante trouxer.

## 8. Ataque 1 e Ataque 2 (ordem P95, 12/10)

> *"Os robôs têm ataque 1 e ataque 2, sendo arma 1 as dos braços e arma 2 a dos ombros/costas/peitoral (podendo ser configurado assim) nos robôs maiores que comportem mais de uma possibilidade de combinar armas. Nos robôs pequenos de entrada, o braço direito e o esquerdo ficam cada um com um botão do mouse, permitindo melhores combinações."*

**O vocabulário** (vale para o jogador, o Hangar, o HUD, as dicas e a documentação; "botão principal" e "botão 2" saem do texto que o jogador lê): **Ataque 1** = o clique do mouse (no toque, ATQ 1); **Ataque 2** = o clique direito ou Q (no toque, ATQ 2). No código, é `TriggerLayout.primary` e `.secondary` (`combat/mounts.ts`), e `attackOf` diz qual ataque aciona cada encaixe.

| Robô | Ataque 1 | Ataque 2 | Combina assim |
|---|---|---|---|
| **Pequeno de entrada** (Vector-09, Arara, Gênesis, Quadra, Onça, Bastion, Colossus; o Lancer e o andróide têm a variante deles) | **braço direito** | **braço esquerdo** | uma arma de cada lado, cada uma no seu botão: plasma no 1 e foguetes no 2; blaster no 1 e gelo no 2; rotatória no 1 e canhão pesado no 2 |
| **Grande** (o Marauder, hoje) | **os dois braços**, juntos (cada mão com a sua arma) | **os dois ombros** (e, um dia, costas e peito) | as mãos no 1 e uma arma de ombro no 2: duas blasters no 1 + míssil teleguiado, sônico, foguetes ou chuva no 2 |
| **Lancer** | braço direito | o escudo da esquerda (o clique direito levanta a chapa) | arma + escudo |

**O que o jogador vê agora (12/10, 1ª parte):** o Hangar rotula cada encaixe com o ataque que o aciona (**BRAÇO DIREITO · ATAQUE 1**, **OMBROS · ATAQUE 2**), o HUD escreve **ATQ 2 · TELEGUIADO**, o menu e a pausa dizem "clique ATAQUE 1: … · clique dir. / Q ATAQUE 2: …", e as configurações e os botões de toque também. **O jogo já atirava assim**; o que mudou é o nome.

**O que falta: o "podendo ser configurado assim".** Hoje cada robô tem **um** layout de gatilhos, fixo. Nos robôs com mais de uma possibilidade (os que têm ombros) o jogador deve poder **escolher no Hangar como os encaixes se dividem entre os dois ataques**. Plano, em ordem:
1. **Layouts nomeados por chassi** (`CHASSIS[<id>].layouts`, o primeiro é o padrão) e a escolha no `LoadoutSpec` (campo novo, entra no link e é validada pelo servidor). Para o Marauder: **"braços no 1, ombros no 2"** (o de hoje) e **"direito no 1; esquerdo e ombros no 2"** (como os pequenos, com os ombros de reforço).
2. **Várias armas diferentes no mesmo ataque.** Hoje o Ataque 2 leva **uma arma só**, a mesma em todos os encaixes dele (os dois ombros). O segundo layout pede a **arma do braço esquerdo e a dos ombros** no mesmo clique direito: a `Armament` passa a resolver a arma de cada encaixe e a ter cadência, carregador e calor **por arma**, sem mudar o que já existe quando há uma só (os testes de hoje seguem valendo).
3. **Costas e peito como encaixes do Ataque 2** (§ 7: novo tipo em `MOUNTS`, boca por robô, desenho, evento de tiro com mais bits e protocolo novo). Com 2, as armas de ombro, de costas e de peito disparam **juntas** no Ataque 2, cada uma do seu lugar.

**Decisão do Comandante, se quiser:** quando o Ataque 2 tem armas diferentes (ombro + costas + peito), elas disparam **todas juntas** (proposta, a mais simples) ou o jogador **alterna** entre elas? Nada disto trava o resto.
