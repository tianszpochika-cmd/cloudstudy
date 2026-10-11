/* Browser-local presentation controls. Never calls a business API. */
(() => {
  const surface = window.DEMO_SURFACE || 'mobile';
  const key = `yxx-ui-v2-controls-${surface}`;
  let state = 'normal';
  let returnFocus;
  let savedControls = {};
  try { savedControls = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
  const controls = document.createElement('button');
  controls.className = 'demo-controls'; controls.textContent = '演示控制'; controls.onclick = open;
  const dialog = document.createElement('dialog'); dialog.className = 'demo-dialog'; dialog.setAttribute('aria-labelledby', 'demo-control-title');
  document.body.append(controls, dialog);
  function open() {
    returnFocus = document.activeElement;
    dialog.innerHTML = `<div class="dialog-head"><h2 id="demo-control-title">演示控制</h2><button aria-label="关闭演示控制" data-close>×</button></div><p class="d">只改变本端的拟真档案与页面状态，不连接真实服务。</p><label class="lb" for="demo-route">完整页面目录</label><select id="demo-route">${Object.keys(V).map(r => `<option value="${r}"${document.getElementById('view').dataset.route === r ? ' selected' : ''}>${TITLES[r] || r} · ${r}</option>`).join('')}</select><label class="lb" for="demo-state">本页状态</label><select id="demo-state">${[['normal','正常'],['loading','加载中'],['empty','空数据'],['full','满数据'],['error','加载失败'],['permission','无权限']].map(([v,t])=>`<option value="${v}"${state===v?' selected':''}>${t}</option>`).join('')}</select><label class="lb" for="demo-persona">学员画像（切换会加载独立档案）</label><select id="demo-persona">${DEMO_PERSONAS.map(p=>`<option value="${p.id}"${savedControls.persona===p.id?' selected':''}>${p.name} · ${p.description}</option>`).join('')}</select><label class="lb" for="demo-theme">界面主题</label><select id="demo-theme"><option value="light"${SET.theme==='light'?' selected':''}>浅色</option><option value="dark"${SET.theme==='dark'?' selected':''}>深色</option><option value="follow"${SET.theme==='follow'?' selected':''}>跟随系统</option></select><div class="dialog-actions"><button class="btn" data-apply>应用设置</button><button class="btn ghost" data-reset>重置本端拟真数据</button></div><p class="d">错误和无权限状态有可执行恢复出口。加载态需手动切换回正常，方便检查骨架与读屏。</p>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelector('[data-apply]').onclick=()=>{
      const persona=dialog.querySelector('#demo-persona').value;
      const route=dialog.querySelector('#demo-route').value;
      state=dialog.querySelector('#demo-state').value;
      SET.theme=dialog.querySelector('#demo-theme').value;
      const changed=(savedControls.persona || 'active')!==persona;
      savedControls={persona,theme:SET.theme};
      try { localStorage.setItem(key,JSON.stringify(savedControls)); } catch(e) { toast('设置未保存：本机存储不可用，请允许存储后重试。'); return; }
      dialog.close();
      if(changed) { location.hash='#/'+route; location.reload(); }
      else { nav('#/'+route); render(); }
    };
    dialog.querySelector('[data-reset]').onclick=()=>{
      dialog.close();
      window.demoConfirm('重置拟真数据？','本端四个学员档案、草稿和沙盒记录将恢复初始样例，另一端不受影响。',()=>{
        try { Object.keys(localStorage).filter(k=>k.startsWith(`yxx-ui-v2-${surface}`)||k===key).forEach(k=>localStorage.removeItem(k)); } catch(e) { toast('重置失败，原数据仍保留。');return; }
        location.hash='#/home';location.reload();
      });
    };
    dialog.showModal();
  }
  dialog.addEventListener('close',()=>returnFocus?.isConnected && returnFocus.focus());
  window.demoConfirm=(title,body,action)=>{
    const modal=document.createElement('dialog');modal.className='demo-dialog';modal.setAttribute('aria-label',title);
    const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=body;
    const actions=document.createElement('div');actions.className='dialog-actions';
    const confirm=document.createElement('button');confirm.className='btn danger';confirm.textContent='确认';
    const cancel=document.createElement('button');cancel.className='btn ghost';cancel.textContent='取消';
    confirm.onclick=()=>{modal.close();action();};cancel.onclick=()=>modal.close();actions.append(cancel,confirm);modal.append(h,p,actions);document.body.append(modal);const active=document.activeElement;modal.addEventListener('close',()=>{modal.remove();active?.isConnected && active.focus();});modal.showModal();cancel.focus();
  };
  function decorate() {
    const view=document.getElementById('view');
    view.setAttribute('tabindex','-1');view.setAttribute('aria-label',TITLES[view.dataset.route]||'页面内容');view.dataset.demoState=state;
    document.querySelectorAll('#view label.lb').forEach(label=>{if(label.htmlFor||label.querySelector('input'))return;let next=label.nextElementSibling;if(next?.matches('input,textarea,select')){next.id ||= 'demo-field-'+Math.random().toString(36).slice(2,8);label.htmlFor=next.id;}});
    if(state==='normal')return;
    const name=TITLES[view.dataset.route]||'当前页面';
    if(state==='loading'){view.setAttribute('aria-busy','true');view.innerHTML=`<section class="demo-skeleton" role="status" aria-label="正在加载${name}"><span></span><span></span><span></span><span></span><p class="d">正在读取本机演示数据…</p><button class="btn ghost" onclick="DemoUI.normal()">完成加载</button></section>`;return;}
    view.setAttribute('aria-busy','false');
    if(state==='full'){view.insertAdjacentHTML('afterbegin','<div class="demo-full-note" role="status">满数据场景 · 长文案与历史记录已展开，主操作仍可执行。</div>');view.querySelectorAll('details').forEach(d=>d.open=true);return;}
    const copy={empty:['◇','暂无'+name+'记录','此档案还没有这类记录。恢复示例后，可继续体验本页完整操作。','载入示例数据'],error:['!','本页数据读取失败','已保存的输入和学习记录仍在本机。重试会恢复当前页面，不会重复提交。','重新读取'],permission:['⌁','当前档案无此操作权限','学习需要成年人确认和当前版本的同意；你仍可查看账号设置与反馈问题。','查看准入与同意']}[state];
    view.innerHTML=`<section class="demo-${state}" role="status"><span class="demo-state-icon" aria-hidden="true">${copy[0]}</span><h2>${copy[1]}</h2><p class="d">${copy[2]}</p><button class="btn" onclick="DemoUI.${state==='permission'?'permissionExit':'normal'}()">${copy[3]}</button><button class="btn ghost" onclick="DemoUI.normal()">返回页面</button></section>`;
  }
  window.DemoUI={normal(){state='normal';render();},permissionExit(){state='normal';nav('#/gate');render();},open,get state(){return state;},setState(v){if(!['normal','loading','empty','full','error','permission'].includes(v))throw Error('Unknown demo state');state=v;render();},routes:()=>Object.keys(V)};
  const previous=render;render=function(){previous();decorate();};
  render();
})();
