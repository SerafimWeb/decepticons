import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { PRAIA_COMPLEXO, PRAIA_ESTACAO } from '../environment/PraiaLayout';
import { CODIGO_DO_ESTADO_DA_PORTA, pesoNaPorta, PORTAS, PORTAS_DA_ESTACAO, portaDoPonto, PortasDaEstacao } from './PortasDaEstacao';

const DT = 1 / 60;
const NINGUEM = [0, 0];

function rodar(p: PortasDaEstacao, s: number, atacantes = NINGUEM, defensores = NINGUEM): void {
  for (let i = 0; i < Math.round(s / DT); i++) p.fixedUpdate(DT, atacantes, defensores);
}

describe('as PORTAS DA ESTAÇÃO (P163, frente 2): a entrada principal e a dos fundos', () => {
  it('são duas, uma em cada fachada do prédio (a sul e a norte), no meio dela e dentro do complexo', () => {
    expect(PORTAS_DA_ESTACAO.map((p) => p.id)).toEqual(['frente', 'fundos']);
    const [frente, fundos] = PORTAS_DA_ESTACAO;
    expect(frente!.z).toBeLessThan(PRAIA_ESTACAO.z - 14); // a fachada sul do prédio (28 m de fundo)
    expect(fundos!.z).toBeGreaterThan(PRAIA_ESTACAO.z + 14); // a norte
    for (const p of PORTAS_DA_ESTACAO) {
      expect(p.x).toBe(PRAIA_ESTACAO.x);
      expect(p.x).toBeGreaterThan(PRAIA_COMPLEXO.minX);
      expect(p.x).toBeLessThan(PRAIA_COMPLEXO.maxX);
      expect(p.z).toBeGreaterThan(PRAIA_COMPLEXO.minZ);
      expect(p.z).toBeLessThan(PRAIA_COMPLEXO.maxZ);
      expect(p.nome).toBe(p.nome.toUpperCase());
    }
    expect(frente!.nome).toBe('ENTRADA PRINCIPAL');
    expect(fundos!.nome).toBe('ENTRADA DOS FUNDOS');
  });

  it('o peso de quem força: Mech 1, manifestante 1, andróide 0,4, Colossus 4', () => {
    expect(pesoNaPorta('VECTOR-09')).toBe(1);
    expect(pesoNaPorta('MANIFESTANTE 3')).toBe(1);
    expect(pesoNaPorta('ANDRÓIDE A-1')).toBe(0.4);
    expect(pesoNaPorta('COLOSSUS-01')).toBe(4);
  });

  it('começam inteiras e fechadas, sem drenar nada', () => {
    const p = new PortasDaEstacao();
    for (let i = 0; i < 2; i++) {
      expect(p.estado(i)).toBe('fechada');
      expect(p.fracaoDaVida(i)).toBe(1);
    }
    expect(p.drenoDaRedePorS).toBe(0);
    expect(p.arrombadasAgora).toBe(0);
  });

  it('três manifestantes arrombam a porta em ~33 s; no meio do caminho ela está FORÇADA e ainda não drena a rede', () => {
    const p = new PortasDaEstacao();
    rodar(p, 20, [3, 0]);
    expect(p.estado(0)).toBe('forcada');
    expect(p.drenoDaRedePorS).toBe(0);
    expect(p.estado(1)).toBe('fechada'); // a outra porta não sente
    rodar(p, 15, [3, 0]);
    expect(p.estado(0)).toBe('arrombada');
    expect(p.vida[0]).toBe(0);
    expect(p.drenoDaRedePorS).toBe(PORTAS.drenoArrombadaPorS);
  });

  it('as duas arrombadas drenam o dobro: o grupo da frente e o dos fundos pedem defensores nos dois lados', () => {
    const p = new PortasDaEstacao();
    rodar(p, 60, [3, 3]);
    expect(p.arrombadasAgora).toBe(2);
    expect(p.drenoDaRedePorS).toBe(2 * PORTAS.drenoArrombadaPorS);
  });

  it('a porta forçada não se recompõe sozinha: sem defensor ela fica como está, o tempo que for', () => {
    const p = new PortasDaEstacao();
    rodar(p, 10, [2, 0]);
    const antes = p.vida[0]!;
    rodar(p, 300, NINGUEM, NINGUEM);
    expect(p.vida[0]).toBe(antes);
  });

  it('o defensor recupera: 8 de vida por segundo (dois, o teto, 16); a porta arrombada volta a fechar aos 30%', () => {
    const p = new PortasDaEstacao();
    rodar(p, 60, [3, 0]); // arrombada
    expect(p.estado(0)).toBe('arrombada');
    rodar(p, 14, NINGUEM, [1, 0]); // 112 de 400 (28%)
    expect(p.estado(0)).toBe('arrombada');
    rodar(p, 2, NINGUEM, [1, 0]); // passou de 120
    expect(p.estado(0)).not.toBe('arrombada');
    // dois e três defensores rendem o mesmo (o teto é dois)
    const dois = new PortasDaEstacao();
    const tres = new PortasDaEstacao();
    rodar(dois, 60, [3, 0]);
    rodar(tres, 60, [3, 0]);
    rodar(dois, 6, NINGUEM, [2, 0]);
    rodar(tres, 6, NINGUEM, [3, 0]);
    expect(tres.vida[0]).toBeCloseTo(dois.vida[0]!, 6);
    // e a recuperação para na vida cheia
    rodar(dois, 60, NINGUEM, [2, 0]);
    expect(dois.vida[0]).toBe(PORTAS.vidaMax);
    expect(dois.estado(0)).toBe('fechada');
  });

  it('com o invasor em cima ninguém recupera: o conserto só acontece com a porta livre de quem a força', () => {
    const p = new PortasDaEstacao();
    rodar(p, 10, [2, 0]);
    const antes = p.vida[0]!;
    rodar(p, 5, [2, 0], [2, 0]);
    expect(p.vida[0]).toBeLessThan(antes);
  });

  it('missão nova (reset): as duas inteiras e fechadas', () => {
    const p = new PortasDaEstacao();
    rodar(p, 60, [3, 3]);
    p.reset();
    for (let i = 0; i < 2; i++) expect(p.estado(i)).toBe('fechada');
    expect(p.drenoDaRedePorS).toBe(0);
  });

  it('os códigos do estado para o HUD e o desenho: 0 fechada, 1 forçada, 2 arrombada', () => {
    expect(CODIGO_DO_ESTADO_DA_PORTA).toEqual({ fechada: 0, forcada: 1, arrombada: 2 });
  });

  it('é determinística e mantém as invariantes sob qualquer sequência: vida em [0, 400], arrombada só com a vida baixa', () => {
    const roda = () => {
      const p = new PortasDaEstacao();
      const r = mulberry32(1701);
      for (let t = 0; t < 60 * 600; t++) {
        const a = [r() < 0.4 ? Math.floor(r() * 5) : 0, r() < 0.4 ? Math.floor(r() * 5) : 0];
        const d = [r() < 0.3 ? Math.floor(r() * 4) : 0, r() < 0.3 ? Math.floor(r() * 4) : 0];
        p.fixedUpdate(DT, a, d);
        for (let i = 0; i < 2; i++) {
          expect(p.vida[i]).toBeGreaterThanOrEqual(0);
          expect(p.vida[i]).toBeLessThanOrEqual(PORTAS.vidaMax);
          if (p.estado(i) === 'arrombada') expect(p.vida[i]).toBeLessThan(PORTAS.vidaMax);
          if (p.estado(i) === 'fechada') expect(p.vida[i]).toBe(PORTAS.vidaMax);
        }
      }
      return JSON.stringify([p.vida, [0, 1].map((i) => p.estado(i))]);
    };
    expect(roda()).toBe(roda());
  });
});

describe('quem está perto de qual porta', () => {
  it('a mais perto dentro do raio, ou -1; num empate vale a de menor índice', () => {
    const [frente, fundos] = PORTAS_DA_ESTACAO;
    expect(portaDoPonto(frente!.x, frente!.z, PORTAS.raioDeAtaque)).toBe(0);
    expect(portaDoPonto(fundos!.x + 2, fundos!.z - 2, PORTAS.raioDeAtaque)).toBe(1);
    expect(portaDoPonto(0, 0, PORTAS.raioDeAtaque)).toBe(-1);
    expect(portaDoPonto(PRAIA_ESTACAO.x, PRAIA_ESTACAO.z, PORTAS.raioDeReparo)).toBe(-1); // dentro do prédio, a 16 m das duas
  });
});
