# METAGAME — a pauta dos blocos que faltam

> Recebido do dono em 2026-09-26: orientação de um especialista externo sobre os módulos que faltam para o
> CYBERMECH ter metagame, economia justa, retenção e viralidade — sem pay-to-win. **Isto é pauta, não é
> código pronto:** nada aqui está no jogo. O detalhe técnico de cada bloco sai quando ele entrar na fila.
>
> Regra do projeto que vale para tudo aqui: **nada que se compra ganha partida** (`GAME_DESIGN.md`) e
> **toda regra de gameplay tem teste de simulação** (G14). A prioridade e o "o quê" são do dono.
>
> **2ª leva (2026-09-27):** o mesmo especialista trouxe a **monetização ética** em 6 frentes (§ 6) e os
> **5 pilares de produto e viralidade** (§ 7): a tese é que "jogo só ganha dinheiro vendendo poder" é herança
> do mobile predatório, e os títulos longevos (CS2, Fortnite, LoL, Helldivers 2, Warframe, Path of Exile)
> faturam com identidade, conveniência de tempo e expressão — nunca com dano. Também **pauta, não código**.

## Onde estamos (o que já existe)

O board hoje cobre **infraestrutura** (core, net, server), **mecânicas de base** (combat, physics, tuning) e
**casca** (ui, brand, hangar). O que sustenta **metagame, economia, retenção e viralidade** ainda não existe.
Vários blocos desta pauta são **extensão** do que já temos — bom, é menos trabalho.

## 1. Calibragem física e balística (embaixo de combate/mechs)

| Módulo | O que é | Hoje no código | Falta |
|---|---|---|---|
| `mass-distribution` | peso/posição das armas muda mira, recuo, giro do torso e strafe | recuo é só cosmético (`MechBase.recoil`); chassi tem `moveSpeed`/`groundAccel` | centro de massa e inércia de verdade; recuo que joga a mira |
| `heat-energy-management` | dissipação granular, risco de shutdown, recarga por consumo de reator | `combat/heat.ts` já tem um dissipador, coeficiente por arma, superaquecimento e travas | dissipação por arma, escudos e reator; shutdown como estado |
| `modular-damage-system` | dano localizado com efeito por subsistema | `combat/damage.ts` já faz 6 partes e efeitos (perna = lento, duas = imóvel, braço = sem arma, cabeça = cego) | ótica (alcance da mira), gerador (subsistemas), atuadores |
| `ammo-ballistics` | tempo de viagem, queda, perfuração vs. ricochete | plasma perde força com a distância (`weapons.ts`); projétil já tem `speed` | queda balística, ricochete/perfuração em blindagem angulada |

## 2. Progressão e metagame — **grupo novo**

| Módulo | O que é | Hoje | Falta |
|---|---|---|---|
| `mastery-skill-tree` | desbloqueia opções táticas e slots — nunca superioridade numérica | decisão "conquistado jogando" (`HANGAR.md`/`GAME_DESIGN.md`); **sem contas** | contas, progressão, árvore de domínio |
| `matchmaking-rating` | MMR por desempenho **e** índice de poder do Mech | salas por código, sem matchmaking (`MULTIPLAYER.md`) | MMR, índice de poder, SBMM |
| `adaptive-ai-director` | IA calibra spawn/agressividade em tempo real (PvE/coop) | `BotSystem` já tem personalidades e um diretor de ataque simples | telemetria do jogador alimentando o diretor |
| `anti-cheat-integrity` | verificação de mira/cadência e telemetria anti-tamper | servidor autoritativo já valida input (G7/G13) | verificação comportamental (a mira assistida no PvP já é uma decisão aberta) |

## 3. Economia e monetização ética — **grupo novo**

