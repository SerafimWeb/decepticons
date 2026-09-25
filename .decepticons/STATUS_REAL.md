# STATUS_REAL — Cyber-Mech Protocol

> Regra R13: o que existe de verdade, sem enfeite. Atualize quando algo mudar de estado.
> **REAL** = funciona de ponta a ponta · **PARCIAL** = existe mas incompleto · **DEMO** = só visual/placeholder · **AUSENTE** = não existe.

Última revisão: 2026-09-23

| Feature | Estado | Observação |
|---|---|---|
| Movimento WASD (aceleração estilo arena) | REAL | engasgo da corrida corrigido em 2026-09-23; coberto por `MechBase.test.ts` |
| Pulo duplo | REAL | Vector-09 `maxJumps: 2` |
| Dash com cooldown | REAL | 2,5 s; FOV abre durante o dash |
| Câmera 3ª pessoa (com colisão) | REAL | |
| Câmera 1ª pessoa (cockpit) | REAL | |
| Câmera tática (top-down, mira no cursor) | REAL | prédios entre a câmera e o Mech ficam translúcidos |
| Canhão de plasma | REAL | raycast do segmento por tick, pool de 64; só dispara com o braço direito inteiro |
| Barricadas destrutíveis | REAL | 6 na arena, HP e cor de dano |
| Destroços físicos | REAL | só cosméticos: o Mech e o tiro passam por eles (o Mech ainda os empurra). Teto de 240, os mais antigos saem primeiro. |
| Partículas, bloom, camera shake | REAL | |
| HUD (VEL, DEBRIS, barra de dash, modo de câmera) | REAL | F1 esconde o HUD (Gemini). Confirmar jogando que o F1 não abre a Ajuda do navegador. |
| Painel de desempenho (FPS, tempo de tick, draw calls) | REAL | Compacto sempre no canto. A tecla `'` abre o detalhado: qualidade adaptativa, triângulos, geometrias, texturas, shaders, heap do JS (só no Chrome), no estilo de terminal do design system Serafim. Funciona no ABNT2 e no US; o smoke testa as duas teclas e o total de draw calls |
| Qualidade adaptativa (G12) | PARCIAL | Gemini; corrigida e com testes, mas ainda não medida numa GPU integrada de verdade |
| Arena | REAL | 1 mapa: 3 prédios, plataforma com rampa, skyline |
| Dano em Mechs por parte | REAL | a parte sai da altura e do lado do impacto na cápsula; dano em parte destruída vai para o torso. Testado no Node (com mutação) e jogado pelo dono |
| Morte e respawn | REAL | torso zerado: explosão e carcaça em destroços. Bots voltam em 4 s, o jogador em 3 s, no ponto de nascimento mais longe de quem está vivo. Testado no Node; no navegador o dono jogou contra os bots |
| Bots inimigos (IA) | REAL | 3 Vector-09 violeta: patrulham, veem só com linha de visão (cone de 110° na patrulha), reagem em 0,5 s, perseguem, atacam andando de lado em rajadas, recuam com o torso baixo, voltam-se para quem os acerta. Determinísticos (RNG com semente). Hoje só caçam o jogador. O dono jogou: "estão atacando bem" |
| Dano no jogador, HUD de integridade | REAL | 6 partes no HUD, borda vermelha ao tomar dano, tela "ABATIDO" com contagem, abates/mortes |
| Painel de missão do projeto | REAL | `npm run painel`, gerado do ROADMAP (fases, 11 frentes, itens) + ESTADO_ATUAL (próxima missão, equipe) + PRs mergeados + ficha técnica (lida de `Vector09.ts`/`ProjectileSystem.ts`) + "sem pay-to-win" (lido do GAME_DESIGN). Visual: HUD cyberpunk das antigas (fósforo âmbar). No ar na raiz do site (`selvamkt.com.br/cybermech/`) |
| Configurações do jogador | REAL | Tela `[ CONFIGURAÇÕES ]` na pausa (Gemini) sobre o contrato `core/Settings.ts`: volume de áudio, sensibilidade, inverter Y, FOV, qualidade fixa ou automática, dificuldade, painel de desempenho, teclas remapeáveis com troca. Salvas no navegador e validadas (teste). O site checa no Chrome headless que a configuração salva vale na largada |
| Calibração do mouse | PARCIAL | `[ CALIBRAR MOUSE ]` na pausa e na tela de configurações: faixa de bússola com o mouse preso, "gravar 1 volta" (o gesto real vira a sensibilidade), DPI + cm/360, ajuste fino de ±1%/±10%, entrada crua (`unadjustedMovement`, com volta ao modo normal se o navegador não deixar). Conta testada no Node (ida e volta cm/360, gesto curto recusado); **a tela ainda não foi usada no navegador**: o dono testa no site |
| Dificuldade dos bots | REAL | Fácil, normal (aprovada pelo dono) e difícil, com teste; escolhida na tela de configurações |
| Rodada com placar | REAL | 5 min valendo abates (todos contra todos), relógio no topo (vermelho nos últimos 30 s), placar segurando Tab, intervalo de 10 s com o mundo congelado, rodada nova com todos inteiros nos pontos de nascimento, barricadas de volta e destroços limpos. Bots com indicativos (KESTREL, MAKO, VIPER). Lógica testada; o fim de rodada não foi visto no navegador (5 min) |
| Pausa | REAL | Esc/menu congela o mundo (os bots não atacam com o jogo pausado) |
| Feedback de acerto | REAL | marcador de acerto, parte destruída anunciada ("PERNA ESQ DESTRUÍDA", "ALVO ABATIDO"), flash de dano, peça arrancada vira destroço |
| Blind Mode (cabeça destruída) | REAL | cabeça zerada: o HUD perde os números e a mira e entra estática na tela (`#hud.blind`), com chiado em loop do `AudioSystem`. Visto no código; não conferido em jogo por outro agente |
| Áudio (efeitos sonoros) | REAL | `AudioSystem` sintetizado com Web Audio API (zero arquivos externos): tiro, impacto/hit, explosão com volume por distância, dash, pouso com intensidade proporcional, estalo de parte destruída, chiado em loop do Blind Mode. `resume()` chamado na 1ª interação (exigência do navegador). Sem custo no loop de 60 Hz (scheduler do Web Audio) |
| Foguetes (braço esquerdo) | REAL | Casulo de 4 tubos; botão direito ou Q (remapeável) no PC, FOGUETE no toque. 4 no carregador, recarga de 1 a cada 2,2 s, 75 m/s, explosão de 6 m com dano que cai com a distância, na parte mais perto (no pé acerta a perna). Quem dispara não se fere; barricadas no raio também levam. Braço esquerdo destruído = sem foguetes. 7 testes (regras + voo com física real); visto no navegador headless. Só o jogador tem foguetes; o dono ainda não jogou |
| Demolição no dash (Colossus-01) | PARCIAL | código pronto (`demolishOnDash`), nenhum Mech usa |
| Slots de sucata | AUSENTE | só o stat `maxScrapSlots` |
| Colossus-01, Ferret-X | AUSENTE | |
| Multiplayer / servidor | AUSENTE | planejado: Colyseus |
| Controles touch / mobile | PARCIAL | Refeito pelo Claude depois do teste do dono num celular (24/09): o toque na pausa começa a partida (tela cheia e deitado onde o navegador deixa), direcional analógico onde o polegar encosta, mirar arrastando à direita, FOGO que segura e mira junto, PULO, DASH, CAM (3ª/1ª) e pausa numa grade sem sobreposição. **Mira no toque (24/09, depois do segundo teste do dono: "dificuldade de mirar e atirar"):** dedo com resposta lenta/rápida, mira assistida (fricção, puxão, rastreio, antecipação do plasma) e tiro automático, desligáveis na tela de configurações; mira acende; vibração. Numa partida emulada, sem tocar em FOGO, 4 acertos em ~6 s (antes, zero). **Ergonomia (terceiro teste do dono: "botões num shape quadrado, tenho que segurar na ponta"):** botões redondos em arco, FOGO para dentro da tela; "Ajustar controles" na pausa abre o editor (arrastar e tamanho), salvo no aparelho; o check emulado arrastou, salvou e recarregou. O dono ainda não confirmou num celular de verdade `npm run check` joga num celular emulado (844×390, toque): começa, anda, atira com dois polegares e pausa. Falta o dono confirmar num celular de verdade |
| Site público (landing + bastidores + jogo) | REAL | https://www.selvamkt.com.br/cybermech/: landing na raiz, o case em `/bastidores/`, jogo em `/jogar/`. Conferido em produção (24/09, PR #19): landing com as três capturas feitas pelo runner do CI, bastidores com as entregas lidas do GitHub. Publicado a cada merge na `main` (rsync/SSH). Conferido em produção num Chrome real: painel, Jogar, jogo carregando, sem erros; CSP aplicada; `.wasm` como `application/wasm` e comprimido (735 KB) |
