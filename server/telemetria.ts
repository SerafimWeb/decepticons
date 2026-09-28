/**
 * Agregador de métricas de produto (contrato em `shared/net/telemetry.ts`). Fica fora do `Server.ts` pelo
 * mesmo motivo do `guard.ts`: o teste bate direto no algoritmo, sem subir HTTP.
 *
 * **Memória limitada de propósito:** 24 baldes de 1 hora por evento (não uma lista de eventos crus que
 * cresce para sempre) e um balde de taxa por IP que se limpa sozinho. Um servidor de pé por semanas não
 * acumula nada proporcional ao tráfego — só `9 eventos × 24 horas` números e `1 balde por IP visto na
 * última hora`.
 */
import { EVENTOS, type EventoNome, type ResumoEventos } from '../shared/net/telemetry';

const HORAS = 24;
/** Fichas por IP: no máximo 30 eventos guardados, recarregando 0,5/s (~30/min) — generoso para um funil
 * de UI (poucos cliques por pessoa), curto o bastante para não valer a pena forjar volume. */
const BALDE_TETO = 30;
const BALDE_RECARGA_POR_S = 0.5;
/** Baldes de IP sem uso por mais que isto somem, para o mapa não crescer para sempre. */
const BALDE_EXPIRA_MS = 60 * 60 * 1000;

type Balde = { tokens: number; refilled: number };

export class Telemetria {
  private readonly total: Record<EventoNome, number>;
  private readonly porHora: Record<EventoNome, number[]>;
  private horaIdx = 0;
  private horaEpoch: number;
  private readonly baldes = new Map<string, Balde>();
  private readonly startedAtIso: string;

  constructor(now = Date.now()) {
    this.total = Object.fromEntries(EVENTOS.map((e) => [e, 0])) as Record<EventoNome, number>;
    this.porHora = Object.fromEntries(EVENTOS.map((e) => [e, new Array(HORAS).fill(0)])) as Record<EventoNome, number[]>;
    this.horaEpoch = Math.floor(now / 3_600_000);
    this.startedAtIso = new Date(now).toISOString();
  }

  /** Um evento chegou de um IP. `'ok'` conta; `'taxa'` significa que esse IP já mandou demais na última hora. */
  registrar(nome: EventoNome, ip: string, now = Date.now()): 'ok' | 'taxa' {
    this.girarHoras(now);
    if (!this.consumirFicha(ip, now)) return 'taxa';
    this.total[nome]++;
    this.porHora[nome][this.horaIdx]!++;
    return 'ok';
  }

  /** O que `GET /eventos/resumo` devolve: só contagens, nunca eventos individuais nem IPs. */
  resumo(now = Date.now()): ResumoEventos {
    this.girarHoras(now);
    const janela24h = {} as Record<EventoNome, number>;
    for (const nome of EVENTOS) janela24h[nome] = this.porHora[nome]!.reduce((a, b) => a + b, 0);
    return { desde: this.startedAtIso, janela24h, total: { ...this.total } };
  }

  private girarHoras(now: number): void {
    const horaEpoch = Math.floor(now / 3_600_000);
    if (horaEpoch === this.horaEpoch) return;
    // Servidor dormiu horas/dias: zera no máximo os 24 baldes (não um loop proporcional ao tempo parado).
    const passos = Math.min(HORAS, horaEpoch - this.horaEpoch);
    for (let i = 0; i < passos; i++) {
      this.horaIdx = (this.horaIdx + 1) % HORAS;
      for (const nome of EVENTOS) this.porHora[nome]![this.horaIdx] = 0;
    }
    this.horaEpoch = horaEpoch;
  }

  private consumirFicha(ip: string, now: number): boolean {
    // Limpeza preguiçosa: a cada ~200 IPs novos, tira quem não aparece há mais de 1h (evita crescer para sempre
    // sem varrer o mapa inteiro a cada request).
    if (this.baldes.size > 200 && this.baldes.size % 50 === 0) {
      for (const [k, b] of this.baldes) if (now - b.refilled > BALDE_EXPIRA_MS) this.baldes.delete(k);
    }
    let b = this.baldes.get(ip);
    if (!b) {
      b = { tokens: BALDE_TETO, refilled: now };
      this.baldes.set(ip, b);
    }
    const dt = Math.max(0, now - b.refilled) / 1000;
    b.tokens = Math.min(BALDE_TETO, b.tokens + dt * BALDE_RECARGA_POR_S);
    b.refilled = now;
    if (b.tokens < 1) return false;
    b.tokens--;
    return true;
  }
}
