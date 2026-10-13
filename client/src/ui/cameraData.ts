import type { MuralSala } from '../../../shared/net/mural';
import type { EstadoDoMural } from '../net/mural';
import type { RadarCaixa, RadarQuadro } from './TacticalRadar';

/** As contas e os textos da janela de câmeras ao vivo (P88), sem DOM: o que a tela desenha sai daqui e tem teste. */

/** O radar de uma sala: os pilotos (triângulos verdes, para onde olham), os Mechs (vermelho grande) e os andróides e técnicos (vermelho pequeno). Só vivos. */
export function quadroDaSala(sala: MuralSala, caixas: readonly RadarCaixa[], meia: number): RadarQuadro {
  const jogadores: (RadarQuadro['voce'] & object)[] = [];
  const inimigos: RadarQuadro['inimigos'][number][] = [];
  for (let i = 0; i < sala.n; i++) {
    const u = sala.unidades[i]!;
    if (!u.viva) continue;
    if (u.tipo === 'human') jogadores.push({ x: u.x, z: u.z, yaw: u.yaw });
    else inimigos.push({ x: u.x, z: u.z, grande: u.tipo === 'mech' });
  }
  return { mapa: 'arena', meia, caixas, voce: null, jogadores, aliados: [], inimigos };
}

/** "1:35" (ou "intervalo" entre as rodadas). */
export function tempoDaRodada(restanteS: number, jogando: boolean): string {
  if (!jogando) return 'intervalo';
  const s = Math.max(0, Math.round(restanteS));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** O que o cartão de uma sala diz: o código e uma linha com pilotos, IAs vivas, rodada e tempo. */
export function linhaDoCartao(sala: MuralSala): { titulo: string; detalhe: string } {
  let ias = 0;
  for (let i = 0; i < sala.n; i++) {
    const u = sala.unidades[i]!;
    if (u.tipo !== 'human' && u.viva) ias++;
  }
  const pilotos = sala.jogadores === 1 ? '1 piloto' : `${sala.jogadores} pilotos`;
  return { titulo: sala.codigo, detalhe: `${pilotos} · ${ias} IA${ias === 1 ? '' : 's'} · rodada ${sala.rodada}, ${tempoDaRodada(sala.restanteS, sala.jogando)}` };
}

/** As salas com mais gente primeiro; empate, pelo código. Não mexe no vetor de quem chama. */
export function ordenarSalas(salas: readonly MuralSala[]): MuralSala[] {
  return [...salas].sort((a, b) => b.jogadores - a.jogadores || a.codigo.localeCompare(b.codigo));
}

/** O total do cabeçalho: salas e pilotos. */
export function totais(salas: readonly MuralSala[]): { salas: number; pilotos: number } {
  let pilotos = 0;
  for (const s of salas) pilotos += s.jogadores;
  return { salas: salas.length, pilotos };
}

export interface TextoDoEstado {
  /** A etiqueta curta do selo. */
  chip: string;
  /** `ok` verde, `espera` âmbar, `erro` vermelho. */
  tom: 'ok' | 'espera' | 'erro';
  /** A frase para quem lê; `null` quando o selo basta. */
  frase: string | null;
  /** Falta o token, ou ele foi recusado: a janela oferece abrir a janela do SERVIDOR, onde se digita. */
  pedeToken: boolean;
}

/** O que a janela diz de cada estado da conexão do mural. */
export function textoDoEstado(e: EstadoDoMural): TextoDoEstado {
  switch (e) {
    case 'ao-vivo':
      return { chip: 'AO VIVO', tom: 'ok', frase: null, pedeToken: false };
    case 'parado':
    case 'conectando':
      return { chip: 'CONECTANDO', tom: 'espera', frase: 'Ligando as câmeras…', pedeToken: false };
    case 'caiu':
      return { chip: 'SEM SINAL', tom: 'espera', frase: 'O servidor não respondeu. Ele está desligado, reiniciando ou o túnel caiu; a janela tenta de novo sozinha.', pedeToken: false };
    case 'sem-servidor':
      return { chip: 'SEM SERVIDOR', tom: 'erro', frase: 'Este jogo não sabe onde está o servidor (build offline).', pedeToken: false };
    case 'sem-token':
      return { chip: 'SEM TOKEN', tom: 'erro', frase: 'As câmeras só abrem com o token do dono: entre pela janela do SERVIDOR (o mesmo token vale aqui).', pedeToken: true };
    case 'token':
      return { chip: 'TOKEN RECUSADO', tom: 'erro', frase: 'O servidor recusou o token. Confira o arquivo metricas-token.txt no PC do servidor.', pedeToken: true };
    case 'bloqueado':
      return { chip: 'BLOQUEADO', tom: 'erro', frase: 'Erros de token demais deste endereço: espere uns 10 minutos.', pedeToken: false };
    case 'desligado':
      return { chip: 'SEM PORTA', tom: 'erro', frase: 'Este servidor não tem a porta do dono ligada (sem token configurado).', pedeToken: false };
  }
}
