import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSite} from '../src/model/buildSite';
import {sceneRegistry} from '../src/scene/registry';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {SPORTS_DOOR,SPORTS_HALL,sportsDoorWorld} from '../src/model/sportsDoor';
import {SPORTS_HALL_PUZZLE,checkCode,checkPassword,parseSudoku,solvedRows} from '../src/gameplay/sudokuPuzzle';
import {disposeAsset} from '../src/model/buildCampus';
import {CROWD,createStudentCrowd,crowdPlacements,crowdVariants} from '../src/gameplay/studentCrowd';
import {createCharacter} from '../src/characters/character';
import {STUDENT} from '../src/characters/config';

const asset=buildSite(),registry=sceneRegistry(asset.root),nav=createNavigation(BUILDINGS,SITE),centre=sportsDoorWorld(SITE.sportsZ);

// The hall is a basketball hall: a court slab with markings and two hoops inside.
const court=asset.root.getObjectByName('Basketball_Court');assert.ok(court,'basketball court exists');
const courtParts:string[]=[];court!.traverse(o=>{if(o instanceof T.Mesh)courtParts.push(o.name);});
const floorMesh=court!.getObjectByName('Court_floor') as T.Mesh;assert.ok(floorMesh,'court floor');
const floorBox=new T.Box3().setFromObject(floorMesh);
assert.ok(Math.abs(floorBox.max.y-SPORTS_HALL.floorTop)<.01,'court floor sits on the hall floor');
assert.ok(Math.abs(floorBox.getSize(new T.Vector3()).x-28.8)<.01&&Math.abs(floorBox.getSize(new T.Vector3()).z-15.8)<.01,'court is 28.8 × 15.8 m');
const lineParts=(floorMesh.parent!.getObjectByName('Basketball_Court__Ivory signage') as T.Mesh)?.userData.authorParts as unknown[]|undefined;
assert.ok(lineParts&&lineParts.length>80,`court markings are modelled (${lineParts?.length??0} line parts)`);
assert.ok(courtParts.some(n=>n.includes('Mullion')),'two hoops with rims and poles');
for(const end of [-1,1])assert.ok(nav.obstacles.some(o=>o.name==='basketball-hoop'&&Math.abs(o.x-(SPORTS_HALL.x+end*14.55))<.01),'hoop poles are solid');
// The doorway itself must stay clear of the court furniture.
assert.equal(nav.blocked(centre.x,centre.z,SPORTS_HALL.floorTop),true,'door still blocks when closed');
// The door is modelled, indexed and animated, and the visual opening matches the collision gap.
const door=asset.root.getObjectByName(SPORTS_DOOR.name);assert.ok(door,'east door group exists');
const leaves=[door!.getObjectByName('Leaf_Left'),door!.getObjectByName('Leaf_Right')];assert.ok(leaves.every(Boolean),'two hinged leaves');
assert.ok(door!.getObjectByName('Night_door_lock_led') instanceof T.Mesh,'lock indicator exists');
const entity=registry.entities.find(e=>e.name.includes('体育馆东门'));assert.ok(entity,'door is in the scene index');
assert.equal(nav.blocked(centre.x,centre.z,0),true,'closed door blocks the opening');
nav.setDoorOpen(SPORTS_DOOR.id,true);
assert.equal(nav.blocked(centre.x,centre.z,0),false,'open door lets the player through');
assert.equal(nav.blocked(centre.x+3,centre.z,0),false,'approach from the east is clear');
assert.equal(nav.blocked(centre.x,centre.z+6,0),true,'east wall stays solid beside the door');
assert.equal(nav.blocked(SPORTS_HALL.x-SPORTS_HALL.eastX,centre.z,0),true,'west wall stays solid');
assert.equal(nav.support(centre.x-3,centre.z,0),SPORTS_HALL.floorTop,'inside floor is walkable');
nav.setDoorOpen(SPORTS_DOOR.id,false);
assert.equal(nav.blocked(centre.x,centre.z,0),true,'the lock can close again');

