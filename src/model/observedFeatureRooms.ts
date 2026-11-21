import * as T from 'three';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {glassMaterial, pane} from './glazing';
import {compact} from './buildCampus';
import {campusFont} from './fonts';
import {voxelizeMaterials} from '../voxel/materials';

type RowKey = [label: string, width?: number, tone?: 'navy' | 'amber' | 'silver' | 'blue'];
const keyboardRows: RowKey[][] = [
  [['`', 1, 'navy'], ...Array.from('1234567890', (n): RowKey => [n]), ['-'], ['='], ['Backspace', 2, 'navy']],
  [['Tab', 1.5, 'navy'], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'], ['['], [']'], ['\\', 1.5, 'navy']],
  [['Caps Lock', 2, 'navy'], ['I', 1, 'amber'], ['S'], ['L', 1, 'amber'], ['O', 1, 'amber'], ['V', 1, 'amber'], ['E', 1, 'amber'], ['J'], ['C', 1, 'amber'], ['D', 1, 'amber'], ['S', 1, 'amber'], [';'], ["'"], ['Enter', 1, 'blue']],
  [['Shift', 2.25, 'navy'], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [','], ['.'], ['/'], ['Shift', 2.75, 'navy']],
];

const wallWidth = 10.8;
const roomDepth = 10.7;
const keyboardBackZ = -4.1;
const keyboardWidth = 7.65;
const keyboardRowPitch = .48;
const flipColumns = 33;
const flipRows = 17;
const tilePitch = .219;

function material(name: string, color: number, roughness = .82) {
  return new T.MeshStandardMaterial({name, color, roughness});
}

function mesh(parent: T.Object3D, name: string, geometry: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number) {
  const object = new T.Mesh(geometry, mat);
  object.name = name;
  object.position.set(x, y, z);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent: T.Object3D, name: string, mat: T.Material, width: number, height: number, depth: number, x: number, y: number, z: number) {
  return mesh(parent, name, new T.BoxGeometry(width, height, depth), mat, x, y, z);
}

function section(parent: T.Group, name: string) {
  const group = new T.Group();
  group.name = name;
  parent.add(group);
  return group;
}

function keycap(width: number, height: number) {
  const radius = height / 2;
  const end = width / 2 - radius;
  const outline = new T.Shape();
  outline.absarc(end, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  outline.absarc(-end, 0, radius, Math.PI / 2, 3 * Math.PI / 2, false);
  outline.closePath();
  return new T.ExtrudeGeometry(outline, {depth: .048, bevelEnabled: false, curveSegments: 6});
}

function keyLabel(parent: T.Group, label: string, mat: T.Material, width: number, x: number, y: number, size = label.length > 1 ? .064 : .15, z = .118) {
  if (label === '←' || label === '→') {
    const direction = label === '←' ? -1 : 1;
    box(parent, 'Arrow_stem', mat, .12, .02, .009, x, y, z + .005);
    for (const side of [-1, 1]) {
      const tip = box(parent, 'Arrow_tip', mat, .072, .018, .009, x + direction * .039, y + side * .023, z + .005);
      tip.rotation.z = -direction * side * Math.PI / 4;
    }
    return;
  }
  const geometry = new TextGeometry(label, {font: campusFont, size, depth: .008, curveSegments: 2});
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const measured = bounds.max.x - bounds.min.x;
  geometry.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, 0);
  geometry.scale(Math.min(1, (width - .12) / measured), 1, 1);
  mesh(parent, 'Legend_' + label, geometry, mat, x, y, z);
}

function buildKeyboardRoom() {
  const root = new T.Group();
  root.name = 'Observed_Keyboard_Wall_Lounge';
  root.userData = {
    sources: ['20261115-P01', '20261115-P02', '20261116-P01', '20261116-P06'],
    dimensions: 'estimated from reference photos',
    placement: 'building, floor and orientation unverified',
  };
  const shell = section(root, 'Lounge_structure');
  const steps = section(root, 'Curved_timber_seating_tiers');
  const furniture = section(root, 'Lounge_furniture');
  const ceiling = section(root, 'Ceiling_cutaway');
  const wall = section(root, 'Keyboard_wall');
  wall.position.set(.48, 2.64, -3.79);
  wall.userData = {
    id: 'CDS1-keyboard-wall',
    units: 'metres',
    origin: 'panel centre',
    forward: '+Z',
    dimensions: {width: keyboardWidth, height: 2.0, rows: keyboardRows.length},
    capabilities: ['keycap.detach', 'keycap.reinsert', 'socket.usb'],
    source: '2026-11-15 WeChat keyboard-wall photo; 2026-11-16 team evidence',
  };

  const timber = material('Lounge warm timber', 0xb59167);
  const trim = material('Lounge dark nosing', 0x49392c);
  const floor = material('Lounge ivory limestone', 0xe3dcc9);
  const plaster = material('Lounge plaster', 0xc6beab);
  const upholstery = material('Lounge ivory upholstery', 0xd7d3c3);
  const carpet = material('Lounge olive rug', 0x77785e);
  const ceilingLight = new T.MeshBasicMaterial({name: 'Lounge warm ceiling light', color: 0xffedca});

  box(shell, 'Lounge_floor', floor, wallWidth, .16, roomDepth, 0, -.08, keyboardBackZ+roomDepth/2);
  box(shell, 'Keyboard_timber_wall', timber, 8.7, 3.02, .20, .48, 2.23, -3.91);
  box(shell, 'Left_return', plaster, .18, 3.7, 4.3, -5.31, 1.85, -1.96);
  box(shell, 'Right_jamb', plaster, .38, 3.7, .30, 5.2, 1.85, -3.92);

  // Each tier is a solid platform with the curved edge seen in the wide photo.
  for (let tier = 0; tier < 3; tier++) {
    const front = (x: number) => -.52 - tier * .65 + .022 * (x - .7) ** 2;
    const outline = new T.Shape();
    outline.moveTo(-3.51, 4.06);
    outline.lineTo(5.39, 4.06);
    for (let index = 16; index >= 0; index--) {
      const x = -3.51 + 8.90 * index / 16;
      outline.lineTo(x, -front(x));
    }
    outline.closePath();
    const height = (tier + 1) * .245;
    const geometry = new T.ExtrudeGeometry(outline, {depth: .245, bevelEnabled: false});
    geometry.rotateX(-Math.PI / 2);
    mesh(steps, 'Curved_tier_' + (tier + 1), geometry, timber, 0, tier * .245, 0);
    for (let index = 0; index < 16; index++) {
      const x1 = -3.51 + 8.90 * index / 16;
      const x2 = x1 + 8.90 / 16;
      const z1 = front(x1);
      const z2 = front(x2);
      const edge = box(steps, 'Dark_tread_edge', trim, Math.hypot(x2 - x1, z2 - z1) + .005, .027, .029, (x1 + x2) / 2, height - .015, (z1 + z2) / 2 + .014);
      edge.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    }
  }
  for (let step = 0; step < 6; step++) {
    const height = (step + 1) * .1225;
    const depth = 4.05 + .03 - step * .34;
    const front = -4.05 + depth;
    box(steps, 'Side_stair_tread', timber, 1.77, .1225, depth, -4.405, height - .06125, -4.05 + depth / 2);
    box(steps, 'Side_stair_nosing', trim, 1.77, .025, .028, -4.405, height - .013, front + .014);
  }
  for (const [y, z] of [[.44, .05], [1.18, -1.91]]) {
    box(steps, 'Side_stair_rail_post', upholstery, .044, .88, .044, -3.58, y, z);
  }
  const rail = box(steps, 'Side_stair_handrail', upholstery, .055, .051, 2.1, -3.58, 1.25, -.93);
  rail.rotation.x = .36;

  const rug=mesh(furniture,'Oval_lounge_rug',new T.CylinderGeometry(1,1,.013,24),carpet,1.20,.013,3.22);
  rug.scale.set(3.65,1,2.45);
  const sofa=section(furniture,'Curved_modular_sofa');
  const sofaFabric=material('Lounge grey sofa textile',0x9ca5a8);
  for(let module=0;module<7;module++){
    const start=-1.78+module*.49;
    mesh(sofa,'Curved_seat_module',arcSlab(1.49,2.19,start,start+.465,.37),sofaFabric,2.15,.085,3.35);
    mesh(sofa,'Curved_back_module',arcSlab(1.93,2.22,start,start+.465,.42),sofaFabric,2.15,.46,3.35);
  }
  mesh(furniture,'Sofa_side_table_top',new T.CylinderGeometry(.29,.29,.045,12),timber,4.35,.57,4.59);
  mesh(furniture,'Sofa_side_table_pedestal',new T.CylinderGeometry(.065,.19,.54,10),trim,4.35,.28,4.59);
  const leaf=material('Lounge foliage',0x3e6048);
  for(const [x,z] of [[-4.98,3.77],[-4.87,4.62],[-4.96,5.39]]){
    mesh(furniture,'White_planter',new T.CylinderGeometry(.25,.21,.56,10),upholstery,x,.28,z);
    for(let spray=0;spray<5;spray++){
      const angle=spray*Math.PI*2/5;
      const foliage=mesh(furniture,'Planter_faceted_leaf',new T.IcosahedronGeometry(.22,0),leaf,x+.22*Math.cos(angle),.96+.11*spray,z+.22*Math.sin(angle));
      foliage.scale.set(.60,1.75,.36);foliage.rotation.set(.30,angle,.36);
    }
  }
  for (const [x, z, angle] of [[-1.35, 1.9, .4], [2.1, 1.7, -.55], [-.9, 3.55, 2.45]]) {
    const chair = section(furniture, 'Upholstered_armchair');
    chair.position.set(x, 0, z);
    chair.rotation.y = angle;
    box(chair, 'Seat', upholstery, .92, .20, .75, 0, .46, 0);
    const back = box(chair, 'Back', upholstery, .92, .55, .17, 0, .77, -.33);
    back.rotation.x = -.15;
    for (const side of [-1, 1]) {
      box(chair, 'Armrest', upholstery, .14, .15, .68, side * .46, .62, 0);
      for (const offset of [-.30, .30]) box(chair, 'Chair_leg', trim, .043, .36, .043, side * .36, .19, offset);
    }
  }
  for (const [x, z, radius] of [[.4, 2.48, .37], [-1.1, .6, .27], [3.8, .72, .27]]) {
    mesh(furniture, 'Round_marble_top', new T.CylinderGeometry(radius, radius, .055, 12), floor, x, .65, z);
    mesh(furniture, 'Tapered_table_pedestal', new T.CylinderGeometry(radius * .37, radius * .7, .62, 10), plaster, x, .31, z);
  }

  box(ceiling, 'Rear_ceiling_strip', plaster, 10.8, .12, 1.42, 0, 3.78, -3.38);
  for (const x of [-3.9, -1.45, 1.4, 4]) {
    box(ceiling, 'Dark_ceiling_channel', trim, .13, .035, 1.4, x, 3.704, -3.38);
    box(ceiling, 'Recessed_ceiling_light', ceilingLight, .046, .012, .38, x, 3.68, -2.9);
  }

  const corridor=section(root,'Keyboard_approach_corridor');
  corridor.userData.source='20261116-P06, sightline from the ribbed corridor to the left side of the keyboard wall';
  const cool=material('Corridor upper blue grey cladding',0x7b8c9f);
  const corridorEnd=12.5, openingZ=6.6, corridorWidth=2.48, centre=-3.65;
  const left=centre-corridorWidth/2,right=centre+corridorWidth/2, depth=corridorEnd-openingZ;
  box(corridor,'Approach_floor',floor,corridorWidth+.22,.16,depth,centre,-.08,openingZ+depth/2);
  box(corridor,'Approach_left_wall',plaster,.15,2.95,depth,left,1.475,openingZ+depth/2);
  box(corridor,'Approach_right_wall',timber,.15,2.95,depth,right,1.475,openingZ+depth/2);
  for(let z=openingZ+.24;z<corridorEnd;z+=.17)box(corridor,'Left_wall_vertical_rib',upholstery,.075,2.89,.065,left+.095,1.48,z);
  for(const x of [left,right])box(corridor,'Approach_portal_jamb',plaster,.16,2.91,.24,x,1.455,openingZ);
  box(corridor,'Approach_ceiling_return',plaster,corridorWidth+.19,.16,1.03,centre,3.01,openingZ+.44);
  box(corridor,'Blue_grey_soffit_at_lounge',cool,wallWidth, .48,.54,0,3.52,5.80);
  for(let x=-4.8;x<5;x+=1.2)box(corridor,'Soffit_vertical_joint',plaster,.018,.42,.018,x,3.53,6.078);
  box(corridor,'Backlit_exit_marker',new T.MeshBasicMaterial({name:'Exit sign emerald',color:0x61e894}),.33,.105,.047,centre,2.72,openingZ+.14);

  const navy = material('Ivory-series navy keycaps', 0x254062);
  const amber = material('Ivory-series warm gold keycaps', 0xd2ab73);
  const silver = material('Ivory-series silver keycaps', 0x8b9bae);
  const ivory = material('Ivory round keycaps', 0xe9dfc8);
  const blue = new T.MeshStandardMaterial({name: 'CDS-1 blue Enter keycap', color: 0x2f6fbf, emissive: 0x000000, emissiveIntensity: 0, roughness: .55});
  const ink = material('Sign keyboard ink', 0x222631);
  const paleInk = material('Sign secondary keyboard ink', 0xe3e9df);
  const panel = material('Ivory-series blue keyboard backing', 0x657eaa);
  const frame = material('Keyboard frame', 0x4c515d);
  const underside = new T.MeshStandardMaterial({name: 'Keycap metal underside', color: 0xbfc4c9, metalness: .9, roughness: .28});
  const pedestalIvory = material('Keycap pedestal ivory', 0xe4dfd2);
  const pedestalOlive = material('Keycap pedestal olive', 0x8b8b76);
  const usbMetal = new T.MeshStandardMaterial({name: 'USB connector metal', color: 0xc9ced5, metalness: .55, roughness: .30, emissive: 0x2a2f36, emissiveIntensity: .35});
  const socketRim = new T.MeshStandardMaterial({name: 'Socket metal rim', color: 0x9aa3ad, metalness: .60, roughness: .35, emissive: 0x1f242a, emissiveIntensity: .30});
  const usbDark = material('USB connector slot', 0x1a1e25);
  const socket = material('Key switch socket', 0x14181f);
  box(wall, 'Recessed_outer_frame', frame, keyboardWidth + .16, 2.15, .10, 0, 0, 0);
  box(wall, 'Blue_keyboard_backing', panel, keyboardWidth, 2.0, .045, 0, 0, .049);
  for (const [rowIndex, row] of keyboardRows.entries()) {
    const gap = .066;
    const widthPerUnit = (keyboardWidth - .40 - gap * (row.length - 1)) / row.reduce((total, [, units = 1]) => total + units, 0);
    let start = -keyboardWidth / 2 + .20;
    const y = (1.5 - rowIndex) * keyboardRowPitch;
    for (const [keyIndex, [label, units = 1, tone]] of row.entries()) {
      const width = widthPerUnit * units;
      const height = Math.min(width, .394);
      const x = start + width / 2;
      const capMaterial = tone ? {navy, amber, silver, blue}[tone] : ivory;
      const digitSymbol = rowIndex === 0 ? '!@#$%^&*()'[keyIndex - 1] : undefined;
      const phrase = rowIndex === 2 && tone === 'amber';
      const enter = label === 'Enter';
      const materialForCap = capMaterial.clone();
      const cap = new T.Group();
      cap.name = `Keycap_r${rowIndex}c${keyIndex}`;
      cap.position.set(x, y, .073);
      cap.userData = {label, row: rowIndex, col: keyIndex, units, tone: tone ?? 'ivory', phrase, enter, marked: label === 'V', rest: [x, y, .073]};
      wall.add(cap);
      mesh(cap, 'Key_' + label, keycap(width, height), materialForCap, 0, 0, 0);
      keyLabel(cap, label, tone === 'navy' || tone === 'blue' ? paleInk : ink, width, 0, -(digitSymbol ? .034 : 0), label.length > 1 ? .064 : .15, .045);
      if (digitSymbol) keyLabel(cap, digitSymbol, ink, width, .078, .088, .080, .045);
      const seat = mesh(cap, 'Keycap_metal_underside', new T.CylinderGeometry(height * .42, height * .42, .014, 20), underside, 0, 0, -.014);
      seat.rotation.x = Math.PI / 2;
      const upper = mesh(cap, 'Keycap_pedestal_upper', new T.CylinderGeometry(.095, .085, .22, 16), pedestalIvory, 0, 0, -.14);
      upper.rotation.x = Math.PI / 2;
      const lower = mesh(cap, 'Keycap_pedestal_lower', new T.CylinderGeometry(.085, .17, .24, 20), pedestalOlive, 0, 0, -.37);
      lower.rotation.x = Math.PI / 2;
      const foot = mesh(cap, 'Keycap_pedestal_foot', new T.CylinderGeometry(.17, .17, .018, 24), pedestalIvory, 0, 0, -.499);
      foot.rotation.x = Math.PI / 2;
      box(cap, 'Keycap_plug_slot', usbDark, .14, .05, .02, 0, 0, -.512);
      const rim = mesh(wall, `Socket_rim_r${rowIndex}c${keyIndex}`, keycap(width * .90, height * .90), socketRim, x, y, .0688);
      rim.scale.z = .07;
      const plate = mesh(wall, `Socket_plate_r${rowIndex}c${keyIndex}`, keycap(width * .78, height * .78), socket, x, y, .0692);
      plate.scale.z = .08;
      box(wall, `Socket_usb_collar_r${rowIndex}c${keyIndex}`, usbMetal, .19, .10, .006, x, y, .074);
      box(wall, `Socket_usb_connector_r${rowIndex}c${keyIndex}`, usbMetal, .15, .07, .048, x, y, .096);
      box(wall, `Socket_usb_tip_r${rowIndex}c${keyIndex}`, usbMetal, .13, .052, .007, x, y, .1155);
      for (const side of [-1, 1]) box(wall, `Socket_usb_hole_r${rowIndex}c${keyIndex}`, usbDark, .016, .016, .001, x + side * .028, y, .1195);
      start += width + gap;
    }
  }

  return root;
}

/** Detachable keycap groups, in row-major order. The group holds the cap shell, legend,
 * stem, and carries the phrase flag used by the CDS-1 keyboard puzzle preview. */
export function keyboardKeycaps(root: T.Object3D) {
  const caps: T.Group[] = [];
  root.traverse(object => {
    if (object instanceof T.Group && object.name.startsWith('Keycap_')) caps.push(object);
  });
  return caps;
}

function arcSlab(inner:number,outer:number,start:number,end:number,height:number){
  const shape=new T.Shape();
  shape.absarc(0,0,outer,Math.PI/2-end,Math.PI/2-start,false);
  shape.absarc(0,0,inner,Math.PI/2-start,Math.PI/2-end,true);
  shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:5});
  geometry.rotateX(Math.PI/2);
  geometry.translate(0,height,0);
  return geometry;
}

