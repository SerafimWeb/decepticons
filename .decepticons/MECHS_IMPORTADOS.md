# MECHS_IMPORTADOS — o contrato do robô de malha importada

> **Para quem vai trazer o próximo robô** (um `.glb` de Tripo3D, Mixamo ou de onde vier). Pedido do dono, 02/10:
> *"o próximo robô temos que fazer com mais inteligência, pra não ficarmos nessa luta pra corrigir eles"* e
> *"os robôs não têm que ter dedos: temos que pensar um formato pras mãos deles e outros suportes de armas, pra mudarmos
> de armas de forma mais facilitada e prática"*. Este documento é a resposta: o que o arquivo precisa trazer, o que o
> código resolve sozinho e como a arma se encaixa. Os detalhes de cada defeito achado estão em `FINDINGS.md`.

## 1. Onde cada robô custou caro, e o que resolveu

| Sintoma | Causa raiz | Resolvido em |
|---|---|---|
| Mech entrava de costas | o arquivo olha para +Z (padrão glTF); o jogo olha para -Z | `rotationY: Math.PI` no `IMPORTED_CHASSIS` |
| Perna sumia de quadro | o eixo de giro de um osso Mixamo é o do exportador, não o do jogo | `AxisCorrectedJoint` mede os eixos |
| Passada de costas, joelho e mira invertidos (nos quatro chassis) | os eixos eram medidos no referencial do arquivo, não no do Mech | referencial = `model` do rig (`FINDINGS.md`, 01/10) |
| Robô invisível, escala 10⁻³⁷ | malhas ocultas da armadura com limites absurdos na `Box3` | `Box3` só de `isMesh` (registro do Gemini, 30/09) |
| Malha "amassada" | skin quebrado ao clonar uma cena já escalada | cena dentro de um `Group`, escala no grupo (idem) |
| Armadura parada no ar | malha **sem skin** (`skinned: 0` no `.glb` antigo do Marauder) | arquivo refeito; o inspetor (§5) acusa `sem-skin` |
| Braços abertos | o Mixamo exporta em T-pose | `armRest` (pose por direção) |
| Ombro "quebrado" depois de baixar o braço a 81° | a ombreira está presa ao osso do braço e gira junto; a pele suave amassa a junta (e a pele rígida, testada, vira estilhaços) | braço no máximo ~50° abaixo da horizontal, antebraço dobrado para a frente |
| O braço saltava de 1,9 a 4,8 m ao atirar (Gênesis: 1,9 m para baixo no direito e 2,7 m para cima no esquerdo) | o coice escrevia `position.z` do osso, que tem o eixo e a unidade do arquivo | `MechRig.setRecoil`, em metros para trás |
| Mão com dedos que não segura nada; arma que não troca | o modelo não tem arma (ou traz uma fixa) | encaixe de arma (§4) |

## 2. O contrato do arquivo

**Obrigatório**
1. **Esqueleto com os 11 ossos que o jogo anima:** quadril, tronco, cabeça, braço (ombro) e mão de cada lado, coxa e canela
   de cada lado. Nomes Mixamo (`mixamorigHips` …) ou mapeados em `boneNames`. Com encaixe de arma, o **antebraço** (o pai da
   mão) é obrigatório: é nele que o encaixe nasce.
2. **Malha com skin:** o corpo inteiro ligado ao esqueleto. Malha estática ao lado de uma com skin é escondida pelo código
   (duplicata de T-pose), mas armadura sem skin fica parada no ar.
3. **Frente em +Z, pés em Y = 0.** A escala não importa: o jogo escala pela altura do chassi em `entities/chassis.ts`.

