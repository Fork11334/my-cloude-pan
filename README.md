# CAC 议会 · 静态站

一个**零依赖**的静态站点：没有框架、没有 npm 包、没有构建依赖，`node site/build.mjs` 就能出站。
内容为虚构创作，与任何现实机构、事件或人物无关。

站点目前有**四大块、二十二个页面**：

| 页面 | 路径 | 作用 |
| --- | --- | --- |
| 主页面 | `/` | 简介、公告、新闻、档案展示、论坛展示、部门轮播，分三段视觉 |
| 访问校验 | `/verify/` | 只负责登录：称呼或邮箱 + 个人密钥 |
| 注册 | `/verify/register/` | 称呼 + 邮箱 → 当场生成个人密钥（只显示一次） |
| 档案部 | `/archive/` | 独立搜索框 + 六个入口 |
| 设施 | `/archive/facilities/` | 粒子地球 + 六处据点，转到坐标后进详情 |
| 装备 | `/archive/equipment/` | 粒子装备库：常规三列、特殊三张设计图、异常封存 |
| 项目 | `/archive/projects/` | 按时间 / 编号 / 级别重排，背景随排序切换 |
| 研究论文 | `/archive/papers/` | 按作者、专业检索 |
| 行动记录 | `/archive/operations/` | 控制部行动，按时间倒序 |
| 评估报告 | `/archive/evaluations/` | 共存部评估，按时间倒序 |
| 论坛 | `/forum/` | 频道、存档与两个可玩版块的入口 |
| 午夜轮班 · 板块 | `/forum/night-shift/` | 游戏板块：置顶卡片直通游戏页，另有两帖 |
| 午夜轮班 · 游戏页 | `/forum/night-shift/play/` | WASM 小游戏本体（全屏画布，`layout: game`） |

设施详情页（`/archive/facilities/<slug>/`，共 6 个）由 `site/data/archive.json` 在构建时生成，不另外写 Markdown。

其它页面（控制部、解析部、共存部、论坛、成员档案、公告页、更多服务、关于我们、守则、搜索、旧密钥页）**仍然下架**，下架的 49 个 Markdown 文件在 `_local/archive-content/`，随时可以搬回 `site/content/` 恢复（见下面的「恢复下架的页面」）。

## 本地跑起来

```bash
node site/build.mjs      # 构建到 dist/
node site/serve.mjs      # 本地预览 http://127.0.0.1:4173
node test/all.mjs        # 测试（30 项，零依赖）
node tools/check-content.mjs   # 内容自检
```

`node site/serve.mjs 5000` 可以换端口。构建时会自动校验全站站内链接。

测试**不会碰工作副本的 `dist/`**：每个用例都设 `CAC_OUT` 指向系统临时目录再跑一次构建，用完即弃。所以可以随时 `npm test`，不用先清产物。

## 访问流程

1. 访问任意页面 → 页面头部的校验脚本发现你既没有会话标记、也没有本机账号，就把你送到 `/verify/?next=原地址`。
2. 在 `/verify/` 只有一条路：登录。
   - **登录**：称呼或邮箱 + 个人密钥。账号存在 `localStorage`，密钥只存加盐 `SHA-256` 散列；这台设备之后进站直接放行。
   - **还没注册**：点页面下方的「去注册领一串」到 `/verify/register/`，填称呼 + 个人邮箱，系统当场生成密钥（**只显示这一次**，抄下来才算数）。
3. 校验通过后播放一段加载动画（进度条 + 三段状态文字），然后回到你原本要去的地址。

**没有访客通道**：不注册就进不来，这是刻意的。旧的密码账号会在下次注册同名时被就地改成密钥方式（会提示）。

**这不是安全措施**：静态站点的内容对拿到地址的人都可见，它只是一道门槛与氛围。真要挡人只能上服务端。相关配置在 `site/site.config.mjs` 的 `gating`（`enabled` 关掉整道门，`route` 换校验页地址）。

