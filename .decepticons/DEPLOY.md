# DEPLOY — Cyber-Mech Protocol

> Fonte canônica de infraestrutura (R8). Leia antes de mexer em build, CI ou hospedagem.

---

## ESTADO: NÃO HÁ DEPLOY

- Nenhum ambiente publicado. Nenhum servidor, domínio, FTP ou repositório remoto.
- **Não invente caminho, host ou secret.** Se uma tarefa precisar de deploy, pare e peça a decisão ao dono (ver pendências em `ESTADO_ATUAL.md`).

---

## REQUISITOS JÁ CONHECIDOS (para quando houver deploy)

**Cliente (estático, `dist/`):**
- Servir `.wasm` com `Content-Type: application/wasm`, senão o browser não compila em streaming.
- Compressão gzip ou brotli em `.js` e `.wasm` (o Wasm cai de 2,2 MB para ~720 KB).
- `assets/*` têm hash no nome: `Cache-Control: public, max-age=31536000, immutable`. `index.html`: `no-cache`.
- Headers de segurança do Protocolo (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`). A CSP precisa de `'wasm-unsafe-eval'` em `script-src`, senão o Rapier não instancia.

**Servidor de jogo (Colyseus, planejado):**
- Precisa de host com WebSocket persistente e processo Node longo. Hospedagem só estática ou FTP não serve.
- Node `^20.19.0 || >=22.12.0`.

---

## OPÇÕES DE HOSPEDAGEM AVALIADAS (2026-09-23, sem decisão)

> Ofertas gratuitas mudam. Confira as condições atuais antes de adotar.

**Cliente (estático):** a **Hostinger atual serve**, com o mesmo pipeline do serafim13 (GitHub Actions → FTP-Deploy-Action). Precisa de `.htaccess` com `AddType application/wasm .wasm` e compressão (`mod_deflate`). Custo extra: zero. Alternativas grátis: Cloudflare Pages, ou o próprio portal de jogos, se esse for o modelo.

**Servidor de jogo (Colyseus, 60 Hz, WebSocket):** a hospedagem compartilhada da Hostinger **não serve**. Ela não mantém um processo Node rodando o tempo todo, e os limites de CPU do plano compartilhado estrangulariam uma simulação a 60 Hz. VPS da Hostinger funcionaria, mas é pago.

| Opção grátis | Serve para | Ressalvas |
|---|---|---|
| PC de casa / homelab + Cloudflare Tunnel | **playtests** | Grátis, aceita WebSocket, não abre porta nem expõe IP. Só fica no ar com o PC ligado; a latência depende do upload de casa. O serafim13 já desenhou o mesmo padrão (`cloudflared` → subdomínio). |
| Oracle Cloud Always Free (ARM Ampere, região São Paulo) | **público, custo zero** | A VM grátis mais forte que existe. Pede cartão na verificação, a capacidade ARM costuma faltar nas regiões populares, e instância ociosa pode ser recolhida. |
| Render (plano free) | demo apenas | Dorme quando fica ocioso, com ~1 min de cold start: inviável para jogo. |
| Fly.io, Railway | — | Sem plano gratuito de verdade hoje (só crédito de teste). |

**Latência:** para shooter, o servidor precisa ficar perto dos jogadores (Brasil → São Paulo).

---

## HISTÓRICO DE FALHAS

Nenhuma até agora.
