# Landing e primeiro acesso — P169 (Codex, 16/10/2026)

## Escopo e origem

Referências visuais: cinco imagens fornecidas pelo dono em `.tmp/landing/`. Identidade adotada: preto mineral, amarelo, tipografia de impacto e fotografias dos próprios Mechs. Nenhum texto ou número das referências foi importado.

`scripts/landing.mjs` lê os atributos de `jogo()`, valida as montagens com `validateLoadout` e gera os links com `loadoutKey`. Os seis destaques vêm da VITRINE do `GAME_DESIGN.md`. Não anuncia conta, ranking ou campanha ainda ausentes.

> **Atualização (P172, 16/10):** a landing foi refeita; as fotos agora vêm de `node .decepticons/medicoes/cena-cinematica.mjs` (o `landing-assets.mjs` saiu). Este relatório fica como registro da primeira versão.

As fotografias promocionais foram produzidas por `node .decepticons/medicoes/landing-assets.mjs` (removido): rigs reais do jogo, cena industrial separada, Three.js, sem alteração dos modelos ou da iluminação da partida. A abertura identifica a composição promocional. Arena e primeira pessoa vieram do cache de capturas do site; a Praia veio de `arte/praia-orla-d55-claude.jpg`. Os oito JPEGs em `client/public/press/` somam 644.335 bytes; a abertura tem 131.756 bytes. Não há modelos 3D carregados na landing.

## Prova visual e funcional

- Capturas em `arte/landing-codex-1440.jpg`, `landing-codex-1280.jpg` e `landing-codex-390.jpg`.
- Desktop 1440×1000 e 1280×720, celular 390×844: sem overflow horizontal, todas as imagens carregadas, nenhum erro JavaScript na primeira rodada.
- Seleção de câmera e abertura do FAQ verificadas no navegador.
- Oficina e Sala de Controle mantêm as tabelas e os indicadores derivados do repositório. A página pública deixa de reproduzir a fila interna e falas cruas; os registros originais e o painel local são preservados.
- A redação inicial do jogo orienta movimento, mira e ataque; a ação secundária explica que abre Hangar e modos.

## Custo e limites

Validação inicial completa: `npm run check` verde, 237 arquivos e 2.420 testes, build, smoke, encaixes de armas e teste do site com CSP. A revisão cruzada identificou o foco externo recortado pelo `clip-path` dos CTAs; corrigido com contorno interno. A integração da `main` fc2d1ba preserva a entrega paralela de explosivos dos bots; o hook do push revalida o conjunto integrado.

Nenhuma operação nova por frame/tick na simulação. A landing usa imagens estáticas, troca de câmera a cada 6 s (pausa por foco, hover, aba oculta e movimento reduzido) e consulta o status no intervalo já definido pelo projeto, com timeout e sem consultas sobrepostas. As demais imagens usam carregamento tardio.

Isto comprova navegação, conteúdo e layout. Não mede aumento de conversão, retenção ou FPS. A homologação de jogadores simultâneos e os controles de toque continuam com as limitações do `STATUS_REAL.md`. A composição promocional não representa uma nova arena jogável.