## 主页面结构

`site/content/index.md` 只写 front-matter 和一段简介，各板块由 `lib/layout.mjs` 的 `homeBlocks()` 生成：

| 板块 | 内容从哪来 | 跳转 |
| --- | --- | --- |
| 顶栏 | 左 CAC 图标（回主界面）→ 中间检索框（按钮，开检索浮层）→ 右头像菜单 | 菜单收在头像下拉里 |
| 标题区 | 大标题 + `intro` 短句 + 三个按钮（锚点跳页内板块） | 页内锚点 |
| 简介列 | 正文（`#about`）+「更多服务」「声明准则」锚点 | 页内锚点 |
| 公告列 | 站点事务，取最近 4 条（`#announcements`） | 纯展示 |
| 新闻列 | **本站动态**（`#news`）；有配图就图+文，没有就纯文字 | 纯展示，不外链 |
| 档案 | SCP 式面板：两份「最近新增」列表 + 三张精品卡（标题 / by 作者 / 引言） | 纯展示，标「重写中」 |
| 论坛 | 图片 + 文字卡片，不显示发布者 | 纯展示，标「重写中」 |
| 部门 | 单部门轮播：理念 + 数据成果，自动切换 + 箭头 + 指示点 | 纯展示 |
| 更多服务 | 站内入口与状态清单（`#services`） | 纯展示 |
| 声明准则 | 四条声明（`#rules`） | 纯展示 |
| 底栏 | 三个入口（更多服务 / 声明准则 / 关于我们 → 都是页内锚点）+ 滚动字符条 | 页内锚点 |

首屏是设计目标：1440×900 与 1200×700 两种窗口下，**标题区 + 简介 / 公告 / 新闻三列都完整落在第一屏内**（实测三列底部 y=695 < 700）。

### 三段分区，三套视觉语言

主页面按内容气质切成三块，每块有自己的背景层（`.zone__bg`，`z-index: -1`，靠 `isolation: isolate` 关在本区里）与交互：

| 分区 | 内容 | 背景 | 交互 |
| --- | --- | --- | --- |
| `.zone--signal` | 首屏 + 简介 / 公告 / 新闻 | 指针驱动的双向光场 + 点阵（跟着指针位移并做径向遮罩）+ 28 秒一圈的锥形扫掠 | 指针写入 `--zx/--zy/--zp/--zq`；点击在落点炸一圈涟漪 |
| `.zone--strata` | 档案 / 论坛 | 58px 横向沉积层 + 细密纹理层（随指针纵向错动）+ 一条跟随指针高度的扫描线 | 同上，但只用到纵向 `--zq` |
| `.zone--axis` | 三个部门 | 一条中轴 + 三道光束，只有当前部门那一道亮起 | 轴刻度带标签（原圆点改造）；钉住滚动推进；点击涟漪 |

指针变量只在 `(hover: hover) and (pointer: fine)` 且未开启减少动效时写入，读取全部落在 rAF 里。

## 档案部

`/archive/` 是一个独立的小站：自己的搜索框（只筛本部门六个入口，不是全站检索），六条去路。所有列表都在**构建时渲染成 HTML**，JS 只负责交互；粒子画布是纯装饰，`prefers-reduced-motion` 下整块不加载动画、只画一帧。

### 粒子引擎

一个文件 [morphfield.js](site/assets/js/morphfield.js) 两种模式，九种形状：

| 模式 | 用途 | 机制 |
| --- | --- | --- |
| `globe` | 设施页、设施详情 | 球面点云（面积自适应 900–2200 粒），可拖动旋转；`focus(lat, lon)` 把某坐标转到正面（ψ = 90° − λ）；设施标记按类型上色，背面自动压暗 |
| `cloud` | 装备页、项目页 | 点云在形状之间插值：每个粒子以 6% 的步长追自己的目标点，中途看起来就是「散开再重组」 |

