/* Online edition: release checks and single-image downloads. No offline media cache. */
(function () {
  'use strict';
  var REPO = 'SJT-bright/crystal-optics-review';
  var button = document.getElementById('release-button');
  var current = {version:document.documentElement.dataset.version, build:document.documentElement.dataset.build};
  var latest = null, checking = null, lastCheck = 0, checkTimer, statusTimer;
  function say(message) {
    var status = document.getElementById('online-status');
    if (status) { status.textContent = message; status.hidden = false; clearTimeout(statusTimer); statusTimer = setTimeout(function () { status.hidden = true; }, 8000); }
  }
  function validRelease(value) {
    return value && typeof value.version === 'string' && /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version) &&
      typeof value.build === 'string' && /^[a-zA-Z0-9.-]{6,64}$/.test(value.build);
  }
  function renderRelease() {
    if (!button) return;
    var changed = latest && latest.build !== current.build;
    button.textContent = changed ? '有新版 · 更新' : 'v' + current.version;
    button.classList.toggle('release-new', !!changed);
    button.title = '当前版本 v' + current.version + ' · ' + current.build + (changed ? '；可更新至 v' + latest.version : '；点击检查更新');
    button.setAttribute('aria-label', button.title);
  }
  function schedule() {
    clearTimeout(checkTimer);
    if (!document.hidden) checkTimer = setTimeout(function () { checkRelease(false); }, 300000);
  }
  function checkRelease(manual) {
    if (checking) return checking;
    if (!manual && Date.now() - lastCheck < 30000) { schedule(); return Promise.resolve(null); }
    lastCheck = Date.now();
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 8000);
    checking = fetch('version.json?check=' + Date.now(), {cache:'no-store', signal:controller.signal})
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (release) {
        if (!validRelease(release)) throw new Error('版本信息无效');
        latest = release; renderRelease();
        if (manual) say(latest.build === current.build ? '当前已是最新版本 v' + current.version : '新版已发布。点击右上角更新按钮查看；本次学习不会自动中断。');
        return release;
      }).catch(function () {
        if (manual) say('暂时无法检查更新，请检查网络后重试。当前版本仍可继续使用。');
        return null;
      }).finally(function () { clearTimeout(timer); checking = null; schedule(); });
    return checking;
  }
  function confirmUpdate() {
    var dialog = document.getElementById('release-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'release-dialog'; dialog.className = 'release-dialog';
      dialog.innerHTML = '<h2>网站有新版本</h2><p id="release-description"></p><p>学习记录保存在当前浏览器。正在作答时可以稍后更新；刷新后回到当前浏览器保存的学习状态。</p><div class="release-buttons"><button id="release-later">稍后</button><button id="release-now">刷新使用新版</button></div>';
      document.body.appendChild(dialog);
      document.getElementById('release-later').onclick = function () { dialog.close(); button.focus(); };
      document.getElementById('release-now').onclick = function () { dialog.close(); location.reload(); };
    }
    document.getElementById('release-description').textContent = '当前 v' + current.version + ' → 新版 v' + latest.version + '（' + latest.build + '）';
    if (!dialog.open) dialog.showModal();
    document.getElementById('release-later').focus();
  }
  if (button) button.onclick = function () { if (latest && latest.build !== current.build) confirmUpdate(); else checkRelease(true); };
  renderRelease(); checkRelease(false);
  window.addEventListener('focus', function () { checkRelease(false); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(checkTimer); else checkRelease(false); });
  async function retireOffline() {
    if (!('serviceWorker' in navigator)) return;
    try {
      var expected = new URL('./sw.js', document.baseURI).href;
      var registrations = await navigator.serviceWorker.getRegistrations();
      for (var registration of registrations) {
        var workers = [registration.active, registration.waiting, registration.installing].filter(Boolean);
        if (workers.some(function (worker) { return worker.scriptURL === expected; })) {
          // Let the retirement worker replace a currently controlling old worker first.
          // Unregistering alone would let the old controller keep caching until navigation.
          try { await registration.update(); } catch (_) {}
          if (!navigator.serviceWorker.controller) await registration.unregister();
        }
      }
      if ('caches' in window) {
        var names = await caches.keys();
        await Promise.all(names.filter(function (name) { return /^rockvm(?:-|$)/.test(name); }).map(function (name) { return caches.delete(name); }));
      }
      localStorage.removeItem('rockvm_warm');
    } catch (_) { /* Restricted storage must not prevent online learning. */ }
  }
  retireOffline();
  var star = document.getElementById('creator-github');
  if (star) {
    star.href = 'https://github.com/' + REPO;
    var ctl = new AbortController(), starTimer = setTimeout(function () { ctl.abort(); }, 6000);
    fetch('https://api.github.com/repos/' + REPO, {signal:ctl.signal, headers:{'Accept':'application/vnd.github+json'}})
      .then(function (response) { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then(function (repo) { if (Number.isSafeInteger(repo.stargazers_count) && repo.stargazers_count >= 0) document.getElementById('github-stars').textContent = repo.stargazers_count.toLocaleString(); })
      .catch(function () {}).finally(function () { clearTimeout(starTimer); });
  }
  function filename(label, extension) {
    return (String(label || '晶体光学图片').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0,100) || '图片') + extension;
  }
  function saveBlob(blob, name) {
    if (!blob || !blob.size) throw new Error('图片尚未就绪');
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  async function downloadImage(source, label, control) {
    if (control && control.disabled) return;
    if (control) control.disabled = true;
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 30000);
    try {
      var url = new URL(source, location.href);
      if (!/^https?:$/.test(url.protocol) && url.protocol !== 'data:') throw new Error('不支持此图片地址');
      var response = await fetch(url.href, {signal:ctl.signal});
      if (!response.ok) throw new Error('图片下载失败');
      var blob = await response.blob();
      if (!/^image\/(jpeg|png|gif|webp|avif|svg\+xml|bmp)(?:;|$)/i.test(blob.type)) throw new Error('服务器未返回图片');
      var suffix = /png/i.test(blob.type) ? '.png' : /webp/i.test(blob.type) ? '.webp' : /gif/i.test(blob.type) ? '.gif' : /svg/i.test(blob.type) ? '.svg' : /avif/i.test(blob.type) ? '.avif' : /bmp/i.test(blob.type) ? '.bmp' : '.jpg';
      saveBlob(blob, filename(label, suffix)); say('已下载当前图片，请保留图片对应的来源信息。');
    } catch (_) { say('图片下载失败，请检查网络或等当前图片加载完成后重试。'); }
    finally { clearTimeout(timer); if (control) control.disabled = false; }
  }
  function downloadStage() {
    var canvas = document.getElementById('stagecanvas');
    if (!canvas || !canvas.width || Number(canvas.style.opacity) !== 1) { say('当前画面尚未加载完成，请稍后再下载。'); return; }
    try {
      var label = typeof VM !== 'undefined' && typeof M !== 'undefined' && M[VM.sid] ? M[VM.sid].name : '显微镜';
      label += '_' + (canvas.dataset.degree || '0') + '度';
      canvas.toBlob(function (blob) { try { saveBlob(blob, filename(label,'.png')); say('已下载当前显微镜画面。'); } catch (_) { say('画面下载失败，请稍后重试。'); } }, 'image/png');
    } catch (_) { say('画面暂时无法下载，请等待图片加载完成后重试。'); }
  }
  window.RockOnline = {downloadImage:downloadImage, downloadStage:downloadStage, checkRelease:checkRelease};
  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-download-current]');
    if (!target) return;
    event.preventDefault(); event.stopPropagation();
    if (target.dataset.downloadCurrent === 'stage') { downloadStage(); return; }
    var image = document.getElementById(target.dataset.downloadCurrent);
    if (!image || !image.complete || !image.naturalWidth) { say('图片尚未加载完成，请稍后再下载。'); return; }
    downloadImage(image.currentSrc || image.src, image.alt || (document.getElementById('lbcap') || {}).textContent, target);
  });
})();
