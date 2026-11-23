import * as T from 'three';
import {B4_DOOR_LEAVES,B4_LAYOUT,B4_LOBBY,B4_OBSTACLES} from './b4Layout';
import {createB4FlipWall} from './b4FlipWall';

/**
 * Static B04 ground-floor shell, built with the opening world so B04 is never
 * hollow: floor, walls, ceiling, the timber tiers under the Keyboard Wall, the
 * supercomputer racks on a plinth, the lobby seating group and the closed
 * entrance door. Every structural box is a `B4_OBSTACLES` rect, so the scenery
 * and the collision come from one parameter object; the furniture is drawn from
 * `B4_LOBBY` and its collision rects are the same numbers. World coordinates;
 * DOM-free, and light-free: in Chapter 1 the room cannot glow by itself.
 */
export const B4_SHELL_NAME='B04_room_shell';
export const B4_RACK_LED='B4 rack status';
export const B4_RACK_BODY='B4 rack body';
export const B4_CEILING='B4 room ceiling';
const std=(name:string,color:number,emissive=0,intensity=0)=>{const m=new T.MeshStandardMaterial({name,color,roughness:.85,metalness:.05});if(emissive){m.emissive.setHex(emissive);m.emissiveIntensity=intensity;}return m;};
const SOURCE={sourceFile:'src/opening/b4Shell.ts',source:'B04 campaign rooms (src/opening/b4Layout.ts)',confidence:'provisional 2030 scenery; not a surveyed interior'};
// No authorKey here: repeated boxes (the rack status strips, the sofa modules) must get a
// unique `name#n` key from tagChildren, or compact() merges traces with duplicate keys.
function box(parent:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={...SOURCE};parent.add(mesh);return mesh;
}
function group(parent:T.Object3D,name:string){const g=new T.Group();g.name=name;g.userData={...SOURCE};parent.add(g);return g;}

