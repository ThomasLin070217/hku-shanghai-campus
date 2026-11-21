import {spawn} from 'node:child_process';

const children = [
  {name: 'agent', child: spawn(process.execPath, ['scripts/agent-server.mjs'], {stdio: 'inherit'}), fatal: true},
  {name: 'vite', child: spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {stdio: 'inherit'}), fatal: true},
  // The local AI bridge is optional: if it cannot start, the MacBook assistant
  // still answers from the built-in campus rules and Vite keeps running.
  {name: 'llm', child: spawn(process.execPath, ['scripts/llm-bridge.mjs'], {stdio: 'inherit'}), fatal: false},
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const {child} of children) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const entry of children) {
  entry.child.on('exit', code => {
    if (stopping) return;
    if (entry.fatal) {
      stop();
      process.exitCode = code ?? 0;
    } else if (code) {
      console.error(`[play] ${entry.name} helper exited (${code}); continuing without it.`);
    }
  });
}
