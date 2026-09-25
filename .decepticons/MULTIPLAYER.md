# MULTIPLAYER — plano técnico (Fase 4)

> Documento de design do multiplayer autoritativo. Dono do tema: Claude (simulação compartilhada, servidor,
> rede). Metas e regras de engenharia: G6, G7, G11–G14 em `PROTOCOLO_UNIVERSAL.md`. Hospedagem: `DEPLOY.md`,
> seção "Servidor de jogo". Criado em 2026-09-25, a pedido do dono: "já podemos começar a planejar o multiplayer?".

## 1. O que o multiplayer precisa entregar

- **Salas de 8** (humanos + bots completando), entra e sai a qualquer hora, sem lobby (`GAME_DESIGN.md`, Decisões).
- **Servidor autoritativo** (G13): o cliente manda só comando; dano, morte, calor, quebra de parede e montagem do
  Hangar são decididos no servidor, com as mesmas regras do jogo.
- **Sensação de jogo local:** o próprio Mech responde na hora (prediction); os outros andam liso (interpolação).
- **Metas (G11, G14):** download ≤ 8 KB/s e upload ≤ 2 KB/s por jogador; servidor a 60 Hz com tick ≤ 2 ms
  para 8 Mechs; estado a 20 Hz; reconexão em até ~15 s sem congelar.

## 2. Pré-requisitos (antes de escrever rede)

