import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,byteRange} from '../server.mjs';
import {readFile,mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
test('hosting launch through a symlink listens on the supplied PORT',async()=>{
  const reserved=createApp();await new Promise(r=>reserved.listen(0,'127.0.0.1',r));const port=reserved.address().port;await new Promise(r=>reserved.close(r));
  const dir=await mkdtemp(path.join(tmpdir(),'optics-launch-'));let child;
  try{
    const link=path.join(dir,'boot.mjs');await symlink(new URL('../server.mjs',import.meta.url),link);
    child=spawn(process.execPath,[link],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
    let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});let reached=false;
    for(let i=0;i<60;i++){
      try{const response=await fetch('http://127.0.0.1:'+port+'/version.json');if(response.ok){reached=true;break;}}catch(_){}
      if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,20));
    }
    assert.equal(reached,true,errors);assert.match(errors,new RegExp('listening on '+port));
  }finally{if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});
test('video range boundaries',()=>{
  assert.deepEqual(byteRange('bytes=0-9',100),{start:0,end:9});
  assert.deepEqual(byteRange('bytes=-10',100),{start:90,end:99});
  assert.deepEqual(byteRange('bytes=90-',100),{start:90,end:99});
  assert.deepEqual(byteRange('bytes=90-999',100),{start:90,end:99});
  for(const invalid of ['bytes=100-','bytes=9-2','bytes=-0','bytes=','bytes=0-2,4-5','bytes=9007199254740999-'])assert.throws(()=>byteRange(invalid,100));
});
test('media proxy normal, range, missing, and upstream failure',async()=>{
  let mode='ok',calls=0;
  const app=createApp({fetchImpl:async(url,options)=>{
    calls++;assert.match(url.href,/^https:\/\/raw\.githubusercontent\.com\/SJT-bright\/crystal-optics-review-media\/v1\.0\.0\//);
    if(mode==='error')throw new Error('upstream unavailable');
    if(mode==='missing')return new Response('not found',{status:404});
    assert.equal(options.headers.Range,'bytes=0-3');
    return new Response(new Uint8Array([1,2,3,4]),{status:206,headers:{'Content-Type':'video/mp4','Content-Length':'4','Content-Range':'bytes 0-3/7446670','Accept-Ranges':'bytes'}});
  }});
  await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port+'/video/conoscopy/350431000.mp4';
  try{
    let r=await fetch(base,{headers:{Range:'bytes=0-3'}});assert.equal(r.status,206);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3,4]);assert.equal(r.headers.get('content-type'),'video/mp4');
    const n=calls;r=await fetch(base,{headers:{Range:'bytes=999999999-'}});assert.equal(r.status,416);assert.equal(calls,n);
    mode='missing';r=await fetch(base);assert.equal(r.status,404);
    mode='error';r=await fetch(base);assert.equal(r.status,502);
  }finally{await new Promise(r=>app.close(r));}
});
test('header deadline does not cut off a slower media body',async()=>{
  let aborted=false;
  const app=createApp({headerTimeoutMs:15,fetchImpl:async(url,{signal})=>{
    const body=new ReadableStream({start(controller){
      let count=0;const abort=()=>{aborted=true;clearInterval(timer);controller.error(new Error('aborted'));};
      signal.addEventListener('abort',abort,{once:true});
      const timer=setInterval(()=>{if(count++<4)controller.enqueue(new Uint8Array([1,2]));else{clearInterval(timer);signal.removeEventListener('abort',abort);controller.close();}},30);
    }});
    return new Response(body,{headers:{'Content-Type':'video/mp4'}});
  }});
  await new Promise(r=>app.listen(0,'127.0.0.1',r));
  try{const r=await fetch('http://127.0.0.1:'+app.address().port+'/video/conoscopy/350431000.mp4');assert.equal((await r.arrayBuffer()).byteLength,8);assert.equal(aborted,false);}
  finally{await new Promise(r=>app.close(r));}
});
test('online server normal and rejected requests',async()=>{
  const app=createApp();await new Promise(r=>app.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.address().port;
  try{
    let r=await fetch(base+'/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/release-button/);assert.doesNotMatch(html,/serviceWorker\.register|id="warmbtn"/);
    r=await fetch(base+'/version.json');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);const release=await r.json();assert.match(html,new RegExp('data-build="'+release.build+'"'));
    r=await fetch(base+'/icon-180.png',{headers:{Range:'bytes=0-7'}});assert.equal(r.status,206);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[137,80,78,71,13,10,26,10]);
    r=await fetch(base+'/icon-180.png',{method:'HEAD'});assert.equal(r.status,200);assert.equal((await r.text()).length,0);
    r=await fetch(base+'/icon-180.png',{headers:{Range:'bytes=999999999-'}});assert.equal(r.status,416);
    r=await fetch(base+'/index.html',{method:'POST'});assert.equal(r.status,405);
    for(const key of ['server.mjs','.env','media-manifest.json','%2e%2e%2fsite.json','%00','img/not-a-real-image.jpg']){r=await fetch(base+'/'+key);assert.ok([400,404].includes(r.status),key+' status '+r.status);}
    const js=await readFile(new URL('../public/online.js',import.meta.url),'utf8');assert.doesNotMatch(js,/caches\.open|serviceWorker\.register|localStorage\.clear/);assert.match(js,/AbortController/);
  }finally{await new Promise(r=>app.close(r));}
});
