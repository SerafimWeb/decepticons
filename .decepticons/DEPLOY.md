# DEPLOY — CYBERMECH

> Fonte canônica de infraestrutura (R8). Leia antes de mexer em build, CI ou hospedagem.

---

## SITE DO PROJETO (cliente estático)

**Endereço:** `https://cybermech.online/` (decisão do dono em 15/10/2026: domínio próprio do jogo, site na raiz, **público**; até então era `www.selvamkt.com.br/cybermech/`, decisão de 23/09. Sem jogadores nem links divulgados na época, a troca foi direta, sem redirecionamento).
**Migração de 15/10 (P142), o que ficou no servidor:** o site está em `domains/cybermech.online/public_html` (o `deploy-site.json` aponta para lá). O **endereço antigo só redireciona**: na pasta `selvamkt.com.br/public_html/cybermech/` o `.htaccess` tem uma linha `RedirectMatch 301 ^/cybermech/?(.*)$ https://cybermech.online/$1` (o caminho e os parâmetros seguem), e o `.htaccess` de antes ficou como `.htaccess.antigo`. **Nada foi apagado** lá; para desfazer, troque o `.htaccess` pelo `.htaccess.antigo` (pelo gerenciador de arquivos da Hostinger ou por SSH). O publicador **não escreve** nessa pasta antiga (a trava só aceita a nova): o redirecionamento foi posto uma vez, à mão, com o caminho conferido. O **servidor de jogo** segue em `jogo.selvamkt.com.br` até o Comandante pôr a zona `cybermech.online` na Cloudflare.

- `/`: landing do jogo, para quem vai jogar (`scripts/landing.mjs`; os destaques vêm da seção VITRINE do `GAME_DESIGN.md`).
- `/sala-de-controle/`: o case do desenvolvimento (`scripts/painel.mjs --site`; até 25/09 era `/bastidores/`, que agora leva para lá): equipe, fluxo, protocolo, evolução, mapa da campanha, frentes, diário e entregas.
- `/jogar/`: o jogo (build do Vite com `base: './'`, funciona em qualquer subpasta).
- `/capturas/`: três imagens do jogo feitas pelo próprio deploy (`site.mjs --capturas`): entra no build headless, joga ~20 s e fotografa as três câmeras. Viram a capa da landing e a prévia do link (og:image). Se falharem, a landing sai sem imagens e o log avisa.
- **O que vai a público (decisão do dono em 24/09: bastidores às claras):** as páginas são geradas, nenhum documento interno vai inteiro. Dos bastidores saem só os títulos do `HISTORICO`, a divisão de trabalho e as pendências por pessoa do `ESTADO_ATUAL`, o `ROADMAP` e números do git e dos PRs. Nunca secrets, host, usuário ou caminho do servidor. O `--check` reprova o codinome interno em qualquer página pública.
- **Dados das páginas** (`scripts/site/dados.mjs`): a lista de PRs vem do GitHub (`gh` com `GH_TOKEN` no CI, permissão `pull-requests: read`); sem acesso, cai para o git. A evolução lê cada merge da `main` com `git grep`, por isso o checkout do CI é com `fetch-depth: 0`.
- **O `selvamkt.com.br` não é deste projeto:** é o site real da Selva MKT, e o CAPTIA fica em `/captia/` nele; os dois moram na mesma conta Hostinger. O publicador só escreve em `domains/cybermech.online/public_html` e **recusa qualquer outra pasta** (a trava é do código e dos testes, não de quem configura).
- **Nome:** `cybermech`, nunca `decepticons` (marca da Hasbro; ver `IDENTITY.md`).

**Como vai ao ar ("build do dia"):** cada merge na `main` com o `check` verde dispara o job `deploy` do `.github/workflows/ci.yml`:
`npm run site -- --capturas` (monta `.tmp/site/` e fotografa o jogo) → rsync por SSH para a Hostinger → `node scripts/site.mjs --verify <SITE_URL>`.
- Mesmo padrão do deploy do CAPTIA nesta conta Hostinger: SSH na **porta 65002**, **5 tentativas** com espera crescente (a proteção anti-abuso da Hostinger às vezes derruba a conexão do runner).
- **Trava de segurança:** o `rsync --delete` apaga no servidor o que não existe localmente. O job se recusa a rodar se `DEPLOY_PATH` não terminar em `/domains/cybermech.online/public_html/`, para nunca apagar o site de outro domínio da conta.
- **Verificação:** landing, `/oficina/`, `/sala-de-controle/` (e `/bastidores/` levando para ela), `/metricas/` (privada, com `noindex`) e `/jogar/` com o conteúdo certo (o servidor responde 200 até para arquivo inexistente), doctype e `<meta charset>` no início, a CSP aplicada e o `.wasm` servido como `application/wasm` e comprimido; capa ausente só avisa. Se a Cloudflare desafiar o IP do runner, o job avisa e não falha (conferir no navegador).

**Minutos do CI (13/10/2026, Qwen, a pedido do Comandante):** o repositório é **privado**, então os minutos do Actions são **medidos** — o plano gratuito dá ~**2.000 min/mês** e a cota estourou (12/10, o "job de 2 s"). O que consome: **cada PR** dispara o `check` (que termina com smoke/bocas/site no Chrome headless — vários minutos) e **cada merge na `main`** dispara o `check` de novo **mais** o `deploy`. Com quatro agentes abrindo PRs o dia todo e merges frequentes, o volume passa da cota. **Duas travas entraram no `ci.yml`:** (1) PR/merge que só mexe em `*.md` **não roda a suíte pesada** — o job ainda termina verde, para o `npm run publicar` (que espera a linha `check`) continuar valendo; (2) `concurrency` **cancela a execução anterior** quando o mesmo PR recebe outro push. O consumo real está em **GitHub → Settings → Billing → Actions** (relatório por workflow/dia).

**Publicar pelo PC do Comandante, sem o GitHub (automático e grátis; 13/10, P105):** o site vai ao ar **sem o Actions**, e é assim que ele publica hoje. `npm run publicar-site` monta o site (`npm run site`), empacota a pasta **num arquivo** (`tar`; a máquina é Windows e não tem `rsync`), **sobe o arquivo inteiro** para dentro do destino por `ssh`, **confere a soma dele no servidor** (`sha256sum`) e **só então extrai** — e no fim **confere por checksum** que o servidor tem os mesmos arquivos que o PC: `index.html`, `jogar/index.html`, `sala-de-controle/index.html`, `.htaccess` **e os `assets/` que o próprio `jogar/index.html` pede** (é o que o navegador baixa para abrir o jogo). Qualquer passo que falhe — inclusive a conferência final — refaz o ciclo inteiro, até 5 tentativas com espera crescente. Só então grava a marca `site-publicado` (a versão do código que está no ar).
- **O site nunca fica meio publicado (a lição de 14/10):** até então o envio era **um cano só** (o `tar` do PC escrevia dentro do `ssh`, que extraía no servidor enquanto recebia). Uma conexão cortada no meio deixou o **`index.html` novo no ar e os `assets/` (nome com hash) não**: o jogo abria e **todos** os scripts respondiam 404 (`ERR_ABORTED`). A publicação que morria no meio não deixava linha nenhuma no log (a saída de um processo lançado pelo WMI não ia a lugar nenhum) e a **trava** de 25 min segurava as rodadas seguintes: o site ficou fora do ar ~40 min. Com o pacote inteiro, conferido por soma **antes** da extração, uma conexão cortada **não muda nada no ar**; cada passo pelo `ssh` tem **limite de tempo** (240 s no envio e na extração, 60 s na conferência), então uma conexão pendurada vira erro e nova tentativa em vez de espera infinita. O pacote é `.tmp/site-pacote.tgz` no PC e `<destino>/.publicar-site.tgz` no servidor (dentro de `/cybermech/`, apagado logo depois de extrair; falhou a extração, ele fica de propósito, para a investigação).
- **Um erro do publicador não fica mais invisível:** o console dele é anexado em `<worktree>\.tmp\servidor\publicar-site-console.log` (o `publicar-site.log`, na pasta de dados, segue com o passo a passo).

