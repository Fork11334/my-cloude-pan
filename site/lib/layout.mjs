/* 页面模板：把构建器算出来的数据拼成完整 HTML。 */

import { esc, u, fmtDate, pad2 } from './html.mjs';
import { archiveMarkup, ARCHIVE_LAYOUTS } from './layout-archive.mjs';
import { renderGamePage } from './layout-game.mjs';

/* 访问校验脚本：任何页面头里都可以插一次。
   抽成导出函数，是因为游戏页（layout-game.mjs）用自己的 <head>，
   但门禁逻辑必须和这里完全一致，不能各写一份。 */
export function guardScript(site, page) {
    const guarded = site.gating.enabled
        && (site.gating.guardAll || page.locked)
        && !page.route.startsWith(site.gating.route)
        && page.route !== '/404/';
    if (!guarded) { return ''; }
    return `<script>
try {
  var ok = sessionStorage.getItem(${JSON.stringify(site.gating.store || 'cac-pass')}) === '1'
        || !!localStorage.getItem(${JSON.stringify(site.gating.accountStore || 'cac-session')});
  if (!ok) {
    location.replace(${JSON.stringify(u(site, site.gating.route))} + '?next=' + encodeURIComponent(location.pathname + location.search));
  }
} catch (e) { /* 隐私模式下直接放行，避免白屏 */ }
</script>`;
}

function head({ site, page, extraCss = '' }) {
    const title = page.route === '/' ? `${site.name} · ${site.tagline}` : `${page.title} · ${site.name}`;
    const desc = page.summary || site.description;
    /* baseUrl 是"域名 + base"的完整前缀，所以这里不再叠加 base */
    const canonical = site.baseUrl ? `${site.baseUrl.replace(/\/$/, '')}${page.route}` : '';
    const css = u(site, '/assets/css/main.css');

    /* 访问校验：除校验页之外，没有访客标记或账号会话就送回 /verify/ */
    const guard = guardScript(site, page);

    return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="dark">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="icon" href="${u(site, '/assets/favicon.svg')}" type="image/svg+xml">
<script>
/* 首次绘制前：套用访客选过的配色；并在允许动效时打开动效开关。
   动效脚本若 2 秒内没起来（网络问题等），就把开关撤掉，保证内容可见。 */
try {
  var t = localStorage.getItem('cac-theme');
  if (t) { document.documentElement.dataset.theme = t; }
  var d = document.documentElement;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    d.classList.add('js');
    setTimeout(function () { if (!window.__cacMotion) { d.classList.remove('js'); } }, 2000);
  }
} catch (e) { document.documentElement.classList.remove('js'); }
</script>
<link rel="stylesheet" href="${css}">
<link rel="stylesheet" href="${u(site, '/assets/css/motion.css')}">
<link rel="stylesheet" href="${u(site, '/assets/css/craft-chrome.css')}">
<link rel="stylesheet" href="${u(site, '/assets/css/theme-legacy.css')}">
<script src="${u(site, '/assets/js/config.js')}"></script>
${extraCss}
${guard}`;
}

function topbar({ site, page }) {
    const links = (site.menu || []).map((item) => {
        if (item.action === 'search') {
            return `<button class="usermenu__act" type="button" data-search-open>${esc(item.label)}</button>`;
        }
        const current = page.route === item.href || (item.href !== '/' && page.route.startsWith(item.href));
        return `<a href="${u(site, item.href)}"${current ? ' class="is-current" aria-current="page"' : ''}${item.accent ? ` data-accent="${esc(item.accent)}"` : ''}>${esc(item.label)}</a>`;
    }).join('\n                    ');

    const themes = site.appearance?.themes || {};
    const themeOpts = Object.keys(themes).map((key, i) =>
        `<button class="themepick__opt${i === 0 ? ' is-on' : ''}" type="button" role="radio" aria-checked="${i === 0}" data-theme-set="${esc(key)}">${esc(themes[key])}</button>`).join('');

    return `<header class="topbar">
    <div class="topbar__inner">
        <a class="brand" href="${u(site, '/')}" aria-label="${esc(site.name)} 主界面">
            <svg class="brand__mark" viewBox="0 0 32 32" role="img" aria-hidden="true" focusable="false">
                <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".55"/>
                <path d="M16 4.5 25.5 16 16 27.5 6.5 16Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
                <circle cx="16" cy="16" r="3.2" fill="currentColor"/>
            </svg>
        </a>

        <button class="searchbox sweep" type="button" data-search-open aria-label="站内检索（Ctrl+K）">
            <span class="searchbox__icon" aria-hidden="true">⌕</span>
            <span class="searchbox__text">搜索档案、帖子与页面…</span>
            <span class="searchbox__keys" aria-hidden="true"><kbd>Ctrl</kbd><kbd>K</kbd></span>
        </button>

        <div class="usermenu" data-usermenu>
            <button class="usermenu__btn" type="button" aria-expanded="false" aria-haspopup="true"
                    aria-controls="usermenu-panel" aria-label="成员菜单" data-usermenu-btn>
                <span class="usermenu__avatar" aria-hidden="true" data-avatar>C</span>
                <span class="usermenu__caret" aria-hidden="true">▾</span>
            </button>
            <div class="usermenu__panel" id="usermenu-panel">
                <p class="usermenu__head">
                    <span class="usermenu__head-mark">${esc(site.mark)}</span>
                    <span class="usermenu__head-tag">${esc(site.tagline)}</span>
                </p>
                <nav class="usermenu__grid" aria-label="快捷跳转">
                    ${links}
                </nav>
                <div class="usermenu__theme">
                    <span class="usermenu__theme-label">界面样式</span>
                    <div class="themepick" role="radiogroup" aria-label="界面样式" data-themepick>
                        ${themeOpts}
                        <span class="themepick__thumb" aria-hidden="true"></span>
                    </div>
                </div>
                <div class="usermenu__foot">
                    <a class="usermenu__home" href="${u(site, '/')}">返回主界面</a>
                    <span class="usermenu__account">
                        <a class="usermenu__login" href="${u(site, '/verify/')}" data-account-login>登录 / 注册</a>
                        <button class="usermenu__out" type="button" data-account-out hidden>退出</button>
                    </span>
                </div>
            </div>
        </div>
    </div>
