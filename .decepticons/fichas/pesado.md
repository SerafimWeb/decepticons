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

- A cápsula, a vida por parte, a velocidade, os ataques e os pontos fracos ainda não estão em `chassis.ts`.
- A IA comum não dirige o Colossus; o próximo PR cria uma máquina de fases separada.
- O boss aparece como final da Sobrevivência offline antes de qualquer modo online.

## 5. Caminho para pilotar

Após o encontro ser validado, o Colossus entra primeiro em sandbox/Hangar. O modo online será assimétrico: um Colossus contra uma equipe, com piloto e artilheiro possíveis. Ele não entra nas salas normais enquanto mapa, câmera e rede não tiverem sido medidos para isso.

## 6. Som (Gemini)

- Passos lentos e graves, audíveis como aviso de ataque.
- Sirene de respiro/núcleo antes dos ataques; som de placas arrancadas por parte.

## 7. Decisões fechadas e abertas

- **Fechado pelo dono:** Colossus-01 é escala 3, 14 m, primeiro boss e futuro chassi de modo próprio.
- **Aberto:** assinatura de arma, valores de combate, fases, quantidade de jogadores do modo assimétrico e momento em que será selecionável no Hangar.
