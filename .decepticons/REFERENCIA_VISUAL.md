# REFERÊNCIA VISUAL — o que o MechArena nos mostra

> **Leitura por data:** as tabelas das seções 3–4 são o retrato de 07/10, não o inventário atual. Atmosfera, sombras de contato, janelas e caudas de tiro já receberam entregas. Para a referência de 13/10 e o próximo corte, ver §7; estado de funcionalidades em `STATUS_REAL.md`.

> Pedido do dono (07/10/2026): ele gravou a tela do MechArena rodando e pediu que o projeto olhasse "a qualidade
> que eles chegaram: gráficos, jogabilidade, armas, cenários". Este arquivo guarda o que foi visto, o que serve para
> o CYBERMECH e o que não serve. Quem for mexer em visual, efeito, HUD ou cenário lê isto antes (Passo Zero, item 11).
> O dono traz mais referências quando o agente pedir; cada uma ganha uma seção aqui.

> **Checkpoint de qualidade (16/10, P170):** as explosões e os efeitos de tiro têm um ponto aprovado pelo Comandante que **não pode piorar**: `CHECKPOINTS.md` (tag `checkpoint/explosoes-v1`, a bancada `medicoes/explosoes.mjs` e a captura de referência).

## 1. Decisão do dono (07/10/2026)

1. **Primeiro, elevar a qualidade dentro do estilo atual** (low-poly neon "Tron", hard-surface em blocos, tudo em código,
   `ESTILO_ROBOS.md`). Não é uma troca de direção de arte.
2. **Depois, evoluir** (modelos mais ricos, texturas, outro tipo de cenário) quando o estilo atual estiver bem resolvido.
   Esta evolução fica aberta: a `VISAO.md` continua valendo ("não é AAA gráfico, visual estilizado e coerente"), e só o
   dono a altera.
3. Cada entrega visual segue R16 (captura em `arte/` e o caminho para ver no site) e G12 (custo de GPU medido, GPU
   integrada como piso).

## 2. O material e o que ele não mostra

| Arquivo (pasta do dono) | O que mostra | Pranchas no repositório |
|---|---|---|
| `Gravando 2026-10-07 210317.mp4` (12 s) | hangar com pódio de MVP numa base lunar; começo de partida 5×5 na cidade neon | `referencias/mecharena/gravando-210317-*.jpg` |
| `mech2.mp4` (22 s) | a cidade neon em combate: foguetes, explosões, rastro de tiro, painel "Your Killer" | `referencias/mecharena/mech2-*.jpg` |
| `mech3.mp4` (13 s) | mapa lunar com pontos de controle A–E, dash com desfoque, feixes de captura | `referencias/mecharena/mech3-*.jpg` |

