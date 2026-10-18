# 三站动效/交互逆向研究报告

目标：把 `mathis-biabiany.fr`、`www.hatom.com`、`retronovaworld.webflow.io` 的入场、文字揭示、滚动联动、跑马灯、hover/指针、页面切换、缓动时长、reduced-motion 拆到可抄的数值级，再给一个「主页 + 校验页」的中文静态站产出 13 个落地动画点。

抓取方式：三站都是 JS 渲染，`web_fetch` 只拿到空壳。全部结论来自 PowerShell `Invoke-WebRequest` 直取的原始 HTML/CSS/JS bundle，证据在 `docs/_raw/`（文件级对照见 `docs/_raw/EVIDENCE-INDEX.md`）。没读到的写「未核实」，不编。

## 0. 方法与证据

### 0.1 抓取坑（含一个必须避开的编码陷阱）

```powershell
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
function Grab([string]$url,[string]$dest){
  $full = Join-Path (Get-Location) $dest; $dir = Split-Path $full -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  for ($t=1; $t -le 3; $t++) { try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 120 -MaximumRedirection 10 `
           -Headers @{ 'User-Agent'=$ua; 'Accept'='*/*' }
      $c = $r.Content
      if ($c -is [byte[]]) { [System.IO.File]::WriteAllBytes($full,$c) }   # 类型分支必需
      else { Set-Content -LiteralPath $full -Value $c -Encoding UTF8 -NoNewline }
      "OK $dest $((Get-Item $full).Length)"; return
    } catch { if ($t -eq 3) { "ERR $dest $($_.Exception.Message)" } else { Start-Sleep -Milliseconds 900 } } } }
```

1. `mathis-biabiany.fr` **308 跳到 `www.` 前缀**，`-MaximumRedirection` 对 308 无效 —— 必须直接用 `https://www.mathis-biabiany.fr/`。
2. `$r.Content` **可能是 `byte[]` 也可能是 `string`**，直接 `WriteAllBytes` 会抛「无法将值…转换为类型 System.Byte[]」。
3. **Webflow 的交互数据不在页面里**。retronova 的 HTML 既无 `data-wf-ix` 也无 `actionLists`，IX2 时间轴藏在延迟加载的 `webflow.schunk.1e7857a7fd3f420f.js`（190,270 B）的模块 `2634`，入口 `Webflow.require("ix2").init({...})`。
4. **读写这些 bundle 时必须显式指定 UTF-8**：用 `[System.IO.File]::ReadAllText($p, (New-Object System.Text.UTF8Encoding($false)))`。Windows PowerShell 的 `Get-Content -Raw` 默认按 ANSI(936) 解码，再 `Set-Content` 写回会造成**不可逆的中文丢字**（本次已踩到并重写修复）。

### 0.2 证据与可信度

| 文件 | 大小 | 内容 |
| --- | --- | --- |
| `mathis/B3vIl35b.js` | 12,835 B | `MaskLoading` 加载器，全部时序常量 |
| `mathis/CS6uuomF.js` | 277,363 B | `createMagneticField` 磁性、环境音、CSS 注入 |
| `mathis/BnDfst1Q.js` | 40,804 B | HomeNav 滚动隐藏、HomeHero 揭示、卡片 3D tilt |
| `mathis/CBVoH9vm.js` | 1,557,066 B | WebGL 墨迹 intro（`playInkIntro`、maskPr） |
| `mathis/entry.css` / `index.html` | 44,091 / 41,571 B | 全部 transition / 内联 style / SSR DOM |
| `hatom/index.html` | 264,525 B | SSR DOM + 内联组件 CSS（含 loader 全样式） |
| `hatom/BNoWhy3H.js` | 427,806 B | WebGL 光标、Loader 组件、Lottie |
| `hatom/DzIV7Ypb.js` | 3,227,119 B | 主包：GSAP、Lenis、SplitText、全部 reveal |
| `hatom/BwkFD7S1.js` | 10,451 B | `Animate` 库 + 24 条缓动 + `InteractionController` |
| `hatom/Dfrb24yg.js` | 19,756 B | `FocusBtn`、`GradientBtn`、`GlitchTitleElt`、`HomePage` |
| `hatom/entry.css` + `HomePage.css` | 167,290 + 66,208 B | 全站 transition / focusButton 光点与 SVG 划线 |
| `retronova/index.html` | 105,950 B | 预载 DOM、7 个内联 style、全部 inline script |
| `retronova/webflow.schunk.1e7857a7fd3f420f.js` | 190,270 B | **IX2 时间轴全量**（15 条 actionList） |
| `retronova/webflow.shared.css` | 378,429 B | Webflow 主样式 |
| `retronova/` 的 `cursor.js` `hover-terminal.js` `random.js` `loading_bar.js` `script.js` `footer.js` `noscroll.js` | 418–5,414 B | 光标状态机 / scramble / 入场乱序 / 进度条 / Flip / clip-path / 解锁滚动 |

- **A 级（源码直读数值）**：本报告 90% 内容。引用均为证据文件内可检索的字符串。
- **B 级（内联样式快照）**：Webflow IX2 在无头抓取时不执行，`index.html` 保留了 `style="opacity:0"` 这类**初始帧**。能证明「作者打算从哪开始动」，不能证明动画播过。标 `[B]`。
- **C 级（未核实）**：GSAP 内部 transform 管线里的 `skewX` 等词属库代码。三站「随滚动速度 skew」结论见 §4.3。

## 1. 入场（load intro）

### 1.1 mathis —— 数字滚轮 + 词序推进 + WebGL 墨迹遮罩（三段式）

**段 A：`mask-loading` 加载层**（纯 DOM + rAF，无 GSAP）。常量在 `mathis/B3vIl35b.js`（搜索 `loadingMin:2e3`）：

```js
const l = { loadingMin: 2e3, wordMin: 500, roll: 500,
            digitStagger: 80, fadeOut: 900, reducedCrossfade: 400 },
      C = ["Mathis Biabiany", "Crafting immersive", "digital experiences"], R = "#F2EDE3", c = 3;

// startLoop 每帧：帧率无关指数趋近
const s = Math.min(.05, (i - this._lastTime) / 1e3);   // dt 上限 50ms
const o = 1 - Math.exp(-4 * s);                        // 4Hz
this._displayed += (this._target - this._displayed) * o;
if (Math.abs(this._target - this._displayed) < .002) this._displayed = this._target;

// updateLoading 相位判定：四条件与才 fadeOut
const i = e - this._startedAt >= l.loadingMin;                        // 已满 2000ms
const s = this._wordIndex === this.words.length - 1
       && !this.wordCell.rolling && e - this._wordSince >= l.wordMin; // 末句满 500ms
this._hideRequested && this._displayed >= 1 && this._hundredRollFinished
  && !this._digitRollActive && s && i && this.enterPhase("fadeOut", e);

// 数字位错峰：delay = 位序 × 80ms，个位先动、百位最晚
m(d, n, { time: i, delay: a * l.digitStagger, instant: this._reducedMotion });
```

DOM（`create()` 运行时创建，`injectStyles()` 注入样式）：`.mask-loading` 内分 `.mask-loading__word` 与 `.mask-loading__counter`，各含若干 `.mask-loading__roll-cell`，每格内是一条 `.mask-loading__roll-track` 包着**两个** `.mask-loading__roll-item`（`top:0` 与 `top:100%`）。关键 CSS：容器 `position:fixed; inset:0; z-index:10001; background:#F2EDE3; will-change:opacity`；文案 `top:clamp(41px,4.3vw,82px); height:clamp(56px,6.25vw,120px); transform:translateY(-50%)`；计数器 `bottom:clamp(41px,4.3vw,82px); font-size:clamp(56px,6.25vw,120px); font-variant-numeric:tabular-nums`；数字位 `flex:0 0 .65em; width:.65em; height:1em; letter-spacing:-.03em`；轨道 `.mask-loading__roll-track { position:absolute; inset:0; height:100%; will-change:transform }`；容器带 `role="progressbar"` + `aria-valuenow` 实时更新。

源码注释原文：`/* Track height = one cell line so translateY(-100%) moves exactly one step. (A stacked 2-line track would make -100% overshoot by a full extra line.) */` —— **轨道高度必须等于一行，`-100%` 才刚好滚一格**。这是滚轮数字最容易踩的坑。

缓动用贝塞尔数值反解（12 次二分）：`f(t)=M(t,.65,0,.35,1)` 等价 `cubic-bezier(.65,0,.35,1)`（`translateY(-100*f(p)%)`）；`E(t)=M(t,.4,0,.2,1)` 等价 `cubic-bezier(.4,0,.2,1)`（`root.style.opacity = 1 - E(p)`）。词序推进 `loadingWordIndexForProgress(p) = min(len-1, floor(p*len))`：进度 0–33/33–66/66–100% 各一句；`mode:"sequential"` 时单词两段式（先 `translateY(0→-100%)` 滚出，重置到 `translateY(100%)` 再滚入），各占 `roll/2 = 250ms`。淡出时长 `this._reducedMotion ? 400 : 900`；reduced-motion 由构造时 `matchMedia("(prefers-reduced-motion: reduce)").matches` 读取，`m(..., { instant: true })` 让滚轮**直接跳终值**。

**段 B：DOM 揭示**（`mathis/BnDfst1Q.js`）：

```js
// HomeNav.q()  —— 整块一起淡入，无 stagger（选择器 .pm-nav__left/.pm-nav__link/.pm-nav__menu-btn）
if (document.querySelector(".mask-loading")) { clearTimeout(h); h = window.setTimeout(q, 1e3); return; }
if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) { ue.set(e, { clearProps: "opacity" }); return; }
ue.fromTo(e, { opacity: 0 }, { opacity: 1, duration: .5, ease: "power2.out",
  onComplete: () => ue.set(e, { clearProps: "opacity" }) });

// HomeHero._()  m = .pm-hero__title, k = .pm-hero__intro
ue.fromTo(m, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .65, delay: .28, ease: "power3.out" });
ue.fromTo(k, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: .65, delay: .44, ease: "power3.out" });
```

CSS 初始态 `.pm-nav:not(.is-ready) .pm-nav__left, .pm-nav:not(.is-ready) .pm-nav__link { opacity: 0 }`。标题是**整块进**，位移 -12px / -10px，靠 280ms 与 440ms 的 delay 拉开层次；`clearProps` 在结束时把控制权交回 CSS。由 `J.on(Z.HOME_INTRO, _)` 触发，另有 `setTimeout(_, 1e4)` 兜底。

**段 C：WebGL 墨迹遮罩**（`mathis/CBVoH9vm.js`，搜索 `La={maskPr`）：

```js
const La = { maskPr:  { duration: 1.1, ease: "Power2.easeOut"   },
             maskPr2: { duration: .7,  ease: "Power3.easeInOut" },
             maskPr3: { duration: .45, ease: "Power2.easeOut"   } };
```

`playInkIntro()` 的 reduced 分支：三段 mask 参数置 0、`_bootCameraGate.value = 1`、立即 `queueMicrotask(() => Ue.emit(Ke.HOME_INTRO))`。**未核实** `maskPr` 在 GLSL 里的确切语义。

**段 D：CSS keyframe**（`entry.css`）：`.pm-about__pile-img { animation: pm-about-pile-in .45s cubic-bezier(.2,.9,.25,1.15) backwards }`，其 `0%` 为 `opacity:0` + `translate(calc(var(--pile-x)*var(--pile-card-w)), …) rotate(calc(var(--pile-r) - 6deg)) scale(.82)`。`cubic-bezier(.2,.9,.25,1.15)` 是**过冲曲线**（y2 > 1），全站唯一。

### 1.2 hatom —— 资源权重进度条 + SVG 彩蛋 + 点击进入

`Loader` 组件在 `hatom/BNoWhy3H.js`（搜索 `moveToPercent`）。SSR DOM：`.loader` 是固定全屏白幕（`z-index:1`、`pointer-events:none`、`transition: visibility 0s .7s`），内含 `Loading 5 phases`、两个 `loader__counter`（上「0」，下三态：`hidding → " 100 "` / `progressComplete → "Click to enter"` / 否则百分比）、中央 `svg.egg`（124×163，含 `mask` 与长 `path`）、底部 `headphones` 文案、以及 `<video class="loader__video" muted playsinline>`。关键 CSS：`gap:5.5555555556vw`（= 1440px 稿下的 `80/1440`，2880 封顶 160px、600 降到 60px）、`.loader__video { mix-blend-mode:darken; width:min(27.7777777778vw,30%); transform:translate(-50%,-50%) }`、`.loader__counter { font-size:.625vw; letter-spacing:.1388888889vw; text-transform:uppercase }`。

**进度公式按字节加权，不是按文件数**：

```js
function E(){ const d = t.resourceFileSize; let N = 0;              // 进度 = 字节加权
  for (const q in d) N += d[q];                                     // 总字节数
  const K = et._resourceLoader._resourcesToPreload; let ce = 0;
  for (let q = 0; q < K.length; q++) { const L = K[q], H = L.type === "gltf";
    const U = H ? (M.loaders.gltf.progresses[L.path] || 0) : (M.cache.includes(L) ? 1 : 0);
    ce += U * (Yi[L.path] / N); }                                   // 该资源权重
  g.value = ce; }
function _(){ b.value += (g.value - b.value) * .1;                  // 10% 线性趋近（作者的简版）
  if (v.value) b.value = g.value;
  f.value && Math.abs(b.value - g.value) < .001 && g.value >= 1
    ? (f.value = false, S()) : f.value && (x.value = un(b.value + .003, 3)); }
F(x, d => { e.value.moveToPercent(Math.floor(d * 4) / 4 + 1e-4) });   // 量化到 1/4
Math.floor(oe(x) * 100)
```

`_resourcesFileSize` 最大几个：`master-scene-compressed.glb` 8,991,464；`egg/normal_low.png` 615,256；`water-normal.jpg` 334,428；`egg/ao.png` 238,525。9MB 的 glb 独占约 90% 权重，所以不会在加载 30 张小贴图时虚报。彩蛋只在 **0 / 25 / 50 / 75 / 100%** 五个台阶变化；`+1e-4` 让 `moveToPercent(0)` 也触发。

