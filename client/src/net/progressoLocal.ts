import { MONTAGEM_MAX, type ProgressoPiloto } from '../../../shared/net/auth';
import { sanitizeName } from '../../../shared/net/messages';
import { HANGAR_STORAGE_KEY } from '../hangar/Hangar';
import type { Armazem, ProgressoLocal } from './sessao';

/** A chave do apelido da sala online (`ui/OnlineLobby.ts`). */
export const CHAVE_APELIDO = 'cybermech-name';

/** O que o jogo oferece à sessão: o nível, o XP e os créditos (`ui/DailyChallenges`) e a montagem do Hangar. */
export interface FontesDoJogo {
  daily: { snapshot(): { nivel: number; xp: number; creditos: number }; restore(p: { nivel: number; xp: number; creditos: number }): void };
  armazem: Armazem | null;
  /** Aplica a montagem que veio da conta (o Hangar valida e a agenda para o próximo renascimento). Opcional: sem ela só o armazenamento é atualizado. */
  aplicarMontagem?: (json: string) => void;
}

/**
 * Liga a sessão (`net/sessao.ts`) ao que o navegador já guardava: o progresso do piloto, o apelido e a montagem do Hangar. **Nada é copiado para outro lugar**: lê e escreve nas mesmas
 * chaves de sempre, então quem nunca criar conta não vê diferença nenhuma.
 */
export function progressoLocalDoJogo(f: FontesDoJogo): ProgressoLocal {
  const ler = (chave: string): string => {
    try {
      return f.armazem?.getItem(chave) ?? '';
    } catch {
      return '';
    }
  };
  return {
    ler(quandoMudou: number): ProgressoPiloto {
      const bruto = ler(CHAVE_APELIDO).trim();
      const montagem = ler(HANGAR_STORAGE_KEY);
      return {
        // O mesmo filtro da sala e do servidor: o que vai e volta é igual, e não há conta que prenda o "mesmo" progresso em reenvios sem fim.
        apelido: bruto ? sanitizeName(bruto) : '',
        ...f.daily.snapshot(),
        montagem: montagem.length <= MONTAGEM_MAX ? montagem : '',
        atualizadoEm: quandoMudou,
      };
    },
    aplicar(p: ProgressoPiloto): void {
      f.daily.restore({ nivel: p.nivel, xp: p.xp, creditos: p.creditos });
      try {
        if (p.apelido) f.armazem?.setItem(CHAVE_APELIDO, p.apelido);
        if (p.montagem) {
          f.armazem?.setItem(HANGAR_STORAGE_KEY, p.montagem);
          f.aplicarMontagem?.(p.montagem);
        }
      } catch {
        /* navegador sem armazenamento: o nível e os créditos já foram; o resto vale quando houver */
      }
    },
  };
}
