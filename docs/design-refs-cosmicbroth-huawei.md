# cosmicbroth.com 与 career.huawei.com/cn 前端设计研究

数值均来自 2026-10-16 实抓（cosmicbroth 响应头 `Date: Fri, 16 Oct 2026 17:08:57 GMT`、`X-Powered-By: Nuxt`、`Server: nginx`）。抓不到的写「未核实」。目标产物：**零依赖原生 CSS/JS 中文站**。

> 代码块内 CSS 采用「一个选择器一行、属性用分号分隔」的紧凑排版以控篇幅，全部可直接运行。

## 0. 抓取方法与证据链

| 目标 | 结果 | 留档 |
|---|---|---|
| `www.cosmicbroth.com/` | 200，461103 字节 HTML | `_raw/cosmicbroth.html` |
| cosmicbroth 内联 `<style>` | **11 块**，最大 35545 字节 | `_raw/cosmic/inline/style1..11.css` |
| cosmicbroth 外部 CSS | `entry.DRleNcrB.css`(14884)、`arrow`(272)、`codeline`(366)、`return_button`(454) | `_raw/cosmic/` |
| cosmicbroth JS | `Bx70QQQb.js`(308577)、`CxtPVY3G.js`(391694) | `_raw/cosmic/js/` |
| `api.cosmicbroth.com/api/overview` | 200，218208 字节 JSON，4 个世界（Bearer token 明文写在 `Bx70QQQb.js` 的 Pinia store） | `_raw/cosmic/overview.json` |
| `career.huawei.com/cn/` | 200，67945 字节 HTML | `_raw/huawei-career.html` |
| 华为 11 个组件 CSS | `https://career.huawei.com/-/media/<组件>/<版本>/pc/index.css` 全部 200 | `_raw/huawei/*.pc.css` |
| 华为模块配置 | 页面内嵌 `<script id="comData_*">` **14 块** | `_raw/huawei/data/` |

**两个坑：** (1) `web_fetch` 对两站都只返回空文本（`COSMIC BROTH` / `华为招聘官网首页`）——都是 JS 渲染 SPA，必须用原始 HTTP + 正则。(2) 华为 HTML 是 **GBK 字节流却声明 `charset=utf-8`**，需按 ISO-8859-1 还原字节再按 UTF-8 解码：`$utf8.GetString([Text.Encoding]::GetEncoding(28591).GetBytes($mojibake))`；修复前 `<title>` 为 `åä¸ºæèèå®ç½é¦é¡µ`，修复后为 `华为招聘官网首页`。

**最重要的免责：华为轮播 DOM（`.aui-carousel` 实际 HTML 结构）未核实。** 所有业务模块都渲染进空的 `<section id="vue_雪花ID">`，静态 HTML 里扫描 `class="..."` 命中 `carousel|banner|swiper|slide` 的结果是**空集**。B 节涉及 DOM 的部分只能给「由 CSS 选择器推出的层级」与「JSON 里确凿的行为参数」。

---

# A 节 · cosmicbroth.com

Nuxt 3 单页应用，全站 `100dvh` 定屏，`::-webkit-scrollbar{display:none}`，**无滚动文档流**，交互靠按住拖拽平移。技术栈：GSAP 3.13.0 + CustomEase + MorphSVGPlugin（`Bx70QQQb.js` 有 `/*! GSAP 3.13.0 ... GreenSock */` 版权头）+ Lenis（`new Bw({duration:1, easing:s=>Math.min(1,1.001-Math.pow(2,-10*s)), smoothWheel:!0, autoRaf:!0})`）。

## A.1 首屏结构

### A.1.1 全局基座（第 1 个内联 `<style>`，无作用域）

```css
*{ font-size:2vmin; margin:0; padding:0; --color_black:#000013; --color_white:#f3f3f3;
   --margin_x:calc(var(--scale)*3rem); --margin_y:calc(var(--scale)*3rem);
   --border_xs:calc(var(--scale)*.05rem); --border_s:calc(var(--scale)*.1rem); --border_m:calc(var(--scale)*.15rem); --border_l:calc(var(--scale)*.2rem); --border_xl:calc(var(--scale)*.3rem);
   --ease_in:cubic-bezier(.6,0,.8,.4); --ease_out:cubic-bezier(.2,.9,.45,1); --ease_inout:cubic-bezier(.7,0,.3,1);
   --line_height_1:calc(var(--scale)*1rem); --line_height_2:calc(var(--scale)*1.5rem); --line_height_4:calc(var(--scale)*2rem);
   --content_width:calc(var(--scale)*65rem); --content_y:calc(var(--scale)*10rem) }
body{ background-color:var(--color_black); width:100% }
::-webkit-scrollbar{ display:none }
img{ pointer-events:none }
div{ display:flex; -webkit-tap-highlight-color:transparent }
@media screen and (max-aspect-ratio:3602879701896397/2251799813685248){ *{ --content_width:calc(var(--scale)*50rem) } } /*≈1.6*/
@media screen and (max-aspect-ratio:1/1){ *{ --margin_x:calc(var(--scale)*1rem); --margin_y:calc(var(--scale)*2rem); --content_width:70vw } }
```

四个要点：`font-size:2vmin` **挂在 `*` 上（连带命中 `html`）**，于是全局 `rem` = 视口短边 2%（短边 1000px 时 `1rem=20px`），`calc(var(--scale)*3rem)` 本质是「短边百分比」；`div{display:flex}` 是全局默认；**响应式主开关是 `--scale` 而非媒体查询换布局**；`--content_width` 桌面 `65rem` / 窄屏 `50rem` / 竖屏 `70vw`。

### A.1.2 首屏 DOM 分层（6 层，从后到前）

来源：`<body>` 实抓 DOM（`_raw/cosmic/body.tags.txt` 第 218–298 行）。

```html
<section><div class="windowview">
  <div class="windowview_backgroud">      <!-- 层1 背景 -->
    <img class="windowview_backgroud_image" src="https://cdn.cosmicbroth.com/background_436870b549.jpg">
    <canvas class="windowview_backgroud_stars"></canvas></div>
  <div class="windowview_stars">           <!-- 层2 星点 -->
    <div class="windowview_stars_empty"></div>
    <div class="windowview_stars_information" style="visibility:hidden;--color:#178ec5">
      <svg class="wsi_line" viewBox="0 0 620 460">…</svg><div class="wsi_container">…</div></div>
    <div class="windowview_stars_star windowview_stars_star_clickable" style="left:40%;top:60%;--r:1;"><img src=".../star_80153f61f1.png"></div>
    <!-- ×4，见 A.3.3 --></div>
  <div class="windowview_mousetip">…</div>                                <!-- 层3 跟随光晕 -->
  <div class="windowview_dragtip windowview_dragtip_left">…</div>         <!-- 层4 拖拽提示 -->
  <div class="uibox">…</div>                                              <!-- 层5 HUD -->
</div></section>
```

外加两个固定浮层：`.loading`（`z-index:10000000`）与 `.ed`/`.ad`（`z-index:1000000`，基础态 `opacity:0; transform:translateY(50%)`）。

### A.1.3 背景的真相：**JPG 照片 + 真 canvas 星场**——不是视频，不是 CSS 渐变

```css
.windowview{ align-items:center; background-color:var(--color_black); height:100dvh; justify-content:center; overflow:hidden; position:absolute; width:100% }
.windowview_backgroud,.windowview_stars{ align-items:center; height:150%; justify-content:center; position:absolute; width:150% } /* 比视口大 50%，留 ±25% 平移余量 */
@media screen and (max-aspect-ratio:1/1){ .windowview_backgroud,.windowview_stars{ height:200%; width:200% } }
.windowview_backgroud_image{ height:auto; opacity:.8; position:absolute; width:100% }
.windowview_backgroud_stars{ height:100%; position:absolute; width:100% }
```

星场是**真 `<canvas>`**（`CxtPVY3G.js` 星场模块）：星数 `total_stars:500`；canvas 尺寸 `innerWidth*devicePixelRatio` × `innerHeight*devicePixelRatio`；`max_radius=(innerWidth+innerHeight)/2e3*devicePixelRatio`、`min_radius=max_radius/5`；`max_speed`/`min_speed` 用 `/8e3` 与 `/10`；每颗星 `alpha:Math.random()`、`dirction_x/y:Math.random()>.5?-1:1`（**源码拼写错误 `dirction` 原样存在**）；闪烁 `h.alpha += (Math.random()-.5)*.2` 后 clamp(0,1)；出界条件 `h.x < h.r*2 || h.x > W+h.r*2` 时翻转方向；绘制 `ctx.fillStyle=\`rgba(255, 255, 255, ${h.alpha})\`` + `arc(x,y,r,0,Math.PI*2)`；循环 `requestAnimationFrame(this.draw.bind(this))`。

### A.1.4 文字分层：**角色式，不是标题/副标题/正文三段式**

```css
@font-face{ font-family:zpix; src:url(/_nuxt/zpix.DytyLrWt.ttf) }
._font_1{ font-family:zpix; font-size:calc(var(--scale)*.6rem) }
._font_2{ font-family:zpix; font-size:calc(var(--scale)*.8rem) }
._font_3{ font-family:zpix; font-size:calc(var(--scale)*1rem) }
._font_4{ font-family:zpix; font-size:calc(var(--scale)*1.2rem) }
._font_5{ font-family:zpix; font-size:calc(var(--scale)*1.4rem) }
```

阶梯 **0.6/0.8/1.0/1.2/1.4 rem**，严格 0.2rem 等差；代入 `*{font-size:2vmin}` 后短边 1000px 屏上为 **12/16/20/24/28 px**。各档归属（DOM `class + 文本` 配对扫描，原文照抄）：

| 类 | 文本 | 位置 |
|---|---|---|
| `_font_1` | `[LOADING]` / `→ ACCESS` / `SYSTEM...` | `.loading_middle_bottom p`（三个并排 `<p>`） |
| `_font_1` | `EN` `HI` `PSI` `CQL` | `.uibox_shipbox_info_data` 四个读数 |
| `_font_1` | `0` / `0` | `.wmo_x` / `.wmo_y` 鼠标坐标读数 |
| `_font_1` | `执行已授权操作`、`飞船实时状态监测反馈`（后者 `_font_2`） | `.ed_content_info_*` |
| `_font_2` | `GRAND-STARRS-RAY` / `EXPLORE` / `CLICK` / `DRAG`（`DRAG` 配 `writing-mode:vertical-lr`） | `.loading_middle_title`、`.wsi_button_text`、`.windowview_mousetip_content p`、`.windowview_dragtip_texts` |
| `_font_2` | `宇宙汤:` `CONSLOE` `External Links` `Check Instruction` `/  /` `ACCESS->` `[返回]::close()` | `.uibox_middle_*`、`.button` |
| `_font_3` | 世界名（API `name`，如 `宇宙汤`） | `.wsi_title p` |
| `_font_4` | `Need Help?` | `.uibox_instructionbox_info_tip p:first-of-type` |
| `_font_5` | `01:09:06` | `.uibox_middle_time>p`（**唯一用最大档**，实时时钟） |

```css
.wsi_container{ align-items:start; flex-direction:column; margin-left:calc(var(--scale)*4.7rem); opacity:0; position:relative; width:calc(var(--scale)*12rem) } /* 固定内容宽 12rem */
.wsi_top{ border:var(--border_m) solid var(--color_white); height:calc(var(--scale)*.7rem); width:100% }
.wsi_top div{ background-color:var(--color_white); width:calc(var(--scale)*3rem) } /* 进度 3/12 = 25% */
.wsi_title{ clip-path:polygon(0 0,0 0,0 100%,0 100%); margin-bottom:calc(var(--scale)*.5rem); padding-left:var(--border_m); width:100% }
.wsi_title p{ background:linear-gradient(90deg,var(--color),#00000000); height:100%; padding-left:calc(var(--scale)*.5rem) }
.wsi_content{ line-height:var(--line_height_1); margin-bottom:calc(var(--scale)*1rem); width:90% }
.wsi_button{ align-self:end }
```

节奏：标题 `margin-bottom .5rem` → 正文 `1rem` → 按钮 `align-self:end`；正文宽 **90%**（右侧留 10% 呼吸缝）。HUD 三段：`.uibox_middle_edge`(14rem) + `.uibox_middle_console`(15rem 圆盘) + `_edge`(14rem)，`margin:0 3rem`；`.uibox{ align-items:end; bottom:calc(var(--scale)*-3.5rem); position:absolute; width:100% }`。

### A.1.5 留白比例

`--margin_x/--margin_y = 3rem` → 短边 1000px 屏上 **60px 安全边距**；竖屏 `1rem/2rem`（20px/40px）。固定浮层全部锚在此变量：`.ed{bottom:var(--margin_y); left:var(--margin_x)}`、`.ad{同}`、`.system_return{top:var(--margin_y)}`。

## A.2 交互动效

### A.2.1 缓动函数（源头在 JS，与 CSS 变量完全一致）

```js
vt.registerPlugin(Ar)
e.ease_in    = Ar.create("ease_in",    "M0,0 C0.6,0,0.8,0.4,1,1")
e.ease_out   = Ar.create("ease_out",   "M0,0 C0.2,0.9,0.45,1,1,1")
e.ease_inout = Ar.create("ease_inout", "M0,0 C0.7,0,0.3,1,1,1")
```

`Ar` 是 GSAP `CustomEase`（同文件有 `CustomEase 3.13.0` 头）。**三条 SVG path 与 CSS `cubic-bezier()` 数值一一对应**：`ease_in=cubic-bezier(.6,0,.8,.4)`（起步极慢后段猛冲）、`ease_out=cubic-bezier(.2,.9,.45,1)`（前 20% 走完 90%，长尾）、`ease_inout=cubic-bezier(.7,0,.3,1)`（极强对称 S）。**这是全站手感的核心，也是最值得抄的一件事。**

### A.2.2 入场动画（四层，严格 stagger）

**① 加载屏开场**（`Bx70QQQb.js` loading 模块 `show()`）：

```js
.set(this.blocks,{scale:1})
.to(this.blocks,{ opacity:1, duration:.5, ease:e.ease_out, stagger:{from:"random", each:.002} })
.to(this.blocks,{ strokeOpacity:0,
                  strokeDashoffset:()=>Math.random()>.5 ? "calc(var(--scale) * 50rem)" : "calc(var(--scale) * -50rem)",
                  duration:.5, ease:e.ease_out, stagger:{from:"random", each:.002} }, "<0.3")
.to(this.middle,  {opacity:1, duration:1, ease:e.ease_out}, "<")
.to(this.codewall,{opacity:.05, duration:1, ease:e.ease_out}, "<")
```

块总数 **11 列 × 10 行 = 110 个 `<polygon class="loading_blocks_block">`**（`body.tags.txt` 第 4–113 行），`110 × .002 = 0.22s` 随机窗口。

```css
.loading_blocks_block{ stroke:var(--color_theme); stroke-width:var(--border_xs); stroke-opacity:0; stroke-dasharray:calc(var(--scale)*50rem) }
.loading_codewall{ color:var(--color_white); font-family:zpix; font-size:calc(var(--scale)*2rem); height:120%; width:120%; letter-spacing:calc(var(--scale)*1rem); line-height:calc(var(--scale)*2.5rem); opacity:.05; word-break:break-all }
```

代码墙每 **100ms** 换一次（`play(){ this.stop(); this.animater = Ws(this.update_code.bind(this), 100) }`），每次 30 组 × 128 位 0/1 串。

**② 加载屏退场**（同文件 `hidden()`）——**`stagger.from` 由 `"random"` 换成 `"center"`，间隔由 `.002` 变 `.004`，退场比入场慢一倍且从中心扩散**：

```js
.to(this.blocks,{strokeOpacity:1, strokeDashoffset:0, duration:.5, ease:ease_out, stagger:{from:"random", each:.002}})
.to([this.middle,this.codewall],{opacity:0, duration:1, ease:ease_out}, "<")
.to(this.blocks,{scale:0, opacity:0, duration:1, ease:ease_out, stagger:{from:"center", each:.004}, onComplete:…}, "<0.2")
```

