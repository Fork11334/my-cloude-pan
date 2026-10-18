# In Pieces 工艺拆解与迁移手册

> 目标站 `http://species-in-pieces.com` ｜ 基准：本地抓取 `index.html` 48,911 B、
> `css/main.css` 724,874 B、`js/main.min.js` 22,883 B ｜ 原始文件与逐条证据见
> `docs/_raw/inpieces/`（索引 `EVIDENCE.md`）

**一句话结论**：这个站没有任何 CSS 3D。`perspective`、`transform-style: preserve-3d`、`rotate3d` 在 724 KB 样式表里各出现 **0 次**。它用「30 个 100%×100% 的 div + 每片一个
`clip-path: polygon()` 三点三角形 + 一个平涂色」造出低多边形立体感，再用 `clip-path` 的三点插值冒充「翻转」。**高级感全部来自参数编排，不来自技术栈。**

---

## 0. 抓取方法

`web_fetch` 只回空壳，必须原始请求：

```powershell
$ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
$r = Invoke-WebRequest -Uri 'http://species-in-pieces.com' -UseBasicParsing -TimeoutSec 30 -Headers @{'User-Agent'=$ua}
[System.IO.File]::WriteAllText("docs\_raw\inpieces\index.html", $r.Content, [System.Text.Encoding]::UTF8)
[regex]::Matches($r.Content,'(?:href|src)\s*=\s*["'']([^"''>]+)["'']')|ForEach-Object{$_.Groups[1].Value}|Sort-Object -Unique
```

关键是**必须拉 725 KB 的 `main.css`**：HTML 只有结构，全部几何坐标在 CSS 里。`js/vars.min.js`（40 KB）只有 30 只动物的名字/拉丁名/分布/三段文案，**不含坐标**。

---

## 1. 动物是怎么拼出来的

### 1.1 数量：每只 30 片，纯 `div`

`index.html` 精确计数：`shard-wrap` → **30**，`class="shard"` → **30**，全文档元素 **778**（div 176）。层级 `#animalchanger > .level-one > .level-two > .animal-mover > .wrap > .shard-wrap > .shard`，
**没有 `<svg>`、`<canvas>`、图片裁切或 WebGL。**（CSS 有 `nth-child(31..33)` 规则但 DOM 无对应元素，属死代码。）

### 1.2 定位方式：不定位

```css
.shard-wrap { position:absolute; width:100%; height:100%; z-index:2; transition:.3s; }
.shard-wrap .shard {
  position: absolute; width:100%; height:100%;      /* 每一片都和画布一样大 */
  transition: 1s cubic-bezier(0.7, 0.3, 0, 1);
  -webkit-clip-path: polygon(50% 50%, 50% 50%, 50% 50%);
  background-color: #1a1a1d; }
```

**30 个 shard 全部是同一块 100%×100% 画布，绝对定位完全重叠。** 三角形位置 100% 由 `clip-path` 决定，`left/top/transform` 一个都不参与。坐标系只有 `.wrap` 的百分比，
其尺寸由 `sizeshards()` 按视口算：`w = 0.99·vw`、`h = 0.7·w`（固定 10:7）、`margin` 取负一半居中 → 换分辨率不重算任何几何。

### 1.3 接缝为什么不露白

三条叠加，缺一不可。**① 绝对重叠**：30 片不是「拼」的是「叠」的，每片都是完整画布，相邻三角形的公共边落在**完全相同的百分比坐标**上，且都绘制在同一个 100% 盒子里，
不存在 transform 缩放带来的亚像素缝。**② 不做 `scale`**：常见的 `transform: scale(1.01)` 补缝法这里根本没用，没有任何片被独立缩放/位移。**③ 底色兜底**：`.wrap` 背后是
`#animalchanger { background-color:#1a1a1d }`，真有 1px 缝也是深底。全文没有 `stroke`、`outline`、`box-shadow` 补缝的痕迹——**接缝是被架构消掉的，不是打补丁。**

### 1.4 三角剖分：每片一个平涂色

```css
#animalchanger.crow .wrap .shard-wrap:nth-child(1) .shard {
  clip-path: polygon(32.8% 58%, 38.4% 61.2%, 12.2% 81.5%);  background-color: #eee5d9; }
#animalchanger.crow .wrap .shard-wrap:nth-child(3) .shard {
  clip-path: polygon(23.7% 62.9%, 39.2% 42.8%, 50.8% 49.8%); background-color: #3c3329; }
```

全站 `clip-path: polygon(...)` 声明 **1,352** 条（含 `-webkit-` 共 1,808 条），其中 **1,324 条为 3 顶点**（纯三角形），27 条 8 顶点（统计图表），1 条 6 顶点。
坐标**不是**严格中心放射（`32.8% 58%, 38.4% 61.2%, 12.2% 81.5%` 完全不含中心），是一张手调三角网（Delaunay 风格）。但预加载阶段用**严格扇形**——三点里必有一个精确 `50% 50%`：
`body.preloader .shard-wrap:nth-child(2) .shard { clip-path: polygon(47.47% 13.626%, 50% 50%, 52.9% 13.867%); }` `body.preloader .shard-wrap:nth-child(3) .shard { clip-path: polygon(52.782% 13.867%, 50% 50%, 58.45% 15.313%); }`
注意 N=3 的第一点 ≈ N=2 的第三点（`52.782%` vs `52.9%`）—— **沿轮廓顺序取点、相邻两片共享一个顶点**的环形生成。

---

## 2. 3D 感从哪来

### 2.1 先否认：没有 CSS 3D

| 属性 | 次数 | 属性 | 次数 |
|---|---|---|---|
| `perspective` | **0** | `rotateY` | 2（均与动物无关） |
| `transform-style: preserve-3d` | **0** | `translateZ` | 5（全部 `(0)`） |
| `rotate3d` / `matrix3d` / `scale3d` | **0/0/0** | `translate3d` | 50（全部 z=0） |
| `will-change` | **0** | `backface-visibility` | 5（全部 `hidden`） |

