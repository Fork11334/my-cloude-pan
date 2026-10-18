/* ==========================================================================
   静态站点构建器（零依赖）
   用法：node site/build.mjs        产出到 dist/
        CAC_OUT=/别处 node site/build.mjs   改产物目录（测试用临时目录）

   这一层只做编排，具体三件事拆在下面三个模块里：
     lib/content.mjs  读 site/content、解析 front-matter、渲染 Markdown
     lib/derive.mjs   由页面集合派生导航结构、首页数据、索引与 sitemap
     lib/layout.mjs   页面模板
   所以想改行为，先看对应模块；想验证，跑 node test/all.mjs。
   ========================================================================== */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { site } from './site.config.mjs';
import { legacyRedirects } from './legacy.mjs';
import { loadPages, textOf } from './lib/content.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import {
    buildHome,
    cardsFor,
    decoratePages,
    findDeadLinks,
    pagerFor,
    robotsFor,
    searchIndexFor,
    sidebarFor,
    sitemapFor,
} from './lib/derive.mjs';
import { renderPage, renderRedirect, escapeHtml } from './lib/layout.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CONTENT = join(here, 'content');
/* 产物目录：默认 dist/；CAC_OUT 可以改到别处（测试用临时目录，避免污染工作副本） */
const DIST = process.env.CAC_OUT ? resolve(process.env.CAC_OUT) : join(root, 'dist');

/* 审查样式时可以关掉门禁：CAC_NO_GATE=1 node site/build.mjs
   部署到 GitHub Pages 项目站点时用 CAC_BASE=/仓库名 node site/build.mjs */
const gatingEnabled = process.env.CAC_NO_GATE ? false : site.gating.enabled;
const base = String(process.env.CAC_BASE ?? site.base ?? '').replace(/\/+$/, '');
/* 完整部署地址前缀（域名 + base），用于 canonical / sitemap；
   留空则不生成 sitemap 与 canonical。 */
const origin = String(process.env.CAC_SITE_URL ?? site.baseUrl ?? '').replace(/\/+$/, '');
const activeSite = { ...site, base, baseUrl: origin, gating: { ...site.gating, enabled: gatingEnabled } };
/* 站内绝对路径统一加上 base 前缀 */
const u = (path) => (path && path.startsWith('/') ? `${base}${path}` : path);

/* ── 档案部数据 ──────────────────────────────────────────────────────────
   一份 archive.json 装六个数据集。设施详情页由数据生成，而不是再写六个
   Markdown —— 同一处设施的坐标、类型、简介只该有一份。 */
const seoulFile = join(here, 'data', 'seoul.json');
const seoul = existsSync(seoulFile) ? JSON.parse(readFileSync(seoulFile, 'utf8')) : [];

const archiveFile = join(here, 'data', 'archive.json');
const archive = existsSync(archiveFile) ? JSON.parse(readFileSync(archiveFile, 'utf8')) : {};

const facilityPages = (archive.facilities?.items || []).map((facility, i) => {
    const rendered = renderMarkdown(facility.body || '', { linkMap: legacyRedirects, base });
    return {
        file: `site/data/archive.json#facilities.${facility.slug}`,
        route: `/archive/facilities/${facility.slug}/`,
        title: facility.name,
        subtitle: facility.region || '',
        intro: '',
        summary: facility.summary || '',
        section: 'archive',
        group: '设施档案',
        order: 100 + i,
        updated: '',
        status: '',
        author: '',
        authorHref: '',
        featured: 0,
        hot: 0,
        layout: 'archive-facility',
        hero: false,
        wide: false,
        locked: false,
        repost: false,
        nav: false,
        noindex: false,
        crumbs: [],
        html: rendered.html,
        toc: rendered.toc,
        text: textOf(rendered.html),
        facility,
    };
});

/* ── 内容 ──────────────────────────────────────────────────────────────── */
const pages = loadPages({ contentDir: CONTENT, root, site, base, linkMap: legacyRedirects })
    .concat(facilityPages);
const byRoute = decoratePages(pages, { site, u, gating: gatingEnabled });

/* ── 首页数据 ──────────────────────────────────────────────────────────────
   公告与新闻写在 site/data/notices.json（纯数据，改文案不用碰代码）；
   主页面的档案条、论坛话题、服务清单、声明条文来自 site/data/home.json */
