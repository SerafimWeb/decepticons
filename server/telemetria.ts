/**
 * Agregador de métricas de produto (contrato em `shared/net/telemetry.ts`). Fica fora do `Server.ts` pelo
 * mesmo motivo do `guard.ts`: o teste bate direto no algoritmo, sem subir HTTP.
 *
 * **Memória limitada de propósito:** 24 baldes de 1 hora por evento (a janela do resumo público), 120 dias de contagem
 * por evento e por país, e um balde de taxa por IP que se limpa sozinho. Um servidor de pé por meses não acumula nada
 * proporcional ao tráfego: o que cresce é no máximo `dias × eventos × países`, com teto em cada um.
 *
 * **Privacidade (dono, 28/09 e 04/10):** só contagens. Nenhum IP é guardado (o balde de taxa vive em memória e some em uma
 * hora), nenhum identificador de pessoa, nada de cidade: só o **país**, e só contado. Sobrevive ao reinício por um arquivo
 * de números (`exportar`/`carregar`), que não tem como identificar ninguém.
 */
import {
  EVENTOS,
  PAIS_DESCONHECIDO,
  TODOS_EVENTOS,
  type DiaMetricas,
  type EventoNome,
  type EventoQualquer,
  type EventoServidor,
  type Metricas,
  type ResumoEventos,
} from '../shared/net/telemetry';

const HORAS = 24;
/** Fichas por IP: no máximo 30 eventos guardados, recarregando 0,5/s (~30/min) — generoso para um funil
 * de UI (poucos cliques por pessoa), curto o bastante para não valer a pena forjar volume. */
const BALDE_TETO = 30;
const BALDE_RECARGA_POR_S = 0.5;
/** Baldes de IP sem uso por mais que isto somem, para o mapa não crescer para sempre. */
const BALDE_EXPIRA_MS = 60 * 60 * 1000;
/** Os dias são no horário de Brasília (o Brasil não tem horário de verão desde 2019, então o deslocamento é fixo). */
const FUSO_MS = -3 * 3_600_000;
const FUSO_TEXTO = 'UTC-03:00';
/** Quantos dias de contagem ficam guardados. */
const DIAS_GUARDADOS = 120;
/** Países diferentes por evento e por dia (o mundo tem ~250; acima disso o resto vai para `??`). */
const PAISES_TETO = 80;

/** O dia (AAAA-MM-DD) de um instante, no horário de Brasília: o mesmo recorte de todas as contagens por dia. */
export function diaDe(now: number): string {
  return new Date(now + FUSO_MS).toISOString().slice(0, 10);
}

type Balde = { tokens: number; refilled: number };
type Dia = Record<string, Record<string, number>>;

