/** ISOLATED DESIGN PROOF ONLY. Writes /tmp fixtures; does not modify production source or UI. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createNavigation} from '../../../src/exploration/navigation.ts';
import {BUILDINGS,SITE} from '../../../src/model/campusParameters.ts';
import {validateAction} from '../../../src/agent/protocol.ts';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const fixturePath=path.join(fs.mkdtempSync(path.join(tmpdir(),'thomas-opening-dispatch-')),'CampusGame.fixture.ts');
async function main(){
 const original=fs.readFileSync(path.join(repo,'src/exploration/game.ts'),'utf8');
 const oldCalls="if(a.interact!==undefined)r.operation=this.survey.interact(a.interact);if(a.computer)r.operation=this.survey.computer(a.computer);";
 assert.ok(original.includes(oldCalls),'fixture must match real baseline dispatch');
 let fixture=original.replace(/from '(\.\.?\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(path.resolve(repo,'src/exploration',p)));
 fixture=fixture.replace("from 'three'",'from '+JSON.stringify(path.join(repo,'node_modules/three/build/three.cjs')));
 fixture=fixture.replace('export class CampusGame {',`export class CampusGame {
 openingDispatch:((kind:string,value:string|undefined)=>any)|null=null;
 dispatchInteraction(id?:string){return this.openingDispatch?.('interact',id)??this.survey.interact(id);}
 dispatchComputer(page:'map'|'tasks'|'clues'|'submit'){return this.openingDispatch?.('computer',page)??this.survey.computer(page);}
 `);
 fixture=fixture.replace(oldCalls,"if(a.interact!==undefined){r.operation=this.dispatchInteraction(a.interact);if(this.paused)return;}if(a.computer){r.operation=this.dispatchComputer(a.computer);if(this.paused)return;}");
 fs.writeFileSync(fixturePath,fixture);
 const {CampusGame}=await import(pathToFileURL(fixturePath).href);
 const g=new CampusGame(createNavigation(BUILDINGS,SITE),BUILDINGS);
 const tests:any[]=[];const add=(name:string,extra:any={})=>tests.push({name,pass:true,...extra});
 let acquired=false;let acquisitions=0;let retries=0;const calls:string[]=[];
 // Scene-specific initialization only in this fixture; real implementation belongs in opening new-game setup.
 g.inventory.slots.fill(null);g.inventory.revision++;
 const checkpoint=g.body.position.toArray();
 g.openingDispatch=(kind:string,value:string|undefined)=>{
  calls.push(kind+':'+value);
  if(kind==='computer'&&value==='tasks'){
   if(!acquired)return{ok:false,code:'laptop_required',message:'Collect the laptop first.'};
   const index=g.inventory.slots.findIndex((s:any)=>s?.itemId==='macbook-air-13-silver');
   if(index<9)g.inventory.select(index);else g.inventory.move(index,g.inventory.selectedHotbar);
   g.openPanel('computer');return{ok:true,code:'opening_alert_opened',message:'Emergency alert.'};
  }
  if(kind==='interact'&&value==='opening-invitation'){
   g.openPanel('computer');return{ok:true,code:'invitation_opened',message:'High Table Dinner.'};
  }
  if(kind==='interact'&&value==='opening-laptop'){
   const existing=g.inventory.slots.find((s:any)=>s?.itemId==='macbook-air-13-silver');
   if(acquired||existing)return{ok:true,code:'already_acquired',message:'Laptop already collected.'};
   const free=g.inventory.slots.findIndex((s:any)=>s===null);
   if(free<0)return{ok:false,code:'inventory_full',message:'Make space first.'};
   g.inventory.slots[free]={itemId:'macbook-air-13-silver',instanceId:'opening-laptop-001',count:1};
   g.inventory.revision++;acquired=true;acquisitions++;return{ok:true,code:'laptop_acquired',message:'MacBook acquired.'};
  }
  if(kind==='interact'&&value==='opening-retry'){
   g.pause('opening_retry');g.body.position.fromArray(checkpoint);g.body.velocity.set(0,0,0);g.closePanel();retries++;
   return{ok:true,code:'retry_ready',message:'Ready to retry.'};
  }
  return null; // Preserve survey behavior for other modes/targets.
 };
 function arm(){if(g.panel)g.closePanel();g.enableAI();assert.ok(g.acquireControl('isolated-proof').ok);}
 function rpc(id:string,operation:any,now:number){const action={commandId:id,controlEpoch:g.epoch,durationMs:100,...operation};assert.equal(validateAction(action),true);assert.ok(g.act(action,now).ok);g.step(1/120,now+1);return action;}
 const human=g.dispatchInteraction('opening-invitation');assert.equal(human.code,'invitation_opened');assert.equal(g.panel,'computer');
 add('human-intent-uses-shared-dispatch');
 arm();const before=g.body.position.toArray(),epoch=g.epoch,frame=g.frame;
 const invite=rpc('rpc-invitation',{interact:'opening-invitation',move:{forward:1,right:0}},1000);
 assert.equal(g.last.operation.code,human.code);assert.deepEqual(g.body.position.toArray(),before);assert.equal(g.frame,frame);
 assert.equal(g.paused,true);assert.equal(g.owner,null);assert.equal(g.armed,false);assert.ok(g.epoch>epoch);
 assert.equal(g.act({...invite,commandId:'stale'},1002).ok,false);
 add('rpc-modal-same-route-revokes-control-and-stops-same-frame-movement',{positionBefore:before,positionAfter:g.body.position.toArray()});
 arm();const pickup=rpc('pickup',{interact:'opening-laptop'},2000);assert.equal(g.last.operation.code,'laptop_acquired');
 assert.ok(g.act(pickup,2002).duplicate);g.step(1/120,2003);
 rpc('pickup-again',{interact:'opening-laptop'},2100);assert.equal(g.last.operation.code,'already_acquired');
 assert.equal(g.dispatchInteraction('opening-laptop').code,'already_acquired');assert.equal(acquisitions,1);
 assert.equal(g.inventory.slots.filter((s:any)=>s?.itemId==='macbook-air-13-silver').length,1);
 add('human-and-rpc-repeated-pickup-exactly-one-instance-and-one-acquisition');
 arm();const beforeAlert=g.body.position.toArray();rpc('open-alert',{computer:'tasks',move:{forward:1,right:0}},3000);
 assert.equal(g.last.operation.code,'opening_alert_opened');assert.equal(g.panel,'computer');assert.equal(g.owner,null);assert.equal(g.paused,true);
 assert.deepEqual(g.body.position.toArray(),beforeAlert);assert.equal(g.inventory.equipped.itemId,'macbook-air-13-silver');
 add('existing-computer-tasks-field-maps-to-alert-without-new-RPC-fields');
 const instance=g.inventory.equipped.instanceId;assert.equal(g.dispatchInteraction('opening-retry').code,'retry_ready');
 assert.equal(acquired,true);assert.equal(retries,1);assert.deepEqual(g.body.position.toArray(),checkpoint);assert.equal(g.inventory.equipped.instanceId,instance);
 assert.equal(g.inventory.slots.filter(Boolean).length,1);assert.equal(g.paused,true);assert.equal(g.armed,false);
 add('human-retry-restores-checkpoint-retains-one-laptop-and-requires-explicit-resume');
 assert.equal(calls.filter(x=>x==='interact:opening-invitation').length,2);
 g.body.world.dispose();
 const result={scope:'isolated source-copy prototype; not production implementation or browser playthrough',baseline:'src/exploration/game.ts',fixture:fixturePath,productionFilesChanged:false,rpcSchemaChanged:false,tests,calls,limitations:['Range and line-of-sight authorization remain future production work.','DOM focus, pointer lock and scene-specific panel rendering are not browser-tested.','Retry uses the authorized checkpoint-restore path, not a public coordinate-write RPC.','AI authorization here applies only to an offline test instance; no browser control enabled.']};
 fs.writeFileSync(new URL('../dispatch-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
