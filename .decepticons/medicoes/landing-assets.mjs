/** Fotografias promocionais dos rigs reais, fora do runtime do jogo. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const tmp = resolve('.tmp/landing-capture');
const out = resolve('client/public/press');
mkdirSync(tmp, { recursive: true }); mkdirSync(out, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
const html = `<!doctype html><html><head><style>body{margin:0}canvas{display:block}</style></head><body><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHASSIS } from '/src/entities/chassis.ts';
import { Vector09 } from '/src/entities/Vector09.ts';
import { ImportedMech } from '/src/entities/ImportedMech.ts';
import { COLOSSUS_01_BLUEPRINT } from '/src/entities/mechBlueprint.ts';
import { IMPORTED_CHASSIS, whenMechAssetReady, tryInstantiateMechRig } from '/src/entities/importedMechAssets.ts';
const q = new URLSearchParams(location.search), id = q.get('id') || 'marauder';
const hero = q.has('hero'), w = hero ? 1920 : 720, h = hero ? 1080 : 780;
const config = IMPORTED_CHASSIS[id];
if(config) await whenMechAssetReady(config.url, CHASSIS[id].height, config);
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(w,h);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x080c11);scene.fog=new THREE.Fog(0x080c11,hero||id==='colossusv4'?65:25,180);
scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.38;
const model=config?new ImportedMech(CHASSIS[id],tryInstantiateMechRig(config.url,CHASSIS[id].height),CHASSIS[id].loadout):new Vector09({stats:CHASSIS[id],loadout:CHASSIS[id].loadout,blueprint:id==='colossus01'?COLOSSUS_01_BLUEPRINT:undefined});
model.render(0,1);model.root.rotation.y=id==='colossusv4'?.28:Math.PI-.28;scene.add(model.root);model.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
const fill=new THREE.DirectionalLight(0xffd49b,2);fill.position.set(-6,12,8);fill.castShadow=true;fill.shadow.mapSize.set(2048,2048);Object.assign(fill.shadow.camera,{left:-18,right:18,top:22,bottom:-10,far:70});fill.shadow.bias=-.001;scene.add(fill);
const rim=new THREE.DirectionalLight(0x59baff,2.4);rim.position.set(8,10,-10);scene.add(rim,new THREE.HemisphereLight(0x82a0be,0x302419,.6));
const steel=new THREE.MeshStandardMaterial({color:0x17232d,roughness:.65,metalness:.6});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),steel);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
for(let i=-4;i<=5;i++){const pillar=new THREE.Mesh(new THREE.BoxGeometry(.7,24,.9),steel);pillar.position.set(i*7,12,-10);pillar.castShadow=true;scene.add(pillar);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.08,12,.1),new THREE.MeshBasicMaterial({color:i%2?0xffac32:0x64b5d6}));lamp.position.set(i*7+.42,8,-9.5);scene.add(lamp);const panel=new THREE.Mesh(new THREE.BoxGeometry(6,18,.25),steel);panel.position.set(i*7+3.5,9,-12);scene.add(panel);}
const grid=new THREE.GridHelper(160,32,0x95732e,0x263843);grid.position.y=.012;scene.add(grid);
const camera=new THREE.PerspectiveCamera(35,w/h,.1,200);
if(hero){
 model.root.position.set(3,0,-1);
 const vector=new Vector09();vector.render(0,1);vector.root.position.set(-4,0,8);vector.root.rotation.y=Math.PI+.28;scene.add(vector.root);vector.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 camera.position.set(12,10,54);camera.lookAt(-12,9,0);camera.fov=38;
}else{const size=CHASSIS[id].height;camera.position.set(1.6,size*.52,size*(id==='colossusv4'?2.5:2.1));camera.lookAt(0,size*.48,0);}
camera.updateProjectionMatrix();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);window.captureReady=true;
</script></body></html>`;
const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 4218, strictPort: true, open: false }, plugins: [{name:'press-capture',configureServer(s){s.middlewares.use('/__press',async(req,res,next)=>{try{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__press'+(req.url||''),html));}catch(e){next(e);}});}}] });
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const id of ['hero','vector09','marauder','colossusv4']){
  if(process.argv.length>2 && !process.argv.slice(2).includes(id)) continue;
  await page.setViewportSize(id==='hero'?{width:1920,height:1080}:{width:720,height:780});
  await page.goto('http://127.0.0.1:4218/__press?id='+(id==='hero'?'colossusv4&hero':id));
  await page.waitForFunction(()=>window.captureReady,{},{timeout:90000});
  await page.screenshot({path:resolve(out,id+'.jpg'),type:'jpeg',quality:90});console.log('fotografia',id);
 }
 if(errors.length) throw Error(errors.join('\n'));
 writeFileSync(resolve(tmp,'resultado.json'),JSON.stringify({models:['Vector09','Marauder','ColossusV4'],errors},null,2));
}finally{await browser?.close();await server.close();}
