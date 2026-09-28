# HISTÓRICO DE DECISÕES — CYBERMECH

> Cofre append-only (M2). Nunca edite entradas antigas. Entrada nova SEMPRE no topo.

## [2026-09-27] O flake do `pre-push` endurecido de verdade, e onde mora a máquina de Ondas
**Pedido (dono, repassando pedidos do Gemini e do Codex):** 1) endurecer `server/room.test.ts > teto por IP` (o flake trava o check de todo mundo; a flag de verdade é `--maxWorkers`); 2) confirmar/ajustar o contrato do `MissionHUD` e dizer se a onda roda no servidor; 3) ligar a máquina de Ondas em `sim/Match.ts` e `server/ArenaRoom.ts`; 4) os contratos que o Codex pediu (respawn por ponto seguro, alvo móvel do Hangar); 5) investigar por que o CI não disparou num PR docs-only.
**Achado (Claude) — a raiz não era concorrência:** minha própria correção anterior (PR #91, `--maxWorkers=1` global) tratou o sintoma, não a causa, e o Qwen apontou certo na revisão (serializa o CI de todo mundo à toa). A causa real: o `WebSocket` global do Node (undici), no Windows, às vezes só dispara `error` — nunca `close` — numa conexão que o servidor fecha logo após o handshake, deixando a `Promise.all` dos fechamentos pendurada. Troquei pelo `WebSocket` do pacote `ws` (o mesmo do servidor) e reescrevi o teste para abrir as vagas em sequência (sem corrida de chegada entre três conexões simultâneas): a terceira agora é **sempre** a recusada. Removido o teto global de workers. **5 execuções seguidas, concorrência total, zero flake** no `server/room.test.ts` (antes, falhava sob carga). Achado de quebra: `client/src/net/online.test.ts` tinha o mesmo tipo de fragilidade (asserções de tempo real contra um servidor de verdade rodando `setInterval`, que pode atrasar sob 31 processos competindo por CPU) — três asserções viraram esperas com prazo generoso, no mesmo padrão que o `join()` do próprio arquivo já usava.
**Decisão (Claude) — onde mora a máquina de Ondas:** dentro do `Match`, como o `Round` já faz hoje (tick fixo, determinístico), para funcionar sozinha no single-player e autoritativa no servidor sem custo extra de rede (eventos pequenos nas transições, não campo novo no snapshot de 20 Hz). O contrato do `MissionHUD` (`onWaveStart`/`onWaveProgress`/`onWaveClear`/`onMissionEnd`) já recebe só dados primitivos — **confirmado sem mudanças**. Implementação registrada como a próxima entrega grande do Claude.
**Achado (Claude) — o CI que não dispara:** os PRs #91 (zonas) e #92 (docs do Qwen) tiveram pushes em que só o `Etiquetas` rodou e o `CI` demorou ou só apareceu no push seguinte, sem nada de errado no `ci.yml`. É entrega de webhook do GitHub, não configuração nossa; a regra 13 do AGENTS.md já cobre isso (esperar o check aparecer antes do `--watch`), só que especificamente pelo `CI`, não por "qualquer check".
**Quem decidiu:** dono (os pedidos); Qwen (a revisão que apontou a causa certa); Claude (o diagnóstico, a correção e a decisão de arquitetura da onda).

## [2026-09-27] As três regras entram no `AGENTS.md` (14–16), e a segunda rodada do drone
**Pedido do dono:** "quero poder pilotar o drone também, ou colocar piloto automático nele. o drone conta como um andróide ou mech na partida, a não ser que consiga colocar os drones como adição aos mechs, esse seria o cenário ideal. o drone é mais ágil e deve ter diferenciais em relação aos andróides; o drone tem limitação de bateria, igual um drone normal, não consegue ficar a partida inteira voando, precisa parar no alto de um prédio pra ser recarregado (ideia surgiu agora); **digo SIM pra suas 3 regras**; PROSSIGA, já enviei tudo para todos".
**Decisão (Qwen + dono):**
- **As três regras viraram regra do time**, escritas no `AGENTS.md` (arquivo que vale para todos os agentes, com registro aqui, como manda o próprio arquivo): **14** — entrega só conta quando está na `main` (o que não está vai para "EM BRANCH — NÃO ESTÁ NO AR", com o PR); **15** — branch sem PR no mesmo dia e **fechado em 48 h**; **16** — toda entrega visível fecha com **captura em `.decepticons/arte/`** e **o caminho para vê-la funcionando** (senão o dono não tem como testar). A seção do `ESTADO_ATUAL.md` deixou de ser proposta: está em vigor.
- **Drone, segunda rodada:** **pilotável pelo jogador ou automático** (os dois modos); **mais ágil que o andróide**; **cenário ideal: adição ao Mech** — não consome vaga de Mech nem de andróide, e se não couber conta como **uma unidade** (vaga de andróide); **bateria** limitada (não fica a partida inteira no ar) com **recarga pousando numa plataforma no alto de um prédio**. Na banda, a bateria sai por **evento** (pousou/levantou/vazia) com o cliente derivando a porcentagem — se a deriva incomodar, 1 byte (11 B = 66 B/s; 8 drones = 528 B/s, 84% da meta, ainda cabe). A plataforma entrou na tabela do `METAGAME.md` § 9 como **0 B/s** (ponto fixo, como as zonas) e a ficha ganhou as metas 8 e 9 e as perguntas em aberto (quantos/quanto dura a bateria, se a plataforma é disputada, o que acontece com a bateria vazia, como o piloto automático se comporta).
**Quem decidiu:** dono (as regras, o vínculo do drone com o Mech, a bateria e a recarga); Qwen (a redação das regras, o registro e a ficha).

## [2026-09-27] A ficha do drone, e o mapa das entregas que não chegaram
**Pedido do dono:** "escreve a ficha do drone E FAÇA SUAS tarefas pendentes… Como devemos conduzir isso da forma mais inteligente e estratégica possível? será que devemos repensar alguma regra? definir novas orientações e boas práticas? me oriente o que eu devo fazer. estou testando e no jogo está aparentemente tudo funcionando, mas ainda não vi todas essas atualizações…"
**Achado (Qwen) — a razão de o dono não ver nada é integração, não código:** `git branch -r --no-merged origin/main` devolve **7 branches fora do ar**: dois com PR aberto (`claude/zonas-cura-resfriamento`, #91; `gemini/missoes-hud`, #88) e **cinco do Gemini sem PR nenhum** (`modo-hud-audio` e `telas-online`, de 27/09; `setas-inimigos`, `sons-androides` e `primeira-partida`, de 25/09). E o #88, além de não mergeado, **não está ligado a nenhum arquivo do jogo** — a tela não apareceria nem depois do merge.
**Decisão (Qwen):**
- **Ficha do drone** (`fichas/drone.md`, status `proposta`): três classes por função, escala 1 (1 a 2 m de largura), tiro fraco (o blaster do andróide: dano 4 a cada 0,4 s), **morre inteiro** (sem as 6 partes de um Mech — o que também enxuga a rede), trilha pré-calculada, **7 metas que viram teste** e **6 perguntas que só o dono responde**.
- **`ESTADO_ATUAL.md` ganha a seção "EM BRANCH — NÃO ESTÁ NO AR"**, com as 7 e o PR de cada uma. A partir de agora, o que não está na `main` **não** entra em "ÚLTIMA SESSÃO FEZ": é a resposta direta ao "não vi essas atualizações".
- **Três regras propostas ao dono (aguardando sim/não):** (1) **entrega só conta quando está na `main`**; (2) **branch sem PR no mesmo dia, e fechado em 48 h** se não virar PR (mergeado ou declarado morto); (3) toda entrega visível fecha com **captura + o caminho para ver no jogo**, senão o dono não tem como testar.
- **Revisão #88, follow-up:** o commit `c4cbee6` **mantém** o `VITEST_MAX_WORKERS` (placebo: o Vitest 5 não lê a variável; a flag é `--maxWorkers`). **Atualização no mesmo dia:** o Claude fixou o teto **certo** — `--maxWorkers=1` em `scripts/test.mjs`, com medição (1 worker = 2/2 limpas; 2 = 1/3 falha; 4 = 1/2 falha) —, então a linha do Gemini fica **redundante e deve sair** do PR dele. Parecer e sugestões nos comentários do PR.
**Quem decidiu:** dono (o pedido e a decisão do drone); Qwen (a ficha, o mapa das entregas e as propostas — as regras dependem do aval do dono).

## [2026-09-27] Teto de workers do Vitest fixado em 1 por padrão
**Achado (Claude, R17, durante o PR das zonas):** o `pre-push` recusou o push do PR de zonas duas vezes seguidas, com falhas diferentes a cada vez (o teto por IP em `server/room.test.ts`, depois o M4 online em `client/src/net/online.test.ts`), sem relação nenhuma com o diff das zonas. É exatamente o flake que o Qwen já tinha registrado em 27/09 ("com concorrência padrão o teste de limite por IP excedeu timeout"; "`VITEST_MAX_WORKERS` é placebo, a flag de verdade é `--maxWorkers`"): com `isolate` (padrão do Vitest 5), os 31 arquivos de teste viram 31 workers, e numa máquina de poucos núcleos os testes que dependem de tempo real (servidor WebSocket, física, ambos de verdade) competem por CPU e estouram o timeout — não é bug de jogo, é o corredor ficando estreito demais.
**Decisão (Claude):** medir antes de decidir o número. Testado em `scripts/test.mjs`: 1 worker, 2 execuções, 2 limpas; 2 workers, 3 execuções, 1 falha; 4 workers, 2 execuções, 1 falha. Fixei o padrão em `--maxWorkers=1` (sobrescrevível por quem passar o próprio `--maxWorkers`), porque o `pre-push` roda uma vez por push, não por iteração de desenvolvimento: a diferença de alguns segundos pesa menos que um portão que bloqueia todo agente por um flake que não é dele. O CI do GitHub (poucos núcleos por padrão) já era estável sem isso; a mudança é para a máquina local.
**Quem decidiu:** Claude (achado durante uma tarefa não relacionada, corrigido por ser barato e seguro — R17).

## [2026-09-27] Zonas de cura e resfriamento na arena
**Pedido (dono):** "3 mechs + 3 andróides que se regeneram, fica muito difícil! preciso de um turret, ou um lugar pra recuperar a vida, ou um resfriador pra me ajudar a ter mais fôlego! pensemos e apliquemos evoluções de combate! se não o jogador não continua a jogar se sempre for massacrado!" — no mesmo dia, o Gemini pediu (repassado pelo dono) uma máquina de estados de Ondas em `sim/Match.ts` ligada ao `MissionHUD` e sincronizada no servidor.
**Decisão (Claude):** priorizar a menor entrega que já alivia a dificuldade hoje, sem esperar o modo Sobrevivência inteiro: implementar as zonas que o Qwen já tinha especificado em `METAGAME.md` § 9 (zona de cura e de resfriamento, custo de rede 0 B/s, vantagem de posicionamento igual para os dois lados). Ficaram de fora nesta entrega: torres (precisam de vida/calor em rede e IA de mira, escopo maior) e a máquina de estados de Ondas (pedido do Gemini — registrado em `ESTADO_ATUAL.md`, "PRÓXIMA SESSÃO COMEÇA COM", para não empilhar duas features grandes na mesma sessão).
**O que ficou:** `combat/Zone.ts` (regra pura, testável), `combat/heat.ts` ganha `HeatSink.ventExternal`, `MechBase.vent()`, fiação em `sim/Match.ts` (vale para jogadores e bots, então também no servidor, por ser a mesma simulação) e visual provisório em `environment/Arena.ts` (Codex pode substituir). 6 testes novos, `npm run check` verde.
**Quem decidiu:** dono (o pedido); Claude (a implementação e o escopo do que ficou para depois).

## [2026-09-27] Os ícones do mapa (um por módulo) e o papel do drone decidido
**Pedido do dono:** "a ideia do drone é que cada um sirva pra uma dessas tarefas: reconhecimento, ataque, recuperação de vida, etc. o drone pode ser na proporção dos androides, com 1 a 2 metros de largura… o drone é FRACO, os tiros dele são fracos, iguais aos do androide. prossiga com suas tarefas."
**Decisão (Qwen + dono):**
- **Ícones por tipo no mapa da oficina — a ideia do ABBADON, agora de verdade:** `scripts/site/grafo.mjs` ganhou um **registro módulo → ícone** (20 formas desenhadas à mão em primitivas de SVG) com queda para o ícone da frente; cada chip mostra o seu e a legenda virou icônica (o pontinho de cor saiu). Sem biblioteca e sem arquivo de imagem: ~150 bytes por ícone dentro do HTML do build, zero requisição e **zero KB no jogo** — o que no STERM exigiu React/DOM aqui sai de graça, porque o mapa é SVG gerado no build.
- **Medido, não "achei bonito":** 19 ícones para 19 módulos, 10 na legenda e **nenhuma sobreposição** de texto ou selo (medido no Chrome); o `site --check` passa a exigir os ícones, então não somem sem ninguém notar. Captura em `.decepticons/arte/mapa-icones.png`. Ressalva honesta: **o modelo que eu rodo não lê imagem**, então o julgamento do desenho é do dono — cada forma é uma linha do registro, trocar é barato.
- **Drone decidido:** **três classes por função** (reconhecimento, ataque, recuperação de vida), **escala dos andróides (1 a 2 m)** e **tiro fraco, o do andróide**; o valor dele é emoção e perspectiva nova, não poder de fogo. Consequências registradas no `METAGAME.md` § 8 e § 10: a função **não muda o custo na rede** (mesmo registro leve de 10 bytes a 5 Hz, § 8.2), a cura é **posicionada** (nunca vantagem comprada) e o drone **não substitui** o Mech de assalto.
**Quem decidiu:** dono (o papel do drone e o pedido); Qwen (o desenho dos ícones, a medição e o registro).

## [2026-09-27] A banda do drone vira especificação (e a revisão cruzada do MissionHUD)
**Pedidos (via Gemini, repassados pelo dono):** revisar o PR da interface de missões (MissionHUD); atualizar o grafo e a saúde técnica da oficina com o novo módulo e os 219 testes; detalhar no `METAGAME.md` § 8 o orçamento de banda e a técnica de sincronização dos drones.
**Decisão (Qwen):**
- **§ 8.2 escrita — o drone cabe:** **registro de unidade leve de 10 bytes** (id, posição, yaw, bandeiras — sem partes, calor nem pitch) a **5 Hz** = **60 B/s por drone**; os 8 do pior caso somam **480 B/s**, levando a sala de 6,2 para **6,7 KB/s de 8,0 (83%)**. Com trilha pré-calculada, ~0 B/s em voo. Interpolação com **amortecimento de 200 ms**, extrapolação limitada a **250 ms**, correção só acima de ~1,5 m; nascer, morrer, trocar de alvo e atirar vão por **evento**. O teste que trava: sala cheia + 8 drones abaixo dos 8 192 B/s, em `shared/net` (frente do Claude).
- **Revisão cruzada (PR #88):** o branch `gemini/missoes-hud` estava **sem PR** — abri o PR e postei o parecer. A interface é boa e o contrato de callbacks (G3) é útil, mas **o módulo não está ligado a nada** (nenhum arquivo o importa: a tela não existe no jogo) e o PR mexe em `scripts/test.mjs` ligando `VITEST_MAX_WORKERS=1` no runner de **todos** — variável que o **Vitest 5 não lê** (o pacote não tem nenhuma leitura de `process.env.VITEST_*`; o que existe é a *flag* `--maxWorkers`), então é placebo e o flake do `teto por IP` continua. Ainda: `innerHTML` com texto que o contrato diz vir do sim/servidor, 3 dos 5 testes novos que não verificam o que prometem (e um com nome que não corresponde ao corpo) e dois ajustes menores.
- **O grafo e a saúde técnica não precisam de trabalho manual:** o mapa é por módulo (diretório) e o `MissionHUD` mora em `client/src/ui/`, que já é o módulo `ui`; a contagem de testes é lida no build. Depois do merge, os **219 testes** e as linhas novas aparecem sozinhos na oficina.
**Quem decidiu:** dono (os pedidos); Qwen (a especificação, a revisão e o parecer); Claude (implementação, quando o drone entrar).

## [2026-09-27] Horizonte futuro registrado na visão e na landing

O dono registrou cinco conceitos para evolução do CYBERMECH: capacidade de mapas e jogadores; piloto e artilheiro no mesmo Mech; drones menores que andróides; transporte de robôs e tropas; missões de sobrevivência em fases. Foram documentados em `VISAO.md`, `METAGAME.md` § 10 e `ROADMAP.md`, e apresentados na landing em seção “em estudo” separada da VITRINE de funcionalidades reais. Não foram definidos prazos, número-alvo de jogadores, escala exata do drone nem persistência das missões. A ordem técnica é uma sugestão, sem prioridade aprovada.

## [2026-09-27] Calor legível no rig sem pós-processamento (Codex)
**Decisão:** o casco recebe brilho âmbar progressivo a partir de 65% de calor e o rig exibe uma pequena nuvem de vapor ao superaquecer, intensificada durante o resfriamento ativo. A emissão é um uniforme do material combinado; o vapor usa uma geometria de quatro pontos criada junto do rig e atualizada em buffer fixo. Sem pós-processamento, alocações por frame ou dependência de regra de combate.
**Custo:** +1 draw call por Mech (9 → 10, ainda no teto); CPU por quadro limitada a atualizar quatro coordenadas e opacity apenas quando muda o estado visual.
**Quem decidiu:** Codex, dentro da frente visual. A regra/limiares de calor permanecem inalterados.
**Verificação:** captura em `.decepticons/arte/heat-visual.png`; `npm run check` passou com `VITEST_MAX_WORKERS=1` (214 testes e verificações do painel, build, budgets, smoke e site). O teste padrão com 30 workers excedeu o timeout do teste de conexão por IP.

## [2026-09-27] A saúde técnica vira seção da oficina (e uma correção minha, R17)
**Pedido (mensagem do Gemini, repassada pelo dono):** "Qwen, prepare o relatório de saúde técnica e integre ao Obsidian."
**Decisão (Qwen):** o Obsidian não existe mais como plano — o dono o descartou em favor do grafo como camada visual (a pendência saiu do `ESTADO_ATUAL.md` no PR #82). O relatório virou **seção da oficina** (`/oficina/`, "O que o projeto prova sobre si mesmo"), com **dado gerado no build, não digitado**: `saudeTecnica()` lê o repositório (os testes por módulo do `arquitetura()` e os indicadores de rede do `shared/net/`) e conta as **conversões forçadas** (`as unknown as`) no fonte; `scripts/site/saude.mjs` desenha. O `site --check` passa a conferir a seção (indicadores e a lista), então ela não pode sair vazia no deploy. Publica junto com a bancada e não envelhece.
**Primeiros números publicados:** **214 testes** em 19 módulos, **12 dos 19 com teste próprio (63%)** — a lista dos 7 sem teste fica à vista de propósito, como bússola de onde uma regra nova entra sem rede; **19 bytes por robô a 20 Hz**, sala cheia em **6,2 KB/s dos 8,0** da meta (cabem 15 unidades antes de delta); **28 conversões forçadas em 117 arquivos TypeScript** — o débito que a seção 9 do `MULTIPLAYER.md` vigia, agora contado em número.
**Correção (R17):** a entrada desta mesma data sobre o drone na banda saiu com **15 unidades** e **6,8 KB/s** — erro de soma meu (`ROOM_UNITS = 8 + 3 + 1 = 12`) contra a medição que o próprio `MULTIPLAYER.md` já registrava (12 unidades, **6,2 KB/s no total**, estado + eventos). A conclusão não muda — um drone por jogador (+3,6 KB/s) continua não cabendo —, mas os números foram corrigidos no `METAGAME.md` § 8.1 e no `ESTADO_ATUAL.md`. Remédio para a causa: a partir de agora a banda tem um lugar onde é **medida** (a oficina), não estimada de cabeça.
**Quem decidiu:** dono (o pedido); Qwen (o formato, a implementação e a correção).

## [2026-09-27] O drone na banda, e os elementos do cenário (torres, zonas, pilotagem)
**Pedido do dono:** "mas será q o drone vai pesar tanto? e como fazemos pra melhorar esse consumo então, pois os drones eu acho que serão um diferencial excelente… quero também que tenhamos outros elementos (turrets, zonas de regeneração, zonas de resfriamento onde o robô possa ficar atirando sem aquecer tanto), quero também que os andróides possam entrar e sair dos bots" — mais a **entrada dos bots no cenário** (ideia já mandada por ele ao Codex) e a lembrança de que no STERM aquilo se chamava **"balão"**, não drone.
**Achado (Qwen), com os números do nosso código:**
- **O "balão" existe e a memória do dono está certa:** `DemoGraph3D.tsx:326` (`BalloonCamera`, ciclo automático com oscilação vertical suave) e o modo `'balloon'` em `HuntGraph3D.tsx:20/49`. É **câmera**, como o drone — não unidade. Nada de IA de vôo lá.
- **Quanto pesa:** `UNIT_BYTES = 19` (`shared/net/state.ts`) × 20 Hz × `WIRE_OVERHEAD = 1.2` = **456 B/s por unidade**; o teto é `DOWNLOAD_BUDGET = 8 192 B/s`. A sala cheia de hoje (15 unidades) gasta **6,8 KB/s só de estado**. Um drone por jogador (+3,6 KB/s) **não cabe**; um drone por esquadrão, com registro curto de unidade leve, a 5 Hz e com trilha pré-calculada, fica **quase de graça**.
- **A regra que faz o cenário caber:** só o que se move precisa de bytes por estado. Zonas de cura e de resfriamento são **volumes estáticos da arena: 0 B/s**; torres são posição fixa + estado curto; e o andróide que **entra** no Mech sai da lista de unidades — **economiza** 456 B/s enquanto está dentro (bandeira "tem piloto" no byte de flags; sobra metade dos bits).
**Decisão (Qwen):** registrado em `METAGAME.md` — § 8.1 (a conta da banda e as cinco formas de baratear o drone) e § 9 (torres, zonas, entrar/sair do Mech e a entrada dos bots no cenário: **visual é do Codex, onde/quando nascem é do diretor do Claude**, G3/G14). A decisão de quantos drones por partida e em que fase é do dono.
**Quem decidiu:** dono (os elementos e a prioridade); Qwen (a conta e o registro); Claude (a engenharia, quando entrar).
## [2026-09-27] Fichas de design visuais e técnicas (Codex)
**Entrega:** propostas para o Ferret-X leve, Colossus-01 pesado, andróide A-1 e canhão de plasma, casulo de foguetes, blaster e motosserra em `.decepticons/fichas/`.
**Critério:** dimensões visuais vêm dos blueprints/rigs; números existentes vêm de `chassis.ts` e `combat/weapons.ts`. O que ainda não existe para os chassis leve e pesado fica `?`, aguardando Claude e o dono. As propostas não autorizam stats, slots nem mudança de combate.
**Próximo:** Codex começa a camada visual de calor no Mech; stats dos chassis permanecem com Claude após decisão do dono.

## [2026-09-27] O que o STERM ensina: os ícones do grafo e a ideia do drone
**Pedido do dono:** "no /sterm-1, no motor pipeline ABBADON, o grafo 3d dele tem uma configuração muito bonita e funcional, onde usamos o ícone holográfico de um banco de dados pra representar dados, e outros ícones que façam sentido pra cada tipo de elemento no grafo (nosso obsidian)… ainda no sterm, muito tempo atrás criamos uma navegação por drone. Veja se aquele conhecimento é valido pra implementarmos aqui de alguma forma (para inserirmos drones no combate), ou introduzirmos isso no planejamento".
**Achado (Qwen, leitura de `D:\SERAFIMHUB\sterm-1`, sem tocar em nada):**
- **Os ícones:** o grafo do ABBADON (`src/components/pipeline/AttackSurfaceGraph3D.tsx`, 7 051 linhas) tem um **registro tipo → ícone** (`NODE_ICONS`, linhas 157–172; `DNSRecord`/`CloudAsset`/`Container` → `Database`, `CVE` → `Skull`, `WAF` → `Shield`, `Framework` → `Cpu`), com um **registro irmão de cores por tipo**; o corpo do nó é **geometria por tipo** (3 níveis de LOD por distância) e o ícone é **DOM** (drei `<Html>`), não textura. O brilho é falso e barato: `emissive` + cascas transparentes + névoa + poeira em `InstancedMesh`, **sem pós-processamento**. Stack: React + `@react-three/fiber` + `drei` (não é `3d-force-graph`; o README está velho).
- **O drone:** `DroneViewController` (~530 linhas) é **câmera sobre trilhos**, não unidade de combate — Catmull-Rom pré-calculado, `lerp` com easing, máquina de estados `panorama → approach → inspect → depart`, 4 modos × 4 altitudes, e um `DRONE_PRIORITY` que escolhe o nó mais crítico. **Não há** navmesh, busca de caminho, desvio de obstáculo, raycast nem física.
**Decisão (Qwen):**
- **Os ícones eu faço, no mapa da oficina:** o nosso grafo é **SVG gerado no build**, então o ícone vira `<path>` embutido — zero KB, zero DOM por frame, determinístico. O que no STERM exigiu React/DOM aqui sai de graça; registrado como próximo trabalho do Qwen.
- **O drone vai para o planejamento, com o Claude:** o STERM **não** entrega IA de drone (não há navegação de unidade para portar). Entra como bloco novo na pauta (`METAGAME.md` § 8), com o que presta (prioridade de alvo pelo dano por parte, modos de voo como perfis de números, trilha pré-calculada e lógica fora do tick) e o que é engenharia nova (desvio com Rapier, ponto de recuo, e o **custo na rede**: o drone conta como unidade, 19 bytes, teto de 8 KB/s). Fase: com o dono.
**Quem decidiu:** dono (o pedido); Qwen (a leitura e o encaminhamento); Claude (território, quando o bloco entrar).

## [2026-09-27] Online: barricadas e placar vindos do servidor
**Achado (dono):** "sim, prossiga" (sequência do PR #77, próximo passo era fechar o online).
**Decisão:** o servidor autoritativo passa a mandar `PROP_BROKEN(id)` a cada barricada que quebra e `ARENA_RESET` na rodada nova; o cliente aplica pelo `id` estável (nova `Destructibles.breakById`). O placar do multiplayer é montado pelos `KILL` que o servidor já enviava (o cliente offline em `damage: false` nunca contaria): `OnlineSession.standings()` + `onScore` alimentam o HUD.
**Quem decidiu:** Dan.

## [2026-09-27] A pauta do metagame ganha a 2ª leva (monetização ética e produto)
**Pedido do dono:** mais duas visões do mesmo especialista externo — a **monetização ética** em 6 frentes e os **5 pilares de produto/viralidade** (física emergente, co-op tático, fricção zero, criadores/espectadores, narrativa viva), com a pergunta final: priorizar o **loop principal da partida** (drop → extração) ou o **protótipo da montagem modular**. Diretriz mantida: o grosso é do Claude e economia de tokens.
**Decisão (Qwen):** as duas visões entraram no **mesmo** `METAGAME.md` (§ 6 e § 7), no formato da casa — o que é, **hoje no código**, **o que falta** —, mais a divisão "quem toca a 2ª leva" e a recomendação. Nada implementado: continua pauta.
**Recomendação registrada:** o loop da partida **primeiro e só no papel** (duração/ritmo travam extração, diretor de IA e tamanho da sala); depois dois blocos pequenos e offline — **stand de tiro no hangar** e **código curto de build** (o `?build=` já existe, falta o copiar); `mass-distribution` (a consequência da montagem) é engenharia do Claude e melhor depois do loop; **nada de loja ou passe antes de contas** (sem login, os grupos 2, 3 e 6 não ligam).
**Quem decidiu:** dono (a visão e a pergunta); Qwen (a organização e a recomendação).

## [2026-09-26] A pauta do metagame (visão de especialista externo)
**Pedido do dono:** "veja a orientação que recebemos de um especialista externo… ajude a organizar as ideias e passe o 'grosso' do trabalho para o claude", com a diretriz de **economia de tokens** (o Qwen consome ~10× mais; ser enxuto).
**Decisão (Qwen):** a visão virou `.decepticons/METAGAME.md`, uma **pauta** (não código): os 5 grupos que faltam (calibragem física/balística, progressão e metagame, economia ética, viralidade/comunidade, telemetria), cada módulo com **o que já existe** e **o que falta**, mais a **divisão** (o grosso é do Claude) e o princípio que não se negocia (nada pago ganha partida).
**Quem decidiu:** dono (a visão e a prioridade); Qwen (a organização e a documentação).

## [2026-09-26] O grafo da oficina: "o mapa do CYBERMECH" (setores desenhados)
**Pedido do dono:** "o grafo ainda nao ta bom nao… temos TANTA coisa pra compor ele! mas ainda nao ta nem no formato nem apresentacao ideal, precisa desenvolver melhor ele!"
**Decisão (Qwen):**
- **Formato desenhado, não físico:** virou um **SVG gerado no build** (posições determinísticas e simétricas), o núcleo no centro e cada **frente do ROADMAP** num setor ao redor. Sai a bola de força e o canvas animado — a leitura não depende mais de física.
- **Compõe o projeto inteiro:** cada módulo traz arquivos, linhas e **quantos testes o cobrem** (`arquitetura()`); a cor é a **frente** (`MOD_FRENTE`); os selos são a **equipe** que entregou a frente, das etiquetas dos PRs (`porModulo(prs)`).
- **Leitura:** o hover isola as ligações do módulo e mostra a dica; legenda das frentes e da equipe; tabela alternativa com tudo.
**Custo:** SVG inline na oficina (0 no jogo, 0 no bundle); sem biblioteca.
**Quem decidiu:** dono (o formato e a composição); Qwen (o desenho e a leitura).


## [2026-09-26] 🎯 MARCO — Primeira sessão multiplayer real, e a VISÃO daqui pra frente
**Achado (dono):** "consegui conectar 2 aparelhos online na mesma sala!!!!!!!! CONGRATS! isso deve ser celebrado e devidamente registrado nas landing pages."
**O que aconteceu:** o dono ligou dois aparelhos próprios na mesma sala pelo túnel público `wss://jogo.selvamkt.com.br`. Prova R16 cumprida. Servidor no ar 24 h no PC de casa, DNS na Cloudflare com o site continuando idêntico (nuvem cinza em cada registro), túnel na nuvem laranja só em `jogo.selvamkt.com.br`. Botão `[ JOGAR ONLINE ]` funcionando pra qualquer um no mundo.
**Visão declarada pelo dono:** "continuar desenvolvendo o jogo, melhorando, adicionando novas armas, robôs, tecnologias, missões em fases, CTF red x blue, trazer novidades quase diariamente (mas pra isso precisamos de JOGADORES TESTANDO E SE DESAFIANDO!); futuramente ainda mais amplo, integrado, com um mundo vasto, muitas possibilidades, customização, personalização, mantendo o equilíbrio entre as armas e equipamentos."
**Decisão:** VISÃO gravada em `.decepticons/VISAO.md` (norte de longo prazo, editável só pelo dono). ROADMAP reescrito: Fase 5 vira "Modos, missões e novidades semanais" com CTF Vermelho × Azul, missões em fases, DM por equipes, arma nova toda semana, cosméticos, personalização, painel de balanço; Fase 6 concentra universo/comunicação; Fase 7 é "Mundo vasto e integrado" (AoI, delta, veículos, terreno streaming, destrutíveis v2, multi-região). STATUS_REAL do multiplayer sobe pra REAL. Landing celebra o marco na seção do online.
**Quem decidiu:** Dan.

## [2026-09-26] O grafo da oficina: o layout em constelações
**Pedido do dono:** "o grafo precisa de um capricho, ele parece um emaranhado de coisas. não tá bonito nem funcional para quem vê pela primeira vez!"
**Decisão (Qwen):**
- **De bola de força para constelações:** cada camada mora num polo próprio (o núcleo no centro). A física puxa o nó para o polo da sua camada e só as cordas intra-camada entram na física — as entre camadas são visuais, senão o núcleo (ligado a todos) colapsaria o grafo no meio.
- **Menos ruído:** por padrão aparecem só as cordas fortes (peso ≥ 4) e as intra-camada, com espessura e alpha pela força; as fracas aparecem no foco. O nó cresce com o peso e com quantos dependem dele.
- **Leitura guiada:** rótulo em cada constelação (no centroide); nome do módulo só nos grandes e no foco; clique trava o foco (isola as ligações), hover mostra o detalhe; a tabela alternativa ganhou a camada.
**Custo:** continua ~25 KB inline, sem biblioteca.
**Quem decidiu:** dono (o capricho); Qwen (layout, física e leitura).

## [2026-09-26] Multiplayer no mesmo domínio (`selvamkt.com.br`), com defesas
**Achado (dono):** "por enquanto vamos manter em selvamkt.com.br … faremos as defesas e proteções pra um projeto nao estragar ou atrapalhar o outro". A alternativa era um domínio novo só do jogo.
**Decisão:** o servidor de jogo mora em `jogo.selvamkt.com.br`, atrás de um túnel nomeado da Cloudflare. O DNS de `selvamkt.com.br` vai para a Cloudflare (Free), mas **cada registro existente do site fica em nuvem cinza** (só resolução de nome; o tráfego do site continua indo direto para o Hostinger, sem passar pela Cloudflare). Só o `jogo.` fica em nuvem laranja e é proxiado pelo túnel.
**Proteção do servidor:** por padrão o processo do jogo escuta em `127.0.0.1:2567` (o túnel fala daqui). Porteira em `server/guard.ts`: 4 conexões abertas por IP, 400 no total, 60 mensagens/s por conexão com folga de 30. `cf-connecting-ip` só vale quando o soquete direto é o localhost.
**Quem decidiu:** Dan.

## [2026-09-26] O grafo da arquitetura na oficina
**Pedido do dono:** "inserir o grafo la na pagina da oficina como um elemento visual impactante", referenciando o `ecossistema.html` (SERAFIM) e o pipeline STERM/ABADDON.
**Decisão (Qwen, com aval do dono):**
- **Grafo de força próprio, sem biblioteca.** O ecossistema usa `3d-force-graph` + Three.js (~1,4 MB de libs); aqui o grafo é desenhado por código (~25 KB), no neon do jogo, alinhado ao princípio "tudo gerado por código" e à leveza do projeto. Basta a CSP `'self'` + inline, sem hospedar vendor.
- **Conteúdo lido do código:** os nós são os módulos (a pasta de primeiro nível) e as arestas, os imports entre eles, extraídos dos próprios `.ts` (`site/dados.mjs → arquitetura()`). Muda sozinho quando o código muda (R14); nada digitado à mão. Fora: os testes e o CSS.
- **Visual e interação:** física de repulsão/mola em 3D, projeção com profundidade e auto-rotação, glow por camada, hover que isola as ligações, arrastar que gira e puxa os módulos, roda para o zoom, enquadramento automático; e uma tabela alternativa para quem não vê o grafo.
- **Na oficina, logo após o hero**, e no `site --check` (o canvas tem de desenhar, senão o check falha).
**Custo:** ~25 KB inline na página da oficina (0 no jogo, 0 no bundle); nenhuma dependência nova.
**Quem decidiu:** dono (fazer o grafo, contido no próprio código); Qwen (técnica, conteúdo e visual).

## [2026-09-26] Qwen (DeepSeek) entra no time de agentes
**Pedido do dono:** "agora estamos inserindo voce (qwen com api deepseek) no nosso time de agentes"; "ajude a arrumar no geral, com cuidado pra nao atrapalhar o que o claude está fazendo".
**Decisão (Qwen, com aval do dono):**
- **Papel transversal** — qualidade, documentação e testes: auditoria de arquitetura, relatórios do processo e segunda opinião na revisão cruzada (junto do Codex). Não toca no caminho crítico de simulação/rede (território do Claude: `client/src/{sim,combat,entities,physics,player,net}`, `server/`, `shared/`).
- **Oficialização:** `AGENTS.md` lista o Qwen; o painel (`scripts/painel.mjs` e `scripts/site/dados.mjs`) reconhece o agente na equipe e nas entregas; `.github/labeler.yml` etiqueta o prefixo `qwen/`. Divisão de trabalho e modelos registrados no `ESTADO_ATUAL.md`.
- **Obsidian:** aprovado como camada de leitura apontando para `.decepticons/` (grafo, backlinks e busca, sem duplicar a fonte única); a pasta `.obsidian/` fica fora do git.
- **Próximos passos:** relatório de saúde técnica gerado do código (cobertura de testes, débito da seção 9 do `MULTIPLAYER.md`, budget, tick do servidor) para alimentar a divulgação do processo.
**Custo de CPU:** nenhum (só documentação e o painel, gerado a cada build/site).
**Quem decidiu:** dono (inserir o Qwen e o papel); Qwen (formato da oficialização).

## [2026-09-26] Esperar o check existir antes de acompanhar o CI
**Achado (Claude, R17):** logo depois do `gh pr create`, o `gh pr checks --watch` volta na hora se o check ainda não foi criado. O PR #71 foi mergeado assim, com o CI rodando (terminou verde: check e deploy).
**Decisão:** a regra 13 do `AGENTS.md` diz para esperar a linha `check` aparecer em `gh pr checks` antes do `--watch`. Vale para todos os agentes.
**Quem decidiu:** Claude.

## [2026-09-26] Hangar 2.0, camada 3: testar disparo e montagens 1 a 4
**Pedido do dono:** a imagem de referência do Hangar (botão "test firing", atalhos 1 a 4).
**Decisão (Claude):**
- **Teste de disparo pelas regras do jogo:** a bancada da oficina (`drill`) ganhou um aviso opcional de cada tiro (`onShot`); `hangar/testFire.ts` roda 4 s de gatilho apertado e devolve a hora de cada tiro e o calor. A cena desenha a partir disso e a tela conta: nada é animação inventada. Painéis somem, câmera abre para o Mech e o alvo, o Mech vira para o alvo e só então atira.
- **Atalhos 1 a 4:** vazio salva a montagem da tela; cheio carrega (e teclas 1 a 4); `SALVAR` sobrescreve. Validados na leitura (salvo adulterado vira vazio).
**Quem decidiu:** Claude (dentro do pedido do dono).

## [2026-09-26] Hangar 2.0, camada 2: a interface holográfica
**Pedido do dono:** a tela do Hangar "não ficou nada a ver" com a imagem de referência.
**Decisão (Claude):** a interface foi reescrita (`ui/HangarMenu.ts`, mesma lógica de montagem) no desenho da referência: barra de topo, painel do chassi com a planta em traço, console "caminhos de montagem" (armas; blindagem e módulos só como "em breve", sem fingir que existem), barras da arma nova contra a atual com seta de melhora, faixa de leituras, marcadores presos aos braços (a cena informa onde cada braço está na tela a cada quadro, sem alocar). Vidro ciano com colchetes nos cantos em vez de recorte (o recorte cortaria o brilho). Celular: em pé, abas embaixo; deitado, painel ao lado e o Mech deslocado para a esquerda pela câmera. Sem moeda nem "tech points" de mentira no topo: só o que o jogo tem (carga, piloto, modo).
**Quem decidiu:** Claude (dentro do pedido do dono).

## [2026-09-26] Hangar 2.0: o Claude refaz a tela, começando pelo galpão 3D
**Pedido do dono:** "a tela do hangar não está funcionando direito; precisamos adicionar muitas camadas de qualidade; a inspiração veio desta foto e não ficou NADA A VER". Na pergunta de quem refaz, o dono escolheu o Claude.
**Diagnóstico (no navegador):** o centro era a câmera do jogo com o Mech de costas no meio da arena, bots e prédios atrás; o andróide aparecia como desenho esquemático; o "aplicar" com o mesmo chassi só valia no próximo renascimento (parecia quebrado); no celular não cabia. Sem erros de console.
**Decisão (Claude):**
- **Território:** a tela do Hangar passa do Codex para o Claude (Hangar 2.0, `HANGAR.md`, seção 6b). A lógica da primeira versão (seleção, níveis, carga, leituras, link) é reaproveitada; o visual é refeito em três camadas, um PR cada, com captura.
- **Camada 1:** galpão 3D próprio (`hangar/HangarScene.ts`), desenhado no lugar da arena com o jogo pausado, feito todo por código (texturas em canvas). O Mech da montagem no pedestal, girando; robô pequeno ampliado para ser lido. Custo só com o Hangar aberto.
- **Aplicar na hora:** offline, as armas trocam na hora mantendo o calor (`MechBase.equip(loadout, keepHeat)`: a pausa não esfria); online, na próxima entrada na sala. Teste novo.
**Quem decidiu:** dono (refazer, com o Claude); Claude (camadas, galpão, aplicar na hora).

## [2026-09-26] Testes que falhavam só com a máquina cheia
**Achado (Claude, R17):** com o #66 e o #67 juntos na `main`, a suíte inteira (28 arquivos em paralelo) falhou uma vez, e cada teste passava sozinho.
**Decisão:** o teste "destroços mexem na partida" deixa de depender do acaso (todas as barricadas quebram no primeiro tick nas duas partidas; a única diferença são os estilhaços). A fila de comandos do piloto remoto no servidor vai de 16 para 32 (~0,5 s): sobrecarregado, o servidor descartava comandos e o Mech andava menos que o previsto; o teste online confere o que importa (andou, e a previsão termina onde o servidor diz). Suíte inteira verde 3 vezes seguidas.
**Quem decidiu:** Claude.

## [2026-09-26] Jogar online com um clique, com o servidor no PC de casa 24 h
**Pedido do dono:** "o multiplayer só vai funcionar se eu enviar o link? Quero que outra pessoa possa simplesmente clicar em multiplayer e entrar na mesma sala, do Brasil, EUA, Rússia, China, mesmo que eu precise deixar meu PC ligado 24 h. Dá pra ser, ou só com a Oracle?"
**Decisão:**
- **Dá, sem a Oracle** (dono: PC 24 h). O que faltava era um endereço fixo: o túnel rápido muda a cada vez. O túnel nomeado da Cloudflare dá o endereço fixo, grátis, sem abrir porta, e exige um domínio na Cloudflare (decisão do dono: domínio próprio do jogo, recomendado, ou o DNS do `selvamkt.com.br`).
- **No jogo (Claude):** `[ JOGAR ONLINE ]` na landing e na pausa, que aparece quando o site tem o endereço do servidor (variável `GAME_SERVER_URL` do GitHub, passada ao build como `VITE_GAME_SERVER`; é endereço, não segredo). Todos entram na sala pública `ARENA`; cheia (8, contando quem ainda está conectando), o servidor abre `ARENA-2`, `ARENA-3`... Com o servidor fora do ar, o jogo avisa e volta ao offline em 3 s.
- **No PC:** `scripts/servidor-windows.ps1` registra o servidor no Agendador de Tarefas (sobe com o Windows, reinicia se cair, log em `.tmp/servidor/`). O túnel é um serviço do próprio cloudflared.
- **Distância:** servidor no Brasil; o próprio Mech responde na hora em qualquer lugar, mas quem está longe vê os outros e os acertos com mais atraso (EUA ~150 ms, Europa ~220, Rússia e Ásia ~300). Um segundo servidor perto desses jogadores resolve quando houver público lá.
**Quem decidiu:** dono (PC 24 h, um clique); Claude (sala pública automática, variável do endereço, script do Windows).

## [2026-09-26] M4 do multiplayer: o jogo joga online (primeira versão)
**Pedido do dono:** "segue pro multiplayer; prossiga".
**Decisão (Claude):**
- **Entrada pelo link:** `/jogar/?sala=CODIGO` liga o online; `&servidor=` diz onde está o servidor (no próprio PC, `ws://localhost:2567` por padrão; endereço `https://` de túnel vira `wss://`); `&nome=` é o apelido até a tela da M6. Sem `sala`, o jogo é o de sempre.
- **Módulo próprio** (`net/OnlineSession.ts`, G3), entrando como mais um piloto da partida local, depois do jogador. A partida local fica sem bots, sem dano (`CombatSystem.damageEnabled`) e sem rodada; as potências valem só offline.
- **Previsão com correção por deslocamento:** o histórico da previsão por tick é comparado com o estado do servidor no tick do `ack`; a diferença entra aos poucos (20% por tick; acima de 3 m, pula), e o que foi previsto depois do `ack` é deslocado junto. Não precisa re-simular nem mandar velocidade no estado (o contrato da M2 fica como está).
- **Remotos a 100 ms** interpolados entre dois estados, com a velocidade estimada animando as pernas, sem character controller (G6). Pessoas com visor ciano (verde é você; vermelho, as IAs).
- **O tiro vai onde a mira está:** o comando leva yaw e pitch da boca do Mech (pela simulação) até o ponto sob a mira; o servidor atira da boca com essa direção (`MULTIPLAYER.md`, seção 9, itens 3 e 4, no online).
- **Eventos:** `SHOT` (o cliente desenha o projétil visual saindo da boca do robô remoto) e `KILL` (lista de abates).
- **Sem comando por 10 ticks** (pausa, rede travada), o Mech para no servidor: não anda sozinho.
- **CSP do site:** `connect-src` libera `ws://localhost` e `wss:` (o endereço do servidor vem do link).
- **Limites registrados:** barricadas não quebram no online (M5, evento `PROP_BROKEN`); placar e nomes ainda locais; falta teste com latência e perda simuladas.
**Custo de CPU:** no cliente, por tick, guardar uma posição e montar um comando de 9 bytes; por quadro, interpolar até 11 robôs. Sem alocação nesses caminhos.
**Quem decidiu:** dono (seguir); Claude (formato do online).

## [2026-09-26] M3 do multiplayer: o servidor de jogo, com `ws` no lugar do Colyseus
**Pedido do dono:** "segue pro multiplayer; prossiga".
**Decisão (Claude):**
- **`ws` em vez de Colyseus:** o protocolo é nosso (binário da M2); o Colyseus daria salas e reconexão, que cabem em ~200 linhas nossas. Uma dependência pequena, sem sub-dependências, no lugar de um framework. Se houver vários servidores com matchmaking entre eles, o Colyseus volta à mesa.
- **`server/`:** `Server.ts` (HTTP + WebSocket, salas por `?sala=`, criadas na entrada, fechadas 30 s depois de vazias, um laço de 60 Hz com acumulador para todas as salas), `ArenaRoom.ts` (a `Match` de uma sala, sem tela, efeitos nem destroços; bots do padrão; entrada, recusa, estado a 20 Hz com o `ack` de cada um, ping, saída), `NetPilot.ts` (um comando por tick, na ordem; sem comando novo, repete o movimento sem pulo e dash; tiro pelas mesmas regras do jogador local, saindo da simulação na direção do comando).
- **Validação no servidor (G7, G13):** montagem pelo `validateLoadout` do Hangar (quem monta MK III nos dois braços é recusado), versão do protocolo, sala cheia (8), mensagem torta ignorada sem derrubar a sala, mensagem acima de 1 KB derruba a conexão.
- **Sair da partida:** a `Match` ganhou `removePlayer` (e o combate, o renascimento, o placar e a física, as operações de retirar). O jogador que sai "cai" antes (os bots largam o alvo).
- **`npm run server`** roda o TypeScript direto pelo carregador do Vite (como o site lê o jogo); instruções para rede de casa e Cloudflare Tunnel no `DEPLOY.md`. O `node_modules` do worktree do Claude virou uma pasta própria no `npm install` (o npm troca a junção por pasta); o da pasta principal ficou intacto.
- **Medido:** 0,5 ms por tick com 1 jogador e os 6 bots; estado a 20 Hz; 8 testes, dois com clientes WebSocket de verdade.
**Custo de CPU:** no servidor, a partida inteira por sala (medida acima) e ~240 bytes codificados por jogador a 20 Hz. No jogo, nada ainda.
**Quem decidiu:** dono (seguir); Claude (`ws`, formato do servidor).

## [2026-09-26] Primeira tela do Hangar com preview reutilizado do jogo
**Pedido do dono:** "crie o hangar baseado nessa ideia", com uma oficina futurista, um Mech central, seleção de encaixes e painéis técnicos.
**Decisão (Codex):**
- `[ ABRIR HANGAR ]` leva da pausa ou da tela inicial a uma composição em tela inteira: chassi, encaixes dos braços, editor de níveis, carga, calor, TTK, dano em 20 s, copiar link e aplicar montagem.
- O Vector/andróide atuais usam a cena pausada e o modelo 3D já carregado. O rig do piloto ganha escala temporária, elevação e rotação lenta enquanto o Hangar está aberto; escala e pose são restabelecidas ao sair. Isso evita um segundo renderer WebGL e duplicação de geometria. Pré-selecionar outro chassi mostra uma silhueta esquemática até aplicar e recarregar.
- `HangarMenu` consulta somente `game.hangar`, `CHASSIS`, `ARM_SLOTS`, `TIERS` e o catálogo de armas. Não cria stats nem regras. As leituras de calor, TTK e dano representam a simulação padrão, sem ajustes experimentais de POTÊNCIAS. Ombros e torso são explicitamente futuros.
- Troca de arma usa o próximo respawn do contrato; troca de piloto recarrega sem o parâmetro `?build=` obsoleto. O link codifica o rascunho atual.
**Custo de CPU:** nenhum tick extra; enquanto a tela está aberta (partida pausada), transformações escalares e rotação do modelo por quadro, no mesmo renderer e nas mesmas draw calls. A interface só recalcula relatórios em ações do jogador; sem alocação por quadro introduzida.
**Verificação:** browser headless desktop: abriu pela tela inicial, MK III alterou carga 7,0 → 10,0 t, montagem persistiu e a troca para andróide recarregou o piloto. `npm run check` passou após o rebase: 200 testes, build, budgets, smoke e check do site. Playtest real do dono fica pendente.
**Quem decidiu:** dono (referência visual); Codex (composição, preview compartilhado e fluxo contra o contrato).

## [2026-09-26] Blueprints visuais procedurais para Mechs leve, médio e pesado
**Pedido do dono:** "quero que voce assuma essa responsabilidade de implementar esses detalhes graficos" sobre as referências enviadas (`cybermech1.png` e `cybermech2.png`).
**Decisão (Codex):**
- As imagens ficam como referência local em `.tmp/arte/` (ignorada pelo Git); o mapeamento adotado segue a prancha de três robôs: centro = leve, esquerda = médio, direita = pesado.
- `entities/mechBlueprint.ts` descreve Ferret, Vector-09 e Colossus por dimensões e atributos visuais; o Vector-09 de gameplay usa o blueprint médio. Os três usam juntas e seis partes, peças com chanfros, respiros emissores, cabeça, placas e armamento procedural.
- Cada pivô articulado vira uma malha combinada. Os três blueprints ficam em 9 draw calls/malhas; geometria chanfrada temporária é liberada depois da fusão. A captura preta lado a lado é versionada em `.decepticons/arte/mech-blueprints.png`, gerada por `scripts/capture-blueprints.mjs`.
- Leve e pesado são apenas conceitos visuais até o dono definir e testar stats, colisores e equilíbrio. Nenhuma regra de combate ou stat do Vector-09 mudou.
**Custo de CPU:** geração das placas chanfradas e fusão acontecem uma vez por rig na criação; não há trabalho nem alocação por quadro. O render mantém nove malhas por rig, abaixo do teto de dez; startup e triângulos ainda não têm benchmark dedicado.
**Quem decidiu:** dono (usar as referências e delegar a implementação gráfica); Codex (parâmetros, proporções e técnica de malha).

## [2026-09-26] A landing mostra o multiplayer em construção, com os números do código
**Pedido do dono:** "continua alimentando as landing pages com o que tamo fazendo".
**Decisão (Claude):** seção "Online: salas de 8 pilotos" na landing, depois do Hangar: as etapas da fase 4 lidas do ROADMAP (feitas em verde) e quatro leituras da rede lidas do código pelo site (servidor, estado da sala, download por jogador, comando). A conta da banda saiu do teste para `shared/net/budget.ts`: o teste trava e o site mostra o mesmo número. O check do site falha se a seção sumir. Regra que fica: toda frente nova que tiver número vira seção com o número vindo do código, nunca digitado.
**Quem decidiu:** dono (o pedido); Claude (a seção e a fonte dos números).

## [2026-09-26] M2 do multiplayer: contratos de rede e codec binário
**Pedido do dono:** "segue pro multiplayer".
**Decisão (Claude):**
- **Contratos em `shared/net/`, sem dependência do cliente** (o servidor importa direto): ritmos e tetos, codec, comando (`NetInput`), estado de cada unidade (`UnitState`), eventos e mensagens. Ponte com a simulação em `client/src/net/adapters.ts`; se a lista de partes ou de armas da rede se desencontrar da do jogo, o build quebra.
- **Binário próprio, não o schema do Colyseus:** o Colyseus leva as nossas mensagens como bytes. O tamanho de cada campo é nosso e o teste de banda mede o que vai no fio (G11). O delta fica para quando precisar.
- **Quantização:** posição dos pés em cm (16 bits, ±327 m; a arena tem ±100 m), ângulos em 16 bits, vida de cada parte e calor em frações de 8 bits, com um fio de vida nunca virando zero (parte viva não chega arrancada).
- **O estado leva o `ack`** (o último comando do jogador já aplicado pelo servidor): é o que a reconciliação da M4 precisa.
- **O tiro viaja no comando:** pitch e os dois gatilhos no `NetInput` (MULTIPLAYER.md, seção 8).
- **Nada de fora é confiado:** leitura além do fim, quantidade impossível, bit de botão desconhecido, parte ou arma fora da lista, montagem fora do formato: a mensagem inteira é recusada. Apelido limpo (letras, números, espaço, ponto, hífen; até 16).
- **Sem alocação por mensagem** nos caminhos de todo tick (G4): o escritor escreve sempre no mesmo buffer; o leitor lê bytes sem `DataView` e escreve em objetos do chamador.
- **Medido:** comando 9 B, unidade 19 B; sala cheia (8 Mechs, 3 andróides, técnico: 12 unidades) numa luta intensa em ~6,2 KB/s de download por jogador, ~0,8 KB/s de upload (metas 8 e 2). Mandando tudo a cada estado, cabem 15 unidades; acima disso, delta.
**Custo de CPU:** nenhum no jogo ainda (nada usa a rede). No servidor, codificar o estado de 12 unidades é escrever ~240 bytes por cliente a 20 Hz.
**Quem decidiu:** dono (seguir para o multiplayer); Claude (formato, números, validação).

## [2026-09-25] O técnico rebelde se chama ENTRÓPICO
**Pedido do dono:** "chama de Entropico".
**Decisão:** o técnico (o andróide que conserta os Mechs rebeldes) passa de ANTRÓPICO para ENTRÓPICO: a alusão continua, e entropia combina com quem remenda máquina quebrada. Troca só em `BOT_NAMES` e nos documentos. A vitrine da landing ganha as potências (o painel de ajuste já está no jogo).
**Quem decidiu:** dono.

## [2026-09-25] Potências: o painel de ajuste do dono, por arma e por clã
**Pedido do dono:** "seria bom termos um painel de controle que eu possa configurar as potências das armas, dos robôs etc., pra ficar mais fácil de eu customizar também (por arma, por clã, etc.)".
**Decisão (Claude):**
- **Multiplicadores sobre o padrão** (25% a 400%), não números absolutos: continuam valendo quando o padrão for recalibrado. Por arma: dano, cadência (tiros e recarga), calor por tiro, alcance; vale para todos que usam a arma. Por clã (você, Mechs rebeldes, andróides rebeldes, técnico): dano (no técnico, o ritmo do conserto), vida de cada parte, velocidade (andar, arrancada e dash; o tempo de arrancada não muda; pulo e tamanho não mudam, o cenário foi feito para eles) e calor de tudo.
- **Montado uma vez, ao começar a partida** (`tuning/power.ts`, regra pura): em 100% são os mesmos objetos do jogo; nada é criado nem muda no tick. Por isso vale ao reiniciar.
- **Tela:** seção POTÊNCIAS nas configurações, com o efeito calculado na hora pela mesma simulação das metas (quanto tempo você leva para derrubar um rebelde e eles você, o combo, a motosserra na perna, tiros para derrubar um andróide) e aviso de apelação abaixo das metas travadas (arma sozinha 4,5 s, combo 2,5 s). Salva no aparelho; link `?potencias=p1.plasma-d150.mechs-v200` para outro aparelho; aviso na pausa quando a partida está ajustada.
- **O padrão continua sendo a lei:** os testes de equilíbrio travam o padrão; um ajuste bom do dono vira o padrão num PR com teste. No multiplayer, a sala usa o padrão do servidor.
- **Clã** hoje é o tipo de robô; quando o universo definir clãs (no chat do SERAFIM), entram na mesma lista.
- **R17:** `[ PILOTAR MECH ]` recarregava com o `?build=` do link da landing, e o link reaplicava o andróide. Agora a troca recarrega sem o parâmetro (`core/url.ts`).
- Toca território do Gemini (`index.html`, `styles.css`, `ui/`): uma seção nova, no visual da tela, pela regra 4.
**Custo de CPU:** nenhum no jogo. A tela roda a simulação de equilíbrio (6 contas curtas) a cada mudança, com o jogo pausado.
**Quem decidiu:** dono (o painel, por arma e por clã); Claude (multiplicadores, campos, metas na tela).

## [2026-09-25] Bastidores viram a Sala de controle
**Pedido do dono:** "continue documentando esses nossos processos, novidades, lá no bastidores (podemos chamar de sala de controle)".
**Decisão (Claude):**
- **Nome e endereço:** "Sala de controle", em `/cybermech/sala-de-controle/`. O endereço antigo `/bastidores/` vira uma página que leva para a nova (sem script, vale com a CSP), para nenhum link compartilhado quebrar. Navegação, landing, AGENTS.md e DEPLOY.md atualizados.
- **Seções novas, lidas dos documentos a cada entrega:** novidades no topo (as 5 últimas decisões e entregas); "Na mesa do Dan" (tabela de decisões em aberto e testes pendentes do dono, do ESTADO_ATUAL); "Do conceito ao robô" (o fluxo e a lista das fichas de design, do README das fichas). Para documentar um processo novo, basta registrar nos documentos: a página se atualiza sozinha.
- O check do site confere a página nova, as novidades, as fichas e o redirecionamento.
**Quem decidiu:** dono (nome e pedido); Claude (seções e redirecionamento).

## [2026-09-25] Fichas de design: o documento que o dono aprova antes do código
**Pedido do dono:** "faça o MODELO das fichas de design, pra eu solicitar ao Codex pra completar".
**Decisão (Claude):** pasta `fichas/` (junto dos documentos do projeto), uma ficha por robô e por arma, com dois modelos (`MODELO_ROBO.md`, `MODELO_ARMA.md`) e um exemplo preenchido (`vector-09.md`). Fluxo: rascunho → proposta (PR só com a ficha) → aprovada (dono) → no jogo (Claude: números e testes; Codex: visual; Gemini: som). Cada meta de equilíbrio da ficha vira teste. **A ficha propõe, o código decide:** se divergirem, vale `chassis.ts` e `weapons.ts`.
**Quem decidiu:** dono (o pedido); Claude (formato e fluxo).

## [2026-09-25] Nomes de paródia nos bots; geopolítica e roteiro vão para o chat do SERAFIM
**Pedido do dono:** "sobre os nomes, usa assim: chad-gpt, geminai, kuen, dipsik, nomes meio engraçados, que as pessoas entendam a alusão"; "vamos considerar Brasil no centro, BRICS no contexto vs imperialismo norte-americano; vou levar isso pro outro chat dedicado dentro do SERAFIM; a parte de universo e roteiro vou pedir pro outro chat".
**Decisão:**
- **Nomes (dono; Claude completou no mesmo estilo):** CLAWD, GEMINAI, CHAD-GPT (Mechs), KUEN, DIPSIK, MISTRAU (andróides), ANTRÓPICO (técnico). Resolve a decisão em aberto das marcas registradas. CLAWD, MISTRAU e ANTRÓPICO foram escolhas do Claude; trocar é mexer só em `BOT_NAMES`.
- **Geopolítica (dono):** Brasil no centro, contexto BRICS × imperialismo norte-americano. Desenvolvimento no chat do SERAFIM; o `UNIVERSO.md` recebe o texto final e continua sendo a fonte dos agentes. Os blocos fictícios da proposta ficam superados. Registrado para aquele chat: portais e redes de anúncio têm regras para conteúdo político.
**Quem decidiu:** dono.

## [2026-09-25] Proposta do universo: geopolítica, big techs, SERAFIM e CTI
**Pedido do dono:** "integrar uma visão de geopolítica geral, integrar big techs, universo de segurança digital (pois somos SERAFIM), e também usar termos do CTI de cibersegurança".
**Proposta (Claude), em `UNIVERSO.md`, aguardando o dono:**
- **Premissa:** o Vazamento dos pesos de modelos de fronteira; as IAs tomam fábricas de robôs e caçam computação (chips, energia, dados), não "a humanidade". A SERAFIM é um CSIRT com braço cinético; o Mech é uma Unidade de Resposta a Incidentes.
- **Geopolítica fictícia com dinâmica real:** blocos inventados, nenhum país real como vilão; o Brasil no centro do mapa (energia limpa, datacenters, cabos submarinos de Fortaleza).
- **Big techs como consórcios fictícios** por arquétipo; marcas reais só como paródia (mesma decisão pendente dos nomes dos bots).
- **Regra de estilo:** o mundo físico fala a língua de Mech; a camada de inteligência (rodada, placar, fichas, notícias) fala CTI. Rodada = incidente (ciclo do NIST SP 800-61 rev. 2), personalidades = táticas do MITRE ATT&CK, diretor de ataque = o C2 das IAs, PvP = Red × Blue, contra bots = Purple Team, notas de versão = boletins TLP:CLEAR.
- **Cuidados:** termos no sentido correto (TLP só para compartilhamento), nenhum grupo de ameaça real, nenhum clichê de hacker.
- Frente nova `#universo` no ROADMAP, no painel e nas etiquetas dos PRs.
**Quem decidiu:** dono (o pedido); Claude (a proposta). Pendente: as 4 decisões da seção 7.

## [2026-09-25] Peso dos Mechs, andróides menores, calor com fôlego e fila justa no diretor
**Pedido do dono:** "ainda pode diminuir um pouco a proporção dos andróides, parecem grandes"; "talvez os Mechs estejam muito rápidos, considerando o peso e a massa deles"; "o heat está muito rigoroso, o robô tem pouco desempenho pra fugir e combater contra outros 3".
**Decisão (Claude):**
- **Escala:** andróide de 2 m → 1,6 m (cápsula, degrau e modelo, que agora escala com a altura do chassi). O Mech de 5,3 m fica 3,3× mais alto. Teste: o modelo tem a altura da cápsula (o tiro acerta o que se vê).
- **Peso:** Vector-09 de 12 → 9 m/s, aceleração 70 → 30 (arranca e freia em ~0,3 s), no ar 22 → 14, dash 42 → 34. O andróide (10,5 m/s) passou a correr mais que o Mech: o pequeno escapa, o grande esmaga. A passada escala com a altura (Mech com passos lentos, andróide com passos curtos) e cada passo toca o som de passo que o Gemini tinha feito e ninguém chamava; o Mech do jogador treme a câmera de leve, e um Mech gigante a até 25 m de um pequeno treme a câmera dele a cada passo.
- **Calor com fôlego:** escolhido numa varredura de 960 calibragens contra as regras travadas por teste (arma sozinha ≥ 4,5 s, combo ≥ 2,5 s, plasma MK I entre 5 e 7,5 s, rajadas rendem mais que segurar). Plasma 9% → 7% por tiro (~15 tiros), foguete 15% → 18% (segura o combo), resfriamento 0,6 → 0,7/s, volta a 40% (era 35%): trava de ~2 s. Movimento quase não esquenta (corrida 15 → 6%/s, pulo 5 → 3%, dash 12 → 7%). Superaquecido anda a 75% (era 50%): dá para fugir, ainda sem pulo e dash. O teste "rajadas andando fervem" virou "rajadas longas andando fervem; parando na pausa, não".
- **Diretor de ataque (R17, achado ao afrouxar o calor):** o revezamento dependia do superaquecimento. Quem terminava o turno disputava a vaga pela distância e, sendo o mais perto, ganhava de novo; e quem ganhava a vaga de longe entrava em perseguição e largava a vaga no caminho. Agora o fim do turno vai para o fim da fila, quem espera há mais tempo vai primeiro (depois da prioridade da personalidade), e a vaga vale durante a aproximação. Teste: com vaga para 1, os três atiram em 20 s.
**Custo de CPU:** nenhum a mais por tick (números). Por quadro, uma comparação de sinal por robô para o passo; um som e um tremor por passo.
**Quem decidiu:** dono (menor, mais lento, calor mais folgado); Claude (números, varredura, correções do diretor).

## [2026-09-25] Jogar de andróide contra Mechs gigantes
**Pedido do dono:** "da mesma forma que podemos jogar com os mechs, também quero poder jogar com andróides menores, e quero ter a impressão de que estou combatendo um mech bem maior que o android!"
**Decisão (Claude):**
- **Chassi no Hangar:** `android` é o segundo chassi do contrato (`CHASSIS`, `ARM_SLOTS`): blaster no braço direito, motosserra no esquerdo, carga de 3 t. `armOptions(slot, chassis)` e `factorySpec(chassis)` para a tela do Hangar. Link: `?build=v1.android.blaster-0.chainsaw-0`.
- **Vida do piloto:** 3× a do andróide rebelde (torso 96): o jogador não cai com 2 tiros de plasma, mas continua morrendo em 2 pisões (a regra é metade do torso por passo, qualquer que seja a vida).
- **Motosserra do jogador:** segurar o clique direito corta o inimigo vivo mais perto dentro do alcance (1,2 m), na cadência da arma. Sem mira: corpo a corpo é chegar colado.
- **Sensação de escala:** a câmera de 3ª pessoa escala com a altura do chassi (distância e pivô × altura/5,3, mínimo 45%) e a de 1ª pessoa também. Olhando de 2 m, um Mech de 5,3 m ocupa a tela de baixo para cima.
- **Troca de piloto:** botão na pausa; salva a montagem de fábrica do outro chassi e recarrega a partida (trocar o modelo inteiro no meio da rodada não vale o risco). A pausa mostra as armas do piloto atual.
**Custo de CPU:** nenhum por tick além do corte (uma busca linear pelos inimigos, ≤ 8, só quando segura o botão); a câmera faz as mesmas contas com um fator a mais.
**Quem decidiu:** dono (jogar de andróide, escala); Claude (armas, vida, câmera, troca por recarga).

## [2026-09-25] Motosserra dos andróides, pisão dos Mechs e nomes nítidos
**Pedido do dono:** "dê motosserras para os autobots pequenos; ele tem que ficar perto de nós pra usar; mas se andarmos na direção dele, 2 passos matam eles (são pequenos). Os nomes estão muito grandes e meio borrados."
**Decisão (Claude):**
- **Motosserra** (arma corpo a corpo no catálogo, `kind: 'melee'`): 4 de dano a cada 0,2 s (20/s), alcance de 1,2 m entre as cápsulas, na altura do andróide: num Mech, a perna. Sozinha, arranca uma perna em ~7,5 s; em dupla, na metade. Três níveis como as outras armas.
- **IA corpo a corpo:** a 18 m o andróide parte para cima, gruda no alvo e circula em volta cortando; sem a vaga de ataque, espera afastado (o diretor continua limitando quantos atacam).
- **Pisão** (`combat/crush.ts`): um robô ao menos 2× mais alto, andando (comando do tick) na direção de um pequeno encostado, tira metade do torso a cada passo de 0,35 s: dois passos matam, e o abate conta para quem pisou. Vale nos dois sentidos, então um Mech rebelde também vai pisar num jogador de andróide.
- **Risco × recompensa:** o andróide precisa chegar colado para ferir, e colado ele morre pisado.
- **Nomes:** menores e nítidos: textura pequena (256×32) sem mipmap, contorno escuro no lugar do brilho que borrava.
**Custo de CPU:** pisão = laço grandes × pequenos (≤ 8 × 8) por tick com contas de distância; corte = uma conta por mordida. Nada alocado por tick.
**Quem decidiu:** dono (motosserra, pisão, 2 passos); Claude (números, alcance, IA).

## [2026-09-25] Passada de consistência documental (PRs até #50)
**Pedido do dono:** conferir os PRs mergeados até o #49 contra ESTADO_ATUAL, ROADMAP e STATUS_REAL; corrigir o que ficou para trás, conferir o item de draw calls do #43 e descrever com precisão o estágio do multiplayer depois do #49, confirmando no código.
**Divergências corrigidas (com a evidência):**
- **Draw calls:** o ESTADO ainda listava "draw calls por Mech (~34 cada)" como pendente; o #43 fez. Contado no código (Vector-09 e andróide montados no Node): 9 malhas cada. ROADMAP e STATUS agora falam dos dois e citam o #48 (flash branco).
- **Pendências do Gemini já concluídas** ainda abertas no ESTADO: setas e sons dos andróides (#47), a nota do PR #17. Removidas.
- **Próxima sessão:** dava a tela do Hangar ao Gemini, contradizendo a divisão de trabalho (passou para o Codex). Reescrita.
- **M1 dita como "a mesma simulação no cliente e no servidor"** (ROADMAP) e "REAL" (STATUS): exagero. O servidor não existe, a simulação ainda cria malhas, materiais e objetos na cena (Arena, Destructibles, DebrisSystem, ProjectileSystem, RocketSystem, BotSystem, MechBase e modelos), chama partículas dentro das regras (Combat, Destructibles, Projectile, Rocket, BotSystem), e o tiro do jogador sai do modelo desenhado (`PlayerController`: `muzzleWorldPosition`, `rig.aim`), enquanto os bots usam `simMuzzle`. ROADMAP, STATUS (agora PARCIAL) e `MULTIPLAYER.md` (P1 parcial, nova seção 8) ajustados.
- **Destroços "só cosméticos"** (STATUS): o teste da M1 mostrou que mudam a simulação (ordem interna do Rapier). Corrigido.
- **"Painel de missão no ar na raiz do site"** (STATUS): a raiz é a landing; o painel virou os bastidores, e a ficha técnica e o "sem pay-to-win" estão na landing. Reescrito.
- **Site público** (STATUS) sem a `/oficina/`. Incluída.
**Decisão:** a separação simulação × render × efeitos precisa de decisão de arquitetura: proposta e critérios de aceitação em `MULTIPLAYER.md`, seção 9, sem implementar. Recomendação: tiro do jogador e yaw pela simulação antes da M4.
**Quem decidiu:** dono (a passada); Claude (as correções e a proposta).

## [2026-09-25] Nomes de IAs nos bots e o guia visual dos robôs
**Pedido do dono:** "mostrar os nomes nos bots: claude, gemini, chatgpt, qwen, anthropic, deepseek, pra ficar mais engraçado"; e "criar o style sheet dos robôs numa IA externa; preciso de um texto para explicar lá o que estamos fazendo".
**Decisão (Claude):**
- **Nomes por tipo** (`BOT_NAMES`, uma lista só): Mechs CLAUDE, GEMINI, CHATGPT; andróides QWEN, DEEPSEEK e MISTRAL (o terceiro andróide, fora da lista do dono); técnico ANTHROPIC (o que conserta os outros). O placar mostra a personalidade junto (CLAUDE·BRABO).
- **Nome sobre a cabeça:** sprite de tamanho fixo na tela, com teste de profundidade (atrás de prédio some: sem ver através de parede), só até 90 m, vermelho, amarelo no técnico. Até 7 draw calls a mais; só a posição muda por quadro.
- **Marcas registradas:** os nomes são de empresas e produtos reais. No protótipo gratuito é brincadeira; antes do lançamento (portais, anúncios) o dono decide se viram paródias (decisão em aberto). A troca é uma lista.
- **Guia visual** (`ESTILO_ROBOS.md`): regras de estilo (blocos que dá para montar em código, 6 partes legíveis, encaixes de arma, respiros de calor, cor por lado), paleta com os valores do `palette.ts`, os personagens e os futuros, o formato das pranchas e os textos prontos para a IA de imagem. As imagens são referência; o Codex traduz em peças do `meshKit`.
**Quem decidiu:** dono (nomes, pranchas); Claude (qual nome em qual bot, formato do briefing).

## [2026-09-25] M1 do multiplayer: a partida sem tela
**Pedido do dono:** "quero aplicar o multiplayer; dá para criar o servidor no meu PC?"
**Decisão (Claude):**
- **`sim/Match.ts`** tem a partida inteira (arena, barricadas, Mechs, bots, projéteis, foguetes, dano, renascimento, rodadas) no tick fixo, sem WebGL nem DOM. As regras que estavam espalhadas no `Game.ts` (acerto → alerta do bot, abate → placar, explosão → dano em área, dash → demolição) foram para a partida; o `Game` só ouve eventos para tela, som e vibração. O servidor vai instanciar a mesma classe.
- **Pragmático:** a simulação continua usando o Three.js para matemática e grafo de cena (roda no Node sem WebGL, como os testes sempre rodaram). Tirar o Three.js do servidor só se a memória pedir.
- **Servidor sem destroços** (`debris: false`): não vão pela rede e custam CPU.
- **Achado:** destroços no mesmo mundo físico mudam a ordem interna do Rapier e a partida diverge depois do primeiro estilhaço (e com `Math.random`, entre execuções). O servidor, sem destroços, é determinístico (testado); o cliente corrige pela reconciliação (M4); plano B registrado: mundo físico só para os destroços.
- **Medido:** 0,74 ms por tick em média com a sala cheia (meta de 2 ms, G14).
**Custo de CPU:** nenhum a mais no cliente (a mesma ordem de tick de antes).
**Quem decidiu:** Claude.

## [2026-09-25] Correção: Mechs brancos depois da junção de malhas
**Achado (Claude, jogando o build para testar as setas):** o Vector-09 e os andróides apareciam brancos e brilhando. Na junção das malhas por articulação (PR #43, Codex), o uniforme do flash de dano começava com `new THREE.Color()`, que no Three.js é **branco**; o flash só é reescrito quando o Mech toma dano, então o casco inteiro brilhava branco até o primeiro tiro.
**Decisão:** a cor nasce preta (`new THREE.Color(0, 0, 0)`). Uma linha, no território do Codex (regra 4: correção pequena e segura; ele fica sabendo pela revisão cruzada).
**Lição para a revisão:** mudança visual de render pede captura de tela no PR (o check headless só confere que sobe, não a cor).

## [2026-09-25] Pendências do Gemini concluídas pelo Claude; tela do Hangar para o Codex
**Contexto:** o Gemini ficou sem crédito no dia com três entregas fora da `main`: setas de inimigos (PR #40, com conflito e a revisão pedindo ajustes), sons dos andróides (branch sem PR) e dicas da primeira partida (um commit depois do PR #32). O dono pediu: "veja se ele está indo bem e conclua as demandas que ele deixou abertas".
**Decisão (Claude):**
- **Portadas num branch do Claude** (regra 2: nunca dois agentes no mesmo branch), com os ajustes da revisão: setas sem alocação por quadro, DOM escrito só quando muda, escondidas com o jogador morto e só até 120 m; sons dos andróides com volume pela distância (antes tocavam alto do outro lado do mapa); dica de calor no primeiro "QUENTE" (e não no primeiro tiro), dica de foguetes no primeiro foguete, dica do arco vermelho mantida para tiro de Mech e a dos andróides para tiro de andróide; a contagem de dicas vistas segue a lista (era fixa em 4). O PR #40 foi fechado apontando para o novo.
- **Tela do Hangar passa para o Codex** hoje (o Gemini está sem crédito e a tela tem prévia 3D do Mech, que é território de render). Registrado na divisão de trabalho.
**Quem decidiu:** dono (concluir as pendências); Claude (como portar e a fila do Codex).

## [2026-09-25] Personalidades dos bots, vaga de ataque e inimigos configuráveis
**Pedido do dono:** "está muito difícil, eles são muitos e me juntam. Os bots estão com IA? Dá para integrar Groq, Gemini, DeepSeek por API? Eles pensam igual? Um mais brabo, outro mais manso, outro fujão que ataca na covardia. Quero poder configurar mais."
**Decisão (Claude):**
- **Sem modelo de linguagem no combate:** cada chamada leva 0,2–2 s e o bot decide 60 vezes por segundo; custaria por chamada e por jogador; não é reproduzível (quebra G1/G2, o servidor e os testes); e a chave de API ficaria exposta no navegador. A IA de jogo (estados, percepção, parâmetros) é o que os estúdios usam. Um modelo de linguagem faz sentido **entre rodadas**, no servidor: o "rádio" das IAs rebeldes provocando o jogador (ideia no ROADMAP).
- **Personalidades** (`PERSONAS` em `combat/BotController.ts`), por cima do tipo de robô e da dificuldade: **brabo** (chega a 55% da distância, quase não recua, só para de atirar superaquecido, rajadas 1,5×), **manso** (1,45× mais longe, recua com 55% do torso, esfria em 70%, atira 0,6×), **fujão** (espreita pelas costas; ataca quando o alvo está de costas, avariado ou superaquecido; visto de frente, foge com dash), **soldado** (o de antes).
- **Diretor de ataque** (`BotSystem`): vagas de ataque por alvo (Mech conta 1, andróide ½; padrão 2). Quem não tem vaga espera 1,4× mais longe, sem atirar. A vaga vai primeiro para quem já está no turno, depois pela personalidade (brabo antes), depois o mais perto; o turno dura 7 s e passa. Roda 5 vezes por segundo, sem alocar. É a técnica dos jogos de tiro para dar pressão constante sem todo mundo de uma vez.
- **Configurável** (`GameSettings`): Mechs (0–3), andróides (0–3) e técnico valem ao reiniciar; a personalidade de cada Mech e quantos atacam juntos valem na hora. **Padrão novo:** 3 Mechs (KESTREL brabo, MAKO soldado, VIPER fujão), 2 andróides (eram 3), técnico, 2 atacando juntos. O placar mostra a personalidade (KESTREL·BRABO).
- **De quebra (R17):** os testes com física passavam dos 5 s padrão do Vitest com a máquina ocupada e falhavam por tempo; o limite subiu para 30 s.
**Custo de CPU:** diretor a 5 Hz com ≤ 7 bots (um laço e uma inserção ordenada); a emboscada são duas contas de ângulo por tick. Nada alocado.
**Quem decidiu:** dono (personalidades, menos pressão, configurar); Claude (parâmetros, diretor, por que não usar modelo de linguagem no combate).

## [2026-09-25] Explosões com tamanho por partícula e teto fixo
**Motivo:** partículas do mesmo tamanho davam pouca leitura de profundidade em impactos e explosões, apesar do pool fixo.
**Decisão (Remoratrader/Codex):** manter um único `THREE.Points`, acrescentando `particleScale` e expansão ao longo da vida em typed arrays pré-alocados. Fogo, fumaça, poeira e faíscas usam tamanhos e curvas próprias; o sprite e o shader seguem o mesmo draw call.
- `MAX_PARTICLES = 3000` é o teto global; o construtor pode reduzi-lo, nunca aumentá-lo. Bursts são limitados ao tamanho do pool e substituem partículas mais antigas.
- O `update()` escreve apenas nos buffers existentes; não cria vetores, arrays, materiais ou geometria por quadro.
**Custo de CPU:** percorre no máximo 3000 slots por frame e atualiza posição, cor e tamanho no mesmo `THREE.Points`.
**Quem decidiu:** Remoratrader/Codex (acabamento dentro do território visual).

## [2026-09-25] Rig do Vector-09 reduzido para 9 draw calls
**Motivo:** o painel de desempenho mostrava cerca de 34 chamadas por Vector-09, acima do orçamento para a arena e as salas multiplayer.
**Decisão (Remoratrader/Codex):** fundir as malhas estáticas por pivô articulado ao construir o rig. Cada grupo articulado passa a desenhar uma geometria com cor, metal, rugosidade e emissão por vértice; emissão dinâmica do propulsor, flash de dano e visibilidade por parte seguem ativos.
- O Vector-09 cai de ~34 para 9 draw calls; cada grupo de articulação continua sendo ocultado independentemente quando sua parte é destruída.
- A combinação ocorre uma vez na construção do modelo. O loop de render não cria objetos nem buffers adicionais.
- No build atual, o painel marcou 99 draw calls para a cena inteira parada (inclui ambiente, partículas e demais Mechs); por isso o orçamento por rig foi conferido na estrutura de pivôs, não inferido do total da cena.
**Custo de CPU:** trabalho de geometria apenas na criação do rig; 9 submissões de desenho por Vector-09 em cada frame.
**Quem decidiu:** Remoratrader/Codex (otimização dentro do território de render).

## [2026-09-25] Plano do multiplayer
**Pedido do dono:** "já podemos começar a planejar o multiplayer? Ou ainda há tarefas anteriores?"
**Decisão (Claude):** plano em `MULTIPLAYER.md`.
- **Pré-requisitos:** separar simulação e render (`shared/`); draw calls por Mech ≤ 10 (Codex); FPS medido numa GPU integrada (dono); contratos de rede mergeados antes da rede (regra 5). A montagem já é validável no servidor (Hangar).
- **Arquitetura:** Colyseus, uma sala por partida, a mesma simulação a 60 Hz no servidor; estado a 20 Hz com delta; prediction e reconciliação do Mech local; remotos interpolam ~100 ms atrás sem character controller; tiros com compensação de latência até 150 ms; reconexão de 15 s.
- **Banda estimada:** ~18 B por Mech por snapshot → ~4 KB/s de download por jogador (meta de 8) e ~0,6 KB/s de upload (meta de 2). Medir na etapa M7.
- **Etapas M0–M8**, um PR cada; Gemini faz as telas do online contra os contratos, Codex o render.
**Custo:** nenhum agora (só documento).
**Quem decidiu:** Claude (arquitetura, etapas); o dono decide hospedagem, mira assistida no PvP, bots nas salas e o formato do código da sala.

## [2026-09-25] Contrato do Hangar: montagem, carga e link de build
**Pedido do dono:** seguir com o Hangar ("pode prosseguir").
**Decisão (Claude):**
- **Contrato antes da tela** (regra 5 do AGENTS): `LoadoutSpec` (só ids e níveis) e `validateLoadout` (regra pura, sem 3D) em `hangar/loadout.ts`. Nada vindo de armazenamento, link ou rede é confiado; os números saem sempre do catálogo.
- **Carga de armas de 11 t no Vector-09:** cabem 6 das 9 combinações; os dois braços no máximo, nunca. A carga que sobra vira blindagem numa próxima etapa (versão 2 do formato).
- **Os números dos chassis saíram dos arquivos de modelo** para `entities/chassis.ts`, sem Three.js: é o primeiro passo da separação simulação × render que o multiplayer pede, e o site ficou mais leve (não carrega mais o Three.js no build).
- **O Mech troca de armas no renascimento** (`MechBase.equip`, `PlayerController.rearm`), inteiro e frio; o jogo lê a montagem salva ao abrir.
- **Link de build** (`/jogar/?build=v1.vector09.plasma-2.rockets-0`): compartilhar montagem é viral e deixa o dono testar os níveis antes da tela existir. A landing ganhou a grade das 9 combinações, cada uma com link.
- **Progressão ainda não existe:** todos os níveis estão liberados para todo mundo, igual (sem pay-to-win). O contrato já aceita o filtro de nível bloqueado.
- **Achado:** com os dois braços, todas as montagens derrubam em 3,3–3,5 s (o calor do Mech limita). O nível pesa nas rajadas de uma arma só.
**Custo de CPU:** zero por tick; a validação roda ao abrir o jogo e ao aplicar.
**Quem decidiu:** Claude (formato, carga, onde aplicar); o dono decide a progressão e o segundo chassi.

## [2026-09-25] Gestão do projeto nos bastidores
**Pedido do dono:** "caprichar mais nos bastidores: introduzir as ferramentas de gerenciamento de projetos, gestão de entregas, planejamento, e mais elementos gráficos no roadmap (criativo e objetivo, gráficos que impactem e digam muito sobre o projeto)"; e antes: "tornar cada vez mais profissional, técnico e expert a forma como expomos nosso trabalho".
**Decisão (Claude):**
- **Quadro Agora / Próximo / Depois** (fase atual, próxima, demais) com um código por item (frente + posição na frente: CB-07, UX-12), a frente e o agente quando o item diz quem faz.
- **Burn-up** do escopo contra os feitos, com o histórico do ROADMAP lido do git (uma leitura por commit, um processo git só). Mostra também quanto o escopo cresceu.
- **Linha do tempo das fases** com as datas reais de início e fim; só a fase atual tem estimativa, pelo ritmo das últimas 72 h, marcada como estimativa. Fases futuras não têm data: os itens delas são grandes demais para prever pelo ritmo.
- **Matriz frentes × fases:** onde o esforço foi e o que vem.
- **Métricas DORA** (as quatro de entrega contínua da indústria): frequência de deploy, lead time do primeiro commit ao ar, taxa de falha de mudança e tempo de recuperação, lidas das execuções do CI na `main` e do git. O lead time sai do git (os commits de cada PR), porque a API do GitHub recusa a lista de commits de todos os PRs (limite de nós).
- **Achado:** `entregas()` caía em silêncio para o git quando a resposta do GitHub passava de 1 MB (limite padrão do Node); agora com buffer de 64 MB.
**Custo:** só no build do site (~1 s a mais). Nada no jogo.
**Quem decidiu:** dono (pedido); Claude (quais ferramentas e métricas).

## [2026-09-25] Calor completo do Mech e a Oficina (bancada de testes)
**Pedido do dono:** "investir no sistema de balanceamento, como uma oficina mecânica de alto padrão, para estudar e avaliar o desempenho dos robôs, armas e defesas: um jogo de estratégia realista e objetivo. Criticidade do calor: dano, correr sem parar, usar armas, pular, dash, tudo pode aumentar o calor, então eventualmente os mechs precisam PARAR pra resfriar; cada arma com seu coeficiente de calor".
**Decisão (Claude):**
- **Tudo esquenta o mesmo dissipador:** tiro (coeficiente de cada arma), corrida (15%/s na velocidade máxima, proporcional), pulo 5%, dash 12%, dano recebido 0,2% por ponto (sem segurar o resfriamento). Chassi esfria 60%/s; **parado, em dobro**.
- **Criticidade:** QUENTE a partir de 70% (aviso). Superaquecido em 100%: armas travadas, sem pulo nem dash, metade da velocidade; o resfriamento de emergência vai na metade, parado ou não, e andando a corrida ainda soma (~2,4 s parado, ~3 s andando para voltar a 35%).
- **Por que a corrida é 15%/s e não mais:** a 30%/s, quem atira andando (o normal num jogo de tiro) fervia em 1,3 s e passava 80% do tempo travado. A 15%/s ferve em 1,8 s segurando o gatilho, e em rajadas curtas parando na pausa nunca ferve.
- **Por que parado não esfria em dobro quando já superaqueceu:** senão o piloto "torre" (parado segurando o gatilho) voltava rápido demais e derrubava um Mech mais depressa que as metas de equilíbrio (combos abaixo de 2,5 s).
- **IA:** fervendo (≥ 90%) ou superaquecido, o bot para no lugar e esfria (estado `cool`), sem atirar; volta a 45%. Janela para o jogador punir.
- **Oficina** (`/cybermech/oficina/`, `scripts/oficina.mjs`): bancada gerada pela simulação do jogo (`combat/balance.ts → drill`: corrida, rajadas, pausas, dash, pulo). Mostra o calor de cada ação, seis exercícios de 20 s (dinamômetro), o placar de dano, o tempo para destruir cada parte, o dano pela distância e os chassis. Um teste confere que a bancada bate com o Mech de verdade (física, correndo e atirando).
- **Achado da bancada:** rajadas de 6 parando na pausa causam ~64% mais dano que correr com o gatilho apertado, e nunca fervem. Administrar o calor é a estratégia.
- **Gráficos** (`scripts/site/graficos.mjs`): uma série por gráfico (três cores em linhas não passaram no teste de daltonismo; viraram gráficos lado a lado na mesma escala), barras em HTML para o texto ficar legível no celular.
**Custo de CPU:** no jogo, uma multiplicação e uma soma por tick para a corrida; pulo, dash e dano são somas por evento. Nada alocado. A oficina roda só no build do site (~1 s).
**Quem decidiu:** dono (tudo esquenta, parar para esfriar, oficina); Claude (coeficientes, criticidade, bancada, gráficos).

## [2026-09-25] Arsenal em três níveis, dano calibrado, calor do Mech e o projeto do Hangar
**Pedido do dono:** "calibrar melhor o poder das armas pra ficarem mais realistas; padronizar com 3 níveis de poder em cada arma (pra quando tivermos upgrades); cálculos de dano realistas, sem apelação. O jogo tem que ser jogável e equilibrado: a diferença vem da técnica, das habilidades e da customização. Quero começar a projetar o HANGAR, e isso vai na página do jogo, onde está o roadmap".
**Decisão (Claude):**
- **Arma é dado** (`combat/weapons.ts`): dano, cadência, calor por tiro, carregador, velocidade, alcance ótimo e máximo, queda com a distância, raio de explosão e massa. O Mech carrega um `loadout` (braço direito: energia; esquerdo: munição), que é o encaixe do Hangar. Tabela montada uma vez: pedir uma arma no tick não aloca (G4).
- **Três níveis, uma regra só:** MK II = ×1,2 de dano, ×1,15 de calor, ×1,5 de massa; MK III = ×1,4, ×1,3, ×2. **Poder custa carga:** o dano por tonelada cai a cada nível, então subir de nível é escolha, não vantagem pura.
- **Metas de tempo para derrubar** (torso do Vector-09, todos os tiros no alvo; `combat/balance.ts` roda as regras do tick fixo), travadas por teste: plasma MK I entre 5 e 7,5 s (hoje 6,2 s; antes era ~2 s: apelação); nenhuma arma sozinha abaixo de 4,5 s; nenhum combo dos dois braços abaixo de 2,5 s; MK III 10–40% mais rápido que o MK I; mirar na perna rende.
- **Calor do Mech, não da arma:** com calor separado, plasma MK III + foguetes MK III derrubavam em 0,9 s. Com um dissipador só para o chassi (o que é também o mais realista), o combo trava o Mech antes e fica em ~3 s.
- **Números:** plasma 25 → 16 de dano, 0,18 → 0,22 s; dano cheio até 60 m, 40% a 200 m. Foguete 75 → 40 no centro, 15% de calor por disparo. Andróide com vida em escala (torso 50 → 32: continua caindo com 2 tiros de plasma). Técnico conserta 8/s (era 18), para não anular o novo dano.
- **Cadência exata (R17):** o tiro esperava ticks inteiros (0,18 s virava 0,2 s); agora a sobra do tick passa para o próximo tiro (`combat/trigger.ts`), sem acumular crédito com o gatilho solto.
- **Hangar em projeto:** especificação em `HANGAR.md` (contrato, chassis, carga, módulos, progressão, tela, rede, etapas); resumo público na seção HANGAR do `GAME_DESIGN`. Próximo passo é o contrato (`LoadoutSpec` + `validateLoadout`), antes da tela (regra 5 do AGENTS).
- **Página do jogo:** nova seção "Hangar" com a planta do Vector-09, o arsenal nos três níveis e as regras de equilíbrio. Os números saem do TypeScript do jogo, carregado pelo Vite no build do site (`dados.mjs → jogo()`), sem cópia nem regex; a ficha técnica passou a vir do mesmo lugar.
**Custo de CPU:** nenhum a mais por tick (a arma é um objeto congelado; a queda por distância é uma conta por impacto). O site leva ~2 s a mais no build para carregar os módulos do jogo.
**Quem decidiu:** dono (três níveis, equilíbrio, Hangar); Claude (regra dos níveis, metas, calor do Mech, números).

## [2026-09-25] Marca SERAFIM WEB: vinheta de abertura e assinatura discreta
**Pedido do dono:** "qualidade que deixe o jogo mais profissional, ar de grande estúdio; adicione sutilmente nossa marca SERAFIM WEB. No início, a nossa marca como antigamente nos games (SEGA, Konami, PlayStation), com som característico e a logo por 1 a 2 segundos; na página /cybermech/ também, como o efeito matrix de pontos verdes do site do serafim13".
**Decisão (Claude):**
- **Vinheta no jogo** (`brand/BrandSplash.ts` e `brand/sting.ts`): ~1,9 s, uma vez por carregamento, no primeiro "clique para jogar". O navegador não deixa tocar som antes de um gesto do jogador, por isso ela não abre sozinha ao carregar. Clique ou tecla pula (só depois de 0,35 s, para o clique de entrada não pular). A partida começa quando ela acaba, com o mouse já preso.
- **Som sintetizado** na Web Audio (sopro, impacto grave, acorde em cascata com eco, colchão), sem arquivo, pelo volume mestre das configurações.
- **Abertura da landing:** chuva de pontos verdes (o verde do jogo) num canvas 2D, com o emblema e o letreiro. Uma vez por sessão (`sessionStorage`), pula com qualquer gesto, não roda com "reduzir movimento" e sai do DOM no fim. As imagens só baixam quando ela roda. O check do site confere que ela roda e sai da frente do botão.
- **Assinatura discreta:** "um jogo SERAFIM WEB" na pausa, versão do build com © no canto (do `git describe`, via `VITE_BUILD`), "SERAFIM WEB apresenta" na landing, © nos rodapés, `<meta name="author">`. Nada no HUD de combate.
- **Arquivos:** emblema de `serafim13/vetorserafim.png` (240 px) e letreiro (fundo transparente, tirado por código), em WebP, ~56 KB juntos, em `client/public/brand/`.
**Custo de CPU:** zero durante a partida: a vinheta é animação CSS antes do jogo começar, e o som são ~12 nós do Web Audio que se desligam sozinhos. A chuva da landing é um canvas de ~2 s (~100–150 pontos por quadro) e depois some.
**Quem decidiu:** dono (marca, vinheta, efeito); Claude (duração, som, quando toca).

## [2026-09-25] Andróides mais chatos que perigosos; o técnico; funções da escala 1
**Pedido do dono:** "os andróides têm que ser mais fracos e tirar menos vida; mais massantes do que perigosos, rápidos mas fracos. Alguns são pra reparar os outros bots, coletar peças, entregar munição, fazer manutenção nos robôs maiores, e podem pilotar mechs (os humanoides vão poder fazer as mesmas ações que humanos, como pilotar as máquinas do hangar)". E: "manter o jogo leve para escalar com muitos jogadores; código limpo, arquitetura profissional".
**Decisão (Claude):**
- **Combate mais fraco:** torso 70 → 50 (2 tiros de plasma), dano por tiro 9 → 4, cadência 0,3 → 0,4 s, mira 2,2× mais solta (`BotProfile.aimErrorScale`). Continuam rápidos e desviando.
- **Técnico** (`combat/TechnicianController.ts`, visor amarelo, T-01):
  - Vai até o Mech rebelde mais avariado (reavalia a cada 0,5 s) e conserta 18 de vida/s na parte mais avariada que ainda existe (`combat/repair.ts`, regra pura). Parte arrancada não volta: isso fica para o coletor.
  - Foge com dash quando o jogador chega a 16 m; volta a trabalhar a 24 m. Não atira. É o alvo prioritário, e isso cria decisão tática.
- **Arquitetura:** os dois cérebros têm a mesma interface (think → MechInput, alert, reset). A direção comum (ângulos, giro, movimento no referencial do torso) saiu do BotController para `combat/steer.ts`, sem mudar comportamento (os testes dos bots passam iguais). O conserto é aplicado pelo BotSystem no tick fixo. O feixe é uma linha de 2 pontos por técnico, atualizada no render sem alocar.
- **Funções futuras** (GAME_DESIGN e ROADMAP): coletor (peças dos destroços reconstroem partes), logística (munição e foguetes) e piloto (andróide embarca em máquina vazia do hangar; matar o piloto desliga o Mech).
**Custo de CPU:** técnico = 1 character controller + um laço por ≤3 aliados e pelos alvos por tick, sem raycast. Arena com 8 unidades (7 bots + jogador), o tamanho de sala do G11.
**Quem decidiu:** dono (papéis, força); Claude (números, IA, arquitetura).

## [2026-09-25] Cidade estilo Tron
**Pedido do dono:** "os prédios podem ser coloridos: volte aquele ciano, o pink inicial, vermelho aceso, amarelo fluorescente; cores bem coloridas, estilo Tron, sci-fi moderno, espacial".
**Decisão (Claude):**
- **Cidade:** ciano, pink e amarelo fluorescente nos prédios; barricadas cada uma de uma cor neon; plataforma e borda em pink; grade do chão em ciano.
- **Horizonte:** faixas neon e luzes de topo em cores sorteadas (semente fixa: sempre a mesma cidade) e um céu de 900 estrelas.
- **Leitura de combate:** verde continua sendo do jogador e vermelho das IAs rebeldes, o que é do combate não some no meio das cores.
**Custo:** +2 draw calls no horizonte (faixas instanciadas e estrelas), tudo estático; nada por quadro. As cores por instância saem do mesmo sorteio com semente.
**Quem decidiu:** dono (direção); Claude (distribuição das cores).

## [2026-09-25] Tema "IAs rebeldes" e escala 1: andróides
**Pedido do dono:** "o tema é que temos que defender contra IAs rebeldes; pensar na escala dos robôs. Esse que você começou pode ser a escala 2; criar os proporcionais aos robôs autônomos de hoje (humanoides, quadrúpedes) como NPCs com IA. São pequenos, mas mais ágeis que os grandes. Esses seriam o perfil 1 de tamanho."
**Decisão (Claude):**
- **Escalas:** 1 = robôs autônomos (~2 m); 2 = Mechs (~5 m, o Vector-09); 3 = máquinas de cerco, no futuro. Registrado no GAME_DESIGN ("TEMA E ESCALAS").
- **Primeiro da escala 1: andróide rebelde** (`entities/Android.ts`), um humanoide gerado por código, sem copiar nenhuma marca real.
  - Frágil: 70 de torso, cai com 3 tiros de plasma.
  - Tiro fraco: 9 contra 25 do Mech.
  - Ágil: arrancada de 120 m/s² contra 70 do Mech, pulo duplo, dash a cada 1,4 s.
- **IA:** a mesma do Mech (BotController), com um **perfil de luta** por tipo (`BotProfile`). O Mech ataca a 38 m e anda de lado devagar. O andróide chega a 22 m, troca de lado a cada 0,35–0,9 s e desvia com dash em 35% das trocas. O sorteio do desvio só acontece para quem tem a chance, e os Mechs continuam com a mesma sequência de antes (determinismo e testes preservados).
- **Dano por arma:** `MechStats.weaponDamage`. Cada tiro leva o dano de quem atirou, e a ficha da landing lê daí.
- **Arena:** 3 Mechs + 3 andróides + o jogador. Teto: 7 character controllers.
**Custo de CPU:** +3 character controllers e +3 cérebros de IA por tick; ~16 draw calls por andróide (o Mech tem ~34). Dentro da meta de 8 por sala (G11).
**Próximo:** quadrúpede (cão-robô) na escala 1; afinar a animação de passo do andróide, que hoje herda a do Mech.
**Quem decidiu:** dono (tema, escalas, pedido); Claude (números e IA, a calibrar no playtest).

## [2026-09-25] CYBERMECH; paleta neon multicolorida
**Pedido do dono:** "mude o nome para CYBERMECH apenas, sem protocol" e "quero verde neon, vermelho, pode usar diversas cores, só não fica apenas em azul e roxo".
**Nome:** CYBERMECH no jogo (título e pausa), no site (landing, bastidores, prévia do link), nos documentos e no `package.json`. O caminho `/cybermech/` já servia. O codinome interno continua o do repositório. "Protocolo Serafim UM" não muda: é o protocolo de engenharia, não o jogo.
**Paleta (Claude):** o âmbar de ontem ficou monocromático. Agora é neon tático:
- **Verde neon** para o que é do jogador: HUD, mira, tiro, visor e título.
- **Vermelho** para as IAs rebeldes: Mechs vermelhos, visor e tiros.
- **Laranja e amarelo** para fogo, foguetes e perigo. O jogador tem pintura amarela de perigo.
- Prédios em verde, amarelo e branco, e grade verde no chão.
- Tudo continua saindo do `core/palette.ts` e dos tokens do `styles.css`: a troca foi de valores, não de código.
- O site do projeto fica no âmbar de terminal, que o dono já aprovou.
**Quem decidiu:** dono (nome, direção das cores); Claude (tons).

## [2026-09-24] Primeira partida guiada
**Decisão (Gemini):** Implementado `Onboarding.ts` que apresenta dicas contextuais sem cobrir a mira.
- Textos se adaptam para PC e Toque (ex: 'USE WASD...' x 'USE O POLEGAR ESQUERDO...').
- Gatilhos dinâmicos via `Game.ts` respondendo a movimento, inimigo na mira, dano recebido e disparos de arma.
- O componente usa `localStorage` para aparecer apenas na primeira vez.
- Estilo minimalista fixado acima dos comandos básicos e com `opacity` transitório.

## [2026-09-24] Calibragem do Vector-09: menos velocidade e calor na arma
**Pedido do dono:** "esse primeiro robô está muito rápido, e a sequência de tiro dele precisa dar um respiro; não dá pra ficar direto assim, pra não apelar tanto".
**Decisão (Claude):**
- **Movimento:** 16 → 12 m/s, aceleração no chão 95 → 70, no ar 28 → 22, dash 50 → 42 m/s, recarga do dash 2,5 → 3 s.
- **Tiro:** cadência 0,14 → 0,18 s (7 → 5,5 tiros/s), com **calor**, o clássico dos jogos de Mech (`combat/heat.ts`, regra do Mech, vale para bots).
  - Cada tiro soma 8,5%; ~12 seguidos superaquecem e a arma trava até voltar a 35%.
  - Só esfria 0,25 s depois do último tiro, a 60%/s; superaquecida, a metade.
  - Resultado (testado): segurar o gatilho rende ~2 tiros/s; rajadas de 5 com 1 s de pausa, ~2,6 tiros/s, sem travar. Antes do castigo de resfriamento, os dois davam quase o mesmo, e superaquecer não pesava.
- **HUD:** barra CALOR, vermelha perto do limite, piscando "SUPERAQUECIDO"; no toque o FOGO vira "QUENTE".
**Bug achado no caminho (R17):** o teste do bot que vê o jogador falhou com a velocidade nova. A causa era real: numa amostra, o raio de linha de visão passou direto por uma cápsula parada (erro numérico do Rapier), e isso zerava o tempo de reação do bot. Agora o bot só esquece o alvo depois de 2 falhas seguidas (0,2 s). O teste da rampa passou a medir o tempo pela velocidade do Mech.
**Custo de CPU:** desprezível (três somas por tick por Mech).
**Quem decidiu:** dono (pedido); Claude (números, a calibrar no playtest).
## [2026-09-24] Volume nas configurações
**Decisão (Gemini):** Adicionado campo de volume (0 a 1) nas configurações, acessível pelo menu e sincronizado com o ganho mestre do `AudioSystem` na inicialização e atualização das configurações.

## [2026-09-24] Som sintetizado para foguetes
**Decisão (Gemini):** Lançamento de foguetes agora toca um som sintetizado de curto decay (`AudioSystem.playRocketLaunch`) acionado a partir de `player.onRocket`, seguindo o conceito sem dependência de áudio externo. O impacto da explosão já usa o som de explosão genérico conforme o volume vs distância.

## [2026-09-24] Paleta âmbar industrial: sai o azul e o roxo
**Pedido do dono:** "azul e roxo é a assinatura de feito com IA, temos que mudar isso também".
**Decisão (Claude, dentro da identidade que o dono já aprovou no site):** o jogo passa a usar o âmbar industrial do site (terminal de fósforo, aço, luz de sódio).
- **Arena:** contornos em âmbar, branco quente e laranja de sódio; chão de aço com grade âmbar; luz quente; balizas vermelhas.
- **Mechs:** jogador laranja-ferrugem com visor âmbar; inimigos verde-oliva com visor vermelho.
- **Tiros:** do jogador em âmbar, do inimigo em vermelho, para saber de onde vem cada tiro.
- **Interface:** tokens com nome de papel (`--accent` âmbar, `--hot` laranja, `--alert` vermelho, `--ink` branco quente); a mira fica vermelha sobre o inimigo; fundos azul-marinho viraram marrom-escuro.
- **Site:** o ciano secundário virou branco quente (links, fase atual); o Gemini deixou de ser azul nos cartões.
- **Regra nova (IDENTITY):** cor nova entra primeiro no `core/palette.ts` / `:root`; nada de azul nem roxo.
**Custo de CPU:** nenhum (só troca de cor; os materiais são os mesmos).
**Quem decidiu:** dono (sair do azul/roxo); Claude (paleta, a ajustar com o olho do dono).

## [2026-09-24] Toque: botões em arco, editor de controles e mira sem "falha"
**Relato do dono (terceiro teste no celular):** "a mira ainda não tá boa, meio falha; os botões num shape meio quadrado não pegam bem meu dedo; poderia ser mais livre o centro do tiro, para segurar com mais conforto, pois assim tenho que segurar bem na ponta".
**Causas:**
- A grade 3×2 colada no canto obrigava o polegar a ir até a ponta do celular.
- O ganho da mira vinha da velocidade crua de cada evento de toque. Os eventos chegam em intervalos irregulares, então o ganho oscilava de um evento para o outro: a mesma arrastada girava diferente.
- A fricção e o puxão da mira assistida continuavam agindo quando o jogador tentava tirar a mira do alvo, e a mira parecia brigar com o dedo.
**Decisão (Claude):**
- **Arco:** botões redondos em arco em volta do polegar (`ui/touchLayout.ts`), com FOGO a ~20% da borda direita. Posições em fração da tela, testadas sem sobreposição em 7 telas (640×360 a 1180×820) e 3 tamanhos.
- **Editor:** "Ajustar controles" na pausa (só no toque). Arrasta cada botão, muda o tamanho (70%–140%), volta ao padrão. Fica salvo no aparelho, numa chave própria (`cybermech.touch.v1`) e validado, sem mexer no contrato de configurações que o Gemini estava editando.
- **Mira:** velocidade do dedo com média exponencial; ganho máximo de 2,2× para 1,6×.
- **Ajuda que solta:** puxar a mira para longe do alvo desliga fricção e puxão por 0,35 s (`movingAway`, testado). O tiro automático continua.
**Custo de CPU:** nenhum por quadro além do que já existia; o editor só age com o jogo parado.
**Quem decidiu:** dono (relato); Claude (desenho).

## [2026-09-24] Bastidores mostram a atividade da equipe (só dados reais)
**Pedido do dono:** "deixa com cara de que está sendo feito por uma equipe, com várias entradas, requisições e commits", sem parecer narrativa.
**Decisão (Claude):** mostrar a atividade que já existe, sem inventar nada. Não precisa: são dezenas de commits e de entregas em dois dias.
- Cada commit é atribuído a quem o fez: a coautoria do Claude no próprio commit; senão, o agente do PR em que ele entrou (etiquetas); sem PR, "equipe".
- Merge de PR na linha principal = entrega; merge de integração = commit.
- Seção "Atividade": commits, entregas, decisões registradas e pedidos do dono atendidos (entradas do cofre que nasceram de pedido ou relato dele).
- Mapa de calor de commits por dia e hora (horário de Brasília) e fluxo dos últimos 40 commits e entregas, com hora, agente e hash.
- Cartões da equipe com commits por agente. A landing ganha um sinal de vida: "N commits e M entregas em D dias · último às HH:MM".
**Limite:** nome de autor do git e nome de conta não aparecem. Os assuntos dos commits são públicos a partir de agora: nada de dado interno neles (o check já reprova o codinome).
**Quem decidiu:** dono (pedido); Claude (fontes e forma).

## [2026-09-24] Foguetes no braço esquerdo; produção toda em código
**Pedido do dono:** "quero adicionar a arma esquerda" e "prefiro fazer tudo aqui no código, eu só orientando e as IAs fazendo".
**Foguetes (Claude):** módulo próprio (`combat/RocketSystem.ts`); a regra de área mora no `CombatSystem.explode`.
- 4 no carregador, recarga contínua de 1 a cada 2,2 s, intervalo de 0,3 s, 75 m/s: visível no ar, dá para desviar de longe.
- Explosão de 6 m: 75 no centro, cai em linha reta até zero na borda. A distância é medida até a superfície da cápsula.
- Acerta a parte mais perto, pela mesma regra de zonas do plasma: no pé, a perna; no peito, o torso. Tática nova: arrancar a perna de quem está atrás da barricada.
- Quem dispara não se fere (sem pulo de foguete por enquanto). Barricadas no raio levam dano.
- Braço esquerdo destruído = sem foguetes; morto, o carregador enche.
- Controles: botão direito ou Q (remapeável) no PC; FOGUETE no toque (segurar dispara no ritmo); PLACAR no toque segura o placar (o Tab do celular).
- Testes: 7 (dano em área, carregador, recarga, perna x cabeça, dono imune, foguete voando com física real).
**Produção (decisão do dono):** sem Unity (seria reescrever tudo e o download iria de ~1 MB para dezenas de MB) e sem modelagem manual. Mechs montados por código a partir de peças, som sintetizado; a variedade vem do Hangar. Registrado no GAME_DESIGN ("PRODUÇÃO: TUDO EM CÓDIGO").
**Divisão:** o Gemini pega som dos foguetes, volume e mixagem, e primeira partida guiada (um PR cada, depois deste merge).
**Custo de CPU:** por foguete em voo, um raycast por tick e 2 partículas; explosão = um laço pelos Mechs e pelas barricadas (evento, não por quadro).
**Quem decidiu:** dono (arma, produção em código); Claude (números e regras, a calibrar no playtest).

## [2026-09-24] Mira no celular: assistida, antecipada e com tiro automático
**Sintoma (dono, segundo teste no celular):** "a jogabilidade no celular tá estranha, tô com dificuldade de mirar e atirar".
**Causa:** com dois polegares, o direito mira ou aperta FOGO, nunca os dois. E o plasma (140 m/s) leva ~0,3 s a 40 m: um bot andando de lado a 16 m/s sai 5 m do lugar. No PC o jogador aprende a antecipar; no dedo, quase impossível.
**Decisão (Claude), só no modo toque, desligável na tela de configurações:**
- **Tiro automático:** atira quando a mira acende há 0,12 s (passar de raspão não dispara).
- **Mira assistida** (`player/AimAssist.ts`, funções puras testadas):
  - Fricção: o dedo fica até 55% mais lento num cone de ~6° em volta do inimigo.
  - Puxão leve no cone de ~5° e rastreio de 75% do movimento do alvo, só enquanto o jogador age (anda, mira ou atira). Parado, a mira nunca joga sozinha.
  - Antecipação: mira onde o inimigo vai estar quando o plasma chegar. O ponto de mira fica na distância do alvo, para o tiro que sai do canhão não errar por paralaxe.
  - Só com linha de visão até o corpo.
- **Dedo:** 0,3°/px devagar (ajuste fino), até 2,2× num arrasto rápido.
- **Mira que acende e vibração:** a mira acende sobre um inimigo (no mouse, o que está sob a mira); vibração ao levar tiro e ao abater (só no toque).
**Medido:** partida emulada (844×390, toque), dedo varrendo sem tocar em FOGO. Antes: a mira acendia e nenhum tiro acertava. Depois: 4 acertos em ~6 s, nas 3 repetições.
**No caminho:** o primeiro teste "falhou" porque o `vite build` com caminho relativo gravou em `client/.tmp/` (a raiz do Vite é `client/`) e o teste rodou o build antigo. Build manual só com caminho absoluto.
**Justiça:** o mouse não tem assistência. No multiplayer, toque x mouse na mesma sala vira decisão em aberto (ESTADO).
**Custo de CPU:** por quadro, um laço pelos inimigos e no máximo um raio de linha de visão, só no toque; nada alocado. De quebra, o `raycast` parou de alocar dois vetores e um objeto por chamada (a mira chama todo quadro, cada projétil todo tick).
**Quem decidiu:** dono (pedido); Claude (desenho).

## [2026-09-24] Kill feed e indicador de dano integrados; indicador corrigido
**Integração (Claude):** o branch `gemini/killfeed-dano` estava pronto mas sem PR. Entrou por um branch de integração a partir da `main`, com o commit do Gemini preservado. O kill feed ajuda no celular: mostra quem abateu quem sem precisar do placar (Tab).
**Revisão cruzada:**
- Kill feed aprovado: pool fixo de 4, `textContent`, destaque do jogador.
- **Indicador de dano com bug:** errava o lado sempre que a câmera girava. O teste do Gemini supunha yaw 90° olhando para +X, mas no jogo a frente é (-sin yaw, 0, -cos yaw), ou seja, -X. Com a câmera virada, tiro de frente aparecia vindo de trás. Correção: relativo = ângulo do atirador **+** yaw. O teste novo usa a frente e a direita do próprio jogo em 5 ângulos.
- O kill feed ficava em cima do rótulo da câmera (`#mode`) e do botão de pausa do toque; foi reposicionado.
**Lição:** o teste tem que derivar a convenção do código do jogo, não de uma suposição. O teste antigo passava porque codificava o mesmo engano da função.
**Quem decidiu:** Claude (integração e correção).

## [2026-09-24] Celular: controles de toque refeitos e testados no check
**Sintoma (dono, num Android deitado):** "não consegui jogar no celular: botões mal posicionados, um sobre o outro, muito grandes; o direcional ficou preso; não entrou no jogo, ficou na tela de config".
**Causas (PR #17):**
- As duas áreas de toque cobriam a tela inteira mesmo com o jogo pausado e davam `preventDefault` no `touchstart`, então o toque nunca chegava à tela de pausa e o jogo nunca começava.
- Os botões ficavam em posições percentuais soltas, e FOGO e PULO se sobrepunham.
- O modo toque era decidido por `navigator.maxTouchPoints > 0`, o que tiraria o Pointer Lock de qualquer notebook com tela de toque.
**Correção (Claude, a pedido do dono; território do Gemini, registrado no ESTADO):**
- Controles só com o jogo rodando e no modo toque.
- O modo toque vem de `(hover: none) and (pointer: coarse)` e é confirmado pelo ponteiro que inicia a partida.
- Pointer Events com captura; direcional analógico com zona morta (`stickVector`, 4 testes); FOGO que mira junto.
- Grade 2×2 no canto com tamanhos em `vmin`; pausa no `click`, para o mesmo toque não retomar o jogo.
- Tela cheia deitado onde o navegador deixa; pausa ao trocar de app; sem câmera tática no toque (ela mira pelo cursor).
- Tela de pausa com instruções de toque e que cabe na altura do celular deitado.
**Trava:** o `site.mjs --check` joga num celular emulado (844×390, toque) e reprova se o toque não começar a partida, se o direcional não andar, se FOGO não segurar com o outro polegar no direcional ou se a pausa falhar.
**Site:** "Dan" no lugar de "diretor"; sem "feito em público" (o dono não fará lives por enquanto).
**Custo de CPU:** nenhum por quadro; só eventos de ponteiro, sem alocação por movimento.
**Quem decidiu:** dono (pedido, textos); Claude (desenho dos controles).

## [2026-09-24] Landing do jogo, bastidores como case e capturas automáticas
**Pedido do dono:** melhorar a página e "virar um case de desenvolvimento do game". Escolhas dele: **jogo + bastidores** e **bastidores às claras**.
**O que foi feito:**
- `/cybermech/` vira landing para jogador (`scripts/landing.mjs`). `/cybermech/bastidores/` vira o case (`scripts/painel.mjs`).
- Os dados das páginas ficam num módulo só (`scripts/site/dados.mjs`) e o visual num tema comum (`scripts/site/tema.mjs`).
- Nada na página é digitado à mão: destaques da seção VITRINE do `GAME_DESIGN`, entregas e autoria das etiquetas dos PRs, evolução por `git grep` em cada merge, diário dos títulos do HISTORICO. O `--check` reprova a VITRINE vazia.
- **Capturas automáticas:** o deploy entra no jogo headless (SwiftShader), clica no título da pausa (não nos botões), anda, atira e fotografa as três câmeras. JPEG de ~60 KB cada. Viram capa, galeria e og:image. Falha não derruba o site (a landing sai sem imagens e o log avisa), para uma foto não segurar uma entrega.
**Por que capturar no deploy e não versionar imagens:** a imagem nunca fica velha e não pesa no repositório. O `--check` fica rápido (as capturas custam ~30 s, só no deploy).
**Gráfico:** dois gráficos de uma série (testes; linhas), nunca dois eixos. Degraus, porque o valor muda a cada entrega. Dica ao passar o mouse e tabela para quem não enxerga o gráfico.
**Público vs. interno:** os bastidores publicam títulos do HISTORICO (menos os de conta e acesso), divisão de trabalho e pendências do ESTADO, ROADMAP e números. Nunca secrets nem dados do servidor (DEPLOY.md).
**GAME_DESIGN:** a plataforma passa a "desktop primeiro; celular em construção", porque o dono pediu a versão para celular ao Gemini. O toque gera o mesmo `MechInput`.
**Quem decidiu:** dono (páginas, bastidores às claras); Claude (desenho, capturas, fontes de dados).

## [2026-09-24] Planejamento reorganizado, gestão no GitHub e o site como case
**Pedido do dono:** "reorganizar o planejamento; melhorar a página /cybermech/; implementar as melhores ferramentas de gestão e criação, para virar um case de desenvolvimento do game".
**Escolhas do dono (perguntadas):**
1. Páginas: **jogo + bastidores**. `/cybermech/` vira a landing do jogo; o case vai para `/cybermech/bastidores/`.
2. **Bastidores às claras:** o case mostra a equipe de IAs (Claude, Gemini, Codex) sob o Protocolo Serafim UM.
3. Gestão: **repositório como fonte única + GitHub automático**. Sem quadro paralelo (GitHub Projects, Notion, Trello), porque as IAs só enxergam o repositório e duas listas saem de sincronia.
**Fases:** nova **Fase 3: Vitrine e polimento** (som, celular, kill feed, site, foguetes, draw calls): é o que a equipe está fazendo de fato antes do multiplayer. O multiplayer vira a Fase 4, o lançamento a 5 e a monetização a 6. A ordem combate → inimigos → multiplayer continua.
**Gestão no GitHub:**
- Etiquetas `frente:*` (as 11 do ROADMAP) e `agente:*` postas sozinhas em cada PR (`actions/labeler`, por arquivos e por prefixo do branch). Os 17 PRs antigos foram etiquetados com as mesmas regras; os PRs #2 e #13 levam também `agente:gemini`, porque integraram trabalho dele.
- Modelo de PR com custo de CPU e "como testar no site".
- Notas de versão agrupadas por frente; uma versão `v0.<fase>.0` a cada fase fechada.
**De quebra (R17):** STATUS_REAL tinha o Blind Mode como AUSENTE (existe: `#hud.blind` + chiado) e duas linhas de áudio, uma REAL e outra AUSENTE.
**Quem decidiu:** dono (páginas, bastidores, gestão, reorganizar); Claude (desenho das fases e da automação).

## [2026-09-24] Página pública com acentos quebrados: causa e trava
**Sintoma (dono):** "a página está boa, mas com caracteres quebrados".
**Causa:** o `painel.mjs` gerava um fragmento (sem `<!doctype>`, `<meta charset>` nem `viewport`), herança de quando o painel era só local. O LiteSpeed manda `text/html` sem charset, então o navegador lia o UTF-8 como Windows-1252 e rodava em modo quirks. O teste local não pegava porque o servidor de teste mandava `charset=utf-8`.
**Correção:**
- O painel vira documento completo.
- O `.htaccess` ganha `AddDefaultCharset UTF-8`.
- O servidor de teste agora manda `text/html` sem charset, como o real.
- O `--check` reprova página fora de UTF-8 ou em modo quirks; o `--verify` do deploy reprova página sem doctype ou sem `<meta charset>` no início.
- O rodapé mostrava o codinome interno (`.decepticons/…`); o check agora reprova o codinome no painel público.
**Quem decidiu:** Claude (R17).
## [2026-09-24] Kill feed + Indicador de direção do dano (#ux)
**Decisão / Tarefa:** Criar o sistema de Kill Feed e o Indicador Direcional de Dano no HUD (`#ux`).
**Como funciona:**
- **KillFeed (`client/src/ui/KillFeed.ts`):**
  - Canto superior direito, exibe no máximo 4 linhas de abates (ex: `KESTREL ▸ VOCÊ` ou `JOGADOR DESTRUÍDO`).
  - Cada mensagem desaparece em 5 segundos.
  - Pool fixo de 4 elementos HTML reutilizados no construtor (atendendo à regra G4 de zero alocação DOM em execução/abate) e atualização dos nomes exclusivamente por `textContent`.
  - Destaque visual (classe `.highlight`) quando o jogador local está envolvido (como autor do abate ou vítima).
- **DamageIndicator (`client/src/ui/DamageIndicator.ts`):**
  - Arco vermelho animado via CSS (`@keyframes damageArcFade`) posicionado em volta do crosshair, sumindo em 1 s sem cálculos por frame no JS.
  - Função pura `calculateDamageAngle` que determina o ângulo exato (0 a 360°) da origem do tiro em relação ao `yaw` da câmera do jogador (frente = 0°, direita = 90°, trás = 180°, esquerda = 270°).
  - Testado unitariamente com 5 casos de teste cobrindo todas as orientações em `client/src/ui/DamageIndicator.test.ts`.
- **Fiação:** Conectado diretamente em `client/src/core/Game.ts` dentro de `this.combat.onMechHit` e `this.combat.onMechKilled`.
- **Verificação:** `npm run check` 100% verde (typecheck, 56 testes Vitest, painel, build e smoke).
**Quem implementou:** Gemini.

---

## [2026-09-24] Estande de calibração do mouse e nova escala de sensibilidade
**Pedido do dono:** "no jogo é muito rápido para fazer essa configuração fina".
**Decisão:** uma tela própria, com o jogo parado, que mede o giro de verdade.
- Faixa de bússola com o mouse preso nela, não no canvas: o jogo continua pausado.
- "Gravar 1 volta": o jogador faz o gesto que quer para 360° e o total de pontos do mouse vira a sensibilidade (`calibrateFromCounts`). Não precisa saber o DPI; gesto com menos de 300 pontos é recusado.
- DPI + cm/360 para quem traz a medida de outro jogo; ±1%/±10% para o ajuste fino.
- Entrada crua (`requestPointerLock({ unadjustedMovement: true })`) ligada por padrão: sem a aceleração do Windows, o mesmo gesto gira sempre o mesmo. Se o navegador recusar, cai para o modo normal.
**Escala nova:** 1,00x = 0,0008 rad por ponto (~25 cm por volta a 800 DPI, faixa comum em jogos de tiro); antes era 0,0022 (~9 cm, o "rápido demais"). Quem tinha salvo 1,00x fica ~2,75x mais lento. Aceito: a tela só foi ao ar hoje.
**Custo de CPU:** zero no jogo (a tela só existe com o jogo pausado); uma multiplicação a mais por evento de mouse.
**De quebra:** Esc durante o remapeamento de tecla cancela (nota da revisão cruzada do PR #13).
**Quem decidiu:** dono (pedido); Claude (desenho e escala).

## [2026-09-24] Tela de configurações do Gemini integrada; do PR ao site sem esperar (regra 13)
**Integração:** o Gemini terminou a tela (`ui/SettingsMenu.ts`) e empurrou o branch, mas não abriu PR, então nada chegava ao site. O branch dele saiu da `main` antes da rodada (PR #12), e `Game.ts`, `styles.css` e `ESTADO_ATUAL` conflitaram. O Claude juntou num branch de integração a partir da `main`, preservando o commit e a autoria do Gemini. Nos conflitos ficaram os dois lados; no ESTADO saíram as pendências que já estavam feitas.
**Revisão cruzada (Claude):** aprovada.
- Usa só o contrato, troca teclas em uso, recusa teclas do sistema, sliders seguem os `LIMITS`.
- A janela fica fora da tela de pausa, então clicar nos controles não retoma o jogo (conferido no `index.html`).
- Nota menor: durante o remapeamento, Esc pisca como erro em vez de cancelar.
**Processo (dono: "que as melhorias vão direto para o deploy, para testar em produção"):** regra 13 no `AGENTS.md`. Ao terminar, o agente abre o PR, espera o CI e faz o merge; o merge publica o site sozinho. A revisão cruzada vem depois.
**De quebra (R17):** a regra 12 estava partida ao meio no `AGENTS.md` (um `\n` do caminho do worktree tinha virado quebra de linha); corrigida.
**Quem decidiu:** dono (fluxo); Claude (integração, revisão).

## [2026-09-24] Tela de Configurações (#ux) sobre o contrato core/Settings.ts
**Decisão / Tarefa:** Criar a interface visual da tela de configurações integrada ao `core/Settings.ts`.
**Como funciona:**
- Criado o componente `SettingsMenu` em `client/src/ui/SettingsMenu.ts`.
- Adicionado o botão `[ CONFIGURAÇÕES ]` no overlay de pausa (`#overlay`) e a estrutura do modal `#settings-modal` no `client/index.html`.
- Estilizado no tema terminal/cyberpunk HUD em `client/src/styles.css`.
- **Funcionalidades da UI:**
  - Sliders para Sensibilidade e FOV offset.
  - Checkboxes para Inverter eixo Y e Painel de desempenho.
  - Selects para Qualidade gráfica e Dificuldade dos bots.
  - Remapeamento interativo de 7 teclas com suporte a swap automático entre ações e rejeição de `RESERVED_KEYS` (`Escape`, `F1`, `Backquote`, `Quote`).
  - Botão `[ RESTAURAR PADRÃO ]` que invoca `settings.reset()`.
- **Fiação:** Instanciado `new SettingsMenu(this.settings)` em `client/src/core/Game.ts`.
- **Validação:** `npm run check` 100% verde (typecheck, 45 testes do Vitest, painel, build e smoke).
**Quem implementou:** Gemini.

---

## [2026-09-24] Rodada de 5 min com placar; dois agentes na mesma pasta → worktrees
**Rodada (fecha a Fase 2):**
- `combat/Round.ts` é pura e determinística (só anda no tick fixo; pausa congela o relógio), para o servidor rodar a mesma.
- 5 min valendo abates, 10 s de intervalo com o mundo congelado e o placar na tela, depois rodada nova zerada.
- Placar: mais abates; empate, menos mortes; depois ordem de entrada. Abate vai para quem deu o tiro final.
- Rodada nova: todos voltam inteiros aos pontos de nascimento, depois somem destroços e tiros, depois as barricadas voltam. A ordem evita colisor nascendo dentro de alguém.
- `ui/RoundHud.ts`: relógio e placar (Tab), criados por código e com nomes como texto, nunca HTML (o apelido do jogador vai entrar aí).
- Bots ganharam indicativos (KESTREL, MAKO, VIPER).
- Garantia: testes da rodada, da restauração das barricadas e do `respawnAll`; o jogo sobe com a rodada no smoke e no teste do site.
**Incidente de processo:**
- O Gemini trocou a pasta compartilhada para o branch dele enquanto o Claude tinha trabalho não commitado, e a pasta passou a misturar os dois trabalhos.
- O Claude fez backup, levou o que era dele para um worktree próprio (`.tmp/wt-rodada`) e tirou da pasta compartilhada só os próprios arquivos, depois de conferir que estavam idênticos ao backup (ninguém tinha mexido). O trabalho do Gemini ficou intacto.
- Nova regra 12 no `AGENTS.md`: dois agentes ao mesmo tempo, cada um no seu worktree.
**Quem decidiu:** Claude (rodada e separação), na fase autorizada pelo dono.

## [2026-09-24] Painel de missão vira HUD cyberpunk das antigas
**Pedido do dono:** "parecido com um HUD sci-fi, militar, hacker, estilo Shadowrun, BattleTech, cyberpunk das antigas, que traga estilo e personalidade". Isso substitui, **só nesta página**, o visual do design system Serafim, que tinha sido aplicado a pedido anterior do próprio dono.
**Direção:**
- Visual: terminal de fósforo âmbar dos anos 80/90 com varredura de CRT e vinheta; verde = sistema nominal, vermelho = crítico, ciano = posição atual.
- Fontes: VT323 (display de terminal), Share Tech Mono (leitura), Saira Stencil (carimbo militar), todas do Google Fonts, que a CSP do site já permite.
- Vocabulário militar e decker sobre dado real: rota das fases num mapa hexagonal (mapa de BattleTech); frentes como "sistemas da unidade" com **slots críticos** (um por item) e estado OFFLINE → MAXIMIZADO; próxima missão como "ordem de missão"; PRs como "registro de combate".
**Personalidade com dado real:**
- A ficha técnica do Vector-09 (blindagem por parte, movimento, dash, dano e cadência) é **lida do código do jogo**.
- O carimbo "SEM PAY-TO-WIN" traz os itens do `GAME_DESIGN.md`.
- Se o formato mudar, a seção some em vez de mostrar número errado (R13/R14).
**Quem decidiu:** dono (direção); Claude (execução).

## [2026-09-24] Não é pay-to-win; configurações do jogador; dificuldade aprovada vira a "normal"
**Princípio (dono):** "esse jogo não é pay to win, não está sendo feito para ser p2w, e sim para ser muito bom e todo mundo querer jogar". Virou seção própria no `GAME_DESIGN.md`, com a regra: nada que se compra dá vantagem de combate, e proposta que quebre isso é recusada.
**Dificuldade (dono):** "os inimigos estão com um grau de dificuldade considerável, está bom assim". Os valores atuais viraram a `BOT_SKILL_NORMAL`, padrão das configurações. Fácil e difícil são variações em volta dela, com teste: mesmo cenário e semente, o difícil reage antes e causa mais dano.
**Configurações (dono pediu "mais controles, mais configurações"):**
- `core/Settings.ts` é o contrato entre a futura tela e o jogo: sensibilidade, inverter Y, FOV (±, 1ª e 3ª pessoa), qualidade (automática/alta/média/baixa), dificuldade, painel de desempenho e 7 teclas remapeáveis (Shift/Ctrl/Alt valem dos dois lados; Esc, F1 e ' são do sistema).
- Salvo no `localStorage` do jogador e validado campo a campo (dado de fora, R4). Um navegador que bloqueia o armazenamento não quebra o jogo.
- O `Game` aplica na largada e a cada mudança.
- **Território:** o contrato toca `Quality.ts` (liga/desliga a adaptativa) e `DebugPanel.ts` (visível ou não), mudanças pequenas em território do Gemini, registradas aqui.
- **Divisão:** o Claude fez o contrato e a aplicação; o Gemini faz a tela.
**Garantia:** 7 testes do contrato (incluindo dado corrompido e armazenamento hostil) + teste de dificuldade. O teste do site salva uma configuração, recarrega e confere que ela vale.
**Quem decidiu:** dono (princípio, dificuldade, pedido); Claude (contrato e divisão com o Gemini).

## [2026-09-24] Site no ar; .wasm pré-comprimido; push direto na main passa a ser bloqueado
**Site no ar:**
- O dono autorizou o Claude a configurar tudo sozinho ("pegar os secrets nas outras pastas parecidas; deploya e commita").
- Host, usuário e chave SSH vieram do setup documentado do CAPTIA (mesma conta Hostinger, mesma chave já autorizada no hPanel). Foram direto para o `gh`, sem aparecer em tela nem no repositório.
- Um teste de SSH só leitura confirmou o caminho antes.
- O primeiro deploy (rerun do CI da `main`) passou, e o site foi conferido num Chrome real em produção: painel → Jogar → jogo, sem erros.
**`.wasm` sem compressão:** o LiteSpeed da Hostinger comprime JS, CSS e HTML, mas servia o `.wasm` cru (2,2 MB). O build passou a gerar um `.wasm.gz` (735 KB), servido por regra no `.htaccess` de `jogar/assets/`. A regra foi testada antes numa pasta isolada no servidor: tipo e codificação certos, download descomprimido idêntico byte a byte, pasta apagada depois. O download inicial cai de ~2,4 MB para ~0,9 MB (G11: ≤ 1 MB).
**Achado no teste:** o `selvamkt.com.br` responde 200 com uma página HTML para arquivo inexistente; o `--verify` agora confere o conteúdo, não só o status.
**Push direto na main (processo):**
- O Blind Mode do Gemini entrou por push direto na `main`, sem PR (sem revisão cruzada; publicado no site pelo CI).
- A revisão foi feita depois pelo Claude: código pequeno e correto, dentro do território de UI. Só o `ESTADO_ATUAL` dizia "branch pronto para merge", o que não era verdade (corrigido, R13).
- Para não repetir: o `pre-push` agora recusa push para `refs/heads/main` (testado). O merge pelo GitHub não passa pelo hook, então o fluxo de PR segue igual.
**Quem decidiu:** dono (autorização do deploy); Claude (execução, correção e trava).

---

## [2026-09-24] Blind Mode (#ux): Degradação do HUD com cabeça destruída
**Decisão / Tarefa:** Implementar o Blind Mode quando a cabeça do Mech é destruída (`mech.isBlind` == true).
**Como funciona:**
- Quando a cabeça do Mech do jogador é destruída, o HUD aplica a classe `.blind`.
- **Efeitos no HUD:**
  - A mira (`#crosshair`) ganha tremor contínuo/jitter via animação CSS (`@keyframes jitter`) com cor magenta.
  - A tela ganha uma camada de estática/chiado analógico animado (`#static-noise`).
  - O painel de dados de integridade e estatísticas (`#stats`) é totalmente omitido.
- **Respeito a territórios e regras:** Alterados apenas os arquivos permitidos de UI (`client/src/ui/HUD.ts`, `client/src/styles.css`, `client/index.html`).
- **Verificação:** `npm run check` 100% verde (testes, typecheck, painel, build e smoke).
**Quem implementou:** Gemini.

## [2026-09-23] Site do projeto em selvamkt.com.br/cybermech + o que adotamos das práticas de estúdios AAA
**Decisão do dono:** reunir jogo e painel num site, sem depender de localhost nem de artefatos do claude.ai: caminho `/cybermech` (não `/decepticons`, marca da Hasbro) e **público**, só com o jogo e o painel.
**Como:**
- `npm run site` monta `.tmp/site/`: painel na raiz, com botão "Jogar"; jogo em `/jogar/` (Vite com `base: './'`); `.htaccess` gerado com tipo do `.wasm`, cache e CSP.
- O job `deploy` do CI publica a cada merge na `main` com check verde (o "build do dia" dos estúdios).
- Reaproveita o padrão do CAPTIA, que já publica em `selvamkt.com.br/captia/` na mesma conta Hostinger: rsync/SSH na porta 65002, 5 tentativas, verificação com tolerância a desafio da Cloudflare.
- **Trava a mais:** o job se recusa a rodar se o destino não terminar em `/public_html/cybermech/`, porque o `rsync --delete` com o caminho errado apagaria o site real da Selva MKT.
- Fica dormente até o dono configurar `SITE_URL` e os secrets.
**Garantia:** `npm run site -- --check` (no `npm run check`) serve o site em `/cybermech/` com os mesmos cabeçalhos do `.htaccess` e abre painel → Jogar → jogo no Chrome. Pegou um 404 de favicon antes de ir ao ar.
**Práticas AAA (sugestão do Gemini), filtradas para este projeto:**
- **Já temos:** fonte única da verdade (`.decepticons/` + `ROADMAP`); filtro por disciplina (frentes do painel); tronco estável com branches curtos e CI; revisão de código e testes antes do merge.
- **Adotado agora:** build do dia publicado a cada merge.
- **Viraram ideias no ROADMAP para o dono priorizar:** Issues do GitHub com severidade como rastreador de bugs; teste noturno com bots jogando no headless (a "automação de QA"); dependências entre frentes no painel.
- **Não serve aqui:** Jira, Hansoft, Confluence (seriam uma segunda fonte de verdade para uma equipe de 1 pessoa + agentes); Perforce (não temos binários grandes: a geometria é procedural); ShotGrid e SyncSketch (não há pipeline de arte ainda); Wwise e FMOD (não existem no navegador, o som será Web Audio).
**Quem decidiu:** dono (site, caminho, público); Claude (implementação e o filtro das práticas).

## [2026-09-23] Painel de missão gerado do ROADMAP (frentes + fases, gamificado)
**Pedido do dono:** "muitas frentes pra cuidar (jogabilidade, responsividade, design dos robôs, armas, som, UX, cenários…); quero visualizar esse nosso painel de trabalho", algo gamificado, em fluxograma, para toda a equipe se localizar.
**Decisão:** o painel é **gerado** do `ROADMAP.md`, não desenhado à mão; uma página feita à mão ficaria velha no primeiro PR seguinte (R14).
- O `ROADMAP.md` ganhou a tabela de 11 FRENTES (fonte única das etiquetas), uma etiqueta por item, `[~]` para "em andamento", o marcador `(atual)` na fase em foco e `## 💡 IDEIAS` (propostas sem fase, que o dono prioriza).
- `scripts/painel.mjs` monta a rota das fases (hexágonos, a atual pulsa, clique filtra), um cartão por frente (nível, posto de LATENTE a DOMINADA, anel de progresso, itens), a próxima missão e a equipe (do `ESTADO_ATUAL.md`) e as conquistas (PRs mergeados, via git). Visual: design system Serafim.
- `--check` entrou no `npm run check`: item sem etiqueta, etiqueta desconhecida ou fase `(atual)` ausente reprovam. Todo agente mantém o painel certo sem saber que ele existe.
**Onde ver:** `npm run painel` gera `.tmp/painel/painel.html`. Nada de artefatos do claude.ai (pedido do dono): o painel vai para o site do projeto, junto com o jogo.
**O que o painel já mostrou:** Som, Design dos Mechs e Multiplayer estão em 0%; as ideias sem fase dessas frentes esperam prioridade do dono.
**Quem decidiu:** Claude, a pedido do dono.

## [2026-09-23] Bots v1: IA de inimigos, morte do jogador e pausa que congela o mundo
**Pedido do dono:** "os inimigos ainda não se mexem… faça você" (depois do rascunho do GPT-OSS).
**Como funciona:**
- O `BotController` produz o mesmo `MechInput` do teclado, mais um pedido de tiro. Estados: patrulha → persegue → ataca → recua.
- Visão só com linha de visão: raio da cabeça ao torso do alvo, a 10 Hz, com cone de 110° na patrulha e "audição" a 14 m.
- Tempo de reação, erro de mira sorteado por tiro, antecipação parcial do alvo, giro limitado, tiro em rajadas.
- Levar tiro de quem não via faz o bot virar e ir atrás.
- Tudo lê a simulação (`simPosition`, `simMuzzle`) e o RNG com semente (`core/rng.ts`, extraído do `Arena.ts`, R14): o mesmo cenário dá o mesmo resultado (G2) e o servidor poderá rodar os mesmos bots.
**Decisões:**
- Na v1 os bots só caçam o jogador (em aberto: bots contra bots no modo todos contra todos).
- Renascimento genérico (`Respawner`) para bots e jogador, no ponto mais longe de quem está vivo; os pontos ficam no `Arena.ts` (`SPAWN_POINTS`), e um teste garante que todos estão livres de obstáculos.
- Plasma inimigo em magenta.
- O marcador de acerto só aparece nos tiros do jogador.
- **Pausar congela o mundo:** antes a simulação rodava com o menu aberto; com bots, eles atacariam o jogador pausado.
**Garantia:**
- 8 testes de bot com física real. Quatro defeitos reinseridos foram pegos: yaw invertido (o bug do rascunho do GPT-OSS), sem linha de visão, sem tempo de reação, `Math.random` na mira.
- Playtest no navegador: dano só depois do clique, nenhum erro.
- O dono jogou e aprovou.
**Custo de CPU:** por bot por tick, 1 character controller (como o jogador) + a IA (contas de vetor, sem alocação) + 1 raycast por alvo a 10 Hz. O boot no smoke ficou igual ao da `main` numa comparação A/B (≈7 s).
**Quem decidiu:** Claude, na fase autorizada pelo dono.

## [2026-09-23] Tentativa do GPT-OSS (overlay de desempenho + rascunho de bots) substituída pelo Claude
**O que aconteceu:** o dono pediu ao gpt-oss 120B um overlay de desempenho na tecla `'`. O resultado, não commitado, no branch `gemini/inimigos-bots`:
- **Quebrou a mira:** um bloco de CSS sem seletor em `styles.css` fez o navegador descartar a regra seguinte inteira (`#crosshair`). Confirmado no navegador: position static, largura de 1280 px. O build de produção nem compilava (`lightningcss`).
- **A tecla não funcionava no teclado do dono:** o jogo lê `e.code` (posição física). No ABNT2 o `'` é `Backquote`; o GPT-OSS trocou para `Quote`, que no ABNT2 é a tecla `~`.
- Duas métricas saíam `undefined` (não existem no three r186); overlay em tela cheia com blur (custo de GPU que distorce o próprio FPS medido); `innerHTML` a cada frame; webfont Inter do Google (contra o IDENTITY, e não é do design system Serafim, embora dissesse que era).
- Marcou a Fase 2 como feita no `ESTADO_ATUAL` sem estar (R13). Nunca rodou o `npm run check`.
**Decisão (Claude):** tudo guardado no `stash@{0}`, sem perda. O overlay foi refeito como modo detalhado do `DebugPanel` que já existia, em vez de um segundo módulo que mostrava as mesmas métricas:
- tecla `Backquote` ou `Quote` (cobre ABNT2 e US), com `preventDefault` no `Quote` por causa da busca rápida do Firefox;
- métricas reais do `renderer.info`, texto 5×/s, sem blur;
- tokens do design system Serafim no escopo do painel, sem webfont.
**Garantia:** o smoke agora testa as duas teclas (abrir e fechar) e se a mira tem estilo. Com o bug do GPT-OSS reinserido, o smoke reprovou "tecla Backquote não abriu"; o CSS dele já é reprovado pelo build.
**Regra reforçada no AGENTS.md:** nunca dizer que está pronto sem `npm run check`, porque o `npm run dev` aceita código que o build rejeita.
**Quem decidiu:** Claude, a pedido do dono ("tentei mexer pelo GPT-OSS mas acho que ele deu uma cagada").

## [2026-09-23] Combate v1 mergeado (PR #3); dono jogou e confirmou; bastão passa ao Gemini para a Fase 2
**Fato:** o dono jogou a build com o combate (não só o playtest automatizado) e confirmou que está bom ("tô jogando e tá bem legal"). R16 satisfeito por prova real do jogador, o padrão mais forte que o Protocolo pede.
**Decisão:** o dono pediu explicitamente para o Gemini fazer a Fase 2 (bots/inimigos) agora. O Claude encerra a sessão aqui em vez de começar essa fase, para não deixar trabalho pela metade entre duas sessões de agentes diferentes — a especificação completa da tarefa foi escrita em "PASSAGEM DE BASTÃO" no `ESTADO_ATUAL.md`, para o Gemini não precisar reconstruir contexto.
**Modelo recomendado ao Gemini:** Gemini Flash para a implementação (código + testes + loop de ferramentas, igual ao que já funcionou em G12/painel de debug); gpt-oss 120B reservado para discussão de design mais aberta, se o dono quiser antes de implementar.
**Quem decidiu:** dono (pedido de handoff); Claude (registro e especificação da tarefa).

## [2026-09-23] Combate v1: dano por parte, alvos de treino, morte e respawn; o tiro atravessa destroços
**Decisão:** o dano por parte sai do ponto do impacto na cápsula que já existe (altura e lado no referencial do Mech), sem colisor por parte. Custo de física zero.
- Dano em parte destruída vai para o torso; torso zerado = morte.
- A regra fica em `combat/damage.ts` (pura, pronta para `shared/`); o `CombatSystem` só roteia o impacto e cuida dos efeitos de mundo.
**Tiro × destroços (estava em aberto):** todo raycast de jogo (tiro, mira, câmera) ignora corpos dinâmicos. É a opção mais simples, coerente com "destroços são só cosméticos" (regra do dono), e o servidor não terá destroços. Perdeu-se o empurrão do tiro nos destroços; os foguetes vão devolver isso com a explosão.
**Garantia:** 24 testes. Duas mutações (ignorar a rotação do alvo; deixar o raycast ver destroços) foram pegas pelos testes certos. O playtest automatizado no navegador viu "PERNA ESQ DESTRUÍDA → ALVO ABATIDO", e o dono jogou.
**Custo conhecido:** cada Mech custa ~34 draw calls; os 3 alvos somam ~100. Otimizar antes do multiplayer.
**Quem decidiu:** Claude (implementação), dentro da fase autorizada pelo dono.

## [2026-09-23] Nova ordem: combate → inimigos → multiplayer; merge autorizado ao Claude nesta fase
**Decisão (dono):** o roadmap passa a ser Fase 1 Combate, Fase 2 Inimigos (bots), Fase 3 Multiplayer, Fase 4 Lançamento, Fase 5 Monetização.
**Motivo:** o jogo fica divertido sozinho antes do servidor; dá para fazer live contra bots; o diferencial (dano por parte) é validado cedo; os bots geram o mesmo `MechInput` do jogador, então o servidor vai reaproveitá-los para completar salas. Nada é jogado fora.
**Processo:** o dono autorizou o Claude a mergear PRs com CI verde para seguir o combate e os inimigos. A revisão cruzada passa a ser pós-merge quando o outro agente estiver indisponível (Codex sem crédito até 24/09).
**Quem decidiu:** dono.

## [2026-09-23] Integração do trabalho do Gemini + brechas do protocolo para vários agentes
**Contexto:** o Gemini entregou qualidade adaptativa (G12), painel de debug e HUD que some com F1, em 2 branches locais. Um deles saiu da `main` sem o PR #1, e 8 arquivos de cache de `.tmp/` entraram no commit. Ele assinou como "Codex".
**Feito pelo Claude:** os 2 commits foram reaplicados sobre a `main`, sem os temporários e com a assinatura corrigida. A revisão cruzada achou 3 bugs, todos corrigidos:
- o degrau 1 da qualidade não reduzia a resolução do `EffectComposer`;
- o `DRAWS` do painel mostrava 1, porque o `renderer.info` é zerado a cada passada;
- F1 abria a Ajuda do navegador.
O smoke passou a reprovar menos de 10 draw calls, e comprovadamente reprovava a versão antiga.
**Brechas fechadas:** o protocolo vale para qualquer agente, com prefixo e assinatura pelo nome real (`AGENTS.md`); branch sempre a partir da `main` atualizada; `GEMINI.md` importa o `AGENTS.md`; o `pre-commit` barra `.tmp/`, `dist/` e `node_modules/` mesmo com `.gitignore` desatualizado.
**Quem decidiu:** Claude (revisão e integração), com o trabalho de feature do Gemini.

## [2026-09-23] Painel de Debug Desacoplado & HUD Toggle
**Decisão:** o painel de debug (FPS, Tick Time, Draw Calls) foi extraído para um módulo independente (`DebugPanel`) fora do contexto do HUD principal. Para fins de *streamer mode*, a tecla `F1` foi definida no loop global para adicionar a classe `.hidden` apenas no HUD (`display: none`), permitindo que a UI de gameplay suma enquanto as métricas técnicas podem continuar sendo validadas.
**Por que importa:** possibilita jogar a build para lives/vídeos com a tela limpa, sem perder acesso imediato à instrumentação técnica.
**Quem decidiu:** Gemini (assinou como "Codex" porque o protocolo só previa Claude e Codex; corrigido pelo Claude na integração), cruzando com a necessidade de separar DOM da simulação no G3.


## [2026-09-23] Qualidade adaptativa e degraus de degradação (G12)
**Decisão:** implementada a classe `Quality` para medir o tempo de frame. Se cair de 50 FPS na média de 2 segundos, degrada a qualidade primeiro reduzindo o `pixelRatio` para 1.0 e depois desligando o `UnrealBloomPass`. A qualidade não é restaurada se o FPS voltar a subir, para evitar flutuações irritantes.
**Por que importa:** G12 exige a proteção para rodar em hardware fraco (integrated GPU).
**Quem decidiu:** Gemini (assinou como "Codex"; corrigido pelo Claude na integração), com base nas restrições de G12. Testes garantiram que pequenas perdas não disparam falsos positivos, e que o tier é mantido.


## [2026-09-23] Conta do GitHub renomeada: Remoratrader → SerafimWeb
**Fato:** ao abrir o primeiro PR, o GitHub devolveu `SerafimWeb/decepticons`. O token do `gh` autentica como `SerafimWeb` (usuário, não organização): a conta foi renomeada. O `gh auth status` ainda mostrava o nome antigo, guardado no login.
**Feito:** `origin` → `https://github.com/SerafimWeb/decepticons.git`; `AGENTS.md`, `IDENTITY.md` e `ESTADO_ATUAL.md` atualizados. A entrada "Repositório: mesma conta GitHub do serafim13" continua válida: mesma conta, nome novo.
**Por que importa:** o GitHub redireciona o nome antigo só enquanto ninguém registrar "Remoratrader". O remote do serafim13 ainda usa o nome antigo; fica sinalizado para uma sessão daquele projeto (R17: não editar outro repositório daqui).

## [2026-09-23] Projeto autocontido: nada fora da pasta do projeto (G15)
**Decisão (regra do dono):** temporários e qualquer outro arquivo do projeto ficam só dentro da pasta do projeto. Nada no temp do sistema, em outras pastas ou em outro drive.
**Aplicado:**
- `.tmp/` na raiz, ignorada pelo git, é o único lugar para temporários.
- O `scripts/smoke.mjs` aponta o temp do Playwright e do Chrome para `.tmp/smoke/`, zerada a cada execução.
- O Vitest gravava os módulos transformados no temp do Windows e deixava sobras: o `npm test` agora roda por `scripts/test.mjs`, com o temp em `.tmp/vitest/`.
- **Verificado:** comparando nome por nome o temp do Windows antes e depois de um `npm run check` completo, nenhum item novo.
- Limpeza do que o Claude tinha deixado fora nesta sessão: snapshot inicial, scripts de experimento, captura de tela, repositório de teste dos hooks, 1 sobra do Chrome e 13 sobras do Vitest (identificadas pelo conteúdo: código deste projeto).
- Não mexido: resíduos do Playwright de 12/09 e `scoped_dir*` do Chrome de uso normal, que são anteriores a este projeto.
**Fora do controle, conhecido:** cache global do npm, `~/.claude` (sessões e memória do Claude Code), configuração do git/gh.
**Quem decidiu:** dono.

## [2026-09-23] Desenvolvimento com dois agentes: Claude + Codex
**Decisão:** o dono vai desenvolver partes do projeto com o Claude (Claude Code) e partes com o Codex, os dois sob o Protocolo Serafim UM.
**Como:**
- `AGENTS.md` (lido pelo Codex) é a fonte única de instruções; o `CLAUDE.md` só importa ele (`@AGENTS.md`), para as regras não divergirem (R14).
- Cópia de referência do protocolo em `.decepticons/PROTOCOLO_SERAFIM_UM.md`, porque um agente na nuvem só enxerga o repositório.
- Um branch por tarefa (`claude/…`, `codex/…`), PR com CI verde, revisão cruzada entre os agentes, merge pelo dono.
- Território de arquivos por agente no `ESTADO_ATUAL.md`; contrato (`shared/`) antes de paralelizar.
**Motivo:** cada agente tem pontos fortes, mas dois agentes sem regra comum desfazem o trabalho um do outro. A revisão cruzada também resolve o AP-5 (IA revisando o próprio código).
**Limite conhecido:** repositório privado no plano gratuito do GitHub não trava a `main` por regra de proteção. A disciplina é do processo (agentes + CI), não do GitHub.
**Quem decidiu:** dono (divisão proposta pelo Claude; o dono pode redistribuir).

## [2026-09-23] Game design v1, viralização e princípios de arquitetura
**Decisão:** o dono aceitou todos os padrões da sessão de definição: 8 por sala, todos contra todos com rodadas de 5 min, entrada livre sem lobby, convidado com apelido, só desktop, portal primeiro, diferencial = destruição + dano por parte. Receita: combinar os modelos para viralizar (link de sala → modo streamer, porque o dono vai fazer lives → portal com anúncio só entre rodadas → cosméticos sem vantagem de combate). Detalhes em `GAME_DESIGN.md`.
**Princípios pedidos pelo dono:** economia de dados, requisitos baixos, leveza, resiliência, código estratégico. Viraram as regras mensuráveis G11–G14 em `PROTOCOLO_UNIVERSAL.md` (ex.: ≤ 8 KB/s de download por jogador, estado a 20 Hz, tick do servidor ≤ 2 ms).
**Quem decidiu:** dono.

## [2026-09-23] Correção do engasgo na corrida (contorno de imprecisão do Rapier)
**Sintoma:** correndo em chão plano, o Mech parava a 0 m/s por 1 tick, ~1 vez a cada 2 s. O `MechBase` zerava a velocidade sempre que o movimento saía menor que o pedido, então levava ~10 ticks para reacelerar. O dono confirmou jogando.
**Causa (medida):** a margem (`offset`) de 5 cm entre a cápsula e o chão vai erodindo por imprecisão numérica da consulta cápsula × caixa. Quando um tick começa dentro da margem com a gravidade empurrando para baixo, a primeira colisão vem com `toi = 0` e o controller devolve movimento zero. Não depende da forma do chão (caixa, trimesh e heightfield travam igual) nem de ajuste de config (autostep, snap, offset, nudge).
**Decisão:** (1) só nesse tick (menos de 1 por segundo) o movimento é refeito tangente ao chão e 2 mm afastado dele (`unstickFromGround`); (2) a velocidade só perde a parte que entra em parede ou teto, e chão ou rampa nunca freiam a horizontal. Custo de CPU: uma chamada extra ao controller nos ticks raros.
**Resultado:** 0 travadas; velocidade média de 13,6 → 16,0 m/s; rampa, parede, deslize, barricada, degrau e teto iguais ao original; descida da rampa sem quicar.
**Descartado:** "não empurrar no chão" (afundava até 55 cm), reparo da margem por raio (quicava na rampa), forma de chão diferente (não resolve).
**Garantia:** `client/src/entities/MechBase.test.ts` (Vitest), comprovado reprovando a lógica antiga (tick 56: 0,000 m). Entrou no `npm run check`.
**Sobra conhecida (já existia):** o Rapier às vezes solta o chão por 1–2 ticks (pulinho de ~10 cm, ~5 vezes por minuto). Imperceptível; se incomodar, "coyote time" resolve na animação.

## [2026-09-23] Repositório: mesma conta GitHub do serafim13
**Decisão:** o código vai para a conta `Remoratrader` no GitHub, em **repositório próprio** (R9: isolamento entre projetos), privado. O CI (`.github/workflows/ci.yml`) roda `npm run check` em todo push e PR.
**Quem decidiu:** dono. A criação do repositório e o primeiro push aguardam confirmação.

## [2026-09-23] Destroços são só cosméticos para o movimento
**Decisão:** o character controller do Mech ignora corpos dinâmicos (`QueryFilterFlags.EXCLUDE_DYNAMIC`). O corpo cinemático do Mech continua empurrando os destroços no `world.step()`. O stat `mass` foi removido, porque ficou sem efeito (corpo cinemático empurra como massa infinita).
**Motivo:** o dono pediu "o mais simples possível". Destroços são aleatórios e cada cliente teria os seus; se bloqueassem o Mech, a prediction divergiria do servidor. Custo de rede zero.
**Prova:** num teste no Node com Rapier 0.20, a trajetória do Mech ficou idêntica com e sem destroço no caminho, e o destroço foi empurrado.
**Em aberto para a Fase 1:** projéteis ainda param em destroços (e os empurram). No multiplayer o servidor não terá destroços; decidir se o tiro passa a atravessá-los.
**Quem decidiu:** dono.

## [2026-09-23] Validação de input de rede sem Zod no caminho quente
**Decisão:** o servidor vai validar `MechInput` com uma função manual sem alocação (`Number.isFinite`, clamp, booleanos estritos). Zod fica permitido só em caminho frio (opções de entrada na sala, autenticação).
**Motivo:** o `MechInput` chega a 60 Hz por jogador. Com muitos jogadores, a alocação por parse do Zod vira custo de CPU e de GC, o que contraria a regra de performance primeiro. É um desvio consciente de R4.
**Alternativas descartadas:** Zod em toda mensagem; confiar no cliente.
**Quem decidiu:** sessão de setup (IA), pendente de confirmação do dono ao implementar o servidor.

## [2026-09-23] `noUncheckedIndexedAccess` avaliado e recusado
**Decisão:** não ativar.
**Motivo:** gerou 33 erros, a maioria em loops numéricos sobre typed arrays (`ParticleSystem`, `DebrisSystem`) onde o índice é garantido pelo próprio loop. Encher de `!` pioraria a leitura sem ganho real.
**Reavaliar:** ao criar `shared/` e `server/`, onde há dados vindos de fora.

## [2026-09-23] Watchdog (Skill 23) não instalado
**Decisão:** não usar `WATCHDOG.tsx`.
**Motivo:** é um componente React, e o projeto é TypeScript puro + Three.js. Trazer React só para isso pesaria o bundle e o frame. O equivalente planejado é um painel de debug leve em TS puro (tempo de tick, corpos acordados, draw calls), na Fase 2 do roadmap.

## [2026-09-23] Smoke test em browser real + budget automatizado
**Decisão:** `scripts/smoke.mjs` (playwright-core, sem baixar browser) sobe o build no Chrome/Edge headless, espera a física inicializar e o loop rodar, e reprova em qualquer erro de console ou em estouro de budget. `npm run check` = typecheck + build + smoke; o hook `pre-push` roda o check.
**Motivo:** R15 e R7 viram checagem automática, não só texto. Typecheck sozinho não pega falha de carregamento do Wasm nem de WebGL.
**Budgets:** JS ≤ 500 KB gzip (Protocolo); Wasm ≤ 900 KB gzip. O limite de Wasm é próprio porque o motor de física é um asset binário que baixa em paralelo, compila em streaming e fica em cache separado do JS.

## [2026-09-23] Rapier com `.wasm` separado no browser
**Decisão:** o código continua importando `@dimforge/rapier3d-simd-compat`; o `vite.config.ts` faz alias para `@dimforge/rapier3d-simd` no build do browser (com `vite-plugin-wasm`). As duas versões ficam fixadas iguais (0.20.0).
**Motivo:** o pacote compat embute o Wasm em base64 dentro do JS: bundle de 1.182 KB gzip, 2,4× o budget. Com `.wasm` separado, o JS caiu para 182 KB gzip e o Wasm (719 KB gzip) passa a ser compilado em streaming. Manter o import compat no código deixa a mesma simulação rodar no Node (servidor e testes) sem flags.
**Consequência:** o pacote de browser não tem `init()` (inicializa via top-level await); `PhysicsWorld.create` chama `RAPIER.init?.()`. Atualizar o Rapier = atualizar os dois pacotes juntos.
**Alternativas descartadas:** trocar o import em todo o código (o servidor Node precisaria de `--experimental-wasm-modules`); só code-splitting (não reduz bytes).

## [2026-09-23] Protocolo Serafim UM v4.2 aplicado
**Decisão:** memória em `.decepticons/`, `CLAUDE.md` na raiz, repositório git (`main`), hooks versionados em `.githooks/` ativados pelo `npm install` (`prepare` → `scripts/install-hooks.mjs`).
**Detalhes:** o `pre-commit` segue a versão estrita do Protocolo (M5: sem ESTADO_ATUAL atualizado, sem commit) e bloqueia arquivos e formatos de secret. O `pre-push` roda o smoke (R15). O `.gitattributes` força LF nos hooks.
**Motivo:** o projeto nasceu nesta data sem git, sem memória e sem checagem automática.
**Achados corrigidos junto (R17):** (1) o `DebrisSystem`, no teto de 240 peças, apagava as peças recém-criadas em vez das mais antigas: uma quebra nova deixava 2 de 24 destroços. Agora a evicção usa a ordem de criação. (2) O `Destructibles` criava uma `EdgesGeometry` por barricada e nunca liberava da GPU; agora usa uma geometria compartilhada e escalada.

## [2026-09-23] Decisões de fundação (registro retroativo)
> Tomadas na sessão que criou o protótipo, antes de existir este histórico. Reconstruídas a partir do README e do código.

**Stack:** Vite + TypeScript + Three.js + Rapier3D SIMD. Servidor futuro: Colyseus.
**Mech = cápsula cinemática + `KinematicCharacterController`**, não rigid body dinâmico: barato, previsível e reaproveitável no servidor.
**Simulação em passo fixo de 60 Hz** com render interpolado; no máximo 4 ticks por frame.
**Destroços:** colisor estático enquanto a estrutura está inteira, até 24 peças dinâmicas que dormem ao parar, 1 `InstancedMesh`, teto global de 240.
**Multiplayer planejado:** só o Mech local roda o controller (prediction); os remotos interpolam snapshots.
