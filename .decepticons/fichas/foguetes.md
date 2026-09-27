# FICHA · CASULO DE FOGUETES (`rockets`)

> **Status:** proposta · **Autor:** Codex · **Data:** 2026-09-27
> Números copiados de `client/src/combat/weapons.ts`; o modelo atual mantém quatro tubos visíveis no Vector-09.

## 1. Identidade
- **Tipo:** munição com carregador e recarga automática.
- **Encaixe:** braço esquerdo do Vector-09.
- **Papel:** explosão lenta e previsível, útil para pressionar grupos e alvos em movimento se antecipados.

## 2. Fantasia de jogo
- **Atirar é:** soltar foguetes pesados em salvas, gerindo quatro disparos antes da recarga.
- **Levar é:** área de perigo que diminui ao afastar-se do centro.
- **Contramedida:** desviar do projétil lento e sair do raio da explosão.

## 3. Números do MK I

| Campo | Valor | Observação |
|---|---:|---|
| Dano no centro | 40 | por foguete |
| Intervalo / tiros por segundo | 0,30 s / ~3,33 | limitada pelo carregador |
| Calor por tiro | 18% | compartilhado com plasma |
| Velocidade | 75 m/s | dá tempo de reação à distância |
| Alcance ótimo / máximo | 225 / 225 m | não perde força pelo alcance antes de sumir |
| Explosão | 6 m | dano cai até zero na borda |
| Carregador / recarga por tiro | 4 / 2,2 s | sistema contínuo de recarga |
| Massa | 4 t | carga do Hangar |

## 4. Equilíbrio
- No combo, o calor comum impede disparar os dois braços sem pausa; valem as metas globais de `balance.ts` e seus testes.
- A munição lenta e a explosão radial deixam esquiva e posicionamento como contrajogo.

## 5. Visual (proposta Codex)
- **Modelo:** casulo blindado no antebraço esquerdo, quatro tubos na configuração atual do Vector.
- **Boca e tiro:** foguete laranja, rastro curto de fumaça e clarão de ignição reutilizando os pools existentes.
- **MK I / II / III:** preservar a leitura de quatro foguetes em todos os níveis; II ganha travessas/reforço; III, dissipador e indicadores mais brilhantes. Não aumentar munição por aparência.

## 6. Som (Gemini)
- Lançamento grave, passagem sibilante, explosão de baixa frequência; atenuar com distância.

## 7. Custo e riscos
- Reutiliza o pool de foguetes e o efeito de explosão existentes; sem luz por projétil. O número visual de tubos não deve sugerir munição diferente.

## 8. Perguntas para o dono
1. Quatro tubos continuam como assinatura do Vector em todos os níveis?
