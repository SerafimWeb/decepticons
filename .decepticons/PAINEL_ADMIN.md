# PAINEL ADMIN — gerenciar o jogo inteiro em poucas telas

> Pedido do dono, 10/10/2026 (P54 de `ORDENS_DO_COMANDO.md`): *"sinto falta de um painel admin completo, onde eu possa gerenciar tudo do
> jogo em poucas telas, de forma inteligente e estratégica, para configurar desde uma campanha, como os bots adversários,
> configuração de cada um, apelidos, pilotos, módulos, armas etc."* Este documento é o **plano**, escrito antes de qualquer tela, para
> os agentes trabalharem em paralelo contra contratos (AGENTS.md, regra 5). **Estado (11/10): o console de comando (seção 0) existe e é a casa
> do painel; as telas que pedem dado novo (ficha de cada bot, campanha, servidor, câmeras) continuam só no plano.**

## 0. O console de comando: a casa do painel (11/10, P86 a P89)

Pedido do Comandante (11/10): "criar nosso painel admin usando essas referências [duas imagens de uma sala de comando com monitores], pra servir
com todos os botões e configurações em um só espaço"; "use minhas imagens apenas como ideia de referência, faça a sua melhorada"; "o painel de
controle vai ser avançado ao ponto de eu, pelo servidor, poder assistir as câmeras em diferentes partidas simultaneamente… chamar a /mesa
além do hangar, cenários, missões, pilotos… tudo reunido nesse painel". As **respostas do Comandante às perguntas da seção 5** saíram dessa conversa
(ver lá). **O que existe, no PR `claude/console-comando`:**

| Monitor | O que mostra | O que abre / faz | Estado |
|---|---|---|---|
| **TEATRO DE OPERAÇÕES** | mapa-múndi tático (Brasil no centro), as missões, rotas da sede, ficha com coordenadas, modos e ameaça | **IMPLANTAR** leva ao mapa (Arena ou Bunker); zoom BRASIL/MUNDO (Z) | REAL (2 de 5 missões jogáveis; locais a confirmar) |
| **RADAR TÁTICO** | planta do mapa aberto, você (com cone de visão), aliados e IAs, zonas de cura e resfriamento | só leitura, 1 Hz | REAL offline; **online só mostra você** |
| **SEU MECH** | esquema das 6 partes com a vida de cada uma, vida, velocidade, carga, armas e módulo | **HANGAR** (tecla H) | REAL |
| **PILOTOS** | quem está na partida (Mechs com personalidade, andróides, técnico, chefe, aliados) e a ameaça de 1 a 5 | **AJUSTAR** abre Configurações > Jogo (contagem, personalidade, nomes) | REAL (ficha de cada bot: AUSENTE) |
| **CARREIRA** | nível, créditos e missões diárias | resgatar recompensa | REAL |
| **REDE** | estado do servidor e dos pilotos online | **JOGAR ONLINE** (tecla O) | REAL |
| **CONFIGURAÇÕES** | atalhos para Controles e Gráficos e som | abre a aba certa | REAL |
| **COMANDO** (só no modo Comandante) | Potências, Mesa de vídeo, Sala de controle, Oficina | abre cada uma; a **Mesa de vídeo verifica se está ligada** e mostra `npm run mesa` quando não está (12/10); a **Ficha de cada bot abre a janela do esquadrão** (12/10, P91); o **Servidor abre a janela do servidor** (12/10, P93: estado, gráficos, salas, log, AVALIAR, TESTAR, REINICIAR, com o token do dono); as **Câmeras ao vivo abrem o mural de radares** (12/10, P88); só a Campanha aparece **"em construção"** (R13), e o plano de cada um está na §8 | PARCIAL |
| **A mesa de operação** | o modo (Deathmatch, Sobrevivência, Bandeira) e o **botão verde** | **Enter** põe em combate | REAL |

**Modo Comandante:** `?comandante=1` (ou `?admin=1`) liga e o navegador lembra; `=0`, ou o selo "MODO COMANDANTE ✕", desliga. **Não é segurança** (exceto o SERVIDOR, que só responde com o token do dono): só
mostra monitores que apontam para telas que já existiam (nenhum muda servidor ou dado de ninguém). O que pedir proteção de verdade (servidor, câmeras) entra com **token no
servidor**, nunca por este interruptor.

