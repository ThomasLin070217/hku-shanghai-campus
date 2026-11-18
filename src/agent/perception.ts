import * as T from 'three';
import type {CampusGame} from '../exploration/game';
import {EXPLORATION as C} from '../exploration/config';
import {ITEMS} from '../items/definitions';
export interface Affordance {
 id:string;
 name:string;
 verb:'collect'|'view'|'equip'|'submit'|'interact'|'open';
 distance:number;
 bearingDeg:number;
 inView:boolean;
 lineOfSight:boolean;
 reachable:boolean;
 requiredDistance:number;
}
export interface Probe {distance:number;supportY:number|null;blocked:boolean;stepUp:number|null;drop:number|null}
export interface NearbyObstacle {name:string;distance:number;bearingDeg:number;top:number}
export interface Perception {
 eye:[number,number,number];
 forward:[number,number,number];
 ground:'grass'|'paving';
 underfootY:number|null;
 probes:Probe[];
 interactables:Affordance[];
 nearby:NearbyObstacle[];
 hud:string[];
 target:{id:string;name:string;actions:string[];distance:number}|null;
}

const DEG=Math.PI/180,INTERACT=2.7,H_HALF=50,V_HALF=36,NEAR_R=12;
const r3=(v:number)=>Math.round(v*1000)/1000;

