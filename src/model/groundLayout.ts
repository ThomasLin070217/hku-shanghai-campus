import type {SiteParameters} from './campusParameters';
import {VIDEO_DETAILS as V} from './videoDetailsParameters';

/** Shared render / navigation footprints. Metres, axis aligned, no stacked junctions. */
export interface GroundRect {x:number;z:number;width:number;depth:number}
export const DRIVE_RECTS:GroundRect[]=[
 ...[-94,94].map(x=>({x,z:0,width:7,depth:193})),
 ...[-44,98].map(z=>({x:0,z,width:188,depth:7})),
];
export const GRAND_STAIR_FOOTPRINT:GroundRect={x:0,z:-39.4,width:30,depth:24};
export function contains(r:GroundRect,x:number,z:number){return Math.abs(x-r.x)<=r.width/2+1e-8&&Math.abs(z-r.z)<=r.depth/2+1e-8;}
export function subtractRects(base:GroundRect,cuts:GroundRect[]):GroundRect[]{
 let pieces=[base];
 for(const cut of cuts)pieces=pieces.flatMap(r=>{
  const x0=r.x-r.width/2,x1=r.x+r.width/2,z0=r.z-r.depth/2,z1=r.z+r.depth/2;
  const a=Math.max(x0,cut.x-cut.width/2),b=Math.min(x1,cut.x+cut.width/2),c=Math.max(z0,cut.z-cut.depth/2),d=Math.min(z1,cut.z+cut.depth/2);
  if(a>=b||c>=d)return[r];
  return[[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,d,z1]].filter(([l,h,n,s])=>h-l>1e-7&&s-n>1e-7).map(([l,h,n,s])=>({x:(l+h)/2,z:(n+s)/2,width:h-l,depth:s-n}));
 });
 return pieces;
}
export function driveSections(){return DRIVE_RECTS.map((r,i)=>({id:`R00${i+1}`,name:['西侧车道','东侧车道','北侧横向车道','南侧横向车道'][i],parts:subtractRects(r,[GRAND_STAIR_FOOTPRINT,...DRIVE_RECTS.slice(0,i)])}));}
export function driveLayout(){return driveSections().flatMap(s=>s.parts);}
export function promenadeCuts(index:number){return [...DRIVE_RECTS,...V.promenade.slice(0,index)];}
export function promenadeLayout(){return V.promenade.flatMap((r,i)=>subtractRects(r,promenadeCuts(i)));}
export function centralWalkLayout(s:SiteParameters){
 // The flat site paving already connects around the courtyard. The raised strips
 // start beyond its planted rim, rather than projecting into its hole and hedge.
 const start=Math.max(30,s.plazaZ+s.plazaRadiusZ+2),end=94.5;
 return start>=end?[]:[-16.8,16.8].map(x=>({x,z:(start+end)/2,width:3,depth:end-start}));
}

/** IMG_4379: staircase above a cross passage. Opening-only position/size estimates. */
export const OPENING_STAIR_PASSAGE={x:0,z:-49,width:30,depth:3.2,clearHeight:3.2,source:'IMG_4379.MOV 00:01–00:09; topology observed, dimensions estimated'};
export function stairPassageSlabBottom(z:number,depth:number,top:number){
 const p=OPENING_STAIR_PASSAGE;
 return top>p.clearHeight+.15&&z+depth/2>p.z-p.depth/2&&z-depth/2<p.z+p.depth/2?p.clearHeight:0;
}