**Custo:** zero no laço do jogo (60 Hz). Com o console à vista: o radar redesenha a 1 Hz, o mapa só ao mudar de tamanho ou de zoom (um caminho e um `fill`
por camada, < 1 ms), animações só de `transform` e `opacity` (compositor), exceto o tracejado das rotas (4 caminhos SVG). Escondido o console, nada roda.
**Durante o carregamento o console é uma tela mínima** (título, rótulo e o botão com o progresso; os monitores em `display: none`) e só liga quando o jogo fica pronto: com o console completo visível o boot do smoke subiu de 6,8 s para 12 a 13 s em CPU de software (`ESTADO_ATUAL`). **Limite conhecido:** o desenho 3D da arena continua rodando por trás do console (opaco); estrangulá-lo é tarefa própria, por causa do `Quality` adaptativo (`ESTADO_ATUAL`).

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

## 2. As cinco telas ("poucas telas"): agora, monitores e gavetas do console

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
| **H** | **Câmeras ao vivo** de várias partidas, pelo servidor (seção 7) | Claude (contrato e servidor), Gemini (mural) | token (E) |
| **I** | **Mesa de vídeo** dentro do console (hoje, só um link local; seção 7) | Qwen ou Claude | — |

Cada etapa: um PR, `npm run check` verde, captura em `arte/`, linha em `ORDENS_DO_COMANDO.md`. **Nenhuma tela entra antes do contrato dela.**

## 5. Decisões do dono (têm padrão; se não disser nada, sigo o padrão)

> **Respondidas em 11/10 (P86):** (1) **onde mora:** o console de comando é a **tela de início e de pausa**, não um botão escondido nem uma página à parte; o que é de
> administração fica no monitor COMANDO, só no modo Comandante ("os dois"). (2) **quem usa:** continua só o dono, no navegador dele, sem conta; o servidor (E e H) pede token.
> As perguntas 3 a 5 seguem com o padrão.

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

## 7. Câmeras ao vivo e mesa de vídeo (pedido de 11/10, P88) — só plano

**O que o Comandante quer:** pelo console, **assistir às câmeras de várias partidas ao mesmo tempo**, direto do servidor, e chamar a mesa de vídeo para editar.

**Peças que já existem:** o servidor autoritativo com salas (`server/Server.ts`, `ArenaRoom`); o estado a 20 Hz (`shared/net/state.ts`); `GET /status` com a contagem de pilotos por sala; o
token do dono (`/metricas`); a câmera de espectador do Gemini (`SpectatorCam`: câmeras fixas e seguir um Mech); o `TacticalRadar` do console (2D, barato).

**Desenho (contrato antes de tela, AGENTS.md regra 5):**
1. **Contrato `OBSERVAR(sala)`** em `shared/net/messages.ts`: o observador entra numa sala **sem ocupar vaga**, **sem aparecer no roster nem no placar** e **sem enviar input**; só com o token de
   administração. Recebe o mesmo estado que um jogador. Sobe o `PROTOCOL_VERSION`. Teste de servidor real: não ocupa vaga, não move ninguém, recebe o estado, token errado é recusado.
2. **Mural de radares:** uma grade de N salas, cada uma um `TacticalRadar` pequeno alimentado pelo estado da sala (2D). **Nunca N cenas 3D** (G12: GPU integrada).
3. **Câmera principal 3D:** a `SpectatorCam`, **só da sala escolhida**; as outras ficam no mural.
4. **Lista de salas** vinda do `/status` (já conta jogadores), com o selo de quem está jogando agora.

**Custo e limites:** o mesmo download de um jogador por sala observada (≤ 8 KB/s, meta G11); 5 salas ≈ 40 KB/s só para o Comandante. **Zero custo para os jogadores** (o servidor serializa o que já serializa).
Teto de observadores por token e por sala, e limite de taxa como nas contas, para não virar vetor de carga. **Observar não é gravar:** nada disto guarda dado de jogador (P75: só as nossas IAs).

**Mesa de vídeo (etapa I):** hoje o monitor COMANDO tem um link para `http://127.0.0.1:4199/.tmp/video/editor.html`, a mesa local (`node .tmp/video/servir.mjs`; `FERRAMENTAS.md` §3, G15: ela **não sobe para o
site**). Próximo passo: o console mostrar se a mesa está no ar (sem `fetch` com erro no console do navegador: o `ServerStatus` já explica por que isso reprova o smoke) e atalhos para as gravações (F9) e a pasta de clipes.

## 8. Fases do painel (12/10, P90): maiores que as anteriores, contrato antes da tela

O Comandante pediu fases maiores ("as próximas fases devem ser maiores que as atuais"). Cada fase é de 2 a 4 PRs, **sempre nesta ordem: contrato e teste, depois simulação ou servidor, depois a tela**, e fecha com captura e o caminho para ver (regra 16 do `AGENTS.md`).

