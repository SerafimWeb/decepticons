# LANÇAMENTO — o escopo congelado (18/10/2026, ordens P194 a P198)

> **O Comandante congelou o escopo (18/10):** *"congele o escopo e vamos focar no mais importante para lançar e ter jogadores online: controle de acesso, privilégio, autenticação, métricas para auditoria interna, analytics,
> observabilidade, governança, tudo que for ainda necessário. Vamos lançar com apenas a fase estação dos cabos e cidade neon livres, depois vamos liberar a terras raras (troque o nome rio vivo para terras raras); faça auditoria
> se nossa arquitetura está segura para lançarmos."* **Esta página manda na escolha do que fazer a seguir** (`AGENTS.md`, Passo Zero 12): o que não está aqui **espera o lançamento**, a menos que o Comandante peça.

## 1. O que é "lançar"

Abrir `cybermech.online` ao público: **jogo grátis no navegador**, com **dois mapas livres: CIDADE NEON (a Arena) e a ESTAÇÃO DOS CABOS (a Praia dos Cabos)**, **online na Arena**, **conta opcional** e **política de privacidade**.
**Fechados no lançamento ("EM BREVE"): o Bunker e a TERRAS RARAS** (a Amazônia; o nome "Terras Raras" foi trocado). Sem ranking, sem times, sem loja. Para o Comandante, o jogo abre tudo (modo Comandante).

## 2. A lista (cada item com "pronto quando")

| # | Frente | O que | Quem | Pronto quando |
|---|---|---|---|---|
| 1 | **Segurança** | **Auditoria da arquitetura** e correção do que for bloqueio | Claude | `AUDITORIA_SEGURANCA.md` com cada achado classificado (bloqueia o lançamento / corrigir logo / risco aceito) e **nenhum "bloqueia" aberto** |
| 2 | **Acesso e privilégio** | Quem pode o quê: convidado, piloto, administrador; o que cada rota exige; como alguém vira administrador | Claude | Matriz de privilégios em `GOVERNANCA.md`, **testada** (a rota de admin recusa quem não é admin) |
| 3 | **Autenticação** | Senha, sessão, tentativas, "esqueci a senha" | Claude + **Comandante decide o e-mail** | Revisto na auditoria; "esqueci a senha": contratar o serviço **ou** lançar avisando que a senha não se recupera |
| 4 | **Auditoria interna** | Trilha de quem fez o quê de sensível (conta criada e apagada, login de administrador, mudança de configuração, leitura das métricas) | Claude | Arquivo de auditoria que só acrescenta, com prazo de guarda, sem dado pessoal além do número da conta |
| 5 | **Analytics e observabilidade** | O que já mede (P185, P193) e o que falta para operar: alerta de servidor fora do ar, erros, capacidade | Claude + **Comandante liga o monitor externo** | O dono é avisado quando o servidor cai (monitor externo gratuito) e o `/metricas` mostra a saúde do servidor |
| 6 | **Governança** | Quem é dono de quê, o que fazer num incidente (LGPD art. 48), como mudar uma regra | Claude escreve; **Comandante aprova** | `GOVERNANCA.md` de uma página |
| 7 | **Mapas do lançamento** | Só CIDADE NEON e ESTAÇÃO DOS CABOS livres; Bunker e TERRAS RARAS "EM BREVE" (**feito:** `core/Lancamento.ts`; o painel de visibilidade do P191 passa a controlá-lo sem deploy). O renome de "Rio Vivo" para "Terras Raras" outra sessão já fez (P187) | Claude | Um único lugar no código diz quais mapas estão liberados; o seletor, os links e a campanha respeitam; o modo Comandante abre todos |
| 8 | **Servidor fora do PC de trabalho** | O servidor de jogo roda no PC em que se trabalha (6 GB, ~500 MB livres): foi ele que derrubou as conexões em 17/10 | **Comandante decide onde e quanto custa** (uma VPS ou um PC dedicado 24 h); Claude instala | Máquina própria, túnel e atualização automática, **dois PCs jogam 30 minutos sem queda** |
| 9 | **Teste com gente de fora** | O online só foi testado por dois PCs do Comandante | Comandante convida 5 a 10 pessoas; Claude olha as métricas e o log | Três sessões de ~30 min, sem queda de servidor, e a lista do que estranharam |
| 10 | **Política revisada** | Entregue em 18/10 (P192), mas é rascunho | **Comandante** (de preferência com um advogado) | Texto revisado, e-mail do encarregado em `.decepticons/contato-privacidade.txt`, razão social/CNPJ no texto |

**Ordem:** 1 → 2, 3, 4 (a auditoria diz o que corrigir primeiro) → 7 (rápido) → 5 e 6; 8, 9 e 10 são do Comandante e andam em paralelo; o 9 só depois do 8.

