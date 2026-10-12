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
| **atordoado** (variante do chocado) | **tiro bem dado** elétrico (decisão do dono, 09/10): **na cabeça**, ou **3 acertos seguidos** no mesmo alvo em 1,4 s (com 0,45 s entre tiros, é acertar 3 sem errar nenhum) | não anda **nem atira** | 0,8 s | **imune a novo atordoamento por 4 s** (sem encadear) |
| **gelado** | arma de gelo | −15% de velocidade por acúmulo | 4 s desde o último tiro | até 3 acúmulos; **fogo apaga** |
| **congelado** | 3 acúmulos de gelado | não anda (mira e atira), **+20% de dano recebido** | 1,5 s | imune a novo congelamento por 5 s |

Resistência por chassi (`statusResist`, no dado do chassi): o Colossus-01 sofre metade da duração; o andróide, uma vez e meia. Escudo
físico: a natureza do dano decide (`eletrico` entrou em `DamageType` no PR-C e `criogenico` entra com o gelo; o lança-chamas é `termico`).
**O estado só pega se pelo menos metade do dano passou pelas defesas** (`STATUS.shieldPass`, campo de energia e chapa do escudo físico, nos
dois caminhos: projétil e explosão): a chapa cerâmica (Refratário) isola o choque, a de aço (Muralha) conduz. Cada regra tem teste de
simulação (G14) e mutação.

## 3. As armas (números de partida)

| Id | Nome | Comportamento | Dano / cadência | Massa | Natureza | Onde |
|---|---|---|---|---|---|---|
| `rotary` ✅ | Metralhadora rotatória | a cadência **sobe de 3 a 20 tiros/s em 1,2 s segurando o gatilho** e cai em 1,5 s ao soltar; o cone de tiro (3,5°) abre junto com a rotação, o primeiro tiro vai reto; **sem carregador: o calor é o freio** (ferve em ~3 s de rajada); 170 m/s, dano cheio até 35 m e 35% aos 95 m | 5 / 6 / 7 por tiro (MK I–III) | 4 / 6 / 8 t | `balistico` | mão direita de Vector-09, Onça, Colossus, Arara e demais; as duas mãos do Marauder (nunca no esquerdo do Vector-09) |
| `arc` ✅ | Arma elétrica | projétil de 90 m/s (faixa azul-branca, violeta no inimigo); cada acerto que chega ao corpo deixa **chocado** (−35% de velocidade, 2 de dano/s por 3 s); o **tiro bem dado** (cabeça, ou 3 acertos em 1,4 s: a cadência dela cabe na janela) atordoa 0,8 s e não encadeia; alcance ótimo 50 m, máximo 130 m a 50% do dano; **não ferve o Mech** (calor 0,06 por tiro) | 7 / 8 / 10 a cada 0,45 s (MK I–III) | 2,5 / 3,75 / 5 t | `eletrico` | qualquer mão de energia, no principal ou no secundário (o botão 2 a atira como o plasma), e as duas do Marauder |
| `flamer` ✅ | Lança-chamas | **fluxo contínuo** em cone de 34° e **30 m (MK II 39 m, MK III 48 m)** que atinge **todos** os que estão nele e à vista (parede segura, outro Mech não); um pulso a cada 0,2 s, cada pulso deixa **queimando**; **6 s de combustível, 4 s de recarga** (solto, o tanque enche em 4 s); esquenta quem atira (ferve em ~4,8 s de chama contínua); dano cheio até 14 m e metade aos 30 m (**cada nível soma +30% de alcance, +15% de pulsos por segundo e +20% de dano**, P76); sozinho derruba um torso em 7,5 a 5,9 s (o plasma, 5,7 s): o valor extra dele é o cone e o fogo (queimando agora dá 6 por segundo). **Reforçado em 11/10 (P72, "muito fraco e curto"):** eram 6 de dano, 14 m e 25°, e 13,3 a 10,9 s | 10 / 12 / 14 por pulso, 5 / 5,75 / 6,5 pulsos/s = 50 a 91/s (MK I–III) | 3,5 / 5,25 / 7 t | `termico` | mão do gatilho principal dos **pesados**: Colossus, Onça, Bastion e Marauder (nas duas mãos) |
| `cryo` ✅ | Arma de gelo | projétil de 70 m/s (faixa branco-gelo, lilás no inimigo); cada acerto que chega ao corpo soma **1 acúmulo de gelado** (−15% de velocidade por acúmulo, até 3, por 4 s desde o último tiro); o **terceiro acúmulo congela** 1,5 s (parado, ainda mira e atira, leva +20% de dano) e dá 5 s de imunidade para não encadear; fogo e gelo se anulam; alcance ótimo 20 m, máximo 55 m (**encurtado em 11/10, P72: "o gelo está indo muito longe"**; eram 45 e 110 m); **num aliado (mesmo lado) esfria em vez de congelar: tira 0,10 de calor por tiro e apaga o fogo, sem dano (P78)**; o rastro dele solta bruma de frio (partículas pequenas e pálidas); não ferve o Mech; sozinha derruba um torso em 35,4 s (MK I) a 25,2 s (MK III), contra 5,7 s do plasma | 5 / 6 / 7 a cada 0,6 s (MK I–III) | 3 / 4,5 / 6 t | `criogenico` | qualquer mão de energia, no principal ou no secundário (o botão 2 a atira como o plasma), e nas duas mãos do Marauder |

