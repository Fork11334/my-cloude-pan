# Antoine Wodniack（wodniack.dev / nodcoding.com）工艺拆解

> 目标站 1：`https://wodniack.dev`（Astro 4.15.9，SSR 静态产物）
> 目标站 2：`https://nodcoding.com`（WordPress + 自研 `plr` 组件层 + `luge` 平滑滚动）
> 目标站 3：`https://codepen.io/wodniack` —— **被 Cloudflare 拦截，0 个 pen 拿到源码，详见 §0.2**
> 全部一手证据：`docs/_raw/wodniack/`（索引 `EVIDENCE.md`）

**结论先说**：他「贵」的地方不是技术栈，是**约束**。整站 3 个颜色、0 个噪点纹理、0 个 `box-shadow`、
0 条 `prefers-reduced-motion`、全站唯一描边宽度 `1px`、圆角只有 `0 / 50% / 999rem` 三种取值。
所有「高级感」来自三件事：

1. 一个 **5 秒**的 loader：8 条 div（5 竖 + 3 横）拼出 AW 字形 + 三边 `1rem` 边框，全程只有 `power4` / `power3`；
2. 首屏 `<a-waves>`：**10×32px 点阵，每帧重写 `<path d>`**（不是 WebGL，不是 `stroke-dasharray`）；
3. 一套把「几何线」当唯一装饰语言的克制排版（Bigger Display 大写 + Fraktion Mono 8–14px 标签 + Editorial New 200 正文）。

---

## 0. 证据与方法（含抓不到的部分）

### 0.1 抓取命令：`Invoke-WebRequest` 超时，`curl.exe` 可用

```powershell
# Invoke-WebRequest 在本环境 25s 超时无响应；curl.exe 1.8s 返回 200
$UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
curl.exe -s -o "00-wodniack-home.html" -w "http=%{http_code} size=%{size_download}`n" --max-time 40 -A $UA "https://wodniack.dev/"
# 站点是 Astro，HTML 里直接暴露全部产物路径：
#   /_astro/index.MJ9FiCyD.css   /_astro/hoisted.BvNyQ0G_.js
curl.exe -s -o "10-index.css"  --max-time 40 -A $UA "https://wodniack.dev/_astro/index.MJ9FiCyD.css"   # 72,702 B
curl.exe -s -o "11-hoisted.js" --max-time 40 -A $UA "https://wodniack.dev/_astro/hoisted.BvNyQ0G_.js"  # 195,891 B
```

实测记录（本次会话）：

| 目标 | 方法 | 结果 |
| --- | --- | --- |
| `wodniack.dev/` | `Invoke-WebRequest` | **超时**（25s，无响应） |
| `wodniack.dev/` | `curl.exe` | **200**，92,298 B，1.85s，非 SPA 空壳（SSR 全量 DOM） |
| `wodniack.dev` DNS | `Resolve-DnsName` | 104.21.19.233 / 172.67.190.118（Cloudflare CDN，非挑战页） |
| `nodcoding.com/` | `curl.exe` | **200**，147,828 B |
| `codepen.io/wodniack` | `curl.exe` / `web_fetch` | **403**，5,585 B，`<title>Just a moment...</title>` |
| `codepen.io` 公共 feed JSON | `curl.exe` | **403**，5,736 B，Cloudflare managed challenge |

### 0.2 CodePen：**被拦，未取到任何 pen 源码**

这是本次任务唯一失败项，如实报告，不补脑：

| 尝试路径 | HTTP | 载荷 | 判定 |
| --- | --- | --- | --- |
| `https://codepen.io/wodniack`（curl，完整 UA） | 403 | 5,585 B | Cloudflare managed challenge |
| `https://codepen.io/wodniack`（`web_fetch`） | 403 | — | 同上 |
| `https://codepen.io/wodniack/pens/public` | 403 | 5,663 B | 同上 |
| `https://codepen.io/wodniack/public-feed?format=json` | 403 | 5,736 B | 同上 |
| `r.jina.ai` 代理 | 000 | 0 B | 连接失败（不解析/被拒） |
| `web.archive.org/cdx/...`（列 pen） | 000 | 0 B | 连接重置，无法列快照 |
| `html.duckduckgo.com` / `search.brave.com` / `lite.duckduckgo.com` | 000 / 000 / 000 | 0 B | 搜索引擎全部不可达 |
| `www.bing.com/search?q=site:codepen.io/wodniack` | 302 | 174 B | 重定向到验证页，无结果 |
| `cdpn.io`（CodePen 静态域） | 404 | — | 域可达，但**没有 pen ID 就无法构造资源 URL** |
| `api.github.com/users/AntoineW/gists` | 200 | 2 B（`[]`） | gist 为空 |

**为什么这是硬墙**：CodePen 的 pen 源码只能通过 `codepen.io/{user}/pen/{id}`、`/embed/{id}` 或
`cdpn.io` 上的构建产物取得，三者都需要**先知道 pen slug/ID**；而 slug 只能从被挑战的 profile 页、
被挑战的 feed JSON 或搜索引擎取得——这三条同时被断。因此「先列 pen 清单，再逐个抓 HTML/CSS/JS」
在本环境**无法执行**，我不编造 pen 标题。

> 附带发现：他站内「MyWay」区引用了两个视频 `/_astro/Pen-4.BOCLYASq.mp4`、`/_astro/Pen-6.CMyHVvwm.mp4`
> ——这是他把自己 pen 的录屏放回作品集，文件名只能证明「至少存在 Pen 4 / Pen 6」，**不能**反推 slug。

**替代方案与可信度**：所有工艺结论改用「线上生产构建（HTML/CSS/JS 三件套）+ 官方仓库源码」双源。
这比 pen 更强：pen 是他 2015–2020 的实验碎片，而这两份是他 2025 年**线上真正跑的代码**。
下文凡涉及「pen 里可能怎么写」的推断，一律标注 `未核实`，并集中列在文末。

## A. Loader：5 秒，8 条线，只用 `power4` / `power3`

### A.1 形态：不是遮罩，是「红色闪一帧 + 透明线框」

SSR 出来的 loader 内联样式（`15-home-pretty.html`）：

```html
<div class="site-intro js-intro" style="opacity:1;position:fixed;top:0;left:0;z-index:50;
     width:100%;height:100%;background:#F40C3F;">
  <div class="sb__path sb__path--v sb__path--v-1 js-logo-line-v"></div>
  <div class="sb__path sb__path--h sb__path--h-1 js-logo-line-h"></div>
  <div class="sb__path sb__path--v sb__path--v-2 js-logo-line-v"></div>
  <div class="sb__path sb__path--v sb__path--v-3 js-logo-line-v"></div>
  <div class="sb__path sb__path--h sb__path--h-2 js-logo-line-h"></div>
  <div class="sb__path sb__path--v sb__path--v-4 js-logo-line-v"></div>
  <div class="sb__path sb__path--h sb__path--h-3 js-logo-line-h"></div>
  <div class="sb__path sb__path--v sb__path--v-5 js-logo-line-v"></div>
  <div class="site-intro__border site-intro__border--top js-border-top"></div>
  <div class="site-intro__border site-intro__border--left js-border-left"></div>
  <div class="site-intro__border site-intro__border--right js-border-right"></div>
</div>
```

