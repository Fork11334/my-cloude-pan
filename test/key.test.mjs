/* ==========================================================================
   个人密钥的格式契约
   测试直接读 site/assets/js/key.js 原文，在 vm 沙箱里跑一遍 ——
   测的就是浏览器实际加载的那份代码，不是复制出来的第二份实现。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const code = readFileSync(new URL('../site/assets/js/key.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
createContext(sandbox);
runInContext(code, sandbox);

const KEY = sandbox.window.CACKey;

test('key.js 在浏览器式环境里挂出 CACKey', () => {
    assert.ok(KEY, 'window.CACKey 没有挂上');
    assert.equal(typeof KEY.generate, 'function');
    assert.equal(KEY.LENGTH, 5);
});

test('生成的密钥永远是 1 位数字 + 4 位大写字母', () => {
    for (let i = 0; i < 500; i += 1) {
        const key = KEY.generate();
        assert.equal(key.length, 5);
        assert.match(key, /^[2-9][A-HJKMNP-Z]{4}$/, `不符合格式：${key}`);
        assert.ok(KEY.isValid(key), `自检不通过：${key}`);
    }
});

test('生成时避开 0 / 1 / I / L / O 这些容易看错的字符', () => {
    const seen = new Set();
    for (let i = 0; i < 3000; i += 1) {
        for (const ch of KEY.generate()) { seen.add(ch); }
    }
    for (const bad of ['0', '1', 'I', 'L', 'O']) {
        assert.ok(!seen.has(bad), `不应出现 ${bad}`);
    }
});

test('随机源可以注入，输出因此可复现', () => {
    assert.equal(KEY.generate(() => 0), '2AAAA');
    assert.equal(KEY.generate(() => 0.999), '9ZZZZ');
});

test('normalize 大写化、剔非法字符、截到 5 位', () => {
    assert.equal(KEY.normalize('6d fup'), '6DFUP');
    assert.equal(KEY.normalize('6dfup!!'), '6DFUP');
    assert.equal(KEY.normalize('6dfupxyz'), '6DFUP');
    assert.equal(KEY.normalize(null), '');
    assert.equal(KEY.normalize('中文'), '');
});

test('isValid 只认规范形式', () => {
    assert.ok(KEY.isValid('6DFUP'));
    assert.ok(!KEY.isValid('6dfup'), '小写不算');
    assert.ok(!KEY.isValid('6DFU'), '少一位不算');
    assert.ok(!KEY.isValid('1ABCZ'), '1 不能用');
    assert.ok(!KEY.isValid('6DFUI'), 'I 不能用');
    assert.ok(!KEY.isValid('6DFUO'), 'O 不能用');
    assert.ok(!KEY.isValid(''), '空不算');
});
