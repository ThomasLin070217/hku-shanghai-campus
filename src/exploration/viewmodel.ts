/**
 * Whether the first-person view model (arms and held item) is drawn. The explorer
 * is its one writer and asks this every frame.
 * - Story mode (Ruling 36): the MacBook is stowed; arms and MacBook show only
 *   while the player has it open with C.
 * - Survey and the legacy pages keep the held item while walking.
 * - `hidden` is a chapter's request, e.g. B4 inside B04 and in a focus view.
 */
export function firstPersonVisible(s:{enabled:boolean;first:boolean;story:boolean;deviceOpen:boolean;hidden:boolean}):boolean{
 return s.enabled&&s.first&&!s.hidden&&(!s.story||s.deviceOpen);
}
