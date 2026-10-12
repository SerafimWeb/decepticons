import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SETTINGS_TABS, isSettingsTab } from './settingsTabs';

/** O contrato entre o HTML e o módulo das abas: seção sem aba válida some do modal para sempre (fica escondida). */
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const modal = html.slice(html.indexOf('id="settings-modal"'), html.indexOf('id="online-lobby"'));

describe('abas das Configurações', () => {
  it('toda seção do modal declara uma aba que existe', () => {
    const secoes = [...modal.matchAll(/<div class="settings-section[^"]*"([^>]*)>/g)];
    expect(secoes.length).toBeGreaterThanOrEqual(9);
    for (const [, atributos] of secoes) {
      const aba = /data-tab="([^"]+)"/.exec(atributos)?.[1];
      expect(isSettingsTab(aba), `seção sem aba válida: ${atributos}`).toBe(true);
    }
  });

  it('cada aba tem um botão e pelo menos uma seção', () => {
    for (const aba of SETTINGS_TABS) {
      expect(modal.includes(`class="settings-tab`) && new RegExp(`<button[^>]*data-tab="${aba}"`).test(modal), `sem botão da aba ${aba}`).toBe(true);
      expect(new RegExp(`<div class="settings-section[^"]*" data-tab="${aba}"`).test(modal), `aba ${aba} sem seção`).toBe(true);
    }
  });

  it('todo botão de aba aponta para uma aba que existe', () => {
    const botoes = [...modal.matchAll(/<button[^>]*class="settings-tab[^"]*"[^>]*data-tab="([^"]+)"/g)].map((m) => m[1]);
    expect(botoes).toEqual([...SETTINGS_TABS]);
  });

  it('o painel de desempenho (de desenvolvedor) mora em Avançado, não em Gráficos', () => {
    const avancado = modal.slice(modal.indexOf('data-tab="avancado"'));
    expect(avancado.includes('id="setting-showperf"')).toBe(true);
    const graficos = modal.slice(modal.indexOf('<h3>GRÁFICOS</h3>'), modal.indexOf('<h3>JOGABILIDADE</h3>') > 0 ? modal.indexOf('<h3>JOGABILIDADE</h3>') : undefined);
    expect(graficos.includes('setting-showperf')).toBe(false);
  });
});
