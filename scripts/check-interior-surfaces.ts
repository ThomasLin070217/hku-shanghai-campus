import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSite} from '../src/model/buildSite';
import {disposeAsset} from '../src/model/buildCampus';

/** The 16×16 pixel tile spreads over 4 m, so up close it is a 25 cm light/dark checker.
 * That reads as cheap masonry on an interior wall, but it is the right surface for the
 * campus exterior. This gate keeps the split honest: no mesh inside a `noVoxelTile`
 * subtree may carry the tile, and the exterior must still carry it. */
const tileKind=(o:T.Mesh)=>{
 const mats=(Array.isArray(o.material)?o.material:[o.material]) as T.Material[];
 for(const m of mats){
  if(!(m instanceof T.MeshStandardMaterial))continue;
  const name=m.map?.name??'';
  if(/^Original_pixel_/.test(name))return name.slice('Original_pixel_'.length);
 }
 return '';
};

// `opening` is what puts the playable B5/B6/B4 interiors in the tree; without it there is
// nothing to check, which is exactly the bug this gate exists to catch.
const site=buildSite(undefined,undefined,true);
const interior:T.Mesh[]=[],exterior:T.Mesh[]=[];
const exemptRoots=new Set<string>();
const walk=(o:T.Object3D,insideInterior:boolean)=>{
 const here=insideInterior||o.userData.noVoxelTile===true;
 if(here&&o.userData.noVoxelTile===true)exemptRoots.add(o.name||'(unnamed)');
 if(o instanceof T.Mesh)(here?interior:exterior).push(o);
 for(const child of o.children)walk(child,here);
};
walk(site.root,false);

for(const name of ['Opening_b5_dinner','Opening_b6_office','B04_lift_car','B04_lift_landing','B04_principal_office','B04_room_shell'])
 assert.ok(exemptRoots.has(name),`${name} must opt out of the pixel tile`);

const tiledInterior=interior.filter(o=>tileKind(o)!=='');
assert.equal(tiledInterior.length,0,
 `${tiledInterior.length} interior mesh(es) still carry the exterior tile, first: ${tiledInterior[0]?.name??''}`);

const tiledExterior=exterior.filter(o=>tileKind(o)!=='');
assert.ok(tiledExterior.length>200,
 `only ${tiledExterior.length} exterior meshes carry the tile — the walk may be skipping everything`);
for(const kind of ['wall','paving'])assert.ok(tiledExterior.some(o=>tileKind(o)===kind),`the exterior ${kind} tile disappeared`);

console.log(`PASS ${interior.length} interior meshes carry no exterior tile; ${tiledExterior.length} of ${exterior.length} exterior meshes still do (${[...new Set(tiledExterior.map(tileKind))].sort().join(', ')})`);
console.log(`PASS ${exemptRoots.size} interior roots opt out: ${[...exemptRoots].sort().join(', ')}`);
disposeAsset(site.root);
