# PROTOCOLO SERAFIM UM
## O Sistema Operacional do Desenvolvedor com IA — v4.2

> Este não é um tutorial. Tutoriais ensinam uma coisa.
> Este protocolo define como você pensa sobre qualquer coisa que constrói.
>
> Leia uma vez com atenção. Use como referência por anos.

---

## LEIA ANTES DE TUDO — O QUE VOCÊ ESTÁ RECEBENDO

**Você está recebendo metodologia. Não está recebendo uma licença de marca.**

O que é transferível:
- O sistema de memória (a pasta de arquivos de estado do projeto)
- As 17 regras absolutas de engenharia
- As 23 skills operacionais (Watchdog incluído)
- Os templates prontos para usar
- O WATCHDOG como componente de QA

O que **não é transferível:**
- O nome "Serafim" como identidade do seu produto
- O posicionamento de "cibersegurança Serafim"
- Qualquer implicação de que seu projeto é, representa ou faz parte da Serafim

**Sobre a pasta `.memory/` nos templates:**
Os templates entregues aqui usam `.memory/` como nome padrão — um nome neutro, sem marca.
O nome `.serafim/` é o que usamos **internamente** nos nossos projetos, porque o nosso produto se chama Serafim.
Seu projeto tem o nome do seu projeto. Use isso.

Renomeie para o que fizer sentido: `.memory/`, `.projeto/`, `.nexus/`, o nome do seu app —
o sistema funciona igual com qualquer nome.

---

## O CUSTO DE NÃO TER UM SISTEMA

Antes de qualquer regra, entenda o que está em jogo.

Um dev médio usando IA sem sistema:
- **Gasta 40% do tempo** explicando contexto que deveria ser persistente
- **Refaz 30% do trabalho** porque a IA contradiz decisões anteriores
- **Descobre bugs em produção** que existiam há semanas sem saber
- **Lança e descobre ao vivo** que faltou segurança, analytics, headers

Não é falta de habilidade. É falta de sistema.

```
Com sistema:    IA amplifica disciplina → entrega mais rápido, quebra menos
Sem sistema:    IA amplifica caos      → entrega mais rápido, quebra mais
```

Este protocolo é o sistema. Não é burocracia — é o que permite ir rápido sem destruir o que já foi construído.

---

## FILOSOFIA CENTRAL

Três pilares. Sem nenhum dos três, o sistema colapsa:

**1. Memória persistente** — o projeto tem estado que sobrevive entre sessões, ferramentas e devs

**2. Padrões não-negociáveis** — qualidade não depende de humor, pressa ou se a IA "achou melhor assim"

**3. Design para o negócio** — código que não gera receita ou elimina custo real não merece existir

---

## RITUAL DE SESSÃO (EXECUTE TODA VEZ)

Antes de qualquer código. Sem exceção.

```bash
# INÍCIO DE SESSÃO (30 segundos)
# 1. Abra .memory/ESTADO_ATUAL.md  (ou o nome que você deu à sua pasta de memória)
# 2. Leia o bloco "O QUE ESTÁ PENDENTE"
# 3. Repasse para a IA: "Contexto: [cole o ESTADO_ATUAL]"
# Só então comece.

# FIM DE SESSÃO (2 minutos)
# 1. Atualize ESTADO_ATUAL.md:
#    - O que foi feito nesta sessão
#    - O que está pendente
#    - O que está bloqueado e por quê
# 2. Se tomou decisão relevante → adicione entry no HISTORICO_DE_DECISOES.md
# 3. git commit (o hook verifica se ESTADO_ATUAL foi atualizado)
```

**Por que isso importa:** A próxima sessão começa com contexto real em vez de você gastar 15 minutos explicando o que fez antes.

---

## PARTE I — O SISTEMA DE MEMÓRIA

### O Problema Que Ninguém Fala

Toda sessão de IA começa do zero. O contexto que você construiu ontem — a arquitetura, as decisões, os motivos de cada escolha — evaporou. Você explica de novo. A IA refaz o que já estava feito. Erros se repetem.

Não é um bug da IA. É ausência de sistema de memória.

### A Solução: A Pasta de Memória do Projeto

Todo projeto tem uma **pasta de memória** na raiz — nos templates inclusos ela se chama `.memory/`, mas você renomeia para o que fizer sentido no seu contexto. Seis arquivos (o sexto é obrigatório para projetos com deploy):

```
.memory/                       ← renomeie para: .projeto/, .nexus/, .nome-do-seu-app/
├── PROTOCOLO_UNIVERSAL.md     ← As regras técnicas do projeto
├── IDENTITY.md                ← Alma: nome, propósito, stack, tom, cores, restrições
├── ESTADO_ATUAL.md            ← RAM viva: o que foi feito, o que vem a seguir
├── ROADMAP.md                 ← Fases macro: curto, médio, longo prazo
├── HISTORICO_DE_DECISOES.md   ← Cofre append-only. Decisões, mais recente no topo.
└── DEPLOY.md                  ← ⚠️ NOVO: Infraestrutura canônica. Caminhos, secrets, histórico de falhas.
```

> **Por que o DEPLOY.md?** Em junho/2026, um projeto perdeu 48 horas de trabalho porque o caminho correto do FTP estava documentado no ESTADO_ATUAL.md mas enterrado em 220 linhas. A IA escreveu o caminho errado. O DEPLOY.md resolve isso: é o único lugar que um agente ou humano consulta antes de qualquer mudança em CI/CD.

E na raiz:
```
CLAUDE.md   ← Ativa o protocolo em qualquer IA que lê o diretório
```

### Como Preencher Cada Arquivo

**IDENTITY.md** — responda estas perguntas, uma por linha:
```markdown
# IDENTITY — [Nome do Projeto]
Propósito: [O que resolve e para quem em uma frase]
Stack: [React + Vite + TypeScript + Supabase, por exemplo]
Deploy: [Hostinger via FTP / Vercel / Railway]
Tom: [Técnico e direto / Amigável e casual / etc.]
Restrições: [Sem Node.js server-side / Sem dependências pesadas / etc.]
Secrets: [Onde ficam: .env local + Supabase Vault]
```

**ESTADO_ATUAL.md** — atualizado ao fim de cada sessão:
```markdown
# ESTADO ATUAL — [Data]

## ÚLTIMA SESSÃO FEZ:
- [Item específico implementado]
- [Bug corrigido]

## PENDENTE:
- [ ] [Próxima tarefa com contexto suficiente para retomar]
- [ ] [Outra tarefa]

## BLOQUEIOS:
- [O que está travado e qual informação falta para destravar]

## PRÓXIMA SESSÃO COMEÇA COM:
[Uma frase de ação. Ex: "Implementar o webhook do Stripe e testar com Stripe CLI"]
```

**HISTORICO_DE_DECISOES.md** — entrada nova sempre no topo:
```markdown
## [2026-05-13] Escolha de stack de email
**Decisão:** Usar Resend com domínio verificado, não SMTP direto
**Motivo:** Melhor deliverability, anti-spam mais robusto, API mais simples em Deno
**Alternativas descartadas:** SMTP Hostinger (configuração frágil em Edge Functions)
**Quem decidiu:** [Dev]
```

### As 5 Regras de Ouro da Memória

**[M1] `ESTADO_ATUAL.md` é a Fonte da Verdade.** Se não está lá, não existe como intenção do projeto.

**[M2] `HISTORICO_DE_DECISOES.md` é imutável.** Entradas antigas nunca são editadas. Só novas no topo. É a auditoria permanente do projeto.

**[M3] `IDENTITY.md` separa alma do técnico.** Mudar cliente ou branding = editar um arquivo, não refatorar o projeto inteiro.

