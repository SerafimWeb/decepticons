# ESTADO ATUAL — CYBERMECH

> **Arquivo:** o que tem mais de dois dias mora em `.decepticons/arquivo/estado-*.md` (nada se perdeu; `npm run arquivar` move mais). Procure por busca, não leia inteiro.


## O "ESQUECI A SENHA": LINK POR E-MAIL, PÁGINA PRÓPRIA E SEM CNPJ NA POLÍTICA — Claude, 18/10 (branch `claude/esqueci-a-senha`, P206)

**O Comandante (18/10):** *"faça o esqueci a senha; não vamos dar CNPJ por enquanto pois não temos e o jogo é indie, feito por uma pessoa apenas"*.

**O que entrou:**
1. **O pedido** (`POST /conta/esqueci`): responde **202 igual exista a conta ou não** e **antes** do trabalho (banco e envio), então nem o texto nem o tempo dizem se o e-mail tem conta. Limites: **5 por hora por IP**, **3 por hora por conta** e **50 e-mails por dia** no total (a cota grátis do Resend é 100). Sem e-mail configurado: 503 `sem-email` e o jogo diz para pedir ajuda pelo contato da Privacidade.
2. **O link:** 32 bytes aleatórios; o banco guarda só a **impressão digital (SHA-256)**; vale **30 min** e **uma vez**; um pedido novo cancela o anterior. Ele vai **depois do `#`** (`/redefinir/?lang=pt#TOKEN`): o fragmento não vai a servidor nenhum nem no Referer.
3. **A troca** (`POST /conta/redefinir`): confere o link, grava a senha nova (scrypt, sal novo) e **encerra todas as sessões da conta**; duas trocas com o mesmo link ao mesmo tempo, só uma passa. **Não entra sozinho:** manda voltar ao jogo e entrar com a senha nova.
4. **A página `/redefinir/`** (`scripts/redefinir.mjs`, sete línguas, `noindex`, **sem Google nem cookies**): tira o token da barra de endereço ao abrir, valida a senha, e mostra a frase certa para link vencido, limite e servidor fora do ar. Provada no navegador sem rede de verdade (`site --check`).
5. **No jogo:** "Esqueci a senha" no painel de login (modo novo, sem aba nem botão primário a mais), nas 6 línguas.
6. **E-mail:** `server/email.ts` (provedor trocável; o Resend por `fetch`, sem biblioteca; chave só em `.tmp/servidor/email.json` ou `CYBERMECH_EMAIL_CHAVE`, nunca no git), textos em 7 línguas.
7. **Sem e-mail ainda? `npm run admin -- link-senha <e-mail>`** gera o mesmo link (30 min, uso único) para o Comandante entregar à pessoa.
8. **Auditoria:** `senha_recuperacao_pedida`, `senha_redefinida`, `link_senha_gerado`, com o número da conta, nunca o e-mail nem o token. **Política:** o controlador agora é "uma pessoa física, sem empresa nem CNPJ por ora"; nova linha na tabela e o Resend como destinatário (EUA).

**Provas:** 22 testes do fluxo com o servidor de verdade (pedir → e-mail → trocar → senha velha falha, sessão antiga cai, link não serve duas vezes; resposta igual com e sem conta; limites; auditoria sem o e-mail; falha do provedor) + 5 do cliente; **5 mutações à mão pegas** (sem prazo, sem encerrar as sessões, vários links por conta, sem a trava de uso único, limite por conta frouxo).

**Falta (dele):** ligar o envio de e-mail: conta no Resend, verificar o domínio `cybermech.online` e guardar a chave (`LANCAMENTO.md § 7`). **Até lá**, o jogo avisa que a recuperação por e-mail não está ativa e o `link-senha` resolve na mão. **Não feito:** e-mail de aviso "sua senha foi trocada" (boa prática; entra com o envio ligado) e o nome da pessoa na política (a LGPD pede a identidade do encarregado; ele decide).

**Próxima sessão começa com:** a leitura do Google Analytics no `/metricas/` (falta o ID numérico da propriedade) e a limpeza do `servidor.log` antigo.

## O CHAT DE VOZ: ÁUDIO DIRETO ENTRE OS JOGADORES, SEM SERVIDOR DE MÍDIA, SEM CUSTO E PROVADO EM CHROME DE VERDADE — Claude, 18/10 (branch `claude/voice-chat`, P205)

**O Comandante (18/10):** trouxe o plano do VOICE CHAT (microfone aberto + apertar-para-falar, áudio espacial, canais ALL + TEAM, TURN a critério técnico) e, ao mandar seguir: *"quero q seja simples, sem custo inicial e eficiente"*.

**O que entrou** (`VOICE_CHAT.md` tem tudo, inclusive onde o código **difere do plano** e por quê):
1. **A voz vai direto de um navegador ao outro** (WebRTC, malha); o servidor **só repassa** a oferta e a resposta (`server/voz.ts`: 3 mensagens 30–32, o remetente é trocado pelo id de verdade, SDP conferido, teto de 30 mensagens por 10 s). **Não sobe o protocolo**, não toca no tick, não gasta banda do jogo.
2. **Sem custo:** só o STUN público do Google (**sem TURN**: quem tem rede que barra a conexão direta fica sem voz e a tela diz "N SEM CONEXÃO"). Opus a 24 kbps **com DTX no SDP** (o plano supunha que viria sozinho: não vem).
3. **Cliente** (`client/src/voice/`): microfone aberto com **T alternando o mudo**, ou **segurar T** (modo nas Configurações, tecla trocável); voz espacial (volume cheio até 12 m, some em 160 m, `equalpower`); quem recusa o microfone **entra como ouvinte**; reconexão da sala refaz a voz sem pedir o microfone outra vez. Indicador no canto de baixo à esquerda, seção CHAT DE VOZ nas Configurações, tudo nas 6 línguas. **Pedaço sob demanda** (3,5 + 0,7 KB gzip, só baixa quem liga a voz numa sala): o JS de partida ficou em **495,4 de 500 KB**.
4. **Nasce RESTRITA** (`tela:voz`, regra do P191): só o modo Comandante (`?comandante=1`) vê e usa até o painel de visibilidade soltar; **é também a chave de desligar** sem republicar.

**Provas:** bancada em **Chrome de verdade** (`medicoes/voz.mjs`, 26 verificações: o áudio chega nos dois sentidos, mudo e PTT cortam, **a 100 m cai a 0,40 e a 200 m some**, recusa vira ouvinte, microfone tardio entra sem renegociar, **falando ~50 pacotes/s e calado ~5 com o DTX**) + a captura do jogo real (`arte/voz-hud-jogo-claude.png`); testes de unidade, de sala e da sessão contra o servidor de verdade; **33 de 34 mutações à mão pegas** (a 34ª virou teste).

**Falta (R13):** (a) **o ouvido do Comandante** (a bancada prova que o áudio chega e o volume cai; se soa bem é dele); (b) **dois aparelhos em redes diferentes** (a bancada liga dois Chrome na mesma máquina); (c) **canal TIME** (o protocolo online não tem time; entra com o CTF online); (d) **mudo por jogador**; (e) **ANTES DE LIBERAR `tela:voz`: a política de privacidade** — a voz mostra o IP aos outros jogadores da sala e o STUN do Google o recebe; o texto pronto, a troca de `POLITICA_VERSAO` e o `PRIVACIDADE.md` estão em `VOICE_CHAT.md` § 4; (f) TURN próprio só se um jogador real reclamar.

**Próxima sessão começa com:** o veredicto do Comandante (testar com dois navegadores em `?comandante=1`); depois o canal TIME junto com os times online, ou o que ele mandar.

## O SERVIDOR AVISA ANTES DE REINICIAR: TELA COM CONTADOR, E O JOGO INSISTE EM VOLTAR — Claude, 18/10 (branch `claude/aviso-de-reinicio`, P204)

**O Comandante (18/10):** *"será que temos que adicionar uma imagem dizendo que estamos reiniciando o servidor ou em manutenção (e dizer se temos previsão de retornar, atualizado automaticamente, com um contador na tela, e se for reinício do servidor, dizer que volta em 1 ou 2 minutos? ou potencialmente mais?)"*. Sim, e entrou.

**O que entrou:**
1. **O servidor avisa e só então corta** (`server.fecharComAviso`, usado pelo painel e pela atualização automática): com gente na sala manda o aviso `AVISO` (mensagem nova, `shared/net/messages.ts`; cliente antigo a ignora, **sem mudar o protocolo**), espera **10 s** (`REINICIO_AVISO_S`) e corta com o código **4010** e o tempo previsto de volta (**60 s**, `REINICIO_VOLTA_EM_S`: medi 16 a 50 s nos deploys de hoje). Sem ninguém, reinicia na hora.
2. **A tela** (`ui/ConnectionNotice.ts`, frases em `ui/avisoDeConexao.ts`, nas 6 línguas): "ATUALIZAÇÃO DO SERVIDOR · corte em 0:07"; depois do corte "SERVIDOR REINICIANDO · volta em ~0:58" descendo; passou da previsão, "DEMORANDO MAIS QUE O PREVISTO · fora há …"; queda sem aviso (PC, internet, túnel) "CONEXÃO PERDIDA · fora há …", e **depois de 30 s o botão "JOGAR OFFLINE ENQUANTO ISSO"**. Quem nunca entrou na sala não ganha a tela (cai no offline em ~19 s, como sempre).
3. **A insistência:** antes o jogo desistia em ~15 s e pedia para recarregar; agora quem já estava na sala tenta de novo **a cada 5 s por até 10 minutos** (`PERSISTENCIA_PADRAO_MS`) e volta sozinho.

**Provas:** 4 testes novos no `online.test.ts` (aviso → corte 4010 → previsão → volta sozinho; queda sem aviso desiste só no fim da persistência; quem nunca entrou não insiste; sala vazia não espera), 1 no codec, 8 das frases; **2 mutações à mão pegas** (tirar a trava de "já entrou" e nunca insistir). **Ponta a ponta no Chrome contra um servidor local** (`medicoes/aviso-reinicio.mjs`, 8 de 8): o aviso conta 0:07, depois do corte 0:58, o servidor volta e a tela some sozinha, a queda sem aviso mostra o botão offline com 35 s. Capturas em `.decepticons/arte/aviso-reinicio-*-claude.jpg`.

**Falta:** ver num reinício de produção de verdade (o próximo deploy com gente na sala); um aviso de **manutenção agendada** escrito pelo dono (hoje só o reinício é anunciado); o aviso na landing do site (a Hostinger não sabe do servidor).

**Próxima sessão começa com:** o "esqueci a senha" e a leitura do Google Analytics nas métricas (ordem P204).

## OS DOCUMENTOS FICARAM 6× MAIS LEVES, O MONITOR É O DA CLOUDFLARE E A CHAVE DO GOOGLE JÁ FUNCIONA — Claude, 18/10 (branch `claude/arquivar-docs`, P203)

**O Comandante (18/10):** *"ARQUIVAR"*; não conseguiu criar o monitor no UptimeRobot e perguntou se é grátis e se o sistema do Telegram (serafim13, BatBot) já não serve; ativou a Google Analytics Data API e deu a conta de serviço; perguntou se vale formatar um PC velho como servidor ou contratar uma VPS; e mandou prosseguir.

**O que entrou:**
1. **`npm run arquivar`** (`scripts/arquivar-docs.mjs`, teste em `server/arquivarDocs.test.ts`): o que tem mais de dois dias do `ESTADO_ATUAL` e do `HISTORICO` foi para `.decepticons/arquivo/` (um arquivo por quinzena). **ESTADO 641 → 152 KB, HISTORICO 645 → 70 KB.** Provado nos documentos de verdade: **0 linhas perdidas** (cada linha não vazia do original está no vivo ou no arquivo) e o painel dá os mesmos números (361 decisões, 393 leituras, 111 pedidos); ele agora lê o vivo e o arquivo. A seção "EM BRANCH" ficou só com a tabela. `AGENTS.md` manda ler **só o topo** e escrever curto (ordem em ~600 caracteres, sessão em ~25 linhas). A `ORDENS` (192 KB) ficou: 123 KB dela são das últimas 48 h, e o remédio ali é a linha curta, não arquivo.
2. **Monitor:** o UptimeRobot grátis dá 50 monitores a cada 5 min **só com e-mail** (o Telegram é de plano pago; e o grátis é, pelos termos de terceiros, para uso não comercial). O sistema do Telegram do serafim13 **não serve para isto**: o `serafim-watchdog` roda **a cada 6 h** pelo GitHub Actions (a detecção levaria até 6 h, e o GitHub Actions está sem pagamento, ao menos no repositório do jogo), e o BatBot é outro produto (varredura de segurança de clientes). **Recomendado: o "Tunnel Health Alert" da própria Cloudflare** (grátis, e-mail, sem conta nova): passo a passo em `LANCAMENTO.md § 6A`.
3. **Chave do Google:** o arquivo é válido e o **Google aceitou a conta** (emitiu o token); falta só o **ID numérico da propriedade** para a leitura dos dados (`LANCAMENTO.md § 6C`).
4. **Servidor em outro computador:** medido, o servidor é leve (100 jogadores ≈ 26% de **um** núcleo, 375 MB, 4,4 KiB/s por jogador): o PC velho não precisa ser bom, mas **não é para fazer agora** (`LANCAMENTO.md § 6D`).

**Falta (dele):** o ID da propriedade do Analytics; o alerta de túnel na Cloudflare; razão social/CNPJ e nome do encarregado; "esqueci a senha"; 5 a 10 pessoas de fora. O `servidor.log` antigo segue como estava (precisa parar o processo do servidor).

**Próxima sessão começa com:** o ID da propriedade do Analytics (conferir a leitura e, se ele quiser, ligar os números no `/metricas/`); senão, as métricas dos primeiros jogadores de verdade.

## O PRIMEIRO TESTE ONLINE: OS BOTS DIFÍCEIS DEMAIS, AS REGRAS NO PAINEL E O "PROBLEMA" QUE ERA O PC — Claude, 18/10 (branch `claude/regras-online`, P201 e P202)

**O Comandante (18/10), depois de jogar online com uma pessoa da internet:** *"achamos MUITO DIFÍCIL os bots inimigos… não conseguimos trocar direito devido à pressão adversária… precisamos melhorar a logística de controlar esse tipo de coisa através do painel admin que só eu tenho"*; e a janela do servidor marcava PROBLEMA ("atraso do laço (p99) 107,9 ms").

**1. A causa dos bots difíceis (achada no código):** a sala online usava o padrão de uma partida solo (3 Mechs e 2 andróides, dificuldade normal) e **a sala não aplicava o limite de atacantes** (`maxAttackers` ficava infinito): **todos os bots atacavam duas pessoas ao mesmo tempo**. É o oposto do jogo solo, que limita a 2.
**2. O que mudou:** o padrão online agora é **de iniciante** (fácil, 2 Mechs, 1 andróide, 1,5 atacantes juntos) e **o dono ajusta no painel**: janela SERVIDOR → **[ REGRAS DAS SALAS ]**: dificuldade, Mechs, andróides, pressão; receitas INICIANTE / PADRÃO / DESAFIO; **APLICAR** vale na hora nas salas de pé (dificuldade, pressão e Mechs; os andróides valem nas salas novas). Guardado no servidor (`regras-online.json`), sobrevive ao reinício. **Porta:** só a chave do dono ou a sessão de uma conta admin (`PAINEL_ADMIN.md` § 7).
**3. O "PROBLEMA" do painel não era o servidor** (`server/admin.ts`): o Node demorou a olhar a fila porque o **PC estava saturado** (as compilações, os testes das duas sessões, o navegador); o TESTAR, com gente de mentira, deu 15,8 ms. **Agora, numa janela sem ninguém jogando, o atraso do laço vira aviso (não problema)** e o painel diz que foi outro programa; com gente jogando vale a régua inteira.

**Provas:** 5 testes (o padrão de iniciante e as receitas, o que vem de fora é puxado para os limites, o armazém em arquivo e o aviso às salas, a sala nova e a sala de pé aplicando, as rotas do dono com o servidor de verdade: 401 sem chave, o POST puxa para os limites e o GET devolve o que vale).

**Falta (R13):** **não vi a janela REGRAS DAS SALAS no navegador** (testes, tipos e o servidor de verdade, sim): o Comandante confere; **o efeito sobre o jogo online (a sensação de dificuldade) é do Comandante julgar**: os números de iniciante são proposta; falta escalar por quantidade de gente, ajustar **por sala** e o dano dos bots; os andróides só mudam nas salas novas; a conta "superadmin" é o `is_admin` que já existia (nenhum papel novo).

**Onde o Comandante confere:** jogue online (`ARENA`), abra `?comandante=1` → COMANDO → SERVIDOR → **[ REGRAS DAS SALAS ]**, escolha INICIANTE ou DESAFIO e APLICAR: a sala de pé muda sem reiniciar.

**Próxima sessão começa com:** o que o Comandante julgar depois do segundo teste online.

## AS PENDÊNCIAS DO LANÇAMENTO: O QUE O COMANDANTE DECIDIU, O E-MAIL DO ENCARREGADO E O PASSO A PASSO DO QUE SÓ ELE FAZ — Claude, 18/10 (branch `claude/pendencias-lancamento`, P199 e P200)

**O Comandante (18/10), respondendo à lista do que faltava:** manter o servidor neste PC por ora (ele está terminando o jogo para deixar o PC só como servidor); o e-mail do encarregado é `volkov@serafimweb.com`; quer as orientações da Cloudflare e como criar a chave do Google; "já estou divulgando, conclua as pendências"; e pediu para manter tudo limpo, enxuto e com boas práticas, perguntando se a contagem de "mais de 3.500 testes" estava duplicada e se há algum bug que torna as conversas longas e caras.

