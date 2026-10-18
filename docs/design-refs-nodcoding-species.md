# nodcoding.com 与 species-in-pieces.com 前端手法研究

> 目标产物仍是**零依赖原生 CSS/JS 中文站**（无框架、无 npm、无构建工具）。
> 所以这里的结论只回答一个问题：这两站的手法，哪些能用原生等价物搬过来，代价多大。
> 与本目录另外四份笔记并列：`motion-recipes.md`（animejs / uiverse / wodniack / motionsites）、
> `motion-recipes-react.md`（ReactBits / Aceternity）、`anim-refs-mathis-hatom-retronova.md`、
> `design-refs-cosmicbroth-huawei.md`。

---

## 0. 取证方式与可信度（先看这段，决定你对下面每个数字的信任）

| 站点 | 拿到了什么 | 没拿到什么 | 等级 |
| --- | --- | --- | --- |
| nodcoding.com | 首页、`/data-bootcamp/`、`/professional-training/` 的完整 HTML（服务器渲染，禁用 JS 也能读全文）；主题静态资源目录结构；占位图 data URI；行卡片与步骤组件的标记 | **主题的 `css/main.css`、`js/main.js`、`js/app.js` 以及对应 `.min` 版本全部 404（5 条路径实测）** → 一处 `@keyframes`、`transition`、`cubic-bezier` 都没读到 | A（标记）/ 无（时间参数） |
| species-in-pieces.com | 首页全量文本，含作者自述的「How it's made」；30 个品类与 30 个碎片的对应关系 | 站点 CSS/JS 本体未取到 | B（机制，作者陈述）/ C（具体数值） |

规范依据（可查）：

- [`clip-path` 自 2020 年 1 月起为 Baseline 广泛可用](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path)。
- 基本图形之间的插值按"同一类型 + 相同分量个数"逐点对应；**点数不一致就退化**（补点或跳变）。
- [`pathLength`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pathLength) 会把长度计算按比例归一，因此一条 `stroke-dasharray` 能适配任意长度的路径。

**本文的规矩：没读到的时间参数一律不写。** nodcoding 那节没有任何毫秒数，是取证限制，不是遗漏。

---

## 1. nodcoding.com：一个真实商业内容站，动效花在哪

### 1.1 结构（A 级，按 1080p 一个视口估）

首页共 11 段：hero（只有 h1，没有小标题）→ 视频成片位 → 三个评分徽标 → 学员证言 → 「Why Nod」四卡 → 即将开课 → 暑期班 9 行 → 企业培训 3 行 → **Stockholm 钉住段 5 项** → B2B → YouTube 三卡 → 报名表单/页脚。

内页是同一套骨架的缩短版：hero → 步骤块（数据营 6 步 / 企业课 3 步）→ 团队 → FAQ。

### 1.2 动效预算（B 级，由标记与结构推出）

**只在两处花钱：**

1. 开场两屏（hero → 视频位）。
2. Stockholm 那一段**钉住的 5 项序列**——用大约 5 个视口的滚动，换 5 张图和 5 句短文案。

**几乎不花钱的地方：** 12 行招生条目（每行是整行链接 + 箭头图标）、价格、FAQ、表格。这些"要你做决定"的内容**一点动效都没有**。

### 1.3 三个可验证的工程细节（A 级）

- **图片位全是 `data:image/svg+xml` 占位**：一个 40×40 的斜纹 pattern，媒体 1080×1080、视频缩略图 480×360。真正的图/视频在加载后替换进来。零依赖站可以直接照抄这招：占位图内联在 HTML 里，**没有额外请求、没有布局抖动**。
- **一套"编号步骤"组件跨页复用**：首页 5 项、数据营 6 项、企业课 3 项，结构与右侧 pager（`1 2 3 …`）完全一致，配图统一 1920×2075 竖幅（宽高比 ≈ 0.93），是给竖长媒体列裁的，不是全幅 hero。
- **整行可点**：每个课程条目是 `<a>` 包住标题 + 「Apply」+ `arrow-2-right.svg`，不是"标题是链接、按钮是另一个链接"。

### 1.4 可迁移的结论

| 区块 | 该有的动效预算 |
| --- | --- |
| 首屏 / 档案封面 / 校验页 | 高（可以有一次"值得记住"的动效） |
| 分区叙事（部门、时间线） | 中（钉住序列最多一处） |
| 公告、新闻、服务清单、声明 | **零**（纯 reveal 都不要超过一次） |
| 列表型条目（档案列表、论坛卡片） | 低（hover 反馈 + 整行可点） |

> 这条与我们现有的首页结构正好互证：现在 16 个 `data-reveal` 平铺在 6 个 `section` 里，属于"每一块都在动"，和 nodcoding 的做法相反。

---

## 2. species-in-pieces.com：碎片聚合，成本被普遍高估

### 2.1 机制（B 级，作者自述 + 规范）