**③ 说明页**（`CxtPVY3G.js` instruction 模块）——`.main` 走 `scale(1.1) → scale(1)`（**轻微内缩**，不是放大）：

```js
reset(){ gsap.set(this.container,{opacity:0}); gsap.set(this.main,{scale:1.1}); gsap.set([this.blocks,this.circles],{opacity:0}) }
show(){ gsap.timeline().to(this.container,{opacity:1, duration:1, ease:e.ease_out}).to(this.main,{scale:1, duration:1, ease:e.ease_out}, "<")
  .to(this.blocks, {opacity:.4, duration:.8, ease:e.ease_out, stagger:{from:"random",each:.1}},  "<")
  .to(this.circles,{opacity:1,  duration:.8, ease:e.ease_out, stagger:{from:"random",each:.05}}, "<") }
```

**④ 系统页**（同文件 system 模块）——标题 `y:100%→0` 配父级 `.system_databox_title{overflow:hidden}` 即「遮罩下拉出」；正文 `opacity` 用 **2s**（容器只 1s），造成「容器到位后文字还在浮现」；`height` 是全站唯一被动的非合成属性：

```js
reset(){ gsap.set(this.container,{opacity:0}); gsap.set(this.title,{y:"100%"}); gsap.set(this.codes,{scale:0});
         gsap.set(this.image,{height:0}); gsap.set(this.content,{opacity:0}); gsap.set(this.button,{opacity:0}) }
show(){ gsap.timeline().to(this.container,{opacity:1, duration:1, ease:e.ease_out})
  .to(this.title,  {y:0,     duration:.8,  ease:e.ease_out}, "<")
  .to(this.codes,  {scale:1, duration:1,   ease:e.ease_in, stagger:.02}, "<")
  .to(this.image,  {height:"calc(var(--scale) * 15rem)", duration:1.2, ease:e.ease_inout}, "<0.2")
  .to(this.content,{opacity:1, duration:2,   ease:e.ease_inout}, "<0.3")
  .to(this.button, {opacity:1, duration:1.5, ease:e.ease_in},   "<") }
```

### A.2.3 视差 = 拖拽平移（不是滚动视差）

```js
container.onmousedown = h => { if_movable=true; mouse_x=h.x; mouse_y=h.y }
container.onmouseup = container.onmouseleave = container.ontouchend = () => { if_movable=false }
container.onmousemove = h => { if(if_movable){ move(h.x,h.y); mouse_x=h.x; mouse_y=h.y } }
container.ontouchmove = h => { h.preventDefault(); if(if_movable){ move(h.touches[0].clientX,h.touches[0].clientY); … } }
move(h, m){
  distance_x += (h - mouse_x) / innerWidth * 500 / devicePixelRatio     // 灵敏度 500
  distance_y += (m - mouse_y) / innerWidth * 500 / devicePixelRatio
  distance_x = Math.max(min_x, Math.min(max_x, distance_x))             // 边界钳制
  distance_y = Math.max(min_y, Math.min(max_y, distance_y))
  gsap.timeline().to(backgroud,{x:distance_x,      y:distance_y,      duration:1, ease:e.ease_out})
                 .to(stars,    {x:distance_x * .8, y:distance_y * .8, duration:1, ease:e.ease_out}, "<")   // 视差 0.8
                 .set([dragtip_line_left,dragtip_line_right], {strokeDashoffset: f => f%2==0 ? m-innerHeight/2 : m-innerHeight/2+20}, "<")
                 .set(dragtip_line_top, {strokeDashoffset: f => f==0 ? h-innerWidth/2 : h-innerWidth/2+20}, "<") }
resize(){ let h=backgroud.offsetWidth, m=backgroud.offsetHeight
          max_x=(h-innerWidth)/2;  min_x=(innerWidth-h)/2;  max_y=(m-innerHeight)/2; min_y=(innerHeight-m)/2; …; move(0,0) }
```

**可抄参数：灵敏度 `500`（鼠标每移动 1 个视口宽，世界移动 500 逻辑像素）；视差分层比 背景 `1.0` : 星场 `0.8`；跟随时长 `1s` + `ease_out`；边界 = 背景比视口大多少就允许多移多少**（这就是背景 `150%` 的原因）。

### A.2.4 鼠标跟随（`.windowview_mousetip`）

```css
.windowview_mousetip{ height:calc(var(--scale)*7.5rem); width:calc(var(--scale)*7.5rem); left:0; top:0; margin-left:calc(var(--scale)*-7.5rem/2); margin-top:calc(var(--scale)*-7.5rem/2); transform:scale(0); pointer-events:none; position:fixed } /* 负 margin 居中 */
.windowview_mousetip_halo{ opacity:0; transform:translate(-3%); transition:opacity .5s var(--ease_inout); width:calc(var(--scale)*4.5rem) }
.windowview_mousetip_content{ height:calc(var(--scale)*1.2rem); overflow:hidden }
.windowview_mousetip_content p{ transform:translateY(-100%); transition:transform .5s var(--ease_inout) }
.windowview_mousetip_click .windowview_mousetip_content p{ transform:translateY(0) } /* 从遮罩下拉出 */
.windowview_mousetip_outline{ transform:rotate(90deg); transition:transform 1s var(--ease_out) .1s }
.windowview_mousetip_activted .windowview_mousetip_outline{ transform:rotate(0) }
.wmo_linedown,.wmo_lineup{ border:var(--border_s) solid var(--color_white); border-radius:50%; transform:scale(.8); transition:transform 1s var(--ease_out) .1s, clip-path .8s var(--ease_out) .1s }
.wmo_lineup{ clip-path:polygon(0 0,100% 0,100% 50%,0 50%) } .wmo_linedown{ clip-path:polygon(0 50%,100% 50%,100% 100%,0 100%) }
.wmo_x,.wmo_y{ transform:scale(0); transition:transform .8s var(--ease_out) .1s }
.windowview_mousetip_activted .wmo_lineup  { clip-path:polygon(0 0,100% 0,100% 40%,0 40%); transform:scale(1) }
.windowview_mousetip_activted .wmo_linedown{ clip-path:polygon(0 60%,100% 60%,100% 100%,0 100%); transform:scale(1) }
.windowview_mousetip_activted .wmo_x,.windowview_mousetip_activted .wmo_y{ transform:scale(1) }
.windowview_mousetip_halo_circle1{ stroke-width:5; filter:url(#windowview_mousetip_halo_wave1) blur(calc(var(--scale)*.05rem)) }
.windowview_mousetip_halo_circle2{ stroke-width:2; filter:url(#windowview_mousetip_halo_wave2) blur(calc(var(--scale)*.01rem)) }
.windowview_mousetip_halo_circle3{ stroke-width:1; stroke-dasharray:3; filter:url(#windowview_mousetip_halo_wave3) blur(calc(var(--scale)*.02rem)) }
```

JS：`move_mousetip` 用 `{x,y, duration:.6, ease:e.ease_out}`；`show/hidden_mousetip` 用 `{scale:1|0, duration:.8, ease:e.ease_out}`。光晕形变用 SVG `feTurbulence`+`feDisplacementMap`（三层 `scale=20/15/10`），GSAP **MorphSVGPlugin** 在 3 条预置路径间循环，每段 `duration:Math.random()*.1+.05`（**50–150ms，`linear`，无限**）；三条路径各约 800–1200 字符，手工复刻成本极高，C 节给 CSS 近似替代。

### A.2.5 Hover：**全部包在 `@media (hover:hover)` 内**

很专业的一手——避免触屏上 hover 态卡住，全站出现十余次。

```css
.uibox_instructionbox_info_icon div{ background-color:var(--color_white); opacity:.3; clip-path:polygon(0 0,100% 0,100% 100%,calc(var(--scale)*1rem) 100%,0 calc(100% - var(--scale)*1rem)); transition:background-color .5s var(--ease_out) }
.uibox_instructionbox_info_icon img{ transition:transform .8s var(--ease_out) }
@media (hover:hover){ .uibox_instructionbox_info:hover .uibox_instructionbox_info_icon div{ background-color:var(--color_theme) }
  .uibox_instructionbox_info:hover .uibox_instructionbox_info_icon img{ transform:scale(.9) rotate(30deg) } }
.uibox_middle_links_icons a:after,.uibox_middle_links_icons a:before{ transition:transform .5s var(--ease_out) }
.uibox_middle_links_icons a div{ background-color:var(--color_theme); opacity:0; transition:opacity .5s var(--ease_out) }
@media (hover:hover){ .uibox_middle_links_icons a:hover div{ opacity:.8 } .uibox_middle_links_icons a:hover:after{ transform:scale(1.1) }
  .uibox_middle_links_icons a:hover:before{ transform:scale(1.1) rotateY(-180deg) } } /* 必须保留 rotateY */
.umc_button_background{ background-color:var(--color_theme); border-radius:50%; filter:blur(0); height:calc(var(--scale)*5rem); width:calc(var(--scale)*5rem); opacity:.8; transform:scale(0); transition:transform .8s var(--ease_out), filter .8s var(--ease_out) }
@media (hover:hover){ .umc_button:hover .umc_button_background{ filter:blur(calc(var(--scale)*1rem)); transform:scale(1) }
  .umc_button:hover .umc_button_layer div{ transform:rotate(calc(var(--a) + 90deg*var(--d))) } }
.wsi_button_text:after{ background:linear-gradient(90deg,var(--color),#00000000); bottom:calc(var(--scale)*-.4rem); height:var(--border_xs); left:0; width:110%; transform:scaleX(0); transform-origin:left; transition:transform .8s var(--ease_out) }
@media (hover:hover){ .wsi_button:hover .wsi_button_text:after{ transform:scaleX(1) } }
.button svg{ fill:var(--color_theme); transition:transform .5s var(--ease_out) } .button p{ transition:color .5s var(--ease_out) }
@media (hover:hover){ .button:hover p{ color:var(--color_theme) } .button:hover svg{ transform:translate(-30%) } }
.ad_title_button{ transform:rotate(45deg); transition:transform .5s var(--ease_out) }
@media (hover:hover){ .ad_title_button:hover{ transform:rotate(45deg) scale(.8) } }
.ed_content_info_button{ color:var(--color_theme); border:var(--border_s) solid var(--color_theme); transition:color .5s var(--ease_out) }
.ed_content_info_button:before{ background-color:var(--color_theme); opacity:.2; transition:opacity .5s var(--ease_out); z-index:-1 }
@media (hover:hover){ .ed_content_info_button:hover{ color:var(--color_black) } .ed_content_info_button:hover:before{ opacity:1 } }
```

弹窗按钮的 hover 用 **`:before` 的 `opacity .2 → 1`** 而非改 `background-color`，这样文字色 `--color_theme → --color_black` 能与背景同步过渡，`:before{z-index:-1}` 保证在文字下方。

### A.2.6 常驻循环动画

| 元素 | 声明（逐字） | 来源 |
|---|---|---|
| `.ship_eye circle:nth-child(3)` | `animation:ship_eye 2s ease infinite`；`0%{fill:#8a4342} 5%{fill:#f3f3f3} 95%{fill:#f3f3f3} to{fill:#8a4342}` | `style2.css` |
| `.ship_stroke .ship_eye circle:nth-child(3)` | 同上但 `1s`（描边模式时长减半） | `style2.css` |
| `.loading_middle_wavebox` | 两层 `svg`：`translate(0)→(-100%)` 与 `→(100%)`，`2s linear infinite`；容器 `mask-image:linear-gradient(90deg,#0000,#000,#0000)` | `style4.css` |
| `.ad_content_scrolltext p` | `animation:ad_content_scrolltext 10s linear infinite`；`translate(0)→translate(-100%)` | `style6.css` |
| `.system_pagebox_wave` | `animation:pagebox_wave 60s linear infinite`；`rotate(0)→rotate(1turn)`；`opacity:.15` | `style8.css` 263 |
| `.umc_web circle` | `animation:umc_web_circle 3s var(--ease_out) infinite calc(var(--d)*1s)`；`0%{opacity:0} 10%{opacity:1} 50%{opacity:1} 60%{opacity:0}` | `style8.css` 192 |
| `.sdb_button_spot div` | `animation:sdb_button_spot 1s linear infinite; animation-delay:calc(var(--d)*1s)`；`0%{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(3)}` | `style8.css` 254 |
| `.mask`（红色警报） | `animation:mask 2s var(--ease_inout) infinite`；`0%{opacity:1} 20%{opacity:0} 50%{opacity:0} 70%{opacity:1} to{opacity:1}`；`background-color:#d60c0c30` | `style5.css` |
| `.ueb_block_t1 line` 等 4 个 HUD 方块 | `animation:… 2s var(--ease_inout) infinite var(--d)`，DOM 上 `--d` 为 `0.4s/0.8s/0s` | `style8.css` 104–136 |
| `.wsi_title_icon_line` | `animation:wsi_title_icon_line 2s linear infinite`；`translateY(0)→500%→0→-500%` | `style8.css` 36 |

**电量条（`style10.css`）用两个自定义属性纯 CSS 生成梯形充电**，最省代码：

```css
div[data-v-86db70d3]{ --color:inherit; animation:charge calc(var(--l)*.125s) var(--ease_inout) infinite; animation-delay:calc(var(--i)*.1s); background-color:var(--color); height:calc(var(--scale)*1rem); margin:0 calc(var(--scale)*.1rem); width:calc(var(--border_xs)*var(--s)) }
@keyframes charge{ 0%{opacity:0} 50%{opacity:1} to{opacity:0} }
```

### A.2.7 转场

**场景切换**纯 opacity 1s：`.system{ … opacity:0; overflow:hidden; position:absolute; touch-action:none; visibility:visible }`、`.system_hidden{visibility:hidden}`；`show()` 首句 `.to(container,{opacity:1,duration:1,ease:ease_out})`，`hidden()` 反之。

**罗盘三层级联**（`style8.css` 262–288）：

```css
.spc_pattern_outer{ opacity:0; transform:scale(.6) rotate(45deg); transform-origin:center }
.spc_pattern_inner{ opacity:0; transform:scale(.8) rotate(-45deg); transform-origin:center }
.spc_pattern_star { fill:var(--color_white); transform:scale(0); transform-origin:250px 29.01px }
.system_pagebox_compass_show .spc_pattern_outer,.system_pagebox_compass_show .spc_pattern_inner{ opacity:1; transform:scale(1) rotate(0) }
.system_pagebox_compass_show .spc_pattern_outer{ transition:transform 1.6s var(--ease_out), opacity 1.6s var(--ease_out) }
.system_pagebox_compass_show .spc_pattern_inner{ transition:transform 1s var(--ease_out) .8s, opacity 1s var(--ease_out) .8s }
.system_pagebox_compass_show .spc_pattern_star { transform:scale(1); transition:transform .5s var(--ease_out) 1.2s }
```

**外环 1.6s/延迟 0 → 内环 1s/延迟 .8s → 星形 .5s/延迟 1.2s**，总 1.7s 收尾。配套 JS：容器 `opacity:0→1 .8s ease_out` 且 `onStart` 里 `classList.add("system_pagebox_compass_show")`；四条 `solidline` 的 `strokeDashoffset 460/300 → 0`（`1.2s ease_out`，第二条 `<0.3`）；`dashline` 的 `strokeDasharray "0,80"→"1,10"`（`1s`）；`dropline` 的 `"0,500"→"0,48"` 且 `strokeDashoffset 10→20`（`1s`）；节点 `opacity:0→1`（`stagger:.2`）；图标 `scale(.5)+opacity:0 → 1`（`stagger:.1`）。

**世界环旋转用 `--index` 驱动三层嵌套 `rotate` 相互抵消**，保证图标始终正立（`style8.css` 268–273，均 `1.5s ease_out`）：

```css
.spw_world{ position:absolute; transform:rotate(calc(var(--index)*var(--angle_world))) }
.spw_world_icon>div{ transform:rotate(calc(var(--index)*-1*var(--angle_world) - var(--angle_pagebox) - var(--angle_visible))) }
.spw_world_icon>div>div{ transform:rotate(calc(var(--angle_rotate) * -1)) }
.spw_world_icon_outter{ transform:translateY(-200%) }
```

