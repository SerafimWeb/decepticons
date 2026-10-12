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
