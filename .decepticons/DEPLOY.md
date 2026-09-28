# DEPLOY — CYBERMECH

> Fonte canônica de infraestrutura (R8). Leia antes de mexer em build, CI ou hospedagem.

---

## SITE DO PROJETO (cliente estático)

**Endereço:** `https://www.selvamkt.com.br/cybermech/` (decisão do dono em 2026-09-23: caminho `/cybermech`, **público**).
- `/cybermech/`: landing do jogo, para quem vai jogar (`scripts/landing.mjs`; os destaques vêm da seção VITRINE do `GAME_DESIGN.md`).
- `/cybermech/sala-de-controle/`: o case do desenvolvimento (`scripts/painel.mjs --site`; até 25/09 era `/bastidores/`, que agora leva para lá): equipe, fluxo, protocolo, evolução, mapa da campanha, frentes, diário e entregas.
- `/cybermech/jogar/`: o jogo (build do Vite com `base: './'`, funciona em qualquer subpasta).
- `/cybermech/capturas/`: três imagens do jogo feitas pelo próprio deploy (`site.mjs --capturas`): entra no build headless, joga ~20 s e fotografa as três câmeras. Viram a capa da landing e a prévia do link (og:image). Se falharem, a landing sai sem imagens e o log avisa.
- **O que vai a público (decisão do dono em 24/09: bastidores às claras):** as páginas são geradas, nenhum documento interno vai inteiro. Dos bastidores saem só os títulos do `HISTORICO`, a divisão de trabalho e as pendências por pessoa do `ESTADO_ATUAL`, o `ROADMAP` e números do git e dos PRs. Nunca secrets, host, usuário ou caminho do servidor. O `--check` reprova o codinome interno em qualquer página pública.
- **Dados das páginas** (`scripts/site/dados.mjs`): a lista de PRs vem do GitHub (`gh` com `GH_TOKEN` no CI, permissão `pull-requests: read`); sem acesso, cai para o git. A evolução lê cada merge da `main` com `git grep`, por isso o checkout do CI é com `fetch-depth: 0`.
- **Nunca na raiz do domínio:** a raiz do `selvamkt.com.br` é o site real da Selva MKT. O CAPTIA já fica em `/captia/` na mesma conta.
- **Nome:** `cybermech`, nunca `decepticons` (marca da Hasbro; ver `IDENTITY.md`).

**Como vai ao ar ("build do dia"):** cada merge na `main` com o `check` verde dispara o job `deploy` do `.github/workflows/ci.yml`:
`npm run site -- --capturas` (monta `.tmp/site/` e fotografa o jogo) → rsync por SSH para a Hostinger → `node scripts/site.mjs --verify <SITE_URL>`.
- Mesmo padrão do deploy do CAPTIA nesta conta Hostinger: SSH na **porta 65002**, **5 tentativas** com espera crescente (a proteção anti-abuso da Hostinger às vezes derruba a conexão do runner).
- **Trava de segurança:** o `rsync --delete` apaga no servidor o que não existe localmente. O job se recusa a rodar se `DEPLOY_PATH` não terminar em `/public_html/cybermech/`, para nunca apagar o site real.
- **Verificação:** landing, `/oficina/`, `/sala-de-controle/` (e `/bastidores/` levando para ela) e `/jogar/` com o conteúdo certo (o servidor responde 200 até para arquivo inexistente), doctype e `<meta charset>` no início, a CSP aplicada e o `.wasm` servido como `application/wasm` e comprimido; capa ausente só avisa. Se a Cloudflare desafiar o IP do runner, o job avisa e não falha (conferir no navegador).

**Configuração no GitHub (dono), sem valor nenhum no repositório (R2/R10) nem no chat (R11):**

| Nome | Tipo | Valor |
|---|---|---|
| `SITE_URL` | variável | `https://www.selvamkt.com.br/cybermech/`: liga o job de deploy |
| `DEPLOY_HOST` | secret | o mesmo host SSH do CAPTIA (hPanel → Acesso SSH) |
| `DEPLOY_USER` | secret | o mesmo usuário SSH do CAPTIA |
| `DEPLOY_PATH` | secret | `/home/<usuário>/domains/selvamkt.com.br/public_html/cybermech/` |
| `DEPLOY_SSH_KEY` | secret | chave privada de deploy (recomendado: uma chave só deste projeto, com a pública cadastrada no hPanel) |

No Git Bash, `gh secret set` corrompe caminhos (`/home/...` vira `D:/Git/home/...`). Use `MSYS_NO_PATHCONV=1 gh secret set DEPLOY_PATH -R SerafimWeb/decepticons` (lição do CAPTIA).

