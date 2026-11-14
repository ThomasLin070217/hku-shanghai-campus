import {sceneRegistry,validEntityQuery} from './registry';
import type {CampusGame} from '../exploration/game';
import type {Object3D} from 'three';
/** Discovery is read-only. Selection needs the same human-granted epoch as movement. */
export function createSceneService(root:()=>Object3D,game:()=>CampusGame,select:(id:string)=>void){
 return(method:string,args:Record<string,unknown>)=>{
  const r=sceneRegistry(root());
  if(method==='entities')return validEntityQuery(args)?{ok:true,...r.query(args)}:{ok:false,error:'invalid_entity_query'};
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
