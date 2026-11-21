/**
 * One F press, one owner. The campaign chapter in play gets the press first; only
 * if it does not consume it does the Chapter 1 interaction run. With no campaign
 * running at Building 4 the press reopens the handoff, so a closed completion
 * dialog never strands the run. When nothing takes the press the player is told.
 */
export interface InteractRoute{
 campaign:()=>{interact():boolean}|null;
 reopenHandoff:()=>boolean;
 opening:()=>{ok:boolean;message:string};
 notify:(message:string)=>void;
}
export function routeInteract(r:InteractRoute):'campaign'|'handoff'|'opening'|'notice'{
 const c=r.campaign();
 if(c?.interact())return 'campaign';
 if(!c&&r.reopenHandoff())return 'handoff';
 const result=r.opening();
 if(result.ok)return 'opening';
 r.notify(result.message);
 return 'notice';
}
