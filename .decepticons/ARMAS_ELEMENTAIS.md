# ARMAS ELEMENTAIS — plano e divisão de trabalho (09/10)

> Pedido do dono, 09/10: *"quero adicionar: metralhadora rotatória, tiros elétricos (que deixam o oponente tomando choque, lento e
> sem funcionar temporariamente caso tome um tiro bem dado), lança-chamas e arma de gelo"*. Escrito por Claude depois de ler o código.
> **Os números são proposta de partida** (a bancada `combat/balance.ts` e as POTÊNCIAS ajustam); as perguntas ao dono estão na seção 6.
> Como criar uma arma: `ARSENAL.md`. O que é real hoje: `STATUS_REAL.md`.

## 1. O que já existe (reaproveitar) e o que falta

| Já existe | Onde |
|---|---|
| Natureza do dano por arma e escudos que resistem por natureza | `DAMAGE_TYPE` em `combat/weapons.ts`, `MetalShield.ts` |
| Calor que trava o Mech (o EMP só aquece o alvo, não o impede de andar) | `EmpEffect.ts`, `absorbEmp` em `MechBase` |
| Carga antes de atirar (trilho) | `ChargeTimer` em `combat/Armament.ts` |
| Bandeiras de estado no pacote de rede e no painel do alvo | `shared/net/state.ts` (6 de 8 bits usados), `ui/TargetPanel.ts` |
| Sons sintetizados | `audio/AudioSystem.ts` |

**Falta:** (a) **efeitos de estado com tempo** (queimando, chocado, gelado, congelado) que mexem em velocidade, controle e dano por segundo
do alvo; (b) **cadência que acelera segurando o gatilho** (rotatória); (c) **arma de fluxo contínuo** (lança-chamas). (a) é o contrato
que as outras três pedem: por isso vem primeiro.

## 2. Efeitos de estado (regras de partida, no tick fixo, sem `Math.random`)

| Estado | Entra por | Efeito | Duração | Acúmulo e limite |
|---|---|---|---|---|
| **queimando** | lança-chamas | 4 de dano/s, +calor no alvo; quem queima não resfria | 4 s, renova a cada contato | não acumula; **gelo apaga** |
| **chocado** | arma elétrica | −35% de velocidade, 2 de dano/s | 3 s, renova | não acumula |
| **atordoado** (variante do chocado) | **tiro bem dado** elétrico: cabeça, ou torso dentro do alcance ótimo | não anda **nem atira** | 0,8 s | **imune a novo atordoamento por 4 s** (sem encadear) |
| **gelado** | arma de gelo | −15% de velocidade por acúmulo | 4 s desde o último tiro | até 3 acúmulos; **fogo apaga** |
| **congelado** | 3 acúmulos de gelado | não anda (mira e atira), **+20% de dano recebido** | 1,5 s | imune a novo congelamento por 5 s |

Resistência por chassi (`statusResist`, no dado do chassi): o Colossus-01 sofre metade da duração; o andróide, uma vez e meia. Escudo
físico: a natureza do dano decide (`eletrico` e `criogenico` entram em `DamageType`; o lança-chamas é `termico`). Cada regra tem teste de
simulação (G14) e mutação.

## 3. As armas (números de partida)

| Id | Nome | Comportamento | Dano / cadência | Massa | Natureza | Onde |
|---|---|---|---|---|---|---|
| `rotary` | Metralhadora rotatória | a cadência **sobe de 3 a 20 tiros/s em 1,2 s segurando o gatilho** e cai ao soltar; o espalhamento abre com a cadência; carregador grande, recarga longa | 3 por tiro | 4 t | `balistico` | braço direito de Vector-09, Onça, Colossus; mãos do Marauder |
| `arc` | Arma elétrica | projétil rápido (90 m/s); aplica chocado; o tiro bem dado atordoa | 7 a cada 0,45 s | 2,5 t | `eletrico` | braço direito (energia) |
| `flamer` | Lança-chamas | **fluxo contínuo**, cone de 25° e 14 m, atinge todos no cone; 6 s de combustível, recarga de 4 s; esquenta quem atira | ~30/s | 3,5 t | `termico` | braços dos Mechs pesados (Onça, Colossus) |
| `cryo` | Arma de gelo | projétil de 70 m/s; 1 acúmulo de gelado por acerto | 5 a cada 0,6 s | 3 t | `criogenico` | braço esquerdo ou direito (energia) |