- Os vídeos ficam em **`.tmp/referencias/mecharena/`** (G15; fora do git, só nesta máquina). A cópia original do dono está em
  `F:\MUSICAS CYBERMECH\mecharenaexemplos\`. No git entram só as **pranchas**: 4 quadros por imagem, 8 por vídeo.
- **Limite do que foi visto:** são gravações do player do YouTube (a barra de tempo aparece em alguns quadros), com
  compressão, e foram analisadas **por 24 quadros**, não em movimento nem com som. Jogabilidade (sensação do tiro, do dash,
  do ritmo) só foi inferida pelo HUD e pelos efeitos. Para julgar isso o agente pede ao dono um trecho mais longo ou a
  descrição do que ele sente.
- O contador no canto dos vídeos marca 107–121 fps e 53 ms de ping: o jogo deles roda folgado na máquina da gravação.

## 3. O que eles fazem e o que isso pede de nós

| Aspecto | O que se vê | Onde estamos (capturas em `arte/`, Chrome headless) | Dentro do estilo atual |
|---|---|---|---|
| **Atmosfera** | cor dominante por mapa (turquesa na cidade, cinza e laranja na lua), luz que modela os volumes, névoa colorida que afasta o fundo, céu com cidade ou planeta, sombra suave sob os robôs | a cena **já tem** luz hemisférica + 2 direcionais, névoa, tone mapping ACES, mapa de ambiente (intensidade 0,25) e bloom (`Arena.ts`, `Game.ts`). O que falta é cor e profundidade: céu `0x04050b`, névoa `0x070912` e chão `0x05070b` são quase pretos, então o mundo se dissolve em preto, e as torres do horizonte são silhuetas pretas sobre céu preto (só as faixas neon aparecem); céu de cor única, sem brilho no horizonte; sem sombra de qualquer tipo. (Antialias já existe: o render target do composer é MSAA 4×; o `antialias: false` do renderer vale só para o framebuffer padrão.) | **sim, primeiro:** céu em degradê com brilho no horizonte (as torres viram silhuetas legíveis), névoa colorida, chão com textura; **depois:** sombra suave sob os robôs (disco instanciado, sem mapa de sombra). Sem luz nova: ajustar as que já existem |
| **Chão e superfícies** | chão com textura, juntas, marcas de uso, faixas de pista | plano de cor única com a grade ciano por cima; prédios e torres em um tom de aço liso, sem janelas | **sim:** uma textura tileável pequena (ou gerada em canvas) e janelas emissivas nos prédios, sem draw call novo |
| **Cenário** | contêineres, rampas, túneis, letreiros, rochas, cabos, escadas; nada é um bloco liso | prédios-caixa com linhas de neon, 6 barricadas | **sim:** adereços instanciados (um `InstancedMesh` por tipo), letreiros emissivos, mesmo vocabulário de caixas |
| **Efeitos** | rastro de tiro com cauda, bola de fogo com faíscas, anel de choque, desfoque no dash, feixe de luz no objetivo, números de dano flutuando | partículas (pool de 3000), bloom e tremor de câmera existem; o foguete deixa fumaça; **rastro com cauda só no canhão de trilho** (`tracer: 'rail'` em `ProjectileSystem.ts`); plasma e blaster são só o ponto brilhante; no dash só o FOV abre; não achei anel de choque no código | **sim, em seguida:** cauda curta no plasma e no blaster, anel de choque na explosão (geometria fina instanciada), desfoque de dash só em qualidade alta |
| **Leitura de combate** | nome + barra + distância sobre o inimigo, "RELOADING" sob a mira, minimapa hexagonal, kill feed com ícones, habilidade com anel de recarga e tecla, painel de quem te matou | nomes sobre a cabeça, painel do alvo com 6 partes e calor, setas de borda, HUD de terminal | **parcial:** barra e distância no nome, anel de recarga, kill feed; o painel do alvo já passa deles em informação |
| **Robôs** | silhueta e paleta próprias por chassi, materiais misturados (metal, borracha, faixa emissiva), armas visíveis e grandes | caixas de cor chapada, faixas emissivas, 6 partes legíveis | **limitado pelo estilo** (`ESTILO_ROBOS.md`: sem greeble). O ganho possível é de luz e material (chanfro, cor por peça, emissivo), não de detalhe miúdo |
| **Desempenho** | ver a seção 4 | meta G12 (GPU integrada), 9 draw calls por Mech | todo item acima declara custo antes de entrar |

**Fora do estilo atual (fica para a evolução, decisão do dono):** modelos de malha detalhada para todos os robôs
(já temos 4 `.glb`), texturas PBR com mapa de normais, sombra dinâmica em todo o mapa, mapa lunar como segundo cenário
completo.

## 4. Como jogos assim rodam em máquina fraca

> **Aviso:** é a prática geral de jogos de arena para celular e PC modesto, **não** a engenharia do MechArena ou do War
> Robots, a que não temos acesso. Serve de lista de técnicas a testar, cada uma medida aqui antes de valer.

| Técnica | Em uma frase | CYBERMECH hoje |
|---|---|---|
| Luz pré-calculada | a sombra e a oclusão do mapa são "assadas" na textura ou na cor dos vértices; em jogo quase não há luz dinâmica | **não usa:** há luzes e mapa de ambiente, mas nada de sombra nem oclusão assada; candidato direto (cor de vértice custa zero em tempo de jogo) |
| Sombra só onde conta | sombra projetada sob os robôs (disco ou projeção plana), mapa com sombra assada | **não usa** (`SPECS_Render.md`: sombra em tempo real, prioridade baixa) |
| Poucos materiais e draw calls | atlas de textura, instanciamento, malhas combinadas | **usa:** `InstancedMesh`, 9 malhas por Mech |
| Mapas fechados e culling | mapa pequeno com muita parede, o que está fora da vista não é desenhado | parcial (arena única e pequena) |
| LOD | modelo mais simples à distância | **não usa** |
| Partículas em folha de sprites | explosão e fumaça são imagens animadas, num pool | pool de 3000 partículas sim; folha de sprites não |
| Pós-processamento mínimo | bloom barato e correção de cor por tom fixo | bloom sim, desligado pela qualidade adaptativa |
| Resolução dinâmica | baixa a resolução antes de perder fluidez | **usa** (G12) |
| Rede enxuta | servidor autoritativo, estado a ~20 Hz quantizado, predição no cliente, **compensação de latência** | usa tudo, **exceto a compensação de latência** (AUSENTE em `STATUS_REAL.md`); interest management é futuro |

Sobre "internet ruim": o que faz um jogo parecer bom com ping alto é a **predição do próprio movimento** (já temos, o
Mech responde na hora e o servidor corrige) e a **compensação de latência no tiro** (acertar o que se viu na tela).
Esta última não existe aqui e é a maior diferença de sensação online; o projeto está em `FINDINGS.md`, seção M5.

## 5. Ordem de ataque combinada (dentro do estilo atual)

1. **Atmosfera:** céu em degradê com brilho no horizonte, névoa colorida, chão com textura; depois, sombra suave sob os
   robôs (disco instanciado). As luzes, o mapa de ambiente e o antialias já existem; o ganho está em cor e profundidade.
   Maior efeito por menor custo.
2. **Cenário:** adereços instanciados e letreiros, para o mapa deixar de ser "caixas no escuro".
3. **Efeitos:** rastro de tiro, anel de choque, fogo com mais corpo, desfoque de dash em qualidade alta. **Feito em 16/10 (P160, Claude), menos o
   desfoque de dash:** rastro em fita contínua (fumaça e fogo do motor), explosão com bola de fogo low-poly, fumaça escura, estilhaço, onda de choque
   e queimado no chão, clarão e brilho por família de arma, marcas na parede e o raio do trilho (`ARSENAL.md`, "A cara de cada tiro").
4. **Leitura:** barra e distância no nome, anel de recarga das habilidades, kill feed.
5. **Material dos robôs:** luz e cor por peça dentro das regras de `ESTILO_ROBOS.md`.

Acompanhamento no `ROADMAP.md` (frente `#cenarios`); estado real de cada passo em `STATUS_REAL.md`.

