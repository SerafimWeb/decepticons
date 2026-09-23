# PROTOCOLO UNIVERSAL — Cyber-Mech Protocol

> O **como** deste projeto. As regras gerais vivem no Protocolo Serafim UM v4.2
> (canônico: `D:\SERAFIMHUB\serafim13\protocolo-serafim-um\PROTOCOLO_SERAFIM_UM.md`; cópia de referência
> no repositório: `.decepticons/PROTOCOLO_SERAFIM_UM.md`, para agentes que só enxergam o repo).
> Este arquivo diz como elas se aplicam aqui e define as specs de engenharia do jogo.
> Mudou uma regra? Registre no `HISTORICO_DE_DECISOES.md`.

---

## PARTE I — APLICAÇÃO DAS 17 REGRAS NESTE PROJETO

| Regra | Status | Como se aplica aqui |
|---|---|---|
| R1 SSOT | ✅ | Estado do projeto só em `.decepticons/`. |
| R2 Zero secrets | ✅ | `.gitignore` + hook `pre-commit` bloqueiam `.env*`, chaves e formatos de token. Hoje não há variável de ambiente; crie `.env.example` junto com a primeira. |
| R3 Unicidade | ✅ | Nada de `_v2`, `_old`, `_bkp`. |
| R4 TS strict + validação na borda | ⚙️ adaptado | `strict` ligado. Borda de rede (servidor): validador manual sem alocação no caminho quente (ver G7); Zod só em caminho frio. `noUncheckedIndexedAccess` recusado (ver histórico). |
| R5 RLS | — N/A | Sem banco. Reavaliar quando houver contas ou persistência. |
| R6 Migration com DOWN | — N/A | Sem banco. |
| R7 Performance budget | ✅ automatizado | JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip: `scripts/smoke.mjs` reprova acima disso. LCP ainda não medido. |
| R8 DEPLOY.md | ✅ | Existe e declara que **não há deploy**. Leia antes de qualquer mudança de build ou CI. |
| R9 Isolamento | ✅ | Nada compartilhado com outros projetos. |
| R10 Secret por nome | ✅ | O `ci.yml` não usa secret hoje. Deploy futuro: só `${{ secrets.NOME }}`, nunca valor no arquivo. |
| R11 Tokens fora do chat | ✅ | Sempre. |
| R12 Automação | ✅ | `npm install` ativa os hooks; `pre-push` e o GitHub Actions (`ci.yml`) rodam o check. O Actions só passa a valer depois do primeiro push. |
| R13 Sem mentira | ✅ | `STATUS_REAL.md` separa o que é REAL, DEMO e AUSENTE. |
| R14 SSOT por dado | ✅ | Stats de Mech: `entities/<Mech>.ts`. Cores de UI: `styles.css`. Constantes de física: `physics/PhysicsWorld.ts`. |
| R15 Smoke antes do push | ✅ automatizado | Hook `pre-push` → `npm run check`. |
| R16 Prove do ângulo de quem usa | ⚙️ adaptado | Jogo: provar no browser real, jogando (pointer lock, as 3 câmeras). Multiplayer: provar com 2+ clientes reais e latência simulada. Smoke headless não substitui isso. |
| R17 Correção proativa | ✅ | Sempre. |

**Skill 23 (Watchdog):** não instalada, porque o componente é React e o projeto não usa React (ver histórico). **Skill 12 (SEO/llms.txt):** só quando houver deploy público.

---

## PARTE II — SPECS DE ENGENHARIA DO JOGO

**[G1] Loop.** Simulação em passo fixo de 60 Hz (`FIXED_DT`), no máximo 4 ticks por frame: a máquina lenta desacelera em vez de travar. Render, câmera, animação e partículas rodam na taxa do monitor, interpolados por `alpha`. Regra de gameplay nunca roda em código de taxa de render.

**[G2] Simulação determinística.** `fixedUpdate` depende só de `MechInput` + estado. No caminho da simulação são proibidos `Math.random`, `Date.now`, DOM e objetos de cena. Efeito visual (partículas, shake, animação) fica fora da simulação.

**[G3] Módulos.** Cada sistema é uma classe independente, instanciada e ligada em `core/Game.ts`. Sistemas conversam por callbacks (`onHit`, `onBreak`, `onLand`, `onDashImpact`), nunca importando `Game`. Feature nova = módulo novo + fiação no `Game`.

**[G4] Zero alocação no caminho quente.** Nada de `new` por frame ou por tick: vetores de rascunho no escopo do módulo (`const _tmp = new THREE.Vector3()`), pools fixos, typed arrays.

**[G5] Draw calls e tetos.** Coisas repetidas usam `InstancedMesh` ou `Points` (1 draw call). Tetos atuais: partículas 3000, destroços 240 (24 por quebra), projéteis 64. Teto novo exige justificativa de custo.

**[G6] Física.** Estático = colisor sem rigid body. Corpo dinâmico precisa dormir ao parar. Mech = cápsula cinemática + `KinematicCharacterController`, que ignora corpos dinâmicos (`EXCLUDE_DYNAMIC`): destroços são só cosméticos e nunca alteram o movimento. Mech remoto **nunca** roda o controller: só interpola snapshots.

