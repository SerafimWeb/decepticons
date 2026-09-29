# FICHA · COLOSSUS-01 (máquina de cerco)

> **Status:** proposta visual implementada · **Autor:** Codex · **Data:** 2026-09-28
> O dono definiu o Colossus-01 como o primeiro boss de **escala 3**. Esta ficha fixa a escala e a silhueta; vida, ataques, IA e disponibilidade no Hangar entram no encontro offline, com testes de simulação próprios.

## 1. Identidade

- **Nome e código:** COLOSSUS-01 (`colossus01` no blueprint)
- **Escala:** 3, **14 m**. É 2,64 vezes a altura do Vector-09 (5,3 m).
- **Classe:** máquina de cerco / boss.
- **Lado inicial:** IA rebelde; candidatura futura a modo assimétrico pilotável.
- **Papel em uma frase:** dominar espaço, obrigar o esquadrão a circular e expor fraquezas antes do golpe decisivo.

## 2. Fantasia de jogo

- **Enfrentar é:** ficar pequeno perto de uma máquina que ocupa a rua, procurar as costas e aproveitar janelas de calor.
- **Pilotar depois é:** comandar massa, abrir caminho e escolher quando expor as próprias fraquezas; não entra no Deathmatch ou CTF normal.
- **Fraqueza clara:** giro e reposicionamento lentos; núcleo frontal e respiros traseiros precisam ficar expostos por ataques e superaquecimento.

## 3. Silhueta e visual (Codex)

- **Silhueta em 3 palavras:** monumental, largo, industrial.
- **Blueprint:** `COLOSSUS_01_BLUEPRINT` em `entities/mechBlueprint.ts`.
- **Estrutura:** base larga, pernas distantes para leitura e circulação, torso alto, ombros quase do tamanho de um Vector-09 e mochila com cinco respiros por lado.

| Parâmetro | Valor |
|---|---:|
| Altura de referência | 14 m |
| Torso | 5,8 × 3,8 × 4,2 m |
| Pernas | segmentos de 3,05 / 2,85 m; pés de 3,25 m |
| Ombreiras | 2,25 × 1,75 × 2,15 m |
| Respiros | 5 por lado |
| Orçamento | 10 draws por rig, incluindo vapor; sem textura externa |

- **As seis partes continuam separadas?** Sim: cabeça, torso, dois braços e duas pernas ainda têm pivôs próprios; a regra existente pode ocultar uma parte quando ela for destruída.
- **Custo no frame:** a fusão de geometria acontece uma vez ao montar o rig. O Colossus não cria objetos nem geometria no quadro; o rig completo fica em 10 draws, igual ao teto dos Mechs atuais.

## 4. Contrato do encontro offline

O primeiro encontro não altera as regras atuais. Ele terá módulo próprio e determinístico, pré-alocará o boss e só usará callbacks para HUD, efeitos e som.

- **Feito (Qwen, 28/09; equilibrado em 29/09):** cápsula, vida por parte e velocidade estão em `chassis.ts` (`COLOSSUS_BOSS_STATS`: 14 m, raio 3,6 m, 5 m/s, sem pulo nem dash, **pernas 450 e torso 1 200**); o pool é pré-alocado no `BotSystem` com **vaga própria** no recorte da onda; e ele é dirigido pela IA comum com o **perfil de cerco** (`BOSS_PROFILE`: ataca a 46 m, **não desvia** e erra mais de propósito — `aimErrorScale` 1.8). É o fecho da onda 6 da Sobrevivência offline (atalho `?modo=survival&onda=6`), nasce em ponto dedicado (testado para a cápsula de 14 m) e o **painel do alvo** mostra as partes e o calor dele.
- **Combate justo, medido por teste (dono, 29/09 — *"não pode ser absurdamente forte... pra termos combates épicos e com inteligência"*):** cada **perna cai em até 10 s** de gatilho apertado e o **torso em até 30 s**; as duas pernas juntas caem **antes** do torso, que é o caminho da vitória desta ficha. O dano por tiro é o do plasma de qualquer rebelde — **sem arma exclusiva** — e o **duelo medido** (IA de verdade, tiro que viaja) mostra um piloto **parado no aberto aguentando mais de 20 s**: o que o Colossus impõe é **espaço e o pisão**, não execução. As faixas estão travadas em `combat/colossusBalance.test.ts` e `combat/colossusBoss.test.ts`.
- **Consequência assumida:** com o dobro da altura de um Vector-09, ele **esmaga um Mech parado em dois passos** — é a mesma regra do pisão, agora com o maior de todos.
- **Falta:** máquina de fases própria (hoje a IA é a comum, com perfil de cerco), pontos fracos/respiros, arma assinatura, HUD de chefe e o modo assimétrico online.

## 5. Caminho para pilotar

Após o encontro ser validado, o Colossus entra primeiro em sandbox/Hangar. O modo online será assimétrico: um Colossus contra uma equipe, **com vários jogadores na mesma máquina — um por arma ou papel** (mísseis, metralhadoras, lança-chamas, recuperação), como o dono decidiu em 28/09; piloto e artilheiro são os dois primeiros postos. Ele não entra nas salas normais enquanto mapa, câmera e rede não tiverem sido medidos para isso.

## 6. Som (Gemini)

- Passos lentos e graves, audíveis como aviso de ataque.
- Sirene de respiro/núcleo antes dos ataques; som de placas arrancadas por parte.

## 7. Decisões fechadas e abertas

- **Fechado pelo dono:** Colossus-01 é escala 3, 14 m, primeiro boss e futuro chassi de modo próprio — **encontro primeiro e, depois, jogável com tripulação** (28/09).
- **Nota de escopo:** o pesado de escala 2 (~6,5 m) **continua existindo** como blueprint visual (`HEAVY_MECH_BLUEPRINT`), mas esta ficha, que era dele, passou a descrever o Colossus; se o pesado voltar a ter ficha, é ficha nova.
- **Aberto:** assinatura de arma, valores de combate, fases, **quantos jogadores** operam a máquina e o momento em que ela será selecionável no Hangar.
