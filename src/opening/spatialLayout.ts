/**
 * Metres; local gameplay rooms are provisional 2030 scenery, not surveyed interiors.
 *
 * The shuttle is parked nose-to-tail with the Building 4 arrival road (R009): the
 * body runs along +X, its passenger door faces north onto the entrance forecourt.
 * That is why `width` is the road-width across Z and `length` runs along X.
 */
export const OPENING_WORLD_REVISION='opening-2030-v9-b6-lift';
/**
 * The MacBook errand as the minimap draws it (owner ruling 2026-11-27: the errand lives in
 * Building 6, the middle building, and the lift is the first left inside). One array
 * serves both the B5 → B6 walk (`routeB6`) and the errand's own marker route
 * (`routeErrand`), so the two can never drift apart as they did when the errand moved house.
 */
const ROUTE_B6: [number,number][]=[[64,-61],[58,-61.5],[58,-48],[24,-48],[18,-48],[18,-26],[4,-26],[4,-52.2],[4,-55.0],[2.3,-55.0],[2.3,-56.9]];
export const OPENING={
 bus:{
  x:64.4,z:30.9,
  /** Body width across the road (Z). */
  width:2.7,
  /** Body length along the road (X). */
  length:7.0,
  floor:.54,
  /** Passenger door, centred on the north face of the bus. */
  doorX:63.4,doorZ:29.55,doorWidth:1.5,
  wheelRadius:.34,
 },
 spawn:[66.6,.54,30.6] as [number,number,number],spawnYaw:Math.PI/2,
 /** The physical invitation on the seat beside the player. */
 invitation:[65.5,1.05,31.55] as [number,number,number],
 busExit:[63.4,0,27.8] as [number,number,number],
 b5:{id:'B05',x0:54,x1:82,z0:-80,door:58,doorWidth:2.4,floor:.02,z1:-54.7,clearHeight:4.55,doorHeight:3.2},
 /** B04 (CDS-1) ground floor behind the entrance: Keyboard Wall, flip wall, aux closet and racks (campaign B4). */
 b4:{id:'B04',x0:46,x1:70,z0:7,door:58,doorWidth:2.6,floor:.02,z1:20.5,clearHeight:4.3,doorHeight:3.95,
  /** The doorway cut contains the whole revolving-door drum (x 56.75–59.25, z 20.28–22.83, cap 3.94 m);
   * the room shell's sliding door replaces it. */
  doorDepth:2.45},
 /** B06 entrance hall (owner ruling, 2026-11-27): the auditorium's south doors at x=4 open
  * onto the grand-stair landing (5.1 m); turning left inside reaches the core lift, turning
  * right reaches the canteen. The 5F principal's office sits above the canteen side, reached
  * by that lift. The floor is the campus model's entrance landing, not the plaza: the grand
  * stair tops out at 5.1 m, so a hall at plaza level would sit under the model's landing. */
 b6:{id:'B06',x0:-4,x1:15.6,z0:-62,door:4,doorWidth:2.4,floor:5.1,z1:-52.925,clearHeight:4.4,doorHeight:3.2},
 staff:[64,.02,-61] as [number,number,number],
 /** The retired Building 6 presentation-desk anchor: scenery only. The interactive
  * MacBook lives in the B4 5F principal's office (`B4_OFFICE.laptop`). */
 presentationDesk:[7.3,5.9,-58.2] as [number,number,number],
 returnPoint:[62,.02,-60] as [number,number,number],
 encounterSafe:[58,0,-53.8] as [number,number,number],
 handoff:[58,.08,25] as [number,number,number],
 /** Where the students gather after the light show — the `crowd` objective points here and
  * the crowd walk starts here, so the marker and the people agree. */
 crowdStart:[52,0,33.5] as [number,number,number],
 patrol:[[63,0,-48],[58,0,-48],[58,0,-59],[63,0,-59]] as [number,number,number][],
 /** Stage checkpoints. The story keeps its progress; capture only moves the body. */
 checkpoints:{
  bus:[66.6,.54,30.6] as [number,number,number],
  b5:[58,0,-52] as [number,number,number],
  /** The MacBook errand starts at Building 6's front entrance landing, outside the doors. */
  b6:[4,5.1,-52.1] as [number,number,number],
  b5safe:[58,0,-53.8] as [number,number,number],
  handoff:[58,.08,25] as [number,number,number],
 },
 /** The same eight units are visible before lockdown, four on each entrance flank. */
 robotFormation:[
  [55.3,0,-53.2],[55.3,0,-51.4],[55.3,0,-49.6],[55.3,0,-47.8],
  [60.7,0,-53.2],[60.7,0,-51.4],[60.7,0,-49.6],[60.7,0,-47.8],
 ] as [number,number,number][],
 /**
  * Eight patrol loops spread across the Thomas route. The first is the original
  * Building 5 ring; the rest cover the B5 forecourt, the B5/B6 link, the B6
  * approach and the Building 4 forecourt so the takeover reads campus-wide.
  */
 robotRoutes:[
  // The B5 exit corridor runs north along x = 58 from the hall door to the forecourt.
  // Every loop that used to sit on that line now patrols beside it, so the route is
  // watched and chased but never walked along a patrol edge.
  [[63,0,-52],[61,0,-52],[61,0,-48],[63,0,-48]],
  [[55,0,-51],[51.5,0,-51],[51.5,0,-46.5],[55,0,-46.5]],
  [[71.5,0,-50],[75,0,-50],[75,0,-46.5],[71.5,0,-46.5]],
  [[55,0,-44],[40,0,-44],[40,0,-36],[55,0,-36]],
  [[24,0,-48],[18,0,-48],[18,0,-30],[24,0,-30]],
  [[18,0,-26],[10,0,-26],[4,0,-26],[4,0,-52]],
  [[20,0,-48],[20,0,-20],[20,0,10],[20,0,30]],
  [[56,0,32.9],[50,0,32.9],[50,0,30.6]],
 ] as [number,number,number][][],
 routeB5:[[63.4,27.8],[52,27.8],[52,33.5],[24,33.5],[24,-48],[58,-48],[58,-61.5],[64,-61]],
 /** B5 → Building 6 entrance, then the left turn to the lift (owner ruling 2026-11-27).
  * The same array is the errand's minimap route: the MacBook lives in this building now. */
 routeB6:ROUTE_B6,
 routeErrand:ROUTE_B6,
 routeB4:[[64,-61],[58,-61.5],[58,-26],[90,-26],[90,33.5],[58,33.5],[58,25]],
} as const;

