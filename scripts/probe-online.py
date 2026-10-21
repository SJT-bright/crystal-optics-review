"""Small public HTTPS release probe; no full-library download or user data."""
from pathlib import Path
import http.cookiejar
import urllib.request
import hashlib,json,time

ROOT=Path(__file__).resolve().parents[1]
BASE='https://crystal-optics-review.app.workbuddy.host/'
QUERY='?sharecode=A64ZUFQANV'
inventory=json.loads((ROOT/'media-manifest.json').read_text())
expected=json.loads((ROOT/'public/version.json').read_text())
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def read(name,headers=None):
    before=time.monotonic()
    with client.open(urllib.request.Request(BASE+name+QUERY,headers=headers or {}),timeout=30) as r:
        body=r.read()
        result={'path':name,'status':r.status,'type':r.headers.get('Content-Type'),'bytes':len(body),'seconds':round(time.monotonic()-before,2)}
        print(json.dumps(result),flush=True)
        return r.status,r.headers,body

status,_,body=read('')
assert status==200 and b'id="release-button"' in body
status,_,body=read('version.json')
version=json.loads(body)
assert version['build']==expected['build'] and version['version']==expected['version']
for name in ['img/seq/863_0/000.jpg','img/seq/863_0/071.jpg']:
    status,_,body=read(name)
    assert status==200 and hashlib.sha256(body).hexdigest()==inventory[name]['sha256']
name='video/conoscopy/351931540.mp4'
status,headers,body=read(name,{'Range':'bytes=0-1023'})
assert status==206 and len(body)==1024 and headers['Content-Range']=='bytes 0-1023/'+str(inventory[name]['bytes'])
print(json.dumps({'complete':True,'version':version['version'],'build':version['build']}),flush=True)