## 6. Segunda rodada (13/10/2026): oito quadros do MechArena em partida (ordem P109)

> O Comandante assistiu a gameplays do MechArena e mandou oito quadros (pranchas em `referencias/mecharena/gameplay-13-10-*.jpg`): "os caras
> evoluíram MUITO a interface, os gráficos, layout e jogabilidade... está muito bom! porém, pay to win... quero evoluir nosso cybermech pra
> ficar ainda mais bonito, melhor de jogar, mais interessante e gostoso de ficar horas na nossa arena". **Mesmo limite da seção 2:** são
> quadros de um vídeo de 33 min do YouTube (a barra do player aparece em alguns), **não movimento nem som**; a sensação do tiro, do dash e do
> ritmo segue inferida. A decisão de 07/10 continua de pé: **elevar dentro do estilo neon** antes de trocar de direção de arte.

### 6.1 O que os quadros mostram, elemento por elemento, e onde estamos

| Elemento | O que o MechArena faz (quadros) | CYBERMECH em 13/10 | Decisão |
|---|---|---|---|
| **Minimapa** (1, 2, 4, 6) | Canto de cima à esquerda, em hexágono ou círculo: inimigos em vermelho, aliados em azul, e as letras A–E no modo de pontos | Só no console de início (1 Hz, norte fixo); **na partida, nada** | **Feito:** `ui/Minimapa.ts`, de frente-para-cima, 75 m, 12 Hz, paredes, zonas e pontos presos na borda para dar a direção |
| **Vida de relance** (1, 2, 4, 6) | Barra larga embaixo no centro, número grande, camada de escudo, retrato do piloto, três abas de habilidade | Seis barras de texto (`█░`) no canto de cima e três medidores miúdos no centro, **sobrepostos** (`ATQ 2 ·` em cima de `FOGUETES`) | **Feito:** `ui/Vitals.ts`, a barra é o **torso** (decide a morte) com o número, âmbar abaixo de 50% e vermelho pulsando abaixo de 25%, e as outras cinco partes em pílulas. **Falta:** retrato do piloto e a camada do escudo de energia |
| **Cartões de arma** (1, 2, 4, 6) | Um por clique, com a tecla de recarga, a munição ou a carga, e "RELOADING" ao lado da mira, por arma | O carregador de foguetes e o calor; **o nome da arma do Ataque 1 não aparecia em lugar nenhum** | **Feito em parte:** cartões ATAQUE 1 e 2 com nome e nível (MK), carregador e calor; acendem com o gatilho apertado. **Falta:** "RECARREGANDO" ao lado da mira |
| **Anéis de dash e de habilidade** (1, 2, 4, 6, 8) | Anéis com a contagem regressiva e a tecla | Barra horizontal "DASH" | **Feito:** anel do dash que enche e acende. O anel do módulo/escudo fica para a frente 2 |
| **Plaqueta no inimigo** (1, 2, 4, 6, 8) | Nome, barra de vida, ícones de módulo e **distância** ("35m"); colchetes vermelhos na mira | Nome e personalidade, sem barra e sem distância; o painel do alvo (seis partes) fica à direita | **Frente 2** |
| **Números de dano flutuantes** (2, 4, 6) | "2.8k", "3.8k", "90.1k" sobem do alvo; "×6" é o combo | O marcador na mira e o som | **Frente 2.** Custo: pool de até ~24 nós, só os vivos |
| **Kill feed** (1, 6) | Três linhas no canto de cima à direita, com o ícone da arma | Existe (`KillFeed`), sem ícone de arma | **Frente 2** (baixo custo) |
| **Escolha de robô e de ponto de nascimento** (3) | Três robôs do esquadrão em cartões (os já usados, riscados em vermelho) e o mapa com os pontos: "Select a Mech and a Spawn Point" | Renasce no mesmo lugar, com texto de contagem | **Frente 3** |
| **"Seu algoz"** (5) | Painel de quem te matou: nome, robô e vida, as armas com o dano, os quatro módulos; "Deploying in… 3" | Câmera de abate offline (segue o bot que matou) e "RENASCENDO EM 3.2 s" | **Frente 3.** É a P98 (killcam) com a ficha do matador; o dado já existe (o `Round` sabe quem matou, a montagem do bot é conhecida) |
| **Modo de pontos de controle** (4, 6) | Cinco pontos A–E, dois times, placar por posse (86 × 88), relógio no topo | Deathmatch, Sobrevivência e CTF (treino offline) | **Frente 5.** É o modo principal deles e o que faz o mapa inteiro virar alvo. Pede regra no `Match` e `OBJECTIVE_STATE` na rede, sem arte nova |
| **Ficha da arma no Hangar** (7) | Poder, Dano, Alcance ótimo, Recarga, nível e estrelas, "Equipar" | Lista por classe; a ficha completa mora na landing e na oficina | Dano, alcance ótimo e recarga na própria lista (frente 5). **Não copiar:** Poder e estrelas |
| **Cenário e cor** (1, 2, 4, 6, 8) | Ambientes **fechados e coloridos**: painéis amarelo, azul e vermelho, tijolo, letreiros, lanternas, jardineiras; chão com marcas; luz que modela os volumes; sombra suave sob os robôs | Arena aberta de 200 m, escura, com contorno neon; o Bunker é fechado mas quase monocromático. A atmosfera (07/10), a sombra de contato (08/10), as janelas e a cauda do tiro já entraram | **Frente 4:** cobertura (contêineres, rampas, muretas) e cor por zona, sem sombra dinâmica |