```js
function S(){ setTimeout(() => { r.updateMainLoader({ progressComplete: true });   // "Click to enter"
  Ao(() => { p() }); }, 500); }                                                     // 停 500ms
function p(){ const d = ae.timeline(); d.add(e.value.fadeOut(), 0);          // 彩蛋 fadeOut
  d.set(o.value, { background: "none" }, 0);                                // 白幕背景立刻撤
  d.call(() => i.value.play(), null, .3);                                   // video 0.3s 起播
  d.add(n.viewManager.showView1("home"), 0); }                              // WebGL 同帧启动
function y(){ const d = ae.timeline();                                      // 真·离场
  d.call(() => { r.updateMainLoader({ hidding: true }); }, null, 0);
  d.to(o.value, { autoAlpha: 0, duration: 1 }, 0);     // 白幕 1s 淡出
  d.to(i.value, { autoAlpha: 0, duration: 1 }, 0);     // 视频同步 1s 淡出
  d.call(() => { r.updateMainLoader({ visible: false }); }, null, 2.3); return d; } }
window.addEventListener("click", D);   // D() 只在 progressComplete && 彩蛋就位时才调 y()
```

**两个 1s 淡出严格同步**（同时间轴位置 0）是「白幕 + 中央视频一起化开」的手感来源；`visible:false` 放在 2.3s，只控制 DOM 挂载。

### 1.3 retronova —— Webflow IX2 22 组时间轴 + 自绘进度条

```html
<body data-barba="wrapper" class="body noscroll"><div data-barba="container" class="home_wrapper">
 <div id="custom-cursor" class="custom-cursor"><div class="cursor-text">[VIEW COLLECTION]</div></div>
 <header id="preloader" data-w-id="1e81328e-…b902" style="display:block;opacity:1" class="preloader">
  <div data-w-id="…78ed" style="opacity:0" class="awwwards_hm">…</div>
  <div class="grain-overlay is-hero is-preloader"></div>
  <div class="container-large"><div id="preloader_content" class="preloader_content">
   <div class="preloader_top">…</div>                    <!-- 四角 mono 文字，均 style="opacity:0" -->
   <div class="progress_wrapper">
    <div data-w-id="…b924" style="transform:… scale3d(1, 0, 1) …" class="progress_bar">
     <div data-w-id="…b92e" class="progress_empty"><div data-w-id="…b92f" class="progress_full"></div></div></div>
    <div class="progress_counter"><div data-w-id="…b931" style="opacity:0" class="loading_text">0%</div></div></div>
   <div class="progress_message content__section"><div data-w-id="…b934" style="opacity:0"
        class="text-style-support-small is-loader is-orange is-random">&lt;unable to cancel&gt;</div></div>
  </div></div>
  <div class="preloader_bottom"><a data-w-id="799c8d16-…" style="opacity:0" href="#" class="skip_button is-button">
    <div class="text-style-support-small is-skip">SKIP LOading</div></a></div>
 </header>
```

```css
.progress_empty { border:1px solid var(--golden-bell); width:20vw; height:1vw; position:relative; overflow:hidden }
.progress_full  { background-color:var(--golden-bell); width:0%; height:1vw; position:absolute; inset:0% }
.progress_counter { text-align:left; width:4vw }
@media (max-width:991px){ .progress_empty{width:33vw;height:1.5vw} .progress_full{height:1.5vw} .progress_counter{width:5vw} }
@media (max-width:479px){ .progress_empty{width:33vw;height:2vw}   .progress_full{height:2vw}   .progress_counter{width:7vw} }
```

`overflow:hidden` + 内条 `width:0 → 100%`，**不是 `scaleX`**；IX2 的 `scale3d(1,0,1)` 是另一套初始帧。绑定（搜索 `"e-4"`）：`eventTypeId:"PAGE_START"` → `actionListId:"a-4"`，`mediaQueries:["main","medium","small","tiny"]`。

**IX2 时间轴 `a-4`（22 组）**，来源 `retronova/webflow.schunk.1e7857a7fd3f420f.js`：

- **第 1 组（初始归零，全部 `duration:500, delay:0, easing:""`，约 50 条）**：`…b902`（preloader）`DISPLAY→block` + `OPACITY→1`；`…b90d/b910/b913/b91b/b91e/b909/b917` 全 `OPACITY→0`；`…b92d` `SCALE{x:0,y:1}`；`…b924` `SCALE{y:0}` + `OPACITY→0`；`…b926`/`…b934` `OPACITY→0`；`…e561` `MOVE{y:-5}`；`…e566` `MOVE{x:0,y:3}`；`…e577/e57a/e57d` `MOVE{y:100}`；`…e560` `SCALE{1.3,1.3}`；`…e56a` `ROTATE{z:90}`；`…e56e` `ROTATE{z:-90}`。
- **第 2 组（`outExpo`）**：`…78ed` d=200 dur=300；`…b909` d=300 dur=300；`…b917` d=300 dur=300 → 均 opacity 1。
- **第 3 组 —— 四角文字 100ms 阶梯（「逐个进」）**：`…b90d delay=0 / …b913 delay=100 / …b910 delay=200 / …b91b delay=300 / …b91e delay=400`，各 `dur=400 outExpo`；`…14c6 delay=500 dur=200`（sound_advice）；`…5fe8 delay=600 dur=500`（skip_button）。交错偏移 100ms、单项 400ms → **单项重叠 75%**，序列总跨度 1100ms。
- **第 4–6 组**：`…b924` d=0 dur=300 outExpo（`OPACITY→1` + Y 轴 scale 回 1）；`…b926`/`…b92a` d=100 dur=500、`…b934` d=200 dur=500 → 1（linear）；`…b92d` d=0 dur=400 outExpo opacity→1 / d=0 dur=500 scale；`…b931` d=0 dur=500 opacity→1（`0%` 文本）；`…b92a` d=0 dur=200 outExpo → 1。
- **第 7–18 组**：`…b92a` 与 `…b926` 交替 `0.4 ⇄ 1`，每组 `dur=200 linear`。**12 组 × 200ms = 2400ms 的 200ms 周期闪烁** —— 没用 CSS keyframes，而是 IX2 硬排 12 组，视觉等价 `animation: blink 400ms steps(1) infinite alternate`。
- **第 19 组**：`delay=200` 全站配色切换（`BACKGROUND_COLOR`/`BORDER`/`TEXT_COLOR`/`FILTER`），大多 `dur=100`，进度条底 `dur=500`，`…b934` opacity→0；`FILTER val=100` 是 `brightness(100%)`。
- **第 20 组**：`…b902` `OPACITY` d=0 dur=300 `inOutCubic` → 0；`…e560` d=0 dur=100 `inOutQuart` → 1。
- **第 21 组（主揭示）**：`DISPLAY …b902 d=200 → none`（白幕从 DOM 移除）；`SCALE …e560 d=200 inOutQuart`；`OPACITY …e59f d=600 dur=700 inSine → 1`（+ `DISPLAY→block`）；`MOVE …e57d d=700 dur=900 inOutQuint`（+ `OPACITY→1`）；`MOVE …e566 d=800 dur=600 inSine`；`OPACITY …e56e / …e56a d=800 dur=700 inSine → 1`；`MOVE …e56e d=800 dur=600 inSine`；`OPACITY …e561 d=800 dur=600 inSine → 1`（+ `MOVE`）；`ROTATE …e56a / …e56e d=800 dur=600 inSine`；`OPACITY ldff2c62 d=800 dur=600 inSine → 1`（+ `DISPLAY→block`）；`OPACITY 22a6…23ba d=800 dur=500 → 1`；`MOVE …e57a d=800 dur=900 inOutQuint`（+ `OPACITY→1`）；`OPACITY cb3a…612391 d=900 dur=400 inSine → 1`（+ `DISPLAY→block`）；`MOVE …e577 d=900 dur=900 inOutQuint`（+ `OPACITY→1`）。**delay=200 白幕走 → 600/700/800 分三批内容 → 900 最后一批；批量间隔 100ms，批内位移 900ms、opacity 700ms。**
- **第 22 组（收尾 ×4）**：`TRANSFORM_MOVE d=100 dur=500 outQuart` + `STYLE_OPACITY d=100 dur=300 outExpo → 1`。

```js
// retronova/loading_bar.js 全文（进度条覆盖 IX2）
var e = document.querySelector(".progress_full"), n = document.querySelector(".loading_text"),
    t = gsap.timeline({ delay: 2.7 });
t.to(e, { width: "100%", duration: 3, ease: "power1.inOut" });
t.to(n, { innerHTML: 100, duration: 3, ease: "power1.inOut", snap: { innerHTML: 1 },
  onUpdate: function () { n.innerHTML = Math.round(n.innerHTML) + "%" } }, "-=3");
```

起始延迟 **2.7s**、时长 **3s** → 进度条在 2.7s → 5.7s 填满；`snap:{innerHTML:1}` 输出整数；`"-=3"` 让百分比与宽度**完全同步**。**强制解锁**（`retronova/noscroll.js`）：`gsap.to(".preloader", { opacity: 0, duration: .5, … })` 绑定 `SKIP` 按钮，并 `setTimeout(o, 7400)`（2.7s 延迟 + 3s 进度 + 1.7s 余量）。`index.html` script#18 另用 `MutationObserver` 监听 `page-wrapper` 的 `style.display` 变 `none`，把 `height` 从 `100vh` 改成 `auto`、`overflow` 改成 `visible`。

### 1.4 三站入场对比

| 维度 | mathis | hatom | retronova |
| --- | --- | --- | --- |
| 加载层 | `#F2EDE3` 白幕 + 左上滚动词 + 左下 3 位滚轮 | `#fff` + 中央 SVG 彩蛋 + 上下 mono 字 + 中央 video | `--background` + 四角终端文字 + 中央进度条 |
| 层级 | `z-index:10001`，`role="progressbar"` + `aria-valuenow` 实时 | `z-index:1`，`pointer-events:none` | `z-index:10`（`load_grid` 是 10000） |
| 进度来源 | 真实 + 平滑 + 硬下限 2000ms | **按资源字节加权** + 量化到 1/4 | 假的固定 3s + `delay 2.7s` |
| 数字动效 | **滚轮**（500ms / stagger 80ms） | 无（`fade-global` 交叉淡入） | 整数跳（`snap:{innerHTML:1}`） |
| 出场 | `fadeOut 900ms`，`cubic-bezier(.4,0,.2,1)` | `autoAlpha 1s`，白幕与视频同步 | IX2 组 20–22 |
| 兜底 | 条件与（非纯计时） | 点击加速 + `progressComplete` 门控 | `setTimeout(o, 7400)` |
| reduced-motion | 全套降级 | **无** | **无** |

## 2. 标题与正文揭示

### 2.1 mathis —— 整块进，不拆字符

`HomeHero._()` 见 §1.1：整块（`<h1 class="pm-hero__title">` 是一个节点），`translateY(-12px) + opacity`，`.65s power3.out`，delay `.28s/.44s`。**没有 overflow 遮罩、没有 clip-path、没有 blur**；stagger 不存在，用固定 delay 差 160ms 代替层次。唯一的文字内容错峰在菜单弹层（`entry.css`）：

```css
@keyframes pm-menu-content-in { 0% { opacity:0; transform: translateY(18px) } to { opacity:1; transform: translateY(0) } }
.pm-menu-enter-active .pd-menu__footer, .pm-menu-enter-active .pd-menu__label,
.pm-menu-enter-active .pd-menu__list li, .pm-menu-enter-active .pd-menu__top {
  animation: pm-menu-content-in .55s cubic-bezier(.22,1,.36,1) both; }
.pm-menu-enter-active .pd-menu__label        { animation-delay: .12s }
.pm-menu-enter-active .pd-menu__list li:first-child  { animation-delay: .16s }
.pm-menu-enter-active .pd-menu__list li:nth-child(2) { animation-delay: .2s }
.pm-menu-enter-active .pd-menu__list li:nth-child(3) { animation-delay: .24s }
.pm-menu-enter-active .pd-menu__list li:nth-child(4) { animation-delay: .28s }
```

`translateY(18px)`、`0.55s`、`cubic-bezier(.22,1,.36,1)`、**stagger 40ms**、起始延迟 120/160ms。**行粒度 = DOM 子元素粒度（`li`），不是逐字符。** reduced 降级用 `transition-duration: .01ms` 而不是 `none` —— **保留 `transitionend` 派发**，同时 `animation: none`。

### 2.2 hatom —— 逐行 + 逐词两个层级

**逐行揭示**（`hatom/DzIV7Ypb.js`，搜索 `remap(De/re.lines.length`）：

```js
for (const De of re.lines) De.style.willChange = "transform";
Ce.from(re.lines, { y: De => remap(De / re.lines.length, [0, 1], [20, 50]),
  ease: "power3.out", duration: 1.4, stagger: $.value.stagger }, 0 + $.value.delay);
Ce.from(re.lines, { opacity: 0, ease: "power2.out", duration: 2, stagger: $.value.stagger },
  0 + .4 + $.value.delay);
```

**全报告最值得抄的一段**：位移量随行号递增 `y = remap(lineIndex / lineCount, [0,1], [20, 50])` —— 第 0 行抬 20px、最后一行抬 50px，**下面的行「追」得更远**，视觉上像整段文字从下方翻上来。位移是 `1.4s power3.out` 在 `0+delay`，透明度是 `2s power2.out` 在 `.4+delay`：**透明度更长更晚**。

**逐词 + clip-path 箭头**（`GradientBtn`，`_e = .35`）：默认文字 `opacity 0→1`（`_e`）、hover 文字 `opacity 1→0`（同 `_e`）构成交叉；旧箭头 `{ clipPath: "inset(0% 0% 0% 0%)", transform: "translate(0px, 0px) scale(1)" }` → `{ clipPath: "inset(0% 0% 0% 100%)", transform: "translate(6px, -6px) scale(2)", duration: .125, ease: "sine.in" }`；新箭头 `{ clipPath: "inset(0% 100% 0% 0%)", … }` → `{ clipPath: "inset(0% 0% 0% 0%)", transform: "translate(0px, 0px) scale(1)", duration: .125, ease: "power2.out" }` 延迟 `.125`。上下两条共 250ms；`inset(0% 0% 0% 100%)` = 只留左侧 0 宽，**clip-path 擦除的通用写法**。4 倍变体：`scale(4)` + `translate(8px,-8px)` + `duration:.2 sine.in`。

