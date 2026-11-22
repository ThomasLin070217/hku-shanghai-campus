import * as T from 'three';
import {B4_DOOR_LEAVES,B4_LAYOUT,B4_OBSTACLES} from './b4Layout';

/**
 * Static B04 ground-floor shell, built with the opening world so B04 is never
 * hollow: floor, walls, ceiling, Keyboard Wall plinth, supercomputer racks and
 * the closed entrance door. Every box is a `B4_OBSTACLES` rect, so the scenery
 * and the collision come from one parameter object. World coordinates; DOM-free.
 */
export const B4_SHELL_NAME='B04_room_shell';
export const B4_RACK_LED='B4 rack status';
export const B4_RACK_BODY='B4 rack body';
export const B4_CEILING='B4 room ceiling';
const std=(name:string,color:number,emissive=0,intensity=0)=>{const m=new T.MeshStandardMaterial({name,color,roughness:.85,metalness:.05});if(emissive){m.emissive.setHex(emissive);m.emissiveIntensity=intensity;}return m;};
const SOURCE={sourceFile:'src/opening/b4Shell.ts',source:'B04 campaign rooms (src/opening/b4Layout.ts)',confidence:'provisional 2030 scenery; not a surveyed interior'};
function box(parent:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){
 const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={...SOURCE};parent.add(mesh);return mesh;
}
function group(parent:T.Object3D,name:string){const g=new T.Group();g.name=name;g.userData={...SOURCE};parent.add(g);return g;}

export function buildB4Shell(){
 const root=new T.Group();root.name=B4_SHELL_NAME;root.userData={...SOURCE,sceneLabel:'B04 ground floor (Keyboard Wall rooms)'};
 const R=B4_LAYOUT.room;
 const mats={wall:std('B4 room wall',0x2a3431),ceiling:std(B4_CEILING,0x1c2321),plinth:std('B4 keyboard plinth',0x49392c),floor:std('B4 room floor',0x3a403c),rack:std(B4_RACK_BODY,0x161b1f),led:std(B4_RACK_LED,0x2f7d52,0x47e08a,.12),frame:std('B4 door frame',0x8fabae)};
 const shell=group(root,'B04_room_structure');
 box(shell,'B4_floor',R.x1-R.x0,R.floor,R.z1-R.z0,(R.x0+R.x1)/2,R.floor/2,(R.z0+R.z1)/2,mats.floor).castShadow=false;
 const racks=group(root,'B04_supercomputer_racks');
 for(const r of B4_OBSTACLES){
  if(!r.render)continue;
  const x=(r.x0+r.x1)/2,z=(r.z0+r.z1)/2,w=r.x1-r.x0,d=r.z1-r.z0;
  if(r.render==='rack'){
   box(racks,r.name,w,r.top-r.bottom,d,x,(r.top+r.bottom)/2,z,mats.rack);
   for(let k=0;k<7;k++)box(racks,'B4_rack_status_strip',.02,.04,d-.2,r.x0-.01,r.bottom+.4+k*.27,z,mats.led);
   continue;
  }
  // The plinth shows only under the timber wall; above it the builder's wall and caps are the surface.
  const top=r.render==='plinth'?Math.min(r.top,B4_LAYOUT.keyboardOrigin[1]+.72):r.top;
  box(shell,r.name,w,top-r.bottom,d,x,(top+r.bottom)/2,z,mats[r.render]);
 }
 // Entrance: a slim frame and two frosted sliding leaves, closed until the campaign opens them.
 const D=B4_LAYOUT.door,door=group(root,'B04_entrance_door'),mid=(D.x0+D.x1)/2,leaf=(D.x1-D.x0)/2;
 // Opaque frosted panels: a closed door must read as closed, not as a window into the dark room.
 const panel=std('B4 door frosted panel',0xb9c9c4,0x31423d,.35);
 for(const x of [D.x0-.04,D.x1+.04])box(door,'B4_door_post',.08,D.height,.2,x,R.floor+D.height/2,D.z,mats.frame);
 box(door,'B4_door_header',D.x1-D.x0+.16,.08,.2,mid,R.floor+D.height+.04,D.z,mats.frame);
 for(const [i,name] of B4_DOOR_LEAVES.entries()){
  const side=i===0?-1:1,g=group(door,name);g.position.set(mid+side*leaf/2,R.floor,D.z);g.userData.closedX=g.position.x;g.userData.slide=side*D.slide;
  box(g,'B4_door_leaf_frame',leaf,.06,D.thickness,0,.03,0,mats.frame);box(g,'B4_door_leaf_frame',leaf,.06,D.thickness,0,D.height-.03,0,mats.frame);
  // Meeting stiles overlap 2 cm so the closed pair has no gap on the centre line.
  box(g,'B4_door_leaf_stile',.08,D.height,D.thickness,side*-(leaf/2-.03),D.height/2,0,mats.frame);
  const pane=new T.Mesh(new T.BoxGeometry(leaf-.06,D.height-.12,.02),panel);pane.name='B4_door_leaf_panel';pane.position.set(0,D.height/2,0);pane.userData={...SOURCE};g.add(pane);
 }
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
