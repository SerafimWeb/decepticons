# AUDITORIA DE SONS — o que existe, o que falta e a pauta do Estúdio (P316, 06/11)

> **Pedido do Comandante (06/11):** *"auditoria de melhoria nos SONS: adiante os trabalhos dos sons das armas, trilha sonora, efeitos sonoros, pois amanhã eu vou entrar no estúdio pra testar e finalizar todos esses arquivos"*, com a direção de timbre dos sintetizadores do Kraftwerk, do Daft Punk, do Prodigy e dos videogames dos anos 80 e 90.
> **O Claude não ouve áudio.** O que esta auditoria entrega é o que se pode medir (o que existe, o que falta, o que está seguro) e candidatos para o ouvido do Comandante julgar. O gosto é dele.
> **Os números abaixo são de 06/11/2026, lidos do repositório.** Para refazer: `armasSom.json`, `vozesGeradas.json`, `npm run sons-retro -- --listar`.

## 1. O que existe

| Camada | O que há | Estado |
|---|---|---|
| **Armas** (23) | 11 com amostra do Estúdio (`armasSom.json`); 5 com síntese própria (arco, gelo, canhão automático, sônico, laser); 3 de laço ou corpo a corpo (rotatória, lança-chamas, motosserra); **4 sem som nenhum: lançador de gás, canhão de trilho, lançador EMP e escopeta caem no tiro genérico do blaster** | as 4 sem som são a lacuna mais barata de fechar: há candidato para cada uma no kit retrô (§ 4) |
| **Narrador** (19 falas × 4 sotaques) | o catálogo está pronto; o manifesto de vozes tem **1 fala por sotaque** (só o "Combate!"); as 9 rodadas caem na **voz robótica do navegador** (só em português) e **9 ficam realmente mudas** (abates 2 a 6, "Você morreu", "Hostis chegando", "Estação segura", "A rede caiu") | **a lacuna mais audível do jogo**: é o feedback que o jogador mais ouve. As falas estão no roteiro (§ 5) e na lista do Estúdio |
| **Rádio de campo** | novo (P316): 189 falas em 7 canais, só português, na voz do Comandante (`radio.json`) | catálogo, roteiro e Estúdio prontos; **nenhuma gravada e o jogo ainda não as toca** |
| **Música** | a de combate é sintetizada no navegador (P315: Lá menor, 108 BPM, sobe com a ação); a trilha do 8 de Janeiro (berrante e trompetista) | **sem música nos menus; sem mixagem** (a música não abaixa quando o narrador fala) |
| **Efeitos do mundo** | impacto, explosão, passos, pulo, investida, sirene, contagem, sequência de abates, estados (gelo, choque, fogo): todos sintetizados em `AudioSystem.ts` | sem amostra; nada medido de "gosto" |
| **Arquivos antigos** (`client/public/audio/`, 11 arquivos, 3,8 MB) | todos carregados no `Game.ts` na abertura (vinheta, ambiente, passos, tiros antigos) | em uso; ~2 MB baixam na abertura (candidato a sob demanda, fora desta auditoria) |

## 2. As lacunas, por ordem de peso

1. **O narrador quase sem voz** (9 falas mudas e 9 na voz robótica do navegador). Gravar amanhã: **roteiro § 5**. É o maior ganho por minuto de estúdio.
2. **As 4 armas sem som** (gás, trilho, EMP, escopeta). Escolher no Estúdio entre os candidatos `RETRO_*` e atribuir na tabela de armas.
3. **O rádio tocar no jogo.** Depende das falas gravadas; o gancho já existe (`Match.onFala` entrega o lado: aliado ou inimigo). PR seguinte.
4. **Mixagem:** abaixar a música quando alguém fala (narrador, rádio, chat de voz). PR seguinte.
5. **Música de menu e variedade de trilha:** dois candidatos de 4 compassos no kit (`tema_menu`, `tema_combate`).
6. **Aviso de míssil travado:** não existe hoje; há a fala (`rd_sistema_alerta_2`) e o bipe (`alerta_missil`) para quando o jogo tiver o evento do travamento.

## 3. A direção sonora: das referências à técnica

As referências são **técnicas**. Nunca amostra, melodia ou letra de ninguém (e as faixas comerciais que estão em `.tmp/SOUNDS/` são só para ouvir: não entram no jogo).