- **Automático:** o atualizador do PC (a tarefa "CYBERMECH atualizar", a cada 10 min) lança o publicador **solto** (pelo WMI, como o ajudante de reinício: a tarefa tem 5 min de limite, montar o site leva mais) **a cada versão nova da `main`**, com `--se-mudou`. Merge na `main` → o servidor atualiza e reinicia → o site é montado e enviado, em poucos minutos, **sem ninguém apertar nada**. O que ele fez fica em `.tmp/servidor/publicar-site.log`.
- **À mão:** `npm run publicar-site` (sempre publica), `-- --capturas` (também fotografa o jogo para a landing; as fotos ficam guardadas em `.tmp/servidor/site-capturas/` e voltam nas montagens seguintes, que não abrem o Chrome), `-- --so-montar` (não envia), `-- --configurar` (diz o que falta na configuração, **sem mostrar valor**).
- **A configuração fica fora do repositório (R2/R10):** `deploy-site.json` na pasta de dados do servidor (`.tmp/servidor/`, a mesma do `contas.db`, que a atualização nunca apaga): `host`, `port`, `user`, `path` e `key` (a chave SSH do PC; a Hostinger já a conhece), mais `url`/`gameServer` opcionais. **A trava é a do job:** `path` tem de terminar em `/domains/cybermech.online/public_html` (a pasta de outro domínio da conta é recusada); host, usuário e caminho só aceitam letras, números, ponto, hífen, sublinhado e barra (nada que o shell remoto interprete). O envio **espelha sem apagar** o que saiu do build (apagar é decisão à parte, e nunca fora de `cybermech/`).
- **Merge sem o CI do GitHub:** `npm run publicar -- --titulo "..." --corpo .tmp/pr.md --sem-ci` não espera o `check` do Actions (a prova é o `npm run check` do hook do push, que barra o push se falhar), aceita o PR `CLEAN` ou `UNSTABLE` (o check vermelho é a cobrança, não o código), mergeia e **só apaga o branch remoto depois de confirmar `MERGED`**. Conflito ou atraso em relação à `main` continuam barrando.
- **Primeira publicação real (13/10, 15:50):** 8cbe837 no ar em **66 s** (montar com capturas + enviar: 4 s), conferida por checksum; o bundle servido já tinha o `COLOSSUS-V4` e a névoa de calor. O site estava congelado desde 12/10 22:03.
- **O disparo automático (13/10, 16:24):** depois do merge do #289 o atualizador reiniciou o servidor em `55ba67c` e, na rodada seguinte, lançou o publicador sozinho: **`PUBLICADO: 55ba67c` em 25 s** (as capturas guardadas voltam sem abrir o Chrome). Um detalhe: a rodada que **traz** o código novo roda o script **antigo** do atualizador (o PowerShell já o leu), então uma mudança no próprio `atualizar-e-reiniciar.ps1` só vale da rodada seguinte em diante.

**Configuração no GitHub (dono), sem valor nenhum no repositório (R2/R10) nem no chat (R11):**

| Nome | Tipo | Valor |
|---|---|---|
| `SITE_URL` | variável | `https://cybermech.online/`: liga o job de deploy |
| `DEPLOY_HOST` | secret | o mesmo host SSH do CAPTIA (hPanel → Acesso SSH) |
| `DEPLOY_USER` | secret | o mesmo usuário SSH do CAPTIA |
| `DEPLOY_PATH` | secret | `/home/<usuário>/domains/cybermech.online/public_html/` |
| `DEPLOY_SSH_KEY` | secret | chave privada de deploy (recomendado: uma chave só deste projeto, com a pública cadastrada no hPanel) |

No Git Bash, `gh secret set` corrompe caminhos (`/home/...` vira `D:/Git/home/...`). Use `MSYS_NO_PATHCONV=1 gh secret set DEPLOY_PATH -R SerafimWeb/decepticons` (lição do CAPTIA).

**Cabeçalhos (`.htaccess` gerado por `scripts/site.mjs`, fonte única também do teste local):**
- `AddType application/wasm .wasm`. O LiteSpeed da Hostinger comprime JS, CSS e HTML sozinho (brotli), **mas não o `.wasm`**: o build gera um `.wasm.gz` (735 KB em vez de 2,2 MB), e o `.htaccess` de `jogar/assets/` entrega essa versão a quem aceita gzip, com `Content-Type: application/wasm` e `Content-Encoding: gzip`. A regra foi testada numa pasta isolada no servidor antes de entrar, e o `--verify` reprova `.wasm` sem compressão.
- CSP com `'wasm-unsafe-eval'` (o Rapier precisa), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- `index.html` sem cache; `jogar/assets/` (nomes com hash) com cache de 1 ano, `immutable`.
- **Sem HSTS por enquanto:** o domínio agora é só do jogo, então dá para ligar depois que o HTTPS estiver estável (decisão do dono; HSTS não se desfaz rápido no navegador).

**Teste antes de ir ao ar:** `npm run site -- --check` (dentro do `npm run check`) serve `.tmp/site/` na raiz (como em produção) com **os mesmos cabeçalhos** e abre bastidores, landing → "Entrar no cockpit" → jogo no Chrome headless. Reprova: violação de CSP, recurso faltando, link interno quebrado, página fora de UTF-8 ou em modo quirks, codinome interno.

---

## SERVIDOR DE JOGO (Node + `ws`, M3 em 26/09)

- Precisa de host com WebSocket persistente e processo Node longo. Hospedagem só estática ou FTP não serve.
- Node `>=22.12.0` (node:sqlite).

**No PC de casa (hoje):**
1. Na pasta do projeto: `npm install` (uma vez) e `npm run server`. Aparece
   `CYBERMECH · servidor de jogo em ws://localhost:2567/?sala=ARENA`. Outra porta: `PORT=3000 npm run server`
   (no PowerShell, `$env:PORT=3000; npm run server`).
2. A cada 10 s o servidor mostra as salas abertas, os jogadores e o tempo médio do tick (meta: até 2 ms).
3. **Rede de casa (sem VPN, para testar dois PCs):** os outros computadores usam `ws://IP-DESTE-PC:2567` (ligue o servidor com `HOST=0.0.0.0`; o padrão é só localhost, para o túnel). Na primeira vez, o Windows pergunta se
   libera o Node no firewall: libere só para redes privadas.
4. **Pela internet (playtest):** Cloudflare Tunnel, sem abrir porta nem mostrar o IP:
   `cloudflared tunnel --url http://localhost:2567` dá um endereço `https://….trycloudflare.com`; o jogo usa o
   mesmo endereço com `wss://`. O endereço muda a cada vez que o túnel sobe.
