import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const [browser, url, output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node scripts/capture-reconstruction.mjs <Chrome path> <camera URL> <output dir>');
const profile = await mkdtemp(join(tmpdir(), 'campus-capture-'));
const chrome = spawn(browser, ['--headless', '--remote-debugging-port=0', '--user-data-dir='+profile,
  '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank'], {stdio:['ignore','ignore','pipe'],windowsHide:true});
let ws;
try {
  const address = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser debugging endpoint timed out')), 15000);
    chrome.stderr.on('data', data => {
      const match = String(data).match(/DevTools listening on (ws:\/\/[^/]+)/);
      if (match) { clearTimeout(timer); resolve(match[1].replace('ws:', 'http:')); }
    });
    chrome.once('error', reject);
  });
  const tabs = await (await fetch(address+'/json/list')).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  let id = 0;
  const send = (method, params) => new Promise((resolve,reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {ws.off('message',receive);reject(new Error(method+' timed out'));},60000);
    function receive(data) {
      const response = JSON.parse(data);
      if (response.id !== requestId) return;
      clearTimeout(timer);
      ws.off('message',receive);
      if (response.error || response.result.exceptionDetails) reject(new Error(JSON.stringify(response)));
      else resolve(response.result);
    }
    ws.on('message',receive);
    ws.send(JSON.stringify({id:requestId,method,params}));
  });
  await send('Page.navigate',{url});
  const evaluate = async expression => (await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
  const deadline = Date.now()+60000;
  while (!(await evaluate('typeof window.capture === "function"'))) {
    if (Date.now()>deadline) throw new Error('Camera did not initialize');
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  await mkdir(output,{recursive:true});
  const metrics = {};
  async function shot(building, view) {
    const {png,...stats} = await evaluate('window.capture('+JSON.stringify(building)+','+JSON.stringify(view)+')');
    const name = building+'-'+view;
    await writeFile(join(output,name+'.png'),Buffer.from(png.split(',')[1],'base64'));
    metrics[name] = stats;
  }
  if (process.argv.includes('--sign')) {
    await shot('sign','front');
  } else if (process.argv.includes('--grounds')) {
    await shot('forecourt','paving');
    for (const view of ['axis','base']) await shot('lawn',view);
    for (const view of ['head-normal','head-incident']) await shot('dinner',view);
  } else {
    for (const id of ['B01','B02','B03','B04','B05','B06','B07'])
      for (const view of ['front','left','right','entry','player']) await shot(id,view);
    await shot('campus','north');
    for (const view of ['normal','incident']) await shot('dinner',view);
  }
  await writeFile(join(output,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');
  if (process.argv.includes('--smoke')) {
    const game = new URL('/', url);
    const browserResults = {};
    for (const route of ['opening','survey','sports-hall']) {
      game.searchParams.set('experience',route);
      await send('Page.navigate',{url:String(game)});
      const deadline = Date.now()+30000;
      let label;
      while (!(label = await evaluate('document.querySelector("#viewport canvas")?.getAttribute("aria-label")'))) {
        if (Date.now()>deadline) throw new Error('Game canvas did not initialize: '+route);
        await new Promise(resolve=>setTimeout(resolve,300));
      }
      browserResults[route] = label;
    }
    await writeFile(join(output,'runtime-smoke.json'),JSON.stringify(browserResults,null,2)+'\n');
  }
} finally {
  ws?.close();
  chrome.kill();
}
