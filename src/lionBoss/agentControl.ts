import {connectAgent} from '../agent/bridge';
import {LOCAL_TOOLS} from '../agent/localTools';
import type {CampusGame} from '../exploration/game';

interface AgentControls {
  game:CampusGame;
  explorer:{enableAI():void};
  host:HTMLElement;
  screenshot:()=>string;
  eligible:()=>boolean;
}

export function attachLawnAgent({game,explorer,host,screenshot,eligible}:AgentControls){
  if(!LOCAL_TOOLS){
    return {dispose(){}};
  }
  const panel=document.createElement('details'),title=document.createElement('summary');
  title.textContent='Local AI control';panel.append(title);
  const arm=document.createElement('button'),status=document.createElement('p');
  arm.type='button';arm.textContent='Authorize the local game agent';status.setAttribute('role','status');
  panel.append(arm,status);host.append(panel);
  const bridge=connectAgent(()=>game,screenshot,s=>{status.textContent=s;});
  arm.onclick=()=>{
    if(!eligible()||game.inventoryOpen||game.panel){status.textContent='Close the lid first, then authorize during a playable stage.';return;}
    bridge.claim();explorer.enableAI();
    if(game.armed)status.textContent='Authorized. Press a movement key or Esc to take control back.';
  };
  return {dispose(){bridge.dispose();panel.remove();}};
}
