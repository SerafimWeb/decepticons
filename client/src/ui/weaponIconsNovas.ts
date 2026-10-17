export type NewWeaponId = 'rotary' | 'arc' | 'flamer' | 'cryo';

/** Ícones de traço (24×24) para as novas armas elementais. */
export const WEAPON_ICON_NOVAS: Record<NewWeaponId, string> = {
  rotary:
    '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="7" r="1.5" /><circle cx="16.3" cy="9.5" r="1.5" /><circle cx="16.3" cy="14.5" r="1.5" /><circle cx="12" cy="17" r="1.5" /><circle cx="7.7" cy="14.5" r="1.5" /><circle cx="7.7" cy="9.5" r="1.5" /><circle cx="12" cy="12" r="2" />',
  arc:
    '<path d="M13 2L4 14h7l-2 8 11-12h-7l2-8z" />',
  flamer:
    '<path d="M12 2c1.5 3 4 4.5 4 7.5a4 4 0 0 1-8 0C8 6.5 10.5 5 12 2z" /><path d="M12 12c1 1.5 2 2.5 2 4a2 2 0 0 1-4 0c0-1.5 1-2.5 2-4z" /><path d="M4 20h16" />',
  cryo:
    '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /><path d="M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 12l-2-2M6 12l-2 2M18 12l2-2M18 12l2 2" />',
};

