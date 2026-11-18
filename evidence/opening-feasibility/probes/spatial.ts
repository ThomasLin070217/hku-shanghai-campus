import fs from 'node:fs';
import * as T from 'three';
import {createNavigation} from '../../../src/exploration/navigation.ts';
import {CharacterPhysics} from '../../../src/exploration/physics.ts';
import {BUILDINGS,SITE} from '../../../src/model/campusParameters.ts';
const reports:any[]=[];
function box(name:string,x0:number,x1:number,z0:number,z1:number,bottom:number,top:number){return{name,x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,bottom,top,angle:0};}
function cutRoom(w:any,id:string,room:{x0:number;x1:number;z0:number;door:number;doorWidth:number;floor:number}){
 const i=w.obstacles.findIndex((o:any)=>o.name===id+'/closed-exterior'),old=w.obstacles[i];if(i<0)throw Error('Missing original volume');
 const x0=old.x-old.w/2,x1=old.x+old.w/2,z0=old.z-old.d/2,z1=old.z+old.d/2,r=room,dl=r.door-r.doorWidth/2,dr=r.door+r.doorWidth/2;
 const pieces=[box(id+'/prototype-left-mass',x0,r.x0,z0,z1,0,old.top),box(id+'/prototype-right-mass',r.x1,x1,z0,z1,0,old.top),box(id+'/prototype-back-mass',r.x0,r.x1,z0,r.z0,0,old.top),box(id+'/prototype-front-left',r.x0,dl,z1-.2,z1,0,old.top),box(id+'/prototype-front-right',dr,r.x1,z1-.2,z1,0,old.top),box(id+'/prototype-lintel',dl,dr,z1-.2,z1,r.floor+2.5,old.top)];
 if(r.floor>0)pieces.push(box(id+'/prototype-raised-floor',r.x0,r.x1,r.z0,z1,0,r.floor));
 w.obstacles.splice(i,1,...pieces);return{...r,z1,removed:old.name,pieces:pieces.map(o=>o.name),roomArea:(r.x1-r.x0)*(z1-r.z0),doorClearance:r.doorWidth};
}
function remesh(w:any){for(const m of w.meshes){m.geometry.dispose();m.material.dispose();}w.meshes.splice(0,w.meshes.length,...w.obstacles.map((o:any)=>{const m=new T.Mesh(new T.BoxGeometry(o.w,o.top-o.bottom,o.d));m.name=o.name;m.position.set(o.x,(o.top+o.bottom)/2,o.z);m.rotation.y=o.angle;m.updateMatrixWorld();return m;}));}
function simulate(w:any,name:string,start:number[],points:number[][]){const body=new CharacterPhysics(w);body.position.set(start[0],w.support(start[0],start[1],0)??0,start[1]);const segments:any[]=[];let groundedFrames=0,totalFrames=0;
 for(const point of points){let frames=0,stuck=0;const hits=new Set<string>();let minY=body.position.y,maxY=minY;for(;frames<120*120;frames++){const dx=point[0]-body.position.x,dz=point[1]-body.position.z;if(Math.hypot(dx,dz)<.045)break;const old=body.position.clone();body.step(1/120,{forward:1,right:0,sprint:false},Math.atan2(-dx,-dz),false);minY=Math.min(minY,body.position.y);maxY=Math.max(maxY,body.position.y);for(const h of body.contacts)hits.add(h.id);if(body.grounded)groundedFrames++;totalFrames++;if(body.position.distanceTo(old)<1e-7)stuck++;else stuck=0;if(stuck>90)break;}
 const ok=Math.hypot(point[0]-body.position.x,point[1]-body.position.z)<.06;segments.push({point,ok,position:body.position.toArray(),seconds:frames/120,minY,maxY,contacts:[...hits]});if(!ok)break;}
 const result={name,passed:segments.length===points.length&&segments.every(s=>s.ok),segments,groundedFrames,totalFrames};reports.push(result);return result;
}
const exterior=createNavigation(BUILDINGS,SITE);
simulate(exterior,'Existing B04 to B05 exterior',[58,33.5],[[24,33.5],[24,-48],[58,-48],[58,-53.8]]);
simulate(exterior,'Existing B05 exterior to B04 handoff',[58,-53.8],[[58,-48],[24,-48],[24,33.5],[58,33.5],[58,25]]);
simulate(exterior,'Existing B06 grand stair reachability',[58,-48],[[24,-48],[18,-48],[18,-26],[4,-26],[4,-52.2]]);
const baselineBlocks={B05:exterior.blocked(58,-60,0),B06:exterior.blocked(4,-56,5.1)};exterior.dispose();
const rooms=createNavigation(BUILDINGS,SITE);
const b05=cutRoom(rooms,'B05',{x0:54,x1:66,z0:-64,door:58,doorWidth:2.4,floor:0});
const b06=cutRoom(rooms,'B06',{x0:1,x1:9,z0:-61,door:4,doorWidth:2.4,floor:5.1});
const originalSupport=rooms.support;
const overlaySupport=(x:number,z:number,y:number)=>{const h=originalSupport(x,z,y);if(x>=b06.x0&&x<=b06.x1&&z>=b06.z0&&z<=b06.z1&&y+.242>=b06.floor)return Math.max(h??-Infinity,b06.floor);return h;};
const overlay={...rooms,support:overlaySupport};remesh(rooms);
simulate(overlay,'B05 narrow doorway, right-turn room and return',[58,-53.8],[[58,-59],[63,-59],[58,-59],[58,-53.8]]);
simulate(overlay,'B06 grand stair, narrow doorway, pickup room and return',[4,-26],[[4,-52.2],[4,-56],[7,-56],[4,-56],[4,-52.2],[4,-26]]);
const retainedWalls={B05left:overlay.blocked(55,-54.8,0),B05right:overlay.blocked(64,-54.8,0),B05north:overlay.blocked(58,-65,0),B06left:overlay.blocked(1.5,-52.7,5.1),B06right:overlay.blocked(8,-52.7,5.1),B06north:overlay.blocked(4,-62,5.1),B05doorOpen:!overlay.blocked(58,-54.8,0),B06doorOpen:!overlay.blocked(4,-52.7,5.1),B06interiorSupport:overlay.support(4,-56,5.1)};
rooms.dispose();
const bus=createNavigation(BUILDINGS,SITE);const stairs=[{name:'prototype-bus-step-1',x0:57,x1:59,z0:36.4,z1:37.2,top:.18},{name:'prototype-bus-step-2',x0:57,x1:59,z0:35.6,z1:36.4,top:.36},{name:'prototype-bus-floor-step-3',x0:57,x1:59,z0:33.5,z1:35.6,top:.54}];for(const s of stairs)bus.obstacles.push(box(s.name,s.x0,s.x1,s.z0,s.z1,0,s.top));const base=bus.support;const busOverlay={...bus,support:(x:number,z:number,y:number)=>{let h=base(x,z,y);for(const s of stairs)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&s.top<=y+.242)h=Math.max(h??-Infinity,s.top);return h;}};remesh(bus);
simulate(busOverlay,'Three 18cm bus steps ascend and descend',[58,38],[[58,34.2],[58,38]]);bus.dispose();
const output={scope:'Temporary offline spatial proof, production code unchanged; no browser playthrough or survey claim',units:'metres',fixedStep:1/120,playerSpeed:2.6,baselineBlocks,prototypeRooms:[b05,b06],retainedWalls,reports};fs.writeFileSync(new URL('../spatial-results.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify({baselineBlocks,retainedWalls,results:reports.map(r=>({name:r.name,passed:r.passed,seconds:r.segments.reduce((n,s)=>n+s.seconds,0),end:r.segments.at(-1).position,contacts:r.segments.flatMap(s=>s.contacts)}))},null,2));if(!reports.every(r=>r.passed)||!Object.entries(retainedWalls).every(([k,v])=>typeof v==='number'||v===true))process.exitCode=1;
