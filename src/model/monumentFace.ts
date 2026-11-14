import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json';
import {signPhotoMaterial} from './nov14Details';

const font=new FontLoader().parse(fontData);
/** Black raised letters remain legible even while the reference crest is loading. */
export function addMonumentFace(parent:T.Group,size:{width:number;height:number;depth:number}){
 const root=new T.Group();root.name='CDS_Monument_Lettering';
 root.userData={source:'U06 IMG_4347.MOV 02:55',text:['SCHOOL OF','COMPUTING &','DATA SCIENCE','The University of Hong Kong'],note:'Original English wording; re-typeset as black geometry for readability. Crest cropped from reference, not redrawn.'};parent.add(root);
 const faceZ=size.depth/2+.014;
 const ivory=new T.MeshStandardMaterial({name:'Ivory_monument_face',color:0xe9e6d9,roughness:.95});
 const backing=new T.Mesh(new T.BoxGeometry(size.width-.04,size.height-.04,.012),ivory);backing.name='Monument_clean_lettering_face';backing.position.set(0,size.height/2,faceZ);root.add(backing);
 // Keep only the crest section of the original photograph. Full photo remains in references.
 const crestGeometry=new T.PlaneGeometry(.91,1.24),uv=crestGeometry.getAttribute('uv');
 for(let i=0;i<uv.count;i++)uv.setXY(i,.143+uv.getX(i)*.219,.24+uv.getY(i)*.51);
 const crest=new T.Mesh(crestGeometry,signPhotoMaterial());crest.name='CDS_monument_reference_crest';crest.position.set(-1.17,1.04,faceZ+.008);root.add(crest);
 const black=new T.MeshStandardMaterial({name:'Sign_monument_black_letters',color:0x080808,roughness:.92,metalness:0});
 const lines=[['SCHOOL OF',1.43,.27],['COMPUTING &',1.07,.27],['DATA SCIENCE',.71,.27],['The University of Hong Kong',.46,.115]] as const;
 for(const [text,y,fontSize] of lines){
  const geo=new TextGeometry(text,{font,size:fontSize,depth:.012,curveSegments:2,bevelEnabled:false});geo.computeBoundingBox();const bounds=geo.boundingBox!,scale=Math.min(1,2.08/(bounds.max.x-bounds.min.x));geo.translate(-bounds.min.x,0,0);geo.scale(scale,scale,1);
  const letters=new T.Mesh(geo,black);letters.name='Lettering_'+text.replaceAll(' ','_');letters.position.set(-.41,y,faceZ+.010);root.add(letters);
 }
 return root;
}
