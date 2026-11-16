import {MONUMENT_NIGHT_POLE, monumentPolePosition, VIDEO_DETAILS} from '../model/videoDetailsParameters';
import {LAWN_SIGN} from '../model/videoFollowup';
import * as T from 'three';
import {COLUMN_X,COLUMN_SHIFT as DX} from '../model/scaleCalibration';
/** Scenic lighting from U03; intensities are art direction, not photometric measurements. */
export function createNightLighting(scene:T.Scene,onApply:((root:T.Object3D,night:boolean)=>void)|undefined,lights:{hemi:T.Light;sun:T.Light;fill:T.Light}){
 const group=new T.Group();group.name='Preview_Night_Lights';scene.add(group);group.visible=false;
 for(const [x,y,z] of [[COLUMN_X,4,25],[18+DX,4,-20],[19+DX,4,-65],[-COLUMN_X,4,-91],[45+DX,5,-99]]){const l=new T.PointLight(0xffd39a,85,24,2);l.position.set(x,y,z);group.add(l);}
 // Local illumination follows the photographed side of the stone sign.
 const pole=monumentPolePosition(),monument=VIDEO_DETAILS.monument;
 const signLight=new T.SpotLight(0xffebb7,118,12,Math.PI/5,.64,2);
 signLight.position.set(pole.x,MONUMENT_NIGHT_POLE.height-.06,pole.z);
 signLight.target.position.set(monument.x,1.05,monument.z+.22);
 const signFill=new T.SpotLight(0xffefce,7,4,Math.PI/5,.72,2);
 signFill.position.set(monument.x,.22,monument.z+.8);
 signFill.target.position.set(monument.x,1.0,monument.z+.20);
 group.add(signLight,signLight.target,signFill,signFill.target);
 // U08: three compact, non-shadow-casting ground lamps; shared lawn sign position.
 for(const x of [-.65,0,.65]){const l=new T.SpotLight(0xf2ffc5,8,3,Math.PI/5,.8,2);l.position.set(x,.27,LAWN_SIGN.z+.84);l.target.position.set(x,.45,LAWN_SIGN.z);group.add(l,l.target);}
 let night=false;
 function apply(root:T.Object3D){root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.name.startsWith('Night_')){m.emissiveIntensity=night?(m.userData.nightIntensity??.5):0;if(m.userData.dayColor!==undefined)m.color.setHex(night?m.userData.nightColor:m.userData.dayColor);}});onApply?.(root,night);}
 function set(value:boolean,root:T.Object3D){night=value;group.visible=value;scene.background=new T.Color(value?0x142b43:0xb5d7e4);scene.environmentIntensity=value?.06:.25;[lights.hemi,lights.sun,lights.fill].forEach((light,i)=>light.intensity=value?[.45,.12,.12][i]:[1.35,2.5,.4][i]);apply(root);}
 return{set,apply,dispose(){group.removeFromParent();group.clear();},get active(){return night;}};
}
