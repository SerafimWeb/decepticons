# ARMAS DO BOTÃO 2 — ombros, costas, peito e tecnologias além da mão

> Aberto em 11/10/2026 (Claude), a pedido do Comandante (ordem **P77**): *"a maioria das armas que fizemos é para as mãos, temos que pensar as armas pro botão 2, seja nos
> ombros, costas, peitoral, etc, vamos VARIAR as armas e tecnologias. As armas de som combinam em ficar nos ombros."*
> Contrato de arma em geral: `ARSENAL.md`. O que é real hoje: `STATUS_REAL.md`. Este arquivo é o **mapa de ideias com o custo de cada uma**, para o Comandante escolher a ordem.

## 1. O que existe hoje (lido no código em 11/10)

| Lugar do corpo | Quem tem | O que leva | Observação |
|---|---|---|---|
| Mão direita (botão 1) | todos | arma de energia/aço/fogo | `ARM_SLOTS.right` |
| Mão esquerda (botão 2) | todos menos o Lancer | arma de energia ou foguete/chuva | `ARM_SLOTS.left`; no Marauder vira a 2ª mão do botão 1 |
| **Ombros** (botão 2) | **só o Marauder** | foguetes, chuva de mísseis e agora o **canhão sônico** | `ARM_SLOTS.marauder.shoulders`; as duas bocas disparam juntas |
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

1. **Dado:** `WeaponId` e entrada em `BASE` (`combat/weapons.ts`); comportamento novo = campo opcional e tipado (`wave`, `flame`, `barrage`), nunca `if (id === …)`.
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
| 2 | **Míssil teleguiado** | ombros | sobe e persegue o ponto da mira por ~1,5 s | *homing* no `RocketSystem` (determinístico) | M | mira de equipe; combinar com o sônico (empurra, o míssil acerta) |
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
