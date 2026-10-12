import * as THREE from 'three';
import { expect, it } from 'vitest';
import { startServer } from '../../../server/Server';
import { BANK_DOOR, type BankReply } from '../../../shared/bank/codes';
import type { MechBase } from '../entities/MechBase';
import { NetClient } from './NetClient';
it('cliente recebe somente o resultado validado na sala local pelo WebSocket binário', async () => {
  const server = await startServer({port:0,host:'127.0.0.1',dbContas:':memory:'});
  let welcome!: () => void, answer!: (reply:BankReply) => void;
  const joined = new Promise<void>(resolve=>{welcome=resolve;});
  const client = new NetClient('ws://127.0.0.1:'+server.port+'/?sala=BANCO',{welcome:()=>welcome(),bank:reply=>answer(reply)});
  const redeem = (code:string) => new Promise<BankReply>(resolve=>{answer=resolve;expect(client.redeemBank(code)).toBe(true);});
  try {
    client.join('BANCO','v1.vector09.plasma-0.rockets-0'); await joined;
    expect((await redeem('TURBO')).status).toBe('far');
    const room = server.rooms.get('BANCO')!;
    const humans=(room as unknown as {humans:Map<unknown,{mech:MechBase}>}).humans;
    const mech=humans.values().next().value!.mech; mech.respawn(new THREE.Vector3(BANK_DOOR.x,0,BANK_DOOR.z));
    expect(await redeem('TURBO')).toEqual({status:'ok',code:'TURBO'});expect(mech.combatBoost.damageMultiplier).toBe(1.25);
    expect(await redeem('134 milhões')).toEqual({status:'ok',code:'134MILHOES'});
  } finally { client.close(); await server.close(); }
});
