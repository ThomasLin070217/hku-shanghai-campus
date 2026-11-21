import * as T from 'three';
import type {CampusGame} from '../exploration/game';
import {SITE} from '../model/campusParameters';
import {campusLandmarks,TASK,CLUE_IDS,recordIds,type Landmark} from './landmarks';
import {EXPLORATION} from '../exploration/config';
export type ComputerPage='map'|'tasks'|'clues';
export interface Outcome {ok:boolean;code:string;message:string;id?:string;page?:ComputerPage}
export interface SurveyProgress {collected:string[];discovered:string[];completed:boolean;elapsedSeconds:number}
export class Survey {
 progress:SurveyProgress={collected:[],discovered:[],completed:false,elapsedSeconds:0};revision=0;
 events:{kind:string;message:string}[]=[];
 lastOutcome:Outcome|null=null;
 constructor(private game:CampusGame){}
 private cachedLandmarks:Landmark[]|null=null;
 private ray=new T.Raycaster();
 invalidateLandmarks(){this.cachedLandmarks=null;}
 get landmarks(){return this.cachedLandmarks??=campusLandmarks(this.game.buildings,this.game.site??SITE).map(l=>({...l,position:[l.position[0],this.game.body.world.support(l.position[0],l.position[2],0)??0,l.position[2]] as [number,number,number]}));}
 get equipped(){return this.game.inventory.equipped?.itemId==='macbook-air-13-silver';}
 emit(kind:string,message:string){this.events.push({kind,message});if(this.events.length>20)this.events.shift();this.game.event('survey',message,{kind});}
 target(){
  const g=this.game,from=g.body.position.clone().add(new T.Vector3(0,EXPLORATION.eyeHeight,0));
  const facing=new T.Vector3(-Math.sin(g.yaw)*Math.cos(g.pitch),-Math.sin(g.pitch),-Math.cos(g.yaw)*Math.cos(g.pitch));
  let best:{landmark:Landmark;distance:number;action:'collect'|'view'}|null=null;
  for(const l of this.landmarks){const to=new T.Vector3(...l.position).add(new T.Vector3(0,1.3,0)),d=to.sub(from),distance=d.length();if(distance>2.7||distance<.05||facing.dot(d.normalize())<.90)continue;
   this.ray.set(from,d);this.ray.near=0;this.ray.far=distance-.06;if(this.ray.intersectObjects(g.body.world.meshes,false).some(hit=>hit.object.name!==l.id))continue;
   if(!best||distance<best.distance)best={landmark:l,distance,action:l.clueId&&!this.progress.collected.includes(l.clueId)?'collect':'view'};
  }return best;
 }
 tick(dt:number){if(this.game.paused)return;if(!this.progress.completed)this.progress.elapsedSeconds+=dt;
  for(const l of this.landmarks)if(Math.hypot(l.position[0]-this.game.body.position.x,l.position[2]-this.game.body.position.z)<13&&!this.progress.discovered.includes(l.id)){this.progress.discovered.push(l.id);this.revision++;this.game.event('discovery','Record point found: '+l.name,{id:l.id});}}
 interact(expectedId?:string):Outcome{
  if(this.game.paused||this.game.inventoryOpen||this.game.panel)return this.finish(false,'paused','Continue the game first.');
  const t=this.target();if(!t||expectedId&&t.landmark.id!==expectedId)return this.finish(false,'no_target','Move close to the record point, aim at it, and make sure nothing blocks the way.');
  const l=t.landmark;
  if(t.action==='view'){this.emit('view',l.description);return this.finish(true,'viewed',l.description,l.id);}
  this.progress.collected.push(l.clueId!);if(!this.progress.discovered.includes(l.id))this.progress.discovered.push(l.id);this.revision++;
  this.emit('collect',l.description+(this.progress.collected.length===CLUE_IDS.length?' All records found: equip the MacBook and open the tasks page to sync.':''));
  return this.finish(true,'collected',l.description,l.id);
 }
 computer(page:ComputerPage|'submit'):Outcome{
  if(!this.equipped)return this.finish(false,'equip_required','Put the MacBook in the hotbar and select it before opening the computer.');
  if(page==='submit'){
   if(this.progress.completed)return this.finish(true,'already_completed','Archive already synced; it will not score twice.');
   const missing=CLUE_IDS.length-this.progress.collected.length;if(missing)return this.finish(false,'records_missing',`Missing ${missing} campus records. Visit the record points on the map first.`);
   this.progress.completed=true;this.revision++;this.emit('complete','Sync complete · Campus Digital Archive 001 unlocked.');return this.finish(true,'completed',TASK.archive);
  }const result={ok:true,code:'page_ready',message:'Computer page ready',page};this.lastOutcome=result;return result;
 }
 private finish(ok:boolean,code:string,message:string,id?:string){const r={ok,code,message,...(id?{id}:{})};this.lastOutcome=r;return r;}
 snapshot(){const t=this.game.paused?null:this.target();return{id:TASK.id,title:TASK.title,status:this.progress.completed?'completed':this.progress.collected.length===CLUE_IDS.length?'ready':'collecting',count:this.progress.collected.length,total:CLUE_IDS.length,collectedClues:this.landmarks.filter(l=>l.clueId&&this.progress.collected.includes(l.clueId)).map(l=>({id:l.clueId!,title:l.name,text:l.description})),discovered:[...this.progress.discovered],archive:this.progress.completed?{id:TASK.archiveId,title:TASK.archiveTitle,text:TASK.archive}:null,elapsedSeconds:Math.round(this.progress.elapsedSeconds),target:!this.game.paused&&t?{id:t.landmark.id,name:t.landmark.name,actions:[t.action],distance:t.distance}:null,objectives:this.landmarks.filter(l=>recordIds.includes(l.id)).map(l=>({id:l.id,name:l.name,position:l.position,collected:this.progress.collected.includes(l.clueId!)}))};}
}