</header>`;
}

function crumbs(page) {
    if (!page.crumbs?.length) { return ''; }
    const items = page.crumbs.map((c, i) => (i === page.crumbs.length - 1
        ? `<span aria-current="page">${esc(c.label)}</span>`
        : `<a href="${c.href}">${esc(c.label)}</a>`)).join('<span class="sep" aria-hidden="true">/</span>');
    return `<nav class="crumbs" aria-label="面包屑">${items}</nav>`;
}

function chips(page) {
    const chips = [];
    if (page.status) { chips.push(`<span class="chip chip--status">${esc(page.status)}</span>`); }
    if (page.repost) { chips.push('<span class="chip chip--repost">转载内容</span>'); }
    if (page.accent) { chips.push(`<span class="chip chip--${esc(page.accent)}">${esc(page.sectionTitle || '')}</span>`); }
    if (page.updated) { chips.push(`<span class="chip chip--plain">最后更新 ${esc(page.updated)}</span>`); }
    if (page.locked && page.gatingOn) { chips.push('<span class="chip chip--locked">授权访问</span>'); }
    return chips.length
        ? `<ul class="chips">${chips.map((c, i) => `<li data-reveal="fade" data-i="${Math.min(i + 2, 8)}">${c}</li>`).join('')}</ul>`
        : '';
}

function sidebar({ sidebar, page }) {
    if (!sidebar) { return ''; }
    const groups = sidebar.groups.map((group) => `
            <div class="sidebar__group">
                ${group.title ? `<p class="sidebar__title">${esc(group.title)}</p>` : ''}
                <ul class="sidebar__list">
                    ${group.items.map((item) => `<li>
                        <a href="${item.href}"${item.href === page.route ? ' class="is-current" aria-current="page"' : ''}>
                            <span>${esc(item.title)}</span>
                            ${item.status ? `<span class="sidebar__badge">${esc(item.status)}</span>` : ''}
                        </a>
                    </li>`).join('\n                    ')}
                </ul>
            </div>`).join('');
    return `<aside class="sidebar" aria-label="分区导航">
        <p class="sidebar__head">${esc(sidebar.title)}</p>${groups}
    </aside>`;
}

function tocBlock(toc, page) {
    if (!toc?.length || toc.length < 3) { return ''; }
    const items = toc.filter((h) => h.level <= 3)
        .map((h) => `<li class="toc__item toc__item--${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`)
        .join('\n            ');
    return `<aside class="toc" aria-label="本页目录">
        <p class="toc__head">本页目录</p>
        <ul class="toc__list">
            ${items}
        </ul>
    </aside>`;
}

function pager({ pager }) {
    if (!pager?.prev && !pager?.next) { return ''; }
    return `<nav class="pager" aria-label="分页">
        ${pager.prev ? `<a class="pager__item pager__item--prev" href="${pager.prev.href}"><span>上一页</span><strong>${esc(pager.prev.title)}</strong></a>` : '<span></span>'}
        ${pager.next ? `<a class="pager__item pager__item--next" href="${pager.next.href}"><span>下一页</span><strong>${esc(pager.next.title)}</strong></a>` : '<span></span>'}
    </nav>`;
}

function sectionCards(sectionCards) {
    if (!sectionCards?.length) { return ''; }
    return sectionCards.map((group) => `
        <section class="group-block">
            <h2 class="group-block__title" data-reveal="left">${esc(group.title)}</h2>
            <div class="card-grid">
                ${group.items.map((item, i) => `
                <a class="card spot-host tilt border-sheen${item.accent ? ` card--${esc(item.accent)}` : ''}" href="${item.href}"
                   data-reveal="blur" data-i="${Math.min(i, 8)}" data-spotlight data-tilt="4">
                    <p class="card__title">${esc(item.title)}${item.status ? `<span class="card__badge">${esc(item.status)}</span>` : ''}</p>
                    ${item.summary ? `<p class="card__desc">${esc(item.summary)}</p>` : ''}
                    ${item.updated || item.author ? `<p class="card__meta">${[item.updated ? `更新于 ${esc(item.updated)}` : '', item.author ? esc(item.author) : ''].filter(Boolean).join(' · ')}</p>` : ''}
                </a>`).join('\n                ')}
            </div>
        </section>`).join('\n');
}

