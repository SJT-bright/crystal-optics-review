/* Deployment-only media transfer. Disabled without a private key; immutable SHA-256 inventory. */
import path from 'node:path';
import {mkdir,stat,open,rename,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';

export function createMediaSeeder({root,manifest,token='',configFile=null}){
  let enabled=/^[a-f0-9]{64}$/.test(token);const active=new Set(),verified=new Set();
  async function matches(key){
    const expected=manifest[key],file=path.join(root,key);
    try{
      if((await stat(file)).size!==expected.bytes)return false;
      if(verified.has(key))return true;
      const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);
      if(h.digest('hex')!==expected.sha256)return false;
      verified.add(key);return true;
    }catch(_){return false;}
  }
  async function missing(){
    const keys=Object.keys(manifest),result=[];
    for(let i=0;i<keys.length;i+=32){const slice=keys.slice(i,i+32),ok=await Promise.all(slice.map(matches));slice.forEach((key,index)=>{if(!ok[index])result.push(key);});}
    return result;
  }
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
  return async function handle(req,res,key){
    if(!key.startsWith('__media_seed/'))return false;
    if(!enabled){json(res,404,{error:'Not found'});return true;}
    const supplied=String(req.headers['x-media-seed-key']||'');
    if(!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token))){res.setHeader('Connection','close');json(res,401,{error:'Unauthorized'});return true;}
    const name=key.slice('__media_seed/'.length);
    if(name==='status'&&req.method==='GET'){const list=await missing();json(res,200,{total:Object.keys(manifest).length,missing:list,verified:Object.keys(manifest).length-list.length});return true;}
    if(name==='finish'&&req.method==='POST'){
      const list=await missing();if(list.length){json(res,409,{error:'Media incomplete',remaining:list.length});return true;}
      enabled=false;token='';if(configFile)await unlink(configFile).catch(()=>{});
      json(res,200,{complete:true,files:Object.keys(manifest).length});return true;
    }
    const meta=manifest[name];
    if(!Object.hasOwn(manifest,name)||!name||name.split('/').some(p=>p==='..'||p.startsWith('.'))||name.includes('\\')){json(res,404,{error:'Not found'});return true;}
    if(req.method==='HEAD'){res.writeHead(await matches(name)?200:404);res.end();return true;}
    if(req.method!=='PUT'){res.setHeader('Allow','PUT, HEAD');json(res,405,{error:'Method not allowed'});return true;}
    const length=String(req.headers['content-length']||'');
    if(!/^\d+$/.test(length)){res.setHeader('Connection','close');json(res,411,{error:'Content-Length required'});return true;}
    if(Number(length)!==meta.bytes){res.setHeader('Connection','close');json(res,413,{error:'Unexpected media length'});return true;}
    if(active.has(name)){res.setHeader('Connection','close');json(res,409,{error:'Transfer already in progress'});return true;}
    active.add(name);
    const destination=path.join(root,name),temporary=destination+'.upload-'+randomUUID();let file;
    try{
      if(await matches(name)){res.setHeader('Connection','close');json(res,200,{path:name,bytes:meta.bytes,sha256:meta.sha256,existing:true});return true;}
      await mkdir(path.dirname(destination),{recursive:true});file=await open(temporary,'wx');
      let count=0;const h=createHash('sha256');
      for await(const chunk of req){
        count+=chunk.length;if(count>meta.bytes)throw new Error('Unexpected length');h.update(chunk);
        let offset=0;while(offset<chunk.length){const r=await file.write(chunk,offset,chunk.length-offset,null);if(!r.bytesWritten)throw new Error('Write failed');offset+=r.bytesWritten;}
      }
      await file.close();file=null;
      if(count!==meta.bytes||h.digest('hex')!==meta.sha256){json(res,422,{error:'Media integrity mismatch'});return true;}
      await rename(temporary,destination);verified.add(name);json(res,201,{path:name,bytes:meta.bytes,sha256:meta.sha256});
    }catch(_){if(!req.destroyed&&!res.headersSent)json(res,503,{error:'Transfer interrupted; retry this file'});else res.destroy();}
    finally{if(file)await file.close().catch(()=>{});await unlink(temporary).catch(()=>{});active.delete(name);}
    return true;
  };
}
