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

type Tile={x:number;y:number;z:number;tilt:number;delay:number;mesh:T.InstancedMesh;index:number;angle:number};
const ease=(t:number)=>t*t*(3-2*t);

export function createB5FlipWall(){
 const root=new T.Group();
 root.name=B5_FLIP_WALL_NAME;
 root.userData={...SOURCE,authorKey:B5_FLIP_WALL_NAME,sceneLabel:'HKU flip wall · Building 5 lobby (ambient)'};

 // Take only the wall from the observed flip-wall room: B5 supplies its own lobby shell,
 // so the builder is asked for the wall part alone.
 const room=buildObservedFeatureRoom('flipWall',{parts:['wall']});
 const wall=room.getObjectByName('HKU_flip_wall');
 if(!wall)throw new Error('the observed flip-wall builder has no HKU_flip_wall part');
 wall.removeFromParent();
 const mount=new T.Group();
 mount.name='B5_flip_wall_mount';
 mount.userData={...SOURCE,authorKey:'B5_flip_wall_mount'};
 mount.position.fromArray(B5_FLIP_WALL_ORIGIN);
 mount.rotation.y=B5_FLIP_WALL_YAW;
 mount.add(wall);
 // The wall's own compacted timber and backing never cast; only the plaque does (the shadow
 // budget is asserted in check-campaign-b4.ts). The tiles below are instanced and also skip it.
 wall.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
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
  // +x is the plaque's east (lobby-facing) side: the ink stands 1–5 mm proud of that face
  // instead of sitting inside the plaque body, where it would be invisible.
  line.position.set(.013,.07-i*.075,0);
  line.userData={...SOURCE,authorKey:'B5_flip_wall_plaque_line'};
  plaque.add(line);
 }

 // One warm wash, low and close, inside the lobby: the wall sits on the shaded west side.
 const wash=new T.PointLight(0xffe6bd,3,4,2);
 wash.name='B5_flip_wall_wash';
 wash.position.set(56.2,3.35,-60.7);
 root.add(wash);

 // The observed wall ships 561 separate tile groups, each with its own geometry and a
 // shadow-casting 6-material face. In the lobby the wall is only ever seen at rest or
 // mid-ripple, so the tiles become two InstancedMeshes (dark and light). The builder keeps
 // producing its per-tile groups for the preview and the GLB exports; only this mount swaps them.
 const groups=flipWallTiles(mount);
 // Sorted by row + column so the turn travels diagonally across the wall.
 const ranks=groups.map(g=>Number(g.userData.row??0)+Number(g.userData.column??0));
 const lo=Math.min(...ranks),hi=Math.max(...ranks),span=Math.max(1,hi-lo);
 const faceOf=(group:T.Group)=>group.children.find((c):c is T.Mesh=>c instanceof T.Mesh&&c.name==='Flip_tile_face');
 const firstFace=faceOf(groups[0]!);
 if(!firstFace)throw new Error(`the observed flip wall tile ${groups[0]!.name} has no Flip_tile_face`);
 // One tile box for every instance; material arrays are the builder's own, shared by all faces
 // (edge, edge, edge, edge, front, back), so no material is cloned or disposed here.
 const faceSize=(firstFace.geometry as T.BoxGeometry).parameters;
 const faceMaterials=new Map<'dark'|'light',T.Material[]>();
 for(const group of groups){
  const face=faceOf(group);
  if(!face)throw new Error(`the observed flip wall tile ${group.name} has no Flip_tile_face`);
  const key=group.userData.front==='green'?'dark':'light';
  if(!faceMaterials.has(key))faceMaterials.set(key,[face.material].flat() as T.Material[]);
 }
 const tileGeometry=new T.BoxGeometry(faceSize.width,faceSize.height,faceSize.depth);
 const darkCount=groups.filter(g=>g.userData.front==='green').length;
 const darkTiles=new T.InstancedMesh(tileGeometry,faceMaterials.get('dark')!,darkCount);
 darkTiles.name='B5_flip_tiles_dark';
 darkTiles.userData={...SOURCE,authorKey:'B5_flip_tiles_dark'};
 darkTiles.castShadow=false;darkTiles.receiveShadow=true;
 const lightTiles=new T.InstancedMesh(tileGeometry,faceMaterials.get('light')!,groups.length-darkCount);
 lightTiles.name='B5_flip_tiles_light';
 lightTiles.userData={...SOURCE,authorKey:'B5_flip_tiles_light'};
 lightTiles.castShadow=false;lightTiles.receiveShadow=true;
 const tilesParent=groups[0]!.parent!;

 // Capture the rest pose (position + the row's small x tilt) and the diagonal delay, then
 // remove the per-tile groups and their geometries. The instance matrices reproduce the
 // groups' local matrices exactly, under the same parent, so the mounted wall is unchanged.
 const scratch=new T.Object3D();
 const tiles:Tile[]=[];
 let darkIndex=0,lightIndex=0;
 for(let i=0;i<groups.length;i++){
  const group=groups[i]!,dark=group.userData.front==='green';
  const mesh=dark?darkTiles:lightTiles,index=dark?darkIndex++:lightIndex++;
  scratch.position.copy(group.position);
  scratch.rotation.set(group.rotation.x,0,0);
  scratch.updateMatrix();
  mesh.setMatrixAt(index,scratch.matrix);
  tiles.push({x:group.position.x,y:group.position.y,z:group.position.z,tilt:group.rotation.x,delay:B5_FLIP_STAGGER*(ranks[i]!-lo)/span,mesh,index,angle:0});
  group.removeFromParent();
  faceOf(group)?.geometry.dispose();
 }
 darkTiles.instanceMatrix.needsUpdate=true;lightTiles.instanceMatrix.needsUpdate=true;
 tilesParent.add(darkTiles);
 tilesParent.add(lightTiles);
 // A half turn about each tile's own y axis can swing its corners outside the rest box, so pad
 // the spheres by one tile diagonal: the wall is never culled mid-ripple.
 const pad=Math.hypot(faceSize.width,faceSize.depth);
 for(const mesh of [darkTiles,lightTiles]){mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=pad;}

 let phase:'idle'|'open'|'close'='idle',clock=0,cooldown=0;

 /** Turn every tile to `amount` of a half turn, staggered by its diagonal delay. */
 function paint(amount:(delay:number)=>number){
  for(const tile of tiles){
   tile.angle=Math.PI*ease(T.MathUtils.clamp(amount(tile.delay),0,1));
   scratch.position.set(tile.x,tile.y,tile.z);
   scratch.rotation.set(tile.tilt,tile.angle,0);
   scratch.updateMatrix();
   tile.mesh.setMatrixAt(tile.index,scratch.matrix);
  }
  darkTiles.instanceMatrix.needsUpdate=true;
  lightTiles.instanceMatrix.needsUpdate=true;
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
  // The two InstancedMeshes share one geometry, so dispose each resource exactly once.
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  root.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   geometries.add(o.geometry);
   for(const m of [o.material].flat())materials.add(m);
  });
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
 }

 return{
  root,
  /** `dt` is 0 while the game is paused, which freezes the ripple with the rest of the world. */
  update,
  dispose,
  /** Read-only view for checks: the phase, the cooldown and how far the ripple has turned. */
  debug:{
   state(){return{phase,cooldown:+cooldown.toFixed(2),turned:tiles.filter(t=>t.angle>.01).length,total:tiles.length};},
  },
 };
}