计数（`[regex]::Matches` 实测）：`js-logo-line-v` = **5**，`js-logo-line-h` = **3**，边框 = **3**（top/left/right，**没有 bottom**）。

第一帧之后，时间轴做的第一件事就是把红底擦掉：

```js
tl.set(wrapper, { opacity: '' })          // .js-site-wrapper 的 SSR opacity:0 放开
tl.set(intro,  { background: 'transparent' })   // 红色只活到这一帧
```

### A.2 时间轴原文（`src__pages__index.astro:402–518`，一字未改）

```js
const tl = gsap.timeline()

tl.fromTo(logoLinesV, { scaleY: 0 }, { scaleY: 1, duration: 1, ease: 'power4.inOut', stagger: 0.15 }, 0)
tl.fromTo(logoLinesH, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power4.inOut', stagger: 0 }, 1)

tl.set(logoLinesV, { transformOrigin: '50% 0' })

tl.fromTo(logoLinesV, { scaleY: 1 }, { scaleY: 0, duration: 1, ease: 'power4.in',
          immediateRender: false, stagger: 0.1 }, 2)
tl.fromTo(logoLinesH, { scaleY: 1 }, { scaleY: 0, duration: 0.5, ease: 'power4.in',
          immediateRender: false, stagger: 0.1 }, 2.1)

tl.from(borderTop,          { scaleY: 0, duration: 3, ease: 'power3.inOut' }, 1)
tl.from([borderLeft, borderRight], { scaleX: 0, duration: 3, ease: 'power3.inOut' }, 1)

tl.call(() => document.dispatchEvent(new CustomEvent('intro')), null, '-=1.85')  // ≈ t=3.15s
tl.call(() => {
  mount.style.opacity = '1'
  intro.remove()
  document.documentElement.classList.remove('is-scroll-blocked')
  Ticker.nextTick(() => Emitter.emit('updateViewport'))
}, null, 5)                                                                      // t=5s 结束
```

---

## B. SVG 线描与首屏波浪：**没有 `pathLength`，没有 `stroke-dasharray`**

`14-index-pretty.css` 与 `00-wodniack-home.html` 全文匹配：`pathLength` / `stroke-dasharray` / `stroke-dashoffset` 各 **0** 次；
`stroke-width` 10 处**全部为 `1px`**。所以线描动画在他这里不是 dash 流，而是 ①`scaleX/scaleY` 缩放 ②每帧重算 `d`。
Logo 是纯直线段的手写 path（`M0 0v280h39.755V16.8H59.65V280h39.756V0H0Z`，**0 个曲线命令**），
和 loader 里 5 竖 3 横的 div 是同一套几何语言。

### B.1 波浪的真实机制：`10 × 32` 点阵 + Perlin

`AWaves.astro:191–201`（点阵生成）：

```js
const xGap = 10          // 水平间距 10px → 线条密度
const yGap = 32          // 垂直间距 32px → 每条线上的采样点

const oWidth  = width  + 200    // 左右各多出 100px，防边缘露白
const oHeight = height + 30

const totalLines  = Math.ceil(oWidth / xGap)     // 竖线数量（= path 数量）
const totalPoints = Math.ceil(oHeight / yGap)    // 每条线的点数
const xStart = (width  - xGap * totalLines)  / 2  // 居中，允许负值
const yStart = (height - yGap * totalPoints) / 2
```

即：**每条竖线一个 `<path>`，path 由 `totalPoints` 个点连成 `L` 折线**。1600px 宽的屏幕 →
`ceil(1800/10) = 180` 条 path，每条 `ceil(h/32)` 个点。这是纯粹的 2D Canvas 思路，只不过落在 DOM/SVG 上。

`AWaves.astro:246–252`（波动）：

```js
const move = noise.perlin2(
  (p.x + time * 0.0125) * 0.002,   // 时间以 12.5px/s 横向推进
  (p.y + time * 0.005)  * 0.0015   // 纵向 5px/s
) * 12                            // 相位幅度 12 rad

p.wave.x = Math.cos(move) * 32    // ← 水平振幅 32px
p.wave.y = Math.sin(move) * 16    // ← 垂直振幅 16px
```

**这就是「首屏波浪」的全部参数**：`cos×32 / sin×16`，相位来自 2D Perlin，频率 `0.002 / 0.0015`，
时间推进 `0.0125 / 0.005`。它不是正弦波（没有 `sin(t)`），是**用 Perlin 噪声当相位**的伪随机波——
所以波形永远不会明显重复，看起来「有生命」。

### B.2 指针交互的弹簧（这是他真正的「手感」所在）

`AWaves.astro:255–280`：

```js
if (this.isInteractive) {
  const dx = p.x - mouse.sx
  const dy = p.y - mouse.sy
  const d  = Math.hypot(dx, dy)
  const l  = Math.max(175, mouse.vs)        // ← 影响半径：至少 175px，且随鼠标速度放大

  if (d < l) {
    const s = 1 - d / l                     // 距离衰减，线性
    const f = Math.cos(d * 0.001) * s       // 空间频率 0.001 → 波长 ≈ 6283px（几乎不变号）

    p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065   // ← 力系数 0.00065
    p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065
  }

  p.cursor.vx += (0 - p.cursor.x) * 0.005   // 弹簧张力
  p.cursor.vy += (0 - p.cursor.y) * 0.005
  p.cursor.vx *= 0.925                      // 摩擦
  p.cursor.vy *= 0.925

  p.cursor.x += p.cursor.vx * 2             // 积分强度
  p.cursor.y += p.cursor.vy * 2

  p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x))   // 钳制 ±100
  p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y))
}
```

参数表（可直接照抄）：

| 参数 | 值 | 作用 |
| --- | --- | --- |
| 影响半径 `l` | `max(175, vs)` px | 175 是下限，鼠标越快影响越大 |
| 距离衰减 | `1 - d/l`（线性） | 没有用平方衰减 |
| 空间频率 | `0.001` | `cos(d*0.001)`，波长 6283px，等于「几乎恒定推力」 |
| 力系数 | `0.00065` | 乘了 `l * vs`，所以快速划过时力会被双倍放大 |
| 弹簧张力 | `0.005` | 回中速度 |
| 摩擦 | `0.925` | 每帧保留 92.5% 速度，约 9 帧衰减到 1/2 |
| 积分强度 | `×2` | 等效 dt 放大 |
| 钳制 | `±100` px | 防止点被拉飞后回不来 |
| 鼠标平滑 | `sx += (x - sx) * 0.1` | 一阶低通，时间常数约 10 帧 |
| 鼠标速度 | `vs += (d - vs) * 0.1`，上限 `100` | 同样的 0.1 低通 |

注意 `isInteractive` 由 `introend` 事件置真（`AWaves.astro:154–156`）——**loader 没结束前，鼠标划过首屏没有任何反应**。
这是「先让动画跑完，再开放交互」的纪律。

### B.3 描边与路点

```scss
/* AWaves.astro <style> */
svg .a__line {
  fill: none;
  stroke: color(secondary);
  stroke-width: 1px;          // 全站唯一描边宽度
}
```

`drawLines()` 里的取舍（`AWaves.astro:304–328`）：

