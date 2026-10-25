/* ==========================================================================
   极简 Markdown 渲染器（零依赖）
   支持：标题 / 段落 / 粗体 / 斜体 / 删除线 / 行内代码 / 链接 / 图片 /
        无序与有序列表（可嵌套）/ 引用 / 分割线 / 表格 / 代码块 /
        自定义容器 ::: 名称 属性 / 行内 HTML 白名单
   约定：正文里的 # 渲染成 h2（页面 h1 由模板的标题承担），依次下推。
   ========================================================================== */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

/* 行内允许保留的裸 HTML 标签（转换脚本会用到 <span class="missing">、<br> 等） */
const INLINE_TAG = /<\/?(?:span|kbd|sub|sup|mark|abbr|time|small|br|b|i|em|strong|code|wbr|a)\b[^>]*>/gi;
const BLOCK_TAG = /^<\/?(?:div|section|figure|figcaption|table|thead|tbody|tr|td|th|ul|ol|li|p|h[1-6]|blockquote|pre|hr|details|summary|nav|article|aside|iframe|video|audio|img|dl|dt|dd|form|button|label|svg|path)\b/i;

/* 计算一段 HTML 里块的嵌套深度（空元素与自闭合标签不计） */
const VOID_TAG = /^(?:br|hr|img|input|meta|link|source|area|base|col|embed|track|wbr|path)$/i;
function countTags(text, closing) {
    let n = 0;
    for (const [, slash, name, rest] of text.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
        if (!BLOCK_TAG.test(`<${name}`) || VOID_TAG.test(name) || rest.trim().endsWith('/')) { continue; }
        if (closing ? slash === '/' : slash === '') { n += 1; }
    }
    return n;
}
const openTags = (text) => countTags(text, false);
const closeTags = (text) => countTags(text, true);