两处 `rotateY`：一处是统计图表收展顺手写的 `scale(1) rotate(0deg) translateZ(0)`（GPU 提升，z=0）；另一处是 `.popout.big-red::after { transform: rotateY(180deg) }`（弹窗箭头镜像）。
**「逐片翻转」不是翻转。** 没有 `perspective`，`rotateY` 只会把片原地压扁。

### 2.2 真正的三个来源

**① 单色平涂 + 网格明暗（low-poly 语言）**：一片一色，相邻色差极小，人眼把「面片明暗跳变」读成曲面。每只 25–32 个唯一色：

| 动物 | 唯一色数 | 代表性取样 |
|---|---|---|
| crow | 28 | `#302717 #32281d #3c3329 #4b413b #744a0f #931f00 #c34a2a #d26549 #ddd7c9 #eee5d9` |
| vaquita | 25 | `#0d1417 #111619 #21282f #2d3b3b #384e4d #486461 #62827f #aac7c6 #d8e2de` |
| frog | 32 | `#180D13 #2C2924 #3B6F4B #4E9F73 #B89A00 #FAC62D #FED63C #FEEC63 #FFF88B` |
| panda | 27 | `#050505 #190F0D #370A02 #53170A #722B12 #94431F #C0684A #DAC79D #F9F0E2` |

**② 三点插值冒充翻转**：polygon 顶点数相同时逐顶点线性插值，三角形 A 插到 B 的观感就是 「这片翻过去了」。默认态三点重合于中心 `polygon(50% 50%, 50% 50%, 50% 50%)`（退化不可见），
所以「从无到有」= 三点从中点炸开；「翻片」= 三角形飞到另一处。

**③ 极慢的连续旋转**——最便宜的一招：

```css
.level-two { transform: rotate(-8deg); }
.level-two { transform: rotate(26deg); transition: 16s linear 1.5s; }
.level-two { transform: rotate(0deg);  transition: .4s; }        /* 归位 */
```

`34° / 16s ≈ 2.1°/s`。慢到第一眼察觉不到，却足以让一张纯平面的三角画被读成 「正在缓缓转动的立体物」。**必须 `linear`：缓动会暴露「这是一次过渡」。**

**纵深来自 z-index，不是 perspective**：`#animalchanger` 深底 → `::after` 400% 黑噪点（z-index:0）→ `::before` 600×600 中心辉光 `opacity .34`（z-index:1）→ `.shard-wrap`（z-index:2）。

---

## 3. 翻滚 / 切换的编排

### 3.1 不是 hover，是三条不同周期的状态机

```js
function animalStates(t){                       // 4s 四相：base→s2→s3→s4→base
  setInterval(() => {
    t.removeClass("state-four");
    setTimeout(() => t.addClass("state-two"), 1000);
    setTimeout(() => { t.removeClass("state-two"); t.addClass("state-three"); }, 2000);
    setTimeout(() => { t.removeClass("state-three"); t.addClass("state-four"); }, 3000);
  }, 4000);
}
// animalStatesSecondLevel：3s 周期，两次 100ms 微颤（+1000 亮、+1100 灭、+1400 亮、+1500 灭）
// animalStatesShimmer：7s 周期，2s 微光（+4000 加 shimmer、+6000 去）
```

周期 **4000 / 3000 / 7000 ms**，LCM = 84 秒 —— 观感永不重复，代码零随机。每个状态只驱动**该动物手挑的一部分片**（iguana 30 片 / tamarin 15 片 / camel 13 / kakapo 12 /
bear 8 / armadillo 6 / turtle 6 / crow **3**），且目标是**手工画的另一套坐标**：

```css
/* 默认态 → state-two：换了一组三角形，不是原坐标加偏移 */
.animal-animations-on.state-two #animalchanger.tamarin .wrap .shard-wrap:nth-child(1) .shard {
  clip-path: polygon(22.45% 33.071%, 23.15% 20.214%, 28.05% 29.929%); }
.animal-animations-on.state-two #animalchanger.tamarin .wrap .shard-wrap:nth-child(2) .shard {
  clip-path: polygon(22.35% 33.071%, 30.3% 24.786%, 31.05% 43.67%); }
```

### 3.2 切换动物：方向感知 + 时长延迟反向耦合

```js
prevAnimal > newAnimal
  ? ($(".wrap").addClass("right-to-left"), $(".wrap.left-to-right").removeClass("left-to-right"))
  : ($(".wrap").addClass("left-to-right"), $(".wrap.right-to-left").removeClass("right-to-left"));
```

`left-to-right` 30 条实测（1→0.34s/0.22s、2→0.38/0.24、5→0.50/0.30、10→0.70/0.40、15→0.90/0.50、20→1.10/0.60、30→1.50/0.80），闭式：

```
正向：duration = 0.30 + 0.04·N     delay = 0.20 + 0.02·N     bgDelay = 0.02·N
反向：duration = 1.54 − 0.04·N     delay = 0.975 − 0.025·N   bgDelay = 0.62 − 0.02·N
缓动：cubic-bezier(0.7, 0.3, 0, 1)      （反向步长 25ms 而非 20ms）
```

关键特征是**时长与延迟反向耦合**：越晚出发的片，动画时间越长。结果 30 片几乎全程同时在飞，形成「长尾波」而不是「排队逐个翻」。正向最后一片结束于 `0.80+1.50 = 2.30 s`，
反向 `0.95+1.50 = 2.45 s`；总运动时长 26.4 s 铺在 2.08 s 窗口里，**重叠率约 76%**。单条原文：

```css
.left-to-right .shard-wrap:nth-child(30) .shard {
  transition: -webkit-clip-path 1.5s 0.8s cubic-bezier(0.7, 0.3, 0, 1),
              background-color 1.5s 0.6s, -webkit-transform 0.3s, margin 0.3s 0.8s; }
```

注意颜色比位移**早 0.2 s 起跑**——先变色、再动位、最后落位。

### 3.3 `backface-visibility` 与背面内容

**没有背面内容。** 5 处全是 `hidden`，用在辉光层、弹窗箭头、`hover-detector` 圆圈上，目的是消亚像素闪边。碎片本身既无背面也无双面内容——它从来不是真正的 3D 平面。

---

## 4. 配色与质感

### 4.1 调色板

