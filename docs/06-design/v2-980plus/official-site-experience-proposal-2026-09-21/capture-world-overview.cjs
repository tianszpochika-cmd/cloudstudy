// Reproducible component captures and touch-emulation check; not a real-device test.
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path');
const base='http://127.0.0.1:18185/official/';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await context.addInitScript(()=>localStorage.setItem('yx-official-motion','off'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/world');
  await page.locator('[data-world="outfit"][data-value="1"]').tap();
  if(!await page.locator('.room-avatar .outfit-1').count())throw new Error('Touch outfit selection failed');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  const scene=await page.locator('.room-perspective').boundingBox(),cdp=await context.newCDPSession(page);
  const x=scene.x+scene.width*.5,y=scene.y+scene.height*.58;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let n=1;n<=6;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-n*22}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(180);
  const verticalScroll=await page.evaluate(()=>scrollY);
  if(verticalScroll<50)throw new Error('Vertical touch scroll blocked by scene');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  const next=await page.locator('.room-perspective').boundingBox(),tx=next.x+next.width*.3,ty=next.y+next.height*.5;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
  for(let n=1;n<=5;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+n*12,y:ty}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const angle=await page.locator('.room-perspective').evaluate(e=>parseFloat(e.style.getPropertyValue('--room-angle')));
  if(!angle)throw new Error('Horizontal touch drag did not rotate');
  await fs.writeFile(path.join(__dirname,'touch-check.json'),JSON.stringify({classification:'chromium-touch-emulation-not-real-device',date:'2026-09-21',touchOutfitSelection:true,verticalScrollUnblocked:verticalScroll>50,horizontalSceneRotation:angle!==0,scriptErrors:errors},null,2)+'\n');
  await context.close();
  const shots=await browser.newPage({viewport:{width:1440,height:1000}});
  await shots.addInitScript(()=>localStorage.setItem('yx-official-motion','off'));
  await shots.goto(base+'#/world');
  for(const theme of ['light','dark']){
   if(await shots.locator('html').getAttribute('data-theme')!==theme)await shots.locator('[data-action="theme"]').click();
   await shots.setViewportSize({width:1440,height:1400});await shots.locator('#world-tab-room').click();
   await shots.locator('#header').evaluate(e=>e.style.visibility='hidden');
   await fs.writeFile(path.join(__dirname,'screenshots',`desktop-world-panel-${theme}.png`),await shots.locator('.world-widget').screenshot());
   await shots.setViewportSize({width:390,height:1400});
   for(const tab of ['room','game','wall']){
    await shots.locator('#world-tab-'+tab).click();
    await fs.writeFile(path.join(__dirname,'screenshots',`world-${tab}-panel-${theme}.png`),await shots.locator('.world-widget').screenshot());
   }
   await shots.locator('#header').evaluate(e=>e.style.visibility='');
  }
  for(const [file,prefix] of [['overview.html','mobile-overview'],['world-overview.html','world-overview']]){
   await shots.setViewportSize({width:1334,height:1400});await shots.goto(base+file);
   for(const theme of ['light','dark']){
    await shots.locator(`[data-theme-choice="${theme}"]`).click();
    await shots.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    const box=await shots.locator('.mobiles').boundingBox();
    await fs.writeFile(path.join(__dirname,'screenshots',`${prefix}-${theme}.png`),await shots.screenshot({clip:{x:0,y:0,width:1334,height:Math.ceil(box.y+box.height+32)}}));
   }
   await shots.setViewportSize({width:390,height:844});
   if(await shots.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(file+' mobile overflow');
  }
  if(errors.length)throw new Error(JSON.stringify(errors));
  console.log('PASS: mobile touch selection, native vertical scroll, horizontal scene drag; both galleries and component captures.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
