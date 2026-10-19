import { decodeBankReply, encodeBankCode } from '../../../shared/net/bank';
import { VOZ } from '../../../shared/net/voz';
import type { BankReply } from '../../../shared/bank/codes';
import { Writer } from '../../../shared/net/codec';
import { PROTOCOL_VERSION } from '../../../shared/net/constants';
import type { NetInput } from '../../../shared/net/input';
import {
  decodeAviso,
  decodeEvents,
  decodePong,
  decodeReject,
  decodeRoster,
  decodeSnapshot,
  decodeWelcome,
  encodeInputs,
  encodeJoin,
  encodeLeave,
  encodePing,
  messageType,
  MSG,
  newEventBatch,
  newSnapshot,
  type AvisoMsg,
  type EventBatch,
  type RejectReason,
  type RosterEntry,
  type Snapshot,
  type WelcomeMsg,
} from '../../../shared/net/messages';

/** O que o cliente ouve do servidor. O estado e os eventos chegam em objetos reutilizados: leia na hora. */
export interface NetClientEvents {
  open(): void;
  bank(reply: BankReply): void;
  welcome(m: WelcomeMsg): void;
  roster(entries: RosterEntry[]): void;
  snapshot(s: Snapshot): void;
  events(b: EventBatch): void;
  /** Ida e volta até o servidor (ms). */
  pong(rttMs: number): void;
  reject(reason: RejectReason): void;
  /** Uma mensagem do chat de voz (`LISTA` ou `SINAL`, `shared/net/voz.ts`): quem decodifica é o `VoiceChat`. */
  voz(bytes: Uint8Array): void;
  /** O servidor avisou que vai reiniciar (P204): em `segundos` ele corta e volta em cerca de `voltaEmS`. */
  aviso(m: AvisoMsg): void;
  /** `code` e `reason` são os do fechamento do WebSocket (0 e vazio quando a conexão nem abriu): `CLOSE_REINICIO` diz "reiniciando" e o motivo é o tempo de volta em segundos. */
  closed(code: number, reason: string): void;
}

/**
 * A conexão do jogo com o servidor (M4): WebSocket binário, as mensagens da M2. Mensagem que não decodifica é
 * ignorada. Manda uma cópia de cada mensagem (o escritor reaproveita o buffer dele).
 */
export class NetClient {
  private readonly ws: WebSocket;
  private readonly w = new Writer(1024);
  private readonly snap = newSnapshot();
  private readonly batch = newEventBatch();
  private queued: Uint8Array<ArrayBuffer>[] = [];

  constructor(
    url: string,
    private readonly on: Partial<NetClientEvents>,
  ) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => {
      for (const b of this.queued) this.ws.send(b);
      this.queued = [];
      this.on.open?.();
    };
    this.ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) this.receive(new Uint8Array(e.data));
    };
    // `closed` dispara UMA vez: no navegador uma conexão que falha dá `error` e depois `close`, e em alguns ambientes (o Node dos testes) a recusa só dá `error`.
    this.ws.onclose = (e) => this.fechou(e?.code ?? 0, e?.reason ?? '');
    this.ws.onerror = () => {
      if (!this.isOpen) this.fechou(0, '');
    };
  }

  private jaFechou = false;

  private fechou(code: number, reason: string): void {
    if (this.jaFechou) return;
    this.jaFechou = true;
    this.on.closed?.(code, reason);
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  join(name: string, build: string): void {
    this.send(encodeJoin(this.w, { protocol: PROTOCOL_VERSION, name, build }));
  }

  sendInputs(inputs: readonly NetInput[], count: number): void {
    if (this.isOpen) this.send(encodeInputs(this.w, inputs, count));
  }

  redeemBank(code: string): boolean {
    if (!this.isOpen) return false;
    this.send(encodeBankCode(this.w, code)); return true;
  }

  ping(): void {
    if (this.isOpen) this.send(encodePing(this.w, performance.now()));
  }

  /** Uma mensagem do chat de voz, já pronta (`PRONTO` ou `SINAL`). */
  enviarVoz(bytes: Uint8Array): void {
    if (this.isOpen) this.send(bytes);
  }

  close(): void {
    if (this.isOpen) this.send(encodeLeave(this.w));
    this.ws.close();
  }

  private send(bytes: Uint8Array): void {
    const copy = bytes.slice();
    if (this.isOpen) this.ws.send(copy);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.queued.push(copy);
  }

  private receive(bytes: Uint8Array): void {
    switch (messageType(bytes)) {
      case MSG.BANK_REPLY: {
        const reply = decodeBankReply(bytes); if (reply) this.on.bank?.(reply); return;
      }
      case MSG.WELCOME: {
        const m = decodeWelcome(bytes);
        if (m) this.on.welcome?.(m);
        return;
      }
      case MSG.ROSTER: {
        const r = decodeRoster(bytes);
        if (r) this.on.roster?.(r);
        return;
      }
      case MSG.SNAPSHOT:
        if (decodeSnapshot(bytes, this.snap)) this.on.snapshot?.(this.snap);
        return;
      case MSG.EVENTS:
        if (decodeEvents(bytes, this.batch)) this.on.events?.(this.batch);
        return;
      case MSG.PONG: {
        const p = decodePong(bytes);
        if (p) this.on.pong?.((performance.now() - p.clientTime) >>> 0);
        return;
      }
      case MSG.AVISO: {
        const a = decodeAviso(bytes);
        if (a) this.on.aviso?.(a);
        return;
      }
      case MSG.REJECT: {
        const r = decodeReject(bytes);
        if (r) this.on.reject?.(r);
        return;
      }
      case VOZ.LISTA:
      case VOZ.SINAL:
        this.on.voz?.(bytes);
        return;
    }
  }
}
