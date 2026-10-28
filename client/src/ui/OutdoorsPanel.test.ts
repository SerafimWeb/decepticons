import { describe, expect, it } from 'vitest';
import { ANUNCIOS_QUE_ALTERNAM, normalizarParametros } from '../../../shared/outdoors';
import { alternarAnuncio } from './OutdoorsPanel';

describe('o painel dos outdoors: ligar e desligar anúncios da troca (P267)', () => {
  it('desliga um anúncio que está ligado e liga um que está desligado, sem mexer nos outros', () => {
    expect(alternarAnuncio([], 'odp-ping')).toEqual(['odp-ping']);
    expect(alternarAnuncio(['odp-ping'], 'swb')).toEqual(['odp-ping', 'swb']);
    expect(alternarAnuncio(['odp-ping', 'swb'], 'odp-ping')).toEqual(['swb']);
    expect(alternarAnuncio(['swb'], 'swb')).toEqual([]);
  });

  it('nunca deixa a troca vazia: desligar o ÚLTIMO anúncio ligado não faz nada (o servidor também recusaria)', () => {
    let desligados: readonly string[] = [];
    for (const id of ANUNCIOS_QUE_ALTERNAM) desligados = alternarAnuncio(desligados, id);
    expect(desligados).toHaveLength(ANUNCIOS_QUE_ALTERNAM.length - 1);
    const sobrou = ANUNCIOS_QUE_ALTERNAM.find((id) => !desligados.includes(id))!;
    expect(sobrou).toBeDefined();
    expect(alternarAnuncio(desligados, sobrou), 'tentar desligar o que sobrou').toEqual(desligados);
    // O que o painel monta é sempre aceito pelo servidor.
    expect(normalizarParametros({ quantidade: 10, periodo: 12, desligados })).not.toBeNull();
  });

  it('quem desliga vários e religa um deles volta a ter troca', () => {
    let desligados: readonly string[] = [];
    for (const id of ANUNCIOS_QUE_ALTERNAM) desligados = alternarAnuncio(desligados, id);
    const religado = alternarAnuncio(desligados, desligados[0]!);
    expect(religado).toHaveLength(desligados.length - 1);
  });
});
