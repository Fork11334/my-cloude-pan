# 四个站点动效手法 → 原生 CSS/JS 复刻技术清单

> 目标环境假设：纯静态中文站，零 npm、零框架、零构建工具。所有示例只使用原生 CSS + Web Animations API + IntersectionObserver。
> 全部示例遵循同一约束：只动 `transform` / `opacity` / `filter`（外加 `clip-path`、`stroke-dashoffset` 等可合成或低成本的属性），并且可被 `prefers-reduced-motion` 关闭。

---

## 0. 抓取状态与取证说明（先看这段，决定你对内容可信度的判断）

| 站点 | 抓取结果 | 证据等级 |
|---|---|---|
| animejs.com | 首页抓取成功；详情页是 SPA 壳，改用其 GitHub 源码取证 | **高**：`src/events/scroll.js`、`src/svg/drawable.js`、`src/svg/index.js`、`src/index.js`、README 全部读到真实 API |
| uiverse.io | 首页抓取成功；元素详情页是 SPA，**页面内的 CSS 抓不到** | **高**：改用其官方 GitHub 仓库 [uiverse-io/galaxy](https://github.com/uiverse-io/galaxy) 的原始 HTML/CSS 文件（已实际读取 2 个开关组件全文） |
| wodniack.dev | 主站抓取成功；其开源仓库 `AntoineW/AW-2025-Portfolio` 全部源码可用 | **最高**：直接读了 `SHero`、`SiteHead`、`AWaves`、`ASeparator`、`SiteScrollbar`、`index.astro`、`Ticker.js`、`package.json` |
| motionsites.ai | 首页 + Academy 教程抓取成功，**教程里含真实 prompt 全文** | **高**：动画参数（lerp 0.12、threshold 0.15、700ms、延迟表）来自其官方 prompt 文本 |

**三个必须先纠正的常见误解**（否则你会照抄错方向）：

1. **wodniack.dev 的招牌动效不是 WebGL。** 首屏背景那些随鼠标起伏的长线，实现是自定义元素 `<a-waves>` 里**一个 `<svg>` + 每帧动态拼 `d` 属性的每行 `<path>`**，位移来自 perlin 噪声 + 弹簧阻尼（`src/components/AWaves.astro`）。仓库依赖里**没有 Three.js、没有 WebGL 库**，`package.json` 只有 `astro / gsap / lenis / sass / autoprefixer / modern-normalize`。
2. **它的"自定义光标"不是跟随轨迹长尾**，是 `a-waves::before` 一个 0.5rem 的圆点，位置由 CSS 变量 `--x / --y` 驱动，每帧 `style.setProperty`。
3. **它的 SVG 描边不是 `stroke-dasharray` 手写**，是 GSAP 的 `DrawSVGPlugin`，且用了 `stagger: { from: 'edges' }` 从两端向中间画。但 anime.js 的 `createDrawable` 源码证明了这条效果的**通用实现就是 `pathLength` + `stroke-dasharray` + `stroke-dashoffset`**——所以第 1 节的还原写法是准确的。

> 未能抓取的部分，我明确标注"未验证"。

---

## A. 效果清单

### A1. animejs.com（动画原理 → 原生还原）

它的官网在演示层面展示的是 **Anime.js v4 的 API 能力**，不是页面本身的动效设计。所以这一节按"它演示了什么原理 → 你怎么用原生实现"来组织。所有 API 名都经源码核对：`animate`、`createTimeline`、`stagger`、`createSpring`、`createDrawable`、`createMotionPath`、`morphTo`、`onScroll`、`createScope`。

---

【名称】错峰入场 stagger
【观感】一组元素依次弹入，间隔稳定，最后一个略带回弹
【实现】
```js
// 原生：不逐个 new Animation，而是一组 delay，浏览器统一调度
const items = document.querySelectorAll('.js-stagger');
const ease = 'cubic-bezier(.22,1,.36,1)'; // 近 spring 的「快出慢收」
items.forEach((el, i) => {
  el.animate(
    [{ opacity: 0, transform: 'translateY(12px)' },
     { opacity: 1, transform: 'none' }],
    { duration: 600, delay: i * 60, easing: ease, fill: 'both' }
  );
});
```
```css
.js-stagger { opacity: 0; } /* 防 FOUC：先不可见，JS 跑到再交给动画 */
@media (prefers-reduced-motion: reduce) {
  .js-stagger { opacity: 1; }
}
```
【关键 API】`Element.animate()`、`KeyframeEffect`、`fill: 'both'`
【坑】`fill: 'both'` 会留下 `animation-fill-mode` 效果导致后续 CSS hover 冲突；动画结束（`anim.finished.then()`）后应 `anim.cancel()` 或显式写终值。元素超过 ~80 个时，别用 `delay: i*60`，改用 CSS `transition-delay` 或分段（每 10 个复位一次）。
【reduced-motion】直接跳过动画、元素保持终态，不要只是把时长改成 0.01ms（会触发 1 帧闪烁）。

---

【名称】按位置/网格错峰（stagger from center）
【观感】动画从元素组中心向外扩散（或从角落/边缘），像涟漪
【实现】
```js
// Anime.js: stagger(65, { from: 'center', grid: [13, 13] })
// 原生：自己算「到原点的距离」，再乘步长
function staggerFromCenter(els, step = 40, origin = 'center') {
  const rects = els.map(el => el.getBoundingClientRect());
  const minX = Math.min(...rects.map(r => r.left));
  const maxX = Math.max(...rects.map(r => r.right));
  const minY = Math.min(...rects.map(r => r.top));
  const maxY = Math.max(...rects.map(r => r.bottom));
  const ox = origin === 'left' ? minX : origin === 'right' ? maxX : (minX + maxX) / 2;
  const oy = origin === 'top' ? minY : origin === 'bottom' ? maxY : (minY + maxY) / 2;

  els.forEach(el => {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(r.left + r.width / 2 - ox, r.top + r.height / 2 - oy);
    el.animate(
      [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }],
      { duration: 700, delay: d * (step / 100), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
    );
  });
}
```
【关键 API】`getBoundingClientRect()`、`Math.hypot()`、`Element.animate()`
【坑】`getBoundingClientRect()` 会强制布局。**只在滚动停止/入场那一次调用**，不要把 `rects` 算在 scroll 回调里。窗口 resize 后距离表会失效，需要重算。
【CSS 变体（零 JS 调度）】给每个元素内联 `--i`，用 `transition-delay: calc(var(--i) * 60ms)`。

---

【名称】时间轴编排（timeline 的相对时间点）
【观感】多段动画按精确节奏接力，某段与上一段重叠（overlap）
【实现】
```js
// Anime.js: createTimeline().add(a, 0).add(b, '<').add(c, '-=0.4')
// 原生：把每一段封装成「返回 Animation 的函数」，自己管时间轴
function timeline(steps) {
  let cursor = 0;               // 单位 ms
  const anims = [];
  for (const s of steps) {
    const at = typeof s.at === 'function' ? s.at(cursor) : (s.at ?? cursor);
    s.els.forEach((el, i) => {
      const a = el.animate(s.keyframes, {
        duration: s.duration ?? 600,
        delay: at + (s.stagger ?? 0) * i,
        easing: s.easing ?? 'cubic-bezier(.22,1,.36,1)',
        fill: 'both'
      });
      anims.push(a);
    });
    cursor = at + (s.duration ?? 600);
  }
  return Promise.all(anims.map(a => a.finished)); // 或 anims 数组统一 play/pause
}

// 用法：第二段从上一段开始处 -400ms 起（等价于 '<' / '-=0.4'）
timeline([
  { els: lines,  keyframes: [{ transform: 'scaleY(0)' }, { transform: 'none' }], duration: 900, stagger: 90, at: 0 },
  { els: [title], keyframes: [{ transform: 'translateY(100%)' }, { transform: 'none' }], duration: 800, at: c => c - 400 }
]);
```
【关键 API】`Element.animate()` 返回的 `Animation` 对象、`animation.currentTime`、`animation.playbackRate`、`Animation.finished`
【坑】原生没有"时间轴对象"，想要 `seek()` / `playbackRate` 整体调速，得自己维护 `anims` 数组并批量改写。复杂（>5 段）时维护成本会迅速超过收益，此时**用 CSS 关键帧 + `animation-delay` 反而更省事**。
【降级】reduced-motion 下：不构建 timeline，直接给所有元素加 `.is-final` 类（由 CSS 定义终态）。

---

【名称】spring / 弹性缓动（含 release 回弹）
【观感】位移越快越"重"，松手后过冲一点再收住，像带阻尼的弹簧
【实现】三种由简到繁：
```css
/* 1) 最省：回弹型 cubic-bezier 的 y 值超出 [0,1] 区间即可过冲 */
.springy { transition: transform .5s cubic-bezier(.22, 1.6, .36, 1); }

/* 2) 更拟真：linear() 直接采样一条带多个过冲峰的曲线（支持度好） */
.springy-2 { transition: transform .6s linear(0, .32 8%, .78 18%, 1.05 27%, 1.12 34%, 1.06 43%, .99 52%, .97 62%, 1 100%); }

/* 3) 真正物理：JS 每帧积分（要能做"松手后继续滑"的交互才需要） */
```
```js
// 3) 原生弹簧积分器：stiffness / damping，等价 Anime.js 的 createSpring
function spring({ stiffness = 120, damping = 6, mass = 1 }) {
  let x = 0, v = 0;                       // 当前值、速度
  return function step(target, dt /* 秒 */) {
    const f = -stiffness * (x - target) - damping * v;
    v += (f / mass) * dt;
    x += v * dt;
    return x;
  };
}
```
【关键 API】`cubic-bezier()`、`linear()`（Chrome 113+ / Firefox 112+ / Safari 17.2+）、`requestAnimationFrame`
【坑】`cubic-bezier` 的 x 分量**必须**在 `[0,1]`，超范围整条声明无效（y 可以超）。弹簧积分必须用真实 delta 时间，否则 120Hz 屏上会快一倍；把 delta 钳到 16–32ms 之间防止掉帧后炸开。
【reduced-motion】弹簧换成 `ease-out`；`linear()` 的过冲全部去掉。

---

【名称】SVG 线条描边（draw / line drawing）
【观感】一条线像被笔"画"出来，可以从两端同时画
【实现】Anime.js 的 `createDrawable` 源码给出了标准做法：设 `pathLength="1000"` 归一化，再动 `stroke-dasharray` 与 `stroke-dashoffset`。
```html
<svg viewBox="0 0 300 60">
  <path class="js-draw" d="M4 40 C80 -10, 200 90, 296 22"
        pathLength="1000" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
```
```js
const paths = document.querySelectorAll('.js-draw');
paths.forEach((p, i) => {
  p.animate(
    [
      { strokeDasharray: '0 1000', strokeDashoffset: 0 },
      { strokeDasharray: '1000 1000', strokeDashoffset: 0 }
    ],
    { duration: 1400, delay: i * 40, easing: 'ease', fill: 'both' }
  );
});
// 若想要 Anime.js 里「从两端向中间画」的 from:'edges' 效果，改成同时收缩 offset：
// keyframes: [{ strokeDashoffset: 0,  strokeDasharray: '0 1000' },
//             { strokeDashoffset: 500, strokeDasharray: '0 1000' }] 需配合两段合成
```
【关键 API】`pathLength` 属性、`stroke-dasharray`、`stroke-dashoffset`、`Element.animate()`
【坑】不设 `pathLength` 就得用 `path.getTotalLength()`（会强制布局，且对 `<circle>`/`<rect>` 行为不同）。`d` 属性**不能**被 Web Animations 平滑插值到另一条点数不同的路径上——**形状变形（morph）在原生里不可靠**，Anime.js 的 `morphTo` 做了路径归一化，你自己写至少要把两条路径转成相同命令序列与点数，量级很大，**建议不做**。
【reduced-motion】直接设终态 `stroke-dasharray: none`。

---

【名称】沿路径运动（motion path）
【观感】一个元素沿固定曲线滑动、并自动朝向切线方向
【实现】原生两条路：
```css
/* 路 A：offset-path（现代浏览器支持良好），零 JS */
.mover {
  offset-path: path("M0,0 C120,-60 240,60 360,0");
  offset-rotate: auto;
  animation: follow 3s linear infinite alternate;
}
@keyframes follow { from { offset-distance: 0%; } to { offset-distance: 100%; } }
```
```js
// 路 B：getPointAtLength 采样，兼容性最好，也方便和别的动画混排
const path = document.querySelector('#circuit');
const total = path.getTotalLength();
const dot = document.querySelector('.js-dot');
path.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1 }); // 占位，非必需
let raf;
function tick(t) {
  const p = path.getPointAtLength(((t / 3000) % 1) * total);
  dot.style.transform = `translate(${p.x}px, ${p.y}px)`;
  raf = requestAnimationFrame(tick);
}
raf = requestAnimationFrame(tick);
```
【关键 API】CSS `offset-path` / `offset-distance` / `offset-rotate`、`SVGGeometryElement.getPointAtLength()`
【坑】`getPointAtLength` 每帧调用会反复触发布局计算，**元素多时先采样成数组缓存**。`offset-path: path()` 的坐标是元素自身定位坐标系，坐标系原点不是 SVG viewBox，容易算错位置。
【reduced-motion】停止跟随，元素静态停在路径起点。

---

【名称】滚动驱动 + 进度同步（scroll-sync）
【观感】动画进度**绑定**滚动位置：滚一半，动画播一半；往回滚会倒放
【实现】
```js
// Anime.js: autoplay: onScroll({ sync: true })（源码确认：sync 为 true / 数字 / 'linear' / 缓动名）
// 原生稳妥配方：IntersectionObserver 管「进出场」，rAF 管「进度」
const targets = document.querySelectorAll('[data-scroll-sync]');

const io = new IntersectionObserver((entries) => {
  for (const e of entries) e.target.dataset.inView = e.isIntersecting ? '1' : '0';
}, { threshold: 0, rootMargin: '0px' });
targets.forEach(el => io.observe(el));

let ticking = false;
function update() {
  ticking = false;
  for (const el of targets) {
    if (el.dataset.inView !== '1') continue;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 → 元素底部刚进视口；1 → 元素顶部离开视口顶部
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    el.style.setProperty('--p', p.toFixed(4));      // 交给 CSS 用
    el.style.transform = `translateY(${(1 - p) * 40}px)`;
    el.style.opacity = String(p);                    // 只在必要时写 opacity
  }
}
addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(update); }
}, { passive: true });
addEventListener('resize', update);
update();
```
【关键 API】`IntersectionObserver`、`requestAnimationFrame`、`getBoundingClientRect()`、`passive: true`
【坑】**绝对不要在 `scroll` 回调里直接读写布局**（`getBoundingClientRect` 会强制同步布局，等于每帧抖动）。要读就统一放进 rAF，且同一帧内「先全部读、再全部写」。`passive: true` 必加，否则移动端滚动被阻塞。
【reduced-motion】不注册 scroll 监听，元素直接设终态（`--p: 1`）。

---

【名称】值错峰（stagger 的"值"维度，不只是时间）
【观感】同样一组元素，除了依次出现，每个还有不同的振幅/缩放/随机位移
【实现】Anime.js 的 `stagger([1.1, .75], { grid: [13,13], from: 'center' })` 是"按位置插值出一组值"。
```js
// 原生：用归一化距离做插值
const els = [...document.querySelectorAll('.dot')];
const rects = els.map(el => el.getBoundingClientRect());
const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length;
const cy = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / rects.length;
const dMax = Math.max(...rects.map(r => Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)));

els.forEach((el, i) => {
  const t = dMax ? Math.hypot(rects[i].left + rects[i].width / 2 - cx, rects[i].top + rects[i].height / 2 - cy) / dMax : 0;
  const scale = 1.1 + (0.75 - 1.1) * t;      // 等价 stagger([1.1, .75])
  el.animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }],
             { duration: 500, easing: 'ease-out', fill: 'both' });
});
```
【关键 API】`Array.prototype.map`、`Element.animate()`、CSS 变量
【坑】和 `from: 'center'` 一样依赖 `getBoundingClientRect`，同样只能算一次。
【降级】reduced-motion 下所有元素统一终态，不做值差异。

---

【名称】媒体查询响应式动画（Scope 的替代）
【观感】窄屏时动画方向/幅度自动换一套，而不是被硬裁掉
【实现】
```js
const mqPortrait = matchMedia('(orientation: portrait)');
const mqReduce   = matchMedia('(prefers-reduced-motion: reduce)');

function build() {
  if (mqReduce.matches) return;               // 直接不建动画
  const isPortrait = mqPortrait.matches;
  document.querySelectorAll('.js-circle').forEach((el, i) => {
    el.animate(
      isPortrait
        ? [{ transform: 'translateX(-50px)' }, { transform: 'translateX(50px)' }]
        : [{ transform: 'translateY(-50px)' }, { transform: 'translateY(50px)' }],
      { duration: 800, delay: i * 100, direction: 'alternate', iterations: Infinity }
    );
  });
}
build();
mqPortrait.addEventListener('change', () => location.reload()); // 或先取消旧动画再 build()
```
【关键 API】`window.matchMedia()`、`MediaQueryList.addEventListener('change')`、`Animation.cancel()`
【坑】`matchMedia().addEventListener` 在很老的 Safari 上要写 `addListener`。重建动画前必须 `cancel()` 旧的，否则会叠加两份。改 orientation 会触发 resize，注意别和 resize 节流逻辑打架。
【reduced-motion】`mqReduce.matches` 为真时**不创建任何动画**，这是最省电也最不容易出错的做法。

---

### A2. uiverse.io（社区微交互：真实源码取证）

> 说明：uiverse 详情页是 SPA，**页内 CSS 抓不到**。下面两个组件是**其官方 GitHub 仓库原文**（`Toggle-switches/AbanoubMagdy1_pink-panda-32.html`、`Toggle-switches/Praashoo7_stupid-termite-0.html`），其余为其量最大的通用套路，我按"同类组件的典型实现"给出原生写法，**不编造组件名**。

---

【名称】滚动开关（squishy toggle）
【观感】滑块带过冲地弹到另一端，像被甩过去
【实现】来源组件原文（未改）：
```css
.switch { position: relative; display: inline-block; width: 3.5em; height: 2em; font-size: 17px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; inset: 0; background: #ccc; border-radius: 30px; transition: .4s; cursor: pointer; }
.slider::before {
  content: ""; position: absolute; left: .3em; bottom: .3em;
  width: 1.4em; height: 1.4em; background: #fff; border-radius: 20px;
  transition: .3s cubic-bezier(0, 2.18, .64, .69);   /* ← 过冲全在这条曲线里 */
}
input:checked + .slider { background-color: #3bd826; }
input:focus + .slider { box-shadow: 0 0 1px #3bd826; }
input:checked + .slider::before { transform: translateX(1.5em); }
```
【关键 API】`:checked +` 兄弟选择器、`cubic-bezier` 过冲、`::before`
【坑】用 `opacity: 0` 隐藏原生 input 后**必须**自己画 `:focus`/`:focus-visible` 环，否则键盘用户完全看不到焦点（原组件只给了 1px 阴影，无障碍上偏弱，建议改成 `outline: 2px solid`）。
【改造要点】`transform: translateX()` 而不是动 `left`，保证只走合成层。加：
```css
.switch input:focus-visible + .slider { outline: 2px solid #3bd826; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .slider, .slider::before { transition-duration: .01ms; } }
```

---

【名称】文案切换式开关（ON / OFF 文字轮换）
【观感】开关上直接写着状态文字，切换时文字与颜色一起变
【实现】来源组件原文核心（用 `content` 换文案 + 变背景）：
```css
.slider::before {
  content: "OFF"; display: grid; place-content: center;
  height: 1.6em; width: 3.6em; left: .17em; bottom: .22em;
  border-radius: 20px; background: rgb(255,0,0);
  box-shadow: 0 0 3.7px #000; transition: .4s ease-in-out;
}
.chk:checked + .slider::before { content: "ON"; background: limegreen; box-shadow: inset 0 0 5px #000; }
```
【关键 API】`content` 属性在伪元素上的切换、`transition`
【坑】**`content` 的值不可过渡/动画**（离散属性），所以只有"换字"没有"文字淡入"效果。想要淡入淡出，必须改成两个真实 `<span>` 叠加、用 `opacity` 切换。
【无障碍】`content` 里的文字**不被所有屏幕阅读器可靠朗读**，真实状态必须放在 `<input>` 的 `aria-label` 或关联 `<label>` 文本里。

---

【名称】按钮渐变滑入（background-position 位移动画）
【观感】hover 时颜色像液体一样从一侧推过来
【实现】
```css
.btn {
  background-image: linear-gradient(120deg, #6a5cff 0 50%, #222 50% 100%);
  background-size: 220% 100%;
  background-position: 0% 0;
  transition: background-position .45s cubic-bezier(.22,1,.36,1), color .45s;
  color: #fff;
}
.btn:hover { background-position: 100% 0; }
```
【关键 API】`linear-gradient()`、`background-size`、`background-position`
【坑】动 `background-position` **不属于合成属性**，大按钮上会掉帧。更稳的替代是**伪元素 `transform: scaleX()` 滑入**（走合成层）：
```css
.btn { position: relative; overflow: hidden; z-index: 0; }
.btn::before {
  content: ""; position: absolute; inset: 0; z-index: -1; background: #6a5cff;
  transform: scaleX(0); transform-origin: 0 50%; transition: transform .45s cubic-bezier(.22,1,.36,1);
}
.btn:hover::before { transform: scaleX(1); }
```
【reduced-motion】保留颜色变化，去掉位移（`transition: none`）。

---

【名称】光泽扫过（shine / sweep）
【观感】一道高光斜着扫过按钮表面
【实现】
```css
.shine { position: relative; overflow: hidden; }
.shine::after {
  content: ""; position: absolute; top: 0; left: -120%;
  width: 60%; height: 100%;
  background: linear-gradient(100deg, transparent, rgb(255 255 255 / .45), transparent);
  transform: skewX(-20deg);
  transition: left .6s ease;
  pointer-events: none;
}
.shine:hover::after { left: 130%; }
```
【关键 API】`skewX()`、伪元素、`overflow: hidden`
【坑】动 `left` 会触发布局；生产写法应改成 `transform: translateX(...)`。`pointer-events: none` 必加，否则伪元素会抢走按钮点击。
【替代】纯 CSS 无限循环版用 `@keyframes` + `animation-play-state: paused`，`hover` 时才 `running`——这样默认零开销。

---

【名称】霓虹辉光 / 外发光
【观感】hover 时按钮边缘渗出一圈同色柔光，并有轻微放大
【实现】
```css
.glow { transition: transform .3s ease, box-shadow .3s ease; }
.glow:hover, .glow:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px rgb(106 92 255 / .6), 0 6px 24px rgb(106 92 255 / .45);
}
```
【关键 API】`box-shadow`、`:focus-visible`
【坑】`box-shadow` 动画代价比 `transform`/`opacity` 高（每帧重绘，可能触发 repaint），**按钮数量少没问题，列表里上百个就会卡**。列表场景改用 `filter: drop-shadow()` 或提前铺一层 `opacity: 0` 的伪元素、只动 `opacity`。
【无障碍】`:focus-visible` 和 `:hover` 写在同一规则里，键盘用户才能获得同等反馈。

---

【名称】3D 悬停抬升卡片（透视）
【观感】鼠标移到卡片上方时卡片抬起，朝向光标微微倾斜
【实现】
```css
.card { transition: transform .4s cubic-bezier(.22,1,.36,1), box-shadow .4s; will-change: transform; }
.card-wrap { perspective: 800px; }
.card:hover { transform: translateY(-6px) rotateX(4deg) rotateY(-4deg); box-shadow: 0 24px 48px rgb(0 0 0 / .35); }
```
```js
// 真正跟随光标的 3D 倾斜（用 CSS 变量解耦 JS 与样式）
document.querySelectorAll('.js-tilt').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - .5;    // -0.5 … 0.5
    const py = (e.clientY - r.top) / r.height - .5;
    card.style.setProperty('--rx', (-py * 8).toFixed(2) + 'deg');
    card.style.setProperty('--ry', ( px * 8).toFixed(2) + 'deg');
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
});
```
```css
.js-tilt { transform: perspective(800px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); }
```
【关键 API】`perspective()`、`pointermove` / `pointerleave`、CSS 自定义属性
【坑】`pointermove` 里 `getBoundingClientRect()` 每帧调用 = 强制布局。缓存 rect，或只在 `pointerenter` 时读一次。**触摸设备上 `pointermove` 会在滑动时触发并点开倾斜**，必须用 `@media (hover: hover)` 或 `matchMedia('(hover: hover)')` 包住。
【reduced-motion】关掉倾斜，只留 `translateY`。

---

【名称】骨架 / 加载器（loader）
【观感】旋转环、脉冲点、或渐变扫过的骨架屏
【实现】
```css
/* 旋转环：用 border 缺口 + rotate */
.spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid rgb(255 255 255 / .18);
  border-top-color: #6a5cff;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(1turn); } }

/* 三点脉冲：transform + opacity，纯合成 */
.dots span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor;
  animation: pulse 1.2s ease-in-out infinite; }
.dots span:nth-child(2) { animation-delay: .15s; }
.dots span:nth-child(3) { animation-delay: .3s; }
@keyframes pulse { 0%, 100% { transform: scale(.6); opacity: .4; } 50% { transform: scale(1); opacity: 1; } }
```
```js
// 尊重系统的"减少动效"但保留"加载中"语义
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelector('.dots')?.setAttribute('aria-hidden', 'true');
  document.querySelector('[data-loading-text]')?.removeAttribute('hidden'); // 用文字替代动画
}
```
【关键 API】`animation-iteration-count: infinite`、`aria-busy`、`role="status"`
【坑】无限动画会持续占用 GPU 与电量，**加载结束后一定要移除节点或 `animationPlayState = 'paused'`**，不然后台标签页仍在跑。`<progress>` 类语义优先用原生元素或 `role="status"` + `aria-live="polite"`，不要只靠视觉。
【reduced-motion】无限旋转**必须**降级为静态指示 + 文字，这是规范建议的做法。

---

### A3. wodniack.dev（全部源码取证，含真实数值）

技术栈实测：`astro ^5.7.13` + `gsap ^3.13.0` + `lenis ^1.3.3` + `sass`。**无 WebGL、无 Three.js。**

---

【名称】SVG 长线波浪 + 鼠标弹簧扰动（招牌效果）
【观感】几十条长短不一的线在页面上缓慢呼吸起伏，鼠标划过处线条被"拨动"并带阻尼回弹
【实现】源码结构（`AWaves.astro`，数值原文）：每 10px 一条竖线、每 32px 一个采样点，用 perlin 噪声推动每个点，鼠标影响半径 `l = max(175, mouse.vs)`，弹簧系数 `0.005`、摩擦 `0.925`、强度 `×2`、位移钳制 `±100`。原生最小还原：
```js
// 1) 噪声：用两条正弦叠加近似 perlin（零依赖、够用）
const noise2 = (x, y) =>
  Math.sin(x * 1.7 + Math.cos(y * 1.3) * 2.1) * .6 + Math.sin(x * .7 - y * 1.1) * .4;

// 2) 建点：每行是一组采样点
const svg = document.querySelector('.js-waves');
const NS = 'http://www.w3.org/2000/svg';
const xGap = 10, yGap = 32, W = svg.clientWidth, H = svg.clientHeight;
const paths = [], lines = [];
for (let x = 0; x <= W; x += xGap) {
  const pts = [];
  for (let y = 0; y <= H; y += yGap) pts.push({ x, y, wx: 0, wy: 0, cx: 0, cy: 0, vx: 0, vy: 0 });
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
  svg.appendChild(p); paths.push(p); lines.push(pts);
}

// 3) 鼠标状态：lerp 平滑 + 速度累积（源码 tick() 的同款做法）
const m = { x: -999, y: -999, sx: -999, sy: -999, v: 0, vs: 0, a: 0 };
addEventListener('pointermove', e => {
  const r = svg.getBoundingClientRect();
  m.x = e.clientX - r.left; m.y = e.clientY - r.top;
}, { passive: true });

// 4) 每帧：推进噪声 → 施加鼠标力 → 弹簧回正 → 重拼 d
let time = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(32, now - last) / 1000; last = now; time += dt;
  m.sx += (m.x - m.sx) * .1; m.sy += (m.y - m.sy) * .1;      // 平滑跟随
  m.v = Math.hypot(m.x - (m.px ?? m.x), m.y - (m.py ?? m.y));
  m.vs += (m.v - m.vs) * .1; m.vs = Math.min(100, m.vs);
  m.px = m.x; m.py = m.y;

  lines.forEach((pts, li) => {
    let d = '';
    pts.forEach((p, pi) => {
      const n = noise2((p.x + time * 12.5) * .002, (p.y + time * 5) * .0015) * 12;
      const wx = Math.cos(n) * 32, wy = Math.sin(n) * 16;
      const dx = p.x - m.sx, dy = p.y - m.sy, dist = Math.hypot(dx, dy);
      const l = Math.max(175, m.vs);
      if (dist < l) {
        const s = 1 - dist / l, f = Math.cos(dist * .001) * s;
        p.vx += Math.cos(m.a) * f * l * m.vs * .00065;
        p.vy += Math.sin(m.a) * f * l * m.vs * .00065;
      }
      p.vx += (0 - p.cx) * .005; p.vy += (0 - p.cy) * .005;   // 弹簧张力
      p.vx *= .925; p.vy *= .925;                              // 摩擦
      p.cx = Math.max(-100, Math.min(100, p.cx + p.vx * 2));
      p.cy = Math.max(-100, Math.min(100, p.cy + p.vy * 2));
      d += (pi ? 'L' : 'M') + (p.x + wx + p.cx).toFixed(1) + ' ' + (p.y + wy + p.cy).toFixed(1);
    });
    paths[li].setAttribute('d', d);
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```
【关键 API】`createElementNS`、`setAttribute('d')`、`requestAnimationFrame`、`pointermove`、lerp
【坑】**这是全站最贵的一段代码**（源码里点数是 `(W+200)/10 × (H+30)/32`，1080p 下约 130 行 × 35 点 ≈ 4500 个点/帧，每帧重拼字符串）。它靠三个机制保住性能：① 自定义元素 `data-intersect` + IntersectionObserver，**离开视口就 `Emitter.off('tick')` 停算**；② `setLines()` 只在 resize 时重建；③ 点在屏幕外也能被 `xGap/yGap` 放宽。你复刻时**必须**照做，否则移动端直接卡死。降低成本的旋钮：把 `xGap` 提到 16–24、`yGap` 提到 40–56。

---

【名称】鼠标平滑跟随的"自定义光标"
【观感】一个小圆点以轻微延迟追随指针，而不是死贴
【实现】源码做法原文（`AWaves.astro` 的 `tick()`）：`mouse.sx += (mouse.x - mouse.sx) * 0.1`，然后写 CSS 变量 `--x / --y`，圆点是 `a-waves::before`。
```css
.cursor-dot {
  position: fixed; top: 0; left: 0; width: .5rem; height: .5rem;
  background: currentColor; border-radius: 50%;
  transform: translate3d(calc(var(--x) - 50%), calc(var(--y) - 50%), 0);
  will-change: transform; pointer-events: none; z-index: 99;
}
```
```js
const dot = document.querySelector('.cursor-dot');
let tx = 0, ty = 0, sx = 0, sy = 0, pending = false;
addEventListener('pointermove', e => {
  tx = e.clientX; ty = e.clientY;
  if (!pending) { pending = true; requestAnimationFrame(step); }
}, { passive: true });
function step() {
  pending = false;
  sx += (tx - sx) * .1; sy += (ty - sy) * .1;
  dot.style.setProperty('--x', sx + 'px');
  dot.style.setProperty('--y', sy + 'px');
  if (Math.abs(tx - sx) > .1 || Math.abs(ty - sy) > .1) {
    pending = true; requestAnimationFrame(step);   // 追上后自动停帧，省电
  }
}
```
【关键 API】`pointermove`、CSS 变量、`translate3d`、`will-change`
【坑】① 真的隐藏系统光标（`cursor: none`）会伤可用性——**不要做**（见 B 节）；② 这个点在触摸设备上毫无意义，用 `(hover: hover) and (pointer: fine)` 包住；③ 只在需要时开 rAF（上面写了"追上就停"），否则永远每帧空转。
【reduced-motion】完全禁用，保留系统指针。

---

【名称】滚动进度条 + 可拖拽拇指（自定义滚动条）
【观感】右侧一条细条，长度反映页面进度，还能直接拖拽滚动
【实现】源码算法（`SiteScrollbar.astro`，原文）：
```js
const bar = document.querySelector('.js-thumb');
function paint() {
  const vh = innerHeight;
  const h  = (vh / document.body.scrollHeight) * vh;      // 拇指高度
  const top = (scrollY / (document.body.scrollHeight - vh)) * (vh - h);
  bar.style.setProperty('--scrollbar-height', h + 'px');
  bar.style.setProperty('--scrollbar-top', top + 'px');
}
addEventListener('scroll', paint, { passive: true });
addEventListener('resize', paint);
paint();
```
【关键 API】`scrollTo()`、`scrollHeight`、`passive: true`
【坑】读取 `scrollHeight` 会强制布局，放进 rAF；拖拽拖拽时源码用 `e.preventDefault()` + `{ passive: false }`，注意别把页面正常滚动一起禁掉。它用 `scale` 而非 `transform` 做缩放（`scale: 1 1` + `transform-origin`），这是现代 CSS 独立变换属性，Chrome 104+/Safari 14.1+ 支持，**老浏览器会整条忽略**——需要 `transform` 兜底。
【reduced-motion】保留，滚动条属于功能性控件，不需要降级。

---

【名称】入场遮罩 + logo 线条绘制（intro）
【观感】整屏色块先盖住，logo 的竖条一根根长出来、横向短条再补齐，然后整体拆解消失，露出页面
【实现】源码时间轴（`index.astro` 的 `intro()`，原文数值）：
```js
const tl = [
  { els: vLines, kf: [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], duration: 1000, stagger: 150, easing: 'cubic-bezier(.76,0,.24,1)', at: 0 },
  { els: hLines, kf: [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], duration: 400,  stagger: 0,   easing: 'cubic-bezier(.76,0,.24,1)', at: 1000 },
  { els: vLines, kf: [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], duration: 1000, stagger: 100, easing: 'cubic-bezier(.76,0,1,1)',   at: 2000 },
  { els: hLines, kf: [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], duration: 500,  stagger: 100, easing: 'cubic-bezier(.76,0,1,1)',   at: 2100 }
];
// 用 A1「时间轴编排」里的 timeline() 跑；总时长约 5s，结束点移除遮罩并解锁滚动
```
【关键 API】`transform-origin`（竖条 `50% 0` / 横条各自角点）、`HTML.classList`、`overflow: hidden` 锁滚动
【坑】源码全程操作 `document.documentElement.classList` 的 `is-scroll-blocked`，同时**首屏内容保持 `opacity: 0` 直到 JS 跑到**——这意味着**禁 JS 时页面是全白的**。纯静态中文站若在意 SEO/无 JS 可用性，应改成"默认可见 + JS 首帧加 `.is-intro` 类再隐藏"，并把遮罩总时长压到 1.2–2s（5 秒在内容站上太长）。
【reduced-motion】完全不播，直接移除遮罩。

---

【名称】clip-path 自下而上揭开
【观感】内容像被一块下移的"幕布"从上到下擦出来
【实现】源码原文用的正是 `clipPath: polygon(...)` 四角插值：
```js
content.animate([
  { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' },
  { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }
], { duration: 1000, easing: 'cubic-bezier(.87,0,.13,1)', fill: 'both' });
```
【关键 API】`clip-path: polygon()`（点数相同才能插值）、`Element.animate()`
【坑】`clip-path` 的插值要求**前后 `polygon()` 顶点数量一致**，否则会退化为离散跳变。它是非合成属性，全屏动画会掉帧——**小区域（标题、卡片）用得很好，整屏少用**。`clip-path` 会创建包含块，`position: fixed` 的后代定位基准会被改变（这是它最容易踩的坑）。
【替代】能用 `transform: scaleY()` + `overflow: hidden` 时优先用后者（走合成层）。

---

【名称】逐字上移 / 逐字抖动（文字动效）
【观感】大标题每个字母从下方滑入并精确落位；之后偶发某个字母随机飞走再回来
【实现】源码结构：`SplitText` 拆成 `words,chars`，每个字符外包一层 `.char__inner`，外层 `.char` 用 `clip-path: inset(0 .005em)` 做遮罩，内层用 `translate` 位移。落位动画原文是 `y: '-200%' → '-100%'`、`stagger: 0.02`、`ease: expo.inOut`。
```html
<h1 class="split"><span class="ch"><span class="ch-in">动</span></span>…</h1>
```
```css
.split .ch { display: inline-block; overflow: hidden; clip-path: inset(0 .005em); }
.split .ch-in { display: block; translate: 0 -100%; will-change: translate; }
/* 随机抖动：源码用 4 个方向的 keyframes 类名 to-top/right/bottom/left */
@keyframes move-to-top { to { translate: 0 -200%; } }
.ch.to-top .ch-in { animation: move-to-top 1s cubic-bezier(.86,0,.07,1) forwards; }
@media (prefers-reduced-motion: reduce) { .split .ch-in { translate: none; } .ch { animation: none !important; } }
```
```js
// 落位：不需要 split 库，直接自己包一层（中文按字拆更自然）
document.querySelectorAll('[data-split]').forEach(el => {
  el.innerHTML = [...el.textContent].map(c =>
    `<span class="ch"><span class="ch-in">${c}</span></span>`).join('');
  el.querySelectorAll('.ch-in').forEach((s, i) => {
    s.animate([{ translate: '0 -200%' }, { translate: '0 -100%' }],
      { duration: 900, delay: i * 20, easing: 'cubic-bezier(.87,0,.13,1)', fill: 'both' });
  });
});
// 随机抖动：源码是 Math.random() > 0.01 的极低概率，每帧只挑一个字符
setInterval(() => {
  if (Math.random() > .01) return;
  const chars = document.querySelectorAll('.split .ch');
  const c = chars[Math.floor(Math.random() * chars.length)];
  const dir = ['top','right','bottom','left'][Math.floor(Math.random() * 4)];
  c.classList.add('to-' + dir);
  setTimeout(() => c.classList.remove('to-' + dir), 2000);
}, 16);
```
【关键 API】`translate` 独立属性、`clip-path: inset()`、`Element.animate()`、`Animation.cancel()`
【坑】① 逐字动画会**破坏文本可选中性与屏幕阅读器朗读**——必须给外层 `aria-label` 原文、内层字符加 `aria-hidden="true"`（wodniack 用了 `.u-sr-only` 补全名）。② 拆字后行高/字距会变，源码专门为 Windows/Android/Firefox 写了几条 `top: .1025em / .1015em` 的补偿 hack——**中文站用中文字体时你自己也会遇到基线偏移**，建议用 `line-height: 1` 容器 + `overflow: hidden` 规避而不是抄这套 hack。③ `setInterval(16)` 常驻是浪费，改用 rAF 或直接 `setTimeout` 递归。

---

【名称】二进制解码分隔条（氛围元素）
【观感】一条窄横条里全是 0/1，字符不断随机翻转；另有一段斜线纹理
【实现】源码手法（`ASeparator.astro`）：每个字符是一个 `overflow: hidden` 的盒子，`::before` 内容是 `'01'` 共 2em 高，靠 **`translate: 0 -100%` / `0`** 切换显示 0 还是 1；另有 `.a__stripes::before` 塞了 300+ 个 `/` 字符当纹理。
```css
.bin { display: inline-block; overflow: hidden; color: transparent; position: relative; }
.bin::before {
  content: "01"; position: absolute; inset: 0; height: 2em; width: 100%;
  color: currentColor; will-change: translate; word-break: break-all;
}
.bin--1::before { translate: 0 -100%; }
.bin--blank::before { content: none; }
```
【关键 API】`translate`、`::before` + `content`、`classList` 切换
【坑】`content` 文本不可过渡，靠的是"两块内容上下叠、位移切换"这个技巧。源码用 `text-shadow: 0 0 1px currentColor` 来给斜线纹理"加粗"——一个便宜但有效的糊弄法。**这段动画必须挂在 IntersectionObserver 上**（源码就是 `intersect` 事件开关），否则整页几百个字符每帧 class 变更会持续吃 CPU。

---

【名称】按钮/图标的独立变换 hover（`scale` / `translate` 属性）
【观感】hover 时背景色从左侧"立"起来铺满，图标同时反色
【实现】源码原文（`SiteHead.astro`）：
```css
.sb-icon { background: var(--fg); clip-path: var(--path); position: relative; }
.sb-icon::before {
  content: ""; position: absolute; inset: 0; background: var(--bg);
  scale: 0 1; transform-origin: 0 50%;            /* 用独立 scale 属性 + 原点控制方向 */
  transition: scale .3s cubic-bezier(.87,0,.13,1);
}
a:hover .sb-icon::before { scale: 1 1; }
```
而"扫描线"文字下划线用同一招但换原点实现**方向相反的进出**（源码）：
```css
.link::before { content:""; position:absolute; bottom: calc(50% - .5em); left: 0; width: 100%; height: 1px;
  background: currentColor; scale: 0 1; transform-origin: 100% 50%; transition: scale .3s cubic-bezier(.87,0,.13,1); }
.link:hover::before { scale: 1 1; transform-origin: 0 50%; }   /* 进场从左边、退场回右边 */
```
【关键 API】独立变换属性 `scale`（Chrome 104+ / Safari 14.1+ / Firefox 72+）、`transform-origin`、`clip-path: path()` 做图标形状
【坑】**用 `scale` / `translate` 独立属性时，元素原本的 `transform` 不会与之合并**——两者是叠加的，调试时容易看不懂位置。若需兼容很老的浏览器，改回 `transform: scaleX(0)`。
【无障碍】所有 hover 效果都要同步给 `:focus-visible`。

---

### A4. motionsites.ai（画廊套路：来自其官方 prompt 文本）

它的画廊里收录的东西高度同质。**最有价值的是它的 Academy 里那份真实 prompt 全文**，动画参数都是写死的数字，下面直接引用。常见套路：

---

【名称】滚动擦洗视频背景（scroll-scrubbed video）
【观感】视频不做自动播放，滚动多快它就播多快，像"手摇放映机"
【实现】其 prompt 原文的技术方案（数值照抄）：
```js
// progress = scrollY / (scrollHeight - innerHeight)，钳到 0–1
// 平滑：smoothed += (target - smoothed) * 0.12，每帧 rAF
// 把视频抽成最多 90 帧（或 duration*12，最少 24 帧），最大宽 960px，缓存成 ImageBitmap
// canvas 按 object-cover 数学绘制（scale = max，居中裁剪）；DPR = min(devicePixelRatio, 2)
// 兜底：帧缓存没好时，直接 video.currentTime = smoothed * (duration - 0.05)（delta > 0.04s 才 seek）
```
```js
let smoothed = 0, target = 0;
addEventListener('scroll', () => {
  target = scrollY / Math.max(1, document.body.scrollHeight - innerHeight);
  target = Math.min(1, Math.max(0, target));
}, { passive: true });
(function loop() {
  smoothed += (target - smoothed) * 0.12;     // ← 这个 0.12 是它的原值
  // drawFrame(smoothed) …
  requestAnimationFrame(loop);
})();
```
【关键 API】`<video preload="auto" muted playsinline>`、`createImageBitmap`、`CanvasRenderingContext2D.drawImage`、`requestAnimationFrame`
【坑】① 每次 `currentTime` 赋值都会触发 seek，**连续 seek 在移动 Safari 上极不稳定**，所以它才要帧缓存；② 必须先 `loadeddata` 后再等 300ms 才开始抽帧（原文如此）；③ 首帧用 `<img>` 当 poster 垫着，三者（poster → video → canvas）用 `opacity` 交叉淡入，才不会白屏；④ 它明确要求**中间插入一个 `h-[80vh]` 的空 spacer**，否则滚动距离不够、视频擦不动。
【reduced-motion】直接显示 poster 静态图，不做 scrub。
【价值判断】这套东西**对内容型中文站性价比很低**：要准备视频资产、要抽 90 帧、要处理移动端 seek 兼容，最终只换来一个"背景动了"的效果。**不建议照抄**，除非你就是做视觉展示页。

---

【名称】入场逐块上浮（staggered fade-up）
【观感】每个文字块/UI 块依次从下方 8px 浮上来并淡入，间隔固定
【实现】其 prompt 原文参数（照抄）：IntersectionObserver `threshold: 0.15`；隐藏态 `translateY(32px) + opacity 0`；过渡 `700ms ease-out`；逐元素 `transition-delay`（logo 0 → 导航链接 `100 + i*100` → CTA 500 → hero 徽标 150 → H1 280 → 卡片 420 → 面板 `300 + i*110`）。
```css
.reveal { opacity: 0; transform: translateY(32px); will-change: transform;
          transition: opacity .7s ease-out, transform .7s ease-out; }
.reveal.is-in { opacity: 1; transform: none; }
```
```js
const io = new IntersectionObserver((es) => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
```
```html
<h1 class="reveal" style="transition-delay: 280ms">…</h1>
```
【关键 API】`IntersectionObserver({ threshold: .15 })`、`transition-delay`、`transitionend`
【坑】① `transition-delay` 写在 CSS 里会同时延迟**入场和退场**（如果做双向），要区分得用 `transition-delay: 0s` 覆盖退场态；② 用 `io.unobserve()` 保证只播一次，否则上下滚动会反复闪；③ `threshold: 0.15` 对**比视口还高的长段落**永远达不到——长内容改用 `threshold: 0` + `rootMargin`。
【reduced-motion】用 CSS 媒体查询把 `.reveal` 直接设为终态（`opacity: 1; transform: none; transition: none`）。

---

【名称】毛玻璃面板（glassmorphism）
【观感】半透明面板浮在动态背景上，带模糊与细边框
【实现】其 prompt 的 token 表（原文）：面板 `bg-white/15 backdrop-blur-md`，边框 `border-white/15~25`。
```css
.glass {
  background: rgb(255 255 255 / .15);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);   /* Safari 仍需前缀 */
  border: 1px solid rgb(255 255 255 / .18);
  border-radius: 16px;
}
```
【关键 API】`backdrop-filter`、`color-mix()` 或 `rgb()` 半透明
【坑】**`backdrop-filter` 是全站最贵的属性之一**：它要求对背后内容做实时模糊，多个大面积毛玻璃层叠会显著掉帧，且与 `filter`、`transform` 组合时会出现渲染层级/裁剪 bug。移动端建议把 `blur` 降到 8px 以下，或**在移动端直接换成不带模糊的半透明纯色**。
【reduced-motion】与动效无关，不必降级；但要注意它和 `will-change` 同用会造成内存暴涨。

---

【名称】固定导航 + 大面积玻璃浮层
【观感】导航常驻顶部，内容在其下方滚动，之间有一条细分割线
【实现】其 prompt 原文：`fixed top-0 z-50` + `border-b border-white/15`；内容顶部内边距 `pt-24 sm:pt-28` 让开导航高度。
```css
.nav { position: fixed; inset: 0 0 auto 0; z-index: 50;
       border-bottom: 1px solid rgb(255 255 255 / .15);
       backdrop-filter: blur(12px); }
main { padding-top: 6rem; }   /* 别用 margin，会被外边距合并吃掉 */
```
【关键 API】`position: fixed`、`inset`、`backdrop-filter`
【坑】`position: fixed` 在祖先有 `transform` / `filter` / `clip-path` / `will-change: transform` 时会**降级为相对该祖先定位**——这和 A3 里 `clip-path` 揭开动画的坑是同一个。做整屏 clip-path 动画时，fixed 导航会跟着乱跑，务必把导航放在 clip 容器之外。
【无障碍】固定导航会遮挡锚点跳转目标，需要 `scroll-margin-top`。

---

【名称】3D 场景 / 产品英雄区
【观感】页面主视觉是实时 3D 模型或视频，随滚动旋转/推进
【实现】（motionsites 收录的"Real 3D websites"分类）
【关键 API】`<canvas>` + WebGL2、或 `<model-viewer>` 自定义元素
【坑】**不建议在零依赖内容站上做**：要么引 Three.js（违背零依赖），要么手写 WebGL（成本极高、移动端发热掉电）。见 B 节结论。
【替代】CSS 3D 能做到的：`perspective` + `rotate3d` + 分层视差（`translateZ` 不同深度），零依赖且走合成层。

---

【名称】跑马灯 / 无缝品牌条（marquee）
【观感】一排文字或 logo 匀速横向滚动，首尾无缝
【实现】零 JS 的标准写法（内容复制一份，位移 -50%）：
```css
.marquee { display: flex; overflow: hidden; }
.marquee__track { display: flex; gap: 3rem; flex: none;
                  animation: marquee 24s linear infinite; }
@keyframes marquee { to { transform: translateX(-50%); } }
.marquee:hover .marquee__track,
.marquee:focus-within .marquee__track { animation-play-state: paused; }
```
```html
<div class="marquee"><div class="marquee__track">…内容…<!-- 再复制一份完全相同的 -->…内容…</div></div>
```
【关键 API】`translateX(-50%)`、`animation-play-state`、`gap`
【坑】① 必须复制**完全相同**的一份（`-50%` 才无缝），两份之间不能有额外空白；② `gap` 会算进宽度，两份的总宽必须是偶数份才对齐；③ 无限动画会在后台标签页继续跑——现代浏览器会节流 rAF 但 CSS 动画不一定，最好在 `visibilitychange` 里暂停。
【reduced-motion】**必须**停掉（这是规范里最典型的"无限自动运动"），改为可横向溢出的静态列表（`overflow-x: auto`）。

---

【名称】粘性滚动叙事（sticky scroll storytelling）
【观感】文字区被"钉"住，滚动时内部内容依次替换（数字递增、图层切换）
【实现】
```css
.scrolly { display: grid; grid-template-columns: 1fr 1fr; }
.scrolly__media { position: sticky; top: 0; height: 100svh; }   /* 用 svh 避开移动端地址栏 */
.scrolly__steps > section { min-height: 100svh; display: grid; place-content: center; }
```
【关键 API】`position: sticky`、`100svh`/`100dvh`、`IntersectionObserver` 切换当前 step
【坑】`position: sticky` **只在父容器高度足够时有效**，父级有 `overflow: hidden` / `overflow: auto` 会直接失效（最经典的 sticky 失灵原因）。移动端地址栏伸缩会让 `100vh` 跳动，用 `svh` 或 `dvh`。
【reduced-motion】保留布局，去掉数字滚动动画。

---

【名称】数字滚动递增（counter）
【观感】关键指标从 0 跳到目标值
【实现】
```js
function countUp(el, to, dur = 1200) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);                 // easeOutCubic
    el.textContent = Math.round(to * e).toLocaleString('zh-CN');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```
【关键 API】`requestAnimationFrame`、`performance.now()`、`toLocaleString()`
【坑】每帧写 `textContent` 会触发**文本重排**，数字位数变化时宽度会抖——给容器加 `font-variant-numeric: tabular-nums` 和固定宽度。
【无障碍】滚动数字要包 `aria-hidden="true"`，另给一个 `u-sr-only` 的真实值，否则屏幕阅读器会念出一长串中间数。

---

## B. 每个站"最值得抄的 3 个" + "明确不要抄的"

### animejs.com
**最值得抄的 3 个**
1. **`stagger` 的三层设计**（时间错峰 / 值错峰 / 位置错峰）——这是一套完整的思想，不只是"延迟递增"。用 A1 的 `staggerFromCenter()` 就能拿到 80% 的效果。
2. **`onScroll` 的 `sync` 语义**：源码里 `sync` 可以是 `true`、数字（0–1，越大越"黏"）、`'linear'`、或任意缓动名，本质是**把滚动进度经 lerp 或缓动映射成动画进度**。A1「滚动驱动」那条配方的前半段（IO 管进出场）配这个 lerp 就是完整的 synced scroll。
3. **`createScope` 的媒体查询重绑定**：它把"动画定义"放进一个可 `revert()` 的作用域，媒体查询变了就整体重来。这正是原生写动画最容易忽略的部分（很多人 resize 后就重复注册监听）。用 `matchMedia().addEventListener` + `anim.cancel()` 实现。

**不要抄**
- 不要因为它演示了 `Draggable`（`releaseMass` / `releaseStiffness` / `velocityMultiplier` / `snap`）就去手写拖拽。拖拽的边界、惯性、容器回弹、滚动与拖拽的优先级冲突是**多个星期的工作量**，静态内容站几乎用不到。
- 不要抄它的缓动编辑器 UI（easing-editor 那个可视化曲线工具）——那是工具页的交互，不是内容站的动效。
- 不要抄 `morphTo` 形状变形：原生不可靠（见 A1 SVG 那条的坑），且对中文内容站没有信息价值。

### uiverse.io
**最值得抄的 3 个**
1. **纯 CSS 状态机**：`:checked + .slider`、`:hover .icon::before { scale: 1 1 }` 这套"父/兄选择器 + 伪元素位移"的模式，**零 JS、零依赖、天然支持键盘**，是零依赖站点的核心武器。
2. **`cubic-bezier(.22,1,.36,1)` / `cubic-bezier(0,2.18,.64,.69)` 这类"过冲型"缓动**：一个数字就能做出弹性手感，比写 spring 积分便宜两个数量级。凡是 200ms 内的 UI 反馈，**优先用缓动而不是真物理**。
3. **伪元素做"色块立起"**：`::before { scale: 0 1; transform-origin: 0 50% }` → hover `scale: 1 1`，用来做按钮背景铺满、下划线扫描、图标反色。这套是 uiverse 出现频率最高也最值得学的技巧（wodniack 也用同一招）。

**不要抄**
- 不要抄 **`box-shadow` 多层霓虹/neumorphism（新拟态）堆叠**：视觉上过时，且多层大范围阴影在列表里是性能杀手（每帧重绘）。
- 不要抄**只有视觉、没有键盘状态的交互**：uiverse 绝大多数组件只有 `:hover`，没有 `:focus-visible`、没有 `aria-*`，也不尊重 `prefers-reduced-motion`。它的代码是"素材"不是"产品代码"，**必须自己补无障碍与降级**。
- 不要抄需要**外部图片/字体做贴图**的组件（不少卡片和 loader 依赖作者自备图片），零依赖站上会引入额外请求或版权问题。

### wodniack.dev
**最值得抄的 3 个**
1. **"一个 Emitter + 一个 Ticker + IntersectionObserver"的架构**（`Emitter.js` / `Ticker.js` / `data-intersect`）：所有模块订阅同一个 rAF 节拍、共享同一套 `intersect` 事件；元素**离开视口就把自己的 tick 回调摘掉**。这是让"一个页面同时跑 6 个持续动画"仍然流畅的关键。你的原生版本可以只用 30 行：
   ```js
   const subs = new Set();
   (function loop(t) { subs.forEach(fn => fn(t)); requestAnimationFrame(loop); })();
   // 每个模块：IO 进场 => subs.add(tick)；离场 => subs.delete(tick)
   ```
2. **`clip-path` + `overflow: hidden` + `translate` 的逐字遮罩**（A3 文字动效）：不需要 GSAP SplitText 就能拿到同等效果，且没有依赖。
3. **`scale` / `translate` 独立变换属性 + `transform-origin` 切换**（A3 最后一条）：用最小成本做出"进场从这边、退场回那边"的方向感，这是高级微交互和普通微交互的分界线。

**不要抄**
- 不要抄 **5 秒的 intro 遮罩**：源码里首屏内容 `opacity: 0` 等 JS，**禁 JS = 白屏**，且 5 秒远超内容站的耐心阈值。要抄就砍到 1–2 秒，并改成"默认可见"。
- 不要抄 **perlin 噪声 + 逐帧重拼 `d` 的波浪背景**：它是本仓库最贵的代码（1080p 约 4500 点/帧），且对中文长文阅读是**纯干扰**。
- 不要抄 **按 UA 字符串给 Windows/Android/Firefox 打 baseline 补偿类**（`is-windows` / `is-android` / `is-firefox` + 三套 `top: .10xx em`）：这是脆弱的 hack，浏览器版本一更新就失效。正确做法是让文字容器 `line-height: 1` + `overflow: hidden`，不依赖基线魔数。
- 不要抄**它那套自定义滚动条拖拽逻辑**：功能和系统滚动条重复，还额外引入了 `preventDefault` 与滚动冲突的风险。

### motionsites.ai
**最值得抄的 3 个**
1. **一套固定的 reveal 规范（参数化）**：`threshold: 0.15` + `translateY(32px) → 0` + `opacity 0 → 1` + `700ms ease-out` + 逐元素 `transition-delay`。**它的价值在于"全站统一"而不是参数本身**——统一比炫技更能提升观感。直接把这五个数字定义成 CSS 变量，全站复用。
2. **玻璃材质 token 化**：面板 / 边框 / 文字 / 徽标各一组固定透明度（.10/.15/.18/.25），全站引用同一组变量。这样即使效果朴素，视觉也是一致的。
3. **`scroll-margin-top` + 固定导航 + 锚点**的结构处理，以及**用 spacer 给滚动动画留出距离**这个思路（`h-[80vh]`）：滚动驱动动画最常见的失败原因就是"滚动距离不够"，主动留白是最简解法。

**不要抄**
- 不要抄**滚动擦洗视频背景**（见 A4 那条的价值判断）：资产重、兼容坑多、移动端 seek 不稳，收益与成本严重不匹配。
- 不要抄它推荐的技术栈（`React + TypeScript + Vite + Tailwind + lucide-react`）——那是给 AI coding tool 用的 prompt 前置条件，和你的零依赖约束完全冲突。
- 不要抄它的**提示词式"像素级复刻"**思路：复刻别人的整站会同时抄进对方的可用性与性能问题，且没有你自己的信息结构。

---

### 重点结论：wodniack.dev 那类 WebGL/shader 与平滑滚动，内容型网站值得用吗？

**先纠正前提**：wodniack.dev 的招牌效果**不是 WebGL**（仓库无 Three.js/WebGL 依赖），是 SVG/Canvas + perlin 噪声 + 弹簧阻尼；它**确实用了平滑滚动**（Lenis `^1.3.3`，且与 GSAP ticker 同步：`gsap.ticker.add(time => lenis.raf(time * 1000))` + `gsap.ticker.lagSmoothing(0)`）。

**结论 1：全屏 WebGL / shader 背景 —— 内容型网站不值得用。**
理由：
- **信息上是负收益**：中文内容站的核心是阅读。持续运动的背景会持续和正文争夺注意力，还会降低文字对比度（可读性直接受影响）。
- **成本极高**：零依赖前提下，要么手写 WebGL2（shader、上下文丢失处理、DPR、resize、内存回收），要么就是几百行起步的 SVG/Canvas 逐帧重绘（A3 的波浪就是例证）。
- **可访问性风险**：shader 背景通常无法被 `prefers-reduced-motion` 优雅关闭（一关就露出空白底，观感断裂），也**不能**被屏幕阅读器理解，纯属装饰噪声。
- **移动端代价**：持续 GPU 占用 = 掉帧 + 发热 + 掉电，而移动端恰恰是中文站的主要流量来源。
- **例外**：作品集 / 产品发布页 / 视觉主导的落地页，首屏是一个短生命周期的"视觉锤"时可以接受，但也要限制在一个静态/半静态的画面上，并保证 reduced-motion 下有等价静态图。

**结论 2：平滑滚动（scroll hijack）—— 内容型网站不值得用，且它其实不是"劫持"。**
要区分两件事：
- **Lenis 这类"平滑滚动"**：不用 `preventDefault` 劫持事件，而是**接管 scroll 值并做 lerp**（wodniack 里就是每帧 `lenis.raf()` 驱动）。技术上比"劫持"温和，但代价仍然真实：
  - **与原生滚动行为冲突**：`Ctrl+F` 页内查找、滚动锚点、`scrollIntoView`、`scroll-behavior: smooth`、浏览器的"记忆滚动位置"、地址栏自动隐藏都会变得别扭或被覆盖。
  - **可访问性**：用户设置的"系统级减少动效"和你自定义的惯性无关；对前庭功能敏感者，惯性滚动是常见的诱因。它还经常破坏键盘 `PageDown` / 空格翻页的预期节奏。
  - **它会让"锚点跳转"变成一次动画**（wodniack 就是 `lenis.scrollTo(id, { duration: 1.5, easing: ... })`）——这本身是酷的，但在中文长文站上，用户点目录时想要的是**立刻到达**。
- **真正的"滚动劫持"**（`wheel` 里 `preventDefault`，把滚动重映射成整套全屏分屏叙事）：**明确不要用**。它破坏了浏览器最基本的心智模型，禁用 JS/降级时页面往往不可读，且几乎不可能做到无障碍可用（键盘、屏幕阅读器、缩放都不对）。

**替代方案（保留 70% 观感、0 风险）**：
1. 用 `scroll-behavior: smooth`（一行 CSS，浏览器原生实现，尊重系统设置）。
2. 用 CSS `scroll-timeline` / `view-timeline` 驱动的滚动动画（**注意：目前 Firefox 尚未支持**，见下方兼容表）——好处是它天然跟随真实滚动位置，"同步"是免费的，也不需要 lerp。
3. 需要对滚动位置做 lerp 感时，**只对背景/装饰层做轻微视差**（`translateY` 系数 0.1–0.2），正文层完全不动。观感上很像平滑滚动，但不动用户的滚动语义。

---

## C. 统一技术备忘录

### C1. Web Animations API（`element.animate()`）vs CSS `transition` — 什么时候用哪个

| 场景 | 用哪个 | 原因 |
|---|---|---|
| hover / focus / active 状态反馈 | **CSS transition** | 声明式、`:hover` 天然联动、不需要 JS 监听 `pointerenter/leave`（也就没有"快速掠过时状态错乱"的问题） |
| 入场动画、滚动触发、一次性编排 | **WAAPI** | 可编程 delay/stagger、可 `cancel()`/`reverse()`/`seek()`、`finished` 是 Promise 方便串流程 |
| 需要中途暂停/倒放/调速 | **WAAPI** | `Animation.pause()`、`playbackRate`、`currentTime` 都是原生能力，CSS 只能靠 `animation-play-state` 且不能倒放 |
| 无限循环的装饰动画（旋转、脉冲） | **CSS `@keyframes`** | 写法最省、不占 JS 主线程；也是 reduced-motion 下最好关闭的 |
| 需要和滚动位置绑定 | 两者都可以，但**倾向 CSS `scroll-timeline`**（若有兼容预算）或 WAAPI + `currentTime` 赋值 | `animation.currentTime = progress * duration` 是同步滚动的最干净写法 |
| 大量元素（>100）同款动画 | **CSS**（类切换 + `transition-delay`） | 每个 `animate()` 都创建一个 Animation 对象，几百个会拖慢样式系统 |
| 需要精确拿到"动画结束"再做事 | **WAAPI** | `await el.animate(...).finished`；CSS 得监听 `transitionend`/`animationend`（还要过滤冒泡的子元素事件） |

**共同铁律**
- 只动 **`transform` / `opacity`**（`filter`、`clip-path`、`box-shadow`、`background-position`、`left/top/width/height` 都会触发重绘或布局，只在局部小元素上用）。
- `will-change` **只在动画即将开始前加、结束后移除**；长期挂着会持续占用合成层内存，元素多了直接 OOM。
- WAAPI 用 `fill: 'both'` 后记得收敛：要么 `anim.cancel()` 并把终态写进 CSS 类，要么保留动画对象。**推荐"动画结束 → 加终态类 → `cancel()`"** 这条路，避免幽灵动画干扰后续交互。
- 不要混用同一属性上的 WAAPI 与 CSS transition：WAAPI 动画的优先级高于普通 CSS 声明，但低于 `!important`，调试时非常费解。

### C2. 滚动驱动动画：一条稳妥配方

**核心原则：`scroll` 事件里只做一件事——请求一帧；所有读写都发生在 rAF 里。**

```js
/* 1) 元素注册 */
const targets = [...document.querySelectorAll('[data-anim]')].map(el => ({
  el, inView: false, lastP: -1
}));

/* 2) IO 只负责"进出场"这种离散状态 —— 它不提供进度，别用它做渐变 */
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    const t = targets.find(t => t.el === e.target);
    if (!t) continue;
    t.inView = e.isIntersecting;
    if (!e.isIntersecting) return;
    // 进场：如果元素本身就是"一次性入场"，在这里 add class 后 unobserve
    if (t.el.hasAttribute('data-once')) { t.el.classList.add('is-in'); io.unobserve(t.el); }
  }
}, { threshold: 0, rootMargin: '0px 0px -10% 0px' });   // 负 rootMargin = 提前一点触发
targets.forEach(t => io.observe(t.el));

/* 3) 进度计算：读放一起、写放一起，全在 rAF 内 */
let queued = false;
function frame() {
  queued = false;
  const vh = innerHeight;
  const reads = [], writes = [];
  for (const t of targets) {
    if (!t.inView) continue;
    const r = t.el.getBoundingClientRect();          // 读
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    if (Math.abs(p - t.lastP) < 0.002) continue;      // 变化太小就跳过，省掉一次样式写
    t.lastP = p;
    reads.push([t, p]);
  }
  for (const [t, p] of reads) {                       // 写
    t.el.style.setProperty('--p', p.toFixed(4));
    t.el.style.transform = `translate3d(0, ${((1 - p) * 60).toFixed(2)}px, 0)`;
  }
  void writes;
}
function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

addEventListener('scroll', request, { passive: true });
addEventListener('resize', () => {                     // resize 后缓存/progress 需重算
  targets.forEach(t => t.lastP = -1); request();
});
request();
```

**要点**
- **`passive: true` 必加**：不加的话移动端浏览器要在事件处理完才敢滚，直接卡。
- **不要在滚动回调里写 `will-change`**：那会在滚动过程中反复创建/销毁合成层，比不加还慢。要加就在进入视口前一次性加上。
- **`{ passive: true }` 与 `preventDefault` 互斥**：需要 `preventDefault` 的地方（拖拽滚动条）单独用 `{ passive: false }` 并缩小作用域。
- **优先用 CSS `scroll-timeline`**（Chrome 115+ / Safari 26+，**Firefox 至今未支持**）：不需要任何 JS 就天然同步，写法是 `animation-timeline: view()`。要做**渐进增强**：默认用上面的 JS 版本，用 `@supports (animation-timeline: view())` 覆盖成 CSS 版本。**不要只写 CSS 版本**——Firefox 用户会完全没有滚动动画。
- **进度映射三种常见曲线**：线性 `p`；缓动 `p**2`（后段加速）；带宽限制 `Math.min(1, p*1.5)`（提前走完，后半段保持终态）。选哪个比"到底用不用滚动动画"更影响观感。

### C3. 页面转场：多页静态站怎么做出"离场/入场"而不白屏

按可靠性从高到低给三套，**推荐组合：方案 1 作为保底基线 + 方案 2 做渐进增强**。

**方案 1（保底，必做）：前置遮罩 + 常规跳转**
思路：不在当前页做"离场动画"（做不了——导航会立刻卸载页面），而是**让目标页的"入场"足够快**。
```html
<!-- 每个页面 body 顶部 -->
<div class="page-veil" aria-hidden="true"></div>
<script>
  // 1) 首帧就显示遮罩（脚本在 head 里内联，避免白帧）
  // 2) DOMContentLoaded 后淡出
  addEventListener('DOMContentLoaded', () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelector('.page-veil').remove(); return;
    }
    const v = document.querySelector('.page-veil');
    v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'both' })
     .finished.then(() => { v.style.display = 'none'; });
  });
</script>
```
```css
.page-veil { position: fixed; inset: 0; z-index: 9999; background: var(--bg);
             pointer-events: none; will-change: opacity; }
```
- **关键点**：遮罩必须在 **CSS/内联脚本里默认可见**，不能靠 JS 去加——否则 JS 加载前就是一次白闪。
- 优点：零依赖、全浏览器一致、**无 JS 时只是没有淡入，页面完全可用**。
- 缺点：只有"入场"，没有"离场"。

**"离场"的低成本补法**：拦截站内 `<a>` 点击，播一个 180–260ms 的遮罩淡入，再 `location.href = href`。**必须**做三件事：① 只处理同源、无 `target`、无 `download`、非 `mailto:` 的链接；② 修饰键（Ctrl/Cmd/Shift/Alt）与鼠标中键、`event.defaultPrevented` 一律放行；③ 设一个 400ms 的超时兜底，动画失败也要跳转（否则用户点了没反应）。
```js
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented) return;
  if (a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 直接原生跳转
  e.preventDefault();
  const v = document.querySelector('.page-veil');
  v.style.display = '';
  const go = () => { location.href = a.href; };
  v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-in', fill: 'both' })
   .finished.then(go).catch(go);
  setTimeout(go, 400);                              // 兜底
}, false);
```

**方案 2（渐进增强）：View Transitions API**
- **同文档**（`.astro`/SPA 式内部导航）：`document.startViewTransition(() => swapDOM())` 已可用。
- **跨文档**（真正的多页静态站，就是你的场景）：只需两行——
  ```css
  @view-transition { navigation: auto; }
  ```
  加上页面上 `view-transition-name` 标记，浏览器就会对多页跳转做默认交叉淡入。
- **兼容性（截至 2026-10，实测 web-features 数据）**：View transitions **Newly available since 2025-10-14**，Chrome 111+、Safari 18+、Firefox 144+。**尚未 Widely available**。
- **降级规则**：用 `@supports (view-transition-name: none)` 包裹自定义动画；不支持时自然退回普通跳转 + 方案 1 的遮罩。**跨文档场景下不要用 `pageswap` / `pagereveal` 事件做关键内容**，它们的支持面比 CSS 属性更窄。
- **注意**：`view-transition-name` 必须**在整页唯一**，重复会导致整次转场失败（静默不播）。转场期间页面被截图，`position: fixed` 元素若没有独立的 `view-transition-name` 会跟着一起淡，看起来"整页在动"。

**方案 3（只在需要"真·离场动画 + 无刷新"时）：Navigation API**
- **兼容性（实测）**：Navigation API **Newly available since 2026-01-13**，Chrome 102+、Safari 26.2+、Firefox 147+，预计 2028-07 才 Widely available。**使用率仅约 0.23%**。
- 它给你的能力：`navigation.addEventListener('navigate', e => { e.intercept({ handler: async () => {...} }) })`，可以拿到 `e.destination.url`、`e.canIntercept`、`e.signal`，从而**先播离场动画、再 `fetch` 目标页 HTML、手动替换 DOM**。
- **结论：绝对不要为了转场动画上这条**。它要求你自己实现 HTML 解析、脚本重执行、`history` 同步、滚动恢复、表单状态，等于**自己写一个迷你路由器**——这正是你明确要避免的复杂度。**除非**站点会演化成真正的 SPA，否则方案 3 不进入候选。
- 若将来真要用：`e.intercept()` 的 handler 必须是 `async`，且**必须检查 `e.canIntercept`**，并在 `e.signal` 被 abort 时放弃动画。

**白屏的根因清单（按出现频率）**
1. 遮罩靠 JS 添加 → JS 慢时先白一帧。**改为 CSS 默认可见。**
2. 入场动画用了 `opacity: 0` 的元素，但 `DOMContentLoaded` 之前无样式 → 内容闪一下才隐藏。**把初始隐藏写在 CSS 里，JS 只负责揭示。**
3. 字体 FOIT：自托管中文字体体积大，`font-display: swap` 必加，且**中文站建议只对标题子集化（subset）**，正文用系统字体栈（`system-ui` + `"PingFang SC"` + `"Microsoft YaHei"`）。
4. 转场时改了 `scroll-behavior: smooth`，新页面从旧位置一路滚上去。**跨页跳转时用 `history.scrollRestoration = 'manual'` 并手动 `scrollTo(0,0)`**，或在 `<head>` 里给 `html { scroll-behavior: auto }` 的临时类。
5. 用 `clip-path` 做整屏转场时，`position: fixed` 的导航跟着跑（见 A4 那条坑）。

### C4. 移动端与无障碍

**触摸**
- `pointermove` / `mousemove` 在触摸设备上语义完全不同：手指按下拖动时，浏览器在判断用户意图（滚动 or 操作），你的倾斜/跟随效果会误触发。**所有跟随指针的效果用 `@media (hover: hover) and (pointer: fine)` 或 `matchMedia` 包住**，不要用 UA 判断。
- 触摸目标最小 **44×44 CSS px**（Apple HIG）/ **48×48**（Material）。很多 uiverse 组件的开关只有 2em 高（约 34px），直接抄会不达标。
- 移动端不用 `:hover` 做唯一反馈——触摸设备上 `:hover` 会"粘住"（第一次点击触发 hover，第二次才触发 click）。**用 `:active` 做触摸反馈**，`:hover` 只在 `(hover: hover)` 下生效。
- 移动端地址栏伸缩：用 `svh`/`dvh`/`lvh` 而不是 `vh`；需要跟随的用 `100dvh`（会持续变化导致重排）或 `100svh`（稳定，推荐）。
- 滚动锚定：`overflow-anchor` 默认开启，DOM 在视口上方插入内容时页面会跳动。骨架屏 → 真实内容的替换过程中容易抖，必要时 `overflow-anchor: none` 并保证占位高度一致。

**`prefers-reduced-motion`**
- **它不只是"减少动画"，规范意图是"消除可能引发前庭不适的运动"**：视差、缩放、旋转、大幅位移、无限循环的自动运动最需要关掉；**颜色/透明度变化通常可以保留**。
- 三档处理策略：
  1. **最佳**：动画不创建（JS 里 `matchMedia` 提前返回）。
  2. **可用**：动画保留但位移量减少（`--shift: 0px` 之类的变量在媒体查询里改小）。
  3. **不要用**：`animation-duration: 0.01ms !important` 一刀切——对依赖动画结束事件的逻辑（`animationend`）会变脆弱，且容易闪一帧。
- 一个实用的全局兜底（放在样式表最后）：
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;     /* 关键：停掉无限动画 */
      transition-duration: .01ms !important;
      scroll-behavior: auto !important;            /* 关键：关掉平滑滚动 */
    }
  }
  ```
  这段是**兜底**不是**方案**——核心动效仍应逐条按 1/2 档处理。
- 注意媒体查询变化时**已在跑的 JS 动画不会自动停**，要监听 `matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', ...)` 并 `cancel()`。同时支持系统级开关与站内"关闭动效"按钮时，两者要取"或"（任一要求减少就减少）。