```js
let d = `M ${p1.x} ${p1.y}`
points.forEach((p1, pIndex) => {
  const isLast = pIndex === points.length - 1
  p1 = moved(p1, !isLast)        // 最后一个点不加光标力，避免线尾被拽断
  d += `L ${p1.x} ${p1.y}`       // 直线段；Q 的写法被注释掉了
})
paths[lIndex].setAttribute('d', d)
```

- 只取 1 位小数：`Math.round(v * 10) / 10`（`moved()`），减少 `d` 字符串长度 → 减少 GC；
- 注释里保留了 `Q`（二次贝塞尔）版本，**但他最终选了 `L`**：64 个点以上的折线在 1px 描边下肉眼看不出区别，却省掉贝塞尔求值；
- **最后一个点固定不加光标力**，线尾不会跟着鼠标甩出去——这是「线是绷在框上的」的观感来源。

---

## C. 滚动：Lenis 零配置 + `scrollProgress` 全局变量 + 1 处 sticky

### C.1 Lenis 初始化：只有 4 行，**一个参数都没有**

`src__pages__index.astro:290–305`：

```js
initLenis() {
  const lenis = new Lenis()              // ← 无参数：没有 lerp、没有 wheelMultiplier、没有 duration

  lenis.on('scroll', ScrollTrigger.update)

  Ticker.add((time) => {
    lenis.raf(time * 1000)               // ← Ticker 给的是秒，Lenis 要毫秒
  })

  window.lenis = lenis
  this.lenis = lenis
}
```

这就是全部。没有 `lerp: 0.1`、没有 `smoothWheel`、没有 `duration: 1.2`。
**默认值即他的选择**（Lenis 默认 `lerp: 0.1`，约等于 100ms 时间常数）。
「等价手写 lerp」= `current += (target - current) * 0.1`，跟 §B.2 里鼠标平滑的 `0.1` 是同一个系数——
他整套系统的「阻尼语言」只有一个数字：**0.1**。

### C.2 全局滚动进度：一个 window 变量，全站消费

```js
window.maxScrollTop  = document.body.scrollHeight - window.safeHeight   // index.astro:356
window.scrollProgress = window.scrollY / window.maxScrollTop            // index.astro:378
```

CSS 侧直接读这个比例做视差（`14-index-pretty.css`）：

```css
.s-work .s__canvas {
  position: absolute; top: 0; left: 0; z-index: 1;
  width: 100%; height: 100%;
  transform: translate3d(0, calc(var(--scroll-progress) * -5%), 0);   /* ← 视差系数 -5% */
}
```

`--scroll-progress` 是 `0–1` 的浮点。**-5% 是整站最强的视差量**（相对于元素自身高度），
不是常见的 0.2–0.5 倍速位移。他宁可「几乎不动」，也不让背景抢文字。

滚动条 thumb 走同一个比例：`thumbY = p * (vh - thumbH)`；拖拽时反解 `p` 再 `lenis.scrollTo(p * maxScrollTop)`，
**不接 `scrollTo` 会和虚拟滚动打架**。全站 `position: sticky` 只出现 **1** 次，场景切换靠 ScrollTrigger 的 `scrub: 1`（1 秒追赶）。

---

## D. 排版：3 个字族、1 个基准 token、0 个 `clamp()`

### D.1 字族与文件（`index.MJ9FiCyD.css` 的 `@font-face` 与 HTML 预载）

| 字族 | 角色 | 用法 |
| --- | --- | --- |
| **PP Editorial New**（Regular 400 / Ultralight 200） | 正文衬线 | 段落，`1.15–1.25rem`，行高 1.48 |
| **PP Fraktion Mono**（Regular / Bold） | 等宽标签 | 8–14px、`uppercase`、`letter-spacing .05–.15em` |
| **Bigger Display** | 巨型标题 | 只用于 hero / 章节大字，`uppercase`，行高 `.82–.85` |

### D.2 字号阶梯：**唯一的 token 是 base，其余是字面量**

`variables-scss/fonts.scss` 全文只有一条：

```scss
$theme-font-families: (
  fraktion:  "'Fraktion Mono', monospace",
  editorial: "'Editorial New', serif",
  bigger:    "'Bigger Display', sans-serif",
);

$theme-font-styles: (
  default: (
    base: (16px, 400, 1.48, editorial, -0.025em),
    //      size weight line-height family letter-spacing
  ),
);
```

编译后 `:root` 只有 4 个变量：

```css
--font-size-base: 16px;
--font-weight-base: 400;
--font-height-base: 1.48;
--font-spacing-base: -.025em;
```

其余字号**全部是组件内的字面量**（`14-index-pretty.css` 去重后共 21 个不同 `font-size`）：

| 用途 | 值 | 来源类型 |
| --- | --- | --- |
| 巨型 hero 字 | `8.625rem`（138px） | 字面量 |
| 章节大标题 | `6.5rem` / `5.5rem` / `5rem` | 字面量 |
| 中标题 | `4rem` / `3.75rem` / `3.5rem` | 字面量 |
| 小标题 | `1.75rem` / `1.5rem` / `1.25rem` | 字面量 |
| 正文 | `1.15rem` / `1.1rem` / `1em` | 字面量 |
| 视口驱动的 hero | `14vw`、`calc(31vw - 1rem)`、`calc(31vw - .75rem)` | 字面量 |
| 等宽标签 | `13px` / `14px` | 字面量 |
| 内联强调 | `.5em` / `75%` / `80%` / `100%` | 相对 |

**注意没有 `clamp()`**：全文 `clamp(` 命中 **0**。他用的是「断点 + 字面量 + `vw` 计算」三件套，
16 个断点（`variables-scss/breakpoints.scss`）：

```scss
desktop-xl: 2000px   desktop-lg: 1680px   desktop-md: 1530px   desktop-sm: 1280px
desktop-xs: 1080px   tablet: 987px        tablet-sm: 767px      phone: 767px+landscape / 576px
phone-landscape     sm-height: 480px      phone-sm: 400px       phone-xs: 360px
```

`calc(31vw - 1rem)` 是「两列大字」的宽度公式：每列 `31vw` 再让出 `1rem` 的缝。

### D.3 行高 / 字距 / 大小写

`line-height` 全部取值：`.82`（巨型 Display 标题）/ `.85`（次一级大标题）/ `1.15`（正文）/ `1`（等宽标签）/ `0`（纯装饰容器）/ `8px`（等宽小字）。

```css
letter-spacing: .014em;   /* 微调，接近 0 */
letter-spacing: .05em;    /* 等宽小标签 */
letter-spacing: .1em;     /* 菜单 / 元信息 */
letter-spacing: .15em;    /* 最小号的 uppercase 标签 */
letter-spacing: var(--font-spacing-base);  /* -.025em，正文用负字距 */
```

```css
text-transform: uppercase;   /* 唯一的大小写变换，命中多次 */
```

**`font-variant-caps` / `small-caps` 命中 0 次**——他没有用 small-caps。
「小字看起来像小型大写」是靠 **Fraktion Mono + `uppercase` + `.15em` 字距 + 8–13px** 手搓出来的。
这比 `font-variant: small-caps` 可靠：后者在不同字族下字重/字宽不一致，而他只用一个等宽字族，天然对齐。

**正文用负字距 `-.025em`**（衬线字收紧），**标签用正字距 `.05–.15em`**（等宽字放开）。
这一正一负是全站「气质分层」的核心——不是靠字号，是靠字距方向。

