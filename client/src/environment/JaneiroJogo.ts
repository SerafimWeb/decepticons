import * as THREE from 'three';
import type { Match } from '../sim/Match';
import { INTEGRIDADE_MAX } from '../sim/MissaoJaneiro';
import { MultidaoDesenho } from './MultidaoDesenho';
import { ChefesJaneiroDesenho } from './ChefesJaneiroDesenho';
import { PRACA_PREDIOS } from './PracaLayout';

/**
 * A MISSÃO DO 8 DE JANEIRO NA TELA (P217, passo 5): o que o jogo desenha por cima da regra (`sim/MissaoJaneiro.ts`, que mora no `Match`): a multidão (`MultidaoDesenho`, três malhas
 * instanciadas, a posição na shader), as mesas sujas dos saguões e o painel dos três prédios. **Pedaço sob demanda** (G3): só quem abre essa missão o baixa; o `Game` o liga por três chamadas
 * (`desenhar` por quadro, `recomecar`, `dispose`).
 *
 * **Custo:** a multidão são 3 desenhos e nenhuma CPU por figurante por quadro (a posição vem da shader); as mesas são 1 desenho de até 22 instâncias, reescrito só quando a sujeira muda; o painel
 * escreve só o que mudou, a ~5 Hz (G4/G5: tudo nasce uma vez, nada de `new` por quadro).
 */

const CSS = `
#janeiro-painel { position: absolute; top: 62px; left: 50%; transform: translateX(-50%); width: min(430px, 88vw); padding: 8px 12px 9px; background: rgba(6, 8, 10, 0.78);
  border: 1px solid rgba(57, 255, 106, 0.35); font-size: 11px; letter-spacing: 1.5px; color: var(--ink, #eef2e8); text-shadow: 0 1px 2px #000; pointer-events: none; }
#janeiro-painel[hidden] { display: none; }
#janeiro-painel .jp-predios { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
#janeiro-painel .jp-predio b { display: block; font-weight: normal; color: var(--muted, #7f9c86); font-size: 10px; white-space: nowrap; }
#janeiro-painel .jp-barra { height: 6px; margin: 3px 0 2px; background: rgba(255, 255, 255, 0.12); }
#janeiro-painel .jp-barra i { display: block; height: 100%; width: 100%; background: var(--accent, #39ff6a); transform-origin: left; }
#janeiro-painel .jp-predio.jp-medio .jp-barra i { background: var(--warn, #ffe14d); }
#janeiro-painel .jp-predio.jp-baixo .jp-barra i { background: var(--alert, #ff2d3d); }
#janeiro-painel .jp-predio.jp-baixo em { color: var(--alert, #ff2d3d); }
#janeiro-painel .jp-predio em { font-style: normal; font-size: 12px; }
#janeiro-abertura { position: absolute; left: 50%; top: 150px; transform: translateX(-50%); width: min(620px, 90vw); padding: 12px 18px; background: rgba(6, 8, 10, 0.84); border-left: 3px solid var(--warn, #ffe14d);
  font-size: 13px; line-height: 1.55; letter-spacing: 1.2px; text-align: center; text-transform: uppercase; color: var(--ink, #eef2e8); text-shadow: 0 1px 2px #000; pointer-events: none; opacity: 1; transition: opacity 1.4s ease; }
#janeiro-abertura.jp-fora { opacity: 0; }
#janeiro-painel .jp-placar { margin-top: 6px; text-align: center; color: var(--muted, #7f9c86); font-size: 10.5px; }
`;

/**
 * A abertura da missão (`fichas/fatos-8-de-janeiro.md` § 5, item 2): **só o que a ficha marca como 🟢**; "para pedir a ruptura" é a descrição do objetivo que o STF julgou. Aparece nos primeiros
 * 12 s da missão, sem pausar nada, e volta quando a missão recomeça. Um teste (`JaneiroJogo.test.ts`) trava o texto na ficha.
 */
export const ABERTURA_DA_MISSAO = '8 de janeiro de 2023. Uma multidão sai do acampamento diante do quartel e invade os Três Poderes para pedir a ruptura da ordem democrática. Defenda os prédios.';
/** Quanto a abertura fica na tela (ticks: 12 s). */
const ABERTURA_TICKS = 720;

const NOMES = PRACA_PREDIOS.map((p) => p.nome);
/** A mesa (x, z) de cada prédio, na ordem de `PracaLayout`: a sujeira desenha uma marca nelas. */
const MESAS = PRACA_PREDIOS.flatMap((p, k) => p.saguao.mesas.map((m, j) => ({ predio: k, mesa: j, x: m.x, z: m.z })));

export interface JaneiroJogo {
  /** Uma vez por quadro: a multidão no tick com a fração entre dois ticks, e (a ~5 Hz) o painel e as mesas. */
  desenhar(alpha: number): void;
  /** A missão recomeçou: a multidão e o painel voltam ao começo. */
  recomecar(): void;
  dispose(): void;
}

