import type {CampusGame} from '../exploration/game';
import {OPENING as O} from './spatialLayout';
import type {OpeningState} from './contracts';
import type {Objective} from '../campaign/types';
/** After Chapter 1 the running campaign owns the route and target (`campaign`, from `host.objective()`). */
export function drawOpeningMap(canvas:HTMLCanvasElement,g:CampusGame,story:OpeningState,large=false,campaign?:Objective|null){
 if(story.stage==='complete'&&campaign){
  const t=campaign.target;drawCampusMap(canvas,g,{route:campaign.route??[],target:t?{x:t[0],z:t[2]}:null},large);return;
 }
 const route=story.stage==='to_b6'?O.routeB6:story.stage==='return_b5'?[...O.routeB6].reverse():story.stage==='to_b4'||story.stage==='complete'?O.routeB4:O.routeB5;
 const target=story.stage==='to_b6'?O.laptop:story.stage==='to_b4'||story.stage==='complete'?O.handoff:story.stage==='bus'?O.busExit:O.staff;
 drawCampusMap(canvas,g,{route,target:{x:target[0],z:target[2]}},large);
}
interface CampusMapOverlay {
 route:readonly (readonly number[])[];
 target:{x:number;z:number}|null;
 focus?:{x:number;z:number;width:number;depth:number};
 markers?:readonly {x:number;z:number;label:string}[];
}
export function drawCampusMap(canvas:HTMLCanvasElement,g:CampusGame,overlay:CampusMapOverlay,large=false){
 const focus=overlay.focus??{x:0,z:-14,width:220,depth:270};
 const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height,s=Math.min((w-32)/focus.width,(h-32)/focus.depth),px=(x:number)=>w/2+(x-focus.x)*s,pz=(z:number)=>h/2+(z-focus.z)*s;
 c.fillStyle='#e6e9dc';c.fillRect(0,0,w,h);c.strokeStyle='#b0bbab';c.lineWidth=5*s;
 const line=(points:readonly (readonly number[])[])=>{c.beginPath();points.forEach(([x,z],i)=>i?c.lineTo(px(x),pz(z)):c.moveTo(px(x),pz(z)));c.stroke();};
 line([[-94,-94],[94,-94],[94,98],[-94,98],[-94,-94]]);line([[24,98],[24,-94]]);line([[24,-48],[58,-48]]);
 for(const b of g.buildings){c.save();c.translate(px(b.x),pz(b.z));c.rotate(-b.rotation*Math.PI/180);c.fillStyle=b.id==='B04'?'#87a38e':'#bcc4b7';c.fillRect(-b.width*s/2,-b.depth*s/2,b.width*s,b.depth*s);c.fillStyle='#173f32';c.font=`${large?18:11}px system-ui`;c.textAlign='center';c.fillText(large?'Building '+Number(b.id.slice(1)):String(Number(b.id.slice(1))),0,4);c.restore();}
 c.strokeStyle='#2e7962';c.lineWidth=large?4:2.5;c.setLineDash([5,4]);line(overlay.route);c.setLineDash([]);
 c.font='600 16px system-ui';c.textAlign='left';
 for(const marker of overlay.markers??[]){
  c.fillStyle='#34564b';c.fillRect(px(marker.x)-3,pz(marker.z)-3,6,6);c.fillText(marker.label,px(marker.x)+13,pz(marker.z)+4);
 }
 if(overlay.target){c.fillStyle='#ad7031';c.beginPath();c.arc(px(overlay.target.x),pz(overlay.target.z),large?8:5,0,Math.PI*2);c.fill();}
 c.save();c.translate(px(g.body.position.x),pz(g.body.position.z));c.rotate(-g.yaw);c.beginPath();c.moveTo(0,-9);c.lineTo(-5,5);c.lineTo(5,5);c.closePath();c.fillStyle='#254b91';c.fill();c.restore();c.textAlign='left';c.fillStyle='#173f32';c.font='12px system-ui';c.fillText('N ↑',9,18);
}
