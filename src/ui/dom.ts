/** Avoid redundant DOM mutations, especially in live regions. */
export function setText(el:Element,text:string){if(el.textContent!==text)el.textContent=text;}
export function setHidden(el:HTMLElement,value:boolean){if(el.hidden!==value)el.hidden=value;}
/**
 * HTML-escape any value that is interpolated into a template string.
 *
 * The project builds most panels with `innerHTML`; every externally-owned string
 * (entity names, clue copy, item labels, archive text) must pass through here.
 * Kept dependency-free on purpose: the escaping contract is tiny and auditable.
 */
const ENTITIES:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export function escapeHtml(value:unknown){return String(value).replace(/[&<>"']/g,c=>ENTITIES[c]!);}
/** Alias used by the data components: "safe to place inside innerHTML". */
export const safeHtml = escapeHtml;