// The sudoku is a legal grid with exactly four blanks, and its row-major read is the door code.
const puzzle=SPORTS_HALL_PUZZLE,rows=solvedRows(puzzle);
assert.equal(puzzle.blanks.length,4,'exactly four blanks');
assert.deepEqual(puzzle.blanks.map(b=>[b.row,b.col]),[[0,0],[2,7],[7,2],[8,8]],'blank positions');
assert.equal(rows.map(row=>[...row].filter(d=>'123456789'.includes(d)).sort().join('')).every(r=>r==='123456789'),true,'rows are 1–9');
for(let c=0;c<9;c++)assert.equal(rows.map(r=>r[c]).sort().join(''),'123456789',`column ${c+1}`);
for(let b=0;b<9;b++){const values=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)values.push(rows[(b/3|0)*3+i][(b%3)*3+j]);assert.equal(values.sort().join(''),'123456789',`box ${b+1}`);}
assert.equal(puzzle.answer,'1911','door code');
assert.equal(checkCode(puzzle,['1','9','1','1']),true,'correct code unlocks');
for(const wrong of [['1','9','1','2'],['1','1','9','1'],['1','9','1',''],['','','',''],['0','9','1','1']])assert.equal(checkCode(puzzle,wrong),false,`reject ${wrong.join('')}`);
const pw=puzzle.password;assert.equal(pw.length,4,'password length');assert.equal(pw.answer,'1911','password answer');
assert.equal(checkPassword(puzzle,'1911'),true,'correct password unlocks');
assert.equal(checkPassword(puzzle,['1','9','1','1']),true,'digit slots match the code');
for(const wrongPassword of ['1912','191','19110','','0000'])assert.equal(checkPassword(puzzle,wrongPassword),false,`reject password ${wrongPassword||'(empty)'}`);
const base={id:'t',doorId:SPORTS_DOOR.id,type:'sudoku',title:'t',size:9,rows:puzzle.rows,answer:'1911',lead:'l',hint:'h',failure:'f',success:'s',password:pw};
assert.throws(()=>parseSudoku({...base,answer:'1912'}),/重复/,'an answer that breaks the grid is rejected');
assert.throws(()=>parseSudoku({...base,rows:['*','*','*','*','*','*','*','*','*'],answer:'1911'}),/空格数量|行/, 'malformed rows are rejected');
assert.throws(()=>parseSudoku({...base,size:8}),/size/,'wrong size is rejected');
assert.throws(()=>parseSudoku({...base,password:{...pw,answer:'191'}}),/password.answer/,'short password is rejected');
assert.throws(()=>parseSudoku({...base,password:{...pw,length:5}}),/password.answer/,'password length must match');

