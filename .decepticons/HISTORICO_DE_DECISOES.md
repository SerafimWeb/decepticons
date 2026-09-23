# HISTÓRICO DE DECISÕES — Cyber-Mech Protocol

> Cofre append-only (M2). Nunca edite entradas antigas. Entrada nova SEMPRE no topo.

---

## [2026-09-23] Desenvolvimento com dois agentes: Claude + Codex
**Decisão:** o dono vai desenvolver partes do projeto com o Claude (Claude Code) e partes com o Codex, os dois sob o Protocolo Serafim UM.
**Como:**
- `AGENTS.md` (lido pelo Codex) é a fonte única de instruções; o `CLAUDE.md` só importa ele (`@AGENTS.md`), para as regras não divergirem (R14).
- Cópia de referência do protocolo em `.decepticons/PROTOCOLO_SERAFIM_UM.md`, porque um agente na nuvem só enxerga o repositório.
- Um branch por tarefa (`claude/…`, `codex/…`), PR com CI verde, revisão cruzada entre os agentes, merge pelo dono.
- Território de arquivos por agente no `ESTADO_ATUAL.md`; contrato (`shared/`) antes de paralelizar.
**Motivo:** cada agente tem pontos fortes, mas dois agentes sem regra comum desfazem o trabalho um do outro. A revisão cruzada também resolve o AP-5 (IA revisando o próprio código).
**Limite conhecido:** repositório privado no plano gratuito do GitHub não trava a `main` por regra de proteção. A disciplina é do processo (agentes + CI), não do GitHub.
**Quem decidiu:** dono (divisão proposta pelo Claude; o dono pode redistribuir).

## [2026-09-23] Game design v1, viralização e princípios de arquitetura
**Decisão:** o dono aceitou todos os padrões da sessão de definição: 8 por sala, todos contra todos com rodadas de 5 min, entrada livre sem lobby, convidado com apelido, só desktop, portal primeiro, diferencial = destruição + dano por parte. Receita: combinar os modelos para viralizar (link de sala → modo streamer, porque o dono vai fazer lives → portal com anúncio só entre rodadas → cosméticos sem vantagem de combate). Detalhes em `GAME_DESIGN.md`.
**Princípios pedidos pelo dono:** economia de dados, requisitos baixos, leveza, resiliência, código estratégico. Viraram as regras mensuráveis G11–G14 em `PROTOCOLO_UNIVERSAL.md` (ex.: ≤ 8 KB/s de download por jogador, estado a 20 Hz, tick do servidor ≤ 2 ms).
**Quem decidiu:** dono.

## [2026-09-23] Correção do engasgo na corrida (contorno de imprecisão do Rapier)
**Sintoma:** correndo em chão plano, o Mech parava a 0 m/s por 1 tick, ~1 vez a cada 2 s. O `MechBase` zerava a velocidade sempre que o movimento saía menor que o pedido, então levava ~10 ticks para reacelerar. O dono confirmou jogando.
**Causa (medida):** a margem (`offset`) de 5 cm entre a cápsula e o chão vai erodindo por imprecisão numérica da consulta cápsula × caixa. Quando um tick começa dentro da margem com a gravidade empurrando para baixo, a primeira colisão vem com `toi = 0` e o controller devolve movimento zero. Não depende da forma do chão (caixa, trimesh e heightfield travam igual) nem de ajuste de config (autostep, snap, offset, nudge).
**Decisão:** (1) só nesse tick (menos de 1 por segundo) o movimento é refeito tangente ao chão e 2 mm afastado dele (`unstickFromGround`); (2) a velocidade só perde a parte que entra em parede ou teto, e chão ou rampa nunca freiam a horizontal. Custo de CPU: uma chamada extra ao controller nos ticks raros.
**Resultado:** 0 travadas; velocidade média de 13,6 → 16,0 m/s; rampa, parede, deslize, barricada, degrau e teto iguais ao original; descida da rampa sem quicar.
**Descartado:** "não empurrar no chão" (afundava até 55 cm), reparo da margem por raio (quicava na rampa), forma de chão diferente (não resolve).
**Garantia:** `client/src/entities/MechBase.test.ts` (Vitest), comprovado reprovando a lógica antiga (tick 56: 0,000 m). Entrou no `npm run check`.
**Sobra conhecida (já existia):** o Rapier às vezes solta o chão por 1–2 ticks (pulinho de ~10 cm, ~5 vezes por minuto). Imperceptível; se incomodar, "coyote time" resolve na animação.

## [2026-09-23] Repositório: mesma conta GitHub do serafim13
**Decisão:** o código vai para a conta `Remoratrader` no GitHub, em **repositório próprio** (R9: isolamento entre projetos), privado. O CI (`.github/workflows/ci.yml`) roda `npm run check` em todo push e PR.
**Quem decidiu:** dono. A criação do repositório e o primeiro push aguardam confirmação.

## [2026-09-23] Destroços são só cosméticos para o movimento
**Decisão:** o character controller do Mech ignora corpos dinâmicos (`QueryFilterFlags.EXCLUDE_DYNAMIC`). O corpo cinemático do Mech continua empurrando os destroços no `world.step()`. O stat `mass` foi removido, porque ficou sem efeito (corpo cinemático empurra como massa infinita).
**Motivo:** o dono pediu "o mais simples possível". Destroços são aleatórios e cada cliente teria os seus; se bloqueassem o Mech, a prediction divergiria do servidor. Custo de rede zero.
**Prova:** num teste no Node com Rapier 0.20, a trajetória do Mech ficou idêntica com e sem destroço no caminho, e o destroço foi empurrado.
**Em aberto para a Fase 1:** projéteis ainda param em destroços (e os empurram). No multiplayer o servidor não terá destroços; decidir se o tiro passa a atravessá-los.
**Quem decidiu:** dono.

