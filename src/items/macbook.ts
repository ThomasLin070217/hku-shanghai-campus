import * as T from 'three';
/** Original geometry, metres. Apple 13-inch Air: 0.3041 × 0.215 × 0.0113 m closed. */
export function createMacBook(lidAngle=1.15){
 const root=new T.Group();root.name='MacBook_Air_13_Silver';
 const silver=new T.MeshStandardMaterial({color:0xc8cdd2,metalness:.7,roughness:.32});
 const black=new T.MeshStandardMaterial({color:0x172027,roughness:.65});
 const screen=new T.MeshStandardMaterial({color:0x126655,emissive:0x0c372e,emissiveIntensity:.35});
 const box=(p:T.Object3D,n:string,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=n;o.position.set(x,y,z);p.add(o);return o;};
 box(root,'Base',.3041,.0078,.215,0,.0039,0,silver);
 box(root,'Keyboard_recess',.277,.0006,.092,0,.008,-.028,black);
 for(let r=0;r<5;r++)for(let c=0;c<14;c++)box(root,'Key',.016,.001,.013,(c-6.5)*.019,.009,-.064+r*.017,silver);
 box(root,'Spacebar',.108,.001,.011,0,.009,.021,black);
 box(root,'Trackpad',.122,.0005,.067,0,.0085,.066,new T.MeshStandardMaterial({color:0xaeb6bd,metalness:.5,roughness:.4}));
 const hinge=new T.Group();hinge.name='Lid_Hinge';hinge.position.set(0,.0078,-.102);root.add(hinge);
 box(hinge,'Lid',.3041,.0035,.205,0,.00175,.1025,silver);
 box(hinge,'Display_bezel',.292,.0007,.193,0,-.0005,.1025,black);
 box(hinge,'Screen',.279,.0005,.177,0,-.001,.1025,screen);
 box(hinge,'Camera_notch',.025,.0006,.01,0,-.0014,.189,black);
 // A restrained pixel desktop, authored here; no Apple image or logo texture embedded.
 const pale=new T.MeshBasicMaterial({color:0xc0e7d0});
 for(let i=0;i<5;i++)box(hinge,'Desktop_pixel',.012,.0007,.012,(i-2)*.022,-.0017,.025,pale);
 for(const x of [-1,1])box(root,'USB_C_port',.0005,.003,.009,x*.1523,.004,-.06,black);
 function setLid(angle:number){hinge.rotation.x=-T.MathUtils.clamp(angle,0,2.3);}
 setLid(lidAngle);root.userData={units:'metres',dimensionsClosed:[.3041,.0113,.215],source:'Original model; Apple technical specifications',lidAngle};
 return {root,hinge,setLid};
}
