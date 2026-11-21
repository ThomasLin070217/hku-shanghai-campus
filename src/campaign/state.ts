/**
 * One-world campaign: the stages after Chapter 1 reaches Building 4, as one
 * linear story machine. Pure data, no DOM, so checks run headless.
 *
 * Story order (doc/11 §2, doc/12 §6–7): B4 restores the supercomputer → the
 * lawn shuts the guardian down and cuts core power → the sports hall door frees
 * the students → the ending lifts the dome.
 */
export const CAMPAIGN_STAGES=['b4_enter','b4_keyboard','b4_flip','b4_breaker','b4_connect','to_lawn','lawn','to_sports','sports','ending','done'] as const;
export type CampaignStage=typeof CAMPAIGN_STAGES[number];
export type CampaignEvent='enter_b4'|'keyboard_solved'|'flip_solved'|'breaker_pulled'|'macbook_connected'|'reach_lawn'|'guardian_shutdown'|'reach_sports'|'door_opened'|'ending_finished';
export const CAMPAIGN_TRANSITIONS:Record<CampaignEvent,{from:CampaignStage;to:CampaignStage}>={
 enter_b4:{from:'b4_enter',to:'b4_keyboard'},keyboard_solved:{from:'b4_keyboard',to:'b4_flip'},flip_solved:{from:'b4_flip',to:'b4_breaker'},
 breaker_pulled:{from:'b4_breaker',to:'b4_connect'},macbook_connected:{from:'b4_connect',to:'to_lawn'},reach_lawn:{from:'to_lawn',to:'lawn'},
 guardian_shutdown:{from:'lawn',to:'to_sports'},reach_sports:{from:'to_sports',to:'sports'},door_opened:{from:'sports',to:'ending'},ending_finished:{from:'ending',to:'done'},
};
export interface CampaignState{schemaVersion:1;stage:CampaignStage;deviceId:string;updatedAt:number}
/** Under 'hku.' so the chapter menu's Reset progress (which clears that prefix) clears the campaign. */
export const CAMPAIGN_SAVE_KEY='hku.campaign.v1';

export function createCampaignState(deviceId:string,now=Date.now()):CampaignState{
 return{schemaVersion:1,stage:'b4_enter',deviceId,updatedAt:now};
}

/** Wrong-stage events change nothing and hand back the same object. */
export function reduceCampaign(s:CampaignState,e:CampaignEvent,now=Date.now()):{state:CampaignState;changed:boolean}{
 const rule=CAMPAIGN_TRANSITIONS[e];
 if(!rule||rule.from!==s.stage)return{state:s,changed:false};
 return{state:{...s,stage:rule.to,updatedAt:now},changed:true};
}

export function parseCampaignState(raw:unknown):CampaignState|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1)return null;
 if(typeof r.stage!=='string'||!(CAMPAIGN_STAGES as readonly string[]).includes(r.stage))return null;
 if(typeof r.deviceId!=='string'||!r.deviceId)return null;
 if(typeof r.updatedAt!=='number'||!Number.isFinite(r.updatedAt))return null;
 return{schemaVersion:1,stage:r.stage as CampaignStage,deviceId:r.deviceId,updatedAt:r.updatedAt};
}

export function stageIndex(stage:CampaignStage):number{
 return CAMPAIGN_STAGES.indexOf(stage);
}

/** b4_* → 'b4'; lawn → 'lawn'; sports → 'sports'; ending|done → 'ending'; to_* walking legs → null. */
export function campaignChapterOf(stage:CampaignStage):'b4'|'lawn'|'sports'|'ending'|null{
 if(stage.startsWith('b4_'))return 'b4';
 if(stage==='lawn'||stage==='sports')return stage;
 if(stage==='ending'||stage==='done')return 'ending';
 return null;
}

/**
 * The restored B4 supercomputer hands the security robots to the MacBook
 * (doc/11 §3), so from `to_lawn` on the opening fleet stops hunting.
 * `null` (no campaign running) keeps the Chapter 1 rules.
 */
export function fleetStandsDown(stage:CampaignStage|null):boolean{
 return stage!==null&&stageIndex(stage)>=stageIndex('to_lawn');
}
