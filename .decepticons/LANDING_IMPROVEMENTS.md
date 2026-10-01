# Melhorias de Landing Pages — CYBERMECH

Recomendações de refactor para concisão e impacto (executadas em iterações).

## Audit de Prolixidade

### Seção "Features" (O que você encontra)

**Problema:** Muitas frases descritivas longas (20+ palavras). Remover pronomes e explicações óbvias.

**Exemplos a editar:**
- ❌ "Arranque uma perna e o inimigo manca; as duas e ele para; destrua a cabeça e ele fica cego."
- ✅ "Perna: o inimigo manca. Cabeça: fica cego."

- ❌ "Mais chato do que perigoso: cai com 2 tiros de plasma ou 2 pisões de Mech."
- ✅ "2 tiros derrubam. 2 pisões também."

**Métrica:** Reduzir de 17 features a 12–14, mantendo os diferenciadores reais.

---

### Seção "Hangar" (Monte o seu Mech)

**Problema:** O lede tem 70 palavras. Reduzir para 20–30.

- ❌ "O Hangar é onde o Mech é montado: chassi, uma arma em cada braço, módulos nos ombros. Toda arma tem três níveis de poder com a mesma regra, e todo poder pesa: quem monta escolhe onde gastar. Na luta, quem decide continua sendo o piloto. Os números abaixo são lidos do código do jogo a cada versão."
- ✅ "Monte seu Mech: chassi, armas, módulos. Todo poder pesa. A luta decide quem vence. Números lidos do código em tempo real."

---

### Seção "Online" (Salas de 8 pilotos)

**Problema:** Lede repetitivo (já explicado na introdução). Focar em "como jogar agora".

- ❌ "O multiplayer está sendo montado em etapas. O servidor decide o que importa (dano, calor, quem caiu), o seu Mech responde na hora, e cada etapa só entra quando os testes provam que ela cabe na conexão de um celular."
- ✅ "Servidor decide tudo. Você controla o Mech. Testado em conexão fraca."

---

### Seção "Sem Pay-to-Win"

**Problema:** 5 pledges, some redundantes. Reduzir a 3.

**Manter:**
- Nada que se compra ganha partida
- Anúncio (se houver) só entre rodadas
- Cosmético, nunca atributo

---

## Hierarquia Visual

**Adicionar:**
- Resumo executivo em 3 linhas acima do hero
- Badges visuais (SOLO / ONLINE / MOBILE) perto de cada seção
- Ticker "X% da Fase 5 pronto" acima de "O que está sendo construído"

---

## Próximos Passos

1. **Fase B1:** Editar `landing.mjs` linhas 264–338 (features)
2. **Fase B2:** Condensar `hangarHtml` (linhas 427, 480)
3. **Fase B3:** Revisar `onlineHtml` e `pledgeHtml`
4. **Validação:** `npm run site -- --check` ✅

---

*Status: Recomendações, não implementadas. Executar em iterações paralelas com FRENTE C.*