**世界切换**：节点 `opacity:0`（`.6s ease_out`）→ `.set(rotate:0)` → `opacity:1`（`1s ease_out`），全程约 1s。

**星点信息卡点开时序**（`show_information()`）——起手值 `.wsi_title{clip-path:polygon(0 0,0 0,0 100%,0 100%)}`、`.wsi_line g{transform:scale(0); transform-origin:143.7968px 132.1248px}`、`.wsi_line path{stroke-dasharray:calc(var(--scale)*4rem); stroke-dashoffset:calc(var(--scale)*4rem)}`、`.wsi_container{opacity:0}`：

```js
gsap.timeline()
  .set(this.information,{left:`${ref.offsetLeft+ref.offsetWidth}px`, top:`${ref.offsetTop+ref.offsetHeight}px`})
  .to(this.line_circle,{transform:"scale(1)", duration:.3, ease:e.ease_out, onStart:()=>{ if_information_visible=true }})
  .to(this.line_line,  {strokeDashoffset:0, duration:.8, ease:e.ease_out}, "<0.1")
  .to(this.title,      {clipPath:"polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", duration:1, ease:e.ease_out}, "<0.3")
  .to(this.wsi_container,{opacity:1, duration:1, ease:e.ease_out}, "<")
```

**`clip-path` 从宽度 0 的多边形变到满宽 = 「从左擦出」的标题揭示，`1s ease_out`**，比 `scaleX` 好，因为不压扁字形。退场反而极快：`{opacity:0, duration:.3, ease:"linear"}` 后 `.set()` 复位。**定时弹窗**：`(Math.random()*60 + 60) * 1e3` → **首次随机弹窗延迟 60–120 秒**，内容是 `.ed`（飞船故障）或 `.ad`（广告）；这两个浮层的具体 tween 数值**未核实**。

### A.2.9 缓动/时长总表

| 用途 | 属性 | 时长 | 缓动 | 延迟/stagger |
|---|---|---|---|---|
| 加载块淡入 / 描边飞出 | opacity / strokeOpacity+strokeDashoffset | .5s | ease_out | random .002；飞出重叠 `<0.3` |
| 加载屏中央淡入 | opacity | 1s | ease_out | `<` |
| 加载屏退场（块描边 / 内容） | strokeOpacity+dashoffset / opacity | .5s / 1s | ease_out | random .002 / `<` |
| 加载屏退场（块缩放） | scale+opacity | 1s | ease_out | `<0.2`，**center .004** |
| 说明页容器 / 主图 | opacity / scale 1.1→1 | 1s | ease_out | 0 / `<` |
| 说明页方块 / 圆点 | opacity→.4 / →1 | .8s | ease_out | `<`，random .1 / .05 |
| 系统页标题 / 代码 | y 100%→0 / scale 0→1 | .8s / 1s | ease_out / ease_in | `<`，stagger .02 |
| 系统页图片 / 正文 / 按钮 | height 0→15rem / opacity / opacity | 1.2s / **2s** / 1.5s | ease_inout / ease_inout / ease_in | `<0.2` / `<0.3` / `<` |
| 罗盘外环 / 内环 / 星形 | scale+rotate | 1.6s / 1s / .5s | ease_out | 0 / .8s / 1.2s |
| 罗盘描边线 | strokeDashoffset 460\|300→0 | 1.2s | ease_out | `<0.5` / `<0.3` |
| 星点卡 圆 / 引线 / 标题 / 内容 | scale / dashoffset / clip-path / opacity | .3s / .8s / 1s / 1s | ease_out | 0 / `<0.1` / `<0.3` / `<` |
| 信息卡退场 | opacity | .3s | **linear** | 0 |
| 鼠标跟随 / 光晕 / 十字线 | x,y / scale 0↔1 / rotate 90→0 | .6s / .8s / 1s | ease_out | — / — / .1s |
| 世界环旋转 / 世界切换节点 | rotate / opacity | 1.5s / .6s+1s | ease_out | — / `<0.4` |
| **主题色切换** | `--color_theme` | .5s | ease_out | — |
| Hover 下划线 / 图标 / 按钮底色 / 圆盘光晕 | scaleX 0→1 / scale.9+rotate30 / opacity .2→1 / scale0→1+blur | .8s / .8s / .5s / .8s | ease_out | — |

**主题色切换**由 `vt.to("body",{"--color_theme": e.current_world.color, duration:.5, ease:e.ease_out})` 完成——**GSAP 直接 tween CSS 自定义属性**，4 个世界的主题色就是这样 0.5s 平滑过渡的。

## A.3 排版与配色

### A.3.1 字体族：**Zpix（最像素字体）自托管 TTF**

```css
@font-face{ font-family:zpix; src:url(/_nuxt/zpix.DytyLrWt.ttf) }
```

**只有这一个 `src`，无 `woff2`、无 `format()`、无 fallback 字体栈**——TTF 加载失败则字感全崩。三重同源证据：(1) `._font_1`~`._font_5` 全部 `font-family:zpix`；(2) 4 处裸写 `zpix`（`.loading_codewall`、`.error_content_404`，见 `style4.css`/`style7.css`）；(3) **Lottie 动画文件也声明了它**——`overview.json` 的 `compass.fonts.list` 为 `{"fName":"Zpix","fFamily":"Zpix","fStyle":"Regular","ascent":75.0005088746548}`，图层文字 `s:{s:34.6978988647461, f:"Zpix", lh:41.6374816894531, fc:[0.953,0.953,0.953]}`，三个字 `宇`/`宙`/`汤` 分别在 `p:[383.551,254.736]`、`[384.096,407.011]`、`[383.568,570.099]`。`fc:[0.953×3]` 正是 `#F3F3F3`。

### A.3.2 字号阶梯、行高、字距

字号见 A.1.4。行高阶梯 `--line_height_1/2/4 = 1/1.5/2 rem`。**基准行高 = `1rem`，而 `_font_1` 正文是 `.6rem`，实际倍数 ≈ 1.667**——中文舒适区间。

| 选择器 | letter-spacing | 来源 |
|---|---|---|
| `.loading_codewall` | `calc(var(--scale)*1rem)`（= 一个字宽） | `style4.css` |
| `.error_asciibox_chars` | `calc(var(--scale)*.35rem)` | `style7.css` |
| `.windowview_dragtip_texts` | `calc(var(--scale)*.4rem)` + `writing-mode:vertical-lr` | `style8.css` |
| `.uibox_middle_time>p`（时钟 `01:09:06`） | `calc(var(--scale)*.15rem)` | `style8.css` |
| `.sdm_content_sections p` | `calc(var(--scale)*.03rem)`（几近 0） | `style8.css` |

规律：**英文/数字大标题用大字距（.4rem、1rem），中文正文用几近 0（.03rem）**，符合中文排版习惯。

### A.3.3 颜色体系

```css
--color_black:#000013;   /* R0 G0 B19，非纯黑 */
--color_white:#f3f3f3;   /* 243 灰，非纯白 */
```

**`--color_theme` 是运行时注入的**，4 个世界实测（`api.cosmicbroth.com/api/overview`）：

| id | name | `color` | `time_diff` | 星点 `x,y` | `r` | 星点图 |
|---|---|---|---|---|---|---|
| `cosmic-broth` | 宇宙汤 | **`#178ec5`** | +15 | 40, 60 | 1 | `star_80153f61f1.png` |
| `checkerboard` | 地平世界 | **`#4BC0AB`** | +100 | 65, 40 | 1.5 | `star_7ace939b54.png` |
| `fogbound-box` | 迷雾中古 | **`#DEC466`** | +20 | 55, 55 | 0.6 | `star_5cf82170c3.png` |
| `meta-room` | 棋盘室 | **`#9B3B62`** | +50 | 45, 40 | 0.6 | `star_cd814e141a.png` |

这 4 组 `x,y,r` 与 `star_image_url` 与 DOM 内联样式**一一对应**，证明数据链路是实抓：

```html
<div class="windowview_stars_star windowview_stars_star_clickable" style="left:40%;top:60%;--r:1;"><img src="...star_80153f61f1.png"></div>
<div class="windowview_stars_star windowview_stars_star_clickable" style="left:65%;top:40%;--r:1.5;"><img src="...star_7ace939b54.png"></div>
<div class="windowview_stars_star windowview_stars_star_clickable" style="left:55%;top:55%;--r:0.6;"><img src="...star_5cf82170c3.png"></div>
<div class="windowview_stars_star windowview_stars_star_clickable" style="left:45%;top:40%;--r:0.6;"><img src="...star_cd814e141a.png"></div>
```

`.windowview_stars_star{ height:calc(var(--scale)*3rem*var(--r)); width:calc(var(--scale)*3rem*var(--r)) }`——**`--r` 是尺寸倍率，基准 3rem。**

**功能色（硬编码，不随主题变）**：`#8a4342`（瞳孔暗红闪烁起始）、`#d60c0c`（故障红）与 `#d60c0c30`（`.mask` 约 19%）、`#f00f03`/`#0326f0`（404 红蓝色差）、`#2cf703`（`error_type6` 荧光绿）、`#919090`/`#565656`（飞船背板亮/暗）、`#858179`（眼部网格）、`#868686`（外壳圆环）、`#312d2e`（眼眶底）、`#f3f3f330`/`#f3f3f350`/`#f3f3f35c`（网格线/日志区/滚动条槽，19%/31%/36%）、`#f3f3f362`/`#f3f3f314`（数据卡渐变 38%/8%）。

**404 的 8 套配色变异**（`style7.css`，同一 DOM 换 class）是「极少代码做大量变体」的范本；**RGB 色差 glitch 的负延迟是灵魂**：

```css
.error_type1{background:var(--color_black)} .error_type1 .error_asciibox{background:var(--color_white)}
.error_type3{background:#0326f0} .error_type3 .error_asciibox{background:var(--color_white)}
.error_type5{filter:grayscale(1)} .error_type5 .error_asciibox{background:#a5a5a5}
.error_type6{background:#2cf703; filter:contrast(1000%)} .error_type6 .error_asciibox{background:var(--color_black)}
.error_type8{background:var(--color_black); filter:brightness(1000%)} .error_type8 .error_asciibox{background:#f00307; filter:blur(calc(var(--scale)*.05rem))}
.error_content_404{ color:var(--color_black); font-family:zpix; font-size:calc(var(--scale)*10rem); margin-bottom:calc(var(--scale)*2rem); margin-right:calc(var(--scale)*-1.5rem) }
.error_content_404:after,.error_content_404:before{ content:"404"; mix-blend-mode:lighten; position:absolute; z-index:-1 }
.error_content_404:after { animation:shake .5s var(--ease_out) infinite reverse; color:#f00f03; transform:translate(2%) }
.error_content_404:before{ animation:shake .5s var(--ease_out) infinite -.3s; color:#0326f0; transform:translate(-2%) }
@keyframes shake{ 0%{transform:translate(1%) translateY(-1%)} 20%{transform:translate(0) translateY(.5%)} 40%{transform:translate(-1%) translateY(1.5%)}
  60%{transform:translate(1%) translateY(0)} 80%{transform:translate(-1.5%) translateY(-1%)} to{transform:translate(1%) translateY(-.5%)} }
```

两个伪元素共用一条 `shake`，一个 `reverse`、一个 `animation-delay:-.3s`（负值即刻从中段起步）——**两层色差永不同步**。

### A.3.4 填充 vs 描边：一套 SVG 两种形态

```css
.ship_front path{ fill:var(--color_white) }                                             /* 实心 */
.ship_stroke .ship_front path{ fill:none; stroke:var(--color_white); stroke-width:3.3 } /* 线框 */
.ship_stroke .ship_back{ visibility:hidden }
```

**可推广到任何图标系统**：一套 path，一个 class 切换填充/描边，不维护两份资源。`stroke-width:3.3` 在 `viewBox="0 0 500 500"` 里是固定值，配 `vector-effect="non-scaling-stroke"`。

### A.3.5 `--scale` 响应式分级（完整）

```css
@media screen and (max-aspect-ratio:3/2){ *{ font-size:1.8vmin } }
@media screen and (max-aspect-ratio:3152519739159347/2251799813685248){ *{ font-size:1.7vmin } } /*≈1.400*/
@media screen and (max-aspect-ratio:5854679515581645/4503599627370496){ *{ font-size:1.6vmin } } /*≈1.300*/
@media screen and (max-aspect-ratio:5404319552844595/4503599627370496){ *{ font-size:1.5vmin } } /*≈1.200*/
@media screen and (max-aspect-ratio:1/1){ *{ font-size:1.7vmax } }                               /* 竖屏切 vmax */
@media screen and (max-aspect-ratio:8106479329266893/9007199254740992){ *{ font-size:1.6vmax } } /*≈0.900*/
@media screen and (max-aspect-ratio:3602879701896397/4503599627370496){ *{ font-size:1.5vmax } } /*≈0.800*/
@media screen and (max-aspect-ratio:3152519739159347/4503599627370496){ *{ font-size:1.4vmax } } /*≈0.700*/
@media screen and (max-aspect-ratio:5404319552844595/9007199254740992){ *{ font-size:1.3vmax } } /*≈0.600*/
@media screen and (max-aspect-ratio:1/2){ *{ font-size:1.2vmax } }
@media screen and (max-aspect-ratio:3602879701896397/9007199254740992){ *{ font-size:1.1vmax } } /*≈0.400*/
```

横屏从 `2vmin` 降到 `1.5vmin`，竖屏改用 `vmax` 并从 `1.7vmax` 降到 `1.1vmax`。**「横屏看短边、竖屏看长边」是精髓**——竖屏若按 `vmin` 算字会小到看不清，这是那串 `max-aspect-ratio` 分数的真正原因。组件级覆写：`.uibox{--scale:1}` → `.9`(≈1.10) → `.93`(竖屏) → `.87` → `.82` → `.77` → `.72` → `.68`；`.loading{--scale:1.2}`（**小屏加载屏反而放大**）；`.windowview_dragtip{--scale:.8}`；`.system_databox,.system_pagebox{--scale:.7}` 且竖屏改 `bottom:10%`/`top:10%`、`--angle_pagebox:0deg`、`--angle_visible:-45deg`。

## A.4 图片处理

### A.4.1 圆角：**几乎为零**

全站 `border-radius` 绝大多数是 `50%`（画圆）；非圆形圆角**只有 4 处**（`.ed_content_shipbox`/`.ueb_block`/`.ad_content_image` 为 0，走切角；少数 `1rem`）。**形态语言是「直角 + 切角」，完全没有现代 UI 的 `8px/12px` 圆角**，唯一柔化手段是 `clip-path`。

### A.4.2 切角：两个核心工具类（第 1 个内联 `<style>`）

```css
/* ① 十字切角：四边中点各切一个口（12 点） */
._clip_cross{ --gap_w:calc(var(--scale)*.5rem); --gap_h:calc(var(--scale)*.5rem);
  clip-path:polygon(0 var(--gap_h), var(--gap_w) var(--gap_h), var(--gap_w) 0, calc(100% - var(--gap_w)) 0, calc(100% - var(--gap_w)) var(--gap_h), 100% var(--gap_h), 100% calc(100% - var(--gap_h)), calc(100% - var(--gap_w)) calc(100% - var(--gap_h)), calc(100% - var(--gap_w)) 100%, var(--gap_w) 100%, var(--gap_w) calc(100% - var(--gap_h)), 0 calc(100% - var(--gap_h))) }
/* ② 四角括号：两个伪元素镜像 */
._clip_edge{ --gap_size:calc(var(--scale)*.5rem); --gap_border:var(--border_xs); --gap_color:var(--color_white) }
._clip_edge:after,._clip_edge:before{ --gap_size:inherit; border:var(--gap_border) solid var(--gap_color); content:""; height:100%; position:absolute; width:100%;
  clip-path:polygon(0 0, var(--gap_size) 0, var(--gap_size) var(--gap_size), 0 var(--gap_size), 0 calc(100% - var(--gap_size)), var(--gap_size) calc(100% - var(--gap_size)), var(--gap_size) 100%, 0 100%) }
._clip_edge:before{ transform:rotateY(-180deg) }   /* ← 镜像出右边两个角 */
```