每只动物**一套独立调色板**（25–32 色），从参考照片采样后做低多边形量化。全站唯一强调色 `#f03252`（`::selection`、`h1`、`::-webkit-scrollbar-thumb` 同色），
深底 `#1a1a1d`，文字 `#fff`。

### 4.2 渐变：只有一个，且是 PNG 不是 CSS 渐变

```css
#animalchanger::before {                    /* 中心辉光，600×600，z-index:1 */
  content:""; opacity:.34; transition:.23s;
  width:600px; height:600px; position:absolute; top:50%; left:50%;
  margin-left:-300px; margin-top:-300px;
  background: url("../img/grad-bg.png") no-repeat center center/cover; pointer-events:none; }
```

用 PNG 不用 `radial-gradient`——图里可以烤进噪点和色偏，CSS 渐变太干净。

### 4.3 噪点 / 纸感：真纹理 + 阶跃抖动

外层 `#animalchanger::after` 是 `400×400%` 放大的 `black-texture.png`（`top/left:-150%`，z-index:0）。纹理清单（`url(../img/...)` 计数）：`repeat-white.png`×7、`red-texture.png`×5、
`green-texture.png`×2、`green-texture-circle.png`×2，`black-texture.png`、`mini-texture.png`、`red-texture-2.png`、`grad-bg.png`、`blood.png`、`transparent.png` 各 ×1。

**胶片抖动 keyframes（全站手工艺感最重的一段）**：

```css
@keyframes scratchy {
  0%,  25% { background-position: 0 0; }
  26%, 50% { background-position: 20px -20px; }   /* 瞬移，无过渡 */
  51%, 75% { background-position: 40px -40px; }
  76%, 99% { background-position: 60px -60px; }
  100%    { background-position: 0 0; } }
@keyframes bgscratchy { to { transform: rotate(720deg); } }        /* 两整圈 */
```

`scratchy` 的手法：**在 25%/51%/76% 处瞬间跳 20px**，靠「停 25% + 瞬移 1%」制造放映机走片 （gate weave）。匀速移动就没这个味。

一处工程细节值得抄：`.shard` 基础样式里写 `background-image: url("../img/transparent.png")` （1×1 透明图占位），让 `background-image` **永远有值**，换纹理时不经历 `none → url()` 的重绘跳变；
`smash` 里还显式写 `transition: all .24s .13s, background-image 0s` 把图片切换整体排除在过渡外。

---

## 5. 文字与版式

### 5.1 基准与阶梯

```css
body, html { font-size:10px; line-height:1.1em; letter-spacing:.03em;
  text-transform: uppercase; background-color:#1a1a1d; -webkit-font-smoothing:antialiased; }
a  { letter-spacing: .2em; }
h1 { color:#f03252; font-size:2.3em;  letter-spacing:.2em;  margin-bottom:15px; }
h2 { font-size:4.35em; line-height:1em; letter-spacing:.05em; }
```

字号阶梯 `p 10.5px` → `h1 23px` → `h2 43.5px`（≈ 1 : 2.2 : 4.1）；字距阶梯 正文 `.03em` → `h2 .05em` → `h1`/`a` `.2em`。字体 `BlocExtCond` 超窄压缩体，**全站只有一套字**，
靠字重 300 + 大写 + 窄体立风格。

### 5.2 位置不随动物变，只换文案

**没有** `#animalchanger.crow h2 { top: ... }` 一类规则（多种写法均未命中）。名称容器位置固定，JS 只替换内容：

```js
$(".content-wrap .content-info .infos ul li:nth-child(1) span").html(animalScientificName[newAnimal]);
$(".animalinfo h2").text(animalNames[newAnimal]);
$(".popout").addClass("text-change");  $(".animalinfo").addClass("text-change");
```

`.text-change` 的模式是「先标记、后按 `nth-child` 阶梯错峰复位」（如 `.animalinfo.text-change a:nth-child(2) { transition-delay: 0s; }`）。

### 5.3 逐字动画：只在入场文案上，而且是逐「词」

`index.html` 里入场四句话被拆成 `<span>`（`<span>30</span> <span>unique</span> <span>species</span> <span>face</span> <span>a fragmented</span> <span>survival.</span>`），
由 `.intro-sequence p.active` 驱动整段进出（`transition: .7s linear`）。**不是逐字 `animation-delay`，是逐词包 `span` 后整段一起动**——这一点容易被误读成
「逐字动画」，特此注明。

---

## 6. 性能技巧

| 项目 | 实测值 | 项目 | 实测值 |
|---|---|---|---|
| 元素总数 | 778（div 176） | `will-change` | **0 次** |
| 碎片系统占用 | **60 节点** | GPU 提升 | `translateZ(0)`×5、`translate3d(...,0)`×50 |
| 动画属性 | `clip-path`/`background-color`/`transform`/`background-position` | 布局属性动画 | 仅 3 条（图表 `height:3px→9px`） |

核心是**「不为动画加节点」**：60 个 div 通过换 `#animalchanger` 的类名，在「预加载图形 → 单只动物 → 30 只总览 → 击碎态 → 统计图表」五种形态间复用，换动物 DOM 零增删：
`$("#animalchanger").attr("class", animalList[newAnimal]);`

### 6.1 四档降级

**档 1 — 非 WebKit**：碎片全隐藏，换 30 张静态 PNG，靠 `nth-child` 选动物：

```css
.nowebkitbrowser .shard-wrap .shard { display:none; }
.nowebkitbrowser .shard-wrap { opacity:0; background-position:center; background-size:cover;
  background-repeat:no-repeat; transform:translateY(10px); }
.nowebkitbrowser .shard-wrap:nth-child(1){ background-image:url(../img/fallbacks/fallback_crow.png); }
```

**档 2 — 移动端**：跳过 15.5 秒入场，直接进静态标题态：

```js
$(".nowebkitbrowser").length || $(window).width() < 700
  ? $("body").addClass("thirty-pieces-titles") : startupSequence();
```

`<700px` 还给 `html` 加 `small-nav`，`html:not(.small-nav)` 前缀一次性关掉整套 hover 网格。该态专属时序：`duration = 0.22 + 0.06·(N−1)`、`delay = 0.43 + 0.03·(N−1)`、`cubic-bezier(1,0,0,1)`。