| Módulo | O que é | Hoje | Falta |
|---|---|---|---|
| `cosmetics-modular-pipeline` | pintura, decalques, propulsores, cockpit, animações | pintura por parâmetro já existe (`meshKit`/rigs) | pipeline de cosméticos + contas + loja |
| `battle-pass-progression` | trilha sazonal cosmética com missões de gameplay variado | — | tudo |
| `salvage-crafting` | sucata/peças do gameplay viram módulos | só o stat `maxScrapSlots` (Colossus, `chassis.ts`) | coleta, inventário, fabricação |

## 4. Viralidade e comunidade — **grupo novo**

| Módulo | O que é | Hoje | Falta |
|---|---|---|---|
| `auto-highlight-recorder` | últimos ~10 s (abate multi, escape no limite) prontos em 9:16 | — | gravação e exportação no cliente |
| `mech-showcase-exporter` | cartão 3D/imagem do Mech com pintura e stats, link de inspeção | **link `?build=` já existe** (Hangar) | exportar imagem/cartão e página de inspeção |
| `killcam-spectator` | câmera pós-morte com o ângulo do disparo e a parte penetrada | — | killcam e modo espectador |
| `community-hub-events` | eventos globais (ex.: "defesa de setor" soma a pontuação de todos) | — | hub comunitário |

## 5. Telemetria e analytics — **submódulo em desempenho**

| Módulo | O que é | Hoje | Falta |
|---|---|---|---|
| `combat-analytics` | heatmap de morte, vitória por chassi/arma, curvas de TTK → acusa desequilíbrio | `oficina/` mostra TTK e dano; metas travadas por teste (`balance.ts`) | telemetria de partidas reais |
| `onboarding-telemetry` | funil dos primeiros 15 min para achar onde o novato trava | onboarding de dicas (`ui/Onboarding.ts`) | telemetria do funil |

## 6. Monetização ética — o que se vende (2ª leva)

Nenhuma linha abaixo muda **dano, blindagem, hitbox ou cadência**. É o que o especialista chama de "efeito Gunpla":
identidade, conveniência de tempo e expressão.

| Frente | O que se vende | Hoje no código | Falta |
|---|---|---|---|
| Expressão modular | pinturas automotivas (camaleão, carbono, fosco militar, cromado desgastado), decalques/insígnias, contagem de abates na fuselagem, cor de propulsor/tracer/escudo, **kits de carroceria** (ombreira, cockpit, aletas — silhueta, sem hitbox nem blindagem) | pintura por parâmetro (`meshKit`/rigs); flash e cores | pipeline de cosméticos (camadas de pintura e decalque) e kits de silhueta |
| Piloto e cabine | enfeites de cockpit, HUD holográfico temático, **voz da IA de bordo** (fria, sarcástica, distorcida avisando superaquecimento e dano crítico), trajes e capacetes no pódio | `ui/HUD.ts` e avisos de calor | telas internas de cockpit, pacotes de voz, trajes |
| Passe de engenharia | trilha trimestral barata com cosméticos da temporada ("Operação Inverno Polar", "Sucata do Deserto") e **missões que forçam builds diferentes** (5 000 de dano de rifle de precisão, 10 pernas destruídas) | — | trilha, missões e **contas** |
| Execuções e celebração | execução corpo a corpo no Mech em pane crítica, holotag de abate sobre a carcaça, entrada em queda de órbita e gesto de vitória no pódio | morte modular existe (`damage.ts`) | estado de pane crítica executável, animações, holotags |
| Hangar social | cenários de garagem (tempestade cyberpunk, instalação subterrânea secreta, oficina de sucata) — é onde o jogador passa metade do tempo tirando print | galpão 3D único (Hangar 2.0) | cenários alternativos (conversa com `mech-showcase-exporter`, § 4) |
| Licenças e colaborações | skins de parceria (anime de mecha, hardware, música) e eventos que **financiam premiação da comunidade** (modelo do passe do *Dota 2*) | — | decisão do dono sobre marcas; depois, o pipeline |

