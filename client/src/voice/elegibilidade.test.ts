import { describe, expect, it } from 'vitest';
import type { IdadeDaConta } from '../../../shared/net/auth';
import { type ElegibilidadeDaVoz, elegibilidadeDaVoz, microfoneDaNarracaoLiberado, motivoSemVoz, vozDeveLigar } from './elegibilidade';
import { TEXTO_DA_ELEGIBILIDADE, TEXTO_DO_BOTAO_DA_VOZ, TEXTO_SEM_VOZ } from './VozNasConfiguracoes';

describe('elegibilidadeDaVoz (P211): só conta de maior de 18 anos abre o chat de voz', () => {
  it('a tabela inteira: logado × faixa de idade', () => {
    const faixas: IdadeDaConta[] = ['adulto', 'menor', 'sem-idade'];
    const esperado: Record<string, ElegibilidadeDaVoz> = {
      'logado|adulto': 'liberada',
      'logado|menor': 'menor',
      'logado|sem-idade': 'sem-idade',
      'convidado|adulto': 'convidado',
      'convidado|menor': 'convidado',
      'convidado|sem-idade': 'convidado',
    };
    for (const logado of [true, false])
      for (const faixa of faixas) expect(elegibilidadeDaVoz(logado, faixa), `${logado ? 'logado' : 'convidado'}|${faixa}`).toBe(esperado[`${logado ? 'logado' : 'convidado'}|${faixa}`]);
  });

  it('só uma combinação libera: nenhuma outra abre a voz', () => {
    const liberadas = [true, false].flatMap((logado) => (['adulto', 'menor', 'sem-idade'] as const).filter((f) => elegibilidadeDaVoz(logado, f) === 'liberada'));
    expect(liberadas).toEqual(['adulto']);
  });

  it('cada caso que não libera tem a sua frase, e cada uma diz o que fazer ou o que vale', () => {
    expect(Object.keys(TEXTO_DA_ELEGIBILIDADE).sort()).toEqual(['convidado', 'menor', 'sem-idade']);
    expect(TEXTO_DA_ELEGIBILIDADE.convidado).toContain('Crie uma conta');
    expect(TEXTO_DA_ELEGIBILIDADE['sem-idade']).toContain('mês e o ano de nascimento');
    expect(TEXTO_DA_ELEGIBILIDADE.menor).toContain('menores de 18 anos');
    expect(TEXTO_DA_ELEGIBILIDADE.menor, 'a criança continua com o som do jogo').toContain('áudio do jogo segue normal');
  });
});

describe('vozDeveLigar (P211): o jogador quer, o Comandante liberou e a conta é de adulto, as três', () => {
  it('só liga com as três condições', () => {
    for (const quer of [true, false])
      for (const liberada of [true, false])
        for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const)
          expect(vozDeveLigar(quer, liberada, idade), `quer=${quer} liberada=${liberada} idade=${idade}`).toBe(quer && liberada && idade === 'adulto');
  });

  it('menor, sem idade e a sessão ainda não restaurada ficam sem voz mesmo com tudo o mais ligado', () => {
    for (const idade of ['menor', 'sem-idade', undefined] as const) expect(vozDeveLigar(true, true, idade)).toBe(false);
    expect(vozDeveLigar(true, true, 'adulto')).toBe(true);
  });
});

describe('microfoneDaNarracaoLiberado (P230): a narração segue a mesma ordem do chat', () => {
  it('só a conta de adulto abre o microfone; menor, sem idade e a sessão ainda não restaurada ficam sem', () => {
    expect(microfoneDaNarracaoLiberado('adulto')).toBe(true);
    for (const idade of ['menor', 'sem-idade', undefined] as const) expect(microfoneDaNarracaoLiberado(idade), String(idade)).toBe(false);
  });

  it('é a mesma resposta do chat de voz para quem já está liberado (uma regra, duas portas)', () => {
    for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const) expect(microfoneDaNarracaoLiberado(idade)).toBe(vozDeveLigar(true, true, idade));
  });
});

describe('o botão da voz (P226): leva ao que falta', () => {
  it('convidado cria a conta e conta sem idade informa a idade; menor e quem já pode não têm botão', () => {
    expect(TEXTO_DO_BOTAO_DA_VOZ.convidado).toBe('[ CRIAR CONTA ]');
    expect(TEXTO_DO_BOTAO_DA_VOZ['sem-idade']).toBe('[ INFORMAR MINHA IDADE ]');
    expect(TEXTO_DO_BOTAO_DA_VOZ.menor, 'o menor não tem o que fazer').toBeUndefined();
    expect(TEXTO_DO_BOTAO_DA_VOZ.liberada).toBeUndefined();
  });
});

describe('motivoSemVoz (P237): o jogo diz por que a voz não está ligada', () => {
  it('a tabela inteira: elegibilidade × voz ligada × funcionalidade liberada', () => {
    const eleg: ElegibilidadeDaVoz[] = ['liberada', 'convidado', 'sem-idade', 'menor'];
    for (const e of eleg)
      for (const voiceOn of [true, false])
        for (const liberada of [true, false]) {
          const esperado = !liberada ? null : e !== 'liberada' ? e : voiceOn ? null : 'desligada';
          expect(motivoSemVoz(e, voiceOn, liberada), `${e}|voiceOn=${voiceOn}|liberada=${liberada}`).toBe(esperado);
        }
  });

  it('só há aviso quando a voz NÃO liga: a mesma regra do vozDeveLigar, vista do outro lado', () => {
    for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const)
      for (const voiceOn of [true, false]) {
        const e = idade === undefined ? 'convidado' : elegibilidadeDaVoz(true, idade);
        const liga = vozDeveLigar(voiceOn, true, idade);
        expect(motivoSemVoz(e, voiceOn, true) === null, `idade=${idade} voiceOn=${voiceOn}`).toBe(liga);
      }
  });

  it('cada motivo tem a sua frase, e ela diz o que fazer ou o que vale', () => {
    expect(Object.keys(TEXTO_SEM_VOZ).sort()).toEqual(['convidado', 'desligada', 'menor', 'sem-idade']);
    expect(TEXTO_SEM_VOZ.convidado).toContain('CONTA DE MAIOR DE 18 ANOS');
    expect(TEXTO_SEM_VOZ['sem-idade']).toContain('INFORME SUA IDADE');
    expect(TEXTO_SEM_VOZ.menor).toContain('SÓ O ÁUDIO DO JOGO');
    expect(TEXTO_SEM_VOZ.desligada).toContain('CONVERSAR POR VOZ');
  });
});
