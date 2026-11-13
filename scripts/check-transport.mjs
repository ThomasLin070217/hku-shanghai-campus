// HTTP service contract checks with no browser connected.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8787';
const health=await fetch(base+'/health').then(r=>r.json());assert.equal(health.listen,'127.0.0.1');
const foreign=await fetch(base+'/act',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:'{}'});assert.equal(foreign.status,403);
const form=await fetch(base+'/act',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'});assert.equal(form.status,415);
const malformed=await fetch(base+'/act',{method:'POST',headers:{'content-type':'application/json'},body:'{'});assert.equal(malformed.status,400);
const unknown=await fetch(base+'/teleport',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(unknown.status,404);
if(!health.ready){const r=await fetch(base+'/observe');assert.equal(r.status,503);assert.equal((await r.json()).error,'not_ready');}
console.log('PASS localhost health, foreign-origin rejection, JSON requirement, malformed body, absent teleport, not_ready when disconnected');