**键盘焦点**
- 视觉上隐藏的 checkbox/radio 保持可聚焦，但**焦点环必须自绘**：`input:focus-visible + .slider { outline: 2px solid; outline-offset: 2px; }`。`:focus-visible`（Chrome 86+/Firefox 85+/Safari 15.4+）能只在键盘操作时显示，避免鼠标点击出现难看的外框。
- **不要用 `outline: none` 而不给替代**。
- 自定义光标效果**不得**妨碍焦点：绝对不要为了做一个光点而设 `cursor: none`，也不要把可聚焦元素埋在 `pointer-events: none` 的层下。键盘 Tab 顺序必须与应用视觉顺序一致——`transform` 位移**不会**改变 Tab 顺序，所以纯靠 `translate` 重排的卡片网格，Tab 顺序仍是 DOM 顺序，需保证两者一致。
- 拖拽类交互（滚动条拇指）必须有键盘替代：`role="scrollbar"` + `aria-controls` + `aria-valuenow/valuemin/valuemax` + 方向键处理。做不到就别做自定义滚动条。
- `scroll-margin-top` 给所有锚点目标加固定导航的高度，否则跳转后标题被导航盖住。

**屏幕阅读器**
- 纯装饰动画容器（波浪背景、跑马灯、二进制条、光标点）一律 `aria-hidden="true"`，并且不要在里面放有语义的内容。
- **逐字拆分的标题必须补语义**（wodniack 用 `.u-sr-only` 的写法是对的）：
  ```html
  <h1 class="split" aria-label="动效复刻技术清单">
    <span aria-hidden="true">动</span><span aria-hidden="true">效</span>…
  </h1>
  ```
