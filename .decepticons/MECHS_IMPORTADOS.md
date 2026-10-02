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
| Braços abertos | o Mixamo exporta em T-pose | `armRest` |
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
4. **A-pose** (braços pendurados, um pouco à frente) em vez de T-pose. T-pose funciona (`armRest`), mas deforma o ombro.
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
| `armRest` | `{ lower, forward, elbow? }`: baixa e adianta os braços; com `elbow` o antebraço fica na horizontal (arma em punho) | só se o arquivo vem em T-pose |
| `weaponMounts` | as mãos somem e a arma da montagem se encaixa no pulso | só se o modelo não traz arma |

**Convenção da animação** (o código a garante; `importedMechRig.test.ts` a trava com modelo **girado**): quadril positivo
leva o pé para a frente (-Z); joelho negativo dobra o pé para trás; pitch positivo no ombro sobe a mão para a frente.
Os eixos são sempre os do Mech (`MechRig.model`), nunca os da cena importada.

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

**Outros encaixes (reservados, não existem ainda):** ombros e costas (`HANGAR.md`: "ombros e torso = módulos"): o mesmo contrato
(nó + escala + módulo), acrescentando uma classe de tamanho (P, M, G) que a arma declara e o encaixe confere.

**Limites conhecidos (R13)**
- **Só o Marauder usa.** Os procedurais (Vector-09, Arara, Onça, Colossus, andróide) têm cano e casulo fixos no antebraço;
  Gênesis, Lancer e Bastion trazem a arma no próprio modelo. A arma só muda de desenho onde há `weaponMounts`.
- No Marauder cada braço aceita uma arma só (`ARM_SLOTS`): hoje o que se vê trocar é o **nível** (MK I a III). Ver outras armas
  depende do catálogo por encaixe (`ROADMAP.md`, IDEIAS).
- Braço destruído some com o módulo, mas a malha do braço fica (malha única; `FINDINGS.md`).
- O ponto de tiro da simulação sai do desenho (`MechBase.muzzleLocal`) e o servidor desenha todo Mech como Vector-09: no Marauder
  os dois diferem cerca de 1 m (`FINDINGS.md`).

## 5. Trazendo o próximo robô: roteiro

1. **Gerar** com o pedido da §6.
2. **Rigar** (Mixamo): em A-pose se o serviço aceitar; senão T-pose, e o `armRest` resolve.
3. **Registrar:** `CHASSIS` e `ARM_SLOTS` (`entities/chassis.ts`), `IMPORTED_CHASSIS` (§3) e o Hangar (`ui/HangarMenu.ts`: título, classe, sigla).
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