Metas de equilíbrio: as do `ARSENAL.md` (sozinha derruba um torso em mais de 4,5 s; as de apoio — gelo e elétrica — bem mais).

## 4. Rede (G11: até 8 KB/s por jogador; hoje 6,2 com 12 robôs)

- **Byte `fx` por unidade, só quando há algo ligado** (feito no PR-A): queimando, chocado, atordoado, gelado (2 bits de acúmulos), congelado,
  lança-chamas ligado, rotatória girando. Um bit livre das flags (`HAS_FX`) avisa que o byte vem a seguir, então **o caso comum não paga nada**
  (`UNIT_BYTES` segue 19). **Pior caso** (as 12 unidades com algum estado, o que nenhuma luta real faz): +240 B/s, 6,69 KB/s de 8, ainda
  dentro do teto. Um byte fixo por unidade estourou a folga de 80% do teste de banda (6,69 > 6,55 KB/s), por isso o byte é condicional. O Mech
  local precisa saber a própria lentidão para a previsão não puxar para trás; os remotos só desenham.
- **Rotatória e lança-chamas não mandam um evento por tiro** (seriam ~15 tiros/s por atirador): o servidor liga a bandeira de "atirando"
  e o cliente desenha o fluxo na cadência da arma (só visual; o dano é do servidor). As armas de projétil usam o evento de tiro de sempre.
- `PROTOCOL_VERSION` 6 → 7 (feito no PR-A, junto do byte `fx`) e as armas entram **só no fim** de `NET_WEAPONS`. O servidor se atualiza sozinho (`DEPLOY.md`, 09/10).
- **Elétrica (PR-C, feito): protocolo 9.** É projétil comum: vira evento de tiro como o plasma, e `NET_WEAPONS` ganha `arc` **no fim** (um cliente do
  protocolo 8 recusaria o tiro). O estado do alvo já viajava no byte `fx` do PR-A (bits chocado e atordoado).
