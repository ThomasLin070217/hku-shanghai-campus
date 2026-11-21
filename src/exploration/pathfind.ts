import type {Navigation} from './navigation';
import {EXPLORATION as C} from './config';
export interface PathOptions {cellSize?:number;clearance?:number;maxNodes?:number;maxStepHeight?:number;maxDrop?:number}
export interface PathResult {
 ok:boolean;
 path:[number,number,number][];
 length:number;
 reachable:boolean;
 partial:boolean;
 reason?:string;
 visited:number;
}
/** 1 m grid A* for the same Navigation used by CharacterPhysics. Never throws. */
type CellPoint=[number,number,number];
const MAX_POINTS=512,EPS=1e-6,SQRT2=Math.SQRT2,BUCKET=8;

class MinHeap{
 private nodes:number[]=[];private scores:number[]=[];
 get size(){return this.nodes.length;}
 push(node:number,score:number){const n=this.nodes,s=this.scores;n.push(node);s.push(score);let i=n.length-1;
  while(i>0){const p=(i-1)>>1;if(s[p]<=s[i])break;[n[p],n[i]]=[n[i],n[p]];[s[p],s[i]]=[s[i],s[p]];i=p;}}
 pop(){const n=this.nodes,s=this.scores,top=n[0],ln=n.pop()!,ls=s.pop()!;
  if(n.length){n[0]=ln;s[0]=ls;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;
   if(l<n.length&&s[l]<s[m])m=l;if(r<n.length&&s[r]<s[m])m=r;if(m===i)break;
   [n[m],n[i]]=[n[i],n[m]];[s[m],s[i]]=[s[i],s[m]];i=m;}}
  return top;}
}

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v:number,a:number,b:number)=>v<a?a:v>b?b:v;

