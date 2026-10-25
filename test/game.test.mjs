/* ==========================================================================
   WASM 模拟层与游戏页的测试
   直接实例化 shift.wasm 在 Node 里跑：这一层不碰 DOM、不碰网络，所以能当纯函数测。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { buildToTemp } from './helpers.mjs';
import { S, PHASE, KIND } from '../site/assets/games/shift-at-midnight/js/state.js';

const WASM = new URL('../site/assets/games/shift-at-midnight/shift.wasm', import.meta.url);

function load() {
    const bytes = readFileSync(WASM);
    const mod = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(mod, { env: {} });
    return instance.exports;
}

const snap = (api) => {
    const out = {};
    for (const [name, index] of Object.entries(S)) { out[name] = api.state(index); }
    return out;
};

/* 快进到柜台前：返回当前来客 */
function nextCustomer(api, maxSeconds = 40) {
    for (let t = 0; t < maxSeconds * 20; t += 1) {
        api.frame(0.05);
        if (api.state(S.phase) === PHASE.serve) { return api.state(S.kind); }
    }
    return 0;
}

test('shift.wasm 可实例化，且不依赖任何宿主 import', () => {
    const bytes = readFileSync(WASM);
    const mod = new WebAssembly.Module(bytes);

    assert.deepEqual(WebAssembly.Module.imports(mod), [], 'WASM 不该依赖宿主函数');
    const names = WebAssembly.Module.exports(mod).map((e) => e.name).sort();
    assert.deepEqual(names, ['act', 'begin', 'frame', 'init', 'memory', 'state', 'version']);

    const api = load();
    assert.equal(api.version(), 3);
    assert.ok(statSync(WASM).size > 1024, 'wasm 体积异常，可能是空产物');
});

test('初始状态：未开始，00:00，理智 100，电量 5', () => {
    const api = load();
    api.init(12345);

    const s = snap(api);
    assert.equal(s.phase, PHASE.ready);
    assert.equal(s.clock, 0);
    assert.equal(s.money, 0);
    assert.equal(s.sanity, 100);
    assert.equal(s.battery, 5);
    assert.equal(s.kind, KIND.none);
    assert.equal(s.ending, 0);
});

test('开始后有人进门，走到柜台前才允许动作', () => {
    const api = load();
    api.init(4242);
    api.begin();
    assert.equal(api.state(S.phase), PHASE.wait);
    assert.equal(api.act(1), 0, '空档时按动作不该生效');

    let sawEnter = false;
    let served = false;
    for (let i = 0; i < 120; i += 1) {
        api.frame(0.05);
        const phase = api.state(S.phase);
        if (phase === PHASE.enter) { sawEnter = true; }
        if (phase === PHASE.serve) { served = true; break; }
    }

    assert.ok(sawEnter, '没人进门');
    assert.ok(served, '来客没有走到柜台前');
    assert.ok(api.state(S.kind) >= KIND.normal && api.state(S.kind) <= KIND.shadow);
    assert.ok(api.state(S.patience) > 0);
});

test('递货：普通顾客加钱，查证只会翻底细，手电扣一格电', () => {
    const api = load();
    api.init(999);
    api.begin();

    /* 找一个普通顾客（其余类型直接请他走） */
    let kind = 0;
    for (let round = 0; round < 60; round += 1) {
        kind = nextCustomer(api);
        if (kind === KIND.normal) { break; }
        api.act(4);
    }
    assert.equal(kind, KIND.normal, '这个种子下没遇到普通顾客');

    const checkedBefore = api.state(S.checked);
    assert.equal(checkedBefore, 0);
    assert.equal(api.act(2), 1);
    assert.equal(api.state(S.checked), 1, '查证没有生效');
    assert.equal(api.state(S.phase), PHASE.serve, '查证不该结束这一单');
    assert.ok(api.state(S.feedback) >= 300, '查证没有给反馈');

    const batteryBefore = api.state(S.battery);
    assert.equal(api.act(3), 1);
    assert.equal(api.state(S.battery), batteryBefore - 1, '手电没有耗电');
});

test('递货给普通顾客：营业额上涨、接待 +1、进入结算阶段', () => {
    const api = load();
    api.init(20261025);
    api.begin();

    let found = 0;
    for (let round = 0; round < 80; round += 1) {
        const kind = nextCustomer(api);
        if (kind === KIND.normal) { found = 1; break; }
        api.act(4);
    }
    assert.equal(found, 1, '这个种子下没遇到普通顾客');

    const moneyBefore = api.state(S.money);
    const servedBefore = api.state(S.served);
    assert.equal(api.act(1), 1);
    assert.ok(api.state(S.money) > moneyBefore, '卖了东西却没有进账');
    assert.equal(api.state(S.served), servedBefore + 1);
    assert.equal(api.state(S.phase), PHASE.react);
    assert.equal(api.state(S.feedback), 101);
});

