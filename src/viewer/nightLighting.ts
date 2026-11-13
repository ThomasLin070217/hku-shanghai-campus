import * as T from 'three';
/** Scenic lighting from U03; intensities are art direction, not photometric measurements. */
export function createNightLighting(scene:T.Scene){
 const group=new T.Group();group.name='Preview_Night_Lights';scene.add(group);group.visible=false;
 for(const [x,y,z] of [[52,4,25],[25,2.5,29],[18,4,-20],[19,4,-65],[-52,4,-91],[45,5,-99]]){const l=new T.PointLight(0xffd39a,85,24,2);l.position.set(x,y,z);group.add(l);}
 let night=false;
 function apply(root:T.Object3D){root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.name.startsWith('Night_')){m.emissiveIntensity=night?m.userData.nightIntensity:0;if(m.userData.dayColor!==undefined)m.color.setHex(night?m.userData.nightColor:m.userData.dayColor);}});}
 function set(value:boolean,root:T.Object3D){night=value;group.visible=value;scene.background=new T.Color(value?0x142b43:0xb5d7e4);scene.environmentIntensity=value?.06:.25;const lights=scene.getObjectByName('Preview_Lights')!.children as T.Light[];[.45,.12,.12].forEach((n,i)=>lights[i].intensity=value?n:[1.35,2.5,.4][i]);apply(root);}
 return{set,apply,get active(){return night;}};
}
