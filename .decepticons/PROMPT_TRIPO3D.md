# Prompt para o Tripo3D: o próximo robô, do jeito certo

> Pedido do dono (10/10): *"crie um prompt para eu fazer esse robô lá no Tripo3D desde o começo dele do jeito certo, para trazer ele perfeito para cá"*.
> Este arquivo é o atalho: **copie o bloco do formato que você quer, cole no Tripo, e siga a lista "No Tripo" no fim**.
> O contrato completo do arquivo (esqueleto, escala, punho) está em `MECHS_IMPORTADOS.md`; aqui só o que você precisa para pedir.

## O texto-base (vale para qualquer robô)

```text
Heavy bipedal combat mech, hard-surface industrial design, perfectly symmetrical left and right, standing in a relaxed A-pose
(arms hanging slightly forward, elbows slightly bent, arms about 30 degrees away from the torso), facing the camera.
No hands and no fingers: each forearm ends in a smooth round flange or coupling plate. No weapons.
One continuous model with clean armor plates and no loose or floating parts.
Every limb is a clearly separated clean volume: the arms never touch the torso or the hips, the legs never fuse together,
with a visible gap between each arm and the body. Feet flat on the ground.
No cables, cloth, capes, flags, antennas or thin parts hanging loose.
Chunky readable silhouette made of large clean armor plates, low-poly game-ready.
Plain white background, no ground, no shadow.
```

## Escolha o formato e acrescente a linha dele no meio do texto-base (antes de "Chunky readable silhouette")

| Formato | Linha para acrescentar | Aviso honesto |
|---|---|---|
| **Pesado de cerco** | `wide heavy torso, huge rounded shoulder armor blocks with a flat top surface, short thick legs with big knee armor, small head sunk between the shoulders` | O jogo encaixa lançadores nos ombros: deixe o topo plano. |
| **Corredor** | `tall and slim, narrow torso, long legs with reversed knees like a bird, long forearms, small pointed head` | Joelho invertido anima, mas pode ficar estranho andando. Testar com o inspetor. |
| **Canhão de ombro** | `compact torso with one oversized armored cylinder on each shoulder, stubby arms, wide stable stance` | O que o código já suporta melhor. |
| **Quatro braços** | `four arms: the upper pair is the main pair in A-pose ending in smooth flanges, the lower pair is smaller and held close against the torso` | O segundo par fica **parado, preso ao tronco** até existir animação e tiro para quatro braços (projeto de arquitetura no ROADMAP). |

## No Tripo (nesta ordem)

1. Gere e **olhe de frente e de lado antes de aceitar**. Braço encostado no corpo ou perna colada não se conserta depois: gere de novo.
2. Contagem de faces em torno de **20 mil** (o jogo aguenta 15 a 25 mil por robô; as malhas cruas de 130 mil a 1,9 milhão **não servem**).
3. Use o **auto-rig humanoide** e exporte **`.glb` com o esqueleto**. Malha sem esqueleto não anda.
4. Se editar no Blender, **mantenha a armature**.
5. Entregue o arquivo com o **nome do robô** e o **papel** que você imagina (tanque, rápido, atirador…). O agente roda `npm run mech:inspecionar -- arquivo.glb` e liga no Hangar.

## O que já existe nas suas pastas e ainda não entrou no jogo

- `LANCER 3d model RIG.glb` (15,9 mil triângulos, rigado) e `military walker 3d model_Clone1 rig.glb` (15,1 mil, 10,8 MB): prontos para o inspetor.
- `CICUTA2.glb` e `ZEROCIRCUIT.glb` (1,9 milhão de triângulos, sem esqueleto): precisam de retopologia (~20 mil faces) e rig antes.
- O robô de **quatro braços** que você tem em `d:\imagens cybermech\modelos 3d`: diga o nome do arquivo e eu rodo o inspetor. Nenhum esqueleto atual tem osso de quarto braço, então ele entra com o segundo par parado.
