import type { Hangar } from '../hangar/Hangar';
import { reloadWithout } from '../core/url';
import { factorySpec } from '../hangar/loadout';

/**
 * Botão na pausa para trocar de piloto: Mech (Vector-09) ou andróide (dono, 25/09: "também quero poder
 * jogar com andróides menores"). Trocar de chassi troca o modelo inteiro: salva a montagem de fábrica do
 * outro chassi no Hangar e recarrega a partida. A tela do Hangar (Codex) vai oferecer o mesmo, com as armas.
 * Também ajusta os textos da pausa (subtítulo e teclas das armas) para o piloto atual.
 */
export class PilotSwitch {
  constructor(hangar: Hangar, before: HTMLElement | null = document.getElementById('btn-settings')) {
    if (hangar.current.chassis === 'android') {
      setText('pilot-sub', 'ANDRÓIDE // piloto a pé contra os Mechs');
      setText('key-primary', 'blaster');
      setText('key-secondary', 'motosserra (encostado)');
    }
    if (!before?.parentElement) return;
    const other = hangar.current.chassis === 'android' ? 'vector09' : 'android';
    const btn = document.createElement('button');
    btn.id = 'btn-pilot';
    btn.type = 'button';
    btn.className = 'btn-terminal';
    btn.textContent = other === 'android' ? '[ PILOTAR ANDRÓIDE ]' : '[ PILOTAR MECH ]';
    btn.title = other === 'android' ? 'Jogar com um andróide de 1,6 m contra os Mechs' : 'Voltar para o Vector-09';
    btn.addEventListener('click', (e) => {
      // A pausa inteira é o botão de "jogar": sem isto o clique também retomaria a partida.
      e.stopPropagation();
      hangar.apply(factorySpec(other));
      // Sem o ?build= do endereço: senão o link de build reaplicaria o chassi antigo.
      reloadWithout('build');
    });
    before.parentElement.insertBefore(btn, before);
  }
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
