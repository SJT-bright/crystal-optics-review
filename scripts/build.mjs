import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const publicDir=path.join(root,'public');
const files=(await readdir(publicDir)).filter(name=>/\.(?:js|css|html)$/.test(name)).sort();
const hash=createHash('sha256').update(pkg.version);
for(const name of files){
  let text=await readFile(path.join(publicDir,name),'utf8');
  if(name==='index.html')text=text.replace(/data-build="[^"]*"/,'data-build="BUILD"').replace(/data-version="[^"]*"/,'data-version="VERSION"').replace(/(id="release-button"[^>]*>)[^<]*/, '$1VERSION');
  hash.update(name+'\0'+text);
}
for (const name of ['server.mjs','site.json','media-manifest.json','scripts/build.mjs']) hash.update(name+'\0'+await readFile(path.join(root,name)));
const build=hash.digest('hex').slice(0,16);
const release={version:pkg.version,build,edition:'online',repository:pkg.repository.url.replace(/\.git$/,''),publishedAt:new Date().toISOString()};
let html=await readFile(path.join(publicDir,'index.html'),'utf8');
html=html.replace(/data-build="[^"]*"/,'data-build="'+build+'"').replace(/data-version="[^"]*"/,'data-version="'+pkg.version+'"');
html=html.replace(/(id="release-button"[^>]*>)[^<]*/,function(_,prefix){return prefix+'v'+pkg.version;});
await writeFile(path.join(publicDir,'index.html'),html);
await writeFile(path.join(publicDir,'version.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify(release));
