/**
 * O mural de câmeras (P88, G3: módulo independente, ligado ao `Server.ts` por callbacks). Uma conexão WebSocket própria (`/?mural=1`) com a
 * chave do dono: quem pede e acerta o token recebe, a `MURAL_HZ` por segundo, todas as salas em radar (`shared/net/mural.ts`).
 *
 * **Custo de CPU:** zero sem ninguém assistindo (nem um temporizador existe: ele nasce com o primeiro espectador e morre com o último).
 * Assistindo, a cada 250 ms o servidor lê as posições de até 8 salas (≤ 12 unidades cada) e escreve ~110 bytes por sala (~0,45 KB/s) num buffer só,
 * reaproveitado (G4); a mesma mensagem vai para todos os espectadores. Fora do tick de 60 Hz: não toca a simulação.
 *
 * **Segurança:** a primeira mensagem tem de ser o pedido com o token (5 s para chegar, senão a conexão cai); erro de token gasta a mesma
 * régua das rotas \`/admin/*\` (10 em 10 min por IP, fechando até para o token certo); no máximo \`max\` espectadores ao mesmo tempo; depois
 * de entrar, tudo o que o cliente mandar é ignorado (o mural não recebe comando de ninguém).
 */
import type { WebSocket } from 'ws';
import { Writer } from '../shared/net/codec';
import { decodeMuralPedido, encodeMural, MURAL_FECHOU, MURAL_HZ, MURAL_SALAS_MAX, newMuralSala, type MuralSala } from '../shared/net/mural';
import type { ArenaRoom } from './ArenaRoom';
import { ehSalaDeTeste } from './autoteste';

export type Veredito = 'ok' | 'negado' | 'bloqueado' | 'desligado';

export interface MuralOpcoes {
  /** As salas abertas (o mural pula as de teste do painel). */
  salas: () => Iterable<ArenaRoom>;
  /** A chave do dono, na mesma régua das rotas de administração. */
  verificar: (ip: string, token: string) => Veredito;
  /** Quantos bytes saíram (o amostrador do painel conta o tráfego). */
  aoEnviar?: (bytes: number) => void;
  log?: (linha: string) => void;
  /** Quantos espectadores ao mesmo tempo (padrão 4). */
  max?: number;
  /** Quanto o espectador tem para mandar o token (ms; padrão 5 s). */
  esperaMs?: number;
  /** De quanto em quanto tempo manda um quadro (ms; padrão 250). */
  cadaMs?: number;
}

interface Espectador {
  ws: WebSocket;
  ip: string;
  entrou: boolean;
  espera: ReturnType<typeof setTimeout>;
}

/** O pedido de mural é uma conexão com \`?mural=1\` (no lugar de \`?sala=\`). */
export function ehPedidoDeMural(url: string | undefined): boolean {
  return new URL(url ?? '/', 'http://x').searchParams.has('mural');
}

export class Mural {
  private readonly espectadores = new Set<Espectador>();
  private readonly w = new Writer(4096);
  private readonly quadro: MuralSala[] = Array.from({ length: MURAL_SALAS_MAX }, newMuralSala);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly o: MuralOpcoes) {}

  /** Quantos estão assistindo (autenticados). */
  get assistindo(): number {
    let n = 0;
    for (const e of this.espectadores) if (e.entrou) n++;
    return n;
  }

  /** O temporizador está ligado? (só com espectador: sem ninguém assistindo, o servidor não gasta nada). */
  get ligado(): boolean {
    return this.timer !== null;
  }

  /** Quantas conexões de mural existem (inclusive as que ainda não mandaram o token). */
  get conexoes(): number {
    return this.espectadores.size;
  }

  /** Uma conexão nova com \`?mural=1\` (já passou pelo teto por IP do servidor). */
  receber(ws: WebSocket, ip: string): void {
    if (this.espectadores.size >= (this.o.max ?? 4)) {
      ws.close(4013, 'espectadores');
      return;
    }
    const e: Espectador = {
      ws,
      ip,
      entrou: false,
      espera: setTimeout(() => {
        if (!e.entrou) ws.close(MURAL_FECHOU.token, 'token');
      }, this.o.esperaMs ?? 5000),
    };
    this.espectadores.add(e);
    ws.on('message', (data, isBinary) => {
      if (!isBinary || e.entrou) return;
      const bytes = data instanceof Buffer ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data as ArrayBuffer)]);
      const token = decodeMuralPedido(bytes);
      const v = token ? this.o.verificar(ip, token) : this.o.verificar(ip, '');
      if (v !== 'ok') {
        ws.close(v === 'bloqueado' ? MURAL_FECHOU.bloqueado : v === 'desligado' ? MURAL_FECHOU.desligado : MURAL_FECHOU.token, v);
        return;
      }
      e.entrou = true;
      clearTimeout(e.espera);
      this.o.log?.('mural: um espectador entrou');
      this.ligar();
      this.enviar(e);
    });
    const sair = () => {
      clearTimeout(e.espera);
      this.espectadores.delete(e);
      if (!this.espectadores.size) this.desligar();
    };
    ws.on('close', sair);
    ws.on('error', () => {
      sair();
      ws.terminate();
    });
  }

  /** Desliga tudo (o servidor fechando). */
  parar(): void {
    for (const e of this.espectadores) {
      clearTimeout(e.espera);
      e.ws.terminate();
    }
    this.espectadores.clear();
    this.desligar();
  }

  private ligar(): void {
    if (!this.timer) this.timer = setInterval(() => this.enviarATodos(), this.o.cadaMs ?? Math.round(1000 / MURAL_HZ));
  }

  private desligar(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Monta o quadro uma vez e manda a mesma mensagem a todos os que já entraram. */
  private enviarATodos(): void {
    if (!this.assistindo) return;
    const bytes = this.montar();
    for (const e of this.espectadores) this.mandar(e, bytes);
  }

  private enviar(e: Espectador): void {
    this.mandar(e, this.montar());
  }

  private mandar(e: Espectador, bytes: Uint8Array): void {
    if (!e.entrou || e.ws.readyState !== e.ws.OPEN) return;
    this.o.aoEnviar?.(bytes.length);
    e.ws.send(Buffer.from(bytes));
  }

  /** O quadro das salas abertas de verdade (até 8; com mais, as de mais gente). Reaproveita os objetos (G4). */
  private montar(): Uint8Array {
    let n = 0;
    for (const sala of this.o.salas()) {
      if (ehSalaDeTeste(sala.code)) continue;
      // Com mais de 8 salas, entram as 8 com mais gente: a que tem mais toma o lugar da que tem menos.
      let alvo = n;
      if (n >= MURAL_SALAS_MAX) {
        alvo = 0;
        for (let i = 1; i < n; i++) if (this.quadro[i]!.jogadores < this.quadro[alvo]!.jogadores) alvo = i;
        if (this.quadro[alvo]!.jogadores >= sala.humanCount) continue;
      } else n++;
      sala.muralDe(this.quadro[alvo]!);
    }
    return encodeMural(this.w, this.quadro, n);
  }
}
