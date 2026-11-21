export type Glyph =
  |'finder'|'map'|'agent'|'mission'|'robotics'|'terminal'|'logs'|'invitation'|'about'
  |'bell'|'power'|'lock'|'brand'|'apple'|'folder'|'file'|'pdf'|'text'|'search'|'wifi'|'trash';

const paths:Record<Glyph,string>={
  finder:'<path d="M4 8h6l2 2h8v8H4z"/><path d="M5 8V6h5l2 2h6v2"/>',
  map:'<path d="m3 7 6-2 6 2 6-2v13l-6 2-6-2-6 2zM9 5v13m6-11v13"/><path d="m6 13 4-3 5 2 3-3"/>',
  agent:'<path d="M4 5h16v11H9l-4 4v-4H4z"/><path d="m8 11 2-3 2 6 2-6 2 3"/>',
  mission:'<path d="M3 5h18v14H3zM3 8h18"/><path d="m6 11 3 2-3 2m5 0h4"/>',
  robotics:'<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V5m-2 0h4M2 12v4m20-4v4m-10 0h3"/><circle cx="8" cy="12" r=".8"/><circle cx="16" cy="12" r=".8"/>',
  terminal:'<path d="M3 4h18v15H3zM8 21h8"/><path d="M5 12h3l2-4 3 8 2-5 2 1h2"/>',
  logs:'<path d="M5 4h13l1 1v15H5zM7 4v16m3-12h6m-6 4h6m-6 4h4"/>',
  invitation:'<path d="M3 6h18v13H3zM3 6l9 7 9-7"/>',
  about:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.5"/>',
  bell:'<path d="M5 17c2-3 2-4 2-7a5 5 0 0 1 10 0c0 3 0 4 2 7zM10 20h4"/>',
  power:'<path d="M10 3v9m-4-6a8 8 0 1 0 10 0"/>',
  lock:'<path d="M5 10h14v10H5zM8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
  brand:'<path d="M3 17V9l6-4v8m0 4V9l6-4v8m0 4V9l6-4v12l-6 4V13l-6 4-6 3"/>',
  apple:'<path d="M12 7c-1.3-1.8-3-2.4-4.6-1.6C5.2 6.4 4 9.4 4.7 13c.6 3.3 2.5 6.2 4.7 6.2 1 0 1.6-.6 2.6-.6s1.6.6 2.6.6c2.2 0 4.1-2.9 4.7-6.2.5-2.6-.2-5.2-2-6.5-1.6-1.1-3.6-.7-5.3.5Z"/><path d="M12 7c.2-2.2 1.4-3.6 3.4-4"/>',
  folder:'<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
  file:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  pdf:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 16v-4h1.4a1.3 1.3 0 0 1 0 2.6H9m4 1.4v-4h1.2c1.2 0 1.8.8 1.8 2s-.6 2-1.8 2z"/>',
  text:'<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/>',
  wifi:'<path d="M3.5 8.5a12 12 0 0 1 17 0M6.5 12a8 8 0 0 1 11 0M9.5 15.4a4 4 0 0 1 5 0"/><circle cx="12" cy="19" r="1"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>',
};

export function glyph(name:Glyph) {
  const art=document.createElement('span');art.className='device-glyph mac-glyph';art.setAttribute('aria-hidden','true');
  art.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6">'+paths[name]+'</svg>';
  return art;
}
export function el<K extends keyof HTMLElementTagNameMap>(tag:K,css='',text=''):HTMLElementTagNameMap[K]{
  const node=document.createElement(tag);if(css)node.className=css;if(text)node.textContent=text;return node;
}
export function action(label:string,fn:()=>void,css=''){
  const button=el('button',css,label);button.type='button';button.addEventListener('click',fn);return button;
}
export function setLabel(node:HTMLElement,value:string){if(node.textContent!==value)node.textContent=value;}
