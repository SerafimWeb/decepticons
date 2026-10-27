import { ROTEIRO_VERSAO, chaveDoRoteiro, sanearRoteiro, type RoteiroSpec } from '../sim/Roteiro';

/** Onde os roteiros do WARGAME ficam salvos no aparelho (P262). */
export const ROTEIROS_STORAGE_KEY = 'cybermech.roteiros.v1';
/** Quantos cabem na lista (o armazenamento do navegador é pequeno). */
export const LIMITE_DE_ROTEIROS_SALVOS = 8;

export type ResultadoDoSalvar = 'ok' | 'sem-nome' | 'cheio' | 'sem-armazenamento';

const mesmoNome = (a: string | undefined, b: string | undefined): boolean => (a ?? '').toLocaleUpperCase('pt-BR') === (b ?? '').toLocaleUpperCase('pt-BR');

/**
 * Os roteiros do WARGAME que o Comandante montou e guardou no aparelho (P262), mesmo desenho de `CampanhaStore`: o
 * armazenamento é injetado (um aparelho sem ele joga só com o link), o que se lê passa por `sanearRoteiro` (guardado
 * adulterado ou de outra versão do formato é como não ter nada) e nada aqui roda por quadro. O nome é a identidade:
 * salvar com um nome que já existe troca o roteiro.
 */
export class RoteiroStore {
  private salvos: RoteiroSpec[];

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
    this.salvos = this.ler();
  }

  /** Os roteiros salvos, na ordem em que foram guardados (uma cópia: quem pede não muda a lista). */
  list(): RoteiroSpec[] {
    return this.salvos.map((r) => structuredClone(r));
  }

  save(r: RoteiroSpec): ResultadoDoSalvar {
    const limpo = sanearRoteiro(r);
    if (!limpo.nome) return 'sem-nome';
    const i = this.salvos.findIndex((s) => mesmoNome(s.nome, limpo.nome));
    if (i < 0 && this.salvos.length >= LIMITE_DE_ROTEIROS_SALVOS) return 'cheio';
    const proximos = [...this.salvos];
    if (i >= 0) proximos[i] = limpo;
    else proximos.push(limpo);
    if (!this.gravar(proximos)) return 'sem-armazenamento';
    this.salvos = proximos;
    return 'ok';
  }

  /** Apaga pelo nome; `false` se não havia. */
  remove(nome: string): boolean {
    const proximos = this.salvos.filter((s) => !mesmoNome(s.nome, nome));
    if (proximos.length === this.salvos.length) return false;
    this.gravar(proximos);
    this.salvos = proximos;
    return true;
  }

  /** O texto do link para levar o roteiro a outro aparelho. */
  key(r: RoteiroSpec): string {
    return chaveDoRoteiro(r);
  }

  private gravar(lista: readonly RoteiroSpec[]): boolean {
    try {
      if (!this.storage) return false;
      if (lista.length === 0) this.storage.removeItem(ROTEIROS_STORAGE_KEY);
      else this.storage.setItem(ROTEIROS_STORAGE_KEY, JSON.stringify(lista));
      return true;
    } catch {
      return false;
    }
  }

  private ler(): RoteiroSpec[] {
    try {
      const raw = this.storage?.getItem(ROTEIROS_STORAGE_KEY);
      if (!raw) return [];
      const json: unknown = JSON.parse(raw);
      if (!Array.isArray(json)) return [];
      const vistos = new Set<string>();
      const out: RoteiroSpec[] = [];
      for (const item of json) {
        // Um item de outra versão do formato (ou lixo) não vira o roteiro padrão: some.
        if (typeof item !== 'object' || item === null || (item as { v?: unknown }).v !== ROTEIRO_VERSAO) continue;
        // Sem nenhuma batida que valha, o saneamento devolveria um roteiro vazio "de fábrica" — mas aqui o nome dado pelo
        // Comandante já é o bastante para valer a pena guardar (um roteiro recém-começado, só o elenco, sem batida ainda).
        const nome = (item as { nome?: unknown }).nome;
        if (typeof nome !== 'string' || !nome.trim()) continue;
        const r = sanearRoteiro(item);
        const id = (r.nome ?? '').toLocaleUpperCase('pt-BR');
        if (!id || vistos.has(id)) continue;
        vistos.add(id);
        out.push(r);
        if (out.length >= LIMITE_DE_ROTEIROS_SALVOS) break;
      }
      return out;
    } catch {
      return [];
    }
  }
}