**行内文字换字**：`SplitText(type:"words")`，`stagger:"0.04"`（**GSAP 字符串形式 = 绝对秒数 40ms**，与数字形式的「总时长按权重分配」不同），位移 `(0,-6)` 或 `(-5,5)`，回位 `.2s power2.out`，颜色 `#000000 .4s power2.in`。

**GlitchTitleElt**（`hatom/Dfrb24yg.js`）：`new Ae(c.value, { type: "words" })` 后 `[...g.words].reverse()`（最后一词先动），位移 `(±30,-30)`、`2s power4.out`、`stagger .04s`，整条时间线 `timeScale(2)`（实际 1s）、`delay:.85s`；**黄色高亮瞬时加、错峰减**（`add("yellow")` 在 0，`remove` 在 `.4 + .02*i` → 第 0 词黄 400ms、第 5 词黄 500ms，高亮扫过）；`opacity 0→1` 用 `duration:.01` + `stagger:.02`（先跳出来后滑入）。`MenuContentElt` 同款但 `delay 1.1s`、`stagger .08s`、黄色消退间隔 50ms。

hover 逐字符变色：`SplitText({type:"chars"})`，颜色 `#C1FF12` `stagger .03 duration .5` 在 `.1`，位移 `x:-20→0` `stagger .02 duration .8 power2.out` 在 `0`，opacity `.6s` 在 `0` —— **颜色 stagger 30ms 与位移 20ms 不同步**。移出时 `m.killTweensOf(n.chars, "color")` 再 `to(color)` 0.3s，**先杀颜色 tween 再反向**，避免从中间值突变。

### 2.3 retronova —— 分割在 JS 里，逐字符 span

`retronova/cms_span.js` 把 `%%...%%` 包成 `.is-cms-desc`，再把其中每个字符包成 `<span class="char">`。`retronova/random.js` 做入场字符乱序复位：

**规格**：每字符 9 步 × 80ms → 单字符 **720ms**；起始随机延迟 `Math.random() * 2000` ms；触发 `IntersectionObserver`，`threshold: 0.5`，容器 `.content__section`，一次性 `dataset.animated`。**这是 `setTimeout` 链而非 rAF**，9 层嵌套 × N 字符。`hover-terminal.js` 另有 GSAP 版（见 §5.3）。

## 3. 跑马灯 / 滚动字幕

### 3.1 retronova —— 唯一的真·CSS 跑马灯

来源 `retronova/index.html` 内联 `<style>`（搜索 `@keyframes scroll`）：

```css
@keyframes scroll { from { transform: translateX(0) } to { transform: translateX(calc(-100% - 4rem)) } }
.scroll  { animation: 13s linear infinite scroll }
.reverse { animation-direction: reverse }
.retro-inspired_marquee   { grid-column-gap: 4rem; grid-row-gap: 4rem; justify-content: flex-start; align-items: center; display: flex }
.ai-wonders-intro_marquee { grid-column-gap: 4rem; grid-row-gap: 4rem; justify-content: flex-start; align-items: center; display: flex }
```

时长 **13s**、`linear`、`infinite`、缺口 **4rem**、方向反转靠 `animation-direction: reverse`。**`translateX(-100% - 4rem)` 里的 `4rem` 与父容器 `gap: 4rem` 必须同一个值**，否则接缝会跳 —— 这是无 JS 跑马灯唯一的硬约束。

CRT 扫描线叠层（同内联 style）：`background: linear-gradient(#fbf6c0, #fbf6c0 3px, transparent 0, transparent 9px); background-size: 100% 7px; opacity: .05`，配 `@keyframes scan-overlay { 0% { background-position: 0 0 } 100% { background-position: 0 -100% } }` 与 `animation: scan-overlay 16s linear infinite` —— **16s 走一整屏**。页脚滚动触发的 SVG 多边形 `clip-path`（`retronova/footer.js`）：100+ 顶点的「撕纸边」多边形；触发 `footer.getBoundingClientRect().top <= 0.1 * innerHeight`；过渡只有 `opacity 0.4s ease-in`，**`clip-path` 本身瞬切无 transition**；滚动监听**无节流**（可优化点）。

### 3.2 mathis 与 hatom —— 都没有跑马灯

实测：mathis 的 `entry.css` 与 `index.html` 中 `marquee` 各 **0** 次；hatom 全部 JS 与 CSS 中 `marquee` **0** 次。两站**未核实存在任何跑马灯**。mathis 的替代品是 `.pm-showreel` 的 sticky 钉住段（§4.4），hatom 的是 Lenis 驱动的纵向 scroll-jacking（§4.2）。

## 4. 滚动联动

### 4.1 mathis —— 方向感知导航 + 卡片 3D tilt

```js
const Ye = 12, Et = 80;
function O(){
  if (!d.value || _.value) { m.value = false; E = window.scrollY; return; }
  const e = Math.max(0, window.scrollY);
  if (e <= Et) { m.value = false; E = e; return; }      // 前 80px 内永不隐藏
  const l = e - E;                                       // 相对上次「已决策位置」的增量
  l > Ye  ? (m.value = true,  E = e)                     // 向下滚 >12px → 隐藏
  : l < -Ye ? (m.value = false, E = e) : 0; }            // 向上滚 >12px → 显示
```

**双阈值**：`threshold = 12px`（累积位移）、`deadZone = 80px`。CSS：`.pm-nav { transition: transform .35s cubic-bezier(.22,1,.36,1); will-change: transform }`、`.pm-nav--hidden { pointer-events:none; transform: translateY(-120%) }` —— `-120%` 而非 `-100%`，多留 20% 确保下落的描边不露。**卡片指针 3D tilt**（常量 `Vt=9, Xt=7, Bt=22, Yt=6, De=48`）：

```js
const N = Math.max(-1, Math.min(1, (A.clientX - R.left) / R.width  * 2 - 1));  // -1..1
const W = Math.max(-1, Math.min(1, (A.clientY - R.top ) / R.height * 2 - 1));
h.ry =  N * Vt;    // rotateY  ±9°
h.rx = -W * Xt;    // rotateX  ∓7°（取反）
h.tx =  N * Bt;    // translateX ±22px
h.ty =  W * Yt;    // translateY ±6px
h.tz =  De;        // translateZ 48px
```

CSS 基座 `.pm-card__lift { transform: perspective(900px) translateZ(0) rotateY(0); transform-style: preserve-3d; will-change: transform }`；reduced 降级是 `transform: none !important`。媒体图 hover：`filter: brightness(1.07) saturate(1.1); transform: scale(1.145)`，`transition: filter .18s ease, transform .35s cubic-bezier(.22,1,.36,1)`。**未核实** mathis 传给 Lenis 的 `lerp / duration / easing`（`entry.css` 里只有 `.lenis-*` 的 5 条辅助规则）。

### 4.2 hatom —— Lenis 纵向 scroll-jacking：16 个 `lenis-section` 分 5 个 phase

```js
this.lenis = new T({ wrapper: this.elemWrapper, content: this.elemContent,
  syncTouch: true, gestureOrientation: "both",
  lerp: .04, syncTouchLerp: .075, syncTouchInertiaLerp: .075 });     // ← BwkFD7S1.js
```

主站 WebGL 那一路（`DzIV7Ypb.js`）另有 `lerp:.05, wheelMultiplier:1`。共享 Ticker 里 `if (this.autoplay) s = Math.min(150, s)`（**dt 上限 150ms**）、限帧任务 `if (this.autoplay) r = Math.min(e.delta * 5, r)`；`_.add(this._tick, 70)` —— **Lenis 以 70fps 上限驱动**（`delta = 1000/70 ≈ 14.29ms`），比每帧跑更省且在 120Hz 屏上强制一致手感。

长按/位移取消（常量 `b=200, w=100, H=2e3, I=10`）：`_onDown` 里 `this._delayTimer = y(b, this._startHold)`（**200ms 长按**）；`_onMove` 里位移 > `I`（**10px**）即 `_onUp()`。`cancelHold()` 回落 `new m(this, 700, { holdProgress: 0 })` = **700ms**；`enterZoom()` 是 `new m(this, 0, …)` = **瞬时**；`clickZoom()` 是 `this.quickZoom = true; this._startHold(w); setTimeout(() => { this.quickZoom = false }, w + 1)` = **100ms 窗口的「点击即缩放」**。

章节阈值（`useUiStore`）：`sectionLimits: [0, .2, .4, .6, .8]`（5 个 phase 起点）、`sectionEndLimits: [.1, .2, .3, .4, .5, .6, .7, .8]`、`autoplaySectionLimits` 与后者相同。`sectionsInBetween` getter 交错前两者，得到 **`[.1,.2, .2,.4, .3,.6, .4,.8]`** —— 四个过渡带 `[.1,.2] [.2,.4] [.3,.6] [.4,.8]`；落在带内 `isBetweenSections = true`，长按被禁止（`x.setIsPreventHold(t)`）。自动推进与分页吸附：

```js
if (e.home.isAutoplaySection && P.velocity >= 0 && !(e.home.isHold || e.home.isZoom))
  P.scrollTo(P.targetScroll + 40, {});                          // 自动每 tick +40px
const m = t === 0 ? 0 : e.home.autoplaySectionLimits[(t - 1) * 2 + 1];
P.scrollTo(P.limit * m, { offset: t ? 100 : 0, force: true, lock: true, duration: 2 });  // 分页点击
```

滚动速度 → WebGL（不是 CSS skew）：`this._speed = Math.abs(this._lenis.velocity / 1e3); this._speed *= $;` —— **`speed = |velocity| / 1000 × speedMultiplier`**，喂给 fluid/planet 强度。

### 4.3 「随滚动速度 skew」查证结论

| 站点 | 是否有 velocity→skew | 证据 |
| --- | --- | --- |
| mathis | **无**（未核实存在） | `xgxdCp6f.js` 的 9 处 `skew` 全在 GSAP 内部 `_renderCSSTransforms` 的 `skewX/skewY` 管线；站点侧只有指针 tilt |
| hatom | **无**（未核实存在） | 26 处 `skew` 全在 GSAP 库内部；站点侧只有 `velocity/1e3` → WebGL |
| retronova | **无**（未核实存在） | 命中仅在 Webflow 生成的初始内联 transform（`skew(0, 0)`） |

**三个站都没有 `skew = clamp(velocity * k, -m, m)` 这种效果。** 可确认的滚动联动只有 5 类：① 方向感知导航隐藏（mathis）；② sticky 钉住段（mathis）；③ 滚动位置驱动 WebGL 参数（hatom）；④ 滚动位置触发 clip-path 切换（retronova footer）；⑤ Lenis 平滑滚动（hatom 明确 `lerp: .04`）。

### 4.4 mathis sticky 钉住段 + 共享元素（`entry.css`）

```css
.pm-showreel { min-height: 175vh }
.pm-showreel__pin { --pm-showreel-pad: clamp(60px,12vh,160px); position: sticky; top: 0; height: 100vh;
                    min-height: 0; display: grid; place-items: center; width: 100%;
                    padding: var(--pm-showreel-pad) var(--pm-gutter) }
.pm-showreel__frame { position: relative; width: min(1464px, 82vw, calc(177.77778vh - var(--pm-showreel-pad)*2*16/9));
                      aspect-ratio: 16/9; border-radius: 20px; overflow: hidden }
.pm-thumb { position: fixed; z-index: 30; width: 145px; height: 82px; border-radius: 10px; overflow: hidden;
            pointer-events: none; transform-origin: top left; transition: opacity .35s ease }
.pm-thumb.is-morphing { will-change: transform, opacity, left, top, width, height }
```

`min-height:175vh` 容器 + `sticky; top:0; height:100vh` 内层 = **75vh 钉住时长**。`__frame` 宽度三路 `min()`：`1464px`（上限）、`82vw`（视口宽）、`calc(177.77778vh - pad*2*16/9)`（按视口高反算 16:9，`177.77778vh = 1600/9 vh`）—— 窄屏按宽缩、矮屏按高缩，永不溢出。`--pm-thumb-inv-x/y` 是缩放比的倒数，让内容在容器被 scale 时保持字面尺寸（FLIP 之外的共享元素手法）。

## 5. hover 与指针

### 5.1 mathis —— 磁性指针（spring-damper 物理）

来源 `mathis/CS6uuomF.js` 的 `createMagneticField`（bundle 内名 `Bb`，搜索 `strength:.58`）：

```js
const Fb = { radius: 150, strength: .58, rotation: 14, stiffness: .14, damping: .72 };
function Bb(e, t = {}) {
  if (!e || typeof window === "undefined") return () => {};
  const n = matchMedia("(hover: hover) and (pointer: fine)"), r = matchMedia("(prefers-reduced-motion: reduce)");
  if (!n?.matches || r?.matches) return () => {};      // 双重门控：连监听都不挂
  const s = { ...Fb, ...t }; const o = e.style.transform;   // 保存原 transform
  let i = 0, a = 0, l = false, u = 0, c = 0, f = 0, d = 0, h = 0, p = 0, m = 0, S = 0;
  const w = A => { m = 0;
    const R = S ? Math.min(Math.max((A - S) / (1e3 / 60), 0), 2) : 1;   // ① dt 归一化，上限 2
    S = A;
    const N = e.getBoundingClientRect(), I = N.left + N.width / 2 - u, M = N.top + N.height / 2 - c,
          $ = i - I, L = a - M, W = Math.hypot($, L),                    // ②③ 目标偏移与距离
          Q = W > .001 ? Math.atan2(L, $) : 0,
          te = l ? Math.max(0, Math.min(1, 1 - W / s.radius)) : 0,       // ④ 半径内线性衰减
          F  = te * te * (3 - 2 * te),                                   // ⑤ smoothstep
          X  = $ * s.strength * F, G = L * s.strength * F,               // ⑥ 目标位移
          re = (Math.cos(Q) * .85 + Math.sin(Q) * .35) * s.rotation * F; // ⑦ 目标旋转
    d += (X - u) * s.stiffness * R; h += (G - c) * s.stiffness * R; p += (re - f) * s.stiffness * .8 * R;
    const ie = s.damping ** R;                                           // ⑨ 阻尼取幂
    d *= ie; h *= ie; p *= ie; u += d * R; c += h * R; f += p * R; E();
    Math.abs(X-u)+Math.abs(G-c)+Math.abs(re-f)+Math.abs(d)+Math.abs(h)+Math.abs(p) > .02
      ? m = requestAnimationFrame(w)                                     // ⑩ 残差阈值 0.02
      : te === 0 && (u = c = f = 0, d = h = p = 0, S = 0, e.style.transform = o); }; };
```