Metas de equilíbrio: as do `ARSENAL.md` (sozinha derruba um torso em mais de 4,5 s; as de apoio — gelo e elétrica — bem mais).

## 4. Rede (G11: até 8 KB/s por jogador; hoje 6,2 com 12 robôs)

- **Segundo byte de bandeiras** por unidade (`UNIT_BYTES` 19 → 20): queimando, chocado, atordoado, gelado, congelado, lança-chamas ligado,
  rotatória girando. Custo: **+240 B/s** com 12 unidades a 20 Hz (6,2 → ~6,45 KB/s). O Mech local precisa saber a própria lentidão para
  a previsão não puxar para trás; os remotos só desenham.
- **Rotatória e lança-chamas não mandam um evento por tiro** (seriam ~15 tiros/s por atirador): o servidor liga a bandeira de "atirando"
  e o cliente desenha o fluxo na cadência da arma (só visual; o dano é do servidor). As armas de projétil usam o evento de tiro de sempre.
- `PROTOCOL_VERSION` 6 → 7 e as armas entram **só no fim** de `NET_WEAPONS`. O servidor se atualiza sozinho (`DEPLOY.md`, 09/10).

## 5. Divisão de trabalho (cada um no seu território; AGENTS.md, regras 2–5 e 12)

| Quem | O quê | Depende de |
|---|---|---|
| **Claude** | **PR-A** contrato dos efeitos de estado (módulo + `MechBase` + testes, nenhuma arma equipável ainda); **PR-B** rotatória; **PR-C** elétrica; **PR-D** lança-chamas; **PR-E** gelo. Cada arma só fica equipável quando completa (dados, regra, rede, Hangar, testes de equilíbrio e mutação); fiação em `Game.ts` | nada |
| **Gemini** | tudo de **tela e som** (seção 7, o pedido): indicadores de estado, bordas de tela, painel do alvo, ícones e dicas do Hangar, medidor da rotatória, sons | nada: as peças recebem dados simples, eu faço a ligação |
| **Codex** | só depois, e só se ele quiser: efeitos visuais 3D das armas (chamas, gelo, raios), modelos | está na auditoria de desempenho (`ESTADO_ATUAL.md`); **não pedir agora**. Até lá uso os `ParticleSystem.burst` que já existem como provisório |
| **Qwen** | sem crédito hoje; depois: testes extras, revisão cruzada do equilíbrio, documentação | — |

## 6. Perguntas ao dono (padrão proposto em negrito: se nada for dito, sigo o padrão)

1. "Tiro bem dado" = **cabeça, ou torso dentro do alcance ótimo**. Serve, ou só cabeça?
2. Atordoamento de **0,8 s com imunidade de 4 s** (nunca encadeia). Muito ou pouco?
3. O fogo deixa o **chão e os prédios queimando**? **Não** (só o alvo; fogo no cenário custa CPU e rede, fica para depois).
4. **Fogo e gelo se anulam** (quem queima é apagado pelo gelo e vice-versa)?
5. **Mech grande resiste** (Colossus ½ do tempo)? Ou todos iguais?

## 7. Pedido ao Gemini (território: `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`)

