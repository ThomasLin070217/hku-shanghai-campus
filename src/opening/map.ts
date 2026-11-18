import type {CampusGame} from '../exploration/game';
import {OPENING as O} from './spatialLayout';
import type {OpeningState} from './contracts';
export function drawOpeningMap(canvas:HTMLCanvasElement,g:CampusGame,story:OpeningState,large=false){
 const c=canvas.getContext('2d');if(!c)return;const w=canvas.width,h=canvas.height,s=Math.min((w-32)/220,(h-32)/270),px=(x:number)=>w/2+x*s,pz=(z:number)=>h/2+(z+14)*s;
 c.fillStyle='#e6e9dc';c.fillRect(0,0,w,h);c.strokeStyle='#b0bbab';c.lineWidth=5*s;
 const line=(points:readonly (readonly number[])[])=>{c.beginPath();points.forEach(([x,z],i)=>i?c.lineTo(px(x),pz(z)):c.moveTo(px(x),pz(z)));c.stroke();};
 line([[-94,-94],[94,-94],[94,98],[-94,98],[-94,-94]]);line([[24,98],[24,-94]]);line([[24,-48],[58,-48]]);
 for(const b of g.buildings){c.save();c.translate(px(b.x),pz(b.z));c.rotate(-b.rotation*Math.PI/180);c.fillStyle=b.id==='B04'?'#87a38e':'#bcc4b7';c.fillRect(-b.width*s/2,-b.depth*s/2,b.width*s,b.depth*s);c.fillStyle='#173f32';c.font=`${large?18:11}px system-ui`;c.textAlign='center';c.fillText(large?'Building '+Number(b.id.slice(1)):String(Number(b.id.slice(1))),0,4);c.restore();}
 const route=story.stage==='to_b6'?O.routeB6:story.stage==='return_b5'?[...O.routeB6].reverse():story.stage==='to_b4'||story.stage==='complete'?O.routeB4:O.routeB5;
 c.strokeStyle='#2e7962';c.lineWidth=large?4:2.5;c.setLineDash([5,4]);line(route);c.setLineDash([]);
 const target=story.stage==='to_b6'?O.laptop:story.stage==='to_b4'||story.stage==='complete'?O.handoff:story.stage==='bus'?O.busExit:O.staff;
 c.fillStyle='#ad7031';c.beginPath();c.arc(px(target[0]),pz(target[2]),large?8:5,0,Math.PI*2);c.fill();
 c.save();c.translate(px(g.body.position.x),pz(g.body.position.z));c.rotate(-g.yaw);c.beginPath();c.moveTo(0,-9);c.lineTo(-5,5);c.lineTo(5,5);c.closePath();c.fillStyle='#254b91';c.fill();c.restore();c.textAlign='left';c.fillStyle='#173f32';c.font='12px system-ui';c.fillText('N ↑',9,18);
}