形状全部是**程序化采样**出来的线框，没有外部模型：`gun` / `grenade` / `armor`（常规三列）、`anchor` / `k96` / `suit`（三张设计图）、`neural` / `cell` / `thought`（项目页三种排序背景）。采样器就四个：线段、盒线框、圆柱、球面（外加圆环与旋转/缩放/平移）。

### 六个页面的交互

- **设施**：左侧列表 `pointerenter` / `focus` / 点击 → 地球转到该坐标 + 右侧面板换文案；`→` 进入详情页。详情页复用同一个引擎，但锁在那个坐标上。
- **装备**：`常规` 三列各有自己的画布（枪械 / 投掷物 / 护具）；`特殊` 用页面级画布，**每 60 秒**散开重组成下一张设计图，点任意一张立刻切；`异常` 只有封存说明。
- **项目**：排序按钮同时换列表顺序与背景形状——按时间 → 神经网，按编号 → 细胞，按级别 → 思维空间。
- **论文**：作者、专业两个输入，即时过滤（`input` 事件），带 `datalist` 候选。
- **行动 / 评估**：构建时就按日期倒序排好，`<time datetime>` 保留机器可读值。

数据都在 `site/data/` 下，改文案不用碰代码：

- `notices.json` — 公告（`announcements`）与本站新闻（`news`）。
- `home.json` — 档案面板与精品卡（`archives`）、论坛话题（`forum`）、服务清单（`services`）、声明条文（`rules`）。
- `image-credits.json` — 配图出处。

## 论坛板块：午夜轮班（WebAssembly）

`/forum/night-shift/⟫T⟫ 是论坛里的游戏板块，置顶卡片点进 `/forum/night-shift/play/⟫T⟫：一间便利店，五分钟一个班次，从 00:00 守到 06:00。

| 层 | 文件 | 说明 |
| --- | --- | --- |
| 规则 | `assets/games/shift-at-midnight/src/shift.ts⟫T⟫ → `shift.wasm⟫T⟫ | AssemblyScript 编译，约 5 KB；时间、来客、判定、结算全在这一层，零宿主依赖 |
| 画面 | `js/art.js⟫T⟫ | 480×300 逻辑坐标的 Canvas 手绘；静态层缓存到离屏画布，没有贴图与音频文件 |
| 文案 | `js/text.js⟫T⟫ | 中文全在前端；WASM 只给数字 |
| 控制 | `js/game.js⟫T⟫ | 载入 wasm、每帧推进、写 DOM、键位 1–4 与按钮、WebAudio 现场合成音效 |
| 外壳 | `site/lib/layout-game.mjs⟫T⟫ | `layout: game⟫T⟫ 的独立页：不挂顶栏与 `main.css⟫T⟫，门禁复用 `guardScript()⟫T⟫ |

~~~bash
npm run build:wasm   # 改完 shift.ts 重新编译；产物已提交，部署时不需要编译器
~~~

构建期依赖只有 `assemblyscript⟫T⟫（devDependencies），站点产物仍然一个依赖都不带。字段表、数值与替换方式见[游戏目录的 README](site/assets/games/shift-at-midnight/README.md)。

**为什么不是原游戏**：工作副本里那份 `Shift At Midnight Demo⟫T⟫ 是 Windows/IL2CPP 构建，没有 WebGL 目标；可执行文件不能直接变成网页，Unity 只能从工程重新导出 WebGL。所以这一版按同一题材重写，没有使用原游戏的任何素材。以后拿到 WebGL 构建，替换步骤写在游戏目录的 README 里。

## 恢复下架的页面

```bash
# 全部恢复
Copy-Item _local\archive-content\* site\content\ -Recurse -Force