> Você é o Gemini; leia `AGENTS.md` e `GEMINI.md`. Contexto: o dono pediu 4 armas novas (metralhadora rotatória `rotary`, elétrica `arc`,
> lança-chamas `flamer`, gelo `cryo`) e 4 estados que elas aplicam em quem é atingido. O Claude faz toda a simulação, a rede e as armas
> (`client/src/combat/`, `entities/`, `sim/`, `shared/`, `server/`): **não mexa nesses arquivos**. Você faz a parte de tela e som, em PRs
> pequenos, **cada um na sua branch `gemini/<tarefa>` a partir da `main` atualizada, na sua worktree** (`git worktree add
> .tmp\wt-gemini-armas -b gemini/armas-ui origin/main`; `node_modules` por junção só para ler: **nunca rode `npm ci` nem `npm install`
> numa pasta com junção**), PR com `npm run check` verde, e merge pelo próprio agente quando o CI passar (regra 13). Assine com o seu nome.
> Tudo recebe **dados simples** (não importe nada de `combat/` ou `entities/`): eu ligo no `core/Game.ts` depois do seu merge.
>
> **Tipos (crie em `client/src/ui/status.ts`, é seu):**
> ```ts
> export type StatusKind = 'queimando' | 'chocado' | 'gelado' | 'congelado';
> export interface StatusView { kind: StatusKind; left: number /* segundos restantes */; level: number /* 0..1, intensidade */ }
> ```
>
> **T1 — Indicadores de estado do jogador** (`ui/StatusBadges.ts` + `styles.css`): `new StatusBadges(root)` e `update(list: readonly
> StatusView[]): void`. Até 4 chips (ícone, nome em português, barra do tempo restante) no HUD. **Sem alocar nada por quadro**: reuse
> os nós e só troque classe e texto quando mudar. `update` também liga classes na raiz (`fx-queimando`, `fx-chocado`, `fx-gelado`,
> `fx-congelado`) que desenham **bordas de tela só com CSS**: geada nas bordas (gelado/congelado), faíscas finas (chocado), brilho quente
> pulsando devagar (queimando). **Acessibilidade:** nada pisca mais de 3 vezes por segundo; `prefers-reduced-motion` e a opção de reduzir
> efeitos de `core/Settings.ts` (se não houver, proponha no PR) deixam tudo estático.
>
> **T2 — Painel do alvo** (`ui/TargetPanel.ts`): a entrada ganha `statuses?: readonly StatusKind[]` e as bandeiras `EM CHAMAS`, `CHOCADO`,
> `GELADO`, `CONGELADO` ao lado das que já existem (`SUPERAQUECIDO · TRAVADO`, `EM DASH`), com cores distintas. Teste no `TargetPanel.test.ts`.
>
> **T3 — Hangar** (`ui/weaponIconsNovas.ts`): `WEAPON_ICON_NOVAS` e `WEAPON_HINT_NOVAS`, ambos `Record<'rotary' | 'arc' | 'flamer' |
> 'cryo', string>`. Ícone = o miolo de um SVG 24×24 de traço, no estilo dos de `WEAPON_ICON` em `HangarMenu.ts`; dica = uma linha em português
> no tom das de `WEAPON_HINT` (o que a arma faz e o que aplica: ex.: "Chocada: −35% de velocidade; tiro na cabeça atordoa 0,8 s"). Eu ligo
> aos `Record<WeaponId, …>` quando os ids existirem.
>
> **T4 — Medidor da rotatória** (`ui/HUD.ts`): `setSpin(level: number)` (0 a 1), um arco fino em volta da mira que enche com a rotação do cano;
> some em 0. Teste da lógica sem DOM.
>
> **T5 — Sons** (`audio/AudioSystem.ts`, síntese como as que já existem, com o fallback atual; respeite o orçamento de vozes e o `Quality`):
> `setRotarySpin(level: number)` (0 a 1, chamado todo quadro: zumbido que sobe de tom com a rotação e cadência de tiros; 0 = silêncio),
> `playArcShot()` (estalo elétrico curto), `setFlame(on: boolean)` (laço de sopro e chama, entra e sai com rampa), `playCryoShot()` (tiro
> cristalino), `playStatusEnter(kind: StatusKind)` (um som por estado: faísca, estalo de gelo, chama), `setStatusLoop(kind: StatusKind |
> null)` (laço baixo enquanto o jogador está no estado). Teste: nenhum nó novo por chamada repetida, e silêncio quando desligado.
>
> **Entrega de cada tarefa:** teste de lógica quando houver (padrão de `TouchControls.test.ts`), **captura em `.decepticons/arte/`** (regra
> 16), `ESTADO_ATUAL.md`, `ROADMAP.md` (marque o item da sua frente) e `STATUS_REAL.md` (peça ainda sem ligação marca **PARCIAL**: "feita,
> falta o Claude ligar"). Se algum tipo ou nome acima não servir, **proponha no PR**: eu ajusto do meu lado.