/** Read-only "eyes" for an external AI: everything below comes from existing game state, never from pixels. */
export function perceive(game:CampusGame):Perception{
 const world=game.body.world,body=game.body.position;
 const cosP=Math.cos(game.pitch),sinP=Math.sin(game.pitch);
 const forward=new T.Vector3(-Math.sin(game.yaw)*cosP,-sinP,-Math.cos(game.yaw)*cosP);
 const eye=new T.Vector3(body.x,body.y+C.eyeHeight,body.z);
 const ray=new T.Raycaster();
 const floorAt=(x:number,z:number,y:number):number|null=>{
  let h=world.support(x,z,y+C.maxStep);
  for(const o of world.obstacles)if(world.overlaps(o,x,z)&&o.top<=y+C.maxStep+.01&&(h===null||o.top>h))h=o.top;
  return h;
 };
 const seeThrough=(from:T.Vector3,to:T.Vector3,self?:string)=>{
  const d=to.clone().sub(from),dist=d.length();
  if(dist<1e-4)return true;
  ray.set(from,d.multiplyScalar(1/dist));ray.near=0.02;ray.far=dist;
  return !ray.intersectObjects(world.meshes,false).some(h=>h.object.name!==self&&h.distance<dist-.02);
 };
 const bearingDir=(dx:number,dz:number)=>{
  const fx=-Math.sin(game.yaw),fz=-Math.cos(game.yaw),lx=-Math.cos(game.yaw),lz=Math.sin(game.yaw);
  return Math.atan2(dx*lx+dz*lz,dx*fx+dz*fz)/DEG;
 };
 const viewOf=(dx:number,dy:number,dz:number)=>{
  const horiz=Math.hypot(dx,dz),elev=Math.atan2(dy,horiz),fElev=Math.atan2(forward.y,Math.hypot(forward.x,forward.z));
  return Math.abs(bearingDir(dx,dz))<=H_HALF&&Math.abs(elev-fElev)<=V_HALF;
 };

 const probes:Probe[]=[];
 const flen=Math.hypot(forward.x,forward.z)||1,ux=forward.x/flen,uz=forward.z/flen;
 for(const distance of [0.6,1.5,3.0]){
  const x=body.x+ux*distance,z=body.z+uz*distance,h=floorAt(x,z,body.y);
  const blocked=h===null||h-body.y>C.maxStep+1e-6||body.y-h>C.maxDrop+1e-6||world.blocked(x,z,h,C.radius);
  probes.push({distance,supportY:h===null?null:r3(h),blocked,stepUp:h===null?null:r3(Math.max(0,h-body.y)),drop:h===null?null:r3(Math.max(0,body.y-h))});
 }

 const interactables:Affordance[]=[];
 const marks=game.survey.landmarks;
 for(const l of marks){
  const p=new T.Vector3(l.position[0],l.position[1]+1.3,l.position[2]);
  const d=p.clone().sub(eye),distance=d.length(),los=seeThrough(eye,p,l.id);
  const verb:Affordance['verb']=l.clueId&&!game.survey.progress.collected.includes(l.clueId)?'collect':'view';
  interactables.push({id:l.id,name:l.name,verb,distance:r3(distance),bearingDeg:r3(bearingDir(d.x,d.z)),inView:viewOf(d.x,d.y,d.z),lineOfSight:los,reachable:distance<=INTERACT&&los,requiredDistance:INTERACT});
 }
 const equipped=game.inventory.equipped;
 if(equipped){
  const name=ITEMS[equipped.itemId]?.name??equipped.itemId;
  interactables.push({id:equipped.itemId,name,verb:'equip',distance:0,bearingDeg:0,inView:true,lineOfSight:true,reachable:true,requiredDistance:0});
  if(equipped.itemId==='macbook-air-13-silver'){
   interactables.push({id:'computer',name:'电脑 · 地图 / 任务 / 线索',verb:'open',distance:0,bearingDeg:0,inView:true,lineOfSight:true,reachable:true,requiredDistance:0});
   interactables.push({id:'computer-submit',name:'提交校园数字档案',verb:'submit',distance:0,bearingDeg:0,inView:true,lineOfSight:true,reachable:true,requiredDistance:0});
  }
 }
 interactables.sort((a,b)=>a.distance-b.distance);

 const nearby:NearbyObstacle[]=[];
 for(const o of world.obstacles){
  if(o.bottom>body.y+C.height+.2||o.top<body.y-.2)continue; // 只报与身体同一高度的碰撞体
  const dx=body.x-o.x,dz=body.z-o.z;
  let px:number,pz:number;
  if(o.radius){const len=Math.hypot(dx,dz),k=len>1e-6?o.radius/len:0;px=o.x+dx*k;pz=o.z+dz*k;}
  else{
   const co=Math.cos(o.angle),si=Math.sin(o.angle),lx=co*dx-si*dz,lz=si*dx+co*dz;
   const cx=lx<-o.w/2?-o.w/2:lx>o.w/2?o.w/2:lx,cz=lz<-o.d/2?-o.d/2:lz>o.d/2?o.d/2:lz;
   px=o.x+co*cx+si*cz;pz=o.z-si*cx+co*cz;
  }
  const ddx=px-body.x,ddz=pz-body.z,distance=Math.hypot(ddx,ddz);
  if(distance>NEAR_R)continue;
  nearby.push({name:o.name,distance:r3(distance),bearingDeg:r3(bearingDir(distance<1e-3?dx:ddx,distance<1e-3?dz:ddz)),top:r3(o.top)});
 }
 nearby.sort((a,b)=>a.distance-b.distance);
 nearby.splice(8);

 let target:Perception['target']=null;
 if(!game.paused){
  const t=game.survey.target();
  if(t)target={id:t.landmark.id,name:t.landmark.name,actions:[t.action],distance:r3(t.distance)};
 }
 const survey=game.survey.progress,marksWithClue=marks.filter(l=>l.clueId).length;
 const hud:string[]=[];
 if(game.inventoryOpen)hud.push('背包：已打开');
 else if(game.panel)hud.push('面板：'+(game.panel==='computer'?'电脑':'设置'));
 else if(game.paused)hud.push('暂停：'+(game.pauseReason??(game.armed?'等待玩家继续':'AI 未开启')));
 if(target)hud.push('交互：按 F '+(target.actions[0]==='collect'?'采集记录':'查看记录'));
 if(equipped)hud.push('已装备：'+(ITEMS[equipped.itemId]?.name??equipped.itemId));
 hud.push(`巡检：${survey.collected.length}/${marksWithClue} 条记录`);
 if(survey.completed)hud.push('档案：已同步');
 else if(survey.collected.length>=marksWithClue)hud.push('提示：装备 MacBook 打开电脑提交');
 if(game.armed&&game.owner)hud.push('AI 控制：'+game.owner);
 const underfoot=floorAt(body.x,body.z,body.y);

 return {
  eye:[eye.x,eye.y,eye.z],
  forward:[forward.x,forward.y,forward.z],
  ground:world.surface(body.x,body.z,body.y),
  underfootY:underfoot===null?null:r3(underfoot),
  probes,
  interactables,
  nearby,
  hud:hud.slice(0,6),
  target,
 };
}