**`clip-path` 把边框裁成只剩左边上下两个 L 形角，`:before` 用 `rotateY(-180deg)` 镜像出右边两个角**——一次定义、两个伪元素、四角齐备。这正是 A.2.5 里 `:hover:before{transform:scale(1.1) rotateY(-180deg)}` 必须保留 `rotateY` 的原因。覆写实例：`.ueb_block{--gap_size:calc(var(--scale)*.6rem); --gap_border:var(--border_m); --gap_color:var(--color_white)}`。

### A.4.3 遮罩（mask）8 种用法

| 用途 | 声明 | 来源 |
|---|---|---|
| 波浪两端渐隐 | `linear-gradient(90deg,#0000,#000,#0000)` | `style4.css` |
| 广告图下半渐隐 | `linear-gradient(180deg,#000 50%,#0000)` | `style6.css` |
| 数据块底部渐隐 | `linear-gradient(180deg,#000,#000,#0000)` | `style8.css` |
| 底部弧形 PCB 轮廓 | `url("data:image/svg+xml,…viewBox='0 0 800 1000'…")` | `style8.css` 239 |
| 中间横线两端渐隐 | `linear-gradient(-90deg,#000 30%,#0000)` | `style8.css` 164 |
| 罗盘边框上下渐隐 | `linear-gradient(0deg,#0000 20%,#000 50%,#0000 80%)` | `style8.css` 188 |
| 雷达网格径向渐隐 | `radial-gradient(circle,#000 0,#0000 75%)` | `style8.css` 190 |
| 进度条尾部渐隐 | `linear-gradient(90deg,#000 90%,#0000)` | `style6.css` 91 |

**`mask-image` + `linear-gradient` 是最常用的「软化边缘」手段**，因为它不影响 `background-color`。那个内联 SVG mask（URL 解码后）是一条左侧带一排锯齿插槽的异形面板轮廓：

```html
<svg xmlns='http://www.w3.org/2000/svg' xml:space='preserve' viewBox='0 0 800 1000'>
<path d='M800 1000H22.25l-.13-67.9h20.63l-.03-34.23-20.62-22.31-.07-21.53L0 853.88v-93.05l22.1-34.01v-42.85L0 659.67v-95.41l22.1-30.92V367.92H0v-71.78l22.1-40.67v-88.31l26.23-50.5-.01-89.82L75.85 0H214.2l32.49 16.98h49.72v22.96h235.88L565.56 0h79.26l19.54 12.12h84.81L800 58.2z'/></svg>
```

### A.4.4 滤镜与混合模式

`filter`：星点可点击态 `contrast(.5)` ↔ `contrast(1)`（`2s ease_out infinite`，`style8.css` 15）；光晕三层 `url(#…wave1/2/3) blur(…)`（`feDisplacementMap scale` = 20/15/10）；圆盘 hover `blur(0)`→`blur(1rem)`；404 模式 5/6/7/8 分别 `grayscale(1)`、`contrast(1000%)`、`url(#error_maskbox_filter)`、`brightness(1000%)`。

`mix-blend-mode` **只有 3 处，全在 404 页**：`.error_content_404:after/:before{mix-blend-mode:lighten}`、`.error_content_button{mix-blend-mode:difference}`、`.error_type6 .error_content_404{mix-blend-mode:difference}`。**首页零混合模式**——层次感靠 `opacity` 与多层 `position:absolute` 堆叠。

### A.4.5 栅格：**没有栅格系统**

完全不用 Grid，也不用 `flex-basis` 百分比列。三种手法：(1) **百分比绝对定位**（星点，位置写死在 HTML 内联，由 API 驱动，尺寸靠 `--r`）；(2) **`rem` 定宽 + `margin` 分隔**（`.uibox_middle_edge{width:14rem}`、`.uibox_middle_console{width:15rem}`、`.uibox_middle{margin:0 3rem}`）；(3) **`flex:1` 等分**（华为侧用，见 B.4.3）。唯一的「栅格感」：`.wsi_container{width:12rem}` + `.wsi_content{width:90%}` → 内容 10.8rem、右缝 1.2rem。

**图文混排比例（实测）**：弹窗 `.ed_content` 为 `.ed_content_shipbox` **50%** : `.ed_content_info` **50%**（`style5.css`）；广告 `.ad_content_image` 宽 20rem、`height:calc(var(--scale)*20rem*9/16)`（16:9），下方 `.ad_content_info{width:85%}`（`style6.css`）；系统页 `.sdm_block_image` 92% 宽 vs `.sdm_content_sections` 70% 宽；数据卡 `.system_databox_main` **23rem × 30rem**。`.ad_content_image` 是唯一固定宽高比容器。

### A.4.6 图片与动画的融合：**不让图片动，让图片被遮罩与描边包裹**

```css
img,p{ -webkit-user-select:none; -moz-user-select:none; user-select:none }
img{ pointer-events:none }                 /* 图片永不接收事件，交互交给上层容器 */
.windowview_backgroud_image{ opacity:.8 }  /* 照片压暗，让 #f3f3f3 线框浮在上面 */
.instruction_main{ height:calc(var(--scale)*40rem*9/16); width:calc(var(--scale)*40rem) }  /* 16:9 */
.instruction_main:after{ background-color:var(--color_white); clip-path:polygon(0 0,100% 0,0 100%); height:calc(var(--scale)*1.5rem); width:calc(var(--scale)*1.5rem); left:0; top:0; position:absolute }
.instruction_main img{ clip-path:polygon(calc(var(--scale)*2.5rem) 0,100% 0,100% 100%,0 100%,0 calc(var(--scale)*2.5rem)); position:absolute; width:100% }
```

**图片被切掉左上角一个 2.5rem 的三角，同一位置放一个 1.5rem 的白色三角 `:after` 做标记**，是典型的「HUD 取景框」语言。全站 `object-fit` 只在华为侧用到一次（B.1.5）。

---

# B 节 · career.huawei.com/cn

架构：服务端只吐 `<section id="vue_雪花ID"></section>` 空壳，真正 DOM 由运行时 Vue 注入；组件经 `require.js`（AMD）按 `window.$aioList` 清单加载，每个组件有独立 CSS（`https://career.huawei.com/-/media/<组件>/<版本>/pc/index.css`）。**页面内嵌的 14 个 `comData_*` JSON 块是唯一服务端吐出的真实数据，也是本次研究最有价值的证据。**

`$aioList`（14 项）：`commonHeader`、`multiPage-search`、`homePage-videoAndImageBanner`、`homePage-dareToBeFirst`、`homePage-jobClassification`、`homePage-internetEverything`、`homePage-talentProgram`、`home-youngPeople`、`homePage-staffActivity`、`home-news`、`commonFooter`、`inquiryAssistant`、`cookiePage-cookieSetting`、`AIAssistant`——各自带独立版本号（如 `homePage-videoAndImageBanner/1.0.1.20260710192726`、`commonHeader/1.0.1.20260812224639`）。

## B.1 内容轮播/切换模块：**有，且有 6 处**

| # | 模块 | 类型 | 数据规模 | 出处 |
|---|---|---|---|---|
| 1 | `videoAndImageBanner` | 主视觉轮播（视频+图片） | `videoList` 1 条、`imgList` 0 条 | block 3 |
| 2 | `dareToBeFirst` | 图文轮播 | `introduceList` 4 条 | block 4 |
| 3 | `jobClassification` | **部门/岗位分类切换（点击式，无箭头无指示点）** | `classificationList` 6 条 | block 5 |
| 4 | `internetEverything` | **部门 Tab 切换 + Swiper** | `tabList` 6 个部门 | block 6 |
| 5 | `talentProgram` | 卡片轮播 | `cardList` 3 条 | block 7 |
| 6 | `staffActivity` | 图片轮播 | `bannerData.imgList` 5 条 | block 9 |

1/2/5/6 是真自动轮播，3 是点击切换的分类卡，4 是 Tab + Swiper 联动。

### B.1.1 主视觉轮播：结构完全由 JSON 定义（block 3 原文照抄）

```json
{ "isAutoPlaySmallVideo": true, "swipeable": true, "arrow": "hover", "autoplay": false,
  "height": "1002px", "mobileHeight": "600px", "flatHeight": "800px",
  "interval": 3000, "loop": true, "showSmallVideoBtn": true, "showSlideDown": false,
  "slideDownText": "向下滑动", "trigger": "hover", "type": "horizontal", "indicatorPosition": "inside",
  "videoList": [{ "bigVideoUrl": "https://career.huawei.com/dam/asset/view/d6d2fc52782f46fa8609454d9397cd30.mp4",
                  "smallVideoUrl": "…/d6d2fc52782f46fa8609454d9397cd30.mp4", "mobileImgUrl": "…/fbae603d2da54faaa1bdd2b6c8ec6639.jpg",
                  "playIcon": "…/e8f58fa703eb42b9859c8bb67fbea918.png", "title": "" }],
  "isShowImgTitle": false, "titleFontSize": "44", "mobileTitleFontSize": 0, "leftPosition": 0,
  "isCustomizeTopPostion": false, "topPosition": 0, "flatTopPosition": 0, "mobileTopPosition": 0, "imgList": [] }
```

这本身就是一份轮播参数设计说明书：`arrow:"hover"`（箭头默认隐藏、hover 才现）、`autoplay:false`（主 Banner 不自动播放）、`trigger:"hover"`、`type:"horizontal"`（横向位移，非淡入淡出）、`indicatorPosition:"inside"`（指示点在 Banner 内部）、`swipeable:true`、`titleFontSize:"44"`。

### B.1.2 DOM 与类名线索（由 CSS 选择器推出，**DOM 本身未核实**）

类名出现次数（`homePage-videoAndImageBanner.pc.css`）：`.aui-carousel` ×51、`.aui-carousel-ul-body` ×28、`.slide-down-container` ×25、`.aui-carousel-list`/`.aui-carousel-block` ×18、`.carousel-item-box` ×17、`.aui-carousel-label` ×15、`.aui-carousel-button` ×14、`.img-title` ×13、`.carousel-video-content` ×11、`.mouse-icon` ×10、`.vertical` ×8、`.aui-icon-width`/`.active-label` ×6、`.split-line`/`.mouse-roller`/`.title`/`.slide-text` ×5、`.outside`/`.carousel-item-img`/`.play-icon`/`.aui-carousel-item` ×4、`.has-label`/`.carousel-small-video`/`.custom-top-position`/`.light`/`.have-left-position` ×3、`.aui-carousel-item-title`/`.aui-left-button`/`.aui-right-button` ×2。

推断层级（`→` 表示 CSS 后代关系）：

```
.hcomponent-career-homePage-videoAndImageBanner
└─ .aui-carousel  （可带 .vertical/.outside/.light/.has-label/.show-title）
   ├─ .aui-carousel-block  (overflow:hidden; position:relative; height:100%;
   │                        border-radius:.25rem / var(--aui-borderRadius-carousel,.25rem))
   │   ├─ .aui-carousel-button.aui-left-button / .aui-right-button
   │   ├─ .aui-carousel-item → .aui-carousel-item-title → .aui-carousel-item-title-span
   │   └─ .carousel-item-box → .carousel-item-img | .carousel-small-video(<video>)
   │                          + .img-title(+ .custom-top-position/.have-link/.have-left-position)
   │                          + .carousel-video-content → .title + .play-icon
   │                          + .slide-down-container → .mouse-icon>.mouse-roller + .split-line + .slide-text
   └─ .aui-carousel-ul-body (<ul>) → .aui-carousel-list (<li>) → .aui-carousel-label (+ .active-label)
```

指示点是 `<ul><li>` 结构（由 `list-style-type:none; display:flex` 与 `.aui-carousel-list{cursor:pointer;padding:0}` 确证）。

### B.1.3 箭头（实抓）

```css
/* 组件库默认（data-v-cbd6460b） */
.aui-carousel .aui-carousel-block .aui-carousel-button{ position:absolute; border-style:none; outline-width:0; padding:0; margin:0;
  height:2rem; height:var(--aui-spacing-8, 2rem); width:2rem; width:var(--aui-spacing-8, 2rem); cursor:pointer; z-index:3;
  border-radius:126rem; background-color:#f3f3f3; background-color:var(--aui-color-bg-3, #f3f3f3);
  color:#fff; text-align:center; font-size:.75rem; font-size:var(--aui-fontSize-xs, .75rem); display:flex; align-items:center; justify-content:center }
.aui-carousel .aui-carousel-block .aui-carousel-button:hover,
.aui-carousel .aui-carousel-block .aui-carousel-button:active{ background-color:rgba(25,25,25,.3); background-color:var(--aui-color-bg-7, rgba(25,25,25,.3)) }
.aui-carousel .aui-carousel-block .aui-carousel-button .aui-left-icon{ width:1.125rem; height:1.125rem; opacity:.5; color:#191919 }
.aui-carousel:not(.vertical) .aui-left-button { left:1rem; top:50%; transform:translateY(-50%) }
.aui-carousel:not(.vertical) .aui-right-button{ right:1rem; top:50%; transform:translateY(-50%) }
.aui-carousel.vertical .aui-left-button { top:1rem; left:50% }
.aui-carousel.vertical .aui-right-button{ top:auto; left:50%; bottom:1rem }
/* 业务层覆盖 */
… .aui-carousel-button{ height:64px !important; width:64px !important; background:rgba(25,25,25,0.15) }
… .aui-carousel-button .aui-icon-width{ width:24px !important; height:24px !important; color:#fff; opacity:1 }
… .aui-carousel-ul-body{ bottom:1.7rem !important }
@media (min-width:768px) and (max-width:1023px){ … .aui-carousel-button{ height:28px !important; width:28px !important; background:rgba(25,25,25,0.3) } … .aui-icon-width{ width:12px !important; height:12px !important } }
```

**桌面：箭头 64×64px、`rgba(25,25,25,.15)` 半透底、白色 24px 图标、`opacity:1`；平板：28×28px、`rgba(25,25,25,.3)`、12px 图标。`border-radius:126rem`（=2016px）是 aui 系统实现胶囊/圆形的统一写法，不用 `50%`。**

### B.1.4 指示点（实抓）

```css
.aui-carousel .aui-carousel-ul-body{ padding:0 .25rem; justify-content:center; align-items:center; list-style-type:none; display:flex; z-index:2; margin:0; width:100%; height:.25rem; left:0; bottom:1rem }
/* 源码笔误：padding-left:var(--aui-spacing-1, a .25rem)，多一个 "a "，原样存在 */
.aui-carousel .aui-carousel-ul-body .aui-carousel-list{ cursor:pointer; padding:0 }
.aui-carousel .aui-carousel-ul-body .aui-carousel-list .aui-carousel-label{ display:block; border-style:none; outline-width:0; padding:0; margin:0; cursor:pointer; border-radius:.125rem; background-color:hsla(0,0%,95%,.5) }
.aui-carousel .aui-carousel-ul-body .aui-carousel-list .aui-carousel-label:hover{ background-color:rgba(238,243,254,.5) }
.aui-carousel:not(.vertical) .aui-carousel-ul-body .aui-carousel-list{ display:inline-block; height:.25rem; padding:0; margin:0 .375rem 0 0 }
.aui-carousel:not(.vertical) … .aui-carousel-label{ height:.25rem; width:.25rem }             /* 4×4px */
.aui-carousel:not(.vertical) … .aui-carousel-label.active-label{ width:1rem; height:.25rem }   /* 16×4px 横条 */
.aui-carousel.outside .aui-carousel-ul-body{ position:static; margin-top:.5rem }
.aui-carousel.outside … .aui-carousel-label{ background-color:#f3f3f3 }
.aui-carousel.outside … .aui-carousel-label:hover, .aui-carousel.outside … .active-label{ background-color:#0067d1 }
.aui-carousel.has-label .aui-carousel-ul-body{ left:0; right:0; text-align:center; transform:none }
.aui-carousel.has-label … .aui-carousel-list{ padding:.375rem .25rem }
.aui-carousel.has-label … .aui-carousel-label{ padding:.125rem 1.125rem; font-size:.75rem }
.aui-carousel.vertical .aui-carousel-ul-body{ flex-direction:column; left:1rem; bottom:0; transform:none; width:.25rem; height:100%; padding:.25rem 0 }
.aui-carousel.vertical … .aui-carousel-list{ display:block; height:auto; margin:0 0 .375rem -.375rem }
.aui-carousel.vertical … .aui-carousel-label{ height:.25rem; width:.25rem }
.aui-carousel.vertical … .aui-carousel-label.active-label{ height:1rem; width:.25rem }
.aui-carousel.light … .aui-carousel-label{ background-color:#f3f3f3 }
.aui-carousel.light … .aui-carousel-label:hover, .aui-carousel.light … .active-label{ background-color:#0067d1 }
.aui-carousel:not(.light) … .aui-carousel-label.active-label{ background-color:#fff }
```