function buildRingDisplayRoom(){
  const root=new T.Group();
  root.name='Observed_Ring_Display_Room';
  root.userData={source:'20261116-P02',placement:'building and floor unverified',dimensions:'estimated from one photo'};
  const shell=section(root,'Public_room_shell');
  const ring=section(root,'Faceted_ring_display');
  const furniture=section(root,'Tables_chairs_and_stools');
  const floor=material('Ivory polished public room floor',0xddd3bf,.39);
  const wall=material('Public room warm plaster',0xc2b5a5);
  const trim=material('Public room dark aluminium',0x444d54);
  const ceiling=material('Ivory ring casing',0xc6c5bc);
  const red=material('Red inset ceramic tiles',0x925b55);
  const navy=material('Blue chair paint',0x3c526a);
  const white=material('Ivory chair paint',0xe0d8c6);
  const screenColors=[0xd9eef2,0xd9d0e2,0xcbd9eb,0xeadae4].map(color=>new T.MeshBasicMaterial({color}));

  box(shell,'Public_room_floor',floor,14,.14,11.6,0,-.07,.3);
  box(shell,'Elevator_rear_wall',wall,14,4.6,.20,0,2.30,-5.42);
  box(shell,'Elevator_reveal',trim,1.65,2.38,.14,0,1.19,-5.24);
  for(const side of [-1,1])box(shell,'Elevator_leaf',ceiling,.71,2.23,.05,side*.366,1.115,-5.146);
  box(shell,'Rear_timber_side_door',wall,.95,2.2,.08,-2.65,1.1,-5.26);
  box(shell,'Elevator_call_marker',screenColors[0],.11,.17,.045,1.04,1.18,-5.20);
  const windowGlass=glassMaterial('clear');
  for(let z=-4.65;z<=4.3;z+=1.70){
    pane(shell,'Left_window',1.66,3.9,-6.88,2.19,z,windowGlass,Math.PI/2);
    box(shell,'Left_window_mullion',trim,.10,4.12,.085,-6.87,2.10,z-.84);
  }
  for(let x=-6.25;x<=6.4;x+=.87)for(let z=-4.85;z<=5.4;z+=.88){
    box(shell,'Red_square_floor_inlay',red,.32,.003,.32,x,.002,z);
    for(const offset of [-.075,.075])box(shell,'Tile_light_mosaic',white,.065,.002,.075,x+offset,.004,z);
  }

  const segments=24;
  const radiusInner=3.95,radiusOuter=4.62, screenBottom=3.67, screenTop=4.49;
  for(let index=0;index<segments;index++){
    const angle=index*Math.PI*2/segments;
    const span=Math.PI*2/segments;
    mesh(ring,'Ring_outer_casing',arcSlab(radiusOuter-.04,radiusOuter+.25,angle,angle+span,.49),ceiling,0,screenTop-.13,-.85);
    const geometry=new T.CylinderGeometry(radiusInner,radiusOuter,screenTop-screenBottom,1,1,true,angle+.005,span-.010);
    // Flip the geometric winding so the display faces inward in GLB viewers.
    const indices=geometry.getIndex()!;
    for(let i=0;i<indices.count;i+=3){
      const last=indices.getX(i+2);
      indices.setX(i+2,indices.getX(i+1));
      indices.setX(i+1,last);
    }
    geometry.computeVertexNormals();
    mesh(ring,'Inward_display_panel',geometry,screenColors[Math.floor(index/2)%screenColors.length],0,(screenBottom+screenTop)/2,-.85);
  }
  mesh(ring,'Central_ceiling_disk',new T.CylinderGeometry(radiusInner,radiusInner,.11,segments),ceiling,0,screenTop+.045,-.85);

  for(const [x,z] of [[-4.65,-.8],[-4.45,3.15],[-.3,.78],[.45,3.0],[3.25,-.65]]){
    mesh(furniture,'Round_cafe_table',new T.CylinderGeometry(.53,.53,.055,12),white,x,.77,z);
    mesh(furniture,'Cafe_table_pedestal',new T.CylinderGeometry(.053,.23,.72,10),trim,x,.37,z);
    for(const [dx,dz,yaw] of [[-.78,0,Math.PI/2],[.78,0,-Math.PI/2],[0,.77,Math.PI]]){
      const chair=section(furniture,'Cafe_chair');
      chair.position.set(x+dx,0,z+dz);chair.rotation.y=yaw;
      const paint=dx<0?navy:white;
      box(chair,'Cafe_chair_seat',paint,.37,.055,.36,0,.47,0);
      box(chair,'Cafe_chair_back',paint,.37,.22,.035,0,.68,-.166);
      for(const sx of [-1,1])for(const sz of [-1,1])box(chair,'Cafe_chair_leg',paint,.034,.45,.034,sx*.145,.225,sz*.145);
    }
  }
  box(furniture,'Rear_high_table',white,5.0,.07,.52,3.65,1.07,-4.53);
  for(const x of [1.47,5.8])box(furniture,'High_table_support',white,.085,1.03,.39,x,.515,-4.53);
  for(const x of [1.65,2.53,3.42,4.31,5.20,6.09]){
    box(furniture,'Red_stool_seat',red,.41,.059,.38,x,.72,-3.94);
    box(furniture,'Red_stool_back',red,.41,.24,.041,x,.92,-3.77);
    for(const dx of [-.16,.16])for(const dz of [-.145,.145])box(furniture,'Red_stool_leg',red,.039,.70,.039,x+dx,.35,-3.94+dz);
  }
  return root;
}

