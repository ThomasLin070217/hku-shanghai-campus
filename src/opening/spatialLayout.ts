/**
 * Metres; local gameplay rooms are provisional 2030 scenery, not surveyed interiors.
 *
 * The shuttle is parked nose-to-tail with the Building 4 arrival road (R009): the
 * body runs along +X, its passenger door faces north onto the entrance forecourt.
 * That is why `width` is the road-width across Z and `length` runs along X.
 */
export const OPENING_WORLD_REVISION='opening-2030-v6-b6-lift-route';
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
 /* The principal's office is on the presentation floor. The grand stair now ends
  * at a sealed 4F terrace, so the office is reached from the ground east door and
  * the lift; its south wall no longer opens onto the stair landing. */
 b6:{id:'B06',x0:1,x1:10.8,z0:-62,door:4,doorWidth:2.4,floor:5.1,z1:-57.6,clearHeight:2.65,doorHeight:2.6,doorSealed:true,
  /* Opening-only apertures. `cuts` replaces the generic room/door cutter: the
   * office cavity stops at its new south wall, while the ground lobby and the east
   * side door are additional apertures in the base glazing/core. */
  cuts:[
   {x0:1.01,y0:5.115,z0:-61.88,x1:10.79,y1:7.75,z1:-57.62},
   {x0:10.78,y0:.015,z0:-61.12,x1:14.02,y1:3.0,z1:-54.96},
   {x0:13.9,y0:-.02,z0:-57.0,x1:14.4,y1:2.64,z1:-55.2},
  ]},
 /** Ground east side door of Building 6, set in the base glazing. */
 b6SideDoor:{x:14.17,z:-56.1,width:1.8,height:2.62},
 /** Ground lift lobby inside the base recess; the floor top is the support height. */
 b6Lobby:{x0:10.8,x1:14.17,z0:-61.1,z1:-54.97,floor:.02,clearHeight:3.0},
 /** Small through-car lift: it opens east to the lobby at ground and west to the
  * office at 5.1 m. `carY` is the walkable car-floor top. */
 b6Lift:{x0:8.6,x1:10.8,z0:-61.1,z1:-58.9,doorZ0:-60.6,doorZ1:-59.4,ground:.02,upper:5.1,clearHeight:2.32,top:7.75},
 b6SideDoorApproach:[15.2,.02,-56.1] as [number,number,number],
 liftLobbyPoint:[12.6,.02,-60] as [number,number,number],
 liftGroundPoint:[9.7,1.0,-60] as [number,number,number],
 liftUpperPoint:[9.7,6.1,-60] as [number,number,number],
 liftPanelGround:[11.30,1.25,-59.15] as [number,number,number],
 liftPanelUpper:[8.20,6.35,-59.15] as [number,number,number],
 staff:[64,.02,-61] as [number,number,number],
 laptop:[7.3,5.9,-58.2] as [number,number,number],
 returnPoint:[62,.02,-60] as [number,number,number],
 encounterSafe:[58,0,-53.8] as [number,number,number],
 handoff:[58,.08,25] as [number,number,number],
 patrol:[[63,0,-48],[58,0,-48],[58,0,-59],[63,0,-59]] as [number,number,number][],
 /** Stage checkpoints. The story keeps its progress; capture only moves the body. */
 checkpoints:{
  bus:[66.6,.54,30.6] as [number,number,number],
  b5:[58,0,-52] as [number,number,number],
  b6:[7.0,5.1,-59.5] as [number,number,number],
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
  [[63,0,-48],[58,0,-48],[58,0,-59],[63,0,-59]],
  [[58,0,-51],[51.5,0,-51],[51.5,0,-46.5],[58,0,-46.5]],
  [[71.5,0,-50],[75,0,-50],[75,0,-46.5],[71.5,0,-46.5]],
  [[58,0,-48],[40,0,-48],[40,0,-40],[58,0,-40]],
  [[24,0,-48],[18,0,-48],[18,0,-30],[24,0,-30]],
  [[18,0,-26],[10,0,-26],[4,0,-26],[4,0,-52]],
  [[20,0,-48],[20,0,-20],[20,0,10],[20,0,30]],
  [[63,0,32.9],[50,0,32.9],[50,0,30.6]],
 ] as [number,number,number][][],
 routeB5:[[63.4,27.8],[52,27.8],[52,33.5],[24,33.5],[24,-48],[58,-48],[58,-61.5],[64,-61]],
 routeB6:[[64,-61],[58,-61.5],[58,-48],[24,-48],[20,-48],[20,-56.1],[16,-56.1],[13.8,-56.1],[12.4,-57.6],[11.6,-59.4],[11.15,-60]],
 /** 5F leg: step out of the lift's west door and cross the office to the desk. */
 routeB6Office:[[9.7,-60],[8.0,-60],[7.3,-59.4]],
 routeB4:[[64,-61],[58,-61.5],[58,-48],[24,-48],[24,33.5],[58,33.5],[58,25]],
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
 archSpring:2.72,archRise:1.6,archStations:[-62,-66,-70,-74,-78],
};

/** Quarter-turn of the authored hall: its long axis is east–west, parallel to B5.
 * Lobby and entry retain their positions. This transform is shared by scenery and physics. */
export function dinnerHallPoint(x:number,z:number):[number,number]{return[60.5+(-60-z),-78+(x-60.5)];}

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
