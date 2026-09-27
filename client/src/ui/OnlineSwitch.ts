import { reloadWithout } from '../core/url';
import { PUBLIC_ROOM } from '../net/onlineConfig';
import { OnlineLobby } from './OnlineLobby';

/**
 * Botão na pausa para entrar e sair do online (dono, 26/09: "quero que outra pessoa possa simplesmente clicar em
 * online e entrar na mesma sala"). Só aparece quando há servidor (o público do build, ou o do próprio PC). Entrar
 * abre o Lobby; sair recarrega sem a sala.
 */
export class OnlineSwitch {
  constructor(online: boolean, hasServer: boolean, before: HTMLElement | null = document.getElementById('btn-settings')) {
    if (!before?.parentElement || (!online && !hasServer)) return;
    const btn = document.createElement('button');
    btn.id = 'btn-online';
    btn.type = 'button';
    btn.className = 'btn-terminal';
    btn.textContent = online ? '[ JOGAR OFFLINE ]' : '[ JOGAR ONLINE ]';
    btn.title = online ? 'Sair da sala e jogar contra os bots, sem internet' : 'Entrar na sala online com quem estiver jogando agora';
    
    let lobby: OnlineLobby | null = null;
    if (!online) {
      lobby = new OnlineLobby();
    }

    btn.addEventListener('click', (e) => {
      // A pausa inteira é o botão de "jogar": sem isto o clique também retomaria a partida.
      e.stopPropagation();
      if (online) {
        reloadWithout('sala');
        return;
      }
      lobby?.show(PUBLIC_ROOM);
    });
    before.parentElement.insertBefore(btn, before);
  }
}
