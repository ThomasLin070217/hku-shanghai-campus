#!/usr/bin/env node
/**
 * Build the two audition pages from whatever takes exist on disk.
 * Regenerate after every composer/voice delivery.
 *
 *   node scripts/build-audition-pages.mjs
 *
 * Music: .scratch/music-2026-11-23/audition.html
 * Voice: .scratch/voice-2026-11-23/audition.html
 */
import {existsSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const musicRoot = join(root, '.scratch/music-2026-11-23');
const voiceRoot = join(root, '.scratch/voice-2026-11-23');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

function walk(dir, suffix) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, suffix));
    else if (name.endsWith(suffix)) out.push(p);
  }
  return out;
}

function page(title, subtitle, groups, kind) {
  const body = groups
    .map(
      (group) => `
    <section class="group">
      <header><h2>${esc(group.title)}</h2>${group.meta ? `<p>${esc(group.meta)}</p>` : ''}</header>
      <div class="takes">
        ${group.takes
          .map(
            (take) => `
          <article class="take" data-key="${esc(take.key)}">
            <div class="take-head">
              <b>${esc(take.label)}</b>
              <label class="veto"><input type="checkbox" data-veto="${esc(take.key)}"> veto</label>
            </div>
            ${take.text ? `<p class="text">${esc(take.text)}</p>` : ''}
            <audio controls preload="none" src="${esc(take.src)}"></audio>
            <code>${esc(take.file)}</code>
          </article>`,
          )
          .join('')}
      </div>
    </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:dark;--bg:#0d1117;--card:#161b22;--line:#30363d;--ink:#e6edf3;--dim:#8b949e;--accent:#d4a24c}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{max-width:980px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:26px;margin:0 0 4px}p.sub{color:var(--dim);margin:0 0 28px}
  .group{margin:0 0 28px}.group header{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:12px}
  h2{font-size:17px;margin:0;letter-spacing:.02em}.group header p{color:var(--dim);margin:0;font-size:13px}
  .takes{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
  .take{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
  .take-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .veto{color:var(--dim);font-size:12px}.text{color:var(--dim);font-size:13px;margin:0 0 8px}
  audio{width:100%;margin:4px 0 6px}code{color:var(--dim);font-size:11px;word-break:break-all}
  .bar{position:sticky;top:0;background:rgba(13,17,23,.96);border-bottom:1px solid var(--line);padding:12px 0;margin:-32px 0 24px;display:flex;gap:12px;align-items:center;z-index:2}
  button{background:var(--accent);color:#1a1205;border:0;border-radius:7px;padding:8px 14px;font-weight:700;cursor:pointer}
  #out{color:var(--dim);font-size:12px;white-space:pre-wrap;flex:1}
</style></head><body><main>
  <h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>
  <div class="bar"><button id="copy">Copy veto list</button><span id="out">Tick “veto” on any take, then copy the list.</span></div>
  ${body}
</main>
<script>
  const KEY='audition-veto-${kind}';
  const load=()=>JSON.parse(localStorage.getItem(KEY)||'[]');
  const save=(v)=>localStorage.setItem(KEY,JSON.stringify(v));
  document.querySelectorAll('[data-veto]').forEach((box)=>{
    box.checked=load().includes(box.dataset.veto);
    box.addEventListener('change',()=>{
      const v=new Set(load());
      box.checked?v.add(box.dataset.veto):v.delete(box.dataset.veto);
      save([...v]);
    });
  });
  document.getElementById('copy').addEventListener('click',async()=>{
    const v=load();
    const text=v.length?v.join('\\n'):'(nothing vetoed)';
    try{await navigator.clipboard.writeText(text);document.getElementById('out').textContent='Copied '+v.length+' item(s):\\n'+text;}
    catch{document.getElementById('out').textContent=text;}
  });
</script></body></html>`;
}

// ---- music ----
const musicGroups = new Map();
for (const file of walk(musicRoot, '.mp3').sort()) {
  const rel = relative(musicRoot, file);
  const parts = rel.split('/');
  if (!parts[0].startsWith('family-')) continue;
  const family = parts[0];
  const cue = parts[1];
  const take = parts[2] ?? 'take';
  const key = `${cue}--${family}--${take}`;
  const groupKey = cue;
  if (!musicGroups.has(groupKey)) musicGroups.set(groupKey, {title: cue, meta: family, takes: []});
  musicGroups.get(groupKey).takes.push({
    key,
    label: `${family} · ${take}`,
    text: '',
    src: rel,
    file: rel,
  });
}
const musicPage = page(
  'HKU Shanghai at War — score audition',
  'Two takes per cue where delivered. Tick veto, copy the list, send it back. Files are relative to this page.',
  [...musicGroups.values()],
  'music',
);
writeFileSync(join(musicRoot, 'audition.html'), musicPage);

// ---- voice ----
const castPath = join(voiceRoot, 'cast.json');
const cast = existsSync(castPath) ? JSON.parse(readFileSync(castPath, 'utf8')) : {lines: []};
const takeFiles = new Set(walk(voiceRoot, '.mp3').map((f) => relative(voiceRoot, f)));
const voiceGroups = cast.lines.map((line) => ({
  title: line.id,
  meta: line.speaker,
  takes: line.takes
    .map((take) => {
      const rel = `out/${line.id}--${take.slug}.mp3`;
      if (!takeFiles.has(rel)) return null;
      return {key: `${line.id}--${take.slug}`, label: take.slug, text: line.text, src: rel, file: rel};
    })
    .filter(Boolean),
}));
const voicePage = page(
  'HKU Shanghai at War — voice audition',
  'Main-story lines first. Tick veto, copy the list, send it back.',
  voiceGroups.filter((g) => g.takes.length),
  'voice',
);
writeFileSync(join(voiceRoot, 'audition.html'), voicePage);

console.log(`music: ${musicGroups.size} cues -> ${join(musicRoot, 'audition.html')}`);
console.log(`voice: ${voiceGroups.filter((g) => g.takes.length).length} lines -> ${join(voiceRoot, 'audition.html')}`);