# 只恢复某一个分区
Copy-Item _local\archive-content\control site\content\ -Recurse
```

恢复后还需要把 `site/legacy.mjs` 里对应的旧地址映射加回来（现在只留了指向主页面的几条），并在 `site/site.config.mjs` 的 `menu` 里把入口加回去——菜单现在只列真实存在的去处，这样不会出现死链。

主页面上的档案 / 论坛条目现在是纯展示。恢复资料库页面后，把 `site/data/home.json` 里对应条目的 `link` 字段填上，`homeBlocks()` 就会把标题渲染成链接（渲染层已经支持：有 `link` 出链接，没有就出纯文本）。

## 目录结构

```
site/
  content/            首页、404、校验页、档案部、论坛与午夜轮班板块
  data/               notices.json / home.json / image-credits.json
  assets/img/         配图（首屏背景、论坛封面、档案封面，合计约 570 KB）
  content/forum/night-shift/  游戏板块：板块页、游戏页、值班手册、夜班记录
  lib/content.mjs     读内容、解析 front-matter、渲染正文（纯函数为主，可直接测）
  lib/derive.mjs      由页面集合派生侧栏/卡片/分页/索引/sitemap（纯函数）
  lib/html.mjs        模板共用工具：转义、部署前缀、日期格式
  lib/layout-archive.mjs  档案部六个版式 + 设施详情
  data/archive.json   档案部全部数据：设施、装备、项目、论文、行动、评估
  lib/markdown.mjs    自写的 Markdown 渲染器（含 ::: 容器语法）
  lib/layout.mjs      页面模板（顶栏、主页面各板块、校验页、侧栏、目录、分页、页脚、检索浮层）
  lib/layout-game.mjs 游戏页外壳（`layout: game`）：全屏画布，不挂顶栏与 main.css
  assets/games/shift-at-midnight/  WASM 游戏：src/shift.ts、shift.wasm、js/、css/
  assets/css/         main.css（结构 + 三色）+ theme-legacy.css（红黑还原）+ motion.css（动效层）
  assets/js/          site.js（菜单 / 检索 / 轮播 / 配色切换）、verify.js（校验页流程）、
                      key.js（密钥格式）、accounts.js（账号与校验语义）、ocean.js（粒子海洋）、
                      morphfield.js（档案部粒子引擎）、archive.js（档案部交互）、motion.js（动效层）
  assets/css/archive.css  档案部专用样式（只在档案页加载）
  build.mjs           构建器：扫描内容 → 渲染 → 输出 dist/
  serve.mjs           本地服务器
  site.config.mjs     站名、菜单、底栏入口、部门轮播、分区、配色、访问校验
  legacy.mjs          旧地址 → 新地址映射（正文改写 + 跳转页）
tools/
  crawl.mjs           从前身站点抓取整站（迁移用，可选）
  extract-content.mjs 把抓下来的正文转成 Markdown（只在做迁移时用）
  check-content.mjs   内容自检
test/                 测试入口 all.mjs + 八个 *.test.mjs（node:test，零依赖）
docs/                 迁移记录、动效拆解、设计参考（含 _raw/ 原始证据）
dist/                 构建产物（.gitignore 里）
_local/               本地素材，不进仓库：归档内容、截图、取图脚本、爬取结果
```

## 写内容

在 `site/content/` 里新建 `.md`，路径就是网址：`site/content/control/cac-project-042.md` → `/control/cac-project-042/`。

```markdown
---
title: CAC-042「渗水」      # 页面标题（必填）
subtitle: 项目档案 · 三级（已静止）
summary: 一句话提要（列表卡片与检索用）
section: control           # 归到哪个分区（决定侧栏分组）
group: 项目资料             # 分区内的分组标题
order: 5                   # 组内排序，越小越前
updated: 2026-10-11
status: 未完成              # 可选，显示成角标
author: Fersolution        # 可选，标题下生成「撰稿 xxx」
locked: true               # 可选，需要先通过访问校验
---

