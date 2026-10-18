/* ==========================================================================
   派生层：由"一组页面"算出导航需要的结构（面包屑、侧栏、卡片、分页、首页数据），
   以及构建末尾的搜索索引、sitemap、站内链接检查。
   全部是纯函数：不读环境、不写文件（只有链接检查会问一句"这个路径存在吗"）。
   参数里的 u 是"站内绝对路径 → 带部署前缀"的那个函数，由调用方提供。
   ========================================================================== */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));
export const byOrder = (a, b) => (a.order - b.order) || a.title.localeCompare(b.title, 'zh');

export function groupsOf(list) {
    const map = new Map();
    for (const p of list) {
        const key = p.group || '';
        if (!map.has(key)) { map.set(key, []); }
        map.get(key).push(p);
    }
    return [...map.entries()].map(([title, items]) => ({ title, items }));
}

export function sectionPages(pages, section) {
    return pages
        .filter((p) => p.section === section)
        .sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title, 'zh'));
}

/* 首页各板块的数据。公告/新闻来自 notices.json，档案/论坛/服务/声明来自 home.json */
export function buildHome({ pages, notices, homeJson }) {
    const isSectionIndex = (p) => ['/control/', '/analyze/', '/coexist/'].includes(p.route);
    const data = homeJson || {};

    return {
        announcements: (notices.announcements || []).slice().sort(byDateDesc),
        news: (notices.news || []).slice().sort(byDateDesc),
        archives: data.archives || {},
        forum: data.forum || {},
        services: data.services || [],
        rules: data.rules || [],
        /* 兼容旧字段（资料库页面恢复后仍然有用） */
        featured: pages.filter((p) => p.featured > 0).sort((a, b) => b.featured - a.featured),
        hot: pages.filter((p) => p.hot > 0).sort((a, b) => b.hot - a.hot),
        recentControl: pages.filter((p) => p.section === 'control' && !isSectionIndex(p)).sort(byOrder).slice(0, 7),
        recentOther: pages
            .filter((p) => (p.section === 'analyze' || p.section === 'coexist') && !isSectionIndex(p))
            .sort(byOrder).slice(0, 7),
    };
}

/* 补齐需要"知道全部页面"才能算的字段：署名链接、面包屑、分区强调色、门禁状态 */
export function decoratePages(pages, { site, u, gating }) {
    const byRoute = new Map(pages.map((p) => [p.route, p]));

    for (const page of pages) {
        page.gatingOn = page.locked && gating;

        // 署名 → 链到对应的成员档案页（如果有）
        if (page.author) {
            const slug = String(page.author).toLowerCase().replace(/[^\w-]+/g, '');
            const profile = `/user/${slug}/`;
            if (byRoute.has(profile)) { page.authorHref = u(profile); }
        }

        // 面包屑
        const crumbs = [{ label: '首页', href: u('/') }];
        if (page.section && byRoute.has(`/${page.section}/`)) {
            crumbs.push({ label: site.sections[page.section]?.title || page.section, href: u(`/${page.section}/`) });
        }
        if (page.route !== '/') {
            const isIndex = page.section && page.route === `/${page.section}/`;
            if (!isIndex) { crumbs.push({ label: page.title, href: u(page.route) }); }
        }
        page.crumbs = page.route === '/' ? [] : crumbs;

        const sectionMeta = site.sections[page.section];
        page.accent = sectionMeta?.accent || '';
        page.sectionTitle = sectionMeta?.title || '';
    }

    return byRoute;
}

/* 侧栏：当前页所在分区 */
export function sidebarFor(page, { pages, site, u }) {
    if (!page.section || !site.sections[page.section]) { return null; }
    const meta = site.sections[page.section];
    const list = sectionPages(pages, page.section);
    if (list.length < 2) { return null; }

    return {
        title: meta.title,
        groups: groupsOf(list).map((g) => ({
            title: g.title,
            items: g.items.map((p) => ({
                title: p.title,
                href: u(p.route),
                status: p.status,
                current: p.route === page.route,
            })),
        })),
    };
}

/* 分区首页：自动列出该分区所有子页卡片；成员档案页则列出该成员撰稿的页面 */
export function cardsFor(page, { pages, site, u }) {
    if (page.section === 'user' && page.route !== '/user/') {
        const own = pages
            .filter((p) => p.author && p.author.toLowerCase() === page.title.toLowerCase() && p.route !== page.route)
            .sort((a, b) => a.route.localeCompare(b.route));
        if (!own.length) { return null; }
        return [{
            title: '撰稿',
            items: own.map((p) => ({
                title: p.title, href: u(p.route), summary: p.summary,
                updated: p.updated, accent: p.accent,
            })),
        }];
    }

    if (!page.section || page.route !== `/${page.section}/`) { return null; }
    const meta = site.sections[page.section];
    const list = sectionPages(pages, page.section).filter((p) => p.route !== page.route);
    if (!list.length) { return null; }

    return groupsOf(list).map((g) => ({
        title: g.title || meta?.title || '全部页面',
        items: g.items.map((p) => ({
            title: p.title,
            href: u(p.route),
            summary: p.summary,
            status: p.status,
            updated: p.updated,
            author: p.author,
            accent: p.accent,
        })),
    }));
}

/* 分页：同一分区内按 order 顺序 */
export function pagerFor(page, { pages, u }) {
    if (!page.section) { return null; }
    const list = sectionPages(pages, page.section);
    const i = list.findIndex((p) => p.route === page.route);
    if (i < 0) { return null; }
    const prev = list[i - 1];
    const next = list[i + 1];

    return {
        prev: prev ? { title: prev.title, href: u(prev.route) } : null,
        next: next ? { title: next.title, href: u(next.route) } : null,
    };
}

/* 搜索索引：只收可索引的页面，正文截前 600 字 */
export function searchIndexFor(pages, u) {
    return pages
        .filter((p) => !p.noindex && p.layout !== 'gate' && p.route !== '/404/')
        .map((p) => ({
            title: p.title,
            url: u(p.route),
            section: p.sectionTitle || '',
            group: p.group || '',
            summary: p.summary || '',
            author: p.author || '',
            text: p.text.slice(0, 600),
        }));
}

/* sitemap：没给完整站点地址就不生成（返回 null） */
export function sitemapFor(pages, origin, escapeHtml) {
    if (!origin) { return null; }
    const urls = pages
        .filter((p) => !p.noindex && p.layout !== 'gate' && p.route !== '/404/')
        .map((p) => `  <url><loc>${escapeHtml(origin + p.route)}</loc>${p.updated ? `<lastmod>${escapeHtml(p.updated)}</lastmod>` : ''}</url>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsFor(origin) {
    return `User-agent: *\nAllow: /\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}`;
}

/* 站内链接自检：返回 "页面 → 链接" 的问题清单。构建器只打印，测试会拿它当红灯 */
export function findDeadLinks(pages, { base, byRoute, distDir }) {
    const problems = [];

    for (const page of pages) {
        for (const [, href] of page.html.matchAll(/href="([^"]+)"/g)) {
            if (!href.startsWith('/') || href.startsWith('//')) { continue; }
            // 渲染后的链接带了 base 前缀，检查前先剥掉
            const href2 = base && href.startsWith(base) ? href.slice(base.length) : href;
            const target = href2.split('#')[0];
            if (!target || target.startsWith('/assets')) { continue; }
            const normalized = target.endsWith('/') ? target : `${target}/`;
            if (byRoute.has(normalized) || existsSync(join(distDir, normalized))) { continue; }
            problems.push(`${page.route} → ${href}`);
        }
    }

    return problems;
}
