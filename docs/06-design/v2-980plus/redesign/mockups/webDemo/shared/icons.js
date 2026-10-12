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
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    ticket:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>',
    shield:'<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/>',
    swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    flag:'<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.6-4.5L3 9M4 13a8 8 0 0 0 14.6 4.5L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    store:'<path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/>',
    type:'<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
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
  var NAV={dash:'grid',students:'users',tickets:'ticket',privacy:'shield',orders:'cart',reconcile:'swap',governance:'alert',reports:'flag',audit:'list',observability:'activity',recovery:'refresh',permissions:'key',identity:'gear',
    home:'home',today:'clock',courses:'book',words:'type',reviewqueue:'refresh',mistakes:'target',weekly:'chart',history:'list',calendar:'calendar',world:'world',collections:'star',me:'me',settings:'gear',support:'help',commerce:'store',content:'book',review:'check',publish:'spark',media:'inbox'};
  function upgradeNav(){
    document.querySelectorAll('.sidebar nav a > span[aria-hidden]:not([data-ico]), .desktop-nav-item > .nav-icon:not([data-ico])').forEach(function(sp){
      var h=(sp.parentElement.getAttribute('href')||'').replace(/^#\/?/,'').split('/')[0];var n=NAV[h];if(!n)return;sp.setAttribute('data-ico',n);sp.classList.add('nav-ico');sp.innerHTML=svg(n);
    });
  }
  var _up=upgrade;upgrade=function(){_up();upgradeNav();};
  function boot(){sprite();upgrade();new MutationObserver(upgrade).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
