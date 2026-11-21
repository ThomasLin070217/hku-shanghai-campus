import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSite} from '../src/model/buildSite';
import {compact,disposeAsset} from '../src/model/buildCampus';
import {sceneRegistry,validEntityQuery} from '../src/scene/registry';
import {createSceneService} from '../src/scene/service';
import {cloneBuildings,SITE} from '../src/model/campusParameters';
import {createNavigation} from '../src/exploration/navigation';
import {CampusGame} from '../src/exploration/game';
const a=buildSite(),r=sceneRegistry(a.root);assert.ok(r.entities.length>15000);assert.equal(r.byId.size,r.entities.length);
for(const id of ['B01','B02','B03','B04','B05','B06','B07','S001','S001-TEXT','L001','A004','B04-ENTRY',...Array.from({length:14},(_,i)=>'R'+String(i+1).padStart(3,'0'))])assert.ok(r.get(id),id);
let meshes=0,vertices=0;a.root.traverse(o=>{if(o instanceof T.Mesh){meshes++;const ranges=r.ranges.get(o)!;assert.ok(ranges?.length);assert.equal(ranges.reduce((s,p)=>s+p.count,0),o.geometry.index?.count??o.geometry.getAttribute('position').count);vertices+=ranges.reduce((s,p)=>s+p.count,0);for(const part of ranges){assert.equal(r.pick({object:o,faceIndex:part.start/3,distance:0,point:new T.Vector3()}),part.id);}}});
console.log(`PASS all ${meshes} render meshes / ${vertices/3} triangles map to ${r.entities.length} unique scene entities`);
const specs=cloneBuildings().reverse();specs.find(b=>b.id==='B04')!.height+=2;const b=buildSite(specs),changed=sceneRegistry(b.root);assert.deepEqual(changed.entities.map(e=>e.id),r.entities.map(e=>e.id));assert.notEqual(changed.revision,r.revision);assert.equal(changed.get('B04')!.size[1]-r.get('B04')!.size[1],2);
console.log('PASS IDs survive building reorder and height changes; revision detects geometry change');
const sample=new T.Group();sample.name='sample';const material=new T.MeshStandardMaterial();for(let i=0;i<3;i++){const mesh=new T.Mesh(new T.BoxGeometry(1,1,1),material);mesh.name='post';mesh.position.x=i*3;sample.add(mesh);}compact(sample);const sr=sceneRegistry(sample);assert.equal(sample.children.length,1);const rays=new T.Raycaster();for(let i=0;i<3;i++){rays.set(new T.Vector3(i*3,0,5),new T.Vector3(0,0,-1));const hit=rays.intersectObject(sample,true)[0],id=sr.pick(hit)!;assert.equal(sr.get(id)!.center[0],i*3);}
console.log('PASS actual triangle picking distinguishes three posts after merging to one mesh');
assert.equal(r.query({kind:'building'}).total,7);assert.equal(r.query({kind:'road'}).total,14);assert.equal(r.query({q:'monument',kind:'area'}).total,2);assert.equal(validEntityQuery({limit:101}),false);assert.equal(validEntityQuery({near:[NaN,0,0]}),false);assert.equal(validEntityQuery({offset:-1}),false);assert.equal(validEntityQuery({kind:'road',limit:10}),true);
const nav=createNavigation(cloneBuildings(),SITE),g=new CampusGame(nav,cloneBuildings());let selected='';const service=createSceneService(()=>a.root,()=>g,id=>selected=id);
assert.equal(service('entity',{id:'S001'}).ok,true);assert.equal(service('entity',{id:'missing'}).ok,false);assert.equal(service('selectEntity',{id:'S001',controlEpoch:g.epoch,sceneRevision:r.revision}).ok,false);
g.enableAI();g.acquireControl('scene-test');const epoch=g.epoch;assert.equal(service('selectEntity',{id:'S001',controlEpoch:epoch,sceneRevision:'stale'}).ok,false);assert.equal(service('selectEntity',{id:'S001',controlEpoch:epoch,sceneRevision:r.revision}).ok,true);assert.equal(selected,'S001');const position=g.body.position.toArray();g.takeover();assert.equal(service('selectEntity',{id:'R001',controlEpoch:epoch,sceneRevision:r.revision}).ok,false);assert.deepEqual(g.body.position.toArray(),position);
console.log('PASS entity discovery, source routing, query limits, selection grant/revision checks and human revocation');
for(const root of [a.root,b.root,sample])disposeAsset(root);nav.dispose();

assert.ok(r.entities.filter(e=>e.name==='Observed_gate_body').every(e=>e.sourceFile==='src/model/observedInteriors.ts'));
