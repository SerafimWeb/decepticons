import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ArenaRoom, type Peer } from './ArenaRoom';
import type { MechBase } from '../client/src/entities/MechBase';
import { BANK_DOOR } from '../shared/bank/codes';
import { Writer } from '../shared/net/codec';
import { PROTOCOL_VERSION } from '../shared/net/constants';
import { encodeJoin, MSG } from '../shared/net/messages';
import { decodeBankReply, encodeBankCode } from '../shared/net/bank';
it('sala local confere a posição do jogador e aplica o código, sem confiar no cliente', async () => {
  const room = await ArenaRoom.create('BANCO'), w = new Writer(); const got: Uint8Array[] = [];
  const peer: Peer = {send:(bytes)=>got.push(bytes.slice()),close:()=>{}};
  try {
    room.receive(peer, encodeBankCode(w,'TURBO')); expect(got).toHaveLength(0);
    room.receive(peer,encodeJoin(w,{protocol:PROTOCOL_VERSION,name:'TESTE',build:'v1.vector09.plasma-0.rockets-0'}));
    const h = (room as unknown as {humans:Map<Peer,{mech:MechBase}>}).humans.get(peer)!;
    const redeem = (code:string) => { room.receive(peer,encodeBankCode(w,code)); return decodeBankReply(got.filter(b=>b[0]===MSG.BANK_REPLY).at(-1)!)!; };
    expect(redeem('TURBO').status).toBe('far'); expect(h.mech.combatBoost.damageMultiplier).toBe(1);
    h.mech.respawn(new THREE.Vector3(BANK_DOOR.x,0,BANK_DOOR.z));
    expect(redeem('TURBO').status).toBe('ok');expect(h.mech.combatBoost.damageMultiplier).toBe(1.25);
    expect(redeem('TURBO').status).toBe('wait'); expect(redeem('134 milhões')).toEqual({status:'ok',code:'134MILHOES'});
    h.mech.modules.torso=0; expect(redeem('OFICINA').status).toBe('dead');
  } finally { room.dispose(); }
});