## [2026-09-23] Validação de input de rede sem Zod no caminho quente
**Decisão:** o servidor vai validar `MechInput` com uma função manual sem alocação (`Number.isFinite`, clamp, booleanos estritos). Zod fica permitido só em caminho frio (opções de entrada na sala, autenticação).
**Motivo:** o `MechInput` chega a 60 Hz por jogador. Com muitos jogadores, a alocação por parse do Zod vira custo de CPU e de GC, o que contraria a regra de performance primeiro. É um desvio consciente de R4.
**Alternativas descartadas:** Zod em toda mensagem; confiar no cliente.
**Quem decidiu:** sessão de setup (IA), pendente de confirmação do dono ao implementar o servidor.

## [2026-09-23] `noUncheckedIndexedAccess` avaliado e recusado
**Decisão:** não ativar.
**Motivo:** gerou 33 erros, a maioria em loops numéricos sobre typed arrays (`ParticleSystem`, `DebrisSystem`) onde o índice é garantido pelo próprio loop. Encher de `!` pioraria a leitura sem ganho real.
**Reavaliar:** ao criar `shared/` e `server/`, onde há dados vindos de fora.

## [2026-09-23] Watchdog (Skill 23) não instalado
**Decisão:** não usar `WATCHDOG.tsx`.
**Motivo:** é um componente React, e o projeto é TypeScript puro + Three.js. Trazer React só para isso pesaria o bundle e o frame. O equivalente planejado é um painel de debug leve em TS puro (tempo de tick, corpos acordados, draw calls), na Fase 2 do roadmap.

## [2026-09-23] Smoke test em browser real + budget automatizado
**Decisão:** `scripts/smoke.mjs` (playwright-core, sem baixar browser) sobe o build no Chrome/Edge headless, espera a física inicializar e o loop rodar, e reprova em qualquer erro de console ou em estouro de budget. `npm run check` = typecheck + build + smoke; o hook `pre-push` roda o check.
**Motivo:** R15 e R7 viram checagem automática, não só texto. Typecheck sozinho não pega falha de carregamento do Wasm nem de WebGL.
**Budgets:** JS ≤ 500 KB gzip (Protocolo); Wasm ≤ 900 KB gzip. O limite de Wasm é próprio porque o motor de física é um asset binário que baixa em paralelo, compila em streaming e fica em cache separado do JS.

## [2026-09-23] Rapier com `.wasm` separado no browser
**Decisão:** o código continua importando `@dimforge/rapier3d-simd-compat`; o `vite.config.ts` faz alias para `@dimforge/rapier3d-simd` no build do browser (com `vite-plugin-wasm`). As duas versões ficam fixadas iguais (0.20.0).
**Motivo:** o pacote compat embute o Wasm em base64 dentro do JS: bundle de 1.182 KB gzip, 2,4× o budget. Com `.wasm` separado, o JS caiu para 182 KB gzip e o Wasm (719 KB gzip) passa a ser compilado em streaming. Manter o import compat no código deixa a mesma simulação rodar no Node (servidor e testes) sem flags.
**Consequência:** o pacote de browser não tem `init()` (inicializa via top-level await); `PhysicsWorld.create` chama `RAPIER.init?.()`. Atualizar o Rapier = atualizar os dois pacotes juntos.
**Alternativas descartadas:** trocar o import em todo o código (o servidor Node precisaria de `--experimental-wasm-modules`); só code-splitting (não reduz bytes).

## [2026-09-23] Protocolo Serafim UM v4.2 aplicado
**Decisão:** memória em `.decepticons/`, `CLAUDE.md` na raiz, repositório git (`main`), hooks versionados em `.githooks/` ativados pelo `npm install` (`prepare` → `scripts/install-hooks.mjs`).
**Detalhes:** o `pre-commit` segue a versão estrita do Protocolo (M5: sem ESTADO_ATUAL atualizado, sem commit) e bloqueia arquivos e formatos de secret. O `pre-push` roda o smoke (R15). O `.gitattributes` força LF nos hooks.
**Motivo:** o projeto nasceu nesta data sem git, sem memória e sem checagem automática.
**Achados corrigidos junto (R17):** (1) o `DebrisSystem`, no teto de 240 peças, apagava as peças recém-criadas em vez das mais antigas: uma quebra nova deixava 2 de 24 destroços. Agora a evicção usa a ordem de criação. (2) O `Destructibles` criava uma `EdgesGeometry` por barricada e nunca liberava da GPU; agora usa uma geometria compartilhada e escalada.

## [2026-09-23] Decisões de fundação (registro retroativo)
> Tomadas na sessão que criou o protótipo, antes de existir este histórico. Reconstruídas a partir do README e do código.

**Stack:** Vite + TypeScript + Three.js + Rapier3D SIMD. Servidor futuro: Colyseus.
**Mech = cápsula cinemática + `KinematicCharacterController`**, não rigid body dinâmico: barato, previsível e reaproveitável no servidor.
**Simulação em passo fixo de 60 Hz** com render interpolado; no máximo 4 ticks por frame.
**Destroços:** colisor estático enquanto a estrutura está inteira, até 24 peças dinâmicas que dormem ao parar, 1 `InstancedMesh`, teto global de 240.
**Multiplayer planejado:** só o Mech local roda o controller (prediction); os remotos interpolam snapshots.