**[M4] `ESTADO_ATUAL.md` não pode crescer indefinidamente.** Quando passar de 100 linhas, audite: informação de infra vai para `DEPLOY.md`, decisões técnicas vão para `HISTORICO_DE_DECISOES.md`, o `ESTADO_ATUAL.md` fica com o estado operacional da semana. Um arquivo de 220 linhas é um arquivo que ninguém vai ler por completo — e a IA vai perder informações críticas no meio do texto.

**[M5] Git hook obrigatório — sem memória, sem commit:**
```bash
#!/bin/bash
# .git/hooks/pre-commit — instale a partir de templates/hooks/pre-commit
# AJUSTE a variável MEMORY_DIR para o nome da sua pasta de memória
MEMORY_DIR=".memory"   # ← mude para .seuapp, .projeto, o que você chamou

if ! git diff --cached --name-only | grep -q "${MEMORY_DIR}/ESTADO_ATUAL.md"; then
  LAST=$(git log -1 --format="%ci" -- "${MEMORY_DIR}/ESTADO_ATUAL.md" 2>/dev/null)
  TODAY=$(date +%Y-%m-%d)
  if [[ "$LAST" != *"$TODAY"* ]]; then
    echo "❌ PROTOCOLO VIOLADO: Atualize ${MEMORY_DIR}/ESTADO_ATUAL.md antes de commitar."
    echo "   Edite o arquivo e faça git add ${MEMORY_DIR}/ESTADO_ATUAL.md"
    exit 1
  fi
fi
```

---

## PARTE II — AS 17 REGRAS ABSOLUTAS

Estas regras não têm exceção. Se for quebrá-las, documente o motivo no `HISTORICO_DE_DECISOES.md`. Sem documentação, não é uma decisão consciente — é negligência.

**[R1] SSOT — Single Source of Truth.**
Todo estado do projeto vive na pasta de memória (`.memory/` ou o nome que você escolheu). Rascunhos temporários são permitidos em outros lugares; verdade, nunca.

**[R2] Zero Secrets no Código.**
Nenhuma chave, token ou senha toca um arquivo versionado. Ponto final. Se aparecer em `git status`, o commit não acontece.

**[R3] Unicidade Estrita.**
Proibido `index_v2.html`, `main_bkp.js`, `component_old.tsx`. Versionar é função do Git. Arquivos duplicados são dívida de atenção disfarçada de cautela.

**[R4] TypeScript Strict ou equivalente.**
Zero `any` implícito. Todo input externo validado com Zod na borda de entrada. Se chegou de fora do sistema, é suspeito até prova em contrário.

**[R5] RLS em 100% das tabelas com dados de usuário.**
Se um usuário consegue ver dados de outro por qualquer via, é uma vulnerabilidade — não um bug de UX. Verifique com esta query:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
);
-- Deve retornar zero linhas. Se retornar alguma, é uma falha de segurança aberta.
```

**[R6] Nenhuma migration sem script DOWN.**
Toda mudança de banco tem rollback documentado. `DROP TABLE` sem backup = hora de explicar ao cliente o que aconteceu.

**[R7] Performance Budget.**
LCP < 2.5s. Bundle < 500KB gzipped. Se ultrapassar, justifique no `HISTORICO_DE_DECISOES.md`. Sem justificativa, otimize.

**[R8] Deploy documentado, automatizado e com DEPLOY.md canônico.**
Deploy manual sem documentação não aconteceu oficialmente. Shadow changes são a raiz de 80% dos "funcionou, aí parou de funcionar".

Mas documentação no ESTADO_ATUAL.md não é suficiente — esse arquivo cresce e a informação se perde. **Todo projeto com deploy precisa de um `.memory/DEPLOY.md`** com:
- Caminho exato no servidor (e qual é o caminho ERRADO, com alerta)
- Secrets usados e onde estão configurados (nunca os valores — só os nomes)
- Histórico de falhas passadas com causa e solução
- Comando que funciona, testado, sem variações

O CLAUDE.md do projeto deve listar DEPLOY.md como leitura obrigatória antes de qualquer modificação em CI/CD.

**Failure mode real:** IA escreve caminho de deploy hardcoded baseado em suposição, ignorando documentação existente → 48h de depuração para descobrir que o problema era um `/public_html/` vs `/domains/serafimweb.com/public_html/`. Documentado. Não repita.

**[R9] Isolamento absoluto entre projetos.**
Secrets, configs e estados de um projeto não vazam para outro. A conta do Supabase pode ser a mesma — os projetos Supabase são diferentes.

**[R10] Secrets sempre por nome, nunca por valor no código.**
Todo arquivo de CI/CD (deploy.yml, Makefile, scripts) referencia secrets pelo nome da variável (`${{ secrets.DEPLOY_PATH }}`), **nunca pelo valor hardcoded**. Isso garante que a única fonte de verdade para credenciais e caminhos é o sistema de secrets, não o código.

**Failure mode real:** Deploy.yml com caminho FTP hardcoded `/public_html/serafim13/` em vez de `${{ secrets.DEPLOY_PATH }}` → quando o caminho mudou, todos os deploys falharam silenciosamente por semanas. O secret tinha o valor certo; o código não.

**[R11] Tokens e chaves pessoais nunca aparecem em chats com IA.**
GitHub PATs, tokens de API e chaves privadas digitados em conversas com IA estão imediatamente comprometidos — o histórico do chat persiste, o contexto é transmitido a servidores externos.

**[R12] Tudo que pode ser automático, deve ser automático.**
Nenhum processo recorrente depende de ação humana manual. Deploy, sincronização de feeds, correlação de alertas, self-check do Brain — todos devem ter trigger automático (cron, systemd, webhook ou scheduler). Humano opera, não mantém infraestrutura.

Camadas de automação obrigatórias:
- **Windows → WSL2:** pasta Startup + registro HKCU/Run iniciam WSL2 Kali no login
- **WSL2 → runner:** systemd `enabled` garante que GitHub Actions runner sobe com o Kali
- **Git push → deploy:** GitHub Actions (`ubuntu-latest`, hosted pelo GitHub) faz build e sobe via FTP-Deploy-Action para o servidor. Runner self-hosted é reserva para cenários específicos — não é o caminho padrão.
- **Supabase cron:** pg_cron + pg_net chamam Edge Functions em intervalos fixos:
  - `correlation-engine` a cada 10min (anti-fadiga de alertas)
  - `threat-intel-sync` a cada 6h (feeds CTI atualizados)
  - `brain-self-check` 1x/dia às 03:00 BRT
- **DB trigger → enrich:** INSERT em `incidents` dispara `enrich-incident` automaticamente

**Failure mode real:** runner parado → job do GitHub Actions esperando para sempre → site com versão antiga → usuário vê "regressão". Fix: automação de startup elimina o elo humano frágil.

**Arquivo de referência:** `.serafim/AUTOMATION.md` documenta cada camada e como verificar.

Regra operacional: gere um token → configure-o no sistema (GitHub Secrets, .env.local) → use o nome da variável no código. O valor nunca transita por chat, commit ou log.

**[R13] Rigor técnico absoluto — zero dívida técnica intencional.**
Nada que está errado, mockado, incompleto ou funcionando pela metade pode ser entregue como se estivesse pronto. Dívida técnica é custo adiado com juros — toda funcionalidade tem três estados permitidos: **(a) funcionando corretamente com dados reais**, **(b) explicitamente marcada como demo/placeholder** com aviso visível, ou **(c) desabilitada**.

O que nunca é permitido:
- Apresentar dado hardcoded ou mockado como se fosse real sem aviso
- Deixar bug conhecido sem registrar em TODO com data e responsável
- Liberar acesso a funcionalidade sem validar que ela funciona do começo ao fim
- Misturar dados reais e dados falsos no mesmo painel sem distinção clara

Controle de acesso obrigatório por nível:
- `super_admin`: acesso total
- `admin`: acesso a operações, sem configurações de sistema
- `analyst/client` (pagante): acesso às features contratadas e validadas
- `viewer` / público: **zero acesso a War Room, Admin, Scans, dados de clientes**

Antes de qualquer feature ir para produção, responder: *"Se um cliente pagar por isso amanhã e eu mostrar ao vivo, funciona sem mentira?"* Se a resposta for não — o caminho é (b) ou (c), nunca entregar como (a).

**Failure mode real:** mostrar DEFCON 5 / MTTD "< 15m" hardcoded enquanto o banco está vazio → cliente descobre que são valores falsos → perda de credibilidade e contrato. Fix: exibir `—` quando não há dados reais, nunca inventar métricas.

**Arquivo de referência:** `.serafim/STATUS_REAL.md` — mapa de funcionalidades com estado real (REAL/DEMO/DESABILITADO).

**[R14] SSOT por tipo de dado — uma fonte, uma verdade.**
Cada tipo de dado do sistema tem exatamente **uma fonte canônica**. Qualquer outra representação é derivada da fonte — nunca paralela a ela.

Estrutura de derivação obrigatória:
```
Fonte canônica (documento ou DB) → derivação por contexto → nunca divergência silenciosa
```

Exemplos práticos:
- **Personas:** documento canônico (`NEX_SYSTEM_PROMPTS_v2.md`) → DB `system_prompt` → overlays por contexto (IRC: voz tática / Autopilot: voz social). A fonte define a identidade; os overlays adicionam, nunca substituem.
- **Configuração de deploy:** `DEPLOY.md` → `deploy.yml` referencia por secret → código não hardcoda nada.
- **Regras do sistema:** `PROTOCOLO_SERAFIM_UM.md` → `CLAUDE.md` de cada projeto → a IA usa o `CLAUDE.md`, mas a verdade mora no Protocolo.

O que esta regra proíbe:
- A mesma persona definida em 3 lugares diferentes que podem divergir
- Config de deploy hardcoded no `deploy.yml` E separada em `.serafim/DEPLOY.md` sem sincronização
- Dois documentos que "explicam" o mesmo dado sem hierarquia clara entre eles

**Failure mode real:** personas com vozes diferentes no IRC, no Autopilot e no documento canônico — nenhuma "errada", todas divergindo silenciosamente. Resultado: respostas inconsistentes que minam credibilidade. Fix: migração SSOT — fonte única no DB, overlays de contexto documentados, documento canônico como lei.

**[R15] Smoke test obrigatório antes de qualquer push.**
Nenhum `git push origin main` acontece sem smoke test passando. Sem exceção.

```bash
# Antes de qualquer push
node scripts/smoke-test-suite.mjs
# exit 0 → push liberado
# exit ≠ 0 → investigar antes de subir
```

O que o smoke test valida:
- Supabase online e respondendo
- Edge Functions críticas acessíveis (brain-chat, irc-persona-bot, autopilot-conductor)
- Tabelas principais acessíveis com a chave correta
- Integrações ativas (Wire, WarRoom, NEX)

Exceções documentadas:
- Tabelas com RLS restritivo testáveis apenas internamente (incidents, assets) → marcar como `⚠️ infra-gated`, não `❌ falha`
- Supabase offline (exit 2) → esperado em manutenção, não é regressão de código

**Failure mode real:** push com Edge Function quebrada → usuários sem Brain por horas até o próximo deploy. Fix: smoke test teria pego o 500 antes do push. Custa 30s. Regressão custa horas.

---

**[R16] Prove do ângulo de quem usa — antes de dar por pronto.**

> Antes de dar qualquer mudança como pronta: liste o que ela pode quebrar que
> **não aparece num teste anônimo** — RLS, permissão, sessão, papel, plano,
> feature flag. **Prove com uma chamada real, como usuário logado, contra
> produção.** Se não puder provar, **diga isso** em vez de dar por pronto.

A segunda frase é a que muda o resultado. *"Revise bem"* não muda nada;
*"prove do ângulo de quem usa"* muda.

**O princípio geral:** todo sistema cujo comportamento depende de **quem está
perguntando** tem um ponto cego do tamanho do papel que você não testou. Testar
como anônimo prova o que o anônimo vê — e absolutamente nada além disso. A
suíte inteira pode ficar verde com a produção quebrada pra 100% dos usuários
reais.

**Como provar (Supabase/PostgREST):** pegue o `jwt_secret` em
`GET https://api.supabase.com/v1/projects/<ref>/postgrest`, emita um JWT HS256
com `{"sub": <user_id>, "email": ..., "role": "authenticated", "aud": "authenticated"}`
e rode as consultas reais da tela contra produção com ele.
**Genérico:** obtenha uma sessão real do papel afetado e repita a operação que o
usuário faz. Se o papel for caro de obter, isso é um problema de testabilidade a
resolver — não uma licença pra pular a prova.