**档 3 — macOS**：加 `body.performance-boost`，走另一套更省参数。**档 4 — 窗口变化**：直接盖遮挡图（`smash-fake.png` + 文案「Re-arranging the pieces」；
`.resize-hider { z-index:10000000; position:fixed; }`），避免重算时闪。

---

## 7. 入场与切换

### 7.1 预加载拼装：三角波延迟

30 条实测（1→1.24s/+0.50s、2→1.28/+0.45、10→1.60/+0.05、11→1.64/0、15→1.80/−0.20、16→1.84/−0.20、20→2.00/0、29→2.36/+0.45、30→2.40/+0.50）：

```
duration = 1.20 + 0.04·N
delay    = 0.50 − 0.05 · min(N−1, 30−N)      缓动 cubic-bezier(0.62, 0.02, 0.34, 1)
```

`N=1` 与 `N=30` 同时最大（+0.50），`N=15/16` 最小（−0.20）。**负延迟合法**：那两片 「已经跑了 0.2 s」，所以中段先成形，观感是从轮廓中段向两端「绽放」，不是从头扫到尾。

再叠一层几乎看不见的灰阶（蓝通道逐片 −1，30 片从 `#252528` 走到 `#212124`，差 4/255）：`body.preloader.start-up-seq .level-one .shard-wrap:nth-child(1) .shard { background-color:#252528; }`
……`nth-child(8)` 为 `#212124`。同时 `.level-one` 从 `scale(0.15) translateY(-20%)` 长到 `scale(0.71) translateY(-6%)`，`transition: 1s cubic-bezier(0.62, 0.02, 0.34, 1)`。

### 7.2 入场时序与切换

`1.4 s` 开始 → `2.6 s` 加 `vaquita-shards` 拼出第一只 → `4.0 s` intro 第 2 段 （`introinterval` 3100ms/段）→ **`15.5 s`** 加 `thirty-pieces-titles` 转标题态。
整整 15.5 秒入场——今天算奢侈，但它同时是内容页（那四句话就是展览前言）。

切下一只动物**没有任何色带/遮罩过场**，全靠方向类切换 + 2.3–2.45 秒错峰波 + 颜色先行 0.2 秒。唯一的「遮挡」是 `.smash` 态（击碎后进信息层）。

### 7.3 击碎（smash）：快速塌缩

```js
function smashanimalprocess(t){
  $("body").removeClass("animal-animations-on");
  animationstateaddition();               // 代际 +1，取消尚未生效的回调
  $("body").toggleClass("smash");
}
```
```css
.smash .wrap .shard-wrap .shard { transition: all 0.24s 0.13s, background-image 0s; }
.smash .wrap .shard-wrap:nth-child(1) .shard { clip-path: polygon(23.2% 21.571%, 21.7% 17.714%, 20.2% 19.857%) !important; }
.smash .wrap .shard-wrap:nth-child(3) .shard { clip-path: polygon(10% 20%, 10.5% 20.5%, 11% 20%) !important; }
```

每个三角塌成 **1–2%** 的碎屑并散开，**240 ms 统一时长 + 130 ms 统一延迟**—— 这里**不排队**，因为「炸开」是瞬时事件，排队反而假。

---

## 8. `prefers-reduced-motion`

**原站没有做。** 724 KB `main.css` 全文搜索 → **0 次**；`main.min.js` 里也没有相关 `matchMedia` 判断。降级只做到「设备/浏览器能力」层面（`small-nav`、`nowebkitbrowser`、
`performance-boost`），**没做到「用户偏好」层面**。这是明确缺口：「30 片 × 每条 1.0–2.4 s 的 `clip-path` 过渡 + 7 s 周期微光」在 WCAG 2.3.3 与 Lighthouse 口径下都会被判为动效过载。

---

## 9. 可迁移清单

> 目标：零 npm、纯手写中文静态站；主页 + 校验页；「控制 / 解析 / 共存」三部门 +
> 大字标题 + 段落 + 跑马灯 + 部门轮播。
> **一条前提**：In Pieces 手写了 900 条 `nth-child` 规则，因为 2014 年 `calc()` + 自定义属性
> 不成熟。今天用 `--i` + `calc()` 能把同样的公式压进一条规则。下文**参数照抄、写法现代化**。

### 迁移点 1 — 三角扇拼贴：把「部门」做成几何徽记

**动什么**：每个部门一枚 24 片三角形徽记，初次进入从中心炸开成形。**参数**：N=24 环形等角；相邻两片共享顶点；一片一平涂色，色差 ≤ 4%。

```css
.sigil { position:relative; width:min(46vmin,380px); aspect-ratio:1; }
.sigil > i { position:absolute; inset:0;                     /* 每片都是整块画布 */
  background: var(--c, #f03252);
  clip-path: polygon(50% 50%, 50% 50%, 50% 50%);              /* 退化成中心点 */
  transition: clip-path 1s cubic-bezier(.7,.3,0,1) calc(var(--d,0) * 1ms); }
```
```js
const fan = (n = 24, r = 46) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * 2 * Math.PI - Math.PI / 2, b = ((k + 1) / n) * 2 * Math.PI - Math.PI / 2;
  return [[50 + Math.cos(a) * r, 50 + Math.sin(a) * r], [50, 50],
          [50 + Math.cos(b) * r, 50 + Math.sin(b) * r]];
});
document.querySelectorAll('.sigil').forEach(fig => {    // 坐标只生成一次，之后即静态
  const base = fig.dataset.dept === 'control' ? [240, 50, 82] : [60, 120, 200];
  fan(24).forEach((t, k) => {
    const el = document.createElement('i'), j = 8 - (k % 5) * 4;   // ±8 明暗抖动
    el.style.clipPath = `polygon(${t.map(p => p.map(v => v.toFixed(2)+'%').join(' ')).join(',')})`;
    el.style.setProperty('--c', `rgb(${base[0]+j} ${base[1]+j} ${base[2]+j})`);
    el.style.setProperty('--d', k * 22);                           // 22ms/片
    fig.appendChild(el);
  });
});
```

