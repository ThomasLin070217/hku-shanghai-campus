import * as T from 'three';
/** Artistic fits to R01/R02, U03 00:09/00:52 and A06/A08; not measured optical coefficients.
 * Alpha-blended PBR keeps GLB portable. No whole-building opacity or screen-space filter. */
export const GLASS_PROFILES = {
 clear: {color:0x98b8b1,opacity:.26,roughness:.12,envMapIntensity:1.0},
 office: {color:0x648d9c,opacity:.43,roughness:.17,envMapIntensity:1.25},
 reflective: {color:0x355c72,opacity:.68,roughness:.12,envMapIntensity:1.65},
 frosted: {color:0xd8e5df,opacity:.55,roughness:.60,envMapIntensity:.45},
 guard: {color:0xb7d5cd,opacity:.18,roughness:.10,envMapIntensity:1.05},
};
export const GLAZING_DEPTH = {facade:2.6,lobby:2.4,slab:.16,glassFrameGap:.045};
export type GlassProfile=keyof typeof GLASS_PROFILES;
export function glassMaterial(profile:GlassProfile){
 const m=new T.MeshPhysicalMaterial({name:'Glazing_'+profile,...GLASS_PROFILES[profile],metalness:0,ior:1.5,transparent:true,depthWrite:false,side:T.DoubleSide});
 m.forceSinglePass=true;m.userData={surfaceRole:'glass',profile,optics:'art-directed from reference; alpha PBR, no measured transmission'};return m;
}
/** Single surface, not six overlapping box faces. Keep transparent meshes grouped by facade plane. */
export function pane(parent:T.Object3D,name:string,w:number,h:number,x:number,y:number,z:number,material:T.Material,yaw=0){
 const o=new T.Mesh(new T.PlaneGeometry(w,h),material);o.name=name;o.position.set(x,y,z);o.rotation.y=yaw;o.castShadow=false;o.receiveShadow=false;o.userData={surfaceRole:'glass'};parent.add(o);return o;
}
export function solid(parent:T.Object3D,name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const opaque=(name:string,c:number)=>new T.MeshStandardMaterial({name,color:c,roughness:.8});
/** Closed 2.6m scenic recess. No room plan, navigation or full interior is claimed. */
export function shallowDepth(parent:T.Object3D,w:number,h:number,depth:number,bays:number,bright=false){
 const g=new T.Group();g.name='Scenic_depth_PROVISIONAL';g.userData={surfaceRole:'opaque-backing',depth,confidence:'visual depth only; not surveyed interior'};parent.add(g);
 const back=opaque(bright?'Night_scenic_lobby_back':'Opaque_recess_backing',bright?0x7e8e89:0x44565e);
 if(bright){back.emissive.setHex(0xffdd9b);back.userData.nightIntensity=.20;back.emissiveIntensity=0;}
 const slab=opaque('Opaque_window_reveal',0x7b8581),trim=opaque('Opaque_recess_columns',0xa8b2ab);
 solid(g,'Recess_back',w,h,.10,0,h/2,-depth,back);
 solid(g,'Recess_floor',w,.14,depth,0,.01,-depth/2,slab);solid(g,'Recess_ceiling',w,.14,depth,0,h,-depth/2,slab);
 for(const s of [-1,1])solid(g,'Recess_side',.12,h,depth,s*w/2,h/2,-depth/2,slab);
 for(let i=2;i<bays;i+=4)solid(g,'Scenic_structural_post',.22,h,.28,-w/2+i*w/bays,h/2,-depth*.60,trim);
 if(bright){const silhouette=opaque('Scenic_seating_silhouette',0x66716b),seat=opaque('Scenic_seat_light',0xb8b7a4),shadow=opaque('Opaque_recess_shadow_panel',0x304549);
 for(let i=2;i<bays;i+=5)solid(g,'Scenic_shadow_panel_PROVISIONAL',Math.min(2.6,w/bays*1.7),Math.min(2.5,h*.7),.06,-w/2+i*w/bays,Math.min(2.5,h*.7)/2,-depth+.08,shadow);
 // Sparse generic blocks only: visible furniture silhouettes, not a reconstructed room plan.
 for(let i=2;i<bays;i+=5){const x=-w/2+i*w/bays;if(w>20&&Math.abs(x)<4)continue;solid(g,'Scenic_low_table',1.3,.10,.65,x,.72,-depth*.65,silhouette);solid(g,'Scenic_table_support',.16,.65,.16,x,.34,-depth*.65,silhouette);for(const side of [-1,1]){solid(g,'Scenic_seat',.5,.13,.48,x+side*.95,.48,-depth*.62,seat);solid(g,'Scenic_seat_back',.5,.57,.10,x+side*.95,.78,-depth*.72,seat);}}
 const lamp=opaque('Night_recess_ceiling_light',0xf5e8c4);lamp.emissive.setHex(0xffe1a1);lamp.emissiveIntensity=0;lamp.userData.nightIntensity=2.0;
 for(let i=1;i<bays;i+=4)solid(g,'Recess_ceiling_strip',Math.min(2,w/bays*1.4),.055,.10,-w/2+i*w/bays,h-.16,-depth*.6,lamp);}
 return g;
}
export interface Cutout{x:number;y:number;w:number;h:number}
/** Subtract a feature window/portal, so a second transparent pane does not cover it. */
export function clippedPane(parent:T.Object3D,name:string,x0:number,x1:number,y0:number,y1:number,z:number,m:T.Material,cut?:Cutout){
 const put=(a:number,b:number,c:number,d:number)=>{if(b-a>.001&&d-c>.001)pane(parent,name,b-a,d-c,(a+b)/2,(c+d)/2,z,m);};
 if(!cut){put(x0,x1,y0,y1);return;}
 const l=Math.max(x0,cut.x-cut.w/2),r=Math.min(x1,cut.x+cut.w/2),b=Math.max(y0,cut.y-cut.h/2),t=Math.min(y1,cut.y+cut.h/2);
 if(l>=r||b>=t){put(x0,x1,y0,y1);return;}put(x0,l,y0,y1);put(r,x1,y0,y1);put(l,r,y0,b);put(l,r,t,y1);
}

/** glTF alphaMode survives export, but WebGL depthWrite/forceSinglePass are renderer flags. */
export function restoreGlassRenderState(root:T.Object3D){root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.surfaceRole==='glass'){m.transparent=true;m.depthWrite=false;m.forceSinglePass=true;o.castShadow=false;o.receiveShadow=false;}});}
