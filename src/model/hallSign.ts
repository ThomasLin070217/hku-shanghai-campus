import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import lettering from './hall-lettering.json';
import shield from './hall-crest.json';

const face=new FontLoader().parse(lettering);

/** C08 south entrance. The sign floats on the left of the wide frame.
 * Glyph widths and crest size are proportional fits, not measured dimensions. */
export function addHallSign(parent:T.Group,width:number,depth:number,white:T.Material){
 const z=depth/2-.35,left=-width*.34;
 function line(label:string,key:string,y:number,w:number,h:number){
  const geometry=new T.ShapeGeometry(face.generateShapes(label,1),3);
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!;
  const size=bounds.getSize(new T.Vector3());
  geometry.translate(-bounds.min.x,-bounds.min.y,0);
  geometry.scale(w/size.x,h/size.y,1);
  const mesh=new T.Mesh(geometry,white);
  mesh.name=label;
  mesh.userData.authorKey=key;
  mesh.position.set(left,y,z);
  parent.add(mesh);
 }
 line('THE UNIVERSITY OF HONG KONG','THE UNIVERSITY OF HONG KONG#1',18.55,width*.317,.52);
 line('香 港 大 學','HKU#1',19.49,width*.186,.8);

 // Isolated silhouette from C08, quantized to seven colours; the glass is
 // visible through the gaps around the shield and ribbon.
 const positions:number[]=[],colors:number[]=[];
 const palette=shield.palette.map(color=>new T.Color('#'+color));
 const unit=2.36/shield.rows.length;
 shield.rows.forEach((row,y)=>{
  for(let x=0;x<row.length;){
   const start=x,cell=row[x++];
   while(row[x]===cell)x++;
   if(cell==='.')continue;
   const x0=start*unit,x1=x*unit,top=-y*unit,bottom=top-unit;
   positions.push(x0,bottom,0,x1,bottom,0,x1,top,0,x0,bottom,0,x1,top,0,x0,top,0);
   const {r,g,b}=palette[Number(cell)];
   for(let i=0;i<6;i++)colors.push(r,g,b);
  }
 });
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 const crest=new T.Mesh(geometry,new T.MeshBasicMaterial({name:'Hall crest colours',vertexColors:true}));
 crest.name='Auditorium_coloured_crest';
 crest.position.set(left-2.51,20.84,z);
 parent.add(crest);
}