**reduced-motion**：直接给终态，不炸开 —— `@media (prefers-reduced-motion: reduce){ .sigil > i{ transition:none; } }`

---

### 迁移点 2 — 单片 = 整块 div + `clip-path`：从架构上消掉接缝

**动什么**：不用「定位 + 缩放」拼图，用「全尺寸重叠 + 裁切」。**参数**：`inset:0`；**任何单片不许单独 `scale`**；深底兜底。

```css
.bad > i { position:absolute; left:calc(var(--x)*1%); top:calc(var(--y)*1%);
           width:62%; height:62%; transform:scale(1.02); }   /* 错：必露白 */

.field { position:relative; width:100%; aspect-ratio:16/9; background:#131316; }
.field > i { position:absolute; inset:0; background: var(--c);
  clip-path: polygon(var(--p));        /* 公共顶点字面写成同一个数值 */
  backface-visibility: hidden; }       /* 消亚像素闪边，不是为了翻面 */
.dept--control { --tone:#f03252; }  .dept--parse { --tone:#5aa9e6; }
.dept--coexist { --tone:#d8c07a; }
```

三层 `z-index`：噪点(0) → 辉光(1) → 碎片(2)。补缝不写 `stroke`，写 `background`。

**reduced-motion**：本条无动效，无需降级；`backface-visibility:hidden` 保留。

---

### 迁移点 3 — 「翻转」用三点插值，不要 `rotateY`

**动什么**：部门切换时每片从三角形 A 插值到三角形 B，冒充翻片。**参数**：`cubic-bezier(.7,.3,0,1)`；时长 1.0–1.5 s；退化态三点重合中心。

```css
.piece { position:absolute; inset:0; background: var(--c);
  clip-path: polygon(var(--a), 50% 50%, var(--b));      /* 外点A·中心·外点B */
  transition: clip-path var(--dur,1s) cubic-bezier(.7,.3,0,1) var(--d,0s); }
.dept[data-state="collapsed"] .piece                   /* 收拢：这片没了 */
  { clip-path: polygon(50% 50%, 50% 50%, 50% 50%); }
.dept[data-state="rearranged"] .piece:nth-child(1)     /* 重排到另一套网格 */
  { clip-path: polygon(22.45% 33.07%, 23.15% 20.21%, 28.05% 29.93%); --dur: 1.5s; }
.dept[data-state="rearranged"] .piece:nth-child(2)
  { clip-path: polygon(22.35% 33.07%, 30.30% 24.79%, 31.05% 43.67%); --dur: 1.46s; }
```
```js
let toggle = false;                                   // 交替两套网格 = 永动「翻片」
function flip(el, netA, netB) {
  const net = toggle ? netA : netB;
  [...el.children].forEach((p, i) => {
    p.style.clipPath = `polygon(${net[i].join(',')})`;
    p.style.setProperty('--dur', (1.5 - i * 0.04) + 's');   // 时长递减
    p.style.setProperty('--d',   (0.02 * i) + 's');         // 延迟递增
  });
  toggle = !toggle;
}
```

**为什么不用 `rotateY`**：它需要父级 `perspective` 才真能「转」；一旦有 `preserve-3d`，30 个 3D 层的合成开销远高于 `clip-path`，而 `clip-path` 在 2D 层插值代价接近重绘一个矩形。
**视觉收益相似，成本差一个量级。**

**reduced-motion**：`@media (prefers-reduced-motion: reduce){ .piece{ transition:none; } }` ——状态仍切换，运动去掉。

---

### 迁移点 4 — 三角波入场错峰：从中间向两端绽放

**动什么**：徽记/标题/部门卡首次进场，按索引做三角波延迟。**参数**：`dur = 1.20 + 0.04·i`；`delay = 0.50 − 0.05·min(i−1, N−i)`；负延迟合法。

```css
.piece {                                    /* 一条规则顶掉 30 条 nth-child */
  --n: 24;
  --tri: min(calc(var(--i) - 1), calc(var(--n) - var(--i)));
  --d:   calc((0.5 - 0.05 * var(--tri)) * 1s);
  --dur: calc((1.2 + 0.04 * var(--i)) * 1s);
  transition: clip-path var(--dur) cubic-bezier(.62,.02,.34,1) var(--d),
              background-color .4s var(--d); }
```
```js
const N = 24;                               // CSS min() 不稳时退化为两段式
for (let i = 1; i <= N; i++) {
  const delay = 0.5 - 0.05 * Math.min(i - 1, N - i);   // i=1 与 i=N 都是 +0.50
  const dur   = 1.2 + 0.04 * i;                        // 1.24 → 2.16
  const el = document.querySelector(`.piece[data-i="${i}"]`);
  el.style.setProperty('--d',   delay.toFixed(3) + 's');
  el.style.setProperty('--dur', dur.toFixed(2) + 's');
}
```

负延迟的效果：`delay = −0.2s` 的片「已经跑了 0.2 秒」，所以**中段先成形、两端后到位** ——这是「绽放」而不是「扫过」。

**reduced-motion**：`@media (prefers-reduced-motion: reduce){ .piece{ --d:0s; --dur:0.01s; } }`

---

### 迁移点 5 — 方向感知 + 时长延迟反向耦合（部门轮播）

**动什么**：轮播左右切换时，碎片朝切换方向撒开再落位。**参数**：前进 `dur=0.30+0.04i / delay=0.20+0.02i`；后退 `dur=1.54−0.04i / delay=0.975−0.025i`；
颜色延迟 `0.02·i`（比位移早 0.2 s）。

