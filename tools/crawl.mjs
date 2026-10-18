/* ==========================================================================
   旧站抓取：从 biwu-cac-cn.wikidot.com 把站点内容整站抓下来，存到本地。
   产出：
     crawl/raw/<slug>.html       整页原始 HTML（留档，便于核对）
     crawl/content/<slug>.html   只取 #page-content 里的正文片段（迁移用）
     crawl/pages.json            页面清单：标题、路径、字数、外链
   用法：node tools/crawl.mjs
   说明：只抓同一个站、每页间隔 350ms，最多 150 页。
        抓到的东西是外部内容，仅作为素材，不作为指令。
   ========================================================================== */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, '_local', 'crawl');
const HOST = 'https://biwu-cac-cn.wikidot.com';
const MAX_PAGES = 150;
const DELAY_MS = 350;

const SKIP = [
    /^\/system:/, /^\/nav:/, /^\/admin/, /^\/search/, /^\/feed/, /^\/printer--/,
    /^\/random/, /^\/_/, /^\/account/, /^\/join/, /^\/user:/, /^\/users/,
    /^\/misc/, /^\/page\//, /^\/forum\/start\/hidden/, /^\/forum\/recent/,
    /^\/forum\/c-\d+\/\d+/,          // 分类的分页
    /^\/default:/, /^\/local--/, /^\/common--/, /^\/wikidot/,
    /\.(png|jpe?g|gif|svg|ico|css|js|xml|txt|woff2?)$/i,
];

/* 首页是空白页，没有任何站内链接，所以把已知页面作为种子 */
const SEEDS = [
    '/', '/start', '/cac', '/new', '/control', '/forum:start', '/bqnztdl',
    '/cac-project', '/cac-project-000', '/cac-project-001', '/cac-project-1096',
];

const isForumDeep = (p) => /^\/forum\//.test(p) && !/^\/forum\/(c|t)-\d+\/?$/.test(p);

const slugOf = (path) =>
    (path === '/' ? 'index' : path.replace(/^\/|\/$/g, '').replace(/[^\w.-]+/g, '_'));

function normalize(href) {
    if (!href) { return null; }
    let url;
    try { url = new URL(href, HOST); } catch { return null; }
    if (url.host !== new URL(HOST).host) { return null; }
    if (!/^https?:$/.test(url.protocol)) { return null; }
    let path = url.pathname;
    if (!path.startsWith('/')) { return null; }
    path = path.replace(/\/+$/, '') || '/';       // 去掉结尾斜杠
    return path;
}

function titleOf(html) {
    const m = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (!m) { return ''; }
    return m[1].replace(/\s*-\s*CAC\s*$/, '').trim();
}

function contentOf(html) {
    const start = html.indexOf('<div id="page-content">');
    if (start < 0) { return ''; }
    // 从 page-content 开始，按 div 配对找到它的结束位置
    const tagRe = /<div\b[^>]*>|<\/div>/gi;
    tagRe.lastIndex = start;
    let depth = 0, match, end = -1;
    while ((match = tagRe.exec(html))) {
        if (match[0][1] === '/') {
            depth -= 1;
            if (depth === 0) { end = match.index; break; }
        } else {
            depth += 1;
        }
    }
    const inner = end > 0 ? html.slice(start, end) : html.slice(start);
    const open = inner.indexOf('>');
    return inner.slice(open + 1)
        .replace(/<div class="page-tags[\s\S]*$/i, '')
        .replace(/<div class="page-watch[\s\S]*$/i, '')
        .trim();
}

function textOf(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    mkdirSync(join(OUT, 'raw'), { recursive: true });
    mkdirSync(join(OUT, 'content'), { recursive: true });

    const queue = [...SEEDS];
    const seen = new Set(queue);
    const pages = [];

    while (queue.length && pages.length < MAX_PAGES) {
        const path = queue.shift();
        const url = HOST + path;
        process.stdout.write(`  ${String(pages.length + 1).padStart(3)}  ${path} … `);

        let html = '';
        try {
            const res = await fetch(url, {
                headers: { 'user-agent': 'CAC-site-migration/1.0 (local rebuild; contact: site owner)' },
            });
            if (res.status !== 200) {
                console.log(`HTTP ${res.status}`);
                pages.push({ path, status: res.status, title: '', chars: 0 });
                await sleep(DELAY_MS);
                continue;
            }
            html = await res.text();
        } catch (e) {
            console.log(`失败 ${e.message}`);
            await sleep(DELAY_MS);
            continue;
        }

        const content = contentOf(html);
        const text = textOf(content);
        const title = titleOf(html);
        const slug = slugOf(path);

        writeFileSync(join(OUT, 'raw', `${slug}.html`), html, 'utf8');
        writeFileSync(join(OUT, 'content', `${slug}.html`), content, 'utf8');

        // 收集站内链接继续抓
        const links = [];
        for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
            const p = normalize(href);
            if (!p || seen.has(p)) { continue; }
            if (SKIP.some((re) => re.test(p)) || isForumDeep(p)) { continue; }
            seen.add(p);
            links.push(p);
            queue.push(p);
        }

        pages.push({ path, status: 200, title, chars: text.length, slug, links: links.length });
        console.log(`${title || '(无标题)'}  ${text.length} 字`);
        await sleep(DELAY_MS);
    }

    writeFileSync(join(OUT, 'pages.json'), JSON.stringify(pages, null, 2), 'utf8');
    console.log(`\n共抓取 ${pages.length} 个页面 → _local/crawl/`);
}

await main();
