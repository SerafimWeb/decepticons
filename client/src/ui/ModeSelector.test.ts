import { describe, expect, it } from 'vitest';
import { gameModeFromSearch } from '../sim/gameMode';
import { ModeSelector, GAME_MODES } from './ModeSelector';
describe('seletor acompanha os modos reais da simulação', () => {
 it('começa na Arena sem parâmetro e oferece também CTF e Domínio',()=>{expect(new ModeSelector('').currentMode).toBe('deathmatch');expect(GAME_MODES.map(m=>m.id)).toEqual(['deathmatch','survival','ctf','dominio']);});
 it('a mesma URL produz o mesmo modo no menu e na simulação',()=>{for(const search of ['?modo=ctf','?modo=dominio','?modo=survival','?modo=sobrevivencia','?modo=inexistente',''])expect(new ModeSelector(search).currentMode).toBe(gameModeFromSearch(search));});
 it('selecionar CTF informa a troca real ao Game',()=>{const selector=new ModeSelector('');let changed='';selector.onModeChange(mode=>changed=mode);selector.setMode('ctf');expect(changed).toBe('ctf');expect(selector.currentMode).toBe('ctf');});
 it('não pede recarregar a partida se o modo já está ativo',()=>{const selector=new ModeSelector('?modo=ctf');let changes=0;selector.onModeChange(()=>changes++);selector.setMode('ctf');expect(changes).toBe(0);});
});

describe('botões do seletor da pausa', () => {
  it('cada modo tem nome curto, único e que cabe lado a lado (três botões em 440 px)', () => {
    const curtos = GAME_MODES.map((m) => m.short);
    expect(new Set(curtos).size).toBe(curtos.length);
    for (const s of curtos) expect(s.length).toBeLessThanOrEqual(14);
  });
  it('a descrição do modo ativo sempre existe (a linha embaixo dos botões nunca fica vazia)', () => {
    for (const m of GAME_MODES) expect(`${m.badge} · ${m.description}`.length).toBeGreaterThan(20);
  });
});