作者原文要点：纯 CSS，**没有 canvas、没有 WebGL**；每个碎片是一个元素，用 `-webkit-clip-path: polygon(三点)` 裁成**三角形**；形态变化 = 换一组顶点坐标，靠 **CSS transition** 连接；坐标由他自己写的 tracing 函数从插画里逐点抄出来（"Point by point, shape by shape, each one has been handcrafted"）。

写于 2015 年，所以带 `-webkit-` 前缀、且提到"碎片位移只有 WebKit 顺，Firefox 只支持 SVG 引用的 clip-path"。前者今天已无必要（`clip-path` 是 Baseline 2020），后者属于历史限制。

### 2.2 为什么必须是三角形

`<basic-shape>` 的插值是**按顶点逐一对应**的：两个 `polygon()` 若点数不同，浏览器要么补点、要么直接跳变。三角形把点数永远锁在 3，于是**任意两个形态之间都能平滑过渡**——这是整个项目的技术支点，也是最容易抄错的地方（很多人会加第 4 个点去做"更自然"的形状，然后过渡就断了）。

### 2.3 成本模型

原站：30 个物种 × 30 个碎片 = **900 个元素**，另外每个碎片有自己的底色，所以"碎片感"来自**颜色差 + 接缝**，不是来自描边。

对内容站，这个量级没有意义。可用的降级版是**一个面板、6–8 片、一次触发**：8 个 `div` + 一条 `transition: clip-path`，没有 rAF、没有逐帧插值、没有 JS 数学。

### 2.4 降级方案（可直接落地的写法）

```css
/* 每个碎片都是一个普通盒，用三角形裁切；点数恒为 3 */
.shard {
    clip-path: polygon(0% 0%, 100% 0%, 50% 100%);   /* A 态：整齐 */
    transition: clip-path .9s var(--ease-out);
    /* 接缝处亚像素白线：给相邻碎片 0.5px 重叠，而不是加描边 */
}
/* B 态：散开。依旧 3 个点，所以能插值 */
.is-on .shard:nth-child(1) { clip-path: polygon(28% 12%, 74% 4%, 52% 86%); }
.is-on .shard:nth-child(2) { clip-path: polygon(6% 44%, 88% 38%, 61% 100%); }
/* …每个碎片一组坐标，全部手写或用一次性脚本生成 */

/* reduced：不给过渡，直接终态 */
@media (prefers-reduced-motion: reduce) {
    .shard { transition: none; }
}
```

触发点用现有的 `IntersectionObserver` 加一个类，不新增机制。

### 2.5 抄的时候会错在哪

1. **点数不一致** → 过渡失效（最常见）。
2. **顶点顺序/winding 不一致** → 碎片会"翻面"或自交。同一套形状要按顺时针统一生成。
3. **接缝白线** → 相邻三角形共边处有 1px 抗锯齿缝；用 0.5px 重叠解决，别用 `outline`。
4. **碎片数一多就掉帧**：每个元素都是一次独立裁切，移动端超过 ~12 片开始能感觉到。
5. **别指望它承载信息**：它是氛围层，`aria-hidden` 必须加上。

---

## 3. 对既有结论的一处修正

`docs/motion-recipes.md` 的「落地优先级」把**路径 morph** 列进了"明确先不做"。这一条要拆成两句：

- **SVG `path` 的 `d` 属性动画**：原生不可靠，**不做**（原结论正确）。
- **`clip-path` 的多边形 morph**：就是标准 CSS 过渡，Baseline 2020 起广泛可用，成本比前者低一个数量级，**可以做**（本条修正）。

两者常被混为一谈，因为都叫"形状变形"。

---

## 4. 明确不抄

| 不抄 | 理由 |
| --- | --- |
| nodcoding 的钉住序列整段搬进首页 | 它用 5 个视口换 5 张图；我们的首页是信息入口，滚动预算应留给阅读。**只建议给部门段用一处。** |
| 30×30 的碎片量级 | 900 个裁切元素，移动端不可接受；降级到 6–8 片 |
| 用碎片做主要叙事 | 信息在裁剪后的形状里读不出来，只能当氛围 |
| 任何需要主题 JS 才能跑起来的"入场上锁" | 本站铁律是默认可见；nodcoding 是服务器渲染 + 渐进增强，这点反而值得学 |

---

## 5. 未核实清单

| 项 | 状态 | 原因 |
| --- | --- | --- |
| nodcoding 的任何缓动曲线与时长 | **未核实** | 主题 CSS/JS 五条路径全 404 |
| nodcoding 是否用平滑滚动（Lenis 类） | **未核实** | 同上；Wodniack 其它项目用 GSAP + Lenis，属推测（C 级） |
| nodcoding Stockholm 段的触发方式（`position: sticky` 还是库的 pin） | **未核实** | 需要跑起来看 |
| species-in-pieces 每个碎片的真实过渡时长与错峰 | **未核实** | CSS 未取到；本文给的是推荐值 |
| species-in-pieces 的碎片是否随物种重建 DOM | **未核实** | 需要跑起来看 |
| Firefox 对 `clip-path` 过渡的表现 | **未核实** | 作者 2015 年的说法已过时，首次实现必须真机验证 |
