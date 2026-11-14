/** Avoid redundant DOM mutations, especially in live regions. */
export function setText(el:Element,text:string){if(el.textContent!==text)el.textContent=text;}
export function setHidden(el:HTMLElement,value:boolean){if(el.hidden!==value)el.hidden=value;}