/** B04 room-shell wall thickness (`b4Layout.ts` `WALL`); repeated here so this
 * constants module stays free of a cycle back into the room layout. */
const B4_WALL=.12;
/**
 * Building 6 core lift (owner ruling, 2026-11-27: the lift is in the middle building,
 * not in CDS-1). The shaft stands in the entrance hall's left half; its east doors face
 * the entry axis, so "enter, turn left" is the lift. The car rises four floors to the 5F
 * plate — the principal's office is a 3 m landing, a 6 m corridor and the office door
 * east of the shaft.
 *
 * Kept under the `B4_LIFT` name: every consumer (lift.ts, the office module, the shell
 * and the gates) imports it by that name. The coordinates, not the name, are the layout.
 */
export const B4_LIFT={
 /** Interior faces of the car. `x1` is the hall's lift-door plane. */
 x0:-0.80,
 x1:1.40,
 z0:-58.20,z1:-55.60,
 clearHeight:2.60,
 /** Door in the east wall: 1.20 m clear, 2.30 m high, measured from the car floor.
  * The width is bounded by the sliding leaves, not chosen freely: each leaf is half the
  * doorway and slides half its width outward, so a 2.00 m doorway would leave a leaf
  * hanging 0.70 m out of the car's south wall into the hall. At 1.20 m both open leaves
  * stay inside the car's 2.60 m east wall with 0.10 m to spare. */
 door:{z0:-57.50,z1:-56.30,height:2.30},
 /** Car shell thickness shared with the room wall. */
 wall:B4_WALL,
 /** Car floor at the entrance hall, and the 5F landing four floors above it
  * (the auditorium rises 23.95 m over six floors, so 3.99 m each). */
 ground:OPENING.b6.floor,
 floorToFloor:3.99,
 landing:OPENING.b6.floor+4*3.99,
 /** Accel–cruise–decel travel and the door timing. */
 travelSeconds:5.0,
 doorSeconds:.8,
 /** How long the doors wait for a passenger before the car leaves. */
 dwellSeconds:1.4,
 /** 5F: the landing is the car footprint plus a 3.0 m lobby, then a 6.0 m corridor. */
 lobbyDepth:3.0,corridorLength:6.0,corridorWidth:1.8,
 /** The principal's office door closes the corridor. Task E builds what is behind it. */
 officeDoor:{width:1.0,height:2.20},
} as const;

/**
 * Building 6 ground hall (owner ruling, 2026-11-27). Entered from the south face; the
 * core lift stands west of the entry axis, the canteen east of it behind a partition.
 * The HKU flip wall hangs on the north wall, facing the doors.
 */
