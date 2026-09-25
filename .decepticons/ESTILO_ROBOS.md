# ESTILO DOS ROBÔS — guia visual e briefing para IA de imagem

> Pedido do dono (2026-09-25): "criar o style sheet dos robôs para dar caras melhores a eles, fazendo as imagens numa IA
> externa". As imagens são **referência de conceito**: os modelos do jogo continuam sendo montados por código a partir
> de primitivas (`entities/meshKit.ts`), sem modelagem manual (`GAME_DESIGN.md`, "Produção: tudo em código"). Por isso o
> briefing pede formas que dê para construir com caixas e cilindros.
> Fonte das cores: `client/src/core/palette.ts` e as variáveis do `client/src/styles.css`.

## 1. O jogo em uma frase

CYBERMECH é um shooter de Mechs no navegador: a humanidade pilota robôs de combate para defender uma cidade neon contra
IAs rebeldes. Visual low-poly neon, estilo "Tron": cidade escura com linhas de luz ciano, pink e amarelo fluorescente.

## 2. Regras de estilo (valem para todos)

- **Hard-surface em blocos:** peças retas, chanfros simples, cilindros; nada orgânico, sem cabos soltos nem detalhe
  miúdo ("greeble"). Parece um brinquedo modular robusto, não um desenho técnico cheio de parafusos.
- **Silhueta legível de longe e no celular:** cada robô reconhecível só pela sombra.
- **Seis partes que dá para ler:** cabeça, torso, braço esquerdo, braço direito, perna esquerda, perna direita. No jogo,
  cada uma tem vida própria e pode ser arrancada: as juntas precisam ser visíveis.
- **Encaixes de arma:** braço direito = arma de energia (canhão de plasma); braço esquerdo = arma de munição (casulo de
  foguetes). Ombros e costas guardam espaço para módulos (dissipador, radar, escudo).
- **Calor:** respiros de dissipador visíveis nas costas e nas laterais do torso (no jogo eles acendem em laranja quando o
  Mech esquenta).
- **Leitura de combate pela cor:** verde neon é sempre do jogador; vermelho é sempre das IAs rebeldes. O cenário usa
  ciano, pink e amarelo fluorescente. **Nunca só azul e roxo.**
- **Materiais:** casco pintado fosco, estrutura em metal escuro (aço grafite), visores e faixas emissivas (luz própria).
- **Proibido:** parecer Transformers, Gundam, Pacific Rim, Titanfall ou MechWarrior; logotipos ou marcas reais (inclusive
  das empresas de IA que dão nome aos bots); texto na imagem.

## 3. Paleta

| Papel | Cor |
|---|---|
| Jogador: pintura | `#E0A21A` amarelo de perigo |
| Jogador: visor e faixas | `#39FF6A` verde neon |
| IAs rebeldes: pintura | `#8C1F22` vermelho escuro |
| IAs rebeldes: visor e faixas | `#FF2D3D` vermelho aceso |
| Técnico: visor | `#E8FF1A` amarelo fluorescente |
| Estrutura (todos) | grafite `#1E2224` e blindagem em aço `#5D6163` |
| Propulsores e foguetes | laranja `#FF8A1F` |
| Andróide: casco | branco quente `#F0F2E8` |

## 4. Personagens

| Robô | Escala | Descrição |
|---|---|---|
| **VECTOR-09** (o jogador) | Mech, 5,3 m | Assalto ágil, ombros largos, pernas digitígradas curtas e fortes, cabeça pequena com visor em faixa. Canhão de plasma no antebraço direito; casulo de 4 tubos de foguete no esquerdo; dois propulsores nas costas. Amarelo com verde neon |
| **Mechs rebeldes** | Mech, 5,3 m | O mesmo chassi tomado pelas IAs, vermelho escuro com visor vermelho. Três personalidades (os nomes são dos bots no jogo): **CLAUDE, o brabo** (placas extras de blindagem na frente, postura inclinada para o ataque); **GEMINI, o soldado** (padrão, equilibrado); **CHATGPT, o fujão** (mais leve, cabeça com sensores grandes, postura de quem espreita) |
| **Andróide de combate** (QWEN, DEEPSEEK, MISTRAL) | Humanoide, 2 m | Parecido com os humanoides de hoje, sem copiar nenhum: casco branco liso, estrutura escura, faixa de visor vermelha, blaster no antebraço, mochila de baterias. Ágil, magro |
| **Técnico** (ANTHROPIC) | Humanoide, 2 m | O mesmo corpo do andróide, visor amarelo, ferramenta de reparo no lugar do blaster (emite um feixe amarelo), mochila maior com peças |
| Futuro: **Ferret-X** | Mech leve, ~4,5 m | Rápido, pernas longas, pouca blindagem |
| Futuro: **Colossus-01** | Mech pesado, ~6,5 m | Largo, blindagem grossa, atravessa paredes no dash |
| Futuro: **cão-robô rebelde** | Quadrúpede, ~1 m de altura | Baixo e rápido; obriga a mirar para baixo |
| **Níveis de arma** (Hangar) | — | Canhão de plasma e casulo de foguetes em MK I, MK II e MK III: cada nível maior e mais elaborado (mais aletas, mais brilho, mais tubos), com a mesma silhueta básica |

## 5. O que pedir em cada imagem (formato da prancha)

- **Um personagem por prancha**, em "character turnaround sheet": vista de frente, lateral, costas e 3/4, na mesma escala,
  lado a lado. Ortográfica (sem perspectiva forte), pose neutra em pé (A-pose).
