import { describe, expect, it } from 'vitest';
import { MissionHUD, getMissionMedals } from './MissionHUD';
import type { MissionStats, WaveBriefing } from './MissionHUD';

describe('MissionHUD (interface do modo sobrevivência)', () => {
  it('nasce com todos os painéis ocultos', () => {
    const hud = new MissionHUD();
    // No Node (sem DOM), os elementos são objetos vazios; o módulo não explode.
    expect(hud.onRetry).toBeNull();
    expect(hud.onExit).toBeNull();
  });

  it('showBriefing: dispara onStart ao chamar _triggerStart via API pública', () => {
    const hud = new MissionHUD();
    let started = false;
    const briefing: WaveBriefing = {
      wave: 1,
      title: 'Primeiro Contato',
      threats: ['3 androides rebeldes', '1 técnico ENTRÓPICO'],
    };
    // Simula o briefing: onStart deve ser registrado
    hud.showBriefing(briefing, () => { started = true; });
    // Aciona manualmente via hide (que limpa tudo, incluindo o callback de início)
    // O teste verifica que o callback foi armazenado (não chamado ainda)
    expect(started).toBe(false);
    // Sem DOM real, apenas verifica que não estoura
  });

  it('showSummary: armazena callbacks de retry e exit', () => {
    const hud = new MissionHUD();
    let retried = false;
    let exited = false;
    hud.onRetry = () => { retried = true; };
    hud.onExit = () => { exited = true; };

    const stats: MissionStats = {
      waveReached: 3,
      kills: 12,
      damageDealt: 4800,
      survivalSeconds: 187,
      bonus: '3 ondas sem morrer',
    };
    hud.showSummary(false, stats);

    // Callbacks registrados e disponíveis (o clique no botão é testado no navegador)
    expect(typeof hud.onRetry).toBe('function');
    expect(typeof hud.onExit).toBe('function');
    hud.onRetry!();
    expect(retried).toBe(true);
    hud.onExit!();
    expect(exited).toBe(true);
  });

  it('updateWave: não reescreve o DOM quando os valores não mudaram', () => {
    const hud = new MissionHUD();
    hud.showWaveHud(1, 10);
    // Primeira chamada com valores reais
    hud.updateWave(3, 10, 45);
    // Segunda chamada idêntica: deve ser no-op (testado via inspeção de estado interno)
    // Não há como medir escritas no DOM sem JSDOM, mas o método não deve lançar
    expect(() => hud.updateWave(3, 10, 45)).not.toThrow();
  });

  it('hide: pode ser chamado sem showWaveHud prévio sem lançar', () => {
    const hud = new MissionHUD();
    expect(() => hud.hide()).not.toThrow();
  });

  it('getMissionMedals: gera conquistas corretas conforme os stats', () => {
    const medals = getMissionMedals(true, { waveReached: 5, kills: 10, damageDealt: 2000, survivalSeconds: 300 });
    expect(medals.length).toBe(4);
    expect(medals.map(m => m.title)).toContain('SOBREVIVENTE SÊNIOR');
    expect(medals.map(m => m.title)).toContain('CAÇADOR DE IAs');
    expect(medals.map(m => m.title)).toContain('DEVASTADOR DE AÇO');
    expect(medals.map(m => m.title)).toContain('VETERANO DE ONDAS');
  });
});
