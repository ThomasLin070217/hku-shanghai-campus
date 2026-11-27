import * as T from 'three';
import {buildObservedFeatureRoom,flipWallTiles} from '../model/observedFeatureRooms';
import {OPENING,B6_HALL} from './spatialLayout';

/**
 * The HKU flip wall, in Building 6's ground hall.
 *
 * Owner ruling (2026-11-27): the wall you can flip is in the middle building, not in
 * CDS-1 and not in the Building 5 lobby — 「那个翻盘的那个HQ翻盘的，明明是在 6号楼，
 * 也就是最中间那一个。入门左转是电梯，入门右转是饭堂。」 It hangs on the hall's north
 * wall, facing the entrance, so a player who walks in sees it before turning either way.
 *
 * Ambient scenery only: no campaign state, no save field, no key binding, no
 * collision beyond the panel's own 14 cm. When the player first comes within 6 m the
 * tiles turn over in a diagonal ripple, hold, then settle back, at most once every 25 s.
 */
export const B6_FLIP_WALL_NAME='B06_flip_wall';
/** The built node names, exported so a gate can find the parts without a second copy
 * of any string (a mistyped copy of one of these silently matched nothing). */
export const B6_FLIP_MOUNT_NAME='B6_flip_wall_mount';
export const B6_FLIP_PLAQUE_NAME='B6_flip_wall_plaque';
export const B6_FLIP_PLAQUE_LINE_NAME='B6_flip_wall_plaque_line';
export const B6_FLIP_TILES_DARK_NAME='B6_flip_tiles_dark';
export const B6_FLIP_TILES_LIGHT_NAME='B6_flip_tiles_light';
/** Where the built panel's louvred face sits (x centre, z face plane), and which way it looks (+z, south). */
export const B6_FLIP_WALL_ORIGIN:[number,number,number]=[B6_HALL.flipWall.x,OPENING.b6.floor,B6_HALL.flipWall.z];
export const B6_FLIP_WALL_YAW=B6_HALL.flipWall.yaw;
/** Proximity that starts the ripple, and the rhythm of the ripple itself. */
export const B6_FLIP_TRIGGER=6;
export const B6_FLIP_STAGGER=.9;
export const B6_FLIP_TURN=.3;
export const B6_FLIP_HOLD=6;
export const B6_FLIP_COOLDOWN=25;
const SOURCE={
 sourceFile:'src/opening/b6FlipWall.ts',
 source:'Owner ruling 2026-11-27 (wall is in Building 6, the middle building) + WeChat vibe group 2026-11-21 + the November 15 flip-wall photo and c2f30ae164433b4a517b2ed5d80b7460.mp4 00:00–00:17.6',
 confidence:'building ruled by the owner; hall position is the north wall facing the doors',
};

type Tile={x:number;y:number;z:number;tilt:number;delay:number;mesh:T.InstancedMesh;index:number;angle:number};
const ease=(t:number)=>t*t*(3-2*t);