function footer({ site, page }) {
    const links = (site.footerLinks || []).map((l) =>
        `<a class="footer__link" href="${l.href && l.href.startsWith('/') ? u(site, l.href) : '#'}">${esc(l.label)}</a>`).join('');
    const tickerItems = (site.ticker || []).map((t) => `
            <span class="marquee__item"><b>${esc(t.cn)}</b> ${esc(t.en)}</span>`).join('');

    return `<footer class="footer">
    <div class="footer__bar">
        <p class="footer__links" aria-label="页脚">
            ${links}
        </p>
        <div class="footer__meta">
            <p class="footer__mark">${esc(site.mark)} <span>${esc(site.tagline)}</span></p>
            <p class="footer__note">${esc(site.footer.note)}</p>
            <p class="footer__note footer__note--dim">${esc(site.footer.migrated)}</p>
        </div>
    </div>

    <div class="marquee" aria-hidden="true" data-marquee>
        <div class="marquee__track" data-marquee-track>${tickerItems}
        </div>
    </div>
</footer>`;
}

function searchOverlay() {
    return `<div class="search" data-search hidden>
    <div class="search__backdrop" data-search-close></div>
    <div class="search__panel" role="dialog" aria-modal="true" aria-label="站内搜索">
        <div class="search__field">
            <span aria-hidden="true">⌕</span>
            <input type="search" placeholder="搜索页面标题与正文…" aria-label="搜索关键词" data-search-input autocomplete="off">
            <button type="button" class="search__close" data-search-close aria-label="关闭搜索">Esc</button>
        </div>
        <div class="search__results" data-search-results></div>
    </div>
</div>`;
}

function gateMarkup(site) {
    return `<div class="gate">
    <section class="terminal" data-gate aria-label="CAC 安全终端">
        <p class="terminal__eyebrow">内部资料库 · 授权验证</p>
        <h1 class="terminal__title">C.A.C 安全检测</h1>
        <ul class="boot" aria-hidden="true">
            <li style="--i:0" class="is-done">挂载模因防护表</li>
            <li style="--i:1" class="is-done">校验终端指纹</li>
            <li style="--i:2" class="is-done">载入授权名单</li>
            <li style="--i:3" class="is-wait">等待密钥</li>
        </ul>
        <form class="terminal__form" data-gate-form autocomplete="off" novalidate>
            <label class="terminal__label" for="gate-key">&gt;&gt; 输入个人密钥 &lt;&lt;</label>
            <input class="terminal__input" id="gate-key" type="text" placeholder="KEY_********"
                   maxlength="64" required spellcheck="false" autocapitalize="off" autocomplete="off" data-gate-input>
            <button class="terminal__submit" type="submit" data-gate-submit>验证密钥</button>
        </form>
        <div class="terminal__screen" data-gate-screen role="status" aria-live="polite" hidden></div>
        <p class="terminal__foot">[ CAC · 加密协议 ]</p>
    </section>
    <p class="gate__back"><a href="${u(site, '/')}">← 返回首页</a></p>
</div>`;
}

/* ── 首页各板块 ────────────────────────────────────────────────────────── */

function noticeList(items, limit) {
    return (items || []).slice(0, limit || items.length).map((n, i) => `
            <li class="notice" data-reveal="fade" data-i="${Math.min(i, 6)}">
                <span class="notice__date">${esc(n.date)}</span>${n.tag ? `<span class="notice__tag">${esc(n.tag)}</span>` : ''}
                <p class="notice__text">${esc(n.text)}</p>
            </li>`).join('');
}

function newsList(site, items, limit) {
    return (items || []).slice(0, limit || items.length).map((n, i) => `
            <li class="news" data-reveal="fade" data-i="${Math.min(i, 6)}">
                <span class="news__date">${esc(n.date)}</span>${n.tag ? `<span class="news__tag">${esc(n.tag)}</span>` : ''}
                <h3 class="news__title">${n.href ? `<a href="${u(site, n.href)}">${esc(n.title)}</a>` : esc(n.title)}</h3>
                ${n.text ? `<p class="news__text">${esc(n.text)}</p>` : ''}
            </li>`).join('');
}

/* 新闻图文卡：有图就图+文，没图就纯文字（本站新闻不带外链） */
function newsCards(site, items, limit) {
    return (items || []).slice(0, limit || items.length).map((n, i) => `
                <article class="ncard${n.image ? '' : ' ncard--text'}" data-reveal="blur" data-i="${i}">
                    ${n.image ? `<a class="ncard__media" href="${esc(n.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">
                        <img src="${u(site, n.image)}" alt="" loading="lazy" decoding="async">
                    </a>` : ''}
                    <div class="ncard__body">
                        <p class="ncard__meta">${n.tag ? `<span class="ncard__tag">${esc(n.tag)}</span>` : ''}<time>${esc(n.date)}</time></p>
                        <h3 class="ncard__title">${n.sourceUrl
                            ? `<a href="${esc(n.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a>`
                            : esc(n.title)}</h3>
                        ${n.summary ? `<p class="ncard__sum">${esc(n.summary)}</p>` : ''}
                        ${n.note || n.source || n.imageNote ? `<p class="ncard__src">
                            ${n.imageNote ? `<span class="ncard__note">${esc(n.imageNote)}</span>` : ''}
                            ${n.note ? `<span class="ncard__links">${esc(n.note)}</span>` : ''}
                            ${n.sourceUrl ? `<span class="ncard__links">出处：<a href="${esc(n.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(n.source)} · 访问原文</a></span>` : ''}
                        </p>` : ''}
                    </div>
                </article>`).join('');
}