**Desejável (corta trabalho depois)**
4. **A-pose** (braços pendurados, um pouco à frente) em vez de T-pose. T-pose funciona (`armRest`), mas a ombreira costuma estar presa ao osso do braço: quanto mais o braço baixa da horizontal, mais ela gira e amassa. No Marauder, 81° ficou quebrado e 50° ficou limpo (`arte/marauder-ombro-antes-depois.png`). Peça o gerador com a ombreira separada do braço, ou presa ao tronco.
5. **Antebraço terminando num punho liso, sem mão nem dedos e sem arma desenhada.** Mão com dedos funciona (some por
   encolhimento do osso), mas pode deixar a ponta do antebraço esticada.
6. **Tamanho na ordem do Marauder:** ~20 mil triângulos (medido, robô com as duas armas) e 611 KB. O orçamento de download
   de um `.glb` ainda não foi decidido (Gênesis-01 tem 3,3 MB; ver `HISTORICO_DE_DECISOES.md`, 30/09).

## 3. O que o código resolve sozinho, e o que fica por chassi

`IMPORTED_CHASSIS[<id>]` em `entities/importedMechAssets.ts`:

| Campo | Para quê | Quando usar |
|---|---|---|
| `url` | o arquivo | sempre |
| `rotationY` | `Math.PI` se o arquivo olha para +Z | quase sempre |
| `boneNames` | nomes de osso fora do padrão Mixamo | só se não for Mixamo |
| `armRest` | `{ upper, fore? }`: a pose do braço **por direção** no referencial do Mech (frente -Z, cima +Y, lado direito em +X; o esquerdo é o espelho). `upper` é para onde aponta o braço (ombro até o cotovelo); `fore`, o antebraço (cotovelo até o pulso). Marauder: `upper [0.62, -0.77, -0.15]` e `fore [0.1, 0, -1]` (arma em punho) | se o arquivo não vem na pose de combate (T-pose) |
| `weaponMounts` | as mãos somem e a arma da montagem se encaixa no pulso | só se o modelo não traz arma |

**Convenção da animação** (o código a garante; `importedMechRig.test.ts` a trava com modelo **girado**): quadril positivo
leva o pé para a frente (-Z); joelho negativo dobra o pé para trás; pitch positivo no ombro sobe a mão para a frente.
Os eixos são sempre os do Mech (`MechRig.model`), nunca os da cena importada.

**Coice dos braços** (`MechRig.setRecoil(direito, esquerdo)`): em **metros para trás** (+Z do Mech), qualquer que seja o eixo e a unidade do osso (o
deslocamento é escrito no referencial do pai e dividido pela escala acumulada dele). O `MechBase` chama com 0,35 m (direito) e 0,5 m
(esquerdo) vezes o recuo; rig sem `setRecoil` (os procedurais) segue escrevendo `position.z` do braço. Medido nos quatro `.glb` reais:
todos recuam 0,35 e 0,5 m para trás, como o Vector-09 (`arte/coice-antes-depois.png`).

## 4. O punho: nenhum robô tem dedos

**Decisão (proposta do dono, 02/10):** o braço termina num **engate universal**, não numa mão: colar + flange + duas travas
luminosas (`coupling`, em `entities/weaponModels.ts`). A arma é um **módulo à parte** que se encaixa nele.

Por quê: (1) mão com dedos não segura nada sem animação de pegada e sem arma com cabo, e uma malha única não deixa tirar
os dedos; (2) trocar de arma passa a ser trocar um módulo, sem tocar no robô; (3) o mesmo contrato serve a qualquer chassi.

**Como funciona**
- `entities/weaponMount.ts` → `createWeaponMounts`: em cada pulso cria o **ponto de encaixe** (`hardpoint`), um nó filho do
  antebraço com **frente (-Z) ao longo do antebraço, cima (+Y) o mais perto possível do cima do Mech e escala = o
  comprimento do antebraço**. Encolhe o osso da mão (escala 0,001): os vértices da mão e dos dedos colapsam no pulso e o
  flange cobre a emenda. A orientação sai da pose final do braço (`armRest`), então o módulo aponta para onde o antebraço aponta.
