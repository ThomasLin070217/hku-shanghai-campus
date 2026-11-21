/**
 * Headless checks for the persistent campus-threat state.
 *
 * The sky barrier is shared by the opening and the lion-boss route, so these tests
 * pin the contract that matters: the seal survives a reload, the three endgame
 * facts are mandatory, and a purged campus can never be re-sealed by a stale save.
 */
import assert from 'node:assert/strict';
import {
 WORLD_THREAT_KEY,
 allEndgameConditionsMet,
 loadWorldThreat,
 markLionDefeated,
 markLocalModelCleared,
 markPowerCut,
 parseWorldThreat,
 resetWorldThreat,
 sealWorld,
 tryPurgeWorld,
 type WorldThreatStorage,
} from '../src/gameplay/worldThreat';
import {OPENING_SAVE_KEY} from '../src/opening/persistence';

class MemoryStorage implements WorldThreatStorage {
 private values=new Map<string,string>();
 getItem(key:string){return this.values.get(key)??null;}
 setItem(key:string,value:string){this.values.set(key,value);}
 removeItem(key:string){this.values.delete(key);}
 keys(){return[...this.values.keys()];}
}

const openingSealed=JSON.stringify({
 version:1,mode:'opening',worldRevision:'test',savedAt:1234,
 story:{stage:'to_b4',events:[]},runtime:{curtain_deployed:true},
});
const openingClear=JSON.stringify({
 version:1,mode:'opening',worldRevision:'test',savedAt:1235,
 story:{stage:'bus',events:[]},runtime:{curtain_deployed:false},
});

// A fresh install starts clear and writes the migrated record once.
{
 const storage=new MemoryStorage();
 const cleared=loadWorldThreat({storage,now:100});
 assert.equal(cleared.phase,'clear');
 assert.equal(cleared.sealedAt,null);
 assert.equal(cleared.purgedAt,null);
 assert.equal(allEndgameConditionsMet(cleared),false,'a new campus is not cleared');
 assert.ok(storage.getItem(WORLD_THREAT_KEY),'the migrated clear record is persisted');
}

// A legacy opening save with curtain_deployed=true migrates into a sealed world.
{
 const storage=new MemoryStorage();
 storage.setItem(OPENING_SAVE_KEY,openingSealed);
 const migrated=loadWorldThreat({storage,now:200});
 assert.equal(migrated.phase,'sealed');
 assert.equal(migrated.sealedAt,1234,'migration keeps the original seal time');
 assert.equal(loadWorldThreat({storage,now:201}).phase,'sealed','the migrated seal persists');
}

// A legacy opening save that was never sealed must not create a dome.
{
 const storage=new MemoryStorage();
 storage.setItem(OPENING_SAVE_KEY,openingClear);
 assert.equal(loadWorldThreat({storage,now:250}).phase,'clear');
}

// The seal is persisted and idempotent.
{
 const storage=new MemoryStorage();
 const sealed=sealWorld(300,storage);
 assert.equal(sealed.phase,'sealed');
 assert.equal(sealed.sealedAt,300);
 assert.equal(loadWorldThreat({storage,now:301}).phase,'sealed','reload keeps the seal');
 const again=sealWorld(400,storage);
 assert.equal(again.sealedAt,300,'sealing an already-sealed campus keeps the first timestamp');
}

// All three endgame facts are required; checking them is append-only.
{
 const storage=new MemoryStorage();
 sealWorld(500,storage);
 let threat=markLionDefeated(510,storage);
 assert.equal(threat.flags.lionDefeated,true);
 assert.equal(threat.flags.powerCut,false);
 assert.equal(tryPurgeWorld(511,storage).purged,false,'lion alone must not lift the barrier');
 threat=markPowerCut(520,storage);
 assert.equal(tryPurgeWorld(521,storage).purged,false,'power alone must not lift the barrier');
 threat=markLocalModelCleared(530,storage);
 assert.equal(threat.flags.localModelCleared,true);
 const purge=tryPurgeWorld(540,storage);
 assert.equal(purge.purged,true);
 assert.equal(purge.threat.phase,'purged');
 assert.equal(purge.threat.purgedAt,540);
 assert.equal(loadWorldThreat({storage,now:541}).phase,'purged','the purge persists');
}

// Purged is terminal: a stale opening save or a repeated seal cannot darken the campus again.
{
 const storage=new MemoryStorage();
 storage.setItem(OPENING_SAVE_KEY,openingSealed);
 sealWorld(600,storage);
 markLionDefeated(601,storage);
 markPowerCut(602,storage);
 markLocalModelCleared(603,storage);
 assert.equal(tryPurgeWorld(604,storage).purged,true);
 assert.equal(sealWorld(605,storage).phase,'purged','a stale seal is ignored after the purge');
 assert.equal(loadWorldThreat({storage,now:606}).phase,'purged');
}

// Explicit new game rewrites a clear record; the old opening save cannot re-seal it.
{
 const storage=new MemoryStorage();
 storage.setItem(OPENING_SAVE_KEY,openingSealed);
 sealWorld(700,storage);
 const reset=resetWorldThreat(storage);
 assert.equal(reset.phase,'clear');
 assert.equal(reset.flags.lionDefeated,false);
 assert.equal(loadWorldThreat({storage,now:701}).phase,'clear','reset beats the old opening save');
 assert.equal(loadWorldThreat({storage,openingSaveRaw:openingSealed,now:702}).phase,'clear','an explicit clear record outranks migration');
}

// A corrupt record is preserved for inspection, then the opening save migrates it.
{
 const storage=new MemoryStorage();
 storage.setItem(WORLD_THREAT_KEY,'{not-json');
 storage.setItem(OPENING_SAVE_KEY,openingSealed);
 const recovered=loadWorldThreat({storage,now:800});
 assert.equal(recovered.phase,'sealed');
 assert.ok(storage.keys().some(key=>key.startsWith(WORLD_THREAT_KEY+'.unreadable.')),'the corrupt record is backed up');
 assert.equal(loadWorldThreat({storage,now:801}).phase,'sealed');
}

// Strict parsing rejects unknown versions and inconsistent records.
{
 assert.equal(parseWorldThreat(null),null);
 assert.equal(parseWorldThreat({schemaVersion:2,phase:'sealed',sealedAt:1,purgedAt:null,flags:{lionDefeated:false,powerCut:false,localModelCleared:false}}),null);
 assert.equal(parseWorldThreat({schemaVersion:1,phase:'sealed',sealedAt:null,purgedAt:null,flags:{lionDefeated:false,powerCut:false,localModelCleared:false}}),null);
 assert.equal(parseWorldThreat({schemaVersion:1,phase:'purged',sealedAt:1,purgedAt:null,flags:{lionDefeated:true,powerCut:true,localModelCleared:true}}),null);
 assert.equal(parseWorldThreat({schemaVersion:1,phase:'clear',sealedAt:null,purgedAt:null,flags:{lionDefeated:1,powerCut:false,localModelCleared:false}}),null);
}

// Storage-less callers still get deterministic in-memory behaviour.
{
 const migrated=loadWorldThreat({storage:null,openingSaveRaw:openingSealed,now:900});
 assert.equal(migrated.phase,'sealed');
 assert.equal(sealWorld(901,null).phase,'sealed','in-memory sealing still works without storage');
 assert.equal(loadWorldThreat({storage:null,now:902}).phase,'clear','without storage the seal is session-only');
}

console.log('PASS world threat: migration, reload persistence, three-fact purge gate, purged terminal state, reset and corrupt-record backup');