### D.4 逐字/逐行 stagger：两套节奏

**A) hero 逐字（`SHero.astro`）——超密**

```js
duration: 3,                       // 单个字 3 秒（!）
ease: 'expo.out',
stagger: { … },                    // 对象形式，配合 from:'start' / amount
duration: 2, ease: 'expo.inOut', stagger: 0.02
```

`stagger: 0.02`（20ms）是**极密**的逐字错开：12 个字总共只差 0.24s，肉眼读作「整词一起浮上来」，
但每个字的曲线相位略有差异，所以边缘有「毛刺感」。
如果按常见的 `0.05–0.1s` 做逐字，12 个字会拖到 1.2s，看起来像幻灯片。**他的答案是 0.02。**

**B) 行级遮罩（`SCTA.astro`）——用 `clip-path` 而不是 `translateY`**

```scss
// 每一行一个 clip-path，0.03em 递增（$i 是行序号）
clip-path: inset(0 0 calc(100% - (0.03em * $i)) 0);
clip-path: inset(calc(100% - (0.03em * $i)) 0 0 0);

--toggle-delay: calc(var(--delay) + var(--offset) + 0.45s);
--toggle-delay: calc(var(--delay) + var(--offset) + 1.45s);

transition: clip-path 0.6s ease(in-out-quint);
```

`inset(0 0 calc(100% - .03em) 0)` 这类写法的妙处：**遮罩高度按 `em` 算**，所以字号一变，遮罩自动跟着变，
不需要重算像素。`0.45s / 1.45s` 两个延迟差 = 1s，是「上半句出、下半句进」的交错窗口。

**C) 标题逐字母（`SWork.astro` 的 `.js-letter`）**

DOM 里 `W / O / R / K` 四个 `<span class="s__title__letter js-letter">`。
逐字母入场曲线来自 `power4.inOut`（§A 同一族），`stagger` 在 0.1 量级。

---

## E. 指针：**没有自定义光标**，只有「擦除式悬停」和一颗 8px 圆点

### E.1 先纠正一个预期

我把 DOM（92KB HTML）与 CSS（73KB）都搜过：**没有 `.cursor` / `.js-cursor` / `mix-blend-mode: difference` 的自定义光标层**。
全站跟指针有关的东西只有三样：

1. `a-waves:before` 那颗 `0.5rem` 的圆点（§B.2 的 `tick()` 每帧写 `--x/--y`），`will-change: transform`，用低通后的坐标跟随；
2. `cursor: grab / grabbing`（`SWork` 可拖拽场景）、`cursor: pointer`、`cursor: default`；
3. 各种 `:hover` 的 `scale` 擦除。

**没有磁性吸附（magnetic button）**：`SiteHead.astro` 里搜不到 `quickTo` / `magnet` / `mousemove` 的按钮跟随逻辑。
他的悬停手感完全靠 CSS 完成，不是 JS。

### E.2 真正的签名动作：`scale: 0 1 → 1 1` 的横向擦除

`14-index-pretty.css` 里这个模式反复出现（社交图标、对比度按钮、菜单项）：

```css
/* 底层：一块实色，横向压缩到 0，锚点在左边 */
.sb-socials .sb__icon:before {
  position: absolute; top: 0; left: 0;
  display: block; width: 100%; height: 100%;
  background: var(--color-primary);
  scale: 0 1;                    /* ← 逻辑属性 scale，不是 transform: scaleX() */
  transform-origin: 0 50%;
  content: "";
}

/* 悬停时横向铺满 */
a:hover .sb__icon:before { scale: 1 1; transform-origin: 0 50%; }

/* 计时：0.3s，曲线 cubic-bezier(1,0,0,1) = in-out-expo */
transition: scale 0.3s cubic-bezier(1, 0, 0, 1);
```

三个可抄要点：

- 用 **`scale` 属性**而不是 `transform: scaleX()`：可以独立于 `transform` 的 `translate3d` 存在，
  不会互相覆盖（`transform-origin` 也能单独生效，不必拼字符串）。
- `cubic-bezier(1,0,0,1)` 是 **in-out-expo** 的近似实现（真 expo 是 `(1,0,0,1)` 这一条在 `easing.scss` 里就叫 `in-out-expo`）：
  起步几乎不动、中段极快、结尾急停。0.3s 用这条曲线，观感像「被吸进去」。
- **锚点永远在左**（`transform-origin: 0 50%`），所以是「从左往右擦」，不是从中心放大。

### E.3 下划线的双伪元素结构

正文链接用的是 `::before` + `::after` 分工：

```css
/* SAbout 正文链接：::after 是那条线 */
.s-about .s__content a:after {
  /* 底层横线：scaleX(0) 起步 */
}
.s-about .s__content a:hover:after {
  transform: scaleX(1);
  transform-origin: 0 50%;
}

/* 另一处：::before 是覆盖块（同 E.2 的擦除） */
.sb-availability a:hover:before {
  scale: 1 1;
  transform-origin: 0 50%;
}
```

结构上就是：**`::before` 做实色擦除块（`scale: 0 1` → `1 1`），`::after` 做 1px 下划线（`scaleX(0)` → `1`）**，
两者都锚定左端。为什么不用 `text-decoration: underline`？因为 `text-decoration` 不能单独控制进度、
不能做「线先长出来、文字后变色」的两段时序。

正文里的 `text-decoration: none` 反复出现（等宽标签上 5 处），说明**装饰线一律伪元素，原生下划线全部关掉**。

## F. 页面过渡：**他根本没有 SPA 过渡**，但有两条别的路径

### F.1 事实：MPA + 每次导航重播 5 秒 loader

`wodniack.dev` 是 Astro 静态站，没有 `<ClientRouter />`（View Transitions）、没有 Swup、没有 Barba。
证据：

- `index.astro` 里搜 `sessionStorage` / `localStorage` / `hasSeen` → **0 命中**；
- `intro()` 在 `Ticker.nextTick(this.intro, this)` 里无条件调用；
- `intro.remove()` 之后没有任何「下次跳过」的标记。

**结论：每一次整页导航都会重放那 5 秒 loader。** 这在 MPA 里就等于页面过渡——
用户点链接 → 白/红一帧 → 线框重画 → 5 秒后内容出现。

这是有意为之还是偷懒？看 `html` 的初始 class 就懂了：

```html
<html lang="en" class="is-scroll-blocked theme-contrasted">
```

`is-scroll-blocked` 从 SSR 就挂着，`intro` 结束才 `classList.remove`（`index.astro:509`）。
**滚动锁是服务端渲染进 class 的**，所以 JS 没加载完也滚不动——这是「过渡」的骨架，不是补丁。

### F.2 反色过渡（真正的「页面级」动效）

`theme-contrasted` 是一个**设计好的第二套主题**（不是滤镜）：

```css
.theme-contrasted {
  --color-primary: #fff2ed;    /* 红 → 米白 */
  --color-secondary: #160000;  /* 黑不变 */
  --color-shadow: #4d4040;     /* 阴影变灰 */
  --color-white: #fff0eb;
}

/* 过渡用的全屏遮罩 */
.site-contrast-mask {
  position: fixed; inset: 0 auto auto 0;
  z-index: 20; width: 100%; height: 100%;
  background: #f40c3f;
  border-color: #160000; border-style: solid; border-width: 0 1rem 0 0;  /* 右侧 1rem 黑边 */
  mix-blend-mode: darken;                    /* ← 关键：只压暗，不加亮 */
  transform: translate3d(-100%, 0, 0);       /* 从左滑入 */
  pointer-events: none;
  will-change: transform;
}
.theme-contrasted .site-contrast-mask { /* 反色态下换成米白底 */ }
```

