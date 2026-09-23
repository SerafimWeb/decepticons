# CLAUDE.md — Cyber-Mech Protocol (codinome DECEPTICONS)

> Lido automaticamente por Claude Code, Cursor e agentes compatíveis. Ativa o Protocolo Serafim UM v4.2.
> Não remova. Não edite sem registrar no `.decepticons/HISTORICO_DE_DECISOES.md`.

## PASSO ZERO — ANTES DE QUALQUER AÇÃO

1. `.decepticons/IDENTITY.md`: o que é, stack, restrições
2. `.decepticons/ESTADO_ATUAL.md`: onde parou, pendências, decisões em aberto
3. `.decepticons/ROADMAP.md`: fases
4. `.decepticons/GAME_DESIGN.md`: o jogo, as decisões de design e o plano de viralização
5. `.decepticons/PROTOCOLO_UNIVERSAL.md`: regras e specs de engenharia (G1–G14)
6. Build, CI, hospedagem ou deploy? Leia `.decepticons/DEPLOY.md` antes. **Hoje não há deploy; não invente caminho nem host.**
7. Vai afirmar que uma feature funciona? Confira `.decepticons/STATUS_REAL.md`.

## O QUE É

Shooter de Mechs multiplayer para o navegador: Vite 8 + TypeScript 7 strict + Three.js + Rapier3D (Wasm SIMD). Hoje é um protótipo single-player; o servidor Colyseus está planejado.

## REGRAS QUE MAIS PESAM AQUI

As specs completas estão em `PROTOCOLO_UNIVERSAL.md`; este é só o índice.
- **Performance primeiro:** CPU baixa com muitos jogadores. Explique o custo de CPU de cada feature.
- **G1/G2:** gameplay só no tick fixo de 60 Hz, determinístico (sem `Math.random`, `Date.now` ou DOM na simulação).
- **G3:** feature nova = módulo independente, ligado em `client/src/core/Game.ts` por callbacks.
- **G4/G5:** zero `new` por frame ou tick; pools, `InstancedMesh`, tetos explícitos.
- **G6:** Mech remoto nunca roda o character controller.
- **G9:** importe sempre `@dimforge/rapier3d-simd-compat`; o `vite.config.ts` faz o alias para o browser. As duas versões do Rapier andam juntas.
- **G11–G13:** metas de rede (≤ 8 KB/s de download por jogador, estado a 20 Hz), requisito mínimo = GPU integrada, servidor autoritativo com reconexão.
- **G14:** uma simulação só (`shared/`); **toda regra de gameplay tem teste de simulação** (modelo: `client/src/entities/MechBase.test.ts`).
- **R2:** nada de secret em arquivo versionado. **R3:** nada de `_v2`, `_old`, `_bkp`.
- **R13:** o que não funciona de ponta a ponta fica marcado como DEMO ou AUSENTE em `STATUS_REAL.md`.
- **R17:** achou bug ou desalinhamento durante a tarefa? Corrija se for barato e seguro; senão, registre.

## MAPA

```text
client/src/
  core/        Game.ts (monta os módulos + loop), InputManager.ts
  physics/     PhysicsWorld.ts (Rapier, FIXED_DT)
  entities/    MechBase.ts (controller, dash, dano modular, animação), Vector09.ts, meshKit.ts
  player/      PlayerController.ts (input/câmera -> MechInput, tiro)
  camera/      CameraRig.ts + modos (3ª, 1ª, tática)
  environment/ Arena.ts, Destructibles.ts, DebrisSystem.ts
  combat/      ProjectileSystem.ts
  fx/          ParticleSystem.ts
  ui/          HUD.ts
scripts/       smoke.mjs (budget + boot headless), install-hooks.mjs
.githooks/     pre-commit (M5 + secrets), pre-push (npm run check)
.github/       workflows/ci.yml (npm run check a cada push/PR)
```

Repositório: `github.com/Remoratrader/decepticons` (privado), branch `main`.

## COMANDOS

```bash
npm run dev        # http://localhost:5173
npm test           # testes de simulação (Vitest, no Node)
npm run check      # typecheck + testes + build + budget + boot headless (obrigatório antes de push)
npm run smoke:dev  # boot headless contra o dev server
```

## ENCERRAMENTO DE SESSÃO

- [ ] `npm run check` passa
- [ ] `.decepticons/ESTADO_ATUAL.md` reflete o estado real (o hook de commit exige)
- [ ] Decisão relevante → nova entrada no topo de `HISTORICO_DE_DECISOES.md`
- [ ] Feature mudou de estado → `STATUS_REAL.md`
- [ ] Nenhum secret em arquivo versionado