function isDarkTile(column: number, row: number) {
  if (column <= 7) return column <= 2 || column >= 6 || (row >= 7 && row <= 9);
  if (column >= 22) return (column <= 24 || column >= 29) || row >= 14;
  if (column >= 10 && column <= 12) return true;
  if (column < 13) return false;
  const diagonal = 13 + Math.abs(row - 8) * .82;
  return column >= diagonal - .7 && column <= diagonal + 1.5;
}

function buildAuxPowerCloset() {
  const root = new T.Group();
  root.name = 'Aux_power_closet';
  root.userData = {
    id: 'CDS1-aux-power',
    units: 'metres',
    origin: 'opening centre',
    forward: '+Z',
    dimensions: {width: 7.4, height: 3.9, depth: .9},
    capabilities: ['power.aux', 'breaker.manual'],
    source: 'fictional 2030 service closet behind the HKU flip wall',
  };
  const metal = material('Aux power cabinet metal', 0x333a40);
  const dark = material('Aux power cavity', 0x0d1114);
  const rail = material('Aux power rack rail', 0x59636b);
  const green = new T.MeshStandardMaterial({name: 'Aux power green', color: 0x2f7d52, emissive: 0x47e08a, emissiveIntensity: 1.3, roughness: .4});
  const amber = material('Aux power amber label', 0xc79a55);
  const red = material('Aux power breaker red', 0xb23a32);
  const black = material('Aux power vent', 0x111518);
  const workLamp = new T.MeshBasicMaterial({name: 'Aux work light', color: 0xffe6c2});
  box(root, 'Cavity_back', dark, 7.37, 3.86, .05, .30, 1.9915, -2.96);
  box(root, 'Cavity_left', dark, .06, 3.86, .86, -3.385, 1.9915, -2.53);
  box(root, 'Cavity_right', dark, .06, 3.86, .86, 3.985, 1.9915, -2.53);
  box(root, 'Cavity_top', dark, 7.37, .06, .86, .30, 3.9215, -2.53);
  box(root, 'Cavity_floor', metal, 7.37, .06, .86, .30, .0615, -2.53);
  for (const x of [-3.38, 3.98]) box(root, 'Opening_frame_vertical', rail, .08, 3.86, .10, x, 1.9915, -1.96);
  for (const y of [.07, 3.90]) box(root, 'Opening_frame_horizontal', rail, 7.44, .08, .10, .30, y, -1.96);
  box(root, 'Aux_rack_back', dark, 6.8, 3.3, .08, .30, 2.08, -2.42);
  for (const x of [-3.05, 3.65]) box(root, 'Aux_rack_rail', rail, .08, 3.3, .12, x, 2.08, -2.34);
  for (const [index, x] of [-2.2, .30, 2.8].entries()) {
    box(root, `Aux_psu_module_${index + 1}`, metal, 1.85, .78, .28, x, 2.88, -2.32);
    for (let vent = 0; vent < 4; vent++) box(root, `Aux_psu_vent_${index + 1}_${vent}`, black, 1.45, .035, .02, x, 2.72 + vent * .09, -2.17);
    box(root, `Aux_psu_led_${index + 1}`, green, .05, .05, .02, x - .78, 3.12, -2.17);
    box(root, `Aux_psu_label_${index + 1}`, amber, .55, .10, .01, x + .45, 3.12, -2.17);
  }
  box(root, 'Aux_breaker_panel', metal, 1.7, 1.0, .10, .30, 1.86, -2.34);
  const lever = box(root, 'Aux_breaker_lever', red, .16, .42, .12, .30, 1.86, -2.26);
  lever.rotation.x = -.45;
  box(root, 'Aux_breaker_label', amber, 1.1, .12, .01, .30, 1.48, -2.28);
  box(root, 'Aux_power_rail', green, 5.9, .035, .02, .30, 1.22, -2.27);
  for (const x of [-2.75, -1.4, 1.4, 2.75]) box(root, 'Aux_cable_conduit', dark, .09, 2.2, .09, x, 1.65, -2.30);
  box(root, 'Aux_warning_plate', amber, 1.5, .22, .01, .30, 1.12, -2.27);
  box(root, 'Aux_work_light', workLamp, 5.4, .03, .03, .30, 3.86, -2.16);
  return root;
}