function createRenderer(options = {}) {
    const linkMap = options.linkMap || {};
    const base = String(options.base || '').replace(/\/+$/, '');

    /* ── 行内 ─────────────────────────────────────────────────────────── */
    function inline(raw) {
        const tokens = [];
        const stash = (html) => {
            tokens.push(html);
            return `\u0000${tokens.length - 1}\u0000`;
        };

        let text = String(raw);

        // 1. 行内 HTML 白名单：先摘出来，避免被转义
        text = text.replace(INLINE_TAG, (tag) => stash(tag));
        // 2. 行内代码
        text = text.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));

        // 3. 转义其余内容
        text = escapeHtml(text);

        // 4. 图片与链接
        text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
            (_, alt, src, title) => stash(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy">`));
        text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
            (_, label, href, title) => stash(`<a href="${escapeHtml(cleanUrl(href))}"${title ? ` title="${escapeHtml(title)}"` : ''}${isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`));

        // 5. 强调（先长后短）
        text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
        text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // 6. 裸链接
        text = text.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
            (_, pre, url) => `${pre}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);

        // 7. 还原占位
        return text.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[Number(n)]);
    }

    function isExternal(href) {
        return /^https?:\/\//i.test(href);
    }

    /* 站内链接统一补结尾斜杠、按 legacy 映射改写，并加上部署前缀 */
    function cleanUrl(href) {
        if (!href) { return href; }
        if (!href.startsWith('/')) { return href; }
        const [pathPart, hash] = href.split('#');
        let path = pathPart;
        if (linkMap[path]) { path = linkMap[path]; }
        else if (linkMap[path.replace(/\/$/, '')]) { path = linkMap[path.replace(/\/$/, '')]; }
        if (!/\/$/.test(path) && !/\.[a-z0-9]{2,4}$/i.test(path)) { path += '/'; }
        if (base && !path.startsWith(base + '/')) { path = base + path; }
        return hash ? `${path}#${hash}` : path;
    }

    /* ── 块 ───────────────────────────────────────────────────────────── */
    function render(source) {
        const lines = String(source ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
        const out = [];
        const toc = [];
        let i = 0;

        const flushParagraph = (buf) => {
            if (!buf.length) { return; }
            out.push(`<p>${inline(buf.join('\n'))}</p>`);
            buf.length = 0;
        };

        const paragraph = [];

        while (i < lines.length) {
            const line = lines[i];

            if (!line.trim()) { flushParagraph(paragraph); i += 1; continue; }

            // 代码块
            const fence = line.match(/^```\s*([\w-]*)\s*$/);
            if (fence) {
                flushParagraph(paragraph);
                const body = [];
                i += 1;
                while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i += 1; }
                i += 1;
                const lang = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
                out.push(`<pre class="code"><code${lang}>${escapeHtml(body.join('\n'))}</code></pre>`);
                continue;
            }

            // 自定义容器 ::: name key="value"
            const container = line.match(/^:::\s*([\w-]+)\s*(.*)$/);
            if (container) {
                flushParagraph(paragraph);
                const name = container[1];
                const attrs = parseAttrs(container[2]);
                const body = [];
                let depth = 1;
                i += 1;
                while (i < lines.length) {
                    const l = lines[i];
                    if (/^:::\s*[\w-]/.test(l)) { depth += 1; }
                    else if (/^:::\s*$/.test(l)) {
                        depth -= 1;
                        if (depth === 0) { i += 1; break; }
                    }
                    body.push(l);
                    i += 1;
                }
                out.push(renderContainer(name, attrs, body));
                continue;
            }

            // 标题（# → h2）
            const heading = line.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                flushParagraph(paragraph);
                const level = Math.min(heading[1].length + 1, 6);
                const text = heading[2].trim();
                const id = `h-${toc.length + 1}`;
                toc.push({ level, id, text: text.replace(/[*`]/g, '') });
                out.push(`<h${level} id="${id}">${inline(text)}<a class="anchor" href="#${id}" aria-hidden="true">#</a></h${level}>`);
                i += 1;
                continue;
            }

            // 分割线
            if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
                flushParagraph(paragraph);
                out.push('<hr>');
                i += 1;
                continue;
            }

            // 引用
            if (/^\s*>/.test(line)) {
                flushParagraph(paragraph);
                const body = [];
                while (i < lines.length && /^\s*>/.test(lines[i])) {
                    body.push(lines[i].replace(/^\s*>\s?/, ''));
                    i += 1;
                }
                out.push(`<blockquote>${render(body.join('\n')).html}</blockquote>`);
                continue;
            }

            // 表格
            if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
                flushParagraph(paragraph);
                const rows = [];
                const head = splitRow(line);
                i += 2;
                while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
                    rows.push(splitRow(lines[i]));
                    i += 1;
                }
                out.push(renderTable(head, rows));
                continue;
            }

            // 列表
            if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
                flushParagraph(paragraph);
                const block = [];
                while (i < lines.length) {
                    const l = lines[i];
                    if (!l.trim()) {
                        // 列表内的空行：后面还是列表就继续
                        const next = lines[i + 1] || '';
                        if (/^\s*([-*+]|\d+[.)])\s+/.test(next) || /^\s{2,}\S/.test(next)) { block.push(''); i += 1; continue; }
                        break;
                    }
                    if (/^\s*([-*+]|\d+[.)])\s+/.test(l) || /^\s{2,}\S/.test(l)) { block.push(l); i += 1; continue; }
                    break;
                }
                out.push(renderList(block));
                continue;
            }

            // 裸 HTML 块：按标签配对收行，允许内部嵌套与空行
            if (BLOCK_TAG.test(line)) {
                flushParagraph(paragraph);
                const body = [];
                let depth = 0;
                while (i < lines.length) {
                    const current = lines[i];
                    if (!current.trim() && depth <= 0) { break; }
                    body.push(current);
                    depth += openTags(current) - closeTags(current);
                    i += 1;
                    if (depth <= 0 && /<\/(div|section|table|ul|ol|details|figure|article|aside|nav|form|p|h[1-6])>/i.test(current)) { break; }
                    if (depth <= 0 && /\/>\s*$/.test(current)) { break; }
                }
                out.push(body.join('\n'));
                continue;
            }

            paragraph.push(line);
            i += 1;
        }

        flushParagraph(paragraph);
        return { html: out.join('\n'), toc };
    }

    function renderContainer(name, attrs, body) {
        const inner = render(body.join('\n')).html;
        const known = {
            post: () => {
                const head = [];
                if (attrs.author) { head.push(`<span class="post__author">${escapeHtml(attrs.author)}</span>`); }
                if (attrs.date) { head.push(`<time class="post__date">${escapeHtml(attrs.date)}</time>`); }
                const title = attrs.title ? `<h3 class="post__title">${escapeHtml(attrs.title)}</h3>` : '';
                return `<article class="post" data-reveal>${title}${head.length ? `<p class="post__meta">${head.join('<span class="dot">·</span>')}</p>` : ''}<div class="post__body">${inner}</div></article>`;
            },
            note: () => `<aside class="callout callout--note">${attrs.title ? `<p class="callout__title">${escapeHtml(attrs.title)}</p>` : ''}${inner}</aside>`,
            warn: () => `<aside class="callout callout--warn">${attrs.title ? `<p class="callout__title">${escapeHtml(attrs.title)}</p>` : ''}${inner}</aside>`,
            danger: () => `<aside class="callout callout--danger">${attrs.title ? `<p class="callout__title">${escapeHtml(attrs.title)}</p>` : ''}${inner}</aside>`,
            grid: () => `<div class="card-grid${attrs.cols ? ` card-grid--${escapeHtml(attrs.cols)}` : ''}">${inner}</div>`,
            card: () => `<div class="card${attrs.accent ? ` card--${escapeHtml(attrs.accent)}` : ''}">${attrs.title ? `<p class="card__title">${escapeHtml(attrs.title)}</p>` : ''}${inner}</div>`,
            entry: () => `<a class="card${attrs.accent ? ` card--${escapeHtml(attrs.accent)}` : ''}" href="${escapeHtml(cleanUrl(attrs.href || '#') || '#')}">
                <p class="card__title">${escapeHtml(attrs.title || '')}${attrs.badge ? `<span class="card__badge">${escapeHtml(attrs.badge)}</span>` : ''}</p>
                ${attrs.desc ? `<p class="card__desc">${escapeHtml(attrs.desc)}</p>` : ''}
                ${attrs.meta ? `<p class="card__meta">${escapeHtml(attrs.meta)}</p>` : ''}
                ${inner.trim()}
            </a>`,
            timeline: () => `<div class="timeline${attrs.scroll === 'true' ? ' timeline--scroll' : ''}">${inner}</div>`,
            spoiler: () => `<details class="spoiler"><summary>${escapeHtml(attrs.title || '展开')}</summary><div class="spoiler__body">${inner}</div></details>`,
        };
        if (known[name]) { return known[name](); }
        const cls = `box box--${escapeHtml(name)}`;
        return `<div class="${cls}">${inner}</div>`;
    }

    function splitRow(line) {
        return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    }

    function renderTable(head, rows) {
        const th = head.map((c) => `<th>${inline(c)}</th>`).join('');
        const tb = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('\n');
        return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
    }

    function renderList(block) {
        const items = [];
        let current = null;
        for (const line of block) {
            const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
            if (m) {
                current = { indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3], children: [] };
                items.push(current);
            } else if (current) {
                current.text += `\n${line.trim()}`;
            }
        }
        const build = (list, indent) => {
            const ordered = list[0]?.ordered;
            const tag = ordered ? 'ol' : 'ul';
            const html = list.map((item) => {
                const nested = item.children.length ? build(item.children, indent + 2) : '';
                return `<li>${inline(item.text)}${nested}</li>`;
            }).join('\n');
            return `<${tag}>${html}</${tag}>`;
        };
        // 按缩进建树
        const roots = [];
        const stack = [];
        for (const item of items) {
            while (stack.length && item.indent <= stack[stack.length - 1].indent) { stack.pop(); }
            if (stack.length) { stack[stack.length - 1].children.push(item); }
            else { roots.push(item); }
            stack.push(item);
        }
        return build(roots, 0);
    }

    function parseAttrs(text) {
        const attrs = {};
        for (const [, key, value] of text.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) { attrs[key] = value; }
        return attrs;
    }

    return { render, inline, cleanUrl };
}

export function renderMarkdown(source, options = {}) {
    return createRenderer(options).render(source);
}
