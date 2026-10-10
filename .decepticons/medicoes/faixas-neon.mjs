import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';

const dir=resolve('.tmp/faixas-neon');mkdirSync(dir,{recursive:true});
process.env.TEMP=process.env.TMP=process.env.TMPDIR=dir;
await build({logLevel:'error',build:{outDir:dir+'/build'},plugins:[{
  name:'bands-measure',enforce:'pre',transform(code,id){
    if(id.endsWith('/src/main.ts')) return code.replace('game.start();','window.__game=game; game.start();');
    if(id.endsWith('/core/Game.ts')) return code.replace("import * as THREE from 'three';","import * as THREE from 'three'; window.__three=THREE;");
  }
}]});
const server=await preview({logLevel:'error',build:{outDir:dir+'/build'},preview:{host:'127.0.0.1',port:0,open:false}});
let browser;
try {
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
  // Screenshot de um canvas também inclui DOM sobreposto; escondê-lo evita medir animações da UI.
  await page.addStyleTag({content:'* { visibility: hidden !important; } canvas { visibility: visible !important; }'});
  const boot=await page.evaluate(()=>{
    const g=window.__game,T=window.__three;
    g.renderer.setAnimationLoop(null);g.settings.update({quality:'media',volume:0});
    const bands=[];g.scene.traverse(o=>{if(o.name==='building-neon-bands')bands.push(o);});
    if(bands.length!==3)throw new Error('Esperava três grupos de faixas');
    const old=[];const m=new T.Matrix4();
    for(const b of bands)for(let i=0;i<b.count;i++){
      b.getMatrixAt(i,m);const mesh=new T.Mesh(b.geometry,b.material);
      // As dimensões dos prédios são inteiras + 0,12; reconstruir o scale original em double,
      // em vez de reutilizar a matriz Float32 da versão instanciada como baseline.
      mesh.scale.set(Math.round(m.elements[0]*100)/100,0.18,Math.round(m.elements[10]*100)/100);
      mesh.position.y=m.elements[13];mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.visible=false;b.parent.add(mesh);old.push(mesh);
    }
    window.__bands=bands;window.__old=old;
    const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',instances:bands.map(x=>x.count),bufferBytes:bands.reduce((n,x)=>n+x.instanceMatrix.array.byteLength,0)};
  });
  const results=[];
  for(const [label,position,target] of [
    ['terceira',[0,7,37],[0,5,-30]],
    ['primeira',[0,5,25],[0,5,-30]],
    ['tatica',[0,65,65],[0,0,-15]],
    ['lateral',[70,20,-20],[0,15,-35]],
    ['perto-banco',[-28,28,-20],[-28,28,-35]],
    ['translucido',[0,65,65],[0,0,-15]],
  ]){
    await page.evaluate(({label,position,target})=>{const g=window.__game;g.camera.position.set(...position);g.camera.lookAt(...target);g.camera.updateMatrixWorld();for(const o of g.match.arena.occluders){o.material.opacity=label==='translucido'?0.18:1;o.material.depthWrite=label!=='translucido';}},{label,position,target});
    const captures={};const stats={};
    for(const variant of ['before','after']){
      stats[variant]=await page.evaluate(variant=>{
        const g=window.__game;for(const o of window.__bands)o.visible=variant==='after';for(const o of window.__old)o.visible=variant==='before';
        for(let i=0;i<3;i++)g.composer.render(0);
        g.renderer.info.reset();g.composer.render(0);g.renderer.getContext().finish();
        return {calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
      },variant);
      const png=await page.locator('canvas').first().screenshot();captures[variant]=png.toString('base64');
      writeFileSync(dir+'/'+label+'-'+variant+'.png',png);
    }
    const difference=await page.evaluate(async captures=>{
      const load=async s=>{const img=new Image();img.src='data:image/png;base64,'+s;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
      const a=await load(captures.before),b=await load(captures.after);let max=0,total=0,pixels=0;
      for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<3;j++){const d=Math.abs(a[i+j]-b[i+j]);max=Math.max(max,d);total+=d;changed ||= d>0;}if(changed)pixels++;}
      return {maxChannelDelta:max,meanChannelDelta:total/(a.length/4*3),changedPixels:pixels,totalPixels:a.length/4};
    },captures);
    results.push({label,position,target,stats,difference});console.log(JSON.stringify(results.at(-1)));
  }
  const report={base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),boot,viewport:[1280,720],method:'mesmo build/página/câmera; troca runtime InstancedMesh por Mesh com matrizes equivalentes; renderer sem animation loop; composer HDR/MSAA4+bloom; gl.finish só na bancada; comparação do canvas sem HUD; não mede FPS',results,errors};
  writeFileSync(dir+'/results.json',JSON.stringify(report,null,2));
  if(errors.length)throw new Error(errors.join('\n'));
  // Instancing muda a ordem de multiplicação das matrizes na GPU: bordas MSAA podem variar.
  // Guardar também o máximo (não esconder outliers); revisar imagens, além do limite de área/erro médio.
  if(results.some(x=>x.difference.changedPixels/x.difference.totalPixels>0.001 || x.difference.meanChannelDelta>0.01))throw new Error('Diferença de imagem exige revisão');
} finally {await browser?.close();await new Promise(r=>server.httpServer.close(r));}
