/** U04=IMG_4339, U05=IMG_4342, M02=HEIC shelter map, M03=campus directory.
 * Metres. Positions/measurements are estimates unless explicitly marked. */
import {LION,lionBodySize} from './lionParameters';
import {COLUMN_SHIFT as DX} from './scaleCalibration';
export const NOV13={
 units:'metres',revision:'2026-11-14-v9-scale1-glass1-experience1-U06',
 openEastPromenade:true,
 lion:{id:'entrance-lion',x:LION.x,z:LION.z,height:LION.bodyHeight+LION.support.height,width:lionBodySize().width,depth:lionBodySize().depth,uncertainty:LION.uncertainty},
 // E/W mirrored flights inside the basin, leaving the existing outer accessible ramp intact.
 stairs:{count:28,rise:.15,run:.40,width:2.0,x:9.0,startZ:-12.8},
 benches:[{id:'promenade-bench-01',x:22.1+DX,z:-15},{id:'promenade-bench-02',x:22.1+DX,z:6}],
 mapSign:{id:'campus-directory',x:15.2+DX,z:61,width:.9,depth:.18,height:2.15},
};
export function plazaStairHeight(x:number,z:number,plazaZ:number,plazaDepth:number){const s=NOV13.stairs,start=plazaZ-s.startZ;if(Math.abs(Math.abs(x)-s.x)>s.width/2||z>start||z<start-s.count*s.run)return null;const i=Math.min(s.count-1,Math.floor((start-z)/s.run));return -Math.min(plazaDepth,(i+1)*s.rise);}