export function buildB4Shell(){
 const root=new T.Group();root.name=B4_SHELL_NAME;root.userData={...SOURCE,authorKey:B4_SHELL_NAME,sceneLabel:'B04 ground floor (Keyboard Wall rooms)'};
 const R=B4_LAYOUT.room,F=R.floor;
 const mats={
  wall:std('B4 room wall',0xded8c9),ceiling:std(B4_CEILING,0xe6e2d8),floor:std('B4 room floor',0xcfc9bd),
  rack:std(B4_RACK_BODY,0x161b1f),plinth:std('B4 rack plinth',0x3b3f42),led:std(B4_RACK_LED,0x2f7d52,0x47e08a,.12),frame:std('B4 door frame',0x8fabae),
  tierTop:std('B4 timber tier tread',0x9a6f45),tierRiser:std('B4 timber tier riser',0x7c5735),
  sofa:std('B4 lobby sofa upholstery',0xe8e4da),rug:std('B4 lobby rug',0x2f5d52),rugRing:std('B4 lobby rug border',0xece5d4),
  stone:std('B4 lobby table stone',0xe9e2d2),timber:std('B4 lobby stool timber',0xb59167),
 };
 const shell=group(root,'B04_room_structure');
 box(shell,'B4_floor',R.x1-R.x0,R.floor,R.z1-R.z0,(R.x0+R.x1)/2,R.floor/2,(R.z0+R.z1)/2,mats.floor).castShadow=false;
 // Racks on a low plinth along the north wall. The plinth is inset 1 cm on the faces the room
 // can see (its south face and its two outer x faces): the rack bodies share those planes
 // otherwise, and the coplanar faces flicker in a 12 cm band at the base of the racks. The
 // collision rects are unchanged: the plinth is scenery, the racks are the obstacles.
 const racks=group(root,'B04_supercomputer_racks'),rx=B4_LAYOUT.rackX,rz=B4_LAYOUT.rackZ,plinthInset=.01;
 const plinthX0=Math.min(...rx.map(r=>r[0]))+plinthInset,plinthX1=Math.max(...rx.map(r=>r[1]))-plinthInset,plinthZ1=rz[1]-plinthInset;
 box(racks,'B4_rack_plinth',plinthX1-plinthX0,.12,plinthZ1-rz[0],(plinthX0+plinthX1)/2,F+.06,(rz[0]+plinthZ1)/2,mats.plinth);
 for(const r of B4_OBSTACLES){
  if(!r.render)continue;
  const x=(r.x0+r.x1)/2,z=(r.z0+r.z1)/2,w=r.x1-r.x0,d=r.z1-r.z0;
  if(r.render==='rack'){
   box(racks,r.name,w,r.top-r.bottom,d,x,(r.top+r.bottom)/2,z,mats.rack);
   // Status strips on the room-facing south face, 1 mm proud: on the west faces they read
   // edge-on through the 0.20 m gaps between the cabinets.
   for(let k=0;k<7;k++)box(racks,'B4_rack_status_strip',w-.2,.04,.02,x,r.bottom+.4+k*.27,r.z1+.011,mats.led);
   continue;
  }
  // A tier is a solid step built from two stacked materials. The riser stops 5 cm below
  // the step top; the tread overlaps it by 2 mm, tops out 2 mm proud of the collision top
  // and is 2 mm wider/deeper, so no riser and tread face is coplanar (coplanar faces flicker).
  if(r.render==='tier'){
   const tread=.05,proud=.002;
   box(shell,r.name,w,r.top-tread-r.bottom,d,x,(r.bottom+r.top-tread)/2,z,mats.tierRiser);
   box(shell,r.name+'_tread',w+2*proud,tread+2*proud,d+2*proud,x,r.top-tread/2,z,mats.tierTop);
   continue;
  }
  box(shell,r.name,w,r.top-r.bottom,d,x,(r.top+r.bottom)/2,z,mats[r.render]);
 }
 // Lobby seating group on the round rug, in front of the Keyboard Wall.
 const lobby=group(root,'B04_lobby_furniture'),L=B4_LOBBY;
 const rug=new T.Mesh(new T.CylinderGeometry(L.rug.r,L.rug.r,.012,44),mats.rug);
 rug.name='B4_lobby_rug';rug.position.set(L.rug.x,F+.006,L.rug.z);rug.receiveShadow=true;rug.userData={...SOURCE,authorKey:'B4_lobby_rug'};lobby.add(rug);
 // A ring, not a disc: a solid border disc would cover the teal rug it is meant to outline.
 // One millimetre above the rug's top face so the two surfaces do not share a plane.
 const ring=new T.Mesh(new T.RingGeometry(L.rug.r-.22,L.rug.r,48),mats.rugRing);
 ring.name='B4_lobby_rug_border';ring.rotation.x=-Math.PI/2;ring.position.set(L.rug.x,F+.013,L.rug.z);ring.receiveShadow=true;ring.userData={...SOURCE,authorKey:'B4_lobby_rug_border'};lobby.add(ring);
 // The curved sofa: modules on a circle, backs outward, the gap facing the room's north-west.
 // The module count comes from the layout object, the same one the collision rects use.
 const S=L.sofa,modules=S.modules,span=S.to-S.from;
 for(let i=0;i<modules;i++){
  const t=S.from+span*(i+.5)/modules,width=2*S.radius*Math.sin(span/(2*modules))+.03;
  const x=S.cx+S.radius*Math.cos(t),z=S.cz+S.radius*Math.sin(t);
  const seat=box(lobby,'B4_lobby_sofa_seat',width,S.seat,.72,x,F+S.seat/2,z,mats.sofa);seat.rotation.y=Math.PI/2-t;
  const back=box(lobby,'B4_lobby_sofa_back',width,.36,.16,S.cx+(S.radius+.28)*Math.cos(t),F+S.seat+.18,S.cz+(S.radius+.28)*Math.sin(t),mats.sofa);back.rotation.y=Math.PI/2-t;
 }
 for(const [i,c] of L.armchairs.entries()){
  const a=group(lobby,'B4_lobby_armchair_'+(i+1));a.position.set(c.x,F,c.z);a.rotation.y=i?Math.PI*.62:-Math.PI*.18;
  const seatH=L.armchairSize*.26,backH=L.armchairSize*.42;
  box(a,'B4_lobby_armchair_seat',L.armchairSize,seatH,L.armchairSize*.82,0,seatH/2,0,mats.sofa);
  // The back starts at the seat's top face: the old +0.3 m offset floated it 9.7 cm above the
  // seat. It then tilts -0.12 rad about its own centre, which lifts the front-bottom edge by
  // 10.8 mm; the centre sits 11 mm low so that edge meets the seat instead of leaving a wedge gap.
  const back=box(a,'B4_lobby_armchair_back',L.armchairSize,backH,.16,0,seatH+backH/2-.011,-L.armchairSize*.33,mats.sofa);back.rotation.x=-.12;
 }
 const table=new T.Mesh(new T.CylinderGeometry(L.table.r,L.table.r,.055,20),mats.stone);
 table.name='B4_lobby_table';table.position.set(L.table.x,F+L.table.h-.0275,L.table.z);table.castShadow=table.receiveShadow=true;table.userData={...SOURCE,authorKey:'B4_lobby_table'};lobby.add(table);
 const pedestal=new T.Mesh(new T.CylinderGeometry(L.table.r*.34,L.table.r*.62,L.table.h-.055,14),mats.timber);
 pedestal.name='B4_lobby_table_pedestal';pedestal.position.set(L.table.x,F+(L.table.h-.055)/2,L.table.z);pedestal.userData={...SOURCE,authorKey:'B4_lobby_table_pedestal'};lobby.add(pedestal);
 const stool=new T.Mesh(new T.CylinderGeometry(L.stool.r,L.stool.r*.72,L.stool.h*.16,16),mats.stone);
 stool.name='B4_lobby_stool_seat';stool.position.set(L.stool.x,F+L.stool.h*.92,L.stool.z);stool.castShadow=true;stool.userData={...SOURCE,authorKey:'B4_lobby_stool_seat'};lobby.add(stool);
 const stem=new T.Mesh(new T.CylinderGeometry(L.stool.r*.34,L.stool.r*.5,L.stool.h*.8,14),mats.timber);
 stem.name='B4_lobby_stool_stem';stem.position.set(L.stool.x,F+L.stool.h*.4,L.stool.z);stem.userData={...SOURCE,authorKey:'B4_lobby_stool_stem'};lobby.add(stem);
 // Entrance: a slim frame and two frosted sliding leaves, closed until the campaign opens them.
 const D=B4_LAYOUT.door,door=group(root,'B04_entrance_door'),mid=(D.x0+D.x1)/2,leaf=(D.x1-D.x0)/2;
 // Opaque frosted panels: a closed door must read as closed, not as a window into the dark room.
 const panel=std('B4 door frosted panel',0xb9c9c4,0x31423d,.35);
 for(const x of [D.x0-.04,D.x1+.04])box(door,'B4_door_post',.08,D.height,.2,x,F+D.height/2,D.z,mats.frame);
 box(door,'B4_door_header',D.x1-D.x0+.16,.08,.2,mid,F+D.height+.04,D.z,mats.frame);
 for(const [i,name] of B4_DOOR_LEAVES.entries()){
  const side=i===0?-1:1,g=group(door,name);g.position.set(mid+side*leaf/2,F,D.z);g.userData.closedX=g.position.x;g.userData.slide=side*D.slide;
  box(g,'B4_door_leaf_frame',leaf,.06,D.thickness,0,.03,0,mats.frame);box(g,'B4_door_leaf_frame',leaf,.06,D.thickness,0,D.height-.03,0,mats.frame);
  // Meeting stiles overlap 2 cm so the closed pair has no gap on the centre line.
  box(g,'B4_door_leaf_stile',.08,D.height,D.thickness,side*-(leaf/2-.03),D.height/2,0,mats.frame);
  const pane=new T.Mesh(new T.BoxGeometry(leaf-.06,D.height-.12,.02),panel);pane.name='B4_door_leaf_panel';pane.position.set(0,D.height/2,0);pane.userData={...SOURCE,authorKey:'B4_door_leaf_panel'};g.add(pane);
 }
 // Side entrance in the same façade, west of the main door (Ruling G1): the same frame and
 // two-leaf construction as the entrance, parked open so the doorway reads as the way in.
 const SD=B4_LAYOUT.sideDoor,sdMid=(SD.x0+SD.x1)/2,sdLeaf=(SD.x1-SD.x0)/2;
 const sideDoorGroup=group(root,'B04_side_door');
 for(const x of [SD.x0-.04,SD.x1+.04])box(sideDoorGroup,'B4_side_door_post',.08,SD.height,.2,x,F+SD.height/2,SD.z,mats.frame);
 box(sideDoorGroup,'B4_side_door_header',SD.x1-SD.x0+.16,.08,.2,sdMid,F+SD.height+.04,SD.z,mats.frame);
 for(const [i,name] of ['B4_side_door_west','B4_side_door_east'].entries()){
  const dir=i===0?-1:1,leaf=group(sideDoorGroup,name);
  // Closed centre kept for a later animation; the leaves start slid clear of the 2.60 m
  // opening by 1.35 m each, the same relationship as the main entrance (leaf 1.30 m).
  leaf.userData.closedX=sdMid+dir*sdLeaf/2;leaf.userData.slide=dir*(sdLeaf+.05);
  leaf.position.set(leaf.userData.closedX+leaf.userData.slide,F,SD.z);
  box(leaf,'B4_side_door_leaf_frame',sdLeaf,.06,SD.thickness,0,.03,0,mats.frame);
  box(leaf,'B4_side_door_leaf_frame',sdLeaf,.06,SD.thickness,0,SD.height-.03,0,mats.frame);
  box(leaf,'B4_side_door_leaf_stile',.08,SD.height,SD.thickness,dir*-(sdLeaf/2-.03),SD.height/2,0,mats.frame);
  const pane=new T.Mesh(new T.BoxGeometry(sdLeaf-.06,SD.height-.12,.02),panel);
  pane.name='B4_side_door_leaf_panel';pane.position.set(0,SD.height/2,0);pane.userData={...SOURCE,authorKey:'B4_side_door_leaf_panel'};leaf.add(pane);
 }
 // The ruled flip wall on the façade's interior face, east of the main door.
 root.add(createB4FlipWall().root);
 return root;
}

/** The entrance leaves in a built world; none when the opening shell is absent. */
export function findB4DoorLeaves(root:T.Object3D):T.Object3D[]{
 return B4_DOOR_LEAVES.map(n=>root.getObjectByName(n)).filter((g):g is T.Object3D=>!!g&&typeof g.userData.closedX==='number');
}
/** Slide the entrance leaves: 0 closed, 1 open. */
export function setB4DoorLeaves(leaves:readonly T.Object3D[],open:number){
 for(const g of leaves){g.position.x=g.userData.closedX+g.userData.slide*open;g.updateMatrixWorld(true);}
}
