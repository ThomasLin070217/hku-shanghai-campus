/** Metres; local gameplay rooms are provisional 2030 scenery, not surveyed interiors. */
export const OPENING_WORLD_REVISION='opening-2030-v1';
export const OPENING={
 bus:{x:65,z:34.8,width:3.0,length:9.5,floor:.54,doorX:63.5,doorZ:32.6},
 spawn:[65,.54,32.7] as [number,number,number],spawnYaw:Math.PI/2,
 busExit:[61.2,0,32.6] as [number,number,number],
 b5:{id:'B05',x0:54,x1:69,z0:-66,door:58,doorWidth:2.4,floor:0,z1:-54.7},
 b6:{id:'B06',x0:1,x1:10,z0:-62,door:4,doorWidth:2.4,floor:5.1,z1:-52.625},
 staff:[64,0,-61] as [number,number,number],
 laptop:[7.3,5.9,-58.2] as [number,number,number],
 returnPoint:[62,0,-60] as [number,number,number],
 encounterSafe:[58,0,-53.8] as [number,number,number],
 handoff:[58,.08,25] as [number,number,number],
 patrol:[[63,0,-48],[58,0,-48],[58,0,-59],[63,0,-59]] as [number,number,number][],
 routeB5:[[61.2,32.6],[58,33.5],[24,33.5],[24,-48],[58,-48],[58,-58],[64,-61]],
 routeB6:[[64,-61],[58,-59],[58,-48],[24,-48],[18,-48],[18,-26],[4,-26],[4,-52.2],[4,-58],[7.3,-58.2]],
 routeB4:[[64,-61],[58,-59],[58,-48],[24,-48],[24,33.5],[58,33.5],[58,25]],
} as const;