**Cabeçalhos (`.htaccess` gerado por `scripts/site.mjs`, fonte única também do teste local):**
- `AddType application/wasm .wasm`. O LiteSpeed da Hostinger comprime JS, CSS e HTML sozinho (brotli), **mas não o `.wasm`**: o build gera um `.wasm.gz` (735 KB em vez de 2,2 MB), e o `.htaccess` de `jogar/assets/` entrega essa versão a quem aceita gzip, com `Content-Type: application/wasm` e `Content-Encoding: gzip`. A regra foi testada numa pasta isolada no servidor antes de entrar, e o `--verify` reprova `.wasm` sem compressão.
- CSP com `'wasm-unsafe-eval'` (o Rapier precisa), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- `index.html` sem cache; `jogar/assets/` (nomes com hash) com cache de 1 ano, `immutable`.
- **Sem HSTS:** vale para o domínio inteiro (`selvamkt.com.br`), então é decisão do dono do domínio, não deste projeto.

**Teste antes de ir ao ar:** `npm run site -- --check` (dentro do `npm run check`) serve `.tmp/site/` em `/cybermech/` com **os mesmos cabeçalhos** e abre bastidores, landing → "Entrar no cockpit" → jogo no Chrome headless. Reprova: violação de CSP, recurso faltando, link interno quebrado, página fora de UTF-8 ou em modo quirks, codinome interno.

---

## SERVIDOR DE JOGO (Node + `ws`, M3 em 26/09)

- Precisa de host com WebSocket persistente e processo Node longo. Hospedagem só estática ou FTP não serve.
- Node `^20.19.0 || >=22.12.0`.

**No PC de casa (hoje):**
1. Na pasta do projeto: `npm install` (uma vez) e `npm run server`. Aparece
   `CYBERMECH · servidor de jogo em ws://localhost:2567/?sala=ARENA`. Outra porta: `PORT=3000 npm run server`
   (no PowerShell, `$env:PORT=3000; npm run server`).
2. A cada 10 s o servidor mostra as salas abertas, os jogadores e o tempo médio do tick (meta: até 2 ms).
3. **Rede de casa:** os outros computadores usam `ws://IP-DESTE-PC:2567`. Na primeira vez, o Windows pergunta se
   libera o Node no firewall: libere só para redes privadas.
4. **Pela internet (playtest):** Cloudflare Tunnel, sem abrir porta nem mostrar o IP:
   `cloudflared tunnel --url http://localhost:2567` dá um endereço `https://….trycloudflare.com`; o jogo usa o
   mesmo endereço com `wss://`. O endereço muda a cada vez que o túnel sobe.
5. **Jogar (M4, 26/09):** o endereço do jogo com `?sala=` entra online.
   - No próprio PC do servidor: `https://www.selvamkt.com.br/cybermech/jogar/?sala=ARENA&servidor=ws://localhost:2567&nome=Dan`
     (ou `npm run dev` e `http://localhost:5173/?sala=ARENA`).
   - Pela internet: suba o túnel e todo mundo abre
     `https://www.selvamkt.com.br/cybermech/jogar/?sala=ARENA&servidor=https://….trycloudflare.com&nome=SeuNome`
     (o jogo troca o `https://` por `wss://`).
   - No topo da tela aparece `ONLINE · SALA ARENA · 42 ms · 2 pilotos`. Sem `servidor` fora do PC do servidor, o
     jogo avisa e joga offline.

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
   New-Item -ItemType Junction -Path .tmp\wt-servidor-prod\node_modules -Target node_modules
   cd .tmp\wt-servidor-prod
   .\scripts\servidor-windows.ps1
   ```
   PowerShell como administrador. O servidor sobe com o Windows, reinicia se cair e grava o log em
   `.tmp\servidor\` (dentro da worktree). Para o PC não dormir: `powercfg /change standby-timeout-ac 0`.
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
   servidor, e rodam em segundos). `npm ci` só quando o `package-lock.json` mudou.
3. **Passou:** reinicia o "CYBERMECH servidor" — agora com o código novo.
4. **Falhou:** `git reset --hard` para o commit anterior. **O servidor que já está no ar nunca é tocado** —
   continua rodando o último código bom, do início ao fim; ninguém percebe que uma atualização quebrada
   existiu, exceto no log.

**Por que uma worktree separada, e não a pasta onde você mexe no código (G15 + segurança):** um `git reset
--hard` automático rodando na sua pasta de trabalho apagaria qualquer edição sua não commitada, um dia
qualquer, sem aviso. O script **recusa rodar** fora de uma worktree — testado, não só documentado.

**Enquanto você dorme:** o log (`.tmp\servidor\atualizacao.log`, na worktree) registra cada atualização
tentada, cada rollback e o motivo. `main.ts` já imprime salas/jogadores/tick a cada 10 s no
`.tmp\servidor\servidor.log` de sempre — os dois logs juntos contam a história completa da noite.

**Para desligar** (voltar a atualizar só manualmente): `.\scripts\servidor-atualizar.ps1 -Remover`, de
dentro da worktree.

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
