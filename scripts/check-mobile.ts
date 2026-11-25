/**
 * Mobile shell primitives: the pure joystick mapping, touch detection, the
 * default graphics quality rule and the safe-area viewport.
 *
 * Task 3 extends this same check with the source and stylesheet asserts for the
 * touch controls layer.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {joystickAxes,useTouchControls,TOUCH_DEAD_ZONE} from '../src/opening/touchInput';
import {fullscreenLabel,fullscreenPlan} from '../src/opening/fullscreenPlan';
import {defaultGraphicsQuality,TOUCH_MAX_PIXEL_RATIO} from '../src/viewer/graphicsQuality';

let passed=0;const failures:string[]=[];
function check(name:string,fn:()=>void){
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message.split('\n')[0]:String(error));}
}
const R=54;
const close=(a:number,b:number,what:string)=>assert.ok(Math.abs(a-b)<=1e-9,`${what}: ${a} != ${b}`);

// 1. Joystick mapping.
check('joystick: the dead zone is the binding 0.16',()=>assert.equal(TOUCH_DEAD_ZONE,0.16));
check('joystick: centre is neutral',()=>assert.deepEqual(joystickAxes(0,0,R),{forward:0,right:0}));
check('joystick: screen up is forward 1',()=>assert.deepEqual(joystickAxes(0,-R,R),{forward:1,right:0}));
check('joystick: screen right is right 1',()=>assert.deepEqual(joystickAxes(R,0,R),{forward:0,right:1}));
check('joystick: screen down is backward 1',()=>assert.deepEqual(joystickAxes(0,R,R),{forward:-1,right:0}));
check('joystick: diagonal is unit length on both axes',()=>{
 const a=joystickAxes(R,R,R);close(a.forward,-Math.SQRT1_2,'forward');close(a.right,Math.SQRT1_2,'right');close(Math.hypot(a.forward,a.right),1,'length');
});
check('joystick: inside the dead zone both axes are 0',()=>{
 assert.deepEqual(joystickAxes(0,-R*(TOUCH_DEAD_ZONE-.01),R),{forward:0,right:0});
 assert.deepEqual(joystickAxes(R*.1,R*.05,R),{forward:0,right:0});
});
check('joystick: beyond the radius is clamped to unit length',()=>{
 assert.deepEqual(joystickAxes(0,-R*3,R),{forward:1,right:0});
 const a=joystickAxes(R*2,R*2,R);close(Math.hypot(a.forward,a.right),1,'diagonal length');close(a.forward,-Math.SQRT1_2,'direction kept');
});
check('joystick: a half deflection is half length',()=>{
 const a=joystickAxes(0,-R/2,R);close(a.forward,.5,'forward');
});
check('joystick: invalid radius or non-finite input is neutral',()=>{
 for(const r of [0,-1,NaN,Infinity])assert.deepEqual(joystickAxes(20,20,r),{forward:0,right:0},`radius ${r}`);
 assert.deepEqual(joystickAxes(NaN,0,R),{forward:0,right:0});
 assert.deepEqual(joystickAxes(0,Infinity,R),{forward:0,right:0});
});

// 2. Touch detection.
check('detection: a coarse primary pointer is touch',()=>{
 assert.equal(useTouchControls({coarsePointer:true,maxTouchPoints:0,hoverNone:false}),true);
});
check('detection: touch points with no hover asks for touch controls',()=>{
 assert.equal(useTouchControls({coarsePointer:false,maxTouchPoints:5,hoverNone:true}),true);
});
check('detection: a hybrid with touch points and hover keeps the desktop path',()=>{
 assert.equal(useTouchControls({coarsePointer:false,maxTouchPoints:5,hoverNone:false}),false);
});
check('detection: a fine pointer with no touch points keeps the desktop path',()=>{
 assert.equal(useTouchControls({coarsePointer:false,maxTouchPoints:0,hoverNone:false}),false);
 assert.equal(useTouchControls({coarsePointer:false,maxTouchPoints:0,hoverNone:true}),false,'no hover without touch is still a mouse');
});
check('detection: both call sites ask the primary pointer, never any-pointer',()=>{
 for(const file of ['../src/exploration/controller.ts','../src/viewer/graphicsQuality.ts']){
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.ok(source.includes('(pointer: coarse)'),`${file} asks for the primary pointer`);
  assert.ok(!source.includes('(any-pointer: coarse)'),`${file} must not use the any-pointer query`);
 }
});

// 3. Default graphics quality precedence.
check('quality: an explicit auto beats the touch-low default',()=>{
 assert.equal(defaultGraphicsQuality({override:'auto',stored:null,touch:true,shortestSide:400}),'auto');
});
check('quality: an explicit low wins everywhere',()=>{
 assert.equal(defaultGraphicsQuality({override:'low',stored:null,touch:false,shortestSide:1400}),'low');
});
check('quality: a stored low wins over a large touch screen',()=>{
 assert.equal(defaultGraphicsQuality({override:null,stored:'low',touch:true,shortestSide:1200}),'low');
});
check('quality: a small touch screen defaults to low',()=>{
 assert.equal(defaultGraphicsQuality({override:null,stored:null,touch:true,shortestSide:390}),'low');
 assert.equal(defaultGraphicsQuality({override:null,stored:null,touch:true,shortestSide:900}),'low','the boundary is inclusive');
});
check('quality: a large touch screen defaults to auto',()=>{
 assert.equal(defaultGraphicsQuality({override:null,stored:null,touch:true,shortestSide:901}),'auto');
});
check('quality: a mouse never gets the touch-low default',()=>{
 assert.equal(defaultGraphicsQuality({override:null,stored:null,touch:false,shortestSide:390}),'auto');
});
check('quality: an unknown override or stored value is ignored',()=>{
 assert.equal(defaultGraphicsQuality({override:'high',stored:'auto',touch:true,shortestSide:400}),'low');
});

// 4. The safe-area viewport.
check('index.html: the viewport meta covers the safe area',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/name="viewport"/,'the viewport meta exists');
 assert.match(html,/width=device-width, initial-scale=1\.0, viewport-fit=cover/,'the viewport content is unchanged except for the safe-area cover');
});

// 5. Fullscreen: what the control does on each device.
check('fullscreen: a desktop with the API gets a button that drives it',()=>{
 assert.deepEqual(fullscreenPlan({fullscreenEnabled:true,requestAvailable:true,standalone:false,touch:false}),
  {button:true,api:true,hint:false});
});
check('fullscreen: an iPhone without the API gets the Add to Home Screen hint, not a dead button',()=>{
 assert.deepEqual(fullscreenPlan({fullscreenEnabled:false,requestAvailable:false,standalone:false,touch:true}),
  {button:true,api:false,hint:true});
});
check('fullscreen: an installed app needs neither the button nor the hint',()=>{
 assert.deepEqual(fullscreenPlan({fullscreenEnabled:false,requestAvailable:false,standalone:true,touch:true}),
  {button:false,api:false,hint:false});
 assert.deepEqual(fullscreenPlan({fullscreenEnabled:true,requestAvailable:true,standalone:true,touch:false}),
  {button:false,api:false,hint:false},'even with the API, the installed app already owns the screen');
});
check('fullscreen: a disabled API (no allowfullscreen iframe) shows nothing',()=>{
 assert.deepEqual(fullscreenPlan({fullscreenEnabled:false,requestAvailable:true,standalone:false,touch:false}),
  {button:false,api:false,hint:false});
});
check('fullscreen: the label follows the state',()=>{
 assert.equal(fullscreenLabel(false),'Full screen');
 assert.equal(fullscreenLabel(true),'Exit full screen');
});
check('fullscreen: only a working API gets the toggle, never a dead button',()=>{
 const source=readFileSync(new URL('../src/opening/fullscreen.ts',import.meta.url),'utf8');
 assert.ok(source.includes('if (plan.api) {'),'the toggle is gated by the API');
 assert.ok(!source.includes('if (plan.button) {'),'plan.button alone would mount a toggle that does nothing on an iPhone');
});

// 6. The manifest and the iPhone meta that make Add to Home Screen full-screen.
check('index.html: the manifest and the Apple web-app meta exist',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/,'the manifest is linked relatively (the site is served from a subpath)');
 assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
 assert.match(html,/name="mobile-web-app-capable" content="yes"/);
 assert.match(html,/name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
 assert.match(html,/rel="apple-touch-icon"/,'iOS needs its own icon link');
});
check('manifest: standalone display, relative scope, real icons',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8')) as {display:string;start_url:string;scope:string;icons:{src:string;sizes:string}[]};
 assert.equal(manifest.display,'standalone','Add to Home Screen must open without browser chrome');
 assert.equal(manifest.start_url,'./','the game is served from /hku-shanghai-campus/, so the start URL is relative');
 assert.equal(manifest.scope,'./');
 assert.ok(manifest.icons.length>=3,'192, 512 and the maskable icon');
 assert.ok(manifest.icons.every(i=>i.src.startsWith('./')),'icons are relative to the manifest');
 for(const size of ['192x192','512x512'])assert.ok(manifest.icons.some(i=>i.sizes===size),`a ${size} icon is declared`);
});

// 7. The touch layer is the real one: one code path with the keyboard.
check('touch controls: mounted as .touch-controls and driven by the explorer',()=>{
 const source=readFileSync(new URL('../src/opening/touchControls.ts',import.meta.url),'utf8');
 assert.ok(source.includes("className = 'touch-controls'"));
 assert.ok(source.includes('explorer.touchMove'),'the stick drives the analog move API');
 assert.ok(source.includes('explorer.touchRun'),'RUN drives the sprint API');
});
check('touch controls: USE, JUMP, BAG and MENU send the keyboard codes',()=>{
 const source=readFileSync(new URL('../src/opening/touchControls.ts',import.meta.url),'utf8');
 for(const code of ['KeyF','KeyE','Space','Escape'])assert.ok(source.includes(`code: '${code}'`),`${code} is dispatched, so the game keeps one input path`);
});
check('touch controls: the stick re-sends while held (a clear() must not stall it)',()=>{
 const source=readFileSync(new URL('../src/opening/touchControls.ts',import.meta.url),'utf8');
 assert.match(source,/requestAnimationFrame\(step\)/,'the hold loop keeps sending the deflection');
});
check('touch controls: campaign focus turns USE into BACK',()=>{
 const source=readFileSync(new URL('../src/opening/touchControls.ts',import.meta.url),'utf8');
 assert.ok(source.includes("focused ? 'BACK' : 'USE'"));
 assert.ok(source.includes('data-campaign-focus'));
});

// 8. The touch stylesheet: safe areas, both orientations, target sizes.
check('touch.css: safe areas and both orientation rules exist',()=>{
 const css=readFileSync(new URL('../src/opening/touch.css',import.meta.url),'utf8');
 assert.ok(css.includes('env(safe-area-inset'),'every edge respects the notch and the home indicator');
 assert.match(css,/@media \(orientation: portrait\)/);
 assert.match(css,/@media \(orientation: landscape\)/);
 assert.match(css,/min-height: 44px/,'the dismiss button meets the 44 px target floor');
});
check('touch.css: the hotbar and the prompt move above the controls',()=>{
 const css=readFileSync(new URL('../src/opening/touch.css',import.meta.url),'utf8');
 assert.match(css,/body\.touch-mode\.opening-mode\.exploring #inventory-hud/,'the rule must outrank the 6 px game rule');
 assert.match(css,/body\.touch-mode \.opening-prompt/);
});
check('touch.css: desk-only chrome is hidden on a phone, never overlapped',()=>{
 const css=readFileSync(new URL('../src/opening/touch.css',import.meta.url),'utf8');
 assert.match(css,/body\.touch-mode \.bag-open \{\s*display: none;/,'the Bag (E) hotbar hint is a keyboard affordance, not a phone one');
 assert.match(css,/@media \(orientation: landscape\) and \(max-height: 500px\) \{[\s\S]*?body\.touch-mode \.opening-mapcard \{\s*display: none;/,'a short landscape phone hides the minimap rather than covering RUN and MENU');
});

// 9. The renderer cap is wired, and the desktop path is untouched.
check('renderer: touch devices cap at 1.15 and main.ts passes it',()=>{
 assert.equal(TOUCH_MAX_PIXEL_RATIO,1.15);
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 assert.match(main,/createSiteViewer\(host,\(\)=>true,touch\?TOUCH_MAX_PIXEL_RATIO:undefined\)/,'the cap is handed to the viewer');
 assert.ok(main.includes("createTouchControls(explorer)"));
 assert.ok(main.includes("createFullscreenControl({stage:stageEl"));
});
check('controller: touchMove and touchRun are part of the explorer API',()=>{
 const controller=readFileSync(new URL('../src/exploration/controller.ts',import.meta.url),'utf8');
 assert.ok(controller.includes('touchMove,'));
 assert.ok(controller.includes('touchRun,'));
});
check('controller: the look multiplier only applies to touch pointers',()=>{
 const controller=readFileSync(new URL('../src/exploration/controller.ts',import.meta.url),'utf8');
 assert.match(controller,/e\.pointerType === 'touch'\?2\.4:1/,'a mouse drag keeps its desktop sensitivity');
});

if(failures.length){console.log(`\ncheck-mobile: ${failures.length} failed`);process.exit(1);}
console.log(`\n${passed+failures.length} checks, 0 failed`);
