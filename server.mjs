import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createMediaSeeder} from './media-seed.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)), PUBLIC=path.join(ROOT,'public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.gif':'image/gif','.mp4':'video/mp4','.pdf':'application/pdf','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
const media=JSON.parse(await readFile(path.join(ROOT,'media-manifest.json'),'utf8'));
const site=JSON.parse(await readFile(path.join(ROOT,'site.json'),'utf8'));
const seedFile=path.join(ROOT,'seed-config.private.json');
let seedConfig=null;try{seedConfig=JSON.parse(await readFile(seedFile,'utf8'));if(!/^[a-f0-9]{64}$/.test(seedConfig.token))throw new Error('Invalid seed configuration');}catch(error){if(error.code!=='ENOENT')throw error;}
const entryFiles=new Set(['index.html','data.js','data_patch.js','vm_complete.js','enrichment_data.js','enrichment.js','conoscopy_data.js','conoscopy.js','struct3d.js','online.js','online.css','sw.js','icon.svg','icon-180.png','制作与资料汇总.txt','version.json']);
export function byteRange(header,size){
  if(!header)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||(!match[1]&&!match[2]))throw new Error('range');
  const left=match[1], right=match[2];
  const start=left?Number(left):Math.max(0,size-Number(right));
  const end=left?(right?Math.min(Number(right),size-1):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=size||(!left&&Number(right)<=0))throw new Error('range');
  return {start,end};
}
export function createApp({fetchImpl=fetch,headerTimeoutMs=30000}={}){
  const seed=createMediaSeeder({root:PUBLIC,manifest:media,token:seedConfig?.token||'',configFile:seedConfig?seedFile:null});
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Cache-Control','no-store, max-age=0');
    let key;
    try{
      const raw=req.url.split('?')[0];
      if(/%(?:2e|2f|5c|00)/i.test(raw))throw new Error('path');
      key=decodeURIComponent(raw).replace(/^\//,'')||'index.html';
      if(key.split('/').some(part=>part==='..'||part.startsWith('.'))||key.includes('\\')||key.includes('\0'))throw new Error('path');
    }catch(_){res.writeHead(400);res.end('Invalid path');return;}
    try{if(await seed(req,res,key))return;}catch(_){if(!res.headersSent){res.writeHead(503);res.end('Media transfer unavailable');}else res.destroy();return;}
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    if(!entryFiles.has(key)&&!Object.hasOwn(media,key)){res.writeHead(404);res.end('Not found');return;}
    try{
      const file=path.join(PUBLIC,key);
      let info;
      try{info=await stat(file);}catch(error){if(error.code!=='ENOENT')throw error;}
      if(!info&&Object.hasOwn(media,key)&&site.mediaOrigin){
        // A source checkout streams only a requested known asset from the published site.
        // The production deployment holds the assets locally. No arbitrary URL proxy.
        const origin=new URL(site.mediaOrigin);
        if(origin.protocol!=='https:')throw new Error('Invalid media origin');
        try{byteRange(req.headers.range,media[key].bytes);}catch(_){res.writeHead(416,{'Content-Range':'bytes */'+media[key].bytes,'Content-Length':'0'});res.end();return;}
        const url=new URL(key,origin.href.endsWith('/')?origin.href:origin.href+'/');
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),headerTimeoutMs);
        res.on('close',()=>controller.abort());
        try{
          const headers={};if(req.headers.range)headers.Range=req.headers.range;
          const response=await fetchImpl(url,{method:req.method,headers,redirect:'error',signal:controller.signal});
          // Only time out waiting for headers. A slow viewer may stream a video for minutes.
          clearTimeout(timer);
          res.statusCode=response.status;
          for(const name of ['content-type','content-length','content-range','accept-ranges']){const value=response.headers.get(name);if(value)res.setHeader(name,value);}
          if(req.method==='HEAD'||!response.body)res.end();else await pipeline(Readable.fromWeb(response.body),res);
        }finally{clearTimeout(timer);}
        return;
      }
      if(!info||!info.isFile()){res.writeHead(404);res.end('Not found');return;}
      const resolved=await realpath(file);
      if(!resolved.startsWith(PUBLIC+path.sep))throw new Error('Invalid file');
      let range;
      try{range=byteRange(req.headers.range,info.size);}catch(_){res.writeHead(416,{'Content-Range':'bytes */'+info.size,'Content-Length':'0'});res.end();return;}
      const headers={'Content-Type':TYPES[path.extname(key).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Content-Length':range?range.end-range.start+1:info.size};
      if(range)headers['Content-Range']='bytes '+range.start+'-'+range.end+'/'+info.size;
      res.writeHead(range?206:200,headers);
      if(req.method==='HEAD'){res.end();return;}
      await pipeline(createReadStream(file,range||{}),res);
    }catch(_){if(!res.headersSent){res.writeHead(502);res.end('Media temporarily unavailable');}else res.destroy();}
  });
}
// Resolve symlinked launch paths used by some hosting sandboxes.
const entry=process.argv[1]?await realpath(process.argv[1]).catch(()=>path.resolve(process.argv[1])):null;
if(entry===await realpath(fileURLToPath(import.meta.url))){
  const port=Number(process.env.PORT||3000);
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
  console.error('Starting Crystal Optics online H5 on port '+port);
  createApp().listen(port,'0.0.0.0',()=>console.error('Crystal Optics online H5 listening on '+port));
}
