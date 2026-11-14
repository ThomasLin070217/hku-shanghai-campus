import type {BuildingSpec,SiteParameters} from '../model/campusParameters';
import {VIDEO_DETAILS} from '../model/videoDetailsParameters';
import {NOV13} from '../model/nov13Parameters';
export interface Landmark {id:string;name:string;position:[number,number,number];kind:'record'|'view';clueId?:string;description:string;source:string}
/** One coordinate source for 3D records, both maps, discovery and AI. Records are fictional overlays. */
export function campusLandmarks(buildings:BuildingSpec[],site:SiteParameters):Landmark[]{
 const b=buildings.find(b=>b.id==='B04')!,a=b.rotation*Math.PI/180,front=b.depth/2+10;
 const path=VIDEO_DETAILS.promenade[0];
 return [
  {id:'record-cds-entry',name:'CDS-1 入口',position:[b.x+Math.sin(a)*front,0,b.z+Math.cos(a)*front],kind:'record',clueId:'clue-learning',description:'入口记录：学习从提出一个好问题开始。档案标记：LEARN。',source:b.source},
  {id:'record-hku-square',name:'HKU 标识广场',position:[8,0,91],kind:'record',clueId:'clue-belonging',description:'广场记录：不同的来处，在这里成为同路人。档案标记：CONNECT。',source:'U04 00:00–00:13 / existing HKU-lawn-letters'},
  {id:'record-east-walk',name:'东侧露天步道',position:[path.x,0,path.z-path.depth/2+3],kind:'record',clueId:'clue-explore',description:'步道记录：抬头看看没有顶盖的天空，下一段路仍有新的问题。档案标记：EXPLORE。',source:'U04 01:10–01:24 / VIDEO_DETAILS.promenade[0]'},
  {id:NOV13.mapSign.id,name:'校园导览牌',position:[NOV13.mapSign.x,0,NOV13.mapSign.z],kind:'view',description:'北侧为礼堂与运动区，南侧为 HKU 草坪。绿色记录点属于本次数字巡检。',source:'M03 / NOV13.mapSign'},
 ];
}
export const TASK={id:'campus-digital-survey',title:'校园数字巡检',archiveId:'archive-campus-001',archiveTitle:'校园数字档案 001 · 未完的地图',archive:'LEARN · CONNECT · EXPLORE。三条记录已归档。同步结束时，档案目录中出现了一条尚未命名的路径：“如果校园也有记忆，谁会记得下一次相遇？”——待后续故事继续。'} as const;
export const CLUE_IDS=['clue-learning','clue-belonging','clue-explore'] as const;
export const recordIds=['record-cds-entry','record-hku-square','record-east-walk'];
