import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/online.js', import.meta.url), 'utf8');

function pendingAutomaticCheck() {
  let resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  const status = {textContent:'', hidden:true};
  const button = {classList:{toggle(){}}, setAttribute(){}};
  const context = vm.createContext({
    document:{hidden:false, documentElement:{dataset:{version:'1.0.1',build:'abcdef12'}},
      getElementById:id => id === 'release-button' ? button : id === 'online-status' ? status : null,
      addEventListener(){}},
    navigator:{}, AbortController,
    fetch:() => pending,
    setTimeout:() => 1, clearTimeout(){},
  });
  context.window = context;
  context.addEventListener = () => {};
  vm.runInContext(source, context);
  return {context, status, resolve, reject};
}

test('manual click during an automatic version request receives success feedback', async () => {
  const f = pendingAutomaticCheck();
  const result = f.context.RockOnline.checkRelease(true);
  f.resolve({ok:true,json:async () => ({version:'1.0.1',build:'abcdef12'})});
  await result;
  assert.match(f.status.textContent, /当前已是最新版本/);
  assert.equal(f.status.hidden, false);
});

test('manual click during an automatic version request receives failure feedback', async () => {
  const f = pendingAutomaticCheck();
  const result = f.context.RockOnline.checkRelease(true);
  f.reject(new Error('network unavailable'));
  await result;
  assert.match(f.status.textContent, /暂时无法检查更新/);
  assert.equal(f.status.hidden, false);
});