```css
.carousel[data-dir="next"] .piece {
  --dur: calc((0.30 + 0.04 * var(--i)) * 1s);
  --d:   calc((0.20 + 0.02 * var(--i)) * 1s);
  --cd:  calc((0.02 * var(--i)) * 1s); }
.carousel[data-dir="prev"] .piece {
  --dur: calc((1.54 - 0.04 * var(--i)) * 1s);
  --d:   calc((0.975 - 0.025 * var(--i)) * 1s);
  --cd:  calc((0.62 - 0.02 * var(--i)) * 1s); }
.piece { transition: clip-path var(--dur,1s) cubic-bezier(.7,.3,0,1) var(--d,0s),
              background-color var(--dur,1s) linear var(--cd,0s); }
```
```js
const DEPTS = ['control', 'parse', 'coexist'];
let cur = 0;
function go(dir) {
  const root = document.querySelector('.carousel');
  root.dataset.dir = dir === 1 ? 'next' : 'prev';     // 先定方向，再换内容
  cur = (cur + dir + DEPTS.length) % DEPTS.length;
  requestAnimationFrame(() => requestAnimationFrame(   // 两帧之间换坐标，才有起点可插值
    () => applyNet(root, DEPTS[cur])));
}
```

**总窗口**：前进时最后一片 `0.20+0.02·24 + 0.30+0.04·24 = 0.68 + 1.26 = 1.94 s`，轮播锁 ≤ 1.94 s，否则会被下一次切换打断。

**reduced-motion**：`@media (prefers-reduced-motion: reduce){ .carousel .piece{ --dur:.001s; --d:0s; --cd:0s; } }`；JS 侧 `if (reduce) { root.dataset.dept = key; return; }` 只换数据。

---

### 迁移点 6 — 多周期节拍叠加：让静止的部门图缓慢「呼吸」

**动什么**：无需交互，三条不同周期定时器轮流给不同子集加状态类。**参数**：4000 / 3000 / 7000 ms（LCM 84 s）；每状态只动该部门 3–15 片。

```js
function breath(root) {
  setInterval(() => {                                   // 4s 四相重排
    root.classList.remove('s4');
    setTimeout(() => root.classList.add('s2'), 1000);
    setTimeout(() => { root.classList.remove('s2'); root.classList.add('s3'); }, 2000);
    setTimeout(() => { root.classList.remove('s3'); root.classList.add('s4'); }, 3000);
  }, 4000);
  setInterval(() => {                                   // 3s 两次 100ms 微颤
    root.classList.add('twitch');
    setTimeout(() => root.classList.remove('twitch'), 100);
    setTimeout(() => root.classList.add('twitch'), 400);
    setTimeout(() => root.classList.remove('twitch'), 500);
  }, 3000);
  setInterval(() => {                                   // 7s 2s 微光
    setTimeout(() => root.classList.add('glow'), 4000);
    setTimeout(() => root.classList.remove('glow'), 6000);
  }, 7000);
}
```
```css
/* 只给「手挑」的片目标坐标，其余不动 */
.dept[data-dept="control"].s2 .piece:nth-child(3n+1) { clip-path: polygon(38% 22%, 50% 50%, 62% 34%); }
.dept[data-dept="control"].s3 .piece:nth-child(3n+2) { clip-path: polygon(41% 56%, 52% 37%, 57% 56%); }
.dept[data-dept="control"].twitch .piece:nth-child(5n) { transform: translate3d(-2px, 1px, 0); }
.dept[data-dept="control"].glow   .piece              { background-color: rgba(255,255,255,.09); }
```

**手工艺要点**：子集要用 `3n+1 / 3n+2 / 3n` 模运算错开，**不要连续索引**—— 连续索引会露出「扫描」痕迹。

**reduced-motion**：整段不启动 —— `if (!matchMedia('(prefers-reduced-motion: reduce)').matches) breath(root);`

---

### 迁移点 7 — 击碎 / 收拢：点击部门时的瞬时塌缩

**动什么**：点击部门卡 → 全片塌成 1–2% 碎屑，详情面板同时推入。**参数**：统一 `240ms` + `130ms` 延迟（**不排队**）；`background-image 0s`。

```css
.carousel.is-smash .piece {
  transition: clip-path .24s .13s cubic-bezier(.7,.3,0,1),
              background-color .24s .13s,
              background-image 0s; }        /* 图片切换不参与过渡 */
.carousel.is-smash .piece:nth-child(1) { clip-path: polygon(23.2% 21.57%, 21.7% 17.71%, 20.2% 19.86%); }
.carousel.is-smash .piece:nth-child(2) { clip-path: polygon(18.8% 25.71%, 16.3% 22.71%, 15.6% 24.00%); }
.carousel.is-smash .piece:nth-child(3) { clip-path: polygon(10.0% 20.00%, 10.5% 20.50%, 11.0% 20.00%); }
.dept-panel { opacity:0; transform:translateY(12px); pointer-events:none;
  transition: opacity .4s .1s, transform .6s .1s cubic-bezier(.62,.02,.34,1); }
.carousel.is-smash .dept-panel { opacity:1; transform:none; pointer-events:auto; }
```
```js
function smash(root) {
  root.classList.add('is-smash');
  setTimeout(() => root.classList.add('pieces-hidden'), 420);  // 塌完隐藏，省掉 30 个 1px 三角的绘制
}
function unsmash(root) {
  root.classList.remove('pieces-hidden');
  requestAnimationFrame(() => root.classList.remove('is-smash'));
}
```

**为什么统一延迟**：塌缩是「事件」不是「过程」。排队会读成「退场动画」，统一延迟才读成「爆开」。

**reduced-motion**：`@media (prefers-reduced-motion: reduce){ .carousel.is-smash .piece{ transition:opacity .15s; opacity:0; } .dept-panel{ transition:none; } }`

---

### 迁移点 8 — 16 秒慢转：最便宜地把平面读成立体

**动什么**：部门徽记外层容器持续极慢旋转。**参数**：`-8deg → 26deg`；`16s linear`；延迟 `1.5s`；归位用 `.4s`。

```css
.sigil-turn { transform: rotate(-8deg); transition: transform 16s linear 1.5s; }
.dept.is-live .sigil-turn  { transform: rotate(26deg); }
.dept.is-reset .sigil-turn { transform: rotate(0deg);
  transition: transform .4s cubic-bezier(.62,.02,.34,1); }
.dept--control .sigil-turn { transition-duration: 16s; }   /* 三部门转速不同，避免整齐 */
.dept--parse   .sigil-turn { transition-duration: 19s; }
.dept--coexist .sigil-turn { transition-duration: 22s; }
```

