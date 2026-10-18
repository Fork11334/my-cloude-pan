/* ==========================================================================
   craft.js —— 手写工艺件（第一层）
   1 loader（真进度 + 线描标识）  2 SVG 波浪场（弹簧 + 指针影响）
   3 行遮罩揭示  4 自定义光标 + 磁性  5 页面过渡  6 颗粒
   约束：零依赖；只动 transform / opacity / filter / clip-path；reduced-motion 全降级。
   ========================================================================== */
(function () {
    'use strict';

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var raf = window.requestAnimationFrame;

    /* 一帧内只跑一次的重排节流 */
    function thr(fn) {
        var q = false;
        var args;
        return function (e) {
            args = e;
            if (q) { return; }
            q = true;
            raf(function () { q = false; fn(args); });
        };
    }

    /* ── 1 loader ──────────────────────────────────────────────────────── */
    function initLoader(done) {
        var box = document.querySelector('[data-loader]');
        if (!box || reduced) { if (box) { box.remove(); } done(); return; }

        var paths = box.querySelectorAll('path');
        [].forEach.call(paths, function (p) {
            var len = p.getTotalLength ? Math.round(p.getTotalLength()) : 1000;
            p.style.setProperty('--len', len);
        });

        var num = box.querySelector('[data-loader-num]');
        var pct = 0;
        var start = performance.now();
        var loaded = false;

        // 真进度：导航资源 + 字体就绪 + 图片，全部就绪才允许到 100
        var assetsReady = (function () {
            var jobs = [];
            if (document.fonts && document.fonts.ready) { jobs.push(document.fonts.ready.catch(function () {})); }
            var imgs = [].slice.call(document.images || []);
            imgs.forEach(function (img) {
                if (img.complete) { return; }
                jobs.push(new Promise(function (res) { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }));
            });
            return Promise.all(jobs);
        })();

        box.classList.add('is-inked');

        function tick(now) {
            var t = now - start;
            // 前 85% 按时间估，剩下 15% 等资源
            var byTime = Math.min(85, (t / 1100) * 85);
            var shown = loaded ? Math.min(100, Math.max(byTime, 92) + ((now - loadedAt) / 320) * 8) : byTime;
            if (shown > pct) { pct = shown; if (num) { num.textContent = String(Math.round(pct)).padStart(3, '0'); } }
            if (pct < 100) { raf(tick); return; }
            // 收尾：拉起 + 通知首屏开始
            box.classList.add('is-done');
            document.documentElement.classList.add('is-ready');
            setTimeout(function () { if (box.parentNode) { box.parentNode.removeChild(box); } done(); }, 950);
        }
        var loadedAt = 0;
        assetsReady.then(function () {
            loaded = true;
            loadedAt = performance.now();
            // 最短停留，避免一闪而过
            var wait = Math.max(0, 1000 - (performance.now() - start));
            setTimeout(function () { raf(tick); }, wait);
        });
        requestAnimationFrame(tick);
    }

    /* ── 2 SVG 波浪场 ──────────────────────────────────────────────────── */
    function initWaves() {
        var host = document.querySelector('[data-waves]');
        if (!host || reduced) { return; }

        var svg = host.querySelector('svg');
        var paths = [].slice.call(host.querySelectorAll('path'));
        if (!svg || !paths.length) { return; }

        var W = 0, H = 0;
        var px = -9999, py = -9999;      // 指针位置
        var pointerIn = 0;               // 指针影响强度，进出时缓动

        function size() {
            var r = host.getBoundingClientRect();
            W = Math.round(r.width);
            H = Math.round(r.height);
            svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
            svg.setAttribute('preserveAspectRatio', 'none');
        }
        size();
        window.addEventListener('resize', thr(size));

        window.addEventListener('pointermove', function (e) {
            px = e.clientX;
            py = e.clientY;
            pointerIn = 1;
        }, { passive: true });
        host.addEventListener('pointerleave', function () { pointerIn = 0; });

        // 每条线的参数：基准高度（占容器高度的比例）、振幅（比例）、频率、速度、相位
        var cfg = [
            { y: 0.70, amp: 0.028, freq: 1.1, speed: 0.55, phase: 0.0, a: 0.55 },
            { y: 0.82, amp: 0.04, freq: 0.8, speed: 0.38, phase: 1.7, a: 0.32 },
            { y: 0.94, amp: 0.055, freq: 0.55, speed: 0.26, phase: 3.4, a: 0.18 },
        ];

        var t0 = performance.now();
        var smoothX = 0, smoothY = 0;

        function frame(now) {
            var t = (now - t0) / 1000;
            // 指针平滑（弹簧式追随，避免抖动）
            var tx = pointerIn ? (px / Math.max(1, W)) * 100 : 50;
            var ty = pointerIn ? (py / Math.max(1, H)) * 100 : 50;
            smoothX += (tx - smoothX) * 0.055;
            smoothY += (ty - smoothY) * 0.055;

            for (var k = 0; k < paths.length; k += 1) {
                var c = cfg[k];
                var d = '';
                var step = Math.max(8, W / 90);
                for (var x = 0; x <= W + step; x += step) {
                    var u = x / W;
                    var baseY = c.y * H;
                    var ampY = c.amp * H;
                    // 基础波
                    var y = baseY + Math.sin(u * Math.PI * 2 * c.freq + t * c.speed + c.phase) * ampY;
                    // 指针处的隆起：距离越近抬得越多，影响半径按屏宽比例
                    var dxn = (u * 100 - smoothX) / 22;
                    var bump = Math.exp(-dxn * dxn) * (0.016 * H + smoothY * 0.0012);
                    y -= bump * 0.7;
                    d += (x === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(2);
                }
                paths[k].setAttribute('d', d);
            }
            raf(frame);
        }
        raf(frame);
    }

    /* ── 3 行遮罩揭示 ──────────────────────────────────────────────────── */
    function initReveal() {
        var nodes = [].slice.call(document.querySelectorAll('[data-reveal]'));
        if (!nodes.length) { return; }

        // 把标题按行切开：中文按标点/长度切，英文按空格
        nodes.forEach(function (el) {
            var text = el.getAttribute('aria-label') || el.textContent;
            var lines = el.getAttribute('data-lines');
            if (lines) {
                el.setAttribute('aria-label', text);
                el.textContent = '';
                lines.split('|').forEach(function (line, i) {
                    var l = document.createElement('span');
                    l.className = 'reveal-line';
                    l.setAttribute('aria-hidden', 'true');
                    var inner = document.createElement('span');
                    inner.style.setProperty('--i', i);
                    inner.textContent = line;
                    l.appendChild(inner);
                    el.appendChild(l);
                });
            }
        });

        if (reduced) { nodes.forEach(function (n) { n.classList.add('is-in'); }); return; }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) { return; }
                en.target.classList.add('is-in');
                io.unobserve(en.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        nodes.forEach(function (n) { io.observe(n); });
    }

    /* ── 4 自定义光标 + 磁性 ───────────────────────────────────────────── */
    function initPointer() {
        if (!fine || reduced) { return; }
        document.documentElement.classList.add('has-cursor');

        var cur = document.createElement('div');
        cur.className = 'cursor';
        cur.innerHTML = '<span class="cursor__ring"></span>';
        document.body.appendChild(cur);

        var cx = window.innerWidth / 2;
        var cy = window.innerHeight / 2;
        var tx = cx;
        var ty = cy;
        window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });

        // 吸附到可交互元素：半径 150、强度 .58（照 wodniack 的实数）
        var hot = null;
        var magRadius = 150;
        var magStrength = 0.58;

        function hit(x, y) {
            return document.elementFromPoint(x, y);
        }
        function interactive(el) {
            return el && el.closest ? el.closest('a, button, .mag, [data-hot]') : null;
        }

        function frame() {
            cx += (tx - cx) * 0.14;
            cy += (ty - cy) * 0.14;

            var el = interactive(hit(tx, ty));
            if (el !== hot) {
                if (hot) { hot.classList.remove('is-hot'); }
                hot = el;
                if (hot) { hot.classList.add('is-hot'); }
                cur.classList.toggle('is-hot', !!hot);
            }

            // 磁性：元素自身朝指针侧轻微位移（帧率无关的阻尼）
            var mx = 0;
            var my = 0;
            if (hot) {
                var r = hot.getBoundingClientRect();
                var dx = tx - (r.left + r.width / 2);
                var dy = ty - (r.top + r.height / 2);
                if (Math.abs(dx) < magRadius && Math.abs(dy) < magRadius) {
                    mx = dx * magStrength * 0.18;
                    my = dy * magStrength * 0.18;
                }
            }
            var current = document.querySelector('.mag.is-magnet');
            if (current !== hot) {
                if (current) { current.classList.remove('is-magnet'); current.style.transform = ''; }
                if (hot && hot.classList.contains('mag')) { hot.classList.add('is-magnet'); }
            }
            if (hot && hot.classList.contains('mag')) {
                hot.style.transform = 'translate(' + mx.toFixed(2) + 'px,' + my.toFixed(2) + 'px)';
            }

            cur.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
            raf(frame);
        }
        raf(frame);
    }

    /* ── 5 页面过渡 ────────────────────────────────────────────────────── */
    function initTransition() {
        if (reduced) { return; }
        var supportsVT = 'startViewTransition' in document;
        if (supportsVT) { return; }             // 交给 CSS 的 @view-transition
        document.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a') : null;
            if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { return; }
            var href = a.getAttribute('href') || '';
            if (!href || href.charAt(0) === '#' || a.target === '_blank' || /^https?:/.test(href)) { return; }
            if (a.host && a.host !== location.host) { return; }
            e.preventDefault();
            document.documentElement.classList.add('is-leaving');
            setTimeout(function () { location.href = a.href; }, 170);
        });
    }

    /* ── 6 颗粒 ────────────────────────────────────────────────────────── */
    function initGrain() {
        var g = document.createElement('div');
        g.className = 'grain';
        g.setAttribute('aria-hidden', 'true');
        document.body.appendChild(g);
    }

    /* ── 7 部门分段：切换时逐个零件错峰落位（In Pieces 的编排法） ────────── */
    function initSegments() {
        var seg = document.querySelector('[data-seg]');
        if (!seg) { return; }
        var btns = [].slice.call(seg.querySelectorAll('.seg__btn'));
        var ink = seg.querySelector('.seg__ink');
        var panels = [].slice.call(document.querySelectorAll('[data-panel]'));
        if (!panels.length) { return; }
        var current = 0;

        function moveInk(animate) {
            var on = btns[current];
            if (!on || !ink) { return; }
            if (!animate) { ink.style.transition = 'none'; }
            requestAnimationFrame(function () {
                ink.style.width = on.offsetWidth + 'px';
                ink.style.transform = 'translateX(' + on.offsetLeft + 'px)';
                if (!animate) { requestAnimationFrame(function () { ink.style.transition = ''; }); }
            });
        }

        function show(next, animate) {
            current = ((next % panels.length) + panels.length) % panels.length;
            btns.forEach(function (b, i) {
                b.classList.toggle('is-on', i === current);
                b.setAttribute('aria-selected', String(i === current));
            });
            panels.forEach(function (p, i) {
                var on = i === current;
                p.classList.toggle('is-on', on);
                p.setAttribute('aria-hidden', String(!on));
                if (!on) { p.classList.remove('is-in'); return; }
                // 先卸再挂 + 强制重排，才能重新播放"逐片错峰"
                p.classList.remove('is-in');
                void p.offsetWidth;
                if (reduced) { p.classList.add('is-in'); return; }
                requestAnimationFrame(function () { p.classList.add('is-in'); });
            });
            moveInk(animate);
        }

        btns.forEach(function (b, i) { b.addEventListener('click', function () { show(i, true); }); });
        show(0, false);
        window.addEventListener('resize', function () { moveInk(false); });
    }

    /* ── boot ──────────────────────────────────────────────────────────── */
    function boot() {
        initGrain();
        initWaves();
        initPointer();
        initTransition();
        initReveal();
        initSegments();
        initLoader(function () { /* 首屏可在此接更多时序 */ });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();