## 3. Fora do lançamento (congelado)

Times na sala online (P81) e os lados Aliados × Consórcio (P186) · **o painel completo** (P191: a parte "tiros e armas" e a ficha dos bots; já existe em partes, § 4; **o painel de visibilidade do P191, que escolhe o que o público vê, está em andamento em outra sessão e entra no lançamento**) · Google Analytics dentro do `/metricas/` (P193; exige chave do Google) · ranking · jogador remoto com o chassi dele ·
Estúdio de tiros e armas e de Mechs 3D · as 72 falas de voz · novos mapas, chefes e armas · tradução da política. **A Amazônia/Terras Raras (P180) tem dono em outra sessão** e segue por lá, fechada ao público.

## 4. O painel único (P191, fundido com o painel de visibilidade): o que já existe

Pedido pela primeira vez em 10/10 (P54, `PAINEL_ADMIN.md`). **Existe em partes:** o **modo Comandante** (`?comandante=1`: Potências, Mesa de vídeo, Sala de controle, Oficina, Servidor com token), o **Estúdio** (`npm run estudio`:
sons e vozes prontos), o **Hangar**, as **Configurações** e o painel do servidor. **Falta:** a aba de tiros e armas do Estúdio e a ficha de cada bot. **Fica para depois do lançamento**; quando for a hora, nessa ordem.

## 5. Como o trabalho anda (ordem do Comandante, 18/10: "mais estratégico e inteligente, mais econômico em tempo e tokens")

1. **Mutação à mão só onde errar custa caro:** autenticação, privilégio, auditoria, dado pessoal, rede. **Visual, texto e documentação: não** (só o teste de sempre e o `npm run check`).
2. **Prova ponta a ponta no Chrome só uma vez por frente**, não por mudança.
3. **Uma ordem por vez**, cada uma com "pronto quando"; mensagem com várias ordens vira uma fila e a primeira anda.
4. **Menos custo de leitura por conversa:** **feito em 18/10 (P203)** com `npm run arquivar`: `ESTADO_ATUAL` 641 → 152 KB e `HISTORICO` 645 → 70 KB, o antigo em `.decepticons/arquivo/`. A `ORDENS_DO_COMANDO.md` ficou (a maior parte é das últimas 48 h): o remédio é a linha curta.
5. **O PC:** enquanto o item 8 não sai, **avisar quando for jogar** e **não trocar a VPN do PC do servidor com gente jogando**.

## 6. O passo a passo do que só o Comandante faz (18/10)

**Estado:** A1 mantido (o servidor segue neste PC até o jogo ficar pronto); A13 reconhecida (a cópia de segurança fica no mesmo disco); **e-mail do encarregado: feito** (`volkov@serafimweb.com`); **faltam** os quatro abaixo, a razão social/CNPJ e o nome do encarregado na política, e "esqueci a senha" (sem serviço de e-mail, o lançamento avisa que a senha não se recupera).

**A. Monitor externo (A14): o alerta de túnel da Cloudflare.** Tem que ser de fora do PC (a página de métricas mora no PC do servidor: se ele desligar, ela não avisa ninguém), e o jogo já passa por um túnel da Cloudflare. O **Tunnel Health Alert** é grátis (Zero Trust), manda e-mail e **não pede conta nova**: dash.cloudflare.com → **Notifications** (menu da conta) → **Add** → **Tunnel Health Alert** → nome "CYBERMECH túnel", destinatário o e-mail dele → escolher o túnel do jogo → Save. Avisa quando o túnel cai (PC desligado, internet fora, `cloudflared` parado). **Não** avisa se só o processo do servidor morrer com o túnel de pé; para isso, como segunda camada, um monitor HTTP em `https://jogo.cybermech.online/status` (o UptimeRobot grátis serve: 50 monitores a cada 5 min **só com alerta por e-mail**; o Telegram dele é de plano pago e o plano grátis é, pelos termos de terceiros, para uso não comercial: conferir). **O sistema do Telegram do serafim13 não serve para isto:** o `serafim-watchdog` roda a cada 6 h pelo GitHub Actions (queda detectada em até 6 h, e o GitHub Actions está sem pagamento, ao menos no repositório do jogo); o BatBot é outro produto (varredura de segurança de clientes).

