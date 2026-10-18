# GOVERNANÇA — quem pode o quê, quem decide, e o que fazer quando dá errado (18/10/2026, ordem P196)

> Uma página para o lançamento. **Quem aprova é o Comandante.** O que o código garante está em `AUDITORIA_SEGURANCA.md`; o que o jogo guarda de cada pessoa, em `PRIVACIDADE.md`.

## 1. Privilégios: quem pode o quê

| Papel | Como se prova | O que pode |
|---|---|---|
| **Visitante** (sem conta) | nada | jogar (solo e online na Arena); mandar contagens (`/evento`) e o resumo da partida (`/partida-metricas`); ler `/status`, `/eventos/resumo` e a configuração pública (`/config`) |
| **Piloto** (com conta) | a sessão, no cabeçalho `x-cybermech-sessao` | **só a própria conta:** ver e guardar o progresso, baixar os dados, apagar a conta (com a senha), ligar ou desligar a medição da atividade |
| **Administrador** (`is_admin`) | a sessão de uma conta promovida | o que o piloto pode, **mais**: `/metricas`, o painel do servidor (`/admin/*`), o mural de câmeras e gravar a configuração global (`POST /admin/config`, só as chaves conhecidas) |
| **Dono** (a chave do servidor) | o token em `.tmp/servidor/metricas-token.txt` (cabeçalho `x-cybermech-metricas`) | `/metricas`, `/admin/*` e o mural, **sem precisar de conta**; e, por ser o dono do PC, o banco, as cópias de segurança e a ferramenta `npm run admin` |
| **Agentes de código** (Claude, Codex, Gemini, Qwen) | acesso ao repositório e ao PC do dono | o que o `AGENTS.md` permite: um branch por tarefa, PR, merge pela esteira com o `npm run check` verde; **nunca** segredo em arquivo versionado |

**Como alguém vira administrador:** **só** pelo `npm run admin -- promover <e-mail>`, no PC do servidor (a pessoa precisa ter criado a conta antes); **nenhuma rota HTTP promove ninguém**. Rebaixar: `npm run admin -- rebaixar <e-mail>`;
listar: `npm run admin -- listar`. Cada promoção e rebaixamento entra na trilha de auditoria. **Regra:** administrador é o dono e quem ele confia por escrito; piloto comum nunca.

## 2. Quem é dono de quê

| O quê | Dono | Observação |
|---|---|---|
| Os dados dos jogadores (controlador, LGPD) | **Comandante / SERAFIM WEB** | O **encarregado** (contato para os titulares) ainda **não foi informado**: arquivo `.decepticons/contato-privacidade.txt` |
| O servidor e o banco de contas | Comandante | Hoje no PC de trabalho (`AUDITORIA_SEGURANCA.md` A1) |
| O código e a esteira de publicação | Comandante; os agentes trabalham por PR | O merge só entra com o `npm run check` verde (G14) |
| A política de privacidade | Comandante (com revisão jurídica) | O texto do Claude é rascunho |
| A Amazônia / Terras Raras | a sessão do Claude que a construiu | Fechada ao público no lançamento |

## 3. Como uma regra muda

1. **Ordem do Comandante** vira linha em `ORDENS_DO_COMANDO.md` no mesmo dia (regra 17).
2. **Um branch, um PR**, com o corpo no modelo `.github/pull_request_template.md` (o que muda, custo de CPU, como testar no site).
3. **`npm run check` verde** (testes de simulação, build, fumaça, site); revisão cruzada depois do merge.
4. **Decisão relevante** vai para o topo do `HISTORICO_DE_DECISOES.md`; mudança de estado, para o `STATUS_REAL.md`; o que muda no que se guarda de uma pessoa, para o `PRIVACIDADE.md` **e** para a política (com a `POLITICA_VERSAO`).
5. **Mudança que mexe em autenticação, privilégio, auditoria ou dado pessoal** leva teste de mutação à mão nas linhas que decidem (`LANCAMENTO.md` § 5).

## 4. O que se guarda e por quanto tempo

| O quê | Prazo | Onde |
|---|---|---|
| Conta, progresso | até a pessoa apagar | `contas.db` |
| Sessões | 30 dias (até 10 por conta) | `contas.db` |
| Atividade por conta | 400 dias (ou até a pessoa desligar) | `contas.db` |
| Cópias de segurança do banco | as 14 mais recentes | `.tmp/servidor/backups/` (**no mesmo disco**: ver A13) |
| Contagens (eventos, partidas, audiência) | 120 dias por dia | `telemetria.json`, `partidas.json`, `audiencia.json` |
| Registro técnico do servidor | 30 dias | `.tmp/servidor/registro/` |
| **Trilha de auditoria** | **400 dias** | `.tmp/servidor/auditoria/` |

## 5. Quando dá errado

| Situação | O que fazer |
|---|---|
| **O servidor caiu** | Ver `/status` e o registro de hoje (`registro/`). A tarefa do Windows e o atualizador (a cada 10 min) o religam sozinhos; se não voltar em 5 min, `DEPLOY.md` § "Servidor de jogo". Sem monitor externo (A14), quem avisa é o jogador. |
| **Suspeita de que o token do dono vazou** | Apagar `.tmp/servidor/metricas-token.txt` e reiniciar o servidor (gera outro); conferir a trilha de auditoria (`/metricas/`, "Auditoria interna") por acessos que não foram seus; `npm run admin -- listar` e rebaixar quem não deveria estar. |
| **Uma conta de administrador foi comprometida** | `npm run admin -- rebaixar <e-mail>` (efeito imediato na sessão aberta); trocar o token do dono; ler a trilha do período. |
| **Vazamento de dados de jogadores** (banco, cópia de segurança, log) | **1)** conter (parar o servidor, trocar o token, tirar a cópia vazada de circulação); **2)** avaliar o que saiu e de quantas contas (a trilha e o `PRIVACIDADE.md` dizem o que existe); **3)** se houver risco relevante às pessoas, **avisar a ANPD e os titulares em prazo razoável** (a ANPD orienta **3 dias úteis**) dizendo o que aconteceu, que dados, os riscos e o que foi feito (LGPD art. 48); **4)** registrar o incidente em `HISTORICO_DE_DECISOES.md`. |
| **Um titular pede algo que o jogo não resolve** | O encarregado responde em até **15 dias** (LGPD art. 19): confirmação de que trata dados e, se pedido, declaração completa. Baixar, apagar e desligar a medição o próprio jogo já resolve. |
| **Um agente de código quebrou algo no ar** | Reverter o merge (`git revert` do PR) por um PR novo; a esteira publica sozinha. Nunca `push --force` na `main`. |

## 6. O que ainda falta (do Comandante)

Designar e divulgar o **encarregado** (e-mail em `.decepticons/contato-privacidade.txt`); ligar o **monitor externo**; copiar as **cópias de segurança para fora do PC**; mudar o **servidor para uma máquina própria**; decidir o "esqueci a senha". Detalhes e prioridade em `LANCAMENTO.md`.
