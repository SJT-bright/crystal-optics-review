import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,byteRange} from '../server.mjs';
import {readFile} from 'node:fs/promises';
test('video range boundaries',()=>{
  assert.deepEqual(byteRange('bytes=0-9',100),{start:0,end:9});
  assert.deepEqual(byteRange('bytes=-10',100),{start:90,end:99});
  assert.deepEqual(byteRange('bytes=90-',100),{start:90,end:99});
  assert.deepEqual(byteRange('bytes=90-999',100),{start:90,end:99});
  for(const invalid of ['bytes=100-','bytes=9-2','bytes=-0','bytes=','bytes=0-2,4-5','bytes=9007199254740999-'])assert.throws(()=>byteRange(invalid,100));
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
