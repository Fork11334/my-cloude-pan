/* ==========================================================================
   档案部：数据完整性 + 页面结构
   数据测「形状对不对」，构建测试「页面里真的有那些钩子」。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildToTemp, read } from './helpers.mjs';

const DATA = JSON.parse(readFileSync(fileURLToPath(new URL('../site/data/archive.json', import.meta.url)), 'utf8'));

test('设施：五种类型齐全，每条都有坐标与唯一编号', () => {
    const types = Object.keys(DATA.facilities.types);
    assert.deepEqual(types.sort(), ['base', 'front', 'logistics', 'outpost', 'research']);

    const slugs = new Set();
    for (const f of DATA.facilities.items) {
        assert.ok(types.includes(f.type), `${f.name} 的类型不存在：${f.type}`);
        assert.equal(typeof f.lat, 'number');
        assert.equal(typeof f.lon, 'number');
        assert.ok(f.lat >= -90 && f.lat <= 90, `${f.name} 纬度越界`);
        assert.ok(f.lon >= -180 && f.lon <= 180, `${f.name} 经度越界`);
        assert.ok(f.summary.length > 10, `${f.name} 缺少简介`);
        assert.ok(!slugs.has(f.slug), `设施编号重复：${f.slug}`);
        slugs.add(f.slug);
    }
    assert.ok(slugs.size >= 5);
});

test('装备：三类齐全，常规三列非空，特殊三张设计图有形状名', () => {
    const eq = DATA.equipment;
    assert.equal(eq.categories.length, 3);
    assert.deepEqual(eq.categories.map((c) => c.id), ['regular', 'special', 'anomalous']);

    for (const key of ['firearms', 'throwables', 'armor']) {
        assert.ok(eq.regular[key].length >= 3, `${key} 太少`);
        for (const item of eq.regular[key]) {
            assert.ok(item.name && item.spec && item.note);
        }
    }

    assert.equal(eq.special.length, 3);
    const shapes = eq.special.map((s) => s.shape).sort();
    assert.deepEqual(shapes, ['anchor', 'k96', 'suit']);
});

test('项目 / 论文 / 行动 / 评估：排序与检索字段齐全', () => {
    assert.ok(DATA.projects.length >= 5);
    for (const p of DATA.projects) {
        assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(p.code, /^[A-Z]+-(P-)?\d+$/);
        assert.ok([1, 2, 3].includes(p.levelRank));
    }

    assert.ok(DATA.papers.length >= 5);
    for (const p of DATA.papers) {
        assert.ok(p.author && p.field && p.title);
    }

    for (const key of ['operations', 'evaluations']) {
        assert.ok(DATA[key].length >= 5, `${key} 太少`);
        for (const item of DATA[key]) {
            assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
            assert.ok(item.code && item.summary);
        }
    }
    for (const e of DATA.evaluations) {
        assert.ok(['高', '中', '低'].includes(e.risk), `风险等级不认识：${e.risk}`);
    }
});

test('六个入口页与全部设施详情页都构建出来了', async () => {
    const out = await buildToTemp();
    const routes = [
        'archive/index.html',
        'archive/facilities/index.html',
        'archive/equipment/index.html',
        'archive/projects/index.html',
        'archive/papers/index.html',
        'archive/operations/index.html',
        'archive/evaluations/index.html',
    ];
    for (const rel of routes) {
        assert.ok(read(out, rel).length > 2000, `${rel} 内容过少`);
    }
    for (const f of DATA.facilities.items) {
        const html = read(out, `archive/facilities/${f.slug}/index.html`);
        assert.ok(html.includes('fac-spec'), `${f.slug} 缺少规格表`);
        assert.ok(html.includes(f.name), `${f.slug} 页面里没有设施名`);
    }
});

test('档案部主页：六个入口 + 独立搜索框', async () => {
    const out = await buildToTemp();
    const html = read(out, 'archive/index.html');

    assert.equal((html.match(/data-arc-entry/g) || []).length, 6);
    assert.match(html, /data-arc-search/);
    assert.match(html, /data-arc-q/);
    for (const route of ['/archive/facilities/', '/archive/equipment/', '/archive/projects/', '/archive/papers/', '/archive/operations/', '/archive/evaluations/']) {
        assert.ok(html.includes(route), `主页缺少入口：${route}`);
    }
});

test('设施页：地球画布、六条设施、五种图例颜色', async () => {
    const out = await buildToTemp();
    const html = read(out, 'archive/facilities/index.html');

    assert.match(html, /data-morph="globe"/);
    assert.equal((html.match(/data-fac="/g) || []).length, DATA.facilities.items.length);
    assert.equal((html.match(/fac-legend__item/g) || []).length, 5);
    assert.match(html, /data-fac-link/);
    assert.match(html, /data-fac-detail/);
    // 每条都要带坐标与颜色，否则 JS 转不过去
    const picks = html.match(/data-lat="[-\d.]+" data-lon="[-\d.]+"/g) || [];
    assert.equal(picks.length, DATA.facilities.items.length);
});

test('装备页：三个标签、三列背景画布、三张特殊设计图', async () => {
    const out = await buildToTemp();
    const html = read(out, 'archive/equipment/index.html');

    assert.equal((html.match(/data-eq-tab="/g) || []).length, 3);
    assert.equal((html.match(/data-eq-panel="/g) || []).length, 3);

    const canvases = html.match(/data-shape-canvas="(gun|grenade|armor)"/g) || [];
    assert.equal(canvases.length, 3, '常规装备应当有三列各自的粒子画布');

    const designs = html.match(/data-shape="(anchor|k96|suit)"/g) || [];
    assert.equal(designs.length, 3, '特殊装备应当有三张设计图');
    assert.match(html, /data-morph="equipment"/);
});

test('项目页：三种排序按钮与三种背景模式的钩子', async () => {
    const out = await buildToTemp();
    const js = read(out, 'assets/js/archive.js');

    for (const mode of ['date', 'code', 'level']) {
        assert.ok(js.includes(`${mode}: { shape:`), `排序模式缺少背景映射：${mode}`);
    }
    const html = read(out, 'archive/projects/index.html');
    assert.equal((html.match(/data-sort="/g) || []).length, 3);
    const items = html.match(/data-date="\d{4}-\d{2}-\d{2}" data-code="[^"]+" data-rank="\d"/g) || [];
    assert.equal(items.length, DATA.projects.length);
});

test('论文页：作者与专业两个检索框 + 可筛选的条目', async () => {
    const out = await buildToTemp();
    const html = read(out, 'archive/papers/index.html');

    assert.match(html, /data-paper-author/);
    assert.match(html, /data-paper-field/);
    assert.equal((html.match(/data-author="/g) || []).length, DATA.papers.length);
});

test('交互回归：画布必须收指针，首页档案板块必须能进', async () => {
    const out = await buildToTemp();

    // 上一版就是这里写成了 none，导致地球拖不动、所有背景都不响应鼠标
    const css = read(out, 'assets/css/archive.css');
    const block = css.split('.arc-canvas {')[1].split('}')[0];
    assert.match(block, /pointer-events:\s*auto/, '.arc-canvas 必须 pointer-events: auto');

    const home = read(out, 'index.html');
    assert.match(home, /class="vacant vacant--link" href="\/archive\/"/, '首页档案板块没有链到档案部');
    assert.ok(home.includes('/archive/'), '首页缺少档案部入口');
});

test('每一页都有可交互背景，且没有残留占位文案', async () => {
    const out = await buildToTemp();

    const pages = [
        'index.html',
        'archive/index.html',
        'archive/facilities/index.html',
        'archive/equipment/index.html',
        'archive/projects/index.html',
        'archive/papers/index.html',
        'archive/operations/index.html',
        'archive/evaluations/index.html',
        'verify/index.html',
        'verify/register/index.html',
    ];

    for (const rel of pages) {
        const html = read(out, rel);
        const hasBg = /data-bg=|data-morph=|data-ocean|data-globe3d/.test(html);
        assert.ok(hasBg, `${rel} 没有任何背景画布`);
    }

    // 首页的占位板块要明确标成临时模板，不能再说「重写中」
    const home = read(out, 'index.html');
    assert.ok(!/>重写中</.test(home), '首页还有「重写中」的占位标题');
    assert.ok(!home.includes('这只是个临时模板'), '首页不该再有临时模板占位');
    assert.ok(home.includes('/forum/'), '论坛板块应链到存档');
});

test('行动记录与评估报告：按时间倒序，且各用各的数据集', async () => {
    const out = await buildToTemp();

    for (const [rel, key, prefix] of [
        ['archive/operations/index.html', 'operations', 'OP-'],
        ['archive/evaluations/index.html', 'evaluations', 'EV-'],
    ]) {
        const html = read(out, rel);
        const dates = [...html.matchAll(/<time class="tl__date" datetime="([\d-]+)"/g)].map((m) => m[1]);
        assert.equal(dates.length, DATA[key].length, `${key} 条目数不对`);

        const sorted = dates.slice().sort((a, b) => b.localeCompare(a));
        assert.deepEqual(dates, sorted, `${key} 不是按时间倒序`);

        assert.ok(html.includes(prefix), `${key} 页面里没有 ${prefix} 编号，可能取了错的数据集`);
    }
});
