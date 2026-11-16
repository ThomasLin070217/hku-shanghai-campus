import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildObservedInterior} from './model/observedInteriors';
import {buildObservedFeatureRoom} from './model/observedFeatureRooms';
import {disposeAsset} from './model/buildCampus';
import {exportGLB, download} from './viewer/export';

const rooms = {
  lobby: {
    build: () => buildObservedInterior('lobby'),
    note: 'CDS-1 门厅 · 按 11 月 16 日照片细化闸机、冷色竖屏及暖白门框灯。',
    overview: [20, 17, 25], front: [0, 1.64, .60], target: [0, 1.2, -4.9],
  },
  floor13: {
    build: () => buildObservedInterior('floor13'),
    note: 'IMG_4347 04:49–05:00 · 13 层灰色电梯厅、木色茶水柜、微波炉、长桌与圆吊灯。',
    overview: [20, 17, 25], front: [0, 1.64, 11], target: [1, 1.2, 0],
  },
  keyboard: {
    build: () => buildObservedFeatureRoom('keyboard'),
    note: '11 月 15–16 日实拍 · 蓝底圆键、弧形沙发、木阶及格栅走廊。楼栋和楼层尚待核对。',
    overview: [12.6, 10.2, 17.6], front: [.38, 2.57, 6.32], target: [.42, 1.27, 2.78],
  },
  flipWall: {
    build: () => buildObservedFeatureRoom('flipWall'),
    note: '11 月 15 日实拍 · 走廊两色翻板拼成 HKU，保留墙框、板缝和弧形顶灯槽。楼栋和楼层尚待核对。',
    overview: [7.8, 4.5, 7.8], front: [.30, 2.05, 5.5], target: [.30, 1.80, -.75],
  },
  ringDisplay: {
    build: () => buildObservedFeatureRoom('ringDisplay'),
    note: '11 月 16 日实拍 · 内倾环形屏、红色嵌砖、桌椅与后墙电梯。楼栋和楼层尚待核对。',
    overview: [9.7, 7.4, 11.7], front: [.9, 1.67, 6.3], target: [0, 2.68, -2.3],
  },
};
type Room = keyof typeof rooms;

const host = document.querySelector<HTMLElement>('#stage')!;
const scene = new T.Scene();
scene.background = new T.Color(0xeae8de);
const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = T.ACESFilmicToneMapping;
host.append(renderer.domElement);
scene.add(new T.HemisphereLight(0xfff6e4, 0x9ca48e, 2.2));
const sun = new T.DirectionalLight(0xfff5df, 2.4);
sun.position.set(-10, 16, 12);
scene.add(sun);

const camera = new T.PerspectiveCamera(56, 1, .03, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 70;
controls.minDistance = 1;

let kind: Room = 'lobby';
let asset = rooms[kind].build();
scene.add(asset);
type View = 'overview' | 'front' | 'corridor';
let activeView:View='overview';
let fittedAspect = 1;

function view(mode:View='overview') {
  activeView=mode;
  const room=rooms[kind];
  if(mode==='corridor'){
    camera.position.set(-3.65,1.66,11.3);
    controls.target.set(-3.34,1.73,-1);
  }else{
    controls.target.fromArray(room.target);
    if(mode==='front'&&(kind==='lobby'||kind==='floor13'))controls.target.y=1.7;
    camera.position.fromArray(mode==='front'?room.front:room.overview);
    camera.position.sub(controls.target).multiplyScalar(Math.max(1,1.15/camera.aspect)).add(controls.target);
  }
  fittedAspect=camera.aspect;
  controls.update();
}

const roomButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-room]'));
const corridorButton=document.querySelector<HTMLButtonElement>('#corridor')!;
function select(next: Room) {
  if (next !== kind) {
    const replacement = rooms[next].build();
    scene.remove(asset);
    disposeAsset(asset);
    kind = next;
    asset = replacement;
    scene.add(asset);
  }
  view(kind==='ringDisplay'?'front':'overview');
  corridorButton.hidden=kind!=='keyboard';
  document.querySelector('#note')!.textContent = rooms[kind].note;
  for (const button of roomButtons) {
    const selected = button.dataset.room === kind;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}

for (const button of roomButtons) button.onclick = () => select(button.dataset.room as Room);
document.querySelector<HTMLButtonElement>('#front')!.onclick = () => view('front');
corridorButton.onclick=()=>view('corridor');
document.querySelector<HTMLButtonElement>('#overview')!.onclick = () => view();

const exportButton = document.querySelector<HTMLButtonElement>('#export')!;
exportButton.onclick = async () => {
  exportButton.disabled = true;
  for (const button of roomButtons) button.disabled = true;
  const exporting = asset;
  try {
    const bytes = await exportGLB(exporting);
    download(new Blob([bytes], {type: 'model/gltf-binary'}), exporting.name + '.glb');
  } finally {
    exportButton.disabled = false;
    for (const button of roomButtons) button.disabled = false;
  }
};

function resize() {
  renderer.setSize(host.clientWidth, host.clientHeight);
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  if (Math.abs(camera.aspect - fittedAspect) > .15) view(activeView);
}
new ResizeObserver(resize).observe(host);
resize();
select(kind);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
Object.assign(window, {__INTERIORS: {scene, camera, renderer, controls, select, view:(front=false)=>view(front?'front':'overview'), get asset() { return asset; }}});
