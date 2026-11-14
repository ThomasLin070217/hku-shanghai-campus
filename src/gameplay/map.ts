import type {CampusGame} from '../exploration/game';
import {VIDEO_DETAILS as V} from '../model/videoDetailsParameters';
/** North is -Z; every position is taken from the runtime model/landmark definitions. */
export function drawCampusMap(canvas:HTMLCanvasElement,g:CampusGame,large=false){
 const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height,pad=large?28:12;
 const scale=Math.min((w-pad*2)/220,(h-pad*2)/270),ox=w/2,oy=h/2+14*scale;
 const px=(x:number)=>ox+x*scale,pz=(z:number)=>oy+z*scale;
 c.fillStyle='#e5eadc';c.fillRect(0,0,w,h);c.strokeStyle='#a6b4a0';c.lineWidth=large?8:3;
 const path=(pts:number[][])=>{c.beginPath();pts.forEach(([x,z],i)=>i?c.lineTo(px(x),pz(z)):c.moveTo(px(x),pz(z)));c.stroke();};
 path([[-94,-94],[94,-94],[94,98],[-94,98],[-94,-94]]);
 c.strokeStyle='#f9f9ed';for(const p of V.promenade){c.lineWidth=p.width*scale;path([[p.x,p.z-p.depth/2],[p.x,p.z+p.depth/2]]);}
 c.lineWidth=4*scale;const entry=g.buildings.find(b=>b.id==='B04');if(entry)path([[V.promenade[0].x,98],[V.promenade[0].x,entry.z+entry.depth/2+10],[entry.x+20,entry.z+entry.depth/2+10]]);path([[-94,-44],[94,-44]]);path([[-20,100],[-20,-50]]);
 c.fillStyle='#9bb384';c.fillRect(px(-14),pz(53),28*scale,40*scale);
 const s=g.site;c.fillStyle='#bec7bc';c.beginPath();c.ellipse(px(s.plazaX),pz(s.plazaZ),s.plazaRadiusX*scale,s.plazaRadiusZ*scale,0,0,Math.PI*2);c.fill();c.strokeStyle='#7e9486';c.lineWidth=1;c.stroke();
 for(const b of g.buildings){c.save();c.translate(px(b.x),pz(b.z));c.rotate(-b.rotation*Math.PI/180);c.fillStyle=b.id==='B04'?'#537d69':'#9ba99e';c.fillRect(-b.width*scale/2,-b.depth*scale/2,b.width*scale,b.depth*scale);c.strokeStyle='#6c8273';c.strokeRect(-b.width*scale/2,-b.depth*scale/2,b.width*scale,b.depth*scale);c.fillStyle='#173d31';c.font=`${large?24:15}px system-ui`;c.textAlign='center';c.fillText(b.id==='B04'?'CDS-1':b.id==='B03'?'CDS-2':b.id.slice(2),0,4);c.restore();}
 for(const [i,l]of g.survey.landmarks.entries()){const done=l.clueId&&g.survey.progress.collected.includes(l.clueId),known=g.survey.progress.discovered.includes(l.id);if(!l.clueId&&!known)continue;
  c.fillStyle=done?'#227859':l.clueId?'#c88832':'#ffffff';c.strokeStyle='#173d31';c.lineWidth=1.5;c.beginPath();c.arc(px(l.position[0]),pz(l.position[2]),large?13:7,0,Math.PI*2);c.fill();c.stroke();if(large){c.fillStyle='#ffffff';c.font='bold 18px system-ui';c.textAlign='center';c.fillText(l.clueId?done?'✓':String(i+1):'i',px(l.position[0]),pz(l.position[2])+4);}}
 c.save();c.translate(px(g.body.position.x),pz(g.body.position.z));c.rotate(-g.yaw);c.beginPath();c.moveTo(0,-(large?17:9));c.lineTo(-6,6);c.lineTo(0,3);c.lineTo(6,6);c.closePath();c.fillStyle='#152f6b';c.strokeStyle='#fff';c.lineWidth=2;c.fill();c.stroke();c.restore();
 c.fillStyle='#244a3c';c.textAlign='left';c.font=`bold ${large?22:16}px system-ui`;c.fillText('N ↑',10,20);
}