**Failure mode real (ODP, 04/09/2026):** uma revogação de `EXECUTE` fechou
corretamente uma função perigosa aberta pra internet, e a lista de exceções foi
montada varrendo o que o cliente chama por `.rpc(...)`. Faltou o caminho
invisível — **função usada DENTRO de uma policy de RLS roda no contexto de quem
faz a query** e exige `EXECUTE` daquele papel. Duas funções-gate caíram, 8
policies junto, dashboard e painel admin inteiros fora do ar. Todas as checagens
seguiram verdes, porque rodavam como `anon`. Descoberto pelo dono, viajando.
Custo da prova que faltou: 30 segundos.

**As variações já pagas da mesma lição** (viram guarda automática, não memória):
- objeto removido do banco que o cliente ainda usa → varredura que deriva a lista
  do código real (`.from('x')`, `rest/v1/x`) e confere contra produção;
- função citada em policy sem `EXECUTE` → auditoria de catálogo que devolve uma
  linha por problema;
- job que reporta sucesso enquanto o trabalho falhou → falhar de verdade, sempre.

**Corolário:** transformar cada prova que faltou em **checagem que roda sozinha**.
Regra virada documento é memória; regra virada teste é garantia.

---

**[R17] Correção proativa contínua — perceber é obrigação de corrigir, não nota para depois.**

> Ao perceber ou localizar um bug, pendência, erro, lacuna, dívida técnica,
> desalinhamento de arquitetura/spec/ambiente, ou desperdício de custo durante
> **qualquer** trabalho — mesmo fora do escopo pedido — corrija dentro do raio
> de segurança da tarefa em mãos. Manter o sistema em pleno status técnico
> operacional, calibrado e economizando com inteligência não é um extra
> cortês: é parte do trabalho, o tempo todo, sem precisar de pedido explícito
> a cada vez.

**O que isso exige na prática:**
- Bug achado enquanto se resolve outra coisa → corrigir, não só anotar, se o
  custo de corrigir agora for baixo e o risco de mexer for conhecido.
- Configuração, arquitetura ou ambiente mal calibrado (ex: dependência
  desnecessária, cache mal configurado, processo manual que devia ser
  automático) → sinalizar SEMPRE; corrigir quando o escopo permitir sem
  aprovação extra.
- Gap de documentação achado (`.serafim`/`.memory` desatualizado, decisão sem
  registro) → atualizar junto, não deixar para "uma sessão de doc depois".

**O que isso NÃO autoriza:**
- Refatoração especulativa não pedida, ou mudança de comportamento de
  produto/preço/regra de negócio sem confirmar com o dono.
