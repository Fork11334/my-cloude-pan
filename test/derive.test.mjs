/* ==========================================================================
   派生层的单元测试：分组、分页、首页排序、索引与 sitemap。
   全部用手写的 page 字面量，不碰磁盘 —— 这一层本来就该是纯函数。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    buildHome,
    findDeadLinks,
    groupsOf,
    pagerFor,
    robotsFor,
    searchIndexFor,
    sitemapFor,
} from '../site/lib/derive.mjs';

const page = (over) => ({ route: '/', title: '页', order: 1, group: '', section: '', summary: '', text: '', ...over });

test('groupsOf 按 group 聚合，并保留首次出现的顺序', () => {
    const groups = groupsOf([
        page({ title: 'a', group: '项目资料' }),
        page({ title: 'b', group: '事件记录' }),
        page({ title: 'c', group: '项目资料' }),
    ]);

    assert.deepEqual(groups.map((g) => g.title), ['项目资料', '事件记录']);
    assert.deepEqual(groups[0].items.map((p) => p.title), ['a', 'c']);
});

test('分页在链首链尾返回空，中间返回前后各一篇', () => {
    const pages = [
        page({ route: '/x/1/', title: '一', section: 'x', order: 1 }),
        page({ route: '/x/2/', title: '二', section: 'x', order: 2 }),
        page({ route: '/x/3/', title: '三', section: 'x', order: 3 }),
    ];
    const u = (p) => p;

    assert.deepEqual(pagerFor(pages[0], { pages, u }), { prev: null, next: { title: '二', href: '/x/2/' } });
    assert.deepEqual(pagerFor(pages[1], { pages, u }), {
        prev: { title: '一', href: '/x/1/' },
        next: { title: '三', href: '/x/3/' },
    });
    assert.deepEqual(pagerFor(pages[2], { pages, u }), { prev: { title: '二', href: '/x/2/' }, next: null });
});

test('首页公告与新闻按日期倒序', () => {
    const home = buildHome({
        pages: [],
        notices: {
            announcements: [{ date: '2026-01-01', title: '旧' }, { date: '2026-03-01', title: '新' }],
            news: [{ date: '2026-02-01' }, { date: '2026-04-01' }],
        },
        homeJson: {},
    });

    assert.deepEqual(home.announcements.map((n) => n.title), ['新', '旧']);
    assert.deepEqual(home.news.map((n) => n.date), ['2026-04-01', '2026-02-01']);
    assert.deepEqual(home.services, []);
});

test('搜索索引剔除 404、gate 与 noindex 页面', () => {
    const index = searchIndexFor([
        page({ route: '/a/', title: '甲' }),
        page({ route: '/404/', title: '兜底' }),
        page({ route: '/gate/', title: '门禁', layout: 'gate' }),
        page({ route: '/b/', title: '乙', noindex: true }),
    ], (p) => p);

    assert.deepEqual(index.map((e) => e.title), ['甲']);
    assert.equal(index[0].url, '/a/');
});

test('sitemap 只在给了完整地址时生成，且带上 origin', () => {
    assert.equal(sitemapFor([page()], '', (s) => s), null);

    const xml = sitemapFor([page({ route: '/a/', updated: '2026-10-11' })], 'https://x.test/cac', (s) => s);
    assert.match(xml, /<loc>https:\/\/x\.test\/cac\/a\/<\/loc>/);
    assert.match(xml, /<lastmod>2026-10-11<\/lastmod>/);
});

test('robots.txt 有地址时带 Sitemap 行，没有时不带', () => {
    assert.doesNotMatch(robotsFor(''), /Sitemap:/);
    assert.match(robotsFor('https://x.test'), /Sitemap: https:\/\/x\.test\/sitemap\.xml/);
});

test('站内链接检查能抓出缺失的目标', () => {
    const dist = mkdtempSync(join(tmpdir(), 'cac-dist-'));
    mkdirSync(join(dist, 'exists'), { recursive: true });
    writeFileSync(join(dist, 'exists', 'index.html'), '', 'utf8');

    const problems = findDeadLinks([
        page({ route: '/', html: '<a href="/exists/">ok</a><a href="/missing/">bad</a><a href="https://out.test/">out</a>' }),
    ], { base: '', byRoute: new Map(), distDir: dist });

    assert.equal(problems.length, 1);
    assert.match(problems[0], /\/missing\//);
});
