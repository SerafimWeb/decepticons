# DESIGN SYSTEM DO SITE — CYBERMECH ONLINE

> **Fonte única da identidade visual do site público** (landing `/`, `/oficina/`, `/sala-de-controle/` e as páginas que vierem).
> Quem vai criar ou mexer numa página lê isto **antes**; o código dos tokens e dos componentes é `scripts/site/hud.mjs`
> (e `landing-style.mjs`, `sala.mjs`). Nasceu em 16/10/2026 (P172, Claude) da direção de arte do Comandante: as cinco
> referências em `.tmp/landing/` (só nesta máquina) e a orientação de um profissional, resumida aqui.
> O jogo em si (HUD de combate, Hangar) tem a linguagem própria dele e **não** segue este arquivo.

## 1. Identidade

CYBERMECH ONLINE é engenharia pesada, indústria militar futurista, arenas mecânicas e tecnologia brutalista. O site precisa
passar: **poder mecânico, escala monumental, competição, precisão, modularidade**. Ele tem de parecer o portal de um jogo
independente ambicioso, não um painel administrativo.

Três regras que valem acima de qualquer detalhe:
1. **A foto é a protagonista.** Imagem dos Mechs **reais do jogo**, em grande escala, com luz de cinema; o texto se apoia nela.
2. **Honestidade.** Número vem do código do jogo (R14); imagem de Mech é do modelo real; o que é render promocional diz
   que é ("Render promocional dos modelos do jogo"); captura de jogo é captura de jogo. Nada de arte inventada como se fosse o jogo.
3. **A sofisticação vem da direção de arte, não da quantidade de efeito.** Sem neon exagerado, sem sombra pesada, sem linha
   futurista de enfeite, sem HUD falso espalhado.

## 2. Paleta (tokens em `:root` do `hudCss`)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#090b0f` | fundo (preto industrial) |
| `--graphite` / `--panel` | `#14191f` / `#11161c` | painéis e cartas |
| `--amber` | `#ffd000` | **a cor de identidade e de ação**: CTA, rótulos, destaque do título |
| `--bone` | `#f4f4f1` | branco técnico: títulos e texto forte |
| `--steel` / `--muted` | `#89929e` / `#97a1ac` | cinza metálico: texto secundário |
| `--text` | `#d7dce1` | texto corrido |
| `--pink` `--orange` `--red` | | só alerta, ameaça e combate |
| `--blue` | `#35c8ff` | só telemetria e dado técnico |
| `--green` | `#5dff8a` | só estado positivo (servidor online, entrega) |

O amarelo **não** é decoração: aparece no CTA, na etiqueta numerada de seção, na ênfase do título e em números que importam.
Cor de agente (Claude, Gemini, Codex, Qwen) só na página do esquadrão.

## 3. Tipografia

- **Títulos e rótulos: Chakra Petch** (600/700 e 700 itálico), todo em caixa alta. Título de seção: `italic 700`,
  `clamp(40px, 5.4vw, 78px)`, entrelinha .94, **branco com a segunda parte em amarelo** (`<em>`).
- **Texto: Barlow** 400/600, 17 px no corpo, 19–20 px no texto de abertura, entrelinha 1,55 a 1,65.
- **Rótulos pequenos** (etiquetas, cabeçalhos de tabela): Chakra Petch 600, caixa alta, espaçamento .12 a .24 em, **nunca abaixo de 12 px**.
- **Proibido:** fonte monoespaçada no site inteiro, microtexto ilegível, aparência de terminal. Os arquivos das fontes são do próprio
  site (`client/public/fonts/`, licença OFL em `LICENCAS.txt`); não se carrega nada de fora (a CSP só libera `'self'`).

## 4. Espaço, grade e pontos de quebra