| 步骤 | 公式 | 说明 |
| --- | --- | --- |
| ① | `R = clamp((now-last)/(1000/60), 0, 2)` | 以 60fps 为 1 单位的帧率归一化 |
| ②③ | `$ = pointerX - (centerX - currentX)`；`W = hypot($, L)` | 指针相对中心的偏移与距离 |
| ④⑤ | `te = clamp(1 - W/radius, 0, 1)`；`F = te²(3-2te)` | `radius=150`；smoothstep 比线性更有磁力场感 |
| ⑥⑦ | `X = $ × strength × F`（`.58`）；`re = (cosθ×.85 + sinθ×.35) × rotation × F`（`14°`） | 方向相关的非对称旋转 |
| ⑧⑨ | `v += (target-current) × stiffness × dt`（`.14`）；`v *= damping^dt`（`.72`） | 幂形式保证帧率无关 |
| ⑩ | 六项残差和 ≤ `0.02` 且 `te === 0` | 归零并恢复原 `transform` |

两处工程细节：`damping ** R` 而非 `damping * R`（60Hz 与 120Hz 手感一致，同 Lenis / UIScrollView 思路）；**开头缓存、停止时还原 `e.style.transform`**，因为写入的是 `${o} ${A}` 前缀拼接，元素原有 transform 不被破坏。调用点参数覆写：环境音开关 `{ radius: 110, strength: .42, rotation: 10 }`（按钮范围收窄、强度降 28%、旋转降 29%）；默认集是给大卡片的。

**链接下划线**（`entry.css`）—— **「下划线擦出」的标准答案**：

```css
.pm-contact__title { --pm-underline-dur: .22s; --pm-underline-gap: .08em;
  transition: opacity .35s ease, letter-spacing .45s cubic-bezier(.22,1,.36,1) }
.pm-contact__title:before, .pm-contact__title:after { content: ""; position: absolute;
  bottom: calc(.05em - var(--pm-underline-gap)); left: 0; width: 100%;
  height: max(2px, .028em); background: currentColor;
  transition: transform var(--pm-underline-dur) cubic-bezier(.65,0,.35,1) }
.pm-contact__title:before { transform: scaleX(1); transform-origin: right center; transition-delay: var(--pm-underline-dur) }
.pm-contact__title:after  { transform: scaleX(0); transform-origin: left  center; transition-delay: 0s }
.pm-contact__title:hover { opacity: .72; letter-spacing: -.045em }
.pm-contact__title:hover:before { transform: scaleX(0); transition-delay: 0s }
.pm-contact__title:hover:after  { transform: scaleX(1); transition-delay: var(--pm-underline-dur) }
```

两条伪元素 `scaleX` 互斥、`transform-origin` 相反；时长 `.22s` + `cubic-bezier(.65,0,.35,1)`；**两个 `transition-delay` 之差造成「先擦掉旧的、再擦出新的」**（延迟 = 对方时长 → 无缝接力）；附带 `letter-spacing -.03em → -.045em`（`0.45s`）与 `opacity → .72`。`height: max(2px, .028em)` 的 2px 下限保证小字号不消失。

其它 hover：`.pm-nav__link { opacity:.9; transition: opacity .25s ease }` → hover `opacity:1`；`.pm-showreel-launch:hover { background: #00000061 }`；`.pm-thumb__close:hover { background: #ffffff47 }`；`.pm-about__bend strong:hover { opacity: 1 }`（`.15s ease`）；`.mediaIcon:hover .mediaIcon--svg path { fill: #c1ff12; animation: fill .5s ease }`。**菜单图标 → X**：两条 `14×1.5px` 横线，`top 5px/11px → 8px` 收拢到中线再各转 ±45°，`0.42s cubic-bezier(.65,0,.35,1)`。

### 5.2 hatom —— `focusButton`：光点 + SVG 划线

DOM：`<div class="focusButton">` 内一个 `<button class="focusButton_text">` + **5 条** `<svg class="focusButton_line focusButton_line-1…3 / -2-out / -3-out" width="127" height="2" viewBox="0 0 127 2"><path d="M0 1H127"/></svg>`。

**光点（两个呼吸点）**：`::before` 是左侧白点（默认 `translate(-.6944444444vw,-50%) scale(1)`），`::after` 是右侧荧光绿点 `#c1ff12`（默认 `scale(0)`）；两者都挂 `animation: blink-* 5s linear 0s infinite alternate`，`box-shadow` 五层 `0 0 1px 1px / 4px 1px / 8px 1px / 16px 1px / 32px 1px`，`width/height: .1388888889vw`，`transition: transform .25s ease`。keyframes 的 6 帧（`0/20/40/60/80/to`）只动模糊半径与 `opacity`（`1 → .7 → .8 → .9 → .7 → 1`），`40%` 帧把 `1px` 逐层压到 `.5px`。**hover 时两点交换**：`::before scale(1→0)`、`::after scale(0→1)`，文字 `translate(.6944vw → 0)`。

**SVG 划线接力**：`.focusButton_line { left:0; width:calc(100% + .69444vw); stroke-width:.0694444444vw; bottom:.4861111111vw; height:.1388888889vw; fill:none }`；`-1` 是静态底线（`stroke:#fff; opacity:.1`）；`-2` / `-3` 与 `-2-out` / `-3-out` 都是 `stroke-dasharray:127`，前两者 `stroke-dashoffset:127`、后两者 `-127`，`-2/-2-out` 用 `#c1ff12`、`-3/-3-out` 用 `#fff`；`-2-out` 带 `transition:all .25s ease .05s`、`-3-out` 带 `transition:all .25s ease 0s`。

```css
.focusButton:hover .focusButton_line-2 { stroke-dashoffset:0; transition: all .25s ease-out }
.focusButton:hover .focusButton_line-3 { stroke-dashoffset:0; transition: all .25s ease-out .05s }
.focusButton:hover .focusButton_line-2-out, .focusButton:hover .focusButton_line-3-out {
  stroke-dashoffset:0; transition: all 0s .3s }                                                /* 延迟 300ms 后瞬跳 */
```

巧妙之处：`stroke-dasharray: 127` **精确等于 `M0 1H127` 的线长**，所以 `dashoffset 127 → 0` 恰好「从右往左擦满」；进/出用不同元素 —— 主段 250ms 擦出（错峰 50ms），`-out` 在 300ms 处瞬时补齐尾巴，形成「电流通过」感。**单位全是 `vw`**：`stroke-width: .0694444444vw`（1440 下 = 1px）、`height: .1388888889vw`（= 2px），2880px 封顶 2px、≤1440px 变 1px。**hatom 全站用 `vw` 当 px 用**（`.0694444444vw = 1/1440`）。

**WebGL 球面光标**（`hatom/BNoWhy3H.js`）：

```js
class ka extends le {                                          // Dot
  constructor(e){ … this._dampFactor = 3; … }
  holdAnimation(){ return ae.timeline().to(this._animation, { scale: 0, duration: 2,  ease: "power2.in" }) }
  releaseAnimation(){ return ae.timeline().to(this._animation, { scale: 1, duration: .5, ease: "power2.in" }) }
  updatePosition(e, i){ const o = .5 - this._config.size / 2;
    this._targetPosition.set(Math.cos(e) * o * i, Math.sin(e) * o * i) }
  update({ time: e, delta: i }){
    const o = 1 - Math.exp(-this._dampFactor * i);              // 帧率无关阻尼
    this.position.x = Lt(this.position.x, this._targetPosition.x, o);
    this.position.y = Lt(this.position.y, this._targetPosition.y, o);
    this.position.z = Math.sqrt(1 - this.position.manhattanLength()) * (.5 - this._config.size / 2);
    this._sprite.scale.setScalar(this._config.size * this._animation.scale); } }
```

`o = 1 - exp(-3 × dt)` 帧率无关；`target = (cosθ × r × n, sinθ × r × n)`；`z = sqrt(1 - |x| - |y|) × n` —— **从 XY 反解 Z 把点压在单位球面**（`manhattanLength()` 是 `|x|+|y|`，省事的伪球面）。光标片元着色器的抗锯齿：`float a = 0.5 - length(vUv - 0.5); a = clamp(a / fwidth(a) + 0.5, 0.0, 1.0);` —— **无分支、屏幕空间一致的圆边缘抗锯齿**。

### 5.3 retronova —— 光标跟随文字 + 逐字符终端 scramble

光标状态机（`retronova/cursor.js`，仅 `innerWidth > 1024` 启用，运行时注入 `* { cursor: none !important }`）：默认 20×20px 圆；悬停 `a, .intro-grid__img` → `40px/40px` 圆 + `boxShadow: 0px 0px 6px <borderColor>`；悬停**非当前**作品图 → `(e.offsetWidth + 20) × 50px`、`borderRadius: 0` 的胶囊，并显示 `.cursor-text`；当前作品图仍用 40px 圆。四套调色板（`body[data-collection]`）：Space Age Glam `#FD8A46` / `rgba(253,138,70,.14)`；Atomic Allure `#F3EDD8` / `rgba(243,237,216,.11)`；Quantum Glamour `#A24EB5` / `rgba(162,78,181,.19)`；Stellar Elegance `#008AA1` / `rgba(0,138,161,.12)`。移动靠 `document.addEventListener("mousemove", o => { r.style.left = o.clientX+"px"; r.style.top = o.clientY+"px"; r.classList.add("show") })`。

光标本体 CSS（`index.html` 内联 style#7）：`position:fixed; width:20px; height:20px; border:1px solid #f3edd8; background:rgba(243,237,216,.11); border-radius:50%; pointer-events:none; transform:translate(-50%,-50%); backdrop-filter:blur(7px); transition: width .2s ease, height .2s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease, border-radius .2s ease; opacity:0` + `.show { opacity: 1 }`。**弱点**：JS 写 `left/top`（触发布局）应改成 `translate3d`。

逐字符 scramble（`retronova/hover-terminal.js`）：

```js
class TextSplitter { split(){ const t = this.element.textContent.split("").map(e => {
    const t = document.createElement("span"); t.textContent = e; return t });
  this.element.innerHTML = ""; t.forEach(e => this.element.appendChild(e)) }
  getChars(){ return Array.from(this.element.querySelectorAll("span")) } }
class TextAnimator { animate(){ this.reset(); const e = this.splitter.getChars();
  e.forEach((e, t) => { const r = e.innerHTML; let n = 0;
    gsap.fromTo(e, { opacity: 0 }, { duration: .03,
      onStart(){ gsap.set(e, { "--opa": 1 }) },
      onComplete(){ gsap.set(e, { innerHTML: r, delay: .03 }) },
      repeat: 3, onRepeat(){ 1 == ++n && gsap.set(e, { "--opa": 0 }) },
      repeatRefresh: true, repeatDelay: .04,
      delay: (t + 1) * .07,                                  // 字符错峰 70ms
      innerHTML: () => lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)],
      opacity: 1 }); }); }
  reset(){ const e = this.splitter.getChars(); e.forEach((e,t) => { gsap.killTweensOf(e); e.innerHTML = this.originalChars[t] }) } }
```

**规格**：字符错峰 `delay = (index + 1) × 0.07s` = **70ms**；`repeat: 3`（共 4 帧）每帧 `.03s`、帧间 `repeatDelay: .04s` → 单字符 `4×.03 + 3×.04 + .03 ≈ .27s`（不含错峰）；触发 `mouseenter` on `.list__item` / `.text-shuffle`。`DOMContentLoaded` 时页面首个 `.text-shuffle`（`index.html` 里出现 **93 次**）自动跑一次。作品图 hover：`gsap.fromTo(e, { filter:"brightness(100%) hue-rotate(0deg)" }, { duration:1, ease:"power4", filter:"brightness(200%) hue-rotate(130deg)" })` —— 亮到 2 倍、色相狂转 130°。另有 `cms_boxshadow.js` 的 `transition = "box-shadow 0.3s ease-in-out"` + `boxShadow = 0px 0px 6px <collectionColor>`。

## 6. 页面切换

### 6.1 mathis 与 hatom：逐字节相同的过渡曲线

```css
.fade-global-{enter,leave,appear}-active { transition: opacity .3s cubic-bezier(.445,.05,.55,.95) }
.fade-global-{enter,leave,appear}-from   { opacity: 0 }
.fade-global-successive-enter-active { height:100%; left:0; position:absolute; top:0; width:100%;
  transition-delay: .4s; transition: opacity .3s cubic-bezier(.445,.05,.55,.95) }
.fade-global-over-{enter,leave,appear}-active { transition: opacity .6s cubic-bezier(.445,.05,.55,.95) }
.fade-global-over-appear-active { transition-delay: .1s }
.page-default-transition-{enter,appear}-active { transition: opacity .7s cubic-bezier(.445,.05,.55,.95) }
.page-default-transition-leave-active { transition: opacity 0s linear }   /* 关键：旧页面瞬走 */
.show-now .page-default-transition-{enter,appear}-active { transition-delay:0s; transition-duration:0s }
```