/* ── 账户：登录 / 注册 ─────────────────────────────────────────────────── */
function accountMarkup({ site, page }) {
    const field = (name, label, opts) => `
            <label class="field"${opts?.row ? ` data-row="${opts.row}" hidden` : ''}>
                <span class="field__label">${esc(label)}</span>
                ${opts?.eye
                    ? `<span class="field__wrap">
                    <input type="${opts.type || 'text'}" name="${name}" data-field="${name}" autocomplete="${opts.autocomplete || 'off'}" placeholder="${esc(opts.placeholder || '')}">
                    <button class="field__eye" type="button" data-toggle-pass aria-label="显示密码">显示</button>
                </span>`
                    : `<input type="${opts?.type || 'text'}" name="${name}" data-field="${name}" autocomplete="${opts?.autocomplete || 'off'}" placeholder="${esc(opts?.placeholder || '')}">`}
                ${opts?.strength ? '<span class="strength" data-strength data-level="0" role="img" aria-label="密码强度：未输入"><i></i><i></i><i></i></span>' : ''}
            </label>`;

    return `
        <article class="acct">
            <p class="acct__eyebrow">${esc(site.mark)} · 账户</p>
            <h1 class="acct__title">登录 / 注册</h1>
            <p class="acct__sub">账号只存在这台设备的浏览器里：不联网、不发邮件、不做真实身份验证。受保护资料库仍然要走 <a href="${u(site, '/gate/')}">密钥验证</a>。</p>

            <div class="acct__tabs" role="tablist" aria-label="登录或注册">
                <button class="acct__tab is-on" type="button" role="tab" aria-selected="true" data-account-tab="login">登录</button>
                <button class="acct__tab" type="button" role="tab" aria-selected="false" data-account-tab="register">注册</button>
                <span class="acct__indicator" data-account-indicator aria-hidden="true"></span>
            </div>

            <form class="acct__form" data-account-form novalidate>
                ${field('user', '用户名', { placeholder: '2 个字符以上', autocomplete: 'username' })}
                ${field('pass', '密码', { type: 'password', eye: true, strength: true, placeholder: '6 位以上', autocomplete: 'current-password' })}
                ${field('pass2', '再输一次密码', { type: 'password', eye: true, row: 'pass2', autocomplete: 'new-password' })}
                ${field('mail', '邮箱（可选）', { type: 'email', row: 'mail', placeholder: '只存在本机，不做验证', autocomplete: 'email' })}
                <button class="cac-btn acct__submit" type="submit" data-account-submit>登录</button>
                <p class="acct__msg" data-account-msg role="status" aria-live="polite"></p>
            </form>

            <p class="acct__foot">清除浏览器数据会一并删除账号；想换设备使用，目前只能重新注册。</p>
        </article>`;
}

/* ── 账户：个人主页 ───────────────────────────────────────────────────── */
function meMarkup({ site }) {
    return `
        <article class="me" data-me>
            <section class="me__guest" data-me-guest hidden>
                <p class="acct__eyebrow">${esc(site.mark)} · 个人主页</p>
                <h1 class="me__name">还没有登录</h1>
                <p class="acct__sub">登录之后这里会显示你的名字、注册时间、界面偏好与门禁状态。</p>
                <p><a class="cac-btn" href="${u(site, '/login/')}">去登录 / 注册</a></p>
            </section>

            <section class="me__member" data-me-member hidden>
                <header class="me__head">
                    <span class="me__avatar" data-me-initial aria-hidden="true">C</span>
                    <div>
                        <h1 class="me__name" data-me-name>—</h1>
                        <p class="me__sub"><span data-me-role>访客</span> · 注册于 <span data-me-created>—</span></p>
                    </div>
                    <button class="cac-btn cac-btn--ghost" type="button" data-me-out>退出登录</button>
                </header>

                <dl class="me__facts">
                    <div><dt>邮箱</dt><dd data-me-mail>—</dd></div>
                    <div><dt>界面样式</dt><dd data-me-theme>红黑</dd></div>
                    <div><dt>门禁状态</dt><dd data-me-gate>未通过</dd></div>
                    <div><dt>账号存放位置</dt><dd>本机浏览器 localStorage</dd></div>
                </dl>

                <div class="me__actions">
                    <a class="cac-btn" href="${u(site, '/cac/')}">进入数据库</a>
                    <a class="cac-btn cac-btn--ghost" href="${u(site, '/forum/')}">浏览论坛</a>
                    <a class="cac-btn cac-btn--ghost" href="${u(site, '/services/')}">更多服务</a>
                    <button class="cac-btn cac-btn--ghost" type="button" data-me-rename>改显示名</button>
                </div>

                <p class="me__note">⚠️ 这是本机账号：换设备或清缓存就会消失，也不附带任何权限。真正受保护的内容仍然需要 <a href="${u(site, '/gate/')}">密钥</a>。</p>
            </section>
        </article>`;
}