**[G7] Rede (planejado).** Servidor autoritativo. O cliente envia só `MechInput`. O servidor valida cada input com função manual sem alocação (`Number.isFinite`, clamp de `moveX`/`moveZ` em -1..1, yaw normalizado, booleanos estritos) e descarta o inválido. O código de `shared/` não pode tocar em DOM nem em WebGL.

**[G8] Budget.** JS ≤ 500 KB gzip, Wasm ≤ 900 KB gzip, checados por `npm run smoke`. Alvo de runtime: 60 FPS estáveis em hardware médio, **sem medição automatizada ainda**.

**[G9] Import do Rapier.** O código sempre importa `@dimforge/rapier3d-simd-compat`, que roda no Node sem flags. O `vite.config.ts` troca por `@dimforge/rapier3d-simd` (`.wasm` separado) no browser. As duas versões ficam **fixadas iguais** no `package.json`: atualize as duas juntas e rode `npm run check`.

**[G10] Estilo.** Identificadores em inglês; comentários e UI em pt-BR. Densidade de comentário igual à do código existente: o porquê, não o óbvio.

### Princípios pedidos pelo dono (2026-09-23): cada um com meta mensurável

**[G11] Economia de dados.** Metas por jogador, sala de 8: **download ≤ 8 KB/s, upload ≤ 2 KB/s**.
- Servidor simula a 60 Hz e envia estado a **20 Hz**; o cliente interpola (buffer ~100 ms).
- Estado binário com delta (só o que mudou), no schema do Colyseus. Posição quantizada (cm), ângulos em 16 bits.
- Input do cliente: bitmask de teclas + yaw/pitch quantizados, poucos bytes por tick.
- Evento pontual (parede quebrou, tiro acertou) vai como mensagem com id, não como estado contínuo. **Destroços e partículas nunca vão pela rede.**
- Download inicial ≤ 1 MB gzip (hoje ~900 KB). Geometria procedural, sem texturas baixadas.
- Medir banda por sala na Fase 1; estourou a meta, é bug.

**[G12] Requisitos mínimos.** Alvo: notebook com GPU integrada, WebGL2, sem WebGPU obrigatório.
- Qualidade adaptativa: FPS abaixo de 50 por alguns segundos → reduz `pixelRatio`, depois desliga o bloom. Nunca o contrário no meio da partida.
- Tetos de pool fixos (G5) valem igual para o pior hardware.

**[G13] Resiliência.**
- Servidor autoritativo: o cliente nunca decide dano, morte ou quebra de parede.
- Todo input validado (G7) + limite de mensagens por cliente (excesso descartado).
- Reconexão automática na mesma sessão (janela de ~15 s) e aviso claro "reconectando…"; o jogo nunca congela.
- Falha de uma sala não derruba o processo nem as outras salas.
- Pacote perdido: interpolação absorve; extrapolação curta e limitada.

**[G14] Código estratégico.**
- Uma simulação só (`shared/`) roda no cliente e no servidor. Nunca duas implementações da mesma regra.
- Toda regra de gameplay tem teste de simulação no Node (padrão: `client/src/entities/MechBase.test.ts`).
- Custo explícito: dependência nova só com o custo em bundle ou CPU justificado; tick do servidor medido (meta: ≤ 2 ms para 8 Mechs).
- Contorno de bug de biblioteca fica isolado, comentado com o diagnóstico e coberto por teste (ex.: `MechBase.unstickFromGround`).

**[G15] Projeto autocontido (regra do dono).** Nada do projeto é salvo fora da pasta dele: nem em outra pasta, nem em outro drive, nem no temp do sistema.
- Temporários (experimentos, snapshots, capturas, repositórios de teste, scripts descartáveis) vão só para `.tmp/` na raiz, que o git ignora.
- Ferramenta que escreve no temp do sistema por padrão é apontada para `.tmp/` (ex.: `scripts/smoke.mjs` com o Playwright e o Chrome; `scripts/test.mjs` com o Vitest).
- O `pre-commit` barra arquivos de `.tmp/`, `dist/` e `node_modules/` no stage, mesmo com o `.gitignore` desatualizado.
- Conhecimento do projeto vai para `.decepticons/` ou `AGENTS.md`, nunca só para a memória de um agente.
- Fora do nosso controle, e conhecido: caches globais de ferramentas (cache do npm, `~/.claude` do Claude Code, configuração do git/gh). Não são arquivos do projeto.

---

## PARTE III — COMANDOS

```bash
npm install          # instala deps e ativa os hooks (.githooks/)
npm run dev          # http://localhost:5173
npm test             # testes de simulação no Node (Vitest; config própria em vitest.config.ts)
npm run check        # typecheck + testes + build + budget + boot no browser headless (pre-push e CI rodam este)
npm run smoke:dev    # boot headless contra o dev server
```

O smoke usa Chrome ou Edge instalados. Em outra máquina: `SMOKE_BROWSER=<caminho>` ou `npx playwright install chromium`.

---

*PROTOCOLO_UNIVERSAL.md v1.0 | derivado do Protocolo Serafim UM v4.2 | 2026-09-23*
