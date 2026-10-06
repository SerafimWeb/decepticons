import { describe, expect, it } from 'vitest';
import { gameModeFromSearch } from '../sim/gameMode';
import { ModeSelector, GAME_MODES } from './ModeSelector';
describe('seletor acompanha os modos reais da simulação', () => {
 it('começa na Arena sem parâmetro e oferece também CTF',()=>{expect(new ModeSelector('').currentMode).toBe('deathmatch');expect(GAME_MODES.map(m=>m.id)).toEqual(['deathmatch','survival','ctf']);});
 it('a mesma URL produz o mesmo modo no menu e na simulação',()=>{for(const search of ['?modo=ctf','?modo=survival','?modo=sobrevivencia','?modo=inexistente',''])expect(new ModeSelector(search).currentMode).toBe(gameModeFromSearch(search));});
 it('selecionar CTF informa a troca real ao Game',()=>{const selector=new ModeSelector('');let changed='';selector.onModeChange(mode=>changed=mode);selector.setMode('ctf');expect(changed).toBe('ctf');expect(selector.currentMode).toBe('ctf');});
 it('não pede recarregar a partida se o modo já está ativo',()=>{const selector=new ModeSelector('?modo=ctf');let changes=0;selector.onModeChange(()=>changes++);selector.setMode('ctf');expect(changes).toBe(0);});
});
