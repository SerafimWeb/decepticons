import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Todos os arquivos de código do cliente (sem os testes: um teste que cita o modelo não o carrega). */
function codigoDoCliente(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) codigoDoCliente(p, saida);
    else if (/\.(ts|html|css)$/.test(nome) && !/\.test\./.test(nome)) saida.push(readFileSync(p, 'utf8'));
  }
  return saida;
}

/** O que está em `public/models` e **de propósito** ninguém carrega, com o motivo (quem religar tira da lista no mesmo PR). */
const NAO_CARREGADOS: Readonly<Record<string, string>> = {
  'quadra-v2.glb': 'desligado desde o gemini/rig-fix: o Quadra-V2 usa o corpo do Vector-09; religar é barato (MECHS_IMPORTADOS.md, § Quadra-V2)',
};

/**
 * P318 (higiene): em 06/11 dois modelos (`lancer-l1.glb`, `lr-7l-bastion.glb`: 8,2 MB) iam para o ar a cada publicação sem ninguém carregar (o Lancer usa `TZLA1.glb` e o Bastion,
 * `LR7L.glb`). Um `.glb` novo em `public/models` precisa de um carregador, ou de uma entrada explícita e justificada em `NAO_CARREGADOS`.
 */
describe('os modelos 3D públicos: nada vai para o ar sem ser carregado', () => {
  const codigo = codigoDoCliente(resolve('client/src')).join('\n');
  const modelos = readdirSync(resolve('client/public/models')).filter((n) => n.endsWith('.glb')).sort();

  it('há modelos e o código do cliente foi lido (a trava só vale com os dois)', () => {
    expect(modelos.length).toBeGreaterThanOrEqual(5);
    expect(codigo.length).toBeGreaterThan(500_000);
  });

  it('todo .glb de public/models é citado pelo código do cliente, ou está em NAO_CARREGADOS com o motivo', () => {
    for (const nome of modelos) {
      if (nome in NAO_CARREGADOS) continue;
      expect(codigo, `${nome}: ninguém o carrega (apague o arquivo ou ligue-o)`).toContain(nome);
    }
  });

  it('a lista de exceções só cita arquivos que existem e traz um motivo de verdade (arquivo apagado sai da lista)', () => {
    for (const [nome, motivo] of Object.entries(NAO_CARREGADOS)) {
      expect(modelos, `${nome} está na lista de exceções mas não existe mais`).toContain(nome);
      expect(motivo.length, nome).toBeGreaterThan(30);
    }
  });
});
