# LANÇAMENTO — o caminho mais curto (PROPOSTA de 18/10/2026; aguarda o "ok" do Comandante)

> **Por que este arquivo existe:** o Comandante perguntou (18/10) *"por que as iterações têm sido tão demoradas? [...] será que estou perdendo o foco? [...] quero lançar logo"* (P190). A resposta honesta: o
> projeto tem **190 ordens registradas** e o que impede o lançamento cabe em **seis itens**. Tudo o que não está aqui continua valendo, mas **espera o lançamento**. Quem decide a lista é o Comandante: este é o
> rascunho do Claude. Aprovada, esta página manda na escolha do que fazer a seguir (`AGENTS.md`, Passo Zero 12).

## 1. O que é "lançar"

Abrir `cybermech.online` ao público: **jogo grátis no navegador**, solo (Arena, Bunker, Praia, Amazônia) e **online na Arena**, com **conta opcional** (progresso entre aparelhos) e **política de privacidade**. Sem ranking, sem
times, sem loja. É o que já existe; falta tirar o risco.

## 2. A lista (6 itens; cada um com "pronto quando")

| # | O que | Quem | Pronto quando |
|---|---|---|---|
| 1 | **Servidor fora do PC de trabalho.** Hoje o servidor de jogo roda no PC em que se trabalha (6 GB, ~500 MB livres, CPU a 70% quando se roda teste): foi ele que derrubou as conexões em 17/10. | **Comandante decide onde e quanto custa** (uma VPS, ou um PC dedicado ligado 24 h); Claude prepara a instalação | O servidor roda numa máquina que não é a de trabalho, com túnel e atualização automática, e **dois PCs jogam 30 minutos sem queda** |
| 2 | **Teste com gente de fora.** O online só foi testado por dois PCs do Comandante. | Comandante convida 5 a 10 pessoas; Claude olha as métricas (`/metricas/`) e o log | Três sessões de ~30 min, sem queda de servidor, e a lista do que as pessoas estranharam |
| 3 | **Política de privacidade revisada.** Entregue em 18/10 (P187), mas é rascunho. | **Comandante** (e, de preferência, um advogado) | Texto revisado, **e-mail do encarregado** em `.decepticons/contato-privacidade.txt`, razão social/CNPJ no texto |
| 4 | **"Esqueci a senha".** Não existe e exige um serviço de e-mail. | **Comandante decide:** contratar o serviço (e o Claude liga), **ou** lançar avisando na tela de criar conta que a senha não se recupera | Uma das duas coisas feita |
| 5 | **Primeira partida em 1 minuto.** Landing → jogar → primeira partida, com quem nunca viu o jogo. | Claude arruma o que as 3 primeiras pessoas do item 2 estranharem | 3 pessoas novas jogando a primeira partida **sem perguntar nada** |
| 6 | **Plano dos 7 primeiros dias, medido.** Onde divulgar, com links marcados (`?utm_source=...`), e a meta de cada número do `/metricas/`. | Comandante escolhe os canais; Claude gera os links e a meta | Uma tabela: canal, link, meta de visitas, meta de "voltou no dia seguinte" (D1) e de minutos por piloto |

**Ordem:** 1 e 3 e 4 podem andar juntos (são decisões do Comandante); 2 só depois do 1; 5 sai do 2; 6 antes de divulgar.

## 3. Fora do lançamento (congelado até o "ok" do Comandante)

Times na sala online (P81) e os lados Aliados × Consórcio (P186) · **o painel único** (P189; já existe em partes, ver abaixo) · Google Analytics dentro do `/metricas/` (P188; exige chave do Google) · ranking · jogador remoto com o
chassi dele · Estúdio de tiros e armas e de Mechs 3D · as 72 falas de voz · novos mapas, chefes e armas · tradução da política.

**A Amazônia (P180) tem dono em outra sessão** e segue por lá: não bloqueia nem é bloqueada por esta lista.

## 4. O painel que o Comandante descreveu (P189): o que já existe

Pedido pela primeira vez em 10/10 (P54, `PAINEL_ADMIN.md`). **Existe em partes:** o **modo Comandante** (`?comandante=1`: Potências, Mesa de vídeo, Sala de controle, Oficina, Servidor com token), o **Estúdio** (`npm run estudio`:
sons e vozes prontos; tiros e armas e Mechs 3D só desenhados), o **Hangar**, as **Configurações** e o painel do servidor. **Falta:** a aba de tiros e armas do Estúdio e a ficha de cada bot. **Recomendação:** não construir um painel
único agora (é o maior desvio possível do caminho de lançamento); quando for a hora, **a ordem é: aba de tiros e armas, depois a ficha dos bots**.

## 5. Como o trabalho passa a andar (proposta)

1. **Uma ordem por vez**, cada uma com "pronto quando" (como na tabela). Mensagens com várias ordens viram uma fila numerada e eu faço a primeira.
2. **Pista rápida:** mudança sem risco (texto, visual, documentação) sai **sem mutação à mão e sem prova ponta a ponta no Chrome**, só com o teste de sempre e o `npm run check`. A mutação e a prova no navegador ficam para conta,
   rede, dado pessoal e dinheiro (onde errar custa caro). Nesta rodada, só a mutação passou de 70 minutos.
3. **Menos custo de leitura por conversa:** arquivar o que é antigo do `ESTADO_ATUAL.md` (3.001 linhas), do `HISTORICO_DE_DECISOES.md` (3.764) e da `ORDENS_DO_COMANDO.md` (320 linhas) em `.decepticons/arquivo/`, mantendo o
   recente. É o maior custo fixo de cada sessão. (Limpeza de documentação já autorizada pelo Comandante em 14/10.)
4. **Um PR por entrega, e o PR diz "isto está no ar / isto ainda não".** O dono confere no site, não no chat.
5. **O PC:** enquanto o item 1 não sai, **avisar quando for jogar** (os testes e o `npm run check` usam todo o processador e a memória) e **não trocar a VPN do PC do servidor com gente jogando**.