`mix-blend-mode: darken` 让红色遮罩扫过时**只让暗部通过**，看起来像「墨滚过纸」而不是「盖一层色块」。
`border-width: 0 1rem 0 0` 在遮罩右缘留一条黑边——扫描时像一把刮刀的刃口。

## G. 质感：0 噪点、0 阴影、1px 线、三档圆角

### G.1 「差不多是噪点」的东西，其实是条纹和点阵

| 检索 | 命中 | 实际做法 |
| --- | --- | --- |
| `feTurbulence`（SVG 噪点） | **0** | 没用噪点滤镜 |
| `noise` 关键字（CSS/HTML） | **0** | 没有 noise 纹理图 |
| `box-shadow` | **0** | 全站零阴影 |
| `backdrop-filter` / `filter` | **0** | 没有毛玻璃、没有滤镜 |
| `repeating-linear-gradient` | 有 | 用**斜条纹**代替颗粒 |
| `sprite-vanish.png` | 有 | 29 帧精灵图做「消失」 |
| `<canvas>` | 有（`js-canvas`） | 粒子/精灵喷射 |

斜条纹（About 区奖项背景，反色态）：

```css
.theme-contrasted .s-about .s__awards {
  background: repeating-linear-gradient(
    -45deg,
    transparent, transparent 1px,
    #160000 1.5px, #160000 2.5px,
    transparent 3px,
    #fff2ed 11px
  );
}
```

`1px / 1.5px / 2.5px / 11px` 这个阶梯是「1px 线 + 0.5px 抗锯齿过渡 + 8px 间隙」。
**颗粒感来自「1.5px 的线在 11px 周期里的密度」，不是来自噪声贴图**——所以放大到 4K 也不会糊。

`3000%` 宽度 ÷ 29 帧 ≈ 103.4%/帧，`steps(29, end)` 每次跳 1 帧 → **29 帧精灵图，0.75s，约 25.8ms/帧（≈38fps 的定格感）**。
用 `mask` 而不是 `background-position`，所以「消失」的形状可以是不规则的墨迹，且能透出背后的任意内容。

### G.2 圆角策略：只有三种取值

`999rem`（胶囊按钮，×4）/ `50%`（hero 圆点，×1）/ `0`（显式清零，×1）/ `inherit`（×1）—— 全站只有这 4 个值。

**没有 4px / 8px / 12px 这种「中间档」圆角**。要么直角（线框、图片、卡片一律 0），
要么正圆/胶囊。中间档圆角会让「1px 线框」的观感变软，与他的几何语言冲突。

## H. 缓动总表（24 条 cubic-bezier，`easing.scss` 原文）

```scss
$ease: (
  in-quad:      cubic-bezier(0.550,  0.085, 0.680, 0.530),
  in-cubic:     cubic-bezier(0.550,  0.055, 0.675, 0.190),
  in-quart:     cubic-bezier(0.895,  0.030, 0.685, 0.220),
  in-quint:     cubic-bezier(0.755,  0.050, 0.855, 0.060),
  in-sine:      cubic-bezier(0.470,  0.000, 0.745, 0.715),
  in-expo:      cubic-bezier(0.950,  0.050, 0.795, 0.035),
  in-circ:      cubic-bezier(0.600,  0.040, 0.980, 0.335),
  in-back:      cubic-bezier(0.600, -0.280, 0.735, 0.045),
  out-quad:     cubic-bezier(0.250,  0.460, 0.450, 0.940),
  out-cubic:    cubic-bezier(0.215,  0.610, 0.355, 1.000),
  out-quart:    cubic-bezier(0.165,  0.840, 0.440, 1.000),
  out-quint:    cubic-bezier(0.230,  1.000, 0.320, 1.000),
  out-sine:     cubic-bezier(0.390,  0.575, 0.565, 1.000),
  out-expo:     cubic-bezier(0.190,  1.000, 0.220, 1.000),
  out-circ:     cubic-bezier(0.075,  0.820, 0.165, 1.000),
  out-back:     cubic-bezier(0.175,  0.885, 0.320, 1.275),
  in-out-quad:  cubic-bezier(0.455,  0.030, 0.515, 0.955),
  in-out-cubic: cubic-bezier(0.645,  0.045, 0.355, 1.000),
  in-out-quart: cubic-bezier(0.770,  0.000, 0.175, 1.000),
  in-out-quint: cubic-bezier(0.860,  0.000, 0.070, 1.000),
  in-out-sine:  cubic-bezier(0.445,  0.050, 0.550, 0.950),
  in-out-expo:  cubic-bezier(1.000,  0.000, 0.000, 1.000),
  in-out-circ:  cubic-bezier(0.785,  0.135, 0.150, 0.860),
  in-out-back:  cubic-bezier(0.680, -0.550, 0.265, 1.550)
);
```

线上真正调用的只有 4 条（`14-index-pretty.css` 去重统计）：
`cubic-bezier(1,0,0,1)` in-out-expo（悬停 / 菜单 / border-width，0.3s 与 1.005–1.1s）、
`cubic-bezier(.86,0,.07,1)`（clip-path 揭示，0.6s / 0.8s）、
`cubic-bezier(.19,1,.22,1)` out-expo（内容淡入，0.3–0.6s）、
`cubic-bezier(.55,.055,.675,.19)` in-cubic（退场 / 星形遮罩，0.6s / 0.8s）。
`back` 系列一次都没上线——**过冲是他明确拒绝的东西**。

### H.1 GSAP 侧的 `ease` 字符串

| ease | 用在哪 | 时长 |
| --- | --- | --- |
| `power4.inOut` | loader 竖线/横线入场、场景切换 | `1s` / `1s` |
| `power4.in` | loader 退场、场景元素退场 | `1s` / `0.75s` |
| `power4.out` | nodcoding 退场、按钮 | `0.8s` / `0.15s` |
| `power3.inOut` | loader 三边边框 | `3s` |
| `power3.out` | nodcoding 虹膜张开 | `3s` |
| `power3.in` | 场景次级退场 | `0.75s` |
| `expo.out` | hero 逐字入场 | `3s` / `2s` / `1.35s` |
| `expo.inOut` | 菜单、hero 元素 | `1.5s` / `1s` |
| `slow(0.15, 0.6)` | 大图慢推（SlowMo 自定义） | — |
| `power2.in` | 长退场 | `2.7s` |

**没有 `back`、没有 `elastic`、没有 `bounce`**。24 条表里备着，线上一条都没用。
这是「贵」与「花哨」的分界线：**过冲（overshoot）一次都不要**。

---

## I. 复刻清单（12 条，零 npm，中文两页站）

**页面**：`index.html` + `verify.html`；**内容**：大号中文标题、中文段落、SVG 波线、部门分段。
**约束**：一个 `.css` + 一个 `.js`，无构建、无依赖。