- **Container** `max-width: 1280px`, respiro lateral 40 px (22 px no celular).
- **Escala de espaço:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72 · 110 px. Seção: 110 px acima e abaixo (72 px no celular); espaço entre cartas: 24 px.
- **Pontos de quebra:** 1180 px (grades de 4 e 3 viram 2), 960 px (duas colunas viram uma; o herói escurece a foto), 860 px (cabeçalho vira duas
  linhas, links rolam na horizontal), 700 px (herói empilhado: foto em cima, texto embaixo).
- **Ritmo:** não repita a mesma grade em sequência. Alterne palco grande + seletor, cartas altas com recuo, faixa de texto grande, foto de
  largura total com régua, tabelas técnicas, mosaico de modos. Cada seção tem uma palavra gigante em contorno atrás (`ghost`), só decoração.

## 5. Botões

- **Primário (`.play-btn`, `gameButton`)**: paralelogramo amarelo, texto escuro, 16 px (`.big`: 22 px). Hover: brilho e a seta anda 4 px; foco: contorno escuro por dentro.
- **Secundário (`.btn-ghost`)**: contorno inclinado, mesmo peso de texto. **Link de ação (`.text-link`)**: texto + seta que sobe.
- **Nunca dois CTAs de jogar juntos.** Na landing, o botão do cabeçalho só aparece depois que o herói sai da tela; o herói tem o seu.
- Botão sem comportamento é proibido (nada decorativo). Todo estado existe: normal, hover, foco visível, ativo.

## 6. Componentes (funções de `scripts/site/hud.mjs`)

| Componente | Função | Nota |
|---|---|---|
| SiteHeader | `hudNav({ base, current, status })` | marca, links, estado do servidor (`statusIndicator`), CTA; sticky com vidro |
| SiteFooter | `hudFooter({ base })` | |
| SectionHeading | `sectionHeading({ n, label, title, em, aside })` | etiqueta numerada amarela + título em duas cores + nota lateral |
| GameButton | `gameButton({ label, href, event, variant })` | `variant`: `big`, `ghost` |
| FeatureCard | `featureCard({ img, pos, zoom, icon, title, text, n })` | carta alta com número em contorno; imagem dá zoom no hover |
| SectionBackground | `ghost('PALAVRA')` | palavra gigante em contorno |
| PageHero | `pageHero({ base, eyebrowText, title, sub, pitch, art })` | abertura das páginas internas |
| Icon | `ico(nome, tamanho)` | ícones de linha, herdam a cor |
| Painel | classe `.panel` | grafite liso, canto superior direito cortado, aba amarela de 44 px; `.frame` é o mesmo nas páginas antigas |

Eventos de métrica: só os quatro que o servidor aceita (`landing_view`, `click_cockpit`, `click_online`, `click_como_e_feito`). Evento novo exige mudar `shared/net/telemetry.ts`.

## 7. Imagem

- **Hero, hangar, escala dos chassis (Andróide, Vector-09 e Colossus-01 lado a lado, Colossus-V4 por trás e discreto), armas e cartas**: fotos de `node .decepticons/medicoes/cena-cinematica.mjs` — os `.glb` e os Mechs procedurais do jogo
  num hangar com luz, névoa, brilho e faíscas. A posição das partes e das medidas na foto sai em `scripts/site/cena/*.json` e a página **posiciona rótulos por ela**
  (a régua de 20 m do Colossus no herói, os rótulos dos quatro chassis na foto de escala, os seis marcadores do Hangar). Mexeu na cena? Rode o script de novo e confira a página.
- **Capturas de gameplay** (`capturas/`, seção de câmeras): feitas jogando o build; sempre rotuladas "Capturas do próprio jogo".
- **Ilustrações do esquadrão** (`eq-*.jpg`): arte de referência do Comandante, recortada; é ilustração, não foto de pessoa.
- Imagem pesada abaixo da primeira dobra: `loading="lazy"`; a do herói: `fetchpriority="high"`. Tamanhos fixos (`width`/`height`) para não pular o layout.
- Não usar imagem de robô que não seja do universo do jogo. Se faltar arte, **pedir** (e deixar a posição pronta), não inventar.

