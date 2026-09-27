# FICHA · BLASTER LEVE (`blaster`)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Números copiados de `client/src/combat/weapons.ts`; arma base do A-1 pilotado.

## 1. Identidade
- **Tipo:** energia, tiro ilimitado limitado pelo calor.
- **Encaixe:** braço direito do andróide pilotável.
- **Papel:** manter pressão leve de média distância sem competir com armas de Mech.

## 2. Fantasia de jogo
- **Atirar é:** disparar pulsos leves e precisos enquanto se aproxima.
- **Levar é:** dano frequente, porém baixo contra blindagem.
- **Contramedida:** manter distância e usar a vantagem de alcance e massa do Mech.

## 3. Números do MK I

| Campo | Valor | Observação |
|---|---:|---|
| Dano | 4 | por tiro |
| Intervalo / tiros por segundo | 0,40 s / 2,5 | energia |
| Calor por tiro | 12% | do dissipador do A-1 |
| Velocidade | 120 m/s | projétil |
| Alcance ótimo / máximo | 25 / 120 m | cai a 50% no máximo |
| Explosão / carregador / recarga | 0 m / — / — | sem explosão nem munição |
| Massa | 0,5 t | MK I; ocupa pouco da carga de 3 t do A-1 |

## 4. Equilíbrio
- A oficina estima 36 s de fogo perfeito contra torso de Mech com 300 HP; mantém o papel de arma leve.
- Os níveis seguem `TIERS`; aprovar carga e calor antes de liberar em progressão.

## 5. Visual (proposta Codex)
- **Modelo:** emissor curto e leve integrado ao antebraço do A-1; preservar escala humana.
- **Boca e tiro:** pulso verde para piloto, vermelho para rebelde, proporcionalmente menor que o plasma do Mech.
- **MK I / II / III:** I bocal simples; II aro de foco; III pequeno capacitor/indicador aceso. Só cosmético: mesma boca de tiro e hitbox.

## 6. Som (Gemini)
- Pulso agudo e curto, mais leve que o canhão de plasma; impacto discreto.

## 7. Custo e riscos
- Usa o sistema/pool de projéteis atual; emissor cosmético criado ao equipar, sem alocação por quadro.
- Risco: contraste insuficiente entre arma leve e tiros de Mech; validar em combate e nas cores por facção.

## 8. Perguntas para o dono
1. Aprova o blaster como arma de pressão/assédio, mantendo dano baixo contra Mechs?
