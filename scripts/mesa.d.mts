export type CasoDaMesa = 'sem-mesa' | 'ja-ligada' | 'ligar';

/** A porta, o endereço do editor e o arquivo que liga a mesa (local, em `.tmp/video/`). */
export const PORTA_DA_MESA: number;
export const URL_DA_MESA: string;
export const ARQUIVO_DA_MESA: string;

/** O que fazer, dado o que existe na máquina: sem a mesa instalada, ela já ligada, ou ligar. */
export function decidir(estado: { existe: boolean; escutando: boolean }): CasoDaMesa;
/** A mensagem de cada caso (o que o terminal escreve). */
export function mensagem(caso: CasoDaMesa): string;
/** Alguém escuta nesta porta do computador? (conexão local, sem sair da máquina) */
export function portaEscutando(porta: number, host?: string, espera?: number): Promise<boolean>;
/** Abre o endereço no navegador padrão. */
export function abrirNoNavegador(url: string, plataforma?: string): void;
