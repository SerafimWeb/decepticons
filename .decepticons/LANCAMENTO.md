# LANÇAMENTO — o escopo congelado (18/10/2026, ordens P194 a P198)

> **O Comandante congelou o escopo (18/10):** *"congele o escopo e vamos focar no mais importante para lançar e ter jogadores online: controle de acesso, privilégio, autenticação, métricas para auditoria interna, analytics,
> observabilidade, governança, tudo que for ainda necessário. Vamos lançar com apenas a fase estação dos cabos e cidade neon livres, depois vamos liberar a terras raras (troque o nome rio vivo para terras raras); faça auditoria
> se nossa arquitetura está segura para lançarmos."* **Esta página manda na escolha do que fazer a seguir** (`AGENTS.md`, Passo Zero 12): o que não está aqui **espera o lançamento**, a menos que o Comandante peça.

> **Atualização 19/10 (P224):** a ordem de hoje é lançar com **2 a 3 missões prontas, offline e online, co-op ou competitivo**: o plano e os pacotes estão em **`CAMINHO_DO_LANCAMENTO.md`**, que passa a mandar **no que diz respeito às missões**; o que esta página diz sobre segurança, privilégio, auditoria, servidor e política continua valendo. **Atualização 20/10 (P232): o lançamento é enxuto e a linha final está na § 0 abaixo; o `CAMINHO_DO_LANCAMENTO.md` fica para a primeira atualização.**

## 0. A linha final (20/10, P232): lançar com o que já é real

**Ordem do Comandante (20/10):** *"devemos focar em apenas UMA delas pra lançar logo e depois continuamos os detalhes das outras? … poucas iterações e poucos PR."* **Decisão: sim.** Lança-se com o escopo de 18/10, que o código já cumpre (o catálogo `funcionalidades.ts` deixa públicos só `mapa:arena` e `mapa:praia`). **A Estação dos Cabos é a missão de vitrine** (a mais completa: objetivo, portas, cabos, dia que vira noite) e a Cidade Neon é a base.

| Mapa | No lançamento | Depois (atualização) |
|---|---|---|
| **Cidade Neon** | offline: Deathmatch, Sobrevivência (6 ondas, Colossus, transformador), Bandeira, Domínio; online: Deathmatch | co-op online (A1 + A2 do `CAMINHO_DO_LANCAMENTO.md`), Bandeira online |
| **Estação dos Cabos** | offline: Deathmatch e a missão em ondas; online: Deathmatch | a missão em co-op online (A3) |
| **Terras Raras** | EM BREVE (restrita) | já é real offline: o Comandante a abre no painel (`mapa:amazonia` → público, sem deploy) quando quiser; antes, medir a sala online no servidor |
| **8 de Janeiro** | EM BREVE (restrita) | a missão não existe (≈ 7 PRs) e pede revisão jurídica antes: só depois |
| Bunker | EM BREVE | — |

**Regra para todos os agentes até o lançamento:** nenhum mapa, missão, arma ou modo novo. Só entra (a) o que bloqueia o lançamento, (b) bug que o playtest das duas missões achar, (c) o que o Comandante mandar. Os pacotes A1 a A7 do `CAMINHO_DO_LANCAMENTO.md` ficam para a primeira atualização.

**O que falta para abrir (conferido em 20/10):**

