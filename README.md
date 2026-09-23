# Cyber-Mech Protocol

Protótipo de shooter de Mechs multiplayer para o navegador. Vite + TypeScript + Three.js + Rapier3D (Wasm/SIMD).

## Rodar

```bash
npm install        # também ativa os hooks git de .githooks/
npm run dev        # abre http://localhost:5173
npm run build      # typecheck + build de produção em dist/
npm test           # testes de simulação (Vitest, no Node)
npm run check      # typecheck + testes + build + budget (JS/Wasm gzip) + boot real no Chrome/Edge headless
```

Contexto do projeto, decisões e pendências: pasta `.decepticons/` (comece pelo `CLAUDE.md`).

## Controles

| Tecla | Ação |
|---|---|
| WASD | mover (na visão tática: relativo à tela) |
| Mouse | mirar (1ª/3ª pessoa: mouse capturado; tática: cursor) |
| Clique esq. (segurar) | canhão de plasma |
| Shift | dash (cooldown de 2,5 s) |
| Espaço | pulo (duplo no Vector-09) |
| V | alterna câmera: 3ª pessoa → 1ª pessoa → tática (LoL/Diablo) |
| Scroll | zoom (3ª pessoa e tática) |
| Esc | pausar |

## Estrutura

```text
client/src/
├── main.ts                   # só bootstrap
├── core/
│   ├── Game.ts               # monta os módulos + loop (sim 60 Hz fixa / render interpolado)
│   └── InputManager.ts       # teclado, pointer lock, cursor, scroll
├── camera/
│   ├── CameraMode.ts         # interface comum dos modos
│   ├── CameraRig.ts          # troca de modo, sensibilidade, shake, FOV
│   ├── ThirdPersonCamera.ts  # ombro, com colisão
│   ├── FirstPersonCamera.ts  # cockpit
│   ├── TacticalCamera.ts     # top-down, mira no cursor, prédios translúcidos
│   └── aim.ts
├── physics/PhysicsWorld.ts   # wrapper do Rapier (colisores estáticos, raycast)
├── entities/
│   ├── MechBase.ts           # character controller cinemático, dash, pulo, dano modular, animação
│   ├── Vector09.ts           # stats + modelo procedural
│   └── meshKit.ts
├── player/PlayerController.ts  # input/câmera -> MechInput, tiro
├── environment/
│   ├── Arena.ts              # chão, prédios, rampa/plataforma, limites, skyline
│   ├── Destructibles.ts      # barricadas com HP -> quebram em destroços
│   └── DebrisSystem.ts       # destroços dinâmicos (1 InstancedMesh)
├── combat/ProjectileSystem.ts
├── fx/ParticleSystem.ts
└── ui/HUD.ts
```

## Física e performance

- **Passo fixo de 60 Hz** para Mech, projéteis e Rapier. O render interpola entre ticks, então o jogo fica liso a 144 Hz e a simulação é determinística (a mesma do servidor). Se a máquina engasgar, roda no máximo 4 ticks por frame: o jogo desacelera em vez de travar.
- **Mech = cápsula cinemática + `KinematicCharacterController`**, não um rigid body dinâmico. Sobe rampas até 50° e degraus até `stepHeight`, desliza em paredes e gruda no chão ao descer. É barato e previsível para netcode.
- **Destroços são só cosméticos:** o controller do Mech ignora corpos dinâmicos, então o trajeto não depende deles (cliente e servidor calculam o mesmo). O corpo do Mech ainda empurra os destroços no passo de física.
- **Destroços:** colisor estático simples enquanto a estrutura está inteira. Ao quebrar, vira no máximo 24 peças dinâmicas que dormem ao parar (Rapier não integra corpos dormindo). Todas as peças usam um único `InstancedMesh`, e só as acordadas atualizam a matriz. Há um limite global de 240 peças: as mais antigas somem primeiro.
- **Projéteis:** raycast do segmento percorrido por tick (não atravessam nada). Aplicam dano em destrutíveis e impulso em destroços.
- **Multiplayer (planejado):** no cliente, só o Mech local roda o character controller (prediction). Mechs remotos só interpolam snapshots, com custo de física zero. O servidor roda o mesmo `MechBase.fixedUpdate` sem render.
- **Rapier no browser:** o código importa `@dimforge/rapier3d-simd-compat` (roda no Node); o `vite.config.ts` troca pelo pacote com `.wasm` separado, que baixa em paralelo e compila em streaming. JS: ~182 KB gzip; Wasm: ~720 KB gzip.

## Próximos passos

Ver `.decepticons/ROADMAP.md`.
