# RESILIÊNCIA — por que o servidor cai, o que já está fechado e o que falta (21/10/2026, ordem P239)

> **A ordem do Comandante (21/10):** *"sera que temos que fazer auditoria completa do projeto, pra corrigir esse tipo de erros? nao podemos ter defeitos ridiculos … quero ter segurança de que NAO VAMOS QUEBRAR A TOA! e que vamos permanecer funcionando!!!! sem interrupções! o que precisamos instalar ou configurar pra termos essa resiliencia?"*
> Esta página responde com **dados do repositório e dos logs de produção** (não com opinião). Complementa `LANCAMENTO.md` (itens 5 e 8), `AUDITORIA_SEGURANCA.md` (A14) e `DEPLOY.md`.

## 1. O que aconteceu em 21/10 (P238)

O `scripts/server.mjs` fechava o carregador de módulos do Vite assim que subia; o primeiro `import()` de um mapa sob demanda (Praia, Terras Raras, 8 de Janeiro) derrubava o processo, e o servidor só voltava na passada do atualizador (até 10 min). Foi corrigido no PR #436. **O que mais importa não é o bug, é por que ninguém o viu antes do Comandante.**

## 2. Por que o verde mentiu: as lacunas, uma a uma

| # | Lacuna | Evidência | Estado |
|---|---|---|---|
| L1 | **Os testes provavam outro sistema, não o de produção.** O Vitest tem o próprio carregador de módulos; a produção usa o `scripts/server.mjs`. | 859 testes de `server/` e `shared/` verdes com a produção caindo. | **Fechada:** `lancadorDoServidor.test.ts` sobe o processo de verdade; `npm run fumaca` abre uma sala de cada mapa. |
| L2 | **Nenhuma rede de segurança no processo.** Uma promessa que falha sem tratamento mata o servidor de todos. | Não havia `unhandledRejection` em lugar nenhum. | **Fechada (P239):** `server/redeDeSeguranca.ts` registra com a causa e segue; tempestade (mais de 10 em 1 min) sai para religar limpo. |
| L3 | **Religar depois de uma queda leva até 10 min.** O Agendador do Windows não religa quem sai com código ≠ 0 (medido em 12/10, `DEPLOY.md`); quem religa é o atualizador, a cada 10 min. | O atualizador achou o servidor fora do ar 1×, 1×, 2×, 1×, 3×, 4× nos dias 10, 15, 17, 18, 20 e 21/10 (`atualizacao.log`). | **Aberta.** A L2 reduz a chance; a cura é o servidor fora do PC (L7) ou uma vigia de 1 min (depende de como se verifica o código novo, § 4). |
| L4 | **Ninguém avisa que o servidor caiu.** | `AUDITORIA_SEGURANCA.md` A14 e `LANCAMENTO.md` item 5, abertos desde 18/10. | **Aberta, é do Comandante** (§ 4). |
| L5 | **O deploy não confere o que o jogador faz.** Depois de religar, o atualizador só pergunta `/status`. | A sala da Praia derrubava o servidor e o `/status` respondia. | **Parcial:** `npm run fumaca` existe e foi provado no processo de verdade; falta o atualizador rodá-lo e **voltar sozinho ao código anterior** se reprovar (próximo PR). |
| L6 | **O portão do atualizador reprova por carga.** Roda 859 testes numa máquina com ~400 MB de RAM livre. | 104 reprovações para 197 aprovações no log; o mesmo código reprovou às 20:46 e passou às 20:55 em 20/10, e de novo em 21/10. | **Aberta.** Cada reprovação é um deploy atrasado (e, se o servidor caiu, uma queda mais longa). |
| L7 | **A produção roda no PC de trabalho.** Compete com testes, navegadores e agentes. | `LANCAMENTO.md` item 8: "foi ele que derrubou as conexões em 17/10"; `CAPACIDADE.md`: "não certifica disponibilidade nem operação 24/7". | **Aberta, é do Comandante** (§ 4). É a maior. |
| L8 | **O que se afirma "REAL" não distinguia "testado no Vitest" de "testado no processo de verdade".** | O `STATUS_REAL.md` do P218 dizia "REAL no servidor de verdade" e estava errado para três mapas. | **Fechada:** regra nova no `AGENTS.md` (Passo Zero 6): mexeu no servidor, no lançador ou no deploy → `npm run fumaca` contra um servidor de verdade antes de entregar. |

