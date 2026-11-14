import {sceneRegistry} from '../src/scene/registry';
import {createCanvas, ImageData, loadImage} from '@napi-rs/canvas';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildObservedInterior} from '../src/model/observedInteriors';
import {buildLounge} from '../src/model/buildLounge';
import {createStudent} from '../src/exploration/student';
import {SCALE_CALIBRATION} from '../src/model/scaleCalibration';
import {buildSite} from '../src/model/buildSite';
import {modelStats,disposeAsset} from '../src/model/buildCampus';
import {exportGLB,reloadGLB} from '../src/viewer/export';
class NodeFileReader{result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;onerror:((e:unknown)=>void)|null=null;readAsArrayBuffer(b:Blob){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();}).catch(e=>this.onerror?.(e));}readAsDataURL(b:Blob){b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}}
class NodeCanvas {
 canvas=createCanvas(1,1);
 constructor(w:number,h:number){this.canvas.width=w;this.canvas.height=h;}
 get width(){return this.canvas.width;} set width(v:number){this.canvas.width=v;}
 get height(){return this.canvas.height;} set height(v:number){this.canvas.height=v;}
 getContext(type:string){return type==='2d'?this.canvas.getContext('2d'):null;}
 async convertToBlob(){return new Blob([new Uint8Array(await this.canvas.encode('png'))],{type:'image/png'});}
}
Object.assign(globalThis,{FileReader:NodeFileReader,OffscreenCanvas:NodeCanvas,ImageData,self:globalThis,createImageBitmap:async(blob:Blob)=>loadImage(Buffer.from(await blob.arrayBuffer()))});
const asset=buildSite(),out=resolve('assets');mkdirSync(resolve(out,'buildings'),{recursive:true});
const entries:[string,typeof asset.root][]=[['HKU-Shanghai-Campus',asset.root]];
const bare=asset.root.clone(true);bare.getObjectByName('Environment')!.removeFromParent();entries.push(['HKU-Shanghai-Campus-no-ground',bare]);
for(const [id,b]of asset.byId){const copy=b.clone(true);copy.userData={...copy.userData,campusPlacement:b.position.toArray(),campusRotation:b.rotation.toArray()};copy.position.set(0,0,0);copy.rotation.set(0,0,0);entries.push([`buildings/${id}`,copy]);}
entries.push(['Student-Green-Gown',createStudent().root],['B05-4F-Stepped-Lounge',buildLounge()],['CDS1-Observed-Lobby',buildObservedInterior('lobby')],['CDS1-13F-Public-Area',buildObservedInterior('floor13')]);
const metadata:Record<string,unknown>={version:9,videoRevision:'U06-2026-11-14',date:'2026-11-14',glazing:asset.root.userData.glazing,scaleCalibration:SCALE_CALIBRATION,parameters:asset.parameters,site:asset.site,assets:{}};
for(const [name,root]of entries){const before=modelStats(root),binary=await exportGLB(root);writeFileSync(resolve(out,name+'.glb'),Buffer.from(binary));const loaded=await reloadGLB(binary),after=modelStats(loaded.scene);
 if(before.triangles!==after.triangles||before.size.some((v,i)=>Math.abs(v-after.size[i])>.001))throw new Error(`${name}: round-trip geometry mismatch`);
 if(name==='HKU-Shanghai-Campus'){const original=sceneRegistry(root),restored=sceneRegistry(loaded.scene.getObjectByName(root.name)!);if(JSON.stringify(original.entities.map(e=>e.id))!==JSON.stringify(restored.entities.map(e=>e.id)))throw Error('Scene IDs lost in GLB round trip');for(const id of [...asset.byId.keys(),'Environment','Circulation','Sports'])if(!loaded.scene.getObjectByName(id))throw new Error(`Missing ${id}`);}
 (metadata.assets as Record<string,unknown>)[name]={bytes:binary.byteLength,before,after,reload:'passed'};disposeAsset(loaded.scene);console.log(`${name}: ${(binary.byteLength/1048576).toFixed(2)} MiB, ${after.triangles} triangles, reload passed`);
}
writeFileSync(resolve(out,'model-metadata.json'),JSON.stringify(metadata,null,2));writeFileSync(resolve(out,'HKU-campus-parameters.json'),JSON.stringify({version:2,modelVersion:8,units:'metres',absoluteScale:'horizontal-ruler-checked-vertical-unverified',scaleCalibration:SCALE_CALIBRATION,buildings:asset.parameters,site:asset.site},null,2));disposeAsset(asset.root);
