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
import {defaultGraphicsQuality} from '../src/viewer/graphicsQuality';

let passed=0;const failures:string[]=[];
function check(name:string,fn:()=>void){
 try{fn();passed++;console.log('  ok  ',name);}
 catch(error){failures.push(name);console.log('  FAIL',name,'\n        ',error instanceof Error?error.message.split('\n')[0]:String(error));}
}
const R=54;
const close=(a:number,b:number,what:string)=>assert.ok(Math.abs(a-b)<=1e-9,`${what}: ${a} != ${b}`);

// 1. Joystick mapping.
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
check('detection: a coarse pointer alone asks for touch controls',()=>{
 assert.equal(useTouchControls({anyCoarse:true,maxTouchPoints:0,hoverNone:false}),true);
});
check('detection: touch points with no hover asks for touch controls',()=>{
 assert.equal(useTouchControls({anyCoarse:false,maxTouchPoints:5,hoverNone:true}),true);
});
check('detection: touch points with hover keeps the desktop path',()=>{
 assert.equal(useTouchControls({anyCoarse:false,maxTouchPoints:5,hoverNone:false}),false);
});
check('detection: a fine pointer with no touch points keeps the desktop path',()=>{
 assert.equal(useTouchControls({anyCoarse:false,maxTouchPoints:0,hoverNone:false}),false);
 assert.equal(useTouchControls({anyCoarse:false,maxTouchPoints:0,hoverNone:true}),false,'no hover without touch is still a mouse');
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

if(failures.length){console.log(`\ncheck-mobile: ${failures.length} failed`);process.exit(1);}
console.log(`\n${passed+failures.length} checks, 0 failed`);
