# PAINEL ADMIN — gerenciar o jogo inteiro em poucas telas

> Pedido do dono, 10/10/2026 (P54 de `ORDENS_DO_COMANDO.md`): *"sinto falta de um painel admin completo, onde eu possa gerenciar tudo do
> jogo em poucas telas, de forma inteligente e estratégica, para configurar desde uma campanha, como os bots adversários,
> configuração de cada um, apelidos, pilotos, módulos, armas etc."* Este documento é o **plano**, escrito antes de qualquer tela, para
> os agentes trabalharem em paralelo contra contratos (AGENTS.md, regra 5). **Estado: só plano; nada deste painel existe ainda.**

## 1. O que já existe (não se refaz, se reúne)

| O que o dono quer mexer | Hoje | Onde |
|---|---|---|
| Sensibilidade, câmera, qualidade, teclas, dificuldade | ✅ tela de Configurações | `core/Settings.ts`, `ui/SettingsMenu.ts` |
| Quantos Mechs e andróides, técnico, personalidade de cada Mech, quantos atacam juntos | ✅ | `ui/EnemySettings.ts` |
| **Apelidos** dos inimigos, andróides, técnico e aliados | ✅ | `ui/EnemySettings.ts`, `core/botNames.ts` |
| Potência de cada arma e de cada clã (dano, cadência, calor, alcance, vida, velocidade) | ✅ | `tuning/power.ts`, `ui/PowerSettings.ts`, link `?potencias=` |
| Montar o **seu** Mech (chassi, armas, módulo, escudo) | ✅ | `hangar/`, `ui/HangarMenu.ts`, link `?build=` |
| Papéis e números dos chassis | ✅ no código, **sem tela** | `entities/chassis.ts` (`CHASSIS_PAPEL`) |
| Ondas da missão (quantos, quando, o chefe) | ⚠️ **plano fixo no código** | `sim/SurvivalWaves.ts` (`SURVIVAL_WAVE_PLANS`) |
| **Chassi e armas de cada bot, piloto de cada bot** | ❌ **não existe**: todo bot é um Vector-09 de plasma | `combat/BotSystem.ts` |
| Campanha (sequência de missões salvas e nomeadas) | ❌ ausente (`STATUS_REAL`, "Painel de campanhas") | — |
| Servidor: ver, reiniciar, jogadores, métricas | ⚠️ só leitura (`/metricas`), e reinício por script no PC | `server/`, `scripts/*.ps1` |
| O que foi pedido e se o jogo melhora | ✅ em Markdown, **sem tela** | `ORDENS_DO_COMANDO.md` |

**Conclusão:** metade do painel é **reunir telas que já existem** num lugar só. A outra metade pede **dado novo**: a ficha de cada bot e a
campanha. Por isso o plano começa nos contratos, não nas telas.

## 2. As cinco telas ("poucas telas")

1. **Oponentes** (a mais pedida): a lista de bots; cada um com **apelido, piloto, chassi, montagem (a mesma do Hangar), personalidade e dificuldade**.
   Hoje só dá para mudar nome e personalidade.
2. **Campanha:** uma sequência de **etapas** (modo, oponentes, objetivo, ondas) com nome, salva e compartilhável por link, como as montagens do Hangar.
   Começa com a Sobrevivência de hoje como campanha padrão (um teste garante que ela dá o mesmo jogo de antes).
3. **Arsenal e chassis:** as Potências de hoje mais a tabela de chassis (papel, vida, velocidade). **Só leitura no começo**, edição depois.
4. **Servidor:** jogadores, salas, métricas, reinício e atualização, **só com o token do dono**. Pedido separado de 28 e 29/09 (P30).
5. **Evolução:** o registro de pedidos e o placar de resultado, para ver se o jogo melhora ou se é cosmético (`ORDENS_DO_COMANDO.md`, seção 6).

## 3. Contratos primeiro (G14: uma simulação, com teste)

Tudo em módulos sem tela, com validação e teste, no molde de `LoadoutSpec` e `PowerStore`:

