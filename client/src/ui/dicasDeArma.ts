import { lobMaxRange } from '../combat/lob';
import { weapon, type WeaponId, type WeaponStats } from '../combat/weapons';

/**
 * A dica de primeiro uso de cada arma (P160 parte 5; o Comandante, 15/10: *"selecionei e implementei elas, mas parece que são armas antigas"*). Antes
 * havia uma dica só para as armas de munição, e dizia "FOGUETES: DANO EM ÁREA" até para a granada, o enxame e o cruzador: uma arma nova se parecia com
 * o foguete também no texto. Agora **cada arma tem a sua frase**, que aparece uma vez, na primeira vez que o jogador atira com ela (e não volta).
 *
 * Dado, não código: o `Record` obriga uma frase por arma nova (o typecheck quebra se faltar), e `dicasDeArma.test.ts` confere que nenhuma se repete.
 * Os números saem da arma (`weapon(id)`), então a dica nunca diz uma coisa e o jogo outra.
 */

const s = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');

/** A frase de cada arma, no tom das outras dicas (caixa alta, curta, imperativa). */
export const DICA_DA_ARMA: Readonly<Record<WeaponId, (w: WeaponStats) => string>> = {
  plasma: () => 'PLASMA: TIRO RÁPIDO E LIMPO; ATIRE EM RAJADAS E DEIXE O CALOR ESFRIAR',
  blaster: () => 'BLASTER: LEVE E PRECISO, ALCANCE LONGO E DANO BAIXO; BOM PARA INCOMODAR',
  shotgun: (w) => `ESCOPETA: ${w.pellets?.count ?? 9} BALINS NUM CONE; MORTAL DE PERTO, ESPALHA DE LONGE`,
  chainsaw: () => 'MOTOSSERRA: CORTA O QUE ESTÁ ENCOSTADO; CHEGUE PERTO',
  rotary: () => 'ROTATÓRIA: SEGURE PARA O CANO GIRAR; A CADÊNCIA SOBE E A MIRA ABRE',
  flamer: () => 'LANÇA-CHAMAS: FOGO EM CONE QUE QUEIMA O ALVO; O TANQUE ACABA',
  sonic: () => 'SÔNICO: A ONDA EMPURRA O INIMIGO PARA LONGE DA COBERTURA',
  arc: () => 'ELÉTRICA: CHOQUE REDUZ A VELOCIDADE; TIRO NA CABEÇA ATORDOA',
  cryo: () => 'GELO: TRÊS ACERTOS CONGELAM O ALVO POR UM INSTANTE',
  emp: () => 'EMP: ESQUENTA O ALVO NO IMPACTO; O CALOR DELE TRAVA AS ARMAS',
  railgun: (w) => `TRILHO: CARREGA ${s(w.chargeTime ?? 0)} S E O RAIO ACERTA NA HORA`,
  cannon: (w) => `CANHÃO PESADO: UM OBUS A CADA ${s(w.fireInterval)} S; BATE COMO UM CAMINHÃO`,
  autocannon: () => 'AUTOMÁTICO: PROJÉTEIS DE AÇO EM SEQUÊNCIA FIRME; MIRE E SEGURE',
  siege: (w) => `CERCO: SEGURE ${s(w.chargeTime ?? 0)} S E SOLTE O BOTÃO PARA DISPARAR`,
  rockets: () => 'FOGUETES: DANO EM ÁREA; EXPLODA NO PÉ DO INIMIGO',
  seeker: (w) => `TELEGUIADO: TRAVA NO INIMIGO À FRENTE (ATÉ ${Math.round(w.guide?.lockRange ?? 0)} M) E CURVA ATRÁS DELE`,
  barrage: (w) => `CHUVA: ${w.barrage?.bombs ?? 8} BOMBAS CAEM EM VOLTA DO PONTO DA MIRA; SAIA DO ANEL`,
  swarm: (w) => `ENXAME: UM APERTO ESVAZIA O LANÇADOR (${w.magazine} MÍSSEIS); VARRA A MIRA PELO ALVO`,
  cruise: () => 'CRUZADOR: SOBE EM ARCO E CAI NO PONTO DA MIRA; O ANEL NO CHÃO É O AVISO',
  grenade: (w) => `GRANADA: CAI NO ANEL VERDE (ATÉ ${Math.round(lobMaxRange(w.speed, w.lob?.gravity ?? 22))} M); MIRE ATRÁS DA COBERTURA E ELA PASSA POR CIMA`,
  harpoon: (w) => `ARPÃO: PUXA O INIMIGO À VISTA (ATÉ ${Math.round(w.maxRange)} M) SE NÃO FOR MAIS PESADO QUE VOCÊ; O DASH CORTA O CABO`,
  laser: () => 'LASER: SEGURE E MANTENHA A MIRA NO ALVO; ACERTA NA HORA, O CALOR DECIDE A DURAÇÃO',
};

/** A frase de `w` (a arma do jogador, no nível dele). */
export function dicaDaArma(w: WeaponStats): string {
  return DICA_DA_ARMA[w.id](w);
}

/** O mínimo do `Storage` que a memória usa (o `localStorage` serve; o teste entrega um falso). */
export interface Memoria {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/**
 * Quais armas já tiveram a dica mostrada: guardado no navegador (as dicas não voltam em outra visita) e tolerante a falha (modo privado, armazenamento
 * cheio ou bloqueado: a dica então vale uma vez por abertura do jogo, e nada quebra).
 */
export class DicasVistas {
  static readonly CHAVE = 'cybermech.dicas.armas.v1';
  private readonly vistas = new Set<string>();

  constructor(private readonly memoria: Memoria | null) {
    try {
      const bruto = memoria?.getItem(DicasVistas.CHAVE);
      const lista: unknown = bruto ? JSON.parse(bruto) : [];
      if (Array.isArray(lista)) for (const id of lista) if (typeof id === 'string') this.vistas.add(id);
    } catch {
      // memória ilegível: começa do zero
    }
  }

  /** A dica de `w`, ou `null` se já foi vista. */
  pendente(w: WeaponStats): string | null {
    return this.vistas.has(w.id) ? null : dicaDaArma(w);
  }

  /** Marca a dica de `w` como vista (e guarda). */
  marcar(w: WeaponStats): void {
    if (this.vistas.has(w.id)) return;
    this.vistas.add(w.id);
    try {
      this.memoria?.setItem(DicasVistas.CHAVE, JSON.stringify([...this.vistas]));
    } catch {
      // sem armazenamento: vale até fechar o jogo
    }
  }
}

/** As dicas de todas as armas no MK I (o teste e a tela de ajuda leem daqui). */
export function todasAsDicas(): Array<{ id: WeaponId; texto: string }> {
  return (Object.keys(DICA_DA_ARMA) as WeaponId[]).map((id) => ({ id, texto: dicaDaArma(weapon(id)) }));
}
