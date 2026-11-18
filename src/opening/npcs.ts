import * as T from 'three';
import {createCharacter} from '../characters/character';
import {NPC_APPEARANCES} from '../characters/config';
import {OPENING} from './spatialLayout';
export function createOpeningNPCs(){
 const root=new T.Group();root.name='Opening_people';
 const actors=[{position:OPENING.staff,appearance:{...NPC_APPEARANCES[0],id:'opening-staff',name:'Dinner coordinator',coat:0x244d3e,shirt:0xf4efd8}},{position:[66,0,-63] as const,appearance:{...NPC_APPEARANCES[1],id:'opening-student-1'}},{position:[67.5,0,-59] as const,appearance:{...NPC_APPEARANCES[0],id:'opening-student-2',coat:0x617d6d}}].map(a=>{const model=createCharacter(a.appearance);model.root.position.fromArray([...a.position]);root.add(model.root);return model;});
 return{root,update(dt:number,incident:boolean,paused:boolean,player:T.Vector3){root.visible=!incident;for(const actor of actors){actor.animate(paused?0:dt,0,true,0,0);if(!paused){const d=player.clone().sub(actor.root.position);if(d.length()<5)actor.root.rotation.y=Math.atan2(d.x,d.z);}}},dispose(){actors.forEach(a=>a.dispose());root.removeFromParent();}};
}