### 6.2 O que NÃO copiar

- **Potência e estrelas que sobem com dinheiro** ("Power Rating 1753", "Lvl. 4 ★★★★★★", "Consumo de energia 16/32", uma lista de 453 itens com raridade): é o que o Comandante chama de pay-to-win. Aqui o Hangar é igual para todos (`GAME_DESIGN.md`, "Não é pay-to-win"); a progressão libera **jeito**, nunca **poder**.
- **"Report Cheater" na tela de morte:** depende de contas e moderação (P47); não é HUD.
- **O mapa inteiro como radar, sempre:** o minimapa daqui mostra só o que está a 75 m. Perfeita informação de onde todo mundo está tiraria o jogo furtivo (P23); a escolha é do Comandante (`HISTORICO_DE_DECISOES.md`, 13/10).
- **A paleta clara de desenho animado:** o cenário deles é diurno e saturado; o nosso segue neon sobre escuro. Cor por zona e cobertura sim, trocar a direção de arte não (decisão de 07/10).

### 6.3 Plano: cinco frentes, um PR pequeno cada, na ordem em que o Comandante enxerga

| Frente | O que entra | Custo (G4, G5, G12) | Estado |
|---|---|---|---|
| **1. HUD de combate** | minimapa, vida do torso e partes, cartões de arma, anel de dash, topo sem sobreposição | um canvas ~150 px a 12 Hz; o resto é DOM escrito só quando muda | **feito** (`claude/referencia-mecharena`) |
| **2. Leitura do combate** | números de dano flutuantes, plaqueta com barra de vida e distância, "recarregando" ao lado da mira, ícone da arma no kill feed | pool fixo de nós; projeção só dos vivos e próximos | próxima |
| **3. Morrer e voltar** | painel "seu algoz" com a ficha do matador, escolha do ponto de nascimento na contagem (a P98 entra aqui) | tela de DOM; nenhum custo na partida | |
| **4. Cenário** | contêineres, rampas e muretas instanciados, cor por região da Arena, mais cobertura no Bunker | `InstancedMesh` por tipo; sem draw call por prop | |
| **5. Pontos de controle e ficha da arma** | modo A–E (posse por proximidade, placar por tempo de posse), minimapa com as letras, dano/alcance/recarga na lista do Hangar | regra no `Match` com teste (G14) e estado de objetivo na rede | depende da decisão 5 da folha de decisões do Comandante (a escolta vem antes?) |