**「点 → 短横条」：`width` 4px → 16px，`height` 不变 4px，点间距 `margin-right:.375rem`（6px）。但该选择器无 `transition`——指示点宽度变化是瞬时的。** `.light`（浅底）激活是品牌蓝 `#0067d1`，`:not(.light)`（深底）激活是纯白 `#fff`；首页是深色视频底，用白点。

### B.1.5 滑块定位与切换动画定义（最值钱的一段）

```css
.aui-carousel-item{ position:absolute; top:0; left:0; width:100%; height:200px; display:inline-block; overflow:hidden }
.aui-carousel-item .aui-carousel-item-title{ position:absolute; bottom:0; width:100%; height:1.5rem; text-align:left; color:#fff; line-height:1.5rem; background-color:#aeaeae }
.aui-carousel-item .aui-carousel-item-title .aui-carousel-item-title-span{ padding:0 .75rem; font-size:.75rem; width:80%; display:inline-block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap }
.aui-carousel-item img{ -webkit-user-drag:none; -moz-user-select:none; user-select:none }
.is-hover   { opacity:.1 }        /* 非激活滑块 */
.is-card    { width:50%; transition-property:transform; transition-duration:.3s; transition-timing-function:cubic-bezier(.4,0,.2,1) }
.is-animate { transition-property:transform; transition-duration:.3s; transition-timing-function:cubic-bezier(.4,0,.2,1) }
.is-inStage { cursor:pointer; z-index:1 }
.is-active  { z-index:2 }
```

**`transition-property:transform`（不是 opacity）、`.3s`、`cubic-bezier(.4,0,.2,1)`**——切换是位移，非淡入淡出、非缩放。

## B.2 自动播放行为

### B.2.1 间隔：**两套参数，5000ms 是主流**

| 模块 | `autoplay` | `interval` | `loop` | 出处 |
|---|---|---|---|---|
| `dareToBeFirst` | `true` | **`5000`** | `true` | block 4 |
| `talentProgram` | `true` | **`5000`** | `true` | block 7 |
| `staffActivity` | `true` | **未核实**（块末尾被空行截断） | 未核实 | block 9 |
| `videoAndImageBanner` | **`false`** | `3000` | `true` | block 3 |

字段名源码拼写为 `carousleData`（多一个 `s`、少一个 `o`），原样存在。**3 个真自动轮播间隔均为 5s；主 Banner 明确关闭自动播放，`interval:3000` 是未生效的配置残留。**

### B.2.2 hover 是否暂停：**未核实**

11 个组件 CSS 里**没有** `animation-play-state:paused`、没有 `.swiper-pause`/`.is-paused`/`[data-paused]`；组件 CSS 里也**没有任何轮播 keyframes**——CSS 层面「无处可暂停」。若存在只能在运行时 AMD 模块 JS 里，而 JS 未抓取。**结论：未核实，倾向未实现但无法证实。** `arrow:"hover"` 与 `trigger:"hover"` 说明 hover 至少控制箭头显隐与切换触发方式。

### B.2.3 切换动画：**位移 + 非激活态压暗**

四条证据链：(1) **`type:"horizontal"`**（block 3 JSON）；(2) **Swiper 库存在且版本可辨**——`homePage-internetEverything.pc.css` 第 586 行有注释头 `* Most modern mobile touch slider and framework with hardware accelerated transitions`，`dareToBeFirst`/`talentProgram`/`staffActivity` 的 CSS 带 `* https://swiperjs.com` / `* Copyright 2014-2021 Vladimir Kharlampidi` / `* Released under the MIT License`，**`2014-2021` 对应 Swiper 6/7 一系**；(3) 业务层 `.is-animate`/`.is-card` 给出 `transform .3s cubic-bezier(.4,0,.2,1)`；(4) `.is-hover{opacity:.1}`。实抓的 Swiper 核心：

```css
.swiper-wrapper{ position:relative; width:100%; height:100%; z-index:1; display:flex; transition-property:transform; box-sizing:content-box }
.swiper-android .swiper-slide,.swiper-wrapper{ transform:translate3d(0px,0,0) }   /* 强制 GPU 层 */
.swiper-slide{ flex-shrink:0; width:100%; height:100%; position:relative; transition-property:transform }
.swiper-3d,.swiper-3d.swiper-css-mode .swiper-wrapper{ perspective:1200px }
.swiper-3d .swiper-slide,…{ transform-style:preserve-3d }
.swiper-3d .swiper-slide-shadow{ background:rgba(0,0,0,.15) }
.swiper-3d .swiper-slide-shadow-left { background-image:linear-gradient(to left,  rgba(0,0,0,.5),rgba(0,0,0,0)) }
.swiper-3d .swiper-slide-shadow-right{ background-image:linear-gradient(to right, rgba(0,0,0,.5),rgba(0,0,0,0)) }
.swiper-3d .swiper-slide-shadow-top  { background-image:linear-gradient(to top,   rgba(0,0,0,.5),rgba(0,0,0,0)) }
.swiper-3d .swiper-slide-shadow-bottom{background-image:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0)) }
.swiper-css-mode>.swiper-wrapper{ overflow:auto; scrollbar-width:none }
.swiper-horizontal.swiper-css-mode>.swiper-wrapper{ scroll-snap-type:x mandatory }
```

**结论：`transform` 位移（`.3s`，`cubic-bezier(.4,0,.2,1)`）+ 非激活态 `opacity:.1`，无 crossfade、无 scale。** Swiper 实例的 `speed` 参数**未核实**（从 CSS `.3s` 与 Swiper 默认 300ms 推得，未读运行时配置）。

### B.2.4 进度条/指示器动画：**没有进度条；指示点宽度变化无过渡**

全站零 `progress`（只命中 `aui-modal` 内部的 `progress`，与轮播无关）；自动播放期间没有任何倒计时视觉（无 `conic-gradient`，无 width 动画）。`homePage-videoAndImageBanner.pc.css` 的**全部 `transition` 声明只有 6 处**，逐条为 `×2 transition-property:transform`、`×2 transition-duration:.3s`、`×2 transition-timing-function:cubic-bezier(.4,0,.2,1)`，且**零 `@keyframes`、零 `animation`**——横幅滑动完全由 `transform` + 内联样式承担。

`@keyframes` 统计（11 个组件 PC 端）：`videoAndImageBanner` **0**、`commonHeader` **0/0/0**（transition/animation 全 0）、`dareToBeFirst` 0、`internetEverything` 0、`staffActivity` 0、`talentProgram` 0、`home-news` 1、`home-youngPeople` 1、`jobClassification` 13、`commonFooter` 14、`multiPage-search` 15——后三者几乎全部来自 aui 设计系统（`aui-fade-in-*`、`aui-slide-up-enter-*` 等），非业务动画。

### B.2.5 Tab 切换模块（`internetEverything`）

```css
.tab-content .tab-item{ flex:0 0; border-bottom:2px solid #f5f5f5 }   /* 基础：与背景同色的假底线 */
.tab-content .tab-item .title{ cursor:pointer; color:#191919; font-weight:400; white-space:nowrap }
.tab-content .tab-item .title-isActive{ color:#c7000b }
.tab-content .tab-item-isActive{ border-bottom:2px solid #c7000b }
```

**用「同宽同色的假底线」避免激活时加边框导致内容上移 2px——很实用的技巧。** 切换过程**无过渡动画**（原站即时切换）。≥1024px 断点精确值：`.title-content{height:80px; max-width:1600px; margin:0 auto 48px}`；`.title{font-size:44px; line-height:68px; padding-bottom:10px}`；`.tab-content{gap:80px}`；`.tab-item{height:38px; padding-bottom:8px}`；`.tab-item .title{font-size:20px; line-height:28px}`；`.main-content{margin:48px 0; padding-top:20px}`；`.img-content{width:70.1%; max-width:1334px; z-index:2}`；`.department-img{width:100%; height:510px}`（≥1920px 为 `538px`）；`.top-red-background{width:68%; height:20px}`（≥1920px `max-width:1294px`）；`.introduce-content{width:647px; height:324px; bottom:93px; padding:40px; border-radius:12px; backdrop-filter:blur(50px); background:#fff}`；`.introduce-title{font-size:24px; line-height:32px; margin-bottom:16px}`；`.introduce-text{font-size:16px; line-height:28px; color:#666}`；`.more-button{height:48px; padding:12px 24px; font-size:16px; line-height:24px}`；区块本身 `{margin:192px auto; padding:96px 0; background:#f5f5f5}`。

**注意：`.introduce-content` 的 `background:#fff` 是 100% 不透明的，所以 `backdrop-filter:blur(50px)` 在当前配置下不产生可见玻璃效果**（要生效需改成 `rgba(255,255,255,.72)`）——这是原实现的一个实际缺陷。

## B.3 数字与成果展示

### B.3.1 关键数字在哪（实测）

| 数字 | 出处 | 上下文（原文） |
|---|---|---|
| `170多个国家和地区` / `30多亿人口` | block 4 `introduceList[0].introduce` | 「公司业务遍及170多个国家和地区，服务全球30多亿人口」 |
| `三十多年` | block 4 `introduceList[1]` | 「华为坚持长期主义，三十多年的研发投入…」 |
| `3MS` / `6,000+首席专家` / `10+万工程师` / `数万门在线课程` | block 7 `cardList[2]` | 「可以在稼先社区里与6,000+首席专家们和10+万工程师一起点燃思想的火花」 |

**关键发现 1：`170` 与 `30亿` 是埋在正文段落里的行内数字，不是独立大字号数据卡——华为首页并没有做大数字展示区。**

**关键发现 2：`jobClassification` 在 CSS 里预留了数字位（`.job-classification-item-number`），但首页 6 个分类数据的 `totalNum`/`numLeftText`/`numRightText` 全部为空字符串**，所以实际不渲染任何数字：

```json
{"title":"研发","titleEn":"R&D","showMore":"false","backgroundUrl":"…","mobileBackgroundUrl":"…",
 "totalNum":"","numLeftText":"","numRightText":""}
```

### B.3.2 「大数字 + 单位 + 标签」的实际排版规律

数字位与标签位是**分离排版**的：`.job-classfication-item-hover .job-classification-item-number{ color:#ffffff; font-weight:400; letter-spacing:0%; text-align:center }`。

| 元素 | 字号（≥1775px） | 字重 | 颜色 | 行高 | 间距 |
|---|---|---|---|---|---|
| 中文标签 `.job-classification-item-title` | **`32px`** | **`700`** | 默认 `#000000` / 激活 `#ffffff` | `40px` | — |
| 英文标签 `.job-classification-item-titleEn` | **`20px`** | **`400`** | 同上 | `28px` | `margin-top:8px` |
| 数字 `.job-classification-item-number` | CSS 未给（继承） | **`400`** | `#ffffff` | 继承 | — |
| 链接项 `.job-classification-item-link-item` | **`14px`** | **`700`** | `#f5f5f5` | `22px` | `margin:0 24px 0 0` |

**中英字号比 32:20 = 1.6；中英字重对比 700:400；英文是注释行 `margin-top:8px`；数字特意用 `font-weight:400`（比中文标签 700 细），说明设计意图是「数字作背景信息，不抢标题」。**

响应式字号阶梯（4 档，完整）：

| 断点 | 中文 title | titleEn | 链接项 | 标题区 |
|---|---|---|---|---|
| 768–1024 | `15px/lh21` | `12px/lh18/mt4` | `12px/lh20/margin 0 0 11px 0` | `20px/lh26` |
| 1024–1440 | `20px/lh28` | `12px/lh20/mt8` | `12px/lh20/margin 0 15px 0 0` | `26px/lh34` |
| 1440–1775 | `26px/lh34` | `16px/lh28/mt8` | `12px/lh20/margin 0 20px 0 0` | `36px/lh54` |
| ≥1775 | `32px/lh40` | `20px/lh28/mt8` | `14px/lh22/margin 0 24px 0 0` | `44px/lh68` |

行高比很稳定：title `1.400/1.400/1.308/1.250`；titleEn `1.500/1.667/1.750/1.400`；标题区 `1.300/1.308/1.500/1.545`。**中文标题始终取 1.25–1.4 的紧行高。** 新闻日期用 **ISO 破折号格式**（`2026-10-12`、`2026-09-29`、`2026-09-24`、`2026-09-24`），不是 `2026年9月29日`——在中文字体里保持数字对齐观感。

### B.3.3 是否等宽字体：**否**

`common.min.css` 全文只有两条 `font-family`：

```css
font-family: swiper-icons      /* Swiper 图标字体，与正文无关；base64 woff 内嵌 */
font-family: Huawei Sans, HarmonyOS_Sans, Microsoft YaHei, Arial, Helvetica, sans-serif
```

**没有 `monospace`、没有 Menlo/Consolas/SF Mono、没有任何等宽字体。** 字体策略：`Huawei Sans`（自有）→ `HarmonyOS_Sans`（**下划线命名**，不是空格）→ `Microsoft YaHei` → `Arial, Helvetica, sans-serif`。**零 webfont 加载，纯系统字体优先级，非常适合零依赖静态站直接抄。** 唯一例外：`.carousel-video-content .title{ font-family:Microsoft YaHei }`——Banner 的 64px 大标题单独指定，这是「业务要求与设计系统不一致」的痕迹。

### B.3.4 是否滚动计数：**没有**

11 个组件 PC 端 CSS 里没有任何与计数相关的 `@keyframes`（唯一业务 keyframes 是 `spin`，用于加载旋转图标）；也没有 `.counter`/`.number-roll`/`.odometer` 之类选择器；JSON 里也**没有**「目标值 + 单位」的独立字段。**未核实：** 若实现在 JS 里我无法排除，所以严格说是「CSS 与数据层均无迹象，倾向不存在」。**品牌色与色板**：`jobClassification` 模块 CSS 的 hex 频次为 `#fff`/`#ffffff` **15 次**、`#c7000b` **5 次**（**华为招聘品牌红**：激活下划线、标题下划线、Tab 激活色）、`#191919` **3 次**（主文字色）、`#000000` 2 次、`#f5f5f5` 1 次。aui token 侧：`#0067d1`（品牌蓝，轮播指示点）、`#666666`、`#dfdfdf`、`#aeaeae`、`#e02128`、`#09aa71`、`#d19f00`、`#2070f3`。**品牌色有两个（`#c7000b` 业务红 与 `#0067d1` aui 蓝）并存不统一。** aui token 实测值：`--aui-duration-base: .3s`、`--aui-ease-out: ease-out`、`--aui-ease-in: ease-in`、`--aui-popup-transition: var(--aui-duration-base)`。

## B.4 卡片与按钮

### B.4.1 圆角阶梯

| 组件 | `border-radius` 值分布 |
|---|---|
| `dareToBeFirst` | `12px`×4、`4px`×3、`1rem`×1 |
| `talentProgram` | `12px`×3、`4px`×2、`6px`×2、`0 0 12px 12px`×1 |
| `internetEverything` | `12px`（卡）、`6px`（按钮） |
| `jobClassification` | `6px`×3、`.25rem`×2、`.5rem`×2、`126rem` |
| `staffActivity` | **`100px`×11**、`12px`×2、`6px`×2、`4px`×2 |
| `home-news` | `6px`×6、`12px`×5、`5.5px`×1、`.25rem`、`126rem` |

