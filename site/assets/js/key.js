/* ==========================================================================
   个人密钥：1 位数字 + 4 位大写字母，例如 6DFUP。
   字母表与数字都剔掉了容易看错的 0 / O / 1 / I / L —— 这串东西是要人手抄、
   口述或贴在便签上的，能少一个歧义就少一个。

   这是全站唯一的"密钥格式"定义，校验与生成都从这里走；
   test/key.test.mjs 直接把这份文件读进来跑，保证测试测的就是线上那份代码。
   ========================================================================== */
(function (root) {
    'use strict';

    var DIGITS = '23456789';                        // 去掉 0 与 1
    var LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';        // 去掉 I / L / O

    function pick(set, rand) {
        return set.charAt(Math.floor(rand() * set.length));
    }

    var api = {
        DIGITS: DIGITS,
        LETTERS: LETTERS,
        LENGTH: 5,

        /* 生成一个新密钥。传入随机源是为了测试能注入固定序列 */
        generate: function (rand) {
            rand = rand || Math.random;
            var out = pick(DIGITS, rand);
            for (var i = 0; i < 4; i += 1) { out += pick(LETTERS, rand); }
            return out;
        },

        /* 输入框里用：大写化、剔掉非法字符、截到 5 位 */
        normalize: function (value) {
            return String(value == null ? '' : value)
                .toUpperCase()
                .replace(/[^0-9A-Z]/g, '')
                .slice(0, 5);
        },

        /* 是否是一个合法密钥（照生成规则反向校验） */
        isValid: function (value) {
            return /^[2-9][A-HJKMNP-Z]{4}$/.test(String(value == null ? '' : value));
        },
    };

    if (root) { root.CACKey = api; }
    if (typeof module === 'object' && module && module.exports) { module.exports = api; }
}(typeof window !== 'undefined' ? window : null));