/** O arquivo de números que sobrevive ao reinício do servidor. */
export interface Persistido {
  v: 1;
  desde: string;
  total: Record<string, number>;
  horaEpoch: number;
  porHora: Record<string, number[]>;
  dias: Record<string, Dia>;
  picos: Record<string, number>;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_PAIS = /^[A-Z0-9?]{2}$/;
const nomes = new Set<string>(TODOS_EVENTOS);
const contagemValida = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export class Telemetria {
  private readonly total: Record<EventoQualquer, number>;
  private readonly porHora: Record<EventoNome, number[]>;
  private horaIdx = 0;
  private horaEpoch: number;
  private readonly baldes = new Map<string, Balde>();
  private readonly seen = new Map<string, number>();
  private startedAtIso: string;
  private readonly dias = new Map<string, Dia>();
  private readonly picos = new Map<string, number>();
  /** Há contagem nova desde o último `exportar` (o servidor só grava o arquivo quando precisa). */
  sujo = false;

  constructor(now = Date.now()) {
    this.total = Object.fromEntries(TODOS_EVENTOS.map((e) => [e, 0])) as Record<EventoQualquer, number>;
    this.porHora = Object.fromEntries(EVENTOS.map((e) => [e, new Array(HORAS).fill(0)])) as Record<EventoNome, number[]>;
    this.horaEpoch = Math.floor(now / 3_600_000);
    this.startedAtIso = new Date(now).toISOString();
  }

  /**
   * Um evento do cliente chegou de um IP, do país `pais`. `'ok'` conta; `'taxa'` significa que esse IP já mandou demais na
   * última hora (e nada é contado).
   */
  registrar(nome: EventoNome, ip: string, now = Date.now(), pais = PAIS_DESCONHECIDO, eventId?: string): 'ok' | 'taxa' {
    this.girarHoras(now);
    if (!this.consumirFicha(ip, now)) return 'taxa';
    if (eventId) {
      for (const [id,at] of this.seen) if (now-at>600000) this.seen.delete(id);
      if (this.seen.has(eventId)) return 'ok';
      if (this.seen.size >= 4096) this.seen.delete(this.seen.keys().next().value!);
      this.seen.set(eventId,now);
    }
    this.total[nome]++;
    this.porHora[nome][this.horaIdx]!++;
    this.noDia(nome, pais, now);
    return 'ok';
  }

  /** Um evento que só o servidor vê (conexão aceita, entrada na sala, recusa). Sem taxa por IP: quem conta é o servidor. */
  contar(nome: EventoServidor, pais = PAIS_DESCONHECIDO, now = Date.now()): void {
    this.total[nome]++;
    this.noDia(nome, pais, now);
  }

  /** `jogadores` estão na partida agora (todas as salas): guarda o maior do dia. */
  pico(jogadores: number, now = Date.now()): void {
    const d = this.diaDe(now);
    if (jogadores > (this.picos.get(d) ?? 0)) {
      this.picos.set(d, Math.trunc(jogadores));
      this.sujo = true;
      this.podar();
    }
  }

  /** O que `GET /eventos/resumo` devolve: só contagens do cliente, nunca eventos individuais nem IPs. */
  resumo(now = Date.now()): ResumoEventos {
    this.girarHoras(now);
    const janela24h = {} as Record<EventoNome, number>;
    const total = {} as Record<EventoNome, number>;
    for (const nome of EVENTOS) {
      janela24h[nome] = this.porHora[nome]!.reduce((a, b) => a + b, 0);
      total[nome] = this.total[nome];
    }
    return { desde: this.startedAtIso, janela24h, total };
  }

  /** O que `GET /metricas` devolve ao dono (com o token): por dia e por país, mais os eventos do servidor. */
  metricas(now = Date.now()): Metricas {
    const chaves = [...new Set([...this.dias.keys(), ...this.picos.keys()])].sort();
    const dias: DiaMetricas[] = chaves.map((dia) => ({ dia, eventos: structuredClone(this.dias.get(dia) ?? {}), pico: this.picos.get(dia) ?? 0 }));
    return { desde: this.startedAtIso, geradoEm: new Date(now).toISOString(), fuso: FUSO_TEXTO, total: { ...this.total }, dias };
  }

  /** Os números para gravar em disco. */
  exportar(): Persistido {
    this.sujo = false;
    return {
      v: 1,
      desde: this.startedAtIso,
      total: { ...this.total },
      horaEpoch: this.horaEpoch,
      porHora: Object.fromEntries(EVENTOS.map((e) => [e, [...this.porHora[e]!]])),
      dias: Object.fromEntries([...this.dias].map(([d, v]) => [d, structuredClone(v)])),
      picos: Object.fromEntries(this.picos),
    };
  }

  /**
   * Volta os números gravados (um arquivo que sobreviveu ao reinício). Nunca confia no arquivo: o que não bate com o formato
   * (nome de evento, dia, país, número) é jogado fora, e um arquivo ilegível é o mesmo que nenhum.
   */
  carregar(raw: unknown, now = Date.now()): void {
    if (typeof raw !== 'object' || raw === null) return;
    const p = raw as Partial<Persistido>;
    if (p.v !== 1) return;
    if (typeof p.desde === 'string' && !Number.isNaN(Date.parse(p.desde))) this.startedAtIso = new Date(p.desde).toISOString();
    for (const [nome, n] of Object.entries(p.total ?? {})) if (nomes.has(nome) && contagemValida(n)) this.total[nome as EventoQualquer] = Math.trunc(n);
    if (Number.isInteger(p.horaEpoch)) {
      this.horaEpoch = p.horaEpoch as number;
      this.horaIdx = 0;
      for (const nome of EVENTOS) {
        const h = p.porHora?.[nome];
        this.porHora[nome] = Array.from({ length: HORAS }, (_, i) => (Array.isArray(h) && contagemValida(h[i]) ? Math.trunc(h[i] as number) : 0));
      }
    }
    for (const [dia, eventos] of Object.entries(p.dias ?? {})) {
      if (!RE_DIA.test(dia) || typeof eventos !== 'object' || eventos === null) continue;
      const d: Dia = {};
      for (const [nome, porPais] of Object.entries(eventos)) {
        if (!nomes.has(nome) || typeof porPais !== 'object' || porPais === null) continue;
        const limpo: Record<string, number> = {};
        for (const [pais, n] of Object.entries(porPais)) if (RE_PAIS.test(pais) && contagemValida(n) && Object.keys(limpo).length < PAISES_TETO) limpo[pais] = Math.trunc(n);
        d[nome] = limpo;
      }
      this.dias.set(dia, d);
    }
    for (const [dia, n] of Object.entries(p.picos ?? {})) if (RE_DIA.test(dia) && contagemValida(n)) this.picos.set(dia, Math.trunc(n));
    this.podar();
    this.girarHoras(now);
    this.sujo = false;
  }

  private diaDe(now: number): string {
    return diaDe(now);
  }

  private noDia(nome: EventoQualquer, pais: string, now: number): void {
    const dia = this.diaDe(now);
    let d = this.dias.get(dia);
    if (!d) {
      d = {};
      this.dias.set(dia, d);
      this.podar();
    }
    const porPais = (d[nome] ??= {});
    // País desconhecido ou já com muitos países neste evento e dia: vai para `??` (o mapa não cresce com lixo).
    const chave = RE_PAIS.test(pais) && (pais in porPais || Object.keys(porPais).length < PAISES_TETO) ? pais : PAIS_DESCONHECIDO;
    porPais[chave] = (porPais[chave] ?? 0) + 1;
    this.sujo = true;
  }

  /** Tira os dias mais antigos que o teto. */
  private podar(): void {
    const todos = [...new Set([...this.dias.keys(), ...this.picos.keys()])].sort();
    for (const dia of todos.slice(0, Math.max(0, todos.length - DIAS_GUARDADOS))) {
      this.dias.delete(dia);
      this.picos.delete(dia);
    }
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