**`leave: 0s linear` 是关键** —— 旧页面**瞬间消失**，新页面 700ms 淡入，观感不是「交叉溶解」而是「旧的立刻走、新的缓缓来」，避免两层内容叠加的透明度污染。`fade-global-successive-enter-active` 的 `transition-delay: .4s` + `position:absolute` 是「等上一屏离场走完 400ms 再进」。hatom 的 `entry.css` 统计完全一致：`cubic-bezier(.445,.05,.55,.95)` **60 次**，`HomePage.css` **20 次**，同样三档 `.3s / .6s / .7s` 与同样的类名。**这条曲线是三站里唯一「跨站复用」的确切证据，最该抄进 CSS 变量。**

hatom 侧钩子：`watch(ee.currentRoute, (Le, Oe) => { re.menu.isOpen = false; re.toggleMainLoader(false); re.setRoute(Le, Oe) })`；WebGL 就绪后 `allPageTransitions[0].enter(el)` 与 `allLayoutTransitions[0].enter(el)`。页面进出（`Dfrb24yg.js` 的 `HomePage`）：`enter` 是 `t.fromTo(r.value.$el, { autoAlpha: 0 }, { autoAlpha: 1, duration: .25, ease: "sine.inOut" }, 0)`，`leave` 是 `duration: .15` 同曲线，`Ge({ enter: ie, leave: ke, mode: "out-in", … })`。**`autoAlpha`（`opacity` + `visibility`）比纯 `opacity` 更省渲染。**

### 6.2 mathis 菜单：clip-path 圆形扩散

```css
.pm-menu-enter-active { transition: clip-path .62s cubic-bezier(.76,0,.24,1), opacity .25s ease }
.pm-menu-leave-active { transition: clip-path .48s cubic-bezier(.76,0,.24,1), opacity .28s ease .08s }
.pm-menu-enter-from, .pm-menu-leave-to { clip-path: circle(0 at calc(100% - 42px) 42px); opacity: 0 }
.pm-menu-enter-to,   .pm-menu-leave-from { clip-path: circle(150vmax at calc(100% - 42px) 42px); opacity: 1 }
```

进 **0.62s** / 出 **0.48s**，`cubic-bezier(.76,0,.24,1)`；`opacity` 进 0.25s / 出 0.28s（**延迟 0.08s**）；半径 `0 → 150vmax`。圆心 `(calc(100% - 42px), 42px)` **精确对应汉堡按钮位置**；`150vmax` 保证任何宽高比下覆盖对角线。**进 620ms / 出 480ms 不对称**（打开比关闭慢 29%）。

### 6.3 hatom phase 过渡

`opacity 0→1`（`1s power2.out`）、`scale 0.8→1`（`1.5s expo.out`）、`translateY(calc(100% + 10px)) → 0`（`1.35s expo.out`）、两条 `translateY(0 → -100%)`（各 `1s expo.out`），全部从时间轴位置 0 起。`translateY(calc(100% + 10px))` 的 `+10px` 让元素起始位置**比自身高度多 10px**，圆角/描边不会在遮罩边缘被切掉。`expo.out` 配 `1.35~1.5s` 是主曲线（起步极快、尾段极慢）。

### 6.4 retronova：Barba + `load_grid` 随机点阵 + FLIP

Barba 过渡：`animateOut` = `gsap.to(container, { opacity: 0, duration: .5, ease: 'expo.out', delay: .2, onComplete: () => gsap.set(container, { display: 'none' }) })`；`animateIn` = `gsap.set(container, { display: 'block', opacity: 0 })` + `gsap.to(container, { opacity: 1, duration: .5, ease: 'expo.out' })`。

`load_grid` 点阵遮罩（HTML 里 `load_grid` 出现 **487 次**）：`.load_grid { z-index:10000; grid-template-rows: auto × 16; grid-template-columns: 1fr × 30; width:100%; height:100svh; display:none; position:fixed; inset:0% }`、`@media (max-width:991px){ grid-template-rows: auto × 13 }`、`.load_grid-item { background-color:#070707; width:100%; height:100% }`。

```js
function initialLoadAnimation() { gsap.to(".load_grid-item", {
  opacity: 0, duration: .001, stagger: { amount: .5, from: "random" },
  onComplete: () => { gsap.set(".load_grid", { display: "none" }) } }); }
$("a").on("click", function (event) {
  if ($(this).prop("hostname") === window.location.host && $(this).attr("href").indexOf("#") === -1
      && $(this).attr("target") !== "_blank") { event.preventDefault();
    let href = $(this).attr("href"); gsap.set(".load_grid", { display: "grid" });
    gsap.fromTo(".load_grid-item", { opacity: 0 }, { opacity: 1, duration: .001,
      stagger: { amount: .5, from: "random" },
      onComplete: function () { setTimeout(function () { barba.go(href) }, 200) } }); } });
```

30 列 × 16 行（桌面）/ 30 × 13（≤991px）；单格 `duration: .001`；**错峰 `stagger: { amount: .5, from: "random" }` → 全部格子在 500ms 窗口内随机点亮**；跳转前 `setTimeout(…, 200)`。**随机点阵闪烁**而非网格扫过：480 格随机分配启动时刻 + `duration .001`，观感像 CRT 断电，成本极低（只动 `opacity`）。`grid.js` 是同一逻辑的 jQuery 旧版，额外含 `window.onpageshow = t => t.persisted && window.location.reload()`。

真 FLIP（GSAP `Flip`，三站唯一）：时间线默认 `duration: 1, ease: "power4.inOut"`，先 `yPercent: -100` 把网格标题/标签推走，再 `Flip.getState(i)` 记录格子状态，窄屏加 `intro-grid--slider`、宽屏加 `intro-grid--scatter` + `intro-grid__img--current`，并用 `gsap.set(t, { x: window.innerWidth/2 - (rect.left + offsetWidth/2), y: window.innerHeight/2 - (rect.top + offsetHeight/2) })` 把当前格移到视口中心；`Flip.from(o, { duration: 1, ease: s, absolute: true, stagger: { each: .02, from: d }, simple: true, prune: true })`，`d = i.indexOf(e)`（被点项索引 → 从点击处向外扩散，每格 20ms）；`absolute: true` 让变形元素脱离文档流，`prune: true` 移除多余包装。`hideSlider` 里 `Flip.getState(i, { props: "filter" })` —— **显式声明 `filter` 一起 FLIP**。关闭按钮 `gsap.set(s, { display:"grid", opacity:0, scale:0 })` → `gsap.to(s, { opacity:1, scale:1, duration:.5 })`。

## 7. 缓动与时长总表

### 7.1 跨站复用曲线

| 曲线 | 出现处 | 次数 |
| --- | --- | --- |
| `cubic-bezier(.445,.05,.55,.95)` | mathis `entry.css`（.3/.6/.7s 三档） | 15 |
| `cubic-bezier(.445,.05,.55,.95)` | hatom `entry.css` | **60** |
| `cubic-bezier(.445,.05,.55,.95)` | hatom `HomePage.css` | **20** |

≈ easeInOutSine 的近似（对称、两端柔）。

### 7.2 mathis

| 曲线 | 等价 | 次数 | 用于 |
| --- | --- | --- | --- |
| `cubic-bezier(.22,1,.36,1)` | easeOutQuint | **7** | 卡片放大、导航位移、菜单内容上移 |
| `cubic-bezier(.65,0,.35,1)` | easeInOutCubic | **4** | 菜单图标、下划线、进度条位置 |
| `cubic-bezier(.76,0,.24,1)` | easeInOutQuart | 2 | 菜单 clip-path 圆形扩散 |
| `cubic-bezier(.445,.05,.55,.95)` | easeInOutSine | 15 | 全局页面过渡 |
| `cubic-bezier(.4,0,.6,1)` | easeInOutQuad | 1 | 声音条 |
| `cubic-bezier(.2,.9,.25,1.15)` | overshoot (y2>1) | 1 | `.pm-about__pile-img` |

JS 曲线：`power2.out`（导航淡入）、`power3.out`（标题揭示）、`Power2.easeOut`（`maskPr` 1.1s）、`Power3.easeInOut`（`maskPr2` .7s）、`Power2.easeOut`（`maskPr3` .45s）、`cubic-bezier(.4,0,.2,1)`（加载层淡出数值反解）、`cubic-bezier(.65,0,.35,1)`（滚轮 translateY 数值反解）。

时长清单（`entry.css` 全部 `transition` 唯一值）：

```
transform .35s cubic-bezier(.22,1,.36,1)                        ×2
transform var(--pm-underline-dur) cubic-bezier(.65,0,.35,1)      ×2
transform .2s ease / opacity .25s ease / background .3s ease     ×2 each
top .42s cubic-bezier(.65,0,.35,1), transform .42s …             ×1
color .35s ease / letter-spacing .35s ease                       ×1 each
opacity .28s ease, transform .28s ease                           ×1
opacity .2s ease / .15s ease / .35s ease                         ×1 each
transform .45s cubic-bezier(.22,1,.36,1)                         ×1
clip-path .62s cubic-bezier(.76,0,.24,1), opacity .25s ease      ×1   菜单进
clip-path .48s cubic-bezier(.76,0,.24,1), opacity .28s ease .08s ×1   菜单出
opacity .2s ease, transform .35s cubic-bezier(.22,1,.36,1)       ×1
opacity .4s ease, transform .4s ease                             ×1
filter .18s ease, transform .35s cubic-bezier(.22,1,.36,1)       ×1   卡片图
background .3s ease, color .3s ease / opacity .4s ease, background .3s ease   ×1 each
background .35s ease, color .35s ease                            ×1
opacity .35s ease, letter-spacing .45s cubic-bezier(.22,1,.36,1) ×1   联系标题
```

自定义属性：`--pm-underline-dur: .22s`、`--pm-underline-gap: .08em`。

### 7.3 hatom

CSS：`entry.css` 的 `cubic-bezier` **只有 1 个值 × 60 次**；`HomePage.css` 同样 1 个值 × 20 次。非 bezier 里有信息量的：`opacity .5s ease .6s ×2`、`fill .1s ease` / `stroke .1s ease ×2 each`、`stroke-dashoffset .175s ease, stroke .35s ease`、`opacity .4s linear 0s`、`opacity 1s linear .2s`。

JS `ease` 字符串统计（`DzIV7Ypb.js` + `Dfrb24yg.js`）：`power1.out ×20`、`power1.inOut ×20`、`power2.out ×9`、`power2.inOut ×7`、`expo.out ×4`、`power3.inOut ×4`、`sine.in ×2`、`sine.inOut ×2`、`power2.in ×2`、`power3.out ×2`、`power4.out`（内联若干）、`none ×1`。

duration 分布：`0 ×13`、`1 ×7`、`.2 ×6`、`.75 ×4`、`.1 ×4`、`.8 ×2`、`.4 ×2`、`.5 ×2`、`1.35 ×1`、`2 ×1`、`1.4 ×1`、`1.5 ×1`。stagger 分布：`"0.04" ×7`（绝对秒）、`.05 ×2`、`.025 ×1`、`.03 ×1`、`.2 ×1`、`1 ×1`、动态注入若干。

**`BwkFD7S1.js` 的 24 条缓动函数**（自研 `Animate`，可直接抄；`t ∈ [0,1]`，默认 `outCubic`，归一化 `Math.max(0, Math.min(1, (elapsed - delay) / duration))`）：

| 名称族 | 公式（节选） |
| --- | --- |
| `linear` | `t => t` |
| `inQuad` / `outQuad` / `inOutQuad` | `t*t` / `t*(2-t)` / `(t*=2)<1 ? .5*t*t : -.5*(--t*(t-2)-1)` |
| `inCubic` / `outCubic` / `inOutCubic` | `t*t*t` / `--t*t*t+1` / `(t*=2)<1 ? .5*t*t*t : .5*((t-=2)*t*t+2)` |
| `inQuart` / `outQuart` / `inOutQuart` | `t*t*t*t` / `1- --t*t*t*t` / `(t*=2)<1 ? .5*t*t*t*t : -.5*((t-=2)*t*t*t-2)` |
| `inQuint` / `outQuint` / `inOutQuint` | `t**5` / `--t**5+1` / `(t*=2)<1 ? .5*t**5 : .5*((t-=2)*t**4+2)` |
| `inSine` / `outSine` / `inOutSine` | `1-cos(tπ/2)` / `sin(tπ/2)` / `.5*(1-cos(πt))` |
| `inExpo` / `outExpo` / `inOutExpo` | `t?1024**(t-1):0` / `t===1?1:1-2**(-10t)` / 分段 |
| `inCirc` / `outCirc` / `inOutCirc` | `1-sqrt(1-t*t)` / `sqrt(1- --t*t)` / 分段 |
| `inElastic` / `outElastic` / `inOutElastic` | 带 `amplitude, period` 参数（全文见证据文件） |
| `inBack` / `outBack` / `inOutBack` | `t*t*((1.70158+1)*t-1.70158)` / `--t*t*((1.70158+1)*t+1.70158)+1` / `i=2.5949095` 分段 |
| `inBounce` / `outBounce` / `inOutBounce` | `outBounce` 用 4 段 `7.5625` 抛物线近似（`/2.75` 分段） |

### 7.4 retronova

CSS 侧（`webflow.shared.css`，378KB）：`cubic-bezier` **0 次**；`transition:` **3 次**；`@keyframes` **只有 1 个** `@keyframes spin { 0% { transform: rotate(0) } to { transform: rotate(360deg) } }`；`animation:` **1 次**。**Webflow 生成的样式几乎不用 CSS transition —— 全部动效都在 IX2 的 JS 时间轴里。**

GSAP 侧：`power1.inOut`（进度条 3s）、`expo.out`（Barba 进出 .5s、关闭按钮 .5s）、`power4` / `power4.inOut`（网格 hover 1s、FLIP 1s）。

IX2 缓动名（`a-4` 里实际使用）：`""`（空 = linear，初始归零与第 7–18 组 LED 闪烁）、`outExpo`（四角文字逐个进）、`inOutCubic`（预载器白幕退场 dur 300）、`inOutQuart`（网格缩放 dur 1、内容块出现 dur 100）、`inOutQuint`（主内容位移 dur 900）、`inSine`（透明度 dur 400–700、物件漂移 dur 600）、`outQuart`（收尾位移 dur 500）。