- `MechRig.mountWeapons(loadout)` (opcional) monta as armas: `primary` no direito, `secondary` no esquerdo; sem arma, o engate
  fica tampado. O `MechBase` chama ao nascer e a cada `equip` (o Hangar chama `equip` ao mudar a montagem). É idempotente: a
  mesma arma não refaz nada; trocar de arma troca só o módulo.
- Os nós de boca (`rig.muzzle`, `rig.leftMuzzle`) moram no encaixe e acompanham a ponta da arma (o teste de disparo do Hangar usa).

**O módulo de arma** (`entities/weaponModels.ts`): **unidade = 1 antebraço**; origem = centro da placa de engate; **frente = -Z**,
cima = +Y; começa sempre com o `coupling`; **uma malha só** (`batchRigMeshes`), montada uma vez por arma e nível e clonada
(geometria e material compartilhados); `muzzle` = a boca. Hoje: canhão de plasma, casulo de foguetes, blaster leve e
motosserra, cada um em MK I, II e III (o nível muda o desenho: aletas e capacitores, grade de tubos 2×2 / 2×3 / 3×3, comprimento).
Catálogo visual: `arte/armas-modulos.png`.

**Custo:** 1 draw call por arma; o Marauder inteiro desenha em 3 (corpo + duas armas). Nada alocado por quadro; a montagem custa
no nascimento do Mech e na troca de arma.

**Arma nova:** (1) os dados em `combat/weapons.ts`; (2) uma função de desenho em `weaponModels.ts` no padrão acima; (3) o id na
lista de `weaponModels.test.ts`.

**Ombros (03/10, só o Marauder):** `IMPORTED_CHASSIS.<id>.shoulderPods = { x, y, z, size }` (com `weaponMounts`) põe um lançador de foguetes
em cada ombro: o nó nasce preso ao **osso do torso** (acompanha a inclinação da mira), na posição `x, y, z` do ombro direito no
referencial do Mech em repouso (metros a partir dos pés, `z` = a traseira do lançador; o esquerdo é o espelho em x) e escala `size`
metros por unidade do módulo. O desenho é `weaponModels.podModel` (o casulo de tubos sem o engate do pulso, uma malha só). Medir os
ossos com a pose de repouso: o ombro do Marauder está em x 0,79, y 4,55 e a ombreira chega a y 4,8; o lançador assenta em cima.

**Bocas por encaixe (obrigatório se o robô tem encaixe de arma):** o servidor não tem o desenho importado (usa o corpo procedural do
Vector-09), então o ponto de onde cada tiro nasce é **dado do chassi**: `MechStats.muzzles` em `entities/chassis.ts` (quatro bocas, em metros
a partir dos pés, virado para -Z). Depois de mexer no rig, na pose (`armRest`), em `shoulderPods` ou no módulo de uma arma:
```
npm run mech:bocas -- marauder
```
carrega o `.glb`, mede as quatro bocas com a montagem de fábrica, imprime medido × dado e sai com código 1 se alguma passar de 15 cm
(roda dentro do `npm run check`). Sem `muzzles` no chassi, imprime o bloco pronto para colar.

**Outros encaixes (reservados, não existem ainda):** peito, cabeça e costas (`HANGAR.md`): o mesmo contrato (nó + escala + módulo),
acrescentando a classe de arma (leve, média, pesada: `combat/weaponClass.ts`, P82) que a arma declara e o encaixe confere.

**Limites conhecidos (R13)**
- **Só o Marauder usa.** Os procedurais (Vector-09, Arara, Onça, Colossus, andróide) têm cano e casulo fixos no antebraço;
  Gênesis, Lancer e Bastion trazem a arma no próprio modelo. A arma só muda de desenho onde há `weaponMounts`.
- No Marauder cada mão aceita blaster ou plasma e os ombros, foguetes (`ARM_SLOTS`); a mão esquerda é a segunda arma do botão
  principal (`Loadout.offhand`) e o secundário é dos ombros (`MechStats.triggers`).
