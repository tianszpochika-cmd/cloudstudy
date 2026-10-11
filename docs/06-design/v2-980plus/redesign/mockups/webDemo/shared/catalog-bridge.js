/* Connect only browser-local publishing facts to both learner layouts. */
(() => {
 const prefix='preview-content-';
 const item=id=>typeof id==='string'&&id.startsWith(prefix)?PreviewWorkflows.catalog().find(c=>prefix+c.id===id):null;
 function sync(){if(window.DEMO_STRESS_ACTIVE)return;const supplied=PreviewWorkflows.catalog();for(let i=BOOKS.length-1;i>=0;i--)if(BOOKS[i].id.startsWith(prefix))BOOKS.splice(i,1);for(let i=LCATALOG.length-1;i>=0;i--)if(LCATALOG[i].id.startsWith(prefix))LCATALOG.splice(i,1);for(const key of Object.keys(CHAP))if(key.startsWith(prefix))delete CHAP[key];for(const c of supplied.filter(c=>c.available)){const id=prefix+c.id;BOOKS.push({id,title:c.title,author:'本机教研工作台',year:'v'+c.version,purpose:'经过独立双审的合成内容',tags:['原创','阅读','B1'],dir:'阅读正文 → 记录笔记 → 查看学习结果',intro:'发布快照 v'+c.version+'；编辑新草稿不会改变这份在架内容。',toc:['原创阅读与表达'],sents:[[c.text||'Read carefully and explain your idea.','B1','仔细阅读，再用自己的话表达。']]});LCATALOG.push({id,goal:'college',level:'B1'});CHAP[id]=['# '+c.title+'\n\n'+c.text+'\n\n## 练习建议\n\n找出一句关键观点，并写下它在日常交流中的用法。'];}}
 function denied(id){const c=item(id);return c&&!c.available;}
 function unavailable(){return '<section class="card"><span class="tag no">当前版本停止供给</span><h2>这份内容已下架</h2><p class="d">本机发布事实已变更，旧链接不能继续读取。原来的完成记录和个人笔记保留，可以换一门课程。</p><button class="btn" onclick="nav(\'#/courses\')">发现其他课程</button><button class="btn ghost" onclick="nav(\'#/collections\')">查看个人笔记</button></section>';}
 const open=lmCourseOpen;lmCourseOpen=function(id){if(denied(id)){toast('该内容已下架，未开放旧版本。');return;}return open(id);};
 const chapter=openChapter;openChapter=function(id,index){if(denied(id)){toast('该内容已下架，不能用旧链接继续读取。');return;}return chapter(id,index);};
 for(const r of ['book','chapter']){const old=V[r];V[r]=()=>denied(BK.cur)?unavailable():old();}
 const previous=render;render=function(){sync();return previous();};window.DemoCatalog={sync,available:id=>!denied(id)};
})();