**O que o Comandante pode ajustar agora:** (a) se o minimapa deve mostrar só quem está à vista; (b) se o modo de pontos de controle entra antes ou depois da escolta (P99); (c) se quer o retrato do piloto na vida (pede arte).

## 7. Seis prints: alcançar a qualidade de movimento, combate e cenários (13/10, Codex, P109)

**Pedido literal:** “andei assistindo uns videos do mech arena, e percebi que eles tem uma jogabilidade, uma fluidez muito boa, movimentação, mecanicas, fisica dos tiros, etc, e cenarios grandes e muito elaborados. quero alcançar o nivel deles. vou colar aqui uns prints”. Complemento à P109, sem duplicar a ordem nem reiniciar o HUD já entregue.

**Evidência:** seis imagens fornecidas pelo dono, preservadas em `referencias/mecharena/2026-10-13-01.png` a `06.png`, na ordem do chat. São referência de análise, não assets do jogo. Nesta sessão a pasta local `.tmp/referencias/` não existia; os vídeos antigos não foram revistos. A fluidez é o relato do dono; um quadro não comprova velocidade, trajetória, resposta ao comando, FPS sustentado nem implementação física do concorrente. O contador visível não é benchmark comparável.

| Print | O que é observável | Aplicação ao nosso jogo |
|---|---|---|
| 1 — Skyship 11 e seleção | Estruturas vermelhas grandes, céu além da plataforma, mapa comprido e cinco silhuetas distintas | Separar área jogável de horizonte visual; oferecer marcos para orientação e leitura do papel de cada chassi |
| 2 — convés | Piso amarelo de circulação, coberturas claras, volumes vermelhos ao fundo; alvo marcado a 67 m | Contraste entre chão, cobertura e unidade. Cobertura com função tática, não só decoração |
| 3 — arena com passarelas | Cruzamento entre piso inferior e passarela, rampas, alturas e caminhos laterais; alvo a 48 m | Rotas alternativas e vantagem de altura com acesso e contrajogo; conferir câmera sob passarela |
| 4 — corredor rochoso | Passagem estreita enquadra alvo a 41 m; descarga amarela e proteção azul envolvem o Mech | Efeito com identidade e centro de mira legível; a imagem não estabelece a física do disparo |
| 5 — pódio | Três corpos muito distintos, plataformas, estandartes e iluminação que destacam os robôs | Silhueta e apresentação do resultado; acabamento de fim de partida após resolver o combate |
| 6 — escudo frontal | Barreira translúcida delimitada, rampas, caixas e indicação de recarga perto da mira | Visual mostrar o volume efetivamente protegido e recarga; evitar brilho que esconda o alvo |

### 7.1 Distância real até a meta

- **Fluidez:** `medicoes/RENDER_C3.md` mediu combate em 09/10 na Vega 11: p50/p95/p99 de **33,4/66,6/100 ms**, com duas travadas >300 ms. Amostra curta e RAM pressionada; não representa uma medição do build de hoje. Exige nova linha de base controlada antes de atribuir a causa ou prometer 60 FPS.
- **Movimento:** o projeto já possui tick fixo, interpolação, dash, pulo e câmeras. Existência de sistemas não atesta boa sensação: avaliar arrancada, parada, strafe, giro, apoio dos pés, colisão da câmera e transições de altura em movimento. Preservar resposta imediata; peso deve vir também da pose, passada e áudio, sem introduzir atraso de input por estética.
- **Tiro:** já há rastros, impactos por família, tremor por arma e efeitos elementais. Conferir a cadeia completa **comando → saída da boca → trajetória → impacto → reação → som/retorno de acerto**. A compensação de latência continua AUSENTE em `STATUS_REAL.md`; contrato de justiça e teste com dois clientes pertencem à frente de simulação/rede. Não tratar toda arma como projétil balístico nem aplicar rewind indiscriminadamente.
- **Cenário:** a Arena tem `halfSize = 100` (200 m de lado em `environment/Arena.ts`); o Bunker possui quatro pisos e limitações registradas. Área física maior não garante riqueza ou ritmo. As capturas mostram profundidade, marcos, cobertura e circulação; não permitem calcular o tamanho dos mapas do concorrente.
- **Base visual:** `Arena.ts` já usa `Atmosphere` e `BuildingWindows`; `Game.ts` liga `ShadowBlobs`. Reaproveitar essas entregas e o HUD da §6. Os textos antigos das §§3–4 sobre ausência dessas peças são históricos.