**B. Cloudflare** (dash.cloudflare.com → o domínio `cybermech.online`):
1. **Estado do visitante:** Rules → **Managed Transforms** → ligar **"Add visitor location headers"**. O servidor lê só o `cf-region-code` (a sigla do estado, só do Brasil); cidade e coordenadas chegam junto, mas são ignoradas e nunca gravadas. O estado aparece em "De onde vêm", no `/metricas/`, a partir do dia seguinte.
2. **HSTS:** SSL/TLS → Edge Certificates → **HTTP Strict Transport Security (HSTS)** → Enable: Max Age **6 meses**, Include subdomains **desligado**, Preload **desligado**, No-Sniff **ligado**. Só vale para os endereços que passam pela Cloudflare (nuvem laranja); se o `cybermech.online` estiver em "somente DNS" (nuvem cinza), o HSTS do site vem do `.htaccess` (uma linha no `scripts/site.mjs`; peça).

**C. Chave do Google Analytics** (para trazer os números do Analytics para o `/metricas/`; o jogo já manda dados pelo código de medição `G-2CCHDCEC7X`, depois do consentimento):
1. console.cloud.google.com → criar um projeto (ex.: "cybermech-analytics").
2. **APIs e serviços → Biblioteca** → procurar **"Google Analytics Data API"** → **Ativar**.
3. **IAM e administrador → Contas de serviço → Criar conta de serviço** (nome `cybermech-metricas`; **sem papéis**).
4. Abrir a conta criada → **Chaves → Adicionar chave → Criar nova chave → JSON**: baixa um arquivo `.json`.
5. analytics.google.com → **Administrador → Gerenciamento de acesso à propriedade → "+"** → colar o e-mail da conta de serviço (termina em `.iam.gserviceaccount.com`) com o papel **Leitor**.
6. Administrador → **Detalhes da propriedade**: copiar o **ID da propriedade** (só números; não é o `G-…`).
7. Guardar o `.json` em `D:\DECEPTICONS\.tmp\servidor\ga-chave.json` (**nunca** colar a chave no chat nem no git) e avisar só "chave guardada" e o ID da propriedade. **Estado em 18/10:** a chave está guardada e o Google a aceitou (emitiu o token para a conta `analytics-cybermech@cybermech-online.iam.gserviceaccount.com`); **falta o ID numérico da propriedade** (Administrador → Detalhes da propriedade) para a conferência final da leitura. **Depois disso falta ligar a leitura no código** (uma ordem à parte; fora do escopo do lançamento).

**D. Servidor em outro computador (decidido em 18/10: ainda não).** Medido (`CAPACIDADE.md`): 100 jogadores em 13 salas = **26% de um núcleo, 375 MB de memória e 4,4 KiB/s por jogador**; o servidor é leve, e o que atrapalha hoje é dividir o PC com o trabalho. Um PC velho serve se tiver **4 GB de memória, disco SSD, cabo de rede** e ninguém usando; formatar costuma curar a lentidão de software, não disco falhando. Uma VPS pequena (1 vCPU, 4 GB) custa cerca de R$ 25 a 48 por mês (preço de promoção e de renovação, a confirmar) e resolve A1 e A13 de uma vez, mas exige reescrever o atualizador (feito para Windows). **Gatilho para migrar:** 20 a 30 jogadores simultâneos de verdade, ou a primeira queda por memória.

## 7. Ligar o e-mail do "esqueci a senha" (só o Comandante; P206)

O código está pronto e testado; falta o provedor. **Enquanto não estiver ligado**, o jogo diz que a recuperação por e-mail não está ativa e `npm run admin -- link-senha <e-mail>` (no PC do servidor) gera o link na mão. Com o Resend (grátis: 100 e-mails por dia, 3.000 por mês):
1. Criar a conta em resend.com e confirmar o e-mail.
2. **Domains → Add Domain** → `cybermech.online`. O Resend mostra alguns registros DNS (SPF, DKIM e um de retorno). **Copie cada um para o DNS da Cloudflare** (dash.cloudflare.com → o domínio → DNS → Add record), **em "somente DNS" (nuvem cinza)**, exatamente como o Resend mostra. Volte ao Resend e clique em **Verify** (leva de minutos a algumas horas).
3. **API Keys → Create API Key**, permissão **Sending access**, domínio `cybermech.online`. A chave (`re_…`) aparece **uma vez só**.
4. Guarde num arquivo, **sem colar a chave no chat**: `D:\DECEPTICONS\.tmp\servidor\email.json` com `{"provedor":"resend","chave":"re_COLE_AQUI","de":"CYBERMECH <nao-responda@cybermech.online>"}`.
5. O servidor lê o arquivo ao subir: no próximo deploy (ou reiniciando) fica ligado. Teste: no jogo, Configurações → Conta → "Esqueci a senha" com o seu e-mail; a mensagem chega em segundos (olhe o spam na primeira vez).
**Depois de ligar**, o que falta é o e-mail de aviso "sua senha foi trocada" (boa prática de segurança; uma ordem curta) e, se quiser, o seu nome na política (a LGPD pede a identidade do encarregado).