IX2 duration 分布：`0`（GENERAL_DISPLAY）、`1`、`100`（大量）、`200`（大量）、`300`、`400`、`500`（大量）、`600`、`700`、`900 ×4`。IX2 delay 分布：`0/100/…/900`，**全部是 100ms 整数倍** —— 整条时间线量化在 100ms 网格上（Webflow 编辑器默认吸附），也让各 actionList 的节奏天然统一。

### 7.5 一个数字速记

| 用途 | mathis | hatom | retronova |
| --- | --- | --- | --- |
| 页面过渡 | `.7s cubic-bezier(.445,.05,.55,.95)` | `.7s cubic-bezier(.445,.05,.55,.95)` | `.5s expo.out`（Barba） |
| 遮罩/帘幕 | `1.1s Power2.easeOut` | `1s autoAlpha`（白幕+视频同步） | `300ms inOutCubic` + `900ms inOutQuint` |
| 行级 stagger | `40ms`（菜单 `li`） | `40ms`（SplitText words） | `100ms`（IX2 四角） |
| 位移曲线 | `cubic-bezier(.22,1,.36,1)` | `power3.out` / `power4.out` | `inSine` / `inOutQuint` |
| 悬停下划线 | `.22s cubic-bezier(.65,0,.35,1)` 双伪元素 | `.25s ease-out` + `dashoffset 127→0` + `.3s 尾巴` | 无（用光标 + scramble） |
| 磁性/跟随 | `radius 150, strength .58, rotation 14°, stiffness .14, damping .72` | WebGL 球面点 `dampFactor 3` | 无（硬跟随 `left/top`） |
| 自定义光标 | 无 | WebGL 球面点，`hold 1→0 @2s` / `release 0→1 @.5s` | DOM 圆 20→40px，`transition .2s ease` ×6 |
| 跑马灯 | 无 | 无 | `13s linear infinite`，缺口 `4rem` |

## 8. `prefers-reduced-motion` 覆盖情况

```
mathis/B3vIl35b.js 1 · BnDfst1Q.js 3 · CBVoH9vm.js 5 · CS6uuomF.js 1
mathis/entry.css 9 · index.html 4 · useIsMobile.css 1
retronova/webflow.schunk.1e7857a7fd3f420f.js 1 · webflow.schunk.ff560088e0bd9e74.js 1
------------------------------------------------------------------  TOTAL = 26
```

| 站点 | 命中数 | 判定 |
| --- | --- | --- |
| **mathis** | **24** | 系统性覆盖（7 个文件） |
| **hatom** | **0** | **未实现**（HTML/CSS/全部 JS 均为 0） |
| **retronova** | **2** | 仅 Webflow 运行时自身的 1 处 ×2 文件；**站点自己的 CSS/JS（`index.html`、`webflow.shared.css`、6 个自定义脚本）命中 0** |

mathis 的逐条落点：① `.pm-card__media img/video` `transition: none` + hover `filter:none; transform:none`；② `.pm-about__pile-img` `animation: none`；③ `.pm-about__bend` / `.project-detail__detail-list` 的 a/strong `transition: none`；④ `.pm-contact__title` + 两伪元素 `transition: none`；⑤ `.pm-nav` `transition: none`（导航瞬移）；⑥ `.pm-menu-*` `transition-duration: .01ms` + `animation: none` + `will-change: auto`；⑦ `.pm-sound*` `will-change: auto` + `.is-on .pm-sound__bar { animation: none; transform: scaleY(.72) }`（**冻结在中间值**）；⑧ `.orientation-lock__phone` `animation: none; transform: rotate(0)`；⑨ `.pm-card__lift` `transform: none !important`（整块禁用 3D tilt）；⑩ `createMagneticField` 里 `if (!hoverMatches || reduceMatches) return () => {}` **连监听都不挂**；⑪ `HomeNav.q()` → `ue.set(e, { clearProps: "opacity" })`；⑫ `HomeHero._()` → `ue.set([m, k], { opacity: 1, y: 0, clearProps: "transform" })`；⑬ `HomeProjectCard` 读 `matchMedia` 后归零；⑭ `playInkIntro()` 三段 mask 置 0 + 立即 `emit(HOME_INTRO)`；⑮ `MaskLoading` 滚轮 `instant: true`、淡出 900 → **400ms**。

**三种降级手法（按推荐度）**：① **`return () => {}` 空函数** —— 最干净，适合指针/滚动类；② **`transition-duration: .01ms` 而非 `none`** —— 保留 `transitionend` 派发，依赖事件的逻辑不卡死；③ **`transform: none !important`** —— 粗暴但一次性保证所有内联 transform 失效。**唯一不推荐**的是 ⑦ 的 `scaleY(.72)`：把动画**冻结在中间值**而非终值，声音条会一直停在 72% 高度。

**hatom = 0 的后果**：系统开启「减少动态效果」时仍会播放完整 WebGL 彩蛋 loader（含 1s 白幕淡出）、Lenis 平滑滚动 + 长按 hold 缩放、SplitText 逐词/逐行入场（1.4s / 2s）、WebGL 球面光标、`blink-default` 5s 无限呼吸光点。**这是明确的「不要模仿」点 —— 抄它的动效时必须自己补。** **retronova = 0（站点侧）的后果**：仍会跑 `13s linear infinite` 跑马灯（**最该被关掉的一个**）、`16s linear infinite` CRT 扫描线、IX2 22 组入场、自定义光标 + 逐字符 scramble、`brightness(200%) hue-rotate(130deg)` 的 1s 滤镜翻转。

## 9. 用在哪：主页 + 校验页的 13 个落地动画点

### 9.0 前设

原生 HTML/CSS/JS，无框架无 npm，只允许 `transform / opacity / filter / clip-path` + `rAF`；两页（`index.html` 主页、`verify.html` 校验页），中文排版为主，模块有**大字标题、段落、跑马灯、部门轮播、空状态占位**。

```css
:root{
  --e-out-quint:  cubic-bezier(.22,1,.36,1);      /* mathis 最常用，7 次 */
  --e-inout-cub:  cubic-bezier(.65,0,.35,1);      /* mathis 菜单/下划线，4 次 */
  --e-inout-sine: cubic-bezier(.445,.05,.55,.95); /* mathis+hatom 跨站复用，95 次 */
  --e-out-expo:   cubic-bezier(.16,1,.3,1);       /* expo.out 的 CSS 等价 */
}
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const reduce = () => RM.matches;
const approach = (cur, target, hz, dt) => cur + (target - cur) * (1 - Math.exp(-hz * dt));
const chars = str => Array.from(str);   // 中文/emoji 必须用 Array.from，不能 split('')
```

**点 1｜加载层：三位数滚轮 + 词序推进.** 触发 `DOMContentLoaded` + `body.is-loading`；动 `.roll__track` 的 `translateY()` 与容器 `opacity`；参数 每格 **500ms**、三位错峰 **80ms**、最短停留 **2000ms**、每句最短 **500ms**、淡出 **900ms**（reduced **400ms**）、位移 `cubic-bezier(.65,0,.35,1)`、淡出 `cubic-bezier(.4,0,.2,1)`。

```html
<div id="boot" class="boot" role="progressbar" aria-label="加载中"
     aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
  <p class="boot__word"><span class="roll"><span class="roll__track">
    <span class="roll__item"></span><span class="roll__item"></span></span></span></p>
  <p class="boot__count"><!-- 3 个 .roll.roll--d，结构同上 --></p></div>
```

```css
.boot{position:fixed;inset:0;z-index:10001;background:#f2ede3;color:#222;display:flex;
      flex-direction:column;justify-content:space-between;padding:clamp(20px,4vw,40px);
      font-variant-numeric:tabular-nums;will-change:opacity}
.roll{display:block;overflow:hidden;position:relative}
.roll__track{display:block;transition:transform var(--roll,500ms) cubic-bezier(.65,0,.35,1)}
.roll--d{display:inline-block;width:.65em;height:1em}     /* 一行高度，-100% 恰好一格 */
.boot__count{display:flex;font-size:clamp(56px,6.25vw,120px);line-height:1}
```

```js
function roll(track, text, backward) {
  const [out, inc] = track.children; inc.textContent = text;
  track.style.transition = 'none'; track.style.transform = 'translateY(0%)';
  requestAnimationFrame(() => { track.style.transition = '';
    track.style.transform = `translateY(${backward ? 100 : -100}%)`; }); }
let displayed = 0, target = 0, last = 0; const startedAt = performance.now();
function frame(now) {
  const dt = last ? Math.min(.05, (now - last) / 1e3) : .016; last = now;
  displayed = approach(displayed, target, 4, dt);              // 4Hz，抄 mathis
  if (Math.abs(target - displayed) < .002) displayed = target;
  boot.setAttribute('aria-valuenow', String(Math.round(displayed * 100)));
  paintCounter(Math.round(displayed * 100));
  if (now - startedAt >= 2000 && displayed >= 1) fadeOut();     // 硬下限 2000ms
  else requestAnimationFrame(frame); }
```

reduced 降级：`track.style.transition = 'none'` 让滚轮直接落位；淡出过渡从 900ms 缩到 400ms。

**点 2｜入场：导航 + 顶区「整块进，两次错峰」.** 触发 加载层 `opacity` 变 0（`MutationObserver` 监听 `style`，抄 retronova script#18），兜底 `setTimeout(…, 10000)`；参数 导航 `.5s power2.out`；标题 `y:-12px, .65s power3.out, delay 280ms`；正文 `y:-10px, .65s power3.out, delay 440ms`。

```css
.nav--intro{opacity:0;transition:opacity .5s var(--e-out-quint)}
.hero__title--intro,.hero__lead--intro{opacity:0;transform:translateY(var(--dy,-12px));
  transition:opacity .65s var(--e-out-quint),transform .65s var(--e-out-quint)}
.hero__title--intro{--dy:-12px;transition-delay:280ms}
.hero__lead--intro {--dy:-10px;transition-delay:440ms}
```

```js
const fallback = setTimeout(revealChrome, 10000);
function revealChrome() { clearTimeout(fallback);
  document.querySelector('.nav').classList.add('nav--go');
  document.querySelectorAll('.hero__title--intro,.hero__lead--intro').forEach(el => el.classList.add('go'));
  setTimeout(() => document.querySelectorAll('.intro-init').forEach(el => {
    el.style.opacity = ''; el.style.transform = ''; }), 1200); }   // 交回 CSS
```

reduced 降级：`el.style.transition='none'; el.style.opacity='1'; el.style.transform='none'; el.style.transitionDelay='0ms'`。

**点 3｜大字标题 + 段落「行级」揭示.** 触发 `IntersectionObserver`，`threshold: 0.25`，一次性；参数 单行 `.55s cubic-bezier(.22,1,.36,1)`、`translateY(18px)`、**stagger 40ms**、起始延迟 120ms。为什么不用逐字：中文无空格，逐字 `inline-block` 会破坏换行与标点挤压；行级揭示对中文更安全，也与三站一致（mathis 的 `li` 级、hatom 的 `lines` 级）。

```html
<h2 data-reveal-lines><span>把复杂的事情</span><span>做成一件事</span></h2>
```

```css
[data-reveal-lines] > span{display:block;opacity:0;transform:translateY(18px);
  transition:opacity .55s var(--e-out-quint),transform .55s var(--e-out-quint)}
[data-reveal-lines].is-in > span{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){ [data-reveal-lines] > span{opacity:1;transform:none;transition:none} }
```

```js
const io = new IntersectionObserver(ents => { for (const e of ents) {
  if (!e.isIntersecting) continue;
  e.target.querySelectorAll(':scope > span').forEach((s, i) => { s.style.transitionDelay = `${120 + i * 40}ms`; });
  e.target.classList.add('is-in'); io.unobserve(e.target); } }, { threshold: .25 });
document.querySelectorAll('[data-reveal-lines]').forEach(el => io.observe(el));
```

**点 4｜导航栏按滚动方向隐藏（抄 mathis 双阈值）.** 触发 `scroll`（`passive` + rAF 节流）；参数 阈值 **12px**（累积位移）、死区 **80px**、过渡 `.35s cubic-bezier(.22,1,.36,1)`、位移 `-120%`（多留 20% 防描边露出）。

```js
const nav = document.querySelector('.nav');
const THRESHOLD = 12, DEAD_ZONE = 80;
let lastY = Math.max(0, scrollY), hidden = false, ticking = false;
function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(() => {
  const y = Math.max(0, scrollY);
  if (y <= DEAD_ZONE) { setHidden(false); lastY = y; }
  else { const d = y - lastY;
    if (d > THRESHOLD) { setHidden(true); lastY = y; }
    else if (d < -THRESHOLD) { setHidden(false); lastY = y; } }
  ticking = false; }); }
function setHidden(v) { if (v === hidden) return; hidden = v; nav.classList.toggle('nav--hidden', v); }
addEventListener('scroll', onScroll, { passive: true });
```

```css
.nav{transition:transform .35s var(--e-out-quint);will-change:transform}
.nav--hidden{transform:translateY(-120%);pointer-events:none}
@media (prefers-reduced-motion: reduce){ .nav{transition:none} }
```

**点 5｜磁吸按钮（抄 mathis `createMagneticField`）.** 触发 `pointermove`（仅 `(hover:hover) and (pointer:fine)` 且非 reduced 时挂载）；参数 `radius 110`、`strength .42`、`rotation 10°`、`stiffness .14`、`damping .72`（按钮用小参数集，大卡片用 `150 / .58 / 14°`）；软阈值 `F = t²(3-2t)`；核销条件 六项残差 ≤ `.02` 且 `t === 0`。**直接复用上面 §5.1 的 `createMagneticField`**：把 `Fb` 换成 `{ radius:110, strength:.42, rotation:10, stiffness:.14, damping:.72 }` 即可，其余（帧率归一化、smoothstep、`damping**R`、残差停机、原 transform 保护）一字不改。下面只列骨架，完整实现见 §5.1。