**阶梯 = `4px`（小标签）/ `6px`（按钮）/ `12px`（卡片）/ `0 0 12px 12px`（图片下挂内容卡）/ `100px`+`126rem`（胶囊、圆形、头像）。** 阴影只有一处非 aui 业务值与一条 aui 系统值：

```css
box-shadow: 0px 2px 16px 0px rgba(0,0,0,0.07843);   /* 业务；0.07843 ≈ 20/255，是设计稿 #00000014 转出来的残留 */
box-shadow: 1px 4px 12px 0px rgba(0,0,0,.16);       /* --aui-boxShadow-md */
```

卡片 hover 过渡只抓到一条完整三元组（`home-news`）：`transition-property:all; transition-duration:.3s; transition-delay:0ms`——**`transition:all .3s` 在必须动 `transform` 时应改成 `transform`，否则会触发非合成属性。**

### B.4.2 按钮：`more-button` 完整规格（最有价值的一处）

```css
/* internetEverything ≥1024px */
.learn-more{ display:flex; justify-content:center; align-items:center; height:48px }
.learn-more .more-button{ cursor:pointer; box-sizing:border-box; border:1px solid #191919; border-radius:6px;
  color:#191919; font-weight:400; text-align:left; height:48px; padding:12px 24px 12px 24px; font-size:16px; line-height:24px }
```

**幽灵按钮：1px `#191919` 描边 + 无填充 + 同色文字 + 6px 圆角。** 响应式四档（`jobClassification`）：

| 断点 | `font-size` | `line-height` | `height` | `padding` | `radius` |
|---|---|---|---|---|---|
| 768–1024 | `14px` | `22px` | `32px` | `5px 16px` | `6px` |
| 1024–1440 | `14px` | `22px` | `40px` | `9px 20px` | `6px` |
| 1440–1775 | `14px` | `22px` | `40px` | `9px 20px` | `6px` |
| ≥1775 | **`16px`** | **`24px`** | **`48px`** | **`12px 24px`** | `6px` |

**`height` 恒等于 `line-height + 2×垂直 padding`：`22+5×2=32`、`22+9×2=40`、`24+12×2=48`。这条自洽关系保证中英文混排时按钮高度不跳动，非常值得抄。** 移动端则去掉 `height`，靠 `padding:9px 20px` + `display:flex` 撑开。aui 弹窗按钮走 `rem`：`--aui-popover-action-width:8rem`、`--aui-popover-action-height:2.75rem`（=44px，满足 44×44 触控目标）、`--aui-popover-action-font-size:.875rem`、`--aui-popover-radius:.5rem`、`--aui-popover-horizontal-action-height:34px`。**设计系统全 `rem` + 变量带 fallback（`var(--aui-spacing-4, 1rem)`），业务层全 `px` 硬编码——两套单位混用是长期演进的结果，自己的项目应统一。**

### B.4.3 Hover 态：**数量极少**

穷举 11 个组件 PC 端 CSS 的 `:hover`：`videoAndImageBanner` 有 `.aui-carousel-button:hover{background-color:rgba(25,25,25,.3)}` 与 `.aui-carousel-label:hover{background-color:rgba(238,243,254,.5)}`；`jobClassification` 有同一组 aui 规则；**`internetEverything`、`talentProgram`、`dareToBeFirst`、`staffActivity`、`home-news`、`home-youngPeople`、`commonHeader` 的业务 hover 规则数均为 0。**

**结论（而不是推测）：华为这个站的按钮与卡片几乎完全没有 hover 反馈——只有 `cursor:pointer`。** 唯一有视觉 hover 的是轮播箭头（底色透明度 `.15 → .3`，且**该规则无 `transition`，是瞬变**）与指示点。另外 `jobClassification` 的「hover」是**点击激活态**而非 CSS `:hover`：两层同时存在，靠 z-index 切换：

```css
.job-classification-main{ width:100%; background-size:cover; display:flex; margin:48px 0; height:740px } /*1440-1775*/
.job-classification-main{ margin:48px 0; height:800px }   /* ≥1775px */
.job-classification-main{ margin:22px 0; height:600px }   /* 768-1024px */
.job-classification-main .job-classification-item{ flex:1; position:relative }   /* 6 等分 */
.job-classification-main .job-classification-item .job-classfication-item-nomal{ width:100%; height:100%; position:absolute; z-index:0; display:flex; flex-direction:column; justify-content:center; align-items:center }
.job-classification-main .job-classification-item .job-classfication-item-hover{ width:100%; height:100%; position:absolute; z-index:1; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#fff; background-size:cover }
```

**注意源码线上真实存在的类名错拼：`job-classfication-item-nomal`（`classfication` 少 `i`、`nomal` 少 `r`）**，原样照抄以证明是实抓。

### B.4.4 边框与分隔线

| 用途 | 声明 | 来源 |
|---|---|---|
| 幽灵按钮边框 | `border:1px solid #191919` | `internetEverything`/`jobClassification` |
| Tab 假底线 → 激活底线 | `border-bottom:2px solid #f5f5f5` → `2px solid #c7000b` | `internetEverything` |
| 英文版标题红下划线 | `border:1px solid #c7000b; width:var(--en-underline-length); height:0` | `jobClassification` |
| 弹窗标题分隔 | `border-bottom:1px solid #dfdfdf` | 同上（popover） |
| CSS 画的链接箭头 | `width:7px; height:7px; border-top:1px solid #fff; border-right:1px solid #fff; transform:rotate(45deg)` | 同上（移动端 `9px`） |
| 轮播箭头图标 | `24px`（桌面）/ `12px`（平板），`color:#fff` | `videoAndImageBanner` |

### B.4.5 Header

`commonHeader.pc.css` 的 `transition`/`animation`/`@keyframes` **全部为 0**——顶部导航完全静态，无滚动吸顶动画、无下划线滑出、无下拉过渡。导航项（block 1 `navList` 原文）：挑战课题专项招聘→`/cn/young-genius`、校园招聘→`/cn/campus-recruitment`、社会招聘→`/cn/social-recruitment`、博士后→`/cn/postdoctoral-researcher`、走进华为→`/cn/entering-huawei`、成长与生活→`/cn/growth-and-life`。语言列表 5 项，其中 3 项外链 `/reccampportal/jp/index.html`、`/la/index.html`、`/euportal/portal/index.html`。**header 的具体高度/字号未逐条提取**。

---

# C 节 · 可以直接照抄的 8 个配方

**统一约束：** 纯原生 HTML/CSS/JS，零框架零构建；**只动 `transform`/`opacity`/`filter`**（例外处标注）；每条带 `@media (prefers-reduced-motion: reduce)`。

> **诚实说明：两个站都没有处理 `prefers-reduced-motion`。** cosmicbroth 的 `Bx70QQQb.js`、`CxtPVY3G.js` 命中数为 **0**；华为 11 个组件 CSS 命中数也为 **0**。下面的兜底是我补的，属「基于实测数值的改进方案」，不是照抄。

## 配方 1 · 三条核心缓动 + 通用揭示动画

来源：`Bx70QQQb.js` 的 `CustomEase` 三条 path 与内联 `--ease_*` 变量（数值照抄）。改动：加 `prefers-reduced-motion`；用 `IntersectionObserver` 触发（原站无滚动文档流）。**价值全在缓动：`cubic-bezier(.2,.9,.45,1)` 的「前 20% 走 90%」让元素「啪」地到位再极慢收尾，用于 `clip-path` 尤其明显。**

```html
<style>
:root{ --ease_in:cubic-bezier(.6,0,.8,.4); --ease_out:cubic-bezier(.2,.9,.45,1); --ease_inout:cubic-bezier(.7,0,.3,1); --ink:#000013; --paper:#f3f3f3 }
body{ background:var(--ink); color:var(--paper); margin:0 }
.reveal{ clip-path:polygon(0 0,0 0,0 100%,0 100%); transition:clip-path 1s var(--ease_out) }        /* 照抄 .wsi_title 的 1s */
.reveal.is-in{ clip-path:polygon(0 0,100% 0,100% 100%,0 100%) }
.rise{ opacity:0; transform:translateY(1.5rem); transition:opacity .8s var(--ease_out) .1s, transform .8s var(--ease_out) .1s }
.rise.is-in{ opacity:1; transform:translateY(0) }                                                    /* 照抄 .8s + 延迟 .1s */
.pop{ opacity:0; transform:scale(0); transition:opacity .5s var(--ease_out) 1.2s, transform .5s var(--ease_out) 1.2s }
.pop.is-in{ opacity:1; transform:scale(1) }                                                          /* 照抄 .5s + 延迟 1.2s */
@media (prefers-reduced-motion: reduce){ .reveal,.rise,.pop{ transition:none !important; clip-path:none !important; opacity:1 !important; transform:none !important } }
</style>
<div class="reveal">标题从左擦出</div><p class="rise">正文上浮</p><div class="pop">图形弹出</div>
<script>
(function(){
  var els=document.querySelectorAll('.reveal,.rise,.pop');
  if (!('IntersectionObserver' in window)){ els.forEach(function(el){ el.classList.add('is-in') }); return; }  // 兜底
  var io=new IntersectionObserver(function(en){
    en.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target) } });
  }, { rootMargin:'0px 0px -10% 0px', threshold:.1 });
  els.forEach(function(el){ io.observe(el) });
})();
</script>
```

## 配方 2 · 拖拽平移视差 + canvas 星场

来源：`CxtPVY3G.js` 的 `bind_container_events()`/`move()`/`resize()`/星场模块；灵敏度 `500`、视差比 `0.8`、500 颗星与 4 条尺寸公式全部照抄。改动：用 `requestAnimationFrame` 线性插值替代 GSAP。**`touch-action:none` + `touchmove` 里 `preventDefault()` 是移动端可拖拽的必要条件；`inset:-25%` 即 `width/height:150%`。**

```html
<style>
html,body{ height:100%; margin:0; overflow:hidden; background:#000013 }
.stage{ position:relative; width:100%; height:100dvh; overflow:hidden; cursor:grab; touch-action:none; -webkit-user-select:none; user-select:none }
.stage.is-dragging{ cursor:grabbing }
.layer{ position:absolute; inset:-25%; display:flex; align-items:center; justify-content:center; will-change:transform }   /* = 150%，给 ±25% 余量 */
.layer--bg img{ width:100%; height:auto; opacity:.8 } .layer--stars{ pointer-events:none }   /* 照抄 opacity:.8 */
canvas{ position:absolute; inset:0; width:100%; height:100% }
@media (prefers-reduced-motion: reduce){ .layer{ will-change:auto } }
</style>
<div class="stage" id="stage">
  <div class="layer layer--bg" id="lyBg"><img src="bg.jpg" alt=""></div>
  <div class="layer layer--stars" id="lyStars"><canvas id="cv"></canvas></div>
</div>
<script>
(function(){
  var stage=document.getElementById('stage'), lyBg=document.getElementById('lyBg'), lyStars=document.getElementById('lyStars'),
      cv=document.getElementById('cv'), ctx=cv.getContext('2d');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, SENS=500;      /* 照抄灵敏度 */
  var stars=[],W=0,H=0,dpr=Math.min(devicePixelRatio||1,2);
  function resizeCanvas(){
    W=cv.width=Math.floor(innerWidth*dpr); H=cv.height=Math.floor(innerHeight*dpr);
    cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px';
    var maxR=(innerWidth+innerHeight)/2000*dpr, minR=maxR/5;        /* 照抄 2e3 与 /5 */
    var maxS=(innerWidth+innerHeight)/8000*dpr, minS=maxS/10;       /* 照抄 8e3 与 /10 */
    stars=[];
    for (var i=0;i<500;i++){ stars.push({ x:Math.random()*W, y:Math.random()*H, sx:Math.random()*(maxS-minS)+minS, sy:Math.random()*(maxS-minS)+minS,
      dx:Math.random()>.5?-1:1, dy:Math.random()>.5?-1:1, r:Math.random()*(maxR-minR)+minR, a:Math.random() }); }   /* total_stars:500 / alpha */
  }
  function drawStars(){ ctx.clearRect(0,0,W,H);
    for (var i=0;i<stars.length;i++){ var s=stars[i];
      s.x+=s.sx*s.dx; s.y+=s.sy*s.dy; s.a+=(Math.random()-.5)*.2;                            /* 照抄闪烁 */
      if (s.a<0) s.a=0; else if (s.a>1) s.a=1;
      if (s.x<s.r*2||s.x>W+s.r*2) s.dx=-s.dx; if (s.y<s.r*2||s.y>H+s.r*2) s.dy=-s.dy;        /* 照抄反弹 */
      ctx.fillStyle='rgba(255,255,255,'+s.a+')'; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); } }
  var tx=0,ty=0,cx=0,cy=0,mx=0,my=0,dragging=false,maxX=0,minX=0,maxY=0,minY=0;
  function bounds(){ var w=lyBg.offsetWidth,h=lyBg.offsetHeight;                             /* 照抄 resize() 边界算法 */
    maxX=(w-innerWidth)/2; minX=(innerWidth-w)/2; maxY=(h-innerHeight)/2; minY=(innerHeight-h)/2; }
  function clamp(){ if (tx>maxX) tx=maxX; else if (tx<minX) tx=minX; if (ty>maxY) ty=maxY; else if (ty<minY) ty=minY; }
  function point(e){ return (e.touches&&e.touches[0]) ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : {x:e.clientX,y:e.clientY}; }
  function onDown(e){ dragging=true; stage.classList.add('is-dragging'); var p=point(e); mx=p.x; my=p.y; }
  function onUp(){ dragging=false; stage.classList.remove('is-dragging'); }
  function onMove(e){ if (!dragging) return; e.preventDefault(); var p=point(e);
    tx+=(p.x-mx)/innerWidth*SENS; ty+=(p.y-my)/innerWidth*SENS; mx=p.x; my=p.y; clamp(); }    /* 照抄公式 */
  function tick(){ cx+=(tx-cx)*.12; cy+=(ty-cy)*.12;                                          /* 0.12 ≈ GSAP duration:1 ease_out */
    lyBg.style.transform='translate3d('+cx+'px,'+cy+'px,0)';
    lyStars.style.transform='translate3d('+(cx*.8)+'px,'+(cy*.8)+'px,0)';                     /* 照抄分层比 0.8 */
    drawStars(); requestAnimationFrame(tick); }
  stage.addEventListener('mousedown',onDown); window.addEventListener('mouseup',onUp); stage.addEventListener('mousemove',onMove);
  stage.addEventListener('touchstart',onDown,{passive:true}); window.addEventListener('touchend',onUp); stage.addEventListener('touchmove',onMove,{passive:false});
  window.addEventListener('resize',function(){ resizeCanvas(); bounds() });
  resizeCanvas(); bounds();
  if (reduce){ stage.style.cursor='default'; drawStars(); } else tick();     // 降级：静态星场
})();
</script>
```

## 配方 3 · 切角面板 + 四角括号 + 脉冲点

来源：`._clip_cross`/`._clip_edge`、`.ueb_block` 覆写值、`.sdb_button_spot div`；**几何点坐标完全照抄**。改动：`calc(var(--scale)*…)` 换 `rem`；加 hover 与 `prefers-reduced-motion`。**`::before{rotateY(-180deg)}` 是心脏：让「只画左边两个角」的 `clip-path` 通过镜像覆盖右边，所以 hover 必须写 `rotateY(-180deg) scale(1.1)`，不能漏掉 `rotateY`。**