> 中文三条硬约束：① 行高不能低于 `1.05`（他给拉丁 Display 用的 `.82` 会切字）；② 中文方块字字距放宽会散架，标签只用 `0.02–0.06em`；③ 逐字拆分必须跳过标点，否则标点挤压失效。

底座（每个骨架都假设已有）：

```css
:root{--c-bg:#fff0eb;--c-ink:#160000;--c-accent:#f40c3f;
  --e-out-expo:cubic-bezier(.19,1,.22,1);--e-in-out-expo:cubic-bezier(1,0,0,1);
  --e-in-out-quint:cubic-bezier(.86,0,.07,1);--e-in-cubic:cubic-bezier(.55,.055,.675,.19)}
body{margin:0;padding:1rem;background:var(--c-bg);color:var(--c-ink);
  font:400 16px/1.75 "Noto Serif SC",serif}
html.is-locked{overflow:hidden}
```

### 1. Loader：8 条线 + 三边框 · 参数：竖线 `1s/in-out-expo/stagger 150ms`、横线 `0.4s/stagger 0`、退场 `1s/in-cubic/100ms`、边框 `3s`、总长 `5s`（来源 `index.astro:402–518`）

```html
<div class="intro" id="intro" aria-hidden="true">
  <i class="v"></i><i class="h"></i><i class="v"></i><i class="v"></i>
  <i class="h"></i><i class="v"></i><i class="h"></i><i class="v"></i>
  <b class="bd bt"></b><b class="bd bl"></b><b class="bd br"></b>
</div>
```
```css
.intro{position:fixed;inset:0;z-index:50;background:#f40c3f;transition:background 0s linear .05s}
.intro.is-clear{background:transparent}
.intro .v{position:absolute;top:12%;width:2px;height:76%;background:var(--c-ink);
  transform:scaleY(0);transform-origin:50% 0;
  transition:transform 1s var(--e-in-out-expo) calc(var(--i)*150ms)}
.intro .h{position:absolute;left:12%;height:2px;width:76%;background:var(--c-ink);
  transform:scaleX(0);transform-origin:0 50%;transition:transform .4s var(--e-in-out-expo) 1s}
.intro .v.is-in{transform:scaleY(1)}
.intro .h.is-in{transform:scaleX(1)}
.intro .v.is-out{transform:scaleY(0);transition:transform 1s var(--e-in-cubic) calc(var(--i)*100ms)}
.intro .h.is-out{transform:scaleY(0);transition:transform .5s var(--e-in-cubic) .1s}
.bd{position:absolute;background:var(--c-ink);transition:transform 3s var(--e-in-out-quint)}
.bt{inset:0 0 auto;height:1rem;transform:scaleY(0);transform-origin:50% 0}
.bl{inset:0 auto 0 0;width:1rem;transform:scaleX(0);transform-origin:0 50%}
.br{inset:0 0 0 auto;width:1rem;transform:scaleX(0);transform-origin:100% 50%}
.intro.is-open .bd{transform:none}
```
```js
const I=document.getElementById('intro'), vs=[...I.querySelectorAll('.v')], hs=[...I.querySelectorAll('.h')];
const t=ms=>setTimeout(ms);
vs.forEach((e,i)=>e.style.setProperty('--i',i));
document.documentElement.classList.add('is-locked');
requestAnimationFrame(()=>I.classList.add('is-clear','is-open'));
vs.forEach((e,i)=>t(()=>e.classList.add('is-in'),i*150));
hs.forEach(e=>t(()=>e.classList.add('is-in'),1000));
t(()=>vs.forEach((e,i)=>t(()=>{e.classList.remove('is-in');e.classList.add('is-out')},i*100)),2000);
t(()=>hs.forEach(e=>{e.classList.remove('is-in');e.classList.add('is-out')}),2100);
t(()=>document.dispatchEvent(new CustomEvent('intro')),3150);
t(()=>{I.remove();document.documentElement.classList.remove('is-locked')},5000);
```

**降级**：`.intro{display:none}` + 立即解锁；JS 顶部 `if(matchMedia('(prefers-reduced-motion:reduce)').matches){I.remove();document.documentElement.classList.remove('is-locked')}`。

### 2. SVG 波线：`10×32` 点阵每帧重写 `d` · 参数：`xGap 10 / yGap 32 / 宽+200 / 高+30`、振幅 `cos×32 sin×16`、相位 `0.0125·t / 0.005·t`、`stroke-width:1px`（来源 `AWaves.astro`；他**不用** `pathLength`/`dasharray`）

```html
<div class="waves" aria-hidden="true"><svg id="wsvg"></svg></div>
```
```css
.waves{position:absolute;inset:0;overflow:hidden}
.waves svg{display:block;width:100%;height:100%}
.waves path{fill:none;stroke:var(--c-ink);stroke-width:1px;opacity:.5}
```
```js
const NS='http://www.w3.org/2000/svg', svg=document.getElementById('wsvg');
const XG=10,YG=32,AX=32,AY=16; let paths=[],cols=[],t=0,raf=0;
const phase=(x,y,t)=>Math.sin(x*.002+t*.0125)*.6+Math.sin(x*.0042+y*.0015-t*.004)*.3+Math.sin(y*.0045+t*.002)*.1;
function build(){
  const W=svg.clientWidth,H=svg.clientHeight,c=Math.ceil((W+200)/XG),r=Math.ceil((H+30)/YG);
  svg.innerHTML=''; paths=[]; cols=[];
  for(let i=0;i<=c;i++){
    const p=document.createElementNS(NS,'path'); svg.appendChild(p); paths.push(p);
    const col=[]; for(let j=0;j<=r;j++) col.push({x:(W-XG*c)/2+XG*i,y:(H-YG*r)/2+YG*j});
    cols.push(col);
  }
}
function frame(){
  t++;
  for(let i=0;i<paths.length;i++){
    const col=cols[i]; let d='M'+col[0].x+' '+col[0].y;
    for(const p of col){ const m=phase(p.x,p.y,t)*12;
      d+='L'+Math.round((p.x+Math.cos(m)*AX)*10)/10+' '+Math.round((p.y+Math.sin(m)*AY)*10)/10; }
    paths[i].setAttribute('d',d);
  }
  raf=requestAnimationFrame(frame);
}
build(); frame();
addEventListener('resize',()=>{cancelAnimationFrame(raf);build();frame()});
```

**降级**：`if(reduce){frame();cancelAnimationFrame(raf);return}` 只画一帧静态波（不要留空）。

### 3. 指针弹簧 · 参数：影响半径 `max(175, 速度)`、力 `0.00065`、张力 `.005`、摩擦 `.925`、积分 `×2`、钳制 `±100`、鼠标低通 `0.1`（来源 `AWaves.astro:255–280`）