const noticesFile = join(here, 'data', 'notices.json');
const notices = existsSync(noticesFile)
    ? JSON.parse(readFileSync(noticesFile, 'utf8'))
    : { announcements: [], news: [] };

const homeFile = join(here, 'data', 'home.json');
const homeJson = existsSync(homeFile) ? JSON.parse(readFileSync(homeFile, 'utf8')) : {};

const home = buildHome({ pages, notices, homeJson });

/* ── 写文件 ────────────────────────────────────────────────────────────── */
if (existsSync(DIST)) { rmSync(DIST, { recursive: true, force: true }); }
mkdirSync(DIST, { recursive: true });

const write = (route, html) => {
    const dir = route === '/' ? DIST : join(DIST, route.replace(/^\/|\/$/g, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf8');
};

const renderContext = (page) => ({
    site: activeSite,
    page,
    body: page.html,
    sidebar: sidebarFor(page, { pages, site, u }),
    toc: page.toc,
    pager: pagerFor(page, { pages, u }),
    sectionCards: cardsFor(page, { pages, site, u }),
    home,
    data: { ...archive, seoul },
});

let count = 0;
for (const page of pages) {
    if (page.route === '/404/') { continue; }
    write(page.route, renderPage(renderContext(page)));
    count += 1;
}

/* 404 */
const notFound = byRoute.get('/404/');
writeFileSync(join(DIST, '404.html'), notFound
    ? renderPage({ site: activeSite, page: notFound, body: notFound.html, sidebar: null, toc: null, pager: null, sectionCards: null, data: { ...archive, seoul } })
    : '<!DOCTYPE html><meta charset="utf-8"><title>404</title><p>页面不存在。<a href="/">回首页</a>',
    'utf8');

/* 旧地址跳转页 */
let redirects = 0;
const skippedRedirects = [];
for (const [from, to] of Object.entries(legacyRedirects)) {
    const target = to.split('#')[0];
    const known = byRoute.has(target) || target === '/';
    if (!known) { continue; }
    const route = from.endsWith('/') ? from : `${from}/`;
    // 新站已有同名页面时不覆盖
    if (byRoute.has(route)) { continue; }
    // Windows 文件名不允许 : * ? " < > | —— 这类旧地址（如 /forum:start）只能放弃
    if (/[:*?"<>|]/.test(route)) { skippedRedirects.push(route); continue; }
    write(route, renderRedirect({ site: activeSite, to: u(from.includes('#') ? to : target) }));
    redirects += 1;
}

/* 资源 */
cpSync(join(here, 'assets'), join(DIST, 'assets'), { recursive: true });
writeFileSync(join(DIST, 'assets', 'js', 'config.js'),
    `window.CAC = ${JSON.stringify({
        base,
        store: site.gating.store,
        passStore: site.gating.guestStore || site.gating.store,
        accountStore: site.gating.accountStore || 'cac-session',
        verify: u(site.gating.route),
        enabled: gatingEnabled,
        theme: site.appearance?.defaultTheme || 'cac',
        themes: site.appearance?.themes || {},
        themeToggle: site.appearance?.toggle !== false,
    }, null, 2)};\n`,
    'utf8');
/* GitHub Pages 默认会用 Jekyll 处理，放一个 .nojekyll 跳过 */
writeFileSync(join(DIST, '.nojekyll'), '', 'utf8');

/* 搜索索引 */
writeFileSync(join(DIST, 'search-index.json'), JSON.stringify(searchIndexFor(pages, u)), 'utf8');

/* sitemap / robots（没填完整地址就不生成 sitemap） */
const sitemap = sitemapFor(pages, origin, escapeHtml);
if (sitemap) { writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8'); }
writeFileSync(join(DIST, 'robots.txt'), robotsFor(origin), 'utf8');

/* ── 站内链接自检 ──────────────────────────────────────────────────────── */
const problems = findDeadLinks(pages, { base, byRoute, distDir: DIST });

console.log(`构建完成：${count} 个页面、${redirects} 个旧地址跳转 → dist/`);
if (skippedRedirects.length) {
    console.log(`Windows 文件名限制，跳过 ${skippedRedirects.length} 个含冒号的旧地址：${skippedRedirects.join('、')}`);
}
if (problems.length) {
    console.log(`\n⚠ 有 ${problems.length} 个站内链接指向不存在的页面：`);
    for (const p of [...new Set(problems)].slice(0, 20)) { console.log(`   ${p}`); }
} else {
    console.log('站内链接检查：全部有效');
}