- Perseguir um achado tangencial até esgotar o orçamento da sessão em vez de
  reportar o achado e perguntar, quando o risco ou custo de continuar for alto.
- Editar código ou documento de OUTRO projeto/repositório sem contexto
  carregado dele — corrija no projeto em que está trabalhando; sinalize o
  resto para uma sessão dedicada.

**Failure mode real (ODPv6, 11/09/2026):** um `deploy.py` publicou
`version.json` e o registro em `app_releases` dizendo "v8.15.0 no ar" enquanto
o `.apk` de fato servido continuava a versão anterior — bug real em
`sync_apk()` (comparava só o primeiro candidato de build encontrado, não o
mais recente). Só foi pego porque a sessão não confiou no HTTP 200 do health
check e conferiu o certificado + `versionCode` do binário publicado contra o
que fora buildado localmente. Na mesma sessão, o primeiro pipeline de CI real
(nunca antes testado de ponta a ponta) revelou 3 bugs adicionais genuínos —
arquivo de config ausente, caminho de keystore duplicado, e uma senha
corrompida silenciosamente por interpolação direta de secret dentro de um
heredoc bash — cada um só resolvido porque a sessão investigou a causa raiz
em vez de tentar contornar o sintoma.

**Corolário:** toda vez que este tipo de achado se repetir na mesma classe de
problema, vira checagem automática (mesmo espírito do R16) — não fica só
registrado em prosa pra a próxima sessão redescobrir do zero.

---

## PARTE III — AS 23 SKILLS DO OPERADOR (WATCHDOG É A SKILL 23, NÃO UM EXTRA À PARTE)

Cada skill é um padrão de operação. Não é opcional — é o que faz a diferença entre projetos que sobrevivem e projetos que colapsam.

---

### SKILL 1 — AI MEMORY ARCHITECTURE
*A única skill que transforma IA de ferramenta em colaborador.*

**O que é:** O sistema de memória da Parte I. É a fundação de tudo.

**Como implementar:**
```bash
# Setup em qualquer projeto (30 segundos)
# Escolha o nome da pasta: .memory, .argus, .nomeDoProjeto, .dev — o que fizer sentido
PROJECT_MEM=".memory"   # ← seu nome aqui

mkdir $PROJECT_MEM
cp -r templates/.memory/* $PROJECT_MEM/
cp templates/CLAUDE.md .
cp templates/hooks/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit

# Se você mudou o nome da pasta, edite a variável MEMORY_DIR no pre-commit
# (linha 4 do hook — já está com comentário indicando onde mudar)
```

**O que preencher primeiro:** `IDENTITY.md` (5 minutos) e `ESTADO_ATUAL.md` (2 minutos). O resto pode esperar o projeto começar a tomar forma.

**Failure mode:** Não atualizar `ESTADO_ATUAL.md` ao fim das sessões. A memória apodrece silenciosamente. Em 2 semanas, o arquivo está desatualizado e você volta a explicar contexto do zero.

---

### SKILL 2 — IDENTITY ISOLATION
*Uma mudança de cliente ou branding não deve tocar no código.*

**O que é:** Separação total entre identidade (quem é o projeto) e técnica (como funciona).

**Como implementar:**
```typescript
// ❌ Identidade hardcoded no componente
const Button = () => <button style={{ color: '#00ff9d' }}>Serafim</button>;

// ✅ Identidade em um único lugar
// src/lib/theme.ts
export const THEME = {
  primary:  'var(--color-primary)',
  fontMono: 'JetBrains Mono, monospace',
  // ...
} as const;

// O componente não sabe quem é o cliente
const Button = ({ children }: { children: React.ReactNode }) => (
  <button style={{ color: THEME.primary }}>{children}</button>
);
```

**Failure mode:** Cores hardcoded em 47 arquivos diferentes. Troca de cliente = refatoração de 3 dias.

---

### SKILL 3 — FRACTAL ARCHITECTURE
*Separação de responsabilidade que escala sem se contradizer.*

**O que é:** Três camadas que nunca se misturam:
```
UI       → Componentes puros. Recebem dados, emitem eventos. Zero fetch, zero lógica.
Lógica   → Hooks e services. Testáveis isoladamente. Zero import de componentes.
Infra    → Clientes externos (supabase, stripe, resend). Zero lógica de negócio.
```

**Como implementar:**
```
src/
├── components/          ← UI reutilizável (Button, Card, Modal)
├── features/
│   └── [feature]/
│       ├── components/  ← UI específica da feature
│       ├── hooks/       ← Estado, fetching, lógica
│       └── types.ts     ← Tipos do domínio
├── lib/                 ← Clientes externos
│   ├── supabase.ts
│   └── stripe.ts
└── pages/               ← Montagem. Zero lógica própria.
```

**Failure mode:** Componente de 400 linhas que faz fetch, valida schema, formata data e renderiza JSX. Impossível testar. Impossível reusar. Impossível manter.

---

### SKILL 4 — ELITE TYPE SAFETY
*Erros de tipo em runtime são erros evitáveis em build time.*

**O que é:** TypeScript com `strict: true` + Zod para validação de inputs externos. Os tipos derivam dos schemas, não o contrário.

**Como implementar:**
```typescript
// tsconfig.json
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true } }

// O schema Zod é a fonte da verdade — o tipo deriva dele
import { z } from 'zod';

const DeviceSchema = z.object({
  id:         z.string().uuid(),
  name:       z.string().min(1).max(100),
  owner_id:   z.string().uuid(),
  pair_token: z.string().nullable(),
  created_at: z.string().datetime(),
});

type Device = z.infer<typeof DeviceSchema>; // Nunca defina esse type manualmente

// Na borda de entrada — antes de qualquer processamento
const result = DeviceSchema.safeParse(rawData);
if (!result.success) {
  return { error: 'Invalid device data', details: result.error.flatten() };
}
// result.data agora é type-safe
```

**Failure mode:** `any` espalhado como curativo. Um campo muda de tipo na API, explode em runtime, em produção, para o usuário — e você não tem nem um TypeScript error para localizar o problema.

---

### SKILL 5 — ZERO-TRUST SECURITY
*Nunca assuma que o dado é válido ou que o usuário tem permissão.*

**O que é:** Segurança em três camadas que se reforçam mutuamente. Se uma falha, as outras seguram.

**Camada 1 — Banco (RLS):**
```sql
-- Usuário só acessa seus próprios dados
CREATE POLICY "owner_only" ON devices
  FOR ALL USING (owner_id = auth.uid());

-- Para inserção: owner_id deve ser o próprio usuário
CREATE POLICY "owner_insert" ON devices
  FOR INSERT WITH CHECK (owner_id = auth.uid());
```

**Camada 2 — API (autenticação + validação):**
```typescript
// Edge Function — sempre nesta ordem
const token = req.headers.get('Authorization')?.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);
if (!user) return new Response('Unauthorized', { status: 401 });

// Só depois valida o body
const body = CreateDeviceSchema.safeParse(await req.json());
if (!body.success) return new Response('Bad Request', { status: 400 });

// Só depois processa — nunca use userId do body, sempre do JWT
await supabase.from('devices').insert({ ...body.data, owner_id: user.id });
```

**Camada 3 — Headers HTTP (`.htaccess` ou `vercel.json`):**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

**Failure mode:** IDOR — usuário A acessa dados do usuário B mudando um ID na URL. Acontece quando a segurança está só na UI. A UI pode ser contornada em 10 segundos com DevTools.

---

### SKILL 6 — DEFENSIVE CODING
*Programe para o pior cenário. O pior cenário sempre acontece.*

**O que é:** Código que antecipa falhas e as trata — sem travar, sem expor erros internos ao usuário.

