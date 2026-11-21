/**
 * IF1 G1: the dome lift at the end of the run.
 *
 * The ending purges the world threat and starts the dome release on its
 * ADMINISTRATOR beat. The opening experience reads the threat through a
 * rate-limited refresh and feeds `curtain:sealed` to the atmosphere every
 * frame, and a sealed frame cancels a release in flight. So:
 * (a) a purge written in this page is adopted on the very next refresh frame,
 *     even when the periodic read has just happened (no storage read needed to
 *     notice it), while a corrupt record is still not re-read every frame;
 * (b) the credits wait until the atmosphere reports the dome fully released,
 *     capped a few seconds past ENDING_SECONDS.
 */
import assert from 'node:assert/strict';

const data=new Map<string,string>();
const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,String(v));},removeItem:(k:string)=>{data.delete(k);},
 get length(){return data.size;},key:(i:number)=>[...data.keys()][i]??null,clear:()=>data.clear()};
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true,writable:true});

const {WORLD_THREAT_KEY,loadWorldThreat,sealWorld,markLionDefeated,markPowerCut}=await import('../src/gameplay/worldThreat');
const {createThreatRefresh}=await import('../src/opening/threatRefresh');
const {createEndingChapter,ENDING_SECONDS}=await import('../src/campaign/endingChapter');
type ChapterContext=import('../src/campaign/types').ChapterContext;
type CampaignStage=import('../src/campaign/state').CampaignStage;

let failures=0;
function group(name:string,fn:()=>void){
 try{fn();console.log('  ok  ',name);}
 catch(error){failures++;console.log('  FAIL',name,'\n        ',error instanceof Error?error.message.split('\n')[0]:String(error));}
}
const dt=1/60;

/** The ending chapter headless, with a recording atmosphere whose lift takes `liftSeconds` after release(). */
function ending(liftSeconds:number|null){
 let stage:CampaignStage='ending',releasedAt:number|null=null,time=0;
 const emitted:string[]=[];
 const atmosphere={
  release(){releasedAt=time;},restoreSealed(){},reset(){},startIncident(){},update(){},
  snapshot(){const up=liftSeconds!==null&&releasedAt!==null&&time-releasedAt>=liftSeconds;
   return{phase:up?'day':releasedAt===null?'night':'disturbance',curtainVisible:!up,releasing:releasedAt!==null&&!up,curtainProgress:up?0:.5};},
 };
 const settled={then(ok?:()=>void){ok?.();return settled;},catch(){return settled;}} as unknown as Promise<void>;
 const ctx={stage:()=>stage,emit:(e:string)=>{emitted.push(e);if(e==='ending_finished')stage='done';return true;},deviceId:()=>'mac',
  notify(){},atmosphere:()=>atmosphere,cardSettled:()=>settled,explorer:{pause(){}},
  scene:null,root:()=>null,openPanel(){},closePanel(){},resume(){},card:()=>settled} as unknown as ChapterContext;
 const chapter=createEndingChapter();chapter.attach(ctx);
 return{chapter,emitted,step(seconds:number){for(let i=0;i<Math.round(seconds/dt);i++){time+=dt;chapter.update(dt);}},get time(){return time;},get releasedAt(){return releasedAt;}};
}

group('(a) a purge written in this page is adopted on the next frame, even right after a periodic read',()=>{
 data.clear();sealWorld();markLionDefeated();markPowerCut();
 const refresh=createThreatRefresh(1);
 let cached=loadWorldThreat();assert.equal(cached.phase,'sealed');
 // The periodic read lands on this frame: the cache is fresh and the next read is a second away.
 cached=refresh(cached,1,()=>loadWorldThreat());assert.equal(cached.phase,'sealed');
 // The ending's ADMINISTRATOR beat purges the record in this page.
 const e=ending(5.2);e.step(3.2+dt);e.step(8.05);assert.notEqual(e.releasedAt,null,'the release beat fired');
 assert.equal(loadWorldThreat().phase,'purged','the ending wrote the purge');
 cached=refresh(cached,dt,()=>loadWorldThreat());
 assert.equal(cached.phase,'purged','the next frame feeds curtain:false, so the release in flight is not cancelled');
});

group('(a) a corrupt record is still read at most once a second',()=>{
 data.clear();data.set(WORLD_THREAT_KEY,'{not json');
 const refresh=createThreatRefresh(1);let cached=loadWorldThreat();let reads=0;
 data.set(WORLD_THREAT_KEY,'{not json');
 for(let i=0;i<120;i++)cached=refresh(cached,dt,()=>{reads++;return loadWorldThreat();});
 assert.ok(reads<=2,`two seconds of frames read the record ${reads} times`);
 assert.ok([...data.keys()].filter(k=>k.startsWith(WORLD_THREAT_KEY+'.unreadable.')).length<=3,'unreadable backups stay bounded');
});

group('(b) the credits wait until the dome is fully back in the sky',()=>{
 data.clear();sealWorld();markLionDefeated();markPowerCut();
 // Release at 8 s on the Mac clock; this lift takes 7 s, so the dome is up at 15 s, past ENDING_SECONDS (14 s).
 const e=ending(7);e.step(3.2+dt);e.step(ENDING_SECONDS+.1);
 assert.deepEqual(e.emitted,[],'at ENDING_SECONDS the dome is still lifting: no credits yet');
 e.step(1.2);
 assert.deepEqual(e.emitted,['ending_finished'],'the credits follow once the dome is up');
});

group('(b) a dome that never reports released still gets credits, about 3 s late at most',()=>{
 data.clear();sealWorld();markLionDefeated();markPowerCut();
 const e=ending(null);e.step(3.2+dt);e.step(ENDING_SECONDS+2.5);
 assert.deepEqual(e.emitted,[],'still waiting inside the cap');
 e.step(.7);
 assert.deepEqual(e.emitted,['ending_finished'],'the cap releases the credits');
});

if(failures){console.log(`\ncheck-campaign-dome: ${failures} failed`);process.exit(1);}
console.log('\ncheck-campaign-dome: PASS');
