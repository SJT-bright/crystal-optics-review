import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createMediaSeeder} from '../media-seed.mjs';
test('deployment media transfer authenticates, validates bytes, resumes and disables',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'optics-seed-')),token='a'.repeat(64),body=Buffer.from('seed');
  const sha256=createHash('sha256').update(body).digest('hex');
  const manifest={'img/test.jpg':{bytes:body.length,sha256}};
  const configFile=path.join(root,'seed-config.private.json');await writeFile(configFile,JSON.stringify({token}));
  const handler=createMediaSeeder({root,manifest,token,configFile});
  const server=http.createServer(async(req,res)=>{try{if(!await handler(req,res,req.url.slice(1))){res.writeHead(404);res.end();}}catch(_){res.writeHead(500);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/__media_seed/',headers={'X-Media-Seed-Key':token};
  try{
    let r=await fetch(base+'status');assert.equal(r.status,401);
    r=await fetch(base+'status',{headers:{'X-Media-Seed-Key':'not-a-key'}});assert.equal(r.status,401);
    r=await fetch(base+'status',{headers});assert.deepEqual((await r.json()).missing,['img/test.jpg']);
    r=await fetch(base+'finish',{method:'POST',headers});assert.equal(r.status,409);
    r=await fetch(base+'unknown.jpg',{method:'PUT',headers,body});assert.equal(r.status,404);
    r=await fetch(base+'img/test.jpg',{method:'PUT',headers,body:'wrong-length'});assert.equal(r.status,413);
    r=await fetch(base+'img/test.jpg',{method:'PUT',headers,body:'nope'});assert.equal(r.status,422);
    await mkdir(path.join(root,'img'),{recursive:true});await writeFile(path.join(root,'img/test.jpg'),'nope');
    r=await fetch(base+'status',{headers});assert.equal((await r.json()).missing.length,1);
    r=await fetch(base+'img/test.jpg',{method:'PUT',headers,body});assert.equal(r.status,201);assert.equal((await r.json()).sha256,sha256);
    assert.deepEqual(await readFile(path.join(root,'img/test.jpg')),body);
    r=await fetch(base+'img/test.jpg',{method:'HEAD',headers});assert.equal(r.status,200);
    r=await fetch(base+'img/test.jpg',{method:'PUT',headers,body});assert.equal(r.status,200);
    r=await fetch(base+'status',{headers});assert.equal((await r.json()).missing.length,0);
    r=await fetch(base+'finish',{method:'POST',headers});assert.equal(r.status,200);assert.equal((await r.json()).complete,true);
    await assert.rejects(()=>readFile(configFile));
    r=await fetch(base+'status',{headers});assert.equal(r.status,404);
  }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
test('media transfer is disabled by default',async()=>{
  const handler=createMediaSeeder({root:tmpdir(),manifest:{}}),server=http.createServer((req,res)=>handler(req,res,'__media_seed/status'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));try{assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/')).status,404);}finally{await new Promise(r=>server.close(r));}
});