- 可变区域（加载状态、实时数字）用 `aria-live="polite"` + `role="status"`；**但要注意**：每帧写 `textContent` 的数字滚动会被读屏**反复朗读**，必须把动画层 `aria-hidden` 掉，只在结束时更新一个 `aria-live` 的真实值。
- 无限动画在 `prefers-reduced-motion` 下关闭是**无障碍要求**，不是"可选优化"（WCAG 2.2.2 Pause, Stop, Hide：超过 5 秒的自动运动必须有暂停机制；2.3.3 Animation from Interactions 要求交互触发的大幅运动可关闭）。
- 跑马灯、自动轮播：要提供暂停按钮或 `hover/focus` 暂停（上面的 `animation-play-state: paused` 已覆盖 focus）。

**其他易漏项**
- `:target` / `:focus-within` 可用来做"纯 CSS 的状态驱动动效"，比 JS 更稳。
- 深色模式：如果做主题切换动画，用 `color-mix()` 过渡或双层面板交叉淡入，避免逐属性动画（`background-color` 动画会重绘整块区域）。
- 打印样式：`@media print` 里把所有动画元素恢复终态（`animation: none; opacity: 1; transform: none`），否则打印出来是一片空白。

---

## 附录：API 与兼容速查（2026-10 实测数据）

