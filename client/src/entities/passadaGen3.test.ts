import { describe, expect, it } from 'vitest';
import {
  fasePorSegundo,
  juntasDaPerna,
  parametrosDaPassada,
  peDaPerna,
  poseDaPassada,
  taxaDaFase,
  type GeometriaDaPerna,
  type PoseDaPassada,
} from './passadaGen3';

// Perna de um Vector-09 (5,3 m): coxa 1,15 m e canela 1,35 m (a conta de `MEDIUM_MECH_BLUEPRINT`), sem joelho deslocado.
const VECTOR09: GeometriaDaPerna = { ue: 1.15, eps: 0, w: 1.35, f0: 0, dRest: 2.5, peFrente: 0.682, peTras: 0.418 };
// Perna digitígrada (Arara-B1): o joelho fica 0,55 m à frente da vertical, e o pé em repouso também.
const ARARA: GeometriaDaPerna = { ue: Math.hypot(0.55, 1.35), eps: Math.atan2(0.55, 1.35), w: 1.75, f0: 0.55, dRest: 1.35 + 1.75, peFrente: 0.372, peTras: 0.228 };
// Pesado (Onça-B2): perna curta e pé grande.
const ONCA: GeometriaDaPerna = { ue: 1.05, eps: 0, w: 1.15, f0: 0, dRest: 2.2, peFrente: 1.023, peTras: 0.627 };
// Perna de um titã (Colossus): alcance longo e passo lento.
const COLOSSUS: GeometriaDaPerna = { ue: 3.05, eps: 0, w: 3.05, f0: 0, dRest: 6.1, peFrente: 2.015, peTras: 1.235 };
const TODAS = [VECTOR09, ARARA, ONCA, COLOSSUS];

const pose = (): PoseDaPassada => ({ hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, dPelvis: 0 });

describe('cinemática inversa da perna (passadaGen3)', () => {
  it('a ida e a volta batem: o pé calculado pelas juntas volta ao alvo', () => {
    const out = { hip: 0, knee: 0 };
    const pe = { f: 0, d: 0 };
    for (const geo of [VECTOR09, ARARA]) {
      for (let f = -1.4; f <= 1.4; f += 0.1) {
        for (let d = 1.6; d <= 2.6; d += 0.1) {
          const r = Math.hypot(f, d);
          if (r > geo.ue + geo.w - 0.01 || r < Math.abs(geo.ue - geo.w) + 0.01) continue;
          juntasDaPerna(geo, f, d, out);
          peDaPerna(geo, out, pe);
          expect(pe.f).toBeCloseTo(f, 6);
          expect(pe.d).toBeCloseTo(d, 6);
        }
      }
    }
  });

  it('a perna esticada (pé na distância máxima) dá junta zero, sem folga', () => {
    const out = { hip: 0, knee: 0 };
    juntasDaPerna(VECTOR09, 0, VECTOR09.ue + VECTOR09.w, out);
    expect(Math.abs(out.hip)).toBeLessThan(1e-9);
    expect(Math.abs(out.knee)).toBeLessThan(1e-9);
  });

  it('agachado (pé embaixo do quadril, perna dobrada): o joelho dobra para trás e a coxa vai para a frente', () => {
    const out = { hip: 0, knee: 0 };
    juntasDaPerna(VECTOR09, 0, 2.0, out);
    expect(out.knee).toBeLessThan(0);
    expect(out.hip).toBeGreaterThan(0);
  });

  it('fora do alcance o pé para no limite e nenhuma junta vira NaN', () => {
    const out = { hip: 0, knee: 0 };
    juntasDaPerna(VECTOR09, 9, 0.2, out);
    expect(Number.isFinite(out.hip + out.knee)).toBe(true);
    juntasDaPerna(VECTOR09, 0, 0, out);
    expect(Number.isFinite(out.hip + out.knee)).toBe(true);
  });
});

describe('parâmetros da passada (passadaGen3)', () => {
  it('o alcance nunca deixa o pé mais longe do que a perna chega com a pelve no andar', () => {
    for (const geo of TODAS) {
      for (const angulo of [0.2, 0.42, 0.7, 1.1]) {
        const p = parametrosDaPassada(geo, angulo);
        const rMax = geo.ue + geo.w;
        const dAndar = geo.dRest - p.agachamento - p.bob;
        const folga = Math.sqrt(Math.max(0, rMax * rMax - dAndar * dAndar)) - Math.abs(geo.f0);
        expect(p.alcance).toBeGreaterThanOrEqual(0);
        expect(p.alcance).toBeLessThanOrEqual(folga + 1e-9);
      }
    }
  });

  it('no Vector-09 o molejo do andar chega à amplitude de projeto (0,125 m): o alcance é o do limite da perna', () => {
    const p = parametrosDaPassada(VECTOR09, 0.7);
    const fundo = poseDaPassada(0, 1, VECTOR09, p, pose());
    let minimo = Infinity;
    let maximo = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      poseDaPassada((i / 1000) * Math.PI * 2, 1, VECTOR09, p, fundo);
      minimo = Math.min(minimo, fundo.dPelvis);
      maximo = Math.max(maximo, fundo.dPelvis);
    }
    expect(maximo - minimo).toBeCloseTo(p.bob, 3);
  });
});