```ts
interface BotSpec {            // um oponente
  v: 1;
  apelido: string;             // o nome na tela (limite de `botNames`)
  piloto: string;              // quem pilota: aparece no placar e nas mensagens (texto livre curto)
  chassi: ChassisId;           // 'vector09' | 'onca' | ... (só os que o bot sabe pilotar)
  montagem: string;            // `loadoutKey` do Hangar: o bot usa as mesmas armas que o jogador
  persona: Persona;            // soldado | brabo | manso | fujão
  dificuldade: Difficulty;     // facil | normal | dificil (escala o bot, não o chassi)
}
interface EtapaSpec { titulo: string; modo: 'arena' | 'sobrevivencia' | 'ctf'; inimigos: BotSpec[]; ataquesSimultaneos: number; chefe?: BotSpec }
interface CampanhaSpec { v: 1; nome: string; etapas: EtapaSpec[] }   // `campanhaKey` / `parseCampanhaKey`, como `loadoutKey`
```

Regras (cada uma com teste): validar tudo que vem de link ou armazenamento ("nada é confiado", como no Hangar); **um bot não pode ter uma montagem
que o chassi dele não aceita** (`validateLoadout`); teto de bots vivos e de custo por etapa (G4/G5: pool pré-alocado, sem `new` por tick);
o desvio de cada bot sai de dados, **sem `Math.random`** (G1/G2); campanha padrão **idêntica** à Sobrevivência de hoje.

## 4. Quem faz o quê (cada um no seu território, AGENTS.md regra 4)

| Etapa | O que | Quem | Depende de |
|---|---|---|---|
| **A** | `BotSpec` e `CampanhaSpec`: contratos, validação, chave/link e testes | Claude | decisões da seção 5 (têm padrão) |
| **B** | `BotSystem` cria bots a partir de `BotSpec` (chassi e armas diferentes); campanha padrão = Sobrevivência de hoje | Claude | A |
| **C** | Tela **Oponentes** (e o esqueleto das cinco abas) | Gemini | A (os dados chegam simples, sem importar a simulação) |
| **D** | Tela **Campanha** | Gemini | A e B |
| **E** | Tela **Servidor**: rotas com token (`/admin/*`) e a tela | Claude (rotas), Gemini (tela) | token e decisão do servidor (`ESTADO_ATUAL`) |
| **F** | Tela **Evolução**: lê o registro de pedidos e o placar | Qwen ou Claude (`scripts/site`) | — |
| **G** | Tela **Arsenal e chassis** (leitura, depois edição) | Gemini | A |

Cada etapa: um PR, `npm run check` verde, captura em `arte/`, linha em `ORDENS_DO_COMANDO.md`. **Nenhuma tela entra antes do contrato dela.**

## 5. Decisões do dono (têm padrão; se não disser nada, sigo o padrão)

1. **Onde mora.** Padrão: **dentro do jogo**, num botão "ADMIN" na pausa (abre as abas), sem página separada; só a aba Servidor pede o token. Alternativa: página `/cybermech/admin/` à parte.
2. **Quem usa.** Padrão: **só o dono**, salvo no navegador dele e compartilhável por link (como `?build=`); sem conta. Alternativa: campanhas salvas na conta (depende do login, P33).
3. **O que é "campanha".** Padrão: **sequência de etapas** (modo, oponentes, objetivo), sem história nem progressão de piloto. Alternativa: com narrativa e evolução entre etapas (muito maior).
4. **Quanto se pode mexer num bot.** Padrão: apelido, piloto, chassi, montagem, personalidade, dificuldade. Fora por enquanto: **vida e velocidade livres de cada bot** (quebraria o equilíbrio medido; entra pelas Potências).
5. **Módulos** (escudo, gerador): entram na montagem do bot como no Hangar, assim que o contrato da montagem os cobrir para bots.

## 6. Riscos honestos

- **É o maior pedido novo desde o Hangar**, e o custo está no dado (`BotSpec`) e na simulação, não nas telas. A etapa B mexe em como todo bot nasce: precisa de teste de que **a partida de hoje não muda**.
- **Bots com armas e chassis diferentes** mudam o equilíbrio das ondas (hoje medido com plasma): ondas novas precisam de uma rodada de balanceamento (`combat/balance.ts`).
- **Servidor com token** é superfície de ataque nova: só leitura e reinício no começo, nada que apague dado; rate limit como as contas.
- **A máquina é compartilhada**: telas pesadas de editar listas grandes precisam de limite (máx. de bots e de etapas) desde o contrato.