/* ── 访问校验页：访客进入 或 注册/登录 ───────────────────────────────── */
function verifyMarkup({ site, page, body }) {
    const themes = site.appearance?.themes || {};
    const themeOpts = Object.keys(themes).map((key, i) =>
        `<button class="themepick__opt${i === 0 ? ' is-on' : ''}" type="button" role="radio" aria-checked="${i === 0}" data-theme-set="${esc(key)}">${esc(themes[key])}</button>`).join('');

    const field = (name, label, opts = {}) => `
                    <label class="field"${opts.row ? ` data-row="${opts.row}" hidden` : ''}>
                        <span class="field__label">${esc(label)}</span>
                        <input type="${opts.type || 'text'}" name="${name}" data-field="${name}"
                            autocomplete="${opts.autocomplete || 'off'}"
                            ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ''}
                            ${opts.maxlength ? `maxlength="${opts.maxlength}"` : ''}
                            placeholder="${esc(opts.placeholder || '')}">
                        ${opts.hint ? `<span class="field__hint">${esc(opts.hint)}</span>` : ''}
                    </label>`;

    /* 两个页面共用这套外壳：/verify/ 只登录，/verify/register/ 只注册 */
    const mode = page.mode === 'register' ? 'register' : 'login';

    const fields = mode === 'register'
        ? `${field('user', '称呼', { placeholder: '2 个字符以上', autocomplete: 'nickname' })}
            ${field('email', '个人邮箱', { type: 'email', placeholder: 'name@example.com', autocomplete: 'email', hint: '只记在这台设备上，用来认领密钥。' })}`
        : `${field('login', '称呼或邮箱', { placeholder: '称呼 或 name@example.com', autocomplete: 'username' })}
            ${field('key', '个人密钥', { placeholder: '6DFUP', maxlength: 5, hint: '1 位数字 + 4 位大写字母。' })}`;

    const submitLabel = mode === 'register' ? '生成我的密钥' : '登录并进入';
    const switchLink = mode === 'register'
        ? `已经有密钥了？<a href="${u(site, '/verify/')}">去登录</a>`
        : `还没有密钥？<a href="${u(site, '/verify/register/')}">去注册领一串</a>`;

    return `<div class="verify" data-verify data-verify-mode="${mode}">
    <canvas class="verify__ocean" data-ocean aria-hidden="true"></canvas>
    <div class="verify__scene" aria-hidden="true"><span class="verify__grid"></span><span class="verify__scan"></span>${shards()}</div>

    <div class="verify__card">
        <p class="verify__eyebrow">${esc(site.mark)} · 访问校验</p>
        <h1 class="verify__title">${esc(page.title)}</h1>
        <p class="verify__sub">${esc(page.subtitle || '')}</p>
        <div class="verify__intro">${body}</div>

        <form class="acct__form" data-account-form novalidate>
            ${fields}
            <button class="cac-btn acct__submit" type="submit" data-account-submit>${submitLabel}</button>
        </form>

        <div class="keycard" data-keycard hidden>
            <p class="keycard__label">你的个人密钥</p>
            <p class="keycard__value" data-key-value>—</p>
            <p class="keycard__note">只显示这一次。抄到安全的地方：下次进来要用「称呼 + 密钥」。</p>
            <div class="keycard__acts">
                <button class="cac-btn cac-btn--ghost" type="button" data-key-copy>复制</button>
                <button class="cac-btn" type="button" data-key-enter>我已记下，进入</button>
            </div>
        </div>

        <p class="verify__switch">${switchLink}</p>
        <p class="verify__msg" data-verify-msg role="status" aria-live="polite"></p>

        <p class="verify__footnote">账号与密钥只存在这台设备的浏览器里；清除网站数据会一并消失，我们也找不回来。</p>

        <div class="verify__foot">
            <span class="verify__foot-label">界面样式</span>
            <div class="themepick" role="radiogroup" aria-label="界面样式" data-themepick>
                ${themeOpts}
                <span class="themepick__thumb" aria-hidden="true"></span>
            </div>
        </div>
    </div>

    <div class="gate-load" data-gate-load aria-hidden="true">
        <p class="gate-load__mark">${esc(site.mark)}</p>
        <p class="gate-load__line" data-gate-line>正在建立信道…</p>
        <p class="gate-load__bar"><span></span></p>
        <p class="gate-load__pct" data-gate-pct>0%</p>
    </div>
</div>`;
}

/* ── 帘幕入场 ─────────────────────────────────────────────────────────── */
function curtainMarkup(site) {
    return `<div class="curtain" data-curtain aria-hidden="true">
    <div class="curtain__inner">
        <p class="curtain__mark">${esc(site.mark)}</p>
        <p class="curtain__bar"><span></span></p>
    </div>
</div>`;
}

/* 碎片聚散：8 块三角形拼成一块面板（clip-path 多边形 morph，样式在 motion.css）
   默认呈现"已组装"的整块；只有 <html class="js"> 时才从散开态收拢回来。
   三角形是为了让每条 polygon 都是 3 个点 —— 点数一致才有线性插值。 */
