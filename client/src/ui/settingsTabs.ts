/**
 * Abas do modal de Configurações (UI-2, `AUDITORIA_INTERFACE.md`). Antes eram 10 seções numa rolagem única de 2.245 px; agora cada seção
 * declara a sua aba no HTML (`data-tab`) e só a aba ativa aparece. Módulo independente (G3): não conhece nenhum ajuste, só esconde e mostra.
 * Custo de CPU: zero fora do clique.
 */
export const SETTINGS_TABS = ['jogo', 'controles', 'graficos', 'avancado'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export function isSettingsTab(v: string | undefined | null): v is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(v ?? '');
}

/** Liga os botões `.settings-tab` do modal às seções `.settings-section[data-tab]`. Devolve `select` para quem quiser abrir numa aba. */
export function attachSettingsTabs(modal: HTMLElement, initial: SettingsTab = 'jogo'): { select(tab: SettingsTab): void } {
  const buttons = [...modal.querySelectorAll<HTMLButtonElement>('.settings-tab')];
  const sections = [...modal.querySelectorAll<HTMLElement>('.settings-section[data-tab]')];
  const body = modal.querySelector<HTMLElement>('.settings-body');
  const select = (tab: SettingsTab): void => {
    for (const b of buttons) {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    }
    for (const s of sections) s.hidden = s.dataset.tab !== tab;
    if (body) body.scrollTop = 0;
  };
  for (const b of buttons) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isSettingsTab(b.dataset.tab)) select(b.dataset.tab);
    });
  }
  select(initial);
  return { select };
}
