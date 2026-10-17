# CHECKPOINTS — pontos de qualidade que não podem piorar

> Um **checkpoint** é um ponto que o Comandante viu, julgou bom e mandou guardar. Fica marcado no git (uma *tag*), com a captura que o prova e a bancada que a refaz.
> **Regra:** quem mexer nos arquivos de um checkpoint roda a bancada dele, **compara com a captura de referência** e só entrega se **não ficou pior**. Melhorar vale; regredir, não.
> Para ver o checkpoint como era: `git show checkpoint/<nome>:caminho/do/arquivo`. Para voltar um arquivo: `git checkout checkpoint/<nome> -- caminho/do/arquivo`.

---

## 1. Explosões e efeitos de tiro (`checkpoint/explosoes-v1`, 16/10/2026, ordem P170)

**O que o Comandante disse (16/10, depois de jogar):** *"as explosões das armas estão ficando INCRÍVEIS! mantenha essa qualidade e marque esse ponto como um checkpoint da UI das explosões."*

**A tag:** `checkpoint/explosoes-v1`, no commit `54c6972` da `main` (partes 1 a 5 da P160 no ar).

**O que faz esse olhar (não perca):**

| Traço | Onde mora | Por quê |
|---|---|---|
| **Bola de fogo low-poly que ferve** e esfria do amarelo ao vermelho, com **mistura normal** (não soma luz) | `fx/Explosions.ts` | somando luz, dez bolas viravam um borrão branco que cobria a tela (medido); com mistura normal o laranja satura e o bloom acende só o miolo |
| **Fumaça escura de verdade**, iluminada por dentro pelo fogo no começo | `fx/Explosions.ts` | antes a "fumaça" somava luz e nunca escurecia |
| **Estilhaços em brasa** que voam, quicam e esfriam | `fx/Explosions.ts` | corpo e peso |
| **Onda de choque**, **clarão no asfalto** e **queimado** que esfria no chão | `fx/Explosions.ts`, `fx/Marks.ts` | a explosão deixa marca |
| A explosão **escala com o raio** da arma (míssil leve pequeno, cruzador grande) e o **tranco** também | `fx/explosionScale.ts`, `fx/Explosions.ts` | nada de uma explosão só para tudo |
| **Rastro em fita** (fumaça que abre e sobe, fogo do motor) | `fx/Ribbons.ts` | antes era uma fila de pontos |
| **Clarão da boca, brilho da cabeça, clarão do acerto** por família; marcas na parede | `fx/Billboards.ts`, `fx/weaponLook.ts` (tabela, uma linha por arma) | cada arma com a sua cara |
| **Raio iônico do trilho** e feixe do laser com energia correndo | `fx/BeamVisuals.ts` | antes uma linha de 1 px |
| O **Mech destruído explode** do tamanho dele | `fx/WeaponFx.ts` (`wreck`) | |

**Prova guardada:**
- `arte/armas-impacto-bancada-claude.jpg` — 15 quadros com os sistemas de verdade e o bloom (a **referência** para comparar).
- `arte/armas-impacto-gpu-mech-destruido-claude.jpg` e `arte/armas-impacto-gpu-fumaca-claude.jpg` — o jogo na GPU real (AMD).
- `arte/armas-hangar-teste-*-claude.jpg` — o "Testar" do Hangar com os mesmos efeitos.

**Como conferir antes de entregar (4 passos, a máquina fraca aguenta):**
1. `node .decepticons/medicoes/explosoes.mjs .tmp/explosoes/depois.jpg` (a bancada: ~2 min em software). Olhe lado a lado com a referência.
2. `npm run build && node .decepticons/medicoes/varrer-nan.mjs --efeitos` — **0 poses com NaN** (um NaN no efeito vira tela preta pelo bloom, só a GPU real vê).
3. `npx vitest run client/src/fx/WeaponFx.test.ts` — tetos dos pools, vida e NaN nos buffers.
4. Custo: **0,45 ms por quadro** sob carga extrema (170 fitas, 219 peças de explosão, 160 cartazes, 80 marcas) e **9 chamadas de desenho** para todos os efeitos. Piorar isto (G12) também é regredir.

**O que pode mudar sem pedir:** números de tamanho, cor e duração de uma arma (a linha dela em `fx/weaponLook.ts`), desde que a bancada continue boa. **O que pede o Comandante:** trocar a direção de arte (o neon low-poly de 07/10) ou voltar a somar luz na bola de fogo.