export function createB6FlipWall(){
 const root=new T.Group();
 root.name=B6_FLIP_WALL_NAME;
 root.userData={...SOURCE,authorKey:B6_FLIP_WALL_NAME,sceneLabel:'HKU flip wall · Building 6 ground hall (ambient)'};

 // Take only the wall from the observed flip-wall room: the hall supplies its own shell.
 const room=buildObservedFeatureRoom('flipWall',{parts:['wall']});
 const wall=room.getObjectByName('HKU_flip_wall');
 if(!wall)throw new Error('the observed flip-wall builder has no HKU_flip_wall part');
 wall.removeFromParent();
 wall.position.set(0,0,0);
 wall.updateMatrixWorld(true);
 const localBox=new T.Box3().setFromObject(wall);
 const mount=new T.Group();
 mount.name=B6_FLIP_MOUNT_NAME;
 mount.userData={...SOURCE,authorKey:B6_FLIP_MOUNT_NAME};
 // The builder's +Z face is the visible louvred face. With yaw 0 it looks south into the
 // hall, and the panel body sits between the face and the north wall.
 // The declared plane is the panel's FACE (W.z + W.depth), the plane the collision covers;
 // the timber backing behind it buries in the north wall, where nobody can see or touch it.
 mount.position.set(
  B6_FLIP_WALL_ORIGIN[0]-(localBox.min.x+localBox.max.x)/2,
  B6_FLIP_WALL_ORIGIN[1],
  B6_FLIP_WALL_ORIGIN[2]+B6_HALL.flipWall.depth-localBox.max.z,
 );
 mount.rotation.y=B6_FLIP_WALL_YAW;
 mount.add(wall);
 // The wall's own compacted timber and backing never cast; only the plaque does thereafter.
 wall.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
 root.add(mount);

 // A plaque on the hall wall beside the panel, so the wall reads as a place, not a prop.
 const plaqueMaterial=new T.MeshStandardMaterial({name:'B6 flip wall plaque brass',color:0xb99a5e,roughness:.5,metalness:.55});
 const plaque=new T.Mesh(new T.BoxGeometry(.62,.24,.02),plaqueMaterial);
 plaque.name=B6_FLIP_PLAQUE_NAME;
 plaque.position.set(B6_HALL.flipWall.x+B6_HALL.flipWall.width/2+.55,OPENING.b6.floor+1.35,OPENING.b6.z0+.011);
 plaque.castShadow=plaque.receiveShadow=true;
 plaque.userData={...SOURCE,authorKey:B6_FLIP_PLAQUE_NAME};
 root.add(plaque);
 const ink=new T.MeshStandardMaterial({name:'B6 flip wall plaque ink',color:0x2c2a24,roughness:.8,metalness:.05});
 for(let i=0;i<3;i++){
  const line=new T.Mesh(new T.BoxGeometry(.4-i*.09,.022,.004),ink);
  line.name=B6_FLIP_PLAQUE_LINE_NAME;
  line.position.set(0,.07-i*.075,.013);
  line.userData={...SOURCE,authorKey:B6_FLIP_PLAQUE_LINE_NAME};
  plaque.add(line);
 }

 // One warm wash, low and close, on the north wall the panel hangs from.
 const wash=new T.PointLight(0xffe6bd,4,5,2);
 wash.name='B6_flip_wall_wash';
 wash.position.set(B6_HALL.flipWall.x,OPENING.b6.floor+3.45,B6_HALL.flipWall.z+1.1);
 root.add(wash);

 // The observed wall ships 561 separate tile groups. In the hall the wall is only ever
 // seen at rest or mid-ripple, so the tiles become two InstancedMeshes (dark and light).
 const groups=flipWallTiles(mount);
 // Sorted by row + column so the turn travels diagonally across the wall.
 const ranks=groups.map(g=>Number(g.userData.row??0)+Number(g.userData.column??0));
 const lo=Math.min(...ranks),hi=Math.max(...ranks),span=Math.max(1,hi-lo);
 const faceOf=(group:T.Group)=>group.children.find((c):c is T.Mesh=>c instanceof T.Mesh&&c.name==='Flip_tile_face');
 const firstFace=faceOf(groups[0]!);
 if(!firstFace)throw new Error(`the observed flip wall tile ${groups[0]!.name} has no Flip_tile_face`);
 const faceSize=(firstFace.geometry as T.BoxGeometry).parameters;
 const faceMaterials=new Map<'dark'|'light',T.Material[]>();
 for(const group of groups){
  const face=faceOf(group);
  if(!face)throw new Error(`the observed flip wall tile ${group.name} has no Flip_tile_face`);
  const key=group.userData.front==='green'?'dark':'light';
  if(!faceMaterials.has(key))faceMaterials.set(key,[face.material].flat() as T.Material[]);
 }
 // A clone of the builder's face, not a fresh box: voxelizeMaterials rewrote its UVs to the
 // pixel scale, and every tile face is the same size, so one clone keeps the texel scale.
 const tileGeometry=firstFace.geometry.clone();
 const darkCount=groups.filter(g=>g.userData.front==='green').length;
 const darkTiles=new T.InstancedMesh(tileGeometry,faceMaterials.get('dark')!,darkCount);
 darkTiles.name=B6_FLIP_TILES_DARK_NAME;
 darkTiles.userData={...SOURCE,authorKey:B6_FLIP_TILES_DARK_NAME};
 darkTiles.castShadow=false;darkTiles.receiveShadow=true;
 const lightTiles=new T.InstancedMesh(tileGeometry,faceMaterials.get('light')!,groups.length-darkCount);
 lightTiles.name=B6_FLIP_TILES_LIGHT_NAME;
 lightTiles.userData={...SOURCE,authorKey:B6_FLIP_TILES_LIGHT_NAME};
 lightTiles.castShadow=false;lightTiles.receiveShadow=true;
 const tilesParent=groups[0]!.parent!;

 // Capture the rest pose (position + the row's small x tilt) and the diagonal delay, then
 // remove the per-tile groups and their geometries.
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
  tiles.push({x:group.position.x,y:group.position.y,z:group.position.z,tilt:group.rotation.x,delay:B6_FLIP_STAGGER*(ranks[i]!-lo)/span,mesh,index,angle:0});
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
   const near=Math.hypot(player.x-B6_FLIP_WALL_ORIGIN[0],player.z-B6_FLIP_WALL_ORIGIN[2])<=B6_FLIP_TRIGGER;
   if(!near)return;
   phase='open';clock=0;cooldown=B6_FLIP_COOLDOWN;
  }
  if(dt<=0)return;
  clock+=dt;
  if(phase==='open'){
   paint(delay=>(clock-delay)/B6_FLIP_TURN);
   if(clock>=B6_FLIP_HOLD){phase='close';clock=0;}
   return;
  }
  paint(delay=>1-(clock-delay)/B6_FLIP_TURN);
  if(clock>=B6_FLIP_STAGGER+B6_FLIP_TURN){phase='idle';clock=0;paint(()=>0);}
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