| 特性 | 支持情况 | 结论 |
|---|---|---|
| `Element.animate()` / WAAPI | 全现代浏览器 | **主力**，可放心用 |
| `IntersectionObserver` | 全现代浏览器 | **主力** |
| `prefers-reduced-motion` | 全现代浏览器 | **必做** |
| `linear()` 缓动函数 | Chrome 113+ / Firefox 112+ / Safari 17.2+ | 可用于 spring 手感，需 `cubic-bezier` 兜底 |
| CSS `scroll-timeline` / `view()` / `animation-timeline` | Chrome 115+ / Edge 115+ / **Safari 26+** / **Firefox 未支持**（阻塞自 2025-09） | **只能做渐进增强**，JS 版必须有 |
| View Transitions（含跨文档 `@view-transition`） | Chrome 111+ / Safari 18+ / Firefox 144+；Newly available 2025-10-14 | 可做增强，`@supports` 包裹，保留遮罩兜底 |
| Navigation API | Chrome 102+ / Safari 26.2+ / Firefox 147+；Newly available 2026-01-13；使用率 ~0.23% | **不建议用于转场** |
| `backdrop-filter` | 全现代浏览器（Safari 需 `-webkit-` 前缀） | 可用，但控制面积与 blur 半径 |
| 独立变换属性 `scale` / `translate` / `rotate` | Chrome 104+ / Safari 14.1+ / Firefox 72+ | 可用；与 `transform` 是**叠加**关系，注意调试 |
| `pathLength` 属性 + `stroke-dasharray` | 全现代浏览器 | SVG 描边的标准做法 |
| `offset-path: path()` | 全现代浏览器 | 沿路径运动首选，注意坐标系 |
| `getPointAtLength()` | 全现代浏览器 | 每帧调用会反复布局，需缓存采样 |