- Braço destruído some com o módulo, mas a malha do braço fica (malha única; `FINDINGS.md`).
- O servidor desenha todo Mech como Vector-09: a boca de cada encaixe do robô importado é dado do chassi (`muzzles`, acima). O
  jogador remoto também é desenhado como Vector-09 no cliente (`FINDINGS.md`).

## 5. Trazendo o próximo robô: roteiro

1. **Gerar** com o pedido da §6.
2. **Rigar** (Mixamo): em A-pose se o serviço aceitar; senão T-pose, e o `armRest` resolve.
3. **Registrar:** `CHASSIS` e `ARM_SLOTS` (`entities/chassis.ts`), `IMPORTED_CHASSIS` (§3) e o Hangar (`ui/HangarMenu.ts`: título, classe, sigla). Com encaixe de arma: `npm run mech:bocas -- <id>` e colar o `muzzles` no chassi.
4. **Inspecionar o arquivo, antes de escrever código:**
   ```
   npm run mech:inspecionar -- client/public/models/novo.glb --id novo
   ```
   Carrega o `.glb` com o mesmo carregador do jogo e imprime: tamanho do arquivo, triângulos, malhas e skin; o esqueleto (Mixamo, Tripo
   ou desconhecido) e os ossos que faltam; antebraço e dedos; a pose de repouso (T-pose, A-pose ou pendurado); para onde o robô olha
   (com a certeza da medida); os **achados** (ERRO, AVISO, info); a **checagem da convenção da animação** com a sugestão aplicada; e a
   **entrada pronta do `IMPORTED_CHASSIS`**. Fotografa o robô em `.tmp/inspecao/<id>/inspecao.png` (frente, três quartos, lado, costas,
   dois passos e mira para cima e para baixo, com as armas encaixadas). Sai com código 1 se achar erro. Exemplo em `arte/inspecao-marauder.png`.
   Limites: a frente vem de uma medida do pé, que no Marauder (garra simétrica) fica fraca; quando a certeza não é "medida", o inspetor
   assume +Z (padrão glTF e Mixamo) e manda conferir o painel "frente" da foto, que deve mostrar a frente do robô.
   A convenção usa sondas presas nos ossos, então vale para qualquer pose de repouso.
5. **Conferir antes do PR:** o Hangar de frente e de três quartos, e o robô andando e mirando para cima e para baixo; guardar as
   capturas em `arte/` (regra 16 do `AGENTS.md`).
6. **Teste:** o robô novo passa pelo mesmo caminho de `importedMechRig.test.ts`. Regra nova de eixo ou de pose se testa com
   modelo **girado**: o teste com modelo sem rotação aprovou o erro dos quatro chassis.

## 6. Pedido para o gerador (modelo de texto)

Sem garantia: o gerador pode ignorar partes. O que protege é o contrato da §2 e a conferência da §5.

> Heavy bipedal combat mech, hard-surface industrial design, symmetrical, standing in a relaxed **A-pose** (arms hanging
> slightly forward, elbows slightly bent), facing the camera. **No hands and no fingers**: each forearm ends in a smooth round
> flange or coupling plate. **No weapons.** One continuous model with clean armor plates and no loose or floating parts.


## 7. Pedido ao Tripo3D por formato, e o que a auditoria de 10/10 achou

> Pedido do dono, 10/10: *"crie um prompt para eu fazer esse robô lá no Tripo3D desde o começo dele do jeito certo, para trazer ele perfeito para cá"*.
> **O atalho para colar no Tripo está em `PROMPT_TRIPO3D.md`** (o dono não achou este §7 no meio do contrato); aqui fica o raciocínio e a auditoria.
> **Use o texto da §6 como base** e acrescente, no fim, as linhas abaixo. O que ele precisa respeitar é o contrato da §2.

