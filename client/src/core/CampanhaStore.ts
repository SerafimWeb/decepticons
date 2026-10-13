import { CAMPANHA_VERSAO, campanhasDeFabrica, chaveDaCampanha, sanearCampanha, sanearEtapa, type CampanhaSpec } from '../sim/campanha';

/** Onde as campanhas do Comandante ficam salvas no aparelho. */
export const CAMPANHAS_STORAGE_KEY = 'cybermech.campanhas.v1';
/** Quantas cabem na lista (o armazenamento do navegador é pequeno, e cada campanha leva até oito esquadrões). */
export const LIMITE_DE_CAMPANHAS_SALVAS = 8;

export type ResultadoDoSalvar = 'ok' | 'sem-nome' | 'reservado' | 'cheio' | 'sem-armazenamento';

const mesmoNome = (a: string | undefined, b: string | undefined): boolean => (a ?? '').toLocaleUpperCase('pt-BR') === (b ?? '').toLocaleUpperCase('pt-BR');

/**
 * As campanhas que o Comandante montou e guardou no aparelho (fase 4B), com nome, como as montagens do Hangar. Mesmo desenho do `EsquadraoStore`: o armazenamento
 * é injetado (um aparelho sem ele joga só com o link), o que se lê passa por `sanearCampanha` (guardado adulterado ou de outra versão do formato é como não
 * ter nada) e nada aqui roda por frame. O nome é a identidade: salvar com um nome que já existe troca a campanha; os nomes das de fábrica são reservados.
 */
export class CampanhaStore {
  private salvas: CampanhaSpec[];

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
    this.salvas = this.ler();
  }

  /** As campanhas salvas, na ordem em que foram guardadas (uma cópia: quem pede não muda a lista). */
  list(): CampanhaSpec[] {
    return this.salvas.map((c) => structuredClone(c));
  }

  save(c: CampanhaSpec): ResultadoDoSalvar {
    const limpa = sanearCampanha(c);
    if (!limpa.nome) return 'sem-nome';
    if (campanhasDeFabrica().some((f) => mesmoNome(f.nome, limpa.nome))) return 'reservado';
    const i = this.salvas.findIndex((s) => mesmoNome(s.nome, limpa.nome));
    if (i < 0 && this.salvas.length >= LIMITE_DE_CAMPANHAS_SALVAS) return 'cheio';
    const proxima = [...this.salvas];
    if (i >= 0) proxima[i] = limpa;
    else proxima.push(limpa);
    if (!this.gravar(proxima)) return 'sem-armazenamento';
    this.salvas = proxima;
    return 'ok';
  }

  /** Apaga pelo nome; `false` se não havia. */
  remove(nome: string): boolean {
    const proxima = this.salvas.filter((s) => !mesmoNome(s.nome, nome));
    if (proxima.length === this.salvas.length) return false;
    this.gravar(proxima);
    this.salvas = proxima;
    return true;
  }

  /** O texto do link para levar uma campanha a outro aparelho. */
  key(c: CampanhaSpec): string {
    return chaveDaCampanha(c);
  }

  private gravar(lista: readonly CampanhaSpec[]): boolean {
    try {
      if (!this.storage) return false;
      if (lista.length === 0) this.storage.removeItem(CAMPANHAS_STORAGE_KEY);
      else this.storage.setItem(CAMPANHAS_STORAGE_KEY, JSON.stringify(lista));
      return true;
    } catch {
      return false;
    }
  }

  private ler(): CampanhaSpec[] {
    try {
      const raw = this.storage?.getItem(CAMPANHAS_STORAGE_KEY);
      if (!raw) return [];
      const json: unknown = JSON.parse(raw);
      if (!Array.isArray(json)) return [];
      const vistos = new Set<string>();
      const out: CampanhaSpec[] = [];
      for (const item of json) {
        // Um item de outra versão do formato (ou lixo) não vira a campanha padrão: some.
        if (typeof item !== 'object' || item === null || (item as { v?: unknown }).v !== CAMPANHA_VERSAO) continue;
        // Sem nenhuma etapa que valha, o saneamento a trocaria pela padrão: aqui isso seria inventar uma campanha que o Comandante nunca salvou.
        const etapas = (item as { etapas?: unknown }).etapas;
        if (!Array.isArray(etapas) || !etapas.some((e) => sanearEtapa(e))) continue;
        const c = sanearCampanha(item);
        const id = (c.nome ?? '').toLocaleUpperCase('pt-BR');
        if (!id || vistos.has(id)) continue;
        vistos.add(id);
        out.push(c);
        if (out.length >= LIMITE_DE_CAMPANHAS_SALVAS) break;
      }
      return out;
    } catch {
      return [];
    }
  }
}
