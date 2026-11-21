import type {Plugin} from 'vite';
import {chat,configured} from './llm.mjs';

/** Exposes the project model only to this machine's development game. */
export function campusModelPlugin():Plugin {
  const model=process.env.LITELLM_MODEL,route='/api/campus-model';
  return {name:'campus-local-model',apply:'serve',
    config(){
      if(!configured()||!model)return;
      return {define:{
        'import.meta.env.VITE_CAMPUS_MODEL_ENDPOINT':JSON.stringify(route),
        'import.meta.env.VITE_CAMPUS_MODEL_NAME':JSON.stringify(model),
      }};
    },
    configureServer(server){
      if(!configured()||!model)return;
      server.middlewares.use(route,async(req,res)=>{
        const respond=(status:number,body:unknown)=>{
          if(res.destroyed||res.writableEnded)return;
          res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
          res.end(JSON.stringify(body));
        };
        const host=req.headers.host??'';
        if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)||
          (req.headers.origin&&req.headers.origin!=='http://'+host&&req.headers.origin!=='https://'+host))return respond(403,{error:'local_origin_required'});
        if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return respond(415,{error:'expected_json_post'});
        const cancel=new AbortController();res.on('close',()=>cancel.abort());
        try{
          const parts:Buffer[]=[];let size=0;
          for await(const part of req){const buffer=Buffer.from(part);size+=buffer.length;if(size>96*1024)return respond(413,{error:'request_too_large'});parts.push(buffer);}
          const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
          if(body?.model!==model||!Array.isArray(body.messages)||!body.messages.length||body.messages.length>20||
            !body.messages.every((turn:{role?:string;content?:string}|null)=>turn&&['system','user','assistant'].includes(turn.role??'')&&typeof turn.content==='string'&&turn.content.length<=16000))return respond(400,{error:'invalid_chat'});
          const result=await chat(body.messages,{model,maxTokens:700,temperature:body.response_format?0:.3,responseFormat:body.response_format,signal:cancel.signal});
          respond(200,result);
        }catch(error){
          const status=error instanceof SyntaxError?400:Number((error as {status?:number})?.status)||502;
          respond(status,{error:'model_request_failed'});
        }
      });
    },
  };
}