**Como implementar:**
```typescript
// ❌ Ingênuo — explode se API falha ou retorna null
const user = await getUser(id);
return user.profile.name;

// ✅ Defensivo — cada ponto de falha tratado
const user = await getUser(id).catch(err => {
  logger.error('getUser failed', { id, error: err.message });
  return null;
});

if (!user) return { error: 'NOT_FOUND' };
return user.profile?.name ?? 'Usuário';

// Para operações críticas — não silencia o erro, mas não quebra o fluxo
async function sendNotification(userId: string) {
  try {
    await telegram.send(userId, 'Novo alerta');
  } catch (err) {
    // Não crítico — log e segue
    logger.warn('Notification failed', { userId, err });
  }
}
```

**Regra prática:** Todo `await` tem tratamento de erro. Todo acesso a propriedade de objeto externo tem `?.` ou verificação explícita. `?.` não é preguiça — é defesa.

**Failure mode:** `TypeError: Cannot read property 'name' of undefined` em produção. O erro mais evitável de todos — e o mais frequente.

---

### SKILL 7 — FORENSIC OBSERVABILITY
*Se você não pode ver o que está acontecendo, você não pode consertar.*

**O que é:** Logging estruturado + audit trail em ações críticas. Não `console.log` — log que você consegue filtrar, agregar e alertar.

**Como implementar:**
```typescript
// src/lib/logger.ts — logger central, nunca console.log espalhado
const logger = {
  info:  (msg: string, ctx?: Record<string, unknown>) =>
    console.log(JSON.stringify({ l: 'info',  msg, ...ctx, ts: Date.now() })),
  warn:  (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ l: 'warn', msg, ...ctx, ts: Date.now() })),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(JSON.stringify({ l: 'error', msg, ...ctx, ts: Date.now() })),
};

// Audit trail para ações sensíveis
await supabase.from('audit_trail').insert({
  user_id:     user.id,
  action:      'device_deleted',
  resource:    'tracked_devices',
  resource_id: deviceId,
  ip:          req.headers.get('x-forwarded-for'),
  created_at:  new Date().toISOString(),
});
```

**O que deve ter audit trail:** delete de qualquer dado, mudança de plano/permissão, acesso a dados sensíveis, falhas de autenticação repetidas.

**Failure mode:** Bug crítico em produção, zero logs estruturados. Você passa 4 horas recriando o que o usuário fez. Com logs, leva 4 minutos.

---

### SKILL 8 — MIGRATION FORTRESS
*Schema de banco que muda sem controle é dívida que não avisa quando vai cobrar.*

**O que é:** Toda mudança de banco é uma migration versionada, com UP e DOWN.

**Como implementar:**
```
supabase/migrations/
├── 20260101000001_initial_schema.sql
├── 20260115000002_add_user_profiles.sql
└── 20260320000003_add_audit_trail.sql
```

```sql
-- 20260320000003_add_audit_trail.sql
-- ══ UP ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_trail (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_user   ON audit_trail(user_id);
CREATE INDEX idx_audit_action ON audit_trail(action, created_at DESC);

-- ══ DOWN (nunca delete — comente para referência futura) ════
-- DROP TABLE IF EXISTS audit_trail;
```

**Failure mode:** `ALTER TABLE users ADD COLUMN plano TEXT` direto no SQL Editor do Supabase em produção. Sem histórico. Sem rollback. Ninguém mais sabe o que foi feito ou quando.

---

### SKILL 9 — PHANTOM OFFLINE MODE
*Usuários não esperam por internet. Apps que esperam perdem usuários.*

**O que é:** PWA com Service Worker que serve conteúdo offline e sincroniza quando volta online.

**Como implementar (com Vite PWA plugin):**
```bash
npm install -D vite-plugin-pwa
```
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [{
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-cache', expiration: { maxAgeSeconds: 300 } }
    }]
  }
})]
```

**Failure mode:** App que mostra tela branca quando o celular perde sinal por 3 segundos. Em apps de tracking ou dashboards, isso é fatal.

---

### SKILL 10 — PERFORMANCE BUDGET
*Velocidade não é um feature. É o produto.*

| Métrica | Limite | O que viola | Como medir |
|---------|--------|-------------|------------|
| LCP | < 2.5s | Imagens sem dimensões, fonts pesados | Lighthouse, PageSpeed |
| CLS | < 0.1 | Elementos que mudam de posição | Lighthouse |
| Bundle (gzip) | < 500KB | Dependências não-necessárias | `npx vite-bundle-analyzer` |
| TTFB | < 800ms | Sem CDN, servidor lento | WebPageTest |

```typescript
// Lazy loading de rotas pesadas — obrigatório
const HeavyFeature = lazy(() => import('./features/heavy/HeavyPage'));

// Imagens — sempre com width/height explícitos
<img src="photo.webp" width={800} height={600} loading="lazy" alt="..." />

// Checar bundle antes de cada release
// package.json
"scripts": { "analyze": "vite build && npx vite-bundle-analyzer" }
```

**Failure mode:** Bundle de 4MB que demora 9 segundos em 4G. Google penaliza no ranking. Usuário abandona na página de preços. Você nunca sabe o motivo.

---

### SKILL 11 — SOVEREIGN DEPLOYMENT
*Nenhum deploy é manual. O que não é automatizado, não é confiável.*

**O que é:** Pipeline CI/CD que executa typecheck → lint → testes → build → deploy sem intervenção humana.

**Como implementar (GitHub Actions):**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx tsc --noEmit          # Falha aqui = não vai para produção
      - run: npm run lint               # Falha aqui = não vai para produção
      - run: npm test -- --run          # Falha aqui = não vai para produção
      - run: npm run build
      - name: Deploy FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server:    ${{ secrets.FTP_HOST }}
          username:  ${{ secrets.FTP_USER }}
          password:  ${{ secrets.FTP_PASS }}
          local-dir: ./dist/
```

**Para projetos Supabase — deploy das Edge Functions:**
```yaml
      - name: Deploy Edge Functions
        run: |
          npx supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Failure mode:** Deploy manual que alguém esquece. Hotfix que vai para staging mas não para produção. "Funcionou na minha máquina" como resposta ao cliente.

---

### SKILL 12 — COGNITIVE VISIBILITY
*Em 2026, ser invisível para IAs é ser invisível para a próxima geração de busca.*

**O que é:** SEO técnico + LLM optimization. Não é sobre keywords — é sobre ser compreensível para máquinas.

**Stack mínima de visibilidade:**
```html
<!-- <head> de toda página -->
<title>[Keyword central] — [Nome do produto]</title>
<meta name="description" content="[150 chars com keyword, específico]">
<meta property="og:title"       content="[Igual ao title]">
<meta property="og:description" content="[Igual à description]">
<meta property="og:image"       content="[URL absoluta, 1200x630px]">
<meta property="og:url"         content="[URL canônica]">
<link rel="canonical"           href="[URL canônica]">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Nome do Produto",
  "description": "O que faz em uma frase",
  "url": "https://seusite.com",
  "offers": { "@type": "Offer", "price": "497", "priceCurrency": "BRL" }
}
</script>
```

```
# /public/llms.txt — o novo robots.txt para IAs
# Nome do Produto
> [Descrição em 1-2 frases: o que é, para quem]

## Páginas principais
- Home: https://seusite.com — [O que o usuário encontra]
- Preços: https://seusite.com/precos — [O que está disponível]

