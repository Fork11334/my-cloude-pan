/* ==========================================================================
   把 crawl/content 里抓下来的旧站正文转换成 site/content 下的 Markdown。

   本脚本只负责**从旧站迁移过来的页面**：
     golden.md、bqnztdl.md、control/cac-project-1096.md、forum/t-*.md
   其余页面（首页、守则、数据库、控制部各条目、成员档案等）都是人工撰写的，
   本脚本绝不写入，避免重新抓取时把手写内容覆盖掉。

   用法：node tools/extract-content.mjs
   ========================================================================== */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, '_local', 'crawl', 'content');
const OUT = join(root, 'site', 'content');

const read = (slug) => {
    const file = join(SRC, `${slug}.html`);
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

const decode = (s) => String(s)
    .replace(/&nbsp;|&#160;|&#32;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&raquo;/g, '»')
    .replace(/&laquo;/g, '«')
    .replace(/&times;/g, '×')
    .replace(/&rarr;/g, '→')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/gi, ' ');

/* ── HTML → Markdown ─────────────────────────────────────────────────────
   分两层：结构块（标题/段落/列表/引用/表格）先转成 Markdown 骨架，
   块内文字再走一遍行内转换。结构块的结果用占位符存起来，
   避免行内层把已经生成好的 <span class="missing"> 当成未知标签删掉。 */
function md(html) {
    const stash = [];
    const save = (text) => {
        stash.push(text);
        return `\u0001${stash.length - 1}\u0001`;
    };

    let s = String(html);
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/<div class="page-rate-widget-box"[\s\S]*?<\/div>/gi, '');
    s = s.replace(/\{\$[^}]*\}/g, '');
    s = s.replace(/<div[^>]*id="u-(author_block|comments2|faq)[\s\S]*?<\/div>/gi, '');
    s = s.replace(/<div[^>]*style="display:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    s = s.replace(/<(div|details)[^>]*class="[^"]*(collapsible|u-faq)[^"]*"[^>]*>/gi, '');

    s = s.replace(/<table[\s\S]*?<\/table>/gi, (t) => save(table(t)));
    // 引用块里的换行要显式写成 <br>，否则整段对话会被 Markdown 合成一行
    s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
        const body = md(inner).split('\n').map((l) => l.trim()).filter(Boolean);
        return save(body.map((l, i) => `> ${l}${i < body.length - 1 ? '<br>' : ''}`).join('\n'));
    });
    s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
        (_, level, inner) => `\n\n${'#'.repeat(Number(level))} ${inlineMd(inner).trim()}\n\n`);
    s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${inlineMd(inner).trim()}`);
    s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
    s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => `\n\n${inlineMd(inner).trim()}\n\n`);
    s = s.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
    s = s.replace(/<div[^>]*>/gi, '\n\n').replace(/<\/div>/gi, '\n\n');
    s = s.replace(/<br\s*\/?>/gi, '<br>');

    s = inlineMd(s);

    s = s.replace(/\u0001(\d+)\u0001/g, (_, n) => stash[Number(n)]);
    s = s.replace(/[ \t]+\n/g, '\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
}

/* 行内标记 → Markdown（只跑一次，所以可以安全地产出 HTML 片段） */
function inlineMd(html) {
    let s = String(html);
    s = s.replace(/<a[^>]*class="[^"]*newpage[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
        (_, text) => `<span class="missing" title="本页尚未建立">${plain(text)}</span>`);
    s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_, href, text) => `[${plain(text)}](${fixHref(href)})`);
    s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${plain(t)}**`);
    s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${plain(t)}*`);
    s = s.replace(/<(del|s)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `~~${plain(t)}~~`);
    s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${plain(t)}\``);
    s = s.replace(/<span[^>]*line-through[^>]*>([\s\S]*?)<\/span>/gi, (_, t) => `~~${plain(t)}~~`);
    s = s.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, (_, t) => plain(t));
    s = s.replace(/<br\s*\/?>/gi, '<br>');
    s = s.replace(/<[^>]+>/g, '');
    return decode(s);
}

