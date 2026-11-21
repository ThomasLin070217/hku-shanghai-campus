import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {recordLawn} from './lawn-recording.mjs';

// Run against a local development/review build. Read-only telemetry guides real keyboard input.
const origin=process.env.CAMPUS_URL??'http://127.0.0.1:5184';
const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL??'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try {
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const stopRecording=await recordLawn(page,process.env.LAWN_DEMO_VIDEO);
  await page.goto(new URL('?experience=lion-boss&quality=low',origin).href,{waitUntil:'domcontentloaded'});
  const snap=()=>page.evaluate(()=>window.__LION_BOSS.snapshot());
  const next=page.locator('#boss-next');
  await page.locator('#boss-start').click();
  const node=(await snap()).nodes[0];
  const keys=new Set();
  async function move(list){
    for(const key of keys)if(!list.includes(key)){await page.keyboard.up(key);keys.delete(key);}
    for(const key of list)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}
  }
  const deadline=Date.now()+45000;
  let casts=0,holding=false;
  while(Date.now()<deadline){
    const state=await snap();
    if(state.combat.phase==='complete')break;
    const dx=node.x-state.player[0],dz=node.z-state.player[2],distance=Math.hypot(dx,dz);
    if(!casts&&state.combat.phase==='chargeWarn'){
      await page.keyboard.press('q');
      casts++;
    }
    const directions=[];
    if(distance>1.7){
      const forward=-Math.sin(state.yaw)*dx-Math.cos(state.yaw)*dz;
      const right=Math.cos(state.yaw)*dx-Math.sin(state.yaw)*dz;
      if(Math.abs(forward)>.36*distance)directions.push(forward>0?'w':'s');
      if(Math.abs(right)>.36*distance)directions.push(right>0?'d':'a');
    }
    await move(directions);
    if(state.combat.phase==='stunned'&&distance<=1.7&&!holding){
      await page.keyboard.down('f');holding=true;
    }
    await page.waitForTimeout(40);
  }
  await move([]);
  if(holding)await page.keyboard.up('f');
  assert.equal(casts,1);
  assert.equal((await snap()).combat.phase,'complete');
  await next.waitFor();
  assert.match(await next.textContent(),/Rescue the students/);
  await page.reload({waitUntil:'domcontentloaded'});
  await next.waitFor();
  await next.click();
  await page.locator('#enter-game').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('experience'),'sports-hall');
  assert.match(await page.locator('.pause-card p').first().textContent(),/Core power is cut/);
  assert.deepEqual(errors,[]);
  await stopRecording();
  console.log('PASS one Q and F shutdown, saved completion and Sports Hall Rescue handoff');
} finally {
  await browser.close();
}