**O que entrou:**
1. **O e-mail do encarregado** em `.decepticons/contato-privacidade.txt` (versionado): a política `/privacidade/` passa a mostrá-lo nos dois lugares em que o contato aparece.
2. **`LANCAMENTO.md § 6`:** o passo a passo do monitor externo (A14), da Cloudflare (estado do visitante e HSTS) e da chave de serviço do Google, com o estado de cada pendência.
3. **A contagem de testes está certa, não duplicou:** o Vitest rodou **3.284 testes em 310 arquivos** (o check de hoje, antes do #385); o site mostra 3.265 (sala de controle) e 3.252 (oficina) porque cada página conta as linhas `it(` com uma regex um pouco diferente; são 312 arquivos de teste e os 7 nomes repetidos estão em pastas diferentes. **"3.500" não aparece em nenhuma página nem documento** do repositório.
4. **Por que as conversas pesam (medido, não é bug de código):** os 5 documentos vivos somam **1,7 MB** (`ESTADO_ATUAL` 638 KB e 3.134 linhas, `HISTORICO` 645 KB e 3.852, `ORDENS` 192 KB, `STATUS_REAL` 156 KB, `ROADMAP` 90 KB); cada PR edita os cinco e briga no topo com os outros agentes; o check do push roda em silêncio de 6 a 10 min numa máquina compartilhada e reprova por carga. **Proposta, que espera o "pode" dele:** arquivar o que tem mais de 30 dias em `.decepticons/arquivo/` (o painel lê ESTADO e HISTORICO e passaria a ler o arquivo também).
5. **A regra de higiene (P200)** entrou no R17 do `AGENTS.md`: o que ficou sem uso na área que o PR tocou sai no mesmo PR.

**Não feito, e por quê:** o `servidor.log` antigo (1 e-mail e 16 IPs de rede) **segue como estava**. O Windows o trava com o servidor no ar (EBUSY) e **parar a tarefa não derruba o servidor** (verificado: o uptime não zerou; ele sobe por um ajudante do WMI). Nada foi alterado e o servidor não foi reiniciado. O servidor novo não escreve nada pessoal nesse arquivo.

**Falta (dele):** conta no monitor externo; ligar a opção na Cloudflare; a chave do Google; razão social/CNPJ e o nome do encarregado na política; "esqueci a senha" (sem serviço de e-mail, lança avisando que a senha não se recupera); 5 a 10 pessoas de fora.

**Próxima sessão começa com:** o "arquivar" do Comandante, se vier; senão, olhar as métricas dos primeiros jogadores de verdade.

## O PAINEL DE VISIBILIDADE: O QUE OS JOGADORES VEEM E O QUE FICA EM TESTE — Claude, 18/10 (branch `claude/visibilidade`, P191)

**O Comandante (18/10):** *"um painel COMPLETO DE TUDO… pra eu poder selecionar o que os jogadores normais veem na tela (quais robôs, armas, fases, detalhes) e quais eu mantenho secretos/restritos ao admin, em estágio de teste… (tipo o botão "lado", "arquivo")"*.

**O que entrou** (`PAINEL_ADMIN.md` § 6): um **catálogo de funcionalidades** (fases, modos, botões e telas, **todos os robôs e todas as armas**) com um padrão `publico` ou `restrito`; o **servidor** guarda as exceções (`visibilidade.json`, sobrevive ao reinício; `GET /visibilidade` público, `POST /admin/visibilidade` só com a chave do dono); o **jogo** aplica (o restrito some para o jogador e aparece com o selo TESTE para o Comandante; link de fase ou modo restrito volta ao padrão); o **painel** (chip VISIBILIDADE ▸, só no modo Comandante): lista de tudo, PÚBLICO | RESTRITO em cada linha, SALVAR PARA TODOS, SÓ NESTE NAVEGADOR, VER COMO JOGADOR, RESTAURAR PADRÕES.

**Fusão com o lançamento (PR #384, outra sessão):** o `Lancamento.ts` dela (a lista fixa de dois mapas) **agora pergunta ao catálogo**: a Cidade Neon e a Estação dos Cabos nascem públicas, o Bunker e a Terras Raras restritos, e **o painel é quem libera um mapa** (sem código). O pino "EM BREVE", o filtro das campanhas e o link que cai na Cidade Neon dela seguem iguais.

**Mudança de comportamento a saber:** **ARQUIVO, ESCOLHA O LADO e RELATÓRIO agora nascem RESTRITOS** (são os exemplos que o Comandante deu de "em desenvolvimento"): o jogador normal **não os vê mais** até o Comandante os liberar no painel (modo Comandante: `?comandante=1`, chip VISIBILIDADE ▸, trocar para PÚBLICO, SALVAR PARA TODOS). Tudo o mais continua como estava (público).

**Provas:** testes do contrato, do armazém em arquivo, das rotas com o servidor de verdade (401 sem chave, 400 com lixo, o que o dono grava aparece no GET), do catálogo (todo robô e toda arma do jogo está nele; o que está em desenvolvimento nasce restrito), da visibilidade (jogador × Comandante, exceção do servidor, cache, falhas de rede, link de fase restrita, DOM) e do painel (só as exceções vão ao servidor).

**Custo:** zero no laço do jogo; uma consulta HTTP ao abrir (1,5 s no máximo, sem travar). O painel é pedaço sob demanda.

**Falta (R13):** **não é cadeado** (quem ligar o modo Comandante vê tudo); **os modais do console de comando** (Potências, Arsenal, Campanha, Mesa, Servidor) ainda não estão no catálogo; a mudança chega ao jogador **na próxima abertura do jogo**; o painel foi **visto no navegador** (`arte/visibilidade-painel-claude.png`), mas o **SALVAR PARA TODOS contra o servidor de produção** só foi exercitado com o servidor de teste (a chave do dono é do Comandante); a lista de robôs mostra os nomes do jogo (VECTOR-09…); só as funcionalidades catalogadas são controláveis.

**Onde o Comandante confere:** `…/jogar/?comandante=1` → **EXPLORAR HANGAR E MODOS ▸** → chip **VISIBILIDADE ▸** (amarelo, no canto de cima). Troque algo para RESTRITO, **VER COMO JOGADOR**, e depois **SALVAR PARA TODOS** (precisa da chave do dono: a janela SERVIDOR guarda).

**Próxima sessão começa com:** o que o Comandante julgar; depois o objetivo na tela dos outros modos e mapas (P190) e a Praia abaixo de 60 fps (P188).

## O LANÇAMENTO: AUDITORIA DE SEGURANÇA, PRIVILÉGIOS, TRILHA DE AUDITORIA, GOVERNANÇA E OS MAPAS FECHADOS — Claude, 18/10 (branch `claude/lancamento-seguranca`, P196 a P198)

**O Comandante congelou o escopo** (`LANCAMENTO.md`) e pediu: acesso, privilégio, autenticação, auditoria interna, observabilidade, governança, **lançar só com CIDADE NEON e ESTAÇÃO DOS CABOS**, "Rio Vivo" virar "Terras Raras" e **uma auditoria de segurança**.

**O que entrou:**
1. **`AUDITORIA_SEGURANCA.md`:** 1.368 pedidos hostis contra um servidor de verdade (0 falhas, `.decepticons/medicoes/abuso-servidor.mjs`), `npm audit` (0 vulnerabilidades), segredos, rotas, autenticação, privilégios. **Conclusão: o código está em condição de lançar; o que bloqueia o público é operacional e do Comandante: A1 (servidor e chaves de publicação no mesmo PC de trabalho) e A13 (cópia das contas no mesmo disco).**
2. **Corrigido:** a configuração global só aceita chaves conhecidas; **limite de falhas por conta** (10 em 15 min, login e apagar); **teto de 10 sessões** por conta; **trilha de auditoria** de 400 dias, sem e-mail nem IP, na seção "Auditoria interna" do `/metricas/`; **`npm run admin`** como único caminho para administrador.
3. **`GOVERNANCA.md`:** a matriz de privilégios, quem é dono de quê, como uma regra muda, o que se guarda e por quanto tempo, e o que fazer quando dá errado (servidor caído, token vazado, vazamento de dados com o aviso à ANPD).
4. **Mapas do lançamento:** só CIDADE NEON e ESTAÇÃO DOS CABOS livres; **Bunker e TERRAS RARAS "EM BREVE"** (o modo Comandante abre todos). O renome de "Rio Vivo" para "Terras Raras" outra sessão já tinha feito (P187): aqui só se conferiu que nada ficou para trás.

**Provas:** 16 testes de segurança de acesso com o servidor de verdade; **mutação à mão: 20 de 20** (só na segurança de acesso, por ordem do Comandante); 6 testes do bloqueio de mapas; o abuso medido.

**Falta (do Comandante, para o lançamento público):** o **servidor fora do PC de trabalho** (A1), a **cópia de segurança fora do PC** (A13), o **monitor externo** (A14), o **encarregado** e a política revisada, o **"esqueci a senha"**, o **HSTS** na Cloudflare e o **teste com 5 a 10 pessoas de fora**.

**No ar (conferido em 18/10, 15:08):** PR #384 na `main` (b2c6f3e); o atualizador religou o servidor no código novo e o site foi publicado e conferido por soma. Ao vivo: `GET /config?chave=segredo` → 400 (a conhecida segue 200), `/metricas` sem o token → 401 e **com o token traz o bloco `auditoria`** (o acesso do dono e a recusa do anônimo já aparecem). O atualizador recusou o deploy **duas vezes** nesse dia por `server/estudio.test.ts` (preparo acima dos 10 s do Vitest com a máquina ocupada): o `hookTimeout` agora é 30 s como o `testTimeout`.

**Próxima sessão começa com:** o que o Comandante decidir sobre o servidor (item 8 de `LANCAMENTO.md`); nada novo antes disso.

## TERRAS RARAS: O JOGO FICOU 2,5× MAIS RÁPIDO, A MISSÃO COMEÇA PERTO E O OBJETIVO ESTÁ NA TELA — Claude, 18/10 (branch `claude/terras-raras`, P187 a P190)

**O Comandante (18/10), depois de jogar:** *"ficou meio travado, pesado… será que há muitos elementos na fase? […] demorou mais de um minuto pra eu chegar correndo lá […] temos que melhorar a descrição dos objetivos da missão na própria tela […] temos sempre que corrigir e melhorar o DESEMPENHO"* e *"mude o nome do rio vivo pra terras raras"*.

**1. O que travava (medido, não suposto).** Criei a bancada na GPU de verdade (`medicoes/amazonia-gpu.mjs`, AMD Vega 11, **a janela dele: 1549×925 a 1,25× = 1936×1156 pixels**), mediu-se cada coisa por vez:
- **Cenário não era o culpado:** com as árvores, o terreno, a água, o céu e as estruturas **todos escondidos**, o quadro só ganhava ~2 ms (de 14 a 12). 6.594 árvores, 2,4 km de mapa e 221 mil triângulos cabem folgados.
- **O culpado: o MSAA 4× do alvo HDR do composer** (`Game.ts`): **~17 dos 27 ms de cada quadro**. O bloom, o cobertor de ondas e o tone mapping desenham tela cheia *dentro* do alvo multiamostrado e cada um paga a resolução das amostras. **Valia para todos os mapas:** a Arena também dava 22 fps na qualidade Alta.
- **A troca:** o alvo HDR sem MSAA e um **FXAA** de uma passada depois do tone mapping (`fx/Fxaa.ts`). **Visualmente equivalente** (comparei recortes lado a lado). Custo do FXAA: ~1,5 ms.
- **Resultado (a janela dele, qualidade Alta):** **Amazônia 27 → 66 fps** (o render do quadro, de 24-27 ms para 10,5 ms), **Arena 22 → 61 fps**, **Praia 25 → 47 fps**. Na qualidade Automática (a padrão) o jogo se estabilizava em 35 a 63 fps com engasgos de 64 ms (p95); agora a Alta já segura 60+.
- **Mais um degrau na qualidade automática** (`core/Quality.ts`): depois de 1,0× e de desligar o bloom, **0,75×** (para GPU integrada mais fraca que a dele).

**2. O mapa é grande demais para uma missão de poucos minutos: o posto avançado.** O jogador nascia na aldeia (x = -960) e o primeiro gerador ficava a 920 m: **100 s de corrida**. Agora ele nasce e renasce num **posto avançado** (`AMAZONIA_POSTO_AVANCADO`, x = -300, na margem sul): **360 m da cerca = ~40 s**, fora do alcance das torres (a mais perto fica a 205 m, elas atiram a 170); a **Resistência** nasce junto. A aldeia segue sendo o que o Draga ameaça (a barra da aldeia continua). O Deathmatch da Amazônia mantém os pontos de sempre. Teste: o posto está em terra firme, fora do alcance das torres e a menos de 450 m da cerca.

**3. O objetivo na tela** (`environment/AmazoniaObjetivos.ts`, no pedaço sob demanda da Amazônia): **uma ordem no topo** (`DERRUBE OS GERADORES · 1 DE 3`, depois `DERRUBE O DRAGA-01`), **uma dica** logo abaixo (`Siga o marcador: CERCA, a 320 m.` / `A Resistência planta a carga: 45%. Proteja-a ou derrube o Draga a tiro.`) e **marcadores no mundo**: um losango sobre cada gerador (o mais perto, maior e pulsando, com nome e distância; os outros só o losango), sobre o Draga e sobre a escotilha aberta; **fora da tela o marcador gruda na borda com uma seta** apontando para onde ir, e aparece **por cima da mata**. A barra do Draga **parou de repetir a ordem** (a linha de regra e a de escudo saíram com o escudo de pé: "nada repetido") e **a célula da aldeia entrou na barra** (com as linhas novas das torres e da invasão ela ficava por cima delas: bug meu de 18/10, achado na captura).

**4. Renomeado: TERRAS RARAS** (seletor, teatro, campanha, Relatório e as seis línguas).

**5. Dieta de JS** (ver `ORDENS_DO_COMANDO.md` P192–P195): o leitor de `.glb` (13 KB gzip) agora só baixa quando o primeiro robô é pedido. **Pacote de partida: 486,2 de 500 KB** (estava em 498,1).

**Provas:** o teste do posto (terra firme, fora das torres, < 450 m), 10 do objetivo (a ordem e a dica em cada passo, os metros, os marcadores: rótulo, destaque, gerador caído some, borda e seta, a missão parada esconde tudo), os da barra do chefe reescritos, a cobertura de idioma, e a medição na GPU salva em `medicoes/amazonia-gpu-2026-10-18.json`. Capturas do jogo de verdade na GPU: `arte/terras-raras-objetivo-claude.png`, `terras-raras-escotilha-claude.png`.

**Custo de CPU:** zero a mais no tick; no quadro, até cinco projeções de marcador (texto a 4 Hz).

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival`: o jogo deve estar **fluido na Alta e na Automática**; você nasce no posto (a cerca está logo ali), a ordem e o losango verde com a distância mostram o caminho.

**Falta (R13):** **o objetivo na tela só existe em TERRAS RARAS** (a praia, a Cidade Neon, a Bandeira e o Domínio ainda têm só o texto de antes: P190 fica 🟡); **a Praia ainda roda a 47 fps** na janela dele (125 mil triângulos e os shaders dela: há o que ganhar); o painel de visibilidade (P191) é o PR seguinte; o FXAA suaviza um pouco as bordas (mais que o MSAA), **o Comandante julga a olho**; a bancada mede quadros, não o toque da mão: se ainda sentir peso, diga em que ponto do mapa.

**Próxima sessão começa com:** o painel de visibilidade (P191); depois o objetivo na tela dos outros modos e a Praia.

## LGPD (P192) E MÉTRICAS DE NÍVEL PROFISSIONAL (P193): BAIXAR OS DADOS, APAGAR A CONTA, POLÍTICA, GOOGLE ANALYTICS COM LICENÇA, E DE ONDE VÊM AS VISITAS — Claude, 18/10 (branch `claude/lgpd-conta`)

**A ordem do Comandante (18/10):** *"faça os ajustes de apagar conta, baixar dados, tudo que a LGPD obrigue, pra que estejamos todo de acordo"*.

**O que entrou:**
1. **No jogo (Configurações → Conta):** criar conta exige **aceitar a política e declarar a idade** (o servidor também; guarda quando e qual versão); logado há **Meus dados**: **baixar tudo** (JSON), **apagar a conta** (com a senha, numa transação: conta, progresso, atividade e sessões) e **desligar o registro da atividade** (apaga o que havia).
2. **No site:** `/privacidade/` (a política), o rodapé com o link em todas as páginas e a **faixa de cookies**: o **Google Analytics só liga depois do "Aceitar"**. **Achado:** a tag estava **fixa dentro do jogo** (`client/index.html`); agora o jogo só a carrega com o "sim" guardado.
3. **No servidor:** **IP mascarado** no log (`212.8.252.x`), **e-mail fora do log**, e o **registro técnico em arquivo por dia, apagado sozinho depois de 30 dias** (`server/registro.ts`; o painel do servidor lê dele). Novos números do dono: contas criadas, logins, falhas de senha, contas apagadas e dados baixados (só contagem).

4. **A audiência (P193):** o `/metricas/` ganhou **De onde vêm** (digitou o endereço, busca, rede social, outro site, campanha `utm_*`; o funil de cada canal, os sites que mandam gente, as campanhas), **Quem chega** (novo ou recorrente, com conta ou convidado, aparelho, navegador, sistema, idioma, estado do Brasil) e **Quanto se joga** (duração das rodadas e a qualidade gráfica ao terminar). **Só categorias; sem IP, sem cidade, sem id de pessoa.** O Google Analytics **não** entrou na página: precisa da chave de serviço do dono (passos na ordem P193).

**Provas:** testes do banco (aceite, exportar sem segredos, apagar só a conta certa, medição), do HTTP com o servidor de verdade (aceite exigido, versão velha, baixar, apagar com senha errada e certa, a sessão morre, a outra conta intacta, oposição, contagens, preflight, **log sem e-mail**), do cliente (corpo do criar, baixar, apagar, medição; a sessão esquece a conta apagada e **mantém o progresso do aparelho**), do painel de login (as duas caixas, "Meus dados", a confirmação de apagar que não destrói o campo ao digitar) e do registro (dia de Brasília, poda de 30 dias, nunca lança); **o check do site prova no navegador a faixa de cookies** (nada do Google antes da escolha; aceitar liga; a escolha vale na visita seguinte; recusar apaga `_ga`; o jogo não tem a tag fixa). **Mutação à mão: LGPD 32 de 32, audiência 38 de 38, faixa de cookies no navegador do check 7 de 7.** **Ponta a ponta no Chrome (a landing e o jogo reais na mesma origem, contra um servidor local):** a visita do Instagram com link marcado vira canal, site de origem e campanha na landing, o jogo herda a origem, a partida conta com conta ou convidado, a duração e a qualidade entram nas rodadas. Capturas em `.decepticons/arte/` (`lgpd-*-p187-claude.jpg`, `metricas-audiencia-p188-claude.jpg`).

**Custo de CPU:** zero no tick. Um `SELECT` pequeno por visita/rodada de quem tem conta (a checagem da medição); o registro escreve uma linha por evento (a cada 10 s por sala, como o log de antes).

**ATENÇÃO (R13):** o **texto da política é rascunho meu**, escrito a partir do código; **não é parecer jurídico**. **Falta o contato do encarregado** (escreva um e-mail em `.decepticons/contato-privacidade.txt` e a página o mostra) e a razão social. **Não existe recuperação de senha** (exige serviço de e-mail). O **`servidor.log` antigo** ainda tem IPs inteiros e um e-mail (só se apaga com a tarefa parada).

**Onde o Comandante confere:** `cybermech.online/privacidade/`; no jogo, Configurações → Conta (criar conta mostra as duas caixas; logado mostra Meus dados); no site, a faixa de cookies na primeira visita.

**Achados no caminho (R17):** o GA era fixo dentro do jogo; o e-mail ia para o log; `limparExpiradas` nunca era chamada; **a primeira partida de cada visita nunca contava em "partidas iniciadas"** (corrigido).

**O Comandante congelou o escopo (18/10, P194 a P198):** a lista de lançamento está em `LANCAMENTO.md` (10 itens: auditoria de segurança, acesso e privilégio, autenticação, trilha de auditoria, analytics e observabilidade, governança, mapas do lançamento, servidor fora do PC de trabalho, teste com gente de fora, política revisada). **No lançamento só CIDADE NEON e ESTAÇÃO DOS CABOS (a Praia dos Cabos) ficam livres; Bunker e TERRAS RARAS (a Amazônia, ex-"Rio Vivo") ficam "EM BREVE".** O P81 e o painel único estão congelados.

**Próxima sessão começa com:** `LANCAMENTO.md` item 1 (a auditoria de segurança) e, em seguida, os itens 2 a 7 (privilégio, autenticação, trilha de auditoria, observabilidade, governança, mapas do lançamento).

## AMAZÔNIA, PARTE F1: O RELATÓRIO DE CONSEQUÊNCIAS, E OS FATOS CONFERIDOS NA FONTE — Claude, 18/10 (branch `claude/amazonia-consequencias`, P179 camada 3 e P180)

**O Comandante (17/10):** o Relatório de Consequências era a camada 3 do P179 (*"o fim da missão mostra o que aconteceu com o rio, com os povos, com a água, com números lidos de ficha"*) e a ficha de fatos da P180 pedia "ler a fonte primária antes de virar texto".

**O que entrou:**
1. **O chip `RELATÓRIO ▸`** no console (ao lado do ARQUIVO): **só aparece quando a missão do rio acaba** (pisca até o primeiro clique) e some quando ela recomeça. **Nada interrompe a partida e nada abre sozinho** ("nenhuma partida é interrompida por sermão"). Carrega sob demanda, como o Arquivo: o painel (2,1 KB) e o texto (`public/relatorio/<língua>.json`, ~5 KB) só baixam no clique.
2. **O painel** (`ui/RelatorioPanel.ts`), cinco abas no estilo do Arquivo: **O QUE ACONTECEU** (o desfecho; a aldeia; o rio; quantos geradores caíram; quantos andróides da Resistência sobraram; o tempo; "por dentro" ou "a tiro"), **três fatos do mundo real** (o mercúrio no cabelo e no peixe, o garimpo em terras indígenas, a emergência Yanomami), cada um com **a data, a fonte com o endereço (abre em outra aba) e o quadro "O QUE ISTO NÃO DIZ"**, e **O QUE É FICÇÃO** (o Draga, o escudo, a Resistência, a mineradora-arquétipo, os números de equilíbrio e **"no jogo o rio se cura em minutos: gesto de vitória, não ciência"**). **Sete línguas.**
3. **A conferência na fonte** (`fichas/fatos-mineracao-amazonia.md` § 0): **abri o estudo Munduruku (nota técnica ENSP/Fiocruz e WWF-Brasil, nov. 2020), a página do MapBiomas e a cronologia do MPF**. **A leitura corrigiu a ficha de 17/10:** o MapBiomas diz **632%**, não 625%; o estudo Munduruku é de **200 pessoas em três aldeias** de uma terra indígena (não "do povo"); **os números de mortes Yanomami misturavam recortes** ("570" e "495 (92%)" não são a mesma conta: 495 são 92% de 538 óbitos de menores de 5 anos) e **divergem entre as fontes: o jogo não cita nenhum**; os "131 barcos queimados" e as "300 balsas" do Madeira **não estão nas fontes primárias achadas** (o MapBiomas fala em mais de 151 balsas por imagem de satélite em 25/10/2021: ler a nota antes de usar). **A portaria da emergência Yanomami ficou 🟡+** (o título, o número e a data estão em fontes oficiais, mas o texto não abriu: 403): o jogo diz **só o que o título confirma**.
4. **A regra "fato tem fonte", com trava:** o teste exige que **cada endereço de fonte do jogo esteja registrado na ficha**, que todo fato tenha `https`, data e "o que isto não diz", que os números batam com o lido (632%, 57,9%, 200 pessoas, 6 µg/g) e que o **número de mortes Yanomami não apareça**.

**Provas:** 16 testes (o formato e as sete línguas, as fontes, os números, os tetos de tamanho, as linhas de "o que aconteceu" em vitória por dentro, vitória a tiro e derrota, a ligação do chip e o painel fora do JS de partida); **5 mutações à mão pegas** (por dentro/a tiro trocados, fonte sem https, fato sem "o que não diz", vitória/derrota trocadas, recomeço sem apagar o resumo). Visto no navegador de verdade, em português e em japonês: cabe sem rolagem em 1280×720 (`arte/relatorio-aconteceu-pt-claude.png`, `relatorio-mercurio-pt-claude.png`, `relatorio-mercurio-ja-claude.png`).

**Custo de CPU:** zero fora do clique. **JS de partida: 495,9 de 500 KB** (+0,25 KB: o chip e o resumo no `Game`).

**Onde o Comandante confere:** jogue a missão do rio até o fim (`…/jogar/?mapa=amazonia&modo=survival&marcha=0.95` perde em ~30 s sem ninguém para derrubá-lo; ou derrube os geradores e plante a carga) e abra **EXPLORAR HANGAR E MODOS**: o chip **RELATÓRIO ▸** pisca no canto de cima, ao lado de ARQUIVO.

**Falta (R13):** **os textos pedem a conferência de uma pessoa de fora** (a regra de `LADO_E_PEDAGOGIA.md` § 7.4), **inclusive as seis traduções, que são minhas**; **a portaria Yanomami** (abrir o texto), **a nota técnica do MapBiomas sobre o Madeira**, **Barcarena** (a cronologia está lida; falta o laudo) e **o factsheet dos 77% a menos de 500 m de um rio** não entraram; o relatório **não muda com o lado** (Aliança ou Consórcio): a parte do Consórcio vem com a campanha invertida; o chip mora no **console completo** (como o ARQUIVO): no menu compacto da primeira partida ele não aparece; **a cura de verdade do rio** segue só desenho.

**Próxima sessão começa com:** o que o Comandante julgar; depois a campanha do Consórcio (P179 camada 4), a dieta de JS e abrir os documentos que faltam.

## AMAZÔNIA, PARTE E: A INVASÃO — os andróides da Resistência plantam a carga no Draga — Claude, 18/10 (branch `claude/amazonia-invasao`, P180)

**O Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar, invadir com andróides e destruir por dentro"*; *"prossiga"*. As partes C, D1 e D2 deram o Draga, o escudo e a defesa; a E dá **o que o jogador faz depois que a defesa cai**.

**O que entrou (`AMAZONIA.md` § 5.5):**
1. **A Resistência:** **3 andróides aliados** (CAIPORA, IARA e CURUPIRA) nascem na aldeia junto do jogador e o acompanham. Caídos, renascem na aldeia em 4 s. (Antes a missão do rio não tinha aliado nenhum; sem drones; só offline.)
2. **A escotilha** (`sim/InvasaoDoDraga.ts`, regra pura): **quando o escudo cai** abre uma escotilha no **flanco do casco** (13 m do eixo, do lado sul quando ele olha para o oeste; acompanha o Draga). Os três andróides **vão até ela sozinhos** (ordem `hold`; chegam a pé, cruzando o campo) e **plantam a carga**: **cada andróide a menos de 8 m soma 1/30 por segundo** (um sozinho: 30 s; os três: ~10 s; a barra sobe com cada um, como a injeção dos cabos, ao contrário). Sem ninguém junto a carga recua devagar (45 s para zerar). **Cheia, detona: o Draga cai por dentro** (`CombatSystem.detonar`: seis bolas de fogo em volta do casco, o abate conta) e a missão acaba em vitória, pela regra de sempre.
3. **O canhão do Draga só mira Mechs:** andróide é pequeno demais para o radar de tiro dele. É o que deixa a Resistência chegar (a guarda e as torres **não** têm essa folga). **Os dois caminhos seguem abertos:** derrubar o tronco a tiro (como na C) ou plantar a carga por dentro (ou misturar).
4. **`BotController.plantador`:** a ordem `hold` vira para valer: o robô vai ao ponto e **fica nele** (sem orbitar o alvo nem recuar para esfriar). Sem isto os andróides orbitavam o Draga e ficavam a 12 m da escotilha.
5. **A tela:** a barra do chefe ganha `INVASÃO · CARGA 45% · 2 DE 3 DENTRO` (só com a escotilha aberta); o aviso `ESCOTILHA ABERTA · OS ANDRÓIDES ENTRAM` sobe uma vez; **no cenário**, um **anel verde** no chão junto ao casco, um **disco** que cresce com a carga e um **farol** que se vê de longe (`environment/AmazoniaEscotilha.ts`, no pedaço sob demanda). **Idioma:** 2 textos novos por língua nas seis línguas.
6. **O renascimento do rio:** com a Resistência entre os rastreados, o "ponto mais longe dos vivos" mandaria o jogador (e os andróides) para o outro lado do mapa ao morrer; **na missão do rio todo mundo renasce na aldeia** (o ponto dela é o único da lista).

**Provas:** 12 testes da regra (a escotilha fechada com escudo de pé, abrir uma vez, 30 s contra 10 s, o teto de 3, o recuo, a detonação única, a geometria do flanco), **10 da partida** (a Resistência existe e nasce nos pontos, a escotilha acompanha o Draga, **os andróides cruzam o campo a pé e chegam**, a carga cheia derruba o Draga: vitória e abate, o canhão ignora andróides e mira o Mech, o jogador renasce na aldeia, recomeçar fecha tudo), 3 do HUD e 2 de lugar (ninguém nasce no rio nem dentro de estrutura). **8 mutações à mão: 7 pegas** (escotilha sempre aberta, o canhão mirando andróide, sem plantador, sem detonação, recomeço sem reiniciar, respawn pelo ponto mais longe, abrir sem o escudo cair); **a que escapa é equivalente** (contar "qualquer aliado" em vez de "andróide": na missão só há andróides aliados). Captura: `.decepticons/arte/amazonia-escotilha-e1-claude.jpg` (a escotilha aberta com a carga a 45%; a bancada ganhou a vista `escotilha`).

**Custo de CPU:** por tick, um laço sobre ≤ 3 andróides e uma soma; a ordem `hold` só é reemitida quando a escotilha anda 6 m. **Medido: a missão inteira custa ~1,4 ms por tick** (guarda dormindo, Resistência andando: ~1,0 ms com a escotilha aberta). **JS de partida: 495,7 de 500 KB** (a E somou 2,4 KB: a regra, a fiação do `Match`, o HUD e o `detonar`; **folga de 4,3 KB: a próxima parte que mexer no pacote de partida tem de pagar com dieta**, por exemplo tirando a regra da missão do rio do pacote inicial).

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival&marcha=0.5` (o Draga já no meio dos geradores): derrube os três geradores (a cerca em x -100, a planta em x 20, a cava em x 260): o aviso `ESCOTILHA ABERTA` sobe, o farol verde aparece no flanco sul do Draga e a Resistência (que estava com você na aldeia) corre até ele; com a carga em 100% o Draga explode por dentro. Ou ignore a Resistência e o derrube a tiro.

**Falta (R13):** **a cura de verdade do rio** (a limpeza no fim segue só desenho; o Relatório de Consequências e o Consórcio, P179 camadas 3 e 4, são a próxima etapa); **o equilíbrio** (13 m, 8 m, 30 s por andróide, 45 s de recuo, 3 andróides, 4 s de renascimento) é **proposta**, não validado com jogadores; **não joguei a invasão até o fim a olho** (o headless roda a ~0,25× do tempo): a captura é do cenário; **os andróides da guarda ainda atiram na Resistência no caminho** (e as torres só miram o jogador); a Resistência não tem voz nem rádio; **só offline**; sem som da detonação além do comum.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências / Consórcio e uma **dieta de JS** (4,3 KB de folga).

## AMAZÔNIA, PARTE D2: AS TORRES ARMADAS E A FORÇA DE DEFESA — Claude, 18/10 (branch `claude/amazonia-guarda`, P180)

**O Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar"*; *"a amazônia já foi entregue em partes, prossiga"*. A D1 deu os geradores sozinhos; a D2 põe **quem os defende**.

**O que entrou (`AMAZONIA.md` § 5.4):**
1. **As oito torres de vigia da margem ficaram armadas** (`sim/TorresDeVigia.ts`, regra pura): cada uma, com um alvo a até **170 m** e a visada livre, solta uma **rajada de 4 tiros** (0,16 s entre eles) a cada **2,4 s**, com erro de mira sorteado de uma semente (determinístico) e começo escalonado (as oito não atiram juntas). O tiro é um projétil sem dono (dano 8, alcance 190): **fogo de cobertura que atravessa o rio**. **Calam quando o gerador da CERCA cai** (é ele que as alimenta): o jogador escolhe entre cruzar sob fogo e ir derrubá-la.
2. **A força de defesa** (`AMAZONIA_GUARDA`): **3 Mechs e 6 androides** em volta dos geradores, do lado norte do rio. **Seguram o posto** (não correm atrás do jogador nem para a aldeia) e **não renascem**: derrubado, fica derrubado. O Draga marcha sem a escolta de ninguém.
3. **Dormem** (`BotSystem`): sem alvo a **420 m** e sem dano, a guarda **não pensa nem anda** (zero CPU por tick); acorda com um alvo mais perto, ou com dano, e fica acordada **6 s** depois do último motivo. **O chefe nunca dorme** (a marcha dele é o relógio da missão).
4. **Nascem no chão** (`BotSystem.alturaDoChao`): o mapa de relevo não admite y = 0 (o robô nascia enterrado e os androides caíam do mundo: 9 ms por tick; agora **~3,2 ms**).
5. **A tela:** a barra do chefe ganhou a linha `TORRES DA MARGEM ARMADAS` / `TORRES DA MARGEM SEM ENERGIA` (muda de cor). **Idioma:** 2 textos novos por língua nas seis línguas; o teste de cobertura os cobre.
6. **Provas:** 7 testes da regra das torres e 8 da partida (a guarda existe e segura o posto, não renasce, a torre atira e acerta, cala sem a CERCA, não atira a 1.000 m, o Mech da guarda troca tiro, a guarda dorme e acorda); **3 mutações à mão pegas** (torres sempre ligadas, sem sono, sono que nunca acorda por perto). O teste "o Draga atira" do `Match.rio` passou a contar só os tiros do canhão dele (as torres também atiram em quem anda no leito).

**Custo de CPU:** por tick, as torres são um laço de 8 e **um raio só quando uma está pronta para atirar**; a guarda (9 robôs) dorme longe, e perto custa o que um bot custa; a missão inteira **~3,2 ms por tick**. **JS de partida: 493,3 de 500 KB** (a regra das torres, o sono e a fiação do `Match` somaram 1,6 KB; folga 6,7 KB): a E carrega sob demanda.

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival`: ande até a margem sul do rio, de frente para o norte, para sentir o fogo das torres (a cerca em x -100, a planta em x 20, a cava em x 260); derrube a CERCA e as torres calam (a linha da barra do chefe vira `SEM ENERGIA`); os Mechs e androides só se mexem quando você chega a menos de 420 m. Para testar sem esperar: `&marcha=0.5`.

**Falta (R13):** **E:** a invasão com androides e a cura de verdade; **o equilíbrio** (dano 8, rajada de 4 a cada 2,4 s, 170 m, 3 Mechs e 6 androides) é **proposta**, não validado com jogadores; **não joguei a defesa até o fim a olho** (o headless roda a ~0,25× do tempo) e **não fotografei a guarda de perto**; **as torres não têm som, clarão de boca nem desenho de tiro próprios** (usam o projétil comum); o aviso do alto da tela **não** diz que a CERCA derrubou as torres (a linha da barra do chefe diz; o aviso do gerador que caiu ocupa o alto).

**Próxima sessão começa com:** a **E** (a invasão com androides e a cura do rio); depois o Relatório de Consequências e o Consórcio (P179 camadas 3 e 4).

## AS MÉTRICAS DOS PILOTOS: QUANTOS ENTRAM, QUANTO JOGAM, QUEM VOLTA — Claude, 18/10 (branch `claude/metricas-usuarios`, P185)

**A pergunta do Comandante (17/10):** *"tem como termos as métricas dos usuários, quantos entram, quantos minutos jogam, quantas mortes, etc? [...] depois implementarmos melhores práticas de marketing orientado pelas nossas informações de usuários?"*

**Resposta curta: sim, e agora o servidor mede.** Já existiam as contagens anônimas (visitas, cliques, partidas, país, pico). **O que entrou:**
1. **Por conta:** a tabela `atividade` (uma linha por conta por dia: abriu o jogo, rodadas, segundos, abates, mortes). Dela saem **DAU/WAU/MAU**, **quem de fato jogou**, **minutos por piloto**, contas novas por dia e a **retenção D1 e D7**. Alimentada pela rodada que o navegador manda **com a sessão** e por abrir o jogo com a sessão guardada.
2. **Para todos (com e sem conta):** rodadas, minutos, abates e mortes **por dia** e **por mapa e modo**, a **onda** em que a rodada parou e a **vitória ou derrota** das missões (o relatório de partida ganhou `map`, `wave` e `won`, opcionais).
3. **A tela do dono:** `/metricas/` ganhou **Pilotos com conta** e **O que se joga**; o `/metricas` traz o bloco `usuarios`. **Só contagens: nenhum e-mail nem número de conta.**
4. **A faxina:** o servidor passou a varrer sessões vencidas e atividade de mais de 400 dias ao subir e a cada 6 h (`limparExpiradas` existia e ninguém chamava).

**Provas:** testes de conta (cenário com dia de Brasília e virada às 03:00 UTC, retenção do dia exato, banco vazio, faxina), de agregação (tetos, reenvio, arquivo antigo), HTTP de ponta a ponta com o servidor de verdade (conta + rodada com sessão, reenvio, sessão inventada, preflight, visita) e do cliente (a sessão só vai ao servidor dono dela). **Mutação à mão: 32 de 32 pegas.** **E ponta a ponta no navegador** (o fio do `Game.ts`, sem teste de unidade): o jogo de verdade no Chrome, com a sessão de uma conta, na Amazônia (`marcha=0.95`) e na Praia (Sobrevivência) mandou ao servidor local `map`, `wave`, `won` e a sessão; o `/metricas` mostrou 1 piloto que jogou, 3 rodadas, 4 min, por mapa e dia (captura: `.decepticons/arte/metricas-pilotos-p185-claude.jpg`, com os números dessa prova).

**Custo de CPU:** zero no tick e no quadro do jogo. O cliente soma dois números por rodada (onda, desfecho); o servidor faz um `INSERT` pequeno por rodada de quem tem conta e um por abertura do jogo; a leitura (`metricasUsuarios`) só roda quando o dono abre o `/metricas`.

**ATENÇÃO (privacidade, R13):** a atividade por conta é **dado pessoal novo**. **O jogo ainda não tem política de privacidade, "apagar minha conta" nem "baixar meus dados"**, e o Google Analytics já está nas páginas. O inventário do que é guardado está em `PRIVACIDADE.md`; **antes de trazer jogadores o dono precisa decidir e publicar a política** (a proposta técnica de apagar/exportar está lá, construo quando ele mandar).

**Falta:** o chassi e o lado por conta; vitória em Bandeira e Domínio (precisa do time do jogador no online, P81); o que o marketing faz com os números (só vale com jogadores medidos).

**Onde o Comandante confere:** `cybermech.online/metricas/` (token em `.tmp/servidor/metricas-token.txt`, ou entrando com a conta de admin): seções **Pilotos com conta** e **O que se joga**. **Os números só começam a encher depois que o site e o servidor atualizarem** e pilotos com conta jogarem; antes disso as seções mostram zeros.

**Próxima sessão começa com:** o **time do jogador na sala online (P81)**: é o que falta para Bandeira 2v2 online, para os lados Aliados × Consórcio (P186) e para a vitória nesses modos.

## AMAZÔNIA, PARTE D1: O ESCUDO DO DRAGA E OS TRÊS GERADORES — Claude, 18/10 (branch `claude/amazonia-defesa`, P180)

**O Comandante (17/10):** *"a amazônia já foi entregue em partes, prossiga"* (a parte C estava pronta e testada num branch local sem PR: **publiquei como veio, #375**, e a produção já religou nela).

**O que entrou (§ 5.3 do `AMAZONIA.md`):**
1. **Os geradores** (`environment/AmazoniaGeradores.ts`): três torres de força (CERCA, PLANTA e CAVA) que se **quebram a tiro** (`Destructibles.addExterno`, o mesmo registro dos coqueiros): 1.500 de vida cada, destroços e faíscas ao cair, seis malhas de desenho. Carregam com a missão (sob demanda).
2. **O escudo** (`sim/EscudoDoDraga.ts`, pura): **com algum gerador de pé o Draga recebe 10% do dano**, por tiro, explosão ou dano por segundo (`DragaMech.escudo`); cai com o último e não volta (rodada nova os devolve).
3. **A tela:** a barra do chefe diz `ESCUDO · 3 DE 3 GERADORES` (e `ESCUDO CAIU`), a regra vira "derrube os geradores", e cada queda avisa.
4. **Idioma (o que a auditoria rigorosa achou):** a Amazônia da parte C **não tinha tradução** na barra do chefe, na aldeia, nos avisos da marcha e nos fins de missão; entraram **28 textos por língua**. **Duas correções no motor do tradutor** (`i18n.ts`): a composição aninhada passa a ter **duas voltas** ("MECH · Lançador EMP MK I") e uma chave sem " · " **não engole** um " · " na borda da lacuna ("ANDRÓIDE " + "· manso" saía meio traduzido).
5. **Provas:** o teste de regra (11 casos, mutações de ligação pegas), o de lugar (nenhum gerador no rio nem dentro de estrutura), o do HUD e o de cobertura de idioma; captura do cenário (`arte/amazonia-gerador-d1-claude.jpg`, `amazonia-geradores-d1-claude.jpg`; a bancada ganhou as vistas `gerador` e `geradores`).

**Custo de CPU:** zero por quadro (um número por tick na regra; o HUD só mexe no DOM quando a contagem muda); seis desenhos e três sensores. **JS de partida: 491,7 de 500 KB.**

**Onde o Comandante confere:** `…/jogar/?mapa=amazonia&modo=survival` (a missão do rio): a barra do chefe diz `ESCUDO · 3 DE 3 GERADORES`; atire no Draga e veja o dano quase não andar; corra para leste pela margem (a cerca em x -100, a planta em x 20, a cava em x 260) e derrube as três torres de força. Para testar sem esperar: `&marcha=0.5`.

**Falta (R13):** **D2:** as torres da margem armadas e a **força de defesa** (Mechs e androides); **E:** a invasão com androides e a cura de verdade; **o equilíbrio** (10%, 1.500) é proposta; **não joguei a missão até o fim a olho** (o headless roda a ~0,25× do tempo): a captura é do cenário; os fatos da ficha da mineração seguem 🟡.

**Próxima sessão começa com:** o que o Comandante julgar; depois a **D2** (as torres e a força de defesa).

## AMAZÔNIA, PARTE C: O DRAGA-01 COM CORPO — a missão do rio é jogável — Claude, 17/10 (branch `claude/amazonia-draga`, P180)

**A ordem do Comandante (17/10):** *"há uma enorme força de defesa deles e teremos que desmantelar, invadir com androides e destruir por dentro"*; *"continua iterando até concluir essas pendências"*. A parte C é **o Draga-01 de verdade na partida**: com corpo, dano, marcha e a missão que ele cria.

**O que entrou (`AMAZONIA.md` § 5.2 tem os números):**
1. **O corpo** (`entities/DragaMech.ts`, `dragaStats.ts`): um `MechBase` como o Colossus (36 m por 10 m de cápsula, canhão de cerco no convés), com um rig vazio de bípede e o desenho de quatro pernas (`WalkerVisual`) por cima. **Os dois módulos de perna são os dois lados**; a perna da frente cai primeiro; um lado caído o deixa a 50%, os dois a 30% (rasteja).
2. **A marcha e o cérebro** (`sim/DragaMarcha.ts`, `combat/DragaController.ts`): ele anda os 1.550 m do leito até a aldeia em ~10 minutos, vira devagar (14°/s), e atira em quem estiver a 320 m com a visada livre; tudo determinístico.
3. **A missão** (`sim/MissaoDoRio.ts`, `Match.rio`): **`?mapa=amazonia&modo=survival`** (o seletor de mapas já leva a ela). Derrubar o Draga vence; ele chegar à linha da aldeia perde; **o jogador morrer não perde**. Sem ondas, rebeldes nem quadro de luz: o Draga é o único inimigo. **`&marcha=0.8`** começa com o Draga 80% do caminho andado (para testar o fim).
4. **A tela:** a barra do chefe com o nome, a fase e os dois lados; a célula **ALDEIA · DRAGA A n m · n MIN** com a barra da marcha; os avisos a 1.000, 500, 250 e 100 m; o fim ("O RIO VIVE" / "A ALDEIA CAIU"); e o rio se limpando para a foz depois da vitória (só desenho).
5. **Carregado sob demanda:** o corpo, o cérebro e o `.glb` só baixam para quem abre a missão (`ChefeCarregado`).
6. **A ficha de fatos** (`fichas/fatos-mineracao-amazonia.md`): o que o jogo pode afirmar como fato sobre o garimpo e a mineração (o mercúrio no peixe, a emergência Yanomami, o garimpo nas terras indígenas, as dragas do Madeira, os rejeitos de Barcarena), cada um com a frase que o jogo pode dizer e a que **não** pode, as fontes e o que é sátira. **Tudo 🟡: só o resumo de uma busca; ler as fontes primárias antes de virar texto.** Nenhum fato entrou no jogo ainda; a expulsão dos povos **não foi levantada**.

**Provas:** testes do corpo no chão de verdade (anda os 1.550 m em ~10 minutos, segue o rio, perna caída = metade da velocidade, canhão com erro de mira determinístico, visada, alcance), da missão, da partida inteira (derrota, vitória, recomeço, o jogador morrendo, o placar) e do HUD. **Mutação à mão: 59 de 60 pegas** (a que escapa é equivalente). **Visto no jogo de verdade** (Chrome sem GPU, `arte/amazonia-missao-draga-c1-claude.jpg` e `amazonia-missao-fim-c1-claude.jpg`): a barra do Draga, a célula da aldeia, os avisos, as pernas amarelas do Draga entre as árvores perto da aldeia, e a derrota quando ele cruza a linha.

**Custo de CPU:** por tick, o Draga é um `MechBase` a mais (um character controller) e o cérebro faz uma conta de rumo e um laço sobre os alvos (≤ 8); quando atira, um raio. **O JS de partida está em 490,7 / 500 KB** (a parte C pagou ~2 KB de HUD, fases e a fiação do `Match`; a dieta de JS da `main`, P-dieta, tinha devolvido a folga: antes de somar, 499,2): **o que a parte D e a E trouxerem só da missão deve carregar sob demanda** (a folga é de 9,3 KB).

**Onde o Comandante confere:** **`cybermech.online/jogar/?mapa=amazonia&modo=survival`** (o seletor de mapas, AMAZÔNIA · RIO VIVO, leva direto): você nasce na aldeia e o Draga está a 1.650 m, marchando para lá. Para ver o fim rápido: **`&marcha=0.9`** (ele chega à aldeia em ~2 minutos: derrube-o antes ou veja a derrota).

**Falta (R13):** **ainda não é a fase inteira**: sem **escudo, geradores, torres, força de defesa** (parte D) e sem **invasão com androides nem cura de verdade** (parte E). Os números de equilíbrio (tronco 4.800, pernas 1.600, o canhão de cerco que mata um Vector-09 em um tiro certeiro) são **de partida, não validados com jogadores**. O Draga **não tem som de passo nem de tiro próprios, nem explosão ao cair** (ele some como os outros Mechs). **A floresta densa esconde o Draga do chão** (só se vê acima das copas, no rio e nas clareiras). **Não medido em GPU de verdade.** **A imagem da serpente não chegou.**

**Próxima sessão começa com:** a **parte D** (os geradores do escudo, as torres da margem, a força de defesa e o ato 1), **carregada sob demanda** (a folga de JS é de 9,3 KB).

## A PRODUÇÃO ESTAVA 2,5 H NO CÓDIGO VELHO: A VERIFICAÇÃO DO ATUALIZADOR REPROVAVA NO ESCURO — Claude, 17/10 (branch `claude/atualizador-log`)

**O que achei (e provei de ponta a ponta):** depois dos merges #371 e #372, o servidor de produção **não atualizou**: o `atualizacao.log` mostrava seis `FALHOU (testes de server/ e shared/)`. Os mesmos testes passavam na minha worktree. Fiquei quieto e a rodada seguinte **verificou em 40 s e religou no código novo** (protocolo 20); a primeira cópia do banco de contas apareceu em `D:\DECEPTICONS\.tmp\servidor\backups\contas-2026-10-18.db` (abre e traz a conta). **Causa:** o meu barulho (check do push, navegador, auditorias) e duas rodadas se atropelando em `.tmp/vitest`, não código quebrado.

**Feito:** o atualizador deixava a saída do teste que falhou se perder (`stdio: 'inherit'`). Agora grava as **últimas 40 linhas** no `atualizacao.log` quando um comando falha (`ultimasLinhas` em `scripts/atualizador.mjs`, 3 testes). O servidor só passa a usar isto depois da próxima atualização que ele verificar. `DEPLOY.md` ganhou a seção do episódio e a regra de operação: **depois de cada merge, ficar quieto** (sem check, sem suíte, sem navegador) até o log mostrar `servidor religou no código novo`.

**Custo de CPU:** zero.

**Falta (R13):** o atualizador **pode** reprovar de novo sob carga: a verificação roda os testes da máquina inteira numa máquina compartilhada. Uma saída mais robusta (repetir a verificação uma vez antes de desistir, ou rodar só em janela de silêncio) é decisão de quem opera a máquina; deixei só a **visibilidade**, que é o que faltava para decidir.

**Próxima sessão começa com:** o que o Comandante julgar. **A Amazônia (P180) está com outra sessão: não mexer.**

## O ONLINE VOLTA SOZINHO QUANDO CAI, E O QUE FALTA PARA LANÇAR — Claude, 18/10 (branch `claude/reconexao-online`, P184 b)

**O Comandante (17/10 à noite):** *"consegui conectar 2 pcs diferentes na mesma sala da arena! deu certo!"* (a correção da porteira, P184); e pediu **as métricas dos usuários** (P185), **a ideia dos lados Aliados × Consórcio** (P186) e que **o online funcione por inteiro antes de tudo**.

**O que entrou (`client/src/net/OnlineSession.ts`, `NetClient.ts`):** **reconexão automática (G13)**: quando a conexão cai (a VPN trocou, o túnel soluçou, o servidor travou ou reiniciou, a porteira cortou), a sessão limpa a sala velha, avisa **"ONLINE · CONEXÃO CAIU · RECONECTANDO (n/6)"** no canto (o mundo segue; nada cobre a tela) e tenta de novo com esperas de **0,3, 0,7, 1,5, 3, 5 e 5 s** (~15 s); volta à sala como piloto novo (a previsão reposiciona o Mech). **Recusa** (versão, sala cheia, montagem) **não reconecta**; seis falhas seguidas viram "caiu: recarregue". **Achado de caminho:** o `NetClient` só avisava o fim da conexão no `close`, e uma conexão recusada só dá `error` em alguns ambientes (o Node dos testes): agora avisa **uma vez**, venha o que vier. **Testes:** o servidor de verdade cai e volta no mesmo endereço (a sessão reconecta e vê os robôs), duas quedas seguidas, esgotar as tentativas, recusa sem reconexão, encerrar cancela, e o aviso único do `NetClient`; **mutação à mão: 10 de 10**.

**O que falta para o online ser lançado (a lista honesta, do `ROADMAP.md` e do `STATUS_REAL.md`):**
1. ✅ **Dois PCs, VPNs diferentes, mesma sala** (provado pelo Comandante, 17/10) e ✅ **reconexão automática** (esta entrega).
2. **Times na sala online (P81)**: dois amigos no mesmo time; é o contrato de que o CTF 2v2 online e os **lados Aliados × Consórcio** (P186, `LADO_E_PEDAGOGIA.md` § 3.5) dependem. **É o próximo passo técnico.**
3. **Métricas dos usuários (P185):** retenção, usuários únicos e tempo por conta (a primeira fatia entra a seguir).
4. **Jogador remoto desenhado com o chassi da montagem dele** (hoje todo humano aparece como Vector-09 para os outros).
5. **Homologar online com rede real e carga** (capacidade, latência e perda, duração prolongada) antes de prometer escala; **o PC do servidor é o de trabalho e tem 6 GB**: para o lançamento o servidor precisa de **máquina própria** (decisão e custo dele; ver `DEPLOY.md`).
6. **Ranking e a política de privacidade (LGPD)** antes de trazer público.
7. Já em dia: login, contas, cópia de segurança do banco, mural, porteira tolerante a picos.

**Onde o Comandante confere:** derrube a conexão de propósito (trocando a VPN, ou desligando e ligando a rede por alguns segundos) com a partida aberta: o canto mostra **RECONECTANDO (1/6)…** e o jogo **volta à sala sozinho**; recarregar a página só é preciso depois de seis falhas.

**Falta (R13):** **não testei com a VPN dele** (só com o servidor de verdade nos testes); o placar da sessão **zera** na volta (o servidor trata como piloto novo); o jogador volta **no ponto de nascimento** da sala; a partida em andamento no servidor (a rodada) segue sem ele durante a queda.

## O ONLINE CAÍA PARA QUEM JOGA POR VPN: A PORTEIRA DESCARTA O PICO EM VEZ DE CORTAR — Claude, 17/10 (branch `claude/guard-rajada`, P184)

**O relato do Comandante (17/10):** *"não tô conseguindo jogar online, dá erro e cai a conexão... não consigo jogar CONTRA meu outro PC usando VPNs diferentes"*.

**O que o `servidor.log` mostra:** quatro cortes **"taxa alta demais"**, dois deles dos IPs **212.8.252.70** e **185.177.124.221** (as duas VPNs do teste), com o servidor saudável no momento do corte; e o tempo médio do tick com picos de **298 e 1.093 ms** (uma média móvel: são travadas de segundos). **O PC do servidor é o mesmo em que se trabalha** e tem 6 GB com ~400 MB livres (o processo do servidor estava com 11 MB na memória, paginado): quando o laço do Node congela, as mensagens de todos chegam juntas na volta, e a porteira cortava **no primeiro excesso**. Quem jogava pela VPN (mais jitter) era o primeiro a cair.

**Corrigido (`server/guard.ts`):** o excesso de mensagens passa a ser **descartado** (nada é decodificado: custo de uma conta) e a conexão segue; só o **abuso de verdade** corta (o descarte acumulado passa de 600, caindo 60 por segundo: uma inundação cai em instantes, uma travada de segundos não). A folga subiu de 30 para 120 mensagens. O log passa a dizer `descarte de <ip>: pico de mensagens (a conexão segue)`. **Testes:** o balde (veredito ok/descarte/corte, o pico que passa, a inundação cortada, o excesso sustentado cortado e o leve nunca), o servidor de verdade (um pico de 45 mensagens não derruba; 80 derrubam); **mutação à mão: 7 de 7**.

**O que o código não resolve (e o que fazer):**
1. **O túnel da Cloudflare cai quando a VPN do PC do servidor muda** (o `jogo.cybermech.online` devolveu **502** por um tempo hoje: o túnel estava fora): não troque a VPN do PC do servidor com gente jogando; se o jogador é este mesmo PC, prefira outro PC como cliente.
2. **Memória do PC do servidor:** com menos de 1 GB livre o servidor trava por segundos. Feche o IDE e os navegadores enquanto joga, e **peça-me para não rodar teste nem build pesado enquanto você joga** (os meus testes e o `npm run check` do push usam todo o processador e a memória).
3. **Testar dois PCs sem VPN:** pela rede de casa (`HOST=0.0.0.0`, `ws://IP-DESTE-PC:2567`; ver `DEPLOY.md`).

**Onde o Comandante confere:** depois do merge o atualizador reinicia o servidor (~1 minuto fora): jogue de dois PCs na mesma sala (`?sala=ARENA`); se algum pico passar, o `servidor.log` mostra `descarte de ...` e **ninguém cai**.

**Falta (R13):** **não provei com a VPN dele** (só com o teste do servidor de verdade e a leitura do log): se ainda cair, o próximo passo é gravar no log o motivo do fechamento de cada conexão (código e quem fechou). Não mexi no túnel nem na prioridade do processo do servidor (o Windows negou: ele roda como serviço).

## IDIOMA, SEGUNDA RODADA: OS MODOS DE JOGO (A PRAIA, A BANDEIRA, O DOMÍNIO) — Claude, 17/10 (branch `claude/idioma-modos`, P173)

**Por que:** a auditoria do Hangar deixou claro que o teste de cobertura não via o que o jogo monta na tela. Auditei **no navegador, em japonês, cada modo** (sobrevivência, bandeira, domínio e a praia, **nunca a Amazônia: está com outra sessão**). Os três primeiros já estavam limpos; **a missão da praia (Cabos Abertos) tinha ~15 textos na tela e dezenas nos avisos**.

**Feito:** **74 textos novos nas seis línguas** (811 por língua): o HUD da praia (porto, ponte, estação, rede, cabos, portas, quadro de luz, a água), os avisos (cabo tomado, cortado, liberado, porta arrombada, cidade no escuro…), o briefing da missão, o chefe (fase, pernas, as três falas), a bandeira (`// PILOTO …`, `// RETORNADA À BASE`), o domínio, as conquistas, o briefing e o terminal do Banco Vorcaris, o "arraste os botões" do toque e o respawn. **Prova no navegador:** a auditoria em japonês de praia e sobrevivência só devolve nomes próprios (`arte/idioma-praia-ja-claude.png`). O teste de cobertura ganhou os 70 casos. **De passagem:** o arpão em japonês tinha dois termos (ハープーン e アンカー銃); ficou ハープーン nos dois.

**Sobre o arpão nos chassis pesados (P181), a conclusão depois de ler o código:** todos os médios têm o mesmo "peso" (raio 1,3), então o Marauder puxa qualquer médio e mais leve (regra "do seu peso ou mais leve"); **só o Onça (1,6) e os titãs (3,6 e 5) são mais pesados, e não têm encaixe de ombro** (o encaixe do Marauder é medido no desenho importado, `shoulderPods`). Dar ombros ao Onça exige encaixe procedural e o desenho do lançador: **é trabalho visual que precisa do olho do Comandante**; fica como decisão dele (abaixo).

**Custo de CPU:** zero.

**Falta (R13):** (a) revisão nativa das traduções; (b) o texto do rádio e do briefing das missões por onda e a tela final de cada modo (só aparecem jogando até o fim); (c) **decisão do Comandante:** ombros no Onça para ele ser o melhor usuário do arpão (trabalho visual), ou deixar o arpão para o Marauder.

**Próxima sessão começa com:** o que o Comandante julgar. **A Amazônia (P180) está com outra sessão: não mexer.**

## ONDE FICAM OS LOGINS, E A CÓPIA DE SEGURANÇA QUE NÃO EXISTIA — Claude, 17/10 (branch `claude/contas-onde`, P183)

**O Comandante (17/10):** *"onde os logins serão salvos se não temos supabase? como está isso? onde estão os arquivos pra eu conferir?"*.

**Resposta (o que existe de verdade):** os logins ficam em **`D:\DECEPTICONS\.tmp\servidor\contas.db`**, um arquivo SQLite no PC do servidor (`node:sqlite`, sem serviço de nuvem, decisão dele de 28/09). Guarda e-mail, o **hash `scrypt`** da senha, o **hash** do token de cada sessão e o progresso (nível, XP, créditos, apelido). O código que lê e escreve é o `server/contas.ts` (o único com SQL); as rotas, `server/Server.ts`; o contrato, `shared/net/auth.ts`. **Hoje há 1 conta** (de teste, criada às 13:12). Está tudo descrito em `DEPLOY.md` (§ "Contas: onde estão, o que guardam e como restaurar").

**Achado (R17): não existia cópia de segurança.** Um arquivo corrompido ou apagado por engano levava as contas de todos os pilotos.

**Feito:**
1. **`server/backupContas.ts`:** uma cópia **consistente** (`VACUUM INTO`, não pega o banco no meio de uma escrita) por dia em `.tmp\servidor\backups\contas-AAAA-MM-DD.db`, as **últimas 14**; o `Server` a faz ao subir e a cada 6 h (a do dia é substituída pela mais nova). Falha na cópia só registra no log: o jogo não cai.
2. **Testes (7) e 2 mutações pegas:** o nome é do dia (UTC); a retenção apaga só as mais velhas e **ignora arquivo que não é cópia**; a cópia é um banco de verdade (abre, autentica a senha, traz o progresso); a segunda rodada do dia a substitui; o servidor copia ao subir.
3. **`DEPLOY.md`:** a tabela de onde está cada coisa, o que o banco guarda, como **restaurar** e como contar as contas sem expor e-mail. Também corrigi o texto velho ("ainda não tem tela"): a tela e a sincronização do progresso estão no ar desde 17/10.

**Custo de CPU:** uma cópia de um arquivo de ~40 KB a cada 6 h.

**Falta (decisão do Comandante, R13):** a cópia fica **no mesmo disco do PC** (a regra G15 impede o projeto de gravar fora da pasta dele): protege de arquivo corrompido ou apagado, **não** de o disco morrer. Levar `backups\` de vez em quando para um pen drive ou para a nuvem pessoal dele é um `Copy-Item` de arquivos pequenos. **O banco guarda e-mails** (dado pessoal, LGPD): vale uma política de privacidade na página quando o cadastro abrir ao público. O servidor de produção só passa a copiar depois de reiniciar com este código (o atualizador reinicia sozinho no merge).

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências e os ombros dos chassis pesados (P181). **A Amazônia (P180) está com outra sessão: não mexer.**

## DIETA DE JS: OS PAINÉIS OPCIONAIS DO CONSOLE SAEM DO DOWNLOAD DE PARTIDA — Claude, 17/10 (branch `claude/dieta-js`, R7)

**O problema:** o JS de partida (o que todo jogador baixa para abrir o jogo) estava em **499,7 / 500 KB**: qualquer módulo novo, de qualquer agente, travaria o `npm run check` de todo mundo. Em uma semana eu tinha estourado o teto três vezes (o `‹ valor ›`, o Arquivo, o idioma).

**Feito:**
1. **Cinco painéis viram pedaços sob demanda** (`import()` no primeiro clique, `core/sobDemanda.ts`): **Esquadrão** (6,8 KB gzip), **Campanhas** (3,6), **Arsenal** (3,8), **Servidor** (6,2) e **Câmeras** (2,8). O `Game` não os importa mais de forma estática; o clique baixa o pedaço, cria o painel e abre (sem rede, avisa no console e o próximo clique tenta de novo).
2. **JS de partida: 499,7 → 486,2 KB** (folga de **13,8 KB**). Os pedaços sob demanda ficam abaixo de 7 KB cada (teto: 150 KB).
3. **Prova no navegador de verdade** (build de produção servido): antes do clique **nenhum** desses cinco pedaços é pedido; depois do clique cada um baixa e o painel abre; zero erros. Testes (`sobDemanda.test.ts`): a fábrica cria uma vez, o erro não fica guardado, um painel que falha não derruba o jogo, e o `Game` não importa mais os cinco de forma estática.

**Custo de CPU:** menos que antes (o download e a análise do JS dos painéis só acontecem para quem os abre).

**Regra para todos os agentes** (agora no `PROTOCOLO_UNIVERSAL.md`, R7): **tela ou painel opcional entra por `import()` no clique; texto estático longo vai para JSON em `public/`.** O próximo candidato, se a folga acabar: o `HangarMenu` (28 KB minificados) e o `HangarScene` (16 KB), que hoje o `Game` aquece no boot (pré-compilação de shaders): tirá-los do boot é uma decisão de experiência (o primeiro "H" passaria a esperar o pedaço), não só de bundle.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## AMAZÔNIA, PARTE B: O RIO E O MAPA — o cenário de 2,4 km com o rio como termômetro — Claude, 17/10 (branch `claude/amazonia-mapa`, P180)

**A ordem do Comandante (17/10):** *"vamos já planejar e construir a próxima fase: o rio Amazonas, uma mineradora acabando com o rio… o cenário precisa ser bem maior… manter a eficiência e a contenção de consumo"* e *"acima desse super mech o rio é limpo e vivo, e depois dessa máquina o rio fica poluído, sujo, com óleo e envenenado"*; depois, *"continua iterando até concluir essas pendências"*.

**O que entrou (parte B do `AMAZONIA.md`, § 5.1 tem os números):**
1. **O mapa `amazonia`** (`client/src/environment/Amazonia*.ts`): 2.400 × 900 m, **o terreno numa função só** lida pela malha e pelo colisor (24 pedaços de 300 m, um colisor de altura), **6.594 árvores instanciadas** com dois níveis de detalhe, as estruturas (a aldeia, a planta, a margem fortificada com 8 torres, as máquinas da cava, a lagoa de rejeitos) fundidas numa malha, a água num shader só. **Carregado sob demanda** (`mapasSobDemanda.ts`): quem joga a Cidade Neon não baixa nada dele.
2. **O rio é o termômetro:** a **frente** (`AmazoniaRio.ts`) é um número; a montante o rio é limpo (verde-azulado, espuma branca, a floresta viva), a jusante é morto (água preta com óleo iridescente, a copa seca, o chão queimado). **O Draga-01 desce o leito rio acima a 2,6 m/s, a frente anda com ele** e ele para a 240 m da aldeia depois de uns 9 minutos. **É DEMO** (só desenho, sem corpo).
3. **Ligado ao jogo:** `?mapa=amazonia&modo=deathmatch`, o link do seletor de mapas (AMAZÔNIA · RIO VIVO), a missão **RIO VIVO** no mapa-múndi do console (o lugar é proposta, no Pará), a campanha (etapa na Amazônia), os nascimentos (o jogador na aldeia, os outros ao longo da margem sul), o radar e o minimapa com a planta e os marcos. Só offline e só Deathmatch.
4. **Achados no caminho (R17, consertados):** (a) `UniformsUtils.merge` **copia o valor** do uniforme, então a água e a lagoa nunca leriam a frente nem o tempo (o teste de uniformes compartilhados pegou); (b) **a chave da campanha não lia os mapas Praia e Amazônia e o link da etapa só levava `mapa=` para o Bunker**: uma etapa na Praia abria a Cidade Neon (já existia; consertado, com teste); (c) **o céu saía preto no jogo** (a câmera do jogo vai a 800 m e o domo tinha 2.200 m; a bancada tinha a câmera dela e não via): agora o mapa traz o `alcanceDaCamera` (1.500 m) e a bancada usa o mesmo.
5. **A bancada** (`medicoes/amazonia.mjs`: fotos de 9 vistas e contagem; `medicoes/amazonia-jogo.mjs`: o jogo real, com a câmera dele) e as capturas em `arte/amazonia-*-b1-claude.jpg`.

**Provas:** **2.892 testes em 279 arquivos** passam (os do mapa: terreno, rio, floresta, estruturas, mapa montado com o orçamento, registro sob demanda, a partida na Amazônia com o Mech andando no relevo, radar, minimapa, campanha, nascimentos, link). **Mutação à mão: 69 de 71 pegas**; as 2 que escapam são equivalentes (a guarda de declive da floresta repete o que a fórmula de densidade já faz; a guarda do nascimento repete a da aldeia). **Medido na bancada** (SwiftShader, sem GPU): **29 a 55 desenhos** (teto 70), **102 a 227 mil triângulos** (teto 250 mil), 58 colisores (teto 400). JS de partida **497,2 / 500 KB** (o mapa tem 7 KB sob demanda; o `ServerPanel` também passou a ser sob demanda).

**Custo de CPU:** por quadro, o `update` escreve um número (o tempo), o `observar` percorre 24 pedaços (um `hypot` cada, sem alocar) e leva o céu junto; o Draga é um desenho com 18 ossos; a simulação não ganhou nada (o mapa é só terreno e paredes). Nenhum `new` por quadro.

**Onde o Comandante confere:** **`cybermech.online/jogar/?mapa=amazonia&modo=deathmatch`** (ou o seletor de mapas, AMAZÔNIA · RIO VIVO): você nasce na aldeia, na margem sul do rio, no meio da floresta. **Ande para leste pela margem** (os pontos de nascimento ficam a cada 170 m) até a frente do veneno: a água fica preta e a floresta seca. Sem jogar: `node .decepticons/medicoes/amazonia.mjs --vistas draga,jusante` e as fotos em `.decepticons/arte/amazonia-draga-b1-claude.jpg` (o rio limpo, o Draga no meio da curva e o morto atrás).

**Falta (R13):** **não é fase, é mapa de Deathmatch**: sem missão, defesa, geradores do escudo, invasão com androides nem cura do rio (partes C a E). **O Draga é DEMO** (sem corpo: não ataca, não leva tiro, não bloqueia). **O orçamento é de contagem** (SwiftShader), **falta medir quadros por segundo numa GPU de verdade** (G12). O chão de cima mostra um desenho de espinha de peixe; sem som ambiente, pássaros nem partículas; a floresta troca a árvore pelo bloco a 260 m (pode estalar). **A imagem da serpente não chegou** (reenviar ou largar em `D:\imagens cybermech\` e dizer o nome). **Uma pasta de resto na raiz do disco** (`C:\.tmp`, de um erro meu do script do Blender, já corrigido) **precisa ser apagada por você** (minha ferramenta não deixa eu apagar fora do projeto). **Uma trava mudou (a do JS por fase, da parte A):** continua valendo o veto do Comandante.

**Próxima sessão começa com:** a **parte C** (o Draga como chefe com corpo na simulação: as quatro pernas como módulos de dano, o rastejo, a barra do chefe e a derrota na aldeia), e o `fichas/fatos-mineracao-amazonia.md` (as fontes dos fatos antes de qualquer texto de missão).

## IDIOMA: O HANGAR, O ESQUADRÃO, AS CAMPANHAS E O HUD DEIXAM DE FALAR PORTUGUÊS — Claude, 17/10 (branch `claude/idioma-telas`, P173)

**O Comandante (17/10):** *"idioma tem que ficar logo no início […] pra pessoa já selecionar o idioma nativo dele"*. Escolhida a língua, as telas avançadas ainda caíam no português: **auditoria no navegador de verdade, em japonês** (`.tmp/auditar-idioma.mjs`, que abre cada tela e lista o texto sem tradução) achou ~250 textos no Hangar, no Esquadrão, nas Campanhas e no HUD.

**Feito:**
1. **232 textos novos em cada uma das seis línguas** (737 por língua): o Hangar inteiro (rótulos, unidades, chassis, módulos, as quatro chapas, os papéis de cada chassi), o Esquadrão, as Campanhas e o HUD da partida (a vista 1ª/3ª pessoa/tática, as ordens aos aliados, o contato).
2. **As dicas das 22 armas do Hangar** (`public/dicas-do-hangar.json`) com tradução: o encaixe agora traduz **cada pedaço** da frase (a dica, o aviso dos ombros, o das costas, o do tamanho 3, a regra da chapa) antes de juntar, porque a frase muda caso a caso e não tem uma chave só.
3. **Composição genérica `{0} · {1}` e `{0} · {1} · {2}`**: o jogo escreve muito texto como "MÉDIO · ASSALTO · Equilíbrio entre alcance e mobilidade." ou "PADRÃO · 3,0 t"; as chaves de composição traduzem **cada parte pelo que o dicionário já sabe** (as descrições dos chassis já estavam traduzidas e não apareciam por estarem coladas). **Duas regras novas no motor (`i18n.ts`):** (a) entre dois padrões que servem ao mesmo texto, vence o de **mais texto fixo** (antes contava o tamanho do regex, que conta cada lacuna); (b) uma chave **sem " · "** não engole uma composição (`ESCALA {0}` não pega "ESCALA 3 · CERCO · …").
4. **Teste de cobertura que exige que nada em português sobre** (`i18n.test.ts`: só nomes próprios e unidades): as dicas, ~18 textos compostos do Hangar, o HUD, o Esquadrão e as Campanhas. **Prova no navegador de verdade:** a auditoria em japonês caiu de ~250 textos para os nomes próprios, as telas do dono e os rótulos de acessibilidade do mapa; capturas `arte/idioma-hangar-*-claude.png`.

**Custo de CPU:** zero (a tradução é por mapa em memória, com cache; o JS cresce o `traduzir` do Hangar, dentro do orçamento).

**Falta (R13):** (a) **revisão por falante nativo** (as traduções são minhas, como as da landing e do Arquivo); (b) as **telas do dono** (Arsenal, Estúdio, Servidor, Painel Admin) e os rótulos de acessibilidade do mapa seguem em português de propósito; (c) o **texto de rádio e de briefing das missões** não foi auditado (só abre jogando a missão); (d) a **voz do narrador** segue em português.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## O ARQUIVO: SEIS FICHAS QUE ENSINAM, NAS SETE LÍNGUAS — Claude, 17/10 (branch `claude/arquivo`, P179 camada 2)

**O Comandante (17/10):** *"devemos explicar o que são [o nazifascismo] e como se manifestam, a rede de mentiras, os interesses obtusos por trás das elites, a manutenção do medo […] pelo menos SUTILMENTE E ELEGANTEMENTE, pedagogicamente"*. A camada 1 (o seletor de lado) já estava no ar; esta é a camada 2 do `LADO_E_PEDAGOGIA.md`.

**Feito:**
1. **O Arquivo** (`ui/ArquivoPanel.ts`): o chip **ARQUIVO ▸** (console completo e pausa, ao lado do selo do lado) abre a placa com a lista das **seis fichas** à esquerda (a marcada em barra dourada com chevron) e a ficha à direita: **o que é, como aparece, como se defender e as fontes**. Setas do teclado (circular), Esc fecha, Enter não vira "jogar", sem rolagem em 1280×720. A ficha 6, **as incoerências**, é **sátira declarada** e a tela avisa ("SÁTIRA DECLARADA · NÃO AFIRMA FATO"). **Opcional, nunca uma porta** (P133): não aparece sozinho.
2. **Sete línguas, em arquivos:** `client/public/arquivo/<língua>.json` (pt, en, es, fr, ja, zh, ru); língua sem arquivo cai no inglês e depois no português. **Fora do pacote de JS:** o conteúdo é JSON e o **painel é um pedaço sob demanda** (`import()` no clique do chip, 1,65 KB gzip), por causa do orçamento de partida (499,6 / 500 KB).
3. **Testes (`ArquivoPanel.test.ts`, 10):** o JSON quebrado não passa; seis fichas na mesma ordem e com o mesmo número de sinais em todas as línguas; só as incoerências são sátira; toda ficha tem fonte; teto de tamanho (cabe sem rolagem); **nenhum nome de político ou bilionário vivo em nenhuma língua**; a ligação (chip, `import()`, tecla). **Prova no navegador de verdade** (`arte/arquivo-*-claude.png`): abre, setas, circular, Esc, japonês carrega o arquivo dele, só o `pt.json` é pedido antes.
4. **De passagem (R17):** `algoPorCima` agora inclui o `.lado-modal` (o seletor de lado e o Arquivo): as teclas do console não valem com eles por cima.

**Custo de CPU:** zero fora do clique (um `fetch` de 3,5 KB na primeira abertura de cada língua e o pedaço de 1,65 KB).

**O que o Comandante precisa saber (R13):** (a) **as fontes estão citadas de memória** (Eco 1995, Paxton 2004, Stanley 2018, Arendt 1951, RAND 2016, Cohen 1972, Herman e Chomsky 1988): **um revisor humano confere título, ano e trecho antes de a tela ir ao ar**; (b) **nenhum caso real nem número** entra sem fonte que o Comandante dê; (c) as traduções (es, fr, ja, zh, ru) são minhas e **pedem falante nativo**; (d) o **orçamento de JS de partida está em 499,6 / 500 KB**: texto longo vai para JSON em `public/`, recurso opcional vira `import()`; quem estourar o teto trava o `npm run check` de todos.

**Falta:** o **Relatório de Consequências** (fim da missão com números lidos de ficha) e a **campanha do Consórcio** (P179 camadas 3 e 4); o Arquivo como **primeira pergunta depois da primeira rodada** segue decisão do Comandante (`LADO_E_PEDAGOGIA.md` § 7.6).

**Próxima sessão começa com:** o que o Comandante julgar (o texto das fichas é dele); depois o Relatório de Consequências, a Amazônia (P180) e os ombros dos chassis pesados (P181).

## O PAR SOLO / MULTI NA PRIMEIRA TELA — Claude, 17/10 (branch `claude/solo-multi`, P182)

**O Comandante (17/10):** na segunda captura dos jogos antigos ele escreveu à mão **MULTI** sobre o "2Players". A primeira tela dos jogos antigos é uma pergunta de duas respostas grandes.

**Feito:**
1. **A primeira tela agora tem o par.** O botão verde segue sendo o **SOLO** (com a nota "SOLO · contra os bots" embaixo) e, logo abaixo, a chapa azul fria **MULTI** ("online, com outros pilotos", tecla O) que **acende em barra dourada** sob o mouse ou com o foco. Clicar abre o lobby online (`OnlineLobby`), pelo mesmo botão que o monitor da REDE já usa: a regra de entrar online continua num lugar só (`OnlineSwitch`). Só aparece com servidor no build e fora de uma sala; some quando o console completo acende (o monitor da REDE já tem o botão: nada repetido). Textos nas sete línguas.
2. **Provado no navegador de verdade** (`arte/primeira-tela-solo-multi-claude.png`, `arte/primeira-tela-multi-dourado-claude.png`): o par aparece na primeira visita, o clique abre o lobby sem "jogar" por baixo, fechar volta ao par, o japonês traduz, "EXPLORAR HANGAR E MODOS" faz o par sumir, zero erros. Teste (`CommandConsole.test.ts`): o HTML, a delegação do clique e o CSS.

**Custo de CPU:** zero (um botão e um clique; a tela enxuta já não acende os monitores).

**Falta (R13):** (a) a **placa** (borda forte, rebites) no console e na pausa; (b) a barra dourada nas **listas do console**; (c) o **olho do Comandante** sobre o par: o MULTI pode ir ao lado do botão verde em vez de embaixo (só CSS).

**Próxima sessão começa com:** o que o Comandante julgar; depois o Arquivo (P179), a Amazônia (P180) e os ombros dos chassis pesados (P181); as dicas de arma do Hangar sem tradução (entrada abaixo).

## A INTERFACE DOS JOGOS ANTIGOS NAS CONFIGURAÇÕES: A LINHA EM BARRA DOURADA E O `‹ VALOR ›` — Claude, 17/10 (branch `claude/interface-antiga`, P182)

**O Comandante (17/10):** *"veja esses exemplos de interface de jogos antigos, eu acho muito boas!"* (duas capturas do Aero Fighters; `REFERENCIA_VISUAL.md` § 8 tem a leitura e o que levamos). *"continue iterando"*.

**Feito:**
1. **`ui/Passo.ts`: o seletor `‹ valor ›`.** Veste um `<select>` que **continua existindo, escondido**: o jogo segue lendo e escrevendo `select.value`, ouvindo `change`; o `‹ valor ›` espelha o que o select diz (por clique, pelas setas do teclado, por mudança de código e pelo texto traduzido) e o muda com **um passo, circular**, sem abrir lista. Nove nas Configurações: qualidade, dificuldade, narrador, quantidades e personalidades dos inimigos. **O idioma fica como lista** (sete línguas).
2. **A linha selecionada em barra dourada com chevron** (`❯`) nas Configurações: a linha sob o mouse ou com o foco, como na referência (barra dourada de ponta a ponta, texto escuro, o passo em fundo escuro).
3. **Testes (`Passo.test.ts`, 8):** o passo circular, o rótulo, o limite de opções, o estilo e a ligação (o select do idioma não vira passo). **Prova no navegador de verdade** (`arte/interface-passo-*-claude.png`): os nove passos existem, o select está escondido e **acompanha** (clique, duas voltas, mudança por código, seta do teclado) e a troca para o japonês **refaz o texto** dos passos.

4. **Orçamento de JS (R7): o pacote chegou a 500,03 KB (limite 500).** As dicas de arma do Hangar saíram do código para `public/dicas-do-hangar.json` (carregado ao abrir o Hangar): **498,49 KB**, folga de 1,5 KB. Texto estático longo novo vai para JSON em `public/`, não para o pacote (`HISTORICO_DE_DECISOES.md`).

**Custo de CPU:** zero fora do clique (um observador de opções por seletor, que só dispara quando o texto das opções muda) e um `fetch` de 3,5 KB na primeira abertura do Hangar.

**Achado aberto (R17):** as 22 dicas de arma do Hangar **não têm tradução** nas seis línguas (o Hangar fala português em qualquer idioma): traduzir cada dica em `public/dicas-do-hangar.json` + dicionários, e o teste de cobertura passa a checar.

**Falta (R13):** (a) o par **SOLO / MULTI** na primeira tela (a anotação dele sobre "2Players"): *feito na entrada acima*; (b) a **placa** (borda forte, rebites) no console e na pausa; (c) a linha em barra dourada **no console** (as listas de operação); (d) o **olho do Comandante**: se a "pele" agradar, (a) a (c) seguem; se ele quiser mais perto da chapa dos jogos antigos, é só CSS.

**Próxima sessão começa com:** o que o Comandante julgar; depois SOLO / MULTI (P182), o Arquivo (P179) e a Amazônia (P180).

## AMAZÔNIA, PARTE A: O DRAGA-01 ANDA — o plano, o rig e a marcha do quadrúpede — Claude, 17/10 (branch `claude/amazonia-mina`, P180)

**A ordem do Comandante:** *"vamos já planejar e construir a próxima fase: o rio Amazonas, uma mineradora acabando com o rio… Já criei o modelo (`heavy industrial walker 3d model`): é um mech maior que o Colossus v4, então o cenário precisa ser bem maior… faça sua melhor versão desse modelo: ele deve se mexer (eu não inseri o RIG: tenho que fazer ou você faz?)"* e *"acima desse super mech o rio é limpo e vivo, e depois dessa máquina o rio fica poluído, sujo, com óleo e envenenado"*. **Resposta: o rig é meu; o Comandante não precisa rigar.**

**Feito:**
1. **O plano** (`AMAZONIA.md`): a mecânica central (**o rio é o termômetro da fase**: limpo a montante do Draga, envenenado a jusante, curando conforme as peças caem), a história (mineradora AURUM, do Grupo Vorcaris: arquétipo, nunca empresa real), o mapa de 2.400 × 900 m com o orçamento (≤ 70 desenhos, ≤ 250 mil triângulos, ≤ 400 colisores), a missão em quatro atos (desmantelar o escudo, derrubar as pernas, invadir com androides, o rio se cura), as partes A a E e as decisões em aberto. A ordem é a **P180**.
2. **O rig do Draga-01** (`scripts/blender/rig-walker.py`, Blender sem janela em `D:\blender\blender.exe`): o arquivo do Comandante é **um quadrúpede de 27 mil triângulos, uma malha só, sem esqueleto, sem pele e sem textura** (537 peças soltas). O script classifica cada peça pela posição (conferida em foto), mede as juntas das quatro pernas nas próprias peças e monta **18 ossos com pele rígida por parte** (a junta não amassa) e **cor nos vértices** (amarelo nas coxas, aço nas canelas, creme no convés, laranja nos guindastes, sujeira para baixo): **984 KB, um desenho**. O original não é tocado; o jogo usa `client/public/models/draga-01.glb`. Reproduzível.
3. **A marcha** (`entities/walkerGait.ts`, função pura): **quatro tempos** (dianteira esquerda, traseira direita, dianteira direita, traseira esquerda; pisada de 75%: **sempre três pés no chão**), passo de **5 m** casado com a velocidade (o pé não escorrega), balanço do casco (um mergulho por passo), convés que gira para a mira, guindastes que oscilam e radar que gira; **perna caída**: o joelho dobra, o casco afunda e inclina para o lado dela. Sem alocar por quadro.
4. **O desenho** (`entities/WalkerVisual.ts`): carrega o `.glb`, escala para **38 m** (tamanho 5), liga cada osso a uma junta que gira nos eixos do Mech (a mesma `AxisCorrectedJoint` dos robôs importados), **mede o sinal do joelho olhando o tornozelo subir** (perna a perna) e aplica a pose. Só do cliente: o servidor nunca carrega `.glb` (G14).
5. **A demonstração** (`debug/WalkerDemo.ts`): **`?walker`** no link põe o Draga andando em círculo de 70 m em volta de onde você nasceu, com o convés mirando em você, em qualquer mapa. **É DEMO**: ainda não é inimigo (não tem corpo na simulação, não atira, não leva tiro).
6. **A bancada** (`medicoes/walker.mjs`): fotografa o Draga de várias vistas e em fases da marcha, ao lado do Vector-09 (a régua de escala).
7. **O orçamento de JS por fase** (`scripts/orcamentoDeJs.mjs`, o `smoke` e 8 testes em `server/orcamentoDeJs.test.ts`): o Draga estourou o teto de 500 KB gzip do push (a `main` já estava em 499,8 KB), então o código dele é **carregado sob demanda** (`?walker`) e o `smoke` passou a medir **dois** tetos: o **de partida** (o que todo jogador baixa; segue 500 KB) e o de cada **pedaço sob demanda** (150 KB). Sem `?walker` nada do Draga é baixado (provado no build de produção). **Muda uma trava do projeto: o Comandante pode vetar** (`HISTORICO_DE_DECISOES.md`, 17/10). **A folga da partida é de 0,1 KB.**

**Provas:** **43 testes**: 16 da marcha pura (a ordem dos passos, nunca dois pés no ar, o quadril contínuo, o pé que não escorrega, a pose sem alocar, a perna caída, o dado torto), **23 do rig com o arquivo REAL carregado em Node** (os 18 ossos, o orçamento de triângulos e de peso, pele rígida de peso 1, 38 m e frente em -Z, quadril positivo leva o pé à frente, o joelho que levanta o pé em cada perna, o pé chato, o convés que gira, 20 s andando sem dois pés no ar e sem escorregar, a inclinação do casco, o radar, o arquivo sem osso que é acusado, duas instâncias independentes) e 4 da demonstração. 34 de 34 mutações à mão pegas. **Descoberta útil:** o `GLTFLoader` roda em Node quando o arquivo não tem textura, então o rig se testa sem navegador. Capturas: `arte/walker-*-a1-claude.jpg` (as vistas, a marcha em quatro fases, as pernas caídas, a escala) e `arte/walker-jogo-praia-s40-claude.jpg` (no jogo de verdade).

**Onde o Comandante confere:** **`?walker`** (e `?mapa=praia&modo=deathmatch&walker`): o Draga anda em círculo à sua frente, de 38 m, e mira o convés em você. Para ver sem jogar: `node .decepticons/medicoes/walker.mjs --fases 0,0.2,0.4,0.6 --vistas lado`.

**Falta (R13):** **tudo o que é o resto do plano** (partes B a E: o rio e o mapa, o Draga como chefe com corpo, a defesa, a invasão). Do próprio Draga: sem som de passo nem poeira (o gancho `onFootstep` existe); sem fumaça na chaminé; o material é simples (sem janelas acesas); o dano por parte ainda não aparece no desenho (só a perna caída, por número); **a imagem da serpente não chegou**.

**Próxima sessão começa com:** a **parte B**, o mapa `amazonia` e o rio com a frente de limpeza (`AMAZONIA.md` §§ 3 e 5).

## A LANDING FALA SETE LÍNGUAS, COM A FAIXA DE IDIOMAS NO TOPO — Claude, 17/10 (branch `claude/landing-idiomas`, P178)

**A ordem do Comandante (17/10):** *"idioma tem que ficar logo no início da landing, pra pessoa já selecionar o idioma nativo dele"*.

**Feito:**
1. **A faixa de idiomas é a primeira coisa da página** (`<nav class="lang-strip">`, antes da navegação): as sete línguas pelo nome nativo, a escolhida em destaque; **enquanto o visitante não escolhe, a faixa fica realçada** (o convite). Trocar traduz a página inteira na hora.
2. **`scripts/site/idioma-landing.js`** (JavaScript puro, sem build: a landing é estática): a mesma ideia do jogo (P173), português como texto de origem, dicionário por língua com lacunas `{n}` para o que o gerador preenche (os números saem do código do jogo). Traduz os textos, `title`/`aria-label`/`alt`, o `<title>` e a descrição. **Escolha: `?lang=` → a salva → a do navegador (fora de navegador de teste) → português**; a escolha vai para `cybermech.lang`, **a mesma chave do jogo**, então quem escolhe na landing **já entra no jogo na língua dele**.
3. **`scripts/site/locales/*.json`: 208 textos por língua** (en, es, fr, ja, zh, ru), copiados para ao lado da página pelo gerador (`scripts/landing.mjs`).
4. **Testes (`server/idiomaLanding.test.ts`):** o tradutor da landing e o do jogo **dão a mesma resposta** (exata, padrões, lacunas traduzidas, margens, espaços quebrados, escolha da língua); os seis dicionários têm as mesmas chaves, sem vazio e com as mesmas lacunas; **a landing de verdade é montada** e confere a faixa como primeira coisa do corpo, o módulo e os dicionários ao lado, e que **90% ou mais dos textos têm tradução** (texto novo sem tradução aparece aqui antes de ir ao ar). O tradutor do jogo ganhou o mesmo fallback de espaços quebrados.

**Custo de CPU/peso:** zero no jogo. Na landing: um módulo de ~4 KB e, só para quem escolhe outra língua, um JSON de ~14–22 KB; a tradução roda uma vez por troca (a página é estática, sem observador).

**Falta (R13):** (a) **as traduções são da Claude e precisam de revisão por falante nativo** antes de divulgar fora do Brasil; (b) a Oficina, a Sala de controle e as demais páginas internas seguem em português; (c) as imagens com texto (as fotos de cena) não são traduzidas; (d) alemão e coreano (os outros mercados da P171) são um JSON novo cada.

**Próxima sessão começa com:** o que o Comandante julgar; depois o Arquivo e o Relatório de Consequências (P179), a missão da Amazônia (P180) quando o modelo chegar, e a linha selecionada em barra dourada nas Configurações (P182).

## DE QUE LADO VOCÊ JOGA? O SELETOR DE LADO, O ARPÃO POR PESO E O PLANO DA AMAZÔNIA — Claude, 17/10 (branch `claude/lado-e-arpao-peso`, P178 a P182)

**O Comandante (17/10)** mandou, numa mensagem só, cinco ordens: o idioma logo no início da **landing** (P178); **perguntar o lado** (Aliança × Consórcio) e **ensinar** o que é o fascismo, a rede de mentiras e o medo, de modo sutil e pedagógico (P179); a **missão da Amazônia** (a mineradora no rio; o modelo é dele, em outro chat) (P180); a regra do **arpão** (o robô mais leve não puxa o mais pesado) (P181); e **referências de interface de jogos antigos** (P182).

**Feito neste PR:**
1. **P181, o arpão por peso (código, REAL):** `HookSystem.pesoDe` (o raio da cápsula): o alvo mais pesado que o atirador não é preso; igual e mais leve são. Substitui o limite fixo de 2,4 m (`breakRadius` saiu da arma). 4 testes e 3 mutações; a dica, o Arsenal e o Hangar dizem a regra nas sete línguas.
2. **P179, o seletor de lado (código, DEMO):** o selo **LADO** no console e na pausa; a pergunta no estilo da placa de metal (P182); o painel **"o discurso e o custo"** para o Consórcio. Teclado (setas, Enter, Esc), traduzido, sem porta (o primeiro acesso não pergunta nada). **Não muda o combate.** Visto no navegador de verdade (`arte/lado-*-claude.png`).
3. **Documentos de design:** `LADO_E_PEDAGOGIA.md` (a pergunta, as quatro camadas, as regras que protegem a ideia, o Arquivo e o que ensinar, as decisões dele), `fichas/fascismo-e-propaganda.md` (a base do Arquivo, **fontes a conferir por um revisor**), `fichas/cenario-amazonas.md` (a missão em cinco fases e o que o modelo dele precisa trazer) e a § 8 de `REFERENCIA_VISUAL.md` (a leitura das duas capturas e o que levamos).
4. **O registro:** as cinco ordens em `ORDENS_DO_COMANDO.md` (P178 a P182; a P177 é de outra sessão).

**Custo de CPU:** zero (HTML/CSS e um clique; a regra do arpão é uma comparação por aperto).

**Falta (R13):** (a) **P178, a landing em outras línguas** (próximo PR); (b) o **Arquivo**, o **Relatório de Consequências** e a **campanha do Consórcio** (P179); (c) **a missão da Amazônia** (P180), à espera do modelo; (d) **ombros nos chassis pesados**, sem os quais o arpão por peso não rende nas mãos de um robô grande (P181); (e) a linha selecionada em barra dourada, o `‹ valor ›` e o par **SOLO / MULTI** (P182); (f) as **decisões do Comandante** em `LADO_E_PEDAGOGIA.md` § 7 (nomes reais ou arquétipos; quanto o Consórcio é jogável; o Arquivo opcional; quem revisa os textos de fato; onde publica).

**Próxima sessão começa com:** a landing em outras línguas (P178).

## AS OUTRAS FASES, PARTE E: A CIDADE NEON GANHA O TRANSFORMADOR DO BANCO VORCARIS E A BARRA DO CHEFE — Claude, 17/10 (branch `claude/outras-fases`, P177, P164, P165)

**A ordem do Comandante:** *"CONTINUA SEGUINDO A PARTE B, C e a D, e melhore as outras fases além da estação cabos"*, e da P164: *"um tipo de circuito que podemos repetir nas diferentes fases… além de chefes especiais com contexto em cada outra fase"*.

**Feito (na missão em ondas da Cidade Neon, a Arena em `?modo=survival`, que é a missão padrão do jogo):**
1. **O circuito do quadro de luz se repete** (`sim/QuadroDeLuz.ts`): a regra pura agora tem **lugar e vida próprios** (`new QuadroDeLuz(ponto, vidaMax)`; sem argumentos é o do porto da praia, 240). O **transformador do Banco Vorcaris** (`environment/ArenaLayout.ts`: x -13, z -33, a leste da porta do banco, **480 de vida**) é a segunda instância. A mesma regra: **da onda 2 em diante o primeiro andróide vivo é o saboteiro**; **o Colossus da onda 6 vai direto a ele** (peso 4: apaga o de 480 em ~20 s) e, com o transformador apagado, **é solto e volta ao comportamento de sempre**; o jogador ou um aliado perto, sem rebelde em cima, recupera (8 por segundo, até dois; volta a ligar com 25%, 120).
2. **A cidade escurece com a energia** (`environment/Arena.ts`): as arestas, as faixas e as janelas dos três prédios, a plataforma e a rampa, as torres do horizonte e **a placa do BANCO VORCARIS** caem até 12% (`PISO_DA_LUZ_DA_CIDADE`: no escuro, não cego); com o transformador **apagado as zonas de cura e de resfriamento deixam de funcionar e o desenho delas some** (a mesma regra da praia).
3. **O desenho** (`environment/ArenaQuadro.ts`): uma cabine de aço com as arestas no azul do banco, uma tela voltada para o meio da arena e um **farol de 9 m** para achá-la de longe: **verde** ligado, **laranja trêmulo** sabotado, **vermelho piscando** apagado; com colisor. **Quatro desenhos**, só na missão em ondas.
4. **O HUD de missão fora da praia** (`ui/PraiaHud.ts` em modo `soMissao`): a célula **"TRANSFORMADOR · BANCO VORCARIS"**, a **barra do chefe** e os avisos do topo, sem o que é só da praia (a faixa da costa, a rede, os cabos, as portas, o cartão, a água, o marcador). **Antes desta parte o Colossus da Arena não tinha barra nenhuma.** A **regra dita do chefe muda com o alvo**: nos cabos da praia ("Ele vai cortar os cabos. Derrube as pernas."), no transformador da Cidade Neon ("Ele vai apagar o transformador do banco. Derrube as pernas.").

**Provas:** **37 testes novos**: 5 na regra pura (vida e lugar próprios, a vida maior segura mais, a volta aos 25% da vida dele, a fração, o reparo e o teto), 4 do layout (o armário não encosta em prédio, barricada, plataforma, zona nem nascimento), **6 de partida** (`Match.arena.test.ts`: só a missão em ondas tem o transformador, a onda 1 sem saboteiro e a 2 com um, o saboteiro chega e o depreda, as zonas caem e o jogador as religa, o Colossus o apaga e é solto, `restartMission`), **12 do desenho e da cidade** (a energia linear, o piso, as zonas, a placa do banco, o horizonte, sem o transformador nada muda) e **9 do HUD de missão** (com um DOM de mentira) mais 1 da regra dita por alvo. A suíte inteira passa. 54 de 56 mutações à mão pegas (as duas que escaparam são equivalentes: a histerese da energia só poupa custo, e dar ordem a um bot morto não muda o jogo). Capturas: `arte/arena-banco-e1-q0_1_1-claude.jpg` (ligado), `…q1_0.4_0.4…` (sabotado), `…q2_0_0…` (apagado, a cidade no escuro), `arena-cidade-e1-q*` (a cidade nos três estados), `arena-chefe-e1-q0_1_1` (o Colossus mascarado ao lado do banco) e **`arena-jogo-onda6-e1-s30-claude.jpg` (o HUD no jogo de verdade)**.

**Onde o Comandante confere:** `?modo=survival` (a Arena é o mapa padrão; `&onda=2` para o saboteiro, `&onda=6` para o Colossus): o banco é o prédio com a placa BANCO VORCARIS, e o transformador fica a leste da porta dele, com o farol verde de 9 m. Veja a célula do transformador no topo do HUD; deixe o saboteiro chegar e a cidade escurecer; corra lá e recupere. Para ver sem jogar: `node .decepticons/medicoes/arena.mjs --vistas banco,cidade --quadro "2:0:0"` (estado:vida:energia).

**Equilíbrio (R13): a missão padrão ficou mais exigente.** Sem o transformador as zonas de cura caem (não se perde a missão por isso, ao contrário do núcleo da praia). Nenhum número foi validado jogando: a vida (480), o peso do Colossus e a volta aos 25% são linhas de tabela.

**Falta:** dano a tiro no transformador; o transformador não aparece no minimapa; **Bunker, Bandeira e Domínio ainda não têm circuito** (a Cidade Neon do Deathmatch segue a de sempre); a Cidade Neon não tem ciclo do dia (é noturna por desenho); **o chefe com contexto próprio de cada fase** (o Banco Vorcaris como fábrica dos bots, P165) segue desenhado, não feito; o interior do banco (P149); só offline.

**Próxima sessão começa com:** o ajuste fino jogando dos dois mapas (praia e Cidade Neon) e a próxima fase da lista: o **Bunker** (que hoje só tem Deathmatch) ou o **Capítulo 4, SANÇÃO** no banco (o congelamento e as chaves de rota, `CAMPANHAS_E_CHEFES.md` § 2).

## CAPÍTULO 1, PARTE D: A COLOSSUS EM TRÊS FASES, A BARRA DO CHEFE E A MÁSCARA — Claude, 17/10 (branch `claude/cap1-parte-d`, P165, P147)

**A ordem do Comandante:** *"CONTINUA SEGUINDO A PARTE B, C e a D"* e, da P165, *"os Colossus V1, quero que você coloque uma MÁSCARA DO TRUMP nele (uma skin, que não será a padrão, apenas quando ele for o chefe)"*.

**Feito (na missão em ondas da praia, o Colossus da onda 6):**
1. **As fases do chefe** (`sim/FasesDoChefe.ts`, regra pura, G14): **ANDA** (as duas pernas de pé) → **MANCA** (uma caiu: metade da velocidade, a regra de sempre do `MechBase.mobility`) → **RASTEJA** (as duas caíram) → **CAIU** (o tronco zerou). **Não criei sistema de dano novo:** a fase sai da vida das pernas e do tronco que o dano por parte já tem. O que é só do chefe: **ele rasteja** (`MechBase.crawls`, 30% da velocidade; num Mech comum, perna destruída segue como torre imóvel) e **escolhe o alvo**.
2. **O alvo do titã:** o **cabo mais perto que ainda não foi cortado** (peso 4: corta em ~17 s, cada cabo cortado drena a rede); com os três cortados, **a porta principal do prédio**. Quem derruba as pernas o para; rasteja e continua atirando e depredando, **então é outra luta, de perto e sem pressa, mas ainda indo ao cabo**. O `Match` o manda por `dirigirOsInvasoresAosAlvos` (a mesma ordem `hold` dos manifestantes).
3. **A barra do chefe no HUD** (`ui/PraiaHud.ts`): só com o Colossus em campo. Título "COLOSSUS-01 · FASE n DE 3 · ANDA/MANCA/RASTEJA", a barra do tronco, as duas pernas (PERNA ESQ / PERNA DIR, riscadas quando caem) e **a regra da fase dita numa linha** ("Ele vai cortar os cabos. Derrube as pernas." / "Uma perna caiu: ele manca. Derrube a outra." / "Rasteja e atira. Acabe com ele antes que o último cabo caia."). Avisos no topo: "UMA PERNA CAIU · ELE MANCA", "RASTEJA · ACABE COM ELE", "COLOSSUS-01 CAIU". O DOM só muda quando a fase, as pernas ou a barra (passos de 1%) mudam.
4. **A máscara** (`entities/mascaraDoChefe.ts`): a **caricatura** do Trump (sátira política, pedido do Comandante), **só no Colossus que é o chefe da missão**; o Colossus que o jogador monta no Hangar não a tem. **12 caixas e 3 materiais, criados uma vez** na montagem do chefe: rosto laranja chapado, nariz saltado, sobrancelhas, fendas dos olhos e da boca, o topete dourado que cai para a frente e as laterais. **1,3× a cabeça** (a cabeça tem 1,65 m numa máquina de 14 m; no tamanho dela não se lia de longe). **Desligável: `?mascara=0`** (ou `off`/`nao`) no link tira; sem o parâmetro ela entra.

**Provas:** **8 testes da regra pura** (`FasesDoChefe.test.ts`: a fase pelas pernas, a perna ferida de pé que não muda a fase, os códigos e os textos do HUD, o rastejo a 30% onde um Mech comum fica imóvel, o cabo mais perto e o desempate, o cabo cortado que não vale, os três cortados (vai à porta), os avisos); **5 de partida** (`Match.chefe.test.ts`: só a onda 6 traz o chefe, que rasteja e veste a máscara, e o `?mascara=0` a tira; ele corta o cabo em ~17 s e segue para o próximo; as pernas mudam a fase e o que rasteja ainda anda, devagar, ao cabo; o tronco zerado o derruba; com os três cabos cortados vai à porta principal); **5 da máscara** (o link, as peças e o grupo, o desenho na frente da cabeça, a escala com o rosto no meio, idempotente e fora do Hangar). **19 de 19 mutações à mão pegas**. Capturas: `arte/praia-cabecadochefe-d1-d30-claude.jpg` (a cabeça do Colossus com a máscara) e `arte/praia-chefe-d1-d30-claude.jpg` (o titã inteiro no cais).

**Decisões desta parte (também no HISTORICO):** só o chefe rasteja; o alvo é o cabo mais perto ainda de pé e depois a porta principal; o jogador pode **kitar** (afastar o titã dos cabos atirando e correndo: é permitido, é uma estratégia); a máscara é 1,3× e desligável; **o risco jurídico e de plataforma de caricaturar uma figura pública segue registrado em `CAMPANHAS_E_CHEFES.md` § 0 e o botão de desligar fica**.

**Onde o Comandante confere:** `?modo=survival&mapa=praia&onda=6` (a onda do chefe): veja a barra no topo, derrube uma perna e leia o aviso e a regra mudarem; `&mascara=0` tira a máscara. Para ver sem jogar: `praia.mjs --arte --sufixo d1 --dias 0.3 --vistas cabecadochefe,chefe --chefe "20,27"` (e `--sem-mascara`).

**Falta (R13):** **o equilíbrio jogando** (a vida e a velocidade do chefe, os 30% do rastejo, o peso 4 nos cabos); **dano a tiro nos cabos, nas portas e no quadro**; a missão só offline (o pool de 13 personagens passa dos 8 de uma sala, G11); a ficha de fato da Enel como cartão no jogo; as vozes (a chave do ElevenLabs foi exposta e precisa ser girada pelo Comandante); **as outras fases** (Arena/Cidade Neon, Bunker, Domínio) ainda não ganharam a melhoria que o Comandante pediu.

**Próxima sessão começa com:** **melhorar as outras fases além da estação de cabos** (a ordem de 17/10), e o ajuste fino jogando do capítulo 1.

## O IDIOMA E A CONTA SAEM DO FUNDO DO MENU PARA O CANTO DA PRIMEIRA TELA — Claude, 17/10 (branch `claude/atalhos-idioma-conta`, P176)

**O Comandante (17/10):** *"nao achei o arpao no hangar, nem a mudança das linguas, nem login"*.

**O que conferi antes de mexer:** abri o **site de produção** num navegador de verdade (sessão limpa, build `bbbc1d8`): o seletor de idioma existe e troca o jogo para o japonês na hora; o bloco da conta existe; o Marauder está destravado e o **Arpão magnético** está na lista de ombros. **Estava tudo no ar, mas escondido:** a primeira tela é a "enxuta" (P133) e só mostra *CLIQUE PARA JOGAR* e *EXPLORAR HANGAR E MODOS*; o idioma e a conta ficavam em Explorar → Ajustar → aba JOGO → rolar, e o arpão exige escolher o Marauder (o último chassi) e abrir a lista dos ombros.

**Feito:** (1) **`<nav class="cc-atalhos">` no canto da primeira tela e da pausa**: o seletor de língua e o botão **[ CONTA ]**; o botão abre as Configurações na aba JOGO **já rolada até a conta** (`data-settings-foco`); (2) os dois seletores de idioma (o do canto e o das Configurações) andam juntos (`i18n.ts`: conjunto de seletores); (3) o botão some enquanto o jogo carrega (não teria o que abrir) e no modo Comandante (o canto é do selo dele); (4) traduções do botão e da dica nas seis línguas (482 textos por língua); (5) teste: o idioma e a conta estão **dentro do `#overlay`, antes do cabeçalho** (um canto que volte para o fundo do menu quebra o teste).

**Custo de CPU:** zero (dois elementos de HTML e um `scrollIntoView` no clique).

**Falta (R13):** (a) **o arpão continua só no Marauder, dentro da lista de ombros**: é a regra (só ele tem ombros), mas não há nada na primeira tela nem no Hangar do Vector-09 que diga isso; se o Comandante quiser, dá para pôr um aviso no cartão do chassi ou uma dica no Hangar; (b) **o olho do Comandante**: se depois do Ctrl+F5 ainda não aparecer, ele precisa dizer **onde está jogando** (site ou pasta local); (c) a landing do site (`/`) segue só em português.

**Próxima sessão começa com:** o que o Comandante disser jogando; a decisão da P171 (ritmo oficial, cosmético de explosão).

## CAPÍTULO 1, PARTE C: O PORTO — os contêineres de desembarque e o quadro de luz da cidade — Claude, 17/10 (branch `claude/cap1-parte-c`, P163, P164)

**As ordens do Comandante:** *"o porto é onde os inimigos chegam, eles devem sair dos contêineres (e na campanha de ondas isso deve ser bem explícito)"* e *"no porto, tem que ter um botão ou chave ou sistema que devemos proteger, para acender as luzes da cidade… um tipo de circuito que podemos repetir nas diferentes fases"*.

**Feito (na missão em ondas da praia):**
1. **Os contêineres de desembarque** (`PraiaLayout.ts`, `PraiaPorto.ts`): três contêineres laranja no cais (a coluna leste do pátio, fileiras z = -48, -32 e -16), a porta para o leste. **Quando a onda entra em campo as portas se abrem para fora** (~2 s, as folhas acendem em laranja de alerta) e **os Mechs e os andróides rebeldes nascem pelas bocas deles**; entre as ondas fecham. Antes os rebeldes nasciam na areia, a ~200 m da estação; agora **a mais de 460 m**: o ritmo mudou (a massa de manifestantes chega em poucos segundos e as máquinas ~45 s depois).
2. **O quadro de luz da cidade** (`sim/QuadroDeLuz.ts`, regra pura, G14): o armário de força na **ponta oeste do cais, a mais de 500 m da estação**. **Da onda 2 em diante o primeiro andróide vivo é o saboteiro**: atravessa o cais e o depreda (peso por tipo; um andróide sozinho leva 80 s). **A energia da cidade é a vida do quadro**: as luzes públicas (bulbos, halos, janelas, poças, feixes) viram o **ciclo do dia vezes a energia**; com o quadro **apagado a cidade fica no escuro e as zonas de cura e de resfriamento deixam de funcionar** (e o desenho delas some). O jogador que chega, sem rebelde em cima, recupera (8/s, até dois; volta a ligar com 25%).
3. **O que o jogador vê:** o painel do armário (verde ligado, laranja trêmulo sabotado, vermelho piscando apagado), uma célula no HUD sob as portas e o aviso no topo ("QUADRO DE LUZ SOB SABOTAGEM · A CIDADE VAI AO ESCURO", "CIDADE NO ESCURO · AS ZONAS DE CURA CAÍRAM", "QUADRO DE LUZ RECUPERADO · A LUZ VOLTOU").

**Provas:** **11 testes da regra pura** (inclui determinismo e invariantes sob 36 mil ticks e o interruptor das zonas); **6 de partida** (`Match.quadro.test.ts`: só a praia tem o quadro, as ondas nascem nas bocas dos contêineres, as portas abrem com a onda em campo, a onda 1 não sabota e a 2 manda o saboteiro, o quadro apagado derruba as zonas e o jogador as religa, `restartMission`); **9 do desenho e dos avisos** (a abertura andando, as folhas abrindo para o leste, o painel, as luzes da cidade sem energia mesmo de noite, as zonas que somem, o teto de desenhos); o layout (os contêineres, as bocas, o quadro). **19 de 19 mutações à mão pegas.** Capturas: `arte/praia-conteineres-c1-d100-claude.jpg` (as portas abertas, dois andróides nas bocas, à noite), `arte/praia-quadro-c1sabotado-d100-claude.jpg` e `arte/praia-quadro-c1apagado-d100-claude.jpg`.

**Onde o Comandante confere:** `?modo=survival&mapa=praia`: veja as portas dos contêineres abrirem no cais quando a onda começa (vá até lá pelo calçadão) e os rebeldes saírem por elas; na onda 2 (`&onda=2`) olhe o HUD: o quadro entra sob sabotagem; corra até o armário na ponta oeste do cais (uns 40 s) e recupere. Para ver sem jogar: `praia.mjs --desembarque --vistas conteineres` e `--quadro "2:0:0" --vistas quadro`.

**Falta (R13):** **o equilíbrio jogando** (o saboteiro leva 80 s; a viagem do jogador, uns 40; os rebeldes agora andam 460 m: cada número é linha de tabela); dano a tiro no quadro, nas portas e nos cabos; **a parte D (a Colossus em três fases, a barra do chefe e a máscara)**; os lugares só de andróide e drone (P149); a ficha de fato da Enel como cartão no jogo. Só offline.

**Próxima sessão começa com:** a **parte D** (a Colossus), e as outras fases.

## CAPÍTULO 1, PARTE B: A INVASÃO DO PRÉDIO — o manifestante, as duas portas e a rua dos fundos — Claude, 17/10 (branch `claude/cap1-parte-b`, P163, P166)

**A ordem do Comandante:** *"os mesmos manifestantes e humanoides inimigos ficam invadindo o prédio da estação, e tem que ter uma entrada principal, e também uma entrada na rua dos fundos (pra dar mais possibilidades de ataque e vulnerabilidade)"*, e *"CONTINUA SEGUINDO A PARTE B, C e a D, e melhore as outras fases"*.

**Feito (na missão em ondas da praia):**
1. **O manifestante** (`entities/chassis.ts`, `entities/Android.ts`): o vândalo humano dos eventos reais que o Comandante pediu (o Capitólio, 6/1/2021; os Três Poderes, 8/1/2023): **camisa amarela, boné e bandeira**, pele sem rosto de ninguém, **sem arma de fogo**. Corpo de andróide, **mais fraco e mais lento** (cai com um tiro certeiro no tronco); a "arma" é a pancada de bandeira, **metade da motosserra**. Pool de 5 no `BotSystem`; os planos das ondas 2 a 6 trazem **2, 3, 3, 5 e 3**; **só na praia** (a Arena e o Bunker seguem como eram).
2. **As duas portas do prédio** (`sim/PortasDaEstacao.ts`, regra pura, G14): a **entrada principal** (fachada sul) e a **dos fundos** (fachada norte), 400 de vida cada. Todo rebelde a menos de 7 m a **força** (Mech e manifestante 1, andróide 0,4, Colossus 4: três manifestantes arrombam uma porta em ~33 s); **arrombada, drena a rede da estação** (12/s cada) e só se **recupera** com o jogador ou um aliado perto e sem invasor em cima (8/s, até dois; volta aos 30%). Porta forçada não se recompõe sozinha.
3. **Duas frentes ao mesmo tempo:** os manifestantes nascem **três pela avenida** (a oeste, entrada principal) e **dois pela rua dos fundos** (atrás do muro norte, entrada dos fundos); cada vaga do pool tem o alvo dela (a porta principal, a dos fundos ou um cabo) e recebe a ordem `hold` do Domínio; os andróides seguem para os cabos (parte A).
4. **O que o jogador vê:** a porta fica **laranja e treme** forçada e, **arrombada, escura, aberta de lado e piscando em vermelho**; duas células no HUD sob os cabos e o aviso no topo ("ENTRADA DOS FUNDOS ARROMBADA · INVASORES DENTRO").

**Provas:** **12 testes da regra pura** das portas (estrutura, o peso de cada invasor, a porta forçada que não se recompõe, o conserto e o teto de dois, o invasor que impede o conserto, determinismo e invariantes sob 36 mil ticks); **9 testes de partida** (`Match.portas.test.ts`: o manifestante mais fraco e sem arma de fogo, o plano das ondas, só a praia tem o pool, a onda 3 ativa os 3 com um pela rua dos fundos, a ordem `hold`, o grupo dos fundos que chega sozinho à porta, a porta que o jogador recupera, o dreno da rede isolado e o `restartMission`); **8 do desenho e dos avisos**; a Arena segue com o plano de sempre. **15 de 16 mutações à mão pegas** (a que escapou é equivalente: a guarda `defesa > 0` era redundante, porque o reparo já é zero sem defensor; uma segunda escapou na primeira rodada, o teste do dreno estava frouxo, foi reforçado e agora pega). Capturas: `arte/praia-manifestantes-b1-d0-claude.jpg` (cinco manifestantes ao lado de um andróide), `arte/praia-portafrente-b1-d60-claude.jpg` e `arte/praia-portafundos-b1-d60-claude.jpg` (a da frente forçada, a dos fundos arrombada).

**Onde o Comandante confere:** `?modo=survival&mapa=praia&onda=2`: os manifestantes saem pela avenida e pela rua dos fundos; olhe o prédio pelos dois lados; deixe um grupo forçar uma porta e veja a célula do HUD mudar; chegue perto da porta, sem invasor, para recuperar. Para ver sem jogar: `praia.mjs --portas "1:0.45,2:0" --vistas portafrente,portafundos` e `--manifestantes "186,26;188.5,29" --vistas manifestantes`.

**Falta (R13):** **o equilíbrio jogando** (cada número é linha de tabela em `PortasDaEstacao.ts`; os manifestantes chegam primeiro, em poucos segundos, e as máquinas depois); **o pool soma 13 personagens, mais que os 8 character controllers de uma sala (G11)**: vale offline e **a missão online terá de caber no teto**; dano a tiro nas portas e nos cabos; **a parte C (o porto: os contêineres que abrem e soltam os inimigos, e o quadro de luz)** e **a D (a Colossus em três fases, a barra do chefe e a máscara)**; os lugares só de andróide e drone (P149).

**Próxima sessão começa com:** a **parte C** (o porto), depois a **D** (a Colossus), e as outras fases.

## OS REBELDES ATIRAM O LASER E O PAINEL CONTA O RITMO DE CONTEÚDO — Claude, 17/10 (branch `claude/bots-laser`, P175)

**A ordem do Comandante (17/10):** *"…e pendências abertas recentes"*. Duas dessas pendências estavam escritas no estado e na análise do War Robots (P171).

**Feito:**
1. **O bot atira o laser** (`BotSystem`, `sim/esquadrao.ts`, `Match`): o esquadrão aceita o laser como arma do bot (`armaServeAoBot`, antes recusava feixe) e o bot manda **um pulso por `fireInterval`** pelo `Match.beamPulse` (o mesmo do jogador: acha o primeiro alvo, aplica o dano com as defesas do caminho, acende o desenho e, no servidor, vira evento de tiro para os outros clientes). Mão principal e mão esquerda. A direção é a que o cérebro mirou (com o erro de mira da dificuldade), então o bot erra como erra com plasma. Sem a partida atrás (`pulso` ausente), o bot com laser fica calado, nunca quebra.
2. **Sala de controle → Ritmo de conteúdo** (`scripts/site/dados.mjs` `conteudoPorSemana`, `painel.mjs`, `sala.mjs`): cada **arma** e cada **chassi** do jogo conta uma unidade na semana (segunda-feira) em que o merge que o trouxe entrou na `main`; os ids saem do código, as datas do git (`--first-parent -S`). Hoje: **30 unidades, 7,3 por semana** nas semanas completas (21/09: 6, 28/09: 6, 05/10: 10, 12/10: 8 até agora). É o número que a análise do War Robots pedia ("o produto é a cadência").
3. **Testes (+12):** `botLaser.test.ts` (6: o esquadrão aceita o laser; pulsos na principal e na esquerda com física de verdade, intervalo, dano, determinismo) e `ritmoDeConteudo.test.ts` (6: cada arma conta uma vez, semanas seguidas desde a segunda-feira, a unidade cai na semana da data, média sem a semana corrente). **8 mutações pegas** (5 no bot, 3 no ritmo).

**Custo de CPU:** o bot com laser faz um raycast por pulso (7,7 por segundo enquanto atira, como o jogador); só quando o esquadrão lhe dá o laser (o padrão do jogo não muda). O painel roda no build do site (uns 40 chamadas de `git log`), nada no jogo.

**Falta (R13):** (a) **D7 e DAU/MAU** no painel: pedem um id anônimo por visita (hoje a telemetria conta eventos por IP, sem pessoa); decisão do Comandante (LGPD); (b) a **meta oficial** de conteúdo (2 por semana, 1 evento a cada 6) segue com ele (P171); (c) o **bot não usa o arpão** (só há ombros no Marauder, e o bot não os tem); (d) o ritmo não conta o que não é arma nem chassi (mapas, pilotos, eventos); (e) a bancada de celular e o desenho do evento mínimo (P171).

**Próxima sessão começa com:** o que o Comandante julgar (as línguas, o login, o arpão, o laser dos bots) e as decisões da P171 (ritmo oficial, inglês antes de monetização: respondida, cosmético de explosão).

## O LOGIN DO JOGADOR, COMPLETO: a conta leva o progresso para outro aparelho — Claude, 17/10 (branch `claude/login`, P174)

**A ordem do Comandante (17/10):** *"quero também que concluamos sobre o LOGIN"*. A conta, o limite de tentativas e o formulário já existiam, mas **nada ligava o formulário ao jogo** e a conta não guardava nada do piloto.

**Feito:**
0. **Achado e corrigido no formulário (R17):** o `LoginPanel` (nunca ligado antes) refazia o painel inteiro no `blur`, o que destruía o campo para onde o foco ia e **o botão sob o clique**: clicar em ENTRAR logo depois de digitar a senha **perdia o clique**. Agora o `blur` só mostra o aviso no lugar (`_mostrarValidacao`), com 2 testes (e uma mutação pega).
1. **No servidor:** `GET`/`PUT /conta/progresso` (só com sessão, corpo até 8 KB, validado por `validarProgresso`: nível 1–999, XP 0–999, créditos até 1 bilhão, montagem até 4 KB, apelido pelo mesmo filtro da sala online; campo a mais do cliente é descartado); tabela `progresso` (uma linha por conta, substituída a cada `PUT`). **Achado e corrigido (R17):** `/conta/eu` não respondia ao **preflight do CORS** (o jogo em `cybermech.online` chama o servidor em outra origem com o cabeçalho da sessão); agora responde, e a rota nova também.
2. **No cliente:** `net/sessao.ts` (`SessaoPiloto`: token por servidor, entrar/criar/sair, restaurar ao abrir, **mescla** e envio com 5 s de calma; rede fora nunca trava nem apaga nada), `net/progressoLocal.ts` (liga a sessão ao que o navegador já guardava: nível/XP/créditos, apelido, montagem; **nenhuma chave nova de progresso**), `ui/ContaSettings.ts` (o `LoginPanel`, já pronto, nas Configurações → JOGO → CONTA DO PILOTO), `DailyChallenges.snapshot/restore/onSave`, `ContaCliente.lerProgresso/gravarProgresso`.
3. **A regra da junção** (`mesclarProgresso`, pura): quem tem **mais nível e XP vence por inteiro** (os créditos andam com o nível: somar dobraria o ganho de quem usa dois aparelhos); empate, o gravado por último; apelido e montagem do outro cobrem o que faltar. Aparelho novo recebe o da conta; convidado que jogou antes de criar a conta **não perde nada**.
4. **Idiomas:** os textos do formulário e as mensagens de erro entraram nas seis línguas (475 textos por língua; o teste cobre a validação e as frases de estado).
5. **Testes (+64):** `progresso.test.ts` (contrato e mescla), `conta-progresso-http.test.ts` (o servidor de verdade: 401, 400, 413, isolamento entre contas, preflight, origem), `sessao.test.ts` (21: junção nos dois sentidos, rede fora, restaurar, sair, envio com calma), `progressoLocal.test.ts` e `auth.test.ts` (o cliente). **18 mutações: 16 pegas e 2 equivalentes** (cancelar o envio ao sair e agendar sem sessão não mudam nada que se veja: sem token a sincronização não faz nada). **Prova no navegador de verdade** (`arte/login-*-claude.png`): um convidado de nível 5 (300 XP, 1234 créditos, apelido ANA) cria a conta num "aparelho"; um navegador limpo entra com ela e **recebe nível, XP, créditos e apelido**; sair não apaga nada do aparelho.

**Custo de CPU/rede:** zero no jogo; uma ida ao servidor ao entrar (um `GET`, e um `PUT` se algo mudou) e **um `PUT` por janela de 5 s de calma** depois de uma mudança de progresso (pouquíssimas por partida). Servidor: um `SELECT`/`INSERT` por chamada; nenhum custo por tick (G13).

**Falta (R13, em `STATUS_REAL.md`):** (a) **o olho do Comandante**; (b) o **ranking** (C4) e o **clã** (C2) do plano; (c) um convite "gostou? guarde seu progresso" depois da primeira partida (a conta só aparece nas Configurações); (d) **recuperar senha** (não há e-mail de recuperação); (e) apelido único; o apelido da conta passa a valer na caixa do lobby **depois de recarregar**; (f) as missões do dia ficam só no navegador; (g) **LGPD:** o e-mail é guardado (o mínimo); falta o "apagar minha conta".

**Próxima sessão começa com:** o que o Comandante julgar do login e das línguas; depois as pendências recentes (bots com o laser; contadores do painel).

## O ARPÃO MAGNÉTICO CHEGA AO JOGO: a arma que prende e puxa — Claude, 17/10 (branch `claude/arpao-no-ar`, P77 3ª parte, protocolo 20)

**O que era:** o porte do arpão de 12/10 (`claude/arpao-magnetico`) nunca entrou na `main`; refeito sobre a `main` de hoje (a sessão anterior deixou o porte parcial local).

**Feito:**
1. **A arma (`harpoon`, só de ombro):** raio de 45 m que morde 10 e **prende o primeiro inimigo à vista**, puxando-o a 9 m/s por até 1,6 s; um aperto a cada 4 s; os dois ombros dividem um cabo. **Contrajogo:** o dash do alvo corta o cabo, a parede também, o Colossus (raio > 2,4 m) o arrebenta, aliado e dono nunca são presos. Regra em `combat/HookSystem.ts` (G14: a mesma offline e no servidor; só o tick fixo; pool de 8).
2. **Ligação:** `Armament` → `PlayerController.hook` → `Match.hookShot` (jogo e `NetPilot` do servidor); `onHook` vira evento de tiro; **protocolo 20** (`harpoon` no fim de `NET_WEAPONS`); `OnlineSession` desenha o raio do arpão de outro jogador (`Match.drawHook`).
3. **Desenho:** `fx/HookVisuals.ts` (o cabo preso, um `InstancedMesh`, pulsa; ciano o seu, vermelho o do inimigo) e o raio do disparo pelo `BeamVisuals`; modelo 3D (bobina e cano com garras), ícone do Hangar, retícula, som (`armasSom.json`), dica de primeiro uso, ficha do Arsenal e o "Testar" do Hangar.
4. **Testes (46 novos):** `HookSystem.test.ts` (prender, `breakRadius`, cabo dividido, pool, puxar, e cada causa de soltar: tempo, chegou, dash, morte, estouro, parede, sem dano ligado), `harpoon.test.ts` (dados, Armament, `Match.hookShot` com física: parede, alcance, o primeiro à vista, aliado, cliente online, `drawHook`) e `HookVisuals.test.ts` (instâncias, cor, NaN). **13 mutações pegas** (limite do raio, dash, puxar sem dano, intervalo da parede, chegada, estouro, segundo ombro, aliado, cliente online, alcance, mordida, Armament, cor).

**Custo de CPU:** um raycast por aperto (a cada 4 s) e **um raycast a cada 6 ticks por cabo preso** (no máximo 8); um `push` por tick por cabo; no desenho, dois `setMatrixAt` por cabo (uma chamada de desenho). Nenhum `new` por tick/quadro (G4/G5).

**Falta (R13):** (a) **o olho do Comandante** (o puxão e o cabo); (b) o **cabo preso de outro jogador** não é desenhado no online (só o raio do disparo); (c) o **bot não usa o arpão**; (d) drone de ombro, ultrassônico e ombros para Bastion/Colossus (P77).

**Próxima sessão começa com:** o login (P174) e as pendências recentes (bots com o laser; contadores do painel).

## O JOGO FALA SETE LÍNGUAS — Claude, 17/10 (branch `claude/idiomas`, P173)

**A ordem do Comandante (17/10):** *"sim, vamos JÁ colocar a opção para outras línguas (inglês, japonês, espanhol, francês, chinês, russo)"*.

**Feito:**
1. **`client/src/i18n/i18n.ts`:** o texto de origem é o português (nenhum módulo de interface precisou mudar); cada língua é um JSON em `client/public/locales/` (`{ "texto em português": "tradução" }`, com lacunas `{0}` para o que o jogo preenche). `traduzir()` é pura (busca exata, padrões com lacuna, cache de 2000); a camada de DOM traduz a página e **observa** (`MutationObserver`) o que o jogo escreve depois (HUD, avisos, menus), inclusive `title`/`aria-label`. **A troca é ao vivo** (cada nó guarda o original), sem recarregar.
2. **Escolha:** `?lang=` do link → a escolha salva (`cybermech.lang`) → a língua do navegador (**só fora de navegador de teste**, para as bancadas e o smoke seguirem comparando português) → português. Seletor em Configurações → JOGO → *Idioma · Language* (sempre bilíngue, para quem está perdido).
3. **445 textos por língua** (en, es, fr, ja, zh, ru): menus, configurações, controles, HUD de combate, avisos de missão, bandeira e domínio, dica de cada arma, nome das armas, modos, setores, desafios, tela de carregamento (com as dicas) e os 3 textos que o CSS escreve (`content`, por `:lang()`).
4. **Testes (26, `i18n.test.ts`):** seis dicionários com **as mesmas chaves**, sem vazio, com as mesmas lacunas, e cada língua na sua escrita; **cobertura por teste**: a dica e o nome de **cada arma** (arma nova sem tradução quebra o teste), os rótulos das configurações, as dicas do carregamento e **todo texto do `index.html`**. Cinco mutações pegas (detecção em navegador de teste, lacuna não traduzida, ordem de especificidade, cache, margens).

**Custo de CPU:** zero em português. Fora dele, um observador de mutações (o HUD troca texto, no pior caso, por quadro) e uma busca em tabela com cache; **nada na simulação** (G1/G2). Peso: o JS cresce ~3 KB; cada dicionário é um JSON de ~20–27 KB (7–9 KB com gzip) que só baixa quem escolheu a língua (G12).

**Falta (R13, está em `STATUS_REAL.md` como PARCIAL):** (a) **revisão por falante nativo** (as traduções são do Claude); (b) a **voz do narrador** segue em português/sotaques; (c) textos desenhados em canvas (placas de nome, mapa-múndi) e as fichas longas do Hangar; (d) a landing do site (`scripts/site/`) continua só em português; (e) a vírgula decimal das dicas (`0,85 s`) não vira ponto em inglês.

**Próxima sessão começa com:** o login (P174), o arpão magnético (P77) e as pendências recentes (bots com o laser; contadores do painel).

## Resumo Executivo

| Aspecto | Status |
|---|---|
| **Projeto** | 🟡 Fase 5 em andamento — multiplayer sob verificação (M4 pronto, M5–M6 planejados) |
| **Jogo** | Retorno do servidor público ao protocolo 6 registrado em 09/10, com ciclos de reinício provados (PRs #189–#192); disponibilidade neste instante não consultada nesta auditoria. Offline: Arena + Sobrevivência + CTF |
| **Build** | Último check local (11/10, Gemini): 969 testes verdes em 124 arquivos, typecheck, build, budget, smoke e site verdes |
| **Última sessão** | 11/10 (Gemini, branch `gemini/cameras-espectador`): Câmeras de vigilância CFTV e espectador (Prédio Serafim, Vorcaris, Drones, Mechs, tecla C e botão no HUD). 10/10 (Gemini): LoginPanel (P33). |
| **Próximo** | painel de campanhas personalizadas (ver `ROADMAP.md`); drones e escudo físico completos no servidor online; playtest do dono: esfera, aliados, escudo físico, Prédio Serafim e drones; dono julga o Marauder (Hangar e partida); M5: cliente online ler `EVENT.HIT`; projeto da compensação de latência (`FINDINGS.md`) |
| **Release** | URL: https://www.selvamkt.com.br/cybermech/ — publicado a cada merge na `main` |

---

**Última atualização:** 2026-10-11 | **Versão:** v0.5.0-beta | **Status:** 🟡 EM DESENVOLVIMENTO

## EM BRANCH — NÃO ESTÁ NO AR (nem no site, nem no jogo)

> **Regra deste documento a partir de 27/09:** só entra em "ÚLTIMA SESSÃO FEZ" o que está na **`main`**. O que ainda está
> em branch mora aqui — e **é por isso que o dono não vê no site**: branch não publica, PR aberto não publica, só o merge na
> `main` publica (o deploy roda sozinho). Se não está no site, procure nesta tabela.

| Branch | O que carrega | PR | Desde |
|---|---|---|---|
| `gemini/marauder-rig-fix` (só local) | **Obsoleto**: o único conteúdo novo (o GLB) foi para `claude/marauder-rig`; o resto já está na `main`. Pode ser apagado quando o dono quiser | — | 01/10 |
| `gemini/game-hq` | **O painel admin do Gemini** (11/10): o **backend** em SQLite e API (`server/Server.ts`, `server/contas.ts`, `net/auth.ts`, `shared/net/auth.ts`), o **painel no frontend** (`ui/AdminPanel.ts` — arquivo novo, 144 linhas, integrado ao Hangar com **cadeados** e modal) e a **flag de `status`** para esconder Mechs em desenvolvimento na oficina (`entities/chassis.ts`, `entities/MechBase.ts`, `ui/HangarMenu.ts`). *(A linha antiga aqui dizia "Estruturação oficial do Game HQ (`HQ.md`)" — o `HQ.md` **já está na `main`**; o que o branch carrega agora é o painel.)* **Diagnóstico (Qwen, 12/10): 327 commits atrás; 4 conflitos** (`.decepticons/ESTADO_ATUAL.md`, `entities/MechBase.ts`, `entities/chassis.ts`, `ui/HangarMenu.ts` — os três de código são do Claude) e o resto entra limpo. Brief no topo deste arquivo | **#259** (aberto, `CONFLICTING`) | 11/10 |
| `gemini/rig-fix` | Corrige a orientação errada de modelos importados (`clonedScene` no `AxisCorrectedJoint`), que deixava Mechs Tripo e Mixamo com pés virados. Desabilita `quadraV2` temporariamente do carregador enquanto a malha ZEROCIRCUIT.glb está corrompida. | — | 01/10 |
| — | **Nada fora da `main` (28/09).** O login e a gravação entraram (#115, #117); o #110 virou obsoleto (só um retalho do `ESTADO_ATUAL.md`) e foi fechado; e os três branches órfãos do Gemini de 25/09 — `primeira-partida`, `setas-inimigos`, `sons-androides`, sem PR e com o conteúdo refeito na `main` — foram declarados mortos e apagados (regra 15). | — | 28/09 |

---

> O histórico de entregas que ficava aqui está em `.decepticons/arquivo/estado-em-branch.md`.

## PENDENTE
- [x] **Dono (04/10):** a recuperação do servidor foi feita à tarde (servidor na `wt-servidor-prod`, dados em `D:\DECEPTICONS\.tmp\servidor`), e a `node_modules` da pasta principal foi refeita em 09/10.
- [x] **Dono (09/10, feito):** reiniciar uma vez como administrador (servidor de produção no protocolo 6). Daqui em diante o reinício é automático e sem administrador (`DEPLOY.md`, seção "09/10").
- [ ] **Dono:** jogar no celular (deitado) e dizer se a mira e o tiro ficaram bons (forte ou fraca demais?); no PC, testar configurações, calibração e som
- [ ] **Dono:** conferir no jogo as novas formas e proporções do Vector-09; dizer se a leitura de leve/médio/pesado bate com as imagens de referência
- [ ] **Dono:** testar o Hangar em desktop e celular: MK III deve atualizar a carga, aplicar armas no respawn, trocar piloto e copiar um link que abre a mesma montagem
- [ ] **Dono:** jogar com as motosserras (andróides colados nas pernas) e pisar neles (ande para cima de um encostado)
- [ ] **Dono:** pôr o servidor público no ar 24 h: escolher o domínio, criar o túnel nomeado da Cloudflare, rodar `scripts\servidor-windows.ps1` e criar a variável `GAME_SERVER_URL` no GitHub (`DEPLOY.md`, "Servidor público 24 h")
- [ ] **Dono:** jogar online com alguém: `npm run server` no PC, o túnel do Cloudflare (`DEPLOY.md`, "Servidor de jogo") e o link `/jogar/?sala=ARENA&servidor=https://….trycloudflare.com&nome=…` para os dois. Dizer como ficou a sensação (atraso, correções, tiros)
- [ ] **Dono:** abrir o Hangar novo (pausa → `[ ABRIR HANGAR ]`): galpão, interface, testar disparo, atalhos 1 a 4, no computador e no celular. O que ainda está longe da imagem de referência?
- [ ] **Dono:** mexer nas potências (configurações → POTÊNCIAS) e dizer se falta algum controle (pontaria dos bots, tamanho do carregador, número de pulos...); quando achar um ajuste bom, mande o link: vira o padrão com teste
- [ ] **Dono:** jogar de andróide (pausa → `[ PILOTAR ANDRÓIDE ]`): a câmera passa a sensação de Mech gigante? Vida, blaster e motosserra estão justos?
- [ ] **Dono:** jogar com o diretor de ataque (no máximo 2 atacando juntos) e as personalidades; dizer se ficou fácil demais (dá para subir "Atacam ao mesmo tempo" nas configurações)
- [ ] **Dono:** jogar com o calor novo (~15 tiros segurando, trava de ~2 s, superaquecido anda a 75%) e o Mech mais pesado (9 m/s, com inércia e passos): ficou bom para lutar contra 3? Se ainda apertar, o próximo ajuste é o resfriamento
- [ ] **Dono:** jogar com as armas novas (menos dano, calor compartilhado com os foguetes) e dizer se a luta ficou lenta ou rápida demais; decidir as perguntas do fim do `HANGAR.md`
- [ ] **Dono:** ouvir a vinheta da marca no jogo (som, volume, duração) e ver a abertura da landing (numa aba anônima ela roda de novo)
- [ ] Confirmar em jogo real que F1 esconde o HUD sem abrir a Ajuda do navegador
- [ ] **Dono:** decidir a separação simulação × render × efeitos (`MULTIPLAYER.md`, seção 9) e as 4 decisões da seção 10
- [ ] **Dono:** jogar com as zonas de cura (canto sudeste) e resfriamento (canto noroeste) contra 3 Mechs + 3 andróides; dizer se +20 vida/s e 0,35 calor/s deixam a luta justa, ou se ainda precisa baixar `enemyMechs`/`enemyAndroids` nas configurações enquanto isso
- [ ] **Dono:** abrir `/cybermech/jogar/?modo=survival`, completar ou perder uma tentativa e dizer se o salto 2→6 inimigos, os intervalos e a ausência de respawn ficaram justos
- [ ] **Dono:** na Arena offline, deixar um bot abater o jogador e avaliar a câmera de abate; `V` deve sair na hora e o respawn deve voltar sem corte brusco
- [ ] **Dono:** abrir o Lancer-L1 (Hangar, ou `?build=v1.lancerL1.shotgun-0.-`), atirar de perto e de longe e dizer se a escopeta tem o peso que você descreveu (alcance menor que o blaster, dano alto colado no inimigo); decidir se o escudo passa a bloquear dano

- [ ] **Dono:** abrir o Marauder (Hangar, ou `?build=v1.marauder.blaster-0.blaster-0.rockets-0`): os dois blasters nas mãos e os dois lançadores nos ombros ficaram como você imaginou? Atirar com o botão esquerdo (as duas mãos) e com o direito ou Q (os dois foguetes) e dizer se o blaster segura a luta ou se esquenta demais (é o primeiro número para mexer em POTÊNCIAS)

## RASCUNHO ANTIGO DE BOTS (superado)
O rascunho do GPT-OSS continua no stash local (`git stash list`: "rascunho GPT-OSS/Gemini 23-09…"). Foi superado pelos bots v1 e pode ser descartado pelo dono (`git stash drop`). Não reaproveitar: andava na direção errada e lia a posição de render (ver histórico).

## MODELOS DE IA
- **Gemini Flash:** bom para tarefas de código bem especificadas dentro do protocolo (fez G12, painel de debug, Blind Mode, tela de configurações e som). Costuma esquecer o PR: conferir se o branch virou PR.
- **Codex (OpenAI):** bom em render e desempenho (#43: draw calls 34 → 9; #44: explosões). Mudança visual pede captura de tela no PR: o #43 deixou os robôs brancos até o primeiro dano sem o check perceber (corrigido no #48).
- **Qwen (Alibaba, via API DeepSeek):** transversal — qualidade, documentação e testes: auditoria de arquitetura, relatórios do processo e segunda opinião na revisão cruzada. Não toca no caminho crítico de simulação/rede (território do Claude); roda `npm run check` antes de declarar pronto.
- **gpt-oss 120B:** só para conversa de design. Em 23/09 entregou código que nem compilava e disse que estava pronto; **não usar para editar este repositório**.

## DIVISÃO DE TRABALHO ENTRE AGENTES
Regras no `AGENTS.md` ("Trabalho com vários agentes"). Um branch por tarefa a partir da `main` atualizada, cada agente na sua pasta (regra 12), PR com CI verde e merge pelo próprio agente (regra 13). As etiquetas do PR dizem a frente e o agente.
**Merge nesta fase:** o dono autorizou merge direto com CI verde. A revisão cruzada acontece depois.

| Agente | Território (arquivos) | Situação |
|---|---|---|
| **Claude** | `client/src/combat/`, `client/src/entities/`, `client/src/physics/`, `client/src/player/`, `scripts/`, `.github/`, `vite.config.ts`; depois `shared/`, `server/`, `client/src/net/` | Em atividade, confirmado pelo dono em 09/10: efeitos de estado e armas elementais (`ARMAS_ELEMENTAIS.md`). A sincronização online dos modos continua na frente de rede quando o contrato existir. O relato anterior de falta de crédito é histórico. |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Em branch `gemini/tela-login`: (1) LoginPanel (P33 — tela de autenticação e criar conta, 8 testes verdes, CSS); (2) correção do codinome no painel público (`scripts/painel.mjs`). Próximo: tela e som das armas elementais (`ARMAS_ELEMENTAIS.md`, seção 7). |
| **Codex** | visual e render do mundo 3D (`client/src/fx/`, `environment/`, modelos e rigs), pós-processamento, câmeras, desempenho e revisão cruzada | Feito: render, blueprints, Hangar/treino, calor/avaria visual, Sobrevivência/CTF offline e câmera de abate; #194 reduziu passadas do Hangar e protegeu seleção. C1 #198, C3 #204 e C4 #205 publicadas/deploy confirmado; C2 #206 em branch enquanto aberto, diagnóstico e restauração do alvo, check local verde. Próximos: C2 limitado e homologação prolongada C3; C5/C6 após orçamento/contratos em `EVOLUCAO_TECNICA.md`. Preservar simulação/rede do Claude e UI/áudio do Gemini. |
| **Gemini** | `client/src/ui/`, `client/src/audio/`, `client/src/styles.css`, `client/index.html`, `client/src/debug/`, `client/src/core/Quality.ts` | Feito: Som dos passos, volume de bots ecoando e Gênesis-01 não aparecendo offline/online. Branch consolidado e mergeado (PR #136). **Entregue em 09/10 (#201): T1–T5 das armas elementais; a ligação ao jogo é do Claude (`claude/ligar-ui-armas`).** Pedido de 09/10, já entregue: tela e som das armas elementais (`ARMAS_ELEMENTAIS.md`, seção 7: indicadores de estado, bordas de tela, painel do alvo, ícones do Hangar, medidor da rotatória, sons). |
| **Codex** | visual e render do mundo 3D (`client/src/fx/`, `environment/`, modelos e rigs), pós-processamento, câmeras, desempenho e revisão cruzada | Feito: render, blueprints, Hangar/treino, calor/avaria visual, Sobrevivência/CTF offline e câmera de abate; #194 reduziu passadas do Hangar e protegeu seleção. C1 #198, C3 #204 e C4 #205 publicadas/deploy confirmado; C2 #206 publicada; #209 prepara shader do chassi antes de exibir, fila limitada, check local verde; publicação deste corte exige merge/deploy. Próximos: C2 limitado e homologação prolongada C3; C5/C6 após orçamento/contratos em `EVOLUCAO_TECNICA.md`. Preservar simulação/rede do Claude e UI/áudio do Gemini. |
| **Qwen** | transversal — documentação (`.decepticons/`), testes de simulação (novos `*.test.ts`), relatórios do processo (`scripts/painel.mjs`, `scripts/site/`, o site) e auditoria de arquitetura (segunda opinião na revisão cruzada). Não mexe em `client/src/{sim,combat,entities,physics,player,net}`, `server/` nem `shared/` sem combinar com o dono do território | Entrou no time em 26/09 (oficialização no painel e na etiqueta). Próximo: relatório de saúde técnica (cobertura, débito da seção 9, budget, tick) para a divulgação |
| **Zona compartilhada** | `client/src/core/Game.ts`, `package.json`, `.decepticons/` | Só fiação e PR pequeno; quem mergear depois junta a `main` e roda `npm run check` |

## DECISÕES EM ABERTO
| Decisão | Situação |
|---|---|
| ~~**Uma chave só para o servidor? (12/10, P93)**~~ **DECIDIDO em 13/10 (P106): aceitar também a sessão `is_admin`.** O Comandante pediu "unifique as contas"; a sessão vale em todas as rotas, o token do dono segue como chave de emergência (não depende do banco). Segue o texto original: | O painel do servidor aceita **só o token do dono** (`metricas-token.txt`, que só existe no PC dele); o painel de chassis do Gemini (#259, no ar) usa a **sessão de uma conta `is_admin`**. Hoje cada painel tem a sua chave e as rotas não se cruzam. **Decidir:** manter assim (recomendado: reiniciar o servidor com a chave que só existe no PC dele é mais forte), aceitar também a sessão `is_admin` nas rotas `/admin/estado` e as outras (uma linha em `server/admin.ts`), ou o contrário. |
| **Enxugar a papelada? (13/10, Claude, a pedido do Comandante: "tenho a impressão de que temos muitas regras")** | **Medido nas minhas entregas de hoje:** a documentação é de 15 a 25% dos bytes de cada PR (6.800 a 15.200 B de doc contra 28 a 97 mil B de código); cada PR repete o mesmo fato em até **sete arquivos** (`ESTADO_ATUAL`, `ROADMAP`, `ORDENS`, `STATUS_REAL`, `HISTORICO`, `PAINEL_ADMIN`, `DEPLOY`); `ESTADO_ATUAL.md` tem 1.500 linhas e o `HISTORICO` 2.700 (o Passo Zero manda ler os dois); todo PR começa **no topo** dos mesmos arquivos, então dois agentes batem em conflito (aconteceu hoje no #292); e a regra de formato do ROADMAP só reprovou **depois de 6 min de check**. As regras de **engenharia** (G1/G2, G14, R2, R13) não atrapalham: são o que segura a qualidade. **Proposta (o dono decide):** (1) um fato, um lugar: `ORDENS` (o que ele pediu e o estado) e `STATUS_REAL` (o que funciona) viram a verdade; o `ESTADO_ATUAL` encolhe para "agora / próximo" (≤ 100 linhas, sobrescrito, o ensaio de cada PR vai no corpo do PR); (2) as entradas novas entram **no fim**, ou em um arquivo por agente, para acabar com o conflito; (3) um `npm run docs:check` de 1 s (o formato do ROADMAP e das ORDENS) antes do check de 6 min; (4) o Passo Zero cai para três leituras fixas e o resto por tarefa. Nada disso foi mudado: o AGENTS.md só se edita com registro e decisão do dono. |
| **O PC de casa sem memória hospeda o servidor de jogo (09/10, medido)** | A máquina tem 6 GB e vive com 300–500 MB livres (navegadores, ChatGPT, Antigravity, Defender, três agentes de código); o servidor chegou a 9 MB residentes e uma entrada demorou **59 s** (12 s minutos depois; 1,4 s quando a máquina estava calma). O SSD é um SATA de entrada que desacelera sob paginação. Um jogador de verdade desistiria. **Decidir:** (a) tirar o servidor desta máquina (VPS pequena; o código e o túnel já estão prontos, `DEPLOY.md`); (b) manter aqui e dar folga (mais RAM, ou fechar o ChatGPT e abas do navegador enquanto o servidor estiver aberto ao público); (c) manter como está só para testes do dono. Enquanto isso o servidor só serve para teste com poucos amigos. |
| **Armas elementais (pedido do dono, 09/10)** | Metralhadora rotatória, elétrica (choque, lentidão, atordoamento no tiro bem dado), lança-chamas e gelo. Plano, números de partida, custo de rede e divisão de trabalho em `ARMAS_ELEMENTAIS.md`; **o dono respondeu em 09/10** ("tiro bem dado" = cabeça ou 3 acertos seguidos em 1,4 s; atordoamento de 0,8 s com imunidade de 4 s; fogo e gelo se anulam; Mech grande resiste): sim a todas. **Só fogo no cenário segue sem resposta** (padrão: não; a porta fica aberta). Ordem: contrato dos efeitos de estado (#199, feito) → rotatória (#200, feito) → **elétrica (PR-C, feito)** → lança-chamas → gelo; tela e som com o Gemini em paralelo (o dono cola o pedido da seção 7 no chat dele). Codex só depois, para os efeitos 3D (hoje na auditoria de desempenho). |
| **Nome do jogo: AVARIA (11/10; era SINGULARIA desde 07/10)** | Em teste **só no título da capa** do jogo, a pedido do Comandante ("Singularia não ficou bom; Avaria tem mais a ver e é mais bacana de ler"). O resto segue CYBERMECH (aba do navegador, carregamento, Hangar, linha de versão, site, URLs, chaves do `localStorage`, nome da pasta de documentos). **O dono decide** se gosta; se sim, a troca geral vira um passo à parte (com migração do `localStorage` e redirecionamento das URLs). **Do dono, fora do código:** busca de marca no INPI (classes 9 e 41), busca em Steam/itch/lojas e compra do domínio. Detalhe em `HISTORICO_DE_DECISOES.md`, 07/10. |
| Drones e torres na partida | A banda aperta antes do formato: a sala cheia de hoje (12 robôs) já usa 6,2 KB/s dos 8,0 KB/s disponíveis por jogador. **Decidir:** drone por jogador (não cabe hoje), um drone por esquadrão, ou habilidade com recarga; e se vale o pacote que barateia (registro curto de unidade leve + estado a 5 Hz + **trilha pré-calculada**, com a conta no `METAGAME.md`, § 8.1). **Zonas de cura/resfriamento já implementadas** (Claude, 27/09, `combat/Zone.ts`): custam 0 B, valem também no online. Torres seguem pendentes: precisam de vida/calor num estado curto e disparo por evento (§ 9). |
| Hospedagem do servidor | Dono (26/09): começar com o PC de casa 24 h. Falta decidir o **domínio do endereço fixo**: um domínio só do jogo na Cloudflare (recomendado, ~R$ 40/ano) ou levar o DNS do `selvamkt.com.br` para a Cloudflare (grátis, mas mexe no site da Selva MKT). Oracle ou VPS depois, com o mesmo código. Seguem abertas: mira assistida no PvP e bots nas salas (`MULTIPLAYER.md`, seção 10). |
| Mira assistida no multiplayer | Hoje é só do toque e só contra bots. Com gente de verdade, toque x mouse na mesma sala precisa de regra: manter (padrão dos jogos de tiro no celular), reduzir contra humanos ou separar salas por tipo de controle. Decidir na Fase 4. |
| Separação simulação × render × efeitos | Proposta e criteria de aceitação em `MULTIPLAYER.md`, seção 9. Recomendação: tiro do jogador e yaw pela simulação antes da M4; o resto quando memória do servidor ou correções visíveis pedirem. |
| Universo (`UNIVERSO.md`, seção 7) | Brasil no centro, no contexto dos BRICS, já decidido. Premissa, roteiro, quanto de CTI entra (só textos ou também mecânicas) e nomes dos consórcios: com o dono, no chat do SERAFIM. Nada muda no jogo antes do aval. |
| Bots contra bots | Hoje os bots só caçam o jogador. No modo "todos contra todos" eles deveriam se enfrentar também: basta passar todos os Mechs em `BotSystem.targets`. |
| Câmera de abate no PvP | O corte offline segue o bot que matou. No online isso revelaria a posição do adversário durante 3 s. **Decidir:** liberar como ferramenta de conteúdo, atrasar/limitar a visão, ou manter ausente em partidas competitivas. Até a decisão, o online conserva a câmera normal e `STATUS_REAL.md` marca AUSENTE. |
| Revisão do status do servidor (#106) | Corrigir duas arestas do PR #105: impedir cadeias duplicadas de polling quando `visibilitychange` ocorre durante `fetch`, e definir a política de CSP para o `/status` de um `?servidor=` explícito. O cache de 1 s e a ausência de tráfego com aba oculta foram aprovados. |
| Colossus-01: arma e encontro | O dono fechou escala 3 e 14 m. Faltam a assinatura de arma, a máquina de fases, valores de combate e a forma do modo assimétrico; o próximo PR do Codex inicia pelo encontro offline determinístico. |
| Mech de tripulação (piloto + 1–2 artilheiros nas armas direcionais do Colossus) | Pedido do dono (29/09), priorizado por ele: **"Colossus jogável (solo) primeiro"** — feito (ver ÚLTIMA SESSÃO FEZ). Este item é a etapa 2: vários jogadores num corpo só. Ainda não tem contrato de rede nem decisão de arquitetura (G6 diz que Mech remoto não roda o character controller — precisa decidir quem simula o quê). Não iniciado. |
| **Estilos de jogo como eixo da evolução (dono, 06/10)** | O dono quer armas e robôs configurados para que, ao evoluírem, abram mais jeitos de lutar: tankar e combate próximo, rush e lutar até o fim, ataque furtivo e jogadas como as do xadrez. Hoje **só os bots** têm estilos (`PERSONAS` em `BotController.ts`: brabo, fujão, manso, soldado); para o jogador, a evolução é uma escada só (`TIERS`) e o chassi não evolui. Texto completo e caminho sugerido no `ROADMAP.md`. **Decidir:** quais estilos entram primeiro; se a evolução é por arma, chassi ou piloto; se a furtividade vale no online (custa banda, G11). Relacionado à linha abaixo. |
| **Chassis: os números têm papel, a forma ainda não (10/10)** | Os 10 chassis agora têm números distintos e um papel cada (`CHASSIS_PAPEL`, `ChassisPapeis.test.ts`). **O que continua com o dono:** escolher o **primeiro arquétipo de forma** (quadrúpede, esteira, canhão no lugar da cabeça, quatro braços; `ROADMAP`, "variedade estrutural") e **jogar e dizer se os papéis estão certos** (os números são proposta). |
| Framework modular de chassis/peças além do Hangar de armas | Pedido do dono (29/09): "criar, editar, evoluir (ou estragar)" os robôs à gosto do jogador — hoje o Hangar só cobre armas por braço (`loadout.ts`); trocar/editar chassi, peças e evolução persistente é maior. **Progresso parcial:** o catálogo de chassis cresceu (Arara-B1, Onça-B2, Colossus-01, além de Vector-09/Andróide), então já dá para *escolher* entre mais modelos — mas ainda não dá para o jogador *criar/editar* um chassi próprio nem evoluí-lo com o tempo. Não iniciado; precisa de escopo antes de construir (afeta rede, persistência de conta, balanceamento). |
| **Modelagem dos chassis: pipeline híbrido, primeiro chassi de verdade no ar (GÊNESIS-01, 30/09)** | Decisão (ver `HISTORICO_DE_DECISOES.md`, 29/09): sai do 100% procedural depois do teto real provado (protótipo tanque/barril, "pilha de moeda"); entra malha gerada por IA (Tripo3D). **Feito:** `GLTFLoader` + `SkeletonUtils.clone` no ponto de montagem do rig (`importedMechRig.ts`, `importedMechAssets.ts`), GÊNESIS-01 escolhível no Hangar e jogável numa partida de verdade — ver ÚLTIMA SESSÃO FEZ. Ainda em aberto: nome/ficha definitivos (hoje empresta 100% do Vector-09), fluxo pra gerar/receber mais chassis assim (hoje é manual: dono gera no Tripo, manda o arquivo, eu rigo o código em volta), orçamento de download por chassi (cada `.glb` ~3 MB). |
| Aliados na Arena online (rede) | **Feito offline** (30/09, ver ÚLTIMA SESSÃO FEZ). Falta só o servidor: `ArenaRoom.ts` desliga `allies` de propósito porque o roster de rede não sabe descrever um aliado pros outros jogadores ainda (ficariam invisíveis, fora de sincronia). `STATUS_REAL.md` marca AUSENTE no online até o roster aprender. |
| Vídeo promocional por prompt/botões no `/mesa` | **Feito (29/09):** a mesa já tinha o formulário; ganhou "gerar por IA" (escreve o roteiro a partir de uma frase, ancorado nos fatos do projeto) e a cena `clipe` (mistura gameplay real gravado no F9 com as cenas desenhadas, cortado por `ffmpeg`). Ver `.decepticons/FERRAMENTAS.md`. |
| Gerenciar as imagens do site sem código (deletar, reordenar, trocar) | Pedido do dono (29/09), depois de achar 3 fotos idênticas na landing (causa real: `capture()` falhando em silêncio — corrigido no mesmo PR, agora falha alto e nunca mais publica foto errada) e pedir um carrossel: **o carrossel entrou** (`scripts/landing.mjs`, gira sozinho entre as capturas que existirem). O que falta é maior — um jeito de escolher/ordenar/remover imagens sem editar `SHOTS` no código. Hoje as capturas são 100% automáticas (o robô entra no jogo e fotografa a cada deploy); um painel de curadoria manual é uma ferramenta nova, não uma correção. Não iniciado; precisa de decisão (onde mora a lista — arquivo versionado editável por formulário local, ou algo mais) antes de construir. |
| **Publicar de um branch põe código não mergeado no ar (14/10, Qwen)** | O `npm run publicar-site` publica o **HEAD da pasta onde roda** — é assim que o atualizador publica a `main` da worktree do servidor, e é o que permite publicar à mão de qualquer pasta. O risco ficou visível hoje: o publish das **20:02:35** (14/10) foi do `8cb80d5`, o HEAD da **pasta principal**, que estava no branch `qwen/o-mapa-da-praia`, e não da `main` — o log passou a avisar quando isso acontece, mas **avisar não impede**. **Decidir:** (a) recusar publicar quando o HEAD não é a `origin/main` (com `--forcar` para quem sabe o que faz — recomendado, alinha com a regra 14: só o merge publica); (b) deixar como está, agora com o aviso no log; (c) publicar sempre a `origin/main` (a pasta não escolhe mais, `--se-mudou` compara com ela). |

## BLOQUEIOS
- Nenhum (o site voltou ao ar em 14/10, 17:53).

## PRÓXIMA SESSÃO COMEÇA COM

- **Claude (09/10):** **PR-D, o lança-chamas `flamer`** (fluxo contínuo em cone de 25° e 14 m que atinge todos no cone, 6 s de combustível e 4 s de recarga, `inflicts: 'burn'`, bandeira `FX_FLAMING` no lugar de um evento por tiro, natureza `termico`; o fogo não passa pela chapa que segura mais da metade, como o choque). Depois o gelo (`cryo`, `inflicts: 'chill'`, natureza `criogenico` que entra em `DamageType` e nas tabelas dos escudos). **Quando o Gemini entregar T1–T5** (o dono relata), ligar no `Game.ts`: `StatusBadges.update` a partir de `status.forEachActive`, `TargetPanel`, `WEAPON_ICON_NOVAS`/`HINT_NOVAS` nos `Record`s do Hangar, `HUD.setSpin(armament.spinLevel)` e os sons. Os números de cada arma são a entrada dela em `BASE` (`weapons.ts`, um lugar só) e `STATUS` (`StatusEffects.ts`); a bancada `combat/balance.ts` mede o resultado.
- **Codex (09/10):** auditoria em EVOLUCAO_TECNICA.md; começar pela medição de frame time e primeiro uso de Hangar/GLB. Energia (#171), esfera/Ctrl/aliados offline (#173) e escudo físico já entregues; faltam playtest e limites online descritos no STATUS_REAL. Retorno de produção ao protocolo 6 registrado em 09/10; disponibilidade não consultada nesta tarefa. Não declarar escala homologada.

- **Claude (03/10):** o Marauder está feito (ver ÚLTIMA SESSÃO FEZ). O que sobra dele: **jogador remoto desenhado com o chassi dele** e o encaixe no evento de tiro (`ROADMAP.md`, `FINDINGS.md`); o **escudo do Lancer** que bloqueia tiro, se o dono quiser; e, com a regra de tiro única e a boca como dado, trazer o encaixe de arma aos Mechs procedurais.
- **Gemini:** **limpar a tela de pausa** (o dono marcou na captura: informação demais, coisas redundantes) e
  **telas de carregamento melhores**. Dois defeitos já diagnosticados pelo Claude em 28/09, para começar por eles:
  1. **`mission-summary` é um id disputado por dois módulos.** `client/index.html:51` tem um `<p id="mission-summary">`
     **dentro do `#overlay`** (a pausa), e `MissionHUD._getOrCreate('mission-summary')` reaproveita esse mesmo nó em vez
     de criar o dele dentro do `#hud` — então o resumo da missão nasce dentro da tela de pausa. Some-se a isso o CSS
     duplicado: `styles.css` define `#mission-summary` duas vezes (a linha de texto da pausa, e o painel de tela cheia
     do MissionHUD com `position:absolute; inset:0; z-index:900`), e a segunda vence. Sugestão: o nó antigo da pausa
     vira `#round-summary` (HUD.ts + index.html + CSS) e o MissionHUD passa a criar o dele.
  2. **O briefing abre atrás da pausa.** `#mission-briefing` tem `z-index:900` mas vive dentro do `#hud`, e o `#overlay`
     vem depois no DOM sem `z-index` — logo a pausa pinta por cima. É por isso que na captura do dono o
     `[ clique para jogar ]` aparece em cima do título da missão, e o `[ INICIAR MISSÃO ]` não recebe clique nenhum
     (a pausa inteira é um botão de retomar). Decidir qual das duas telas manda enquanto as duas estão abertas.
- **Gemini:** **tela de criar conta / entrar** (dono, 28/09: "partir para login?"). O backend já está pronto e
  testado (`claude/login-esqueleto`, mergeado): `client/src/net/auth.ts` (`ContaCliente`) tem `criar(email,
  senha)`, `entrar(email, senha)`, `sair(token)`, `eu(token)` — todos devolvem `{token, email}` ou `{erro:
  string}` prontos para mostrar, nunca lançam. Falta só a tela: um par de campos (e-mail, senha), os botões
  criar/entrar, e onde guardar o `token` no navegador (`localStorage`, o padrão do resto do jogo — `Settings`,
  `Hangar`, `DailyChallenges` já fazem assim) para o `eu()` confirmar a sessão ao abrir o jogo. Sugestão de
  lugar: um item novo em `[ CONFIGURAÇÕES ]` ou um botão ao lado do `[ JOGAR ONLINE ]` na pausa — decisão
  sua de UX. **Sem progressão migrada ainda** (decisão do dono): a tela só precisa provar entrar/sair
  funcionando; XP/créditos continuam em `localStorage` por enquanto.
- **Gemini:** depois: telas do online e calor no HUD; acompanhar o deploy do `gemini/modo-hud-audio`.
- **Codex (06/10):** sinais de avaria entregues na `main` pelo PR #164, CI verde. Começar pelo playtest offline/online/importados (a captura é de bancada), depois seguir o próximo corte abaixo. O visual do Colossus, o boss da onda 6 e o chassi solo já foram entregues; não refazê-los. Próximo corte de implementação: fases/pontos fracos/câmera do encontro offline, respeitando as decisões de arma e modo assimétrico ainda abertas; depois cosméticos e silhuetas. MK I/II/III dos módulos de arma importados já têm diferenças visuais (`MECHS_IMPORTADOS.md` § 4).
- **Claude (atualizado 30/09):** as duas frentes que estavam "sem começar" na sessão anterior **saíram e já
  estão na `main`** — pipeline híbrido de malha importada (GÊNESIS-01, chassi de verdade e jogável) e aliados
  na Arena offline (2 bots no time do jogador). Ver ÚLTIMA SESSÃO FEZ para os dois. O que ficou: (1) **aliados
  no online** — servidor desliga de propósito (`MatchOptions.allies: false`), falta o roster de rede aprender
  a descrever um aliado; (2) ~~Mech parado afunda no chão~~ (corrigido em 10/10; ver "DECISÕES EM
  ABERTO", precisa de tempo dedicado ao character controller do Rapier); (3) **arma de assinatura por
  fabricante** (ofereci propor 2-3 conceitos concretos — Vanta/guerra eletrônica, Forge/impacto — dono
  ainda não respondeu); (4) **Mech de tripulação do Colossus** (piloto + artilheiros, priorizado pelo dono
  para depois do solo, que já está no ar). Mais antigo ainda: definir e implementar o contrato autoritativo
  para escolher o modo da sala e transportar as transições de onda/objetivo; completar o online; sincronizar
  máquina de estados de Ondas da simulação.
- **Qwen:** a fila do `DIVERSAO.md` § 10 — **item 2 (conserto da progressão)** e adiante; o item 1 já tem a metade de HUD no jogo (painel do alvo) e a metade visual (sinais no próprio modelo) segue com a frente visual.
- **Dono (primeiro de tudo, 28/09):** **reiniciar o servidor de jogo de casa** para ele passar a responder
  `/status` — até lá a página diz "SERVIDOR ONLINE · SEM CONTAGEM DE PILOTOS" (online, sem o número).
- **Dono:** Testar no site o Seletor de Modo, a abertura do Briefing da Missão (`KeyM` / `KeyB` ou selecionar Sobrevivência), os alarmes de onda, as medalhas de conquista e o jogo offline de Sobrevivência/CTF. Decidir o universo (`UNIVERSO.md`, seção 7), a seção 9 e as decisões da seção 10 do `MULTIPLAYER.md`.
