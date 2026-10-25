/* ==========================================================================
   游戏页外壳（layout: game）
   和站内其它页不同：它不挂顶栏、不挂 main.css —— 全屏画布需要一个干净的
   <body>，样式只有 assets/games/shift-at-midnight/css/shift.css 一份。
   门禁脚本仍然复用 layout.mjs 导出的 guardScript，语义与全站一致。
   ========================================================================== */

import { esc, u } from './html.mjs';
import { guardScript } from './layout.mjs';

const GAME = '/assets/games/shift-at-midnight';

export function renderGamePage({ site, page }) {
    const title = page.title + ' · ' + site.name;
    const desc = page.summary || site.description;
    const canonical = site.baseUrl ? site.baseUrl.replace(/\/$/, '') + page.route : '';
    const back = u(site, '/forum/night-shift/');
    const handbook = u(site, '/forum/night-shift/handbook/');

    return '<!DOCTYPE html>\n' +
'<html lang="' + esc(site.lang) + '" data-theme="' + esc(site.appearance?.defaultTheme || 'legacy') + '">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
'<title>' + esc(title) + '</title>\n' +
'<meta name="description" content="' + esc(desc) + '">\n' +
'<meta name="color-scheme" content="dark">\n' +
(page.noindex ? '<meta name="robots" content="noindex">\n' : '') +
(canonical ? '<link rel="canonical" href="' + esc(canonical) + '">\n' : '') +
'<meta property="og:title" content="' + esc(page.title) + '">\n' +
'<meta property="og:description" content="' + esc(desc) + '">\n' +
'<meta property="og:type" content="website">\n' +
'<link rel="icon" href="' + u(site, '/assets/favicon.svg') + '" type="image/svg+xml">\n' +
'<link rel="stylesheet" href="' + u(site, GAME + '/css/shift.css') + '">\n' +
guardScript(site, page) + '\n' +
'</head>\n' +
'<body class="shift-body">\n' +
'<main class="shift" data-shift-board>\n' +
'  <header class="shift__bar">\n' +
'    <a class="shift__back" href="' + back + '">← 午夜轮班 · 板块</a>\n' +
'    <p class="shift__name">SHIFT AT MIDNIGHT <span>· WASM</span></p>\n' +
'    <div class="shift__tools">\n' +
'      <button type="button" data-shift-sound aria-pressed="false">声音 关</button>\n' +
'      <button type="button" data-shift-full>全屏</button>\n' +
'    </div>\n' +
'  </header>\n' +
'\n' +
'  <section class="shift__hud" aria-label="班次状态">\n' +
'    <div class="hud__now">\n' +
'      <p class="hud__clock" data-shift-clock>00:00</p>\n' +
'      <p class="hud__hour" data-shift-hour>第 1 / 6 小时</p>\n' +
'    </div>\n' +
'    <div class="hud__track" role="img" aria-label="班次进度">\n' +
'      <span class="hud__fill" data-shift-track></span>\n' +
'      <i class="hud__tick" style="left:16.66%"></i><i class="hud__tick" style="left:33.33%"></i>' +
'<i class="hud__tick" style="left:50%"></i><i class="hud__tick" style="left:66.66%"></i><i class="hud__tick" style="left:83.33%"></i>\n' +
'    </div>\n' +
'    <ul class="hud__stats">\n' +
'      <li class="stat"><span>营业额</span><b data-shift-money>¥0</b></li>\n' +
'      <li class="stat"><span>理智</span><b data-shift-sanity>100</b><i class="stat__bar"><em data-shift-sanity-bar></em></i></li>\n' +
'      <li class="stat"><span>电量</span><b data-shift-battery>5 / 8</b><i class="stat__bar"><em data-shift-battery-bar></em></i></li>\n' +
'    </ul>\n' +
'  </section>\n' +
'\n' +
'  <section class="shift__stage" data-shift-stage>\n' +
'    <canvas class="shift__canvas" data-shift-canvas width="960" height="600" role="img"\n' +
'            aria-label="夜里的便利店：货架、柜台和门，来客从右边的门进来"></canvas>\n' +
'\n' +
'    <div class="bubble" data-shift-bubble data-show="0" data-kind="0" aria-live="polite">\n' +
'      <p class="bubble__who" data-shift-who>顾客</p>\n' +
'      <p class="bubble__line" data-shift-line></p>\n' +
'      <p class="bubble__id" data-shift-id data-show="0"></p>\n' +
'      <span class="bubble__time"><i data-shift-patience-bar></i></span>\n' +
'    </div>\n' +
'\n' +
'    <p class="toast" data-shift-toast data-show="0" data-tone="0" role="status" aria-live="polite"></p>\n' +
'\n' +
'    <div class="alarm" data-shift-alarm data-show="0" role="alert">\n' +
'      <p class="alarm__title">后门有人在敲</p>\n' +
'      <p class="alarm__keys"><kbd>1</kbd> 开门　<kbd>4</kbd> 别出声</p>\n' +
'    </div>\n' +
'\n' +
'    <div class="veil" data-shift-veil data-show="1" data-mode="loading">\n' +
'      <div class="veil__card">\n' +
'        <div class="veil__panel" data-veil-loading>\n' +
'          <p class="veil__kicker">正在载入</p>\n' +
'          <h1 class="veil__title">WebAssembly 模块</h1>\n' +
'          <p class="veil__text">shift.wasm · 约 5 KB · 时间、来客、判定都跑在这一层里。</p>\n' +
'          <p class="veil__spin" aria-hidden="true">▍</p>\n' +
'        </div>\n' +
'\n' +
'        <div class="veil__panel" data-veil-intro hidden>\n' +
'          <p class="veil__kicker">论坛 · 午夜轮班板块</p>\n' +
'          <h1 class="veil__title">午夜轮班</h1>\n' +
'          <p class="veil__lede">00:00 到 06:00，一个人守着一间便利店。<br>来的人大多很有礼貌。礼貌不代表安全。</p>\n' +
'          <ul class="veil__keys">\n' +
'            <li><b>1</b>递货</li><li><b>2</b>查证件</li><li><b>3</b>手电</li><li><b>4</b>请他走</li>\n' +
'          </ul>\n' +
'          <p class="veil__text">营业额、理智、手电电量。理智见底就换班；撑到 06:00 才算交班。' +
'03:33 之后，别给没有影子的人开门。</p>\n' +
'          <button class="veil__btn" type="button" data-shift-begin>开始值班</button>\n' +
'          <p class="veil__note">判定与时间在 WebAssembly 里跑；画面是 Canvas 现画的，没有任何贴图文件。</p>\n' +
'        </div>\n' +
'\n' +
'        <div class="veil__panel" data-veil-end hidden>\n' +
'          <p class="veil__kicker">班次结束</p>\n' +
'          <p class="veil__rank" data-shift-end-rank>—</p>\n' +
'          <h1 class="veil__title" data-shift-end-title></h1>\n' +
'          <p class="veil__text" data-shift-end-text></p>\n' +
'          <ul class="veil__stats" data-shift-end-stats></ul>\n' +
'          <button class="veil__btn" type="button" data-shift-again>再来一班</button>\n' +
'        </div>\n' +
'\n' +
'        <div class="veil__panel" data-veil-error hidden>\n' +
'          <p class="veil__kicker">载入失败</p>\n' +
'          <h1 class="veil__title">WASM 没有起来</h1>\n' +
'          <p class="veil__text">常见原因：直接双击打开本地文件（file://）时浏览器不允许取 .wasm。' +
'用 <code>node site/serve.mjs</code> 起本地服务器再看。</p>\n' +
'          <p class="veil__text veil__text--dim" data-shift-error-detail></p>\n' +
'        </div>\n' +
'      </div>\n' +
'    </div>\n' +
'  </section>\n' +
'\n' +
'  <p class="shift__hint" data-shift-hint>轮到你决定。</p>\n' +
'\n' +
'  <section class="shift__actions" aria-label="柜台动作">\n' +
'    <button class="act" type="button" data-shift-act="1" data-live="0" data-visible="1" disabled>\n' +
'      <kbd data-act-key>1</kbd><span data-act-label>递货</span><i data-act-hint>收钱、交货</i>\n' +
'    </button>\n' +
'    <button class="act" type="button" data-shift-act="2" data-live="0" data-visible="1" disabled>\n' +
'      <kbd data-act-key>2</kbd><span data-act-label>查证件</span><i data-act-hint>看清他是谁</i>\n' +
'    </button>\n' +
'    <button class="act" type="button" data-shift-act="3" data-live="0" data-visible="1" disabled>\n' +
'      <kbd data-act-key>3</kbd><span data-act-label>手电</span><i data-act-hint>照一下（耗电）</i>\n' +
'    </button>\n' +
'    <button class="act" type="button" data-shift-act="4" data-live="0" data-visible="1" disabled>\n' +
'      <kbd data-act-key>4</kbd><span data-act-label>请他走</span><i data-act-hint>今晚不卖给你</i>\n' +
'    </button>\n' +
'  </section>\n' +
'\n' +
'  <section class="shift__foot">\n' +
'    <div class="log">\n' +
'      <p class="log__head">值班记录</p>\n' +
'      <ol class="log__list" data-shift-log></ol>\n' +
'    </div>\n' +
'    <div class="radio">\n' +
'      <p class="radio__head">收音机</p>\n' +
'      <p class="radio__line" data-shift-radio>FM 093.3：今夜有雨，路面湿滑。</p>\n' +
'    </div>\n' +
'  </section>\n' +
'\n' +
'  <footer class="shift__legal">\n' +
'    <p>本站版本是按夜班题材重写的 WASM 小游戏，不使用任何原游戏素材。</p>\n' +
'    <p><a href="' + back + '">回到板块</a> · <a href="' + handbook + '">值班手册</a> · ' +
'<a href="' + u(site, '/') + '">主界面</a></p>\n' +
'  </footer>\n' +
'</main>\n' +
'<noscript><p style="padding:16px;color:#cbd8da">这个页面靠 WebAssembly 与 Canvas 运行，需要开启 JavaScript。</p></noscript>\n' +
'<script type="module" src="' + u(site, GAME + '/js/game.js') + '"></script>\n' +
'</body>\n' +
'</html>\n';
}