**数据来源**：[web-features explorer — Navigation API](https://web-platform-dx.github.io/web-features-explorer/features/navigation/)、[View transitions](https://web-platform-dx.github.io/web-features-explorer/features/view-transitions/)、[Scroll-driven animations](https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/)；anime.js 源码 [juliangarnier/anime](https://github.com/juliangarnier/anime)；wodniack.dev 源码 [AntoineW/AW-2025-Portfolio](https://github.com/AntoineW/AW-2025-Portfolio)；uiverse 组件源码 [uiverse-io/galaxy](https://github.com/uiverse-io/galaxy)；motionsites 动效参数来自其 [Academy 教程](https://motionsites.ai/lesson/build-scroll-animated-website-with-ai)。

---

## 落地优先级建议（如果你只能做 5 件事）

1. **全站统一的 reveal 规范**（C 节 B4 第一名的参数化方案），加上 `prefers-reduced-motion` 三档处理 —— 投入产出比最高。
2. **C2 的滚动驱动配方**（IO 管进出场 + rAF 管进度，读写分离）—— 一次写对，后面所有滚动效果都靠它。
3. **uiverse 的伪元素 `scale` 铺满技巧**，用在按钮、导航、图标上（零 JS、天然键盘可用，只要补 `:focus-visible`）。
4. **方案 1 的遮罩入场**（CSS 默认可见 + JS 淡出）—— 200 行内解决"页面不白闪"，且无 JS 也能用。
5. **`@media (hover: hover)` 隔离所有指针跟随效果** —— 这是移动端体验最常见的翻车点。

**明确先不做**：整屏 WebGL、滚动劫持/平滑滚动、滚动擦洗视频、拖拽、路径 morph。
