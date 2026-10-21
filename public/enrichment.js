/* Additive reading notes. Original records and quiz identifiers stay authoritative. */
(function (global) {
  'use strict';
  function catalog() { return global.LEARNING_ENRICHMENT || {entries:{},sources:{}}; }
  function entries(kind, id) { return catalog().entries[kind + ':' + String(id)] || []; }
  function safeUrl(url) { return /^https:\/\//i.test(String(url || '')) ? url : ''; }
  function sourceLink(id) {
    var s = catalog().sources[id], url = s && safeUrl(s.url);
    if (!url) return '';
    return '<a href="' + attr(url) + '" target="_blank" rel="noopener noreferrer" title="' + attr(s.title) + '">' + esc(s.publisher || s.title) + '</a>';
  }
  global.learningExtraText = function (kind, id) {
    var c=(catalog().corrections||{})[kind+':'+String(id)];
    return (c?c.text+' ':'')+entries(kind,id).map(function(e){return e.title+' '+e.points.map(function(p){return p.text}).join(' ')}).join(' ');
  };
  global.learningExtraHtml = function (kind, id) {
    var list = entries(kind,id);
    if (!list.length) return '';
    var n = list.reduce(function(total,e){return total+e.points.length},0);
    var correction=(catalog().corrections||{})[kind+':'+String(id)];
    var html = correction?'<div class="learning-correction"><strong>资料核对</strong> '+esc(correction.text)+'<div class="learning-citation">依据：'+correction.source_ids.map(sourceLink).filter(Boolean).join(' · ')+'；原资料保留供对照。</div></div>':'';
    html += '<details class="learning-extra" data-learning-target="' + attr(kind+':'+id) + '"><summary>补充学习 · '+n+' 个观察与辨别要点</summary><div class="learning-extra-body">';
    list.forEach(function(e){
      html += '<h4>'+esc(e.title)+'</h4><ul>';
      e.points.forEach(function(p){
        html += '<li>'+esc(p.text)+'<div class="learning-citation">参考：'+p.source_ids.map(sourceLink).filter(Boolean).join(' · ')+'</div></li>';
      });
      html += '</ul>';
    });
    return html+'<p class="hint">要点与参考来源可在线查阅。补充说明不替代当前标本的实拍观察。</p></div></details>';
  };
  global.learningSourceIndexHtml = function () {
    var data=catalog(), sources=Object.keys(data.sources);
    if (!sources.length) return '';
    var html='<div class="sheet" id="s-enrichment"><details class="learning-extra"><summary>补充学习来源 · '+Object.keys(data.entries).length+' 个现有条目 / '+sources.length+' 个来源页</summary><div class="learning-extra-body"><p class="hint">资料核对日期：'+esc(data.date)+'。各条目图片下方可展开补充学习；这部分是来源转述，原课程文字与原素材署名保留。</p><ol>';
    sources.forEach(function(id){var s=data.sources[id];html+='<li>'+sourceLink(id)+' · '+esc(s.title)+' <span class="hint">'+(s.language==='zh'?'中文':'外文')+'</span></li>'});
    return html+'</ol></div></details></div>';
  };
})(window);
