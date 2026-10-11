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

/** Dicas de uma linha em português no tom das de WEAPON_HINT. */
export const WEAPON_HINT_NOVAS: Record<NewWeaponId, string> = {
  rotary:
    'Energia · a cadência sobe de 3 a 20 tiros/s segurando o gatilho · espalhamento abre com a aceleração · o calor é o freio',
  arc:
    'Energia · projétil elétrico rápido · aplica Chocado (−35% de velocidade); tiro na cabeça ou 3 acertos seguidos atordoa 0,8 s',
  flamer:
    'Combustível · fluxo contínuo em cone de 30 m (MK II 39 m, MK III 48 m) · 10 de dano por pulso (50/s) em todos os que estão nele, que ficam Queimando (6/s + calor) · cada nível dá mais alcance, mais pulsos por segundo e mais dano · 6 s de chama, 4 s de recarga · esquenta quem atira · apagado por gelo',
  cryo:
    'Energia · projétil criogênico de alcance curto (55 m) · aplica Gelado (−15% de velocidade/acúmulo até 3x); 3 acúmulos congelam por 1,5 s (+20% dano); apagado por fogo',
};
