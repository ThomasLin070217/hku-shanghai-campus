import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createCanvas,ImageData,loadImage} from '@napi-rs/canvas';
import {cloneBuildings,SITE,parseCampusConfig,validateCampus} from '../src/model/campusParameters';
import {signPhotoMaterial} from '../src/model/nov14Details';
import {deferredTexture,prepareModelTextures} from '../src/model/deferredTextures';
import {exportGLB,reloadGLB} from '../src/viewer/export';
import {disposeAsset} from '../src/model/buildCampus';
import {createNightLighting} from '../src/viewer/nightLighting';

const config={version:2,buildings:cloneBuildings(),site:{...SITE}};
assert.deepEqual(parseCampusConfig(config),{buildings:config.buildings,site:config.site});
assert.deepEqual(parseCampusConfig({...config,buildings:[...config.buildings].reverse()}).buildings.map(b=>b.id),config.buildings.map(b=>b.id).reverse());
for(const value of [null,[],{...config,site:[]},{...config,buildings:[null,...config.buildings.slice(1)]}])assert.throws(()=>parseCampusConfig(value));
for(const key of Object.keys(SITE))for(const bad of [null,'3',Infinity,NaN,1e12,-1e12]){assert.throws(()=>parseCampusConfig({...config,site:{...SITE,[key]:bad}}),key);}
for(const key of ['label','source','usage','confidence'])assert.throws(()=>parseCampusConfig({...config,buildings:config.buildings.map((b,i)=>i===0?{...b,[key]:{bad:true}}:b)}));
const overlap=cloneBuildings();overlap.find(b=>b.id==='B05')!.z=0;assert.throws(()=>validateCampus(overlap,SITE),/间距/);
const extra=JSON.parse(JSON.stringify(config));extra.site.unexpected=999;extra.buildings[0].surprise='ignored';assert.ok(!('unexpected' in parseCampusConfig(extra).site));
console.log('PASS strict configuration parsing, numeric bounds, arbitrary-key exclusion, reversed IDs, invalid link geometry');

class Reader{result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(b:Blob){void b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(b:Blob){void b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}}
class Canvas{canvas=createCanvas(1,1);constructor(w:number,h:number){this.canvas.width=w;this.canvas.height=h;}get width(){return this.canvas.width;}set width(v:number){this.canvas.width=v;}get height(){return this.canvas.height;}set height(v:number){this.canvas.height=v;}getContext(type:string){return type==='2d'?this.canvas.getContext('2d'):null;}async convertToBlob(){return new Blob([new Uint8Array(await this.canvas.encode('png'))],{type:'image/png'});}}
Object.assign(globalThis,{FileReader:Reader,OffscreenCanvas:Canvas,ImageData,self:globalThis,createImageBitmap:async(b:Blob)=>loadImage(Buffer.from(await b.arrayBuffer()))});
const root=new T.Group(),material=signPhotoMaterial();root.add(new T.Mesh(new T.PlaneGeometry(2,1),material));
assert.equal((material.map as T.DataTexture).image.width,1);
// Export immediately, without manually warming the texture. The shared exporter must wait.
const binary=await exportGLB(root);const old=JSON.parse(fs.readFileSync('src/model/cds-monument-photo.json','utf8'));
assert.equal((material.map as T.DataTexture).image.width,old.width);assert.equal((material.map as T.DataTexture).image.height,old.height);
assert.deepEqual(Buffer.from((material.map as T.DataTexture).image.data as Uint8Array),Buffer.from(old.rgba,'base64'));
const loaded=await reloadGLB(binary);let restored:T.Texture|undefined;loaded.scene.traverse(o=>{if(o instanceof T.Mesh)restored=(o.material as T.MeshStandardMaterial).map??undefined;});assert.ok(restored);assert.equal((restored.image as {width:number}).width,old.width);assert.equal((restored.image as {height:number}).height,old.height);
fs.mkdirSync('evidence/remaining-fixes',{recursive:true});fs.writeFileSync('evidence/remaining-fixes/sign-roundtrip.glb',Buffer.from(binary));disposeAsset(root);disposeAsset(loaded.scene);
console.log('PASS PNG matches every original RGBA byte; immediate GLB export waits; embedded photo reloads at full resolution');
let calls=0;const m=new T.MeshBasicMaterial({map:deferredTexture(async()=>{if(++calls===1)throw Error('offline');return{data:new Uint8Array([1,2,3,255]),width:1,height:1};})});const retry=new T.Mesh(new T.PlaneGeometry(),m);await assert.rejects(prepareModelTextures(retry));await prepareModelTextures(retry);assert.equal(calls,2);disposeAsset(retry);
let resolve!:(x:{data:Uint8Array;width:number;height:number})=>void;const texture=deferredTexture(()=>new Promise(r=>{resolve=r;}));const late=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({map:texture}));const job=prepareModelTextures(late);texture.dispose();resolve({data:new Uint8Array(16),width:2,height:2});await job;assert.equal(texture.image.width,1);disposeAsset(late);
console.log('PASS deferred image retry and disposed-texture late completion protection');
const scene=new T.Scene(),hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),fill=new T.DirectionalLight();scene.add(fill,hemi,sun);const night=createNightLighting(scene,undefined,{hemi,sun,fill});night.set(true,new T.Group());assert.equal(hemi.intensity,.45);night.set(false,new T.Group());assert.equal(sun.intensity,2.5);night.dispose();assert.ok(!scene.getObjectByName('Preview_Night_Lights'));
console.log('PASS named lighting references survive scene order changes and dispose removes night lights');