4b. **Cortes por taxa alta e picos (18/10, P184).** A porteira (`server/guard.ts`) limita cada conexão a 60 mensagens por segundo (o cliente manda ~31), com folga de 120 para picos. **Acima disso a mensagem é descartada e a conexão segue**; só o abuso de verdade (o descarte acumulado passa de 600, caindo 60 por segundo) corta (código 4008, `corte de <ip>: taxa alta demais` no log). Um pico aparece como `descarte de <ip>: pico de mensagens (a conexão segue)`. **Por quê:** o PC do servidor é o mesmo em que se trabalha, e quando ele fica sem memória o laço do Node congela por segundos (o `tick` do log é uma média móvel: 298 e 1.093 ms são travadas de segundos); as mensagens de todos chegam juntas na volta, e antes um jogador bem-comportado era cortado por isso. **A conexão que cai volta sozinha (18/10):** o cliente reconecta com esperas de 0,3, 0,7, 1,5, 3, 5 e 5 s (~15 s, G13); a tela mostra "RECONECTANDO (n/6)" no canto e o jogador volta à sala como piloto novo (o placar da sessão zera); só depois de seis tentativas é que pede para recarregar. **Se a conexão cair mesmo assim,** olhe, nesta ordem: (1) o `jogo.cybermech.online/status` responde? (um 502 da Cloudflare é o túnel fora do ar: **o túnel cai quando a VPN do PC do servidor muda**); (2) a memória livre do PC do servidor (menos de 1 GB: feche o IDE e os navegadores); (3) o `servidor.log`.
4c. **O registro técnico do servidor (18/10, P187, LGPD).** O que o servidor diz de si (salas, conexões, recusas, "conta criada (número N)", a cópia de segurança, "métricas privadas ligadas: o token está em …") **não vai mais para o `servidor.log`**: vai para **`.tmp\servidor\registro\servidor-AAAA-MM-DD.log`**, um arquivo por dia (dia de Brasília), **apagado sozinho depois de 30 dias** (`server/registro.ts`; o painel do servidor lê dele). O `servidor.log` da tarefa fica só com o que o Node escreve sozinho (o aviso do SQLite, e a queda com erro). **Onde os itens de baixo dizem "o `servidor.log` diz …", leia "o registro de hoje diz …".** O IP nunca vai inteiro para o registro (`212.8.252.x`) e o e-mail não vai. **Limpeza única, com a tarefa parada:** o `servidor.log` de antes de 18/10 tem IPs inteiros e 1 e-mail; com a tarefa "CYBERMECH servidor" parada, apague ou renomeie o arquivo (rodando, o Windows não deixa: EBUSY). **O contato do encarregado** da política de privacidade: uma linha com o e-mail em `.decepticons/contato-privacidade.txt` (ou a variável `CYBERMECH_CONTATO_PRIVACIDADE` onde o site é montado); sem ele a página usa os botões do jogo.
4d. **A audiência (18/10, P188): de onde vêm as visitas.** O servidor soma, por dia e por categoria (nunca por pessoa), de onde a visita veio (digitou o endereço, busca, rede social, outro site, campanha `utm_*`), o aparelho, o navegador, o sistema, o idioma, novo ou recorrente e o funil de cada canal (`server/Audiencia.ts`); fica em **`.tmp\servidor\audiencia.json`** (120 dias, junto do `telemetria.json` e do `partidas.json`) e aparece nas seções **De onde vêm**, **Quem chega** e **Quanto se joga** do `/metricas/`. **O estado do Brasil** só aparece se a Cloudflare mandar o cabeçalho `cf-region-code`: no painel da Cloudflare do domínio, **Rules → Managed Transforms → "Add visitor location headers"** (ação do dono; sem ela a tabela de estados fica vazia e o resto funciona). **O endereço IP nunca é guardado nem lido para isto.** Para ver uma campanha aparecer, abra a landing com `?utm_source=teste&utm_medium=zap&utm_campaign=lancamento`.
5. **Jogar (M4, 26/09):** o endereço do jogo com `?sala=` entra online.
   - No próprio PC do servidor: `https://cybermech.online/jogar/?sala=ARENA&servidor=ws://localhost:2567&nome=Dan`
     (ou `npm run dev` e `http://localhost:5173/?sala=ARENA`).
   - Pela internet: suba o túnel e todo mundo abre
     `https://cybermech.online/jogar/?sala=ARENA&servidor=https://….trycloudflare.com&nome=SeuNome`
     (o jogo troca o `https://` por `wss://`).
   - No topo da tela aparece `ONLINE · SALA ARENA · 42 ms · 2 pilotos`. Sem `servidor` fora do PC do servidor, o
     jogo avisa e joga offline.

> **FEITO em 15/10 (P144):** a zona `cybermech.online` está na Cloudflare (nameservers `chin` e `dom.ns.cloudflare.com`), `jogo.cybermech.online` aponta para o túnel `cybermech`, e o jogo publicado fala com ele (`gameServer` do `deploy-site.json`). O nome antigo `jogo.selvamkt.com.br` ainda funciona e **só sai do túnel por ordem do Comandante**. O que está abaixo segue como registro do que foi feito e como refazer.

**Mover o servidor de jogo para `jogo.cybermech.online` (P144, 15/10): o passo a passo do Comandante.** O túnel
`cybermech` **já existe** e serve `jogo.selvamkt.com.br`; falta pôr a zona nova na Cloudflare, porque o túnel só publica
nomes de uma zona que esteja lá. Hoje o DNS de `cybermech.online` está nos servidores de nome da **Hostinger**
(`hermes` e `artemis.dns-parking.com`), não na Cloudflare. Nada abaixo mexe no `selvamkt.com.br`.
1. **Cloudflare → Add a site → `cybermech.online` → plano Free.** Ela lê a zona e mostra o que achou. A zona de hoje
   (lida pela API da Hostinger em 15/10, nada alterado): `@` ALIAS → `cybermech.online.cdn.hstgr.net`; `www` CNAME →
   `www.cybermech.online.cdn.hstgr.net`; `ftp` A → `82.25.73.129`; `autodiscover` e `autoconfig` CNAME →
   `*.mail.hostinger.com`; `MX` 5 `mx1.hostinger.com` e 10 `mx2.hostinger.com`; `TXT` SPF
   `v=spf1 include:_spf.mail.hostinger.com ~all`. Confira que **todos** entraram (o `@` pode aparecer como CNAME: está certo, a
   Cloudflare "achata" o apelido). **Marque todos como "DNS only" (nuvem cinza):** o site continua exatamente como está e o
   tráfego vai direto à Hostinger.
2. **Hostinger → Domínios → `cybermech.online` → Nameservers → alterar** para os dois que a Cloudflare mostrou (o domínio é
   da Hostinger, não do registro.br). Propaga em minutos a algumas horas; o site segue no ar o tempo todo.
3. **Túnel:** Zero Trust → Networks → Tunnels → `cybermech` → Public hostname → Add: `jogo.cybermech.online` →
   `http://localhost:2567`, **WebSocket ligado**. **Não remova** o `jogo.selvamkt.com.br` ainda.
4. **Avise o Claude.** Ele troca o `gameServer` do `.tmp/servidor/deploy-site.json` para `wss://jogo.cybermech.online`,
   publica com **0 jogadores**, confere (`/status` e entrar numa sala) e só então o nome velho sai do túnel.
