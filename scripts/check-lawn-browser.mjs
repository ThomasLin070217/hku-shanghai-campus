import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {recordLawn} from './lawn-recording.mjs';

// Run against a local development/review build. Read-only telemetry guides real keyboard input.
const origin=process.env.CAMPUS_URL??'http://127.0.0.1:5184';
const pair=(process.env.LAWN_PAIR??'stun,ghost').split(',');
const useModel=process.env.LAWN_MODEL==='1';
const prompts={
  stun:'请帮我写一个保护程序，让机械狮子的运动系统暂时停下来三秒，然后恢复，避免损伤硬件。',
  lure:'暂时借用旁边的小机器人，让它跑向右侧引开守卫，把防御锁旁边的位置腾给我。',
  ghost:'在草地上投放一个不存在的电子身份，让巡逻守卫误以为那里有入侵者，转向那个信号。',
};
const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL??'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.routeWebSocket('**/*',socket=>{
    if(new URL(socket.url()).host!==new URL(origin).host)socket.connectToServer();
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(!useModel)await context.addInitScript(()=>localStorage.setItem('hku.opening.agent.offline','1'));
  const stopRecording=await recordLawn(page,process.env.LAWN_DEMO_VIDEO);
  await page.goto(new URL('?experience=lion-boss&quality=low',origin).href,{waitUntil:'domcontentloaded'});
  const snap=()=>page.evaluate(()=>window.__LION_BOSS.snapshot());
  const pause=ms=>page.waitForTimeout(ms);
  const start=page.locator('#boss-start'),wb=name=>page.locator('[data-wb="'+name+'"]');
  const keys=new Set();
  async function move(list){
    const next=new Set(list);
    for(const k of keys)if(!next.has(k)){await page.keyboard.up(k);keys.delete(k);}
    for(const k of next)if(!keys.has(k)){await page.keyboard.down(k);keys.add(k);}
  }
  async function walk(to,radius=.65){
    const end=Date.now()+18000;
    while(Date.now()<end){
      const s=await snap(),dx=to.x-s.player[0],dz=to.z-s.player[2],d=Math.hypot(dx,dz);
      if(d<=radius||(s.leg==='prepare'&&Math.hypot(to.x-s.safe.x,to.z-s.safe.z)<.01)){await move([]);return;}
      const f=-Math.sin(s.yaw)*dx-Math.cos(s.yaw)*dz,r=Math.cos(s.yaw)*dx-Math.sin(s.yaw)*dz;
      const next=[];
      if(Math.abs(f)>.36*d)next.push(f>0?'w':'s');
      if(Math.abs(r)>.36*d)next.push(r>0?'d':'a');
      if(d>2.5)next.push('Shift');
      await move(next);await pause(65);
    }
    await move([]);throw Error('Could not reach '+JSON.stringify(to)+' from '+JSON.stringify((await snap()).player));
  }
  await start.waitFor();await start.click();
  let s=await snap();await walk(s.trigger,1.5);await page.waitForFunction(()=>window.__LION_BOSS.snapshot().combat.awakened);
  await pause(2700);await walk(s.safe,.95);await page.keyboard.press('c');
  await page.locator('[data-launch-mission]').click();
  for(const id of pair){
    await page.locator('[data-slot="'+id+'"]').click();await wb('input').fill(prompts[id]);
    await pause(650);await wb(useModel?'generate':'preset').click();
    await page.waitForFunction(()=>!document.querySelector('[data-wb=test]').disabled||
      document.querySelector('[data-wb=status]').classList.contains('vc-error'),null,{timeout:45000});
    assert.equal(await wb('test').isDisabled(),false,await wb('status').textContent());
    await pause(650);await wb('test').click();
    await page.waitForFunction(()=>!document.querySelector('[data-wb=deploy]').disabled);
    await pause(600);await wb('deploy').click();
    await page.waitForFunction(()=>document.querySelector('[data-wb=deploy]').disabled&&document.querySelector('[data-wb=deploy]').textContent.includes('已部署'));
    await pause(600);
    const loaded=await snap();
    assert.ok(loaded.equipped[id],id+' was not equipped after compilation');
  }
  console.log('Compiled',pair,useModel?'model':'offline');
  await wb('close').click();await page.locator('[data-mac-sleep]').click();await start.click();
  s=await snap();const stageNodes=s.nodes;
  assert.equal(stageNodes.length,3);
  // Walk round the lion's physical body along the east side between service stations.
  for(let i=0;i<3;i++){
    if(i===1)await walk({x:stageNodes[1].x+1,z:stageNodes[0].z},1);
    if(i===2)await walk({x:stageNodes[1].x+1,z:stageNodes[2].z},1);
    await walk(stageNodes[i],1.3);
    const until=Date.now()+55000;let hold=false;
    while(Date.now()<until){
      s=await snap();if(s.combat.repaired>i)break;
      if(Math.hypot(s.player[0]-stageNodes[i].x,s.player[2]-stageNodes[i].z)>1.8)await walk(stageNodes[i],1.2);
      const open=['stunned','helperRun','lured','ghosted'].includes(s.combat.phase);
      if(open&&!hold){await page.keyboard.down('f');hold=true;}
      if(!open){
        if(hold){await page.keyboard.up('f');hold=false;}
        for(const slot of [i%2,(i+1)%2]){
          if(s.combat.cooldown[pair[slot]]<=0){
            await page.keyboard.press(slot?'r':'q');
            if((await snap()).combat.cooldown[pair[slot]]>0)break;
          }
        }
      }
      await pause(90);
    }
    await page.keyboard.up('f');s=await snap();assert.equal(s.combat.repaired,i+1);console.log('Committed',stageNodes[i].id,s.hearts);
  }
  await pause(2200);assert.equal((await snap()).combat.phase,'complete');
  const next=page.locator('a[href*="experience=sports-hall"]').filter({hasText:/体育馆/}).first();
  await next.click();await page.getByRole('button',{name:'开始营救'}).waitFor();await pause(900);
  assert.deepEqual(errors,[]);await stopRecording();
  console.log('PASS browser: awakening, preparation, two deployments, three held operations, shutdown, rescue');
}finally{await browser.close();}