| Fase | Ordem | O que entrega | Pronto quando |
|---|---|---|---|
| **1 · Esquadrão** | P91 | O Comandante monta a partida: **quantos bots e aliados quiser** (até 24 inimigos, 12 aliados e 32 no total; o Bunker, 11), cada um com apelido, chassi, armas, personalidade e dificuldade; salvo no navegador e compartilhável por link. **1A e 1B (no ar, 12/10)** o contrato `BotSpec` e `EsquadraoSpec` (validação, peso, link `q1.…`, o padrão de hoje, tradução das configurações antigas), os pontos de nascimento extras (36 + 16, conferidos pela física) e `Match`/`BotSystem` montando o esquadrão: **o padrão dá o mesmo jogo de hoje** (4 fotos tick a tick), a arma decide a distância de tiro, o custo foi medido (0,55 ms por tick com 7 corpos, 1,9 ms com 33); **1C (no ar, 12/10)** o editor: a janela do esquadrão em PILOTOS → ESQUADRÃO (duas listas, ficha do robô, seis prontos, carga, salvar e reiniciar, link, desfazer) | o esquadrão padrão reproduz a partida de hoje tick a tick ✅; 32 robôs cabem no orçamento de tick medido ✅; a janela cabe de 1024×700 a 1920×1080 e no celular ✅ |
| **2 · Servidor na interface** | P93 | **Resetar, testar, avaliar e analisar o servidor**, pelo console. **2A e 2B (no ar, 12/10)** rotas `/admin/*` com o token do dono (`GET /admin/estado`, `/admin/historico`, `/admin/log`, `/admin/avaliar`; `POST /admin/testar`, `/admin/sala/fechar`, `/admin/reiniciar`), o contrato em `shared/net/admin.ts` e a janela do monitor SERVIDOR (`ui/ServerPanel.ts`): estado ao vivo, quatro gráficos da última hora, tabela de salas com FECHAR, log, e os botões AVALIAR, TESTAR e REINICIAR com confirmação. O token é o das métricas, a porta nem existe sem ele (404), e erro de token 10 vezes em 10 min fecha o IP (429) | token errado é recusado ✅; reiniciar só com a sala vazia (ou com confirmação) e sem perder dado ✅; testar recusa com jogadores na sala ✅; testes de servidor real ✅; **prova do religamento pela tarefa de produção ainda não feita** (só com um agendador de mentira) |
| **3 · Câmeras ao vivo** | P88 | Assistir a várias partidas ao mesmo tempo, pelo servidor (§7): **3A e 3B (no ar, 12/10)** o contrato do **mural** (`shared/net/mural.ts`: um canal só, `/?mural=1`, 4 Hz, ~0,45 KB/s por sala, com o token do dono, sem ocupar vaga, sem subir o protocolo) e a janela de radares (`ui/CameraWall.ts`); **3C** a câmera 3D de **uma** sala por vez (`OBSERVAR(sala)`, um estado inteiro; ainda não existe) | observador não ocupa vaga nem aparece no placar; 5 salas ≈ 40 KB/s só para o Comandante |
| **4 · Campanha, arsenal e evolução** | P27, P54 | **4A e 4B (no ar, 13/10)** `sim/campanha.ts` (etapas com mapa, modo, esquadrão e meta de abates; a Sobrevivência de hoje como campanha padrão e a Operação Neon de fábrica), a janela CAMPANHA no monitor COMANDO (editar, salvar com nome, copiar link, jogar) e a faixa e o painel do fim dentro da partida; **4C — o Arsenal (no ar, 13/10):** a janela ARSENAL (armas e chassis, só leitura; a Evolução é a Sala de Controle, sem duplicar; as potências por chassi ficam como decisão do Comandante) | a campanha padrão dá o mesmo jogo de hoje; link compartilhável como o do Hangar |
| **5 · Pendências do Gemini e do Codex** | P94 | O que os dois deixaram e estão sem crédito para fechar: a branch `gemini/game-hq` (bloqueio de chassis pelo Comandante, ligado à API da fase 2), os itens `(Gemini)` do `ROADMAP` (carregamento com barra e dicas, abertura da rodada, aviso de abate, telas do online) e o que for de código das frentes C2 a C5 do Codex; **o que depende de GPU real (a homologação do C3) fica dito com franqueza** | cada item na `main`, com teste e captura, ou marcado com o motivo de não ter sido feito |

**Regras que valem para todas:** (1) cada PR traz o custo de CPU e de rede com número; (2) nada de `Math.random`, `Date.now` ou DOM na simulação (G1/G2); (3) o que o Comandante pode mexer tem teto (G4/G5) e o teto é explicado; (4) o que não funciona de ponta a ponta aparece como "em construção" (R13); (5) o servidor só ganha rota nova com token, taxa limitada e teste de servidor real.