```js
function magnetic(el, opt = { radius:110, strength:.42, rotation:10, stiffness:.14, damping:.72 }) {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches || reduce()) return () => {};  // 不挂监听
  const base = el.style.transform;                 // 保护既有 transform
  let tx=0, ty=0, rot=0, vx=0, vy=0, vr=0, px=0, py=0, inside=false, raf=0, last=0;
  const tick = now => { raf = 0;
    const R = last ? Math.min(Math.max((now - last) / (1e3/60), 0), 2) : 1; last = now;   // dt 归一化
    const r = el.getBoundingClientRect();
    const dx = px - (r.left + r.width/2 - tx), dy = py - (r.top + r.height/2 - ty);
    const t = inside ? Math.max(0, Math.min(1, 1 - Math.hypot(dx,dy) / opt.radius)) : 0;
    const F = t*t*(3-2*t), ang = Math.atan2(dy,dx);
    const gx = dx*opt.strength*F, gy = dy*opt.strength*F;
    const gr = (Math.cos(ang)*.85 + Math.sin(ang)*.35) * opt.rotation * F;
    vx += (gx-tx)*opt.stiffness*R; vy += (gy-ty)*opt.stiffness*R; vr += (gr-rot)*opt.stiffness*.8*R;
    const damp = opt.damping ** R;                 // 幂形式，帧率无关
    vx*=damp; vy*=damp; vr*=damp; tx+=vx*R; ty+=vy*R; rot+=vr*R;
    el.style.transform = `${base} translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg)`;
    const res = Math.abs(gx-tx)+Math.abs(gy-ty)+Math.abs(gr-rot)+Math.abs(vx)+Math.abs(vy)+Math.abs(vr);
    if (res > .02) raf = requestAnimationFrame(tick);
    else if (t === 0) { tx=ty=rot=vx=vy=vr=0; el.style.transform = base; } };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick) };
  addEventListener('pointermove', e => { if (e.pointerType && !['mouse','pen'].includes(e.pointerType)) return;
    px=e.clientX; py=e.clientY; inside=true; kick(); }, { passive:true });
  addEventListener('scroll', kick, { passive:true }); addEventListener('resize', kick, { passive:true });
  return () => cancelAnimationFrame(raf); }
document.querySelectorAll('[data-magnetic]').forEach(magnetic);
```

reduced 降级：函数内部门控 —— `reduce()` 为真时**直接返回空操作，不挂任何监听器**，不需要额外 CSS。

**点 6｜导航/图标的「下划线接力」.** 触发 `hover` / **`focus-visible`**；参数 单段 **220ms**、`cubic-bezier(.65,0,.35,1)`、`transform-origin` 相反、**延迟 = 对方时长（220ms）**、粗细 `max(2px, .028em)`。

```css
.unl{position:relative;display:inline-block;text-decoration:none;color:inherit}
.unl::before,.unl::after{content:"";position:absolute;left:0;bottom:calc(.05em - .08em);
  width:100%;height:max(2px,.028em);background:currentColor;
  transition:transform var(--u,220ms) var(--e-inout-cub)}
.unl::before{transform:scaleX(1);transform-origin:right center;transition-delay:var(--u,220ms)}
.unl::after {transform:scaleX(0);transform-origin:left  center;transition-delay:0s}
.unl:hover::before,.unl:focus-visible::before{transform:scaleX(0);transition-delay:0s}
.unl:hover::after, .unl:focus-visible::after {transform:scaleX(1);transition-delay:var(--u,220ms)}
@media (prefers-reduced-motion: reduce){
  .unl::before,.unl::after{transition:none}
  .unl::before{transform:scaleX(0)} .unl::after{transform:scaleX(1)}   /* 直接停在「已擦出」 */
  .unl:hover::after,.unl:focus-visible::after{transform:scaleX(1)} }
```

**点 7｜校验页：加权进度条 + 手写 SVG 划线.** 触发 校验开始，进度由「已完成项数 / 总项数」驱动；参数 内条 `width 0 → 100%` 用 `3s cubic-bezier(.455,.03,.515,.955)`（`power1.inOut` 等价）；SVG `dashoffset → 0`，`250ms ease-out`。内条用 `width` 而非 `scaleX` —— 抄 retronova，`overflow:hidden` 内改 `width` 不会被边框挤压。

```html
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
  <div class="bar__fill"></div>
  <svg class="bar__line" viewBox="0 0 300 2" preserveAspectRatio="none"><path d="M0 1H300" pathLength="300"/></svg>
</div>
```

```css
.bar{position:relative;width:min(560px,72vw);height:8px;border:1px solid #cbb98a;overflow:hidden}
.bar__fill{position:absolute;inset:0;width:0%;background:#cbb98a;
           transition:width var(--dur,3s) cubic-bezier(.455,.03,.515,.955)}
.bar__line{position:absolute;left:0;bottom:-6px;width:100%;height:2px;fill:none;stroke:#c1ff12;
           stroke-width:2;stroke-dasharray:300;stroke-dashoffset:300;transition:stroke-dashoffset 250ms ease-out}
.bar__line.is-on{stroke-dashoffset:0}
```

```js
const fill = document.querySelector('.bar__fill'), line = document.querySelector('.bar__line');
const TOTAL = 12; let done = 0;
function step() { done++; const p = done / TOTAL;
  fill.style.width = (p * 100).toFixed(1) + '%';
  document.querySelector('.bar').setAttribute('aria-valuenow', String(Math.round(p * 100)));
  if (done === 1) line.classList.add('is-on');
  if (done >= TOTAL) finish(); }
if (reduce()) { fill.style.transition = 'none'; line.style.transition = 'none'; line.classList.add('is-on'); }
```

**点 8｜跑马灯：内容自适应时长 + hover 减速 + 页面隐藏暂停.** 触发 `DOMContentLoaded` + `ResizeObserver`；动 `translate3d()`（rAF 驱动）。**为什么不用 retronova 的纯 CSS 方案**：它的 `translateX(calc(-100% - 4rem))` 要求「缺口宽度 = 容器 gap」精确相等，中文文案长度一变、或 gap 用 `em` 而内容用 `px`，接缝就跳；而且 CSS animation 无法做「hover 减速」与「页面隐藏暂停」。所以**保留它的速度模型**，改用 rAF。参数 基准 **13s 走完一份内容** → `speed = unitWidth / 13`（px/s）；hover 时 `× 0.35`；`document.hidden` 时暂停。

```html
<div class="mq" data-marquee><div class="mq__half">部门一 · 部门二 · 部门三 · 部门四 ·</div></div>
```

```css
.mq{overflow:hidden;white-space:nowrap}
.mq__half{display:inline-block;will-change:transform;padding-right:4rem}  /* 4rem 与缺口一致 */
```

```js
function marquee(root) {
  const half = root.querySelector('.mq__half');
  if (reduce()) { root.style.overflowX = 'auto'; return }         // 完全停住，改为可横向滚动
  half.insertAdjacentHTML('afterend', half.outerHTML);            // 复制一份做无缝拼接
  let unit = half.getBoundingClientRect().width;
  const BASE = 13000;                                             // 抄 retronova：13s 一份
  let x = 0, speedScale = 1, last = 0, paused = false;
  root.addEventListener('pointerenter', () => speedScale = .35);
  root.addEventListener('pointerleave', () => speedScale = 1);
  document.addEventListener('visibilitychange', () => paused = document.hidden);
  const frame = now => { const dt = last ? Math.min(.05, (now - last) / 1e3) : .016; last = now;
    if (!paused && unit > 0) { x -= (unit / (BASE / 1000)) * speedScale * dt;
      if (-x >= unit) x += unit;
      Array.from(root.children).forEach(el => el.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`); }
    requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  new ResizeObserver(() => { unit = half.getBoundingClientRect().width }).observe(half); }
document.querySelectorAll('[data-marquee]').forEach(marquee);
```

**点 9｜部门轮播：横向 scroll-snap + 自动播放 + 手势.** 触发 滚轮 / 触摸 / 左右方向键 / 分页点；参数 每片 `scroll-snap`；自动播放 **每 4s 一片**；hover/focus 暂停；拖拽阈值 **10px**（抄 hatom `I = 10`）。

```css
.dept__track{display:flex;gap:24px;overflow-x:auto;scroll-snap-type:x mandatory;
             scrollbar-width:none;overscroll-behavior-x:contain}
.dept__track::-webkit-scrollbar{display:none}
.dept__item{flex:0 0 min(78vw,560px);scroll-snap-align:center;opacity:.5;transform:scale(.96);
            transition:opacity .45s var(--e-out-quint),transform .45s var(--e-out-quint)}
.dept__item.is-active{opacity:1;transform:scale(1)}
```

```js
function slider(track) {
  const items = Array.from(track.children); let idx = 0, auto = 0;
  const goto = (i, smooth = true) => { idx = (i + items.length) % items.length;
    items.forEach((el, k) => el.classList.toggle('is-active', k === idx));
    const el = items[idx];
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2,
                     behavior: smooth && !reduce() ? 'smooth' : 'auto' }); };
  const play = () => { if (auto || reduce()) return; auto = setInterval(() => goto(idx + 1), 4000) };
  const stop = () => { clearInterval(auto); auto = 0 };
  track.addEventListener('pointerenter', stop); track.addEventListener('pointerleave', play);
  track.addEventListener('focusin', stop); track.addEventListener('focusout', play);
  addEventListener('keydown', e => { if (e.key === 'ArrowRight') { stop(); goto(idx + 1) }
                                     if (e.key === 'ArrowLeft')  { stop(); goto(idx - 1) } });
  let sx = 0, dragging = false;                                    // 手势：>10px 视为拖拽
  track.addEventListener('pointerdown', e => { sx = e.clientX; dragging = false });
  track.addEventListener('pointermove', e => { if (sx && Math.abs(e.clientX - sx) > 10) dragging = true });
  track.addEventListener('pointerup', () => { if (dragging) { stop(); play() } sx = 0 });
  goto(0, false); play(); }
document.querySelectorAll('[data-slider]').forEach(slider);
```

reduced 降级：`track.style.scrollBehavior = 'auto'`（关平滑、保留可滚）且 `play()` 内 `reduce()` 门控 → **不启动自动播放**，只留手动点击与键盘。

**点 10｜hash 路由的两段式过渡 + 圆形揭幕.** 触发 `hashchange`；参数 离开 **0s linear（瞬时）**；进入 **700ms `cubic-bezier(.445,.05,.55,.95)`**；圆形揭幕进 **620ms**、出 **480ms**，曲线 `cubic-bezier(.76,0,.24,1)`；圆心对准触发按钮，半径 `0 → 150vmax`。

```css
.view--leave{opacity:0;transition:opacity 0s linear}                 /* 旧视图瞬走 */
.view--enter{opacity:0;transition:opacity 700ms var(--e-inout-sine)}
.view--enter.is-shown{opacity:1}
.veil{position:fixed;inset:0;z-index:900;background:#141414;pointer-events:none;
      clip-path:circle(150vmax at var(--cx,90%) var(--cy,42px));
      transition:clip-path 480ms cubic-bezier(.76,0,.24,1),opacity 280ms ease 80ms}
.veil.is-shut{clip-path:circle(0 at var(--cx,90%) var(--cy,42px));opacity:0}
```

```js
function route(nextHash, originEl) {
  const r = originEl.getBoundingClientRect(), R = reduce();
  veil.style.setProperty('--cx', (r.left + r.width / 2) + 'px');
  veil.style.setProperty('--cy', (r.top + r.height / 2) + 'px');
  veil.classList.remove('is-shut');
  veil.style.transitionDuration = R ? '0ms,0ms' : '620ms,250ms';
  setTimeout(() => {
    currentView.classList.add('view--leave');
    render(nextHash);
    const nv = document.querySelector('.view');
    nv.classList.add('view--enter'); requestAnimationFrame(() => nv.classList.add('is-shown'));
    veil.classList.add('is-shut');
    setTimeout(() => { veil.classList.remove('is-shut','view--enter');
      nv.classList.remove('view--enter','is-shown','view--leave'); }, R ? 0 : 900);
  }, R ? 0 : 480); }
```

reduced 降级：所有 `transitionDuration/Delay` 置 `0ms`、`setTimeout` 变 `0`，但**保留 `opacity` 的状态切换**，保证不出现黑屏。

**点 11｜校验失败抖动 + 空状态呼吸.** 触发 校验失败时给输入框加类；空状态容器进入视口时启动；参数 抖动 **420ms**、6 次衰减往返、峰值 ±6px、`cubic-bezier(.36,.07,.19,.97)`；呼吸 **5s linear infinite alternate**、`box-shadow` 五层（1/4/8/16/32px）。

```css
@keyframes shake{ 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)}
  30%,50%,70%{transform:translateX(-6px)} 40%,60%{transform:translateX(6px)} }
