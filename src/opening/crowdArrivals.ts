/**
 * Where the plaza crowd ends up: the B5 hall, as guests at the dinner.
 *
 * The students walk about 150 m from the plaza to Building 5 with the player (about 182 s). The route's last
 * waypoint is one point in the lobby, and each student used to be collapsed to scale 0 on
 * arrival, so all 52 vanished in the room the player was walking into. They now leave the route
 * at their own place in the hall and stand there for the rest of the chapter.
 *
 * Places are found with the game's own collision (`blocked`), so a table, an arch pier or the
 * dais can never host a guest, and the result depends only on `count`: a reload does not
 * reshuffle the room. Around each table first, where guests at a dinner stand; the aisles and
 * the open floor take the rest.
 */
export type Place=readonly [number,number];

/** Standing width a guest needs. Two arrivals closer than this render as one flickering figure. */
export const ARRIVAL_SPACING=.62;

export interface ArrivalWorld{
 blocked(x:number,z:number,y:number,r?:number):boolean;
 support(x:number,z:number,y:number):number|null;
}

/** The part of a navigation world the crowd reads: the side-effect-free ground and the obstacles. */
 export interface CrowdBase{
 floorAt(x:number,z:number,y:number):number|null;
 blocked(x:number,z:number,y:number,r?:number):boolean;
 }

/**
 * The crowd's own view of the ground: the same floors and the same obstacles as the player's
 * world, minus the side effects.
 *
 * Why this exists (2026-11-25): the player's `world.support` is not a pure question. It is the
 * clock the lift and the Building 4 office run on — every call is handed to `tickOffice` and
 * `tickLift` as "the point the player stands at". The crowd asks where the floor is about 52
 * times a frame while it walks, and it used to ask `support`, with *student* coordinates. So the
 * crowd alone carried a called lift the whole 18.88 m down while the player was reading a panel
 * (the lift is meant to move only while the player is asking), and kept the office's clocks
 * running.
 *
 * It must read `world.floorAt`, never `world.support`. The first version of this function took a
 * floor rule and applied it to `base().support(...)): that still called the ticking query and
 * then applied the floors a second time on top of its answer — idempotent for heights, so every
 * "same ground" check passed, and the ticks were still there. A test built on a world with the
 * opening hook switched off could not see it. `floorAt` is the same arithmetic with the ticks
 * left out, so there is nothing left to get wrong here.
 *
 * `base` returns the player's CURRENT navigation world rather than the world itself, because
 * that world is replaced whole by a campus rebuild (`explorer.rebuild`): a crowd holding the old
 * one would keep asking a disposed world where the floor is.
 */
 export function crowdWorld(base:()=>CrowdBase):ArrivalWorld{
 return{
  support:(x,z,y)=>base().floorAt(x,z,y),
  blocked:(x,z,y,r)=>base().blocked(x,z,y,r),
 };
}

/** The B5 hall, in world metres. The partition at x 60 has its opening at z -63..-57.6. */
const HALL={x0:60.8,x1:80.6,z0:-78.4,z1:-56.4,floor:.02} as const;

/** Keep the head table and the dais clear: the high table is the ceremony's own place. */
const HEAD_TABLE={x:80.8,z:-66.6,clear:2.2} as const;

/** A rectangle of floor that is already taken by something a body cannot share: a chair. */
export interface Occupied{x:number;z:number;half:number}

/** A dinner table as the collision world knows it: a solid box with its centre and full extents. */
export interface TableBox{x:number;z:number;w:number;d:number}

/**
 * The dinner tables, read out of the collision world itself, so the places a guest stands can
 * never drift from the boxes a player walks into. Each is named `opening-b5-table-<i>` there.
 */
export function dinnerTables(world:{obstacles:readonly {name:string;x:number;z:number;w:number;d:number}[]}):TableBox[]{
 return world.obstacles.filter(o=>/^opening-b5-table-\d+$/.test(o.name)).map(({x,z,w,d})=>({x,z,w,d}));
}