- Fundo cinza médio liso ou escuro liso; iluminação uniforme de estúdio, sem cenário.
- Uma silhueta humana de 1,8 m ao lado, em cinza, para escala.
- Amostras de cor da paleta na borda da prancha (quadrados sem texto).
- Uma prancha extra por robô com as peças separadas ("exploded view": cabeça, torso, braços, pernas, armas), útil para
  montar em código.
- Formato 16:9, alta resolução. Sem texto nem letras na imagem (IA de imagem erra texto; os rótulos entram depois).

## 6. Texto para a IA de imagem

**Contexto (colar antes do pedido):**

> I'm art-directing a browser mech shooter called CYBERMECH. Humanity pilots combat mechs to defend a neon city against
> rebel AIs. The 3D models are built in code from simple primitives (boxes, cylinders, bevels), so I need concept art
> that can be rebuilt from blocky parts: hard-surface, chunky, modular-toy-like, clean silhouettes readable on a phone,
> no organic shapes, no cables, no tiny greebles. Visual world: dark low-poly city with neon light lines in cyan, pink
> and fluorescent yellow ("Tron"-like). Color rule: neon green always belongs to the player, bright red always belongs
> to the rebel AIs. Every robot has six readable, detachable parts (head, torso, two arms, two legs) with visible joints,
> an energy cannon on the right forearm, an ammo launcher on the left forearm, and heat vents on the torso back and
> sides. Do not resemble Transformers, Gundam, Pacific Rim, Titanfall or MechWarrior. No logos, no real brands, no text
> or letters anywhere in the image.

**Prancha do jogador:**

> Character turnaround sheet of VECTOR-09, a 5.3-meter agile assault mech: front, side, back and three-quarter views
> side by side at the same scale, orthographic, neutral A-pose, on a flat mid-gray background with even studio
> lighting. Broad shoulders, short strong digitigrade legs, small head with a horizontal visor slit. Hazard-yellow matte
> paint (#E0A21A) over dark graphite frame (#1E2224) and steel (#5D6163), glowing neon-green visor and chest stripe
> (#39FF6A). Right forearm: plasma cannon with a glowing muzzle. Left forearm: a four-tube rocket pod with orange
> tips (#FF8A1F). Two back thrusters. Heat vents on the torso back and sides. A gray 1.8 m human silhouette for scale.
> Color swatches as plain squares along the bottom edge. 16:9, no text.

**Mechs rebeldes (uma prancha por personalidade; trocar a última frase):**

> Character turnaround sheet of a rebel-AI combat mech built on the same 5.3-meter chassis as VECTOR-09: front, side,
> back and three-quarter views, orthographic, neutral A-pose, flat dark-gray background, even lighting. Dark crimson
> matte paint (#8C1F22), graphite frame, glowing bright-red visor and stripes (#FF2D3D). Plasma cannon on the right
> forearm, four-tube rocket pod on the left forearm, back thrusters, heat vents. Gray 1.8 m human silhouette for scale,
> color swatches as plain squares, 16:9, no text.
> - Brabo variant: extra frontal armor plates, forward-leaning aggressive stance, heavier shoulders.
> - Soldado variant: standard balanced armor, upright disciplined stance.
> - Fujão variant: lighter armor, oversized sensor head, crouched stalking stance.

**Andróide de combate:**

> Character turnaround sheet of a 2-meter rebel combat android, similar in spirit to today's humanoid robots without
> copying any real product: front, side, back and three-quarter views, orthographic, neutral pose, flat mid-gray
> background, even lighting. Smooth warm-white shell (#F0F2E8) over a dark graphite frame, thin glowing red visor band
> (#FF2D3D) across a smooth faceless head, a compact blaster built into the right forearm, a slim battery backpack.
> Agile, slim proportions, visible joints. Gray 1.8 m human silhouette for scale, plain color swatches, 16:9, no text.

**Técnico:**

> Same 2-meter android body as the combat android, but a technician: glowing fluorescent-yellow visor band (#E8FF1A), a repair tool
> with an emitter instead of the blaster on the right forearm, a larger backpack carrying spare parts. Turnaround sheet,
> front, side, back and three-quarter views, orthographic, flat mid-gray background, even lighting, 1.8 m human
> silhouette, plain color swatches, 16:9, no text.

**Peças separadas (depois de escolher um conceito):**

> Exploded-view parts sheet of [ROBOT NAME] from the previous design: head, torso, left arm, right arm with weapon, left
> leg, right leg and backpack, laid out separately in a clean grid, each shown front and side, orthographic, flat
> background, even lighting, same colors and materials, no text.

**Níveis de arma:**

> Weapon upgrade sheet for a mech forearm plasma cannon in three tiers side by side (tier 1, tier 2, tier 3): same basic
> silhouette, each tier larger and more elaborate (more cooling fins, longer barrel, brighter neon-green core glow).
> Graphite and hazard-yellow materials, orthographic side and three-quarter views, flat mid-gray background, no text.
> Then the same for a four-tube rocket pod (tier 3 with six tubes and armored caps).

## 7. Depois das imagens

1. O dono escolhe um conceito por robô e salva as imagens em `.tmp/arte/` (não vão para o repositório nem para o site).
2. O Codex (território de render) traduz cada conceito em peças do `meshKit`, mantendo as 6 partes, os encaixes e o teto
   de draw calls (≤ 10 por Mech, `STATUS_REAL.md`).
3. As regras de jogo (tamanho da cápsula, zonas de dano em `combat/damage.ts`) não mudam por causa do visual: se o
   conceito pedir outra proporção, vira proposta no `ESTADO_ATUAL.md` antes.
