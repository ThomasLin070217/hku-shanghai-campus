import raw from '../../content/puzzles/sports-hall-lock.json';

/** Static content shared by the door lock UI and the offline checks. The JSON is content
 * (narrative-owned); this module only validates it and exposes stable typed access.
 * Two stages: a 9×9 sudoku read row-major, then a short numeric password. */
export interface SudokuBlank {row:number;col:number;order:number}
export interface DoorPassword {length:number;answer:string;lead:string;hint:string;failure:string;success:string}
export interface SudokuPuzzle {
 id:string;doorId:string;title:string;size:number;rows:string[];answer:string;
 lead:string;hint:string;failure:string;success:string;blanks:SudokuBlank[];password:DoorPassword;
}
const FILE='content/puzzles/sports-hall-lock.json';
function must(condition:unknown,reason:string):asserts condition{if(!condition)throw new Error(`${FILE}: ${reason}`);}
const unitCells=(r:number,c:number)=>[[0,1,2,3,4,5,6,7,8].map(i=>[r,i] as const),[0,1,2,3,4,5,6,7,8].map(i=>[i,c] as const),[0,1,2,3,4,5,6,7,8].map(i=>[Math.floor(r/3)*3+Math.floor(i/3),Math.floor(c/3)*3+(i%3)] as const)];

export function parseSudoku(input:unknown):SudokuPuzzle{
 must(input&&typeof input==='object'&&!Array.isArray(input),'必须是对象');
 const r=input as Record<string,unknown>;
 for(const key of ['id','doorId','title','answer','lead','hint','failure','success'] as const)must(typeof r[key]==='string'&&(r[key] as string).length>0,`${key} 必须是非空字符串`);
 must(r.type==='sudoku','type 必须是 sudoku');
 must(r.size===9,'size 必须是 9');
 must(Array.isArray(r.rows)&&r.rows.length===9,'rows 必须是 9 行');
 const rows=r.rows.map((row,i)=>{must(typeof row==='string'&&/^[1-9*]{9}$/.test(row),`第 ${i+1} 行必须是 9 位数字或 *`);return row as string;});
 const answer=r.answer as string;
 must(/^[1-9]{1,9}$/.test(answer),'answer 必须是 1–9 组成的数字串');
 const blanks:SudokuBlank[]=[];
 for(let row=0;row<9;row++)for(let col=0;col<9;col++)if(rows[row][col]==='*')blanks.push({row,col,order:blanks.length+1});
 must(blanks.length===answer.length,`空格数量 ${blanks.length} 与答案长度 ${answer.length} 不一致`);
 // Fill the blanks with the answer and require a complete, legal grid: the puzzle and code cannot drift apart.
 const grid=rows.map(row=>row.split(''));
 blanks.forEach((b,i)=>{grid[b.row][b.col]=answer[i];});
 for(let row=0;row<9;row++)for(let col=0;col<9;col++)for(const unit of unitCells(row,col))for(const [ur,uc] of unit){
  if(ur===row&&uc===col)continue;
  must(grid[ur][uc]!==grid[row][col],`填入答案后 (${row+1},${col+1}) 与 (${ur+1},${uc+1}) 重复：${grid[row][col]}`);
 }
 const password=parsePassword(r.password);
 return{id:r.id as string,doorId:r.doorId as string,title:r.title as string,size:9,rows,answer,lead:r.lead as string,hint:r.hint as string,failure:r.failure as string,success:r.success as string,blanks,password};
}
function parsePassword(input:unknown):DoorPassword{
 must(input&&typeof input==='object'&&!Array.isArray(input),'password 必须是对象');
 const p=input as Record<string,unknown>;
 must(Number.isInteger(p.length)&&(p.length as number)>=2&&(p.length as number)<=8,'password.length 必须是 2–8');
 const length=p.length as number;
 must(typeof p.answer==='string'&&new RegExp(`^\\d{${length}}$`).test(p.answer),`password.answer 必须是 ${length} 位数字`);
 for(const key of ['lead','hint','failure','success'] as const)must(typeof p[key]==='string'&&(p[key] as string).length>0,`password.${key} 必须是非空字符串`);
 return{length,answer:p.answer as string,lead:p.lead as string,hint:p.hint as string,failure:p.failure as string,success:p.success as string};
}
export const SPORTS_HALL_PUZZLE=parseSudoku(raw);
/** Row-major read of the four printed digits is the sudoku code. */
export function readCode(digits:string[]){return digits.map(d=>d.trim()).join('');}
export function checkCode(puzzle:SudokuPuzzle,digits:string[]){return digits.length===puzzle.blanks.length&&digits.every(d=>/^[1-9]$/.test(d.trim()))&&readCode(digits)===puzzle.answer;}
export function checkPassword(puzzle:SudokuPuzzle,entries:string[]|string){const code=Array.isArray(entries)?entries.join(''):entries;return new RegExp(`^\\d{${puzzle.password.length}}$`).test(code)&&code===puzzle.password.answer;}
export function solvedRows(puzzle:SudokuPuzzle){const grid=puzzle.rows.map(row=>row.split(''));puzzle.blanks.forEach((b,i)=>{grid[b.row][b.col]=puzzle.answer[i];});return grid.map(row=>row.join(''));}