/** Deterministic, so the room is identical on every reload. */
function random(seed:number){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

/**
 * Where a guest stands at a dinner table.
 *
 * The tables run along world x after the quarter turn, 5.4 m by 1.2 m, and their chairs are on
 * the two long sides: north and south of the table, in z, at .95 m from its centre line, with the
 * back .18 further out. A guest does not stand in a chair row. They stand in the aisle beyond the
 * chairs, .45 m clear of the backrest, in a staggered line the length of the table; the short ends
 * take the rest.
 *
 * The first version of this got the axes backwards. It put guests at `x +- 1.95`, along the
 * table's length and straight through the chair rows, and the chairs have no collision, so
 * nothing stopped it: 16 of 52 students were standing inside a chair (measured 2026-11-25 against
 * the drawn seats).
 */
function* aroundTable(t:TableBox):Generator<Place>{
 const beyond=1.2/2+.95+.18+.45,reach=t.w/2-.3;
 for(let k=-2;k<=2;k++){
  const along=k*(reach/2.5);
  yield[t.x+along,t.z-beyond+(k%2?.16:-.16)];yield[t.x-along,t.z+beyond+(k%2?-.16:.16)];
 }
 yield[t.x-t.w/2-1.05,t.z];yield[t.x+t.w/2+1.05,t.z];
}

/** A loose grid over the open floor, ordered away from the door so the room fills from the back. */
function* openFloor():Generator<Place>{
 for(let z=HALL.z0+1;z<HALL.z1;z+=1.05)for(let x=HALL.x0+1.2;x<HALL.x1;x+=1.05)yield[x+((Math.round(z*10)%2)?.5:0),z];
}

/**
 * `count` unique, clear standing places in the hall, in a fixed order. A place is kept only when
 * the world says it is free floor, no chair occupies it, it is far enough from every place
 * already kept, and it is clear of the high table. The result depends only on `count` and the
 * two lists, so a reload does not reshuffle the room.
 *
 * `tables` and `chairs` come from the hall's own layout (`dinnerTables` and `dinnerChairPlaces`
 * in `spatialLayout.ts`); neither is optional. The chairs are scenery with no collision, so a
 * caller that passes an empty list gets students standing in chairs — which is what happened.
 */
export function crowdArrivals(count:number,world:ArrivalWorld,tables:readonly TableBox[],chairs:readonly Occupied[]):Place[]{
 if(!Number.isFinite(count)||count<=0)return[];
 const next=random(20301125),out:Place[]=[],body=.19;
 const onChair=(x:number,z:number)=>chairs.some(c=>Math.abs(c.x-x)<c.half+body&&Math.abs(c.z-z)<c.half+body);
 const free=(x:number,z:number)=>{
  if(x<HALL.x0||x>HALL.x1||z<HALL.z0||z>HALL.z1)return false;
  if(Math.hypot(x-HEAD_TABLE.x,z-HEAD_TABLE.z)<HEAD_TABLE.clear)return false;
  if(onChair(x,z))return false;
  const h=world.support(x,z,HALL.floor+.5);
  if(h===null)return false;
  return !world.blocked(x,z,h);
 };
 const keep=(x:number,z:number)=>{
  for(const [ox,oz] of out)if(Math.hypot(ox-x,oz-z)<ARRIVAL_SPACING)return false;
  out.push([+x.toFixed(3),+z.toFixed(3)]);return true;
 };
 for(const table of tables){for(const [x,z] of aroundTable(table)){if(out.length>=count)break;if(free(x,z))keep(x,z);}}
 if(out.length<count)for(const [x,z] of openFloor()){if(out.length>=count)break;if(free(x,z))keep(x,z);}
 /* Still short (a hall rebuilt with less floor): jitter the open floor rather than overlap. */
 for(let guard=0;out.length<count&&guard<20000;guard++){
  const x=HALL.x0+next()*(HALL.x1-HALL.x0),z=HALL.z0+next()*(HALL.z1-HALL.z0);
  if(free(x,z))keep(x,z);
 }
 return out;
}

/**
 * The way in from a lobby point to a place in the hall, as a route around the furniture.
 *
 * The first version returned `[door, place]`, and the straight line from the door to the place
 * crossed a dinner table for 41 of the 52 students (review D2, 2026-11-25). The tables are
 * solid to the player but the crowd does not collide, so the only place to fix it is the route.
 *
 * The router samples the hall on a .4 m grid once: a cell is open when the crowd's own world
 * does not block a .3 m body there AND no chair footprint is within .3 m of it (the chairs are
 * scenery and have no collision). One breadth-first search from the door cell reaches every
 * place, and each route is string-pulled: the farthest point that can be seen in a straight
 * line, checked every 5 cm. The result starts at the partition opening, follows the aisles,
 * and ends at the student's own place.
 */
export type HallRoute=(fromX:number,fromZ:number,to:Place)=>Place[];

export function createHallRouter(world:ArrivalWorld,chairs:readonly Occupied[]):HallRoute{
 const CELL=.4,CLEAR=.3;
 const nx=Math.floor((HALL.x1-HALL.x0)/CELL)+1,nz=Math.floor((HALL.z1-HALL.z0)/CELL)+1;
 const xAt=(i:number)=>HALL.x0+i*CELL,zAt=(j:number)=>HALL.z0+j*CELL;
 const open=new Uint8Array(nx*nz);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=xAt(i),z=zAt(j),h=world.support(x,z,HALL.floor+.3);
  let ok=h!==null&&!world.blocked(x,z,h,CLEAR);
  if(ok)for(const c of chairs)if(Math.abs(c.x-x)<c.half+CLEAR&&Math.abs(c.z-z)<c.half+CLEAR){ok=false;break;}
  open[j*nx+i]=ok?1:0;
 }
 /** A .3 m body can stand at this point: the same rule the grid uses, for line-of-sight. */
 const clearAt=(x:number,z:number)=>{
  const h=world.support(x,z,HALL.floor+.3);
  if(h===null||world.blocked(x,z,h,CLEAR))return false;
  for(const c of chairs)if(Math.abs(c.x-x)<c.half+CLEAR&&Math.abs(c.z-z)<c.half+CLEAR)return false;
  return true;
 };
 const clearLine=(ax:number,az:number,bx:number,bz:number)=>{
  const d=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(d/.05));
  for(let k=1;k<=n;k++){const t=k/n;if(!clearAt(ax+(bx-ax)*t,az+(bz-az)*t))return false;}
  return true;
 };
 const nearestOpen=(x:number,z:number)=>{
  let best=-1,bestD=Infinity;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
   if(!open[j*nx+i])continue;
   const d=Math.hypot(xAt(i)-x,zAt(j)-z);
   if(d<bestD){bestD=d;best=j*nx+i;}
  }
  return best;
 };
 return(fromX,fromZ,to)=>{
  // Already east of the partition plane: the place alone. `>` (not `> 60.6`) so a body
  // standing exactly at 60.6 is not sent back through the door (review D8).
  if(fromX>60)return[to];
  const doorZ=fromZ>=-63&&fromZ<=-57.6?fromZ:-60.3;
  const door:Place=[60,doorZ];
  const start=nearestOpen(HALL.x0,doorZ);
  const dist=new Int32Array(nx*nz).fill(-1),prev=new Int32Array(nx*nz).fill(-1),queue=new Int32Array(nx*nz);
  if(start>=0){
   let head=0,tail=0;dist[start]=0;queue[tail++]=start;
   while(head<tail){
    const cell=queue[head++],ci=cell%nx,cj=(cell-ci)/nx;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
     const ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=nx||nj>=nz)continue;
     const next=nj*nx+ni;if(!open[next]||dist[next]>=0)continue;
     dist[next]=dist[cell]+1;prev[next]=cell;queue[tail++]=next;
    }
   }
  }
  // The nearest REACHED cell to the place; a cell behind a table is not a target.
  let end=-1,endD=Infinity;
  if(start>=0)for(let cell=0;cell<open.length;cell++){
   if(dist[cell]<0)continue;
   const d=Math.hypot(xAt(cell%nx)-to[0],zAt((cell-cell%nx)/nx)-to[1]);
   if(d<endD){endD=d;end=cell;}
  }
  /* No grid route (a hall rebuilt around the crowd): keep the old straight line rather than
   * teleporting. The arrivals test asserts every segment, so this cannot pass unnoticed. */
  if(start<0||end<0)return[door,to];
  const cells:Place[]=[];for(let cell=end;cell>=0;cell=prev[cell])cells.push([xAt(cell%nx),zAt((cell-cell%nx)/nx)]);
  cells.reverse();
  const points:Place[]=[door,...cells,to];
  // String-pull: from each anchor, take the farthest point the body can walk to in a straight line.
  const out:Place[]=[points[0]!];
  let at=0;
  while(at<points.length-1){
   let far=at+1,probe=Math.min(at+12,points.length-1);
   while(probe>at+1&&!clearLine(points[at]![0],points[at]![1],points[probe]![0],points[probe]![1]))probe--;
   far=probe;
   out.push(points[far]!);at=far;
  }
  return out;
 };
}