test('03:33 有人敲后门：只剩开门 / 别出声两个选择', () => {
    const api = load();
    api.init(777);
    api.begin();

    let reached = false;
    for (let i = 0; i < 20000; i += 1) {
        api.frame(0.05);
        const phase = api.state(S.phase);
        if (phase === PHASE.knock) { reached = true; break; }
        if (phase === PHASE.serve) { api.act(4); }
        if (phase === PHASE.over) { break; }
    }
    assert.ok(reached, '没有触发 03:33 的敲门');
    assert.ok(api.state(S.clock) >= 213, '敲门来得太早');
    assert.equal(api.state(S.knockDone), 0);

    const sanityBefore = api.state(S.sanity);
    assert.equal(api.act(4), 1, '「别出声」应当是有效动作');
    assert.equal(api.state(S.knockDone), 1);
    assert.equal(api.state(S.phase), PHASE.wait);
    assert.ok(api.state(S.sanity) >= sanityBefore, '别出声应当回一点理智');
});

test('正常做生意能撑到 06:00：结局是天亮，评级落在 S–C 之间', () => {
    const api = load();
    api.init(31337);
    api.begin();

    for (let i = 0; i < 20000; i += 1) {
        api.frame(0.05);
        const phase = api.state(S.phase);
        if (phase === PHASE.serve) {
            const kind = api.state(S.kind);
            api.act(kind === KIND.normal || kind === KIND.regular ? 1 : 4);
        }
        if (phase === PHASE.knock) { api.act(4); }
        if (phase === PHASE.over) { break; }
    }

    const s = snap(api);
    assert.equal(s.phase, PHASE.over);
    assert.equal(s.clock, 360);
    assert.equal(s.ending, 1);
    assert.ok(s.rank >= 1 && s.rank <= 4, '评级越界');
    assert.ok(s.money > 200, '一整班下来营业额偏低');
    assert.ok(s.total >= 8, '一班下来来客太少');
    assert.ok(s.sanity >= 0 && s.sanity <= 100);
});

test('把每一单都推掉：理智见底，结算成换班而不是天亮', () => {
    const api = load();
    api.init(31337);
    api.begin();

    for (let i = 0; i < 20000; i += 1) {
        api.frame(0.05);
        const phase = api.state(S.phase);
        if (phase === PHASE.serve) { api.act(4); }
        if (phase === PHASE.knock) { api.act(4); }
        if (phase === PHASE.over) { break; }
    }

    const s = snap(api);
    assert.equal(s.phase, PHASE.over);
    assert.equal(s.ending, 2, '推光所有客人应当先崩理智');
    assert.equal(s.sanity, 0);
    assert.equal(s.rank, 0, '崩溃时没有评级');
    assert.ok(s.clock < 360, '崩溃应当发生在天亮之前');
});

test('游戏页与板块页都进了产物，且资源路径指得对', async () => {
    const out = await buildToTemp();

    const play = readFileSync(join(out, 'forum', 'night-shift', 'play', 'index.html'), 'utf8');
    const board = readFileSync(join(out, 'forum', 'night-shift', 'index.html'), 'utf8');
    const wasm = join(out, 'assets', 'games', 'shift-at-midnight', 'shift.wasm');
    const gameJs = readFileSync(join(out, 'assets', 'games', 'shift-at-midnight', 'js', 'game.js'), 'utf8');

    assert.match(play, /data-shift-canvas/);
    assert.match(play, /data-shift-act="4"/);
    assert.match(play, /\/assets\/games\/shift-at-midnight\/js\/game\.js/);
    assert.match(play, /\/assets\/games\/shift-at-midnight\/css\/shift\.css/);
    assert.match(play, /name="robots" content="noindex"/, '游戏页不该进检索与 sitemap');
    assert.match(board, /href="\/forum\/night-shift\/play\/"/, '板块页要有进游戏的入口');

    assert.ok(existsSync(wasm), '产物里没有 shift.wasm');
    assert.ok(statSync(wasm).size > 1024);
    assert.ok(existsSync(join(out, 'assets', 'games', 'shift-at-midnight', 'css', 'shift.css')));
    assert.match(gameJs, /'\.\.\/shift\.wasm'/, 'wasm 的相对路径应以 game.js 所在目录为基准');
});