1. **Playtest do Comandante, uma vez:** a Sobrevivência da Cidade Neon e a missão da Estação dos Cabos até o fim, em GPU real (`STATUS_REAL.md`: "falta o olho do Comandante e o equilíbrio jogando"). O que ele estranhar vira **no máximo 1 PR** de equilíbrio. *Comandante joga; Claude corrige.*
2. **Teste com 5 a 10 pessoas de fora** (item 9): duas sessões de ~30 min na Cidade Neon online; Claude lê `/metricas` e o log. *Comandante convida.*
3. **Fechar o atalho `?comandante=1`** (item 11): hoje **aberto** (o `deploy-site.json` não tem `comandantePorLink`, visto em 20/10). *O Comandante diz "pode fechar"; Claude faz.*
4. **Voz:** o `/status` do servidor mostra `tela:voz` **pública** em 20/10 (provavelmente aberta para os testes do microfone). Sem denúncia (`CAMINHO_DO_LANCAMENTO.md` § 5), **volte a `restrito`** no painel (SERVIDOR → VISIBILIDADE) antes de abrir, ou abra a voz só depois do PR da denúncia. *Comandante, no painel.*
5. **Política e e-mail:** o nome do encarregado na política (§ 6) e o DKIM/DMARC (§ 7B), para o "esqueci a senha" não cair no spam. *Comandante.*
6. **O servidor segue neste PC** (A1 mantido, § 6 D): nada de merge (o atualizador reinicia o servidor) com gente jogando; migrar quando chegar a 20 a 30 jogadores ao mesmo tempo.

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

| 11 | **Fechar o atalho do Comandante** (P224) | O `?comandante=1` abre, no site publicado, as fases restritas para quem digitar o link. É interruptor de desenvolvimento: no lançamento se fecha com uma linha. **Dois passos juntos:** (a) escrever `"comandantePorLink": false` em `.tmp/servidor/deploy-site.json` e publicar de novo; (b) o **servidor recusar mapa restrito a quem não é administrador** (**feito:** pacote A0, P226) | O (b) está feito; **o Comandante diz "pode fechar" e o Claude faz o (a)** | `https://cybermech.online/?comandante=1` **não** mostra o IMPLANTAR do 8 DE JANEIRO, e a conta de administrador continua abrindo o modo Comandante. **Lembrete automático:** enquanto estiver aberto, cada publicação do site escreve `LEMBRETE DE LANÇAMENTO` no log (`.tmp/servidor/publicar-site.log`) |

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

**Estado:** A1 mantido (o servidor segue neste PC até o jogo ficar pronto); A13 reconhecida (a cópia de segurança fica no mesmo disco); **e-mail do encarregado: feito** (`volkov@serafimweb.com`); **monitor: o alerta de túnel da Cloudflare já foi criado pelo Comandante** (A); **sem CNPJ** (decidido: o jogo é independente, de uma pessoa; a política já diz isso); **"esqueci a senha" pronto no código** (P206, aguardando a chave do Resend: § 7); **Google Analytics pronto no código** (P207, falta o ID da propriedade: C); `servidor.log` antigo **limpo**. **Faltam:** B (a opção de estado do visitante e o HSTS na Cloudflare), a chave do Resend (§ 7), o ID da propriedade (C), o nome do encarregado na política (a LGPD pede; ele decide) e o teste com gente de fora.

**A. Monitor externo (A14): o alerta de túnel da Cloudflare.** Tem que ser de fora do PC (a página de métricas mora no PC do servidor: se ele desligar, ela não avisa ninguém), e o jogo já passa por um túnel da Cloudflare. O **Tunnel Health Alert** é grátis (Zero Trust), manda e-mail e **não pede conta nova**: dash.cloudflare.com → **Notifications** (menu da conta) → **Add** → **Tunnel Health Alert** → nome "CYBERMECH túnel", destinatário o e-mail dele → escolher o túnel do jogo → Save. Avisa quando o túnel cai (PC desligado, internet fora, `cloudflared` parado). **Não** avisa se só o processo do servidor morrer com o túnel de pé; para isso, como segunda camada, um monitor HTTP em `https://jogo.cybermech.online/status` (o UptimeRobot grátis serve: 50 monitores a cada 5 min **só com alerta por e-mail**; o Telegram dele é de plano pago e o plano grátis é, pelos termos de terceiros, para uso não comercial: conferir). **O sistema do Telegram do serafim13 não serve para isto:** o `serafim-watchdog` roda a cada 6 h pelo GitHub Actions (queda detectada em até 6 h, e o GitHub Actions está sem pagamento, ao menos no repositório do jogo); o BatBot é outro produto (varredura de segurança de clientes).

