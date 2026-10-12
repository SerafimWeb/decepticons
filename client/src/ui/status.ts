export type StatusKind = 'queimando' | 'chocado' | 'atordoado' | 'gelado' | 'congelado';

export interface StatusView {
  kind: StatusKind;
  left: number; /* segundos restantes */
  level: number; /* 0..1, intensidade */
}
