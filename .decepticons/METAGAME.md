# METAGAME — a pauta dos blocos que faltam

> Recebido do dono em 2026-09-26: orientação de um especialista externo sobre os módulos que faltam para o
> CYBERMECH ter metagame, economia justa, retenção e viralidade — sem pay-to-win. **Isto é pauta, não é
> código pronto:** nada aqui está no jogo. O detalhe técnico de cada bloco sai quando ele entrar na fila.
>
> Regra do projeto que vale para tudo aqui: **nada que se compra ganha partida** (`GAME_DESIGN.md`) e
> **toda regra de gameplay tem teste de simulação** (G14). A prioridade e o "o quê" são do dono.

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

## Próximo passo

O dono prioriza: quais grupos entram primeiro e em que fase do `ROADMAP.md`. Depois disso, um PR por bloco,
pelo dono do território, com a ficha de design (`fichas/`) antes do código.