/* 纯文本：去标签、压空白 */
function plain(html) {
    return decode(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

const strip = plain;

function summarize(text, limit = 70) {
    const s = plain(String(text)
        .replace(/:::\s*[\w-]+[^\n]*/g, '')
        .replace(/:::/g, '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\*\*|~~|`/g, '')
        .replace(/^-\s*/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
    return s.length > limit ? `${s.slice(0, limit)}…` : s;
}

function fixHref(href) {
    if (/^https?:/i.test(href)) { return href; }
    if (href.startsWith('/')) { return href; }
    return `/${href.replace(/^\.?\//, '')}`;
}

function table(html) {
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
        [...m[1].matchAll(/<(t[hd])[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => strip(c[2])));
    if (!rows.length) { return ''; }
    const head = rows[0];
    const body = rows.slice(1);
    const line = (cells) => `| ${cells.join(' | ')} |`;
    return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}

/* 取某个 <div ...> 的内部 HTML（按标签配对，避免被嵌套 div 截断） */
function innerDiv(html, marker) {
    const start = html.indexOf(marker);
    if (start < 0) { return ''; }
    const openEnd = html.indexOf('>', start) + 1;
    if (openEnd <= 0) { return ''; }
    let depth = 1;
    const re = /<div\b[^>]*>|<\/div>/gi;
    re.lastIndex = openEnd;
    let m;
    while ((m = re.exec(html))) {
        if (m[0][1] === '/') {
            depth -= 1;
            if (depth === 0) { return html.slice(openEnd, m.index); }
        } else {
            depth += 1;
        }
    }
    return html.slice(openEnd);
}

/* 删掉某个 <div>（按标签配对，不要用懒惰匹配——中间可能隔着正文） */
function removeDiv(html, marker) {
    const start = html.indexOf(marker);
    if (start < 0) { return html; }
    let depth = 0;
    const re = /<div\b[^>]*>|<\/div>/gi;
    re.lastIndex = start;
    let m;
    while ((m = re.exec(html))) {
        if (m[0][1] === '/') {
            depth -= 1;
            if (depth === 0) { return html.slice(0, start) + html.slice(m.index + m[0].length); }
        } else {
            depth += 1;
        }
    }
    return html;
}

/* ── 论坛帖：按 post 拆成 ::: post 块 ──────────────────────────────────── */
function threadToMarkdown(html) {
    const chunks = html.split(/<div class="post" id="post-/).slice(1);
    const posts = [];
    for (const chunk of chunks) {
        const title = strip(innerDiv(chunk, '<div class="title"'));
        const info = innerDiv(chunk, '<div class="info">');
        const content = innerDiv(chunk, '<div class="content"');
        const userBlock = (info.match(/<span class="printuser[\s\S]*?<\/span>/i) || [])[0] || '';
        const names = [...userBlock.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => m[1].trim()).filter(Boolean);
        const author = names.length ? names[names.length - 1] : '';
        const date = strip((info.match(/<span class="odate"[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || '');
        const body = md(content);
        if (!body && !title) { continue; }
        posts.push({ title, author, date, body });
    }
    return posts.map((p) => {
        const attrs = [
            p.title ? `title="${p.title.replace(/"/g, '&quot;')}"` : '',
            p.author ? `author="${p.author.replace(/"/g, '&quot;')}"` : '',
            p.date ? `date="${p.date.replace(/"/g, '&quot;')}"` : '',
        ].filter(Boolean).join(' ');
        return `::: post ${attrs}\n${p.body}\n:::`;
    }).join('\n\n');
}

function channelOf(html) {
    const m = html.match(/<a href="\/forum\/c-\d+\/?"[^>]*>([^<]+)<\/a>/);
    return m ? strip(m[1]).split('/').pop().trim() : '';
}

/* ── 写文件 ────────────────────────────────────────────────────────────── */
function writePage(relPath, front, body) {
    const file = join(OUT, relPath);
    mkdirSync(dirname(file), { recursive: true });
    const matter = Object.entries(front)
        .filter(([, v]) => v !== '' && v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${typeof v === 'string' && /[:#]/.test(v) ? `"${v.replace(/"/g, "'")}"` : v}`)
        .join('\n');
    writeFileSync(file, `---\n${matter}\n---\n\n${body.trim()}\n`, 'utf8');
    return relPath;
}

const written = [];

/* 1) 彩蛋页 /golden */
{
    let html = read('golden');
    html = removeDiv(html, '<div class="info-container">');
    const commentAt = html.search(/<div class="comment-section">/i);
    const comments = commentAt >= 0 ? html.slice(commentAt) : '';
    const body = commentAt >= 0 ? html.slice(0, commentAt) : html;

    const commentMd = [...comments.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
        .map((m) => strip(m[1]))
        .filter((t) => t && !/^讨论串$/.test(t))
        .map((t) => {
            const m = t.match(/^(.*?)\s*\((\d{4}\/\d{2}\/\d{2}\s+[\d:]+)\)\s*点赞\s*(\d+)\s*(.*)$/);
            if (!m) { return `- ${t}`; }
            const text = m[4].replace(/\s*回复\(\d+\+?\)\s*$/, '').trim();
            return `::: post author="${m[1]}" date="${m[2]}" title="点赞 ${m[3]}"\n${text}\n:::`;
        }).join('\n\n');

    written.push(writePage('golden.md', {
        title: '恭喜你，赤到史了',
        subtitle: 'SCP-CN-XXXX · 一个不该在饭前阅读的项目',
        summary: '一篇恶搞风格的项目文档，附评论区存档。',
        group: '彩蛋页',
        section: 'archive',
        order: 20,
        updated: '2026-02-11',
    }, `${md(body)}\n\n# 讨论串\n\n${commentMd}`));
}

/* 2) 转载内容 /bqnztdl */
{
    const html = read('bqnztdl');
    written.push(writePage('bqnztdl.md', {
        title: '败犬女主太多了 第一卷 P2',
        subtitle: '转载内容 · 与本站设定无关',
        summary: '用户搬运的轻小说文本，原样存档。',
        group: '转载内容',
        section: 'archive',
        order: 30,
        repost: 'true',
    }, md(html)));
}

/* 3) 未写完的项目档案 /cac-project-1096 */
{
    const body = md(read('cac-project-1096')).replace(/^#### /gm, '# ');
    written.push(writePage('control/cac-project-1096.md', {
        title: 'CAC-1096「循环」',
        subtitle: '项目档案 · 未完成',
        summary: '一篇未写完的项目文档：祖父和雨。',
        section: 'control',
        group: '项目资料',
        order: 23,
        status: '未完成',
    }, body));
}

/* 4) 论坛讨论串 */
{
    const list = ['forum_t-17594860', 'forum_t-17593316', 'forum_t-17592875', 'forum_t-17592826',
        'forum_t-17592638', 'forum_t-17592816', 'forum_t-17592698', 'forum_t-17592675'];
    const titles = {
        't-17594860': '失败的内嵌页面',
        't-17592698': '什么是内部频道',
        't-17592675': '败犬女主太多了-8.5卷',
        't-17593316': '分享',
        't-17592875': '紧急通告',
        't-17592826': '嵌入练习',
        't-17592638': '二月不会有那么可爱的女主角',
        't-17592816': '安丰毅黑历史这一块',
    };
    /* 首页「论坛板块」精选的话题：数字是排序，越大越靠前 */
    const HOT = { 't-17592875': 4, 't-17592638': 3, 't-17592675': 2, 't-17594860': 1 };
    let n = 0;
    for (const slug of list) {
        const html = read(slug);
        if (!html) { continue; }
        n += 1;
        const channel = channelOf(html) || '未分类';
        const body = threadToMarkdown(html);
        const firstLine = summarize((body.match(/^::: post[^\n]*\n([\s\S]{0,200})/) || [])[1] || '', 64);
        const name = slug.replace('forum_t-', 't-');
        written.push(writePage(`forum/${name}.md`, {
            title: titles[name] || name,
            summary: firstLine,
            section: 'forum',
            group: channel,
            order: n,
            updated: '2026-02-26',
            repost: name === 't-17592675' ? 'true' : '',
            hot: HOT[name] || '',
        }, body));
    }
}

console.log(`已迁移 ${written.length} 个页面：`);
for (const w of written) { console.log('  · site/content/' + w); }
console.log('\n其余页面均为人工撰写，本脚本不会改动。');