### 7.2 Primeiro alvo: uma arena como referência de qualidade

Proposta de execução para concretizar a meta, sem alterar `VISAO.md` ou assumir trabalho de sessões externas. Evoluir **uma arena existente** até o dono aprovar a experiência; só então replicar o padrão. A ordem de movimento/tiro/arte abaixo complementa a frente de HUD da §6.

| Etapa | Entrega verificável | Aceite e custo a conferir |
|---|---|---|
| A — medir fluidez | Mesma versão, GPU integrada, 1280×720, resolução interna declarada, montagem e esquadrão fixos; três sessões de 5 min após aquecimento, com movimento e tiro. Registrar também primeiro uso a frio | p50/p95/p99, travadas >50/100/300 ms, CPU/GPU quando disponíveis, RAM, draws e tempo até jogar. **Alvos propostos**, não resultados: 60 FPS; p95 ≤20 ms, p99 ≤33,3 ms; zero travadas >100 ms após aquecimento. Ambiente ocupado deve ser identificado, sem encerrar processos alheios |
| B — pilotar e atirar | Percurso repetível: arrancar/parar, strafe mirando, dash, rampa, curva junto de parede; disparar três famílias existentes contra alvo parado e móvel | Clipe do mesmo percurso antes/depois e julgamento do dono; boca/impacto coerentes e câmera sem atravessar cobertura. Testes de simulação se a regra mudar. Animação e efeitos com pools e tetos, sem novas alocações no frame |
| C — arena acabada | Rota central, flancos e altura útil, cobertura na escala dos chassis, marcos por setor, kit consistente de chão/parede/rampa/contêiner e horizonte decorativo | Capturas fixas e percurso em movimento; testar spawn, rampas, câmera, tiros e navegação de bots antes de detalhar. Medir deslocamento até contato e caminhos sem cobertura. Instanciamento por setor/tipo; colisores simples só onde há interação, custo de CPU/física medido |
| D — experiência online | Dois clientes, atraso/jitter/perda controlados, confronto entre aquilo que o piloto viu e o acerto decidido pelo servidor | Relatório por arma e condição; correções visíveis, tempo de retorno, banda e tick. Compensação depende de contrato de autoridade/justiça; manter limites de rede existentes |

**Direção de arte:** preservar identidade neon, mas tornar volumes e superfícies legíveis com luz, contraste e materiais consistentes. Usar detalhe grande que ajuda orientação; não depender de bloom para desenhar o cenário. Sombras pré-calculadas, atlas e LOD são candidatos a ensaio, não características comprovadas do MechArena nem tecnologias aprovadas sem medida.

**Próximo corte Codex:** etapa A (retomar C3 no build atualizado) e percurso da etapa B para registrar problemas concretos; depois um setor da Arena como prova da etapa C, coordenado com a frente de cenário da §6. Não ampliar mapa nem introduzir novas regras de combate neste registro. Cada implementação futura fecha com check, captura/clipe, custo e caminho no site.

**Resultado desta sessão:** referência preservada e critérios definidos; nenhum ganho de FPS, alteração de mapa, mecânica ou equivalência ao MechArena foi entregue. A P109 continua em operação.

## 8. Interfaces de jogos antigos (17/10, P182): a "chapa" com linha selecionada em barra dourada

> O Comandante mandou duas capturas de um jogo de tiro de arcade (Aero Fighters, Hamster/Success, versão de 2025) e escreveu: *"veja esses exemplos de interface de jogos antigos, eu acho muito boas!"*. Na segunda, ele escreveu à mão **MULTI** sobre a linha "2Players". **As capturas ficam só nesta máquina** (`.tmp/referencias/aero-fighters-opcoes.png` e `aero-fighters-menu-jogadores.png`): são arte de terceiros e não entram no git (como os vídeos da § 1). Aqui ficam **a leitura e o que levamos**.