**关键数值 `2.1°/s`**（34°/16s）：超过 `3°/s` 就成「转盘」，低于 `1.5°/s` 察觉不到。**必须 `linear`**：缓动会暴露「这是一次过渡」，线性才像「一直在转」。

**reduced-motion**：停转，但保留静态角度免得构图塌掉 —— `@media (prefers-reduced-motion: reduce){ .sigil-turn, .dept.is-live .sigil-turn
{ transform: rotate(9deg); transition: none; } }`

---

### 迁移点 9 — 胶片质感：阶跃抖动 + 噪点层 + 透明占位图

**动什么**：整站长驻颗粒噪点；关键区块做「放映机走片」式阶跃抖动。**参数**：`background-position` 每 20px 一跳、跳 1% 时间、停 25%；噪点层 400% 放大铺底。

```css
.grain { position:fixed; inset:-150%; z-index:0; pointer-events:none;
  background: url("./img/noise.png") repeat 0 0;   /* 真 PNG，256×256 灰度噪点 alpha ≤ .06 */
  opacity:.5; animation: bgscratchy 240s linear infinite; }
.scratch { background-image: url("./img/paper.png"); background-repeat: repeat;
  animation: scratchy 6s steps(1, end) infinite; }        /* 停 + 瞬移，不插值 */
@keyframes scratchy {
  0%,  25% { background-position: 0 0; }
  26%, 50% { background-position: 20px -20px; }
  51%, 75% { background-position: 40px -40px; }
  76%, 99% { background-position: 60px -60px; }
  100%    { background-position: 0 0; } }
@keyframes bgscratchy { from { transform: rotate(0deg); } to { transform: rotate(720deg); } }

/* 透明占位图：防换纹理时从 none → url() 的重绘跳变 */
.piece { background-image: url("./img/transparent.png");   /* 1×1 全透明 */
  background-repeat: repeat; background-color: var(--c);
  transition: clip-path var(--dur) cubic-bezier(.7,.3,0,1) var(--d),
              background-image 0s; }                       /* 图片切换永不过渡 */
```

**`steps(1, end)` 是这段关键**：让 `background-position` 硬跳而不补间。In Pieces 用 4 段 keyframe 手写实现，今天一句 `steps()` 就够。

**reduced-motion**：颗粒保留（静态不刺眼），抖动停掉 —— `@media (prefers-reduced-motion: reduce){ .grain{animation:none;}
.scratch{animation:none;background-position:0 0;} }`

---

### 迁移点 10 — 大字标题逐字错峰（中文按「字」不按「词」）

**动什么**：标题进场，每个汉字独立 `clip-path` 揭示 + 微位移。**参数**：每字 `+35ms`；时长 `0.9s`；`cubic-bezier(.62,.02,.34,1)`；
中文无词边界，必须 `Array.from()` 拆 code point。

```html
<h1 class="big-title" aria-label="控制 · 解析 · 共存"></h1>
```
```css
.big-title { font-size: clamp(2.8rem, 9vw, 7.5rem); line-height: 1.04;
  letter-spacing: .12em;            /* 中文标题字距要大，.03em 不够 */
  display: flex; flex-wrap: wrap; }
.big-title .ch { display: inline-block;
  clip-path: inset(100% 0 0 0);      /* 从下往上揭示 */
  transform: translateY(.28em);
  transition: clip-path .9s cubic-bezier(.62,.02,.34,1) calc(var(--i) * 35ms),
              transform .9s cubic-bezier(.62,.02,.34,1) calc(var(--i) * 35ms); }
.big-title.is-in .ch { clip-path: inset(-10% 0 0 0); transform: none; }
```
```js
function splitTitle(el) {           // 必须按 code point 拆，避免生僻字/emoji 被切断
  const text = el.getAttribute('aria-label') || el.textContent;
  el.textContent = '';
  Array.from(text).forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch'; s.style.setProperty('--i', i); s.textContent = ch;
    el.appendChild(s); });
}
const title = document.querySelector('.big-title');
splitTitle(title);
new IntersectionObserver((es, ob) => {          // 主页/校验页共用
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); ob.unobserve(e.target); } });
}, { threshold: .25 }).observe(title);
```

**避坑**：`inline-block` 之间换行会引入空格，手写时写成 `</span\n><span`（闭合与开启紧邻）；`clip-path: inset()` 比 `overflow:hidden` + `translateY` 便宜，因为它不触发容器尺寸重算。

**reduced-motion**：`@media (prefers-reduced-motion: reduce){ .big-title .ch{ clip-path:none; transform:none; opacity:0; transition: opacity .2s linear calc(var(--i)*8ms); }
.big-title.is-in .ch{ opacity:1; } }`

---

### 迁移点 11 — 跑马灯：双轨 + `translateX(-50%)` + 内容自复制

**动什么**：一条无缝横向滚动带（部门名 / 关键词）。**参数**：轨道内容复制两份；位移 `0 → -50%`；`40s linear infinite`；
**间隙必须算进轨道宽度**，否则接缝会跳。

```html
<div class="marquee" aria-hidden="true"><div class="marquee__track">
  <span>控制</span><span>解析</span><span>共存</span>
  <span>控制</span><span>解析</span><span>共存</span>
</div></div>
```
```css
.marquee { overflow: hidden; padding-block: .6em;
  border-block: 1px solid rgba(255,255,255,.12);
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.marquee__track { display: flex; width: max-content; gap: 2.5em;
  animation: slide 40s linear infinite; }
.marquee:hover .marquee__track { animation-play-state: paused; }
@keyframes slide {
  from { transform: translateX(0); }
  to   { transform: translateX(calc(-50% - 1.25em)); }   /* 半个 gap 补差 */
}
```
```js
function fillMarquee(track) {       // 内容驱动的份数：短内容多复制几份
  const unit = [...track.children].map(n => n.cloneNode(true));
  const gap  = parseFloat(getComputedStyle(track).gap);
  const w = unit.reduce((s, n) => s + n.getBoundingClientRect().width, 0) + gap * unit.length;
  const need = Math.ceil(window.innerWidth / w) + 1;      // 至少铺满一屏
  track.innerHTML = '';
  for (let i = 0; i < need * 2; i++) unit.forEach(n => track.appendChild(n.cloneNode(true)));
}
```

