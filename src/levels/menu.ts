import './menu.css';
import lawnPhoto from './lawn.webp';
import {getGraphicsQuality,setGraphicsQuality,type GraphicsQuality} from '../viewer/graphicsQuality';

document.title = 'HKU Shanghai · 校园试玩';
document.querySelector('#app')!.innerHTML = `
  <main class="levels">
    <header class="levels-heading"><span>HKU Shanghai</span><span>校园试玩</span></header>
    <div class="levels-layout">
      <section aria-labelledby="levels-title">
        <h1 id="levels-title">选择关卡</h1>
        <p class="levels-hint">用电脑键盘和鼠标游玩。按 Esc 暂停。</p>
        <label class="levels-quality"><input type="checkbox" id="low-graphics"> 低画质模式（降低三维分辨率，关闭阴影）</label>
        <nav class="levels-list" aria-label="可试玩的关卡">
          <a href="?experience=opening"><b>校园开场 <small lang="en">High Table</small></b><span>从校园巴士出发，取回 MacBook，前往 4 号楼。</span></a>
          <a href="?experience=sports-hall"><b>体育馆营救</b><span>解开东门的数独和密码锁，救出馆内学生。</span></a>
          <a href="?experience=lion-boss"><b>草坪上的守卫 <small>L001</small></b><span>在 MacBook 上写技能，反制机械狮子并修复系统。</span></a>
          <a href="?experience=survey"><b>校园数字巡检</b><span>走访三个室外地标，在电脑上同步校园档案。</span></a>
        </nav>
      </section>
      <figure><img src="${lawnPhoto}" alt="校园草坪与守卫狮子 L001 的游戏实景"><figcaption>校园草坪 / L001</figcaption></figure>
    </div>
  </main>`;

const lowGraphics = document.querySelector<HTMLInputElement>('#low-graphics')!;
function showQuality(quality:GraphicsQuality) {
  lowGraphics.checked = quality === 'low';
  document.querySelectorAll<HTMLAnchorElement>('.levels-list a').forEach(link => {
    const params = new URLSearchParams(link.search);
    if (quality === 'low' || new URLSearchParams(location.search).has('quality')) params.set('quality',quality);
    else params.delete('quality');
    link.search = params.toString();
  });
}
showQuality(getGraphicsQuality());
lowGraphics.addEventListener('change', () => {
  const quality = lowGraphics.checked ? 'low' : 'auto';
  setGraphicsQuality(quality);
  showQuality(quality);
});