### 8.1 O que as duas telas fazem (elemento por elemento)

| Elemento | O que se vê | Por que funciona |
|---|---|---|
| **A placa** | painel central em **chapa metálica rebitada**, cantos chanfrados com parafusos, interior escuro e liso; o título (`Options`, `Select Number of Players`) **fica fora/em cima** da placa | o painel **parece um objeto**: separa o menu do fundo, qualquer fundo; o interior escuro dá contraste ao texto |
| **A linha selecionada** | uma **barra horizontal** em degradê **dourado/laranja** por toda a largura do painel, com um **chevron vazado** (❯) à esquerda | impossível errar o que está selecionado, de longe e com o canto do olho; teclado e controle sem mouse |
| **A linha não selecionada** | texto **branco, grosso, com contorno escuro**; no menu de jogadores, a barra **fria (azul)** com a **mesma forma** da dourada | **duas temperaturas, uma forma**: quente = aqui, frio = disponível |
| **A linha de opção** | `Rótulo` à esquerda, `‹  valor  ›` na coluna da direita (setas brancas) | trocar um valor **é um passo (esquerda/direita)**, sem abrir lista; cabe em qualquer controle |
| **A lista curta** | de **4 a 9 linhas**, grandes, espaçadas; ações (`Reset to Default`, `controller`, `License`) como linhas centrais, sem moldura | nada de rolagem: o que cabe é o que importa (o princípio 7 da `AUDITORIA_INTERFACE.md`) |
| **Os botões de saída** | dois botões **de metal em relevo** (`Close`, `Quit Game`) **fora da placa**, embaixo | a saída é sempre a mesma coisa, no mesmo lugar |
| **O tipo** | sem serifa, **negrito**, **contorno escuro** de 2 px | legível sobre céu claro, chapa texturizada ou qualquer cena |
| **O "MULTI"** (a anotação dele) | `1Player` / `MULTI` como as duas respostas da pergunta "quantos jogadores" | a **primeira pergunta do jogo é uma só, com duas respostas grandes** |

### 8.2 O que levamos, e o que NÃO

**Levamos a estrutura, não a pele.** A direção de arte continua a de 07/10 (neon, baixo-poli, § 1): **nada de céu azul, logotipo ou chapa idêntica** (arte do Hamster). O que vira nosso:

1. **A linha selecionada em barra + chevron** (`▸`), em nosso laranja (`--hot`) sobre o fundo escuro, com a linha **não selecionada em ciano frio** da mesma forma. Vale para o console, as listas e as Configurações.
2. **O seletor `‹ valor ›`** no lugar de `<select>` quando há **poucos valores** (qualidade, dificuldade, narrador, idioma): um clique, sem lista.
3. **A placa** (painel de borda forte, cantos chanfrados, "parafusos" desenhados em CSS) para **perguntas de uma tela só**: o lado, o modo.
4. **A primeira pergunta com duas respostas grandes**: o "quantos jogadores" dele vira **`SOLO` / `MULTI`** (offline contra os bots × online) onde hoje existe o par `[ JOGAR ONLINE ]` / `[ JOGAR OFFLINE ]` (`OnlineSwitch`).
5. **O contorno escuro no texto** onde ele cai sobre a cena (já temos nos nomes dos Mechs).

### 8.3 A ordem (cada item é CSS/HTML, sem custo de CPU na partida)

| # | Entrega | Estado |
|---|---|---|
| 1 | **O seletor de lado** (a pergunta "de que lado você joga?", `LADO_E_PEDAGOGIA.md`) feito **no estilo da placa**: a primeira aplicação da referência | feito em 17/10 (P179/P182) |
| 2 | a **linha selecionada** (barra + chevron) e o **seletor `‹ valor ›`** nas Configurações | **feito em 17/10 (P182):** `ui/Passo.ts`; nove `‹ valor ›` nas Configurações, a linha sob o mouse ou com o foco em barra dourada com chevron |
| 3 | o par **`SOLO` / `MULTI`** na primeira tela | **feito em 17/10 (P182):** o botão verde é o SOLO; o MULTI é a chapa azul fria embaixo, que acende em barra dourada e abre o lobby online (só com servidor, fora de sala; tecla O) |
| 4 | a **placa** no console e na pausa | plano |

