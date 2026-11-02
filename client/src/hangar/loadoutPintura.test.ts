import { describe, expect, it } from 'vitest';
import { Writer } from '../../../shared/net/codec';
import { decodeJoin, decodeRoster, encodeJoin, encodeRoster } from '../../../shared/net/messages';
import { BUILD_MAX, PROTOCOL_VERSION } from '../../../shared/net/constants';
import { CHASSIS, type ChassisId } from '../entities/chassis';
import { factorySpec, loadoutKey, parseLoadoutKey, validateLoadout } from './loadout';

const CHASSIS_IDS = Object.keys(CHASSIS) as ChassisId[];

describe('a cor do casco na chave da montagem (P305)', () => {
  it('sem cor (ou com a de fábrica) a chave sai igual à de sempre: link, conta e roster não mudam', () => {
    const spec = factorySpec('vector09');
    expect(loadoutKey(spec)).not.toMatch(/\.P\d/);
    expect(loadoutKey({ ...spec, pintura: 0 })).toBe(loadoutKey(spec));
  });

  it('com cor, a chave leva o sufixo .P<n> no fim', () => {
    const spec = factorySpec('vector09');
    expect(loadoutKey({ ...spec, pintura: 3 })).toBe(`${loadoutKey(spec)}.P3`);
  });

  it('ida e volta: o texto lê de volta o mesmo chassi e a mesma cor', () => {
    const spec = { ...factorySpec('marauder'), pintura: 6 };
    const lido = parseLoadoutKey(loadoutKey(spec));
    expect(lido).not.toBeNull();
    expect(lido!.chassis).toBe('marauder');
    expect(lido!.pintura).toBe(6);
    expect(loadoutKey(lido!)).toBe(loadoutKey(spec));
  });

  it('ida e volta com o modo de botões (chave v4) e o layout: a cor não atrapalha as outras partes', () => {
    const spec = { ...factorySpec('colossusv4'), v: 4 as const, botoes: { rightHand: 2 as const }, pintura: 4 };
    const lido = parseLoadoutKey(loadoutKey(spec));
    expect(lido).not.toBeNull();
    expect(lido!.pintura).toBe(4);
    expect(lido!.botoes).toEqual({ rightHand: 2 });
  });

  it('recusa a cor de fábrica escrita no texto (.P0 não existe: uma montagem, uma chave)', () => {
    expect(parseLoadoutKey(`${loadoutKey(factorySpec('vector09'))}.P0`)).toBeNull();
  });

  it('recusa cor que não existe no catálogo e texto malformado', () => {
    const base = loadoutKey(factorySpec('vector09'));
    expect(parseLoadoutKey(`${base}.P99`)).toBeNull();
    expect(parseLoadoutKey(`${base}.P7`)).toBeNull();
    expect(parseLoadoutKey(`${base}.P`)).toBeNull();
    expect(parseLoadoutKey(`${base}.P03`)).toBeNull();
  });

  it('validar a montagem recusa cor fora do catálogo (o mesmo critério no Hangar e no servidor)', () => {
    const r = validateLoadout({ ...factorySpec('vector09'), pintura: 9 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('formato');
    expect(validateLoadout({ ...factorySpec('vector09'), pintura: 2 }).ok).toBe(true);
  });

  it('a montagem com dois ou mais botões escolhidos lê de volta igual (o grupo B tem vários pares; antes só o primeiro era lido)', () => {
    // O Colossus de fábrica tem arma na mão direita e nas costas (a mão esquerda está vazia: botão nela não vale).
    const spec = { ...factorySpec('colossus01'), v: 4 as const, botoes: { rightHand: 1 as const, back: 2 as const } };
    const chave = loadoutKey(spec);
    const lido = parseLoadoutKey(chave);
    expect(lido, chave).not.toBeNull();
    expect(lido!.botoes).toEqual({ rightHand: 1, back: 2 });
  });

  it('o pior caso medido (Colossus-01: cinco botões no 2, visão, railgun e a cor) é válido, cabe no teto e chega inteiro no JOIN e no roster', () => {
    // Medido com o maior nome de arma em cada encaixe (97 caracteres). Antes do P305 o teto era 80 e o texto era cortado em silêncio.
    const piorCaso = 'v4.colossus01.railgun-2.railgun-2.-.visao.autocannon-2.autocannon-0.blaster-2.Brh2lh2rs2ls2bk2.P6';
    const spec = parseLoadoutKey(piorCaso);
    expect(spec, 'a montagem é válida').not.toBeNull();
    expect(loadoutKey(spec!)).toBe(piorCaso);
    expect(piorCaso.length).toBeLessThanOrEqual(BUILD_MAX);
    const join = decodeJoin(encodeJoin(new Writer(512), { protocol: PROTOCOL_VERSION, name: 'ANA', build: piorCaso }));
    expect(join?.build).toBe(piorCaso);
    const roster = decodeRoster(encodeRoster(new Writer(512), [{ id: 1, kind: 'human', name: 'ANA', build: piorCaso }]));
    expect(roster?.[0]?.build).toBe(piorCaso);
  });

  it('a montagem de fábrica de cada chassi, com a cor mais alta e os botões, cabe no tamanho do JOIN (BUILD_MAX)', () => {
    for (const id of CHASSIS_IDS) {
      const spec = { ...factorySpec(id), pintura: 6 };
      expect(loadoutKey(spec).length, id).toBeLessThanOrEqual(BUILD_MAX);
    }
  });
});