## 8. Movimento

- Só CSS (`opacity`, `transform`) e um script pequeno (`HUD_JS`): revelar ao rolar (`.reveal` → `.in`, 0,7 s, atraso escalonado de até 0,21 s), paralaxe do herói com o ponteiro (≤ 14 px, só com mouse),
  troca de câmera com fade de 0,8 s e barra de progresso de 6,5 s. Pausa com hover, foco e aba escondida.
- `prefers-reduced-motion`: tudo aparece parado, sem troca automática. Sem JavaScript o conteúdo aparece inteiro (a classe `js` só liga as animações).
- Custo: nada por quadro; nenhum WebGL na página; o observador desliga cada bloco depois de revelá-lo.

## 9. Acessibilidade

- Contraste medido (WCAG) sobre `#090b0f`: texto corrido `#d7dce1` 14,3:1; texto secundário `#97a1ac` 7,5:1 (6,7:1 sobre o painel); nota discreta `--faint` `#7d8996` 5,5:1 (5,0:1 sobre o painel); amarelo 13,4:1; texto escuro sobre o botão amarelo 13,5:1. Nada abaixo de 4,5:1.
- Foco visível em tudo que é clicável; link de pular para o conteúdo; um `h1` por página; seções com `aria-labelledby`; botões de câmera com `aria-pressed`.
- Alvo de toque ≥ 44 px nos botões; os marcadores numerados do Hangar têm 30 px e a lista ao lado faz o mesmo papel; o seletor de câmera rola na horizontal no celular.
- Imagem decorativa com `alt=""`; imagem que informa tem texto alternativo que diz o que mostra.

## 10. Convenções para página nova

1. Importe de `scripts/site/hud.mjs`: `hudCss(base)`, `hudNav`, `hudFooter`, os componentes e `HUD_JS`; **não** defina de novo paleta, fonte ou botão.
2. Página interna: `pageHero` + `<div class="page">…</div>`; as classes antigas (`.frame`, `.read`, `.kicker`, `.lede`) já vêm no sistema por `HUD_PAGE_CSS`.
3. Número só de `dados.mjs` (código do jogo, git, documentos). Nada digitado, nada inventado.
4. Foto de Mech: do `cena-cinematica.mjs` (acrescente um `shot` se faltar ângulo).
5. Depois de montar: `npm run site -- --check` (o teste abre a página num Chrome com a CSP do servidor), captura em `.decepticons/arte/` e as quatro larguras (390, 768, 1280, 1440).

## 11. Faça × evite

| Faça | Evite |
|---|---|
| Mech grande, luz de cinema, escala à mostra (régua em metros) | Carta escura com borda luminosa repetida |
| Título em itálico pesado, branco + amarelo | Fonte pequena, mono, "painel de programação" |
| Um CTA claro por tela | Dois botões de jogar juntos; botão sem função |
| Número do código do jogo | Métrica inventada, "pilotos com personalidade" sem existir |
| Seções com ritmo diferente | Mesma grade de três cartas em todo lugar |
| Texto de apoio legível (≥ 16 px) | Microtexto de 9–11 px |

## 12. Páginas já no sistema e o que falta

- **Feito (P172):** landing, oficina (`pageHero` + `HUD_PAGE_CSS`), sala de controle (esquadrão com cartas por IA, atividade com mapa de calor e registro filtrável, "como um pedido vira jogo").
- **Mapa das referências do Comandante:** *Hangar + Arsenal* → seções 03 e 05 da landing; *Dados que importam* → oficina; *Esquadrão* e *Atividade* → sala de controle.
- **Falta:** página própria de Hangar/Arsenal com comparador; "Pilotos" (não existe como recurso: só entra quando o jogo tiver); render em movimento do herói (hoje é foto); fotos de armas com mais detalhe (os modelos das armas ainda são simples).
