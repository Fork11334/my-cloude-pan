/* ==========================================================================
   访问校验：登录页（/verify/）与注册页（/verify/register/）共用一份逻辑
   登录：称呼或邮箱 + 个人密钥
   注册：称呼 + 邮箱 → 现场生成密钥（1 数字 + 4 大写字母），只显示一次
   ⚠️ 账号只存在这台设备的 localStorage 里，不联网、不做真实身份验证。
   ========================================================================== */
(function () {
    'use strict';

    var ACC_KEY = 'cac-accounts';
    var SES_KEY = 'cac-session';
    var PASS_KEY = (window.CAC && window.CAC.passStore) || 'cac-pass';
    var KEY = window.CACKey || null;
    var ACC = window.CACAccounts || null;

    var verify = document.querySelector('[data-verify]');
    if (!verify) { return; }

    var mode = verify.getAttribute('data-verify-mode') === 'register' ? 'register' : 'login';

    var msg = verify.querySelector('[data-verify-msg]');
    var form = verify.querySelector('[data-account-form]');
    var submit = form ? form.querySelector('[data-account-submit]') : null;
    var userInput = form ? form.querySelector('[data-field="user"]') : null;
    var emailInput = form ? form.querySelector('[data-field="email"]') : null;
    var loginInput = form ? form.querySelector('[data-field="login"]') : null;
    var keyInput = form ? form.querySelector('[data-field="key"]') : null;
    var keycard = verify.querySelector('[data-keycard]');
    var keyValue = verify.querySelector('[data-key-value]');
    var keyEnter = verify.querySelector('[data-key-enter]');
    var keyCopy = verify.querySelector('[data-key-copy]');
    var load = verify.querySelector('[data-gate-load]');
    var loadLine = verify.querySelector('[data-gate-line]');
    var loadPct = verify.querySelector('[data-gate-pct]');

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pending = null;

    /* ── 工具 ──────────────────────────────────────────────────────────── */
    function read(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
    }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }
    function setPass() {
        try { sessionStorage.setItem(PASS_KEY, '1'); } catch (e) { /* 隐私模式忽略 */ }
    }
    function nextUrl() {
        var base = (window.CAC && window.CAC.base) || '';
        var next = '';
        try { next = new URLSearchParams(location.search).get('next') || ''; } catch (e) { next = ''; }
        if (!next || next.charAt(0) !== '/' || next.indexOf('//') === 0) { next = '/'; }
        if (base && next.indexOf(base + '/') === 0) { next = next.slice(base.length); }
        return base + next;
    }
    function say(text, kind) {
        if (!msg) { return; }
        msg.textContent = text || '';
        msg.className = 'verify__msg' + (text ? ' is-on' : '') + (kind ? ' verify__msg--' + kind : '');
    }
    function digest(text) {
        if (window.crypto && crypto.subtle && window.TextEncoder) {
            return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
                return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                    return ('0' + b.toString(16)).slice(-2);
                }).join('');
            }).catch(function () { return weakHash(text); });
        }
        return Promise.resolve(weakHash(text));
    }
    function weakHash(text) {
        var h = 5381;
        for (var i = 0; i < text.length; i += 1) { h = (((h << 5) + h) + text.charCodeAt(i)) >>> 0; }
        return 'w' + h.toString(16);
    }
    function makeSalt() {
        var bytes = new Uint8Array(8);
        if (window.crypto && crypto.getRandomValues) { crypto.getRandomValues(bytes); }
        else { for (var i = 0; i < bytes.length; i += 1) { bytes[i] = Math.floor(Math.random() * 256); } }
        return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    function markInvalid(input, bad) {
        if (input) { input.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
    }
    function clearInvalid() {
        [userInput, emailInput, loginInput, keyInput].forEach(function (el) { markInvalid(el, false); });
    }
    function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    /* ── 出场：加载动画 → 跳转 ─────────────────────────────────────────── */
    function leave(text) {
        setPass();
        verify.classList.add('is-passed', 'is-leaving');
        var duration = reduced ? 420 : 1500;
        var started = Date.now();

        if (load) {
            load.classList.add('is-on');
            load.removeAttribute('aria-hidden');
            if (loadLine) { loadLine.textContent = text || '正在建立信道…'; }
        }

        var ticker = setInterval(function () {
            var p = Math.min(99, Math.round(((Date.now() - started) / duration) * 100));
            if (loadPct) { loadPct.textContent = p + '%'; }
            if (loadLine) {
                loadLine.textContent = p > 68 ? '载入主界面…' : (p > 32 ? '校验通过' : (text || '正在建立信道…'));
            }
            if (p >= 99) { clearInterval(ticker); }
        }, 60);

        setTimeout(function () {
            clearInterval(ticker);
            if (loadPct) { loadPct.textContent = '100%'; }
            location.replace(nextUrl());
        }, duration);
    }

    /* ── 注册成功：先给密钥，再放行 ───────────────────────────────────── */
    function showKeycard(name, key) {
        pending = { name: name, key: key };
        if (keyValue) { keyValue.textContent = key; }
        if (keycard) { keycard.hidden = false; }
        if (form) { form.hidden = true; }
        say('密钥已生成。先抄下来，再进入主界面。', 'good');
        if (keyEnter) { keyEnter.focus(); }
    }

    function enter() {
        if (!pending) { return; }
        if (!write(SES_KEY, { user: pending.name, keyId: null, at: Date.now() })) {
            say('浏览器不允许写入本地存储（可能是隐私模式），登录状态没法保存。', 'bad');
            return;
        }
        leave('正在建立信道…');
    }

    if (!KEY || !ACC) {
        say('页面脚本没有完整加载，刷新一次再试。', 'bad');
        return;
    }

    /* ── 密钥输入：自动大写、剔非法字符 ────────────────────────────────── */
    if (keyInput) {
        keyInput.addEventListener('input', function () {
            var clean = KEY.normalize(keyInput.value);
            if (keyInput.value !== clean) { keyInput.value = clean; }
            keyInput.classList.toggle('is-key-ok', KEY.isValid(clean));
            markInvalid(keyInput, false);
        });
    }

    /* ── 提交 ──────────────────────────────────────────────────────────── */
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            if (pending) { enter(); return; }

            clearInvalid();
            var accounts = read(ACC_KEY, {});

            if (mode === 'register') {
                var name = userInput ? (userInput.value || '').trim() : '';
                var email = emailInput ? (emailInput.value || '').trim() : '';

                if (name.length < 2) {
                    markInvalid(userInput, true);
                    say('称呼至少 2 个字符。', 'bad');
                    if (userInput) { userInput.focus(); }
                    return;
                }
                if (!isEmail(email)) {
                    markInvalid(emailInput, true);
                    say('填一个能用的邮箱，例如 name@example.com。', 'bad');
                    if (emailInput) { emailInput.focus(); }
                    return;
                }

                var rec = ACC.find(accounts, name);
                if (rec && rec.keyHash) {
                    markInvalid(userInput, true);
                    say('这个称呼已经被注册了。换一个，或者用邮箱去登录。', 'bad');
                    return;
                }

                submit.disabled = true;
                submit.classList.add('is-busy');
                say('正在生成密钥…', 'busy');

                var salt = makeSalt();
                ACC.issueKey({
                    salt: salt,
                    takenIds: ACC.takenIds(accounts),
                    generate: KEY.generate,
                    digest: digest,
                }).then(function (issued) {
                    accounts[name] = ACC.makeRecord({
                        name: name,
                        email: email,
                        salt: salt,
                        issued: issued,
                        created: new Date().toISOString().slice(0, 10),
                    });
                    submit.disabled = false;
                    submit.classList.remove('is-busy');

                    if (!write(ACC_KEY, accounts)) {
                        say('浏览器不允许写入本地存储（可能是隐私模式），账号没法保存。', 'bad');
                        return;
                    }
                    var legacy = ACC.isLegacy(rec);
                    showKeycard(name, issued.key);
                    if (legacy) { say('检测到旧版密码账号，已就地改成密钥登录。先抄下新密钥。', 'good'); }
                });
                return;
            }

            /* 登录：称呼或邮箱 + 密钥 */
            var who = loginInput ? (loginInput.value || '').trim() : '';
            var key = keyInput ? (keyInput.value || '').trim() : '';

            if (!who) {
                markInvalid(loginInput, true);
                say('填称呼或邮箱。', 'bad');
                if (loginInput) { loginInput.focus(); }
                return;
            }
            if (!KEY.isValid(key)) {
                markInvalid(keyInput, true);
                say('密钥格式是 1 位数字 + 4 位大写字母，例如 6DFUP。', 'bad');
                if (keyInput) { keyInput.focus(); }
                return;
            }

            var found = ACC.findByLogin(accounts, who);
            if (!found) {
                markInvalid(loginInput, true);
                say('没有找到这个称呼或邮箱。先去注册领一串密钥。', 'bad');
                return;
            }

            submit.disabled = true;
            submit.classList.add('is-busy');
            say('正在校验…', 'busy');

            ACC.checkKey(found.record, key, digest).then(function (ok) {
                submit.disabled = false;
                submit.classList.remove('is-busy');

                if (!ok) {
                    markInvalid(keyInput, true);
                    say('称呼和密钥对不上。密钥是我们生成的那串五位码，不是邮箱。', 'bad');
                    return;
                }
                if (!write(SES_KEY, { user: found.name, keyId: found.record.keyId || null, at: Date.now() })) {
                    say('浏览器不允许写入本地存储（可能是隐私模式），登录状态没法保存。', 'bad');
                    return;
                }
                leave('正在建立信道…');
            });
        });
    }

    if (keyEnter) { keyEnter.addEventListener('click', enter); }

    if (keyCopy) {
        keyCopy.addEventListener('click', function () {
            var text = pending ? pending.key : '';
            function done() { say('已复制到剪贴板。', 'good'); }
            function fallback() {
                say('复制失败，请手动抄下：' + text, 'bad');
                if (keyValue) {
                    try {
                        var range = document.createRange();
                        range.selectNodeContents(keyValue);
                        var sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } catch (e) { /* 忽略 */ }
                }
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done).catch(fallback);
            } else {
                fallback();
            }
        });
    }

    /* ── 入场：卡片就位、碎片收拢 ─────────────────────────────────────── */
    requestAnimationFrame(function () {
        verify.classList.add('is-ready');
        Array.prototype.forEach.call(verify.querySelectorAll('[data-shards]'), function (el) {
            el.classList.add('is-in');
        });
    });

    say(mode === 'register'
        ? '填一个称呼和一个邮箱，系统会生成只属于你的密钥。'
        : '用「称呼或邮箱 + 个人密钥」进入。');
}());
