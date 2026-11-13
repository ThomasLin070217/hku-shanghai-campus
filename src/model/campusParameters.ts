/** Whole Zhangjiang site. Metric estimates, NOT survey coordinates. +X east-ish, -Z north-ish.
 * Number-position mapping follows candidate P01, cross-checked with M01/R02/A04.
 * Campus usage and geometric confidence are deliberately separate. */
export interface BuildingSpec {id:string;label:string;kind:'frameTower'|'bandTower'|'amenities'|'auditorium';x:number;z:number;width:number;depth:number;height:number;floors:number;bays:number;rotation:number;source:string;confidence:string;usage:string;}
export const BUILDINGS:BuildingSpec[]=[
 {id:'B01',label:'1号楼 · 西侧北塔',kind:'frameTower',x:-52,z:-2,width:59.5,depth:45,height:79.6,floors:17,bays:25,rotation:0,source:'P01,A02,A04,A07',confidence:'外形可靠；楼号定位与尺寸推断',usage:'三期范围，启用状态未独立确认'},
 {id:'B02',label:'2号楼 · 西侧南塔',kind:'frameTower',x:-52,z:70,width:59.5,depth:35.5,height:79.6,floors:17,bays:25,rotation:0,source:'P01,A02,A04,A05',confidence:'外形可靠；楼号定位与尺寸推断',usage:'三期范围，具体功能待核实'},
 {id:'B03',label:'3号楼 · 东侧南塔',kind:'bandTower',x:52,z:70,width:59.7,depth:37.3,height:66.15,floors:14,bays:25,rotation:0,source:'P01,A01,A04,C02',confidence:'外形可靠；楼号定位与尺寸推断',usage:'校方确认3号楼承担AI与合作科研；定位依候选总图'},
 {id:'B04',label:'CDS-1 · 4号楼',kind:'bandTower',x:52,z:-2,width:59.7,depth:45,height:66.15,floors:14,bays:25,rotation:0,source:'R01,R02,R04,P01,T02',confidence:'入口身份可靠；尺寸暂定',usage:'计算与数据科学学院教学科研'},
 {id:'B05',label:'5号楼 · 学生活动',kind:'amenities',x:52,z:-70,width:59.7,depth:30,height:23.95,floors:5,bays:25,rotation:0,source:'R02,A06,P01,C02,C03',confidence:'外观可靠；楼号与具体尺寸推断',usage:'校方确认5号楼学生活动及大学雅堂'},
 {id:'B06',label:'礼堂 · 中央公共建筑',kind:'auditorium',x:0,z:-70,width:34.15,depth:34.15,height:23.95,floors:6,bays:14,rotation:0,source:'R02,R06,A06,P01',confidence:'礼堂身份可靠；6号楼对应及尺寸推断',usage:'Auditorium；层数仅作为外形参数'},
 {id:'B07',label:'7号楼 · 西北配套楼',kind:'amenities',x:-52,z:-70,width:59.5,depth:30,height:23.95,floors:5,bays:25,rotation:0,source:'A06,P01,M01',confidence:'外形可靠；用途与隐藏立面待核实',usage:'三期范围，具体功能待核实'},
];
export const SITE={width:208,depth:256,centerZ:-14,plazaX:0,plazaZ:25,plazaRadiusX:16,plazaRadiusZ:22,plazaDepth:4.2,bridgeHeight:5.3,bridgeWidth:4.4,treeHeight:5.4,sportsZ:-117,sportsWidth:190,sportsDepth:31};
export type SiteParameters=typeof SITE;
export const cloneBuildings=()=>BUILDINGS.map(b=>({...b}));
export function validateCampus(specs:BuildingSpec[],site:SiteParameters){
 if(specs.length!==7||new Set(specs.map(b=>b.id)).size!==7)throw new Error('校园配置必须包含7个独立楼栋');
 for(const b of specs){if(!BUILDINGS.some(o=>o.id===b.id)||!['frameTower','bandTower','amenities','auditorium'].includes(b.kind))throw new Error('未知楼栋编号或类型');for(const k of ['x','z','width','depth','height','floors','bays','rotation'] as const)if(!Number.isFinite(b[k]))throw new Error(`${b.id} ${k} 必须是数字`);
 if(b.width<15||b.width>90||b.depth<15||b.depth>70||b.height<10||b.height>110||b.floors<2||b.floors>24||b.bays<8||b.bays>40||!Number.isInteger(b.floors)||!Number.isInteger(b.bays))throw new Error('建筑尺寸或分格超出支持范围');}
 for(const v of Object.values(site))if(!Number.isFinite(v))throw new Error('场地参数必须有限');
 if(site.width<180||site.depth<220||site.plazaRadiusX<8||site.plazaRadiusX>20||site.plazaRadiusZ<10||site.plazaRadiusZ>28||site.plazaDepth<1||site.plazaDepth>8)throw new Error('场地边界或下沉空间参数超出支持范围');
}