export function findPath(world:Navigation,from:readonly number[],to:readonly number[],options:PathOptions={}):PathResult{
 const fail=(reason:string):PathResult=>({ok:false,path:[],length:0,reachable:false,partial:false,reason,visited:0});
 try{
  if(!world||!world.bounds||!Array.isArray(from)||!Array.isArray(to))return fail('blocked');
  const fx=Number(from[0]),fy=Number(from[1]),fz=Number(from[2]);
  const tx=Number(to[0]),ty=Number(to[1]),tz=Number(to[2]);
  if(![fx,fy,fz,tx,ty,tz].every(finite))return fail('blocked');
  const cs=clamp(finite(options.cellSize)?options.cellSize:1,.5,4);
  const clearance=clamp(finite(options.clearance)?options.clearance:C.radius,0,2);
  const maxNodes=Math.max(1,Math.floor(finite(options.maxNodes)?options.maxNodes:20000));
  const maxStep=clamp(finite(options.maxStepHeight)?options.maxStepHeight:C.maxStep,.05,1);
  const maxDrop=clamp(finite(options.maxDrop)?options.maxDrop:C.maxDrop,.05,2);
  const b=world.bounds,minX=b.minX,minZ=b.minZ,W=Math.floor((b.maxX-minX)/cs),H=Math.floor((b.maxZ-minZ)/cs);
  if(W<1||H<1||W*H>400000)return fail('blocked');
  const startY=world.support(fx,fz,fy+maxStep);
  if(startY===null)return fail('blocked');

  // Bucket obstacles once: blocked() otherwise scans every obstacle for every expansion.
  const bucketMap=new Map<number,typeof world.obstacles>();
  const pad=clearance+0.75;
  for(const o of world.obstacles){
   const co=Math.cos(o.angle),si=Math.sin(o.angle),ex=Math.abs(co)*o.w/2+Math.abs(si)*o.d/2,ez=Math.abs(si)*o.w/2+Math.abs(co)*o.d/2;
   const x0=Math.floor((o.x-ex-pad)/BUCKET),x1=Math.floor((o.x+ex+pad)/BUCKET);
   const z0=Math.floor((o.z-ez-pad)/BUCKET),z1=Math.floor((o.z+ez+pad)/BUCKET);
   for(let bx=x0;bx<=x1;bx++)for(let bz=z0;bz<=z1;bz++){const k=bx*1000+bz;let list=bucketMap.get(k);if(!list){list=[];bucketMap.set(k,list);}list.push(o);}
  }
  const blockedAt=(x:number,z:number,y:number):boolean=>{
   const list=bucketMap.get(Math.floor(x/BUCKET)*1000+Math.floor(z/BUCKET));
   if(!list)return false;
   for(const o of list)if(y+C.height>o.bottom+.003&&y<o.top-.003&&world.overlaps(o,x,z,clearance))return true;
   return false;
  };
  const centerX=(ix:number)=>minX+(ix+.5)*cs,centerZ=(iz:number)=>minZ+(iz+.5)*cs;
  const cellOf=(x:number,z:number)=>({ix:clamp(Math.round((x-minX)/cs-.5),0,W-1),iz:clamp(Math.round((z-minZ)/cs-.5),0,H-1)});
  const indexOf=(ix:number,iz:number)=>iz*W+ix;
  const cellFeasible=(ix:number,iz:number,yRef:number):number|null=>{
   const x=centerX(ix),z=centerZ(iz),h=world.support(x,z,yRef+maxStep);
   if(h===null||blockedAt(x,z,h))return null;
   return h;
  };

  // Exact destination first: snapping alone would teleport an out-of-bounds target onto the rim.
  const exactY=world.support(tx,tz,startY+maxStep);
  const exactOk=exactY!==null&&!blockedAt(tx,tz,exactY);
  const goal=cellOf(tx,tz);
  let goalIx=goal.ix,goalIz=goal.iz,exactGoal=true;
  const goalCellH=cellFeasible(goalIx,goalIz,startY);
  if(!exactOk||goalCellH===null){
   // Nearest walkable cell to the requested point; A* still needs a real grid goal.
   let best:number[]|null=null,bestD=Infinity;
   for(let r=0;r<=12;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
    const ix=goal.ix+dx,iz=goal.iz+dz;if(ix<0||iz<0||ix>=W||iz>=H)continue;
    if(cellFeasible(ix,iz,startY)===null)continue;
    const d=Math.hypot(centerX(ix)-tx,centerZ(iz)-tz);
    if(d<bestD-EPS){bestD=d;best=[ix,iz];}
   }
   if(!best)return fail('unreachable');
   goalIx=best[0];goalIz=best[1];exactGoal=exactOk;
  }
  const goalIdx=indexOf(goalIx,goalIz),startCell=cellOf(fx,fz),startIdx=indexOf(startCell.ix,startCell.iz);
  const startPoint:CellPoint=[fx,startY,fz];

  const size=W*H,gScore=new Float64Array(size).fill(Infinity),parent=new Int32Array(size).fill(-1),heights=new Float64Array(size).fill(NaN),closed=new Float64Array(size).fill(NaN);
  const heuristic=(ix:number,iz:number)=>{const dx=Math.abs(ix-goalIx),dz=Math.abs(iz-goalIz);return (Math.max(dx,dz)+(SQRT2-1)*Math.min(dx,dz))*cs;};
  const direct=(ix:number,iz:number)=>Math.hypot(centerX(ix)-tx,centerZ(iz)-tz);
  // Edge walkability: cheap endpoint test, midpoint probe, then 0.25 m sub-sampling only
  // when a 1 m cell straddles several stair treads (0.17 m risers still cost < maxStep each).
  const heightFrom=(fx:number,fz:number,ix:number,iz:number,cy:number):number|null=>{
   if(ix<0||iz<0||ix>=W||iz>=H)return null;
   const x=centerX(ix),z=centerZ(iz),h=world.support(x,z,cy+maxStep);
   if(h===null)return null;
   if(h-cy<=maxStep+EPS&&cy-h<=maxDrop+EPS&&!blockedAt(x,z,h)){
    const mx=(fx+x)/2,mz=(fz+z)/2,mh=world.support(mx,mz,cy+maxStep);
    if(mh!==null&&mh-cy<=maxStep+EPS&&cy-mh<=maxDrop+EPS&&h-mh<=maxStep+EPS&&mh-h<=maxDrop+EPS&&!blockedAt(mx,mz,mh))return h;
   }
   const dx=x-fx,dz=z-fz,dist=Math.hypot(dx,dz),n=Math.max(2,Math.ceil(dist/.25));
   let prevY=cy;
   for(let i=1;i<=n;i++){
    const t=i/n,sx=fx+dx*t,sz=fz+dz*t,e=world.support(sx,sz,prevY+maxStep);
    if(e===null||e-prevY>maxStep+EPS||prevY-e>maxDrop+EPS)return null;
    if(blockedAt(sx,sz,e))return null;
    prevY=e;
   }
   return prevY;
  };
  const open=new MinHeap();
  gScore[startIdx]=0;heights[startIdx]=startY;open.push(startIdx,heuristic(startCell.ix,startCell.iz));
  let visited=0,bestIdx=startIdx,bestD=direct(startCell.ix,startCell.iz),found=false,limit=false;
  // The sunken court floor and the curved flight over it share the same 1 m cells, so one
  // cell can be walkable at more than one height. Re-open a cell when a higher surface is
  // reached; tread heights are a finite ladder, so this terminates.
  const relax=(ci:number,ix:number,iz:number,h:number,tent:number)=>{
   const nb=indexOf(ix,iz),prev=heights[nb];
   if(Number.isFinite(prev)&&h<=prev+1e-9)return;
   gScore[nb]=tent;parent[nb]=ci;heights[nb]=h;open.push(nb,tent+heuristic(ix,iz)*1.0001);
  };
  while(open.size){
   if(visited>=maxNodes){limit=true;break;}
   const ci=open.pop();const ph=heights[ci];if(Number.isFinite(closed[ci])&&ph<=closed[ci]+1e-9)continue;closed[ci]=ph;visited++;
   const ix=ci%W,iz=(ci-ix)/W,cx=centerX(ix),cz=centerZ(iz);
   const d=direct(ix,iz);if(d<bestD-EPS){bestD=d;bestIdx=ci;}
   if(ci===goalIdx){found=true;break;}
   const cy=heights[ci],g0=gScore[ci];
   const orthH:{[k:string]:number|null}={};
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const h=heightFrom(cx,cz,ix+dx,iz+dz,cy);orthH[dx+','+dz]=h;
    if(h!==null)relax(ci,ix+dx,iz+dz,h,g0+cs);
   }
   for(const [dx,dz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
    if(orthH[dx+',0']===null||orthH['0,'+dz]===null)continue; // 禁止穿角
    const h=heightFrom(cx,cz,ix+dx,iz+dz,cy);
    if(h!==null)relax(ci,ix+dx,iz+dz,h,g0+cs*SQRT2);
   }
  }

  // Rebuild point chain. Start is exact; found goal uses exact coordinates, partial stops at the best node.
  const cells:number[]=[];let c=found?goalIdx:bestIdx;
  while(c>=0){cells.push(c);c=parent[c];if(cells.length>40000)break;}
  cells.reverse();
  const pts:CellPoint[]=[startPoint];
  for(const ci of cells){
   if(ci===startIdx)continue;
   const ix=ci%W,iz=(ci-ix)/W;pts.push([centerX(ix),heights[ci],centerZ(iz)]);
  }
  if(found&&exactGoal&&exactY!==null){
   const last=pts[pts.length-1];
   if(Math.hypot(last[0]-tx,last[2]-tz)>1e-3)pts.push([tx,exactY,tz]);
   else{last[0]=tx;last[1]=exactY;last[2]=tz;}
  }
  const simplified=simplify(pts,world,maxStep,maxDrop,clearance);
  const output=simplified.length>MAX_POINTS?decimate(simplified,MAX_POINTS):simplified;
  let length=0;for(let i=1;i<output.length;i++)length+=Math.hypot(output[i][0]-output[i-1][0],output[i][1]-output[i-1][1],output[i][2]-output[i-1][2]);
  const ok=found&&exactGoal;
  return{ok,path:output,length:Math.round(length*1000)/1000,reachable:ok,partial:!ok&&output.length>1,reason:ok?undefined:limit?'limit':'unreachable',visited};
 }catch{return fail('blocked');}
}

