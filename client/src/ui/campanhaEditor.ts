import { sanearCampanha, LIMITES_DA_CAMPANHA, modoServeAoMapa, MODOS_DO_MAPA, sanearAbates, type CampanhaSpec, type EtapaDaCampanha } from '../sim/campanha';
import { limparNome, resumoDoEsquadrao, type EsquadraoSpec } from '../sim/esquadrao';
import type { MapId } from '../environment/Bunker';
import type { GameMode } from '../sim/gameMode';

/**
 * As contas da janela Campanha (13/10, fase 4B): só dados e funções, sem DOM, para a tela (`CampaignPanel.ts`) só desenhar. Cada função recebe a campanha e
 * devolve **outra** (nunca muda a recebida) já passada por `sanearCampanha`, então o que sai do editor é sempre uma campanha válida, no mesmo molde do
 * `esquadraoEditor.ts`. Uma ação que não vale (etapa a mais, mapa sem o modo) devolve a campanha como estava, e `podeAdicionar` diz de antemão.
 */

const copia = (c: CampanhaSpec): CampanhaSpec => JSON.parse(JSON.stringify(c)) as CampanhaSpec;

/** Cabe mais uma etapa? */
export const podeAdicionar = (c: CampanhaSpec): boolean => c.etapas.length < LIMITES_DA_CAMPANHA.etapas;

/** A etapa que a janela oferece para acrescentar: Cidade Neon, Sobrevivência, com o esquadrão que o Comandante escolheu. */
export function novaEtapa(esquadrao: EsquadraoSpec, mapa: MapId = 'arena', modo: GameMode = 'survival'): EtapaDaCampanha {
  const m: GameMode = modoServeAoMapa(modo, mapa) ? modo : 'deathmatch';
  return m === 'deathmatch' ? { mapa, modo: m, esquadrao, abates: LIMITES_DA_CAMPANHA.abatesPadrao } : { mapa, modo: m, esquadrao };
}

export function adicionarEtapa(c: CampanhaSpec, etapa: EtapaDaCampanha): CampanhaSpec {
  if (!podeAdicionar(c)) return c;
  const out = copia(c);
  out.etapas.push(etapa);
  return sanearCampanha(out);
}

/** Tira a etapa `i` (de 0). A última não sai: uma campanha sem etapa não existe (o saneamento a trocaria pela padrão em silêncio). */
export function removerEtapa(c: CampanhaSpec, i: number): CampanhaSpec {
  if (c.etapas.length <= 1 || i < 0 || i >= c.etapas.length) return c;
  const out = copia(c);
  out.etapas.splice(i, 1);
  return sanearCampanha(out);
}

/** Troca a etapa `i` de lugar com a vizinha (`-1` sobe, `1` desce). Na ponta, não faz nada. */
export function moverEtapa(c: CampanhaSpec, i: number, passo: -1 | 1): CampanhaSpec {
  const j = i + passo;
  if (i < 0 || i >= c.etapas.length || j < 0 || j >= c.etapas.length) return c;
  const out = copia(c);
  [out.etapas[i], out.etapas[j]] = [out.etapas[j]!, out.etapas[i]!];
  return sanearCampanha(out);
}

/** Muda o mapa da etapa. Se o modo dela não roda no mapa novo (Sobrevivência no Bunker), vira Deathmatch; o esquadrão é cortado pelo saneamento ao que o mapa comporta. */
export function trocarMapa(c: CampanhaSpec, i: number, mapa: MapId): CampanhaSpec {
  const e = c.etapas[i];
  if (!e || e.mapa === mapa) return c;
  const out = copia(c);
  const alvo = out.etapas[i]!;
  alvo.mapa = mapa;
  if (!modoServeAoMapa(alvo.modo, mapa)) {
    alvo.modo = 'deathmatch';
    alvo.abates = LIMITES_DA_CAMPANHA.abatesPadrao;
  }
  return sanearCampanha(out);
}

/** Muda o modo da etapa (se o mapa o comporta). Entrar no Deathmatch põe a meta padrão; sair dele a apaga. */
export function trocarModo(c: CampanhaSpec, i: number, modo: GameMode): CampanhaSpec {
  const e = c.etapas[i];
  if (!e || e.modo === modo || !modoServeAoMapa(modo, e.mapa)) return c;
  const out = copia(c);
  const alvo = out.etapas[i]!;
  alvo.modo = modo;
  if (modo === 'deathmatch') alvo.abates = LIMITES_DA_CAMPANHA.abatesPadrao;
  else delete alvo.abates;
  return sanearCampanha(out);
}

/** A meta de abates do Deathmatch, dentro dos limites. Nos outros modos não faz nada. */
export function trocarAbates(c: CampanhaSpec, i: number, abates: number): CampanhaSpec {
  const e = c.etapas[i];
  if (!e || e.modo !== 'deathmatch') return c;
  const out = copia(c);
  out.etapas[i]!.abates = sanearAbates(abates);
  return sanearCampanha(out);
}

/** Põe um esquadrão na etapa (o mesmo contrato do editor de esquadrão); o saneamento corta o que o mapa não comporta. */
export function trocarEsquadrao(c: CampanhaSpec, i: number, esquadrao: EsquadraoSpec): CampanhaSpec {
  if (!c.etapas[i]) return c;
  const out = copia(c);
  out.etapas[i]!.esquadrao = esquadrao;
  return sanearCampanha(out);
}

/** O nome da campanha (limpo; vazio apaga e a tela mostra o título automático). */
export function renomear(c: CampanhaSpec, nome: string): CampanhaSpec {
  const out = copia(c);
  const limpo = limparNome(nome);
  if (limpo) out.nome = limpo;
  else delete out.nome;
  return sanearCampanha(out);
}

/** Os modos que a lista da etapa oferece para o mapa dela. */
export const modosOferecidos = (mapa: MapId): readonly GameMode[] => MODOS_DO_MAPA[mapa];

/** A linha de resumo do esquadrão da etapa: "3 inimigos · 2 aliados". */
export function resumoDoEsquadraoDaEtapa(e: EtapaDaCampanha): string {
  const r = resumoDoEsquadrao(e.esquadrao);
  const inimigos = `${r.inimigos} ${r.inimigos === 1 ? 'inimigo' : 'inimigos'}`;
  const aliados = `${r.aliados} ${r.aliados === 1 ? 'aliado' : 'aliados'}`;
  return `${inimigos} · ${aliados}`;
}

/** O título automático de uma campanha sem nome: "CAMPANHA · 3 ETAPAS". */
export const tituloDaCampanha = (c: CampanhaSpec): string => c.nome ?? `CAMPANHA · ${c.etapas.length} ${c.etapas.length === 1 ? 'ETAPA' : 'ETAPAS'}`;