**Acréscimos ao texto da §6 (valem para qualquer formato):**

> Perfectly symmetrical left and right. Every limb is a clearly separated clean volume: the arms never touch the torso or the hips,
> the legs never fuse together, and there is a visible gap between each arm and the body (arms about 30 degrees away from the torso).
> Feet flat on the ground. No cables, cloth, capes, flags, antennas or thin parts hanging loose. Chunky readable silhouette made of
> large clean armor plates, low-poly game-ready. Plain white background, no ground, no shadow.

**Formato** (cole **um** destes no meio do texto, antes de "Chunky readable silhouette"):

| Formato | Acrescente | Aviso honesto |
|---|---|---|
| Pesado de cerco | `wide heavy torso, huge rounded shoulder armor blocks with a flat top surface, short thick legs with big knee armor, small head sunk between the shoulders` | O jogo já encaixa lançadores nos ombros: deixe o topo plano. |
| Corredor | `tall and slim, narrow torso, long legs with reversed knees like a bird, long forearms, small pointed head` | Joelho invertido anima, mas pode ficar estranho andando: testar com o inspetor antes de afirmar. |
| Canhão de ombro | `compact torso with one oversized armored cylinder on each shoulder, stubby arms, wide stable stance` | O que o código já suporta melhor. |
| Quatro braços | `four arms: the upper pair is the main pair in A-pose ending in smooth flanges, the lower pair is smaller and held close against the torso` | **O segundo par fica parado, preso ao tronco**, até existir animação e tiro para quatro braços (projeto de arquitetura, `ROADMAP`). Sem isso é o "rabo da Onça" de novo: bonito e sem função. |

**No Tripo:** (1) gere e **olhe de frente e de lado antes de aceitar**: braço encostado no corpo ou pernas coladas não se conserta depois, gere de novo;
(2) contagem de faces em torno de **20 mil** (o jogo aguenta 15 a 25 mil por robô); (3) use o auto-rig humanoide e exporte `.glb` **com o esqueleto**;
(4) se editar no Blender, **mantenha a armature**; (5) entregue o arquivo com o nome do robô e o papel que o dono imagina (tanque, rápido…), e o agente
roda `npm run mech:inspecionar` (§5) e liga no Hangar.

**O que a auditoria das pastas do dono achou (10/10, leitura só do cabeçalho dos `.glb`):**
- As malhas **cruas** do Tripo têm 130 mil a **1,9 milhão** de triângulos e **nenhum esqueleto**: não servem no navegador. Os robôs que entraram no
  jogo têm 14 a 20 mil triângulos, com skin (o Marauder, 0,6 MB).
- `CICUTA2.glb` e `ZEROCIRCUIT.glb` (78 a 79 MB, 1,9 milhão de triângulos, sem esqueleto) estavam **dentro do repositório** desde 01/10 (entraram junto com um
  commit de Google Analytics) e eram publicados no site sem ninguém usar. **Removidos em 10/10**; os originais continuam na pasta do dono
  (`REMODELAGEM GLB FINAL`). Para trazê-los, precisam de retopologia (~20 mil faces) e rig.
- **Rigados e ainda fora do Hangar:** `LANCER 3d model RIG.glb` (15,9 mil triângulos) e `military walker 3d model_Clone1 rig.glb` (15,1 mil, 10,8 MB, pesado).
- **O Quadra-V2 não tem malha própria no jogo** (a entrada dele em `IMPORTED_CHASSIS` está desligada desde o `gemini/rig-fix`): ele usa o corpo do Vector-09. `quadra-v2.glb` (14 mil triângulos, Mixamo) está em `public/models` e ninguém o carrega; `lancer-l1.glb` e `lr-7l-bastion.glb` também estão sem uso (o Lancer usa `TZLA1.glb` e o Bastion, `LR7L.glb`). Religar o Quadra é barato e é o primeiro passo para o papel de escaramuçador **parecer** diferente.
- **Nenhum esqueleto tem osso de quarto braço.** Um robô de quatro braços, se já existe, é malha sem rig ou tem o segundo par colado no tronco.