5. **Proteções da Cloudflare (todas grátis), com o `jogo.` já respondendo:** SSL/TLS → **Full (strict)** · **Always Use HTTPS** ·
   TLS mínimo 1.2 · Security → **Bot Fight Mode** (se o smoke headless ou o monitor forem barrados no `jogo.`, crie exceção
   de IP) · WAF → **rate limiting** em `jogo.cybermech.online/conta/*` (o plano grátis dá uma regra: 10 pedidos por 10 s por IP →
   bloquear) · **Turnstile** no cadastro, quando a conta de jogador abrir (P145) · **DNSSEC** (a Cloudflare gera o DS; cole na
   Hostinger) · **HSTS** só depois de uma semana sem problema (o site também ainda não manda o cabeçalho).
6. **No servidor (já no código, P143):** o WebSocket e as rotas `/conta/*` só aceitam a página do jogo
   (`https://cybermech.online` e `www`), a máquina local e a rede de casa (`server/origem.ts`). Outra origem (um domínio de
   teste, um beta) entra por **`CYBERMECH_ORIGENS="https://beta.exemplo,https://outro.exemplo"`** nas variáveis da tarefa do servidor.

**Servidor público 24 h no PC de casa (26/09): quem abre o site clica em "Jogar online" e entra.**
O túnel rápido (`trycloudflare.com`) muda de endereço toda vez que sobe: serve para teste, não para o público. Para
um endereço fixo, o túnel nomeado da Cloudflare (grátis, sem abrir porta, sem mostrar o IP de casa), que exige um
domínio cadastrado na Cloudflare. **Decisão do dono em 26/09: manter no mesmo domínio (`selvamkt.com.br`)**, com o
subdomínio `jogo.selvamkt.com.br` só para o servidor de jogo. As proteções que garantem que um projeto não estraga
o outro ficam em "Servidor no mesmo domínio", logo abaixo.

Passo a passo, uma vez só:
1. **DNS na Cloudflare (o site continua igual):** entrar em `dash.cloudflare.com` → Add a site → `selvamkt.com.br`
   → plano Free. A Cloudflare lê a zona do Hostinger e mostra tudo que encontrou. Confira que **todos** os registros
   antigos estão lá (`A @ 82.25.73.129`, `AAAA @ 2a02:4780:13:816:0:305f:eea0:4`, `www` CNAME, `ftp`, `autodiscover`,
   `MX mx1/mx2.hostinger.com`, `TXT SPF v=spf1 include:_spf.mail.hostinger.com ~all`, mais quaisquer chaves de e-mail
   `hostingermail-*._domainkey`; o painel do Hostinger tem a lista). Marque **cada um deles como "DNS only" (nuvem
   cinza)**: a Cloudflare só resolve nome, o tráfego vai direto para o Hostinger, e o site da Selva MKT continua
   idêntico ao que é hoje. No `registro.br`, troque os nameservers para os dois que a Cloudflare deu (algo como
   `ada.ns.cloudflare.com` e `sam.ns.cloudflare.com`). Propaga em minutos a algumas horas; enquanto propaga, tudo
   segue funcionando pelos servidores antigos.
2. **Túnel do jogo:** dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create → nome `cybermech` → Windows.
   A tela mostra um comando `cloudflared.exe service install <TOKEN>`. **O token é segredo:** nunca no repositório,
   nunca no chat; rode direto no PowerShell como administrador. O túnel vira um serviço do Windows. Depois, em
   "Public hostname": `jogo.selvamkt.com.br` → `http://localhost:2567`, com **WebSocket ligado** (a Cloudflare pergunta;
   é obrigatório para o jogo). A Cloudflare cria sozinha um CNAME `jogo` → `<uuid>.cfargotunnel.com` e liga a
   nuvenzinha laranja **só nesse subdomínio**; o resto da zona segue cinza.