- **Lança-chamas (PR-D, feito): protocolo 11.** Não solta projétil e **não vira evento de tiro** (seriam 5 por segundo por atirador): `Armament` pede um pulso ao `ShotSink.flame` a cada 0,2 s, o servidor aplica o cone (`Match.flameCone`, o mesmo código do jogo offline) e o dono liga a bandeira `FX_FLAMING` do byte `fx` (que já existia desde o PR-A), que os outros jogadores leem para desenhar o fluxo (`fx/FlameVisuals`). A montagem `flamer` entra no JOIN e no roster, então o protocolo sobe para 11 (um servidor antigo recusaria a build). A rotatória e o lança-chamas usam o mesmo medidor em volta da mira (rotação do cano / combustível).
- **Gelo (PR-E, feito): protocolo 10.** Projétil comum, como a elétrica: vira evento de tiro e `NET_WEAPONS` ganha `cryo` **no fim** (um cliente do protocolo 9 recusaria o tiro). O estado do alvo já viajava no byte `fx` do PR-A (os dois bits de acúmulos de gelado e o de congelado). A natureza `criogenico` entra em `DamageType`: a cerâmica (Refratário, 0,7) isola o frio; o aço (Muralha, 0,45), a malha (Amortecedor, 0,4) e o reativo (0,3) deixam passar.
- **Rotatória (PR-B, feito): protocolo 8.** A montagem `rotary` passa a valer no JOIN e no roster, mas ela **não entra em `NET_WEAPONS`**: nunca vira
  evento de tiro (o servidor sai cedo em `ArenaRoom.shot` quando a arma tem `spin`). Os outros jogadores desenham o fluxo a **10 tiros/s** (o real é 20)
  quando a bandeira `FX_SPINNING` do dono está ligada, e a arma sai **da montagem do roster** (`rotaryOf` em `OnlineSession`), não do desenho do Mech.
  O desvio de cada tiro sai do número do tiro (ângulo áureo, `combat/spread.ts`), sem sorteio: o mesmo número de tiro dá o mesmo desvio no servidor e no cliente (o servidor decide o acerto; o tiro do cliente local é só desenho).

## 5. Divisão de trabalho (cada um no seu território; AGENTS.md, regras 2–5 e 12)

| Quem | O quê | Depende de |
|---|---|---|
| **Claude** | **PR-A** contrato dos efeitos de estado (módulo + `MechBase` + testes, nenhuma arma equipável ainda); **PR-B** rotatória; **PR-C** elétrica; **PR-D** lança-chamas; **PR-E** gelo. Cada arma só fica equipável quando completa (dados, regra, rede, Hangar, testes de equilíbrio e mutação); fiação em `Game.ts` | nada |
| **Gemini** | tudo de **tela e som** (seção 7, o pedido): indicadores de estado, bordas de tela, painel do alvo, ícones e dicas do Hangar, medidor da rotatória, sons | nada: as peças recebem dados simples, eu faço a ligação |
| **Codex** | só depois, e só se ele quiser: efeitos visuais 3D das armas (chamas, gelo, raios), modelos | está na auditoria de desempenho (`ESTADO_ATUAL.md`); **não pedir agora**. Até lá uso os `ParticleSystem.burst` que já existem como provisório |
| **Qwen** | sem crédito hoje; depois: testes extras, revisão cruzada do equilíbrio, documentação | — |

### Estado da tela e do som (09/10, noite)

O Gemini entregou T1–T5 no #201 (`StatusBadges`, painel do alvo com `statuses`, `weaponIconsNovas`, `HUD.setSpin`, e o sintetizador em `AudioSystem`). A ligação ao jogo é de quem tem a simulação: `core/statusHud.ts` lê o `StatusSet` do jogador, alimenta os indicadores e dispara o som de entrada (uma vez por estado) e o laço (o estado mais incapacitante manda: congelado > atordoado > queimando > chocado > gelado); `MechBase.statuses` alimenta o painel do alvo; `PlayerController.onShot(w)` escolhe o estalo elétrico; `spinLevel` alimenta o medidor e o zumbido. **Falta o Gemini**: `setFlame` (lança-chamas) e `playCryoShot` (gelo) já existem no áudio dele e esperam as armas. **Visto só numa página de teste, não numa partida real.**

## 6. Decisões do dono (09/10)

