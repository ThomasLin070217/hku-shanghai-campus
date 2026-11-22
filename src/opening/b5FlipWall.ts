import * as T from 'three';
import {buildObservedFeatureRoom,flipWallTiles} from '../model/observedFeatureRooms';

/**
 * The HKU flip wall, in the Building 5 ground-floor lobby.
 *
 * Where it stands: the November WeChat thread says the wall you can flip is on the
 * first floor of the building in front of the tennis courts, and that it is *not*
 * the CDS-1 keyboard. Building 5 (x 54–82, z −80…−54.7) is the low block between the
 * campus core and the sports strip, so its 1F lobby is the placement; the exact
 * building, floor and corridor are unverified (see `SOURCE` below).
 *
 * Ambient scenery only: no campaign state, no save field, no key binding, no
 * collision. When the player first comes within 6 m the tiles turn over in a
 * diagonal ripple, hold, then settle back, at most once every 25 s. It is here so
 * the campus reads right, not so it can be solved.
 */
export const B5_FLIP_WALL_NAME='B5_flip_wall';
/** Where the wall's own origin sits, and which way its louvred face looks (+x, east). */
export const B5_FLIP_WALL_ORIGIN:[number,number,number]=[56.36,.02,-60.70];
export const B5_FLIP_WALL_YAW=Math.PI/2;
/** Proximity that starts the ripple, and the rhythm of the ripple itself. */
export const B5_FLIP_TRIGGER=6;
export const B5_FLIP_STAGGER=.9;
export const B5_FLIP_TURN=.3;
export const B5_FLIP_HOLD=6;
export const B5_FLIP_COOLDOWN=25;
const SOURCE={
 sourceFile:'src/opening/b5FlipWall.ts',
 source:'WeChat vibe group 2026-11-21: "HKU 可以翻的那个东西，在网球场前面的那个楼的1楼" + "cds1 的键盘"; geometry from the November 15 flip-wall photo and c2f30ae164433b4a517b2ed5d80b7460.mp4 00:00–00:17.6',
 confidence:'building choice is an inference (Building 5 stands between the campus core and the tennis courts); floor and corridor placement unverified',
};

type Tile={group:T.Group;delay:number};
const ease=(t:number)=>t*t*(3-2*t);

export function createB5FlipWall(){
 const root=new T.Group();
 root.name=B5_FLIP_WALL_NAME;
 root.userData={...SOURCE,authorKey:B5_FLIP_WALL_NAME,sceneLabel:'HKU flip wall · Building 5 lobby (ambient)'};

 // Take only the wall from the observed corridor room: its shell belongs to B5 already.
 const room=buildObservedFeatureRoom('flipWall');
 const wall=room.getObjectByName('HKU_flip_wall');
 if(!wall)throw new Error('the observed flip-wall builder has no HKU_flip_wall part');
 wall.removeFromParent();
 const mount=new T.Group();
 mount.name='B5_flip_wall_mount';
 mount.position.fromArray(B5_FLIP_WALL_ORIGIN);
 mount.rotation.y=B5_FLIP_WALL_YAW;
 mount.add(wall);
 root.add(mount);

 // A plaque on the lobby wall beside the panel, so the wall reads as a place, not a prop.
 const plaqueMaterial=new T.MeshStandardMaterial({name:'B5 flip wall plaque brass',color:0xb99a5e,roughness:.5,metalness:.55});
 const plaque=new T.Mesh(new T.BoxGeometry(.02,.24,.62),plaqueMaterial);
 plaque.name='B5_flip_wall_plaque';
 // On the lobby's west wall face (x 54.15, 12 cm thick), just south of the panel.
 plaque.position.set(54.22,1.35,-56.85);
 plaque.castShadow=plaque.receiveShadow=true;
 plaque.userData={...SOURCE,authorKey:'B5_flip_wall_plaque'};
 root.add(plaque);
 const ink=new T.MeshStandardMaterial({name:'B5 flip wall plaque ink',color:0x2c2a24,roughness:.8,metalness:.05});
 for(let i=0;i<3;i++){
  const line=new T.Mesh(new T.BoxGeometry(.004,.022,.4-i*.09),ink);
  line.name='B5_flip_wall_plaque_line';
  line.position.set(-.013,.07-i*.075,0);
  line.userData={...SOURCE,authorKey:'B5_flip_wall_plaque_line'};
  plaque.add(line);
 }

 // One warm wash, low and close, inside the lobby: the wall sits on the shaded west side.
 const wash=new T.PointLight(0xffe6bd,3,4,2);
 wash.name='B5_flip_wall_wash';
 wash.position.set(56.2,3.35,-60.7);
 root.add(wash);

 // The ripple: tiles sorted by row + column so the turn travels diagonally across the wall.
 const groups=flipWallTiles(mount);
 const ranks=groups.map(g=>Number(g.userData.row??0)+Number(g.userData.column??0));
 const lo=Math.min(...ranks),hi=Math.max(...ranks),span=Math.max(1,hi-lo);
 const tiles:Tile[]=groups.map((group,i)=>({group,delay:B5_FLIP_STAGGER*(ranks[i]!-lo)/span}));

 let phase:'idle'|'open'|'close'='idle',clock=0,cooldown=0;

 /** Turn every tile to `amount` of a half turn, staggered by its diagonal delay. */
 function paint(amount:(delay:number)=>number){
  for(const tile of tiles)tile.group.rotation.y=Math.PI*ease(T.MathUtils.clamp(amount(tile.delay),0,1));
 }

 function update(dt:number,player:Readonly<T.Vector3>){
  if(dt>0&&cooldown>0)cooldown=Math.max(0,cooldown-dt);
  if(phase==='idle'){
   if(cooldown>0)return;
   const near=Math.hypot(player.x-B5_FLIP_WALL_ORIGIN[0],player.z-B5_FLIP_WALL_ORIGIN[2])<=B5_FLIP_TRIGGER;
   if(!near)return;
   phase='open';clock=0;cooldown=B5_FLIP_COOLDOWN;
  }
  if(dt<=0)return;
  clock+=dt;
  if(phase==='open'){
   paint(delay=>(clock-delay)/B5_FLIP_TURN);
   if(clock>=B5_FLIP_HOLD){phase='close';clock=0;}
   return;
  }
  paint(delay=>1-(clock-delay)/B5_FLIP_TURN);
  if(clock>=B5_FLIP_STAGGER+B5_FLIP_TURN){phase='idle';clock=0;paint(()=>0);}
 }

 function dispose(){
  root.removeFromParent();
  const materials=new Set<T.Material>();
  root.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   o.geometry.dispose();
   for(const m of [o.material].flat())materials.add(m);
  });
  for(const m of materials)m.dispose();
 }

 return{
  root,
  /** `dt` is 0 while the game is paused, which freezes the ripple with the rest of the world. */
  update,
  dispose,
  /** Read-only view for checks: the phase, the cooldown and how far the ripple has turned. */
  debug:{
   state(){return{phase,cooldown:+cooldown.toFixed(2),turned:tiles.filter(t=>t.group.rotation.y>.01).length,total:tiles.length};},
  },
 };
}