```js
const M={x:-9e3,y:-9e3,sx:0,sy:0,lx:0,ly:0,vs:0,a:0,set:false};
addEventListener('pointermove',e=>{M.x=e.clientX;M.y=e.clientY;
  if(!M.set){M.sx=M.x;M.sy=M.y;M.lx=M.x;M.ly=M.y;M.set=true}},{passive:true});
function spring(p,reduce){
  if(reduce) return p;
  M.sx+=(M.x-M.sx)*.1; M.sy+=(M.y-M.sy)*.1;
  const dx=M.x-M.lx,dy=M.y-M.ly,sp=Math.hypot(dx,dy);
  M.vs+=(sp-M.vs)*.1; M.vs=Math.min(100,M.vs);
  M.a=Math.atan2(dy,dx); M.lx=M.x; M.ly=M.y;
  const d=Math.hypot(p.x-M.sx,p.y-M.sy),l=Math.max(175,M.vs);
  if(d<l){const s=1-d/l,f=Math.cos(d*.001)*s,k=f*l*M.vs*.00065;
    p.cx=(p.cx||0)+Math.cos(M.a)*k; p.cy=(p.cy||0)+Math.sin(M.a)*k}
  p.cx=((p.cx||0)*.925-(p.cx||0)*.005)*2; p.cy=((p.cy||0)*.925-(p.cy||0)*.005)*2;
  p.cx=Math.max(-100,Math.min(100,p.cx)); p.cy=Math.max(-100,Math.min(100,p.cy));
  return p;
}
// 在 §2 的 frame() 里对每个点先 spring(p,reduce) 再取坐标
```

**降级**：`spring(p,true)` 直接返回，波线仍在、指针不参与；同时移除 `pointermove` 监听。

### 4. 平滑滚动 · 参数：`lerp 0.1`（Lenis 默认，也是他唯一用的阻尼数字）、`wheelMultiplier 1`（来源 `new Lenis()` 零参数）

```js
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const S={cur:scrollY,tgt:scrollY,max:0}; let locked=false;
const measure=()=>S.max=document.documentElement.scrollHeight-innerHeight;
addEventListener('resize',measure); measure();
addEventListener('wheel',e=>{
  if(reduce) return;                        // 减动模式：完全不拦
  e.preventDefault(); locked=true;
  S.tgt=Math.max(0,Math.min(S.max,S.tgt+e.deltaY));
},{passive:false});
(function loop(){
  S.cur+=(S.tgt-S.cur)*(reduce?1:.1);
  if(Math.abs(S.tgt-S.cur)<.1) S.cur=S.tgt;
  if(locked) scrollTo(0,S.cur);
  requestAnimationFrame(loop);
})();
// 键盘/触控/锚点仍走原生；滚完同步目标值，防「抢回」
addEventListener('scroll',()=>{ if(!locked) S.tgt=scrollY },{passive:true});
addEventListener('touchend',()=>{locked=false},{passive:true});
```

**降级**：`reduce` 时 `wheel` 直接 `return`（不 `preventDefault`），全站回落原生滚动。

### 5. 视差：只有 `-5%` · 参数：系数 `-5%`（全站最强）、thumb 公式 `p*(vh-thumbH)`（来源 `.s__canvas` 的 `translate3d(0,calc(var(--p)*-5%),0)`）

```js
let tick=false;
addEventListener('scroll',()=>{ if(tick)return; tick=true;
  requestAnimationFrame(()=>{
    const max=document.documentElement.scrollHeight-innerHeight||1;
    document.documentElement.style.setProperty('--p',(scrollY/max).toFixed(4));
    tick=false;
  })},{passive:true});
```
```css
.hero__deco{transform:translate3d(0,calc(var(--p,0)*-5%),0);will-change:transform}
.dept__rule{transform:scaleX(calc(.2 + var(--p,0)*.8));transform-origin:0 50%}
.rail{position:fixed;right:.5rem;top:0;width:2px;height:100vh;background:rgba(22,0,0,.12)}
.rail i{display:block;width:100%;height:64px;background:var(--c-ink);
  transform:translateY(calc(var(--p,0)*(100vh - 64px)))}
@media (prefers-reduced-motion:reduce){.hero__deco,.dept__rule{transform:none}}
```

**降级**：位移归零，进度条保留（它是信息，不是动效）。

### 6. sticky 部门段 · 参数：段高 `300vh`、`top:0`、全站只给 1 个（来源：全站 `position:sticky` 仅 1 次）

```html
<section class="dept"><div class="dept__pin"><p class="label">部门 01 / 技术</p>
  <h2>把接口<br>写成可读的句子</h2></div><i class="dept__rule"></i></section>
```
```css
.dept{position:relative;height:300vh}
.dept__pin{position:sticky;top:0;height:100vh;display:grid;align-content:center;padding:var(--pad,4vw)}
.dept__rule{position:absolute;left:60%;top:12%;width:1px;height:76%;background:currentColor;opacity:.25}
@media (prefers-reduced-motion:reduce){.dept{height:auto}.dept__pin{position:static;height:auto}}
```

**降级**：减动模式下拆掉 sticky（`height:auto` + `position:static`），否则用户会「被困在一屏里」。

### 7. 字号阶梯 · 参数：`138px / 64px / 28px / 18.4px / 13px`，中文行高 `1.05 / 1.1 / 1.75`，字距 `-.02em`（标题）与 `.15em`（标签）（来源 `14-index-pretty.css` 字号表）

```css
:root{--t-hero:8.625rem;--t-h2:4rem;--t-h3:1.75rem;--t-body:1.15rem;--t-label:13px}
h1{font-size:var(--t-hero);line-height:1.05;letter-spacing:-.02em;font-weight:700;margin:0;text-wrap:balance}
h2{font-size:var(--t-h2);line-height:1.1;letter-spacing:-.01em;font-weight:700;margin:0 0 .5em}
h3{font-size:var(--t-h3);line-height:1.3;font-weight:600;margin:0 0 .4em}
p{font-size:var(--t-body);line-height:1.75;letter-spacing:.01em;max-width:34em;margin:0 0 1em}
.label{font-size:var(--t-label);line-height:1;letter-spacing:.15em;font-weight:500;
  font-variant-numeric:tabular-nums}
html{font-synthesis:none;text-spacing-trim:trim-start}   /* 禁假粗体 + 标点挤压 */
@media (max-width:1280px){:root{--t-hero:6.5rem;--t-h2:3rem}}
@media (max-width:767px){:root{--t-hero:14vw;--t-h2:2rem;--t-body:1rem} h1{line-height:1.12}}
```

**降级**：本条无动效；但字号必须随视口变化，否则 320px 宽会横向滚动。

### 8. 逐字 / 逐行 · 参数：逐字 `stagger 0.02`（不是 0.1）、单字 `.9s out-expo`；行遮罩 `0.03em` 递增、`0.6s in-out-quint`、交错 `0.45s/1.45s`（来源 `SHero.astro`、`SCTA.astro`）

```js
const PUNCT='，。、；：？！「」『』（）—…·';
document.querySelectorAll('[data-split]').forEach(el=>{
  const txt=el.textContent.trim(); el.textContent='';
  [...txt].forEach(ch=>{
    if(PUNCT.includes(ch)) return el.append(ch);      // 标点不包 span
    const s=document.createElement('span');
    s.className='ch'; s.textContent=ch;
    s.style.setProperty('--i',el.querySelectorAll('.ch').length);
    el.append(s);
  });
});
```
```css
[data-split] .ch{display:inline-block;transform:translateY(110%);
  transition:transform .9s var(--e-out-expo) calc(var(--i)*20ms)}
.is-in [data-split] .ch{transform:none}
.lines{-webkit-mask:repeating-linear-gradient(180deg,#000 0 1.75em,transparent 1.75em 3.5em);
        mask:repeating-linear-gradient(180deg,#000 0 1.75em,transparent 1.75em 3.5em);
  animation:lineIn .6s var(--e-in-out-quint) both}
@keyframes lineIn{from{opacity:.001;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){[data-split] .ch{transform:none;transition:none}.lines{animation:none}}
```

