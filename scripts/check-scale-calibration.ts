import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {SCALE_CALIBRATION as SC,CALIBRATED_LAYOUT as CL} from '../src/model/scaleCalibration';
import {VIDEO_DETAILS as V} from '../src/model/videoDetailsParameters';
import {buildSite} from '../src/model/buildSite';
import {createNavigation} from '../src/exploration/navigation';
import {CampusGame} from '../src/exploration/game';
import {CharacterPhysics} from '../src/exploration/physics';
import {EXPLORATION as C} from '../src/exploration/config';
const b=(id:string)=>BUILDINGS.find(b=>b.id===id)!;
const readings=JSON.parse(readFileSync('references/scale-calibration/measurements.json','utf8')).measurements;
const values=[b('B04').width,b('B04').depth,b('B03').width,b('B03').z-b('B04').z,b('B05').width,b('B05').x-b('B07').x,b('B07').width,SITE.width];
const measured=readings.map((r:any,i:number)=>{assert.ok(Math.abs(values[i]-r.metres)<=r.practicalUncertaintyMetres,`${r.id} exceeds measurement tolerance`);return {id:r.id,ruler:r.metres,model:values[i],withinTolerance:true};});
const nav=createNavigation(BUILDINGS,SITE),asset=buildSite(),game=new CampusGame(nav,BUILDINGS);
for(const spec of BUILDINGS){assert.equal(asset.byId.get(spec.id)!.position.x,spec.x);assert.ok(nav.contacts(spec.x,spec.z,0).some(o=>o.name.startsWith(spec.id+'/')));}
assert.equal(asset.root.getObjectByName('Oculus_Pavilion')!.position.x,CL.westWalkX);
assert.ok(nav.obstacles.some(o=>o.name==='oculus-column'&&o.x===CL.westWalkX-5));
assert.ok(!nav.blocked(game.body.position.x,game.body.position.z,game.body.position.y));
assert.equal(game.body.position.x,b('B04').x);
// The moved west wall blocks at its new location; the vacated strip is now usable.
assert.ok(nav.contacts(-86,10,0).some(o=>o.name.startsWith('B01/')));
assert.ok(!nav.contacts(-24,10,0).some(o=>o.name.startsWith('B01/')));
// Traverse the actual model's narrow east perimeter lane after spreading columns.
const walker=new CharacterPhysics(nav);const x=b('B04').x+b('B04').width/2+1.65;
walker.position.set(x,nav.support(x,30,0)!,30);
for(let i=0;i<120*22;i++)walker.step(C.fixedStep,{forward:1,right:0,sprint:false},0,false);
assert.ok(walker.position.z< -26.9,JSON.stringify(walker.position.toArray()));
assert.equal(C.height,1.8);assert.equal(C.speed,2.6);assert.equal(SC.globalScaleFactor,1);
assert.equal(game.observe().world.scaleCalibration?.id,SC.id);
const report={date:new Date().toISOString(),measured,buildingVisualCollisionSync:true,spawn:game.body.position.toArray(),vacatedStripPassable:true,newWallSolid:true,eastPerimeterLaneEnd:walker.position.toArray(),eastPromenadeX:V.promenade[0].x,verticalScaleUnverified:true};
writeFileSync('evidence/scale-calibration/checks.json',JSON.stringify(report,null,2));console.log(report);nav.dispose();