describe('passada com o pé plantado (passadaGen3)', () => {
  it('no apoio o pé anda para trás à velocidade do corpo: não escorrega', () => {
    const geo = VECTOR09;
    const p = parametrosDaPassada(geo, 0.7);
    const taxa = taxaDaFase(p);
    const v = 6; // m/s
    // A frente do pé de apoio em função da fase: no apoio ela vai de +alcance a -alcance em relação ao quadril.
    const frente = (fase: number): number => {
      const ciclo = (((fase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      return geo.f0 + p.alcance * (1 - (2 * ciclo) / p.fracaoDeApoio);
    };
    let fase = 0.2;
    const dt = 1e-4;
    let checados = 0;
    for (let i = 0; i < 4000; i++) {
      const ciclo = (fase % (Math.PI * 2)) / (Math.PI * 2);
      // Só dentro do apoio, longe das bordas (onde a fase troca de lado e a derivada numérica vira ruído).
      if (ciclo < p.fracaoDeApoio - 0.02 && ciclo > 0.02) {
        const velocidade = (frente(fase + taxa * v * dt) - frente(fase)) / dt;
        // O pé anda para trás à mesma velocidade que o corpo: dx/dt = -v, sem deslizar.
        expect(velocidade).toBeCloseTo(-v, 1);
        checados++;
      }
      fase += taxa * v * dt;
    }
    expect(checados).toBeGreaterThan(100);
  });

  it('o ciclo é contínuo: entre duas amostras próximas nenhuma junta nem a pelve dá um salto', () => {
    for (const geo of TODAS) {
      const p = parametrosDaPassada(geo, 0.7);
      let anterior = poseDaPassada(0, 1, geo, p, pose());
      let maior = 0;
      for (let i = 1; i <= 2000; i++) {
        const cur = poseDaPassada((i / 2000) * Math.PI * 2, 1, geo, p, pose());
        maior = Math.max(maior, Math.abs(cur.hipL - anterior.hipL), Math.abs(cur.kneeL - anterior.kneeL), Math.abs(cur.hipR - anterior.hipR), Math.abs(cur.dPelvis - anterior.dPelvis));
        anterior = cur;
      }
      // Um passo de 1/2000 do ciclo. O movimento suave dá ~0,01 rad aqui; um salto de verdade (o degrau da pelve que existia
      // antes do `min` contínuo) dava 0,98 rad. O limite fica entre os dois e pega qualquer degrau que volte.
      expect(maior).toBeLessThan(0.05);
    }
  });

  it('a pelve andando fica entre o agachamento e o agachamento mais a amplitude do molejo', () => {
    for (const geo of TODAS) {
      const p = parametrosDaPassada(geo, 0.7);
      const topo = geo.dRest - p.agachamento;
      for (let i = 0; i < 1000; i++) {
        const q = poseDaPassada((i / 1000) * Math.PI * 2, 1, geo, p, pose());
        expect(q.dPelvis).toBeLessThanOrEqual(topo + 1e-9);
        expect(q.dPelvis).toBeGreaterThanOrEqual(topo - p.bob - 1e-6);
      }
    }
  });

  it('o pé rígido não afunda no piso: a ponta (ou o calcanhar) mais funda fica a menos de 10% da distância do eixo à ponta abaixo do chão', () => {
    for (const geo of TODAS) {
      const p = parametrosDaPassada(geo, 0.7);
      const pe = { f: 0, d: 0 };
      let maisFundo = Infinity;
      for (let i = 0; i < 2000; i++) {
        const q = poseDaPassada((i / 2000) * Math.PI * 2, 1, geo, p, pose());
        for (const [hip, knee] of [[q.hipL, q.kneeL], [q.hipR, q.kneeR]] as const) {
          peDaPerna(geo, { hip, knee }, pe);
          // O eixo do pé está a `pelve - d` do chão; o pé gira com a canela (hip + knee) e o canto que toca cai `a·|sen|` abaixo do eixo (calcanhar se o pé está à frente, ponta se está atrás).
          const sn = Math.sin(hip + knee);
          maisFundo = Math.min(maisFundo, q.dPelvis - pe.d - (sn > 0 ? geo.peTras : geo.peFrente) * Math.abs(sn));
        }
      }
      expect(maisFundo).toBeGreaterThan(-0.1 * geo.peFrente);
    }
  });

  it('a cadência tem teto: abaixo dele a fase acompanha a velocidade (pé plantado), acima dele fica no máximo', () => {
    const p = parametrosDaPassada(VECTOR09, 0.7);
    const taxa = taxaDaFase(p);
    expect(fasePorSegundo(p, 1)).toBeCloseTo(taxa, 9);
    expect(fasePorSegundo(p, 100)).toBeCloseTo(p.ciclosMax * Math.PI * 2, 9);
    expect(fasePorSegundo(p, 0)).toBe(0);
    // Quem corre mais rápido que o teto da cadência nunca passa dele.
    expect(fasePorSegundo(p, 20)).toBeLessThanOrEqual(p.ciclosMax * Math.PI * 2 + 1e-9);
  });

  it('a perna avariada manca: com a escala do passo em zero o pé dela não sai do lugar e o da outra anda', () => {
    const geo = VECTOR09;
    const p = parametrosDaPassada(geo, 0.7);
    const pe = { f: 0, d: 0 };
    let esquerdaMin = Infinity;
    let esquerdaMax = -Infinity;
    let direitaMin = Infinity;
    let direitaMax = -Infinity;
    for (let i = 0; i < 400; i++) {
      const q = poseDaPassada((i / 400) * Math.PI * 2, 1, geo, p, pose(), 0, 1);
      peDaPerna(geo, { hip: q.hipL, knee: q.kneeL }, pe);
      esquerdaMin = Math.min(esquerdaMin, pe.f); esquerdaMax = Math.max(esquerdaMax, pe.f);
      peDaPerna(geo, { hip: q.hipR, knee: q.kneeR }, pe);
      direitaMin = Math.min(direitaMin, pe.f); direitaMax = Math.max(direitaMax, pe.f);
    }
    expect(esquerdaMax - esquerdaMin).toBeLessThan(0.05);
    expect(direitaMax - direitaMin).toBeGreaterThan(p.alcance);
  });

  it('sai do repouso sem estalo: varrendo o peso de 0 a 1 nenhuma junta pula (o repouso é a perna esticada, ponto singular da conta)', () => {
    for (const geo of TODAS) {
      const p = parametrosDaPassada(geo, 0.7);
      for (const fase of [0, 1.3, 2.9, 4.4]) {
        let anterior = poseDaPassada(fase, 0, geo, p, pose());
        let maiorJunta = 0;
        let maiorPelve = 0;
        for (let i = 1; i <= 200; i++) {
          const q = poseDaPassada(fase, i / 200, geo, p, pose());
          maiorJunta = Math.max(maiorJunta, Math.abs(q.hipL - anterior.hipL), Math.abs(q.kneeL - anterior.kneeL), Math.abs(q.hipR - anterior.hipR), Math.abs(q.kneeR - anterior.kneeR));
          maiorPelve = Math.max(maiorPelve, Math.abs(q.dPelvis - anterior.dPelvis) / geo.dRest);
          anterior = q;
        }
        // Mistura linear das juntas: o passo de 1/200 do peso move uma junta no máximo ~1/200 da amplitude (<= ~1,5 rad), e a pelve ~1/200 do agachamento.
        expect(maiorJunta).toBeLessThan(0.02);
        expect(maiorPelve).toBeLessThan(0.002);
      }
    }
  });

  it('o peso mistura a pose de andar com o repouso: meio peso dá meia pose', () => {
    const geo = VECTOR09;
    const p = parametrosDaPassada(geo, 0.7);
    const cheio = poseDaPassada(1.1, 1, geo, p, pose());
    const meio = poseDaPassada(1.1, 0.5, geo, p, pose());
    expect(meio.hipL).toBeCloseTo(cheio.hipL * 0.5, 9);
    expect(meio.kneeR).toBeCloseTo(cheio.kneeR * 0.5, 9);
    expect(meio.dPelvis - geo.dRest).toBeCloseTo((cheio.dPelvis - geo.dRest) * 0.5, 9);
  });

  it('parado (peso 0) a pose é a do repouso e as duas pernas ficam iguais', () => {
    for (const geo of [VECTOR09, ARARA]) {
      const p = parametrosDaPassada(geo, 0.7);
      for (const fase of [0, 1, 2.5, 4]) {
        const q = poseDaPassada(fase, 0, geo, p, pose());
        expect(Math.abs(q.hipL)).toBeLessThan(1e-6);
        expect(Math.abs(q.kneeL)).toBeLessThan(1e-6);
        expect(q.hipR).toBeCloseTo(q.hipL, 9);
        expect(q.kneeR).toBeCloseTo(q.kneeL, 9);
        expect(q.dPelvis).toBeCloseTo(geo.dRest, 9);
      }
    }
  });

  it('a passada do digitígrado (Arara) também fica sem NaN e com a pelve dentro do limite', () => {
    const p = parametrosDaPassada(ARARA, 0.5);
    for (let i = 0; i < 500; i++) {
      const q = poseDaPassada((i / 500) * Math.PI * 2, 1, ARARA, p, pose());
      expect(Number.isFinite(q.hipL + q.kneeL + q.hipR + q.kneeR + q.dPelvis)).toBe(true);
      expect(q.dPelvis).toBeLessThanOrEqual(ARARA.dRest - p.agachamento + 1e-9);
    }
  });
});
