/** Whole Zhangjiang site. Metric estimates, NOT survey coordinates. +X east-ish, -Z north-ish.
 * Number-position mapping follows candidate P01, cross-checked with M01/R02/A04.
 * Campus usage and geometric confidence are deliberately separate. */
import {COLUMN_X} from './scaleCalibration';
export interface BuildingSpec {id:string;label:string;kind:'frameTower'|'bandTower'|'amenities'|'auditorium';x:number;z:number;width:number;depth:number;height:number;floors:number;bays:number;rotation:number;source:string;confidence:string;usage:string;}
export const BUILDINGS:BuildingSpec[]=[
 {id:'B01',label:'Building 1 · West north tower',kind:'frameTower',x:-COLUMN_X,z:-2,width:59.5,depth:45,height:79.6,floors:17,bays:25,rotation:0,source:'SM06（列位置推断）,P01,A02,A04,A07',confidence:'外形可靠；楼号位置由用户导览图复核；水平量级经卫星核对、列位置推断；高度仍估计',usage:'三期范围，启用状态未独立确认'},
 {id:'B02',label:'Building 2 · West south tower',kind:'frameTower',x:-COLUMN_X,z:70,width:59.5,depth:35.5,height:79.6,floors:17,bays:25,rotation:0,source:'SM06（列位置推断）,P01,A02,A04,A05',confidence:'外形可靠；楼号位置由用户导览图复核；水平量级经卫星核对、列位置推断；高度仍估计',usage:'三期范围，具体功能待核实'},
 {id:'B03',label:'CDS-2 · Building 3',kind:'bandTower',x:COLUMN_X,z:70,width:59.7,depth:37.3,height:66.15,floors:14,bays:25,rotation:0,source:'SM03,SM04,SM06（列位置推断）,P01,A01,A04,C02',confidence:'外形可靠；楼号位置由用户导览图复核；水平量级经卫星核对、列位置推断；高度仍估计',usage:'校方确认3号楼承担AI与合作科研；定位依候选总图'},
 {id:'B04',label:'CDS-1 · Building 4',kind:'bandTower',x:COLUMN_X,z:-2,width:59.7,depth:45,height:66.15,floors:14,bays:25,rotation:0,source:'SM01,SM02,SM06（列位置推断）,R01,R02,R04,P01,T02',confidence:'入口身份可靠；宽深经卫星测距核对；高度暂定',usage:'计算与数据科学学院教学科研'},
 {id:'B05',label:'Building 5 · Student activities',kind:'amenities',x:COLUMN_X,z:-70,width:59.7,depth:30,height:23.95,floors:5,bays:25,rotation:0,source:'SM05,SM06,R02,A06,P01,C02,C03,U02（用户实录）',confidence:'外观可靠；宽度及东西列间距经卫星核对；高度与其余尺寸推断',usage:'校方确认5号楼学生活动及大学雅堂；用户确认4楼阶梯休闲区（独立参考资产）'},
 {id:'B06',label:'Building 6 · Auditorium',kind:'auditorium',x:0,z:-70,width:34.15,depth:34.15,height:23.95,floors:6,bays:14,rotation:0,source:'R02,R06,A06,P01',confidence:'礼堂身份可靠；6号楼对应由用户图确认；尺寸估计',usage:'Auditorium；层数仅作为外形参数'},
 {id:'B07',label:'Building 7 · Northwest support building',kind:'amenities',x:-COLUMN_X,z:-70,width:59.5,depth:30,height:23.95,floors:5,bays:25,rotation:0,source:'SM06,SM07,A06,P01,M01',confidence:'外形可靠；宽度及东西列间距经卫星核对；用途、高度与隐藏立面待核实',usage:'三期范围，具体功能待核实'},
];
export const SITE={width:208,depth:256,centerZ:-14,plazaX:0,plazaZ:-9,plazaRadiusX:15,plazaRadiusZ:15,plazaDepth:4.2,bridgeHeight:5.3,bridgeWidth:4.4,treeHeight:5.4,sportsZ:-117,sportsWidth:190,sportsDepth:31};
export type SiteParameters=typeof SITE;
export const cloneBuildings=()=>BUILDINGS.map(b=>({...b}));
export function validateCampus(specs:BuildingSpec[],site:SiteParameters){
 if(!Array.isArray(specs)||specs.some(b=>!b||typeof b!=='object')||specs.length!==7||new Set(specs.map(b=>b.id)).size!==7)throw new Error('校园配置必须包含7个独立楼栋');
 for(const b of specs){for(const k of ['label','source','confidence','usage'] as const)if(typeof b[k]!=='string'||b[k].length>2000)throw new Error(`${b.id} ${k} 必须是长度不超过2000的文字`);if(!BUILDINGS.some(o=>o.id===b.id)||!['frameTower','bandTower','amenities','auditorium'].includes(b.kind))throw new Error('未知楼栋编号或类型');for(const k of ['x','z','width','depth','height','floors','bays','rotation'] as const)if(!Number.isFinite(b[k]))throw new Error(`${b.id} ${k} 必须是数字`);
 if(Math.abs(b.x)>1000||Math.abs(b.z)>1000||Math.abs(b.rotation)>3600)throw new Error('建筑位置或转向角超出编辑范围');
 if(b.width<15||b.width>90||b.depth<15||b.depth>70||b.height<10||b.height>110||b.floors<2||b.floors>24||b.bays<8||b.bays>40||!Number.isInteger(b.floors)||!Number.isInteger(b.bays))throw new Error('建筑尺寸或分格超出支持范围');}
 const limits:Record<keyof SiteParameters,[number,number]>={width:[180,500],depth:[220,600],centerZ:[-300,300],plazaX:[-150,150],plazaZ:[-200,200],plazaRadiusX:[8,20],plazaRadiusZ:[10,28],plazaDepth:[1,8],bridgeHeight:[1,15],bridgeWidth:[1,12],treeHeight:[1,20],sportsZ:[-300,300],sportsWidth:[10,400],sportsDepth:[10,150]};
 if(!site||typeof site!=='object')throw Error('场地参数必须是对象');
 for(const k of Object.keys(limits) as (keyof SiteParameters)[]){const [min,max]=limits[k];if(!Number.isFinite(site[k])||site[k]<min||site[k]>max)throw Error(`场地 ${k} 必须在 ${min}–${max} 范围内`);}
 const teaching=specs.find(b=>b.id==='B04')!,activities=specs.find(b=>b.id==='B05')!;
 if(teaching.z-teaching.depth/2-(activities.z+activities.depth/2)<=0)throw Error('4号楼与5号楼南北间距不足，无法生成现有连廊；请调整位置或进深');

}

/** Parse untrusted JSON without merging arbitrary keys into the scene configuration. */
export function parseCampusConfig(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('需要校园参数对象');
 const config=raw as Record<string,unknown>;
 if(config.version!==2||!Array.isArray(config.buildings))throw Error('需要 version 2 校园参数文件');
 if(config.site!==undefined&&(!config.site||typeof config.site!=='object'||Array.isArray(config.site)))throw Error('site 必须是场地参数对象');
 const fields=Object.keys(BUILDINGS[0]) as (keyof BuildingSpec)[];
 const buildings=config.buildings.map(raw=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('楼栋参数必须是对象');return Object.fromEntries(fields.map(k=>[k,(raw as Record<string,unknown>)[k]])) as unknown as BuildingSpec;});
 const input=config.site as Record<string,unknown>|undefined;
 const site=Object.fromEntries(Object.entries(SITE).map(([k,v])=>[k,input&&Object.hasOwn(input,k)?input[k]:v])) as SiteParameters;
 validateCampus(buildings,site);return{buildings,site};
}
