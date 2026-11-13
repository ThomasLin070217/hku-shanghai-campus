import * as T from 'three';
import {writeFileSync} from 'node:fs';
import {buildSite} from '../src/model/buildSite';
import {cloneBuildings,SITE} from '../src/model/campusParameters';
const a=buildSite();a.root.updateMatrixWorld(true);
function down(root:T.Object3D,x:number,z:number){return new T.Raycaster(new T.Vector3(x,200,z),new T.Vector3(0,-1,0)).intersectObject(root,true).map(h=>h.point.y);}
const ground=a.environment.getObjectByName('Ground')!;
const hole=down(ground,0,SITE.plazaZ),outside=down(ground,0,SITE.plazaZ+SITE.plazaRadiusZ+3),floor=down(a.circulation,0,SITE.plazaZ);
if(hole.length)throw new Error('Ground covers the sunken courtyard');if(!outside.length)throw new Error('Missing surrounding paving');if(!floor.some(y=>Math.abs(y+SITE.plazaDepth)<.01))throw new Error('Lower courtyard floor not found');
const specs=cloneBuildings();specs[0].height=83;const changed=buildSite(specs);if(changed.byId.get('B01')!.userData.parameters.height!==83)throw new Error('Parameters not retained');
let rejected=false;try{specs[0].width=NaN;buildSite(specs);}catch{rejected=true;}if(!rejected)throw new Error('Invalid geometry accepted');
const report={buildingCount:a.byId.size,groups:a.root.children.map(c=>c.name),sunkenCourtyard:{holeGroundHits:hole.length,outsidePavingHeight:outside[0],lowerFloorHeights:floor},parameterUpdate:true,invalidParameterRejected:true};writeFileSync('assets/geometry-checks.json',JSON.stringify(report,null,2));console.log(report);