## Tecnologia
[Stack usado, integrações, diferenciais técnicos]
```

**Failure mode:** Produto excelente que o ChatGPT e o Perplexity nunca recomendam porque não tem dados estruturados. Em 2026, mais de 30% das buscas de produto passam por IAs.

---

### SKILL 13 — SOVEREIGN MONITORING
*Você precisa saber que quebrou antes do usuário te ligar.*

**Stack mínima (gratuita):**
```
UptimeRobot   → Alerta em 5 min se cair
Sentry        → Captura erros JS em runtime, grava replay
Google Analytics 4 → Comportamento de usuário, funil de conversão
Supabase Logs → Erros em Edge Functions e queries lentas
```

**Health check endpoint obrigatório:**
```typescript
// Edge Function ou API route: /api/health
export async function GET() {
  const [dbCheck] = await Promise.allSettled([
    supabase.from('_health_check').select('1').limit(1),
  ]);

  const ok = dbCheck.status === 'fulfilled';
  return Response.json(
    { status: ok ? 'ok' : 'degraded', ts: Date.now() },
    { status: ok ? 200 : 503 }
  );
}
```

**UptimeRobot:** monitora `/api/health` a cada 5 minutos. Alerta no WhatsApp quando retorna 503.

**Failure mode:** Site caído por 4 horas antes de alguém perceber. Chargeback de R$800 de cliente que não conseguiu fazer upgrade porque o checkout estava offline.

---

### SKILL 14 — THREAT-MONETIZATION LOOP
*Produto sem modelo de receita claro é hobby, não negócio.*

**O framework de precificação:**
```
Entry (R$29-97):      Remove objeção de preço. Captura volume e prova social.
Mid (R$297-997):      O produto real. Onde está a margem e o LTV.
High-Ticket (R$1.497+): Para o problema sério. Gera casos de sucesso e autoridade.
```

**Como implementar no código:**
```typescript
// Feature flags por plano — centralizadas, não espalhadas
const PLAN_GATES = {
  free:       { devices: 1,   history_days: 7,   alerts: false, export: false },
  family:     { devices: 5,   history_days: 30,  alerts: true,  export: false },
  fleet:      { devices: 999, history_days: 365, alerts: true,  export: true  },
} as const;

type Plan = keyof typeof PLAN_GATES;
type Feature = keyof (typeof PLAN_GATES)['free'];

function canAccess(feature: Feature, plan: Plan): boolean {
  const limit = PLAN_GATES[plan][feature];
  return limit !== false && limit !== 0;
}

// Gate na UI — sempre visível, nunca escondido
{!canAccess('export', userPlan) && (
  <UpgradeBanner
    feature="Exportar Relatórios"
    currentPlan={userPlan}
    targetPlan="fleet"
  />
)}
```

**Failure mode:** App completo com todas as features no plano gratuito. Zero receita. "Mas o produto é bom..." — o problema não é o produto.

---

### SKILL 15 — EVENT-DRIVEN ARCHITECTURE
*Operações lentas não bloqueiam operações rápidas.*

**O que é:** Separar o que precisa ser imediato (< 100ms) do que pode ser assíncrono.

**Como implementar:**
```typescript
// ❌ Síncrono — o usuário espera 4 segundos para criar conta
async function createUser(data: UserData) {
  await db.users.create(data);
  await sendWelcomeEmail(data.email);   // 2-3s
  await notifySlack(data);              // 1s
  return { success: true };
}

// ✅ Fire-and-forget para operações não-críticas
async function createUser(data: UserData) {
  await db.users.create(data);
  // Retorna imediato, processa em background
  void sendWelcomeEmail(data.email).catch(err => logger.warn('email failed', { err }));
  void notifySlack(data).catch(err => logger.warn('slack failed', { err }));
  return { success: true }; // < 100ms
}

// Para operações garantidas — fila persistente via Supabase
await supabase.from('job_queue').insert({
  type:    'send_welcome_email',
  payload: { email: data.email, userId: data.id },
  status:  'pending',
});
// Worker separado processa a fila — sem risco de perder o job
```

**Failure mode:** Endpoint que demora 8s porque manda email de forma síncrona. Timeout do usuário. Rate limit do servidor de email que quebra o fluxo de cadastro em pico de uso.

---

### SKILL 16 — COGNITIVE REDUNDANCY (LLM FALLBACK)
*Nunca dependa de um único provedor de IA.*

**O que é:** Cadeia de fallback automático entre provedores de LLM para disponibilidade e controle de custo.

**Como implementar:**
```typescript
type LLMProvider = { provider: string; model: string; costPer1kTokens: number };

const LLM_CHAIN: LLMProvider[] = [
  { provider: 'groq',     model: 'llama-3.3-70b-versatile', costPer1kTokens: 0.0006  },
  { provider: 'gemini',   model: 'gemini-2.0-flash',        costPer1kTokens: 0.00015 },
  { provider: 'deepseek', model: 'deepseek-chat',           costPer1kTokens: 0.00027 },
  { provider: 'openai',   model: 'gpt-4o-mini',             costPer1kTokens: 0.00015 },
];

async function callLLM(prompt: string): Promise<string> {
  for (const llm of LLM_CHAIN) {
    try {
      const result = await callProvider(llm.provider, llm.model, prompt);
      void logLLMCall(llm, result.usage); // fire-and-forget
      return result.text;
    } catch (err) {
      logger.warn('LLM failed, trying next', { provider: llm.provider, error: err.message });
    }
  }
  throw new Error('All LLM providers exhausted');
}
```

**Failure mode:** App de IA que fica offline toda vez que a OpenAI tem um incident. Ou que gasta 10x mais porque não tentou o provider mais barato primeiro.

---

### SKILL 17 — LLM COST SOVEREIGNTY
*IA cara demais mata a margem. IA barata demais mata a qualidade.*

**O que é:** Log e controle financeiro de cada chamada a LLM — por feature, por usuário, por mês.

**Como implementar:**
```typescript
// Tabela llm_calls no Supabase
await supabase.from('llm_calls').insert({
  user_id:      user.id,
  provider:     'groq',
  model:        'llama-3.3-70b',
  tokens_in:    usage.prompt_tokens,
  tokens_out:   usage.completion_tokens,
  cost_usd:     (usage.total_tokens * 0.0000006),
  latency_ms:   Date.now() - startTime,
  feature:      'chat_response',
});

