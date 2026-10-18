# 重建笔记（craft 重写）

> 这份文件记录「以 Antoine 级工艺重写前端」这条线的**判断、证据与未决问题**。
> 写在会话上下文耗尽时，目的是让下一个接手的人（或下一轮的我）不用重新摸一遍。

## 一、起点与备份

- 上一个 AI 的实现已完整备份到 `_local/handover-ai/`（56 个文件 / 1 MB），可随时回看或整体恢复。
- 内容（14 个 Markdown：`index.md` / `verify.md` / `404.md` / `archive/**` / `forum/**` / `verify/register.md`）**全程未改动**。

## 二、关键发现：它建在我的层上，不是替换

| 位置 | 事实 |
| --- | --- |
| `layout.mjs:466-470` | `curtainMarkup` —— 就是我上一版的帘幕（标识 + 细进度线） |
| `layout.mjs:531-539` | `hero` 结构：`hero__bg` 照片 + `hero__field`（`data-starfield` 画布）+ kicker / title(`data-split`) / punch / actions |
| `main.css:1465-1484` | `.hero / .hero__bg / .hero::after / .hero__kicker / .hero__title` —— 就是我写的编辑式首屏样式 |
| `layout.mjs:672-677` | 校验页用的是**另一套外壳**（多 `key.js` / `accounts.js` / `ocean.js`） |

→ **不需要换装 hero**，也不存在双帘幕/双 loader（`craft.js` 找 `[data-loader]`，页面里没有，自动跳过）。

## 三、它的真实增量，与为什么不满意

`/archive/` 用 `sessionStorage['cac-pass'] = '1'`（或任一 `localStorage['cac-session']`）可以绕过守卫看。

- **有价值的是广度**：档案部 6 类（设施/装备/异常收容物/研究论文/行动记录/评估报告）、每类带计数与说明、`archive.json` 12.8 KB 真实数据、类内检索、面包屑与返回。
- **不满意的是层级**：六张**同规格描边卡片**并排，除编号外没有任何区别；背景那层星座连线（canvas 2D）纯装饰，不随内容/指针联动；检索框 + 红色胶囊是通用 App 套路。
- **它的 3D 栈**：`v3d.js` 303 行（**真 WebGL**）、`morphfield.js` 593 行（canvas 2D + rAF）、`archive.js` 332 行（canvas）。这跟 Antoine 的路子相反（他用 SVG path + 手写弹簧、无 WebGL），代价是维护与降级成本。

### 因此「推倒」的边界

| 留 | 弃 |
| --- | --- |
| `archive.json` 的 6 类数据与计数 | 6 张等重描边卡片的网格 |
| 面包屑 / 返回 / 类内检索的**功能** | 星座背景那层装饰 canvas |
| 双页 + 校验的访问骨架 | 三段 canvas 渲染（`v3d` / `morphfield` / `bgfield`） |

改法：6 类做成**编辑式列表**（大号编号 + 名称 + 一句说明 + 计数右对齐、发丝线分隔、hover 整行位移），背景换成与首屏同一套 SVG 波线 + 颗粒，不再养第二套 canvas。

## 四、已完成并验证的工艺件

`site/assets/css/craft.css`（设计系统 + 部门分段）、`site/assets/js/craft.js`（loader / SVG 波浪场 / 行遮罩 / 光标 + 磁性 / 过渡 / 分段）、验证页 `site/assets/demo/craft.html`。

| 件 | 状态 | 证据 |
| --- | --- | --- |
| loader（`pathLength` 线描 + 真进度） | 已建 | 截图 |
| 首屏 SVG 波浪场（正弦叠加 + 指针高斯隆起 + 0.055 平滑） | 已建 | 定稿帧 |
| 行遮罩上浮 | 已建 | 定稿帧（修过中文下半截被切） |
| 磁性按钮 + 自定义光标（半径 150 / 强度 .58） | 已建 | 修过幽灵行逃逸 |
| 部门分段（逐片错峰 `i × 70ms`） | 已建 | iframe 滚动截图 |
| reduced-motion 降级 | 通过 | 定稿帧 |
| 无 JS 降级 | 通过 | 修过"选中态深字消失" |

### 已集成到正式页面的一层

`craft-chrome.css`（2 KB，只含颗粒/光标/过渡，刻意不写 `body`/字号/布局）+ `craft-chrome.js`（约 50 行，不需要页面标记）。

- 接法：在 `layout.mjs` 里以**唯一锚点**替换插入（`motion.css` 之后、`motion.js` 之后、校验页的 `ocean.js` 之后），插入前先数匹配次数，保证幂等。
- 验证：两页各含 css/js **各 1 次**，构建 19 页通过，站内链接全部有效。

## 五、三个待办（按优先级）

