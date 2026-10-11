'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const callbacks={},cache=new Map(),nodes=new Map();
const node=()=>({innerHTML:'',textContent:'',dataset:{},open:false,classList:{add(){},remove(){}},showModal(){this.open=true},close(){this.open=false}});
const context={console,setTimeout:()=>0,clearTimeout(){},location:{hash:'#/dash'},confirm:()=>true,Blob,URL,document:{documentElement:{dataset:{}},querySelector(s){if(s.includes('name=')||s==='#modal [name=reason]')return null;if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return[];},addEventListener(e,fn){callbacks[e]=fn;}},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)},FormData:class{constructor(f){this.data=f.data;}entries(){return Object.entries(this.data)[Symbol.iterator]();}get(k){return this.data[k];}}};
context.window=context;context.addEventListener=(e,fn)=>callbacks['window:'+e]=fn;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'data.js'),'utf8'),context);
const seed=context.AdminFixtures.seed();seed.authenticated=true;cache.set('yx.demo.admin.product.v3',JSON.stringify(seed));
vm.runInContext(fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),context);
const demo=context.AdminDemo;
const click=(a,id='')=>callbacks.click({target:{closest(s){return s==='[data-nav]'?null:s==='[data-action]'?{dataset:{action:a,id}}:null;}}});
const submit=(id,data,subject='')=>callbacks.submit({preventDefault(){},target:{id,dataset:{id:subject},data}});
function nav(r,id=''){context.location.hash='#/'+r+(id?'/'+id:'');callbacks['window:hashchange']();}
let checks=0;function check(c,label){assert.ok(c,label);checks++;}
for(const r of demo.routes){if(r!=='login'){const scopes={review:'l1',reviewdetail:'l1',publish:'publisher',versions:'publisher',content:'editor',contentdetail:'editor',editor:'editor',media:'publisher',upload:'publisher',refunds:'finance1',refunddetail:'finance1'};click('switch-identity',scopes[r]||'ops');}nav(r);check(nodes.get('#app').innerHTML.length>250,'render '+r);for(const state of ['loading','empty','full','error','permission','normal']){callbacks.change({target:{id:'state-mode',value:state}});check(nodes.get('#app').innerHTML.length>250,r+' '+state);}}
click('switch-identity','editor');nav('editor');submit('content-form',{title:'原创阅读 · 静态全链验收',type:'阅读',level:'B1',text:'The quiet library helps students focus on their reading and makes study enjoyable.',rights:'on',media:'on'});
let c=demo.getState().content.at(-1),cid=c.id;check(c.status==='草稿','new draft');click('submit-content',cid);check(demo.getState().content.at(-1).status==='待初审','submit');
click('switch-identity','l1');nav('reviewdetail',cid);submit('review-form',{decision:'approve',reason:'原创内容与必要媒体核验通过'},cid);check(demo.getState().content.at(-1).status==='待终审','L1');
click('switch-identity','l2');nav('reviewdetail',cid);submit('review-form',{decision:'approve',reason:'内容准确且学习目标一致'},cid);check(demo.getState().content.at(-1).status==='可发布','L2');
click('switch-identity','publisher');nav('publish');click('publish',cid);submit('modal-form',{reason:'独立发布者确认版本可分发'});check(demo.getState().content.at(-1).status==='已发布','publish');click('force',cid);submit('modal-form',{reason:'版权核验发现新的受限事实'});check(demo.getState().content.at(-1).blocked.includes(1),'force blocks version');
click('switch-identity','ops');nav('ticketdetail','TK-3001');click('claim-ticket','TK-3001');click('escalate-ticket','TK-3001');submit('modal-form',{target:'support',reason:'需要二线核对学习会话恢复情况'});check(demo.getState().tickets[0].status==='待二线接收','escalation pending');
click('switch-identity','support');nav('ticketdetail','TK-3001');click('receive-ticket','TK-3001');check(demo.getState().tickets[0].assignee==='support','receiver accepted');submit('ticket-form',{reply:'已核对静态学习会话并确认恢复结果。',next:'resolve'},'TK-3001');click('close-ticket','TK-3001');submit('modal-form',{});check(demo.getState().tickets[0].status==='已关闭','ticket closed');
click('switch-identity','finance1');nav('refunddetail','RF-501');click('approve-refund','RF-501');submit('modal-form',{reason:'订单与退款申请符合样例条件'});check(demo.getState().refunds[0].approvals.length===1,'first refund approval');click('approve-refund','RF-501');check(demo.getState().refunds[0].approvals.length===1,'duplicate rejected');
click('switch-identity','finance2');nav('refunddetail','RF-501');click('approve-refund','RF-501');submit('modal-form',{reason:'独立复核退款金额及申请原因'});check(demo.getState().refunds[0].status==='待渠道处理','second approval');click('submit-refund','RF-501');submit('modal-form',{});check(demo.getState().refunds[0].status==='渠道处理中','pending channel');click('finish-refund','RF-501');submit('modal-form',{});check(demo.getState().refunds[0].status==='已退款','channel receipt');
click('switch-identity','ops');nav('privacydetail','PR-802');click('privacy-check','PR-802');check(demo.getState().privacy[1].status==='冷静期','no premature deletion');
nav('identity');click('storage-fail');const before=JSON.stringify(demo.getState());click('theme');check(JSON.stringify(demo.getState())===before,'failed write rolls back');click('storage-fail');
console.log(JSON.stringify({checks,passed:true,routes:demo.routes.length,scope:'VM rendering and static state-machine; browser visual acceptance not covered'},null,2));