**B. Cloudflare** (dash.cloudflare.com → o domínio `cybermech.online`):
1. **Estado do visitante:** Rules → **Managed Transforms** → ligar **"Add visitor location headers"**. O servidor lê só o `cf-region-code` (a sigla do estado, só do Brasil); cidade e coordenadas chegam junto, mas são ignoradas e nunca gravadas. O estado aparece em "De onde vêm", no `/metricas/`, a partir do dia seguinte.
2. **HSTS (A12):** **feito para o site pelo `.htaccess` (19/10).** A Cloudflare só cobre o que passa por ela, e conferi: **o `cybermech.online` (o site) é servido direto pela Hostinger (`Server: hcdn`), sem passar pela Cloudflare** (nuvem cinza); só o `jogo.cybermech.online` passa (`Server: cloudflare`). Então o HSTS que o Comandante ligou na Cloudflare vale, no máximo, para o `jogo.`, e **o `jogo.` ainda não manda o cabeçalho** (conferi em 19/10: pode levar um tempo ou a opção não salvou; não é crítico, só scripts e o WebSocket falam com ele). **O site agora manda `Strict-Transport-Security: max-age=15552000` (180 dias)**, sem `includeSubDomains` e sem `preload` (as duas decisões que não se desfazem), definido em `scripts/site.mjs` e conferido pelo `site --check`.

**C. Chave do Google Analytics** (para trazer os números do Analytics para o `/metricas/`; o jogo já manda dados pelo código de medição `G-2CCHDCEC7X`, depois do consentimento):
1. console.cloud.google.com → criar um projeto (ex.: "cybermech-analytics").
2. **APIs e serviços → Biblioteca** → procurar **"Google Analytics Data API"** → **Ativar**.
3. **IAM e administrador → Contas de serviço → Criar conta de serviço** (nome `cybermech-metricas`; **sem papéis**).
4. Abrir a conta criada → **Chaves → Adicionar chave → Criar nova chave → JSON**: baixa um arquivo `.json`.
5. analytics.google.com → **Administrador → Gerenciamento de acesso à propriedade → "+"** → colar o e-mail da conta de serviço (termina em `.iam.gserviceaccount.com`) com o papel **Leitor**.
6. Administrador → **Detalhes da propriedade**: copiar o **ID da propriedade** (só números; não é o `G-…`).
7. Guardar o `.json` em `D:\DECEPTICONS\.tmp\servidor\ga-chave.json` (**nunca** colar a chave no chat nem no git) e avisar só "chave guardada" e o ID da propriedade. **Estado em 19/10 (testado ao vivo):** a chave está guardada, o Google a aceita e **a Admin API já está ligada**; a leitura está pronta no código (P207). **Mas a conta de serviço só enxerga uma propriedade, a "odpandroid" (o app Android do Olho do Pai, no "Default Account for Firebase"), e ela NÃO é a do CYBERMECH** (o jogo e o site medem com o código `G-2CCHDCEC7X`, que não está nessa propriedade). O acesso foi dado na propriedade errada. **O servidor não usa os números dela**: o `/metricas/` diz "a conta só enxerga outra(s) propriedade(s) (odpandroid)". **Para consertar (2 minutos):** analytics.google.com → escolha a propriedade do CYBERMECH (a que tem o fluxo web do `G-2CCHDCEC7X`; se ainda não existir, crie uma propriedade nova com um fluxo web para `cybermech.online` e troque o código nos três lugares: `client/index.html`, `scripts/site/tema.mjs` e `server/analytics.ts`) → **Administrador → Gerenciamento de acesso à propriedade → "+" → o e-mail `analytics-cybermech@cybermech-online.iam.gserviceaccount.com` → papel Leitor**. O servidor percebe em até 30 s, sem reiniciar, e descobre a propriedade sozinho (a que tem o `G-2CCHDCEC7X`). Se preferir apontar à mão: o ID de 9 ou 10 dígitos em `D:\DECEPTICONS\.tmp\servidor\ga-propriedade.txt` (esse arquivo vale sem conferir). O número de 21 dígitos que veio no chat em 18/10 é o `client_id` da conta de serviço, outra coisa. **Achado em 20/10 (print do Comandante): a propriedade do CYBERMECH existe** e chama-se **"cybermech"**, dentro da conta **"Default Account for Firebase"** (o nome da conta vem do Firebase do app Android; **não há relação funcional com o jogo**), e já recebe os dados do site (65 usuários em 7 dias). **Falta só o papel Leitor nela:** Administrador (engrenagem, canto inferior esquerdo) → com "cybermech" selecionada no topo → **Gerenciamento de acesso à propriedade** → **"+"** → **Adicionar usuários** → colar o e-mail da conta de serviço → **desmarcar "Notificar por e-mail"** → função **Leitor** → Adicionar. Não é preciso achar o código `G-2CCHDCEC7X`: o servidor o confere sozinho.