function shards() {
    const cells = Array.from({ length: 8 }, (_, i) =>
        `<span class="shards__s" style="--si:${i};--sa:${(0.06 + (i % 3) * 0.035).toFixed(3)}"></span>`).join('');
    return `<span class="shards" data-shards aria-hidden="true">${cells}</span>`;
}

function homeBlocks({ site, page, home, body }) {    const announcements = home?.announcements || [];
    const news = home?.news || [];
    const featured = home?.featured || [];
    const hot = home?.hot || [];

    /* 公告：细线分隔的安静列表（不用卡片） */
    const noticeRows = announcements.slice(0, 5).map((n, i) => `
                        <li class="nt" data-reveal="fade" data-i="${i}">
                            <span class="nt__date">${esc(n.date)}</span>
                            ${n.tag ? `<span class="nt__tag">${esc(n.tag)}</span>` : ''}
                            <span class="nt__text">${esc(n.text)}</span>
                        </li>`).join('');

    /* 本站动态：报纸式的简讯栏 */
    const newsRows = news.slice(0, 3).map((n, i) => `
                    <article class="nw" data-reveal="fade" data-i="${i}">
                        <p class="nw__meta"><time>${esc(n.date)}</time>${n.tag ? `<span>${esc(n.tag)}</span>` : ''}</p>
                        <h3 class="nw__title">${esc(n.title)}</h3>
                        <p class="nw__sum">${esc(n.summary || '')}</p>
                        ${n.note ? `<p class="nw__note">${esc(n.note)}</p>` : ''}
                    </article>`).join('');

    /* 更多服务 / 声明准则两个板块已按要求下架，数据仍留在 site/data/home.json */

    /* 部门轮播：一次只显示一个部门 */
    const deptSlides = (site.departments || []).map((d, i) => `
                <article class="slide${i === 0 ? ' is-on' : ''}${d.accent ? ` slide--${esc(d.accent)}` : ''}" data-slide="${i}"
                         role="group" aria-roledescription="幻灯片" aria-label="${esc(d.label)}"${i === 0 ? '' : ' aria-hidden="true"'}>
                    <span class="slide__num" aria-hidden="true">0${i + 1}</span>
                    <div class="slide__text">
                        <p class="slide__label">${esc(d.label)}</p>
                        ${d.motto ? `<p class="slide__motto">${esc(d.motto)}</p>` : ''}
                        <p class="slide__desc">${esc(d.desc)}</p>
                    </div>
                </article>`).join('');

    const deptDots = (site.departments || []).map((d, i) =>
        `<button class="dots__dot${i === 0 ? ' is-on' : ''}" type="button" role="tab" aria-selected="${i === 0}" aria-label="${esc(d.label)}" data-slide-to="${i}"><span class="dots__tick" aria-hidden="true"></span><span class="dots__label" aria-hidden="true">${esc(d.label)}</span></button>`).join('');

    const deptNav = (site.departments || []).length > 1 ? `
            <button class="carousel__nav carousel__nav--prev" type="button" data-slide-prev aria-label="上一个部门">‹</button>
            <button class="carousel__nav carousel__nav--next" type="button" data-slide-next aria-label="下一个部门">›</button>
            <div class="dots" role="tablist" aria-label="部门切换">${deptDots}</div>` : '';

    return `
        <div class="zone zone--signal" data-zone="signal">
        <span class="zone__bg" aria-hidden="true"><canvas class="zone__field" data-bg="signal"></canvas><i class="zone__grid"></i><i class="zone__sweep"></i></span>
        <section class="hero" id="top">
            <div class="hero__bg" aria-hidden="true" style="background-image:url('${u(site, '/assets/img/bg-hero.jpg')}')"></div>
            <canvas class="hero__field" data-starfield aria-hidden="true"></canvas>

            <div class="hero__inner">
                <p class="hero__kicker">${esc(site.mark)}&ensp;·&ensp;内部资料库</p>
                <h1 class="hero__title" data-split>${esc(page.title)}</h1>
                ${page.intro ? `<p class="hero__punch">${esc(page.intro)}</p>` : ''}
                <div class="hero__actions">
                    <a class="act act--solid" href="#about">
                        <span class="act__stack"><span class="act__line">从这里开始 ↓</span><span class="act__line act__line--ghost" aria-hidden="true">从这里开始 ↓</span></span>
                    </a>
                    <a class="act" href="${u(site, '/verify/')}">
                        <span class="act__stack"><span class="act__line">登录 / 注册</span><span class="act__line act__line--ghost" aria-hidden="true">登录 / 注册</span></span>
                    </a>
                </div>
            </div>
        </section>

        <section class="sec" id="about">
            <header class="sec__head">
                <span class="sec__index" aria-hidden="true">01</span>
                <h2 class="sec__title">什么是 CAC</h2>
                <span class="sec__rule" data-reveal="line" aria-hidden="true"></span>
            </header>
            <div class="sec__grid">
                <div class="sec__main" data-reveal="fade">
${body}
                </div>
                <aside class="aside" id="announcements">
                    <p class="aside__label">公告<span>最近 ${Math.min(announcements.length, 5)} 条</span></p>
                    <ul class="nt-list">${noticeRows}
                    </ul>
                    <p class="aside__foot">论坛仅限授权人员访问 · 数据受模因加密保护</p>
                </aside>
            </div>
        </section>

        <section class="sec" id="news">
            <header class="sec__head">
                <span class="sec__index" aria-hidden="true">02</span>
                <h2 class="sec__title">本站动态</h2>
                <span class="sec__rule" data-reveal="line" aria-hidden="true"></span>
            </header>
            <div class="news-strip">${newsRows}
            </div>
        </section>
        </div>

        <div class="zone zone--strata" data-zone="strata">
        <span class="zone__bg" aria-hidden="true"><canvas class="zone__field" data-bg="strata"></canvas><i class="zone__strata"></i><i class="zone__beamline"></i></span>

        <section class="sec" id="archives">
            <header class="sec__head">
                <span class="sec__index" aria-hidden="true">03</span>
                <h2 class="sec__title">档案</h2>
                <span class="sec__rule" data-reveal="line" aria-hidden="true"></span>
            </header>
            <a class="vacant vacant--link" href="${u(site, '/archive/')}" data-reveal="wipe">
                ${shards()}
                <span class="vacant__mark" aria-hidden="true">◫</span>
                <p class="vacant__title">档案部</p>
                <p class="vacant__desc">设施、装备、异常收容物、研究论文、行动记录与共存评估，六类材料全部可查。</p>
                <span class="vacant__go" aria-hidden="true">进入档案部 →</span>
            </a>
        </section>

        <section class="sec" id="forum">
            <header class="sec__head">
                <span class="sec__index" aria-hidden="true">04</span>
                <h2 class="sec__title">论坛</h2>
                <span class="sec__rule" data-reveal="line" aria-hidden="true"></span>
            </header>
            <ul class="forum-list" data-reveal="fade">
                <li><a href="${u(site, '/forum/night-shift/')}">午夜轮班 · 夜班记录</a><span>游戏板块</span></li>
                <li><a href="${u(site, '/forum/t-nightlong/')}">长夜便利店 · NIGHTLONG MART</a><span>可玩</span></li>
                <li><a href="${u(site, '/forum/')}">内部论坛 · 频道存档</a><span>入口</span></li>
            </ul>
        </section>
        </div>

        <div class="zone zone--axis" data-zone="axis">
        <span class="zone__bg" aria-hidden="true"><canvas class="zone__field" data-bg="axis"></canvas><i class="zone__axis"></i><i class="zone__beam" data-beam="0"></i><i class="zone__beam" data-beam="1"></i><i class="zone__beam" data-beam="2"></i></span>

        <section class="sec sec--wide" id="departments">
            <header class="sec__head">
                <span class="sec__index" aria-hidden="true">05</span>
                <h2 class="sec__title">部门</h2>
                <span class="sec__rule" data-reveal="line" aria-hidden="true"></span>
            </header>
            <div class="dept-seq" data-dept-seq style="--slides:${(site.departments || []).length}">
            <div class="carousel" data-carousel>
                <div class="carousel__viewport">
                    <div class="carousel__track" data-track>${deptSlides}
                    </div>
                </div>
                ${deptNav}
            </div>
            </div>
        </section>
        </div>`;
}

