# FICHA · CTF (Vermelho × Azul)

> **Status:** proposta · **Autor:** Qwen (a pedido do dono, 27/09/2026, pelo pedido do Gemini: "crie os testes de
> simulação do CTF") · **Data:** 2026-09-27
> **O que esta ficha é:** as **regras que os testes vão travar** — a lista de testes da § 4 é o entregável pedido.
> **O que ela não é:** o código (Claude), o HUD (Gemini) e a bandeira/efeitos em 3D (Codex).
> **O que o dono já decidiu** (`ROADMAP.md`, Fase 5): "duas equipes, **uma bandeira em cada base**, `sim/Match.ts`
> com times; **ganha a primeira equipe a capturar 3 vezes ou a com mais capturas em 8 min**. Balanceado pra bandeira
> + Mech pesado ficar em risco simétrico ao Mech leve com dash." Começa em **2v2**.

## 1. Por que esta ficha existe antes de um teste
**Os testes do CTF não podem ser escritos antes da regra.** G14 (toda regra de gameplay tem teste de simulação) e a
regra 5 do `AGENTS.md` (contrato antes de paralelizar) dizem a mesma coisa por dois ângulos: o teste nasce **no PR
que cria a regra**, contra o contrato já fixado. Conferido em 27/09/2026: `client/src/sim/` **não tem** nenhuma
ocorrência de `team`, `CTF`, `flag` ou `bandeira` — não existe time, base nem bandeira no jogo. Escrever os `it()`
hoje daria um arquivo vermelho, ou pior: um teste que passa sem testar nada (o vício que a revisão do MissionHUD
apontou). Então o que entrego aqui é a **especificação de cada teste** — o nome, o que ele monta e o que ele prova —
para o Claude implementar regra e teste no mesmo PR (ou para eu escrever os `it()` logo atrás do contrato dele,
como combinado nas outras frentes).

## 2. As regras (o que a partida faz)
- **Times:** dois, **Vermelho e Azul**, iguais em número. 2v2 no primeiro corte (decisão do dono).
- **Bandeiras:** uma por time, nasce na **base** dele. A bandeira inimiga é o objetivo; a própria é o que se defende.
- **Pegar:** por **proximidade** (raio curto, encostar), nunca por tiro. Quem é do time da bandeira **não** a carrega.
- **Carregar:** a bandeira passa a viajar com quem a pegou; o portador fica **mais lento** (proposta: −15% de
  velocidade no chão; o dash continua) — é a alavanca que realiza o que o dono pediu: **o Mech pesado com a bandeira
  corre o mesmo risco que o Mech leve com dash**. Sem isso, o CTF vira "quem tem dash pega e volta".
- **Soltar:** o portador abatido **larga a bandeira onde caiu**. A bandeira largada **volta à base** depois de
  `T` s (proposta: **15 s**) ou quando alguém do time dela toca nela — o que vier primeiro.
- **Capturar:** levar a bandeira inimiga até a **sua base**, **com a sua própria bandeira em casa**. Sem a própria
  bandeira na base, encostar não pontua (senão a partida é uma corrida de ida e o "defender" deixa de existir).
- **Ponto:** a captura devolve as duas bandeiras às bases e soma 1 ao time.
- **Fim:** primeira equipe a **3 capturas** vence na hora; sem isso, aos **8 min (480 s)** vence quem tem **mais
  capturas**; empate em capturas desempata por **abates**; empate nos dois é empate.
- **Abate não pontua captura.** O placar tem as duas colunas, e a partida se decide pela primeira.

## 3. O que isso custa (banda e CPU)
Mesma regra das zonas e da base do drone: **só o que se move precisa de bytes por tick.**
- **Bandeira na base / largada no chão:** posição fixa do mapa → **0 B/s de estado**; pegar, soltar, devolver e
  capturar são **eventos** (um `FLAG_*` e o `CAPTURE`), não campos por tick.
- **Bandeira carregada:** **0 B/s a mais** — ela viaja junto do portador, cujo estado já vai na rede a 20 Hz; o que
  entra é **um bit de bandeira** nas flags de quem a carrega. O byte de flags usa 4 dos 8 bits hoje; **bandeira nova
  nas flags = subir `PROTOCOL_VERSION`** (por desenho o servidor recusa cliente de versão diferente).
- **Time:** contadores do placar viajam por **evento** (`CAPTURE`), como o placar do servidor já faz.
- **CPU:** por tick, a colisão de bandeira é um **raio** contra as bandeiras (2) e não contra a cena. Nada de física
  nova, nada de alocação por tick.

## 4. Os testes (cada linha é um `it()`)
1. **"Partida com times exige dois times com bandeira":** montar um `Match` de CTF sem time, ou com time sem
   bandeira na base, falha no contrato (não deixa a partida começar torta).
2. **"Cada bandeira começa na base do seu time."**
3. **"Encostar pega: quem está a ≤ raio da bandeira inimiga a carrega; quem está fora do raio não."**
4. **"O time da bandeira não carrega a própria bandeira."**
5. **"Abater o portador solta a bandeira onde ele caiu"** — e ela não volta à base no mesmo tick.
6. **"Bandeira largada volta à base em 15 s, ou quando alguém do time dela encosta"** — o que vier primeiro.
7. **"Sem a própria bandeira em casa, encostar na base com a inimiga não pontua."**
8. **"A captura devolve as duas bandeiras às bases"** (a capturada e a própria, que estava largada).
9. **"Abate não é captura":** o placar de abates sobe, o de capturas não.
10. **"A 3ª captura encerra a partida na hora"**, com o vencedor no `MATCH_END`.
11. **"Aos 480 s vence quem tem mais capturas; empate em capturas desempata por abates; empate nos dois é empate."**
12. **"O portador corre mais devagar"** — e o teste que o dono pediu: **o tempo de exposição do portador**
    (do pegar até pontuar ou cair) **é próximo entre o chassi leve e o pesado** (mesma janela, dentro de uma
    tolerância declarada no teste: é a simetria que ele pediu, travada por número).
13. **"A bandeira não vaza estado":** o estado de 20 Hz não ganha campo novo; a bandeira carregada é **um bit** no
    portador; base e bandeira no chão são fixas. (Teste de orçamento, em `shared/net`, junto dos que já existem.)
14. **"É determinístico":** mesma semente e mesmos inputs → mesmos instantes de captura e mesmo vencedor.
15. **"O servidor decide":** captura nasce do servidor, nunca do cliente (mesma autoridade do resto do online).

## 5. Divisão e o que falta
- **Claude:** times e regras em `sim/Match.ts` + os testes da § 4 (pedido do Gemini já em curso). O contrato de times
  é o primeiro pedaço — todo o resto (HUD, visual, testes) depende dele.
- **Gemini:** HUD do CTF (placar Azul × Vermelho, indicador de bandeira: quem carrega, onde está a nossa) — já pedido.
- **Codex:** bandeira e bases em 3D, e o efeito da captura — já pedido.
- **Qwen:** esta ficha e a § 4; depois, revisão de balanço com o CTF existindo (a tabela de preços e o relógio da
  partida são decisão de dono, medida na simulação).

## 6. Perguntas para o dono
1. **A arena de hoje é pequena para 3 capturas em 8 min.** Ou o mapa cresce (duas bases afastadas), ou o número cai
   para 2 capturas, ou a partida fica mais curta. Qual dos três?
2. **Respawn durante a partida:** 2v2 sem respawn vira xadrez; com respawn rápido (proposta: 5 s) a partida flui.
   Confirma o respawn?
3. **Bandeira largada:** volta em 15 s (proposta) ou só quando alguém do time dela tocar?
4. **O portador perde velocidade (−15% proposto)**, só o dash, ou nada além do risco de estar marcado?
5. **Bots completam os times** no primeiro corte (2v2 exige quatro pessoas no servidor; hoje há bots no jogo)?
6. **Placar:** só capturas, ou capturas + abates (decide o desempate e o que o HUD mostra)?
7. **Empate aos 8 min:** prorrogação de "próxima captura vence" ou empate declarado (o placar mostra empate)?
