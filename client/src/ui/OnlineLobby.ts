import { browserStorage } from '../core/Settings';
import { sanitizeName } from '../../../shared/net/messages';
import { PUBLIC_ROOM } from '../net/onlineConfig';

/**
 * Lobby e tela de carregamento do multiplayer (M6).
 */
export class OnlineLobby {
  private readonly modal = document.getElementById('online-lobby')!;
  private readonly btnClose = document.getElementById('btn-lobby-close')!;
  private readonly btnConnect = document.getElementById('btn-lobby-connect') as HTMLButtonElement;
  private readonly inputName = document.getElementById('lobby-name')! as HTMLInputElement;
  private readonly inputRoom = document.getElementById('lobby-room')! as HTMLInputElement;
  private readonly storage = browserStorage();

  constructor() {
    this.inputName.value = this.storage?.getItem('cybermech-name') || '';

    this.btnClose.addEventListener('click', () => this.hide());
    
    this.btnConnect.addEventListener('click', () => {
      const name = sanitizeName(this.inputName.value || 'PILOTO');
      const room = this.inputRoom.value.trim().toUpperCase() || PUBLIC_ROOM;
      this.storage?.setItem('cybermech-name', name);
      
      const url = new URL(location.href);
      url.searchParams.set('sala', room);
      url.searchParams.set('nome', name);
      location.assign(url.toString());
    });
  }

  show(room: string = PUBLIC_ROOM): void {
    this.inputRoom.value = room;
    this.modal.classList.remove('hidden');
    this.setConnecting(false);
    this.inputName.focus();
  }

  setConnecting(connecting: boolean, msg: string = 'CONECTANDO...'): void {
    if (connecting) {
      this.modal.classList.remove('hidden');
      this.btnConnect.disabled = true;
      this.btnConnect.textContent = `[ ${msg} ]`;
      this.inputName.disabled = true;
      this.inputRoom.disabled = true;
      
      // Tela de carregamento estética (grafos técnicos)
      const bgClass = Math.random() > 0.5 ? 'bg-grafo' : 'bg-bars';
      this.modal.classList.add(bgClass);
      
    } else {
      this.btnConnect.disabled = false;
      this.btnConnect.textContent = '[ ENTRAR NA SALA ]';
      this.inputName.disabled = false;
      this.inputRoom.disabled = false;
      
      this.modal.classList.remove('bg-grafo', 'bg-bars');
    }
  }

  hide(): void {
    this.modal.classList.add('hidden');
    this.modal.classList.remove('bg-grafo', 'bg-bars');
  }
}
