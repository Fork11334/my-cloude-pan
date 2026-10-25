# 午夜轮班 · SHIFT AT MIDNIGHT（WASM 版）

论坛板块「午夜轮班」里的那款网页小游戏。五分钟一个班次，从 00:00 守到 06:00。

- 游戏页：`/forum/night-shift/play/`（页面模板见 `site/lib/layout-game.mjs⟫T⟫）
- 板块页：`/forum/night-shift/⟫T⟫
- 内容入口：`site/content/forum/night-shift/play.md⟫T⟫（只有 front-matter，`layout: game⟫T⟫）

## 结构

| 文件 | 作用 |
| --- | --- |
| `src/shift.ts⟫T⟫ | AssemblyScript 源码：时间、来客、判定、结算。**这一层没有任何中文，也不碰 DOM** |
| `shift.wasm⟫T⟫ | 编译产物，约 5 KB，已提交；部署时不需要再装编译器 |
| `js/state.js⟫T⟫ | 状态字段号（与 `state(i)⟫T⟫ 一一对应） |
| `js/text.js⟫T⟫ | 全部中文文案：来客台词、查证结果、反馈、收音机、评级 |
| `js/art.js⟫T⟫ | Canvas 画面：480×300 逻辑坐标，全部现画，没有贴图与音频文件 |
| `js/game.js⟫T⟫ | 载入 WASM、每帧推进、写 DOM、接键盘与按钮、合成音效 |
| `css/shift.css⟫T⟫ | 游戏页样式，自带一套变量，不依赖 `main.css⟫T⟫ |

前端只做三件事：把状态读出来、把画面画出来、把按钮接进去。所有规则都在 WASM 里。

## 重新编译

~~~bash
npm install            # 只装构建期依赖（assemblyscript）；站点产物本身仍然是零依赖
npm run build:wasm     # asc src/shift.ts -o shift.wasm -O3 --runtime stub --noAssert
~~~

编译产物直接落在本目录，构建器会把整个 `assets/⟫T⟫ 原样拷进 `dist/⟫T⟫。

## 状态字段

`state(i)⟫T⟫ 的字段号写在 `js/state.js⟫T⟫ 的 `S⟫T⟫ 里，两边必须一致（测试会比对导出名）。

| 字段 | 含义 |
| --- | --- |
| 0 phase | 7 未开始 / 0 空档 / 1 进门 / 2 柜台前 / 3 结算反馈 / 4 离开 / 5 敲门 / 6 结束 |
| 1 clock | 班次内分钟数（0–360），每秒推进 1.2 分钟 |
| 2 money / 3 sanity / 4 battery | 营业额 / 理智 / 手电电量 |
| 5 kind | 0 无 / 1 普通 / 2 熟客 / 3 醉汉 / 4 未成年 / 5 缺证 / 6 兜帽客 / 7 影子 |
| 6 demand | 0 烟 / 1 酒 / 2 加油 / 3 问路 / 4 咖啡 / 5 打火机 |
| 7 walk / 8 patience / 26 patienceMax | 走动进度（0–1000）/ 剩余耐心 / 耐心上限（百分之一秒） |
| 9 checked / 10 lastAct | 是否查过证件 / 上一个动作 |
| 11–14 feedback / feedbackT / tone / shake | 反馈文案号、余留时间、语气（0 中性 / 1 好 / 2 坏）、震屏强度 |
| 15–18 served / refused / incidents / total | 接待、拒绝、事故、来客总数 |
| 19–20 ending / rank | 结局（1 天亮 / 2 崩溃）/ 评级（1 S … 4 C，崩溃为 0） |
| 21–23 radio / knockDone / flash | 收音机第 n 条 / 敲门是否处理过 / 手电余辉 |

## 数值（改平衡时看这里）

- 班次 300 秒现实时间，每小时 50 秒。
- 理智每秒掉 0.06（一整班约 18 点）；一次事故掉 8–26；归零即失败。
- 电量 5 格起步、上限 8 格，03:00 与 05:00 各补 2 格。
- 评级：S ≥ ¥800 且理智 ≥ 70；A ≥ ¥600；B ≥ ¥400；其余 C。
- 03:33 后门会有人敲门，只来一次；不理会掉 8 点理智。

## 和原 Unity 工程的关系

这是**按同一题材重写的网页版**，不是原游戏的移植。原工程是本机上的 Windows/IL2CPP 构建，没有导出 WebGL——Windows 的可执行文件不能直接变成网页，Unity 只能从工程重新导出 WebGL。

如果以后拿到了 WebGL 构建（Unity 导出的 `Build/*.loader.js⟫T⟫、`*.wasm⟫T⟫、`*.data⟫T⟫），把它放进本目录下的 `unity/Build/⟫T⟫，再把 `site/lib/layout-game.mjs⟫T⟫ 里的画布换成 Unity 的 `createUnityInstance⟫T⟫ 挂载点即可，`js/⟫T⟫ 与 `css/⟫T⟫ 这一套可以整体撤掉。注意 GitHub Pages 单文件上限 100 MB，Unity 的 `.data⟫T⟫ 常常超，需要拆分或用外部存储。

## 署名

站点原创代码，随站点一起按 CC BY-SA 3.0 发布。没有任何第三方素材：画面是 Canvas 路径，声音是 WebAudio 现场合成的。题材上的致敬不涉及素材复制。
