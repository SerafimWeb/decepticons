import { t } from '../i18n/i18n';

/**
 * O botão de mudo ao lado de cada piloto na lista da REDE (P228). Mora no **pedaço sob demanda da voz** (quem nunca liga a voz nunca baixa isto): a lista da REDE, que está no pacote de partida,
 * só guarda o clique e pede ao pedaço da voz que desenhe o botão. O pacote de partida está colado no teto de 500 KB.
 *
 * `mudo` diz se este piloto está silenciado agora; o botão mostra o estado (e o diz a leitor de tela com `aria-pressed`). Quem clica inverte o estado: a lista lê o `aria-pressed`.
 */
export function anexarMudo(li: HTMLElement, id: number, mudo: boolean): void {
  const m = document.createElement('button');
  m.type = 'button';
  m.className = mudo ? 'rede-mudo ligado' : 'rede-mudo';
  m.dataset.mudo = String(id);
  m.setAttribute('aria-pressed', String(mudo));
  m.textContent = mudo ? t('VOZ SILENCIADA') : t('SILENCIAR VOZ');
  m.title = mudo ? t('Ouvir de novo a voz deste piloto') : t('Silenciar a voz deste piloto até você sair da sala');
  li.append(m);
}
