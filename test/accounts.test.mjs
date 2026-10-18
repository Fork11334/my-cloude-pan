/* ==========================================================================
   账号与密钥的语义（注册 → 领取密钥 → 用密钥登录）
   用真的 crypto.subtle 跑，不是假散列；模块本身也在 vm 里跑原文件。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const code = readFileSync(new URL('../site/assets/js/accounts.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
createContext(sandbox);
runInContext(code, sandbox);
const ACC = sandbox.window.CACAccounts;

const digest = (text) => webcrypto.subtle
    .digest('SHA-256', new TextEncoder().encode(text))
    .then((buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''));

async function register({ name = '甲', email = 'a@b.co', salt = 'deadbeefdeadbeef', key = '6DFUP', accounts = {}, takenIds = [] } = {}) {
    const issued = await ACC.issueKey({ salt, takenIds, generate: () => key, digest });
    const record = ACC.makeRecord({ name, email, salt, issued, created: '2026-10-17' });
    return { record, issued };
}

test('注册 → 领取密钥 → 用同一串密钥登录成功', async () => {
    const { record } = await register();
    assert.equal(record.name, '甲');
    assert.equal(record.email, 'a@b.co');
    assert.equal(record.version, 2);
    assert.equal(record.role, '成员');
    assert.equal(record.keyHash.length, 64, 'SHA-256 十六进制应当是 64 位');
    assert.ok(await ACC.checkKey(record, '6DFUP', digest));
});

test('错误的密钥不能通过', async () => {
    const { record } = await register();
    assert.ok(!(await ACC.checkKey(record, '6DFUQ', digest)));
    assert.ok(!(await ACC.checkKey(record, '6dfup', digest)), '大小写不同也不算');
    assert.ok(!(await ACC.checkKey(record, '', digest)));
});

test('记录里不存明文密钥', async () => {
    const { record } = await register();
    assert.ok(!JSON.stringify(record).includes('6DFUP'), '明文密钥泄露到记录里了');
});

test('同一条密钥配不同的盐，散列不同（不能拿另一条记录的散列来登）', async () => {
    const a = await register({ salt: 'aaaa' });
    const b = await register({ salt: 'bbbb', name: '乙' });

    assert.notEqual(a.record.keyHash, b.record.keyHash);
    assert.ok(await ACC.checkKey(a.record, '6DFUP', digest));
    assert.ok(await ACC.checkKey(b.record, '6DFUP', digest));
});

test('生成密钥时会避开已被占用的 keyId', async () => {
    const first = await register({ salt: 's1', key: '6DFUP' });
    let calls = 0;
    const second = await ACC.issueKey({
        salt: 's2',
        takenIds: [first.issued.id],
        generate: () => (calls++ === 0 ? '6DFUP' : '7ABCZ'),
        digest,
    });

    assert.equal(second.key, '7ABCZ');
    assert.notEqual(second.id, first.issued.id);
});

test('takenIds 从账号表里收集，忽略没有 keyId 的旧记录', () => {
    const ids = ACC.takenIds({
        甲: { keyId: 'aaaa1111' },
        乙: {},
        丙: { keyId: 'bbbb2222' },
    });
    // vm 里造出来的数组原型不同，用 join 比，别用 deepEqual
    assert.equal(ids.join(','), 'aaaa1111,bbbb2222');
});

test('find 只认自有属性，不会取到原型链上的名字', () => {
    assert.equal(ACC.find({}, 'constructor'), null);
    assert.equal(ACC.find(null, '甲'), null);
    assert.equal(ACC.find({ 甲: { name: '甲' } }, '甲').name, '甲');
});

test('登录时可以填称呼，也可以填邮箱（不区分大小写）', () => {
    const accounts = {
        甲: { email: 'Jia@Example.com', keyHash: 'h1' },
        乙: { email: 'yi@example.com', keyHash: 'h2' },
    };

    assert.equal(ACC.findByLogin(accounts, '甲').name, '甲');
    assert.equal(ACC.findByLogin(accounts, 'jia@example.COM').name, '甲');
    assert.equal(ACC.findByLogin(accounts, 'YI@example.com').name, '乙');
    assert.equal(ACC.findByLogin(accounts, ' 甲 ').name, '甲', '两端空格要去掉');
    assert.equal(ACC.findByLogin(accounts, '不存在'), null);
    assert.equal(ACC.findByLogin(accounts, ''), null);
});

test('旧版密码账号会被认出来，且不能用密钥登录', async () => {
    assert.ok(ACC.isLegacy({ hash: 'abc', salt: 'x' }));
    assert.ok(!ACC.isLegacy({ keyHash: 'abc' }), '有 keyHash 就是新账号');
    assert.ok(!ACC.isLegacy(null));

    assert.equal(await ACC.checkKey({ hash: 'abc' }, '6DFUP', digest), false);
});