function newsBlocks({ site, page, home, body }) {
    return `
        <article class="article">
            <div class="read-rail" aria-hidden="true"><span class="read-rail__fill"></span></div>
            <header class="page-head">
                ${crumbs(page)}
                <h1 data-split>${esc(page.title)}</h1>
                ${page.subtitle ? `<p class="page-head__sub" data-reveal="fade" data-i="1">${esc(page.subtitle)}</p>` : ''}
                ${chips(page)}
            </header>
            <div class="prose">${body}</div>
        </article>
        <div class="home-upper home-upper--page">
            <section class="panel panel--notice">
                <header class="panel__head"><h2>公告</h2><span class="panel__count">${(home?.announcements || []).length} 条</span></header>
                <ul class="notice-list">${noticeList(home?.announcements || [])}
                </ul>
            </section>
            <section class="panel panel--news">
                <header class="panel__head"><h2>新闻</h2><span class="panel__count">${(home?.news || []).length} 条</span></header>
                <ul class="news-list">${newsList(site, home?.news || [])}
                </ul>
            </section>
        </div>`;
}

export function renderPage(ctx) {
    const { site, page, body, sidebar: sb, toc, pager: pg, sectionCards: cards, home, data } = ctx;
    const themeAttr = site.appearance?.defaultTheme || 'cac';

    /* 游戏页：独立外壳（全屏画布），自己的 head 与样式 */
    if (page.layout === 'game') {
        return renderGamePage({ site, page });
    }

    /* 访问校验页：独立外壳，不带顶栏与底栏 */
    if (page.layout === 'verify') {
        return `<!DOCTYPE html>
<html lang="${site.lang}" data-theme="${esc(themeAttr)}">
<head>
${head({ site, page })}
</head>
<body class="layout-verify">
${verifyMarkup({ site, page, body })}
<script src="${u(site, '/assets/js/key.js')}" defer></script>
<script src="${u(site, '/assets/js/accounts.js')}" defer></script>
<script src="${u(site, '/assets/js/ocean.js')}" defer></script>
<script src="${u(site, '/assets/js/craft-chrome.js')}" defer></script>
<script src="${u(site, '/assets/js/site.js')}" defer></script>
<script src="${u(site, '/assets/js/verify.js')}" defer></script>
</body>
</html>
`;
    }

    const shellClass = ['shell', sb ? 'shell--side' : '', toc?.length >= 3 ? 'shell--toc' : ''].filter(Boolean).join(' ');
    const isHome = page.layout === 'home';
    const isNews = page.layout === 'news';
    const isAccount = page.layout === 'account';
    const isMe = page.layout === 'me';
    const isArchive = ARCHIVE_LAYOUTS.includes(page.layout);
    const atmos = isHome
        ? `<div class="atmos" aria-hidden="true">
    <div class="atmos__glow"></div>
    <div class="atmos__aurora"></div>
    <div class="atmos__aurora atmos__aurora--rev"></div>
    <span class="atmos__beam atmos__beam--1"></span><span class="atmos__beam atmos__beam--2"></span><span class="atmos__beam atmos__beam--3"></span><span class="atmos__beam atmos__beam--4"></span>
    <div class="atmos__spot"></div>
    <div class="atmos__grid"></div>
</div>`
        : '';
    /* 标题短就逐字入场，太长（比如带编号的长标题）就整块模糊入场 */
    const titleAttr = page.title.length <= 24 ? ' data-split' : ' data-reveal="blur"';

    /* 首页走自己的版式：没有侧栏与目录，板块自上而下排列 */
    const content = isHome
        ? `<main id="main" class="home">
${homeBlocks({ site, page, home, body })}
</main>`
        : isArchive
            ? `<main id="main" class="main main--archive">
${archiveMarkup(page.layout, { page, body, data })}
</main>`
                : `<div class="${shellClass}">
    ${sidebar({ sidebar: sb, page })}
    <main id="main" class="main">
        <article class="article">
            <div class="read-rail" aria-hidden="true"><span class="read-rail__fill"></span></div>
            <header class="page-head">
                ${crumbs(page)}
                <h1${titleAttr}>${esc(page.title)}</h1>
                ${page.subtitle ? `<p class="page-head__sub" data-reveal="fade" data-i="1">${esc(page.subtitle)}</p>` : ''}
                ${page.author ? `<p class="byline" data-reveal="fade" data-i="2">撰稿 ${page.authorHref ? `<a href="${page.authorHref}">${esc(page.author)}</a>` : esc(page.author)}</p>` : ''}
                ${chips(page)}
            </header>
            ${page.repost ? '<aside class="callout callout--repost"><p class="callout__title">转载内容</p><p>本页内容并非本站原创，版权归原作者所有；此处仅作存档，如权利人提出异议将立即移除。</p></aside>' : ''}
            <div class="prose">
${body}
            </div>
        </article>
        ${sectionCards(cards)}
        ${pager({ pager: pg })}
    </main>
    ${tocBlock(toc, page)}
</div>`;

    return `<!DOCTYPE html>
<html lang="${site.lang}" data-theme="${esc(themeAttr)}">
<head>
${head({ site, page, extraCss: isArchive ? `<link rel="stylesheet" href="${u(site, '/assets/css/archive.css')}">` : '' })}
</head>
<body class="layout-page${isHome ? ' layout-home' : ''}${isArchive ? ' layout-archive' : ''}${page.wide ? ' page--wide' : ''}${page.locked && page.gatingOn ? ' page--locked' : ''}">
${isHome ? curtainMarkup(site) : ''}
<a class="skip-link" href="#main">跳到正文</a>
${atmos}
${topbar({ site, page })}
${!isHome ? `<div class="backbar">
    <button class="backbar__btn" type="button" data-back>← 返回上页</button>
    <a class="backbar__btn backbar__btn--home" href="${u(site, '/')}">回主页</a>
</div>` : ''}
<div class="progress" data-progress hidden aria-hidden="true"><span></span></div>
${content}
${footer({ site, page })}
${searchOverlay()}
<script src="${u(site, '/assets/js/site.js')}" defer></script>
${isHome || isArchive ? `<script src="${u(site, '/assets/js/bgfield.js')}" defer></script>` : ''}
<script src="${u(site, '/assets/js/motion.js')}" defer></script>
<script src="${u(site, '/assets/js/craft-chrome.js')}" defer></script>
${isArchive ? `<script src="${u(site, '/assets/js/morphfield.js')}" defer></script>
${page.layout === 'archive-globe' ? `<script src="${u(site, '/assets/js/v3d.js')}" defer></script>` : ''}
<script src="${u(site, '/assets/js/archive.js')}" defer></script>` : ''}
</body>
</html>
`;
}

export function renderRedirect({ site, to }) {
    const target = esc(to);
    return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<title>页面已迁移</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<meta name="robots" content="noindex">
<style>
body { background:#0b0e12; color:#c9cfd4; font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
       display:flex; min-height:100vh; margin:0; align-items:center; justify-content:center; text-align:center; }
a { color:#4fa3c9; } code { color:#a377cf; }
</style>
</head>
<body>
<main>
    <h1>页面已迁移</h1>
    <p>新地址：<a href="${target}"><code>${target}</code></a></p>
    <p>如果没有自动跳转，请点击上面的链接。</p>
</main>
<script>location.replace(${JSON.stringify(to)} + location.hash);</script>
</body>
</html>
`;
}

export { esc as escapeHtml };