```html
<style>
:root{ --paper:#f3f3f3; --ink:#000013; --theme:#178ec5; --ease_out:cubic-bezier(.2,.9,.45,1) }   /* 主题色取"宇宙汤"世界 */
body{ background:var(--ink); color:var(--paper); font-family:system-ui,sans-serif; padding:3rem }
/* ① 十字切角：四边中点各切一个口（12 点，照抄） */
.clip-cross{ --gap_w:.5rem; --gap_h:.5rem; background:#161616; padding:1.5rem;
  clip-path:polygon(0 var(--gap_h), var(--gap_w) var(--gap_h), var(--gap_w) 0, calc(100% - var(--gap_w)) 0, calc(100% - var(--gap_w)) var(--gap_h), 100% var(--gap_h), 100% calc(100% - var(--gap_h)), calc(100% - var(--gap_w)) calc(100% - var(--gap_h)), calc(100% - var(--gap_w)) 100%, var(--gap_w) 100%, var(--gap_w) calc(100% - var(--gap_h)), 0 calc(100% - var(--gap_h))) }
/* ② 四角括号：两个伪元素镜像 */
.clip-edge{ --gap_size:.5rem; --gap_border:1px; --gap_color:var(--paper); position:relative; padding:1.5rem; background:#161616 }
.clip-edge::before,.clip-edge::after{ --gap_size:inherit; content:""; position:absolute; width:100%; height:100%; border:var(--gap_border) solid var(--gap_color); transition:transform .5s var(--ease_out);
  clip-path:polygon(0 0, var(--gap_size) 0, var(--gap_size) var(--gap_size), 0 var(--gap_size), 0 calc(100% - var(--gap_size)), var(--gap_size) calc(100% - var(--gap_size)), var(--gap_size) 100%, 0 100%) }
.clip-edge::before{ transform:rotateY(-180deg) } .clip-edge::after{ transform:none }    /* 镜像出右边两个角 */
@media (hover:hover){ .clip-edge:hover::before{ transform:rotateY(-180deg) scale(1.1) } .clip-edge:hover::after{ transform:scale(1.1) } }
.hud-block{ --gap_size:.6rem; --gap_border:2px; width:2.5rem; height:2.5rem; display:inline-block; margin-right:.5rem }   /* 照抄 .ueb_block 覆写 */
.pulse{ position:relative; width:.8rem; height:.8rem; margin:2rem 0 }                                                    /* 照抄 .sdb_button_spot div */
.pulse i{ position:absolute; inset:0; border:1px solid var(--theme); border-radius:50%; animation:pulse 1s linear infinite }
.pulse i:first-child{ background:var(--theme); animation:none; transition:transform .5s var(--ease_out) }
@keyframes pulse{ 0%{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(3)} }
@media (hover:hover){ .pulse:hover i:first-child{ transform:scale(1.5) } }
@media (prefers-reduced-motion: reduce){ .clip-edge::before,.clip-edge::after{ transition:none } .pulse i{ animation:none; opacity:.3 } }
</style>
<div class="clip-cross">十字切角面板</div>
<div class="clip-edge" style="margin-top:2rem">四角括号面板（hover 四角同步外扩 1.1 倍）
  <span class="hud-block clip-edge"></span><span class="hud-block clip-edge"></span><span class="hud-block clip-edge"></span></div>
<div class="pulse"><i></i><i></i></div>
```

## 配方 4 · 下划线擦出 + 幽灵按钮

来源：下划线照抄 cosmicbroth `.wsi_button_text:after`（`scaleX(0)→scaleX(1)`、`.8s var(--ease_out)`、`width:110%`、`transform-origin:left`）；按钮尺寸照抄华为 `.more-button`，箭头照抄 `.job-classification-item-link-item-icon`。改动：把 cosmicbroth 的渐变下划线改成浅底可用的实色；给华为按钮补上 cosmicbroth 的下划线动效与 `::before` 底色层。**`transform-origin:left` 是从左往右长而非中间绽开的关键；hover 不能改 `background-color`，要用 `::before` 的 opacity 分离，否则文字色与背景过渡不同步。**

```html
<style>
:root{ --ease_out:cubic-bezier(.2,.9,.45,1); --brand:#c7000b; --ink:#191919; --white:#fff }
body{ background:var(--white); color:var(--ink); padding:3rem; font-family:Huawei Sans,HarmonyOS_Sans,"Microsoft YaHei",Arial,Helvetica,sans-serif }
/* ↑ 字体栈照抄华为 common.min.css 唯一一条正文声明 */
.ul{ position:relative; display:inline-block; cursor:pointer; text-decoration:none; color:var(--ink) }
.ul::after{ content:""; position:absolute; left:0; bottom:-.4rem; height:1px; width:110%; background:linear-gradient(90deg,var(--brand),rgba(199,0,11,0));
  transform:scaleX(0); transform-origin:left; transition:transform .8s var(--ease_out) }   /* 照抄 bottom:-.4rem / 110% / .8s */
@media (hover:hover){ .ul:hover::after{ transform:scaleX(1) } }
.ghost{ display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; height:48px; padding:12px 24px; font-size:16px; line-height:24px; font-weight:400;
  border:1px solid var(--ink); border-radius:6px; color:var(--ink); background:transparent; cursor:pointer; position:relative; overflow:hidden;
  -webkit-tap-highlight-color:transparent; transition:color .5s var(--ease_out) }           /* 尺寸全部照抄华为 .more-button */
.ghost::before{ content:""; position:absolute; inset:0; background:var(--brand); opacity:0; z-index:-1; transition:opacity .5s var(--ease_out) }
@media (hover:hover){ .ghost:hover{ color:var(--white) } .ghost:hover::before{ opacity:1 } }
.ghost i{ display:inline-block; width:7px; height:7px; border-top:1px solid currentColor; border-right:1px solid currentColor; transform:rotate(45deg); margin-left:10px; transition:transform .5s var(--ease_out) }
@media (hover:hover){ .ghost:hover i{ transform:rotate(45deg) translate(3px,-3px) } }
@media (max-width:767px){ .ghost{ height:auto; padding:9px 20px; font-size:14px; line-height:22px } }     /* 照抄移动端 */
@media (prefers-reduced-motion: reduce){ .ul::after{ transition:none; transform:scaleX(1) } .ghost,.ghost::before,.ghost i{ transition:none } }
</style>
<a class="ul" href="#">下划线擦出（0.8s，从左侧展开到 110%）</a><br><br><br>
<button class="ghost">了解更多 <i></i></button>
```

## 配方 5 · 哑光玻璃卡 + 部门 Tab 切换

来源：数值照抄 `homePage-internetEverything.pc.css` ≥1024px 断点（见 B.2.5）。改动：给原站「零过渡」的 Tab 切换加 `transition`；补 `prefers-reduced-motion`。**`border-bottom:2px solid #f5f5f5` 未激活时也必须存在**（肉眼看不见，因为等于背景色）——这是避免激活时内容跳动 2px 的关键，华为做对了。另注：`backdrop-filter:blur(50px)` 配 `background:#fff`（不透明）不产生可见效果，要玻璃感需改 `rgba(255,255,255,.72)`。

```html
<style>
:root{ --brand:#c7000b; --ink:#191919; --grey:#666; --line:#f5f5f5; --ease_out:cubic-bezier(.2,.9,.45,1); --dur:.3s }
body{ margin:0; color:var(--ink); font-family:Huawei Sans,HarmonyOS_Sans,"Microsoft YaHei",Arial,Helvetica,sans-serif }
.section{ background:var(--line); margin:192px auto; padding:96px 0 }                                  /* 照抄 */
.title-content{ height:80px; max-width:1600px; margin:0 auto 48px; text-align:center }
.title-content .title{ display:inline-block; font-weight:bold; font-size:44px; line-height:68px; padding-bottom:10px; border-bottom:2px solid var(--line) }
.title-content .title.is-on{ border-bottom-color:var(--brand) }
.tab-content{ display:flex; justify-content:center; align-items:center; overflow:auto; gap:80px; max-width:1600px; margin:0 auto; scrollbar-width:none }  /* 照抄 gap:80px */
.tab-content::-webkit-scrollbar{ height:0 }
.tab-item{ flex:0 0; height:38px; padding-bottom:8px; border-bottom:2px solid var(--line); transition:border-color var(--dur) var(--ease_out) }              /* 前四项照抄，transition 我加的 */
.tab-item .title{ cursor:pointer; font-weight:400; white-space:nowrap; font-size:20px; line-height:28px; transition:color var(--dur) var(--ease_out) }
.tab-item.is-on{ border-bottom-color:var(--brand) } .tab-item.is-on .title{ color:var(--brand) }
.main-content{ position:relative; width:100%; margin:48px 0; padding-top:20px }
.img-content{ position:relative; z-index:2; width:70.1%; max-width:1334px; margin:0 auto }
.department-img{ display:block; width:100%; height:510px; object-fit:cover; opacity:0; transition:opacity var(--dur) var(--ease_out) }   /* 照抄 510px */
.department-img.is-on{ opacity:1 }
.top-red-background{ position:absolute; z-index:1; top:0; left:0; width:68%; height:20px; background:var(--brand) }                       /* 照抄 */
.introduce-content{ position:absolute; z-index:3; width:647px; height:324px; padding:40px; border-radius:12px; backdrop-filter:blur(50px); -webkit-backdrop-filter:blur(50px);
  background:#fff; display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden; bottom:93px; right:max(24px, calc((100vw - 1600px) / 2)) }   /* 照抄 + max() 兜底 */
.introduce-title{ font-size:24px; line-height:32px; margin-bottom:16px; font-weight:700 }
.introduce-text{ font-size:16px; line-height:28px; color:var(--grey); font-weight:400; overflow:hidden }
.introduce-body{ opacity:0; transform:translateY(8px); transition:opacity var(--dur) var(--ease_out), transform var(--dur) var(--ease_out) }
.introduce-body.is-on{ opacity:1; transform:translateY(0) }
.learn-more{ display:flex; justify-content:center; align-items:center; height:48px; margin-top:48px }
.more-button{ height:48px; padding:12px 24px; font-size:16px; line-height:24px; border:1px solid var(--ink); border-radius:6px; color:var(--ink); background:transparent; cursor:pointer; box-sizing:border-box }
@media (max-width:1023px){ .tab-content{ gap:40px } .title-content{ height:34px; margin:0 5% 20px }
  .title-content .title{ font-size:20px; line-height:26px; padding-bottom:6px }
  .introduce-content{ width:auto; height:auto; padding:24px; position:static; margin:24px auto; max-width:90% } }
@media (prefers-reduced-motion: reduce){ .tab-item,.tab-item .title,.department-img,.introduce-body{ transition:none } .introduce-body{ opacity:1; transform:none } }
</style>
<section class="section">
  <div class="title-content"><span class="title is-on">多样岗位</span></div>
  <div class="tab-content" id="tabs">
    <div class="tab-item is-on"><div class="title">研发</div></div><div class="tab-item"><div class="title">销售</div></div>
    <div class="tab-item"><div class="title">服务</div></div><div class="tab-item"><div class="title">供应链</div></div>
    <div class="tab-item"><div class="title">采购</div></div><div class="tab-item"><div class="title">财经</div></div>
  </div>
  <div class="main-content">
    <div class="img-content"><div class="top-red-background"></div><img class="department-img is-on" id="deptImg" src="dept-0.jpg" alt=""></div>
    <div class="introduce-content"><div class="introduce-title" id="deptTitle">研发 / R&amp;D</div>
      <div class="introduce-body is-on" id="deptBody"><div class="introduce-text" id="deptText">部门介绍文字……</div></div></div>
  </div>
  <div class="learn-more"><button class="more-button">了解更多</button></div>
</section>
<script>
(function(){
  var DATA=[{t:'研发',en:'R&D',img:'dept-0.jpg'},{t:'销售',en:'Sales',img:'dept-1.jpg'},{t:'服务',en:'Service',img:'dept-2.jpg'},
    {t:'供应链',en:'Supply Chain',img:'dept-3.jpg'},{t:'采购',en:'Procurement',img:'dept-4.jpg'},{t:'财经',en:'Finance',img:'dept-5.jpg'}];  // title/titleEn 照抄 block 5
  var items=document.querySelectorAll('#tabs .tab-item'), img=document.getElementById('deptImg'),
      title=document.getElementById('deptTitle'), body=document.getElementById('deptBody'), text=document.getElementById('deptText'), cur=0;
  function go(i){
    if (i===cur) return;
    items[cur].classList.remove('is-on'); items[i].classList.add('is-on');
    img.classList.remove('is-on'); body.classList.remove('is-on');            // 只动 opacity/transform
    setTimeout(function(){ var d=DATA[i]; img.src=d.img; title.textContent=d.t+' / '+d.en; text.textContent='部门介绍…';
      img.classList.add('is-on'); body.classList.add('is-on'); }, 300);       // 与 CSS .3s 对齐
    cur=i;
  }
  items.forEach(function(el,i){ el.setAttribute('tabindex','0'); el.setAttribute('role','button');
    el.addEventListener('click',function(){ go(i) });
    el.addEventListener('keydown',function(e){ if (e.key==='Enter'||e.key===' '){ e.preventDefault(); go(i) } }); });
})();
</script>
```

## 配方 6 · 指示点 + 箭头 + 自动轮播

来源：箭头 `64×64px`/`rgba(25,25,25,.15)`/图标 `24px`/`border-radius:126rem`；指示点 `.25rem`→`width:1rem`、`margin-right:.375rem`、`hsla(0,0%,95%,.5)`→`#fff`、`bottom:1.7rem`；切换 `transform .3s cubic-bezier(.4,0,.2,1)`；非激活 `opacity:.1`；间隔 `5000`。改动（原站未核实，属改进）：加 hover 暂停、`visibilitychange` 暂停、指示点宽度过渡、`prefers-reduced-motion`。**切换是 `translate3d(-N%,0,0)` + 非激活 `opacity:.1`；`visibilitychange` 暂停是必需的，否则切到别的 tab 30 秒再回来会连跳 6 次。**

