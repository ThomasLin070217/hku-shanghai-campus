import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSite} from '../src/model/buildSite';
import {sceneRegistry} from '../src/scene/registry';
import {createNavigation} from '../src/exploration/navigation';
import {BUILDINGS,SITE} from '../src/model/campusParameters';
import {SPORTS_DOOR,SPORTS_HALL,sportsDoorWorld} from '../src/model/sportsDoor';
import {SPORTS_HALL_PUZZLE,checkCode,checkPassword,parseSudoku,solvedRows} from '../src/gameplay/sudokuPuzzle';
import {disposeAsset} from '../src/model/buildCampus';

const asset=buildSite(),registry=sceneRegistry(asset.root),nav=createNavigation(BUILDINGS,SITE),centre=sportsDoorWorld(SITE.sportsZ);

// The door is modelled, indexed and animated, and the visual opening matches the collision gap.
const door=asset.root.getObjectByName(SPORTS_DOOR.name);assert.ok(door,'east door group exists');
const leaves=[door!.getObjectByName('Leaf_Left'),door!.getObjectByName('Leaf_Right')];assert.ok(leaves.every(Boolean),'two hinged leaves');
assert.ok(door!.getObjectByName('Night_door_lock_led') instanceof T.Mesh,'lock indicator exists');
const entity=registry.entities.find(e=>e.name.includes('体育馆东门'));assert.ok(entity,'door is in the scene index');
assert.equal(nav.blocked(centre.x,centre.z,0),true,'closed door blocks the opening');
nav.setDoorOpen(SPORTS_DOOR.id,true);
assert.equal(nav.blocked(centre.x,centre.z,0),false,'open door lets the player through');
assert.equal(nav.blocked(centre.x+3,centre.z,0),false,'approach from the east is clear');
assert.equal(nav.blocked(centre.x,centre.z+6,0),true,'east wall stays solid beside the door');
assert.equal(nav.blocked(SPORTS_HALL.x-SPORTS_HALL.eastX,centre.z,0),true,'west wall stays solid');
assert.equal(nav.support(centre.x-3,centre.z,0),SPORTS_HALL.floorTop,'inside floor is walkable');
nav.setDoorOpen(SPORTS_DOOR.id,false);
assert.equal(nav.blocked(centre.x,centre.z,0),true,'the lock can close again');

// The sudoku is a legal grid with exactly four blanks, and its row-major read is the door code.
const puzzle=SPORTS_HALL_PUZZLE,rows=solvedRows(puzzle);
assert.equal(puzzle.blanks.length,4,'exactly four blanks');
assert.deepEqual(puzzle.blanks.map(b=>[b.row,b.col]),[[0,0],[2,7],[7,2],[8,8]],'blank positions');
assert.equal(rows.map(row=>[...row].filter(d=>'123456789'.includes(d)).sort().join('')).every(r=>r==='123456789'),true,'rows are 1–9');
for(let c=0;c<9;c++)assert.equal(rows.map(r=>r[c]).sort().join(''),'123456789',`column ${c+1}`);
for(let b=0;b<9;b++){const values=[];for(let i=0;i<3;i++)for(let j=0;j<3;j++)values.push(rows[(b/3|0)*3+i][(b%3)*3+j]);assert.equal(values.sort().join(''),'123456789',`box ${b+1}`);}
assert.equal(puzzle.answer,'1911','door code');
assert.equal(checkCode(puzzle,['1','9','1','1']),true,'correct code unlocks');
for(const wrong of [['1','9','1','2'],['1','1','9','1'],['1','9','1',''],['','','',''],['0','9','1','1']])assert.equal(checkCode(puzzle,wrong),false,`reject ${wrong.join('')}`);
const pw=puzzle.password;assert.equal(pw.length,4,'password length');assert.equal(pw.answer,'1911','password answer');
assert.equal(checkPassword(puzzle,'1911'),true,'correct password unlocks');
assert.equal(checkPassword(puzzle,['1','9','1','1']),true,'digit slots match the code');
for(const wrongPassword of ['1912','191','19110','','0000'])assert.equal(checkPassword(puzzle,wrongPassword),false,`reject password ${wrongPassword||'(empty)'}`);
const base={id:'t',doorId:SPORTS_DOOR.id,type:'sudoku',title:'t',size:9,rows:puzzle.rows,answer:'1911',lead:'l',hint:'h',failure:'f',success:'s',password:pw};
assert.throws(()=>parseSudoku({...base,answer:'1912'}),/重复/,'an answer that breaks the grid is rejected');
assert.throws(()=>parseSudoku({...base,rows:['*','*','*','*','*','*','*','*','*'],answer:'1911'}),/空格数量|行/, 'malformed rows are rejected');
assert.throws(()=>parseSudoku({...base,size:8}),/size/,'wrong size is rejected');
assert.throws(()=>parseSudoku({...base,password:{...pw,answer:'191'}}),/password.answer/,'short password is rejected');
assert.throws(()=>parseSudoku({...base,password:{...pw,length:5}}),/password.answer/,'password length must match');

console.log('PASS east door geometry/碰撞门洞一致, 可开关; sudoku 4 blanks → 1911; 第二道 4 位密码 1911, 错误/残缺密码被拒绝', {centre,sudoku:puzzle.answer,password:pw.answer,entities:registry.entities.length});
nav.dispose();disposeAsset(asset.root);
