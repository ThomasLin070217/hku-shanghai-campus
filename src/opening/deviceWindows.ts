import type {MacApp} from './macbook';

export type WindowApp = Exclude<MacApp,'desktop'>;
type WindowState = 'closed'|'visible'|'minimized';
interface DeviceWindow {
  frame:HTMLElement;
  titlebar:HTMLElement;
  body:HTMLElement;
  state:WindowState;
  x:number;
  y:number;
  positioned:boolean;
  maximized:boolean;
  z:number;
  exitTimer?:ReturnType<typeof setTimeout>;
}

export function createWindowManager(host:HTMLElement,changed:(app:MacApp)=>void) {
  const windows=new Map<WindowApp,DeviceWindow>();
  let active:MacApp='desktop';
  let order=0;
  let dragging:{window:DeviceWindow;id:number;dx:number;dy:number}|null=null;

  function place(w:DeviceWindow) {
    if(!host.clientWidth||!host.clientHeight||w.state!=='visible')return;
    if(!w.positioned){
      const offset=(w.z%3-1)*12;
      w.x=(host.clientWidth-w.frame.offsetWidth)/2+offset;
      w.y=(host.clientHeight-w.frame.offsetHeight)/2+offset;
      w.positioned=true;
    }
    if(w.maximized)return;
    w.x=Math.max(0,Math.min(w.x,host.clientWidth-w.frame.offsetWidth));
    w.y=Math.max(0,Math.min(w.y,host.clientHeight-w.frame.offsetHeight));
    w.frame.style.left=w.x+'px';w.frame.style.top=w.y+'px';
  }
  const resized=new ResizeObserver(()=>{for(const w of windows.values())place(w);});
  resized.observe(host);
  function focus(app:MacApp) {
    if(active!==app && active!=='desktop')windows.get(active)?.frame.classList.remove('is-front');
    active=app;
    if(app!=='desktop'){
      const w=windows.get(app)!;
      if(!w.frame.classList.contains('is-front')){w.z=++order;w.frame.style.zIndex=String(w.z);}
      w.frame.classList.add('is-front');
    }
    changed(active);
  }
  function nextFocus(){
    const ordered=Array.from(windows.entries()).filter(([,w])=>w.state==='visible').sort(([,a],[,b])=>b.z-a.z);
    focus(ordered[0]?.[0]??'desktop');
  }
  function hide(app:WindowApp,state:WindowState) {
    const w=windows.get(app);
    if(!w||w.state!=='visible')return;
    w.state=state;
    w.frame.inert=true;
    w.frame.dataset.leaving=state;
    w.exitTimer=setTimeout(()=>{if(w.state!=='visible')w.frame.hidden=true;},120);
    if(active===app)nextFocus();else changed(active);
  }
  function zoom(w:DeviceWindow) {
    w.maximized=!w.maximized;w.frame.classList.toggle('is-maximized',w.maximized);
    w.titlebar.querySelector('[data-window-control="zoom"]')?.setAttribute('aria-pressed',String(w.maximized));
    place(w);
  }
  function make(app:WindowApp,title:string,body:HTMLElement){
    const frame=document.createElement('section');
    frame.className='device-window opening-mac-window '+app;
    frame.setAttribute('role','region');frame.setAttribute('aria-label',title);frame.dataset.window=app;frame.tabIndex=-1;
    const titlebar=document.createElement('header');titlebar.className='device-titlebar';
    const controls=document.createElement('div');controls.className='device-controls';
    const caption=document.createElement('b');caption.textContent=title;
    const w:DeviceWindow={frame,body,titlebar,x:0,y:0,state:'closed',z:0,positioned:false,maximized:false};
    const actions=[
      ['close','Close window','×',()=>hide(app,'closed')],
      ['minimize','Minimize window','−',()=>hide(app,'minimized')],
      ['zoom','Zoom window','+',()=>zoom(w)],
    ] as const;
    for(const [key,label,mark,fn] of actions){
      const button=document.createElement('button');button.type='button';button.dataset.windowControl=key;button.textContent=mark;
      button.setAttribute('aria-label',label);button.title=label;button.addEventListener('click',fn);
      controls.append(button);
    }
    titlebar.append(controls,caption);
    const surface=document.createElement('div');surface.className='device-surface';surface.append(body);
    frame.append(titlebar,surface);host.append(frame);
    windows.set(app,w);
    frame.addEventListener('pointerdown',()=>{if(active!==app)focus(app);},{capture:true});
    frame.addEventListener('focusin',()=>{if(w.state==='visible'&&active!==app)focus(app);});
    titlebar.addEventListener('dblclick',event=>{if(!(event.target as Element).closest('button'))zoom(w);});
    titlebar.addEventListener('pointerdown',event=>{
      if(event.button!==0||w.maximized||(event.target as Element).closest('button'))return;
      const rect=w.frame.getBoundingClientRect();
      dragging={window:w,id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
      titlebar.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    titlebar.addEventListener('pointermove',event=>{
      if(dragging?.window!==w||dragging.id!==event.pointerId)return;
      const rect=host.getBoundingClientRect();
      w.x=event.clientX-rect.left-dragging.dx;w.y=event.clientY-rect.top-dragging.dy;place(w);
    });
    titlebar.addEventListener('lostpointercapture',()=>{dragging=null;});
    return w;
  }
  function open(app:WindowApp,title:string,body:()=>HTMLElement,activate?:()=>void) {
    const w=windows.get(app)??make(app,title,body());
    const wasVisible=w.state==='visible';w.state='visible';
    clearTimeout(w.exitTimer);delete w.frame.dataset.leaving;w.frame.hidden=false;w.frame.inert=false;
    focus(app);place(w);
    if(!wasVisible)activate?.();
    w.frame.focus({preventScroll:true});
  }
  return {open,focus,state:(app:WindowApp)=>windows.get(app)?.state??'closed',
    closeFront(){if(active==='desktop')return false;hide(active,'closed');return true;},
    desktop(){for(const [key,w] of windows)if(w.state==='visible')hide(key,'minimized');focus('desktop');},
    dispose(){resized.disconnect();for(const w of windows.values())clearTimeout(w.exitTimer);windows.clear();},
    get active(){return active;},
  };
}
