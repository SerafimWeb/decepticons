# FICHA · CANHÃO DE PLASMA (`plasma`)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Números copiados de `client/src/combat/weapons.ts`; se divergirem, o código e `balance.ts` prevalecem.

## 1. Identidade
- **Tipo:** energia, tiro ilimitado limitado pelo calor do Mech.
- **Encaixe:** braço direito do Vector-09.
- **Papel:** tiro direto de médio/longo alcance, com dano que cai à distância.

## 2. Fantasia de jogo
- **Atirar é:** lançar pulsos rápidos, claros e legíveis, em rajadas.
- **Levar é:** receber um impacto pontual; procurar cobertura ou mudar a distância.
- **Contramedida:** mover-se, usar cobertura ou manter o combate além da faixa ideal.

## 3. Números do MK I

| Campo | Valor | Observação |
|---|---:|---|
| Dano | 16 | por tiro direto |
| Intervalo / tiros por segundo | 0,22 s / ~4,55 | regra via `FireTimer` |
| Calor por tiro | 7% | dissipador compartilhado |
| Velocidade | 140 m/s | projétil/raycast contínuo |
| Alcance ótimo / máximo | 60 / 200 m | dano cai linearmente após 60 m |
| Dano no máximo | 40% | some a 200 m |
| Explosão / carregador / recarga | 0 m / — / — | sem explosão, sem munição |
| Massa | 3 t | carga do Hangar |

## 4. Equilíbrio
- Referência atual de `balance.ts`: MK I derruba torso 300 HP em cerca de 6,2 s no cenário de fogo perfeito usado pela tabela de balanço.
- Aplicam-se os limites globais testados: nenhuma arma abaixo de 4,5 s sozinha; MK III entre 10% e 40% mais rápida que MK I; menor dano por tonelada em níveis altos.

## 5. Visual (proposta Codex)
- **Modelo:** cano frontal compacto e bobina/coletor atrás do emissor, preso ao antebraço direito.
- **Boca e tiro:** núcleo verde do jogador (`GLOW.friendlyPlasma`) ou vermelho do inimigo (`GLOW.hostilePlasma`), com rastro do sistema de projéteis.
- **MK I / II / III:** I emissor simples; II anel de contenção adicional; III bobina maior e respiros acesos. Preservar o mesmo ponto de tiro e hitbox; variação só cosmética.

## 6. Som (Gemini)
- Disparo curto e energético; impacto seco; variações de distância já seguem o sistema de áudio.

## 7. Custo e riscos
- Reutiliza o pool de projéteis existente (64); nenhuma luz dinâmica por tiro. Alterar geometria do rig só em `equip`, fora do loop de render.

## 8. Perguntas para o dono
1. Aprova emissor/cor por facção (verde aliado, vermelho rebelde) e três níveis cosméticos sem mudança de regra?
