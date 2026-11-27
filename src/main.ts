import {createOpeningExperience} from './opening/experience';
import {createPrologue} from './opening/prologue';
import {openingCheckpoint,checkpointCampaign,checkpointForStage,CHECKPOINT_LABELS,applyCheckpointThreat,type OpeningCheckpoint} from './opening/checkpoint';
import {OPENING_SAVE_KEY} from './opening/persistence';
import {createChapterList} from './opening/chapterMenu';
import {DEFAULT_SETTINGS} from './gameplay/save';
import {createCampaignHost,type CampaignHost} from './campaign/host';
import {showChapterCard} from './campaign/chapterCard';
import {CAMPAIGN_CHAPTERS} from './campaign/chapters';
import type {HeartsChannel} from './opening/heartsChannel';
import type {CampaignEvent} from './campaign/state';
import {markRelayRestored,relayRestored} from './opening/backupRelay';
import {recordCorePowerCut} from './lionBoss/mission';
import {createOpeningAtmosphere,type OpeningAtmosphere} from './opening/atmosphere';
import {loadWorldThreat,sealWorld} from './gameplay/worldThreat';
import {BUILD_VERSION,BUILD_STAMP} from './version';
const route=new URLSearchParams(location.search).get('experience');
const sportsMode=route==='sports-hall';
const openingMode=route!=='survey'&&!sportsMode;
const publicPlaytest=import.meta.env.MODE==='playtest';
/** The local AI bridge only exists when this page is served as local tooling. */
const localAiControls=!publicPlaytest&&LOCAL_TOOLS;
import {createSceneInspector} from './scene/inspector';
import {createSceneService} from './scene/service';
import {sceneRegistry} from './scene/registry';
import {prepareModelTextures,deferredTextureStats} from './model/deferredTextures';
import {createExperience} from './gameplay/experience';
import {createSportsDoor,createSportsRescueExperience} from './gameplay/sportsDoor';
import {createStudentCrowd} from './gameplay/studentCrowd';
import {CONTROL_GUIDE,KEYS,keyLabel} from './exploration/config';
import {buildLounge} from './model/buildLounge';
import {createGlassEnvironment} from './viewer/glassEnvironment';
import {createNightLighting} from './viewer/nightLighting';
import {connectAgent} from './agent/bridge';
import {LOCAL_TOOLS} from './agent/localTools';
import './style.css';
import './ui/exploration.css';
import {setText,setHidden} from './ui/dom';
import {createExplorer} from './exploration/controller';
import * as T from 'three';
import {buildSite} from './model/buildSite';
import {SCALE_CALIBRATION} from './model/scaleCalibration';
import {cloneBuildings,SITE,parseCampusConfig,type BuildingSpec} from './model/campusParameters';
import {modelStats,disposeAsset,resourceReport} from './model/buildCampus';
import {createSiteViewer,type CampusView} from './viewer/siteViewer';
import {TOUCH_MAX_PIXEL_RATIO,touchDevice} from './viewer/graphicsQuality';
import {createTouchControls} from './opening/touchControls';
import {createFullscreenControl,fullscreenLabel} from './opening/fullscreen';
import {exportGLB,reloadGLB,download} from './viewer/export';
// --------------------------------------------------------- boot parameters (R-12).
// `?checkpoint=bus` predates the plaza opening: the bus is parked scenery now, so the value
// names the crowd start, not a checkpoint. An old bookmark must start Chapter 1 at the plaza
// rather than silently resume whatever save this tab holds. Any other unknown value is
// reported below instead of ignored; `OPENING_CHECKPOINTS` stays the honest list.
const bootQuery=new URLSearchParams(location.search);
let unknownCheckpoint:string|null=null;
{
 const raw=bootQuery.get('checkpoint');
 if(openingMode&&raw&&openingCheckpoint(raw)===null){
  if(raw==='bus'){
   bootQuery.delete('checkpoint');bootQuery.set('fresh','1');
   try{history.replaceState(null,'',location.pathname+'?'+bootQuery.toString()+location.hash);}catch{/* the URL is cosmetic */}
  }else unknownCheckpoint=raw;
 }
}
// The opening's checkpoints only exist on the opening page: the sports-hall and survey
// pages keep their own reset paths.
const bootCheckpoint=openingMode?openingCheckpoint(bootQuery.get('checkpoint')):null;
let specs=cloneBuildings(),site={...SITE},asset=buildSite(specs,site,openingMode),imported:T.Object3D|null=null,selected='B04';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header class="header"><a class="brand" href="./"><span class="brand-mark">H<span>K</span>U</span><span class="brand-copy">SHANGHAI<span>Campus Survey · 09</span></span></a><div class="header-right"><a href="./characters.html" target="_blank">Character index ↗</a><button id="night-toggle">Night / Day</button><a href="./interiors.html" target="_blank">Interior record ↗</a><button id="lounge-toggle">Building 5 · 4F</button><button id="mode-toggle" class="mode-toggle">Model view &amp; export</button><button id="walk-photo" class="walk-photo">Save view ↓</button><span class="status-dot"></span><span>Campus</span> <span class="header-divider">/</span><span>张江基地</span> <a href="./evidence/nov14-video/index.html" target="_blank">Review archive ↗</a></div></header>
<main class="layout"><aside class="sidebar"><div class="eyebrow">ZHANGJIANG · CAMPUS ATLAS</div><h1 class="campus-title">HKU<br><em>Shanghai.</em></h1><p class="lead">Seven building groups, one public-space axis.</p><p class="asset-description">Based on campus photography, the design team's aerial footage and the satellite layout.<br>An editable campus asset, inspectable building by building.</p>
<div class="section-title">Campus views <span>01—06</span></div><div class="views"><button data-view="iso" class="active">Campus overview</button><button data-view="top">Site plan</button><button data-view="north">North sports zone</button><button data-view="south">South entrance</button><button data-view="plaza">Central courtyard</button><button data-view="selected">Selected building</button></div>
<div class="section-title spacing">Building index <span>7 BUILDINGS</span></div><div id="building-list" class="building-list"></div><div id="building-note" class="building-note"></div><label class="toggle-row"><span>Isolate building</span><input id="isolate" type="checkbox"><i></i></label>
<details class="parameters"><summary>Edit selected building <span>＋</span></summary><p class="tiny">Estimated metric parameters; building positions checked against the candidate site plan. Edits rebuild live; the JSON can be saved and restored.</p><div class="param-grid">${[['x','Position X'],['z','Position Z'],['width','Width'],['depth','Depth'],['height','Height'],['floors','Estimated floors'],['bays','Facade bays'],['rotation','Rotation']].map(([key,label])=>`<label>${label}<input type="number" name="${key}" step="${['floors','bays'].includes(key)?1:.1}"></label>`).join('')}</div><div class="param-buttons"><button id="apply">Apply parameters</button><button id="restore">Restore campus</button></div><div class="param-buttons"><button id="save-config">Save JSON</button><button id="load-config">Load JSON</button></div><input type="file" id="file-config" accept=".json" hidden></details>
<div class="section-title spacing">Scene layers</div>${[['environment','Ground, roads and planting'],['circulation','Walkways, grand steps and sunken space'],['sports','North sports facilities'],['labels','Building numbers']].map(([id,name])=>`<label class="toggle-row"><span>${name}</span><input id="${id}" type="checkbox" checked><i></i></label>`).join('')}
<div class="evidence-note"><span class="small-label">Evidence boundary</span><p><b>Overall layout and visible form cross-checked</b><br>Horizontal dimensions are checked against satellite measurements; heights, hidden faces and connection nodes remain estimates.</p><button id="evidence-open">See confirmed and provisional items ↗</button></div>
<div class="export-section"><div class="section-title">Export asset</div><select id="export-scope" aria-label="Export scope"><option value="all">Whole campus</option><option value="selected">Selected building · local origin</option></select><label class="check-row"><input id="include-env" type="checkbox" checked>Whole-campus export includes the currently visible environment</label><button id="export-glb" class="primary">Export GLB ↓</button><div class="secondary-row"><button id="export-png">Save PNG ↓</button><button id="load-glb">Reload GLB ↑</button></div><button id="return-model" class="return-model">Restore editable campus ↺</button><input type="file" id="file-glb" accept=".glb" hidden><label class="check-row"><input id="transparent" type="checkbox">Transparent PNG · hide ground and planting</label></div><footer class="sidebar-footer">CAMPUS 002 <span>OPEN SOURCE / v9.0</span></footer></aside>
<section class="stage" aria-label="Campus 3D preview"><div id="viewport"></div><div id="labels-layer"></div><div class="stage-top"><span id="mode-label">Orthographic · Campus overview</span><button id="reset">↺ Reset overview</button></div><div class="stage-bottom"><span>Drag to rotate · scroll to zoom · right-drag to pan</span><span id="stats"></span></div><div class="model-tag"><span>07</span><div>ZHANGJIANG<small>HKU Shanghai campus · normal state</small></div></div><div id="toast" role="status"></div><div id="crosshair">+</div><div id="control-badge"><span id="control-state">Player · Paused</span><button id="takeover">Take control</button></div><div id="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="pause-card"><div class="eyebrow">HKU SHANGHAI / VOXEL CAMPUS</div><h2 id="pause-title">Campus Survey</h2><p>Visit three landmarks, collect campus records, then sync the archive with the MacBook. Any order, about 3–5 minutes.</p><button id="enter-game" class="primary">Enter exploration</button><button id="enter-compat" hidden>Drag controls</button><div class="key-guide">${CONTROL_GUIDE(openingMode)}</div><section class="pause-group pause-chapters" aria-labelledby="pause-chapters-title"><h3 class="pause-group-title" id="pause-chapters-title">Chapter</h3><button id="replay-intro" type="button">Replay intro</button><button id="pause-checkpoint" class="pause-checkpoint" type="button">Return to checkpoint</button><details class="pause-chapter-select"><summary>Chapter select</summary><div data-pause-chapters></div></details></section><section class="pause-group pause-settings" id="pause-settings" aria-labelledby="pause-settings-title"><h3 class="pause-group-title" id="pause-settings-title">Settings</h3><label class="pause-setting">Music volume<output id="pause-music-out" for="pause-music"></output><input id="pause-music" data-setting="music" type="range" min="0" max="1" step="0.05" aria-label="Music volume"></label><label class="pause-setting">Ambient volume<output id="pause-ambient-out" for="pause-ambient"></output><input id="pause-ambient" data-setting="ambient" type="range" min="0" max="1" step="0.05" aria-label="Ambient volume"></label><label class="pause-setting">Mouse sensitivity<output id="pause-sensitivity-out" for="pause-sensitivity"></output><input id="pause-sensitivity" data-setting="sensitivity" type="range" min="0.0004" max="0.006" step="0.0001" aria-label="Mouse sensitivity"></label><button id="pause-fullscreen" type="button">Full screen</button><button id="experience-settings">Settings &amp; save</button></section><p id="session-save" class="tiny"></p><p id="build-version" class="tiny"></p><button id="new-game">Restart game…</button><button id="enable-ai">Enable AI control</button><p class="tiny" id="bridge-status">Local control service: not connected</p></div></div></section></main>
<dialog id="evidence-dialog"><button class="close-dialog" aria-label="Close">×</button><div class="eyebrow">REFERENCE → CAMPUS</div><h2>A traceable campus reconstruction</h2><div class="evidence-images"><figure><img loading="lazy" src="./references/architect/A04.jpg" alt="Design team aerial photo, four towers and the low north block"><figcaption>C01 / Design team aerial photo</figcaption></figure><figure><img loading="lazy" src="./references/campus/phase2-07.jpg" alt="Campus photo, 2026 south lawn and the HKU sign"><figcaption>C02 / Campus south lawn, 2026</figcaption></figure></div><p><b>Confirmed:</b> seven building groups, two tower facade types, the central auditorium and grand steps, the sunken plaza, the elevated walkway and the existing sports facility types.</p><p><b>Reasonable inference:</b> tower row alignment, walkway connections and the layout of the north sports zone.</p><p><b>Provisional:</b> building heights, unmeasured depths, floor counts, roof equipment, hidden faces, walkway node elevations and exact sports-field boundaries. Planning drawings were not treated as as-built drawings.</p><p><b>Measured 2026-11-14:</b> the CDS-1 roof is about 60×45 m; the north east and west buildings are about 116 m apart centre to centre, each row shifted out by 6 m. Imagery date unknown; see the error notes.</p><a href="./references/scale-calibration/index.html" target="_blank">See satellite measurements and before/after comparison ↗</a><p><a href="./references/glass/index.html" target="_blank">See glass, frame and backing corrections ↗</a></p><p>Covers the Fangchun Road main campus and the adjacent sports strip. The Shengxia Road off-campus flats, the Hong Kong home campus and other Shanghai sites are outside this plot; the 2035 storyline is not included yet.</p><a href="./references/campus-index.html" target="_blank">Open sources, reference index and per-building evidence ↗</a></dialog>`;
const host=document.querySelector<HTMLElement>('#viewport')!;const touch=touchDevice();const viewer=createSiteViewer(host,()=>true,touch?TOUCH_MAX_PIXEL_RATIO:undefined);viewer.scene.add(asset.root);
const lounge=buildLounge();lounge.visible=false;viewer.scene.add(lounge);const glassEnvironment=createGlassEnvironment(viewer.renderer,viewer.scene);const lighting=createNightLighting(viewer.scene,glassEnvironment.refresh,viewer.lights);let loungeView=false;const loungeDayExposure=viewer.renderer.toneMappingExposure;
let exploring=false;let pauseWasHidden:boolean|null=null;const explorer=createExplorer(viewer.renderer.domElement,viewer.scene,specs,site,openingMode);
// The phone shell: an on-screen stick and action buttons, plus a fullscreen
// control that works on desktop and explains the Add to Home Screen route where
// iPhone Safari has no Fullscreen API. Both are inert on a fine-pointer device.
const stageEl=document.querySelector<HTMLElement>('.stage')!;
const touchControls=touch?createTouchControls(explorer):null;
if(touchControls){document.body.classList.add('touch-mode');stageEl.append(touchControls.root);}
const fullscreen=createFullscreenControl({stage:stageEl,touch,onViewportChange:()=>{explorer.resize(host.clientWidth,host.clientHeight);}});
let atmosphere:OpeningAtmosphere|undefined;
let viewportWidth=host.clientWidth,viewportHeight=host.clientHeight;const viewportObserver=new ResizeObserver(([entry])=>{viewportWidth=entry.contentRect.width;viewportHeight=entry.contentRect.height;explorer.resize(viewportWidth,viewportHeight);});viewportObserver.observe(host);explorer.resize(viewportWidth,viewportHeight);viewer.beforeRender.add(dt=>explorer.update(dt));
const elements=new Map<string,HTMLElement>();const el=(id:string)=>{let node=elements.get(id);if(!node){node=document.getElementById(id)!;elements.set(id,node);}return node;};const checked=(id:string)=>(el(id) as HTMLInputElement).checked;let timer:ReturnType<typeof setTimeout>;
function notify(message:string){el('toast').textContent=message;el('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el('toast').classList.remove('show'),4500);}
const crowd=openingMode?null:createStudentCrowd();
if(crowd)viewer.scene.add(crowd.root);
let door:ReturnType<typeof createSportsDoor>|null=null;
const interactWithDoor=()=>door?.interact()??false;
let campaign:CampaignHost|undefined;
/** What the pause card's checkpoint button can do here: the epilogue has no pose to return
 * to (R-09), a run with no save has no checkpoint yet (R-10), everything else can reset. */
function checkpointReadiness():'ready'|'epilogue'|'none'{
 if(campaign?.active)return campaign.chapter()==='ending'?'epilogue':'ready';
 if(bootCheckpoint)return 'ready';
 try{return localStorage.getItem(OPENING_SAVE_KEY)!==null?'ready':'none';}catch{return 'none';}
}
const experience=openingMode
 ?createOpeningExperience(viewer.scene,explorer,notify,()=>asset.openingWorld,()=>loungeView?undefined:atmosphere,()=>campaign)
 :sportsMode?createSportsRescueExperience(explorer,interactWithDoor)
 :createExperience(viewer.scene,explorer,notify,{beforeInteract:interactWithDoor});
if(unknownCheckpoint)notify(`Unknown checkpoint “${unknownCheckpoint}” — the run continues from the saved state.`);
// -------------------------------------------------------------- pause card.
// Chapter select and Replay intro live in the pause card (owner, 2026-11-25):
// the floating Chapters link is covered by the pause overlay while paused
// (z-index 12 over 11) and the pointer is locked while playing, so it could
// never be clicked. The card is the one surface a player can always click.
let syncPauseCard=()=>{};
{
 const chapterHost=document.querySelector<HTMLElement>('[data-pause-chapters]');
 if(chapterHost)chapterHost.replaceWith(createChapterList());
 const host=experience as unknown as {settings?:Record<string,number|boolean>;setSetting?:(key:string,value:number|boolean)=>void};
 const section=document.getElementById('pause-settings');
 const sliders=Array.from(document.querySelectorAll<HTMLInputElement>('#pause-settings input[data-setting]'));
 const format=(key:string,value:number)=>key==='sensitivity'?(value/DEFAULT_SETTINGS.sensitivity).toFixed(2)+'×':Math.round(value*100)+'%';
 // The `<output>` carries the value for sighted players; `aria-valuetext` carries it for
 // screen readers. Without it the wrapping label made the accessible name
 // "Music volume20%" and changed on every slider move (D-10).
 const output=(key:string,value:number)=>{const text=format(key,value),node=document.getElementById(`pause-${key}-out`),input=document.getElementById(`pause-${key}`);if(node)node.textContent=text;if(input)input.setAttribute('aria-valuetext',text);};
 syncPauseCard=()=>{
  const values=host.settings;if(values)for(const input of sliders){const key=input.dataset.setting!;const value=Number(values[key]);if(Number.isFinite(value)&&input.value!==String(value))input.value=String(value);output(key,Number(input.value));}
  const checkpoint=document.getElementById('pause-checkpoint') as HTMLButtonElement|null;
  if(checkpoint){
   // Only offer a return that exists: the epilogue has no checkpoint pose (R-09) and a
   // brand-new run has nothing to return to yet (R-10). Other pages keep their own label.
   const readiness=openingMode?checkpointReadiness():'ready';
   checkpoint.hidden=readiness==='epilogue';
   checkpoint.disabled=readiness==='none';
   checkpoint.textContent=readiness==='none'?'No checkpoint yet':el('reset').textContent.replace(/^[↺\s]+/,'');
  }
 };
 if(section&&!host.setSetting)section.hidden=true;
 for(const input of sliders)input.addEventListener('input',()=>{const key=input.dataset.setting!,value=Number(input.value);host.setSetting?.(key,value);output(key,value);});
 syncPauseCard();
 document.getElementById('pause-checkpoint')?.addEventListener('click',()=>el('reset').click());
 const fullscreenButton=document.getElementById('pause-fullscreen');
 if(fullscreenButton&&!fullscreen.api)fullscreenButton.hidden=true;
 fullscreenButton?.addEventListener('click',()=>{void fullscreen.toggle();});
 const syncFullscreen=()=>{if(fullscreenButton)fullscreenButton.textContent=fullscreenLabel(!!document.fullscreenElement);};
 document.addEventListener('fullscreenchange',syncFullscreen);syncFullscreen();
}
if(openingMode){
 // One world: after Chapter 1 the campaign runs B4 → lawn → sports hall → ending
 // in this page, on this campus model, explorer and HUD, in first person.
 explorer.lockView('first');
 let dragControls=false;
 const host=createCampaignHost({context:{
  scene:viewer.scene,root:()=>asset.root,explorer,notify,atmosphere:()=>atmosphere,
  openPanel:id=>{dragControls=document.pointerLockElement!==viewer.renderer.domElement;explorer.openPanel(id==='computer'||id==='settings'?id:'door');},
  closePanel:()=>explorer.closePanel(),resume:()=>dragControls?explorer.enterCompat():explorer.enter(),
  card:showChapterCard,hearts:(experience as {hearts?:HeartsChannel}).hearts,
  // Loop cues take over the story bus's bed, so the campaign never stacks two musics.
  // One-shots (a victory stinger) ride the shared music bus, which survives the ending's
  // pause; both honour the player's music volume and mute.
  music:(name,options)=>{
   const audio=(experience as {audio?:{playScore?(name:string,loop?:boolean):void}}).audio;
   audio?.playScore?.(name,options?.loop===true);
  },
  stopMusic:()=>(experience as {audio?:{stopScore?():void}}).audio?.stopScore?.(),
 },chapters:CAMPAIGN_CHAPTERS,
 // The save toast belongs to chapter boundaries, not to every save (Ruling 33).
 onChapterBoundary:()=>(experience as {announceSave?:()=>void}).announceSave?.()});
 campaign=host;
 const checkpoint=openingCheckpoint(new URLSearchParams(location.search).get('checkpoint')),resume=checkpoint?checkpointCampaign(checkpoint):null;
 const mac=explorer.game.inventory.slots.find(slot=>slot?.itemId==='macbook-air-13-silver')?.instanceId;
 if(resume&&mac){
  // Campaign checkpoint: the results of the chapters before it, through their real writers.
  if(resume.relay)markRelayRestored(mac);
  if(resume.corePower)recordCorePowerCut(mac);
  // Seal + lion + power must be on disk before the ending attaches (it purges).
  if(checkpoint)applyCheckpointThreat(checkpoint);
  host.start(mac,resume.stage);
 }else if((experience as {story?:{stage:string}}).story?.stage!=='complete'||checkpoint)host.reset();
 else if(!host.active&&mac)host.start(mac,relayRestored(mac)?'to_lawn':'b4_enter'); // a Chapter 1 save from before the campaign existed
 viewer.beforeRender.add(dt=>host.update(dt));
 // F reaches the campaign through the opening's one interact handler (campaign first).
}
if(!openingMode){
 let dragControls=false;
 door=createSportsDoor({
  root:()=>asset.root,game:()=>explorer.game,notify,
  openPanel:()=>{dragControls=document.pointerLockElement!==viewer.renderer.domElement;explorer.openPanel('door');},
  closePanel:()=>explorer.closePanel(),resume:()=>dragControls?explorer.enterCompat():explorer.enter(),
  persist:()=>experience.persist(true),standalone:sportsMode
 });
 viewer.beforeRender.add(dt=>door?.update(dt));
}
function loadAssetTextures(root:T.Object3D){
 // The sign photos are decorative, and this message is authoring copy ("Re-apply
 // parameters", "export"). A player's page must boot without an error toast for a
 // texture the player cannot act on — on a loaded machine the decode can also time
 // out on a perfectly normal boot (D-06). The authoring page keeps the message.
 void prepareModelTextures(root).catch(error=>{
  if(document.body.classList.contains('game-shell')){console.warn('[campus] sign photos could not load',error);return;}
  notify('Sign photos could not load. Re-apply parameters to retry; export will load them again.');
 });
}
loadAssetTextures(asset.root);
const graphicsControls=['export-png','walk-photo','enter-game','enter-compat','enable-ai'];
viewer.renderer.domElement.addEventListener('webglcontextlost',()=>{graphicsControls.forEach(id=>(el(id) as HTMLButtonElement).disabled=true);experience.persist(true);explorer.pause('graphics_context_lost');experience.audio.setActive(false);experience.audio.stopPreviews();notify('The graphics context was lost and the game is paused. Continue once it recovers.');});
viewer.renderer.domElement.addEventListener('webglcontextrestored',()=>{graphicsControls.forEach(id=>(el(id) as HTMLButtonElement).disabled=false);explorer.pause('graphics_context_restored');glassEnvironment.invalidate();lighting.set(loungeView?false:nightRequested,loungeView?lounge:imported||asset.root);notify('Graphics restored. Click to continue.');});
viewer.beforeRender.add(dt=>experience.update(dt));
// The sealed AI curtain encloses the entire site. In the standalone 4F lounge view its
// near-black skin and red cage composite straight over the interior, which reads as a
// black lounge and a wall of red lattice (interior QA, 2026-11-25). Hide the boundary
// only while that view is up: `apply()` recomputes `root.visible` from the seal progress
// on every frame, so the first campus frame after the view restores it by itself.
let loungeBoundary:T.Object3D|null|undefined;
viewer.beforeRender.add(()=>{if(!loungeView)return;if(loungeBoundary===undefined)loungeBoundary=viewer.scene.getObjectByName('Opening_AI_curtain_boundary')??null;if(loungeBoundary)loungeBoundary.visible=false;});
// First-person shadow footprint: 64 m box on the player instead of the 400 m campus one.
if(openingMode)viewer.beforeRender.add(()=>{const p=explorer.game.body.position;viewer.followSunShadow({x:p.x,y:p.y??0,z:p.z});});
function stats(){const s=modelStats(loungeView?lounge:imported||asset.root);el('stats').textContent=`${s.triangles.toLocaleString()} triangles · ${s.meshes} meshes`;return s;}
function select(id:string){if(loungeView)setView('iso');selected=id;document.querySelectorAll<HTMLElement>('[data-building]').forEach(e=>e.classList.toggle('active',e.dataset.building===id));const s=specs.find(b=>b.id===id)!;el('building-note').textContent=`${s.confidence}. ${s.usage}. Source: ${s.source}`;document.querySelectorAll<HTMLInputElement>('.param-grid input').forEach(i=>i.value=String(s[i.name as keyof BuildingSpec]));sync();if(checked('isolate'))setView('selected');}
const escapeHTML=(value:string)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let labels:HTMLElement[]=[];const labelPosition=new T.Vector3();
function index(){el('building-list').innerHTML=specs.map(b=>`<button data-building="${b.id}"><span>${b.id.slice(1)}</span>${escapeHTML(b.label)}</button>`).join('');el('labels-layer').innerHTML=specs.map(b=>`<button class="map-label" data-building="${b.id}">${b.id==='B04'?'CDS-1':b.id==='B06'?'Auditorium':b.id.slice(1)}</button>`).join('');document.querySelectorAll<HTMLButtonElement>('[data-building]').forEach(b=>b.onclick=()=>select(b.dataset.building!));labels=Array.from(document.querySelectorAll<HTMLElement>('.map-label'));select(selected);}
function sync(){el('export-glb').textContent=loungeView?'Export 4F lounge GLB ↓':'Export GLB ↓';(el('export-scope') as HTMLSelectElement).disabled=loungeView;el('transparent').parentElement!.lastChild!.textContent=loungeView?'Transparent PNG · keep lounge structural floor':'Transparent PNG · hide ground and planting';const source=imported||asset.root;asset.root.visible=!imported&&!loungeView;if(imported)imported.visible=!loungeView;lounge.visible=loungeView;const isolated=checked('isolate');for(const id of ['environment','circulation','sports']){const name={environment:'Environment',circulation:'Circulation',sports:'Sports'}[id]!;const obj=source.getObjectByName(name);if(obj)obj.visible=checked(id)&&(id==='environment'||!isolated);}
 for(const b of specs){const obj=source.getObjectByName(b.id);if(obj)obj.visible=!isolated||b.id===selected;}el('labels-layer').style.display=checked('labels')&&!imported&&!loungeView?'block':'none';}
function setView(v:CampusView){if(loungeView){loungeView=false;sync();lighting.set(nightRequested,imported||asset.root);stats();}viewer.view(v,(imported||asset.root).getObjectByName(selected));document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));el('mode-label').textContent='Orthographic · '+({iso:'Campus overview',top:'Site plan',north:'North sports zone',south:'South entrance',plaza:'Central courtyard',selected:specs.find(b=>b.id===selected)!.label}[v]);}
function rebuild(next:BuildingSpec[]){const before=debugMemory();const a=buildSite(next,site,openingMode);if(imported){viewer.scene.remove(imported);disposeAsset(imported);imported=null;}viewer.scene.remove(asset.root);disposeAsset(asset.root);asset=a;specs=next.map(s=>({...s}));viewer.scene.add(asset.root);loadAssetTextures(asset.root);explorer.rebuild(specs,site);experience.relocate();lighting.apply(asset.root);index();sync();stats();debugMemory('rebuild',before);}
/** Dev/review only: renderer resource counters before and after a rebuild. A repeated
 * rebuild that keeps growing these numbers is the leak signal; a flat line is the pass. */
function debugMemory(label?:string,before?:{geometries:number;textures:number;programs:number}){const info=viewer.renderer.info,now={geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs?.length??0};if(label&&(import.meta.env.DEV||import.meta.env.MODE==='review'))console.debug('[campus] '+label,before,'->',now);return now;}
for(const id of ['environment','circulation','sports','labels','isolate'])el(id).onchange=()=>{sync();if(id==='isolate')setView(checked('isolate')?'selected':'iso');};
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view as CampusView));
el('apply').onclick=()=>{try{const next=specs.map(b=>({...b})),s=next.find(b=>b.id===selected)!;document.querySelectorAll<HTMLInputElement>('.param-grid input').forEach(i=>{(s as unknown as Record<string,number>)[i.name]=Number(i.value);});rebuild(next);notify('Rebuilt the selected building and scene');}catch(e){notify(String(e));}};
el('restore').onclick=()=>{site={...SITE};rebuild(cloneBuildings());setView('iso');notify('Reference campus restored');};
el('return-model').onclick=()=>{site={...SITE};rebuild(cloneBuildings());(el('isolate') as HTMLInputElement).checked=false;sync();setView('iso');notify('Editable campus restored');};
el('save-config').onclick=()=>download(new Blob([JSON.stringify({version:2,modelVersion:8,units:'metres',scaleCalibration:SCALE_CALIBRATION,buildings:specs,site},null,2)],{type:'application/json'}),'HKU-campus-parameters.json');el('load-config').onclick=()=>el('file-config').click();el('file-config').onchange=async e=>{const input=e.target as HTMLInputElement;try{const f=input.files?.[0];if(!f)return;if(f.size>1048576)throw Error('Campus parameter file must be 1 MB or smaller');const c=parseCampusConfig(JSON.parse(await f.text()));const previousSite=site;site=c.site;try{rebuild(c.buildings);}catch(err){site=previousSite;throw err;}notify('Campus parameters loaded');}catch(err){notify(String(err));}finally{input.value='';}};
function exportTarget(){if(loungeView){const copy=lounge.clone(true);copy.visible=true;return copy;}const source=imported||asset.root;if((el('export-scope') as HTMLSelectElement).value==='selected'){const original=source.getObjectByName(selected);if(!original)throw new Error('Selected building not found in the imported asset');const copy=original.clone(true);copy.userData={...copy.userData,campusPlacement:original.position.toArray(),campusRotation:original.rotation.toArray()};copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.visible=true;return copy;}
 const copy=source.clone(true);if(!checked('include-env'))copy.getObjectByName('Environment')?.removeFromParent();return copy;}
el('export-glb').onclick=async()=>{const button=el('export-glb') as HTMLButtonElement;button.disabled=true;try{const b=await exportGLB(exportTarget());download(new Blob([b],{type:'model/gltf-binary'}),`HKU-Shanghai-${loungeView?'B05-4F-Lounge':(el('export-scope') as HTMLSelectElement).value==='selected'?selected:'Campus'}.glb`);notify(`GLB exported · ${(b.byteLength/1048576).toFixed(2)} MB`);}catch(e){notify(String(e));}finally{button.disabled=false;}};
el('export-png').onclick=()=>{const env=(imported||asset.root).getObjectByName('Environment')||asset.environment;download(viewer.capture(checked('transparent'),env),`HKU-Campus-${viewer.getView()}.png`);notify('PNG saved');};el('load-glb').onclick=()=>el('file-glb').click();
el('file-glb').onchange=async e=>{const input=e.target as HTMLInputElement;try{const f=input.files?.[0];if(!f)return;if(f.size>120*1048576)throw new Error('Choose a GLB smaller than 120 MB');const g=await reloadGLB(await f.arrayBuffer());if(loungeView){loungeView=false;lounge.visible=false;lighting.set(nightRequested,imported||asset.root);}if(imported){viewer.scene.remove(imported);disposeAsset(imported);}imported=g.scene;viewer.scene.add(imported);lighting.apply(imported);(el('isolate') as HTMLInputElement).checked=false;sync();stats();const ids=specs.filter(b=>!!imported!.getObjectByName(b.id));if(ids.length===1){selected=ids[0].id;setView('selected');}else if(imported.getObjectByName('B05_4F_Stepped_Lounge')){viewer.view('selected',imported);el('mode-label').textContent='Reloaded · Building 5, 4F lounge';}else setView('iso');notify('GLB reloaded. Restore editable campus to return to the parameter model.');}catch(err){notify(String(err));}finally{input.value='';}};
const dialog=el('evidence-dialog') as HTMLDialogElement;el('evidence-open').onclick=()=>dialog.showModal();document.querySelector<HTMLButtonElement>('.close-dialog')!.onclick=()=>dialog.close();
const ray=new T.Raycaster();let start=[0,0];host.onpointerdown=e=>{start=[e.clientX,e.clientY];};host.onpointerup=e=>{if(exploring||loungeView||document.body.classList.contains('scene-inspecting'))return;if(Math.hypot(e.clientX-start[0],e.clientY-start[1])>5||e.button!==0||imported)return;const r=host.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),viewer.camera);const hits=ray.intersectObjects([...asset.byId.values()].filter(b=>b.visible),true);if(hits[0]){let o:T.Object3D|null=hits[0].object;while(o&&!asset.byId.has(o.name))o=o.parent;if(o)select(o.name);}};
viewer.callbacks.add(()=>{if(exploring||loungeView)return;for(const [i,b] of specs.entries()){const tag=labels[i];const p=labelPosition.set(b.x,b.height+5,b.z).project(viewer.camera);tag.style.left=`${(p.x+1)/2*viewportWidth}px`;tag.style.top=`${(1-p.y)/2*viewportHeight}px`;tag.hidden=!asset.byId.get(b.id)!.visible||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;}});
window.addEventListener('keydown',e=>{if(exploring)return;if((e.target as HTMLElement).matches('input,select,textarea')||dialog.open)return;if(e.key.toLowerCase()==='r'){(el('isolate') as HTMLInputElement).checked=false;sync();setView('iso');}if(e.key==='1')setView('iso');if(e.key==='2')setView('top');});
function mode(walk:boolean){
 if(loungeView){loungeView=false;sync();lighting.set(nightRequested,imported||asset.root);}
 if(walk&&imported){viewer.scene.remove(imported);disposeAsset(imported);imported=null;asset.root.visible=true;}
 if(walk)lighting.set(nightRequested,asset.root);
 exploring=walk;viewer.renderer.domElement.setAttribute('aria-label',walk?(openingMode?'Campus exploration: ':'Campus outdoor exploration: ')+CONTROL_GUIDE(openingMode)+' · '+keyLabel(KEYS.pause)+(openingMode?' pause':' pause'):'Campus model view: drag to rotate, scroll to zoom, right-drag to pan');
 // The landmark contains the game, not a preview, once play starts (D-07).
 stageEl.setAttribute('aria-label',walk?(openingMode?'Campus exploration':'Campus outdoor exploration'):'Campus 3D preview');
 document.body.classList.toggle('exploring',walk);viewer.controls.enabled=!walk;viewer.setActiveCamera(walk?explorer.camera:viewer.camera);
 if(walk){for(const id of ['environment','circulation','sports'])(el(id) as HTMLInputElement).checked=true;(el('isolate') as HTMLInputElement).checked=false;sync();el('labels-layer').style.display='none';el('mode-label').textContent=openingMode?'Building 4 · Shanghai Campus':sportsMode?'Sports Hall · East door':'CDS-1 · Outdoor exploration';el('reset').textContent=openingMode?'Return to checkpoint':sportsMode?'↺ Return to east door':'↺ Return to safe spot';document.querySelector('.stage-bottom>span')!.textContent=CONTROL_GUIDE(openingMode);}
 else{sync();setView('iso');el('reset').textContent='↺ Reset overview';document.querySelector('.stage-bottom>span')!.textContent='Drag to rotate · scroll to zoom · right-drag to pan';}
 explorer.setEnabled(walk);stats();el('mode-toggle').textContent=openingMode?(walk?'Campus model tools':'Return to opening'):(walk?'Model view &amp; export':'Return to outdoor exploration');
}
el('mode-toggle').onclick=()=>mode(!exploring);
/** Moves the body through the opening's own checkpoint spawn path (floor settle for a
 * campaign checkpoint, fleet reset, respawn grace); story, backpack and hearts are untouched. */
function respawnAt(id:OpeningCheckpoint){(experience as unknown as {respawnAtCheckpoint?:(id:OpeningCheckpoint)=>void}).respawnAtCheckpoint?.(id);}
el('reset').onclick=()=>{if(exploring){
  // In a campaign chapter the button returns you to the start of the chapter you are in.
  // The explorer's default spawn is the B5 handoff, which left a player at the sports hall
  // 176 m from it with the objective unchanged (found in the 2026-11-26 shakedown).
  const stage=campaign?.stage?.()??null;
  // A walking leg is not a chapter. `chapterEntry()` names the leg's DESTINATION (that is
  // its contract), and moving the body there fired the arrival event on the next frame:
  // the 84 m lawn walk was skipped and the guardian fight started (R-02). A leg returns to
  // the pose its own checkpoint boots at, which is where the leg starts.
  const leg=campaign?.active&&stage!==null?checkpointForStage(stage):null;
  const entry=leg?null:campaign?.chapterEntry?.();
  // The epilogue has no checkpoint: `chapterEntry()` is null there (the ending chapter's
  // entry is a radius-0 placeholder at the campus origin, so the host does not offer it).
  // The card hides the button; this branch is the handler's refusal if anything else
  // reaches the reset (R-09).
  if(!entry&&campaign?.active&&!leg){notify('The epilogue has no checkpoint — let it play out.');viewer.renderer.domElement.focus();return;}
  // A run booted from a checkpoint returns to that checkpoint's own pose instead of the
  // opening's per-stage spawn: `safePose()` maps `to_b5` to the B5 handoff, 77 m past the
  // B5 dinner checkpoint (R-01).
  if(leg)respawnAt(leg);
  else if(entry){const game=explorer.game;game.body.position.set(entry[0],entry[1]>0?entry[1]:.02,entry[2]);game.body.velocity.set(0,0,0);}
  else if(bootCheckpoint)respawnAt(bootCheckpoint);
  else if(sportsMode)experience.relocate();else explorer.reset();experience.persist(true);notify(openingMode?'Checkpoint restored. Your progress and backpack are preserved.':sportsMode?'Returned to the Sports Hall east door. Door progress is preserved.':'Returned to the safe spot. Tasks and backpack are preserved.');viewer.renderer.domElement.focus();}else{(el('isolate') as HTMLInputElement).checked=false;sync();setView('iso');}};
el('walk-photo').onclick=()=>download(viewer.capture(false,asset.environment),'HKU-outdoor-exploration.png');
let nightRequested=false;
el('night-toggle').onclick=()=>{if(loungeView){notify('The lounge uses indoor lighting. Return to campus to switch night mode.');return;}nightRequested=!nightRequested;lighting.set(nightRequested,imported||asset.root);el('night-toggle').textContent=openingMode?(nightRequested?'Day mode':'Night mode'):(nightRequested?'Switch to day':'Switch to night');};
function showLounge(){mode(false);loungeView=true;sync();lighting.set(false,lounge);viewer.renderer.toneMappingExposure=loungeDayExposure;viewer.scene.fog=null;viewer.view('selected',lounge);el('mode-label').textContent='Building 5 · 4F stepped lounge / standalone section · estimated dimensions';stats();notify('Building and floor confirmed. This is a standalone reference asset; use Return to outdoor exploration to go back to campus.');}
el('lounge-toggle').onclick=()=>showLounge();
index();stats();mode(true);if(openingMode){atmosphere=createOpeningAtmosphere(viewer.scene,viewer.renderer,viewer.lights);let threat=loadWorldThreat();if(threat.phase==='clear'&&(experience as {runtime?:{curtain_deployed:boolean}}).runtime?.curtain_deployed)threat=sealWorld();if(threat.phase==='sealed')atmosphere.restoreSealed();document.getElementById('night-toggle')?.style.setProperty('display','none');}if(import.meta.env.DEV||import.meta.env.MODE==='review')Object.assign(window,{__CAMPUS:{viewer,explorer,experience,door,crowd,touchControls,fullscreen,openingDebug:(experience as {debug?:unknown}).debug,campaign:campaign&&{state:()=>campaign!.state(),emit:(event:CampaignEvent)=>campaign!.emit(event),start:(deviceId:string)=>campaign!.start(deviceId),chapter:()=>campaign!.chapter(),chapterEntry:()=>campaign!.chapterEntry(),get active(){return campaign!.active;},objective:()=>campaign!.objective(),get debug(){return campaign!.debug;}},mode,showLounge,lighting,atmosphere,lounge,worldThreat:()=>loadWorldThreat(),get asset(){return asset;},get imported(){return imported;},stats,select,setView,rebuild,exportTarget,version:BUILD_VERSION,perf:()=>viewer.perf(),memory:()=>debugMemory(),resources:()=>resourceReport(viewer.scene),deferred:()=>deferredTextureStats(),ready:true}});
const prologue=openingMode?createPrologue({viewer,explorer,scene:viewer.scene,audio:experience.audio,bounds:()=>{const box=new T.Box3();for(const object of asset.byId.values())box.expandByObject(object);return box;},atmosphere}):undefined;
// ?intro=1 forces a replay past the session flag and the crowd stage, but never
// over a checkpoint; the button is hidden wherever no prologue can play (review M1/N6).
const prologueParams=new URLSearchParams(location.search),checkpoint=openingCheckpoint(prologueParams.get('checkpoint'));
el('replay-intro').hidden=!prologue||checkpoint!==null;
if(prologue){
 const intro=prologueParams.get('intro'),seen=(()=>{try{return sessionStorage.getItem('hku.campus.prologue.v1')==='1';}catch{return false;}})(),
  start=experience as {story?:{stage:string;invitation_read?:boolean}},
  atStart=start.story?.stage==='crowd'&&start.story.invitation_read!==true;
 if(checkpoint===null&&(intro==='1'||(intro!=='0'&&!seen&&atStart)))void prologue.play();
}
if(import.meta.env.DEV||import.meta.env.MODE==='review')Object.assign((window as unknown as {__CAMPUS:object}).__CAMPUS,{prologue});

// Both are real taps, so they are the gesture the Fullscreen API needs; entering
// the game takes the whole screen on a phone until the player leaves it by hand.
el('enter-game').onclick=()=>{void fullscreen.autoEnter();explorer.enter();};
el('replay-intro').onclick=()=>{const prologue=(window as unknown as {__CAMPUS?:{prologue?:{play():Promise<void>}}}).__CAMPUS?.prologue;if(prologue){void prologue.play().catch(()=>{});return;}const url=new URL(location.href);try{sessionStorage.removeItem('hku.campus.prologue.v1');}catch{}url.searchParams.set('intro', '1');location.assign(url.toString());};
el('takeover').onclick=()=>{void fullscreen.autoEnter();explorer.takeover();};
el('enable-ai').onclick=()=>{if(agentBridge){agentBridge.claim();explorer.enableAI();}};

document.addEventListener('game-notice',e=>{notify((e as CustomEvent).detail);el('enter-compat').hidden=false;});
// The drag-controls offer belongs to the state "pointer lock is unavailable". A lock
// that succeeds withdraws it again, instead of revealing it for the rest of the
// session after one failure (D-11).
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement)el('enter-compat').hidden=true;});
el('enter-compat').onclick=()=>{void fullscreen.autoEnter();explorer.enterCompat();};

// ------------------------------------------------------- pause-card focus (D-03/D-04).
// The card is a dialog: focus moves to its primary button on open, returns where it
// came from on close, and Tab cycles inside it. The canvas behind the overlay is
// removed from the tab order while the card is up, so the first Tab can never land
// on the world behind the menu.
let pauseReturnFocus:HTMLElement|null=null;
function enterPauseCard(){
 // The prologue gate and any native dialog own the screen above the card.
 if(document.body.classList.contains('prologue-active')||document.querySelector('dialog[open]'))return;
 const panel=el('pause-panel'),active=document.activeElement;
 if(active instanceof HTMLElement&&panel.contains(active))return;
 pauseReturnFocus=active instanceof HTMLElement&&active!==document.body?active:null;
 document.getElementById('enter-game')?.focus({preventScroll:true});
}
function leavePauseCard(){
 const panel=el('pause-panel'),active=document.activeElement,inside=active instanceof HTMLElement&&panel.contains(active);
 // Another surface (the backpack, the MacBook, a story dialog) took focus: keep it.
 if(!inside&&active!==document.body)return;
 const target=pauseReturnFocus;pauseReturnFocus=null;
 if(target&&target.isConnected&&target.getClientRects().length>0)target.focus({preventScroll:true});
 else viewer.renderer.domElement.focus({preventScroll:true});
}
function trapPauseCardFocus(e:KeyboardEvent){
 if(e.key!=='Tab'||e.defaultPrevented)return;
 const panel=el('pause-panel');
 if(panel.hidden||document.body.classList.contains('prologue-active'))return;
 if(document.querySelector('dialog[open]'))return;
 const card=panel.querySelector<HTMLElement>('.pause-card');if(!card)return;
 const items=Array.from(card.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(node=>node.getClientRects().length>0);
 if(!items.length)return;
 const first=items[0],last=items[items.length-1],active=document.activeElement,inside=active instanceof HTMLElement&&card.contains(active);
 if(e.shiftKey&&(!inside||active===first)){e.preventDefault();last.focus({preventScroll:true});}
 else if(!e.shiftKey&&(!inside||active===last)){e.preventDefault();first.focus({preventScroll:true});}
}
document.addEventListener('keydown',trapPauseCardFocus);
// A paused boot shows the card even when the renderer is too loaded to produce a frame
// for a while (the bug hunt measured under 1 fps), so the first focus cannot wait for
// the render callback. The prologue/dialog guard keeps the gate's own screen in charge.
if(exploring&&explorer.game.paused)enterPauseCard();
viewer.callbacks.add(()=>{const g=explorer.game;const pauseHidden=!exploring||!g.paused||g.inventoryOpen||!!g.panel;setHidden(el('pause-panel'),pauseHidden);
 // "Esc · menu" is only true while the menu is closed; the overlay is translucent and
 // used to leave the hint legible under it (D-02).
 const shellHint=document.querySelector<HTMLElement>('.shell-hint');if(shellHint){const hideHint=!pauseHidden;if(shellHint.hidden!==hideHint)shellHint.hidden=hideHint;}
 if(pauseHidden!==pauseWasHidden){pauseWasHidden=pauseHidden;
  // The canvas is only reachable in play, never behind the pause dialog.
  const canvas=viewer.renderer.domElement;canvas.tabIndex=pauseHidden?0:-1;
  if(pauseHidden)leavePauseCard();else{syncPauseCard();
  // Reaching a slider scrolls the card; that offset used to survive the close,
  // so the next MENU opened with the heading and Continue already above the
  // screen edge (measured on a 390×844 phone: scrollTop 166 of 166).
  const card=document.querySelector<HTMLElement>('.pause-card');if(card)card.scrollTop=0;enterPauseCard();}}setHidden(el('crosshair'),!exploring||g.paused||g.view!=='first');setHidden(el('control-badge'),!exploring);const state=g.owner?'active':g.armed?'armed':'human';if(document.body.dataset.aiControl!==state)document.body.dataset.aiControl=state;setText(el('control-state'),openingMode?`${g.owner?'AI controlling':g.armed?'AI ready':'Player'} · ${g.paused?'Paused':g.view==='first'?'First person':'Third person'}`:`${g.owner?'AI controlling':g.armed?'AI ready':'Player'} · ${g.paused?'Paused':g.view==='first'?'First person':'Third person'}`);});

const toolsMenu=document.createElement('details');toolsMenu.id='campus-tools';toolsMenu.innerHTML='<summary>Campus tools</summary><div class="tools-content"></div>';document.querySelector('.header-right')!.append(toolsMenu);
for(const node of Array.from(document.querySelectorAll('.header-right > a,.header-right > button:not(#night-toggle)')))toolsMenu.querySelector('.tools-content')!.append(node);
toolsMenu.addEventListener('toggle',()=>{if(toolsMenu.open&&exploring)explorer.pause('tools_open');});
toolsMenu.querySelector('.tools-content')!.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button,a'))toolsMenu.open=false;});
const help=document.createElement('button');help.textContent='Help';help.onclick=()=>experience.openSettings();document.querySelector('.header-right')!.prepend(help);
const advanced=document.createElement('details');advanced.className='pause-options';advanced.innerHTML='<summary>Restart / AI control</summary>';el('session-save').after(advanced);advanced.append(el('new-game'),el('enable-ai'),el('bridge-status'));
{const buildVersion=document.getElementById('build-version');if(buildVersion)buildVersion.textContent=`HKU: Barrier 2030 · ${BUILD_STAMP}`;}
if(!localAiControls){el('enable-ai').hidden=true;el('bridge-status').hidden=true;advanced.querySelector('summary')!.textContent='Restart';}
const levelsLink=document.createElement('a');levelsLink.href='?experience=levels';levelsLink.textContent=openingMode?'Chapters':'Chapters';document.querySelector('.header-right')!.prepend(levelsLink);
const desktopNote=document.createElement('p');desktopNote.className='desktop-note';desktopNote.textContent='Keyboard and mouse are supported. On a phone, the left stick walks, drag to look, and the buttons act.';el('enter-game').before(desktopNote);
const inspector=createSceneInspector({host,scene:viewer.scene,camera:()=>viewer.activeCamera,root:()=>asset.root,ready:()=>!imported&&!loungeView,openModel:()=>{mode(false);(el('isolate') as HTMLInputElement).checked=false;for(const id of ['environment','circulation','sports'])(el(id) as HTMLInputElement).checked=true;sync();},frame:box=>{const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),span=Math.max(size.x,size.y,size.z,2)*1.65;viewer.controls.target.copy(center);viewer.camera.position.copy(center).add(new T.Vector3(.8,.65,1).normalize().multiplyScalar(Math.max(15,span*1.5)));const aspect=host.clientWidth/host.clientHeight;const height=Math.max(span,span/aspect);Object.assign(viewer.camera,{left:-height*aspect/2,right:height*aspect/2,top:height/2,bottom:-height/2,zoom:1});viewer.camera.updateProjectionMatrix();viewer.camera.lookAt(center);viewer.controls.update();},notify});
viewer.callbacks.add(inspector.update);
const numberButton=document.createElement('button');numberButton.id='scene-index-toggle';numberButton.textContent='Scene index';numberButton.onclick=()=>inspector.setOpen(!inspector.opened);document.querySelector('.header-right')!.prepend(numberButton);
const sceneService=createSceneService(()=>asset.root,()=>explorer.game,id=>{inspector.show(id);});
const agentBridge=localAiControls?connectAgent(()=>explorer.game,()=>viewer.screenshot(),s=>el('bridge-status').textContent=openingMode?(s.includes('此窗口已连接')?'Local AI control service connected.':'Local AI control service unavailable or owned by another window.'):s,sceneService):null;
// Any stable scene ID (S001, R005, B04-P-...) can be a walkTo/lookAt target, resolved from the same registry the inspector uses.
explorer.game.entityResolver=id=>{const entity=sceneRegistry(asset.root).get(id);return entity?[entity.center[0],entity.center[1],entity.center[2]]:null;};
if(import.meta.env.DEV||import.meta.env.MODE==='review')Object.assign((window as unknown as {__CAMPUS:object}).__CAMPUS,{inspector});

// pagehide with BFCache keeps a paused, resumable page; only final unload disposes resources.
window.addEventListener('pagehide',event=>{experience.persist(true);explorer.pause('page_hidden');if(event.persisted)return;clearTimeout(timer);viewportObserver.disconnect();touchControls?.dispose();fullscreen.dispose();agentBridge?.dispose();inspector.dispose();door?.dispose();crowd?.dispose();experience.dispose();prologue?.dispose();atmosphere?.dispose();explorer.dispose();lighting.dispose();glassEnvironment.dispose();disposeAsset(asset.root);disposeAsset(lounge);if(imported)disposeAsset(imported);viewer.dispose();});

if(!import.meta.env.DEV&&import.meta.env.MODE!=='review'){document.querySelectorAll('a[href*="evidence/"],.evidence-note').forEach(n=>n.remove());dialog.remove();}

if(openingMode){
 document.title='HKU: Barrier 2030 · Chapter 1 · High Table';document.body.classList.add('opening-mode');
 const copy:Record<string,string>={'mode-label':'Building 4 · Shanghai Campus','reset':'Return to checkpoint','mode-toggle':'Campus model tools','takeover':'Take control','night-toggle':'Night / Day','experience-settings':'Settings & save','new-game':'Restart in Settings…','enable-ai':'Enable AI control','bridge-status':'Local control service','enter-compat':'Drag controls','scene-index-toggle':'Scene index'};
 for(const [id,text]of Object.entries(copy)){const node=document.getElementById(id);if(node)node.textContent=text;}
 const checkpointStart=openingCheckpoint(new URLSearchParams(location.search).get('checkpoint'));
 const pause=document.querySelector('.pause-card');if(pause){const eyebrow=pause.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='A CDS CAMPUS STORY';pause.querySelector('h2')!.textContent='HKU: Barrier 2030';pause.querySelector('p')!.textContent=checkpointStart?`Checkpoint: ${CHECKPOINT_LABELS[checkpointStart]}. Continue from here.`:'You are a Student Ambassador on your way to the High Table Dinner. Begin in the plaza crowd after the light show.';pause.querySelector('.key-guide')!.textContent='WASD move · Shift run · Space jump · F interact · E backpack · C MacBook';pause.querySelector('.desktop-note')!.textContent=touch?'Touch · left stick walks · drag to look · buttons act, MENU pauses':'Keyboard and mouse · Continue to look around and move';pause.querySelector('.pause-options summary')!.textContent='Restart / AI control';}
 const help=document.querySelector('.header-right > button:not(#scene-index-toggle):not(#night-toggle)');if(help)help.textContent='Help';
 toolsMenu.querySelector('summary')!.textContent='Campus tools';advanced.querySelector('summary')!.textContent=localAiControls?'Restart / AI control':'Restart';
 document.querySelector('.brand-copy > span')!.textContent='HKU: Barrier 2030';
 document.querySelector('.stage-bottom > span')!.textContent='WASD move · Shift run · F interact · C MacBook · E backpack';
 for(const node of Array.from(document.querySelectorAll<HTMLElement>('.header-right > span'))){if(node.textContent==='张江基地')node.textContent='Shanghai';}
 const header=document.querySelector('.header-right');for(const node of Array.from(header?.childNodes??[]))if(node.nodeType===Node.TEXT_NODE){if(node.textContent?.includes('张江基地'))node.textContent='Shanghai';}
}
if(sportsMode){
 document.title='HKU Shanghai · Sports Hall Rescue';
 document.querySelector('.brand-copy > span')!.textContent='Sports Hall Rescue';
 document.querySelector('.pause-card .key-guide')!.textContent='WASD move · Mouse look · F door · Esc pause';
}
if(publicPlaytest)advanced.querySelector('summary')!.textContent=openingMode?'Restart':'Restart';
