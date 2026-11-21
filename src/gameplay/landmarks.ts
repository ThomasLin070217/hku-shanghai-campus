import type {BuildingSpec,SiteParameters} from '../model/campusParameters';
import {VIDEO_DETAILS} from '../model/videoDetailsParameters';
import {NOV13} from '../model/nov13Parameters';
export interface Landmark {id:string;name:string;position:[number,number,number];kind:'record'|'view';clueId?:string;description:string;source:string}
/** One coordinate source for 3D records, both maps, discovery and AI. Records are fictional overlays. */
export function campusLandmarks(buildings:BuildingSpec[],site:SiteParameters):Landmark[]{
 const b=buildings.find(b=>b.id==='B04')!,a=b.rotation*Math.PI/180,front=b.depth/2+10;
 const path=VIDEO_DETAILS.promenade[0];
 return [
  {id:'record-cds-entry',name:'CDS-1 entrance',position:[b.x+Math.sin(a)*front,0,b.z+Math.cos(a)*front],kind:'record',clueId:'clue-learning',description:'Entrance record: learning starts with a good question. Archive tag: LEARN.',source:b.source},
  {id:'record-hku-square',name:'HKU letters plaza',position:[8,0,91],kind:'record',clueId:'clue-belonging',description:'Plaza record: different origins, fellow travellers here. Archive tag: CONNECT.',source:'U04 00:00–00:13 / existing HKU-lawn-letters'},
  {id:'record-east-walk',name:'East open walkway',position:[path.x,0,path.z-path.depth/2+3],kind:'record',clueId:'clue-explore',description:'Walkway record: look up at the open sky; the next stretch brings new questions. Archive tag: EXPLORE.',source:'U04 01:10–01:24 / VIDEO_DETAILS.promenade[0]'},
  {id:NOV13.mapSign.id,name:'Campus guide sign',position:[NOV13.mapSign.x,0,NOV13.mapSign.z],kind:'view',description:'The hall and sports area are to the north, the HKU lawn to the south. Green record points belong to this campus survey.',source:'M03 / NOV13.mapSign'},
 ];
}
export const TASK={id:'campus-digital-survey',title:'Campus Survey',archiveId:'archive-campus-001',archiveTitle:'Campus Digital Archive 001 · Unfinished Map',archive:'LEARN · CONNECT · EXPLORE. Three records archived. When the sync ended, an unnamed path appeared in the archive index: "If the campus also has memory, who will remember the next encounter?" — the story continues later.'} as const;
export const CLUE_IDS=['clue-learning','clue-belonging','clue-explore'] as const;
export const recordIds=['record-cds-entry','record-hku-square','record-east-walk'];
