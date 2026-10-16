# ARSENAL — como criar e configurar armas e robôs

> Escrito em 04/10 depois de criar a escopeta (PR #154) e a chuva de mísseis, para ninguém redescobrir a lista. Robô importado:
> `MECHS_IMPORTADOS.md`. Encaixes e gatilhos: `combat/mounts.ts`. O que cada coisa é de verdade hoje: `STATUS_REAL.md`.

## Ataque 1 e Ataque 2 (12/10, ordem P95)

O jogador fala em **Ataque 1** (o clique) e **Ataque 2** (o clique direito ou Q); no código são o gatilho `primary` e o `secondary` de `TriggerLayout`. **Robôs pequenos:** braço direito = Ataque 1, braço esquerdo = Ataque 2. **Robôs grandes:** braços = Ataque 1, ombros (e, um dia, costas e peito) = Ataque 2. Texto novo para o jogador nunca diz "botão 2" nem "principal/secundário": diz Ataque 1 e Ataque 2. O modelo e o que falta (layouts configuráveis, várias armas no mesmo ataque) estão em `ARMAS_DE_BOTAO_2.md` § 8.

## Classes de arma e tamanhos de robô (11/10, ordem P82 do Comandante)

> *"As armas devem ter 3 diferentes tamanhos (leve, média, pesada), e robôs gigantes usam armas pesadas como leves (pra eles), mas é a arma pesada normal dos outros robôs (os do tamanho 2, padrão principal do jogo). Futuramente faremos versões das armas para o tamanho 3 e 4."*

Duas coisas separadas: a **classe** da arma (o porte dela: leve, média ou pesada; **não é o peso**, que sobe com o nível MK) e o **tamanho** do robô
(`CHASSIS_SIZE` em `entities/chassis.ts`: 1 andróide, **2 Mechs, o padrão do jogo**, 3 e 4 gigantes; é a "escala" do `GAME_DESIGN.md`). Tudo mora em `combat/weaponClass.ts` (a tabela `WEAPON_FIT` e a conta `classFor`).

| Classe (no tamanho 2) | Armas |
|---|---|
| **Leve** | blaster, motosserra, escopeta, arma elétrica (arco), lançador EMP, lançador de mísseis leve |
| **Média** | canhão de plasma, arma de gelo, canhão sônico, canhão automático, metralhadora rotatória, casulo de foguetes, míssil teleguiado, raio laser |
| **Pesada** | canhão pesado, lança-chamas, canhão de trilho, chuva de mísseis, míssil cruzador |

**A regra, uma conta só:** a classe é relativa a quem carrega, e cada passo de tamanho sobe duas classes, então **a pesada do tamanho N é a leve do tamanho N+1**.

| Quem carrega | Leves dele | Médias dele | Pesadas dele |
|---|---|---|---|
| Mech (**tamanho 2**) | as leves da tabela | as médias | as pesadas |
| Gigante (**tamanho 3**, o Colossus) | **as pesadas dos Mechs** (canhão pesado, lança-chamas, trilho, chuva) | *versões de tamanho 3: futuro* | *versões de tamanho 3: futuro* |
| Gigante maior (**tamanho 4**) | as pesadas do tamanho 3 (futuras) | *futuro* | *futuro* |
| Andróide (tamanho 1) | (a conta desce: a leve dos Mechs é a pesada dele) | — | — |

**O que mudou no jogo (P82):**
- O **Hangar agrupa as armas por classe** (LEVES, MÉDIAS, PESADAS) pela classe que o **chassi** enxerga; o andróide fica numa lista só. No Colossus tudo cai em **LEVES**, com a nota "tamanho 3: o que é pesado nos Mechs comuns é leve para ele".
- O **Colossus só oferece as pesadas dos Mechs** (canhão pesado, trilho, lança-chamas na mão principal; canhão, trilho e chuva na outra); plasma, foguetes, automático e rotatória saíram dele: para um gigante são pequenos demais. Os Mechs (tamanho 2) **não perderam nada**.
- O **Colossus do jogador** sai da fábrica com **canhão pesado + chuva de mísseis** (`COLOSSUS_PLAYER_STATS`). **O chefe da missão segue com plasma e foguetes** (`COLOSSUS_BOSS_STATS` intacto): trocar a arma do encontro mexe no equilíbrio dele, decisão em aberto.
- Link `?build=` ou montagem salva do Colossus com arma média ou leve passa a ser recusada (`encaixe`); o servidor cai na montagem de fábrica. A **Arara-B1 é tamanho 2** (o Hangar, o `HANGAR.md` e o `UNIVERSO.md` a chamavam de "escala 1", que é o andróide).
- A ficha de cada arma na landing do site diz a classe.

**Mudar uma arma de classe** é uma linha em `WEAPON_FIT` (e a lista da tabela em `weaponClass.test.ts`); ela troca de grupo no Hangar e, se virar pesada, passa a caber no Colossus sozinha. A classificação de hoje é a proposta do Claude: **leve até ~2,5 t, média 3 a 4 t**, e **pesada**
o que já era só dos chassis pesados por decisão do Comandante (canhão pesado, lança-chamas) mais as duas que mais pesam depois do canhão (trilho e chuva, 5 t). O Comandante ajusta.

**Como criar a versão de tamanho 3 (futuro):** é uma **arma nova** (um `WeaponId` próprio, por exemplo um canhão do tamanho do gigante) com `WEAPON_FIT` `{ class: 'heavy', size: 3 }` e os números em `BASE`; entra na lista do gigante em `ARM_SLOTS` e **não** nas dos Mechs
(o teste `nenhum encaixe oferece arma que o tamanho do chassi não carrega` trava isso). Só precisa existir como **média** e **pesada**: a leve do tamanho 3 já existe, é a pesada do 2 (outro teste proíbe declará-la). Nada na regra muda.

**O projeto dessas armas — os nomes, o papel e os números — está na `fichas/armas-de-tamanho-3-e-4.md`** (proposta Qwen, 12/10): a regra de escala (dano ×1,8, calor ×1,5, **peso ×2**, alcance ×1,3, cadência ×0,75), as quatro primeiras armas e as perguntas ao Comandante. O passo a passo abaixo continua sendo o **como**; a ficha é o **quê**.

## O que já é só ajustar número (sem código)

**Configurações → POTÊNCIAS** (`tuning/power.ts`): por arma, multiplica dano, cadência, calor e alcance; por clã (jogador, Mechs
rebeldes, andróides), vida, velocidade e calor. Vale para toda arma nova sozinho (a lista vem de `WEAPON_IDS`). O link
`?potencias=` leva o ajuste a outra pessoa. Não cria arma nem robô: só mexe nos números que já existem.

**Números de partida de uma arma** moram na tabela `BASE` de `combat/weapons.ts` (dano, intervalo, calor, carregador, alcance,
raio da explosão, peso). Os três níveis (MK I a III) saem sozinhos da mesma regra; o equilíbrio é travado por teste.

## Arma nova: a lista

Uma arma que **só usa campos que já existem** (dano, cadência, alcance, explosão) pede os passos 1, 4, 5, 6 e 7. Uma que **se
comporta de um jeito novo** (a escopeta não precisou; a chuva de mísseis sim) pede todos.

1. **Dados:** `WeaponId` e uma entrada em `BASE` (`combat/weapons.ts`). Comportamento novo vira um campo opcional e tipado da
   arma (a chuva tem `barrage`), nunca um `if (id === ...)` espalhado. Quatro tabelas `Record<WeaponId, …>` também exigem a arma nova (o typecheck quebra se faltar): `DAMAGE_TYPE` (natureza do dano), `WEAPON_FIT` (classe e tamanho, `combat/weaponClass.ts`, P82), `WEAPON_MOUNTS` (em quais tipos de encaixe cabe: braço, ombro, costas, peito, cabeça, `combat/mountKinds.ts`, P84) e `FIRE_KICK` em `combat/fireFeel.ts` (quanto o tiro faz a câmera tremer; 0 para corpo a corpo).
2. **Regra no tick fixo:** projétil comum não precisa de nada. Comportamento novo é um módulo próprio (`combat/XSystem.ts`, como o
   `BarrageSystem`): pool fixo, `fixedUpdate`, `clear`, `render`, callbacks `onFired` e `onExplode`. Liga no `sim/Match.ts` (criar,
   passo, três `clear`, explosão) e no `core/Game.ts` (desenho). Sem `Math.random`, `Date.now` nem DOM (G1/G2): o desenho de
   uma chuva é uma conta do ponto da mira, não um sorteio.
3. **Quem atira:** o jogador local (`PlayerController`) e o servidor (`NetPilot`) usam a mesma regra (`combat/Armament.ts`) e
   cada um só diz **de onde** o tiro sai e **para onde** vai (`ShotSink`). Comportamento novo entra nesses dois `sink`.
4. **Equilíbrio:** `combat/balance.ts` já conta carregador, calor e cadência; arma com efeito próprio diz quanto conta num alvo
   parado (`Barrage.onTarget`) para a bancada não mentir. Escreva as metas em `combat/weapons.test.ts`: sozinha, uma arma que
   derruba um Mech leva mais de 4,5 s; com outra, mais de 2,5 s; arma de apoio, bem mais (a chuva, mais de 10 s).
5. **Hangar:** `ui/HangarMenu.ts` (`WEAPON_HINT`, `WEAPON_ICON`) e **em quais chassis e em qual encaixe ela vai** (`ARM_SLOTS` em
   `entities/chassis.ts`; a carga conta pelo peso e por encaixe: dois ombros pesam o dobro).
6. **Desenho:** `entities/weaponModels.ts` (o `switch` do `build`) vale para os robôs com encaixe de arma desenhado (hoje o
   Marauder). Os procedurais (Vector-09, Onça, Colossus, Arara) desenham a arma no próprio rig, em `entities/mechBlueprint.ts`: o
   braço direito é um cano fixo; o esquerdo, o casulo de foguetes, ou liso quando a arma é a chuva de mísseis, que vira um morteiro
   nas costas (`buildBackMortar`, oculto até ser equipado; o gancho é o `mountWeapons`). **Arma nova num procedural = um grupo
   oculto no rig + um ramo em `mountWeapons`**; nunca mova a boca de simulação por arma (G14, ver o comentário no rig). O Lancer
   usa a arma do `.glb` dele.
   **A cara do tiro (P160):** uma entrada em `WEAPON_LOOK` (`fx/weaponLook.ts`, `Record`: o typecheck exige) — o brilho da cabeça do projétil,
   o clarão da boca, o clarão do acerto, a marca que fica na parede, o rastro em fita e se o acerto explode, cada um com a cor do jogador e a de
   aviso do inimigo (o teste `fx/WeaponFx.test.ts` trava a cor igual). Também `IMPACT_FX` (`fx/impactFx.ts`, as partículas do acerto).
7. **Rede** (se a arma atira): `NET_WEAPONS` em `shared/net/events.ts` (**só no fim**) e `PROTOCOL_VERSION` + 1 em
   `shared/net/constants.ts`; `server/ArenaRoom.ts` (o `onFired` do sistema vira o evento de tiro) e
   `net/OnlineSession.ts` `remoteShot` (o desenho do tiro do outro jogador). **Subir o protocolo recusa quem está com a versão
   velha: o servidor precisa estar atualizado antes (`DEPLOY.md`).**
8. **Site:** a landing e a Oficina leem o código (`scripts/site/dados.mjs`); rode `npm run site -- --check` e olhe se a arma
   nova não entrou num número que ela não devia (a carga de fábrica, "uma arma sozinha ≥ ...").
9. **Registro:** `STATUS_REAL.md` (o que é real e o que é só desenho), `HISTORICO_DE_DECISOES.md`, `ESTADO_ATUAL.md`, `ROADMAP.md`.

Teste de mutação nas regras novas (estrague a regra e veja o teste cair) é o que garante que o teste serve.

## Robô novo

- **Malha importada** (a via de hoje): `MECHS_IMPORTADOS.md` do pedido ao gerador ao PR. Comandos: `npm run mech:inspecionar -- arquivo.glb`
  (confere o arquivo) e `npm run mech:bocas -- <id>` (mede de onde cada arma atira e confere com o dado do chassi).
- **Dados:** `CHASSIS`, `CHASSIS_SIZE` (o tamanho: 1 andróide, 2 Mechs, 3 e 4 gigantes) e `ARM_SLOTS` em `entities/chassis.ts` (vida, velocidade, calor, carga, o que cada encaixe aceita) e, se o
  robô atira por mais de uma mão ou tem ombros, `triggers` e `muzzles` (`combat/mounts.ts`).
- **Mais de um gatilho por lado, ombros:** já existe (Marauder). Peito, cabeça e costas são ideia (`ROADMAP.md`).
- **Corpo que não é bípede** (cão-robô, esteira, drone): ideia, ainda sem plano de corpo no código (`ROADMAP.md`).

## Mísseis, laser e a calibragem do alcance (P152, 15/10, Claude)

> *"melhorar os estilos de armas... lançador de mísseis leve (8, 16 ou até 32 sequencialmente), raio laser de longo alcance, míssil cruzador de longo alcance, míssil guiado de médio alcance... calibrar melhor o alcance, potência, tempo de recarga"* — ordem P152 do Comandante. As decisões e o porquê de cada número: `HISTORICO_DE_DECISOES.md` (15/10).

**As três mecânicas novas, como modelos para a próxima arma do mesmo tipo:**

- **Salva comprometida** (o lançador de mísseis leve, `swarm`): o campo `salvo` (`cone`, `onTarget`) e `tierMagazine` (o carregador cresce ×2 por nível: 8, 16, 32). A regra mora no **`RocketLauncher`** (`committed`: a salva só começa com os tubos cheios, não se cancela e só recarrega depois do último míssil) e no **`Armament`** (continua pedindo o tiro enquanto `committed`, com o botão solto). O desvio de cada míssil sai de `spreadAt(número do míssil, cone)` e o `ShotSink.rocket` ganhou o 4º parâmetro (`spread`): o jogador (`PlayerController.launch`) e o servidor (`NetPilot`) o aplicam à direção **antes** de lançar, então o evento de tiro já leva a direção com o desvio e o outro jogador desenha igual. Os mísseis vão para um pool à parte no `RocketSystem` (128, um `InstancedMesh`, rastro de uma partícula a cada três ticks). A bancada conta só a fração `onTarget` dos mísseis (como a chuva conta as bombas).
- **Arco** (o míssil cruzador, `cruise`): `CruiseSystem` (módulo próprio, G3). O caminho é uma **parábola** do lançamento ao ponto da mira (`cruisePoint`, função pura), percorrida a velocidade constante (`cruiseRate`); o ponto de chegada é o chão (ou o telhado) sob a mira, e a mira além do alcance cai no limite dele. Um raio curto por tick acha o que está no caminho (parede, prédio mais alto que o arco, Mech), menos o dono. O jogador passa o ponto da mira pelo gancho `PlayerController.cruise`; o servidor, pelo mesmo ponto que a chuva já usa (`NetPilot.aim(..., needPoint)`); o outro jogador acha o ponto por um raio do evento de tiro.
- **Feixe** (o raio laser, `beam`): `Match.beamPulse` acerta **na hora** o primeiro que o raio da boca encontra (`projectiles.onHit`: o mesmo caminho de defesa, parte e abate de um tiro) e `fx/BeamVisuals` acende a linha (dois `InstancedMesh`, pool de 40, acesa 0,16 s para os pulsos de 0,13 s virarem um feixe contínuo). `ShotSink.beam` é **opcional**: quem não sabe desenhar feixe recebe o pulso como projétil comum. **Um evento de tiro por pulso** (a bandeira do byte `fx` não coube: os 8 bits estão ocupados); o outro jogador acende o feixe com `Match.drawBeam`. Os bots ainda não a usam (`armaServeAoBot` exclui `beam`).
- **Guiamento por nível** (`tierGuide`): o guiado (`seeker`) afina a curva e o alcance da trava a cada nível; o cone da trava é da mira do jogador e não muda.

**O que tocar numa arma desse tipo** (além da lista da seção de cima): a ficha do ARSENAL (`ui/arsenalData.ts`, `notasDaArma`), a mira (`WeaponReticle`), os desenhos 3D de ombro e de mão (`weaponModels.ts`), o estouro (`fx/explosionScale.ts` escala pelo raio da explosão: explosão pequena e muitos mísseis não enchem as partículas), o HUD (`ui/rocketPips.ts`: carregador de mais de quatro vira fração dos quatro marcadores) e **uma linha em `FAIXAS` de `combat/calibragem.test.ts`**. Rede: `NET_WEAPONS` **no fim**, `PROTOCOL_VERSION` + 1, o `onFired` do sistema (ou `Match.onBeam`) em `server/ArenaRoom.ts` e o ramo de `net/OnlineSession.remoteShot`. Teste de ponta a ponta: `net/online.test.ts` (o outro jogador vê).

**Faixas de alcance** (`rangeBandOf`, pelo alcance **máximo**): corpo a corpo até 3 m, **curto** até 60, **médio** até 200, **longo** acima. O preço do alcance é o dano por segundo: nenhuma arma de longo alcance de Mech passa o plasma (com 10% de folga), travado por `combat/calibragem.test.ts`, que também fixa a faixa de cada arma e a recarga cheia (`fullReload`, de vazio a cheio). MK I, na bancada do Vector-09 (DPS sustentado = dano por segundo com o calor e a recarga):

| Arma | Classe | Faixa | Alcance ótimo / máx (m) | Dano | Cadência (s) | Recarga cheia (s) | DPS sustentado | Carga (t) |
|---|---|---|---|---|---|---|---|---|
| Motosserra (`chainsaw`) | LEVE | corpo a corpo | 1,2 | 4 | 0,2 | — | — | 1,5 |
| Canhão sônico (`sonic`) | MÉDIA | curto | 10 / 22 | 20 | 1,2 | — | 17,3 | 3 |
| Lança-chamas (`flamer`) | PESADA | curto | 17 / 36 | 10 | 0,2 | — | 35,0 | 3,5 |
| Escopeta (`shotgun`) | LEVE | curto | 8 / 50 | 9 × 6 (balins) | 0,8 | — | 68,4 | 2 |
| Arma de gelo (`cryo`) | MÉDIA | curto | 20 / 55 | 5 | 0,6 | — | 8,5 | 3 |
| Metralhadora rotatória (`rotary`) | MÉDIA | médio | 35 / 95 | 5 | 0,05 | — | 42,5 | 4 |
| Lançador EMP (`emp`) | LEVE | médio | 45 / 110 | 9 | 1,3 | — | 7,2 | 2,5 |
| Blaster leve (`blaster`) | LEVE | médio | 25 / 120 | 4 | 0,4 | — | 10,1 | 0,5 |
| Chuva de mísseis (`barrage`) | PESADA | médio | 120 | 30 × 8 bombas | 1 | 12,0 | 12,0 | 5 |
| Arma elétrica (`arc`) | LEVE | médio | 50 / 130 | 7 | 0,45 | — | 15,6 | 2,5 |
| Canhão automático (`autocannon`) | MÉDIA | médio | 50 / 140 | 10 | 0,2 | — | 35,0 | 3,5 |
| Lançador de mísseis leve (`swarm`) | LEVE | médio | 150 | 5 × 8 (16 e 32 nos níveis) | 0,07 | 2,8 | 7,2 | 2 |
| Míssil teleguiado (`seeker`) | MÉDIA | médio | 170 | 55 × 2 | 0,5 | 6,4 | 20,2 | 4 |
| Canhão de plasma (`plasma`) | MÉDIA | médio | 60 / 200 | 16 | 0,22 | — | 41,6 | 3 |
| Casulo de foguetes (`rockets`) | MÉDIA | longo | 225 | 40 × 4 | 0,3 | 8,8 | 22,7 | 4 |
| Canhão pesado (`cannon`) | PESADA | longo | 90 / 260 | 90 | 2,6 | — | 36,0 | 6 |
| Canhão de trilho (`railgun`) | PESADA | longo | 140 / 320 | 72 | 1,4 | — | 33,6 | 5 |
| Raio laser (`laser`) | MÉDIA | longo | 180 / 360 | 6 | 0,13 | — | 34,8 | 4 |
| Canhão de cerco (`siege`) | PESADA (T3) | longo | 140 / 400 | 360 | 4,5 | — | 60,0 | 12 |
| Míssil cruzador (`cruise`) | PESADA | longo | 420 | 90 | 1 | 6,0 | 15,0 | 5 |

**A regra dos 4,5 s (P111) e os mísseis:** o lançador leve e o cruzador foram calibrados contra ela (a bancada, todo nível e combo do Marauder). O lançador conta só 55% dos mísseis numa nuvem de 2,6° e vale como pressão (7 a 8 de dano por segundo, golpe de abertura de 40 a 224 se todos acertarem); o cruzador bate 90 / 108 / 126 (dois acertos nunca bastam, como o canhão pesado). **Para mudar um número sem código:** Configurações → Potências (dano, cadência, calor e alcance por arma); com código, a entrada em `BASE` (`weapons.ts`) e, se a faixa mudar, a linha de `FAIXAS` no teste.

**Honestidade (R13):** ninguém jogou nem ouviu as três; os números são proposta do Claude (o ouvido e a mão são do Comandante). Os bots não usam as três. O míssil de outro jogador voa reto no desenho (o dano e a explosão são do servidor).

## A cara de cada tiro: rastro, explosão, clarão e marca (P160, 16/10, Claude)

O que o tiro **parece** mora em `fx/weaponLook.ts` (dado, uma linha por arma), separado do que ele **faz** (`combat/weapons.ts`); quem desenha é
o `fx/WeaponFx.ts`, que a simulação de tiro avisa por um campo opcional (`fx` do `ProjectileSystem`, `RocketSystem`, `CruiseSystem`,
`BarrageSystem`: `fired`, `flying`, `impact`, `landed`, `trail`). **O servidor deixa esse campo vazio e não paga nada.**

| Peça | Onde | O que é |
|---|---|---|
| Clarão da boca, brilho da cabeça, clarão do acerto | `fx/Billboards.ts` | cartazes de luz virados para a câmera (glow, estrela de 4 pontas, aro, língua de pólvora), 1 desenho para todos |
| Rastro em fita | `fx/Ribbons.ts` | a fumaça e o fogo do motor de foguete, míssil, cruzador, bombas da chuva e obus: fita contínua que abre, sobe e se desfaz (era uma fila de pontos) |
| Explosão com corpo | `fx/Explosions.ts` | clarão, bola de fogo low-poly que ferve, fumaça escura de verdade, estilhaços que quicam, faíscas; escala com o `blastRadius` |
| Marcas | `fx/Marks.ts` | queimado no chão, furo quente na parede (aro na cor do tiro que esfria), geada do gelo; clarão no asfalto e onda de choque rente ao chão |
| Raio iônico do trilho | `fx/BeamVisuals.ts` | o feixe do laser, mais grosso e na cor do trilho (era uma linha de 1 px) |

**Para mexer no visual de uma arma** (cor, tamanho do brilho, rastro, marca): só a linha dela em `WEAPON_LOOK`. A explosão de um Mech destruído é
`WeaponFx.wreck` (do tamanho do robô). Custo medido: 0,45 ms por quadro com 170 fitas, 219 peças de explosão, 160 cartazes e 80 marcas ao mesmo
tempo (carga extrema); nada alocado por quadro. O Estúdio (aba TIROS E ARMAS, P157) vai editar esta tabela.

### Balins da escopeta (P160 parte 2, 16/10)

A escopeta sai em **nove balins num cone de 3,4°** (`pellets` na arma; `damage` é o de cada balin). Os balins nascem dentro do `ProjectileSystem.fire`,
então valem igual para o jogador, os bots, o servidor e o desenho do tiro de outro jogador, a partir de **um** evento de tiro, num desenho fixo
(`spreadAt` com o número do balin; sem sorteio). Medido com física de verdade, o disparo inteiro num Vector-09: **54 até 10 m**, 45 aos 15–20 m, 32 aos
25–30 m, 15 aos 40 m e 10 aos 50 m (aos 40 m o cone tem 4,8 m e só 5 balins pegam). O tempo para derrubar um torso de perto não mudou (4,0 s no
MK I, 3,2 s no MK II e III). No jogo, os balins que acertam o mesmo alvo juntos viram **um** número de dano e **um** som de acerto.

## O que ainda não é dado puro (honestidade)

Comportamentos de arma são código. O caminho para uma arma nova ser **só dado** é uma lista de padrões de disparo (reto, em arco,
chuva, rajada, feixe) escolhidos por um campo da arma, cada um com seu sistema testado. Hoje há cinco (reto, chuva, salva, arco e feixe; mais o cone do lança-chamas e da onda). Um editor
visual que cria arma e robô sem mexer em código **não existe**; as POTÊNCIAS são o mais perto disso.

## Trilho e EMP (06/10, Codex)

`chargeTime` usa `ChargeTimer` em Armament e na bancada: só dispara após a carga inteira, cancelada por soltar o gatilho, perder o braço, trocar montagem ou superaquecer. `empHeat` passa por `EmpEffect` e aquece o alvo conforme a distância; o bloqueio ocorre pela regra existente de superaquecimento, sem impedir caminhar. `tracer` escolhe o desenho no pool de projéteis. Procedurais e Marauder usam os mesmos modelos; a boca física continua a do chassi. Cada nova arma também ganha uma mira em `WeaponReticle`.

O protocolo atual é 6 (catálogo inclui geradores frontal/esférico; formato de pacote do 5). O dono pediu que o servidor público offline não fosse tocado hoje: validação online somente com servidor local efêmero. Quando o servidor público voltar, deve usar este código/protocolo; não houve tentativa de atualização dele nesta entrega.


## Compatibilidade ampliada — 06/10, Codex

ARM_SLOTS compartilha engates de energia entre Mechs; não duplicar listas na UI ou no site. validateLoadout continua árbitro de massa e encaixe. Armament mantém lançadores por mão quando o principal é munição (Onça); rearm renova os carregadores. Procedurais usam weaponModel nas variantes fora do canhão/casulo de fábrica, mantendo a boca física fixa. GLBs integrados ainda não trocam aparência.

Próximas propostas (não equipáveis): feixe térmico contínuo com exigência de mira/calor e arpão magnético com contrajogo/massa/rompimento do cabo. Não são novos IDs do catálogo ainda.

## Estados de fogo, choque e gelo — 09/10, Claude

Arma que **aplica um estado** no alvo usa o campo `inflicts` (`'burn' | 'shock' | 'chill'`) na entrada de `BASE`; o resto é do contrato de
`combat/StatusEffects.ts` (`.decepticons/ARMAS_ELEMENTAIS.md`): o `CombatSystem` aplica no acerto que chega ao corpo, o `Match` faz o tempo
correr antes dos pilotos, o `MechBase` lê `status` (velocidade, travas de tiro, dano recebido), e o servidor manda o byte `fx` de cada unidade.
Números em `STATUS` (um lugar só); resistência por chassi em `MechStats.statusResist`. **Arma que não atira projétil** (lança-chamas,
rotatória) liga `status.flaming`/`status.spinning` no dono em vez de mandar um evento por tiro. A rotatória (`spin` na entrada de `BASE`) é o modelo: a regra fica em `SpinUp` (`trigger.ts`), o desvio em `spread.ts` (por número de tiro, sem sorteio), o servidor sai cedo em `ArenaRoom.shot` quando a arma tem `spin`, e o outro jogador desenha o fluxo pela bandeira, lendo a arma da montagem do roster. A elétrica (`inflicts: 'shock'`, `tracer: 'arc'`) é o modelo das armas de projétil que aplicam estado: o `CombatSystem` só aplica quando pelo menos `STATUS.shieldPass` do dano passou pelas defesas, e a cor da faixa vem do `tracer` (`ProjectileSystem`).

## Armas do botão 2 (ombros, costas, peito) — 11/10, Claude

O mapa de ideias com o custo de cada uma, o que existe hoje por lugar do corpo e o contrato de uma arma de botão 2 estão em **`.decepticons/ARMAS_DE_BOTAO_2.md`**. O canhão sônico (`sonic`) é o modelo de **arma de ombro com efeito de área e empurrão**: campo `wave` na arma (`Wave`: meio ângulo e velocidade do empurrão), `ShotSink.wave`,
`Match.waveCone` (a regra) e `MechBase.push` (o empurrão). Arma nova de ombro = **uma entrada em `ARM_SLOTS[chassi].shoulders`** (e a carga conta por boca); os registros `IMPACT_FX`, `MUZZLE_FX`, `FIRE_KICK`, mira e Hangar quebram o typecheck se faltarem.

## Anel de fogo (módulo de escudo `fire`) — 11/10, Claude

O anel de fogo não é arma: é o terceiro `ShieldId` do gerador de energia (`combat/EnergyShield.ts`, números em `FIRE_RING`). Módulo novo de escudo = uma entrada em `SHIELDS` (o Hangar, a carga e a rede leem dali) +
o que ele **faz**: aqui `combat/FireRing.ts`, chamado pela partida (`Match.ringTick`) quando o gerador marca um pulso (`consumePulse`). O desenho: `ShieldVisuals` (o que fica no chão) e um `fx/…Visuals.ts` próprio
(as partículas), os dois pela bandeira de escudo ligado que já viaja na rede. Falta fazer: o texto do Hangar (`hangar-module-select`) e o rótulo do HUD (`ShieldHUD`) são strings soltas, não leem `SHIELDS`.

## Armas de aço (tiro de metal) — 11/10, Claude

O canhão pesado (`cannon`) e o canhão automático (`autocannon`) são o modelo de **arma de projétil que se vê como metal**, não como luz: `tracer: 'shell'` (obus) ou `'slug'` (projétil fino) na entrada
de `BASE`. O `ProjectileSystem` troca a faixa de luz por um **corpo de aço sólido** (`fx/kineticShot.ts`: `KINETIC` tem as medidas, `buildSlugGeometry` a bala) com a cauda quente atrás (mais
fina que o corpo, senão ela o lava). Três tabelas `Record<WeaponId, …>` a mais pedem uma decisão por arma nova: `MUZZLE_FX` (`fx/muzzleFx.ts`: o clarão da boca; `null` = o genérico do jogador; `casing`
solta o estojo), `IMPACT_FX` (o impacto) e, para o rastro de partículas no voo, `TRAIL_FX` (`fx/impactFx.ts`: gelo e obus). Quem fecha a conta de equilíbrio é a bancada: **arma nova confira o combo
com os foguetes MK III e com ela mesma nas duas mãos** (`steelWeapons.test.ts` é o modelo): a 1ª conta do canhão (100 de dano a cada 2,4 s) violava a meta de 2,5 s. Ao calibrar por `sed`, ancore
no nome da arma (um `sed` por números pegou o lança-chamas junto).

## Reação do alvo ao acerto (P69, 12/10, Claude)

Todo acerto que passa pela defesa **empurra** o alvo (`MechBase.push`) e dá um **tranco no torso** dele (`MechBase.flinch`, só desenho): a conta e a tabela estão em `combat/reaction.ts` e a ligação, em `CombatSystem.react` (acerto direto: para onde o tiro andava; explosão: para longe do centro). **Arma nova não declara nada:** ela herda pela **natureza do dano** (`PUSH_PER_DAMAGE`: balístico 0,05 m/s por ponto, explosivo 0,04, laser 0,02, térmico 0,015, gelo 0,01; pulso, som, corte e choque, zero) até `HIT_PUSH_MAX` (4,5 m/s). Arma que **não** deve empurrar (um fluxo, um cone com o empurrão dela) é a que tem `flame` ou `wave`.

## Armas dos bots do esquadrão (P91, 12/10, Claude)

O bot de um esquadrão (`sim/esquadrao.ts`) pode levar qualquer arma da mão principal do chassi **que ele sabe usar**: energia sem rotação de cano, chama, onda, carga nem míssil guiado (`armaServeAoBot`; hoje plasma, blaster, escopeta, EMP, arco, gelo, canhão automático e, nos pesados, o canhão pesado). **Arma nova de energia simples entra sozinha**; uma com mecânica própria (`spin`, `flame`, `wave`, `guide`, `barrage`, `chargeTime`) só entra quando a IA aprender o gatilho dela (`BotSystem` solta o projétil comum da arma principal). `Match.esquadrao.test.ts` põe **cada** arma permitida num bot e exige que ela acerte o jogador em 30 s: arma nova que o bot "usa" e não machuca falha lá. A distância de tiro vem da arma (`BotController.baseRange`: 1,25 vez o alcance ótimo, no máximo os 38 m do tipo de robô, no mínimo 10 m): uma arma curta nova puxa o bot para perto sem tocar em mais nada.

## Natureza do dano — 06/10, Claude

Toda arma declara a natureza do dano em `DAMAGE_TYPE` (`client/src/combat/weapons.ts`): o `Record` quebra o typecheck se faltar. Os escudos físicos (`MetalShield.ts`) resistem por natureza. Arma sônica futura usa `sonico` (o Amortecedor já está pronto para ela).