```html
<style>
:root{ --dot-off:hsla(0,0%,95%,.5); --dot-on:#fff; --arrow-bg:rgba(25,25,25,.15); --arrow-bg-hover:rgba(25,25,25,.3); --carousel-ease:cubic-bezier(.4,0,.2,1) }
.carousel{ position:relative; overflow:hidden; border-radius:.25rem; user-select:none }
.carousel-block{ position:relative; overflow:hidden; height:var(--carousel-height,1002px); border-radius:.25rem }     /* 照抄 height:"1002px" */
.track{ display:flex; height:100%; will-change:transform; transition:transform .3s var(--carousel-ease) }            /* 照抄 */
.slide{ flex:0 0 100%; width:100%; height:100%; position:relative; overflow:hidden; opacity:1; transition:opacity .3s var(--carousel-ease) }
.slide:not(.is-active){ opacity:.1 }                                                                                /* 照抄 .is-hover */
.slide img{ display:block; width:100%; height:100%; object-fit:cover; pointer-events:none }
.arrow{ position:absolute; top:50%; transform:translateY(-50%); width:64px; height:64px; display:flex; align-items:center; justify-content:center;    /* 照抄业务层 */
  border:0; padding:0; margin:0; border-radius:126rem; background:var(--arrow-bg); color:#fff; cursor:pointer; z-index:3;
  opacity:0; transition:opacity .3s var(--carousel-ease), background-color .3s var(--carousel-ease) }               /* arrow:"hover" → 默认隐藏 */
.arrow svg{ width:24px; height:24px; opacity:1 } .arrow--left{ left:1rem } .arrow--right{ right:1rem }
.carousel:hover .arrow{ opacity:1 } .arrow:hover{ background:var(--arrow-bg-hover) }
.arrow:focus-visible{ opacity:1; outline:2px solid #fff; outline-offset:2px }
.dots{ position:absolute; left:0; right:0; bottom:1.7rem; margin:0; padding:0 .25rem; height:.25rem; list-style:none; display:flex; justify-content:center; align-items:center; z-index:2 }
.dots li{ display:inline-block; height:.25rem; padding:0; margin:0 .375rem 0 0 } .dots li:last-child{ margin-right:0 }   /* 照抄 */
.dot{ display:block; border:0; padding:0; margin:0; cursor:pointer; height:.25rem; width:.25rem; border-radius:.125rem; background:var(--dot-off);
  transition:width .3s var(--carousel-ease), background-color .3s var(--carousel-ease) }                              /* 照抄 4×4 / 2px */
.dot:hover{ background:rgba(238,243,254,.5) } .dot.is-active{ width:1rem; background:var(--dot-on) }                    /* 照抄 4px → 16px */
@media (max-width:1023px){ .arrow{ width:28px; height:28px; background:rgba(25,25,25,.3) } .arrow svg{ width:12px; height:12px } }
@media (prefers-reduced-motion: reduce){ .track,.slide,.dot,.arrow{ transition:none } .carousel .arrow{ opacity:1 } }
</style>
<div class="carousel" id="car"><div class="carousel-block">
  <div class="track" id="track">
    <div class="slide is-active"><img src="s1.jpg" alt=""></div><div class="slide"><img src="s2.jpg" alt=""></div>
    <div class="slide"><img src="s3.jpg" alt=""></div><div class="slide"><img src="s4.jpg" alt=""></div>
  </div>
  <button class="arrow arrow--left" id="prev" aria-label="上一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg></button>
  <button class="arrow arrow--right" id="next" aria-label="下一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg></button>
  <ul class="dots" id="dots"></ul>
</div></div>
<script>
(function(){
  var root=document.getElementById('car'), track=document.getElementById('track'), slides=track.querySelectorAll('.slide'),
      dotBox=document.getElementById('dots'), total=slides.length, index=0;
  var INTERVAL=5000, reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;     /* 照抄 carousleData.interval */
  for (var i=0;i<total;i++){ var li=document.createElement('li'), b=document.createElement('button');
    b.className='dot'+(i===0?' is-active':''); b.type='button'; b.setAttribute('aria-label','第 '+(i+1)+' 张');
    (function(n){ b.addEventListener('click',function(){ go(n); restart() }) })(i); li.appendChild(b); dotBox.appendChild(li); }
  var dots=dotBox.querySelectorAll('.dot');
  function go(n){ index=(n+total)%total;                                                            /* loop:true */
    track.style.transition = reduce ? 'none' : 'transform .3s cubic-bezier(.4,0,.2,1)';              /* 照抄 */
    track.style.transform='translate3d('+(-index*100)+'%,0,0)';                                      /* 位移，非淡入淡出 */
    for (var i=0;i<total;i++){ slides[i].classList.toggle('is-active', i===index); dots[i].classList.toggle('is-active', i===index); } }
  var timer=null;
  function start(){ if (reduce||total<2) return; stop(); timer=setInterval(function(){ go(index+1) }, INTERVAL) }
  function stop(){ if (timer){ clearInterval(timer); timer=null } } function restart(){ stop(); start() }
  root.addEventListener('mouseenter', stop); root.addEventListener('mouseleave', start);            /* trigger:"hover" 的意图 */
  document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(); else start() });   /* 防切回后连跳 */
  document.getElementById('prev').addEventListener('click',function(){ go(index-1); restart() });
  document.getElementById('next').addEventListener('click',function(){ go(index+1); restart() });
  var x0=null;                                                                                     /* swipeable:true */
  root.addEventListener('touchstart',function(e){ x0=e.touches[0].clientX; stop() },{passive:true});
  root.addEventListener('touchend',function(e){ if (x0===null) return; var dx=e.changedTouches[0].clientX-x0;
    if (Math.abs(dx)>40) go(index+(dx<0?1:-1)); x0=null; start(); });
  root.setAttribute('tabindex','0');
  root.addEventListener('keydown',function(e){ if (e.key==='ArrowLeft'){ go(index-1); restart() } if (e.key==='ArrowRight'){ go(index+1); restart() } });
  go(0); start();
})();
</script>
```

## 配方 7 · `--scale` 比例缩放响应式

来源：`*{font-size:2vmin}` + `--scale` 分级 + `--margin_x/--margin_y` 全部照抄第 1 个内联 `<style>` 的 `@media` 链（长浮点分数原样保留，浏览器能算）。改动：加 `:root{--scale:1}` 默认值（否则 `calc(var(--scale)*3rem)` 会失效）。**取舍：布局永不换（同一套 DOM），只有尺寸连续缩放；代价是极端比例下字会不可读。生产环境建议加下限，如 `font-size:clamp(13px, 2vmin, 22px)`。** `*` 命中 `html` 是方案能工作的原因。

```html
<style>
*{ font-size:2vmin;                                                                     /* 挂钩 html，全局 rem = 视口短边 2% */
  margin:0; padding:0; --color_black:#000013; --color_white:#f3f3f3; --color_theme:#178ec5;
  --margin_x:calc(var(--scale) * 3rem); --margin_y:calc(var(--scale) * 3rem);
  --border_xs:calc(var(--scale)*.05rem); --border_s:calc(var(--scale)*.1rem); --border_m:calc(var(--scale)*.15rem); --border_l:calc(var(--scale)*.2rem); --border_xl:calc(var(--scale)*.3rem);
  --ease_in:cubic-bezier(.6,0,.8,.4); --ease_out:cubic-bezier(.2,.9,.45,1); --ease_inout:cubic-bezier(.7,0,.3,1);
  --line_height_1:calc(var(--scale)*1rem); --line_height_2:calc(var(--scale)*1.5rem); --line_height_4:calc(var(--scale)*2rem); --content_width:calc(var(--scale)*65rem) }
._font_1{ font-size:calc(var(--scale)*.6rem) } ._font_2{ font-size:calc(var(--scale)*.8rem) }
._font_3{ font-size:calc(var(--scale)*1rem) } ._font_4{ font-size:calc(var(--scale)*1.2rem) } ._font_5{ font-size:calc(var(--scale)*1.4rem) }
body{ background:var(--color_black); color:var(--color_white) } :root{ --scale:1 }        /* 必须有默认值 */
@media screen and (max-aspect-ratio:3/2){ *{ font-size:1.8vmin } }                        /* 横屏：2vmin 逐级降到 1.5vmin */
@media screen and (max-aspect-ratio:3152519739159347/2251799813685248){ *{ font-size:1.7vmin } } /*≈1.400*/
@media screen and (max-aspect-ratio:5854679515581645/4503599627370496){ *{ font-size:1.6vmin } } /*≈1.300*/
@media screen and (max-aspect-ratio:5404319552844595/4503599627370496){ *{ font-size:1.5vmin } } /*≈1.200*/
@media screen and (max-aspect-ratio:1/1){ *{ font-size:1.7vmax } }                         /* 竖屏切 vmax，按 vmin 算字会太小 */
@media screen and (max-aspect-ratio:8106479329266893/9007199254740992){ *{ font-size:1.6vmax } } /*≈0.900*/
@media screen and (max-aspect-ratio:3602879701896397/4503599627370496){ *{ font-size:1.5vmax } } /*≈0.800*/
@media screen and (max-aspect-ratio:3152519739159347/4503599627370496){ *{ font-size:1.4vmax } } /*≈0.700*/
@media screen and (max-aspect-ratio:5404319552844595/9007199254740992){ *{ font-size:1.3vmax } } /*≈0.600*/
@media screen and (max-aspect-ratio:1/2){ *{ font-size:1.2vmax } }
@media screen and (max-aspect-ratio:3602879701896397/9007199254740992){ *{ font-size:1.1vmax } } /*≈0.400*/
@media screen and (max-aspect-ratio:3602879701896397/2251799813685248){ *{ --content_width:calc(var(--scale)*50rem) } }   /*≈1.600*/
@media screen and (max-aspect-ratio:1/1){ *{ --margin_x:calc(var(--scale)*1rem); --margin_y:calc(var(--scale)*2rem); --content_width:70vw } }
.frame{ min-height:100dvh; padding:var(--margin_y) var(--margin_x); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--line_height_2) }
.card{ width:var(--content_width); max-width:100%; border:var(--border_m) solid var(--color_white); padding:var(--line_height_4); box-sizing:border-box }
.card h1{ font-size:calc(var(--scale)*1.4rem); font-weight:400; margin-bottom:var(--line_height_1) }
.card p{ font-size:calc(var(--scale)*.6rem); line-height:var(--line_height_1); letter-spacing:calc(var(--scale)*.03rem) }
.card .accent{ color:var(--color_theme) }
</style>
<div class="frame"><div class="card"><h1>COSMIC BROTH</h1>
  <p>正文字号 <span class="accent">0.6rem</span>，行高 <span class="accent">1rem</span>，字距 <span class="accent">0.03rem</span>。</p>
  <p>改窗口比例，整站字号与间距按视口比例连续缩放，不换布局。</p></div></div>
```

## 配方 8 · RGB 色差 Glitch + 跑马灯

来源：色差照抄 `style7.css` 的 `.error_content_404` 及 `:before`/`:after`（红 `#f00f03`/蓝 `#0326f0`、`mix-blend-mode:lighten`、`.5s var(--ease_out) infinite`、`reverse` 与 `-.3s`、`translate(±2%)`、完整 `shake` 关键帧）；跑马灯照抄 `style6.css` 的 `.ad_content_scrolltext p`（`10s linear infinite`、`translate(0)→translate(-100%)`）。改动：加 `prefers-reduced-motion`（停 glitch）；跑马灯加 hover 暂停与两端羽化。**负 `animation-delay` 是灵魂：`:before` 用 `-.3s` 从动画中段起步，`:after` 用 `reverse` 反向播放，两者永不同步。主体字色等于背景色，所以未叠加伪元素时不可见。跑马灯要真正无缝需把内容复制两份并同时 `translate(-100%)`。**

```html
<style>
:root{ --ink:#000013; --paper:#f3f3f3; --glitch-red:#f00f03; --glitch-blue:#0326f0; --ease_out:cubic-bezier(.2,.9,.45,1) }
body{ background:var(--ink); color:var(--paper); margin:0; min-height:100vh; gap:3rem; display:flex; flex-direction:column; align-items:center; justify-content:center;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace }
.glitch{ position:relative; display:inline-block; color:var(--ink); font-size:10rem; line-height:1; margin-bottom:2rem; margin-right:-1.5rem; z-index:0 }   /* 照抄 10rem / 负 margin */
.glitch::before,.glitch::after{ content:"404"; position:absolute; left:0; top:0; z-index:-1; mix-blend-mode:lighten }                                       /* 照抄 */
.glitch::after{ color:var(--glitch-red); transform:translate(2%); animation:shake .5s var(--ease_out) infinite reverse }                                    /* 照抄 reverse */
.glitch::before{ color:var(--glitch-blue); transform:translate(-2%); animation:shake .5s var(--ease_out) infinite -.3s }                                    /* 照抄负延迟 */
@keyframes shake{ 0%{transform:translate(1%) translateY(-1%)} 20%{transform:translate(0) translateY(.5%)} 40%{transform:translate(-1%) translateY(1.5%)}
  60%{transform:translate(1%) translateY(0)} 80%{transform:translate(-1.5%) translateY(-1%)} to{transform:translate(1%) translateY(-.5%)} }                  /* 照抄 6 帧 */
.marquee{ width:min(90vw,640px); overflow:hidden; border-top:1px solid #f3f3f330; border-bottom:1px solid #f3f3f330; padding:.75rem 0;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent); mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent) }
.marquee p{ display:inline-block; white-space:pre; color:#178ec5; font-size:.95rem; margin:0; animation:marquee 10s linear infinite }                       /* 照抄 */
@keyframes marquee{ 0%{transform:translate(0)} to{transform:translate(-100%)} }
.marquee:hover p{ animation-play-state:paused }
@media (prefers-reduced-motion: reduce){
  .glitch::before,.glitch::after{ animation:none } .glitch::before{ transform:translate(-2%) } .glitch::after{ transform:translate(2%) }
  .glitch{ color:var(--paper) } .marquee p{ animation:none } }
</style>
<div class="glitch">404</div>
<div class="marquee"><p>GRAND-STARRS-RAY &nbsp;·&nbsp; [LOADING] → ACCESS SYSTEM... &nbsp;·&nbsp; COSMIC BROTH &nbsp;·&nbsp; </p></div>
```

## C.9 配方索引

| # | 名称 | 核心技术 | 来源 |
|---|---|---|---|
| 1 | 三条核心缓动 + 揭示 | `cubic-bezier(.2,.9,.45,1)` + `clip-path` 擦出 + IO | cosmicbroth `CustomEase` + 内联 CSS |
| 2 | 拖拽平移视差 | `touch-action:none` + 增量×500/视口宽 + 1.0/0.8 分层 | cosmicbroth `move()`/`resize()` |
| 3 | 切角面板 + 四角括号 | 12 点 `clip-path` + `rotateY(-180deg)` 镜像 | `._clip_cross`/`._clip_edge` |
| 4 | 下划线擦出 + 幽灵按钮 | `transform-origin:left` + `scaleX` + `::before` opacity | `.wsi_button_text` + 华为 `.more-button` |
| 5 | 哑光玻璃卡 + Tab | `backdrop-filter` + 假底线防跳动 | 华为 `internetEverything` |
| 6 | 指示点 + 箭头 + 轮播 | `translate3d` + `opacity:.1` + `border-radius:126rem` | 华为 `aui-carousel` + `interval:5000` |
| 7 | `--scale` 比例缩放 | `*{font-size:2vmin}` + `max-aspect-ratio` 分级 | cosmicbroth 第 1 个内联 `<style>` |
| 8 | RGB 色差 Glitch + 跑马灯 | `mix-blend-mode:lighten` + 负 `animation-delay` | `style7.css` / `style6.css` |

---

## 附录 A：未核实清单

| 项 | 状态 | 原因 |
|---|---|---|
| 华为 `.aui-carousel` 实际 DOM 结构 | **未核实** | 模块渲染进空 `<section id="vue_*">`；静态 HTML `class` 扫描 `carousel\|banner\|swiper\|slide` 为空集 |
| 华为组件 JS（`res.hc-cdn.com/<组件>/<版本>/pc/index.js`） | **未抓取** | 所有运行时逻辑（hover 暂停、speed、滚动计数）均无法证实 |
| 华为轮播 hover 是否暂停 | **未核实** | CSS 无 `animation-play-state`、无 `.is-paused`；若存在只能在 JS |
| Swiper 实例 `speed` | **未核实** | 由 CSS `.3s` 与 Swiper 默认 300ms 推得，未读运行时配置 |
| 华为是否有滚动数字计数 | **未核实（倾向无）** | CSS 与 JSON 均无迹象，无法排除 JS |
| `.ad`/`.ed` 弹窗的 Vue 过渡数值 | **未核实** | 两个 bundle 中未定位到对应 tween |
| `overview`/`introduces` 以外的 cosmicbroth API | **未抓取** | 只取 `overview`（218 KB）用于确认主题色与文案 |
| 两站的 `prefers-reduced-motion` 处理 | **确认缺失** | cosmicbroth 两个 bundle 命中 0；华为 11 个组件 CSS 命中 0 |
| 华为 `commonHeader` 的高度/字号 | **未逐条提取** | 仅做整体统计（`transition`/`animation`/`@keyframes` 全 0） |
| Zpix 字体授权条款 | **未核实** | 只确认站点自托管 `/_nuxt/zpix.DytyLrWt.ttf` |

## 附录 B：本地留档文件索引

| 文件 | 内容 |
|---|---|
| `docs/_raw/cosmicbroth.html` | cosmicbroth 原始 HTML（466545 字节） |
| `docs/_raw/cosmic/inline/style1..11.css` | 11 个内联 `<style>`，已按 `}` 换行格式化 |
| `docs/_raw/cosmic/*.css` | 4 个外部 CSS |
| `docs/_raw/cosmic/js/Bx70QQQb.js`、`CxtPVY3G.js` | 主 JS bundle（含 GSAP 3.13.0） |
| `docs/_raw/cosmic/overview.json` | 4 个世界的文案/主题色/坐标/Lottie 罗盘 |
| `docs/_raw/cosmic/body.tags.txt` | 压缩 `points` 后的 DOM 标签清单（763 行） |
| `docs/_raw/huawei-career.html` / `.fixed.html` | 华为首页原始 / 编码修复后 |
| `docs/_raw/huawei/data/*.json` | 14 个 `comData_*` 模块配置 |
| `docs/_raw/huawei/*.pc.css` | 11 个组件 PC 端 CSS |
| `docs/_raw/huawei/common.min.css` | 华为基础样式（字体栈唯一来源） |