**O que o Comandante confere:** o seletor de lado. Se a "pele" agradar, os itens 2 a 4 seguem na ordem; se ele quiser mais perto da chapa dos jogos antigos (rebites, relevo), é **só CSS** e se ajusta com a captura na mão.

## 9. Quatro quadros de uma cidade cyberpunk: o alvo da Cidade Neon (27–28/10, P264)

> O Comandante mandou quatro quadros de um vídeo curto de cidade cyberpunk à noite (**não são capturas de jogo**: ele os dá como o "nível" que quer) e,
> depois da primeira entrega de atmosfera (letreiros e postes soltos no chão), disse: *"eu quero que o cenário fique nesse nível dos exemplos que enviei.
> ainda tá muito longe disso"*. Sobre os postes: *"achei meio frágeis, não sei se estão fazendo sentido... só se tiver o desenho das ruas, pois nesse
> quadriculado não achei bom não"*. **As imagens ficam só nesta máquina** (`.tmp/referencias/cidade-cyberpunk/2026-10-28-01.png` a `04.png`): são arte de
> terceiros e não entram no git (como as das §§ 1 e 8). Aqui ficam a leitura e o que levamos. **Mesmo limite das outras:** quatro quadros parados, sem movimento.

### 9.1 O que os quadros mostram, e onde a Cidade Neon estava

| Quadro | O que se vê | A Cidade Neon antes (P264 PR1) |
|---|---|---|
| 1 — a cidade de cima | torres altas em **camadas** que somem numa névoa verde-azulada; **telões verticais** ao longo das torres (rosa, azul, laranja); janelas como grade fina; passarelas ligando prédios | ~12 objetos no meio de um chão quadriculado; o horizonte eram 80 caixas sem janela |
| 2 — o beco de letreiros | um telão enorme na lateral; **letreiros de bandeira** em escrita inventada/oriental pendurados sobre a rua; coluna de tubo vermelho; tudo saturado em rosa, ciano e vermelho | letreiros soltos no chão, sem nenhum prédio atrás |
| 3 — a praça | **desenhos em tubo de neon** nas fachadas (figuras, caveira de gato); um peixe holográfico no ar; pista elevada; **chão molhado** com reflexo rosa e vermelho | sem reflexo; chão de grade |
| 4 — a avenida ao longe | três ou quatro filas de torres, faixas horizontais de letreiros, anúncios grandes claros no meio do escuro | uma fila só, e sem profundidade |

### 9.2 O que levamos (entregue na PR2) e o que NÃO levamos

**Levamos a estrutura, não a pele nem a marca.** A direção de arte continua a de 07/10 (neon baixo-poli sobre escuro, § 1). **Entregue:** (1) **a praça dentro de uma cidade** —
três filas de torres em volta (`CidadeNeonLayout.ts` é o dado; `CidadeNeonTorres.ts` as desenha numa chamada só), com janelas finas, quinas e coroas em neon, lojas no
térreo e névoa que as separa em camadas; (2) **telões que passam anúncios** (a cada 6–13 s, com falha de sinal na troca), **letreiros de bandeira** com glifos
inventados e um aqui e ali queimado, **desenhos em tubo de neon** nas fachadas; (3) **o desenho da rua**: calçadão de lajotas, avenida em anel com faixas, meio-fio e faixas de
pedestre, postes robustos de verdade na calçada e tampas de bueiro soltando vapor (o "quadriculado" saiu); (4) **o chão molhado** (poças e o rastro de cada telão e poste refletido
no asfalto, por um truque barato de shader, sem desenhar a cena duas vezes).
**NÃO levamos:** nenhuma marca, logotipo ou escrita de verdade (as marcas dos anúncios são do universo do jogo: CYBERMECH, SERAFIM, VORCARIS, SINAPSE, BOTO; os glifos são inventados);
fotorrealismo (volumetria de verdade, reflexo de verdade, raio traçado).
**Ainda não (próximos cortes, se o Comandante quiser):** pista elevada e passarelas entre as torres; hologramas flutuando; tráfego de veículos voadores; chuva e
névoa de chão mais densa; mobília de rua (toldos, barracas, máquinas) ao longo da avenida; os três prédios do meio da praça, que ainda são caixas.
**Atualização (P266, 28/10):** os telões com anúncios inventados deram lugar aos **outdoors da marca** (a arte dos produtos do Comandante, na vertical; `MARCA_E_ANUNCIOS.md`): "nenhuma marca real" passa a valer só para os
letreiros de bandeira e os neons. O **holograma** que os quadros mostram flutuando virou a logo da Serafim em 3D sobre o Prédio Serafim.