.field.is-invalid{animation:shake 420ms cubic-bezier(.36,.07,.19,.97) both}
@keyframes breathe{
  0%  {box-shadow:0 0 1px 1px #fff,0 0 4px 1px #fff,0 0 8px 1px #fff,0 0 16px 1px #fff,0 0 32px 1px #fff;opacity:1}
  20% {box-shadow:0 0 1px #fff,0 0 4px #fff,0 0 8px #fff,0 0 16px #fff,0 0 32px #fff;opacity:.7}
  40% {box-shadow:0 0 1px .5px #fff,0 0 4px .5px #fff,0 0 8px .5px #fff,0 0 16px .5px #fff,0 0 32px .5px #fff;opacity:.8}
  60% {box-shadow:0 0 1px 1px #fff,0 0 4px 1px #fff,0 0 8px 1px #fff,0 0 16px 1px #fff,0 0 32px 1px #fff;opacity:.9}
  80% {box-shadow:0 0 1px #fff,0 0 4px #fff,0 0 8px #fff,0 0 16px #fff,0 0 32px #fff;opacity:.7}
  to  {box-shadow:0 0 1px 1px #fff,0 0 4px 1px #fff,0 0 8px 1px #fff,0 0 16px 1px #fff,0 0 32px 1px #fff;opacity:1} }
.empty__dot{width:6px;height:6px;border-radius:100%;background:#fff;
            animation:breathe 5s linear 0s infinite alternate}
@media (prefers-reduced-motion: reduce){
  .field.is-invalid{animation:none;outline:2px solid #d33;outline-offset:2px}   /* 静态描边替代抖动 */
  .empty__dot{animation:none;opacity:1;box-shadow:0 0 4px 1px #fff} }
```

```js
function flagInvalid(field, msg) {
  field.classList.remove('is-invalid');
  void field.offsetWidth;                                  // 强制回流，让同名动画可重播
  field.classList.add('is-invalid'); field.setAttribute('aria-invalid', 'true');
  document.getElementById(field.getAttribute('aria-describedby')).textContent = msg;
  field.addEventListener('animationend', () => field.classList.remove('is-invalid'), { once: true }); }
```

**关键**：失效提示**不能只靠动画** —— 改成静态红色描边 + `aria-invalid`，保证 reduced-motion 与屏幕阅读器用户都能收到信号。

**点 12｜部门内容切换：字符 scramble（改 rAF）.** 触发 轮播切到新部门时（`goto()` 内），或 hover 部门名；参数（抄 retronova `random.js`）**每字符 9 步**、**步间隔 80ms**、**起始随机延迟 0–2000ms**、字符集 `A-Za-z0-9!@#$%^&*()`。retronova 用 9 层嵌套 `setTimeout` × N 字符，字符多时定时器数量爆炸；下面改成**单个 rAF + 每字符独立计时**，行为一致但只跑一个循环。

```js
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
const STEPS = 9, STEP_MS = 80, SPREAD = 2000;
function scramble(el, text) {
  el.textContent = '';
  const cells = chars(text).map(ch => { const s = document.createElement('span');
    s.textContent = ch; s.dataset.final = ch; el.appendChild(s); return s });
  if (reduce()) return;                                     // reduced：DOM 结构不变，即终值
  const state = cells.map(() => ({ start: performance.now() + Math.random() * SPREAD, step: 0, acc: 0 }));
  let last = 0;
  const frame = now => { const dt = last ? now - last : 16; last = now; let alive = false;
    cells.forEach((c, i) => { const st = state[i];
      if (st.step >= STEPS) { c.textContent = c.dataset.final; return }
      if (now < st.start) { alive = true; return }
      st.acc += dt; if (st.acc >= STEP_MS) { st.acc -= STEP_MS; st.step++ }
      if (st.step >= STEPS) c.textContent = c.dataset.final;
      else { c.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0]; alive = true } });
    if (alive) requestAnimationFrame(frame); };
  requestAnimationFrame(frame); }
```

reduced 降级：内联 `if (reduce()) return;` —— **在生成 `span` 之后立刻返回**，DOM 结构与无障碍读取完全一致，只是不做乱码。
（retronova 原始实现 `random.js` 的逐字符 9 步 × 80ms `setTimeout` 链见 §2.3 与 `docs/_raw/EVIDENCE-INDEX.md`。）

**点 13｜空状态长按展开的进度反馈（抄 hatom `InteractionController`）.** 触发 `pointerdown`；**200ms** 后进入 hold 并显示进度环；`2000ms` 前松手则取消；参数 `holdDelay 200ms`、`holdMax 2000ms`、位移取消阈值 **10px**、取消回落 **700ms**。

```html
<button class="hold" data-hold><span class="hold__label">长按展开</span>
  <svg class="hold__ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20"/></svg></button>
```

```css
.hold{position:relative;touch-action:none}          /* 才能拿到 pointermove */
.hold__ring{position:absolute;inset:0;fill:none;stroke:#c1ff12;stroke-width:3;
  stroke-dasharray:125.6;stroke-dashoffset:125.6;   /* 2πr, r=20 */
  transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 700ms var(--e-inout-cub)}
.hold.is-holding .hold__ring{transition:none}
```

```js
function holdButton(btn) {
  const ring = btn.querySelector('.hold__ring'), C = 2 * Math.PI * 20;   // 125.66
  const DELAY = 200, MAX = 2000, MOVE = 10;
  let t0 = 0, sx = 0, sy = 0, timer = 0, raf = 0, holding = false;
  const draw = p => ring.style.strokeDashoffset = String(C * (1 - p));
  const cancel = () => { clearTimeout(timer); cancelAnimationFrame(raf);
    holding = false; btn.classList.remove('is-holding'); ring.style.transition = ''; draw(0); };  // 700ms 回落
  const loop = now => { const p = Math.min(1, (now - t0) / MAX); draw(p);
    if (p >= 1) { btn.dispatchEvent(new CustomEvent('holdcomplete')); cancel(); return }
    raf = requestAnimationFrame(loop); };
  btn.addEventListener('pointerdown', e => {
    if (reduce()) { btn.dispatchEvent(new CustomEvent('holdcomplete')); return }   // 长按→单击
    t0 = performance.now(); sx = e.clientX; sy = e.clientY; btn.setPointerCapture(e.pointerId);
    timer = setTimeout(() => { holding = true; btn.classList.add('is-holding');
      raf = requestAnimationFrame(loop) }, DELAY); });
  btn.addEventListener('pointermove', e => { if (!holding && !timer) return;
    if (Math.max(Math.abs(e.clientX - sx), Math.abs(e.clientY - sy)) > MOVE) cancel(); });
  ['pointerup','pointercancel','pointerleave'].forEach(t =>
    btn.addEventListener(t, () => { if (holding || timer) cancel() })); }
document.querySelectorAll('[data-hold]').forEach(holdButton);
```

reduced 降级：`pointerdown` 直接派发 `holdcomplete`（**长按变成单击**），进度环保持满环作为静态提示。**注意不能让长按成为唯一路径** —— 按钮本身仍要可点击。

## 10. 抄的时候最容易踩的 10 个坑

| # | 坑 | 正确做法 | 证据 |
| --- | --- | --- | --- |
| 1 | 滚轮数字堆两行 + `translateY(-100%)` | 轨道高度必须 = 一行，`-100%` 才刚好一步 | mathis `B3vIl35b.js` 源码注释 |
| 2 | `current += (target-current)*0.1` 做平滑 | 用 `1-exp(-hz*dt)` 或 `damping**dt`，否则 120Hz 屏上快一倍 | hatom `BNoWhy3H.js`、mathis `B3vIl35b.js` |
| 3 | 磁性/跟随用 `left/top` 写位置 | 用 `transform: translate3d()`，`left/top` 每帧触发布局 | retronova `cursor.js`（反面教材） |
| 4 | 下划线只用一个伪元素 `scaleX(0→1)` | `::before` 擦除 + `::after` 擦出，**延迟 = 对方时长** | mathis `entry.css` `.pm-contact__title` |
| 5 | 跑马灯 `translateX(-100%)` 无缺口补偿 | `translateX(calc(-100% - GAP))`，`GAP` **必须等于**父容器 `gap` | retronova 内联 `@keyframes scroll` |
| 6 | SVG 划线用估算的 `dasharray` | `dasharray` = 路径实际长度（`viewBox` 宽 127 → `127`），或用 `pathLength="300"` 归一化 | hatom `HomePage.css` |
| 7 | 用 `transition: none` 做 reduced 降级 | 用 `transition-duration: .01ms` 保留 `transitionend` 派发 | mathis `entry.css` `.pm-menu-*` |
| 8 | `stagger: 0.04` 与 `stagger: "0.04"` 混用 | GSAP 里字符串是「每项间隔秒数」，数字是「总时长按权重分配」 | hatom `DzIV7Ypb.js` / `Dfrb24yg.js` |
| 9 | 中文按 `str.split('')` 切字符 | 用 `Array.from(str)`，否则代理对会碎 | 通用 |
| 10 | reduced-motion 只关动画、不管语义 | 抖动换静态描边 + `aria-invalid`；长按保留单击路径 | hatom 完全没做（反面教材） |

## 11. 未核实清单

1. **mathis 的 Lenis 参数**（`lerp` / `duration` / `easing`）—— `CS6uuomF.js` 是库代码，实例化参数在 SSR DOM 中不可见。
2. **mathis `maskPr` / `maskPr2` / `maskPr3` 在 GLSL 中的确切语义**（半径、噪声阈值还是 UV 偏移）—— 只拿到三段时长与缓动。
3. **hatom loader 的「`Click to enter` 文案切换」所用 `fade-global` 过渡的实际时长** —— SSR 里只有类名，未能确认就是 `entry.css` 的 `.3s`。
4. **hatom 的 `egg` SVG `moveToPercent()` 到底动什么属性**（`stroke-dashoffset` 还是 `clipPath`）—— 只看到调用点与「量化到 1/4」的逻辑。
5. **hatom 的 Lottie 动画数据** —— 有 Lottie 运行时代码与 `easeName` 相关符号，但未定位到实际 JSON（`"fr":` 与 `easeName:"..."` 正则命中均为 0）。
6. **retronova IX2 `SCROLLING_IN_VIEW` continuous action 具体驱动了什么** —— 拿到事件配置（`continuousParameterGroupId:"a-p"`、`smoothing:50`、`endOffsetValue:50/20`）与 `actionListId:"a"`，但 `a`（`GENERAL_CONTINUOUS_ACTION`）的 actionItems 未展开打印。
7. **retronova 的 `intro-grid` / `slider` 相关 class 在当前首页是否存在** —— `script.js` 里大量 `document.querySelector(".intro-grid-wrap")` / `.slider-title` / `.controls` 未做空值保护；`index.html` 中 `intro-grid` 仅出现 1 次、`hover-effect` 与 `list__item` 均为 0 次，说明这段脚本主要服务于 `collections/*` 子页。
8. **三站的音频设计** —— retronova 用 Howler 挂了 7 个 `mp3`（`ambient_sound.mp3` 258,714 B、`collection-sound.mp3` 768,912 B、`hover_sound.mp3` 25,196 B 等），mathis 有 Web Audio 环境音（`cutoff: 2e4 / 420`，`volume: .25 / .15`），hatom 有 `srt` 字幕同步音频。未做音频与动画的时序对齐分析。
9. **hatom 的 `resourcesFileSize` 是否与服务端实际文件一致** —— 表里 9MB 的 `master-scene-compressed.glb` 未下载校验。

## 12. 一页速查

```
入场
  mathis     数字滚轮 500ms / 错峰80ms / 最短2000ms / 淡出900ms
  hatom      资源字节加权 + 量化到1/4 + 彩色SVG彩蛋 + 点击进入 + 白幕与视频同步1s
  retronova  假进度3s@delay2.7s + IX2 22组 / 四角文字100ms阶梯 / 兜底7.4s

文字揭示
  mathis     整块进 (y:-12/-10px, .65s power3.out, delay .28/.44)
             行级进 (.55s cubic-bezier(.22,1,.36,1), stagger 40ms)
  hatom      行级 (y按行号 20→50px, 1.4s power3.out; opacity 2s power2.out, +400ms)
             词级 (SplitText words, stagger 40ms, x/y ±30, 2s power4.out, timeScale2)
  retronova  逐字符 span + 9步×80ms scramble, 起始随机 0-2000ms

滚动
  方向隐藏   12px阈值 + 80px死区 + translateY(-120%) + .35s easeOutQuint
  指针tilt   rotateY nx*9° / rotateX -ny*7° / translate(nx*22, ny*6) / translateZ 48px
  sticky     min-height 175vh + sticky top:0 height:100vh
  章节阈值   sectionLimits [0,.2,.4,.6,.8] / Lenis lerp .04 / 分页 2s lock 滚动
  随速skew   三站均无（未核实存在）

跑马灯
  retronova 13s linear infinite, translateX(0 → -100%-4rem), gap 4rem 必须相等

hover
  下划线     .22s cubic-bezier(.65,0,.35,1) 双伪元素, 延迟=对方时长
  SVG划线    dasharray 127, dashoffset 127→0, .25s ease-out + 尾巴 .3s
  hover滤镜  brightness(1.07) saturate(1.1) + scale(1.145) / .35s easeOutQuint
  光标       20→40px 圆 / 胶囊 (宽+20)×50, transition .2s ×6 属性
  磁性       radius 150(按钮110) strength .58(.42) rotation 14°(10°) stiffness .14 damping .72

页面切换
  共同曲线   cubic-bezier(.445,.05,.55,.95)  时长 .3s / .6s / .7s
  进入       .7s 淡入 ; 离开 0s 瞬走
  菜单       clip-path circle(0 → 150vmax at calc(100%-42px) 42px), .62s 进 / .48s 出,
             cubic-bezier(.76,0,.24,1)
  点阵遮罩   grid 30×16, duration .001, stagger amount .5 from random
  FLIP       1s power4.inOut, stagger each .02 from 点击项

reduced-motion
  mathis 24 处 / hatom 0 处 / retronova 站点侧 0 处
  → 抄 hatom 与 retronova 的动效时必须自己补
```

## 13. 结语：三个可迁移结论

1. **真正决定手感的不是曲线，是错峰与时长比。** retronova 的四角文字像终端逐行打印，靠的是「100ms 交错 + 400ms 单项」这个 1:4 比例，而不是任何一条 cubic-bezier。hatom 的行揭示像「文字从下面翻上来」，靠的是**位移量随行号从 20px 递增到 50px**。这两个都是**结构**而非**参数**，换曲线依旧成立。
2. **帧率无关是所有物理感效果的前提。** mathis 磁性的 `damping ** dt`、hatom 光标的 `1 - exp(-3*dt)`、mathis 加载层的 `1 - exp(-4*dt)`，三个站在各自写法里都用了同一类公式。而用 `current += (target-current)*0.1` 的地方（hatom 的 loader 进度）在 120Hz 上会明显偏快 —— 那处是简写，不值得抄。
3. **入场必须有两套时间：一套给「已经加载完」，一套给「无论怎样都要开始」。** mathis 用「四条件与 + `setTimeout(_, 1e4)`」；hatom 用「`progressComplete && 彩蛋就位` 才允许点击加速」；retronova 直接用 `setTimeout(o, 7400)`。三站都有兜底，且**兜底时间是显式常量**而非隐式等待。抄的时候这两个数字（完成条件 + 硬兜底）必须同时写下来。

---

*报告完。证据在 `docs/_raw/mathis/`、`docs/_raw/hatom/`、`docs/_raw/retronova/`；`docs/_raw/EVIDENCE-INDEX.md` 给出文件级对照与复核命令。文中所有引用均为证据文件内的可检索字符串。*