正文用 Markdown。站内链接写 `/control/`，渲染时会自动补结尾斜杠并加上部署前缀。
```

自定义容器：`::: grid cols="3"`、`::: entry title= href=`、`::: card`、`::: post title= author=`、`::: note/warn/danger`、`::: timeline`、`::: spoiler`。Markdown 的 `#` 渲染成 `<h2>`（页面 h1 来自 front-matter 的 `title`）。

## 部署到 GitHub Pages

站点是**纯静态产物**：没有任何服务端运行时代码，构建完只剩 HTML/CSS/JS/图片。所以 GitHub Pages 直接可用，第三方库也只能以两种方式进来——构建时打包，或运行时从 CDN 加载（本项目用后者，见 `site/assets/js/v3d.js`），且必须有加载失败时的降级路径。

仓库 → Settings → Pages → Source 选 **GitHub Actions**；推送 `.github/workflows/deploy.yml` 即可。
项目站点会自动带上仓库名前缀（`CAC_BASE`），站点地址用 `CAC_SITE_URL`。

```bash
CAC_BASE=/仓库名 CAC_SITE_URL=https://用户名.github.io/仓库名 node site/build.mjs
```

两条与游戏页有关的部署常识：

- 产物里有一个 `assets/games/shift-at-midnight/shift.wasm⟫T⟫（约 5 KB）。GitHub Pages 会以 `application/wasm⟫T⟫ 提供它，不需要额外配置；本地用 `node site/serve.mjs⟫T⟫ 时也已经登记了这个 MIME。
- GitHub Pages 对**单个文件**有 100 MB 上限。WASM 版远在这个线以下；如果要换成 Unity 的 WebGL 构建，`.data⟫T⟫ 常常超过 100 MB，得拆分或放到外部存储。

## 动效层

`site/assets/css/motion.css` + `site/assets/js/motion.js`，**全部原生实现，没有引入任何库**：

| 效果 | 参考出处 | 实现要点 |
| --- | --- | --- |
| 首屏星场 | cosmicbroth.com（真 `<canvas>`，约 500 颗） | 半径与速度按视口比例算；照片与星场按 1.0 : 0.8 分层错位；切到后台暂停，约 25fps |
| 极光 / 光束 / 聚光 / 网格 | Aceternity Aurora、Background Beams、Spotlight | 纯 CSS 渐变 + 缓慢旋转，**没有 WebGL** |
| 标题逐字入场 | ReactBits SplitText | 按码点切字（中文不会拆坏），原文存进 `aria-label` |
| 卡片聚光 + 倾斜 + 描边流光 | Aceternity Spotlight / 3D Card | 指针坐标写进 CSS 变量，rAF 节流，尺寸缓存（不在 pointermove 里读布局） |
| 数字滚动 | ReactBits CountUp | 进视口触发一次，无 JS 时显示静态数字 |
| 部门轮播 | career.huawei.com（实测参数） | 横向位移 `.3s cubic-bezier(.4,0,.2,1)`、非激活 `opacity:.1`、指示点 4→16px 不加过渡、5000ms、箭头 hover 才露出 |
| 切角与四角括号 | cosmicbroth.com「零圆角 + clip-path 切角」 | 档案面板头部右上角 `clip-path` 切一刀；轮播卡四角伪元素括号 |
| 校验页扫描线 + 扩散过场 | — | 网格 + 扫描光束；通过时从按钮位置扩散一圈再跳转 |
| 页面转场 | wodniack.dev 的思路 | `@view-transition` 原生跨文档转场，不支持的浏览器用 JS 淡出兜底 |
| 点击火花 / 磁吸 / 阅读光束 / 走马灯 / 回到顶部 | uiverse.io、ReactBits、Aceternity | 只动 transform / opacity / filter |
| 碎片聚散 | species-in-pieces.com 的三角碎片法，降到 8 片 | `clip-path` 多边形 morph；每条 polygon 恒为 3 个点才能线性插值；无 JS 时直接是组装态 |
| 部门钉住序列 | nodcoding.com 的编号章节 | 宽屏 + 精确指针 + 未开减少动效时，容器拉高、轮播 `sticky`、滚动推进编号；三个条件缺一即回退自动播放 |
| 校验页背景 | 自绘 canvas | 粒子海洋 + 鱼群：洋流漂移、指针推开、点击涟漪、半透明拖尾；切后台停、`reduced` 只画一帧 |
| 校验页出入场 | — | 卡片浮起 + 海洋淡入；通过后是加载层（进度条 + 三段状态文字），不是直接跳转 |
| 主页面分区背景 | — | 信号场 / 沉积层 / 三轴，三套独立语汇；指针位置经 rAF 写进 CSS 变量，点击炸涟漪 |
| 档案部粒子 | 自绘 canvas | 地球与形状重组共用一套引擎：球面点云 / 九种程序化线框，面积自适应的粒子数 |
| 3D 地球 | Three.js（运行时 CDN 动态 import） | 真球体 + 程序化地表贴图（同一份陆地轮廓画成等距圆柱投影）+ 加色大气层 + 设施光点；拖拽旋转、列表驱动 `focus(lat, lon)`；**加载失败自动退回 2D 点云**，宽屏且未开减少动效才启用 |

