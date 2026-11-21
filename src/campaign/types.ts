import type * as T from 'three';
import type {createExplorer} from '../exploration/controller';
import type {OpeningAtmosphere} from '../opening/atmosphere';
import type {CampaignEvent,CampaignStage} from './state';
export type Explorer=ReturnType<typeof createExplorer>;
export type Vec3=[number,number,number];
export interface Objective{text:string;target:Vec3|null;route?:[number,number][]}
export interface ChapterContext{
 scene:T.Scene; root:()=>T.Object3D; explorer:Explorer; deviceId:()=>string;
 stage:()=>CampaignStage; emit:(event:CampaignEvent)=>boolean;
 notify:(text:string)=>void; atmosphere:()=>OpeningAtmosphere|undefined;
 openPanel:(id:string)=>void; closePanel:()=>void; resume:()=>void;   // modal panels pause the game and release pointer lock; resume re-enters play
 card:(kicker:string,title:string,ms?:number)=>Promise<void>;          // shared full-screen chapter card (Task 1)
 hearts?:{get():number;max:number;damage(n:number):number;heal():number};   // the opening runtime's hearts; damage/heal return the new value and persist like a robot catch does
}
export interface Chapter{
 id:'b4'|'lawn'|'sports'|'ending';
 /** Where the walking leg that leads into this chapter ends (host emits the entry event inside `radius`). */
 entry:{point:Vec3;radius:number;event:CampaignEvent};
 /** Route drawn on the minimap for the walking leg into this chapter, x/z pairs, last point = entry.point. */
 approach:[number,number][];
 attach(ctx:ChapterContext):void;   // once, when the campaign first needs this chapter (build scenery, HUD)
 update(dt:number):void;            // every frame while attached; dt is 0 while the game is paused or the explorer is off
 interact():boolean;                // E key; true if consumed
 objective(stage:CampaignStage):Objective|null;
 detach():void;
 debug?:Record<string,(...args:never[])=>unknown>;
}
export type ChapterId=Chapter['id'];
