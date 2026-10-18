# LANÇAMENTO — o escopo congelado (18/10/2026, ordens P190 a P194)

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
| 5 | **Analytics e observabilidade** | O que já mede (P185, P188) e o que falta para operar: alerta de servidor fora do ar, erros, capacidade | Claude + **Comandante liga o monitor externo** | O dono é avisado quando o servidor cai (monitor externo gratuito) e o `/metricas` mostra a saúde do servidor |
| 6 | **Governança** | Quem é dono de quê, o que fazer num incidente (LGPD art. 48), como mudar uma regra | Claude escreve; **Comandante aprova** | `GOVERNANCA.md` de uma página |
| 7 | **Mapas do lançamento** | Só CIDADE NEON e ESTAÇÃO DOS CABOS livres; Bunker e TERRAS RARAS "EM BREVE"; "Terras Raras" vira "Terras Raras" | Claude | Um único lugar no código diz quais mapas estão liberados; o seletor, os links e a campanha respeitam; o modo Comandante abre todos |
| 8 | **Servidor fora do PC de trabalho** | O servidor de jogo roda no PC em que se trabalha (6 GB, ~500 MB livres): foi ele que derrubou as conexões em 17/10 | **Comandante decide onde e quanto custa** (uma VPS ou um PC dedicado 24 h); Claude instala | Máquina própria, túnel e atualização automática, **dois PCs jogam 30 minutos sem queda** |
| 9 | **Teste com gente de fora** | O online só foi testado por dois PCs do Comandante | Comandante convida 5 a 10 pessoas; Claude olha as métricas e o log | Três sessões de ~30 min, sem queda de servidor, e a lista do que estranharam |
| 10 | **Política revisada** | Entregue em 18/10 (P187), mas é rascunho | **Comandante** (de preferência com um advogado) | Texto revisado, e-mail do encarregado em `.decepticons/contato-privacidade.txt`, razão social/CNPJ no texto |

**Ordem:** 1 → 2, 3, 4 (a auditoria diz o que corrigir primeiro) → 7 (rápido) → 5 e 6; 8, 9 e 10 são do Comandante e andam em paralelo; o 9 só depois do 8.

## 3. Fora do lançamento (congelado)

Times na sala online (P81) e os lados Aliados × Consórcio (P186) · **o painel único** (P189; já existe em partes, § 4) · Google Analytics dentro do `/metricas/` (P188; exige chave do Google) · ranking · jogador remoto com o chassi dele ·
Estúdio de tiros e armas e de Mechs 3D · as 72 falas de voz · novos mapas, chefes e armas · tradução da política. **A Amazônia/Terras Raras (P180) tem dono em outra sessão** e segue por lá, fechada ao público.

## 4. O painel único (P189): o que já existe

Pedido pela primeira vez em 10/10 (P54, `PAINEL_ADMIN.md`). **Existe em partes:** o **modo Comandante** (`?comandante=1`: Potências, Mesa de vídeo, Sala de controle, Oficina, Servidor com token), o **Estúdio** (`npm run estudio`:
sons e vozes prontos), o **Hangar**, as **Configurações** e o painel do servidor. **Falta:** a aba de tiros e armas do Estúdio e a ficha de cada bot. **Fica para depois do lançamento**; quando for a hora, nessa ordem.

## 5. Como o trabalho anda (ordem do Comandante, 18/10: "mais estratégico e inteligente, mais econômico em tempo e tokens")

1. **Mutação à mão só onde errar custa caro:** autenticação, privilégio, auditoria, dado pessoal, rede. **Visual, texto e documentação: não** (só o teste de sempre e o `npm run check`).
2. **Prova ponta a ponta no Chrome só uma vez por frente**, não por mudança.
3. **Uma ordem por vez**, cada uma com "pronto quando"; mensagem com várias ordens vira uma fila e a primeira anda.
4. **Menos custo de leitura por conversa:** arquivar o que é antigo do `ESTADO_ATUAL.md` (3.000 linhas), do `HISTORICO_DE_DECISOES.md` (3.800) e da `ORDENS_DO_COMANDO.md` em `.decepticons/arquivo/`.
5. **O PC:** enquanto o item 8 não sai, **avisar quando for jogar** e **não trocar a VPN do PC do servidor com gente jogando**.