**D. Servidor em outro computador (decidido em 18/10: ainda não).** Medido (`CAPACIDADE.md`): 100 jogadores em 13 salas = **26% de um núcleo, 375 MB de memória e 4,4 KiB/s por jogador**; o servidor é leve, e o que atrapalha hoje é dividir o PC com o trabalho. Um PC velho serve se tiver **4 GB de memória, disco SSD, cabo de rede** e ninguém usando; formatar costuma curar a lentidão de software, não disco falhando. Uma VPS pequena (1 vCPU, 4 GB) custa cerca de R$ 25 a 48 por mês (preço de promoção e de renovação, a confirmar) e resolve A1 e A13 de uma vez, mas exige reescrever o atualizador (feito para Windows). **Gatilho para migrar:** 20 a 30 jogadores simultâneos de verdade, ou a primeira queda por memória.

## 7. Ligar o e-mail do "esqueci a senha" (só o Comandante; P206)

O código está pronto e testado. **Enquanto não estiver ligado**, o jogo diz que a recuperação por e-mail não está ativa e `npm run admin -- link-senha <e-mail>` (no PC do servidor) gera o link na mão.

**O caminho recomendado: o e-mail da própria Hostinger. Sem serviço novo, sem cartão, sem cadastro de terceiro.** O `cybermech.online` já usa o e-mail da Hostinger (os registros MX e SPF dele apontam para lá: conferido), então basta uma caixa:
1. No **hPanel da Hostinger** → **E-mails** → escolha o domínio `cybermech.online` → **Criar conta de e-mail** → endereço `nao-responda@cybermech.online` e uma senha forte (anote; a Hostinger só a mostra quando você a cria). Se o seu plano não tiver caixa de e-mail para esse domínio, o hPanel avisa nessa tela: me diga e eu mostro o plano B (Resend, abaixo).
2. **O arquivo `D:DECEPTICONS.tmpservidoremail.json` já foi criado (19/10)**, preenchido com a Hostinger (`smtp.hostinger.com`, porta 465, usuário `nao-responda@cybermech.online`). **Você não escreve JSON.** **Onde rodar os comandos `npm run email`:** em **`D:DECEPTICONS.tmpwt-servidor-prod`** (`cd D:DECEPTICONS.tmpwt-servidor-prod`), a pasta de produção, que o atualizador mantém sempre em dia. **Não use `D:DECEPTICONS`**: ela está parada num branch antigo (217 commits atrás), e por isso o `npm run email` "não existia" lá.
3. Abra esse arquivo no **Bloco de Notas**, troque `COLE_A_SENHA_AQUI` pela senha da caixa e salve. (A senha fica só nesse arquivo, fora do git; **não cole no chat**.)
4. `npm run email -- testar seu@email.com`: manda uma mensagem de verdade pelo mesmo caminho do servidor. Se falhar, ele diz o que conferir (senha, porta, limite). Se chegar no spam na primeira vez, marque "não é spam".
5. **Pronto, sem reiniciar o servidor:** ele relê o arquivo sozinho. Teste no jogo: Configurações → Conta → "Esqueci a senha". `npm run email -- estado` mostra o que está configurado, sem mostrar a senha.

