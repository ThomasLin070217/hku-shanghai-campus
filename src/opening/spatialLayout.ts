/**
 * Metres; local gameplay rooms are provisional 2030 scenery, not surveyed interiors.
 *
 * The shuttle is parked nose-to-tail with the Building 4 arrival road (R009): the
 * body runs along +X, its passenger door faces north onto the entrance forecourt.
 * That is why `width` is the road-width across Z and `length` runs along X.
 */
export const OPENING_WORLD_REVISION='opening-2030-v5-b5-full-hall';
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
 b6:{id:'B06',x0:1,x1:10,z0:-62,door:4,doorWidth:2.4,floor:5.1,z1:-52.625,clearHeight:2.65,doorHeight:2.6},
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
  b6:[4,5.1,-56] as [number,number,number],
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
 routeB6:[[64,-61],[58,-61.5],[58,-48],[24,-48],[18,-48],[18,-26],[4,-26],[4,-52.2],[4,-58],[7.3,-58.2]],
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
 archSpring:2.72,archRise:1.6,archStations:[-62,-70,-78],
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