**Por que é mais lucrativo:** poucos gastando muito (baleia) contra **muitos gastando pouco e sempre**; e pay-to-win
esvazia o matchmaking em meses, mata o clipe assistível e abre mão da cena de e-Sports. **Pré-requisito:** contas
(login) — sem elas não liga nem este grupo nem o 2.

## 7. Pilares de produto e viralidade (2ª leva)

| Pilar | O que é | Hoje | Falta / custo |
|---|---|---|---|
| Física emergente (o efeito clipável) | cenário que desmorona (ponte, guindaste, prédio industrial), falhas espetaculares (propulsor descontrolado girando o Mech, canhão travado fumando, carcaça detonando com onda que empurra quem está perto) e sobreviver em pane crítica até a extração | destroços e morte modular existem (`Destructibles`, `DebrisSystem`) | encadear os efeitos; a onda de choque que empurra aliado **custa física** (G4/G5: teto por tick) |
| Formato: co-op tático (PvE) ou híbrido | esquadrão de 3–4 Mechs caindo em zona infestada para recuperar componentes e extrair; arena/CTF como camada competitiva opcional | PvP online com bots (M4); CTF na Fase 5 (`VISAO.md`) | o outro lado inteiro (diretor de IA + missão + extração). **Decisão de produto grande** |
| Fricção zero de entrada | carregar rápido, 60–120 FPS em hardware intermediário, entrar na partida do amigo em poucos cliques, **stand de tiro/treino no hangar sem carregar partida** | já é leve (sem CDN; qualidade adaptativa G12); `?build=` existe; o hangar já testa disparo (Hangar 2.0, camada 3) | convite/jump-in e o modo treino dedicado |
| Criadores e espectadores | câmera de espectador para casters, **código de build curto** (`CM-HEAVY-V9-SNIPER`) importável com um clique, replay pós-partida para render 4K | link `?build=` já existe (longo) | código curto com copiar/colar; killcam/espectador (§ 4); ferramenta de replay |
| Narrativa viva e metagame global | guerra comunitária por setores (as vitórias de todos somam) e eventos semanais que mudam o meta (tempestade eletromagnética derruba escudo, falha de suprimentos) | `UNIVERSO.md` | hub comunitário (§ 4) e eventos dirigidos pelo servidor |

**Quem toca a 2ª leva:** **Claude** — o estado de pane crítica e os efeitos que empurram, o co-op/extração, o
código curto de build, o espectador/replay e a telemetria (custo de CPU medido em cada um). **Codex** — kits de
carroceria, cenários de hangar, animações de execução e pódio, captura em 4K. **Gemini** — loja, passe e telas de
progressão, cockpit e HUD temático, hub de eventos e funil. **Qwen** — a pauta, os testes de simulação e o balanço.

## 8. Drones em combate — o que presta do STERM (2026-09-27)

Fui ler o grafo 3D do pipeline ABBADON (`D:\SERAFIMHUB\sterm-1`) e a "navegação por drone" de lá. Veredito curto: **o
drone do STERM é uma câmera sobre trilhos, não uma unidade de combate** — não tem navmesh, busca de caminho, desvio de
obstáculo nem física (é um Catmull-Rom pré-calculado + `lerp`, com a máquina de estados `panorama → approach → inspect
→ depart`). **Não existe IA de drone para reaproveitar.** O que presta são três ideias, e as três são baratas:

| Ideia do STERM | O que serve aqui | Dono |
|---|---|---|
| `DRONE_PRIORITY` — a câmera escolhe o nó mais crítico (CVE → segredo → domínio…) | **Prioridade de alvo do drone:** ele caça o que já está ferido (perna travada, braço destruído, cabeça cega) em vez de escolher por distância — encaixa direto no dano por parte que já existe (`combat/damage.ts`) | Claude |
| 4 modos de voo × 4 altitudes, cada perfil um conjunto de números | **Modos de drone:** patrulha alta, reconhecimento e "colar no alvo" — cada modo é só um perfil (altura, distância, velocidade) sobre o mesmo controlador | Claude (IA) + Gemini (HUD) |
| Trilha montada **antes**; câmera e lógica **fora** do tick | Regra de ouro para tudo que voa no CYBERMECH: trilha pronta no spawn, `rng.ts` no lugar de `Math.random`, vetores pré-alocados — senão quebra G2 e G4 | Claude |

