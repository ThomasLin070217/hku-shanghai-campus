import type {CampusGame} from '../exploration/game';
import {OPENING as O} from './spatialLayout';
import type {OpeningState} from './contracts';
import type {Objective} from '../campaign/types';
/** After Chapter 1 the running campaign owns the route and target (`campaign`, from `host.objective()`). */
export function drawOpeningMap(canvas:HTMLCanvasElement,g:CampusGame,story:OpeningState,large=false,campaign?:Objective|null){
 if(story.stage==='complete'&&campaign){
  const t=campaign.target;drawCampusMap(canvas,g,{route:campaign.route??[],target:t?{x:t[0],z:t[2]}:null,theme:'dark'},large);return;
 }
 const route=story.stage==='to_b6'?O.routeB6:story.stage==='return_b5'?[...O.routeB6].reverse():story.stage==='to_b4'||story.stage==='complete'?O.routeB4:O.routeB5;
 const target=story.stage==='crowd'?O.crowdStart:story.stage==='to_b6'?O.laptop:story.stage==='to_b4'||story.stage==='complete'?O.handoff:O.staff;
 drawCampusMap(canvas,g,{route,target:{x:target[0],z:target[2]},theme:'dark'},large);
}
interface CampusMapOverlay {
 route:readonly (readonly number[])[];
 target:{x:number;z:number}|null;
 focus?:{x:number;z:number;width:number;depth:number};
 markers?:readonly {x:number;z:number;label:string}[];
 /** 'dark' = the opening HUD tokens (story mode); the default light plan stays for the lion page. */
 theme?:'light'|'dark';
}
const MAP_THEMES={
 light:{ground:'#e6e9dc',road:'#b0bbab',building:'#bcc4b7',b04:'#87a38e',label:'#173f32',route:'#2e7962',marker:'#34564b',target:'#ad7031',player:'#254b91',font:'system-ui'},
 // Dark ground, ink buildings, the green current target, the gold player (opening.css tokens).
 dark:{ground:'#08120f',road:'#1f3029',building:'rgba(232,244,238,.24)',b04:'rgba(116,230,180,.34)',label:'#e8f4ee',route:'#74e6b4',marker:'#a4bcb1',target:'#74e6b4',player:'#ffb648',font:'Inter, system-ui'},
} as const;
export function drawCampusMap(canvas:HTMLCanvasElement,g:CampusGame,overlay:CampusMapOverlay,large=false){
 const focus=overlay.focus??{x:0,z:-14,width:220,depth:270};
 const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height,s=Math.min((w-32)/focus.width,(h-32)/focus.depth),px=(x:number)=>w/2+(x-focus.x)*s,pz=(z:number)=>h/2+(z-focus.z)*s;
 const k=MAP_THEMES[overlay.theme??'light'];
 c.fillStyle=k.ground;c.fillRect(0,0,w,h);c.strokeStyle=k.road;c.lineWidth=5*s;
 const line=(points:readonly (readonly number[])[])=>{c.beginPath();points.forEach(([x,z],i)=>i?c.lineTo(px(x),pz(z)):c.moveTo(px(x),pz(z)));c.stroke();};
 line([[-94,-94],[94,-94],[94,98],[-94,98],[-94,-94]]);line([[24,98],[24,-94]]);line([[24,-48],[58,-48]]);
 for(const b of g.buildings){c.save();c.translate(px(b.x),pz(b.z));c.rotate(-b.rotation*Math.PI/180);c.fillStyle=b.id==='B04'?k.b04:k.building;c.fillRect(-b.width*s/2,-b.depth*s/2,b.width*s,b.depth*s);c.fillStyle=k.label;c.font=`${large?18:11}px ${k.font}`;c.textAlign='center';c.fillText(large?'Building '+Number(b.id.slice(1)):String(Number(b.id.slice(1))),0,4);c.restore();}
 c.strokeStyle=k.route;c.lineWidth=large?4:2.5;c.setLineDash([5,4]);line(overlay.route);c.setLineDash([]);
 c.font=`600 16px ${k.font}`;c.textAlign='left';
 for(const marker of overlay.markers??[]){
  c.fillStyle=k.marker;c.fillRect(px(marker.x)-3,pz(marker.z)-3,6,6);c.fillText(marker.label,px(marker.x)+13,pz(marker.z)+4);
 }
 if(overlay.target){c.fillStyle=k.target;c.beginPath();c.arc(px(overlay.target.x),pz(overlay.target.z),large?8:5,0,Math.PI*2);c.fill();}
 c.save();c.translate(px(g.body.position.x),pz(g.body.position.z));c.rotate(-g.yaw);c.beginPath();c.moveTo(0,-9);c.lineTo(-5,5);c.lineTo(5,5);c.closePath();c.fillStyle=k.player;c.fill();c.restore();c.textAlign='left';c.fillStyle=k.label;c.font=`12px ${k.font}`;c.fillText('N ↑',9,18);
}