| Referência | A técnica que se aproveita | Onde entra |
|---|---|---|
| **Kraftwerk** (máquina, precisão, voz de computador, rádio e números) | voz com modulação em anel, sem emoção; sequências repetidas e exatas; bipes de rádio | tratamentos **Robô retrô** e **Androide**; o canal **COMPUTADOR DE BORDO**; `tema_menu`; os bipes `comms_abrir` e `comms_fechar` (2525 e 2475 Hz) |
| **Daft Punk** (vocoder, talkbox, varrido de filtro, bumbo que bombeia) | phaser, voz com formante, serra com filtro, bumbo de seno | tratamentos **Talkbox** e **Grande Irmão**; as leituras `rave` das armas |
| **Prodigy** (serra distorcida, quebra de ritmo, ruído agressivo) | distorção pesada, "stab" curto de acorde, caixa e chimbal em quebra | `tema_combate`; o canhão e o cerco na leitura `rave`; tratamento **Interceptação** |
| **Videogames de 8 bits** (pulso, triângulo, ruído de 15 bits; arcades) | onda de pulso com *duty*, ruído do LFSR, bitcrush, varredura de frequência | as leituras `8bit` de todas as armas; tratamento **Chip 8-bit**; `acerto`, `explosao`, `fanfarra_rodada` |

## 4. O kit retrô (`npm run sons-retro`)

**O que é:** um sintetizador por código (`scripts/retroSynthLib.mjs`) que gera **72 candidatos** (36 sons × 2 leituras: `8bit` e `rave`) como `RETRO_<som>_<leitura>.wav`. Um por arma (as 23), mais impacto (`explosao`, `acerto`), comando e aviso (`comms_abrir`, `comms_fechar`, `alerta_missil`, `radar_ping`, `aviso_calor`), movimento (`dash`, `reaparecer`) e **trilha** (`fanfarra_rodada`, `sequencia_abate`, `tema_menu`, `tema_combate`: 4 compassos exatos, em laço).

**Como usar:** `npm run sons-retro` grava em `.tmp/SOUNDS/ARMAS/` (as 72 já estão lá desde 06/11). No Estúdio, aba **SONS**, eles aparecem na lista de referências com o prefixo `RETRO_`: abra um, corte, trate (os efeitos novos **robô**, **bitcrush** e **fase** também valem aqui), salve como clipe e atribua à arma na tabela. **Escolher entre `8bit`, `rave` e o som de hoje é o seu ouvido.**

**O que está garantido (testado, `server/retroSynth.test.ts`):** cada som é finito, sem estourar (pico em −1 dBFS), nunca em silêncio, sem clique nas pontas, determinístico (mesmos bytes sempre), e as duas leituras são sons diferentes; o "pew" realmente cai de frequência, o bumbo é grave, os bipes de rádio estão em 2525 e 2475 Hz, os temas têm exatamente 4 compassos a 108 BPM. **O que não está garantido:** que soem bem. Isso só o ouvido diz.

## 5. A pauta do Estúdio de amanhã (duas sessões)

**Sessão 1: o que o jogador mais ouve (uns 40 minutos).**
1. **Narrador** (roteiro § 5, 19 falas, sotaque Brasileiro): grave primeiro as 9 mudas e as 9 rodadas (que hoje usam a voz robótica do navegador). Comece por **Rodada um a nove** (grave e firme) e **Você morreu**; deixe as de grito (**Combate!**, **Abate duplo** a **Lendário**) para o fim da sessão.
2. **Armas** (aba SONS): ouça os `RETRO_*` das **4 armas sem som** (gás, trilho, EMP, escopeta) e atribua. Depois, se quiser, compare os `8bit` e `rave` com o som atual de cada uma das outras.

**Sessão 2: o rádio de campo (roteiro § 6; umas 3 horas se for tudo).** Grave **primeiro as falas com ★** (as 22 que já têm, no jogo, o evento que as dispara; o jogo ainda não as toca), do canal mais calmo para o mais gritado: Controle, Computador de bordo, Pilotos, Rádio inimigo interceptado, Androides, IAs rebeldes e, por último, os Gritos. Cada fala tem o botão do tratamento sugerido destacado; os números são ponto de partida.

**Trilha:** ouça `RETRO_tema_menu_*` e `RETRO_tema_combate_*` e diga se algum serve de música de menu ou de combate; o Claude o põe no jogo (carregado sob demanda, fora do pacote de partida de 500 KB).

**Depois de salvar:** diga ao Claude **"publica os sons"**.

## 6. O que esta entrega NÃO faz (R13)

- **O jogo ainda não toca o rádio** nem o aviso de míssil, e **não troca nenhum som sintetizado** por um do kit: trocar som é decisão do ouvido do Comandante, feita no Estúdio.
- **Nada foi ouvido.** O Claude mede nível, pico, duração e forma; o gosto é do Comandante.
- **O Estúdio não gera música:** os dois temas são candidatos de 4 compassos, não uma trilha completa.
- **Mixagem** (abaixar a música sob a voz) e **música de menu no jogo** ficam para o PR seguinte.

## 7. Ligado a

`ROTEIRO_DE_GRAVACAO.md` (o roteiro, gerado) · `ESTUDIO.md` § 3.1 · `VOZES_E_SONS.md` § 7 · `VOCABULARIO_COMANDO.md` · `RADIO_E_EMISSORES.md` (o desenho dos emissores no mundo, ainda sem código) · `ORDENS_DO_COMANDO.md` P315 e P316.
