/* ==========================================================================
   账号与密钥的语义层（纯逻辑，不碰 DOM）
   verify.js 只负责界面与流程，这里负责"一条账号记录长什么样、怎么校验"。

   记录形状：
     { name, email, salt, keyHash, keyId, created, role, version }
     · keyHash = SHA-256(salt + ':' + key)，只存散列，不存明文密钥
     · keyId   = SHA-256(key) 的前 8 位，只用来查重（"这串密钥有没有被用过"）
   旧版账号（只有 password 散列、没有 keyHash）会被 isLegacy 认出来，
   注册同名时可以直接覆盖成密钥方式。

   这是全站唯一的账号语义定义；test/accounts.test.mjs 直接读这份文件跑。
   ========================================================================== */
(function (root) {
    'use strict';

    var api = {
        VERSION: 2,
        ROLE: '成员',

        /* 从账号表里取一条记录；不用 accounts[name] 直接取，避免原型链上的名字 */
        find: function (accounts, name) {
            if (!accounts || !name) { return null; }
            return Object.prototype.hasOwnProperty.call(accounts, name) ? accounts[name] : null;
        },

        /* 旧的密码账号：有记录，但没有密钥散列 */
        isLegacy: function (record) {
            return !!record && !record.keyHash;
        },

        /* 登录用：称呼优先，其次按邮箱（不区分大小写）找同一条记录 */
        findByLogin: function (accounts, value) {
            if (!accounts || !value) { return null; }
            var raw = String(value).trim();
            if (!raw) { return null; }

            var byName = api.find(accounts, raw);
            if (byName) { return { name: raw, record: byName }; }

            var lower = raw.toLowerCase();
            var keys = Object.keys(accounts);
            for (var i = 0; i < keys.length; i += 1) {
                var rec = accounts[keys[i]];
                if (rec && rec.email && String(rec.email).toLowerCase() === lower) {
                    return { name: keys[i], record: rec };
                }
            }
            return null;
        },

        /* 已经被占用的 keyId 列表（生成新密钥时用来查重） */
        takenIds: function (accounts) {
            return Object.keys(accounts || {}).map(function (k) {
                var rec = accounts[k];
                return rec && rec.keyId ? rec.keyId : '';
            }).filter(Boolean);
        },

        /* 生成一串没被占用的密钥。generate/digest 都由调用方注入，测试可以固定它们 */
        issueKey: function (options) {
            var salt = options.salt;
            var takenIds = options.takenIds || [];
            var generate = options.generate;
            var digest = options.digest;
            var tries = 0;

            function attempt() {
                var key = generate();
                return digest(key).then(function (raw) {
                    var id = String(raw).slice(0, 8);
                    if (takenIds.indexOf(id) !== -1 && tries < 24) {
                        tries += 1;
                        return attempt();
                    }
                    return digest(salt + ':' + key).then(function (hash) {
                        return { key: key, hash: hash, id: id };
                    });
                });
            }

            return attempt();
        },

        makeRecord: function (input) {
            return {
                name: input.name,
                email: input.email,
                salt: input.salt,
                keyHash: input.issued.hash,
                keyId: input.issued.id,
                created: input.created,
                role: api.ROLE,
                version: api.VERSION,
            };
        },

        /* 登录校验：把用户输入的密钥按同一条盐重算散列，与记录比对 */
        checkKey: function (record, key, digest) {
            if (!record || !record.keyHash) { return Promise.resolve(false); }
            return digest(record.salt + ':' + key).then(function (hash) {
                return hash === record.keyHash;
            });
        },
    };

    if (root) { root.CACAccounts = api; }
    if (typeof module === 'object' && module && module.exports) { module.exports = api; }
}(typeof window !== 'undefined' ? window : null));
