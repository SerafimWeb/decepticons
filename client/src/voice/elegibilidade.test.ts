import { describe, expect, it } from 'vitest';
import type { IdadeDaConta } from '../../../shared/net/auth';
import { type ElegibilidadeDaVoz, elegibilidadeDaVoz, microfoneLiberado, motivoSemVoz, vozDeveLigar } from './elegibilidade';
import { TEXTO_DA_ELEGIBILIDADE, TEXTO_DO_BOTAO_DA_VOZ, TEXTO_SEM_VOZ } from './VozNasConfiguracoes';

describe('elegibilidadeDaVoz, regra da P211 (soAdulto = true): só conta de maior de 18 anos abre o chat de voz', () => {
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
      for (const faixa of faixas) expect(elegibilidadeDaVoz(logado, faixa, true), `${logado ? 'logado' : 'convidado'}|${faixa}`).toBe(esperado[`${logado ? 'logado' : 'convidado'}|${faixa}`]);
  });

  it('só uma combinação libera: nenhuma outra abre a voz', () => {
    const liberadas = [true, false].flatMap((logado) => (['adulto', 'menor', 'sem-idade'] as const).filter((f) => elegibilidadeDaVoz(logado, f, true) === 'liberada'));
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

describe('elegibilidadeDaVoz, fase de testes (P241, o padrão): convidado e conta sem idade falam e ouvem; só o menor fica sem microfone', () => {
  it('a tabela inteira: logado × faixa de idade', () => {
    const esperado: Record<string, ElegibilidadeDaVoz> = {
      'logado|adulto': 'liberada',
      'logado|menor': 'menor',
      'logado|sem-idade': 'liberada',
      'convidado|adulto': 'liberada',
      'convidado|menor': 'liberada',
      'convidado|sem-idade': 'liberada',
    };
    for (const logado of [true, false])
      for (const faixa of ['adulto', 'menor', 'sem-idade'] as const) {
        const chave = `${logado ? 'logado' : 'convidado'}|${faixa}`;
        expect(elegibilidadeDaVoz(logado, faixa), chave).toBe(esperado[chave]);
        expect(elegibilidadeDaVoz(logado, faixa, false), `${chave} (explícito)`).toBe(esperado[chave]);
      }
  });

  it('o padrão é a fase de testes: a ordem do Comandante (21/10) vale sem passar parâmetro', () => {
    expect(elegibilidadeDaVoz(false, 'sem-idade')).toBe('liberada');
    expect(microfoneLiberado('sem-idade')).toBe(true);
    expect(vozDeveLigar(true, true, 'sem-idade')).toBe(true);
  });
});

describe('vozDeveLigar, regra da P211 (soAdulto = true): o jogador quer, o Comandante liberou e a conta é de adulto, as três', () => {
  it('só liga com as três condições', () => {
    for (const quer of [true, false])
      for (const liberada of [true, false])
        for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const)
          expect(vozDeveLigar(quer, liberada, idade, true), `quer=${quer} liberada=${liberada} idade=${idade}`).toBe(quer && liberada && idade === 'adulto');
  });

  it('menor, sem idade e a sessão ainda não restaurada ficam sem voz mesmo com tudo o mais ligado', () => {
    for (const idade of ['menor', 'sem-idade', undefined] as const) expect(vozDeveLigar(true, true, idade, true)).toBe(false);
    expect(vozDeveLigar(true, true, 'adulto', true)).toBe(true);
  });
});

describe('vozDeveLigar, fase de testes (P241): todos entram na voz (o menor só ouve); a conta ainda não restaurada espera', () => {
  it('quer × liberada × idade', () => {
    for (const quer of [true, false])
      for (const liberada of [true, false])
        for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const)
          expect(vozDeveLigar(quer, liberada, idade, false), `quer=${quer} liberada=${liberada} idade=${idade}`).toBe(quer && liberada && idade !== undefined);
  });
});

describe('microfoneLiberado (P230, P241): o chat, o teste e a narração seguem a mesma regra do microfone', () => {
  it('regra da P211: só a conta de adulto abre o microfone; menor, sem idade e a sessão ainda não restaurada ficam sem', () => {
    expect(microfoneLiberado('adulto', true)).toBe(true);
    for (const idade of ['menor', 'sem-idade', undefined] as const) expect(microfoneLiberado(idade, true), String(idade)).toBe(false);
  });

  it('fase de testes: adulto e sem idade (o convidado) abrem o microfone; o MENOR não, e a conta ainda não restaurada também não', () => {
    expect(microfoneLiberado('adulto', false)).toBe(true);
    expect(microfoneLiberado('sem-idade', false)).toBe(true);
    expect(microfoneLiberado('menor', false), 'o menor só ouve').toBe(false);
    expect(microfoneLiberado(undefined, false), 'na dúvida, sem').toBe(false);
  });

  it('na regra da P211 quem fala é quem ouve (uma regra, duas portas); na fase de testes o menor ouve e não fala', () => {
    for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const) expect(microfoneLiberado(idade, true)).toBe(vozDeveLigar(true, true, idade, true));
    expect(vozDeveLigar(true, true, 'menor', false)).toBe(true);
    expect(microfoneLiberado('menor', false)).toBe(false);
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
    // regra da P211: o menor também fica sem voz
    for (const e of eleg)
      for (const voiceOn of [true, false])
        for (const liberada of [true, false]) {
          const esperado = !liberada ? null : e !== 'liberada' ? e : voiceOn ? null : 'desligada';
          expect(motivoSemVoz(e, voiceOn, liberada, true), `${e}|voiceOn=${voiceOn}|liberada=${liberada}`).toBe(esperado);
          // fase de testes: o menor entra na voz (só ouvindo), então o motivo dele é o de quem está liberado
          const emTeste = e === 'menor' ? (!liberada ? null : voiceOn ? null : 'desligada') : esperado;
          expect(motivoSemVoz(e, voiceOn, liberada, false), `${e}|voiceOn=${voiceOn}|liberada=${liberada} (fase de testes)`).toBe(emTeste);
        }
  });

  it('só há aviso quando a voz NÃO liga: a mesma regra do vozDeveLigar, vista do outro lado', () => {
    for (const idade of ['adulto', 'menor', 'sem-idade', undefined] as const)
      for (const voiceOn of [true, false]) {
        for (const soAdulto of [true, false]) {
          const e = idade === undefined ? 'convidado' : elegibilidadeDaVoz(true, idade, soAdulto);
          const liga = vozDeveLigar(voiceOn, true, idade, soAdulto);
          expect(motivoSemVoz(e, voiceOn, true, soAdulto) === null, `idade=${idade} voiceOn=${voiceOn} soAdulto=${soAdulto}`).toBe(liga);
        }
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
