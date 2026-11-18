import type {ItemStack} from '../items/inventory';
import type {Settings} from '../gameplay/save';
export type OpeningStage='bus'|'to_b5'|'to_b6'|'return_b5'|'incident'|'to_b4'|'complete';
export type OpeningEvent='read_invitation'|'exit_bus'|'accept_errand'|'take_laptop'|'return_b5'|'read_alert'|'reach_b4';
export interface OpeningState {schemaVersion:1;stage:OpeningStage;invitation_read:boolean;laptop_acquired:boolean;campus_alert_triggered:boolean;alert_read:boolean;events:string[];elapsedSeconds:number}
export type OpeningModal='invitation'|'staff'|'computer'|'alert'|'caught'|'settings'|'complete'|null;
export interface OpeningSave {version:1;mode:'opening';worldRevision:string;savedAt:number;position:[number,number,number];yaw:number;pitch:number;view:'first'|'third';slots:(ItemStack|null)[];selectedHotbar:number;story:OpeningState;settings:Settings}
export interface OpeningView {story:OpeningState;modal:OpeningModal;objective:string;detail:string;prompt:string;saveStatus:string;busReady:boolean;computerPage:'map'|'tasks';robotState:string;robotWarning:number;settings:Settings;handoffEvent:string;player:[number,number,number];yaw:number;target:[number,number,number]|null}
export interface OpeningUIActions {action:(action:'read_invitation'|'accept_errand'|'read_alert'|'retry'|'restart'|'save'|'safe'|'computer'|'settings'|'map')=>void;close:()=>void;setting:(key:keyof Settings,value:number|boolean)=>void;drawMap:(canvas:HTMLCanvasElement,large:boolean)=>void}