function buildFlipWallRoom() {
  const root = new T.Group();
  root.name = 'Observed_HKU_Flip_Wall_Corridor';
  root.userData = {
    sources: ['November 15 flip wall photo', 'c2f30ae164433b4a517b2ed5d80b7460.mp4, 00:00–00:17.6'],
    dimensions: 'estimated grid and corridor dimensions; HKU lettering traced approximately',
    placement: 'building, floor and corridor endpoints unverified',
  };
  const shell = section(root, 'Corridor_structure');
  const wall = section(root, 'HKU_flip_wall');
  const tiles = section(wall, 'Flip_tile_faces');
  wall.position.set(.30, 0, -1.93);
  wall.userData = {
    id: 'CDS1-hku-flip-wall',
    units: 'metres',
    origin: 'panel centre',
    forward: '+Z',
    dimensions: {columns: flipColumns, rows: flipRows, tilePitch, width: flipColumns * tilePitch, height: flipRows * tilePitch},
    capabilities: ['tile.flip.vertical-axis', 'tile.front-back-inverse'],
    source: 'November 15 flip-wall photo; c2f30ae164433b4a517b2ed5d80b7460.mp4, 00:00-00:17.6',
  };
  const limestone = material('Corridor ivory stone', 0xcfc9b6);
  const plaster = material('Corridor plaster', 0xe2dacf);
  const wood = material('Flip tile warm timber', 0xb78d62);
  const green = material('Flip tile charcoal green', 0x2e4544);
  const tileEdge = material('Flip tile edge', 0x2b2a24);
  const black = material('Corridor dark frame', 0x32302b);
  const darkBacking = material('Wall recess shadow', 0x443528);
  const lamp = new T.MeshBasicMaterial({name: 'Corridor warm spot', color: 0xffe9c1});
  const width = flipColumns * tilePitch;
  const height = flipRows * tilePitch;
  const bottom = .13;

  box(shell, 'Corridor_floor', limestone, 11.4, .16, 5.2, 0, -.08, .5);
  // Rear wall is a frame around the service opening; the flip panel covers the cavity.
  box(shell, 'Flip_wall_rear_wall_left', plaster, 1.963, 4.12, .22, -4.3685, 2.06, -2.05);
  box(shell, 'Flip_wall_rear_wall_right', plaster, 1.363, 4.12, .22, 4.6685, 2.06, -2.05);
  box(shell, 'Flip_wall_rear_wall_top', plaster, 7.374, .197, .22, .30, 4.0215, -2.05);
  box(shell, 'Flip_wall_rear_wall_bottom', plaster, 7.374, .06, .22, .30, .03, -2.05);
  box(shell, 'Stone_column', limestone, .63, 4.1, .68, -4.77, 2.05, .97);
  box(shell, 'Dark_door_reveal', black, .23, 3.19, .14, -3.59, 1.595, -1.89);
  box(shell, 'Service_door', material('Corridor timber door', 0x7d6852), .79, 2.36, .13, -4.28, 1.18, -1.9);
  box(shell, 'Right_dark_jamb', black, .12, 4.06, .18, 4.22, 2.03, -1.89);
  box(shell, 'Short_ceiling_return', plaster, 10.7, .15, 2.4, 0, 4.10, -.875);
  for (let index = 0; index < 17; index++) {
    const x = -5.05 + index * .59;
    const z = -.85 + .028 * Math.min(index - 6, 0) ** 2;
    const channel = box(shell, 'Recessed_ceiling_channel', black, .635, .022, .090, x, 4.017, z);
    channel.rotation.y = -.095 * Math.min(index - 6, 0);
    if (index % 4 === 0) box(shell, 'Recessed_spot', lamp, .15, .012, .044, x, 4, z);
  }

  box(wall, 'Panel_shadow_gap', darkBacking, width + .10, height + .10, .08, 0, bottom + height / 2, 0);
  for (const side of [-1, 1]) {
    box(wall, 'Timber_side_frame', wood, .077, height + .14, .23, side * (width / 2 + .035), bottom + height / 2, .056);
    box(wall, 'Timber_horizontal_frame', wood, width + .146, .07, .23, 0, bottom + height / 2 + side * (height / 2 + .035), .056);
  }

  for (let row = 0; row < flipRows; row++) {
    for (let column = 0; column < flipColumns; column++) {
      const x = (column + .5) * tilePitch - width / 2;
      const y = bottom + height - (row + .5) * tilePitch;
      const dark = isDarkTile(column, row);
      const tile = new T.Group();
      tile.name = `FlipTile_r${row}c${column}`;
      tile.position.set(x, y, .11);
      tile.rotation.x = (row % 3 - 1) * .018;
      tile.userData = {row, column, front: dark ? 'green' : 'wood', back: dark ? 'wood' : 'green'};
      tiles.add(tile);
      const face = new T.Mesh(
        new T.BoxGeometry(tilePitch - .012, tilePitch - .019, .044),
        [tileEdge, tileEdge, tileEdge, tileEdge, dark ? green : wood, dark ? wood : green],
      );
      face.name = 'Flip_tile_face';
      face.castShadow = face.receiveShadow = true;
      tile.add(face);
    }
  }

  root.add(buildAuxPowerCloset());
  return root;
}

/** Independently flippable tiles, in row-major order. Each tile rotates around its
 * vertical centre; the front and back faces carry opposite colours. */
export function flipWallTiles(root: T.Object3D) {
  const tiles: T.Group[] = [];
  root.traverse(object => {
    if (object instanceof T.Group && object.name.startsWith('FlipTile_')) tiles.push(object);
  });
  return tiles;
}

export type FeatureRoom = 'keyboard' | 'flipWall' | 'ringDisplay';

export function buildObservedFeatureRoom(kind: FeatureRoom) {
  const builders = {keyboard:buildKeyboardRoom, flipWall:buildFlipWallRoom, ringDisplay:buildRingDisplayRoom};
  const root = builders[kind]();
  compact(root);
  voxelizeMaterials(root);
  return root;
}