## Bot com chassi importado (P91, 12/10, Claude)

Um bot do esquadrão pode ter o chassi de um robô importado (`CHASSIS_DOS_BOTS`), mas **nunca a malha**: o servidor não carrega `.glb`, e o bot vive na simulação. Ele leva os **números do chassi** (vida, passo, dash, escudo de metal) e o corpo procedural do Vector-09 (o Arara e a Onça têm o deles, `entities/blueprintByChassis.ts`). Robô importado novo entra sozinho na lista de chassis dos bots; para ele ganhar a silhueta própria no bot, o caminho é um blueprint procedural, não o `.glb`.

## 8. O Colossus v4 (P100, 12/10, Qwen): o laudo do arquivo, o rig consertado e a lição do armRest

> **Status: RESOLVIDO no mesmo dia.** O rig foi refeito por **script no Blender headless** (`.tmp/rig-construir.py`):
> esqueleto de **17 ossos com nomes Mixamo** (medidos a partir dos pesos bons do rig antigo), pele refeita por *bone heat*,
> **decimate 98.304 → 24.576 triângulos** e texturas 2048 → 1024 (**8,6 MB → 2,6 MB**). O inspetor passa (mixamo, 17 ossos,
> com antebraço, frente -Z medida) e o vazamento da pele é ≤ 2,7% da altura. O laudo abaixo fica como registro do arquivo
> que chegou.
>
> **A segunda lição (custou uma rodada): o `armRest`.** O arquivo veio com os braços **pendurados** (A-pose) e o módulo da
> arma aponta para onde o **antebraço** aponta — sem `armRest`, o canhão de cerco apontava **para o chão** (o
> `npm run mech:bocas` mediu a mão a 3,83 m de altura num titã de 20 m). Com `armRest: { upper: [0.62,-0.77,-0.15],
> fore: [0.1,0,-1] }` (a mesma pose do Marauder) as bocas caem certas: **mão a 13,51 m de altura e 9,18 m à frente**.
> **Regra nova: todo robô importado que leva arma de código precisa de `armRest`**, mesmo que a pose de repouso dele seja
> boa — a pose de repouso é do corpo, não do cano.

> **Pedido do dono (12/10):** *"adicionei um novo modelo na pasta /blender/colossusv4, leve ele para o hangar, veja se está correto a armadura, ossos, etc, ou se devo melhorar ele no blender. ele é do tamanho 4, bem maior que o colossus v3"*.
> **Em uma linha:** **não entra no Hangar ainda** — o esqueleto tem 11 ossos e **faltam quatro dos que o jogo anima** (tronco, cabeça e as duas mãos), e os braços são **um osso só**. O dono **re-riga** e manda de novo; as decisões dele estão na **P100**.

**O arquivo:** `D:\imagens cybermech\BLENDER\colossusv4.glb` (o `.blend` ao lado). Medido com `npm run mech:inspecionar`, 12/10.

| Medida | Valor | Referência |
|---|---|---|
| Tamanho do arquivo | **8,6 MB** | Marauder 0,6 MB · Gênesis 3,3 MB |
| Triângulos | **98.304** | o jogo aguenta 15 a 25 mil por robô; o Marauder, ~20 mil com as duas armas |
| Malhas | 1, **com skin** (é o contrato) | — |
| Materiais e texturas | 1 material · 3 texturas, a maior 2048 px | peso no download |
| Esqueleto | 11 ossos, **sem animação** | — |
| Pose de repouso | braços pendurados (0° da vertical) — **boa** | dispensa `armRest` |
| Frente | +Z assumida (o pé não decidiu) | → `rotationY: Math.PI`; conferir na foto |
| Tamanho na cena | 1,00 × 0,99 × 0,62 unidades | não importa: o jogo escala pela altura do chassi |

