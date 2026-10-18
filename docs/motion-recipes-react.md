# ReactBits × Aceternity：原生 CSS/JS 复刻技术清单

> 目标环境：纯静态 HTML + 一个 Markdown→HTML 的 Node 脚本。无 npm、无 React、无构建工具。
> 全篇只讲**原生 CSS 属性 + 浏览器 API**。定位原则：**能不 JS 就不 JS；必须 JS 时，JS 只负责写 CSS 变量、切 DOM、加类名，动画一律交给 CSS 合成属性。**
> 代码块用 `// ---- JS ----` 与 `/* ---- CSS ---- */` 作分区标记，标记**下方**就是该语言；以 `<` 开头的行是 HTML 结构示意（顺序按效果需要排列，不固定）。

---

## 0. 抓取状态与清单依据

| 站点 | 抓取结果 |
|---|---|
| [reactbits.dev](https://reactbits.dev/) | **成功**。目录全量抓到：[Text Animations](https://reactbits.dev/c/text-animations) 32 项、[Animations](https://reactbits.dev/c/animations) 41 项、[Components](https://reactbits.dev/c/components) 49 项、[Backgrounds](https://reactbits.dev/c/backgrounds) 66 项、[Micro Interactions](https://reactbits.dev/c/micro) 36 项。 |
| [ui.aceternity.com](https://ui.aceternity.com/) | 组件详情页正文被超长导航截断，改用官方 [llms.txt](https://ui.aceternity.com/llms.txt) 的全量组件目录（113 组件 / 181 Blocks）作为名称依据。 |

两个直接影响你决策的判断：

1. **ReactBits 当前版本已大规模转向 WebGL/shader。** Backgrounds 的 66 项里绝大多数（Ferrofluid、Balatro、Liquid Chrome、Hyperspeed、Molten Metal、Prism、Silk…）是片元着色器，**零依赖静态站不要抄**。真正能抄的是 Text Animations / Animations / Components 里的 DOM 与 CSS 部分——本清单重点在这。
2. **Aceternity 的效果大多是「SVG path + framer-motion」或「canvas + 少量状态」。** SVG 部分可以几乎原样搬进静态页（`<path>` + CSS `offset-path` 或 `<animateMotion>`）；`useMotionValue/useSpring` 用 **CSS 变量 + rAF + transition** 替代；`whileInView` 用 `IntersectionObserver` 替代。

两站共有的规律：**90% 的「高级观感」来自 5 个原语** ——

- CSS 变量驱动的 `radial-gradient` 高光（`--mx/--my`）
- `perspective` + `rotateX/rotateY` + `translateZ` 分层
- `transition-delay: calc(var(--i) * Nms)` 错峰
- `clip-path` / `mask-image` 揭示
- `mix-blend-mode` 叠加

C-1 把这 5 个原语抽成可复用配方，A 节每条效果都是它们的组合。C-3 是踩坑清单，**动手前先读 C-3 第 8 条（no-js 兜底）**。

---

# A. 效果清单

每条给出【观感】【实现】【关键 API】【坑】+ 一段最小示例。版本号只是量级判断，**请以 caniuse 为准**；标「不确定」的地方我确实没验证。

## A1. ReactBits（11 条）

### 1【Split Text 逐字错峰入场】文字动效
**来源**：`/text-animations/split-text`（`Blur Text`、`Scroll Reveal`、`Scroll Float` 是同机制变体）

**观感**：标题的字符从下方 0.4em 处带轻微模糊上浮，逐个出现。

**实现**
- JS：读原文存 `aria-label` → 清空 → 按 **Unicode 码点**切分（`[...str]`，别用 `split('')`）→ 每字包 `<span>`，索引写进 `--i` → `IntersectionObserver` 加根类名。
- CSS：`opacity 0→1`、`translateY(.4em)→0`、`blur(8px)→0`，`transition-delay: calc(var(--i) * 40ms)`。

**关键 API**：`IntersectionObserver`、`style.setProperty`、`[...str]` 码点展开、`transition-delay`

**坑**
- 切字破坏朗读顺序 → 原文放 `aria-label`，碎片 `aria-hidden="true"`。
- 中文按「字」切自然；英文应按「词」切（`Intl.Segmenter`，Chrome 87+/Safari 14.1+/Firefox 125+），否则丢失换行机会，长标题溢出。
- 每个字符 + `filter: blur` = 一个合成层，**超过约 200 个 span 明显掉帧** → 长正文禁用。
- 延迟必须走 CSS 变量 + `calc()`，不要在 JS 里拼 `transitionDelay` 字符串。

```
<h1 class="split" aria-label="原生动画组件">原生动画组件</h1>
// ---- JS ----
document.querySelectorAll('.split').forEach(el => {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', i);
    s.textContent = (ch === ' ') ? '\u00A0' : ch;
    el.append(s);
  });
  new IntersectionObserver(([e], ob) => {
    if (e.isIntersecting) { el.classList.add('is-in'); ob.disconnect(); }
  }, { threshold: .35 }).observe(el);
});
/* ---- CSS ---- */
.split .ch{display:inline-block;opacity:0;transform:translateY(.4em);filter:blur(8px);
  transition:opacity .6s,transform .6s,filter .6s;transition-delay:calc(var(--i)*40ms)}
.split.is-in .ch{opacity:1;transform:none;filter:blur(0)}
@media (prefers-reduced-motion:reduce){.split .ch{opacity:1;transform:none;filter:none;transition:none}}
```

### 2【Shuffle / Decrypted Text 乱码收敛】文字动效
**来源**：`/text-animations/shuffle`、`/text-animations/decrypted-text`；Aceternity `Encrypted Text` 同源
**观感**：字符先显示为随机符号，从左到右逐个「定格」成真实文字。
**实现**：与 A1-1 同一套「索引 + 错峰」思路，只是被推迟的字符先显示为随机符号：
`el.textContent = src.map((c,i) => (i < done || c === ' ') ? c : glyphs[(Math.random()*glyphs.length)|0]).join('')`；
用 `requestAnimationFrame` 推进 `done`，**每 4 帧才定格 1 个字符**（不是每帧），结束时 `cancelAnimationFrame` 并返回一个取消函数。只写 `textContent`，绝不用 `innerHTML`。
**关键 API**：`requestAnimationFrame`、`cancelAnimationFrame`、`textContent`、`font-variant-numeric: tabular-nums`
**坑**：① 每帧改文本会触发布局 → 降到每 4 帧一次，且只用于 ≤20 字的标题；② 容器 `aria-label` 存原文、乱码层 `aria-hidden="true"`；③ 字符宽度不一致会让整行抖动 → `tabular-nums` 或等宽字体 + `min-width: <n>ch`；④ `prefers-reduced-motion` 时直接输出最终文本，不要「快速播一遍」。

### 3【Text Type 打字机】文字动效
**来源**：`/text-animations/text-type`；Aceternity `Typewriter Effect`

**观感**：字符按节奏出现，末尾竖线闪烁。

**实现**：**不要**用 `width` + `overflow:hidden` + `steps()`（只能等宽、不换行、会切坏中文）。用 JS 切片 `text.slice(0, n)`，`setTimeout` 递归（每步间隔可随机抖动，更像真人）；光标用伪元素 + `@keyframes` 做 `opacity` 呼吸。想更省，长文改用 `clip-path: inset(0 100% 0 0)` 揭示——纯合成层。

**关键 API**：`setTimeout` 递归、`textContent`、`clip-path: inset()`

**坑**
- 打字机让用户「等内容出现」，**首屏正文绝不能用**，只做标题/标签。
- 光标别用 `border-right`（改变行宽触发重排）→ `::after { display:inline-block; width:.08em; height:1em }`。
- 必须给屏幕阅读器完整文本：容器 `aria-label`，或旁置 `.sr-only`。
- `prefers-reduced-motion` 时一次性渲染全文。

```
<h2 class="type" data-text="零依赖，一样能发光"></h2>
// ---- JS ----
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.type').forEach(el => {
  const full = el.dataset.text;
  el.setAttribute('aria-label', full);
  if (reduce.matches) { el.textContent = full; return; }
  el.setAttribute('aria-hidden', 'true');
  let i = 0;
  (function step() {
    el.textContent = full.slice(0, ++i);
    if (i < full.length) setTimeout(step, 45 + Math.random() * 55);
    else el.classList.add('is-done');
  })();
});
/* ---- CSS ---- */
.type::after{content:"";display:inline-block;width:.08em;height:1em;background:currentColor;
  margin-left:.08em;vertical-align:-.12em;animation:blink 1s steps(1,end) infinite}
.type.is-done::after{animation:blink 1s steps(1,end) 4 forwards;opacity:0}
@keyframes blink{50%{opacity:0}}
```

### 4【Aurora 极光背景】背景与氛围
**来源**：`/backgrounds/aurora`、`/backgrounds/soft-aurora`（WebGL 版）；Aceternity `Aurora Background`

**观感**：顶部一片柔和彩光缓慢流动、呼吸。

**实现**：ReactBits 是 3D Perlin 噪声着色器（**抄不了**）。Aceternity 版本质是「渐变层 + 大模糊 + 位移」，静态站用后者：一个绝对定位的**小尺寸**元素（如 600×600 再 `scale(2)`），`background: conic-gradient(...)`，`filter: blur(60px)`，`@keyframes` **只动 `transform: translate3d`**；上面盖一层页面底色的渐变遮罩吃掉硬边。

**关键 API**：`conic-gradient()`、`repeating-linear-gradient()`、`filter: blur()`、`transform: translate3d()`

**坑**
- **大面积 `filter: blur` 是移动端头号杀手**：1440×600 区域每帧重绘。解法：小元素 + `scale()`，或预渲染低分辨率 WebP，或用 `radial-gradient` 直接画柔边。**动画只跑 `transform`，绝不动 `blur()` 半径。**
- `filter` 会创建包含块 → 后代 `position: fixed` 失效；也会拍平 3D。
- 不要写 `will-change: filter`（常驻显存）。
- 必须 `@media (prefers-reduced-motion: reduce){ animation: none }`，并保证静态帧也好看。
- 极光层一律 `pointer-events: none`，内容层 `position: relative; z-index: 1`。

```
<div class="aura" aria-hidden="true"></div>
/* ---- CSS ---- */
.aura{position:absolute;inset:-20% -10% auto;height:60vh;pointer-events:none;z-index:-1;
  background:conic-gradient(from 200deg at 50% 0%,
    oklch(70% .18 300/.55), oklch(75% .15 200/.5), oklch(80% .14 120/.35), transparent 70%);
  filter:blur(60px);transform:translate3d(0,0,0);
  animation:drift 22s ease-in-out infinite alternate;will-change:transform}
@keyframes drift{
  from{transform:translate3d(-6%,-2%,0) rotate(-4deg) scale(1.05)}
  to  {transform:translate3d(6%,3%,0) rotate(5deg) scale(1.15)}}
@media (prefers-reduced-motion:reduce){.aura{animation:none}}
```

### 5【Dot Grid / Ripple Grid 点阵网格】背景与氛围
**来源**：`/backgrounds/dot-grid`、`/backgrounds/ripple-grid`；Aceternity `Grid and Dot Backgrounds`、`Background Ripple Effect`、`Dotted Glow Background`

**观感**：细密圆点铺满，光标附近亮起；配 `mask` 时中心聚焦、边缘淡出。

**实现**
- **纯 CSS 静态网格**（首选）：`background-image: radial-gradient(circle, rgba(255,255,255,.16) 1px, transparent 1px)` + `background-size: 24px 24px`。
- **中心聚焦**：`mask-image: radial-gradient(circle at 50% 30%, #000 25%, transparent 75%)`——Aceternity 的 dots-masked 就是这个。
- **光标反应**：容器 `pointermove` 写 `--mx/--my`（rAF 合帧），叠一层 `radial-gradient` 高光层。

**关键 API**：`radial-gradient()`、`mask-image`（配 `-webkit-mask-image`）、`pointermove`、`getBoundingClientRect`（**只在 enter/resize 调**）

**坑**
- ReactBits 的 Dot Grid 是 WebGL 弹簧点阵，**别用几百个 DOM 点模拟**。
- `pointermove` 里调 `getBoundingClientRect()` = 每帧强制同步布局（layout thrashing）→ 缓存矩形，`scroll`/`resize`/`pointerenter` 时刷新。
- 触摸端没有 hover → 效果只能是装饰，不能承载信息。
- `background-attachment: fixed` 会严重掉帧，别用。

```
/* ---- CSS ---- */
.dotgrid{position:relative;isolation:isolate;
  background-image:radial-gradient(circle,rgba(255,255,255,.16) 1px,transparent 1px);
  background-size:24px 24px;
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 25%,transparent 75%);
  mask-image:radial-gradient(circle at 50% 30%,#000 25%,transparent 75%)}
.dotglow{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s;
  background:radial-gradient(circle 220px at var(--mx,50%) var(--my,50%),
             rgba(99,102,241,.28),transparent 70%)}
.dotgrid:hover .dotglow{opacity:1}
// ---- JS ----
const grid = document.querySelector('.dotgrid');
let rect = grid.getBoundingClientRect(), queued = false, mx = 0, my = 0;
const flush = () => { queued = false;
  grid.style.setProperty('--mx', mx + 'px');
  grid.style.setProperty('--my', my + 'px'); };
grid.addEventListener('pointerenter', () => rect = grid.getBoundingClientRect(), {passive:true});
grid.addEventListener('pointermove', e => {
  mx = e.clientX - rect.left; my = e.clientY - rect.top;
  if (!queued) { queued = true; requestAnimationFrame(flush); }
}, {passive:true});
addEventListener('resize', () => rect = grid.getBoundingClientRect(), {passive:true});
```

### 6【Spotlight Card 光标跟随高光】卡片与容器
**来源**：`/components/spotlight-card`、`/components/border-glow`；Aceternity `Card Spotlight`、`Glowing Effect`、`Hover Border Gradient`
（ReactBits `Star Border` 与 Aceternity `Moving Border` 的「沿边框走光」是同一机制，见 A2-7）

**观感**：卡片上有一团柔光跟着鼠标，靠近边缘时边框更亮。

**实现**：见 **C-1 配方 1**。核心是「坐标 → CSS 变量 → `radial-gradient` 引用变量 → `pointerleave` 平滑归零」。

**关键 API**：`pointermove` / `pointerleave`、`requestAnimationFrame`、`style.setProperty`

**坑**
- 用 `pointermove` 而非 `mousemove`（统一鼠标/笔/触控）。
- 高光层必须 `pointer-events: none`，否则会互相抢事件。
- 更新变量用 `el.style.setProperty('--mx', x+'px')`；**不要拼 `style.cssText`**，会清掉其它内联样式。
- 卡片要 `isolation: isolate`，否则 `mask` / `mix-blend-mode` 会串到全页。

```
<article class="glowcard"><h3>标题</h3><p>正文…</p></article>
/* ---- CSS ---- */
.glowcard{position:relative;isolation:isolate;--mx:50%;--my:0%;
  background:radial-gradient(320px circle at var(--mx) var(--my),rgba(120,140,255,.16),transparent 65%),#12131a;
  border:1px solid #23242e;transition:border-color .25s}
.glowcard::after{content:"";position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;
  background:radial-gradient(200px circle at var(--mx) var(--my),rgba(140,160,255,.5),transparent 60%);
  opacity:0;transition:opacity .25s;padding:1px;
  -webkit-mask:linear-gradient(#000,#000) content-box,linear-gradient(#000,#000);
  -webkit-mask-composite:xor;mask-composite:exclude}
.glowcard:hover::after{opacity:1}
// ---- JS ----
document.querySelectorAll('.glowcard').forEach(card => {
  let rect = card.getBoundingClientRect(), queued = false, x = 0, y = 0;
  card.addEventListener('pointerenter', () => { rect = card.getBoundingClientRect(); }, {passive:true});
  card.addEventListener('pointermove', e => {
    x = e.clientX - rect.left; y = e.clientY - rect.top;
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px'); });
  }, {passive:true});
});

@media (prefers-reduced-motion:reduce){.glowcard::after{display:none}}
```

### 7【Tilted Card 3D 倾斜 + 眩光】卡片与容器
**来源**：`/components/tilted-card`、`/components/profile-card`、`/components/holo-card`；Aceternity `3D Card Effect`、`Comet Card`、`Wobble Card`、`Glare Card`（**Aceternity 的 3D Card Effect 与本条完全同源**，区别只是卡片内部有多层 `translateZ`）

**观感**：卡片随指针绕 X/Y 轴倾斜，内部元素有视差分层，表面一道眩光划过。

**实现**：外层 `perspective: 900px`，内层 `transform: rotateX(var(--rx)) rotateY(var(--ry))`，角度由相对坐标映射（典型 ±10°）；内层 `transform-style: preserve-3d`，近/远元素分别 `translateZ(24px)` / `translateZ(-16px)`；眩光层用 `linear-gradient(115deg, transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%)` + `background-position` 跟随。

**关键 API**：`perspective`、`transform-style: preserve-3d`、`rotateX/rotateY`、`translateZ`、`backface-visibility`

**坑**
- `perspective` 必须写在没有被 transform 的父级上，写在自身无效。
- **`filter`、`overflow: hidden`、`backdrop-filter` 都会拍平 3D 上下文** → 这是「照抄不生效」的头号原因。圆角裁剪要放在**内层每个图层**上。
- `will-change: transform` 只在 hover 期间加（`pointerenter` 加、`pointerleave` 删）。
- 触摸端 `:hover` 会「粘住」→ 用 `@media (hover: hover) and (pointer: fine)` 包住。
- 键盘用户感知不到倾斜 → 信息不能只放在倾斜/眩光里。

```
<div class="tilt"><div class="tilt-inner">
  <img class="z" style="--z:70px" src="cover.webp" alt="">
  <h3 class="z" style="--z:90px">标题浮起来</h3>
  <div class="glare" aria-hidden="true"></div>
</div></div>
/* ---- CSS ---- */
.tilt{perspective:900px}
.tilt-inner{position:relative;transform-style:preserve-3d;
  transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
  transition:transform .35s cubic-bezier(.22,1,.36,1)}
.z{transform:translateZ(var(--z,0px));border-radius:16px}
.glare{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;
  background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);
  background-size:250% 100%;background-position:var(--gx,50%) 0}
.tilt:hover .glare{opacity:1}
// ---- JS ----
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.tilt').forEach(box => {
    const inner = box.querySelector('.tilt-inner'), MAX = 10;
    box.addEventListener('pointermove', e => {
      const r = box.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      inner.style.setProperty('--rx', (-py * 2 * MAX).toFixed(2) + 'deg');
      inner.style.setProperty('--ry', ( px * 2 * MAX).toFixed(2) + 'deg');
      inner.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%');
    }, {passive:true});
    box.addEventListener('pointerleave', () => {
      inner.style.setProperty('--rx','0deg'); inner.style.setProperty('--ry','0deg');
    });
  });
}
@media (prefers-reduced-motion:reduce){.tilt-inner{transform:none}.glare{display:none}}
```

### 8【Magnet 磁吸】光标与指针
**来源**：`/animations/magnet`；Aceternity `Magnetic Button`

**观感**：元素朝光标轻微位移，离开后带过冲地弹回。

**实现**：`pointermove` 算「元素中心 → 指针」向量乘以系数（0.2–0.35），写 `--tx/--ty`；`transform: translate3d(var(--tx), var(--ty), 0)`；`pointerleave` 归零。回弹用 `transition: transform .4s cubic-bezier(.34,1.56,.64,1)`，或用 `linear()` 自定义弹簧。

**关键 API**：`pointermove`/`pointerleave`、缓存的 `getBoundingClientRect()`、CSS 变量、`cubic-bezier()` / `linear()`

**坑**
- **位移别超过 12–20px**：视觉位置与命中区域不一致会让用户点不中（transform 会影响 hit-testing）。
- 在 `pointermove` 里调 `getBoundingClientRect()` 是最常见的性能 bug → 缓存，`scroll` 时失效。
- 触摸端 `matchMedia('(hover: hover)')` 跳过。
- 磁吸元素外面要留**原尺寸占位容器**，否则布局会跟着抖。

```
// ---- JS ----
const canHover = matchMedia('(hover: hover) and (pointer: fine)');
const reduced  = matchMedia('(prefers-reduced-motion: reduce)');
if (canHover.matches && !reduced.matches) {
  document.querySelectorAll('[data-magnet]').forEach(el => {
    const PULL = 0.3, MAX = 16;
    let rect = null;
    const reset = () => { el.style.setProperty('--tx','0px'); el.style.setProperty('--ty','0px'); };
    el.addEventListener('pointerenter', () => rect = el.getBoundingClientRect(), {passive:true});
    el.addEventListener('pointermove', e => {
      if (!rect) rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const clamp = v => Math.max(-MAX, Math.min(MAX, v * PULL));
      el.style.setProperty('--tx', clamp(dx).toFixed(1) + 'px');
      el.style.setProperty('--ty', clamp(dy).toFixed(1) + 'px');
    }, {passive:true});
    el.addEventListener('pointerleave', reset);
    addEventListener('scroll', () => rect = null, {passive:true});
  });
}
/* ---- CSS ---- */
[data-magnet]{transform:translate3d(var(--tx,0),var(--ty,0),0);
  transition:transform .4s cubic-bezier(.34,1.56,.64,1)}
@media (prefers-reduced-motion:reduce){[data-magnet]{transform:none;transition:none}}
```

### 9【Animated Content 滚动入场包装器】滚动驱动
**来源**：`/animations/animated-content`、`/animations/fade-content`

**观感**：内容滚入视口时淡入并轻微上移，可带子元素错峰。

**实现**：一个通用包装器。`IntersectionObserver` 加 `.is-in`；方向由 `data-dir` 选；子元素错峰复用 `--i`。**这是全站性价比最高的 20 行。**

**关键 API**：`IntersectionObserver`（`rootMargin: '0px 0px -12% 0px'`）、`threshold`、`unobserve()`

**坑**
- `rootMargin` 用负值让「进入视口 12% 后」才触发，避免内容已经滚过去才播。
- 触发后立刻 `unobserve()`，否则来回滚动会反复播。
- **首屏元素不要挂**（会白闪）；或 DOM 就绪时同步补 `.is-in`。
- 绝不要在 `scroll` 事件里读 `getBoundingClientRect()`——ReactBits 的 `Scroll Float`/`Scroll Velocity` 是那么干的。改成 IO，或在 rAF 里**先批量读、后批量写**。
- **不确定**：`filter: blur()` 在 transition 中与 `transform` 并存时，部分低端 Android WebView 会掉帧，优先只动 `opacity + transform`。

```
<div class="reveal" data-dir="up"><h2>小标题</h2><p>正文…</p></div>
// ---- JS ----
const io = new IntersectionObserver((entries, ob) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    ob.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.setProperty('--i', i % 6);
  io.observe(el);
});
/* ---- CSS ---- */
.reveal{opacity:0;transform:translate3d(0,18px,0);
  transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);
  transition-delay:calc(var(--i,0) * 70ms)}
.reveal[data-dir="left"]{transform:translate3d(-24px,0,0)}
.reveal.is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
```

### 10【Count Up 数字滚动】加载与状态
**来源**：`/text-animations/count-up`、`/components/counter`

**观感**：数字从 0 快速滚到目标值，到点停住。

**实现**：`IntersectionObserver` 触发后，用 rAF + 缓出函数推进，`Intl.NumberFormat` 负责千分位/货币/小数。**别用 `setInterval(…, 16)`**，会和渲染不同步。

**关键 API**：`requestAnimationFrame`、`performance.now()`、`Intl.NumberFormat`、`IntersectionObserver`

**坑**
- 数字变化会让容器宽度抖动 → `font-variant-numeric: tabular-nums` + `min-width: <n>ch`。
- **无障碍**：动画期间数字会被读屏反复朗读 → 可视数字 `aria-hidden="true"`，另放 `.sr-only` 写最终值。
- `prefers-reduced-motion` 时直接写入最终值。
- `Intl.NumberFormat` 实例先建好，别在 rAF 循环里 new。

```
<p class="count" data-to="12480"><span class="count-num" aria-hidden="true">0</span>
  <span class="sr-only">12,480</span> 次构建</p>
// ---- JS ----
const fmt = new Intl.NumberFormat('zh-CN');
document.querySelectorAll('.count').forEach(box => {
  const num = box.querySelector('.count-num');
  const target = Number(box.dataset.to), DUR = 1400;
  new IntersectionObserver(([e], ob) => {
    if (!e.isIntersecting) return; ob.disconnect();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      num.textContent = fmt.format(target); return;
    }
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / DUR), eased = 1 - Math.pow(1 - p, 3);
      num.textContent = fmt.format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }, { threshold: 0.4 }).observe(box);
});
/* ---- CSS ---- */
.count-num{font-variant-numeric:tabular-nums;min-width:6ch;display:inline-block}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
```

### 11【Magic Bento Bento 网格 + 单元光标光】布局与网格
**来源**：`/components/magic-bento`、`/components/chroma-grid`、`/components/masonry`；Aceternity `Bento Grid`、`Layout Grid`

**观感**：不等宽的功能块拼成网格，鼠标所在单元边缘亮起。

**实现**：布局用 CSS Grid（`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` + 关键单元 `grid-column: span 2`）；光标光复用 A1-6 配方，但**只对当前 hover 的那个单元写变量**，这样永远只有一个元素在写样式。

**关键 API**：CSS Grid、`pointerenter`（容器级一个监听 + `closest()`）、CSS 变量、`aspect-ratio`

**坑**
- Aceternity 的 `Layout Grid` 用 framer-motion 的 `layout` 做「点击后重排」，**原生没有等价物**（FLIP 需要测量首末位置）。可行的替代是 View Transitions：`document.startViewTransition(() => 改 DOM)`——**支持度不确定**（Chrome 111+ 有，Safari/Firefox 较晚），必须 `typeof document.startViewTransition === 'function'` 判断后降级。
- 别让每个单元都挂 `pointermove`（N 个监听 + N 次 rAF）→ **容器级一个监听 + `e.target.closest('.cell')`**。
- **`grid-auto-flow: dense` 会打乱 tab 顺序** → 内容站不要用。
- 移动端建议直接砍掉高光，只留布局。

```
<div class="bento">
  <article class="cell cell--wide">大功能</article>
  <article class="cell">小功能 A</article>
  <article class="cell">小功能 B</article>
</div>
/* ---- CSS ---- */
.bento{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.cell{position:relative;isolation:isolate;aspect-ratio:4/3;padding:20px;border-radius:16px;
  background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%),
    rgba(120,140,255,.14),transparent 60%),#12131a;border:1px solid #23242e}
.cell--wide{grid-column:span 2}
@media (hover:none),(prefers-reduced-motion:reduce){.cell{background:#12131a}}
// ---- JS ----
const bento = document.querySelector('.bento');
let current = null, queued = false;
bento.addEventListener('pointermove', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  current = cell;
  const r = cell.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (queued) return; queued = true;
  requestAnimationFrame(() => { queued = false;
    current.style.setProperty('--mx', x + 'px');
    current.style.setProperty('--my', y + 'px'); });
}, {passive:true});
```

## A2. Aceternity UI（11 条）

> 依据：官方 [llms.txt](https://ui.aceternity.com/llms.txt) 全量清单（113 组件）。组件详情页正文被导航截断，以下拆解基于「该组件已知的 DOM 结构与官方描述」，**未逐行核对源码**，但用到的都是标准 CSS/SVG/JS 能力。

### 1【Text Generate Effect 逐词淡入】文字动效
**路径**：`/components/text-generate-effect`（官方描述：words fade in one by one on load）

**观感**：一段话按「词」为单位依次淡入（常配轻微模糊）。

**实现**：文本按词切分 → 每词一个 `<span>` → `--i` 递增 → `opacity 0→1`、`blur(6px)→0`、延迟 `i * 90ms`。React 版是 `motion.span` + `initial/animate`，静态站等价物就是**触发 + transition-delay**。

**关键 API**：`Intl.Segmenter`、`IntersectionObserver`、`transition-delay: calc(var(--i) * 90ms)`

**坑**
- **中文没有空格**：`split(/\s+/)` 在中文段落上等于「整段一个词」。改用 `Intl.Segmenter('zh', { granularity: 'word' })`，或退化为按标点切句。
- 空格必须显式还原（切 span 后空白会被折叠）→ 给 `span` 加 `white-space: pre-wrap`。
- 词级切分同样破坏朗读 → 容器 `aria-label` 存原文。
- `filter: blur` 逐词动画在移动端开销明显；词多时（>40）改成只动 `opacity + translateY`。
- 这是正文，延迟总时长控制在 1.2s 内，或只在首屏用过一次。

```
<p class="gen" aria-label="纯静态站点也能有质感">纯静态站点也能有质感</p>
// ---- JS ----
document.querySelectorAll('.gen').forEach(el => {
  const text = el.getAttribute('aria-label');
  el.setAttribute('aria-hidden', 'true');
  el.textContent = '';
  const seg = ('Segmenter' in Intl)
    ? [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)].map(s => s.segment)
    : text.split(/(?<=[，。！？、])/);           // 无 Segmenter 时按标点粗切
  seg.forEach((word, i) => {
    const s = document.createElement('span');
    s.className = 'w'; s.style.setProperty('--i', i); s.textContent = word;
    el.append(s);
  });
  new IntersectionObserver(([e], ob) => {
    if (e.isIntersecting) { el.classList.add('is-in'); ob.disconnect(); }
  }, { threshold: .4 }).observe(el);
});
/* ---- CSS ---- */
.gen .w{display:inline-block;opacity:0;filter:blur(6px);transform:translateY(.25em);
  transition:opacity .5s,filter .5s,transform .5s;
  transition-delay:calc(var(--i) * 90ms);white-space:pre-wrap}
.gen.is-in .w{opacity:1;filter:blur(0);transform:none}
@media (prefers-reduced-motion:reduce){.gen .w{opacity:1;filter:none;transform:none;transition:none}}
```

### 2【Typewriter Effect / Flip Words】文字动效
**路径**：`/components/typewriter-effect`、`/components/flip-words`、`/components/encrypted-text`、`/components/text-flipping-board`

**观感**：打字机逐字（可循环删改）；`Flip Words` 在同一位置把词做 3D 翻转替换。

**实现**：打字机同 A1-3。`Flip Words`：容器 `perspective` + 单元素方案——`@keyframes` 在 50% 处 `opacity: 0; transform: rotateX(90deg)`，在 `animationend` 时换 `textContent` 再播入场。

**关键 API**：`setTimeout` 递归、`perspective`/`rotateX`、`animationend` 事件、`visibilitychange`

**坑**
- 换词时容器宽度会变 → 用 `display: inline-grid` + 所有词 `grid-area: 1/1` 叠在同一格，自动取最宽。
- 循环定时器应在 `document.hidden` 时停（`visibilitychange`），否则后台标签页也在空转。
- 读屏会不停朗读变化中的文本 → 容器 `aria-live="off"`，最终状态放 `aria-label`。

```
<span class="flip" aria-live="off"><span class="flip-word" aria-hidden="true">快</span></span>
// ---- JS ----
const words = ['快', '稳', '零依赖'];
document.querySelectorAll('.flip').forEach(box => {
  const el = box.querySelector('.flip-word');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = words[0]; return; }
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;                       // 后台不空转
    el.classList.add('out');
    el.addEventListener('animationend', () => {
      el.textContent = words[++i % words.length];
      el.classList.remove('out'); el.classList.add('in');
    }, { once: true });
  }, 2200);
});
/* ---- CSS ---- */
.flip{display:inline-grid;perspective:600px}
.flip-word{grid-area:1/1;transform-origin:50% 50%}
.flip-word.out{animation:flipOut .32s ease-in forwards}
.flip-word.in{animation:flipIn .32s ease-out backwards}
@keyframes flipOut{to{opacity:0;transform:rotateX(90deg)}}
@keyframes flipIn{from{opacity:0;transform:rotateX(-90deg)}}
@media (prefers-reduced-motion:reduce){.flip-word{animation:none!important}}
```

### 3【Spotlight / Spotlight New 聚光灯】背景与氛围
**路径**：`/components/spotlight`、`/components/spotlight-new`

**观感**：页面顶部两侧各射下一道锥形光，缓慢摆动。

**实现**：Aceternity 原版是 **SVG `<ellipse>` + 巨大 `feGaussianBlur`**，外层套 `translateY(-50%) rotate(...)` 动画。静态站两种做法：① 纯 CSS 用 `clip-path: polygon()` 做梯形 + `linear-gradient` + `filter: blur(40px)`；② 保留 SVG，但动画交给 CSS `transform`。

**关键 API**：`clip-path: polygon()`、`linear-gradient()`、`filter: blur()`、`feGaussianBlur`、`transform-origin`

**坑**
- **`stdDeviation` 不要动画**：每次变化都要重算整张滤镜图，是性能黑洞。要动就动 `transform`。
- SVG 滤镜成本与**元素像素面积**成正比：全屏 spotlight 在移动端等于全屏重绘 → `@media (max-width: 640px)` 直接隐藏或减小模糊半径。
- `filter: blur()` 对超大元素在 Safari 上有已知的闪烁/崩溃报告（**不确定**当前版本是否仍有）→ 保守使用小元素 + `scale()`。
- 光层 `pointer-events: none`，内容层 `position: relative; z-index: 1`。

```
<div class="spot" aria-hidden="true">
  <i class="beam beam--l"></i><i class="beam beam--r"></i>
</div>
/* ---- CSS ---- */
.spot{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.beam{position:absolute;top:-40%;width:38%;height:120%;filter:blur(38px);opacity:.5;
  background:linear-gradient(to bottom,rgba(163,190,255,.55),rgba(163,190,255,0) 72%);
  clip-path:polygon(42% 0,58% 0,100% 100%,0 100%);
  animation:sway 9s ease-in-out infinite alternate}
.beam--l{left:-6%;transform-origin:50% 0}
.beam--r{right:-6%;transform-origin:50% 0;animation-delay:-3s}
@keyframes sway{from{transform:rotate(-9deg)}to{transform:rotate(7deg)}}
@media (prefers-reduced-motion:reduce){.beam{animation:none}}
@media (max-width:640px){.beam{filter:blur(24px);opacity:.35}}
```

### 4【Aurora Background 极光（Aceternity 版）】背景与氛围
**路径**：`/components/aurora-background`

**观感**：与 A1-4 类似但更「分层」：底部一条条纹渐变带向上淡出，上方叠一层模糊深色渐变压住。

**实现**：① 光带层：`repeating-linear-gradient(100deg, 色A 10%, 色B 15%, 色C 20%, 色D 25%, 色E 30%)`，`background-size: 300% 200%`，`animation: aurora 60s linear infinite` **只动 `background-position`**；② 遮罩层：同色系 `linear-gradient` + `filter: blur(10px)`，把光带压成柔光。

**关键 API**：`repeating-linear-gradient()`、`background-size`、`background-position` 动画、`filter: blur()`、`prefers-color-scheme`

**坑**
- `background-position` 动画是**重绘**不是合成 → 能接受是因为只有 1 层大光带；**别在同一页叠 3 个以上**。
- `background-size: 300%` 会让浏览器缓存的位图变大 → 移动端降到 `150%`。
- 60s 一个周期几乎全程在重绘 → 必须 `@media (prefers-reduced-motion: reduce){ animation: none }`，并保证静态帧好看。
- 极光层必须 `aria-hidden="true"`，否则会被读屏当内容。

```
<div class="aurora" aria-hidden="true"></div>
/* ---- CSS ---- */
.aurora{position:absolute;inset:auto 0 0;height:50vh;pointer-events:none;
  background:repeating-linear-gradient(100deg,
    #7c3aed 10%, #2563eb 15%, #06b6d4 20%, #a855f7 25%, #7c3aed 30%);
  background-size:300% 200%;background-position:50% 50%;
  animation:aurora 60s linear infinite;opacity:.35}
.aurora::after{content:"";position:absolute;inset:0;
  background:linear-gradient(to top,#0b0c12 10%,transparent);
  filter:blur(10px)}
@keyframes aurora{from{background-position:50% 50%}to{background-position:350% 50%}}
@media (prefers-reduced-motion:reduce){.aurora{animation:none}}
@media (max-width:640px){.aurora{background-size:150% 200%}}
```

### 5【Meteors / Background Beams 流星与光束】背景与氛围
**路径**：`/components/meteors`、`/components/background-beams`、`/components/background-beams-with-collision`

**观感**：几条斜向光条在深色背景上划过长空，尾部带渐隐拖尾。

**实现**（这类效果最值得抄，因为**基本都是 SVG / 纯 DOM**）
- **Meteors**：一个 `2×2px` 的小元素，`::before` 做一条 70px 的渐隐尾巴，`@keyframes` 从原点位移到 `translate3d(-420px, 420px, 0)`，每个流星随机 `animation-delay` 与位置。
- **Background Beams**：SVG 里几十条 `<path>`，配 `stroke="url(#gradient)"`，用 `stroke-dasharray` + `stroke-dashoffset` 让光沿路径跑（CSS `@keyframes` 或 SMIL `<animate>` 都行）。

**关键 API**：`stroke-dasharray` / `stroke-dashoffset`、`<linearGradient>` + `stroke="url(#g)"`、`transform: translate3d()`、随机化 `animation-delay`

**坑**
- 元素会跑出容器 → `overflow: hidden`；但 `overflow: hidden` + `filter` 会开新合成层，注意数量。
- 拖尾不要用大半径 `box-shadow`（很贵），用一条 1px 的小渐变条。
- 数量控制：**流星 ≤ 20 个、SVG 光束 ≤ 40 条**，再多就该考虑 canvas 了。
- 全部 `pointer-events: none`。
- Aceternity 的 `with-collision` 碰撞逻辑**不确定**，不建议复刻。

```
<div class="meteors" aria-hidden="true"></div>
// ---- JS ----
const sky = document.querySelector('.meteors');
for (let i = 0; i < 16; i++) {
  const m = document.createElement('i');
  m.className = 'meteor';
  m.style.left = Math.random() * 100 + '%';
  m.style.top  = Math.random() * 60 + '%';
  m.style.animationDelay = (Math.random() * 8).toFixed(2) + 's';
  m.style.animationDuration = (4 + Math.random() * 5).toFixed(2) + 's';
  sky.append(m);
}
/* ---- CSS ---- */
.meteors{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.meteor{position:absolute;width:2px;height:2px;border-radius:50%;background:#dbe4ff;opacity:0;
  animation:meteor linear infinite}
.meteor::before{content:"";position:absolute;top:50%;right:0;width:70px;height:1px;
  transform:translateY(-50%);
  background:linear-gradient(to left,rgba(219,228,255,.9),transparent)}
@keyframes meteor{
  0%{opacity:0;transform:translate3d(0,0,0)}
  8%,70%{opacity:1}
  100%{opacity:0;transform:translate3d(-420px,420px,0)}}
@media (prefers-reduced-motion:reduce){.meteors{display:none}}
```

### 6【Card Spotlight / Glowing Effect 边框光晕】卡片与容器
**路径**：`/components/card-spotlight`、`/components/glowing-effect`、`/components/hover-border-gradient`
**观感**：卡片内部有跟随鼠标的径向光（与 A1-6 完全同配方）；`Glowing Effect` 更进一步——边框在鼠标**靠近**（不必悬停）时就点亮，即 Cursor 官网那种邻近发光。
**实现**：容器级一个 `pointermove`，对每张卡片算「鼠标到卡片矩形的最短距离」，把 0→1 的强度写进 `--active`：
`dx = Math.max(r.left - cx, 0, cx - r.right); dy = Math.max(r.top - cy, 0, cy - r.bottom);`
`dist = Math.hypot(dx, dy); c.style.setProperty('--active', Math.max(0, 1 - dist / 220))`。
```css
.gcard::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;
  background:conic-gradient(from 180deg,rgba(140,160,255,.9),transparent 40%,rgba(140,160,255,.9));
  opacity:calc(var(--active,0)*.9);transition:opacity .25s;-webkit-mask:linear-gradient(#000,#000) content-box,linear-gradient(#000,#000);-webkit-mask-composite:xor;mask-composite:exclude}
```
**关键 API**：容器级 `pointermove` + **缓存矩形数组**、`Math.hypot`、点到矩形的最短距离公式、CSS 变量、`conic-gradient`
**坑**：① 邻近探测是 **O(卡片数)**，每帧对 N 张卡调 `getBoundingClientRect()` 会直接卡死 → 缓存矩形（`resize`/`scroll` 后重建），move 里只做纯数学；② 每张卡要 `isolation: isolate`，否则 `mix-blend-mode` 会串色；③ 不要给每张卡单独挂 `pointermove`；④ 键盘用户感知不到邻近发光 → 只能锦上添花，`:focus-visible` 样式必须单独写足。

### 7【Moving Border 走光的按钮边框】卡片与容器
**路径**：`/components/moving-border`、`/components/hover-border-gradient`、`/components/stateful-button`
（ReactBits 的 `Star Border` 是同一效果）

**观感**：按钮四周有一圈光沿边框匀速绕行。

**实现**：**SVG 版最稳且兼容性最好**——`<rect rx="23" pathLength="100">`，`stroke-dasharray: 18 82`，`@keyframes { to { stroke-dashoffset: -100 } }`。`pathLength="100"` 让你用百分比控制虚线长度，**且完全不依赖 `@property`**。
CSS 版（圆角矩形、无 SVG）需要 `@property --a { syntax:'<angle>' }` 才能让 `conic-gradient(from var(--a))` 平滑插值。

**关键 API**：`pathLength`、`stroke-dasharray`/`stroke-dashoffset`、`@property`、`mask-composite: exclude`

**坑**
- **`@property` 不支持时角会「跳」** → 用 `@supports (background: conic-gradient(from 0deg, red, blue))` 包起来，不支持就退化为静态发光边。`@property` 支持：Chrome/Edge 85+、Safari 16.4+、Firefox 128+（**不确定**精确边界）。
- `mask-composite` 需要双写：`-webkit-mask-composite: xor` + `mask-composite: exclude`。
- 走光是**无限循环**，`visibilitychange` 时加类暂停（`animation-play-state: paused`）。
- **`:focus-visible` 不能被 `overflow: hidden` 或 `mask` 裁掉** → 焦点样式用 `outline` + `outline-offset`。

```
<a class="movbtn" href="#"><svg aria-hidden="true" viewBox="0 0 200 48" preserveAspectRatio="none">
  <rect x="1" y="1" width="198" height="46" rx="23" pathLength="100"
        fill="none" stroke="url(#g)" stroke-width="2" stroke-dasharray="18 82"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8ba4ff"/><stop offset="1" stop-color="#e879f9"/>
  </linearGradient></defs>
</svg><span>查看文档</span></a>
/* ---- CSS ---- */
.movbtn{position:relative;display:inline-grid;place-items:center;padding:12px 28px;
  border-radius:24px;background:#16171f;color:#e8eaf2;text-decoration:none}
.movbtn svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.movbtn rect{animation:dash 3.6s linear infinite}
@keyframes dash{to{stroke-dashoffset:-100}}
.movbtn:focus-visible{outline:2px solid #8ba4ff;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.movbtn rect{animation:none;stroke-dasharray:100 0;opacity:.5}}
```

### 8【Following Pointer / Animated Tooltip 跟随光标的浮层】光标与指针
**路径**：`/components/following-pointer`、`/components/animated-tooltip`、`/components/tooltip-card`、`/components/link-preview`

**观感**：鼠标悬停在链接/头像上时，浮层用弹簧手感跟着光标移动并淡入。

**实现**：一个 `position: fixed` 的浮层，`pointerenter` 显示，`pointermove` 更新 `transform: translate3d()`。**关键技巧**：位置用 `transform` 而不是 `left/top`，并且「跟随」要有阻尼——rAF 里 `pos += (target - pos) * 0.18`。

**关键 API**：`pointerenter`/`pointerleave`/`pointermove`、`position: fixed`、`transform: translate3d()`、rAF 阻尼插值

**坑**
- **浮层必须 `pointer-events: none`**，否则它会出现在光标下方抢走 `pointerleave`，导致疯狂闪烁。
- 用 `position: fixed` 配 `clientX/clientY` 最省事；但**祖先有 `filter`/`transform` 时 `fixed` 会退化成 `absolute`**。
- 触摸端没有 hover → 改成「点击展开」，或直接隐藏。
- **键盘可达性**：浮层信息重要时必须在 `focusin`/`focusout` 时同样可见。
- 浮层别用 `backdrop-filter: blur()`（大面积模糊 + 每帧移动 = 最坏组合）。

```
<p>看这个<a class="peek" href="#" data-tip="零依赖也能有质感">链接</a></p>
<div class="peek-layer" hidden><strong>零依赖</strong><span>也能有质感</span></div>
// ---- JS ----
const layer = document.querySelector('.peek-layer');
let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
const loop = () => {
  cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;      // 阻尼插值 = 弹簧感
  layer.style.transform = `translate3d(${cx + 16}px, ${cy + 16}px, 0)`;
  raf = (Math.abs(tx - cx) > .5 || Math.abs(ty - cy) > .5) ? requestAnimationFrame(loop) : 0;
};
document.querySelectorAll('.peek').forEach(a => {
  const show = () => { layer.hidden = false; };
  const hide = () => { layer.hidden = true; cancelAnimationFrame(raf); raf = 0; };
  a.addEventListener('pointerenter', show);
  a.addEventListener('pointerleave', hide);
  a.addEventListener('focus', show); a.addEventListener('blur', hide);   // 键盘可达
  a.addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    if (!raf) { cx = tx; cy = ty; raf = requestAnimationFrame(loop); }
  }, {passive:true});
});
/* ---- CSS ---- */
.peek-layer{position:fixed;top:0;left:0;z-index:50;pointer-events:none;
  padding:8px 12px;border-radius:10px;background:#1a1b24;border:1px solid #2a2c38;
  box-shadow:0 8px 24px rgba(0,0,0,.4)}
@media (hover:none){.peek-layer{display:none}}
```

### 9【Sticky Scroll Reveal + Tracing Beam 滚动跟随光线】滚动驱动
**路径**：`/components/sticky-scroll-reveal`、`/components/tracing-beam`、`/components/timeline`

**观感**：左侧一条细光线随滚动向下生长；或一列内容粘住，随滚动切换当前项高亮。

**实现**
- **Tracing Beam**：`position: sticky` 的竖线，高度由滚动进度决定。原版用 framer-motion `useScroll` + `scaleY`。**静态站最优解是 CSS 滚动驱动动画**：`animation-timeline: scroll(root block)` + `animation-range: 0% 100%`，`transform-origin: top`，`scaleY(0)→1`。
- **降级**：`IntersectionObserver` 逐段点亮 + `position: fixed` 的进度条（rAF 里读 `scrollTop`）。
- **Sticky Scroll Reveal**：`position: sticky; top: 6rem` 的容器 + 内部切换内容，用 IO 观察每个块来切换 `.active`。

**关键 API**：`animation-timeline: scroll()`、`position: sticky`、`IntersectionObserver`、`transform: scaleY()`

**坑**
- **`scroll()` 时间线必须配 `@supports`**，否则不支持的浏览器里元素会停在初始帧（`scaleY(0)` = 完全看不见）。
- `animation-timeline: scroll()` 支持：Chrome/Edge 115+ 有，Safari/Firefox 尚未普遍支持（**不确定**）→ 必须有 JS 降级。
- **绝不监听 `scroll` 去读写 `getBoundingClientRect`**。要么 CSS 滚动时间线，要么 IO，要么 rAF 里「先批量读、再批量写」。
- **`position: sticky` 需要父链上没有 `overflow: hidden`**，否则退化成 `relative`——这是 sticky 最常见的失效原因。
- 移动端地址栏收缩会改变视口高度 → 用 `min-height` 而非 `100vh`（`100svh` 更稳，**支持度不确定**）。
- **不要做滚动劫持**（`preventDefault` 改 `scrollTop`）：破坏 Ctrl+F、锚点、读屏与滚动恢复。

```
<div class="beam" aria-hidden="true"></div>
/* ---- CSS ---- */
.beam{position:fixed;left:24px;top:0;width:2px;height:100vh;transform-origin:top;
  background:linear-gradient(#8ba4ff,#e879f9);transform:scaleY(0)}
@supports (animation-timeline: scroll()){
  .beam{animation:grow linear both;animation-timeline:scroll(root block);animation-range:0% 100%}
  @keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
}
@media (prefers-reduced-motion:reduce){.beam{transform:scaleY(1);animation:none}}

// ---- JS（降级：只有不支持滚动时间线时才跑）----
if (!CSS.supports('animation-timeline', 'scroll()')) {
  const beam = document.querySelector('.beam');
  let queued = false;
  const paint = () => {
    queued = false;
    const h = document.documentElement;
    const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    beam.style.transform = `scaleY(${Math.min(1, Math.max(0, p))})`;
  };
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, {passive:true});
}
```

### 10【Multi Step Loader / Stateful Button 加载状态】加载与状态
**路径**：`/components/multi-step-loader`、`/components/loader`、`/components/stateful-button`、`/components/image-generation-loader`

**观感**：多步骤加载列表逐条点亮；按钮点下后转圈，成功后变对勾。

**实现**
- **旋转 loader**：`border: 2px solid rgba(...); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite`。用 `transform: rotate()`，别用 `background-position`。
- **对勾**：SVG `<path>` + `stroke-dasharray: L; stroke-dashoffset: L → 0`，`getTotalLength()` 拿 L。
- **按钮状态机**：`data-state="idle|loading|done|error"` + 属性选择器，同步设 `aria-busy` 和 `disabled`。

**关键 API**：`@keyframes spin`、`stroke-dasharray`/`stroke-dashoffset`、`SVGPathElement.getTotalLength()`、`aria-busy`、`data-*` 状态属性

**坑**
- **加载状态必须对读屏可见**：`aria-busy="true"` 加在按钮上；纯视觉转圈对读屏用户等于没反馈。
- 无限旋转是持续 GPU 占用 → `visibilitychange` 时暂停。
- **不要用 `prefers-reduced-motion` 直接关掉 loader**——「加载中」是必要信息。降级为静态「加载中…」文字 + 慢速不定进度条，而不是消失。
- 步骤变化用 `aria-live="polite"`，但别逐条播报（会吵）→ 只在完成时播报一次。

```
<button class="sbtn" data-state="idle">
  <span class="sbtn-label">提交</span>
  <svg class="sbtn-tick" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="2.5"/>
  </svg>
</button>
/* ---- CSS ---- */
.sbtn{position:relative;display:grid;place-items:center;min-width:110px;padding:10px 20px;
  border-radius:12px;background:#1b1c24;color:#e8eaf2;border:1px solid #2a2c38}
.sbtn[data-state="loading"] .sbtn-label{visibility:hidden}
.sbtn[data-state="loading"]::after{content:"";position:absolute;width:18px;height:18px;
  border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;
  animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.sbtn-tick{position:absolute;width:20px;height:20px;opacity:0;
  transition:stroke-dashoffset .45s ease-out,opacity .2s}
.sbtn[data-state="done"] .sbtn-tick{opacity:1}
@media (prefers-reduced-motion:reduce){
  .sbtn[data-state="loading"]::after{animation:none;border-top-color:rgba(255,255,255,.5)}
  .sbtn-tick{transition:none}}
// ---- JS ----
document.querySelectorAll('.sbtn').forEach(btn => {
  const tick = btn.querySelector('.sbtn-tick path');
  const L = tick.getTotalLength();
  tick.style.strokeDasharray = L; tick.style.strokeDashoffset = L;
  btn.addEventListener('click', async () => {
    btn.dataset.state = 'loading';
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    await new Promise(r => setTimeout(r, 1200));        // 换成真实请求
    btn.dataset.state = 'done';
    btn.removeAttribute('aria-busy');
    tick.style.strokeDashoffset = 0;
  });
});
```

### 11【Bento Grid / Layout Grid】布局与网格
**路径**：`/components/bento-grid`、`/components/layout-grid`、`/blocks/bento-grids`

**观感**：尺寸不一的卡片组成紧密网格，部分单元嵌小可视化。

**实现**：CSS Grid；桌面 `grid-template-columns: repeat(3, 1fr)` + 关键单元 `grid-column: span 2` / `grid-row: span 2`；移动端 `grid-template-columns: 1fr`。高度对齐用 `grid-auto-rows: minmax(160px, auto)`。点击重排可用 View Transitions。

**关键 API**：CSS Grid（`span`/`auto-rows`）、`aspect-ratio`、`document.startViewTransition`（**Chrome 111+，Safari/Firefox 较晚——不确定**）、`::view-transition-group()`

**坑**
- **`grid-auto-flow: dense` 会打乱 tab 顺序** → 内容站不要用。
- `startViewTransition` 必须做函数存在性判断；它能被减少动效影响——用 `@media (prefers-reduced-motion: reduce){ ::view-transition-group(*){ animation-duration: .01ms !important } }` 关掉。
- View Transitions 会短暂冻结渲染（截图 + 交叉淡入），**别在滚动中触发**。
- Bento 单元里的小可视化若是 canvas/循环动画，用 `IntersectionObserver` 在离开视口时 `cancelAnimationFrame`，否则 N 个单元 = N 个常驻循环。

```
<section class="bento2">
  <article class="b2 b2--lg">主功能</article>
  <article class="b2">次功能</article>
  <article class="b2">次功能</article>
  <article class="b2 b2--wide">宽功能</article>
</section>
/* ---- CSS ---- */
.bento2{display:grid;gap:16px;grid-template-columns:repeat(3,1fr);
  grid-auto-rows:minmax(150px,auto)}
.b2{border-radius:18px;background:#12131a;border:1px solid #23242e;padding:20px}
.b2--lg{grid-column:span 2;grid-row:span 2}
.b2--wide{grid-column:1 / -1}
@media (max-width:760px){.bento2{grid-template-columns:1fr}
  .b2--lg,.b2--wide{grid-column:auto;grid-row:auto}}
@media (prefers-reduced-motion:reduce){
  ::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){
    animation-duration:.01ms!important}}

// ---- JS（可选：点击重排，带能力检测与降级）----
document.querySelectorAll('.b2[data-toggle]').forEach(card => {
  card.addEventListener('click', () => {
    const apply = () => card.classList.toggle('is-expanded');
    if (typeof document.startViewTransition === 'function') document.startViewTransition(apply);
    else apply();                                  // 降级：直接切，接受跳变
  });
});
```

---

# B. 每个站「最值得抄的 3 个」

评判标准（针对**内容型中文静态站**）：① 不遮挡文字；② 只跑合成属性；③ 有标准无障碍解法；④ 实现量 ≤ 60 行且能复用多个位置。

## B1. ReactBits —— 值得抄的 3 个

**① Split Text（A1-1）逐字/逐词入场**
内容站最稀缺的是「标题有节奏」。它只依赖 `IntersectionObserver` + `transition-delay`，零运行时，且**中文按字切是天然正确的**。可访问性有标准答案（`aria-label` + `aria-hidden`）。复用面：文章标题、章节标题、hero、目录项。成本约 25 行 JS + 8 行 CSS。

**② Animated Content / Fade Content 通用滚动入场包装器（A1-9）**
投入产出比全站最高。**一个** 20 行的 `IntersectionObserver` + 一个 `.reveal` 类就能覆盖全站所有「滚入淡入」，不必为每个模块单独写动画。它也是**最安全**的动效——只改透明度与 18px 位移。成本约 15 行 JS + 8 行 CSS。

**③ Spotlight Card / Border Glow（A1-6）**
ReactBits 里少有的「氛围提升但不干扰阅读」的效果：高光在**背景层**，文字对比度不变，且完全跑在合成层上。做成配方后可用于卡片、导航项、Bento 单元、代码块、按钮。成本约 20 行 JS（rAF 合帧 + 缓存 rect）+ 10 行 CSS。

> 诚实说明：ReactBits 视觉最惊艳的是 WebGL 背景（Backgrounds 分类 66 项里的绝大多数），但对内容站它们是负资产。

## B2. Aceternity —— 值得抄的 3 个

**① Spotlight New / Aurora Background（A2-3、A2-4）**
能给整页「定调」，但比 Meteors / Background Beams **安静得多**——没有明确的运动物体，不会把视线从正文拉走。实现就是「渐变 + 模糊 + 慢速 transform」，不需要 JS（除 reduced-motion 判断）。成本约 20 行 CSS、0 行 JS。

**② Bento Grid + Glowing Effect（A2-11、A2-6）**
Bento 是「把一长串功能列表变成可扫读模块」的成熟解法，而**布局本身就是普通 CSS Grid**——没有 JS 也能工作，`Glowing Effect` 只是可选增强。成本：布局 10 行 CSS；光晕 25 行 JS（含矩形缓存，注意 O(N) 开销）。

**③ Typewriter Effect / Text Generate Effect（A2-1、A2-2）**
观感强、代码少，而且**降级路径非常干净**——`prefers-reduced-motion` 时直接渲染完整文本，一行搞定。只用在**标题级短文本**（≤20 字）与状态提示。成本约 20 行 JS + 8 行 CSS。

## B3. 明确「不要抄」的清单

| 类别 | 具体组件 | 为什么不要 |
|---|---|---|
| **大面积跟随光标的模糊/液化** | ReactBits：`Splash Cursor`、`Blob Cursor`、`Ghost Cursor`、`Glow Cursor`、`Swarm Cursor`、`Pixel Trail`、`Image Trail`、`Ribbons`、`Meta Balls`、`Liquid Ether`；Aceternity：`Lens`、`SVG Mask Effect`、`Canvas Reveal Effect`、`Pixelated Canvas`、`Chromatic Image` | 全屏 canvas 每帧重绘 + 大面积 `filter: blur`，中低端机必然掉帧；遮挡正文、干扰阅读；对键盘/触摸用户完全无效。 |
| **滚动劫持 / 超长 sticky** | ReactBits：`Scroll Expand`、`Scroll Stack`、`Option Wheel`、`Circular Gallery`、`Dome Gallery`；Aceternity：`Macbook Scroll`、`Container Scroll Animation`、`Hero Parallax`、`Sticky Scroll Reveal`（**慎用**，非禁用） | 把 `position: sticky` 拉成超长滚动段会让用户觉得「滚不动」；移动端地址栏收缩引发跳变；破坏 Ctrl+F、锚点定位与滚动恢复。若一定要用，段长控制在 1.5 屏以内。 |
| **常驻无限粒子/星空/物理** | ReactBits：`Particles`、`Galaxy`、`Pixel Snow`、`Antigravity`、`Hyperspeed`、`Ballpit`、`Ferrofluid`、`Balatro`、`Liquid Chrome`；Aceternity：`Vortex`、`Shooting Stars`、`Sparkles`（少量可用）、`Wavy Background` | 常驻 rAF 空转、耗电、笔记本风扇响；绝大多数是着色器，静态站复刻成本远高于收益。 |
| **让正文「要交互才看得清」** | ReactBits：`Scrambled Text`、`Fuzzy Text`、`Variable Proximity`、`Text Pressure`、`Glitch Text`（正文用）；Aceternity：`Focus Cards`（hover 时 `blur` 其他卡）、`Wobble Card`、`3D Card Effect`（用在长文本卡上） | 把可读内容变成交互产物，是无障碍反模式；`Focus Cards` 的「其余模糊」让用户无法同时比较。 |
| **替换系统光标** | ReactBits：`Target Cursor`、`Crosshair`；Aceternity：`Following Pointer`（作为浮层预览可以，替换光标不行） | `cursor: none` 让用户找不到指针；触摸端毫无意义；系统级辅助功能失效。 |
| **整屏 `backdrop-filter: blur`** | 两站的玻璃拟态路线（Aceternity `Cover`、`Evervault Card` 等） | 每帧重新采样背后的整片内容，是目前移动端最贵的一类效果。只在小面积（< 300×200px）且静止时用。 |

**一句话原则**：凡是「需要每帧重绘大面积像素」或「需要用户先交互才能读到内容」的效果，都别抄。

---

# C. 统一技术备忘录

## C-1 标准实现配方（11 条）

**配方 0：三条铁律**
1. **JS 只写 CSS 变量、只切 DOM、只加类名**，所有动画交给 `transition` / `@keyframes`。
2. **只动 `transform` / `opacity` / `filter` / `clip-path`**。（后两者虽在合成层，但改动会重绘整个元素，代价高于前两者。）
3. **`pointermove` / `scroll` / `resize` 里永远不做布局读取**。要么缓存矩形，要么在 rAF 里「先批量读、再批量写」。

**配方 1：光标跟随高光（最常用）**
```
容器 pointerenter → 缓存 rect
容器 pointermove  → 算相对坐标 → 若未排队则 rAF
rAF 回调          → el.style.setProperty('--mx', x+'px')，'--my' 同理
CSS              → background: radial-gradient(<R> circle at var(--mx) var(--my), 色A, transparent <R2>)
高光层            → pointer-events: none
```
完整代码见 **A1-6**。要点：`--mx/--my` 给**默认值**（如 `50%`），这样无 JS 时也有合理的静态态。

**配方 2：3D 倾斜** → 完整代码见 **A1-7**。外层 `perspective`，内层 `rotateX/rotateY`，子元素 `translateZ`；角度映射 `px - 0.5 → ±10deg`（超过 16deg 会晕）。**外层不要 `overflow: hidden`，也不要 `filter`。**

**配方 3：滚动入场** → 完整代码见 **A1-9**。

**配方 4：无缝跑马灯（纯 CSS，无需 JS）**
```html
<div class="marquee"><div class="marquee-track">
  <span>项 1</span><span>项 2</span><span>项 3</span>
  <!-- 复制一份，并给副本 aria-hidden="true" -->
  <span aria-hidden="true">项 1</span><span aria-hidden="true">项 2</span><span aria-hidden="true">项 3</span>
</div></div>
```
```css
.marquee{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.marquee-track{display:flex;gap:2rem;width:max-content;animation:slide 28s linear infinite}
@keyframes slide{to{transform:translate3d(-50%,0,0)}}
.marquee:hover .marquee-track,.marquee:focus-within .marquee-track{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.marquee-track{animation:none;flex-wrap:wrap;width:auto}}
```
对应组件：ReactBits `Logo Loop`、`Scroll Velocity`、`Text Loop`；Aceternity `Infinite Moving Cards`、`Logo Cloud Marquee`。**坑**：`width: max-content` 必需；副本必须 `aria-hidden`，否则读屏念两遍。

**配方 5：渐变 / 扫光文字（纯 CSS）**
```css
.shiny{background:linear-gradient(110deg,#6b7280 42%,#fff 50%,#6b7280 58%);
  background-size:250% 100%;-webkit-background-clip:text;background-clip:text;
  color:transparent;animation:sheen 3.4s linear infinite}
@keyframes sheen{from{background-position:180% 0}to{background-position:-80% 0}}
.shiny::selection{background:#334155;color:#fff}
@media (forced-colors:active){.shiny{color:CanvasText;background:none;animation:none}}
@media (prefers-reduced-motion:reduce){.shiny{animation:none;background-position:50% 0}}
```
**坑**：`background-position` 动画是重绘，只适合小面积文字；`forced-colors` 模式下必须还原 `color`，否则文字完全不可见。对应组件：ReactBits `Shiny Text`、`Gradient Text`；Aceternity `Text Hover Effect`（用 `stroke-dashoffset` 做描边，原理不同但同属文字表面动效）。

**配方 6：clip-path 揭示（比 `width` 动画好）**
```css
.wipe{clip-path:inset(0 100% 0 0);transition:clip-path .8s cubic-bezier(.65,0,.35,1)}
.is-in .wipe,.wipe.is-in{clip-path:inset(0 0 0 0)}
[dir="rtl"] .wipe{clip-path:inset(0 0 0 100%)}
```
优势：不改变布局、不触发重排、可用于任意元素。对应组件：ReactBits `Animated Content`（wipe 变体）、`Masked Heading`。

**配方 7：折叠 / 展开（`grid-template-rows` 技巧）**
```css
.acc-item{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.22,1,.36,1)}
.acc-item.is-open{grid-template-rows:1fr}
.acc-item > div{overflow:hidden;min-height:0}
```
```js
document.querySelectorAll('.acc-head').forEach(h => {
  h.addEventListener('click', () => {
    const item = h.closest('.acc-item');
    h.setAttribute('aria-expanded', String(item.classList.toggle('is-open')));
  });
});
```
**坑**：内层必须有 `overflow: hidden; min-height: 0`，否则 `1fr` 不裁剪。原生 `<details>` 的展开动画需要 `::details-content`（**支持度不确定**），不如这套稳。

**配方 8：点击波纹（一次性动画）**
```css
[data-ripple]{position:relative;overflow:hidden;isolation:isolate}
.ripple{position:absolute;left:var(--x);top:var(--y);width:0;height:0;border-radius:50%;
  background:rgba(255,255,255,.35);pointer-events:none;transform:translate(-50%,-50%);
  animation:ripple .6s ease-out forwards}
@keyframes ripple{to{width:340px;height:340px;opacity:0}}
@media (prefers-reduced-motion:reduce){.ripple{display:none}}
```
```js
document.querySelectorAll('[data-ripple]').forEach(el => {
  el.addEventListener('pointerdown', e => {
    const r = el.getBoundingClientRect();
    const dot = document.createElement('i');
    dot.className = 'ripple';
    dot.style.setProperty('--x', (e.clientX - r.left) + 'px');
    dot.style.setProperty('--y', (e.clientY - r.top) + 'px');
    el.append(dot);
    dot.addEventListener('animationend', () => dot.remove());   // 必须自清理
  }, {passive:true});
});
```
**坑**：动画 `width/height` 是重绘（面积小、一次性，可接受）；嫌贵就改固定尺寸 + `transform: scale(0)→1` + `opacity`。**必须 `animationend` 自清理**，否则每次点击都堆一个 DOM 节点。

**配方 9：玻璃拟态（谨慎）**
```css
.glass{background:rgba(20,21,28,.55);backdrop-filter:blur(12px) saturate(140%);
  -webkit-backdrop-filter:blur(12px) saturate(140%);border:1px solid rgba(255,255,255,.08)}
@supports not (backdrop-filter: blur(1px)){.glass{background:rgba(20,21,28,.92)}}
```
**坑**：① 代价与背后**整片内容**面积成正比，元素一动就每帧重算 → 只用于静止的小面板（导航栏、角标）；② 它创建包含块，后代 `position: fixed` 失效；③ **别用在跟随光标移动的元素上**；④ 必须有不支持的降级底色，否则文字对比度不足。

**配方 10：滚动进度指示（`scale` 而非 `height`）**
```css
.progress{position:fixed;inset:0 auto auto 0;width:100%;height:3px;transform-origin:0 50%;
  background:linear-gradient(90deg,#8ba4ff,#e879f9);transform:scaleX(0)}
@supports (animation-timeline: scroll()){
  .progress{animation:grow-x linear both;animation-timeline:scroll(root block)}
  @keyframes grow-x{from{transform:scaleX(0)}to{transform:scaleX(1)}}
}
```
降级用 rAF（见 A2-9 的 `paint()`）。**绝不要用 `height: X%` 或 `top: Xpx`**——那是逐帧布局。

**配方 11：状态驱动的 CSS（推荐的整体架构）**
不要「一个效果一个 class」。用 `data-*` + 属性选择器把动画变成状态机：
```css
[data-state="idle"]    .tick{opacity:0}
[data-state="loading"] .spinner{animation:spin .8s linear infinite}
[data-state="done"]    .tick{opacity:1;stroke-dashoffset:0}
[data-state="error"]   {animation:shake .3s}
```
好处：JS 只改一个属性；`prefers-reduced-motion` 只需在一处覆盖；测试时可手工改 DOM 复现任意状态。

## C-2 纯 CSS 能做 vs 必须 JS

| 效果 | 纯 CSS | 备注 |
|---|---|---|
| `:hover` / `:focus-visible` 的颜色、位移、缩放、阴影 | ✅ | 首选，零 JS |
| `@keyframes` 无限循环（旋转、呼吸、跑马灯、扫光、极光漂移） | ✅ | 只要保证只动合成属性 |
| 渐变点阵/网格/条纹背景（含 `mask-image` 聚焦） | ✅ | `radial-gradient` / `repeating-linear-gradient` |
| 文字渐变、描边、扫光 | ✅ | `background-clip: text`、`-webkit-text-stroke` |
| 折叠展开（`grid-template-rows: 0fr→1fr`） | ✅ | 需要 JS 切类名 |
| 滚动驱动动画（进度条、视差、逐段点亮） | ✅ **有条件** | `animation-timeline: scroll()`；不支持的浏览器必须 JS 降级 |
| 3D 倾斜、跟随光标的高光（依赖指针坐标） | ❌ | 需要 `pointermove` 写 CSS 变量 |
| 滚动入场（进入视口才播） | ❌ | 需要 `IntersectionObserver`（或滚动时间线 + `animation-range`） |
| 文本按字/词切分 | ❌ | 需要 DOM 切分 |
| 数字滚动、乱码收敛、打字机 | ❌ | 需要 rAF / 定时器 |
| 点击波纹、火花 | ❌ | 需要 `pointerdown` + 动态元素 |
| 拖拽、滑块、磁吸 | ❌ | 需要 Pointer Events |
| 主题切换、暗色适配 | ⚠️ | `prefers-color-scheme` 纯 CSS；手动切换需要 JS 加 `data-theme` |

**结论**：内容型动画站**约 70% 的效果可以纯 CSS 完成**。剩下 30% 里只有 6 类 JS 原语是必需的：
`IntersectionObserver`、`pointermove`→CSS 变量、`requestAnimationFrame` 数值动画、`setTimeout` 序列、`pointerdown` 一次性元素、`classList`/`data-*` 状态切换。

## C-3 踩坑清单

**1. 滚动性能**
- **永远不要**在 `scroll` 里调 `getBoundingClientRect()` / `offsetTop` / `offsetHeight`——会让浏览器放弃滚动优化，变成每帧强制同步布局。ReactBits 的 `Scroll Float`/`Scroll Velocity`、Aceternity 的 `Tracing Beam` 原版都这么干（React 的 `useScroll` 内部做了批处理）。静态站换成 `IntersectionObserver` 或 CSS 滚动时间线。
- 必要时**在 rAF 回调里「先全部读、再全部写」**，不要读写交替。
- 监听器一律 `{ passive: true }`（`scroll`、`wheel`、`touchstart`、`touchmove`、`pointermove`）。
- `scroll-behavior: smooth` 要尊重减少动效：`@media (prefers-reduced-motion: reduce){ html{scroll-behavior:auto} }`。
- 长页面每段挂 `IntersectionObserver` 没问题（IO 很便宜），但**每段都挂 `scroll` 监听**会线性变慢。

**2. 移动端与触摸**
- **`:hover` 在触摸屏会「粘住」**：点一下之后保持 hover 直到点别处。所有 hover 驱动的效果都要包在 `@media (hover: hover) and (pointer: fine)` 里。
- `pointermove` 在触摸上只在拖动时触发，且浏览器可能已开始滚动手势 → 用 `touch-action` 明确意图：`touch-action: pan-y` 或 `none`（完全接管，仅用于滑块）。
- **不要 `preventDefault()` 在 `touchmove` 上**，除非实现了完整手势（含惯性、边界回弹）。
- 移动端 CPU 弱 3–5 倍：`filter: blur` / 大面积 `backdrop-filter` / 大量并发动画要按 `matchMedia('(max-width: 640px)')` 降级。
- iOS Safari 地址栏改变 `100vh` → 优先 `100svh`（**支持度不确定**），或 `height: 100%` 配 `html,body{height:100%}`。
- 电池：`document.hidden` 为真时暂停一切无限动画（`.is-hidden { animation-play-state: paused }`）。
- **触摸目标 ≥ 44×44px**：`scale(0.9)` 会缩小命中区 → 用 `padding` 撑够。

**3. 键盘用户**
- 所有 hover 触发的效果必须同时有 `:focus-visible` 的等价路径（或效果本身对信息无影响）。
- **不要 `outline: none`**。要改就改成更高对比：`outline: 2px solid var(--focus); outline-offset: 3px`。
- 用 transform 位移的元素，焦点框会跟着移动 → 可能被 `overflow: hidden` 裁掉或跑出视口。位移量保持小（≤20px）。
- 焦点顺序必须与视觉顺序一致 → **不要用 `grid-auto-flow: dense`**。
- 浮层（tooltip / link preview）要在 `focusin` 时也显示，且 `Escape` 可关闭。
- Tab 到屏幕外元素时，`sticky` 可能让元素出现在错误位置 → sticky 容器每个子项都要能被 Tab 到且可见。

**4. 屏幕阅读器**
- **切分文本必须补偿**：容器 `aria-label="原文"` + 碎片 `aria-hidden="true"`。这是 Split Text / Text Generate / Shuffle 的硬性要求。
- 运行中的动效容器加 `aria-live="off"`，否则打乱的字会被反复朗读。
- 仅作装饰的层（极光、光斑、粒子、网格、流星）一律 `aria-hidden="true"`。
- 数字滚动：可视数字 `aria-hidden="true"`，旁置 `.sr-only` 写最终值。
- 加载状态用 `aria-busy="true"`，不要只靠视觉转圈。
- `prefers-reduced-motion` **不等于**「关掉所有动效」，而是「不要大幅位移/视差/闪烁」。淡入淡出、颜色过渡、加载指示应当**保留**。
- 装饰性 SVG 要 `aria-hidden="true"` 或 `focusable="false"`。
- 别用 `visibility: hidden` 藏内容后又期望读屏能读；视觉隐藏用 `.sr-only` 那套（`clip-path: inset(50%)`）。

**5. `will-change` 滥用**
- `will-change` 是**性能提示不是加速开关**：它让浏览器提前提升为合成层并常驻显存。加在多个元素上会直接爆显存、整体更卡。
- 正确用法：**交互开始前加、结束后删**。
```js
card.addEventListener('pointerenter', () => card.style.willChange = 'transform');
card.addEventListener('pointerleave', () => card.style.willChange = 'auto');
```
- 现代浏览器对 `transform`/`opacity` 动画会自动提升合成层，**多数情况下根本不需要写 `will-change`**。
- 不要写 `will-change: filter`、`will-change: background-position`、`will-change: top`（等于要求一直重绘）。
- 一次性入场动画**不要**加 `will-change`，动画结束它就没有价值。
- 调试：DevTools → Rendering → "Layer borders" 与 "Paint flashing"，能直接看到你造了多少合成层 / 是否满屏重绘。

**6. `filter: blur` 的开销**
- 成本与**元素像素面积 × 模糊半径**相关，且**每次重绘都要重算**。
- **绝不要动画 `blur()` 的半径**（`blur(0)→blur(8px)` 这类逐帧重算模糊核）。ReactBits 的 `Blur Text`、`Split Text`、Aceternity 的 `Text Animation Blur Fade In` 都是模糊动画——**短文本可以，正文不要**。
- 大面积极光/光斑：把模糊层做**小**（如 600×600）再 `transform: scale(2)`，成本按小尺寸算。
- 或改用 `radial-gradient` 直接画柔边（零滤镜成本）——**这是最被低估的替代方案**，90% 的「柔光」用渐变就能做出来。
- `backdrop-filter` 比 `filter` 更贵（要采样背后整片内容），见配方 9。
- 副作用：创建包含块（后代 `fixed` 失效）、创建层叠上下文（`z-index` 行为变化）、拍平 3D（`preserve-3d` 失效）。

**7. 合成层与层叠上下文**
- `transform`（非 none）、`filter`、`opacity < 1`、`backdrop-filter`、`will-change`、`isolation: isolate`、`mix-blend-mode` 都会**创建新的层叠上下文** → 该元素内的 `z-index` 只在其内部有意义。这是「z-index 设了 9999 还是不显示」的头号原因。
- `mix-blend-mode` 会与**整个层叠上下文**混合，不只是视觉相邻元素 → 用 `isolation: isolate` 把混合范围限制在卡片内。
- 层数不是越多越好：每层都有合成开销。**同屏动画元素控制在 20–30 个以内。**

**8. 其它（含最容易忽略的一条）**
- **不要依赖 JS 才能看见内容**：所有入场动画的初始态都要有「JS 没跑起来」的兜底 —— `<html class="no-js">` + 脚本第一行 `document.documentElement.classList.remove('no-js')`，CSS 写 `.no-js [data-reveal]{opacity:1;transform:none;filter:none}`。**脚本 404 或被 CSP 拦截时，否则整页空白。**
- **打印**：`@media print { .aura,.beam,.spot,.meteors,[data-aura] { display: none } }`，否则彩色大块会印出来。
- **强制颜色模式**（Windows 高对比度）：`@media (forced-colors: active)` 下 `color: transparent` 的文字会消失，必须还原。
- **透明偏好**：`prefers-reduced-transparency` 支持很少（**不确定**），用 `@supports not (backdrop-filter: ...)` 做能力降级更实际。
- **`mask-composite` 双写法**：`-webkit-mask-composite: xor`（旧 WebKit）+ `mask-composite: exclude`（标准）。
- **`100vh` 陷阱**：移动端地址栏导致高度跳变，`sticky` / 全屏 hero 会抖。
- **浏览器缩放**：`translateZ` 在大缩放下可能有亚像素抖动，`backface-visibility: hidden` 有缓解作用。

## C-4 建议的落地骨架（放进 `<head>` 最前的公共 CSS）

```html
<html class="no-js">
<script>document.documentElement.classList.remove('no-js');</script>
```
```css
*,*::before,*::after{box-sizing:border-box}
/* 1. 全局尊重系统偏好；需要保留信息的动效（如加载指示）单独恢复 */
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
  .sbtn[data-state="loading"]::after{animation-duration:1.2s!important;animation-iteration-count:infinite!important}
}
/* 2. no-js 兜底：脚本没跑起来时，内容必须可见（最容易忽略、后果最严重） */
.no-js [data-reveal],.no-js .split .ch,.no-js .gen .w{
  opacity:1!important;transform:none!important;filter:none!important}
```
通用动效类 `.reveal`、`:focus-visible`、打印隐藏规则分别见 A1-9、C-3 第 3 条、C-3 第 8 条。

**验收清单（改完自测这 7 条）**
1. 关掉 JS，或让脚本 404，页面内容是否完整可见？
2. 系统开启「减少动态效果」后，是否还有位移/视差/闪烁？加载指示是否仍在工作？
3. 只用键盘 Tab 一遍，焦点是否始终可见且顺序正确？
4. 用读屏（NVDA/VoiceOver）读一遍，切分过的标题是否通顺、不重复？
5. DevTools Performance 录 5 秒滚动，有长任务或持续重绘吗？Rendering 面板的 "Paint flashing" 是否满屏绿？
6. 手机上打开，发热是否明显？（重点看 `filter: blur` 与 `backdrop-filter`）
7. 切到别的标签页时，无限动画是否停了？

## 附：未确认事项

**未确认项汇总**（落地前请自行确认）：
- `@property`、`offset-path: path()`、`animation-timeline: scroll()`、`document.startViewTransition()`、`100svh`、`prefers-reduced-transparency` 的具体浏览器版本边界。
- Aceternity 的 `background-beams-with-collision` 碰撞实现方式，以及 `Layout Grid` 点击重排后是否保留阅读顺序（原版基于 framer-motion `layout`，原生复刻需自己保证）。
- ReactBits `Animations` 分类里的 WebGL 项（`Splash Cursor`、`Meta Balls`、`Metallic Paint` 等）是否都有非 WebGL 降级路径——从描述看没有。
