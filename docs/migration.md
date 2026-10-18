# 旧站迁移记录

本站的前身是 `biwu-cac-cn.wikidot.com`（Wikidot 平台，已停止更新）。这份文档记录迁移过程，方便日后核对或重新抓取。

## 抓了什么

`tools/crawl.mjs` 从旧站抓了 **43 个地址**（含所有 404 记录），原始 HTML 存在 `_local/crawl/`：

- `_local/crawl/raw/<slug>.html` —— 整页原始 HTML（留档）
- `_local/crawl/content/<slug>.html` —— 只取 `#page-content` 的正文片段（转换用）
- `_local/crawl/pages.json` —— 页面清单：标题、路径、字数、外链数

抓取只走同一个站、每页间隔 350ms、最多 150 页，跳过 `/system:`、`/admin`、`/feed`、资源文件与论坛分页。

## 对照结论

| 旧站页面 | 情况 | 现在 |
| --- | --- | --- |
| `/new` | 免责声明（1627 字） | `/rules/`，改写成自建站点的说法 |
| `/control` | 控制部导航（4 组 16 个入口） | `/control/`，改为自动生成的分组卡片 |
| `/cac-project` | 项目列表 | `/control/cac-project/` |
| `/cac-project-1096` | 只写了一个小节「祖父和雨」 | 原样保留，标「未完成」 |
| `/golden` | 恶搞项目文档 + 评论区 | `/golden/`，评论区转成帖子样式 |
| `/bqnztdl` | 转载轻小说（2.7 万字） | `/bqnztdl/`，带「转载内容」横幅 |
| 8 篇论坛讨论串 | 生活信道 / 内部频道 / 作业频道 | `/forum/`，只读存档 |
| `/start`、`/cac` | 几乎是空页（各只有一句话） | 首页与数据库页按 `2.txt`、`3.txt` 草稿重建 |
| **15 个入口** | **旧站是 404**（控制部 13 个子页 + 解析部 + 共存部） | 全部补写了正文，见 `site/content/` |

旧站的样式没有可复用的主题文件（`biwu-cac-cn.wdfiles.com/local--theme/cac/style.css` 现在已经抓不到，连接被重置），但每页 head 的内联 `<style>` 里留了作者自己写的主题，要点如下，已还原到 `site/assets/css/theme-legacy.css`：

| 元素 | 旧站原文 |
| --- | --- |
| 页头 | `border-bottom: 2px solid #a00`、`h1 { color: #e66 }`、居中 |
| 卡片 | `#1e1e1e` 底、`#3a3a3a` 边、圆角 10px、`box-shadow: 0 3px 8px rgba(0,0,0,.5)` |
| 卡片标题 | `#f0c0c0` 配 `#b33` 左竖条，hover 变红边 + 淡红发光 |
| 链接 | `#89a9ff`，hover `#ff8c8c` |
| 引用块 | `#2a2a2a` 底、`#444` 边、`#bbb` 字 |
| 页脚 | `1px dashed #444` 上边框 |
| 字体 | `'Trebuchet MS', 'Segoe UI', sans-serif` |

页面底色旧站由 Wikidot 主题提供、没能取到，`theme-legacy.css` 里按卡片 `#1e1e1e` 反推为 `#141414`。

## 旧地址对照

24 条旧地址会生成跳转页，映射写在 `site/legacy.mjs`（正文里的旧链接也会被自动改写）：

```
/start            → /
/new              → /rules/
/cac-project-001  → /control/cac-project-001/
/control-department-rsu → /control/rsu/
/cac-project      → /control/cac-project/
…共 24 条，见 site/legacy.mjs
```

唯一没生成的是 `/forum:start` —— Windows 文件名不允许冒号，建不出这个目录；部署在 Linux 上若需要，可以手工补一个跳转页。

## 重新抓取（可选）

旧站如果还有新内容，按顺序跑：

```bash
node tools/crawl.mjs            # 重新抓整站 → _local/crawl/
node tools/extract-content.mjs  # 转换迁移页 → site/content/
node site/build.mjs
```

`extract-content.mjs` **只负责从旧站搬来的 11 个页面**（`golden.md`、`bqnztdl.md`、`control/cac-project-1096.md`、8 篇论坛讨论串），不会碰人工撰写的页面——重新抓取不会覆盖首页、守则、以及控制部那些档案。

## 迁移中修掉的问题

1. **Wikidot 语法残留**：`//斜体//` 写在 `[[html]]` 块里不会被解析，页面上会原样显示两个斜杠；`{$变量}` 是组件模板占位符，会漏进正文。
2. **组件外壳**：`/golden` 页带着 SCP 的 `info-container` 折叠组件与评分挂件，已剥离，只保留正文与警告语。
3. **链接失效**：旧站有 `class="newpage"` 的链接指向从未建立的页面（`/scp-447` 等），转成带提示的灰字而不是死链。
4. **编号跳号**：守则的条款编号从 8 直接跳到 10，已修正。
5. **标题层级**：`####` 四级标题代替正文段落的地方（附件里的「说明」）改成引用块。
6. **过时表述**：守则里多处「本网站建立在 Wikidot.com 平台上」「违反 Wikidot 服务条款」，已改写成自建静态站点的说法。
7. **真实昵称**：旧站论坛的昵称只出现在 `/user/` 的成员档案里；控制部人员名单用的是虚构代号，避免把真人写进虚构编制。

上一轮还基于这些源码做过一版 Wikidot 页面代码，归档在 `old-wikidot/`（含当时的问题清单 `README-wikidot.md`），不参与本站部署。
