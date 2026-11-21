import type {ConsoleResult,ProjectId,VibeService} from './consoleService';

export interface DeviceCommand {id:string; label:string; enabled:boolean; reason?:string}
export interface RobotDevice {
  id:string; name:string; status:string; permission:string; commands:DeviceCommand[];
  remainingSeconds?:number; lastResult?:string;
}
export interface RoboticsService {
  devices():readonly RobotDevice[];
  execute(deviceId:string,commandId:string):Promise<ConsoleResult<string>>;
}
export interface FieldSkillStatus {
  target:string|null; canCast:boolean; reason:string; cooldown:number; cooldownTotal:number;
}
export interface FieldSkillService {
  read(project:ProjectId):FieldSkillStatus;
  cast(project:ProjectId):Promise<ConsoleResult<string>>;
}
export interface CampusComputeSession {
  vibe:VibeService; robotics:RoboticsService; field?:FieldSkillService; energy?:()=>string;
}

// A story integration supplies only currently authorised sessions and reconstructs
// them from its own save. A desktop opening or a lawn launch never writes this grant.
type Source=(macInstanceId:string)=>CampusComputeSession|null;
let current:Source|null=null;
export function registerCampusComputeSource(source:Source){
  current=source;
  return ()=>{if(current===source)current=null;};
}
export function getCampusComputeSession(macInstanceId:string):CampusComputeSession|null {
  return current?.(macInstanceId)??null;
}
