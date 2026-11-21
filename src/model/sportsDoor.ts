import * as T from 'three';
import {pane,solid} from './glazing';

/** Client request 2026-11-20: a glazed east-elevation door with a keypad lock on the
 * sports hall, to be opened by a sudoku puzzle later. The hall itself is a closed
 * block-out in the C03/R02 evidence, so this door is a game-play addition: its size
 * follows the existing 5×3 m hall doors, its position is inferred from the block-out. */
export const SPORTS_HALL={x:-68,width:39,depth:26,wallHeight:7,ridge:10.5,floorTop:.3,eastX:19.5};
export const SPORTS_DOOR={
 id:'sports-east-door',
 name:'Sports_East_Door',
 width:3.2,height:2.7,leafWidth:1.56,swing:1.42,
 lock:{y:1.28,z:2.18},
 code:{digits:4,content:'content/puzzles/sports-hall-lock.json'},
 sourceFile:'src/model/sportsDoor.ts',
};
export const sportsDoorWorld=(sportsZ:number)=>({x:SPORTS_HALL.x+SPORTS_HALL.eastX,z:sportsZ});
export interface DoorMaterials {frame:T.Material;clear:T.Material;back:T.Material}

/** Two hinged leaves in their own pivot groups, so the runtime can swing just the leaf. */
export function buildSportsDoor(hall:T.Group,m:DoorMaterials){
 const x=SPORTS_HALL.eastX,half=SPORTS_DOOR.width/2,w=SPORTS_DOOR.width,h=SPORTS_DOOR.height,lw=SPORTS_DOOR.leafWidth;
 const g=new T.Group();g.name=SPORTS_DOOR.name;
 g.userData={sourceFile:SPORTS_DOOR.sourceFile,source:'2026-11-20 client request: east glass door + keypad lock',confidence:'fictional-gameplay-addition_not-observed',label:'体育馆东门 · 玻璃门与门禁锁'};
 hall.add(g);
 solid(g,'Door_threshold',.26,.06,w+.24,x,.28,0,m.frame);
 for(const s of [-1,1])solid(g,'Door_jamb',.26,h,.14,x,h/2,s*half,m.frame);
 solid(g,'Door_head',.26,.16,w+.14,x,h+.08,0,m.frame);
 const leaf=(name:string,z:number,yaw:number)=>{const p=new T.Group();p.name=name;p.position.set(x,0,z);p.rotation.y=yaw;g.add(p);
  pane(p,'Door_glass_leaf',lw,h-.14,lw/2,(h-.14)/2+.07,0,m.clear);
  for(const s of [-1,1])solid(p,'Door_leaf_stile',.06,h-.14,.06,lw/2+s*(lw/2-.03),(h-.14)/2+.07,0,m.frame);
  solid(p,'Door_leaf_rail',lw,.07,.06,lw/2,.04,0,m.frame);solid(p,'Door_leaf_rail',lw,.07,.06,lw/2,h-.03,0,m.frame);
  for(const s of [-1,1])solid(p,'Door_handle',.05,.30,.05,lw-.10,1.05,s*.07,m.frame);
  solid(p,'Door_kick_plate',lw-.10,.30,.02,lw/2,.23,0,m.back);return p;};
 const left=leaf('Leaf_Left',-half,-Math.PI/2),right=leaf('Leaf_Right',half,Math.PI/2);
 const lock=new T.Group();lock.name='Door_Lock';lock.position.set(x+.15,SPORTS_DOOR.lock.y,SPORTS_DOOR.lock.z);g.add(lock);
 solid(lock,'Lock_panel',.09,.46,.36,0,0,0,m.back);
 const ledMat=new T.MeshStandardMaterial({name:'Night_door_lock_led',color:0x2a0f0d,emissive:0xff3b2f,emissiveIntensity:1.4,roughness:.35,metalness:.10});
 solid(lock,'Night_door_lock_led',.04,.06,.06,.05,.14,0,ledMat);
 for(let r=0;r<3;r++)for(const c of [-1,0,1])solid(lock,'Lock_key',.02,.05,.05,.05,-.02-r*.11,c*.10,m.frame);
 solid(lock,'Lock_card_reader',.04,.10,.16,.05,-.28,0,m.frame);
 return{group:g,left,right,led:ledMat};
}