**O que é novo de verdade (não vem do STERM):** desvio de obstáculo com Rapier (raycast + separação), ponto de recuo, e o
custo na banda — que tem conta e tem saída (§ 8.1). É engenharia de simulação: **território do Claude**, e depois do loop
da partida definido (§ 7). Decisão de fase com o dono.

### 8.1 Quanto pesa (e como fica barato)

Números do nosso próprio código, não estimativa: uma unidade custa **19 bytes** (`UNIT_BYTES`, `shared/net/state.ts`), o
estado vai a **20 Hz** e a moldura do WebSocket soma 20% (`WIRE_OVERHEAD = 1.2`) → **456 B/s por unidade**. O teto é de
**8 192 B/s** por jogador (`DOWNLOAD_BUDGET`). A sala cheia de hoje (**12 unidades** — `ROOM_UNITS`: 8 Mechs, 3 andróides e o
técnico) usa **6,2 KB/s** no total, pela própria conta do site (`downloadPerSecond`, a mesma que os testes travam): 5,3 KB/s
de estado + ~0,9 KB/s dos eventos da luta. Sobram ~1,8 KB/s, e o código calcula que **cabem 15 unidades** antes de precisar
de delta. Um drone por jogador seriam **+3,6 KB/s: não cabe**. Mas o drone não precisa custar 19 bytes nem 20 Hz:

| Como | Efeito | Observação |
|---|---|---|
| **Registro curto de unidade leve** (id + posição + yaw + flags ≈ 10 B) | 456 → ~240 B/s | drone não tem seis partes nem calor; é um segundo formato no mesmo codec |
| **Estado do drone a 5 Hz**, o resto o cliente extrapola | ~4× menos | voa em trajetória suave; a extrapolação erra pouco |
| **Trilha pré-calculada** (o evento de spawn leva `path id` + instante; o servidor manda só correção) | **~0 B/s** em voo | é a ideia do STERM pagando em **banda**, não só em determinismo — vale para drone de patrulha, **não** para drone pilotado pelo jogador |
| **Teto por esquadrão** (1 drone por time, ou habilidade com recarga) | divide por 4 | decisão do dono: o drone vira recurso tático, não equipamento padrão |
| **Alcance (AoI) e delta** — o próximo passo já previsto do online | corta o agregado inteiro | passando de ~20 unidades, o delta deixa de ser opção |

Duas ou três dessas linhas juntas deixam o drone quase de graça em banda. O que **não** dá para fugir é o desvio de
obstáculo e o ponto de recuo: é física nova dentro do tick, e é aí que aparece o custo de CPU — medir com a sala cheia antes
de fixar quantos drones por partida. (A conta da banda é a mesma que o `npm test` trava e a oficina publica; a primeira versão
desta seção, em 27/09, saiu com o número errado — 15 unidades e 6,8 KB/s —, corrigido aqui: são **12 unidades** e **6,2 KB/s no
total**. A conclusão não muda.)

## 9. Elementos do cenário, zonas e pilotagem (2026-09-27)

Pedido do dono no mesmo dia: **torres**, **zonas de regeneração**, **zonas de resfriamento** (onde o Mech atira sem esquentar
tanto), os **andróides entrando e saindo dos Mechs** — e a **entrada dos bots no cenário**, esta ele já mandou ao Codex. Tudo
isso cabe na banda se valer uma regra só: **só o que se move precisa de bytes por estado.**

