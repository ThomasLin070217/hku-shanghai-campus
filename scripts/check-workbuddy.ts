import assert from 'node:assert/strict';
import * as T from 'three';
import {disposeAsset} from '../src/model/buildCampus';
import {CampusGame} from '../src/exploration/game';
import {createNavigation} from '../src/exploration/navigation';
import {cloneBuildings,SITE} from '../src/model/campusParameters';
import {captureSave,restoreSave,DEFAULT_SETTINGS} from '../src/gameplay/save';
import {drawCampusMap} from '../src/gameplay/map';
import {createCanvas} from '@napi-rs/canvas';
import {writeFileSync} from 'node:fs';

const checks:string[]=[];
function check(name:string,fn:()=>void){fn();checks.push(name);console.log('PASS',name);}
check('Line/Points/Sprite resources released once; retained materials/textures survive subtree removal',()=>{
 const discard=new T.Group(),keep=new T.Group(),texture=new T.Texture(),shared=new T.MeshBasicMaterial({map:texture});
 const geometry=new T.BoxGeometry(),lineMat=new T.LineBasicMaterial(),pointsMat=new T.PointsMaterial(),spriteMat=new T.SpriteMaterial();
 discard.add(new T.LineSegments(geometry,lineMat),new T.Points(geometry,pointsMat),new T.Sprite(spriteMat),new T.Mesh(new T.BoxGeometry(),shared));
 keep.add(new T.Mesh(new T.BoxGeometry(),shared));
 const calls=new Map<unknown,number>();for(const r of [geometry,lineMat,pointsMat,spriteMat,shared,texture])r.addEventListener('dispose',()=>calls.set(r,(calls.get(r)||0)+1));
 disposeAsset(discard,keep);for(const r of [geometry,lineMat,pointsMat,spriteMat])assert.equal(calls.get(r),1);assert.equal(calls.get(shared),undefined);assert.equal(calls.get(texture),undefined);disposeAsset(keep);assert.equal(calls.get(shared),1);assert.equal(calls.get(texture),1);
});
const specs=cloneBuildings(),world=createNavigation(specs,{...SITE}),game=new CampusGame(world,specs,{...SITE});
check('Landmarks reuse identity/support results; paused observe performs no target query',()=>{
 const first=game.survey.landmarks;let supportCalls=0,targetCalls=0;const support=world.support,target=game.survey.target;
 world.support=(...args)=>{supportCalls++;return support(...args);};game.survey.target=()=>{targetCalls++;return target.call(game.survey);};
 for(let i=0;i<120;i++){assert.equal(game.survey.landmarks,first);game.survey.snapshot();}
 assert.equal(supportCalls,0);assert.equal(targetCalls,0);world.support=support;game.survey.target=target;
});
check('Saving avoids observe; world revision mismatch preserves progress and resets position safely',()=>{
 game.observe=()=>{throw Error('Save must not call observe');};game.survey.progress.collected=['clue-learning'];
 const saved=captureSave(game,DEFAULT_SETTINGS);saved.worldRevision='older-world';saved.position=[-30,0,80];
 assert.equal(restoreSave(game,saved).recoveredPosition,true);assert.deepEqual(game.survey.progress.collected,['clue-learning']);assert.equal(game.owner,null);
});
check('Rebuild preserves frame/history and invalidates AI epoch; stale commands stay rejected',()=>{
 game.enableAI();game.acquireControl('review');const epoch=game.epoch;
 game.act({commandId:'rebuild-in-flight',controlEpoch:epoch,durationMs:1000,move:{forward:1,right:0}},0);game.step(1/120,1);
 const frame=game.frame,time=game.timeMs,oldLandmarks=game.survey.landmarks;
 const nextSpecs=cloneBuildings();nextSpecs.find(b=>b.id==='B04')!.x+=2;const next=createNavigation(nextSpecs,{...SITE});game.replaceWorld(next,nextSpecs,{...SITE});
 assert.equal(game.records.get('rebuild-in-flight')?.status,'interrupted');assert.equal(game.records.get('rebuild-in-flight')?.reason,'world_rebuilt');assert.ok(game.epoch>epoch);assert.equal(game.frame,frame);assert.equal(game.timeMs,time);assert.notEqual(game.survey.landmarks,oldLandmarks);
 assert.equal(game.act({commandId:'stale',controlEpoch:epoch,durationMs:100}).error,'stale_epoch');assert.deepEqual(game.survey.progress.collected,['clue-learning']);next.dispose();
});
check('Map entry path is identical with B04 moved to another array index',()=>{
 const a=createCanvas(240,280),b=createCanvas(240,280);game.buildings=specs;drawCampusMap(a as unknown as HTMLCanvasElement,game);game.buildings=[...specs].reverse();drawCampusMap(b as unknown as HTMLCanvasElement,game);assert.ok(a.toBuffer('image/png').equals(b.toBuffer('image/png')));
});
world.dispose();
writeFileSync('evidence/workbuddy-review/logic-checks.json',JSON.stringify({date:new Date().toISOString(),checks},null,2));