### 三条硬约束

1. **默认可见**：所有"待入场"的隐藏态都写在 `html.js` 下。JS 关闭、脚本加载失败（2 秒兜底）或 `prefers-reduced-motion: reduce` 时，页面直接呈现最终状态。
2. **只动合成属性**：只用 transform / opacity / filter，滚动里不读写布局。
3. **移动端隔离**：光标氛围、磁吸、倾斜、聚光、点击火花都要求 `(hover: hover) and (pointer: fine)`。
4. **新动效也要自己兜底**：碎片聚散在无 JS 时直接是组装态；部门钉住序列在 `prefers-reduced-motion`、触屏或窄屏下整段不生效，轮播回到自动播放；粒子海洋在 `reduced` 下只画一帧静态画面。

## 配图与出处

首屏背景、论坛封面、档案封面来自 **NASA 图片库**（公有领域），下载在 `site/assets/img/`（约 570 KB），出处与 NASA ID 记在 [site/data/image-credits.json](site/data/image-credits.json)。重新抓取用 `_local/tools/fetch-images.mjs`（本地工具，不进仓库）。

## 自检情况

| 检查 | 方法 | 结果 |
| --- | --- | --- |
| 站内链接 | 构建时扫描全部内部 href | 全部有效（主页面只链向 `/`、`/verify/` 与页内锚点） |
| 访问守卫 | 无标记直接访问 `/` | 被送到 `/verify/?next=/`，校验页正常渲染 |
| 访客进入 | 打标记后访问 `/` | 主页面正常渲染 |
| 注册 / 登录 | 填表提交 | 落到 `/`，账号表与会话写入本机；散列用 `crypto.subtle` SHA-256 |
| 无 JS 可用 | iframe `sandbox="allow-same-origin"`（禁用脚本） | 内容全部可见，入场隐藏态不生效 |
| 减少动态效果 | Edge `--force-prefers-reduced-motion` | 动画关闭、直接最终态，星场不启动 |
| 窄屏 | 390px iframe 内测 `scrollWidth` | 等于视口宽，无横向溢出 |
| 首屏 | 1440×900 与 1200×700 下量三列底部 | y=695，两种窗口都在首屏内 |
| 内容自检 | `node tools/check-content.mjs` | 3 个 Markdown 文件，无提示词残留 |
| 测试 | `node test/all.mjs` | 68 项全绿：Markdown 8、内容层 5、派生层 7、密钥 6、账号语义 9、构建集成 12、档案部 10、WASM 与游戏页 9 |

### 三个踩过的坑（写在这里免得再犯）

