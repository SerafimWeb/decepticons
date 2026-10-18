# PRIVACIDADE — o que o CYBERMECH guarda de quem joga (inventário de fatos, 18/10/2026)

> **Isto não é a política de privacidade, e não é parecer jurídico.** É o inventário do que o código faz hoje, **a fonte de fatos do texto publicado em `cybermech.online/privacidade/`**
> (`scripts/privacidade.mjs`; versão em `POLITICA_VERSAO`, `shared/net/auth.ts`). Cada linha foi conferida no código; quando o código mudar, este arquivo, o texto da página e a versão mudam
> **juntos, no mesmo PR** (regra 13 do `AGENTS.md`). Quem decide o texto final, a base legal e o aviso ao jogador é o dono (de preferência com um advogado).

## 1. Quem joga como convidado (sem conta)

| Onde | O que fica | Quanto tempo | Identifica a pessoa? |
|---|---|---|---|
| **No navegador** (`localStorage`, `sessionStorage`) | apelido, nível, XP, créditos, montagem, configurações, idioma, escolha de cookies, histórico das últimas 20 rodadas, fila de até 12 resumos a enviar; **`cybermech.visitou`: o dia da primeira visita** (para "novo ou recorrente"); **`cybermech.origem` (aba): de onde a aba chegou** | até o jogador limpar o navegador (a fila vence em 24 h; a origem some ao fechar a aba) | não sai do aparelho, exceto os resumos abaixo; **a data da primeira visita nunca é enviada**, só a faixa |
| **Servidor de jogo, contagens** (`telemetria.json`) | **quantas vezes** cada evento aconteceu (visita, clique, jogo aberto, partida iniciada, conta criada, login…), **por dia e por país** | 120 dias | não: só contagem; o país vem do cabeçalho da Cloudflare |
| **Servidor de jogo, audiência** (`audiencia.json`, P188) | por dia: de onde a visita veio (canal: direto, busca, rede social, outro site, campanha; o nome do site e as marcas `utm_*` do link), **aparelho** (celular/tablet/computador), **navegador, sistema, idioma**, **novo ou recorrente** (faixa de dias desde a primeira visita), **estado do Brasil** (`cf-region-code` da Cloudflare, só do túnel) e o **funil por canal** (landing, clique, jogo aberto, partida iniciada e terminada, com conta ou convidado). Cada valor é uma **categoria** de lista fechada, com teto de valores por dia | 120 dias | não: só soma por categoria; o id da aba (que vem no evento) só serve para não contar o reenvio e **nunca é guardado** |
| **Servidor de jogo, resumos de rodada** (`partidas.json`) | totais por versão, modo, montagem, mapa, dia e "com conta ou convidado": rodadas, minutos, abates, mortes, onda, vitória/derrota, quadros lentos | sem prazo (só somas); dias: 120 | não: o id da rodada fica 24 h em memória só para não contar duas vezes e **nunca vai para o arquivo** |
| **Servidor de jogo, memória** | o balde de taxa por IP (limite de eventos) e o teto de conexões por IP | some em 1 h / quando a conexão fecha; não vai para disco | o IP existe só em memória |
| **Registro técnico** (`registro/servidor-AAAA-MM-DD.log`) | eventos de operação e segurança: salas, conexões, recusas, cortes. **IP mascarado** (`212.8.252.x`); **nunca o e-mail** (a linha de conta criada diz só o número) | **30 dias**, apagado sozinho (`server/registro.ts`) | a rede do IP (não a casa) |
| **`servidor.log`** (a saída que a tarefa do Windows redireciona) | só o que o Node escreve sozinho: avisos do SQLite e quedas com erro. **O de antes de 18/10 tem 22 linhas com IP inteiro e 1 e-mail** | sem rotação (o Windows não deixa apagar com a tarefa rodando) | **pendência do dono: apagar com a tarefa parada** |
| **Sala online** | o apelido e a montagem escolhidos, enquanto o jogador está na sala | só em memória, até sair | o apelido é digitado pelo jogador (filtrado) |

## 2. Quem cria uma conta (login, P174)

| Onde | O que fica | Observação |
|---|---|---|
| `contas.db`, tabela `contas` | **e-mail**, hash da senha (scrypt com sal; a senha nunca fica em texto), data de criação, **a versão da política aceita e quando**, a escolha de medir ou não a atividade, marca de admin | dado pessoal direto (o e-mail) |
| tabela `sessoes` | hash do token de sessão, conta, criação e vencimento (30 dias) | o token de verdade só existe no navegador; vencidas são varridas a cada 6 h |
| tabela `progresso` | apelido, nível, XP, créditos, montagem (o que o navegador já guardava) | uma linha por conta |
| tabela `atividade` (P185) | por conta e por dia: **se abriu o jogo, quantas rodadas, quantos segundos, abates e mortes** | números declarados pelo navegador (métrica de produto, nunca placar nem recompensa); apagada após **400 dias**; **a pessoa pode desligar** (apaga o que havia) |
| cópia de segurança | `VACUUM INTO` do `contas.db` a cada 6 h, na pasta de dados do servidor (só no PC do servidor), **as 14 mais recentes** | tem tudo que as tabelas têm; **apagar a conta tira a pessoa das cópias em até 14 dias** |

