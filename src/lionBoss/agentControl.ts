import {connectAgent} from '../agent/bridge';
import type {CampusGame} from '../exploration/game';

interface AgentControls {
  game:CampusGame;
  explorer:{enableAI():void};
  host:HTMLElement;
  screenshot:()=>string;
  eligible:()=>boolean;
}

export function attachLawnAgent({game,explorer,host,screenshot,eligible}:AgentControls){
  if(import.meta.env.MODE==='playtest'||!['localhost','127.0.0.1'].includes(location.hostname)){
    return {dispose(){}};
  }
  const panel=document.createElement('details'),title=document.createElement('summary');
  title.textContent='本机 AI 控制';panel.append(title);
  const arm=document.createElement('button'),status=document.createElement('p');
  arm.type='button';arm.textContent='授权本机游戏代理';status.setAttribute('role','status');
  panel.append(arm,status);host.append(panel);
  const bridge=connectAgent(()=>game,screenshot,s=>{status.textContent=s;});
  arm.onclick=()=>{
    if(!eligible()||game.inventoryOpen||game.panel){status.textContent='请先关盖，并在可操作的关卡阶段授权。';return;}
    bridge.claim();explorer.enableAI();
    if(game.armed)status.textContent='已授权。按移动键或 Esc 收回控制。';
  };
  return {dispose(){bridge.dispose();panel.remove();}};
}