**Plano B: o Resend** (grátis: 100 e-mails por dia, 3.000 por mês; exige conta e verificar o domínio): conta em resend.com → **Domains → Add Domain** → `cybermech.online` → copiar cada registro DNS que ele mostra para a **Cloudflare** (DNS → Add record, em "somente DNS"/nuvem cinza) → **Verify** → **API Keys → Create** (Sending access) → no `email.json`: `{"provedor":"resend","chave":"re_…","de":"CYBERMECH <nao-responda@cybermech.online>"}`.

**Sobre a Cloudflare (a resposta que o agente dela deu):** para o e-mail da Hostinger **não há nada a fazer lá**. O MX e o SPF já estão certos. A pergunta "qual chave guardar?" dele era sobre o Resend (plano B), que você não precisa usar. A chave/senha nunca vai para a Cloudflare: fica no `email.json` do PC do servidor.

**Depois de ligar**, o que falta é o e-mail de aviso "sua senha foi trocada" (boa prática de segurança; uma ordem curta) e, se quiser, o seu nome na política (a LGPD pede a identidade do encarregado).

**7B. Entregabilidade do e-mail (DKIM e DMARC) e o HSTS do `jogo.` (20/10, depois de o e-mail de redefinição chegar).** O DNS do `cybermech.online` fica na **Cloudflare**, então a Hostinger não cria estes registros sozinha. Conferi o DNS público em 20/10: o **SPF existe e está certo** (`v=spf1 include:_spf.mail.hostinger.com ~all`); o **DKIM não existe** e o **DMARC não existe**. Sem eles o Gmail e o Outlook podem mandar a mensagem para o spam.
1. **Cloudflare → `cybermech.online` → DNS → Records → Add record**, três vezes, tipo **CNAME**, **Proxy status: "DNS only" (nuvem cinza; com a laranja o DKIM não funciona)**: nome `hostingermail-a._domainkey` → destino `hostingermail-a.dkim.mail.hostinger.com`; o mesmo para `hostingermail-b._domainkey` → `hostingermail-b.dkim.mail.hostinger.com` e `hostingermail-c._domainkey` → `hostingermail-c.dkim.mail.hostinger.com`. (Conferi que os três destinos existem no DNS público: o `a` publica a chave real; `b` e `c` são marcadores de rotação vazios, normais. **Confira no hPanel da Hostinger, em E-mails, se os nomes batem com os que ela mostra**: eu não vejo o painel dela.)
2. Mais um registro, tipo **TXT**, nome `_dmarc`, conteúdo `v=DMARC1; p=none;`. É só observar: **não bloqueia nada**. Depois de algumas semanas sem problema, sobe para `p=quarantine`.
3. **Teste** (depois de alguns minutos): `npm run email -- testar seu@gmail.com`; no Gmail, abra a mensagem → "Mostrar original" → deve dizer **SPF: PASS, DKIM: PASS, DMARC: PASS**.
4. **HSTS do `jogo.`:** Cloudflare → `cybermech.online` → **SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS) → Enable HSTS**: Max-Age **6 meses**, Include subdomains **desligado**, Preload **desligado**, No-Sniff **ligado** → Save. Em 20/10 o `jogo.` ainda não mandava o cabeçalho (`curl -sI https://jogo.cybermech.online/`). Prioridade baixa: só scripts e o WebSocket falam com ele; o site (`cybermech.online`) já manda o HSTS pelo `.htaccess`.

