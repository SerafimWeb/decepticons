/**
 * Codec binário da rede (G11): um escritor e um leitor sobre bytes, em little endian.
 *
 * - **Sem alocação nos caminhos de todo tick** (G4): o escritor escreve sempre no mesmo buffer e devolve uma vista
 *   dele (quem envia manda ou copia antes da próxima escrita); o leitor lê de um `Uint8Array` sem criar `DataView`
 *   e escreve em objetos do chamador. Só as mensagens raras (entrada, lista de jogadores) criam texto.
 * - **Nada de fora é confiado** (G7): ler além do fim, ou um tamanho impossível, marca a leitura como ruim, e a
 *   mensagem inteira é recusada por quem decodifica. Sem exceção no caminho normal.
 * - Quantização (G11): posição em centímetros (16 bits: ±327 m), ângulos em 16 bits, frações em 8 bits.
 */

const TAU = Math.PI * 2;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

export class Writer {
  private readonly buf: Uint8Array;
  private at = 0;

  constructor(capacity = 4096) {
    this.buf = new Uint8Array(capacity);
  }

  /** Começa uma mensagem nova no mesmo buffer. */
  reset(): this {
    this.at = 0;
    return this;
  }

  get length(): number {
    return this.at;
  }

  /** A mensagem escrita: uma vista do buffer (válida até a próxima escrita). */
  done(): Uint8Array {
    return this.buf.subarray(0, this.at);
  }

  u8(v: number): this {
    this.buf[this.at++] = v & 0xff;
    return this;
  }

  i8(v: number): this {
    return this.u8(v < 0 ? v + 256 : v);
  }

  u16(v: number): this {
    this.buf[this.at++] = v & 0xff;
    this.buf[this.at++] = (v >>> 8) & 0xff;
    return this;
  }

  i16(v: number): this {
    return this.u16(v < 0 ? v + 65536 : v);
  }

  u32(v: number): this {
    this.buf[this.at++] = v & 0xff;
    this.buf[this.at++] = (v >>> 8) & 0xff;
    this.buf[this.at++] = (v >>> 16) & 0xff;
    this.buf[this.at++] = (v >>> 24) & 0xff;
    return this;
  }

  /** Texto em UTF-8 com o tamanho na frente (1 byte), cortado em `max` bytes sem partir um caractere. */
  str(s: string, max: number): this {
    const { written } = encoder.encodeInto(s, this.buf.subarray(this.at + 1, this.at + 1 + max));
    this.buf[this.at] = written;
    this.at += 1 + written;
    return this;
  }
}

export class Reader {
  private buf: Uint8Array = new Uint8Array(0);
  private at = 0;
  /** Leu além do fim ou achou um valor impossível: a mensagem inteira não vale. */
  bad = false;

  set(bytes: Uint8Array): this {
    this.buf = bytes;
    this.at = 0;
    this.bad = false;
    return this;
  }

  /** Leu tudo, e nada deu errado: a mensagem vale. */
  get clean(): boolean {
    return !this.bad && this.at === this.buf.length;
  }

  private take(n: number): boolean {
    if (this.at + n > this.buf.length) {
      this.bad = true;
      return false;
    }
    return true;
  }

  u8(): number {
    if (!this.take(1)) return 0;
    return this.buf[this.at++]!;
  }

  i8(): number {
    const v = this.u8();
    return v > 127 ? v - 256 : v;
  }

  u16(): number {
    if (!this.take(2)) return 0;
    const v = this.buf[this.at]! | (this.buf[this.at + 1]! << 8);
    this.at += 2;
    return v;
  }

  i16(): number {
    const v = this.u16();
    return v > 32767 ? v - 65536 : v;
  }

  u32(): number {
    if (!this.take(4)) return 0;
    const b = this.buf;
    const v = (b[this.at]! | (b[this.at + 1]! << 8) | (b[this.at + 2]! << 16) | (b[this.at + 3]! << 24)) >>> 0;
    this.at += 4;
    return v;
  }

  /** Texto com o tamanho na frente; maior que `max` bytes é mensagem ruim. */
  str(max: number): string {
    const n = this.u8();
    if (n > max) this.bad = true;
    if (this.bad || !this.take(n)) return '';
    const s = decoder.decode(this.buf.subarray(this.at, this.at + n));
    this.at += n;
    return s;
  }
}

// ---------- quantização ----------

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** NaN e infinito viram 0: número estragado não passa adiante. */
const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/** Metros → centímetros em 16 bits com sinal (±327,67 m; a arena tem ±100 m). */
export const toCm = (m: number) => clamp(Math.round(finite(m) * 100), -32767, 32767);
export const fromCm = (cm: number) => cm / 100;

/** Ângulo qualquer → 16 bits (0 a 2π, passo de 0,0055°). */
export const toAngle = (a: number) => Math.round((((finite(a) % TAU) + TAU) % TAU) * (65536 / TAU)) & 0xffff;
/** 16 bits → ângulo entre -π e π (o mesmo lado que o jogo usa). */
export const fromAngle = (u: number) => {
  const a = (u * TAU) / 65536;
  return a > Math.PI ? a - TAU : a;
};

/** Inclinação (-π/2 a π/2) → 16 bits com sinal. */
export const toPitch = (p: number) => Math.round((clamp(finite(p), -Math.PI / 2, Math.PI / 2) / (Math.PI / 2)) * 32767);
export const fromPitch = (q: number) => (q / 32767) * (Math.PI / 2);

/** Eixo de movimento (-1 a 1) → 8 bits com sinal. */
export const toAxis = (v: number) => Math.round(clamp(finite(v), -1, 1) * 127);
export const fromAxis = (q: number) => clamp(q / 127, -1, 1);

/**
 * Fração (0 a 1) → 8 bits. Maior que zero nunca vira zero: uma parte com um fio de vida não pode chegar ao outro
 * lado como arrancada.
 */
export const toFrac = (f: number) => {
  const v = clamp(finite(f), 0, 1);
  return v <= 0 ? 0 : Math.max(1, Math.round(v * 255));
};
export const fromFrac = (q: number) => q / 255;
