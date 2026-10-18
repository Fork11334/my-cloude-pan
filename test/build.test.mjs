/* ==========================================================================
   构建器的集成测试
   每个用例都真的跑一次构建，但产物写进系统临时目录（CAC_OUT），不碰工作副本的 dist/。

   这里刻意不复用 build.mjs 内部函数：测试要能独立地"不信"构建器。
   站内链接检查在测试里重写了一遍 —— 构建器的自检只打印警告，测试要让它变成红灯。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { legacyRedirects } from '../site/legacy.mjs';
import { buildToTemp as build, walk } from './helpers.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'site', 'content');

const readConfig = (out) => JSON.parse(
    readFileSync(join(out, 'assets', 'js', 'config.js'), 'utf8')
        .replace(/^\s*window\.CAC\s*=\s*/, '')
        .replace(/;\s*$/, ''),
);

test('构建产出页面、索引与资源', async () => {
    const out = await build();

    for (const rel of [
        'index.html',
        'verify/index.html',
        '404.html',
        'search-index.json',
        'robots.txt',
        '.nojekyll',
        'assets/css/main.css',
        'assets/css/motion.css',
        'assets/css/theme-legacy.css',
        'assets/js/site.js',
        'assets/js/motion.js',
        'assets/js/verify.js',
        'assets/js/config.js',
    ]) {
        assert.ok(existsSync(join(out, rel)), `缺少产物：${rel}`);
    }
});

