/* Author-published interference figures; current specimen modes stay intact. */
(function(){
  'use strict';
  var dialog=null,active=null,trigger=null,query='',selection='',picked='';
  function data(){return window.CONOSCOPY_REFERENCE||{entries:[],coverage:[]}}
  function safe(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function bySid(sid){return data().entries.filter(function(e){return (e.targetSids||[]).indexOf(String(sid))>=0})}
  function stop(){
    if(!dialog)return;
    dialog.querySelectorAll('video').forEach(function(v){v.pause();v.removeAttribute('src');v.load()});
  }
  function close(){
    if(!dialog||!dialog.open)return;
    active=null;stop();dialog.close();if(trigger&&trigger.isConnected)trigger.focus({preventScroll:true});
  }
  function ensure(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='conoscopy-dialog';dialog.className='conoscopy-dialog';
    dialog.setAttribute('aria-labelledby','conoscopy-heading');
    dialog.innerHTML='<div class="conoscopy-head"><h2 id="conoscopy-heading">实拍锥光参考</h2><span id="conoscopy-total"></span><button id="conoscopy-close" aria-label="关闭锥光参考">关闭 ×</button></div>'+ 
      '<div class="conoscopy-layout"><aside class="conoscopy-sidebar"><input type="search" id="conoscopy-search" placeholder="搜索矿物 / 标本 · 支持拼音" aria-label="搜索锥光参考">'+
      '<select id="conoscopy-filter" aria-label="锥光参考矿物筛选"></select><div id="conoscopy-count" role="status"></div><div id="conoscopy-list" class="conoscopy-list"></div></aside>'+ 
      '<div class="conoscopy-viewer" id="conoscopy-viewer" role="region" aria-label="锥光参考画面"></div></div>';
    document.body.appendChild(dialog);
    document.getElementById('conoscopy-close').onclick=close;
    dialog.addEventListener('cancel',function(e){e.preventDefault();close()});
    dialog.addEventListener('close',stop);
    dialog.addEventListener('click',function(e){if(e.target===dialog)close()});
    document.getElementById('conoscopy-search').oninput=function(){query=this.value.trim().toLowerCase();renderList()};
    document.getElementById('conoscopy-filter').onchange=function(){selection=this.value;renderList()};
  }
  function shown(){
    return data().entries.filter(function(e){
      var groupHit=!selection||(e.targetSids||[]).indexOf(selection)>=0||e.mineralKey===selection;
      var words=(e.mineralZh+' '+e.mineralEn+' '+e.specimen+' '+(e.pinyin||'')).toLowerCase();
      return groupHit&&(!query||words.indexOf(query)>=0);
    });
  }
  function renderList(){
    var rows=shown(),list=document.getElementById('conoscopy-list');
    if(!rows.some(function(e){return e.id===picked}))picked=rows.length?rows[0].id:'';
    document.getElementById('conoscopy-count').textContent=rows.length+' 条匹配 · '+data().entries.length+' 条实拍';
    var last='';
    list.innerHTML=rows.map(function(e){
      var group=e.mineralZh,lastGroup=group!==last?'<div class="conoscopy-group">'+safe(group)+'</div>':'';last=group;
      return lastGroup+'<button class="conoscopy-row'+(e.id===picked?' on':'')+'" data-reference-id="'+safe(e.id)+'" aria-current="'+(e.id===picked?'true':'false')+'" title="'+safe(e.mineralZh+' · '+e.specimen+' · '+e.figureZh)+'">'+
        '<span>'+safe(e.specimen+' · '+e.figureZh)+'</span><small>'+safe(e.kind==='video'?'视频 '+Math.round(e.duration)+' 秒':'实拍照片')+'</small></button>';
    }).join('')||'<div class="conoscopy-empty">没有匹配的素材，可清空搜索或选择全部矿物。</div>';
    list.querySelectorAll('[data-reference-id]').forEach(function(b){b.onclick=function(){picked=b.dataset.referenceId;list.querySelectorAll('button').forEach(function(row){var on=row===b;row.classList.toggle('on',on);row.setAttribute('aria-current',on?'true':'false')});renderMedia(picked)}});
    renderMedia(picked);
  }
  function renderMedia(id){
    if(active===id)return;
    stop();active=id;
    var e=data().entries.find(function(entry){return entry.id===id}),viewer=document.getElementById('conoscopy-viewer');
    if(!e){viewer.innerHTML='<div class="conoscopy-empty">请选择一条锥光参考。</div>';return}
    var media=e.kind==='video'?'<video id="conoscopy-media" controls playsinline preload="none" src="'+safe(e.localPath)+'" poster="'+safe(e.posterPath)+'" aria-label="'+safe(e.mineralZh+' '+e.specimen+' '+e.figureZh)+'"></video>':
      '<img id="conoscopy-media" decoding="async" src="'+safe(e.localPath)+'" alt="'+safe(e.mineralZh+' '+e.figureZh)+'">';
    viewer.innerHTML='<div class="conoscopy-title"><strong>'+safe(e.mineralZh)+'</strong><span>'+safe(e.specimen+' · '+e.figureZh)+'</span></div>'+ 
      '<div class="conoscopy-media-box">'+media+'</div><div class="conoscopy-error" id="conoscopy-error" role="status" hidden>素材暂时无法加载，请检查网络后重试。<button id="conoscopy-retry">重试</button></div>'+ 
      '<p class="conoscopy-note">其他标本的实拍教学参考。'+(e.kind==='video'?'按视频时间播放与拖动，未标定为当前载物台角度。':'原文未标定载物台角度。')+'</p>'+ 
      '<p class="conoscopy-caption">'+safe(e.caption||'')+'</p><details class="conoscopy-source"><summary>来源与拍摄条件</summary><p>'+safe(e.conditions)+'</p>'+ 
      '<p>'+safe(e.originalTitle||e.caption)+'</p><p>'+safe(e.author)+' · '+safe(e.specimen)+'</p>'+ 
      '<a href="'+safe(e.sourceUrl)+'" target="_blank" rel="noopener noreferrer">作者原始页面 ↗</a>'+ 
      (e.videoId?' · <a href="https://vimeo.com/'+safe(e.videoId)+'" target="_blank" rel="noopener noreferrer">原始视频 ↗</a>':'')+'</details>';
    var element=document.getElementById('conoscopy-media');
    element.addEventListener('error',function(){if(active===id&&element.isConnected&&element===document.getElementById('conoscopy-media'))document.getElementById('conoscopy-error').hidden=false});
    document.getElementById('conoscopy-retry').onclick=function(){active=null;renderMedia(id)};
  }
  function open(sid,button){
    ensure();trigger=button||document.activeElement;stop();active=null;query='';picked='';
    if(typeof window.pauseSourceVideos==='function')window.pauseSourceVideos();
    selection=bySid(sid).length?String(sid):'';
    var categories=data().coverage.map(function(c){return {value:c.sid,label:c.name+' · '+c.count}});
    data().extraMinerals.forEach(function(c){categories.push({value:c.key,label:c.name+' · '+c.count})});
    document.getElementById('conoscopy-filter').innerHTML='<option value="">全部矿物 · '+data().entries.length+' 条</option>'+categories.map(function(c){return '<option value="'+safe(c.value)+'">'+safe(c.label)+'</option>'}).join('');
    document.getElementById('conoscopy-filter').value=selection;document.getElementById('conoscopy-search').value='';
    document.getElementById('conoscopy-total').textContent=data().videoCount+' 段视频 · '+data().photoCount+' 张照片';
    renderList();if(!dialog.open)dialog.showModal();
    document.getElementById('conoscopy-search').focus({preventScroll:true});
  }
  window.Conoscopy={open:open,close:close,count:function(sid){return bySid(sid).length}};
  document.addEventListener('visibilitychange',function(){if(document.hidden&&dialog)dialog.querySelectorAll('video').forEach(function(v){v.pause()})});
})();