| # | O quê | Por quê | Estado |
|---|---|---|---|
| P1 | **Separar simulação de render** | Uma simulação só, no cliente e no servidor (G14); o servidor não pode depender de WebGL nem de DOM | **Parcial.** M1 (PR #49): `sim/Match.ts` roda a partida inteira no Node sem WebGL nem DOM. Mas a simulação ainda **cria objetos de render** e **chama efeitos** (seção 8), e o tiro do jogador sai do modelo desenhado. A separação completa é a proposta da seção 9, a decidir |
| P2 | **Draw calls por Mech de ~34 para ≤ 10** | 8 Mechs + andróides na tela numa GPU integrada (G12) | ✅ Codex (PR #43): 9 malhas por Vector-09 e 9 por andróide (contado no código em 25/09: uma malha combinada por pivô articulado; o flash branco que veio junto foi corrigido no PR #48) |
| P3 | **FPS medido numa GPU integrada** | Saber a folga antes de somar rede | dono, num notebook comum, com o painel de desempenho (`'`) |
| P4 | **Contratos de rede definidos e mergeados** (seção 5) | Regra 5 do AGENTS: contrato antes de paralelizar | a fazer (etapa M2) |
| P5 | Montagem validável no servidor | Ninguém entra com arma adulterada | ✅ `validateLoadout` (Hangar), texto curto de ~30 bytes |

## 3. Arquitetura

```text
 cliente (navegador)                                 servidor (Node + Colyseus, uma ArenaRoom por sala)
 ───────────────────                                 ─────────────────────────────────────────────────
 input → NetInput (seq, tick) ──── 30 Hz, 2 ticks ──▶ fila de inputs por jogador (validados, G7)
 prediction: roda o próprio Mech já                  simulação shared/ a 60 Hz: Mechs, bots, projéteis,
 (MechSim + Rapier local)                            foguetes, calor, dano, barricadas
 reconciliação: estado do servidor chega,     ◀───── snapshot a 20 Hz com delta (só o que mudou)
 reposiciona e re-simula os inputs pendentes  ◀───── eventos com id: acerto, parte arrancada, abate,
 remotos: interpolação ~100 ms atrás (G6)             explosão, barricada quebrou
 efeitos, destroços, partículas: só locais
```

- **Servidor:** Node com Colyseus; a simulação é a mesma do cliente (`shared/`), com o Rapier em Wasm (já roda no
  Node: é assim que os testes rodam hoje). Bots rodam no servidor e completam a sala até 8.
- **Mech local:** prediction com o mesmo `MechSim`; guarda os inputs sem confirmação (número de sequência); ao chegar
  o estado autoritativo, volta para ele e re-simula os pendentes. Correção pequena é suavizada no visual, não teleporta.
- **Mechs remotos:** interpolam entre dois snapshots, ~100 ms no passado; **nunca rodam o character controller** (G6).
  Perdeu pacote: extrapolação curta e limitada (G13).
- **Tiros:** o cliente mostra o disparo na hora (efeito), o servidor decide o acerto com **compensação de latência**
  (volta as cápsulas ao instante que o atirador via, até 150 ms). Acima disso, o atirador é que se adapta.
- **Calor e cadência:** rodam no servidor (as mesmas regras de `heat.ts` e `trigger.ts`); o cliente prevê a barra de
  calor e corrige com o snapshot.
- **Reconexão (G13):** token de sessão; a sala guarda o Mech por 15 s; o cliente mostra "reconectando…" e retoma.

## 4. Orçamento de banda (estimativa, a medir na M7)

Estado de um Mech por snapshot, quantizado (G11):

| Campo | Bytes |
|---|---|
| posição (3 × 16 bits, cm numa arena de ±320 m) | 6 |
| yaw e pitch (2 × 16 bits) | 4 |
| vida das 6 partes (6 × 8 bits, fração da máxima) | 6 |
| calor (8 bits) + flags (vivo, dash, superaquecido, no chão) | 2 |
| **total por Mech** | **18** |

- 8 Mechs × 18 B × 20 Hz = **2,9 KB/s** sem delta; com delta (só o que mudou), menos.
- Eventos: ~40 tiros/s na sala × ~12 B = ~0,5 KB/s; acertos e abates, bem menos.
- Moldura do WebSocket e do Colyseus: ~20%.
- **Download estimado: ~4 KB/s por jogador** (meta: 8). **Upload:** input de ~8 B a 60 Hz, em pacotes de 2 ticks:
  ~0,6 KB/s (meta: 2).

## 5. Contratos (etapa M2, mergeados antes de qualquer rede)

| Contrato | Conteúdo | Onde |
|---|---|---|
| `NetInput` | `seq`, `tick`, `moveX`/`moveZ` (int8), `moveYaw`/`yaw`/`pitch` (16 bits), botões em bitmask: pulo, dash, tiro, secundária | `shared/net/input.ts` |
| `MechState` | os campos da tabela da seção 4 + id e montagem (`loadoutKey`) | `shared/net/state.ts` (schema do Colyseus) |
| Mensagens | `join { nome, build }`, `welcome { id, tick, sala }`, `input`, `event { tipo, dados }`, `leave` | `shared/net/messages.ts` |
| Codec | ida e volta de cada mensagem, com teste de tamanho em bytes (o teste falha se estourar o orçamento) | `shared/net/codec.test.ts` |

## 6. Etapas (um PR cada)

| Etapa | O quê | Quem |
|---|---|---|
| M0 | Este plano | Claude ✅ |
| M1 | Partida sem tela (`sim/Match.ts`): a partida inteira roda no Node sem WebGL nem DOM, determinística sem destroços; o cliente monta a partida por ela ✅ (PR #49). **Ainda não** é a simulação compartilhada: ver seções 8 e 9 | Claude |
| M2 | Contratos e codec binário, com testes de tamanho | Claude |
| M3 | `server/`: `ArenaRoom` com a simulação a 60 Hz, bots, entrada por `?sala=`; roda local com `npm run server` | Claude |
| M4 | Prediction + reconciliação do Mech local; interpolação dos remotos; teste com latência e perda simuladas | Claude |
| M5 | Tiros autoritativos com compensação de latência; eventos de acerto, parte e abate | Claude |
| M6 | Entrada pelo link com apelido, reconexão, "reconectando…" | Claude (rede) + Gemini (telas) |
| M7 | Medir banda por sala e tick do servidor contra G11 e G14; playtest R16 com 2+ clientes reais (PC do dono + Cloudflare Tunnel) | Claude + dono |
| M8 | Servidor no ar (hospedagem: decisão do dono, `DEPLOY.md`) | Claude + dono |

**Em paralelo:** Gemini faz as telas (apelido, código da sala, lista de jogadores, placar online, indicador de ping)
contra os contratos da M2; Codex reduz as draw calls (P2) e cuida do visual dos Mechs remotos (interpolação suave,
efeito de entrada e saída).

## 7. Riscos

**Medido na M1 (25/09, `sim/Match.test.ts`):** a sala cheia do padrão (1 jogador + 3 Mechs + 2 andróides + técnico)
roda sem tela a **0,74 ms por tick em média** (p95 2,4 ms, picos raros de coleta de lixo) num PC comum: dentro da meta
de 2 ms do G14. Um núcleo aguenta ~20 salas.

**Achado da M1: destroços mexem na simulação.** Estão no mesmo mundo físico: mesmo ignorados pelos raios e pelo
controlador dos Mechs, eles mudam a árvore interna do Rapier e a ordem das colisões que o Mech resolve. A partida com
destroços diverge ~1 s depois do primeiro estilhaço, e duas partidas com destroços divergem entre si (`Math.random`).
O servidor roda **sem** destroços (determinístico, testado). No cliente, a diferença é pequena e a reconciliação da M4
corrige. Se a correção aparecer na tela, os destroços vão para um mundo físico só deles.


- **CPU do servidor:** 8 character controllers + raycasts a 60 Hz por sala. Meta de ≤ 2 ms por tick; medir na M3 e na
  M7. Se estourar: menos raycasts por tick nos bots, ou salas menores.
- **Prediction do Rapier:** o character controller é determinístico dado o mesmo estado, mas pequenas diferenças
  entre máquinas viram correção. A reconciliação absorve; o visual suaviza.
- **Mira assistida (toque) contra mouse** na mesma sala: decisão do dono (seção 8).
- **Trapaça:** nada do que o cliente manda é número de jogo (dano, calor, vida). Input fora do limite é descartado.

## 8. Onde estamos depois do PR #49 (conferido no código em 25/09)

**Já roda:**
- `sim/Match.ts` monta e roda uma partida inteira (arena, barricadas, Mechs, bots com personalidade e diretor de ataque,
  projéteis, foguetes, calor, dano por parte, renascimento, rodadas) no tick fixo, no Node, sem WebGL nem DOM
  (`sim/Match.test.ts`, 4 testes). O jogo no navegador usa a mesma classe (`core/Game.ts`).
- Determinística sem destroços (duas partidas iguais, tick a tick). Tick médio de 0,74 ms com a sala cheia (1 jogador +
  6 bots) num PC comum; p95 2,4 ms.
- Módulos puros, sem Three.js: armas (`combat/weapons.ts`), bancada (`balance.ts`), calor (`heat.ts`), cadência
  (`trigger.ts`), números dos chassis (`entities/chassis.ts`, só importa tipos), validação da montagem
  (`hangar/loadout.ts`).

**Ainda depende de Three.js de render dentro da simulação** (contado nos arquivos):
- Criam malhas, materiais ou objetos na cena: `Arena`, `Destructibles`, `DebrisSystem`, `ProjectileSystem` (pool de
  64 malhas), `RocketSystem`, `BotSystem` (feixe do técnico), `MechBase`/`Vector09`/`Android` (o modelo articulado).
  A `Match` exige uma `THREE.Scene`; no servidor ela seria uma cena que nunca é desenhada.
- Chamam efeitos dentro das regras (`particles.burst`): `CombatSystem`, `Destructibles`, `ProjectileSystem`,
  `RocketSystem`, `BotSystem`. A `Match` recebe um `ParticleSystem`; no servidor, um objeto vazio com `burst`
  (feito nos testes com um "cast", não por um tipo próprio).
- **O tiro do jogador sai do modelo desenhado:** `PlayerController` usa `muzzleWorldPosition` e
  `leftMuzzleWorldPosition` (posição interpolada do modelo) e o ponto de mira da câmera (`rig.aim`). Os bots já usam
  `simMuzzle` (da simulação). O servidor não tem como reproduzir o tiro do jogador como está.
- **O yaw do jogador é escrito na taxa do render** (`applyFacing`, para a mira responder na hora) e o pitch do tiro não
  está no `MechInput`. No multiplayer, os dois têm de viajar no comando de cada tick (`NetInput`, seção 5).
- **Destroços** mudam a simulação quando estão no mesmo mundo físico (seção 7).

**Ainda não existe:** contratos de rede e codec (M2), `server/` com Colyseus (M3), prediction e reconciliação (M4),
tiros autoritativos (M5), entrada por link e reconexão (M6).

## 9. Proposta de arquitetura: simulação × render × efeitos (a decidir; não implementada)

**Problema:** para o servidor rodar exatamente a regra do cliente sem carregar render, e para o cliente prever o próprio
Mech igual ao servidor, a simulação não pode depender do que está desenhado nem do relógio do quadro.

**Proposta (Claude, 25/09):**
1. **Estado da simulação sem objetos de cena:** Mechs, projéteis, foguetes e barricadas guardam só dados (posições em
   `THREE.Vector3`/`Quaternion` podem ficar: são só matemática). Malhas, materiais e `scene.add` saem para "vistas"
   do cliente (`MechView`, `ProjectileView`, `ArenaView`) que leem o estado depois de cada tick.
2. **Efeitos por eventos, não por chamada:** as regras emitem eventos (`hit`, `explosion`, `partDestroyed`,
   `propBroken`, `shot`); o cliente transforma em partículas, som e tremor; o servidor os manda pela rede como
   evento com id (G11). A `Match` deixa de receber `ParticleSystem`.
3. **Tiro do jogador pela simulação:** origem em `simMuzzle` e direção do yaw e pitch do comando do tick (como os
   bots); o modelo desenhado só anima. Pitch entra no `MechInput`.
4. **Yaw no tick:** o comando do tick carrega o yaw; a câmera continua respondendo na hora (a vista usa o yaw local).
5. **Destroços fora do mundo da simulação:** mundo físico só deles, no cliente (ou sem colisão com nada que a
   simulação consulte).

**Critérios de aceitação** (todos, para dar a separação por concluída):
- Um teste monta a `Match` **sem passar cena nem efeitos** e roda uma partida inteira; nenhum arquivo importado pela
  simulação cria `Mesh`, `Material`, `Sprite`, `Line` ou `Points` (verificado por teste que varre os imports).
- Mesma entrada, mesmo resultado: a partida do cliente e uma "partida de servidor" (sem vistas) dão o mesmo estado,
  tick a tick, **com destroços ligados no cliente**.
- O tiro do jogador, repetido na simulação só com os comandos gravados, acerta os mesmos alvos que no cliente.
- Todos os testes de hoje passam sem mudar o que verificam; o `npm run check` e o jogo no site continuam iguais.
- Tick médio da sala cheia continua ≤ 2 ms (G14), agora sem os objetos de cena.

**Custo e risco:** mexe em `MechBase`, `ProjectileSystem`, `RocketSystem`, `Destructibles`, `Arena`,
`CombatSystem`, `PlayerController` e na fiação do `Game` (território do Claude e zona compartilhada; a parte visual
toca o território do Codex). Estimativa: 2 a 3 PRs. Pode entrar antes da M3 (o servidor já nasce sem render) ou
depois (o servidor começa com cena descartável e a separação vem na M4, quando a prediction exigir). **Recomendação:**
itens 3 e 4 antes da M4 (sem eles a prediction não bate); itens 1, 2 e 5 quando o custo de memória do servidor ou as
correções visíveis pedirem. **Decisão do dono.**

## 10. Decisões do dono

1. **Hospedagem do servidor:** Oracle Always Free (São Paulo, custo zero, capacidade instável) ou VPS paga pequena
   (estável). Recomendação em `DEPLOY.md`.
2. **Mira assistida no PvP:** manter (padrão dos jogos de tiro no celular), reduzir contra humanos, ou separar salas
   por tipo de controle.
3. **Bots nas salas online:** completam até 8 (sala sempre cheia) ou só quando houver menos de N humanos.
4. **Nome e código da sala:** código curto aleatório (`/jogar/?sala=K7Q2`) ou nome escolhido.
