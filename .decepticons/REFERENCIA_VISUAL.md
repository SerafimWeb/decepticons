# REFERÊNCIA VISUAL — o que o MechArena nos mostra

> Pedido do dono (07/10/2026): ele gravou a tela do MechArena rodando e pediu que o projeto olhasse "a qualidade
> que eles chegaram: gráficos, jogabilidade, armas, cenários". Este arquivo guarda o que foi visto, o que serve para
> o CYBERMECH e o que não serve. Quem for mexer em visual, efeito, HUD ou cenário lê isto antes (Passo Zero, item 11).
> O dono traz mais referências quando o agente pedir; cada uma ganha uma seção aqui.

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
3. **Efeitos:** rastro de tiro, anel de choque, fogo com mais corpo, desfoque de dash em qualidade alta.
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