**O esqueleto, osso por osso** (nomes do arquivo; ao carregar, o Three troca o espaço por `_`):

```
pelvis ─┬─ pelvis L ─┬─ arm L                      (um osso só: sem antebraço, sem mão)
        │            └─ thigh L ─ shin L ─ foot L
        └─ pelvis R ─┬─ arm R
                     └─ tight R ─ shin R ─ foot R   ← "tight": é `thigh R`
```

**O que o jogo exige e o arquivo não tem** (`DEFAULT_BONES`, `entities/importedMechRig.ts`): `torso`, `head`, `leftHand`, `rightHand`. Os braços ainda nascem no **mesmo nó das pernas** (`pelvis L`/`pelvis R`): não há tronco entre o quadril e o ombro, então não existe mira nem torção de tronco. O carregador **lança erro** ("osso não encontrado") e o `Game` cai no corpo procedural do Vector-09 com os números do chassi — por isso **nada foi ligado**: um chassi ligado assim mostraria o Vector-09, não o arquivo novo.

**O brief do re-rig** (o que pedir ao Blender/Tripo/Mixamo):
1. **Refazer o rig** em vez de remendar: o auto-rig humanóide do **Tripo3D** (a ponte `Tripo3d_Blender_Bridge` está instalada nesta máquina) ou o **Mixamo** entrega o conjunto de uma vez. **Usar os nomes do Mixamo** (`mixamorigHips`, `mixamorigLeftArm`…) dispensa `boneNames` por completo: o jogo lê os nomes de fábrica.
2. A hierarquia que o jogo anima: quadril → tronco → cabeça; quadril → coxa → canela → pé (nos dois lados); tronco → **braço → antebraço → mão** (nos dois lados). O **antebraço** é obrigatório quando o robô leva arma de código: é nele que o encaixe nasce (`weaponMount.ts`).
3. Corrigir o nome `tight R` (é `thigh R`).
4. Enxugar: **decimate de 98 mil para 15–25 mil triângulos** e texturas 2048 → 1024 (alvo ≤ 1 MB).
5. Olhar a simetria: o eixo X vai de −0,486 a +0,510 (~2,4% de diferença entre os lados).
6. **Manter o que já está certo:** malha única com skin, braços pendurados (não é T-pose), **sem arma desenhada**, pés no chão.

**A escala 4 tem um portão antes do Hangar.** A escolha do dono (12/10) **ressuscita a P11** ("Mechs de tamanho 4 e 5", de 28/09, que estava sem registro): o `RobotSize` 4 já existe no tipo, mas **nenhuma arma cabe nele hoje** — todas as armas são `size: 2` e a regra (`combat/weaponClass.classAt`) só deixa o tamanho 4 usar arma declarada `size: 3`. Ou seja, **um robô de tamanho 4 entra sem arma nenhuma** até existirem as versões de arma de tamanho 3/4 — exatamente o "futuramente faremos versões das armas para o tamanho 3 e 4" da **P82**. A **altura** também é decisão do dono (a P11 falava em "10× e 20× maiores"; o Colossus, escala 3, tem 14 m; o Mech padrão, 5,3 m).

**O que já está pronto para quando o arquivo voltar:** copiar o `.glb` para `client/public/models/`, registrar `CHASSIS`, `ARM_SLOTS`, `CHASSIS_SIZE`, `CHASSIS_PAPEL`, `IMPORTED_CHASSIS` (§3) e o Hangar (`ui/HangarMenu.ts`), rodar `npm run mech:inspecionar -- <arquivo> --id colossusv4` e, com encaixe de arma, `npm run mech:bocas`.

**Foto do laudo:** `.decepticons/arte/colossusv4-malha-qwen.png` (6 vistas da malha crua — o rig não monta). **O veredito da armadura é do dono: eu não leio imagem.**