1. **"Tiro bem dado" = na cabeça, ou uma boa sequência acertando certinho** (ficou como: 3 acertos seguidos no mesmo alvo em 1,4 s).
2. Atordoamento de **0,8 s com imunidade de 4 s** (nunca encadeia): **sim**.
3. **Fogo e gelo se anulam**: **sim**.
4. **Mech grande resiste** (Colossus ½ do tempo): **sim**.
5. Fogo queimando **o cenário** (chão e prédios): **não decidido pelo dono**; segue o padrão, **não** (só o alvo; custa CPU e rede). O sistema
   não fecha essa porta: entra depois como arma ou terreno à parte.

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
> export type StatusKind = 'queimando' | 'chocado' | 'atordoado' | 'gelado' | 'congelado';
> export interface StatusView { kind: StatusKind; left: number /* segundos restantes */; level: number /* 0..1, intensidade */ }
> ```
>
> **T1 — Indicadores de estado do jogador** (`ui/StatusBadges.ts` + `styles.css`): `new StatusBadges(root)` e `update(list: readonly
> StatusView[]): void`. Até 4 chips (ícone, nome em português, barra do tempo restante) no HUD. **Sem alocar nada por quadro**: reuse
> os nós e só troque classe e texto quando mudar. `update` também liga classes na raiz (`fx-queimando`, `fx-chocado`, `fx-atordoado`, `fx-gelado`,
> `fx-congelado`) que desenham **bordas de tela só com CSS**: geada nas bordas (gelado/congelado), faíscas finas (chocado), estática
> cinza-azulada com a imagem levemente "dura", sem piscar (atordoado), brilho quente pulsando devagar (queimando). **Acessibilidade:** nada pisca mais de 3 vezes por segundo; `prefers-reduced-motion` e a opção de reduzir
> efeitos de `core/Settings.ts` (se não houver, proponha no PR) deixam tudo estático.
>
> **T2 — Painel do alvo** (`ui/TargetPanel.ts`): a entrada ganha `statuses?: readonly StatusKind[]` e as bandeiras `EM CHAMAS`, `CHOCADO`,
> `ATORDOADO`, `GELADO`, `CONGELADO` ao lado das que já existem (`SUPERAQUECIDO · TRAVADO`, `EM DASH`), com cores distintas. Teste no `TargetPanel.test.ts`.
>
> **T3 — Hangar** (`ui/weaponIconsNovas.ts`): `WEAPON_ICON_NOVAS` e `WEAPON_HINT_NOVAS`, ambos `Record<'rotary' | 'arc' | 'flamer' |
> 'cryo', string>`. Ícone = o miolo de um SVG 24×24 de traço, no estilo dos de `WEAPON_ICON` em `HangarMenu.ts`; dica = uma linha em português
> no tom das de `WEAPON_HINT` (o que a arma faz e o que aplica: ex.: "Chocada: −35% de velocidade; tiro na cabeça, ou 3 acertos seguidos, atordoa 0,8 s"). Eu ligo
> aos `Record<WeaponId, …>` quando os ids existirem.
>
> **T4 — Medidor da rotatória** (`ui/HUD.ts`): `setSpin(level: number)` (0 a 1), um arco fino em volta da mira que enche com a rotação do cano;
> some em 0. Teste da lógica sem DOM.
>
> **T5 — Sons** (`audio/AudioSystem.ts`, síntese como as que já existem, com o fallback atual; respeite o orçamento de vozes e o `Quality`):
> `setRotarySpin(level: number)` (0 a 1, chamado todo quadro: zumbido que sobe de tom com a rotação e cadência de tiros; 0 = silêncio),
> `playArcShot()` (estalo elétrico curto), `setFlame(on: boolean)` (laço de sopro e chama, entra e sai com rampa), `playCryoShot()` (tiro
> cristalino), `playStatusEnter(kind: StatusKind)` (um som por estado: chama, faísca, zumbido seco do atordoamento, estalo de gelo, trinco do congelamento), `setStatusLoop(kind: StatusKind |
> null)` (laço baixo enquanto o jogador está no estado). Teste: nenhum nó novo por chamada repetida, e silêncio quando desligado.
>
> **Entrega de cada tarefa:** teste de lógica quando houver (padrão de `TouchControls.test.ts`), **captura em `.decepticons/arte/`** (regra
> 16), `ESTADO_ATUAL.md`, `ROADMAP.md` (marque o item da sua frente) e `STATUS_REAL.md` (peça ainda sem ligação marca **PARCIAL**: "feita,
> falta o Claude ligar"). Se algum tipo ou nome acima não servir, **proponha no PR**: eu ajusto do meu lado.
