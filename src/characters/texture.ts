import * as T from 'three';
import type {Appearance} from './config';
/** Original six-face, 16px-per-face art. No Minecraft/Kenney sample skin is distributed here. */
export function characterTexture(part:string,a:Appearance){
 const w=96,h=16,data=new Uint8Array(w*h*4),rgb=(c:number)=>[(c>>16)&255,(c>>8)&255,c&255];
 const set=(f:number,x:number,y:number,c:number)=>{const o=((15-y)*w+f*16+x)*4;data.set([...rgb(c),255],o);};
 for(let f=0;f<6;f++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  let c=a.coat;
  if(part==='head'){
   c=a.skin;
   if(f===2||f===5&&y<13||(f<2&&y<9))c=a.hair;
   if(f===4){if(y<4||y===4&&(a.hairStyle==='short'?x<6||x>11:x<10)||y===5&&x<3)c=a.hair;
    if(y===7&&(x>=3&&x<=5||x>=10&&x<=12))c=a.hair;
    if(y===9&&(x>=3&&x<=5||x>=10&&x<=12))c=0xf5efe0;
    if(y===9&&(x===4||x===11))c=0x202a30;
    if(y===11&&(x===7||x===8))c=0xc98e6e;
    if(y===13&&(x===7||x===8))c=0x995f50;
   }
   if(f===3)c=a.skin;
  }else if(part.startsWith('leg')){c=y>12?0x1b2229:y===12?0x9aa2a1:a.pants;}
  else if(part.startsWith('arm')){c=y>12?a.shirt:a.coat;if(x===1&&y<10)c=a.trim;}
  else {if(f===4){if(x>4&&x<11)c=a.shirt;if(x===4||x===11)c=a.trim;if(x===8&&[5,9,13].includes(y))c=0x596367;if(y<3&&(x===5||x===10))c=0xffffff;}if(f===5&&[3,7,12].includes(x))c=a.trim;}
  if((x*13+y*7+f*19)%37===0){const v=rgb(c).map(n=>Math.min(255,n+7));c=(v[0]<<16)+(v[1]<<8)+v[2];}set(f,x,y,c);
 }
 const tex=new T.DataTexture(data,w,h);tex.colorSpace=T.SRGBColorSpace;tex.magFilter=tex.minFilter=T.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;tex.name=a.id+'/'+part;return tex;
}