| Elemento | Como entra | Custo na banda | Dono |
|---|---|---|---|
| Torres | posição fixa da arena (uma vez); vida/calor num estado curto e disparo/quebra por evento | ~0–3 B por torre | Claude (sim) + Codex (visual) |
| Zona de regeneração | volume fixo da arena, definido uma vez; quem cura é o servidor (autoridade) | **0 B** | Claude |
| Zona de resfriamento | idem, volume estático; dá bônus de resfriamento dentro dele (o `coolingBoost` de `combat/heat.ts` já existe) | **0 B** | Claude |
| Andróide **entra** no Mech | o andróide **sai da lista de unidades** enquanto está dentro; o Mech ganha a bandeira "tem piloto" (o byte de flags usa 4 dos 8 bits) | **−456 B/s** enquanto dentro: **economiza** | Claude (sim) + Gemini (tecla/HUD) |
| Andróide **sai** do Mech | evento de spawn do andróide no ponto do Mech | 1 evento | Claude |
| Entrada dos bots no cenário | o **visual** (cápsula, portão, descida de órbita) é do Codex; **onde e quando** nascem é do diretor de ataque (`adaptive-ai-director`, § 2) | a do `SPAWN` que já existe | Codex (visual) + Claude (regra) |

**Cuidado com o teto:** `MAX_UNITS = 32` (o id cabe em 1 byte) e a sala cheia de hoje usa 15 — torres, zonas e drones moram
dentro dele, mas **quem aperta primeiro é a banda, não o formato**. Bandeira nova nas flags (ex.: "tem piloto") muda o
protocolo: subir `PROTOCOL_VERSION`, porque por desenho o servidor recusa cliente de versão diferente. E a regra do
`GAME_DESIGN.md` continua valendo: zona de cura e de resfriamento são **vantagem tática de posicionamento**, iguais para os
dois times — nunca algo que se compra.

## Divisão (o grosso é do Claude)

- **Claude** — a engenharia: `mass-distribution`, `ammo-ballistics`, `adaptive-ai-director`, `matchmaking-rating`,
  `anti-cheat-integrity`, `salvage-crafting`, `combat-analytics` e a progressão. É o território dele (simulação,
  rede, servidor). Cada regra com teste de simulação (G14).
- **Codex** — o visual: `cosmetics-modular-pipeline`, cockpit, `mech-showcase-exporter` (o cartão 3D).
- **Gemini** — a interface: telas de progressão, loja, funil/`onboarding-telemetry`, hub de eventos.
- **Qwen** — a pauta (este arquivo), os testes de simulação e o balanço travado por teste.

## Princípio que não se negocia

Tudo aqui é **cosmético ou conquistado jogando**. Se um bloco exige superioridade paga, ele é recusado — não
importa quanto renda (`GAME_DESIGN.md`, "NÃO É PAY-TO-WIN").

## Recomendação do Qwen (2026-09-27) — por onde eu começaria

O especialista fechou com uma pergunta: **o loop principal da partida (drop → extração) ou o protótipo da montagem
modular?** Minha leitura, e é de propósito a mais barata de executar:

1. **O loop primeiro — e só no papel.** É a decisão que trava as outras: duração e ritmo definem a extração, o
   diretor de IA e o tamanho da sala. Uma ficha de uma página resolve; não precisa de código.
2. **Duas coisas pequenas que servem a qualquer loop:** o **stand de tiro/treino** (offline, sem servidor,
   reaproveitando o hangar que já testa disparo) e o **código curto de build** (o `?build=` já existe; falta o
   botão de copiar). Reter o novato e gerar clipe não depende de infraestrutura nova.
3. **A montagem modular já existe** (Hangar 2.0 + `validateLoadout`); o que falta é **consequência**
   (`mass-distribution`) — engenharia do Claude, e melhor depois do loop definido.
4. **Nada de loja ou passe antes de contas.** Sem login, os grupos 2, 3 e 6 desta pauta ficam no papel.

## Próximo passo

O dono prioriza: quais grupos entram primeiro e em que fase do `ROADMAP.md`. Depois disso, um PR por bloco,
pelo dono do território, com a ficha de design (`fichas/`) antes do código.