// The crowd inside the hall: exactly 100 students, all on the floor, none in the walls or the aisle.
const placements=crowdPlacements(),variants=crowdVariants();assert.equal(placements.length,100,'100 students');
const crowd=createStudentCrowd(placements,variants);
// Cast: half female with long hair, one fifth international across several skin tones.
const female=variants.filter(v=>v.female).reduce((n,v)=>n+v.count,0),international=variants.filter(v=>v.international).reduce((n,v)=>n+v.count,0);
assert.equal(variants.reduce((n,v)=>n+v.count,0),100,'variant counts add up');
assert.equal(female,50,'half the crowd is female');
assert.equal(international,20,'one fifth is international');
assert.ok(variants.filter(v=>v.female).every(v=>v.appearance.hairStyle==='long'),'female students use long hair');
assert.ok(new Set(variants.filter(v=>v.international).map(v=>v.appearance.skin)).size>=3,'at least three international skin tones');
assert.ok(new Set(variants.map(v=>v.appearance.skin)).size>=5,'crowd mixes domestic and international skin tones');
const innerX=SPORTS_HALL.width/2-.35,innerZ=SPORTS_HALL.depth/2-.35;
for(const p of placements){
 assert.ok(Math.abs(p.x-SPORTS_HALL.x)<innerX,`student x ${p.x} inside the hall`);
 assert.ok(Math.abs(p.z-SITE.sportsZ)<innerZ,`student z ${p.z} inside the hall`);
 assert.ok(Math.hypot(p.x-(SPORTS_HALL.x+SPORTS_HALL.eastX),p.z-SITE.sportsZ)>2.5,'doorway approach stays clear');
 assert.ok(p.scale>=.9&&p.scale<=1.1,'scale stays near the protagonist');
 assert.ok(Math.abs(p.yaw-CROWD.yaw)<.9,'students keep roughly facing the door');
}
assert.equal(crowd.count,100,'crowd reports 100');
assert.ok(crowd.meshes.every(m=>m.isInstancedMesh),'every crowd mesh is instanced');
assert.equal(crowd.meshes.reduce((n,m)=>n+m.count,0),100*2,'each student is drawn twice: atlas body plus flat-colour parts');
assert.ok(crowd.meshes.length<=20,`instancing keeps draw calls low (${crowd.meshes.length})`);
assert.ok(crowd.triangles<40000,`crowd triangles stay small (${crowd.triangles})`);
// Scatter: no two students overlap, and the crowd fills the hall instead of sitting in a grid.
let closest=Infinity;for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)closest=Math.min(closest,Math.hypot(placements[i].x-placements[j].x,placements[i].z-placements[j].z));
assert.ok(closest>1.0,`students do not overlap (closest ${closest.toFixed(2)} m)`);
assert.ok(new Set(placements.map(p=>p.x.toFixed(2))).size>90,'positions are scattered, not on a grid');
// The twelve students closest to the door must be the long-haired ones.
const doorX=SPORTS_HALL.x+SPORTS_HALL.eastX,doorZ=SITE.sportsZ;
const nearest=placements.map((p,i)=>({i,d:Math.hypot(p.x-doorX,p.z-doorZ)})).sort((a,b)=>a.d-b.d).slice(0,12);
for(const seat of nearest){const variant=crowd.seatOf.get(seat.i);assert.ok(variant&&variant.female,`seat ${seat.i} at ${seat.d.toFixed(2)} m is a long-haired student`);}
// The long-hair geometry must read as hair: more parts, deeper silhouette, shorter body.
const flatOf=(key:string)=>crowd.meshes.find(m=>m.name.includes(`__${key}__`)&&m.name.endsWith('flat'))!;
const boundsOf=(key:string)=>{const g=flatOf(key).geometry;return{verts:g.getAttribute('position').count,box:new T.Box3().setFromBufferAttribute(g.getAttribute('position') as T.BufferAttribute)};};
const maleBounds=boundsOf('cn-man'),femaleBounds=boundsOf('cn-woman');
const maleSize=maleBounds.box.getSize(new T.Vector3()),femaleSize=femaleBounds.box.getSize(new T.Vector3());
assert.ok(femaleBounds.verts>=maleBounds.verts+200,`long hair adds geometry (${maleBounds.verts} → ${femaleBounds.verts} vertices)`);
assert.ok(femaleSize.z>maleSize.z+.05,`long hair deepens the silhouette (${maleSize.z.toFixed(2)} → ${femaleSize.z.toFixed(2)} m)`);
assert.ok(femaleSize.y<maleSize.y,`female students are shorter (${maleSize.y.toFixed(2)} → ${femaleSize.y.toFixed(2)} m)`);
// Clothes vary by variant, and female students get a narrower face.
assert.ok(new Set(variants.map(v=>v.appearance.coat)).size>=6,`gowns use several colours (${new Set(variants.map(v=>v.appearance.coat)).size})`);
assert.ok(variants.filter(v=>v.female).every(v=>(v.appearance.faceWidth??1)<=.9),'female students have a narrower face');
{
 const maleHead=createCharacter(STUDENT).root.getObjectByName('head')!,femaleHead=createCharacter(variants.find(v=>v.female)!.appearance).root.getObjectByName('head')!;
 assert.ok(femaleHead.scale.x<maleHead.scale.x*.9,`narrower face is applied to the rig (${maleHead.scale.x.toFixed(3)} → ${femaleHead.scale.x.toFixed(3)})`);
}
assert.ok(crowd.meshes.every(m=>!!m.instanceColor),'every student carries a per-instance tint');
// The atlas must hold each variant's own head texture, so every face shows the right skin.
const atlas=crowd.atlasInfo;
for(const variant of variants){
 const slot=atlas.slots.get(`${variant.appearance.id}/head`);
 assert.ok(slot!==undefined,`head texture packed for ${variant.key}`);
 const skin=variant.appearance.skin,rgb=[(skin>>16)&255,(skin>>8)&255,skin&255];
 let matches=0;
 for(let row=slot*16;row<slot*16+16;row++)for(let x=0;x<atlas.width;x++){
  const o=(row*atlas.width+x)*4;if(Math.abs(atlas.data[o]-rgb[0])<9&&Math.abs(atlas.data[o+1]-rgb[1])<9&&Math.abs(atlas.data[o+2]-rgb[2])<9)matches++;
 }
 assert.ok(matches>100,`${variant.key} head texture carries its skin tone (${matches} texels)`);
}
const drawCalls=crowd.meshes.length,crowdTriangles=crowd.triangles;
const first=crowd.meshes[0].instanceMatrix.array;
assert.ok(Math.abs(first[13]-SPORTS_HALL.floorTop)<1e-4,'students stand on the hall floor');
const matrix=new T.Matrix4();crowd.meshes[0].getMatrixAt(0,matrix);const euler=new T.Euler().setFromRotationMatrix(matrix);
assert.ok(Math.abs(euler.y-CROWD.yaw)<.9,'instances keep the authored facing');
crowd.dispose();
console.log('PASS east door geometry/碰撞门洞一致, 可开关; sudoku 4 blanks → 1911; 第二道 4 位密码 1911, 错误/残缺密码被拒绝; 馆内 100 名学生就位', {centre,sudoku:puzzle.answer,password:pw.answer,students:crowd.count,drawCalls,crowdTriangles,entities:registry.entities.length});
nav.dispose();disposeAsset(asset.root);
