/* 语学星静态 Demo · 内联 SVG 图标精灵（离线、无外部请求）
   用法：<svg class="ico"><use href="#i-home"></use></svg>
   自动升级：移动端底部导航与顶栏搜索按钮的字符图标替换为矢量图标（保留原有文字与 aria）。 */
(function(){
  var P={
    home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    learn:'<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
    world:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    me:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chev:'<path d="m9 6 6 6-6 6"/>',
    back:'<path d="m15 6-6 6 6 6"/>',
    check:'<path d="m5 12 5 5 9-10"/>',
    x:'<path d="M6 6l12 12M18 6 6 18"/>',
    alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
    lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    inbox:'<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
    spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    book:'<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h12"/>'
  };
  var NS='http://www.w3.org/2000/svg';
  function sprite(){
    if(document.getElementById('demo-icon-sprite'))return;
    var s='<svg xmlns="'+NS+'" id="demo-icon-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">';
    for(var k in P)s+='<symbol id="i-'+k+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+P[k]+'</symbol>';
    s+='</svg>';
    document.body.insertAdjacentHTML('afterbegin',s);
  }
  function svg(name){return '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-'+name+'"></use></svg>';}
  window.demoIcon=svg;
  var TAB={home:'home',today:'learn',world:'world',me:'me'};
  function upgrade(){
    document.querySelectorAll('.tabbar a[data-t] > i:not([data-ico])').forEach(function(i){
      var n=TAB[i.parentElement.getAttribute('data-t')];if(!n)return;i.setAttribute('data-ico',n);i.innerHTML=svg(n);
    });
    document.querySelectorAll('.topbar .icon-button:not([data-ico])').forEach(function(b){
      if(!/搜索/.test(b.getAttribute('aria-label')||''))return;b.setAttribute('data-ico','search');b.innerHTML=svg('search');
    });
  }
  function boot(){sprite();upgrade();new MutationObserver(upgrade).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
