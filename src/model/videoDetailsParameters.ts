/** U02/U03 user footage. Component types observed; metric sizes/positions remain estimates. */
import {COLUMN_SHIFT as DX} from './scaleCalibration';
export const VIDEO_DETAILS={
 promenade:[{x:18+DX,z:-4,width:4.2,depth:88},{x:19+DX,z:-70,width:4.2,depth:46}],
 track:{x:0,z:-98,width:174,depth:3.2,height:.06},
 monument:{x:25+DX,z:29,width:3.8,height:2.05,depth:.32,rotation:.3},
 hallSign:{x:18.15,z:-88.8,width:.65,height:2.35,depth:.22},
 northernBeds:[{x:-70-DX,width:13},{x:-61-DX,width:5},{x:-43-DX,width:6},{x:-34-DX,width:10},{x:36+DX,width:13},{x:53+DX,width:13},{x:70+DX,width:13}],
 northernSteps:{building:'B07',width:6.8,run:.9,rise:.17,count:3},
 hedgeLength:12.5,
 hedgeCenters:[-40,-27,-14,-1,12,25].map(z=>({x:21.25+DX,z})),
 pathHeight:.035,
};
export const LOUNGE_PARAMETERS={width:13.4,depth:14.8,rows:6,rowRun:1.65,rowRise:.40,sideStairWidth:1.25,ceilingHeight:5.6,floor:4,building:'B05'};

/** 20261116-P03: a slim pole on the camera-left side of the stone sign. */
export const MONUMENT_NIGHT_POLE = {localX:-3.12,localZ:.94,radius:.065,height:4.85};
export function monumentPolePosition(){
 const {x,z,rotation}=VIDEO_DETAILS.monument;
 const {localX,localZ}=MONUMENT_NIGHT_POLE;
 return {x:x+localX*Math.cos(rotation)+localZ*Math.sin(rotation),z:z-localX*Math.sin(rotation)+localZ*Math.cos(rotation)};
}
