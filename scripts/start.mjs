import {spawn} from 'node:child_process';
const children=[spawn(process.execPath,['scripts/agent-server.mjs'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit'})];let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const p of children)p.kill('SIGTERM');}for(const s of ['SIGINT','SIGTERM'])process.on(s,stop);for(const c of children)c.on('exit',code=>{stop();process.exitCode=code??0;});