// Budget alert — query mensal por feature
const { data } = await supabase.rpc('get_monthly_llm_spend', { feature: 'chat_response' });
if (data.total_usd > 50) {
  await notifyAdmin(`⚠️ Budget: chat_response gastou $${data.total_usd} este mês`);
}
```

**Failure mode:** Fatura de $3.000 no final do mês de uma feature que você achava que custava $300. Ou usuários abusando da API de LLM sem nenhum rate limit por conta.

---

### SKILL 18 — ADAPTIVE INTELLIGENCE
*Sistemas inteligentes se ajustam ao comportamento. Não esperam instrução.*

**O que é:** Algoritmos que mudam parâmetros baseados em dados observados em tempo real.

**Exemplo concreto — ping GPS adaptativo:**
```typescript
function calcPingInterval(
  lastLat: number, lastLng: number,
  curLat: number, curLng: number,
  baseIntervalMs: number
): number {
  const distanceMoved = haversineMeters(lastLat, lastLng, curLat, curLng);

  if (distanceMoved > 100) {
    // Em movimento rápido: ping a cada 5s no máximo
    return Math.min(baseIntervalMs, 5_000);
  } else if (distanceMoved > 20) {
    // Em movimento lento: intervalo normal
    return baseIntervalMs;
  } else {
    // Parado: economiza bateria, pinga 3x menos
    return baseIntervalMs * 3;
  }
}
```

**Outros padrões:**
- Refresh de dashboard: mais rápido quando usuário está ativo, mais lento quando idle
- Qualidade de upload: menor em 3G, maior em WiFi
- Verbosidade da IA: mais contexto para usuários avançados, menos para novatos

**Failure mode:** Sistema que trata igual um usuário parado em casa e um em movimento no trânsito. Drena bateria. Gera dados redundantes. Dashboard com localização "1 hora atrás" quando o dispositivo está online.

---

### SKILL 19 — SECURE SECRETS MANAGEMENT
*Uma credencial vazada pode custar mais do que o produto vale.*

**Hierarquia onde secrets vivem:**
```
Dev local:              .env (nunca commitado)
CI/CD:                  GitHub Secrets / Vercel Environment Variables
Edge Functions:         Supabase Vault (npx supabase secrets set KEY=value)
Frontend:               Apenas VITE_* públicos (anon key, URL pública)
```

**O que NUNCA deve ser público:**
- `service_role` key do Supabase — bypassa RLS completamente
- `sk_live_*` do Stripe — acesso a todos os pagamentos
- Tokens de bots (Telegram, Slack, Discord)
- Qualquer chave com permissão de escrita em produção

**`.gitignore` obrigatório:**
```
.env
.env.local
.env.production
*.pem
*.key
```

**Verificação antes de qualquer commit:**
```bash
# Procurar por possíveis secrets acidentais
git diff --cached | grep -E "(sk_live|service_role|Bearer |password.*=)" && echo "⚠️ Possível secret detectado"
```

**Failure mode:** `sk_live_abc123` commitado no GitHub. Bot de scan encontra em 4 minutos. Stripe bloqueia a conta. Você explica para o cliente o que aconteceu com o dinheiro dele.

---

### SKILL 20 — API DESIGN PRINCIPLES
*APIs são contratos. Contratos quebrados custam retrabalho em cascata.*

**O que é:** Design de API que evolui sem quebrar clientes existentes.

```typescript
// Versionamento obrigatório — /api/v1/resources, nunca /api/resources
// Status codes semânticos:
const STATUS = {
  OK:         200, // Sucesso com dados
  CREATED:    201, // Recurso criado
  NO_CONTENT: 204, // Sucesso sem dados (DELETE)
  BAD_REQUEST: 400, // Input inválido
  UNAUTHORIZED: 401, // Não autenticado
  FORBIDDEN:  403, // Autenticado mas sem permissão
  NOT_FOUND:  404, // Recurso não existe
  TOO_MANY_REQUESTS: 429, // Rate limit
  SERVER_ERROR: 500, // Nunca expor stack trace aqui
} as const;

// Resposta de erro padronizada — sempre igual
type ErrorResponse = {
  error: {
    code: string;     // Machine-readable. Ex: "VALIDATION_ERROR"
    message: string;  // Human-readable. Ex: "Email inválido"
    field?: string;   // Qual campo, se aplicável
  }
};
```

**Failure mode:** API que retorna `200 { success: false, error: "something went wrong" }`. O frontend não sabe o que fazer. Você não consegue filtrar erros nos logs. Os usuários veem mensagens genéricas.

---

### SKILL 21 — AUTONOMOUS QA MATRIX
*Bugs que chegam ao usuário custam 10x mais para corrigir do que bugs pegos antes.*

**O que é:** Três camadas de teste que cobrem desde lógica isolada até fluxo completo.

Ver **WATCHDOG_SERAFIM.md** para implementação completa — o módulo WATCHDOG cobre toda esta skill com prompts prontos, templates de teste, e o componente visual de monitoramento.

**Resumo das camadas:**
```
Unit (Vitest)       → Lógica pura. Rápido. Sem IO.
Integration (Vitest + real DB local) → Infra com banco real.
E2E (Playwright)    → Fluxo completo do usuário.
WATCHDOG Component  → Monitoramento visual em tempo real (abrir com Shift+D).
```

---

### SKILL 22 — BUSINESS ARCHITECTURE FIRST
*Todo projeto começa com: como isso ganha dinheiro?*

**O framework de 3 perguntas antes do primeiro commit:**
1. **Qual é a dor?** (Específica, mensurável, dolorosa o suficiente para pagar)
2. **Qual é o ROI para o usuário?** (Quanto ele economiza ou ganha)
3. **Qual é o caminho de upgrade?** (De gratuito para pago, de pago para mais caro)

**Precificação baseada em valor, não em custo:**
```
Pergunta certa: Quanto custa para o cliente NÃO ter isso?

Exemplo:
  Rastreamento familiar sem produto:    R$3.000/mês (investigador)
  Rastreamento familiar com produto:    R$79/mês
  Posicionamento natural:               "Por menos que 1 hora de investigador"
```

**Aplicado ao código:**
```typescript
// O plano gratuito é o funil, não o produto
// O produto real começa no plano pago
// Nunca dê de graça o que resolve a dor central

const FREE_PLAN_LIMITS = {
  devices: 1,          // Suficiente para sentir o valor
  history_days: 3,     // Não suficiente para o uso real
  alerts: false,        // A feature mais valiosa, gate no pago
  realtime: false,
};
```

**Failure mode:** App construído inteiramente antes de alguém pagar R$1. Você descobre que o mercado não quer quando o produto está pronto.

---

### SKILL 23 — WATCHDOG INTEGRATION
*O sistema de QA que usuários veem funcionando.*

**O que é:** O módulo WATCHDOG — um componente React visual que você dropa no projeto e abre com `Shift+D`. Combina monitoring em tempo real, health checks de endpoints, e mapa da arquitetura com status por componente.

**Como ativar:**
```bash
# 1. Copie templates/WATCHDOG.tsx para src/qa/Watchdog.tsx
# 2. Configure as constantes no topo do arquivo:
#    - PROJECT_META (nome, stack, versão)
#    - ARCHITECTURE_MAP (seus arquivos críticos)
#    - HEALTH_CHECKS (seus endpoints)
# 3. Monte no App.tsx:
```

```tsx
// src/App.tsx
import { Watchdog } from './qa/Watchdog';

export default function App() {
  return (
    <>
      <Router />
      {import.meta.env.DEV && <Watchdog />} {/* Dev only */}
      {/* OU para clientes premium: sem condicional */}
      <Watchdog />
    </>
  );
}
```

**O que você vê:**
- **Tab FLUXO:** Interaction trail em tempo real — cada clique do usuário registrado com timestamp
- **Tab SAÚDE:** Health checks automáticos dos seus endpoints com latência
- **Tab ATLAS:** Mapa da arquitetura com status HEALTHY/CRITICAL/STABLE por componente

**Casos de uso reais:**
- Demo para cliente: abre Shift+D ao vivo e mostra que tudo está monitorado
- Debugging: vê exatamente onde o usuário clicou antes do erro
- QA: verifica que endpoints estão respondendo antes de entregar

Ver `templates/WATCHDOG.tsx` para o componente completo e `WATCHDOG_SERAFIM.md` para todas as técnicas de QA.

---

## PARTE IV — O ARSENAL DE PROMPTS

Os prompts certos multiplicam o valor de tudo que você construiu até aqui.

### PROMPT 1 — Início de Sessão
```
Contexto do projeto:
[Cole o ESTADO_ATUAL.md]

Regras absolutas:
- TypeScript strict, zero any
- RLS em toda tabela com dados de usuário
- Todo secret em variável de ambiente, nunca no código
- Sem arquivos duplicados (v2, bkp, old)

Tarefa desta sessão:
[Descreva o que precisa fazer]

Antes de implementar qualquer coisa, me diga:
1. Quais arquivos você vai tocar
2. Se há algum risco ou dependência que eu devo saber
3. Só então implemente
```

### PROMPT 2 — Code Review
```
Você é um engenheiro sênior fazendo code review.
Analise este código e classifique cada problema:
- CRÍTICO (segurança, dados, produção)
- ALTO (performance, confiabilidade)
- MÉDIO (manutenibilidade, tipo)
- BAIXO (estilo, naming)

