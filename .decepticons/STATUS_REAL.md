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
| Canhão de plasma | REAL | raycast do segmento por tick, pool de 64 |
| Barricadas destrutíveis | REAL | 6 na arena, HP e cor de dano |
| Destroços físicos | REAL | só cosméticos: o Mech passa por eles e os empurra, sem ser bloqueado. Teto de 240, os mais antigos saem primeiro. |
| Partículas, bloom, camera shake | REAL | |
| HUD (VEL, FPS, DEBRIS, barra de dash) | REAL | |
| Arena | REAL | 1 mapa: 3 prédios, plataforma com rampa, skyline |
| Dano em Mechs / hitbox por parte | AUSENTE | `modules` existe, mas nada aplica dano a um Mech. `mobility` e `isBlind` leem um estado que nunca muda. |
| Blind Mode (cabeça destruída) | AUSENTE | só o getter `isBlind` |
| Braço esquerdo (lançador secundário) | DEMO | só o modelo, sem arma |
| Demolição no dash (Colossus-01) | PARCIAL | código pronto (`demolishOnDash`), nenhum Mech usa |
| Slots de sucata | AUSENTE | só o stat `maxScrapSlots` |
| Colossus-01, Ferret-X | AUSENTE | |
| Multiplayer / servidor | AUSENTE | planejado: Colyseus |
| Áudio | AUSENTE | |
| Controles touch / mobile | AUSENTE | |
| Deploy público | AUSENTE | ver `DEPLOY.md` |
