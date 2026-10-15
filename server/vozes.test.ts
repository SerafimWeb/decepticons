import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogo from '../client/src/audio/falas.json';
import { linhasDeVozes, montarManifesto, planejar, resumoDoPlano, sintetizar } from '../scripts/vozesLib.mjs';

const FALAS = catalogo.falas;
const CONFIG = { vozes: { br: { voz: '' }, en: { voz: 'VOZ_EN' }, ru: { voz: 'VOZ_RU' }, cn: { voz: '  ' } } };

describe('gerador de vozes (P146): o plano', () => {
  it('gera uma fala por sotaque que tem voz, e pula os sem voz (branco conta como sem voz)', () => {
    const plano = planejar({ falas: FALAS, config: CONFIG, existentes: new Set() });
    expect(plano.fazer.length).toBe(FALAS.length * 2); // só en e ru têm voz
    expect(new Set(plano.fazer.map((f) => f.sotaque))).toEqual(new Set(['en', 'ru']));
    expect(plano.fazer.every((f) => f.voz === (f.sotaque === 'en' ? 'VOZ_EN' : 'VOZ_RU'))).toBe(true);
    expect(plano.pulados.filter((p) => p.motivo === 'sem voz configurada').map((p) => p.sotaque)).toContain('br');
    expect(plano.pulados.filter((p) => p.motivo === 'sem voz configurada').map((p) => p.sotaque)).toContain('cn');
  });

  it('o que já existe não se gera de novo (o crédito gasta uma vez só por frase), a menos que refaça', () => {
    const existentes = new Set(['en/combate', 'ru/combate']);
    const sem = planejar({ falas: FALAS, config: CONFIG, existentes });
    expect(sem.fazer.some((f) => f.chave === 'combate')).toBe(false);
    expect(sem.pulados.filter((p) => p.motivo === 'já existe')).toHaveLength(2);
    const com = planejar({ falas: FALAS, config: CONFIG, existentes, refazer: true });
    expect(com.fazer.filter((f) => f.chave === 'combate')).toHaveLength(2);
  });

  it('--so e --sotaque limitam, e a conta de caracteres é a do texto de cada sotaque', () => {
    const plano = planejar({ falas: FALAS, config: CONFIG, existentes: new Set(), sotaques: ['en'], so: ['combate', 'voce_morreu'] });
    expect(plano.fazer.map((f) => f.chave)).toEqual(['combate', 'voce_morreu']);
    expect(plano.caracteres).toBe('Fight!'.length + 'You die.'.length);
    expect(plano.fazer[0]).toMatchObject({ sotaque: 'en', estilo: 'grito', texto: 'Fight!' });
  });

  it('o resumo diz quantas falas, quantos caracteres e quem está sem voz', () => {
    const t = resumoDoPlano(planejar({ falas: FALAS, config: CONFIG, existentes: new Set(['en/combate']) }));
    expect(t).toContain('caractere(s) a pagar');
    expect(t).toContain('Sem voz configurada (pulados): br, cn');
    expect(t).toContain('Já existem (pulados, sem custo): 1');
  });
});

describe('gerador de vozes: o manifesto', () => {
  it('lista, na ordem do catálogo, só o que tem arquivo; arquivo fora do catálogo é ignorado', () => {
    const m = montarManifesto({ en: ['voce_morreu', 'combate', 'lixo'], ru: [] }, FALAS, 'n');
    expect(m).toMatchObject({ _nota: 'n', br: [], en: ['combate', 'voce_morreu'], ru: [], cn: [] });
  });
});

describe('gerador de vozes: a chamada ao ElevenLabs', () => {
  const base = { chaveApi: 'CHAVE-SECRETA-123', voz: 'abc 123', texto: 'Fight!', estilo: 'grito', modelo: 'eleven_multilingual_v2', saida: 'mp3_44100_128', estilos: catalogo.estilos };

  it('manda texto, modelo e ajustes do estilo para a voz certa, com a chave só no cabeçalho', async () => {
    let visto: { url: string; init: { method: string; headers: Record<string, string>; body: string } } | null = null;
    const bytes = await sintetizar({
      ...base,
      fetchFn: async (url, init) => {
        visto = { url, init };
        return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      },
    });
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(visto!.url).toBe('https://api.elevenlabs.io/v1/text-to-speech/abc%20123?output_format=mp3_44100_128');
    expect(visto!.init.method).toBe('POST');
    expect(visto!.init.headers['xi-api-key']).toBe('CHAVE-SECRETA-123');
    expect(visto!.url).not.toContain('CHAVE-SECRETA');
    expect(visto!.init.body).not.toContain('CHAVE-SECRETA');
    expect(JSON.parse(visto!.init.body)).toEqual({ text: 'Fight!', model_id: 'eleven_multilingual_v2', voice_settings: catalogo.estilos.grito });
  });

  it('erro da API vira mensagem útil e nunca vaza a chave', async () => {
    const falha = (status: number, corpo: string) =>
      sintetizar({ ...base, fetchFn: async () => ({ ok: false, status, text: async () => corpo, arrayBuffer: async () => new ArrayBuffer(0) }) });
    await expect(falha(401, '{"detail":"invalid"}')).rejects.toThrow(/401.*ELEVENLABS_API_KEY/);
    await expect(falha(429, 'too many')).rejects.toThrow(/429.*o que já saiu fica/);
    await expect(falha(422, 'texto ruim')).rejects.toThrow(/422.*texto ruim/);
    for (const s of [401, 429, 422]) {
      await falha(s, 'x').catch((e: Error) => expect(e.message).not.toContain('CHAVE-SECRETA'));
    }
  });

  it('a lista de vozes da conta mostra id, nome, sotaque e gênero', () => {
    const l = linhasDeVozes({ voices: [{ voice_id: 'V1', name: 'Boris', category: 'premade', labels: { accent: 'russian', gender: 'male' } }, { voice_id: 'V2', name: 'Sem rótulo' }] });
    expect(l[0]).toContain('V1');
    expect(l[0]).toContain('Boris');
    expect(l[0]).toContain('russian');
    expect(l[1]).toContain('-');
    expect(linhasDeVozes(null)).toEqual([]);
  });
});

describe('comando npm run vozes (de ponta a ponta, sem rede e sem gastar nada)', () => {
  const rodar = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [resolve('scripts/vozes.mjs'), ...args], {
      encoding: 'utf8',
      env: { ...process.env, ELEVENLABS_API_KEY: '', ...env },
    });

  it('--custo funciona sem chave e não escreve nada', () => {
    const r = rodar(['--custo']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('caractere(s) a pagar');
  });

  it('--gerar sem --sim mostra o plano e diz que nada foi gasto (mesmo com chave)', () => {
    const r = rodar(['--gerar', '--sotaque', 'en'], { ELEVENLABS_API_KEY: 'x' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Nada foi gasto');
  });

  it('--listar e --gerar --sim sem a chave recusam e explicam como definir, sem imprimir chave nenhuma', () => {
    const lista = rodar(['--listar']);
    expect(lista.status).toBe(1);
    expect(lista.stderr).toContain('ELEVENLABS_API_KEY');
    const gera = rodar(['--gerar', '--sim', '--sotaque', 'en']);
    expect(gera.status).toBe(1);
    expect(gera.stderr).toContain('ELEVENLABS_API_KEY');
  });

  it('--gerar passa de 3000 caracteres? recusa antes de gastar', () => {
    const r = rodar(['--gerar', '--sim', '--sotaque', 'en', '--max-caracteres', '5'], { ELEVENLABS_API_KEY: 'x' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('passam do teto');
  });
});
