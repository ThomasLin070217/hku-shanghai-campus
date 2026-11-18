import {escapeHtml} from './dom';
import './dataComponents.css';

/**
 * DataTable — a small, dependency-free sortable/filterable table.
 *
 * The project has no table library and the scene registry is the only large
 * data source (18k entities, filtered through `SceneRegistry.query()`), so this
 * component stays deliberately thin: columns in, rows in, sorting and paging
 * handled locally, every string escaped.
 */
export interface Column<T> {
  key:string;
  label:string;
  /** Sort by `value` (defaults to the formatted text). */
  sortable?:boolean;
  numeric?:boolean;
  get(row:T):string|number;
  format?(value:string|number,row:T):string;
}

export interface DataTable<T> {
  readonly el:HTMLElement;
  setRows(rows:readonly T[]):void;
  /** Case-insensitive substring filter over every formatted cell. */
  setFilter(text:string):void;
  /** Highlight one row (matched through `getRowId`). */
  setSelected(id:string|undefined):void;
  dispose():void;
}

export function createDataTable<T>(options:{
  columns:readonly Column<T>[];
  ariaLabel?:string;
  pageSize?:number;
  emptyText?:string;
  caption?:string;
  /** Row identity used for the selected style. */
  getRowId?(row:T):string;
  /** When set, rows become clickable (mouse + Enter/Space). */
  onRowClick?(row:T):void;
}):DataTable<T>{
  const pageSize=Math.max(1,options.pageSize??8);
  const root=document.createElement('section');
  root.className='data-table';
  root.setAttribute('aria-label',options.ariaLabel??'Data table');
  const table=document.createElement('table');
  const caption=document.createElement('caption');
  caption.className='data-table-caption';
  caption.textContent=options.caption??'';
  const thead=document.createElement('thead');
  const headRow=document.createElement('tr');
  const tbody=document.createElement('tbody');
  table.append(caption,thead,tbody);
  thead.append(headRow);
  root.append(table);
  const footer=document.createElement('div');
  footer.className='data-table-footer';
  const status=document.createElement('span');
  status.className='data-table-status';
  status.setAttribute('role','status');
  const pager=document.createElement('div');
  pager.className='data-table-pager';
  const prev=document.createElement('button');
  prev.type='button';
  prev.textContent='Prev';
  const next=document.createElement('button');
  next.type='button';
  next.textContent='Next';
  pager.append(prev,next);
  footer.append(status,pager);
  root.append(footer);

  let rows:readonly T[]=[];
  let filter='';
  let page=0;
  let sortKey:string|null=null;
  let sortDir:1|-1=1;
  let selectedId:string|undefined;

  const cells=(row:T):string[]=>options.columns.map(c=>{
    const value=c.get(row);
    return c.format?c.format(value,row):String(value);
  });
  const filtered=():T[]=>{
    if(!filter)return [...rows];
    const needle=filter.toLowerCase();
    return rows.filter(row=>cells(row).some(text=>text.toLowerCase().includes(needle)));
  };
  const sorted=():T[]=>{
    const list=filtered();
    if(!sortKey)return list;
    const column=options.columns.find(c=>c.key===sortKey);
    if(!column)return list;
    return list.sort((a,b)=>{
      const left=column.get(a),right=column.get(b);
      const order=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right));
      return order*sortDir;
    });
  };

  function renderHead():void{
    headRow.replaceChildren();
    for(const column of options.columns){
      const th=document.createElement('th');
      th.scope='col';
      if(column.numeric)th.className='is-numeric';
      if(column.sortable){
        const button=document.createElement('button');
        button.type='button';
        button.textContent=column.label;
        if(sortKey===column.key)button.dataset.sorted=sortDir===1?'ascending':'descending';
        button.addEventListener('click',()=>{
          if(sortKey===column.key)sortDir=sortDir===1?-1:1;
          else{sortKey=column.key;sortDir=1;}
          page=0;
          render();
        });
        th.setAttribute('aria-sort',sortKey===column.key?(sortDir===1?'ascending':'descending'):'none');
        th.append(button);
      }else{
        th.textContent=column.label;
      }
      headRow.append(th);
    }
  }

  function render():void{
    renderHead();
    const list=sorted();
    const pages=Math.max(1,Math.ceil(list.length/pageSize));
    if(page>=pages)page=pages-1;
    const start=page*pageSize;
    const slice=list.slice(start,start+pageSize);
    tbody.replaceChildren();
    if(!slice.length){
      const tr=document.createElement('tr');
      const td=document.createElement('td');
      td.colSpan=options.columns.length;
      td.className='data-table-empty';
      td.textContent=options.emptyText??'No matching rows.';
      tr.append(td);
      tbody.append(tr);
    }else{
      for(const row of slice){
        const tr=document.createElement('tr');
        const rowId=options.getRowId?.(row);
        if(rowId!==undefined&&rowId===selectedId){tr.className='is-selected';tr.setAttribute('aria-selected','true');}
        if(options.onRowClick){
          tr.tabIndex=0;
          tr.classList.add('is-clickable');
          tr.addEventListener('click',()=>options.onRowClick!(row));
          tr.addEventListener('keydown',event=>{
            if(event.key==='Enter'||event.key===' '){event.preventDefault();options.onRowClick!(row);}
          });
        }
        for(const [index,text] of cells(row).entries()){
          const td=document.createElement('td');
          if(options.columns[index]?.numeric)td.className='is-numeric';
          td.innerHTML=escapeHtml(text);
          tr.append(td);
        }
        tbody.append(tr);
      }
    }
    status.textContent=`${list.length} / ${rows.length} rows · page ${page+1}/${pages}`;
    prev.disabled=page<=0;
    next.disabled=page>=pages-1;
    caption.hidden=!caption.textContent;
  }

  prev.addEventListener('click',()=>{if(page>0){page-=1;render();}});
  next.addEventListener('click',()=>{page+=1;render();});

  render();
  return{
    el:root,
    setRows(next){rows=next;page=0;render();},
    setFilter(text){filter=text.trim();page=0;render();},
    setSelected(id){if(id===selectedId)return;selectedId=id;render();},
    dispose(){root.remove();rows=[];filter='';},
  };
}
