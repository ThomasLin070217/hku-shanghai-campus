/** One distance-driven gait clock shared by visible pose and footstep events.
 * Distances are per footfall, not a full left/right cycle. No root motion. */
export const GAIT={walkStep:.72,runStep:1.12,runThreshold:3.6,blend:14,landingSilence:.14};
export type Motion='idle'|'walk'|'run'|'jump'|'land';
export class Gait {
 phase=0;speed=0;blend=0;run=0;steps=0;landings=0;impact=0;motion:Motion='idle';grounded=true;private air=false;private lowestVelocity=0;private landingTime=0;private clock=0;
 reset(){this.phase=0;this.speed=0;this.blend=0;this.run=0;this.motion='idle';this.air=false;this.lowestVelocity=0;this.landingTime=0;this.grounded=true;}
 update(dt:number,distance:number,grounded:boolean,vertical:number,speedHint?:number){
  if(dt<=0)return;this.clock+=dt;const valid=distance<=Math.max(.04,dt*8),speed=valid?(speedHint??(distance>1e-5?distance/dt:0)):0,moved=valid&&(distance>1e-5||speed>.04);
  this.speed=speed;this.grounded=grounded;
  if(!grounded){this.air=true;this.lowestVelocity=Math.min(this.lowestVelocity,vertical);}
  const landed=grounded&&this.air;
  if(landed){this.air=false;this.landings++;this.impact=Math.min(1,Math.max(.15,-this.lowestVelocity/8));this.lowestVelocity=0;this.landingTime=.18;}
  this.landingTime=Math.max(0,this.landingTime-dt);
  const runTarget=speed>GAIT.runThreshold?1:0,weight=1-Math.exp(-GAIT.blend*dt);
  this.run+=(runTarget-this.run)*weight;this.blend+=((grounded&&moved?1:0)-this.blend)*weight;
  this.motion=!grounded?'jump':this.landingTime>0?'land':speed>.04?(runTarget?'run':'walk'):'idle';
  if(grounded&&moved){const before=Math.floor(this.phase/Math.PI);this.phase+=distance/(GAIT.walkStep+(GAIT.runStep-GAIT.walkStep)*this.run)*Math.PI;const count=Math.floor(this.phase/Math.PI)-before;if(!landed&&this.landingTime<.18-GAIT.landingSilence)this.steps+=count;}
 }
 get landing(){return this.landingTime/.18;}
 get time(){return this.clock;}
}