## 3. Dívida técnica: o que os números dizem

- **O código está saudável:** 402 arquivos de código para 351 de teste; 21 `TODO/FIXME/HACK`; 34 usos de `any`/`@ts-ignore`; o maior arquivo é o `Game.ts` (2.476 linhas), seguido de `Match.ts` (1.577). Não há motivo para reescrever nem para uma auditoria linha a linha.
- **A bagunça é de operação:** 56 worktrees, 113 branches locais e 98 remotos acumulados (limpeza barata, regra 15 do `AGENTS.md`); o `npm run check` roda só `tsc` (não há lint). Não é a prioridade: o defeito era uma promessa ignorada de propósito com `void`, que um lint padrão também deixaria passar; o que o pegou foi o teste do processo de verdade.
- **O que a "auditoria completa" certa é:** não é ler tudo; é a **revisão do caminho de operação** (lançador, supervisão, deploy, monitoramento, hospedagem). Este documento é a primeira passada; as lacunas L3 a L7 são o resto.

## 4. O que fazer, em ordem

**Já feito (este PR e o #436):** L1, L2, L8 e metade da L5 (a fumaça).

**Próximo PR (Claude, sem custo):** o atualizador roda a fumaça depois de religar e, se reprovar, **volta ao commit anterior, religa e registra** (e não tenta o mesmo commit de novo até a `main` andar). Isso fecha a L5: um deploy ruim dura segundos, não até alguém avisar. Depois, a L6: tirar do portão do atualizador o que o CI do GitHub e o hook de push já provaram numa máquina limpa, e deixar nele o que só a produção prova (a fumaça).

**Só o Comandante pode (e eu preparo tudo):**
1. **Monitor externo (L4, 10 min, grátis):** um monitor que pergunta `https://jogo.cybermech.online/status` a cada poucos minutos e manda e-mail/celular quando não responde (UptimeRobot ou parecido; exige cadastro, por isso é do dono). Sem isso, a primeira pessoa que descobre a queda é o jogador.
2. **Onde o servidor mora (L3 e L7, a decisão que mais pesa):** `LANCAMENTO.md` item 8. O servidor de jogo precisa de uma máquina que só faça isso (VPS pequena ou um PC dedicado 24 h): reinício automático em segundos (o `systemd` religa um processo que caiu em ~1 s, coisa que o Agendador do Windows não faz), memória só dele, sem teste nem navegador competindo. Eu faço a migração (o túnel e o domínio ficam como estão); o que decide é **quanto custa e quem paga**: confira o preço do plano de VPS na Hostinger, que você já usa para o site. Um especialista de DevOps/SRE só vale por **algumas horas** para revisar a máquina nova (firewall, backups do `contas.db`), não para refazer o projeto.
3. **Rodar `gh auth login -h github.com` no PowerShell** (o token do `gh` está morto: toda chamada avisa e cai na credencial do Git; é só um aviso, mas esconde o dia em que o fallback falhar).

**Antes de lançar em escala (checklist, junto com `LANCAMENTO.md`):** (a) a fumaça verde na produção depois de cada deploy; (b) o monitor externo ligado e testado derrubando o servidor de propósito uma vez; (c) **sete dias seguidos sem queda não planejada** sob o monitor (é isso que "sem interrupções" quer dizer, e só se prova com tempo); (d) um teste de invasão por terceiro (`AUDITORIA_SEGURANCA.md` § 4: a auditoria não viu a Cloudflare, a Hostinger, o Windows do PC); (e) a capacidade homologada (`CAPACIDADE.md`). O que eu **não** posso fazer: o teste de invasão, a revisão jurídica, o playtest com gente de fora e julgar a sensação de jogo.

## 5. Como conferir hoje

- `npm run fumaca` (servidor local) ou `npm run fumaca -- --url https://jogo.cybermech.online --origem https://cybermech.online` (produção; **só com 0 jogadores**: o `/status` mostra). Sai com 1 se algum mapa não abre como devia ou se o processo reiniciou no meio.
- O que ficou registrado de cada queda: `servidor.log` (a pilha do Node), `.tmp/servidor/registro/` (o dia a dia; agora com "rejeição não tratada" e "falha ao abrir a sala X") e, na worktree de produção, `.tmp/servidor/atualizacao.log` (cada deploy e cada reprovação do portão).