export function criarJaneiroJogo(scene: THREE.Scene, match: Match, hud: HTMLElement, setLinha: (texto: string) => void, pedirGolpe: () => boolean = () => false): JaneiroJogo {
  const chefes = match.chefesJaneiro ? new ChefesJaneiroDesenho(match, hud) : null;
  if (chefes) scene.add(chefes.grupo);
  const multidao = match.multidao!;
  const missao = match.missaoJaneiro!;
  const desenho = new MultidaoDesenho(multidao);
  // A regra (o `Match`) já usa os avisos da multidão; o desenho os acompanha sem tirar nenhum.
  const aoFugir = multidao.aoFugir;
  const aoSair = multidao.aoSair;
  multidao.aoFugir = (i, causa) => {
    aoFugir?.(i, causa);
    desenho.aoMudar(i);
  };
  multidao.aoSair = (i) => {
    aoSair?.(i);
    desenho.aoSair(i);
  };
  multidao.aoMorrer = (i) => desenho.aoMorrer(i);
  scene.add(desenho.grupo);

  // As mesas sujas: um montinho de cor chapada em cada mesa suja, sem texto (a ficha, § 5).
  const montinho = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0x6b4f2a }), MESAS.length);
  montinho.frustumCulled = false;
  const matriz = new THREE.Matrix4();
  const sumida = new THREE.Matrix4().makeScale(0, 0, 0);
  const sujaAntes = new Uint8Array(MESAS.length);
  for (let k = 0; k < MESAS.length; k++) montinho.setMatrixAt(k, sumida);
  montinho.instanceMatrix.needsUpdate = true;
  scene.add(montinho);

  // O painel dos três prédios: nasce uma vez; depois só se escreve o que mudou.
  const estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);
  const painel = document.createElement('div');
  painel.id = 'janeiro-painel';
  const grade = document.createElement('div');
  grade.className = 'jp-predios';
  const celulas = NOMES.map((nome) => {
    const c = document.createElement('div');
    c.className = 'jp-predio';
    const t = document.createElement('b');
    t.textContent = nome;
    const barra = document.createElement('div');
    barra.className = 'jp-barra';
    const enche = document.createElement('i');
    barra.appendChild(enche);
    const pct = document.createElement('em');
    c.append(t, barra, pct);
    grade.appendChild(c);
    return { c, enche, pct, ultimo: -1 };
  });
  const placar = document.createElement('div');
  placar.className = 'jp-placar';
  painel.append(grade, placar);
  hud.appendChild(painel);
  const abertura = document.createElement('div');
  abertura.id = 'janeiro-abertura';
  abertura.textContent = ABERTURA_DA_MISSAO;
  hud.appendChild(abertura);

  let passo = -1;
  let ultimaLinha = '';
  let ultimoPlacar = '';

  const atualizar = (): void => {
    abertura.classList.toggle('jp-fora', match.tickDaMissao >= ABERTURA_TICKS);
    for (let k = 0; k < celulas.length; k++) {
      const cel = celulas[k]!;
      const fracao = Math.max(0, missao.integridade[k]! / INTEGRIDADE_MAX);
      const pct = Math.ceil(fracao * 100);
      if (pct === cel.ultimo) continue;
      cel.ultimo = pct;
      cel.enche.style.transform = `scaleX(${fracao.toFixed(3)})`;
      cel.pct.textContent = `${pct}%`;
      cel.c.classList.toggle('jp-baixo', fracao <= 0.25);
      cel.c.classList.toggle('jp-medio', fracao > 0.25 && fracao <= 0.55);
    }
    const sujas = [0, 0, 0].reduce((s, _, k) => s + missao.mesasSujas(k), 0);
    const texto = `EXPULSOS ${missao.expulsos} · ELIMINADOS ${multidao.eliminados} · REBELDES ${match.rebeldesVivos} · MESAS SUJAS ${sujas}`;
    if (texto !== ultimoPlacar) {
      ultimoPlacar = texto;
      placar.textContent = texto;
    }
    const naPraca = multidao.presentes + match.rebeldesVivos;
    const linha =
      multidao.faltamChegar > 0
        ? `DEFENDA OS TRÊS PRÉDIOS · NA PRAÇA ${naPraca}`
        : naPraca > 0
          ? `ESVAZIE A PRAÇA · ${naPraca} RESTANTES`
          : (match.chefesJaneiro?.restantes ?? 0) > 0 ? 'VENÇA OS CHEFES · PROTEJA A PRAÇA' : 'A PRAÇA ESVAZIOU';
    if (linha !== ultimaLinha) {
      ultimaLinha = linha;
      setLinha(linha);
    }
    let mudou = false;
    for (let k = 0; k < MESAS.length; k++) {
      const m = MESAS[k]!;
      const suja = missao.mesaSuja(m.predio, m.mesa) ? 1 : 0;
      if (suja === sujaAntes[k]) continue;
      sujaAntes[k] = suja;
      montinho.setMatrixAt(k, suja ? matriz.makeTranslation(m.x, 0.95, m.z) : sumida);
      mudou = true;
    }
    if (mudou) montinho.instanceMatrix.needsUpdate = true;
  };
  atualizar();

  return {
    desenhar(alpha: number): void {
      desenho.atualizar(match.tickDaMissao + alpha);
      chefes?.atualizar(pedirGolpe());
      const p = Math.floor(match.tickDaMissao / 12);
      if (p !== passo) {
        passo = p;
        atualizar();
      }
    },
    recomecar(): void {
      desenho.recomecar();
      for (const cel of celulas) cel.ultimo = -1;
      ultimaLinha = '';
      ultimoPlacar = '';
      sujaAntes.fill(0);
      for (let k = 0; k < MESAS.length; k++) montinho.setMatrixAt(k, sumida);
      montinho.instanceMatrix.needsUpdate = true;
      passo = -1;
      atualizar();
    },
    dispose(): void {
      chefes?.dispose();
      scene.remove(desenho.grupo);
      scene.remove(montinho);
      desenho.dispose();
      montinho.geometry.dispose();
      (montinho.material as THREE.Material).dispose();
      montinho.dispose();
      painel.remove();
      abertura.remove();
      estilo.remove();
    },
  };
}
