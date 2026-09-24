# DEPLOY — Cyber-Mech Protocol

> Fonte canônica de infraestrutura (R8). Leia antes de mexer em build, CI ou hospedagem.

---

## SITE DO PROJETO (cliente estático)

**Endereço:** `https://www.selvamkt.com.br/cybermech/` (decisão do dono em 2026-09-23: caminho `/cybermech`, **público**).
- `/cybermech/`: landing do jogo, para quem vai jogar (`scripts/landing.mjs`; os destaques vêm da seção VITRINE do `GAME_DESIGN.md`).
- `/cybermech/bastidores/`: o case do desenvolvimento (`scripts/painel.mjs --site`): equipe, fluxo, protocolo, evolução, mapa da campanha, frentes, diário e entregas.
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
- **Verificação:** landing, `/bastidores/` e `/jogar/` com o conteúdo certo (o servidor responde 200 até para arquivo inexistente), doctype e `<meta charset>` no início, a CSP aplicada e o `.wasm` servido como `application/wasm` e comprimido; capa ausente só avisa. Se a Cloudflare desafiar o IP do runner, o job avisa e não falha (conferir no navegador).

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

## SERVIDOR DE JOGO (Colyseus, planejado para a Fase 4)

- Precisa de host com WebSocket persistente e processo Node longo. Hospedagem só estática ou FTP não serve.
- Node `^20.19.0 || >=22.12.0`.

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
