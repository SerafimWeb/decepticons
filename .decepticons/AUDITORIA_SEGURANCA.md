# AUDITORIA DE SEGURANÇA — a arquitetura está segura para lançar? (18/10/2026, ordem P198)

> **Pergunta do Comandante:** *"faça auditoria se nossa arquitetura está segura para lançarmos"*. **Resposta curta:** o **código** está em condição de lançar (nada que bloqueie, depois das correções desta
> auditoria); o **que bloqueia o lançamento público é operacional e é do Comandante**: o servidor de jogo e as chaves de publicação dividem o mesmo PC de trabalho (A1), e não há cópia de segurança das contas fora
> desse PC (A13). Isto é uma auditoria **do repositório e de um servidor de teste**, feita pelo Claude: **não é teste de invasão feito por terceiro** nem cobre a Cloudflare, a Hostinger e o Windows do PC (item "o que não foi visto").

## 1. O que foi examinado e como

| Camada | Como foi examinada |
|---|---|
| **Todas as rotas HTTP** (24 caminhos: conta, progresso, dados, apagar, medição, config, métricas, partidas, eventos, status, admin) | leitura do código de cada rota: quem pode chamar, o que valida, o limite de corpo e de taxa |
| **WebSocket do jogo** | leitura do aperto de mão (`Origin`, teto por IP e total, taxa por conexão, tamanho de mensagem) e do formato binário |
| **Abuso de verdade** | **1.368 pedidos hostis** (métodos trocados, JSON quebrado, corpos de 100 KB, caminhos com `..`, `%00`, URL de 20 KB, cabeçalhos mentirosos) **+ 8 pedidos crus quebrados no socket + 7 frames de WebSocket lixo** contra um servidor de verdade: **0 respostas 5xx, 0 vazamentos de caminho ou pilha, o servidor seguiu de pé**; a origem de fora foi recusada no aperto de mão |
| **Dependências** | `npm audit --omit=dev`: **0 vulnerabilidades** |
| **Segredos** | busca por chaves e senhas nos arquivos versionados: **nenhuma** (as duas ocorrências de `xi-api-key` são o nome do cabeçalho; a chave vem de variável de ambiente); `.env*` e a pasta de dados (`.tmp/`) estão fora do git; o gancho de commit barra segredo (R2) |
| **Autenticação e sessão** | leitura de `contas.ts`, `login.ts`, `Server.ts`: hash, sessão, limites, mensagens |
| **Privilégios** | quem vira administrador, o que cada porta exige (matriz em `GOVERNANCA.md`) |
| **Cabeçalhos e CSP** | leitura de `scripts/site.mjs` (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`) |

## 2. O que já estava certo

- **O servidor é a autoridade** (G13): o cliente manda **comando**, nunca número de jogo; o formato binário já limita o alcance (eixos em 1 byte, ângulos em 2): não existe jeito de mandar um valor fora de faixa nem `NaN`.
- **Senha:** `scrypt` com sal por conta; tempo de resposta parecido para conta que existe e que não existe; a mensagem de erro do login é a mesma nos dois casos.
- **Sessão:** token aleatório de 32 bytes; o banco guarda só o resumo `SHA-256` (vazar o arquivo não dá sessão a ninguém); 30 dias; o token vai no **cabeçalho** (não em cookie): sem CSRF.
- **SQL:** todas as consultas são parametrizadas (a única que monta texto, o `VACUUM INTO` da cópia de segurança, usa um caminho interno escapado).
- **Origem:** o navegador de outro site não consegue usar o jogo do visitante para chamar o servidor (CORS devolve a origem do próprio pedido, nunca `*`, nas rotas de conta; o WebSocket recusa origem de fora).
- **Limites:** 4 conexões por IP, 400 no total, taxa por conexão com descarte (e corte só no abuso), corpos de 256 B a 10 KB, login 8 por 10 min por IP, métricas 30 por 10 min, admin 10 falhas por 10 min.
- **O servidor escuta só em `127.0.0.1`**; quem fala com ele é o túnel da Cloudflare. A tarefa roda **sem privilégio de administrador** (`RunLevel Limited`).
- **Token do dono** comparado em tempo constante (`timingSafeEqual`).

## 3. Os achados, com a decisão de cada um

**Bloqueia o lançamento público**

| # | Achado | Estado |
|---|---|---|
| **A1** | O **servidor de jogo roda no PC de trabalho do Comandante, sob o usuário dele**, junto com o repositório e **as chaves SSH da publicação do site**. Um processo comprometido alcança tudo o que esse usuário alcança. Além do risco, o PC tem 6 GB e já derrubou as conexões (17/10). | **ABERTO (Comandante).** `LANCAMENTO.md` item 8: máquina própria com um usuário sem privilégio, **sem** as chaves de publicação. Até lá, só **beta fechado** (pouca gente, sem divulgar). |
| **A13** | A **cópia de segurança das contas** (14 dias) fica **no mesmo disco** do banco. Disco quebrado, ransomware ou apagão no PC = contas perdidas, sem volta. | **ABERTO (Comandante).** Copiar `.tmp/servidor/backups/` para outro disco ou nuvem (criptografado), uma vez por dia. |

**Corrigido nesta rodada**

| # | Achado | Correção |
|---|---|---|
| **A2** | `GET /config` (**pública**) entregava **qualquer** chave guardada e `POST /admin/config` gravava **qualquer** chave e valor. Hoje só há uma chave (`chassis_status`), mas bastava o dono guardar outra um dia. | **Lista branca de chaves** (`CONFIG_CHAVES`), valor sempre JSON de até 4 KB, mudança e recusa entram na trilha de auditoria. |
| **A3** | O limite de login era **só por IP**: quem tenta adivinhar a senha de **uma** conta com muitos IPs passava. | **Limite por conta:** 10 senhas erradas em 15 min trancam a conta (429, mesmo com a senha certa); vale também para o "apagar a conta" e para e-mail que não existe. |
| **A4** | **Sessões ilimitadas** por conta (login repetido acumulava linhas sem fim). | **Teto de 10 sessões** por conta; as mais velhas saem. |
| **A5** | **Nenhuma trilha de auditoria** ("quem apagou essa conta?", "alguém tentou entrar no painel?"); o log tinha **e-mail e IP inteiro**. | **Trilha de auditoria** (`server/auditoria.ts`, 400 dias, só o número da conta, nada de e-mail nem IP) mostrada no `/metricas/`; log com IP mascarado e sem e-mail (P192). |
| **A6** | **Administrador só por SQL manual**, sem registro. | **`npm run admin -- promover <e-mail>`** é o único caminho (nenhuma rota promove ninguém); promoção e rebaixamento entram na trilha. |
| **A7** | O **Google Analytics carregava sempre, até dentro do jogo**, e gravava cookie sem consentimento. | Só depois do "Aceitar" (P192); no jogo, só com o "sim" guardado. |

**Risco aceito para o lançamento (com o porquê)**

| # | Achado | Por que aceito |
|---|---|---|
| **A8** | Criar conta com e-mail que já existe responde "este e-mail já tem conta" (revela que existe). | Padrão da indústria e necessário para o jogador entender; o login **não** revela; o limite por IP encarece a varredura. |
| **A9** | **Sem verificação de e-mail e sem "esqueci a senha"** (não há serviço de e-mail). | Decisão do Comandante (`LANCAMENTO.md` item 3): contratar um serviço, **ou** lançar avisando que a senha não se recupera. Sem verificação, alguém pode criar conta com o e-mail de outro (sem consequência hoje: a conta guarda só progresso de jogo). |
| **A10** | Métricas e relatórios de partida são **declarados pelo navegador** e podem ser forjados. | Não valem placar nem recompensa (G13); medem produto. |
| **A11** | A CSP tem `'unsafe-inline'` (as páginas têm scripts inline). | Todo texto de jogador passa por escape ou `textContent`; o jogo é estático e não mostra conteúdo de terceiros. Plano: trocar por hashes depois do lançamento. |
| **A15** | O bloqueio dos mapas fechados (Bunker, Terras Raras) é **de produto**: `?comandante=1` abre. | O jogo roda no navegador de quem joga; o bloqueio só evita que alguém esbarre no que não foi anunciado. |
| **A16** | A tranca por conta permite **negar o acesso por 15 min** a quem for alvo de erros propositais. | É o preço dessa defesa; com o teto por IP (8 em 10 min) custa vários IPs. |

**Recomendações do Comandante (não bloqueiam)**

| # | O quê | Como |
|---|---|---|
| **A12** | **HSTS** está desligado. | Na Cloudflare: "Always Use HTTPS" + HSTS (depois de conferir que nada do site depende de HTTP). |
| **A14** | **Sem monitor externo**: o Comandante só sabe que o servidor caiu quando alguém avisa. | Um monitor gratuito (UptimeRobot ou parecido) em `https://jogo.cybermech.online/status` e no site, com aviso por e-mail ou celular. |
| **A17** | O **token do dono** é um só e vale em `/metricas`, `/admin/*` e no mural. | Para trocar: apagar `.tmp/servidor/metricas-token.txt` e reiniciar o servidor gera outro. Trocar se alguém que o conhecia sair. |
| **A19** | O **`servidor.log` antigo** tem IPs inteiros e 1 e-mail (de antes de 18/10). | Com a tarefa parada, apagar o arquivo (`DEPLOY.md` § 4c). |

## 4. O que não foi visto

A **Cloudflare** (regras, WAF, túnel), a **Hostinger** (a conta, o SSH, as permissões das pastas), o **Windows do PC** (atualizações, antivírus, quem mais usa a máquina) e **teste de invasão por terceiro**. Antes de divulgar em larga escala,
vale **um teste de invasão pago**; para o lançamento pequeno, esta auditoria mais os itens A1 e A13 resolvidos é o mínimo honesto.

## 5. Como repetir

- Abuso: `node .decepticons/medicoes/abuso-servidor.mjs` (da raiz do projeto; sobe um servidor de teste na porta 2597, dispara os pedidos hostis e o derruba; sai com código 1 se o servidor cair, vazar pilha ou aceitar origem de fora). `FERRAMENTAS.md` § 4.6.
- Dependências: `npm audit --omit=dev`.
- Os testes de segurança de acesso: `server/seguranca.test.ts`, `server/lgpd-http.test.ts`, `server/conta-http.test.ts`, `server/origem-http.test.ts`, `server/guard.test.ts`.
