# VITRINE — o que o site público pode dizer, e o que fica a sete chaves (21/10/2026, ordem P240)

> **A ordem do Comandante (21/10):** *"temos que começar a profissionalizar e levar isso como uma grande marca ou grandes estúdios de criação, guardando nossos segredos a sete chaves e divulgando só o superficial, o que possamos ou devemos mostrar pra captar novos leads. Não faço questão de divulgarmos questões técnicas que custaram pra aprendermos, assim protegemos nossa propriedade intelectual e não ensinamos a clonarem nossas ideias e processos."*
> Quem criar ou mexer em **qualquer página pública** (landing, oficina, esquadrão, jogo) lê isto antes. Não confundir com a seção `## VITRINE` do `GAME_DESIGN.md` (os destaques que a landing mostra): aquela é o **que mostrar**; esta é o **que nunca mostrar**.

## 1. O que o site público mostra (e pode continuar mostrando)

- **O jogo** e a landing: o que o CYBERMECH é, os modos, os Mechs, as imagens reais, o botão de jogar.
- **A oficina**: o que é do **jogo** (robôs, armas, escudos, calor, dano por distância). É informação de quem joga.
- **O esquadrão** (`/sala-de-controle/`, o endereço continua por causa dos links já espalhados): quem faz o jogo, em uma frase curada por pessoa, e o guia "o que observar ao jogar".
- **A política de privacidade**: a LGPD obriga a nomear quem trata os dados, então ela é a única página que pode citar fornecedores (por isso a guarda a ignora).

## 2. O que **nunca** vai a público

| Classe | Exemplos que já vazaram (e foram fechados em 21/10) |
|---|---|
| **Infraestrutura e segurança** | onde o servidor roda, o túnel, a hospedagem, tokens, cópias de segurança, cabeçalhos de segurança, o que a auditoria achou |
| **Processo e ferramentas** | o Protocolo Serafim UM, a revisão cruzada entre as IAs, os hooks, o atualizador, as worktrees, o ritmo de trabalho (mapa de calor de commits) |
| **Decisões e entregas** | o diário de decisões e o título de cada PR (21/10: a página publicava a confissão de uma queda do servidor) |
| **Retrato técnico** | testes por módulo, **onde falta teste**, "279 conversões forçadas", o mapa da arquitetura com módulos, linhas e dependências |
| **Planos** | o roadmap, as frentes de trabalho, as armas ainda não anunciadas ("Novas armas, novos papéis") |

O critério: *isto ensinaria alguém a copiar como fazemos, ou entregaria um roteiro de onde atacar ou criticar?* Se sim, é interno.

## 3. Como é garantido (não é boa vontade, é trava)

- **`scripts/site/vitrine.mjs`**: uma lista de termos proibidos (infraestrutura, segurança, processo) conferida sobre o **texto visível** de cada página pública. Roda no `npm run check` (dentro do `site.mjs --check`) **e** no `--verify` depois da publicação: se um termo aparecer, o check reprova e o site não vai ao ar.
- **`server/vitrine.test.ts`**: prova que a versão pública da página do esquadrão não leva as seções, os números nem o texto de processo (e que a interna leva tudo), e que o `site.mjs` chama a guarda.
- **Duas versões na mesma fonte:** `scripts/site/sala.mjs` e `scripts/oficina.mjs` montam a pública e a interna (`modo` / `--interno`). Nada interno é perdido: só deixou de ir ao ar.
- **O código do jogo** é entregue ao navegador de quem joga e não dá para esconder; o que se controla é que **não vá com mapa de fontes**: conferido em 21/10, o bundle publicado não traz `sourceMappingURL` e o `.map` responde 404.

## 4. Como o Comandante vê o interno

`npm run painel -- --interno` gera `.tmp/painel/sala-interna.html` (a sala de controle completa) e `node scripts/oficina.mjs --interno` gera `.tmp/painel/oficina-interna.html` (a oficina com o mapa da arquitetura e a saúde técnica). **Só no PC do Comandante**, nunca no site. O acesso interno **com login de administrador** (a Mesa de decisões, sem precisar de arquivo nem de comando) é o próximo PR.

## 5. O que não dá para recolher

As páginas antigas ficaram públicas por semanas: **cópias que terceiros tenham feito** (arquivos da web, buscadores, capturas) não se recolhem. O histórico do git é privado e não foi afetado. Por isso a regra vale daqui para a frente e a guarda existe: a próxima página que vazar não chega ao ar.