**降级**：JS 里 `if(reduce) return` 根本不拆字（拆了会破坏朗读与复制）。

### 9. 悬停：双伪元素 · 参数：`::after` 下划线 `scaleX 0→1`、`0.3s in-out-expo`；`::before` 擦除 `scale:0 1→1 1`、`transform-origin:0 50%`（来源 `.sb__icon:before` + `a:hover:after`）

```css
.link{position:relative;display:inline-block;color:inherit;text-decoration:none;padding:.1em 0}
.link::after{content:"";position:absolute;left:0;bottom:0;width:100%;height:1px;
  background:currentColor;transform:scaleX(0);transform-origin:0 50%;
  transition:transform .3s var(--e-in-out-expo)}
.link:hover::after,.link:focus-visible::after{transform:scaleX(1)}
.wipe{position:relative;isolation:isolate;padding:.45em 1em;border:1px solid currentColor;
  background:none;color:inherit;font:inherit;cursor:pointer}
.wipe::before{content:"";position:absolute;inset:0;z-index:-1;background:currentColor;
  scale:0 1;transform-origin:0 50%;transition:scale .3s cubic-bezier(1,0,0,1)}
.wipe:hover::before,.wipe:focus-visible::before{scale:1 1}
.wipe:hover{color:var(--c-bg)}
@media (prefers-reduced-motion:reduce){.link::after,.wipe::before{transition:none}}
```

**降级**：去掉过渡但保留 hover 结果（线直接出现、色块直接铺满）。

### 10. 两页过渡：反色遮罩 · 参数：`0.6s`、`cubic-bezier(.86,0,.07,1)`、`translate3d(-100%)→0`、右缘 `1rem` 黑边、`mix-blend-mode:darken`（来源 `.site-contrast-mask`）

```css
.curtain{position:fixed;inset:0;z-index:60;background:var(--c-accent);
  border-right:1rem solid var(--c-ink);mix-blend-mode:darken;pointer-events:none;
  transform:translate3d(-100%,0,0);transition:transform .6s var(--e-in-out-quint);
  will-change:transform}
.curtain.is-in{transform:translate3d(0,0,0)}
html.arriving .curtain{transform:translate3d(0,0,0);transition:none}
html.arriving.is-ready .curtain{transform:translate3d(100%,0,0);
  transition:transform .6s var(--e-in-out-quint)}
```
```js
const curtain=document.getElementById('curtain');
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
document.getElementById('go').addEventListener('click',e=>{
  if(reduce) return;                                  // 原生跳转
  e.preventDefault(); curtain.classList.add('is-in');
  setTimeout(()=>location.href='verify.html',360);     // 60% 时跳
});
if(sessionStorage.getItem('nav')==='1'){              // verify.html 侧
  document.documentElement.classList.add('arriving');
  requestAnimationFrame(()=>document.documentElement.classList.add('is-ready'));
  sessionStorage.removeItem('nav');
}
```

**坑**：混合基准是最近的有 `isolation` 的祖先；遮罩要挂 `body` 直下且 `body` 无 `transform`。
**降级**：`reduce` 时不拦截点击、不执行 `arriving` 分支。

### 11. 质感：条纹代替噪点 · 参数：条纹周期 `11px`、线宽 `1.5px`、`-45deg`；画框 `1rem`；圆角只允许 `0/50%/999rem`；`box-shadow` 零（来源 `.theme-contrasted .s__awards`、全站 `border-radius` 仅 4 值）

```css
.dept--alt{background:repeating-linear-gradient(-45deg,
  transparent 0 1px,rgba(22,0,0,.55) 1.5px 2.5px,transparent 3px 11px)}
.frame{position:fixed;inset:1rem;z-index:5;pointer-events:none;
  border:1px solid rgba(22,0,0,.18);border-radius:0}
.pill{border-radius:999rem;padding:.5em 1.2em;border:1px solid currentColor}
.dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--c-ink)}
.card{border:1px solid rgba(22,0,0,.2);border-radius:0}   /* 中间档圆角：禁止 */
@media (max-width:767px){.frame{inset:.5rem}}
/* 若确实要颗粒而非条纹：内联 SVG，零请求 */
.grain::after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.035;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")}
```

**注意**：`feTurbulence` 那段是**替代方案**，不是他的做法——他全站 `0` 个噪点纹理、`0` 个 `box-shadow`。

### 12. 缓动落地：4 变量 + 1 个 JS 补间 · 参数：`in-out-expo(1,0,0,1)` 悬停/遮罩、`out-expo(.19,1,.22,1)` 入场、`in-out-quint(.86,0,.07,1)` clip-path、`in-cubic(.55,.055,.675,.19)` 退场（来源 `easing.scss` 24 条）

```css
:root{--e-out-expo:cubic-bezier(.19,1,.22,1);--e-in-out-expo:cubic-bezier(1,0,0,1);
  --e-in-out-quint:cubic-bezier(.86,0,.07,1);--e-in-cubic:cubic-bezier(.55,.055,.675,.19)}
.reveal{opacity:0;translate:0 12px;
  transition:opacity .6s var(--e-out-expo),translate .6s var(--e-out-expo)}
.reveal.is-in{opacity:1;translate:0 0}
.reveal:nth-child(2){transition-delay:.06s}
.reveal:nth-child(3){transition-delay:.12s}
```
```js
const EASE={outExpo:t=>t===1?1:1-Math.pow(2,-10*t),
  inOutExpo:t=>t===0?0:t===1?1:t<.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2};
function tween(from,to,dur,fn,onUpdate){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){onUpdate(to);return}  // 降级
  const t0=performance.now();
  (function step(now){const t=Math.min(1,(now-t0)/dur);
    onUpdate(from+(to-from)*EASE[fn](t)); if(t<1)requestAnimationFrame(step)})(t0);
}
```

**统一降级兜底**（他本人 `0` 次 `prefers-reduced-motion`，这一条必须补）：

```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important;scroll-behavior:auto !important}
  .intro{display:none}
  .dept{height:auto}.dept__pin{position:static;height:auto}
  .curtain{display:none}
}
```

---

## K. 未核实清单（诚实边界）

1. **CodePen 全部 pen**：Cloudflare managed challenge（403 / 5,585 B）；搜索引擎与 Wayback 全部不可达；
   **0 个 pen 的 HTML/CSS/JS 未取得**（§0.2）。站内 `Pen-4.mp4` / `Pen-6.mp4` 只能证明至少存在 Pen 4 / Pen 6。
2. `SMyWay` 的 3D 物件旋转上限与逐帧阻尼：`--rx/--ry/--rz` 写入点已确认，tween 数值未逐值反解。
3. nodcoding 的 `luge` 内部 `lerp` 默认值（75KB 打包件，未逐行读）。
4. 波浪真机帧率与 `d` 字符串拼接的 GC 压力**未实测**；1600px 宽约 180 条 path 每帧全量重写，低端机建议降到 `8×48`。
5. `sprite-vanish.png` 是否恰为 29 帧（`steps(29,end)` + `3000%` 是强证据，未数图）；hero 逐字 `stagger` 的对象形式完整键值亦未展开。
