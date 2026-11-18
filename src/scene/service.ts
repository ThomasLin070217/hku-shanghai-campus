import * as T from 'three';
import {sceneRegistry,validEntityQuery,SCENE_SCHEMA,type SceneEntity} from './registry';
import type {CampusGame} from '../exploration/game';
import {PROTOCOL_VERSION} from '../agent/protocol';
import type {Object3D} from 'three';
/** Discovery is read-only. Selection needs the same human-granted epoch as movement. */
export function createSceneService(root:()=>Object3D,game:()=>CampusGame,select:(id:string)=>void){
 const slim=(e:SceneEntity)=>({id:e.id,name:e.name,kind:e.kind,center:e.center,size:e.size,buildingId:e.buildingId,sourceFile:e.sourceFile});
 return(method:string,args:Record<string,unknown>)=>{
  const r=sceneRegistry(root());
  if(method==='entities')return validEntityQuery(args)?{ok:true,...r.query(args)}:{ok:false,error:'invalid_entity_query'};
  if(method==='world'){
   const g=game(),observe=g.observe(),entities=r.entities;
   return{ok:true,schema:SCENE_SCHEMA,revision:r.revision,protocolVersion:PROTOCOL_VERSION,units:'metres',axes:'+Y up; yaw=0 faces -Z; positive yaw turns left',
    bounds:g.body.world.bounds,
    buildings:entities.filter(e=>e.kind==='building').map(slim),
    roads:entities.filter(e=>e.kind==='road').map(slim),
    areas:entities.filter(e=>e.kind==='area').map(slim),
    landmarks:observe.landmarks.map(l=>({id:l.id,name:l.name,position:l.position})),
    survey:{id:observe.survey.id,title:observe.survey.title,status:observe.survey.status,count:observe.survey.count,total:observe.survey.total,targets:observe.survey.objectives},
    rules:{control:'explicit user enable; per-agent controlEpoch',maxActionMs:1000,maxDirectiveMs:30000,maxQueryLimit:100,actions:['move/lookDelta/jump (legacy)','walkTo','approach','lookAt','followPath'],stopDistanceM:2.4,note:'Movement always passes CharacterPhysics; no coordinate writes, no teleport, no AI self-enable.'}};
  }
  if(method==='entity'||method==='selectEntity'){
   if(typeof args.id!=='string'||args.id.length>100)return{ok:false,error:'invalid_entity_id'};
   const e=r.get(args.id);if(!e)return{ok:false,error:'unknown_entity',id:args.id};
   if(method==='selectEntity'){
    const g=game();if(args.controlEpoch!==g.epoch)return{ok:false,error:'stale_epoch',controlEpoch:g.epoch};
    if(!g.owner||!g.armed||g.paused)return{ok:false,error:'no_control'};
    if(args.sceneRevision!==r.revision)return{ok:false,error:'stale_scene',sceneRevision:r.revision};
    select(e.id);
   }
   const p=game().body.position,relative=e.center.map((v,i)=>v-p.getComponent(i));
   return{ok:true,revision:r.revision,entity:e,relativePosition:relative,children:r.entities.filter(c=>c.parentId===e.id).map(c=>({id:c.id,name:c.name,kind:c.kind})),editGuide:{mode:'source',file:e.sourceFile,anchor:e.sourceAnchor,checks:['npm run check:scene','npm run check:all'],note:'Edit authoring parameters/code, not the merged mesh. Keep navigation consistent. No runtime coordinate-write endpoint.'}};
  }
  return{ok:false,error:'unknown_method'};
 };
}