1. **不要给 `body` 加 `overflow`**：浏览器会把 body 的 overflow 传播到视口，整页滚不动。
2. **也不要给 `html` 加 `overflow-x: clip`** 挡横向溢出：`visible` 与 `clip` 组合会把另一轴也算成 `clip`，纵向滚动一起消失。正确做法是让装饰层由自己的容器裁切。
3. **门禁类页面垂直居中别用 `justify-content: center`**：内容比视口高时顶部会被切掉且滚不上去，用 `margin-block: auto`。

## 版权

- 站内原创内容默认采用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.zh)。
- 下架的论坛帖里有两篇**转载的轻小说文本**（版权归原作者，原文在 `_local/archive-content/forum/`）。若你是权利人并希望移除，删掉对应文件即可；它们目前不在站点上。

---

## 当前状态（前端重建进行中）

> 本节由前端重写工作追加，**上面的目录与说明以“内容层”为准，视觉层正在被替换**。

- 站点可运行：`node site/build.mjs` 后 `node site/serve.mjs 4180`。
- 访问流程已定稿为**「密钥 + 账号」**（校验页 `/verify/`），不再提供访客入口。
- 新工艺层在 `site/assets/css/craft.css`（设计系统 + 部门分段）与 `site/assets/js/craft.js`（loader / SVG 波浪 / 行遮罩 / 光标磁性 / 分段）；隔离验证页 `/assets/demo/craft.html`。
- 已上线的外壳层：`craft-chrome.css` + `craft-chrome.js`（颗粒 / 自定义光标 / 页面过渡），两页各挂一次。
- 进度、证据与未决项见 [docs/rebuild-notes.md](docs/rebuild-notes.md)；In Pieces 的一手实测见 [docs/craft-in-pieces.md](docs/craft-in-pieces.md)。

## 前端工艺层（craft）

视觉与动效被单独隔离成三层，全部原生手写、零运行时依赖，且都有 `prefers-reduced-motion` 与无 JS 降级：

| 文件 | 作用 | 挂载方式 |
| --- | --- | --- |
| `assets/css/craft.css` + `assets/js/craft.js` | 设计系统（7 级字号阶梯、`--ease` 曲线）、loader（`pathLength` 线描 + 真进度）、SVG 波线、行遮罩、光标、部门分段 | 隔离验证页 `/assets/demo/craft.html` |
| `assets/css/craft-chrome.css` + `assets/js/craft-chrome.js` | **外壳层**：-45° 条纹质感、自定义光标、页面过渡、首屏点阵波线、页面套框（自绘）、档案行 hover 与逐条揭示、轮播方向感知、正文链接擦出、编辑入口 | 由 `layout.mjs` 在 `motion.css` / `motion.js` 之后各插一次（幂等拼接） |

### 校对工具（仅 devDependencies，不进产物）

```bash
npm run check        # 内容自检（禁用词、front-matter）
npm run check:text   # 文案校对：ASCII 引号、中英间距
npm run verify       # 测试 + 内容自检
```

`zhlint`（中文标点排版）与 `pangu`（中英间距）装在 `devDependencies` 里，只用于校对；站点产物仍然一个依赖都不带。

### 编辑与协作

每页右下角「编辑此页 ↗」直接跳 GitHub 在线编辑器（`site/content/<路径>/index.md`），提交后 Actions 自动重建。新建页面在 `site/content/` 下加 `.md`、写 `title` 即可。这是纯静态站实现多人协作编辑的现实路径，不需要后端。

### 参考站一手调研

- `docs/craft-wodniack.md` —— wodniack.dev 线上产物 + 官方仓库双证（上版备份在 `docs/_raw/wodniack/craft-wodniack.PREV.md`）
- `docs/craft-in-pieces.md` —— In Pieces 的实测（**没有 CSS 3D**，"翻转"是 `clip-path` 三点插值；三条时序公式）
- `docs/rebuild-notes.md` —— 重建过程的判断、留/弃边界与环境坑