test('每个 Markdown 源文件都落成了对应路由', async () => {
    const out = await build();
    const files = walk(CONTENT).filter((f) => f.endsWith('.md'));

    assert.ok(files.length > 0, 'site/content 下应当有 Markdown 文件');

    const routes = files.map((file) => {
        let rel = relative(CONTENT, file).replace(/\\/g, '/').replace(/\.md$/, '');
        if (rel === 'index') { return '/'; }
        rel = rel.replace(/\/index$/, '');
        return `/${rel}/`;
    });

    for (const route of routes) {
        // 404 页刻意写成根目录的 404.html，而不是 /404/index.html
        const target = route === '/'
            ? 'index.html'
            : route === '/404/'
                ? '404.html'
                : join(route.replace(/^\//, ''), 'index.html');
        assert.ok(existsSync(join(out, target)), `${route} 没有产出 ${target}`);
    }
});

test('站内链接没有死链', async () => {
    const out = await build();
    const missing = [];

    for (const file of walk(out).filter((f) => f.endsWith('.html'))) {
        const html = readFileSync(file, 'utf8');
        for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
            if (!href.startsWith('/') || href.startsWith('//')) { continue; }
            const target = href.split('#')[0];
            if (!target) { continue; }
            const rel = target.replace(/^\/+/, '');
            const candidates = [join(out, rel), join(out, rel, 'index.html'), `${join(out, rel)}.html`];
            if (!candidates.some((p) => existsSync(p))) {
                missing.push(`${relative(out, file)} → ${href}`);
            }
        }
    }

    assert.deepEqual(missing, [], `发现 ${missing.length} 条死链`);
});

test('搜索索引是合法 JSON，每条都有标题与地址', async () => {
    const out = await build();
    const index = JSON.parse(readFileSync(join(out, 'search-index.json'), 'utf8'));

    assert.ok(Array.isArray(index));
    assert.ok(index.length > 0);
    for (const entry of index) {
        assert.equal(typeof entry.title, 'string');
        assert.ok(entry.title.length > 0);
        assert.match(entry.url, /^\//);
    }
});

test('访问门禁的开关体现在 config.js', async () => {
    const on = await build();
    const off = await build({ CAC_NO_GATE: '1' });

    assert.equal(readConfig(on).enabled, true);
    assert.equal(readConfig(off).enabled, false);
    assert.equal(readConfig(on).verify, '/verify/');
});

test('旧地址都生成了跳转页，且目标真实存在', async () => {
    const out = await build();

    for (const [from, to] of Object.entries(legacyRedirects)) {
        const route = from.endsWith('/') ? from : `${from}/`;
        const file = join(out, route.replace(/^\/+/, ''), 'index.html');
        assert.ok(existsSync(file), `旧地址 ${from} 没有跳转页`);

        const html = readFileSync(file, 'utf8');
        assert.match(html, /http-equiv="refresh"|location\.(replace|href)/, `${from} 没有跳转动作`);

        const target = to.split('#')[0];
        const targetFile = target === '/'
            ? join(out, 'index.html')
            : join(out, target.replace(/^\/+/, ''), 'index.html');
        assert.ok(existsSync(targetFile), `旧地址 ${from} 指向不存在的 ${target}`);
    }
});

test('sitemap 只在给了完整站点地址时生成', async () => {
    const plain = await build();
    assert.ok(!existsSync(join(plain, 'sitemap.xml')), '没给 CAC_SITE_URL 时不应生成 sitemap');
    assert.doesNotMatch(readFileSync(join(plain, 'robots.txt'), 'utf8'), /^Sitemap:/m);

    const hosted = await build({ CAC_SITE_URL: 'https://example.github.io/cac' });
    const xml = readFileSync(join(hosted, 'sitemap.xml'), 'utf8');
    assert.match(xml, /<loc>https:\/\/example\.github\.io\/cac\//);
    assert.match(readFileSync(join(hosted, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.github\.io\/cac\/sitemap\.xml/);
});

test('CAC_BASE 同时作用于产物链接与运行时配置', async () => {
    const out = await build({ CAC_BASE: '/cac' });
    const html = readFileSync(join(out, 'index.html'), 'utf8');

    assert.match(html, /href="\/cac\//);
    assert.equal(readConfig(out).base, '/cac');
});

test('校验页只登录，注册是独立页面', async () => {
    const out = await build();
    const login = readFileSync(join(out, 'verify', 'index.html'), 'utf8');
    const register = readFileSync(join(out, 'verify', 'register', 'index.html'), 'utf8');

    // 登录页：称呼或邮箱 + 密钥，没有邮箱注册字段，也没有密钥卡
    assert.match(login, /data-verify-mode="login"/);
    assert.match(login, /data-field="login"/);
    assert.match(login, /data-field="key"/);
    assert.ok(!login.includes('data-field="email"'), '登录页不该有邮箱字段');
    assert.match(login, /\/verify\/register\//, '登录页要能跳去注册');

    // 注册页：称呼 + 邮箱 + 密钥卡，没有密钥输入
    assert.match(register, /data-verify-mode="register"/);
    assert.match(register, /data-field="user"/);
    assert.match(register, /data-field="email"/);
    assert.match(register, /data-keycard/);
    assert.ok(!register.includes('data-field="key"'), '注册页不该要用户填密钥');
    assert.match(register, /\/verify\//, '注册页要能跳回登录');

    for (const html of [login, register]) {
        assert.ok(html.includes('data-ocean'), '海洋背景丢了');
        assert.ok(html.includes('data-gate-load'), '加载层丢了');
    }
});

test('主页面分区：三套背景、顶部栏图标、部门轴标签', async () => {
    const out = await build();
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const cssMain = readFileSync(join(out, 'assets', 'css', 'main.css'), 'utf8');
    const cssMotion = readFileSync(join(out, 'assets', 'css', 'motion.css'), 'utf8');
    const js = readFileSync(join(out, 'assets', 'js', 'motion.js'), 'utf8');

    for (const zone of ['signal', 'strata', 'axis']) {
        assert.match(html, new RegExp(`class="zone zone--${zone}" data-zone="${zone}"`), `缺少 ${zone} 分区`);
    }
    assert.equal((html.match(/class="zone__bg"/g) || []).length, 3, '每个分区都要有自己的背景层');
    assert.match(html, /class="brand__mark"/, '顶部栏缺少 CAC 图标');
    assert.equal((html.match(/dots__label/g) || []).length, 3, '部门轴应有三个带标签的刻度');

    for (const selector of ['.zone--signal .zone__grid', '.zone--strata .zone__beamline', '.zone--axis .zone__beam']) {
        assert.ok(cssMain.includes(selector), `主样式缺少 ${selector}`);
    }
    assert.match(cssMotion, /@keyframes zoneSweep/);
    assert.match(cssMotion, /@keyframes zonePulse/);
    assert.match(js, /function initZones/);
    assert.match(js, /initZones\(\)/);
});

test('部门钉住序列：容器、编号数与样式条件一致', async () => {
    const out = await build();
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const css = readFileSync(join(out, 'assets', 'css', 'motion.css'), 'utf8');
    const js = readFileSync(join(out, 'assets', 'js', 'site.js'), 'utf8');

    const seq = html.match(/data-dept-seq style="--slides:(\d+)"/);
    assert.ok(seq, '首页缺少钉住序列容器');

    const slides = (html.match(/data-slide="/g) || []).length;
    assert.equal(Number(seq[1]), slides, '--slides 应当等于实际幻灯片数');

    // CSS 拉高容器的条件，必须和 JS 接管的条件是同一组
    assert.match(css, /\.dept-seq \{ height: calc\(var\(--slides, 5\) \* 78vh\); \}/);
    assert.match(css, /\.dept-seq \.carousel \{ position: sticky; top: 12vh; \}/);
    assert.match(css, /@media \(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/);
    assert.match(js, /matchMedia\('\(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\)'\)/);
});

test('碎片聚散：结构齐、每条规则都是三个点', async () => {
    const out = await build();
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const gate = readFileSync(join(out, 'verify', 'index.html'), 'utf8');
    const css = readFileSync(join(out, 'assets', 'css', 'motion.css'), 'utf8');

    for (const [name, page] of [['首页', html], ['校验页', gate]]) {
        assert.match(page, /data-shards/, `${name}缺少碎片容器`);
        const cells = page.match(/class="shards__s"/g) || [];
        assert.equal(cells.length, 8, `${name}应当有 8 块碎片`);
    }

    // 每条 .shards__s 规则都必须是 3 个顶点：点数不一致就没有线性插值
    const rules = [...css.matchAll(/\.shards__s:nth-child\(\d\)[^{]*\{\s*clip-path:\s*polygon\(([^)]*)\)/g)];
    assert.equal(rules.length, 16, '组装态与散开态各 8 条');
    for (const [, points] of rules) {
        assert.equal(points.split(',').length, 3, `顶点数不是 3：${points}`);
    }
});
