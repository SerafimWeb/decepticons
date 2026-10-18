# PRIVACIDADE — o que o CYBERMECH guarda de quem joga (inventário de fatos, 18/10/2026)

> **Isto não é a política de privacidade, e não é parecer jurídico.** É o inventário do que o código faz hoje, para o Comandante (e quem ele escolher) redigir a política (LGPD) **antes do lançamento**
> (P185). Cada linha foi conferida no código; quando o código mudar, este arquivo muda junto. Quem decide o texto, a base legal e o aviso ao jogador é o dono.

## 1. Quem joga como convidado (sem conta)

| Onde | O que fica | Quanto tempo | Identifica a pessoa? |
|---|---|---|---|
| **No navegador** (`localStorage`) | apelido, nível, XP, créditos, montagem, configurações, histórico das últimas 20 rodadas, fila de até 12 resumos a enviar | até o jogador limpar o navegador (a fila vence em 24 h) | não sai do aparelho, exceto os resumos abaixo |
| **Servidor de jogo, contagens** (`telemetria.json`) | **quantas vezes** cada evento aconteceu (visita, clique, jogo aberto, partida iniciada…), **por dia e por país** | 120 dias | não: só contagem; o país vem do cabeçalho da Cloudflare |
| **Servidor de jogo, resumos de rodada** (`partidas.json`) | totais por versão, modo, montagem, mapa, dia e "com conta ou convidado": rodadas, minutos, abates, mortes, quadros lentos | sem prazo (só somas) | não: o id da rodada fica 24 h em memória só para não contar duas vezes e **nunca vai para o arquivo** |
| **Servidor de jogo, memória** | o balde de taxa por IP (limite de eventos) | some em 1 h; não vai para disco | o IP existe só em memória |
| **Servidor de jogo, log** (`servidor.log`) | **o IP** nas linhas de recusa, corte e descarte por abuso ("recusa de …", "corte de …") | até o dono apagar o arquivo | **sim, o IP**: precisa constar na política e ter prazo de descarte definido |
| **Sala online** | o apelido e a montagem que o jogador escolheu, enquanto está na sala | só em memória, até sair | o apelido é digitado pelo jogador (passa por filtro) |

## 2. Quem cria uma conta (login, P174)

| Onde | O que fica | Observação |
|---|---|---|
| `contas.db`, tabela `contas` | **e-mail**, hash da senha (scrypt com sal; a senha nunca fica em texto), data de criação, marca de admin | dado pessoal direto (o e-mail) |
| tabela `sessoes` | hash do token de sessão, conta, criação e vencimento (30 dias) | o token de verdade só existe no navegador; vencidas são varridas a cada 6 h |
| tabela `progresso` | o que o navegador já guardava (apelido, nível, XP, créditos, montagem) para seguir entre aparelhos | uma linha por conta |
| tabela `atividade` (**P185, novo**) | por conta e por dia: **se abriu o jogo, quantas rodadas, quantos segundos, abates e mortes** | números **declarados pelo navegador** (métrica de produto, nunca placar nem recompensa); apagada após 400 dias |
| cópia de segurança | `VACUUM INTO` do `contas.db` a cada 6 h, na pasta de dados do servidor (só no PC do servidor) | tem tudo que a tabela tem |

**O que muda com a P185:** até aqui o servidor só guardava **contagens sem identificação**. A tabela `atividade` liga o uso do jogo (dias ativos, minutos, abates, mortes) a uma **conta** (um número, ligado ao e-mail no mesmo banco). É isso que permite saber quantos pilotos voltam (retenção D1/D7), quantos entram por dia/semana/mês e quantos minutos cada um joga. **Só vale para quem criou conta:** o convidado continua só nas contagens.

**Quem vê:** só o dono, em `/metricas` (token do dono ou sessão de admin). O bloco `usuarios` traz **só contagens**, nunca e-mail nem número de conta (o teste `server/usuarios-http.test.ts` confere que nenhum e-mail aparece). A página `/metricas/` do site é `noindex` e não tem link no menu.

## 3. Terceiros

- **Google Analytics** (`gtag`, nas páginas do site, não dentro do jogo): cidade, aparelho, tempo no site e origem do clique ficam com o Google. A tag está instalada; **consentimento e aviso de cookies não estão resolvidos** (OBSERVABILIDADE.md, item 4).
- **Cloudflare** (DNS, proxy do site e túnel do servidor de jogo): vê o IP de quem conecta, por ser o intermediário. O servidor de jogo só lê o país (`cf-ipcountry`) e o IP (`cf-connecting-ip`) que ele entrega.
- **Serafim13** (erros do cliente publicado, só nos hostnames oficiais): mensagem e pilha do erro, versão, contexto; e-mails e `?query`/`#hash` de URLs são removidos antes de enviar.
- **ElevenLabs** (vozes do narrador): só gera as falas na máquina do dono; nada do jogador vai para lá.

## 4. O que falta (decisão e trabalho do dono)

1. **Redigir a política** e a página dela, e linkar na tela de criar conta e no rodapé do site (conferido em 18/10: **nenhuma tela do jogo nem página do site fala de privacidade hoje**, e o Google Analytics já está nas páginas).
2. **Base legal e consentimento:** o que é "execução do serviço" (conta, progresso) e o que pede aviso ou consentimento (atividade por conta, Google Analytics).
3. **Direitos do titular (LGPD art. 18):** **hoje não existe** "apagar minha conta" nem "baixar meus dados" no jogo. Quem pedir hoje depende de o dono mexer no `contas.db` à mão. É o item técnico mais provável de ser cobrado: **proposta:** um botão "apagar a conta" que remove `contas`, `sessoes`, `progresso` e `atividade` da conta (uma transação), e uma exportação em JSON dos mesmos dados. Posso construir quando o dono mandar.
4. **Prazo do log com IP** (`servidor.log`): definir por quantos dias fica e apagar sozinho.
5. **Menores:** o jogo não pergunta idade; a política precisa dizer o que vale para menores de 18.
6. **Backup:** as cópias do `contas.db` também são dado pessoal (mesma retenção que o banco).