**中文站注意**：`gap` 是轨道总宽的一部分，`-50%` 会少走半个 gap → 用 `calc(-50% - gap/2)` 补；用 `width: max-content` 而非 `100%`，否则 flex 会压缩子项；跑马灯必须 `aria-hidden="true"`
+ 视觉隐藏的等价文本，否则读屏念两遍。

**reduced-motion**：停走，改横向可滚动 —— `@media (prefers-reduced-motion: reduce){ .marquee{overflow-x:auto;}
.marquee__track{animation:none;} }`

---

### 迁移点 12 — 统一降级 + 代际计数器（原站缺的这块）

**动什么**：① 全局 `prefers-reduced-motion` 开关；② 取消过期回调。**参数**：一个 CSS 变量 `--motion`（1/0）统一控时长；JS 侧一个 `gen` 计数器。

```css
:root { --motion: 1; }
@media (prefers-reduced-motion: reduce) { :root { --motion: 0; } }
/* 所有时长乘以 --motion；为 0 时 transition 变 0s，状态仍然切换 */
.piece, .big-title .ch, .carousel .piece {
  transition-duration: calc(var(--dur, 1s) * var(--motion));
  transition-delay:    calc(var(--d,   0s) * var(--motion)); }
```
```js
let gen = 0;                            // 对应 In Pieces 的 animationstatequestion()
function schedule(fn, ms) {
  const my = ++gen;                     // 领号
  return setTimeout(() => {
    if (my !== gen) return;             // 已非最新一代 → 丢弃
    fn();
  }, ms);
}
function onDeptChange() {
  gen++;                                // 立刻作废所有在途回调
  schedule(() => document.body.classList.add('anim-on'), 2000);
}
const reduce = matchMedia('(prefers-reduced-motion: reduce)');   // CSS 管不到的闸门
const M = () => (reduce.matches ? 0 : 1);
function go(dir) {
  gen++;
  if (M()) { /* 逐片 clip-path 错峰 */ } else { applyNetImmediate(); }
}
reduce.addEventListener('change', () => { gen++; /* 重新初始化当前态 */ });
```

**为什么必须有它**：连续点「下一只」时会有多个 2000ms `setTimeout` 在途；它们都带旧号，只有最新的能生效。**这是纯手写动画站最容易漏的一处**——没有它，快速点击会让状态机错乱。

**reduced-motion**：本条本身即降级实现，无二级降级。

---

## 10. 数值速查表

| 项目 | In Pieces 实测值 | 来源 |
|---|---|---|
| 每只动物碎片数 | 30（DOM 30 个 `.shard-wrap`） | `index.html` 计数 |
| 碎片元素 | `<div class="shard">`，100%×100%，绝对重叠 | `main.css` `.shard-wrap .shard` |
| 形状表达 | `clip-path: polygon(3 点)`，1,324 条 | `main.css` 正则计数 |
| `perspective` / `preserve-3d` | **0 / 0** | `main.css` 全文计数 |
| 三种缓动 | `(.7,.3,0,1)` 主 / `(.62,.02,.34,1)` 入场 / `(1,0,0,1)` 闪态 | 各状态 |
| 切换正向 | `dur=0.30+0.04i`，`delay=0.20+0.02i` | 30 条实测拟合 |
| 切换反向 | `dur=1.54−0.04i`，`delay=0.975−0.025i` | 30 条实测拟合 |
| 切换总窗口 | 正向 2.30 s / 反向 2.45 s | 计算 |
| 入场三角波 | `dur=1.20+0.04i`，`delay=0.50−0.05·min(i−1,30−i)` | 30 条实测拟合 |
| 环境节拍 | 4000 / 3000 / 7000 ms（LCM 84 s） | `main.min.js` |
| 微颤 / 微光 | 100 ms×2 / 3 s；2 s / 7 s | `animalStates*` |
| 击碎 | 240 ms + 统一 130 ms 延迟 | `.smash .shard` |
| 慢转 | `-8deg → 26deg`，16 s linear，延迟 1.5 s（≈2.1°/s） | `.level-two` |
| 画布比例 | `w=0.99·vw`，`h=0.7·w`（10:7） | `sizeshards()` |
| 每只动物色数 | 25–32 | 4 只抽样统计 |
| 全站元素数 / `will-change` | 778（div 176，碎片 60）/ **0** | `index.html` / `main.css` |
| 基准字号 | `10px`，阶梯 10.5 / 23 / 43.5 px | `body` / `h1` / `h2` |
| 字距阶梯 | `.03em` / `.05em` / `.2em` | 同上 |
| 强调色 / 深底 | `#f03252` / `#1a1a1d` | `::selection`、`body` |
| 辉光 / 噪点 | 600×600 `opacity .34`；`400%×400%` | `#animalchanger::before` / `::after` |
| 入场时长 | 15.5 s（1.4 起，15.5 转标题） | `startupSequence` |
| `prefers-reduced-motion` | **0 次命中 → 未实现** | `main.css` 全文计数 |

---

## 11. 未核实项

1. **纹理 PNG 的实际尺寸与噪声强度**：`img/` 下二进制未下载（只抓了 HTML/CSS/JS），
   `noise.png`、`black-texture.png`、`grad-bg.png` 的像素尺寸与 alpha 值**未核实**。
2. **30 只动物的三角网是手工还是脚本生成**：代码里只有成品坐标、没有生成器；从「预加载用
   严格扇形、正片用非扇形手调网格」的差异看，倾向「离线脚本 + 手工修点」，**未核实**。
3. **`.all-animals` 总览态的 30 只小图坐标**：用 4 种选择器写法均未命中该组逐条几何规则，
   可能由运行时行内样式或另一套未下载的样式提供。**未核实**。（`fallbacks.min.css` 里    `nth-child(N) → fallback_<animal>.png` 的映射是确证的，说明「N 号槽位 = N 号动物」确实存在。）
4. **音效实现细节**：只确认 `SOUNDS.play("smashpiano")` 与 `SOUNDS.playLoop("ambientloop", 44500)`，
   音频文件本身未抓取。
5. **真机帧率**：无设备实测，**未核实**。