export const B6_HALL={
 interior:{x0:OPENING.b6.x0,x1:OPENING.b6.x1,z0:OPENING.b6.z0,z1:OPENING.b6.z1,ceiling:OPENING.b6.clearHeight},
 /** Canteen partition with a 3.4 m opening; the room is east of the entry axis. */
 canteen:{partitionX:10.40,openingZ0:-58.60,openingZ1:-55.20},
 tables:[
  {x:12.15,z:-58.90,w:1.05,d:3.20,top:.76},
  {x:14.25,z:-58.90,w:1.05,d:3.20,top:.76},
 ] as const,
 counter:{x0:10.70,x1:15.30,z0:-53.78,z1:-53.14,h:.95},
 /** The observed HKU flip wall, centred on the hall's north wall and facing south.
  * `z` is the wall plane the panel backs onto; `depth` is how far it stands proud. */
 flipWall:{x:3.10,z:OPENING.b6.z0,yaw:0,width:7.374,depth:.11},
 /** The lift's shaft walls, built inside the hall (the tower mass is hollow here). */
 shaft:{wall:.12},
} as const;

/** IMG_4380: observed arrangement, estimated metres. Lobby on the left, hall on the right.
 * Existing table indices remain stable; the additional row is appended. */
export const DINNER_LAYOUT={
 source:'IMG_4380.MOV 00:00–00:27; user confirms B5 ground floor / right turn',
 partitionX:60,doorZ0:-63,doorZ1:-57.6,
 tableWidth:1.2,tableLength:5.4,
 tables:[[63.1,-66],[68.1,-66],[73.1,-66],[63.1,-74],[68.1,-74],[73.1,-74],[78.4,-66],[78.4,-74]] as [number,number][],
 chairOffsets:[-2,-1,0,1,2],
 archCenters:[63.15,68.45,73.75,79.05],archHalfWidth:2.65,
 archPiers:[60.5,65.8,71.1,76.4,81.7],
 crossWidth:23.2,crossCenter:71.9,longLength:21.4,longCenterZ:-70.7,endZ:-81.32,
 archSpring:2.72,archRise:1.6,archStations:[-62,-70,-78],
};

/** Quarter-turn of the authored hall: its long axis is east–west, parallel to B5.
 * Lobby and entry retain their positions. This transform is shared by scenery and physics. */
export function dinnerHallPoint(x:number,z:number):[number,number]{return[60.5+(-60-z),-78+(x-60.5)];}

/** A dining chair on the floor of the B5 hall, in world metres. */
export interface DinnerChair{x:number;z:number;half:number}
/**
 * Every chair drawn at the dinner tables, as the floor it occupies.
 *
 * The chairs are scenery: `world.ts` builds them as boxes and merges them into one mesh per
 * material, so there is no chair object to query afterwards, and they have no collision. Anything
 * that stands people on that floor — the plaza crowd taking its place at the dinner — has to know
 * where they are from here, or it puts a student inside a chair (found 2026-11-25: 2 of 52).
 *
 * This is the arithmetic `world.ts` uses to draw them. In authored hall coordinates a chair of
 * table `(a,b)` stands at `(a + side*.95, b + row)`: its side offset runs along authored x and its
 * row along authored z. `dinnerHallPoint` then turns the whole hall a quarter, so in the world
 * the row offset lands on x and the side offset on z. The seat is a `.44` square and the back is
 * `.18` further from the table, so a chair's footprint is about `.69` deep and `.44` wide; this
 * uses the larger on both axes, which errs toward keeping a student clear.
 *
 * The three chairs `world.ts` leaves out (they are animated elsewhere) are left out here too, so
 * the list is the chairs a player can see. Verified against the drawn seats on 2026-11-25:
 * 77 chairs, 77 seats, every seat inside exactly one chair's footprint.
 */
export function dinnerChairPlaces():DinnerChair[]{
 const out:DinnerChair[]=[],seat=.44,backOut=.18,back=.07;
 for(const [i,[a,b]] of DINNER_LAYOUT.tables.entries())for(const [j,row] of DINNER_LAYOUT.chairOffsets.entries())for(const side of [-1,1] as const){
  // The three capture chairs are animated standing chairs elsewhere, not static scenery.
  if(i<3&&j===0&&side===-1)continue;
  const [x,z]=dinnerHallPoint(a+side*(.95+backOut/2),b+row);
  out.push({x,z,half:seat/2+Math.max(backOut/2+back/2,0)});
 }
 return out;
}

/** IMG_4380 00:24 / phase2-02: low timber dais, transverse table and a lectern on the left.
 * Dimensions are provisional. All rectangles are in authored hall coordinates. */
export const DINNER_HEAD={
 stage:{x:DINNER_LAYOUT.crossCenter,z:DINNER_LAYOUT.endZ+.995,w:9.2,d:1.85,h:.14},
 table:{x:DINNER_LAYOUT.crossCenter,z:-80.32,w:5.85,d:.80,h:.78},
 lectern:{x:DINNER_LAYOUT.crossCenter-3.7,z:-80.32,w:.62,d:.56,h:1.10},
 chairRows:[-81.01,-79.64],
 chairOffsets:[-2.35,-1.41,-.47,.47,1.41,2.35],
 chair:{w:.46,d:.47,h:.93},
};