Para cada problema CRÍTICO ou ALTO, mostre a correção.

[COLE O CÓDIGO]
```

### PROMPT 3 — Debug Estruturado
```
Tenho este bug:
- Input: [exatamente o que faço]
- Output atual: [o que acontece]
- Output esperado: [o que deveria acontecer]
- Erro completo: [stack trace]
- Último commit que funcionava: [sha ou "não sei"]

Não me dê o fix ainda.
Primeiro: em qual camada o problema provavelmente está?
Segundo: como confirmo com 1 teste isolado?
Só depois: o fix.
```

### PROMPT 4 — Feature com Testes
```
Antes de implementar [FEATURE], escreva os testes.
Cubra:
1. Happy path com dados válidos
2. Edge cases (null, undefined, vazio, muito grande)
3. Error cases (o que deve falhar e como)

Após eu aprovar os testes, você implementa.
A implementação deve passar em todos os testes.
```

### PROMPT 5 — Encerramento de Sessão
```
Sessão encerrada. Atualize o ESTADO_ATUAL.md da sua pasta de memória com:

## ÚLTIMA SESSÃO FEZ:
[O que foi implementado hoje]

## PENDENTE:
[O que ficou para próxima sessão]

## BLOQUEIOS:
[O que precisa de decisão ou informação externa]

## PRÓXIMA SESSÃO COMEÇA COM:
[Uma linha de ação específica]

E se houver alguma decisão arquitetural relevante, adicione no HISTORICO_DE_DECISOES.md.
```

---

## PARTE V — OS 10 ANTI-PATTERNS QUE MATAM PROJETOS COM IA

Evite cada um destes. Todos foram observados em projetos reais.

**[AP-1] The Blank Session**
Começar a sessão sem dar contexto. A IA inventa o que não sabe. Você descobre na próxima sessão que ela contradisse decisões que você não lembra de ter tomado.

**[AP-2] The Living Any**
`const data: any = await fetch(...)`. Começa como "temporário para testar". Fica para sempre. Em 3 meses, é impossível refatorar porque nenhum tipo está correto.

**[AP-3] The Duplicated Truth**
Mesmo dado em dois lugares — banco e localStorage, dois estados de React, duas variáveis globais. Eles inevitavelmente divergem. O usuário vê dados diferentes dependendo de qual ele olha.

**[AP-4] The Hidden Feature**
Feature completa e funcional que ninguém pode encontrar porque não está no menu principal, não tem onboarding, não tem tooltip. 0% de adoção. 100% de custo de desenvolvimento.

**[AP-5] The Sycophantic AI**
Usar a mesma sessão de IA para revisar o que ela mesma implementou. Ela vai confirmar que está correto. Use uma sessão nova para code review.

**[AP-6] The God Component**
Um componente de 600 linhas que sabe tudo, faz tudo, e não pode ser testado nem reutilizado. Resultado natural de pedir à IA que "implemente a feature inteira" sem forçar separação.

**[AP-7] The Silent Deploy**
Deploy manual sem documentação no HISTORICO. Em 2 semanas, ninguém sabe por que o comportamento mudou. Em 2 meses, você está fazendo arqueologia no servidor.

**[AP-8] The Free Feature Trap**
Colocar a feature central — a que resolve a dor real — no plano gratuito. Você gera usuários, não receita. O plano pago não tem valor suficiente para justificar upgrade.

**[AP-9] The Orphan Branch**
Feature desenvolvida em branch separado por 3 semanas sem merge. No merge, conflitos em 40 arquivos. 2 dias de trabalho perdidos resolvendo diff.

**[AP-10] The Vanishing Context**
Fazer perguntas arquiteturais no chat sem salvar as respostas. "A IA sugeriu X na semana passada, como era mesmo?" — não tem como recuperar. Decisões importantes vão para o HISTORICO. Sempre.

---

## PARTE VI — O MOTOR DE NEGÓCIO

### Estrutura de Produto que Sobrevive

```
ENTRADA (R$29-97)
  Propósito: remover objeção de preço, capturar volume
  Feature: resolve 30% da dor
  Conversão esperada: 2-5% dos visitantes
  Objetivo real: construir lista e prova social

NÚCLEO (R$297-997)
  Propósito: o produto real, onde está a margem
  Feature: resolve a dor central completamente
  Retenção esperada: 70%+ dos pagantes por 6 meses
  Objetivo real: LTV e cases de sucesso

PREMIUM (R$1.497+)
  Propósito: para quem tem o problema urgente e complexo
  Feature: personalização, suporte prioritário, escala
  Volume esperado: 10-15% da base
  Objetivo real: autoridade de mercado e casos de referência
```

### A Métrica de Sucesso Que Importa

Defina antes de lançar. Uma pergunta, uma resposta:

> O que um usuário feliz faz que um usuário frustrado não faz?

Exemplos:
- SaaS de tracking: "Abre o dashboard 3x na primeira semana"
- Ferramenta de dev: "Completa o setup em menos de 10 minutos na primeira sessão"
- Produto educacional: "Completa a primeira trilha em menos de 7 dias"

Essa métrica é a sua estrela norte. Tudo na UI, no onboarding e no produto direciona o usuário para ela.

---

## REFERÊNCIA RÁPIDA — OS NÚMEROS QUE IMPORTAM

```
Performance Budget:     LCP < 2.5s | CLS < 0.1 | Bundle < 500KB gzip
Health Check:           Resposta < 200ms
Rate Limit padrão:      100 requests/min por IP
Rotação de secrets:     Semestral mínimo
Session RAM:            ESTADO_ATUAL.md atualizado ao fim de cada sessão
Commit gate:            Pre-commit hook verifica ESTADO_ATUAL.md
Deploy gate:            typecheck + lint + tests antes de qualquer push
```

---

## HISTÓRICO DE VERSÕES

> Não existia até 11/09/2026 — achado durante uma auditoria cross-projeto que
> o cabeçalho deste arquivo dizia v4.1 e o rodapé dizia v4.0, e que nenhum
> arquivo de changelog registrava o que mudou entre versões. Corrigido junto
> com a criação desta seção. **Regra de manutenção:** toda vez que uma regra,
> skill ou anti-pattern for adicionado/alterado aqui, adicione uma linha —
> mesmo padrão do `HISTORICO_DE_DECISOES.md` de cada projeto (entrada nova no
> topo, nunca editar entrada antiga).

- **v4.2** (11/09/2026) — Adiciona **[R17] Correção proativa contínua**
  (perceber bug/lacuna/desperdício durante qualquer trabalho é obrigação de
  corrigir, não nota para depois). 16→17 regras absolutas. Corrige
  inconsistência de versão (cabeçalho v4.1 × rodapé v4.0) e de contagem de
  skills (Parte III dizia "22 skills + Watchdog" mas a Skill 23 já era o
  próprio Watchdog — 22→23 skills, sem "+1" separado). Cria esta seção de
  histórico, que não existia.
- **v4.1** (04/09/2026, inferido — sem registro explícito até esta auditoria)
  — Adiciona **[R16] Prove do ângulo de quem usa** (failure mode real do
  ODPv6, 04/09/2026). 15→16 regras absolutas.
- **v4.0** e anteriores — sem changelog registrado antes desta seção existir.

---

*Protocolo Serafim UM v4.2 — Extraído de produção real. Construído para ser usado, não admirado.*
*"Sem sistema, a IA amplifica o caos na mesma velocidade que amplifica a disciplina."*