3. **Servidor, numa worktree separada da pasta onde você edita (recomendado desde 28/09; ver "Atualização
   automática" abaixo do motivo):**
   ```powershell
   git worktree add .tmp\wt-servidor-prod origin/main
   cd .tmp\wt-servidor-prod
   npm ci                      # node_modules PRÓPRIO. Nunca um atalho (junção) para o do projeto: veja "04/10" abaixo
   .\scripts\servidor-windows.ps1
   ```
   O `servidor-windows.ps1` **recusa** rodar na pasta principal ou com `node_modules` em atalho. **Os dados ficam fora da
   worktree (desde 04/10):** a tarefa define `CYBERMECH_DADOS` apontando para `<pasta principal>\.tmp\servidor`
   (`D:\DECEPTICONS\.tmp\servidor`) e é lá que ficam o banco de contas (`contas.db`), os números das métricas
   (`telemetria.json`), o token (`metricas-token.txt`) e o `servidor.log`. A worktree é só código: trocá-la, resetá-la ou
   apagá-la nunca leva o banco. Outra pasta (dentro do projeto, G15): `.\scripts\servidor-windows.ps1 -Dados D:\caminho`.
   PowerShell como administrador. O servidor sobe com o Windows e reinicia se cair. Para o PC não dormir:
   `powercfg /change standby-timeout-ac 0`.
   Sem mexer em nada, o processo escuta só em `127.0.0.1:2567` (o túnel fala daqui): não aparece na rede de
   casa nem em nenhum outro lugar da internet.
   **Reiniciar manualmente** (PowerShell como administrador — `Restart-ScheduledTask` **não existe** no
   módulo `ScheduledTasks`, é sempre parar e começar):
   ```powershell
   Stop-ScheduledTask -TaskName "CYBERMECH servidor"; Start-Sleep 2; Start-ScheduledTask -TaskName "CYBERMECH servidor"
   ```
4. **Site:** no GitHub, Settings → Secrets and variables → Actions → **Variables** (não é segredo) →
   `GAME_SERVER_URL` = `wss://jogo.selvamkt.com.br`. No próximo merge, o site sai com `[ JOGAR ONLINE ]` na landing
   e na pausa do jogo, apontando para o túnel.
5. **Com o PC desligado**, quem clica em online vê "servidor fora do ar" e volta ao jogo offline em 3 s.

### Atualização automática (Claude, 28/09; dono: "tem como o servidor reiniciar sozinho quando for necessário
### ou isso fragiliza ele? como aplicarmos inteligência... e quando eu estiver dormindo?")

**Decisão de arquitetura: puxar, nunca receber.** Em vez de um webhook (o CI chamando um endpoint novo no PC
de casa — mais uma porta escutando a internet, mais superfície de ataque), o próprio PC pergunta ao GitHub de
tempos em tempos se há código novo. Zero portas novas abertas; o `git fetch` é a única saída, e sai pela
mesma internet de sempre.

```powershell
cd .tmp\wt-servidor-prod        # a MESMA worktree do passo 3, não a pasta principal
.\scripts\servidor-atualizar.ps1
```

O que a tarefa "CYBERMECH atualizar" faz a cada 10 min (`scripts\atualizar-e-reiniciar.ps1` →
`scripts\atualizar-servidor.mjs`):
1. `git fetch origin main`; se não avançou, não faz nada (nem escreve no log).
2. Se avançou: `git merge --ff-only`, e **só então** roda o mesmo portão que o CI roda — `npm run typecheck`
   e os testes de `server/` e `shared/` (não a suíte inteira: são os que importam para o processo do
   servidor, e rodam em segundos).
   **`package-lock.json` mudou?** O atualizador **para o servidor antes do `npm ci`** (o processo mantém aberto o binário
   nativo do rolldown, e no Windows o `npm ci` não apaga arquivo em uso) e só depois reinstala e verifica.
3. **Passou:** (re)liga o "CYBERMECH servidor" — agora com o código novo.
4. **Falhou:** `git reset --hard` para o commit anterior. Sem mudança nas dependências, **o servidor que já está no
   ar nunca é tocado**. Com mudança, o atualizador também refaz as dependências do código antigo e **religa** o servidor
   que ele mesmo parou. Ninguém percebe que uma atualização quebrada existiu, exceto no log.
   Ele **recusa** rodar se `node_modules` for um atalho para outra pasta (teste: `server/atualizador.test.ts`).

**Por que uma worktree separada, e não a pasta onde você mexe no código (G15 + segurança):** um `git reset
--hard` automático rodando na sua pasta de trabalho apagaria qualquer edição sua não commitada, um dia
qualquer, sem aviso. O script **recusa rodar** fora de uma worktree — testado, não só documentado.

**Enquanto você dorme:** o log (`.tmp\servidor\atualizacao.log`, na worktree) registra cada atualização
tentada, cada rollback e o motivo. `main.ts` já imprime salas/jogadores/tick a cada 10 s no
`.tmp\servidor\servidor.log` de sempre — os dois logs juntos contam a história completa da noite.

**Para desligar** (voltar a atualizar só manualmente): `.\scripts\servidor-atualizar.ps1 -Remover`, de
dentro da worktree.

### 04/10: o servidor estava desatualizado, e o atualizador apagou a node_modules de todo mundo (Claude)

**O que aconteceu:** a tarefa "CYBERMECH atualizar" **nunca foi registrada** (o `Register-ScheduledTask` falhava com
`P99999999DT23H59M59S` fora do intervalo e o script dizia "Pronto" mesmo assim), e a tarefa "CYBERMECH servidor" rodava da
**pasta principal** do projeto, não da worktree dedicada: o servidor ficou no protocolo 1 enquanto o site passou ao 2 (online
recusado com "versão diferente"). Ao rodar a atualização à mão, o `npm ci` passou pela **junção** `wt-servidor-prod\node_modules`
→ `node_modules` do projeto, que todas as worktrees compartilham, apagou quase tudo e parou em EPERM no binário do rolldown que o
próprio servidor mantém aberto. O servidor no ar sobreviveu (tudo já estava na memória), mas não reiniciaria.
**O que mudou no código:** o gatilho da tarefa usa 10 anos em vez de `TimeSpan.MaxValue`, e o registro confere se a tarefa existe;
o atualizador recusa `node_modules` em atalho e para o servidor antes do `npm ci`; `servidor-windows.ps1` recusa a pasta principal e
o atalho; os `.ps1` ganharam BOM (acentos saíam quebrados no Windows PowerShell 5.1).
**Recuperar o PC do servidor (PowerShell como administrador):**
```powershell
Stop-ScheduledTask -TaskName "CYBERMECH servidor"           # solta o binário travado
cd D:\DECEPTICONS\.tmp\wt-servidor-prod
cmd /c rmdir node_modules                                   # remove só o atalho (a junção), não o conteúdo de lá
git fetch origin; git reset --hard origin/main              # a worktree do servidor é descartável
npm ci                                                      # node_modules próprio do servidor
.\scripts\servidor-windows.ps1                             # re-registra o servidor apontando PARA ESTA pasta (código) e para D:\DECEPTICONS\.tmp\servidor (dados) e liga
.\scripts\servidor-atualizar.ps1                           # registra a atualização automática (a cada 10 min)
cd D:\DECEPTICONS; npm ci                                   # conserta a node_modules do projeto (as outras worktrees usam)
```
O `contas.db` **não precisa ser copiado**: já está em `D:\DECEPTICONS\.tmp\servidor\`, que é a pasta de dados. O token das métricas aparece
em `D:\DECEPTICONS\.tmp\servidor\metricas-token.txt` quando o servidor novo sobe (o `servidor.log` da mesma pasta diz o caminho).
Conferir: `Invoke-RestMethod https://jogo.selvamkt.com.br/status` deve mostrar `protocol: 3` (ou o que `PROTOCOL_VERSION` de `shared/net/constants.ts` disser); e `Get-ScheduledTask | ? TaskName -like 'CYBERMECH*'`
deve listar as duas tarefas.

### 09/10: a atualização automática nunca reiniciava o servidor de verdade (Claude)

**O que acontecia:** a tarefa "CYBERMECH atualizar" buscava o código, verificava (typecheck + testes) e fazia `Stop-ScheduledTask` + `Start-ScheduledTask`. O `Stop` mata só o `cmd.exe` da tarefa: o `node` filho fica **órfão**, segurando a porta 2567, e **só PowerShell como administrador o encerra** (o processo roda numa sessão própria da tarefa e nega acesso até ao mesmo usuário). O servidor novo subia, achava a porta ocupada e a tarefa terminava com resultado 1; o velho seguia no ar. Sintoma: `/status` com `protocol` e `uptimeS` que não mudam depois de "OK: … verificado, pedindo reinício" no `atualizacao.log`. O mesmo órfão faria o `npm ci` dar EPERM no binário em uso.
**O conserto:** o servidor se encerra sozinho. `server/parada.ts` vigia o arquivo `parar.flag` na pasta de dados (`CYBERMECH_DADOS`); ao vê-lo o servidor apaga o arquivo, salva os números e sai (código 0; saída forçada em 8 s se travar). `scripts/parar-servidor.ps1` cria o arquivo, espera a porta liberar (até 25 s) e só então devolve 0; encerrar à força é o último recurso e só funciona como administrador. A atualização usa esse script para o reinício e antes do `npm ci` (que **recusa** se o servidor não parou), confere o `/status` depois de religar e registra no `atualizacao.log`. Um reinício que não deu deixa o marcador `.tmp\wt-servidor-prod\.tmp\servidor\reinicio-pendente`: a próxima rodada (10 min) tenta de novo, e o aviso sai uma vez só.
**Religar logo depois de parar falha (medido em 09/10, derrubou a produção por uns 4 min):** o `cmd.exe` da tarefa ainda leva um instante para terminar; o `Start-ScheduledTask` nesse instante cria uma instância que morre na hora, com resultado 1 e **sem escrever nada no log**. Por isso `parar-servidor.ps1` só devolve com a tarefa de fato parada (+ folga de 3 s) e `scripts/ligar-servidor.ps1` liga, **confere o `/status`** e tenta de novo (até 3 vezes). Provado em produção, sem administrador: 3 ciclos de parar + ligar, 16–19 s fora do ar cada, `uptimeS` zerando. **Reinício à mão a qualquer hora (sem administrador):** `.\scripts\parar-servidor.ps1; .\scripts\ligar-servidor.ps1`.
**Uma vez, à mão (só para um servidor de antes da vigia; já feito em 09/10):** PowerShell **como administrador**: `Get-NetTCPConnection -LocalPort 2567 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`, depois `Start-ScheduledTask -TaskName "CYBERMECH servidor"`. Dali em diante o reinício é automático. **Parar o servidor à mão a qualquer hora:** `.\scripts\parar-servidor.ps1` (sem administrador, se o servidor tem a vigia).

**Rodada cortada e servidor caído (09/10, depois de ver um ciclo completo levar 4 min 17 s com a máquina ocupada):** o limite de execução da tarefa "CYBERMECH atualizar" no registro atual é de **5 min**; se o Agendador a cortasse depois de parar o servidor e antes de religar, o servidor ficaria parado sem ninguém tentar de novo. Agora o marcador `reinicio-pendente` nasce **antes** de parar (some só quando o `/status` responde) e a rodada de 10 min, quando não há nada novo e nada pendente, **liga o servidor se ele não responder** (vigia; não toca em servidor que responde). Testado em produção nos três caminhos (saudável intocado; caído religado; pendente parado e religado). `servidor-atualizar.ps1` passa a registrar o limite em **20 min**: para aplicar no PC, uma vez, PowerShell como administrador: `.\scripts\servidor-atualizar.ps1` (opcional; o marcador e a vigia já cobrem o corte).

**Rodada cortada no meio da verificação (09/10, noite): o código ficava em disco e o servidor no velho.** O marcador `reinicio-pendente` só nasce depois da verificação, então uma rodada cortada antes dela deixava a seguinte ver "nada novo". Agora o atualizador grava `.tmp\wt-servidor-prod\.tmp\servidor\verificacao-pendente.json` (`de`, `para`, `feito`) assim que puxa o código e **retoma de onde parou** na rodada seguinte (o typecheck que passou não se repete); falhou, volta para `de`. Para saber se há verificação pela metade: esse arquivo existe, e o `atualizacao.log` mostra "retomando a verificação cortada". Reinício à mão (0 jogadores): `.\scripts\parar-servidor.ps1`; se disser "a porta continua ocupada", **confira a porta de novo antes de concluir** (sob falta de memória o servidor leva mais de 100 s para sair) e só então `.\scripts\ligar-servidor.ps1`. Vigiar o servidor: uma consulta ao `/status` por minuto, nunca a cada poucos segundos.

### 17/10: a verificação do atualizador reprovava "no escuro" e o servidor ficou 2,5 h no código velho (Claude)

**O que aconteceu:** depois dos merges das contas (#371) e do idioma (#372), o `atualizacao.log` registrou **seis** `FALHOU (testes de server/ e shared/) — voltando para ce46b79` (duas delas com 12 s de diferença: duas rodadas se atropelando em `.tmp/vitest`), e a produção seguiu no código velho. Os mesmos testes (`node scripts/test.mjs run --no-isolate server shared`) passavam na worktree de desenvolvimento. Na primeira rodada **em silêncio** (sem `npm run check`, sem navegador na máquina) a verificação passou em **40 s** e o servidor religou no código novo em 1 min (protocolo 20; a primeira cópia do banco de contas apareceu em `backups\`).

**Causa:** concorrência de CPU e de pasta com o trabalho dos agentes na mesma máquina, não código quebrado. **O que ficou ruim:** o `executar` do atualizador usava `stdio: 'inherit'`, então a saída do teste que falhou ia para o console da tarefa agendada e **se perdia**: o log dizia que falhou, não qual teste.

**O que mudou:** `scripts/atualizar-servidor.mjs` agora captura a saída e, quando um comando falha, grava no `atualizacao.log` **as últimas 40 linhas** dele (`ultimasLinhas`, com teste). **Regra de operação:** depois de cada merge, **ficar quieto** (sem `npm run check`, sem suíte, sem captura de navegador) até o log mostrar `servidor religou no código novo`.

### Contas de piloto (login, Claude 28/09 — só o esqueleto: criar conta, entrar, sair)

**Banco:** SQLite embutido do Node (`node:sqlite`, sem dependência nova — depois da dor do dia com o binário
nativo do `@rolldown`, evitar mais um binário nativo como `better-sqlite3` foi a decisão certa). Arquivo em
`contas.db` na pasta de dados (`CYBERMECH_DADOS`; padrão `.tmp/servidor/` ao lado do código, e em produção
`D:\DECEPTICONS\.tmp\servidor\`, fora da worktree do servidor desde 04/10), ao lado do log de sempre: **gitignored,
sobrevive à atualização automática** (que só mexe em arquivos versionados), ao `git reset --hard` de um rollback e a
trocar ou apagar a worktree.
**Requisito:** Node **22.12 ou mais novo** (`node:sqlite` não existe no Node 20) — o `package.json` só aceita
essa faixa agora; quem tinha Node 20 no PC do servidor precisa atualizar.
**Senha:** nunca em texto — `scrypt` com sal por conta (`node:crypto`, também sem dependência nova).
**Sessão:** token aleatório de 32 bytes que o cliente guarda; o banco só grava o hash SHA-256 dele — um
vazamento do arquivo `contas.db` não dá sessão utilizável a ninguém. 30 dias de validade.
**Tentativas:** `/conta/entrar` e `/conta/criar` dividem uma régua de 8 tentativas a cada 10 min por IP
(`server/login.ts`), separada do `Guard` do WebSocket e do balde da `Telemetria` — o risco aqui é diferente
(alguém testando senha).
**Rotas** (mesmo processo HTTP do `/status` e do `/evento`): `POST /conta/criar`, `POST /conta/entrar`
(devolvem `{token, email}`), `POST /conta/sair` e `GET /conta/eu` (cabeçalho `x-cybermech-sessao`). Contrato
em `shared/net/auth.ts`.
**Tela e progresso (17/10, P174):** a tela de criar conta e entrar (`ui/LoginPanel.ts`, `ui/ContaSettings.ts`) e a sincronização do progresso (`POST /conta/progresso`, `net/progressoLocal.ts`: nível, XP, créditos e apelido; vale o maior nível/XP) estão no ar.

#### Contas: onde estão, o que guardam e como restaurar (17/10)

**Não há Supabase nem serviço de nuvem para o jogo** (decisão do dono, 28/09: gratuito, sem serviço novo). As contas moram **num arquivo SQLite no PC do servidor**:

| O quê | Onde |
|---|---|
| O banco (contas, sessões, progresso) | `D:\DECEPTICONS\.tmp\servidor\contas.db` (a pasta é a `CYBERMECH_DADOS` da tarefa do Windows) |
| As cópias de segurança | `D:\DECEPTICONS\.tmp\servidor\backups\contas-AAAA-MM-DD.db` (uma por dia, as últimas 14; feitas pelo servidor ao subir e a cada 6 h, `server/backupContas.ts`) |
| O código que lê e escreve | `server/contas.ts` (o único lugar com SQL), as rotas em `server/Server.ts`, o contrato em `shared/net/auth.ts` |
| O que o jogador guarda no aparelho | só o **token da sessão** (`localStorage`, chave por servidor); o progresso local é copiado para a conta e vice-versa |

**O que o banco guarda:** e-mail, **hash `scrypt` da senha** (nunca a senha), o **hash** do token de cada sessão (nunca o token) e o JSON do progresso. Um vazamento do arquivo não dá senha nem sessão a ninguém, mas **traz os e-mails** (dado pessoal: LGPD).

**O que protege e o que NÃO protege (R13):** a cópia diária protege de arquivo **corrompido ou apagado por engano** e de uma atualização que quebre o banco. **Não protege de o disco do PC morrer ou de o PC ser perdido:** a regra G15 (nada fora da pasta do projeto) mantém as cópias no mesmo disco. **Decisão do dono, em aberto:** levar a pasta `backups\` para outro lugar de tempos em tempos (um pen drive, ou a nuvem pessoal dele): é um `Copy-Item` de arquivos de ~40 KB.

**Restaurar** (o servidor precisa estar parado: o `scripts\parar-servidor.ps1` da pasta de dados, ou a tarefa do Windows parada):
1. `Copy-Item D:\DECEPTICONS\.tmp\servidor\backups\contas-AAAA-MM-DD.db D:\DECEPTICONS\.tmp\servidor\contas.db -Force`
2. Subir o servidor de novo; o `servidor.log` diz `cópia de segurança das contas: …` quando ele faz a primeira cópia nova.
3. Conferir com um login (a sessão de quem já estava logado continua valendo se ela existia na cópia).

**Conferir quantas contas existem sem expor e-mail:** `node --no-warnings -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('D:/DECEPTICONS/.tmp/servidor/contas.db',{readOnly:true});console.log(d.prepare('SELECT COUNT(*) n FROM contas').get())"` (em 17/10 havia **1 conta**, criada às 13:12, de teste).

### Servidor no mesmo domínio (proteção entre os dois projetos)

Cliente e servidor moram na mesma zona; as proteções abaixo garantem que um não derruba o outro:

- **Nuvem cinza no site, laranja só no `jogo.`:** a Cloudflare não passa por dentro do site da Selva MKT. Se um dia
  a Cloudflare cair inteira, o site continua no ar pelo Hostinger; se o servidor de jogo cair, o site também.
- **CSP do site já libera `wss:` para o `connect-src`:** o site chama o `jogo.` pelo túnel, e nada mais.
- **Servidor escuta em `127.0.0.1`:** o `main.ts` traz `HOST=127.0.0.1` como padrão. Ninguém alcança o processo do
  jogo pela rede de casa nem pela internet sem passar pelo túnel. Precisa expor à LAN para um playtest? `HOST=0.0.0.0`
  na chamada do `npm run server` (ou da tarefa do Windows).
- **Porteira do servidor (`server/guard.ts`):** teto de 4 conexões abertas por IP, 400 no total, 60 mensagens/s por
  conexão (com folga de 30 para picos). Excesso fecha com códigos de aplicação (`4013` = tente mais tarde, `4008` =
  taxa alta demais) e o contador aparece no log de 10 s. O IP real do jogador vem do cabeçalho `cf-connecting-ip` da
  Cloudflare **só quando** o soquete direto é o localhost (o túnel): um cabeçalho vindo de outra máquina não engana
  a porteira (G7).
- **Serviço isolado:** o `scripts/servidor-windows.ps1` sobe como usuário limitado (S4U), sem senha guardada, e grava
  log só em `.tmp/servidor/` (G15). Nada fora da pasta do projeto.
- **Métricas de produto (`GET /eventos/resumo`, `POST /evento`, `server/telemetria.ts`):** contrato em
  `shared/net/telemetry.ts`. Lista fechada de 9 nomes de evento — qualquer outro nome recusa com 400, então
  ninguém injeta contagem inventada no painel. Corpo maior que 256 bytes recusa com 413 sem terminar de ler.
  Cada IP tem um balde de 30 eventos, recarregando 0,5/s — próprio, separado do `Guard` do WebSocket. A
  resposta do resumo é só números agregados por evento (últimas 24h e desde que o servidor subiu): nenhum
  evento cru, nenhum IP, nenhuma sala. Sem cookie e sem id persistente entre sessões.
- **Origem das conexões e métricas privadas (04/10; `GET /metricas`, `/cybermech/metricas/`):** o país de quem chega
  vem do cabeçalho `CF-IPCountry` que a Cloudflare põe no túnel — **só vale quando o soquete direto é o localhost**
  (`clientCountry` em `server/guard.ts`), então um cabeçalho inventado por outra máquina não enche a tabela de países
  falsos. Sem túnel (rodando local) tudo cai em `??` (Desconhecido). Só o **país** (nunca IP, nunca cidade) e só
  **contagens por dia (fuso de Brasília), evento e país**: o arquivo `.tmp/servidor/telemetria.json` não tem nada que
  identifique ninguém e guarda até 120 dias; o servidor grava a cada 60 s se mudou e ao fechar, então os números
  sobrevivem ao reinício e à atualização automática. Além dos 9 eventos do navegador, o servidor conta sozinho
  `conexao_online`, `entrou_na_sala` e as recusas (`recusa_versao`, `recusa_cheia`, `recusa_montagem`,
  `recusa_mensagem`, `recusa_limite`), mais o **pico de jogadores** do dia: é daí que vem o "o servidor precisa
  atualizar" quando `recusa_versao` sobe. O `GET /eventos/resumo` público continua **sem país nenhum**.
  - **Token do dono:** o detalhe só sai com o cabeçalho `x-cybermech-metricas`. O servidor gera um token forte na
    primeira subida e guarda em `metricas-token.txt` na pasta de dados (`CYBERMECH_DADOS`; em produção `D:\DECEPTICONS\.tmp\servidor\`; ou use a variável `CYBERMECH_METRICAS_TOKEN`,
    com 16+ caracteres). Sem token e sem pasta de dados a rota nem existe (404). Compara em tempo constante e corta a
    força bruta: 30 tentativas por 10 min por IP (429, até para o token certo).
  - **A página:** `https://cybermech.online/metricas/` (sem link em menu nenhum, `noindex`, sem Google
    Analytics). Cole o token uma vez; ele fica só naquele navegador e **só para aquele servidor** (um link com
    `?servidor=` apontando para outro lugar nunca recebe o token guardado). Mostra hoje/7 dias, o funil, 14 dias e a
    tabela de países dos últimos 30 dias. **O arquivo fica na pasta de dados** (`CYBERMECH_DADOS`), junto do `contas.db`: em produção, `D:\DECEPTICONS\.tmp\servidor\metricas-token.txt` (até 04/10 ele ficava na pasta de onde o código roda; a pasta de dados foi separada do código). O log (`servidor.log`) diz o caminho exato na subida ("métricas privadas ligadas: o token está em …"), sem escrever o token. Só existe depois que o servidor **novo** subir pela primeira vez.
  - **Cidade, aparelho, tempo no site e de onde veio o clique** não são contados pelo nosso servidor (decisão de
    privacidade): estão no Google Analytics, que já está nas páginas (`analytics.google.com` → Relatórios → Público).
  - **Suposição a conferir no dia:** o `CF-IPCountry` só chega se a Cloudflare estiver à frente do túnel (é o caso do
    `jogo.selvamkt.com.br`); confira que `IP Geolocation` está ligada. Se a coluna "Desconhecido"
    ficar com quase tudo, é aqui que se olha (Cloudflare → Network → IP Geolocation).
- **Painel do servidor (12/10, P93; `/admin/*`, monitor COMANDO → SERVIDOR do jogo com `?comandante=1`):** o mesmo token das métricas (`x-cybermech-metricas`), as mesmas regras (sem token configurado a porta nem existe: 404; compara em tempo constante) e uma régua própria, mais dura: **10 erros de token por IP em 10 min → 429**, até para o token certo (quem acerta não gasta a régua). Rotas: `GET /admin/estado` (selo, versão do código, uptime, se está sob a tarefa, salas, contas, tráfego), `/admin/historico` (uma hora, 720 amostras de 5 s: jogadores, salas, tick da pior sala, CPU, memória, atraso do laço, rede), `/admin/log` (o fim do `servidor.log`, ou o que o servidor escreveu desde que subiu), `/admin/avaliar` (veredito e capacidade estimada); `POST /admin/testar` (409 com gente jogando), `/admin/sala/fechar` e `/admin/reiniciar` (409 com gente jogando, a menos que o corpo traga `{"confirmar":true}`). O **reinício solta um ajudante e sai com o código 75**: o **Agendador NÃO religa quem sai com código ≠ 0** (provado em produção em 12/10: a tarefa ficou "Ready", resultado 75), então o servidor cria, **pelo WMI** (`Win32_Process.Create`: um `spawn` do PowerShell morre com o pai ou nem roda), um ajudante (`scripts/religar-servidor.ps1`, via `server/religar.ts`) que espera a porta livre e liga a tarefa pelo `ligar-servidor.ps1` (o mesmo caminho do atualizador); se o WMI falhar, aciona a tarefa do atualizador (`schtasks /Run`), que religa o servidor que não responde, e o vigia dele (a cada 10 min) é a última rede. Cada passo vai para `religar.log` na pasta de dados (o processo do WMI não herda o ambiente: a pasta vai em `-Dados`). **Provado em produção em 12/10 (3ª tentativa, 0 jogadores): o servidor voltou em 16 s.** **Código 0 é parar de verdade** (`parar.flag`). Rodando à mão (sem `CYBERMECH_DADOS`) o painel avisa que reiniciar só desliga. O `/admin/testar` abre uma sala `TESTE-xxxx` com quatro clientes de mentira (fora da telemetria e do `/status`) e mede por 7 s: **nunca rode com gente jogando e nunca durante o reinício pós-merge**. Contrato: `shared/net/admin.ts`; servidor: `server/admin.ts` e `server/autoteste.ts`; o ensaio no navegador (local, em `.tmp/console/`, não versionado) usa um servidor de teste na porta 2999, com a pasta de dados em `.tmp/`, sob um agendador de mentira que o religa quando sai com código ≠ 0.
- **Uma chave só (13/10, P106, "unifique as contas"):** o painel do servidor, o mural de câmeras e as métricas aceitam, no **mesmo cabeçalho** (`x-cybermech-metricas`) e na mesma mensagem do mural, **ou** o token do dono **ou a sessão de uma conta com `is_admin`** (a conta que o Comandante já usa no Hangar). Quem entra como admin no Hangar não cola chave nenhuma: o cliente guarda a sessão no mesmo lugar da chave do dono (e o painel de admin do Hangar reaproveita a sessão guardada, conferida em `/conta/eu`). A sessão errada gasta a **mesma régua** de erros do token (10 por IP em 10 min → 429); conta comum não entra; sessão encerrada em `/conta/sair` deixa de valer; o token do dono continua valendo sem o banco de contas. Sem token do dono, a porta fica aberta **só** para a conta admin (antes, 404).
- **Mural de câmeras (12/10, P88; `ws(s)://servidor/?mural=1`, monitor COMANDO → CÂMERAS AO VIVO):** uma conexão WebSocket própria, **fora das salas** (não ocupa vaga, não entra no `/status` nem na telemetria; passa pelo teto de 4 conexões por IP). A **primeira mensagem** tem de ser o pedido com o token do dono (o mesmo de `/admin/*`, com a **mesma régua de erros**: 10 por IP em 10 min fecham a porta, até para o token certo); em 5 s sem pedido a conexão cai. Fechamentos: `4003` token errado, `4004` IP bloqueado, `4005` servidor sem token configurado (a porta nem existe), `4013` espectadores demais (4). Recebe `MURAL` 4 vezes por segundo, com todas as salas (até 8) e só o que um radar precisa (~0,45 KB/s por sala cheia); sem ninguém assistindo, o servidor não gasta nada (o temporizador nasce com o primeiro espectador). Não sobe o `PROTOCOL_VERSION` (mensagens novas que o cliente de jogo nunca usa). Contrato: `shared/net/mural.ts`; servidor: `server/mural.ts`.
- **Segredos:** o token do túnel fica no serviço do Windows, não no repositório. O `GAME_SERVER_URL` é variável
  pública do GitHub, não segredo.

Complementos que a Cloudflare oferece (todos gratuitos, opcionais): em `jogo.selvamkt.com.br` → Security → WAF →
"Custom rules", uma regra "Block if URI Path not starts with `/`" fecha varreduras óbvias; e um Rate Limit de 20
requisições HTTP/min por IP (o WebSocket depois de ligado não conta) evita bombardeio de handshake.

**O que o PC aguenta:** 0,5 ms de CPU por tick por sala (um núcleo leva ~20 salas); ~50 KB/s de upload por sala cheia
(8 pessoas), longe do limite de uma fibra comum. **Custo:** o domínio e a energia do PC ligado (depende do PC; um
desktop comum gasta algumas dezenas de reais por mês). **Distância:** o servidor fica no Brasil; o seu próprio Mech
responde na hora em qualquer lugar (previsão), mas quem está longe vê os outros e os acertos com mais atraso: América
do Sul ~20–80 ms, EUA ~120–180 ms, Europa ~200–250 ms, Rússia e Ásia ~250–350 ms. A China pode ter bloqueios e
lentidão imprevisíveis na Cloudflare. Quando houver jogadores fora da América do Sul com frequência, um segundo
servidor perto deles resolve (o código é o mesmo).

**Opções avaliadas em 2026-09-23 (sem decisão). Ofertas gratuitas mudam: confira antes de adotar.**
A hospedagem compartilhada da Hostinger **não serve** para o servidor: não mantém um processo Node rodando o tempo todo, e os limites de CPU estrangulariam uma simulação a 60 Hz. VPS da Hostinger funcionaria, mas é pago.

| Opção grátis | Serve para | Ressalvas |
|---|---|---|
| PC de casa / homelab + Cloudflare Tunnel | **playtests** | Grátis, aceita WebSocket, não abre porta nem expõe IP. Só fica no ar com o PC ligado; a latência depende do upload de casa. |
| Oracle Cloud Always Free (ARM Ampere, região São Paulo) | **público, custo zero** | A VM grátis mais forte que existe. Pede cartão, a capacidade ARM costuma faltar, instância ociosa pode ser recolhida. |
| Render (plano free) | demo apenas | Dorme quando ocioso, ~1 min de cold start: inviável para jogo. |
| Fly.io, Railway | — | Sem plano gratuito de verdade hoje. |

**Latência:** para shooter, o servidor precisa ficar perto dos jogadores (Brasil → São Paulo).

---

## HISTÓRICO DE FALHAS

- **2026-09-23, 1º deploy:** o site subiu certo, mas o `.wasm` saía sem compressão (2,2 MB), porque o LiteSpeed não comprime `application/wasm`. Corrigido com o `.wasm.gz` pré-comprimido (ver acima).
- **2026-09-23, configuração:** o dono rodou os comandos `gh secret set` no PowerShell, onde `<` não existe; o bloco inteiro falhou antes de rodar (nada ficou pela metade). Os comandos de secret deste arquivo são para o **Git Bash**.


## Observabilidade e protocolo 5 — 06/10

Erros do cliente publicado usam o endpoint já existente do Serafim13 (sinal-erro), identificado em core/Diagnostics.ts. A CSP permite somente a origem Supabase correspondente; não há credencial no cliente. Aceitação/persistência no serviço central ainda requer verificação operacional. Resumos de partida usam /partida-metricas no servidor do jogo, com fila local limitada e leitura privada em /metricas. Ver OBSERVABILIDADE.md.

O cliente desta entrega usa protocolo 5; servidor anterior será recusado por incompatibilidade. O servidor público está offline por orientação do dono e não deve ser consultado, iniciado ou atualizado nesta tarefa. Publicação do site não comprova funcionamento online.