/** String pulling: keep only points joined by a walkable straight segment. */
function simplify(points:CellPoint[],world:Navigation,maxStep:number,maxDrop:number,clearance:number):CellPoint[]{
 if(points.length<3)return points.map(p=>[p[0],p[1],p[2]]);
 const seg=(a:CellPoint,b:CellPoint):boolean=>{
  const dx=b[0]-a[0],dz=b[2]-a[2],horiz=Math.hypot(dx,dz);
  const n=Math.max(1,Math.ceil(horiz/0.5));let prevY=a[1];
  for(let i=1;i<=n;i++){
   const t=i/n,x=a[0]+dx*t,z=a[2]+dz*t,h=world.support(x,z,prevY+maxStep);
   if(h===null||h-prevY>maxStep+EPS||prevY-h>maxDrop+EPS)return false;
   if(world.blocked(x,z,h,clearance))return false;
   prevY=h;
  }
  return true;
 };
 const out:CellPoint[]=[[points[0][0],points[0][1],points[0][2]]];
 let i=0;
 while(i<points.length-1){
  let j=points.length-1;
  while(j>i+1&&!seg(points[i],points[j]))j--;
  out.push([points[j][0],points[j][1],points[j][2]]);i=j;
 }
 return out;
}
function decimate(points:CellPoint[],max:number):CellPoint[]{
 const out:CellPoint[]=[];
 for(let i=0;i<max;i++)out.push(points[Math.round(i*(points.length-1)/(max-1))]);
 return out;
}
