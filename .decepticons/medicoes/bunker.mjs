import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, preview } from 'vite';
const dir = resolve('.tmp/bunker'); mkdirSync(dir, {recursive:true});
process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
const { chromium } = await import('playwright-core');
await build({logLevel:'error',build:{outDir:dir+'/build'},plugins:[{name:'bunker-probe',enforce:'pre',transform(code,id){
  if(id.endsWith('/src/main.ts'))return 'import * as T from "three"; window.__THREE=T;\n'+code.replace('game.start();','window.__game=game; game.start();');
}}]});
const server = await preview({logLevel:'error',build:{outDir:dir+'/build'},preview:{host:'127.0.0.1',port:0,open:false}});
let browser;
try {
  browser = await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]+'?mapa=bunker');
  await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
  const cases=[];
  for(const [name,pos,look] of [
    ['bunker-poco-codex',[0,61,76],[0,8,0]],
    ['bunker-atrio-codex',[0,8,48],[0,18,-34]],
    ['bunker-tunel-secreto-codex',[56,32,-40],[64,32,-62]],
    ['bunker-atirador-codex',[57,45,57],[0,42,0]],
  ]){
    const result=await page.evaluate(({pos,look})=>{
      const g=window.__game,T=window.__THREE;g.renderer.setAnimationLoop(null);
      g.camera.position.set(...pos);g.camera.lookAt(...look);g.mech.root.visible=false;
      document.getElementById('overlay').style.display='none';
      g.renderer.info.reset();g.composer.render(0);
      const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
    },{pos,look});
    await page.screenshot({path:'.decepticons/arte/'+name+'.png'});cases.push({name,...result});
    cases.at(-1).gpuMs = await page.evaluate(async () => {
      const g=window.__game,gl=g.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if(!ext)return null;
      for(let i=0;i<30;i++)g.composer.render(0);
      const samples=[];
      for(let i=0;i<12;i++){
        const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);g.composer.render(0);gl.endQuery(ext.TIME_ELAPSED_EXT);
        let ready=false;for(let n=0;n<500;n++){
          await new Promise(resolve=>setTimeout(resolve,10));
          if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){ready=true;break;}
        }
        const invalid=gl.getParameter(ext.GPU_DISJOINT_EXT)||gl.isContextLost();
        if(!ready||invalid){gl.deleteQuery(q);throw new Error('Timer GPU inválido');}
        samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
      }
      samples.sort((a,b)=>a-b);return {samples:12,p50:samples[5],p95:samples[11]};
    });
  }
  writeFileSync('.decepticons/medicoes/bunker-2026-10-10.json',JSON.stringify({cases,errors,scope:'vistas controladas do mapa real; não certifica FPS, elevadores operacionais ou IA vertical'},null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify({cases,errors}));
} finally {await browser?.close();await server.close();}
