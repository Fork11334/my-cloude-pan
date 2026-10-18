/* ==========================================================================
   内容层：扫描 site/content，解析 front-matter，渲染正文。
   这一层不碰 dist/、不读环境变量，只依赖传入的参数 —— 所以可以直接被测试调用，
   也是整个构建里唯一"纯"的部分（同样的输入永远给同样的输出）。
   ========================================================================== */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, sep } from 'node:path';

import { renderMarkdown } from './markdown.mjs';

/* front-matter：只认 key: value 的平铺写法，值可以是引号串、布尔、数字。
   不支持嵌套与数组 —— 需要嵌套的内容放 site/data/*.json，不放进正文头。 */
export function parseFrontMatter(text) {
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!m) { return { data: {}, body: text }; }
    const data = {};
    for (const line of m[1].split('\n')) {
        const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
        if (!kv) { continue; }
        let value = kv[2].trim();
        if (/^".*"$/.test(value) || /^'.*'$/.test(value)) { value = value.slice(1, -1); }
        else if (value === 'true') { value = true; }
        else if (value === 'false') { value = false; }
        else if (/^-?\d+(\.\d+)?$/.test(value)) { value = Number(value); }
        data[kv[1]] = value;
    }
    return { data, body: text.slice(m[0].length) };
}

export function walkContent(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = `${dir}${sep}${name}`;
        if (statSync(full).isDirectory()) { return walkContent(full); }
        return name.endsWith('.md') ? [full] : [];
    });
}

/* 文件路径 → 网址：index.md 是所在目录的首页，其余每个 .md 一个目录 */
export function routeOf(contentDir, file) {
    let rel = relative(contentDir, file).split(sep).join('/').replace(/\.md$/, '');
    if (rel === 'index') { return '/'; }
    rel = rel.replace(/\/index$/, '');
    return `/${rel}/`;
}

/* 从渲染后的 HTML 里抽纯文本，给搜索索引用 */
export function textOf(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/* 读全部页面。这里只做"一页之内"的事；跨页面的派生（面包屑、上下篇、侧栏）在 derive.mjs */
export function loadPages({ contentDir, root, site, base, linkMap }) {
    const files = existsSync(contentDir) ? walkContent(contentDir).sort() : [];

    return files.map((file) => {
        const raw = readFileSync(file, 'utf8');
        const { data, body } = parseFrontMatter(raw);
        const route = data.route || routeOf(contentDir, file);
        const rendered = renderMarkdown(body, { linkMap, base });

        return {
            file: relative(root, file).split(sep).join('/'),
            route,
            title: data.title || '未命名页面',
            subtitle: data.subtitle || '',
            intro: data.intro || '',
            summary: data.summary || '',
            section: data.section || '',
            group: data.group || '',
            order: typeof data.order === 'number' ? data.order : 999,
            updated: data.updated || '',
            status: data.status || '',
            author: data.author || '',
            authorHref: '',
            featured: Number(data.featured) || 0,
            hot: Number(data.hot) || 0,
            layout: data.layout || 'page',
            /* 页面自带的枚举值：校验页的 login/register、时间轴页取哪个数据集 */
            mode: data.mode || '',
            dataset: data.dataset || '',
            hero: data.hero === true,
            wide: data.wide === true,
            locked: data.locked === true || (site.gating.lockSections || []).includes(data.section || ''),
            repost: data.repost === true,
            nav: data.nav === true,
            noindex: data.noindex === true,
            crumbs: [],
            html: rendered.html,
            toc: rendered.toc,
            text: textOf(rendered.html),
        };
    });
}
