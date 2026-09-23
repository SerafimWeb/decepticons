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
| Painel de debug (FPS, tempo de tick, draw calls) | REAL | Gemini; o total de draw calls foi corrigido e é checado pelo smoke |
| Qualidade adaptativa (G12) | PARCIAL | Gemini; corrigida e com testes, mas ainda não medida numa GPU integrada de verdade |
| Arena | REAL | 1 mapa: 3 prédios, plataforma com rampa, skyline |
| Dano em Mechs por parte | REAL | a parte sai da altura e do lado do impacto na cápsula; dano em parte destruída vai para o torso. Testado no Node (com mutação) e jogado pelo dono |
| Morte e respawn | REAL | torso zerado: explosão, a carcaça vira destroço, e o alvo volta em 4 s. A volta foi testada no Node; no navegador foi vista a morte, não a volta |
| Alvos de treino | REAL | 3 Vector-09 violeta parados na arena |
| Feedback de acerto | REAL | marcador de acerto, parte destruída anunciada ("PERNA ESQ DESTRUÍDA", "ALVO ABATIDO"), flash de dano, peça arrancada vira destroço |
| Blind Mode (cabeça destruída) | AUSENTE | só o getter `isBlind` |
| Braço esquerdo (lançador secundário) | DEMO | só o modelo, sem arma |
| Demolição no dash (Colossus-01) | PARCIAL | código pronto (`demolishOnDash`), nenhum Mech usa |
| Slots de sucata | AUSENTE | só o stat `maxScrapSlots` |
| Colossus-01, Ferret-X | AUSENTE | |
| Multiplayer / servidor | AUSENTE | planejado: Colyseus |
| Áudio | AUSENTE | |
| Controles touch / mobile | AUSENTE | |
| Deploy público | AUSENTE | ver `DEPLOY.md` |
