# SPECS: Audio — CYBERMECH

Sistema de som: efeitos sintetizados, 3D posicional, mixagem e volume.
> **Aviso (01/10):** os números de CPU, rede e memória desta ficha são estimativas de redação, sem medição no repositório que os sustente. Valem como ordem de grandeza até alguém medir; a verdade medida mora em `STATUS_REAL.md`, nos testes e em `ArenaRoom.tickMs`. Auditoria pendente.

## Objetivo

`AudioSystem.ts` gerencia efeitos sonoros (tiro, impacto, passos, explosão, motosserra) sintetizados com `AudioContext` (nada de `.wav`). Suporta 3D posicional (som vem de onde o inimigo está), atenuação por distância, múltiplos canais com volume independente.

## Decisões de Design

| Decisão | Razão | Trade-off |
|---|---|---|
| Síntese em vez de samples | Zero downloads, customizável, determinístico | CPU na síntese (~1 ms/som) |
| 3D posicional com PannerNode | Imersão, direção do inimigo | Fone: difícil localizar altura |
| Volume por canal (SFX, música) | Mixer separado, fácil de ajustar | Configurações guardadas em localStorage |
| Carregamento assíncrono de contexto | Não bloqueia boot | Primeiro som pode trajar (mitigado: pré-sintetizar) |

## Contrato

```ts
// AudioSystem.ts
class AudioSystem {
  // Efeitos
  playShot(position: Vector3, weapon: WeaponType): void
  playImpact(position: Vector3, part: Part): void
  playFootstep(position: Vector3, weight: "light" | "heavy"): void
  playExplosion(position: Vector3, radius: number): void
  
  // Controles
  setVolume(channel: "sfx" | "music", level: 0..1): void
  mute(channel: string): void
}

// Synthes
interface SynthSpec {
  frequency: number
  duration: number
  envelope: { attack, decay, sustain, release }
  filter?: { type, frequency, Q }
}
```

## Custo

- **CPU:** ~1 ms por síntese (3-4 Mechs disparando = 4 ms)
- **Memory:** ~100 KB (AudioContext, buffers de síntese)
- **GPU:** Nenhum (tudo é Audio API)
- **Render:** Nenhum (audio não renderiza)
- **Upload:** 0 KB (nenhum arquivo de som)

## Testes

**Arquivo:** `client/src/audio/AudioSystem.test.ts` (15+ casos)

**Cobertura:**
- ✅ Síntese de tons (frequência, duração)
- ✅ Envelope ADSR (ataque, queda, sustento, liberação)
- ✅ 3D posicional (PannerNode actualiza)
- ✅ Atenuação por distância (som fica quieto longe)
- ✅ Volume por canal (SFX vs música)
- ✅ iOS/navegadores com autoplay bloqueado (retry com interação)

**Regressão:** Sínteses fixadas; mudança = auditar qualidade.

---

## Conhecimento

**Ligado:**
- `GameMode.ts` (eventos de tiro, impacto)
- `Match.ts` (posição de Mechs)
- `Settings.ts` (volume guardado)
- Sínteses próprias (sem Tone.js, puro Web Audio)

**Achados (R17):**
- ✅ Síntese sem samples: passos pesados de Mech vs andróide, sons diferem muito
- ✅ PannerNode stereo: som vem de um lado, localização clara com fone
- ⚠️ iOS bloqueia AudioContext sem interação do usuário (workaround: resume() no clique)

---

## Próximos Passos

**Aberto:**
- Música de fundo (ambiência)
- Efeitos de ambiente (eco, reverb)
- Localização 3D em altura (difícil com estéreo)
- Compressor de dinâmica (para evitar picos)

**Não é bloqueador:**
- Áudio é enhancement, funciona sem (jogo mudo é aceitável)

---

*Versão 1.0 | 2026-10-01 — Spec de referência*
