import * as T from 'three';
import {COLUMN_X,COLUMN_SHIFT as DX} from '../model/scaleCalibration';
/** Scenic lighting from U03; intensities are art direction, not photometric measurements. */
export function createNightLighting(scene:T.Scene,onApply:((root:T.Object3D,night:boolean)=>void)|undefined,lights:{hemi:T.Light;sun:T.Light;fill:T.Light}){
 const group=new T.Group();group.name='Preview_Night_Lights';scene.add(group);group.visible=false;
 for(const [x,y,z] of [[COLUMN_X,4,25],[25+DX,2.5,29],[18+DX,4,-20],[19+DX,4,-65],[-COLUMN_X,4,-91],[45+DX,5,-99]]){const l=new T.PointLight(0xffd39a,85,24,2);l.position.set(x,y,z);group.add(l);}
 let night=false;
 function apply(root:T.Object3D){root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.name.startsWith('Night_')){m.emissiveIntensity=night?m.userData.nightIntensity:0;if(m.userData.dayColor!==undefined)m.color.setHex(night?m.userData.nightColor:m.userData.dayColor);}});onApply?.(root,night);}
 function set(value:boolean,root:T.Object3D){night=value;group.visible=value;scene.background=new T.Color(value?0x142b43:0xb5d7e4);scene.environmentIntensity=value?.06:.25;[lights.hemi,lights.sun,lights.fill].forEach((light,i)=>light.intensity=value?[.45,.12,.12][i]:[1.35,2.5,.4][i]);apply(root);}
 return{set,apply,dispose(){group.removeFromParent();group.clear();},get active(){return night;}};
}