**Convidado vs conta:** o convidado continua só nas contagens (sem identificação). Só quem criou conta tem atividade registrada por conta.

**Quem vê:** só o dono, em `/metricas` (token do dono ou sessão de admin). O bloco `usuarios` traz **só contagens**, nunca e-mail nem número de conta (o teste `server/usuarios-http.test.ts` confere). A página `/metricas/` do site é `noindex` e não tem link no menu.

## 3. Os direitos do titular (LGPD art. 18): o que o código faz

| Direito | Como | Onde no código |
|---|---|---|
| Confirmação e acesso (II), portabilidade (V) | **Baixar meus dados**: um JSON com a conta, o progresso, a atividade e as sessões (datas), **sem o hash da senha, o sal nem os segredos das sessões** | `GET /conta/dados`; `Contas.exportarDados` |
| Eliminação (VI) | **Apagar minha conta**: pede a senha de novo (mesma régua de tentativas do login); apaga conta, progresso, atividade e sessões **numa transação**; a sessão morre | `POST /conta/apagar`; `Contas.apagarConta` |
| Oposição (art. 18 § 2) | **Registrar minha atividade**: desligar apaga o que havia e para de registrar (visita e rodada) | `POST /conta/medicao`; `Contas.definirMedicao` |
| Correção (III) | apelido, montagem e progresso o jogador ajusta no jogo e vão para a conta. **Corrigir o e-mail não existe** | — |
| Revogar o consentimento (IX) | cookies: "Preferências de cookies" no rodapé; conta: apagá-la | `scripts/site/tema.mjs` |
| Informação sobre o compartilhamento (VII) | a política, seção 4 | `scripts/privacidade.mjs` |
| **Aceite** (art. 8) | criar conta exige as duas caixas (política lida; 18 anos ou autorização do responsável); o **servidor recusa** sem elas ou com a política de outra versão; guarda **quando e qual versão** | `parseCriarConta`; `contas.aceite_em/aceite_versao` |

## 4. Terceiros

- **Google Analytics** (`gtag`): **só depois do "Aceitar"** na faixa de cookies do site. A escolha vale no site e no jogo (`localStorage` `cybermech.cookies`); o **jogo não tem faixa**: só carrega o Google com o "sim" guardado. Antes de 18/10 a tag era **fixa**, inclusive dentro do jogo. Cidade, aparelho, tempo no site e origem do clique ficam com o Google.
- **Cloudflare** (DNS, proxy do site e túnel do servidor de jogo): vê o IP de quem conecta, por ser o intermediário. O servidor de jogo só lê o país (`cf-ipcountry`) e o IP (`cf-connecting-ip`) que ele entrega.
- **Hostinger** (hospedagem do site estático): guarda as páginas e o jogo; não recebe contas nem progresso.
- **Serafim13** (erros do cliente publicado, só nos hostnames oficiais): mensagem e pilha, versão, contexto; e-mails e `?query`/`#hash` de URLs são removidos antes de enviar.
- **ElevenLabs** (vozes do narrador): só gera as falas na máquina do dono; nada do jogador vai para lá.

## 5. O que falta (decisão e trabalho do dono)

1. **Revisar o texto da política** (rascunho meu, a partir deste inventário) e dizer se concorda com as escolhas: **18 anos ou autorização do responsável**; **30 dias** de registro; **400 dias** de atividade; **14 dias** de backups. De preferência, com um advogado.
2. **Contato do encarregado:** um e-mail em `.decepticons/contato-privacidade.txt` (uma linha) e a **razão social/CNPJ** da SERAFIM WEB, para a seção 1 da política.
3. **Limpar o `servidor.log` antigo** (IPs inteiros e 1 e-mail): com a tarefa "CYBERMECH servidor" parada, apagar o arquivo (`DEPLOY.md` § 4c).
4. **Recuperação de senha e verificação de e-mail:** não existem; exigem um serviço de e-mail transacional (decisão e custo dele).
5. **Corrigir o e-mail da conta:** não existe (exige a verificação do item 4).
6. **Idiomas:** o painel de conta e a política só em português.
7. **Cloudflare (opcional, para o estado do Brasil nas métricas):** ligar "Add visitor location headers" (Managed Transforms) para o servidor receber `cf-region-code`; sem isso a métrica de estado fica vazia.