1. **校验页的方向（需要用户拍板）**：它把流程改成了**仅密钥**（称呼/邮箱 + 个人密钥，示例 `6DFUP`），**没有访客进入**。用户原话要求「可以选择以访客身份进入或者是注册/登录」。恢复访客入口，还是接受密钥制 —— 未定，不宜擅自改。
2. **档案页换装**：按上面的「留/弃」表，把卡片网格换成编辑式行列表，背景统一到首屏那套。
3. **文档**：`README.md` 仍在描述旧结构，等换装完再一次性更新。

## 六、环境备忘（避免重复踩坑）

- 本地预览：`node site/build.mjs` 后 `node site/serve.mjs 4180`；本轮用的是 4180（4173 已被上一次会话的进程占用过）。
- 无头截图**不推进 CSS 过渡**，看到的"半截字/半透明"多为过渡中途帧；判最终态要用 `--force-prefers-reduced-motion`。
- 首屏 `min-height: 100svh` 会吃掉所有加高截图的余量；拍中段板块要用 iframe 内 `scrollIntoView`（见 `_local/checks/seg-shot.html`）。
- 无 JS 检查用 `sandbox` 不带 `allow-scripts` 的 iframe（见 `_local/checks/nojs.html`）。
- 中文文件读写别用 `Get-Content -Raw` / `Set-Content`（PS 会按 ANSI 读坏），用 `[System.IO.File]::ReadAllText/WriteAllText` + `UTF8Encoding($false)`。

---

# 附：In Pieces 拆解结论（`docs/craft-in-pieces.md`，786 行）

## 三条颠覆常识的实测

1. **全站没有 CSS 3D**。725 KB 的 `main.css` 里 `perspective` / `preserve-3d` / `rotate3d` 命中均为 0；`rotateY` 只有 2 处，与动物无关。所谓"碎片翻转"是**假的**。
2. **每只动物 30 片，纯 `<div>`**，每片都是 100%×100% 的同一块画布、绝对定位完全重叠；形状 100% 由 `clip-path: polygon(3 点)` 决定，`left/top/transform` 全不参与（共 1,324 条三顶点 polygon）。
3. **接缝不是补出来的，是架构消掉的**：满铺重叠 + 公共顶点写成同一数值 + 任何单片都不单独 `scale` + `#1a1a1d` 深底兜底。全文没有 stroke / box-shadow 补缝。

## "翻转" = 三点插值

退化态是 `polygon(50% 50%, 50% 50%, 50% 50%)`（三点重合于中心），从无到有就是三点炸开。所以"翻转"其实是**裁切形状的插值**，不是 3D 旋转。

## 可直接抄的时序公式（30 条实测拟合）

| 场景 | 时长 | 延迟 |
| --- | --- | --- |
| 切换（正向） | `0.30 + 0.04N` | `0.20 + 0.02N` |
| 切换（反向） | `1.54 − 0.04N` | `0.975 − 0.025N` |
| 入场 | `1.20 + 0.04N` | `0.50 − 0.05·min(N−1, 30−N)` |

- 缓动统一 `cubic-bezier(.7,.3,0,1)`。
- 时长与延迟**反向耦合** → 重叠率 76%，总窗口 2.30s / 2.45s，不是排队翻。
- **负延迟合法**，让中段先成形、两端后到位，形成"绽放"而不是"推进"。
- 其他：三条互质周期 `4000/3000/7000ms`（LCM 84s）叠加驱动呼吸与微光，零随机；`.level-two` 16s linear 慢转（−8°→26°，≈2.1°/s）；z-index 三层（噪点 0 / 辉光 1 / 碎片 2）；778 节点，`will-change` 0 次。
- **原站 `prefers-reduced-motion` 命中 0 次**——迁移必须补。

## 对我们已有的两个直接改进点

1. **部门分段现在是线性错峰 `i × 70ms`**，应改成三角波：`delay = 基础 − 步长 × min(i, n−1−i)`，让中间零件先成形。这是同一条公式的直接应用，改一行 CSS 的量。
2. **档案页的行列表可以加"三点炸开"的 hover**：不用 3D，用 `clip-path: polygon()` 三点插值做遮罩揭开，正好是原站的手法，且只动 `clip-path`。

## 复刻清单

12 条（三角扇拼贴 / 满铺裁切消接缝 / 三点插值冒充翻转 / 三角波错峰 / 方向感知轮播 / 多周期呼吸 / 击碎收拢 / 16s 慢转 / 胶片质感 / 中文逐字标题 / 双轨跑马灯 / `--motion` 统一降级）在 `docs/craft-in-pieces.md` 里，每条都带参数与原生骨架，并已用 `--i + calc()` 把原站 900 条 `nth-child` 压成一条规则。
