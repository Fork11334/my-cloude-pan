/* ==========================================================================
   CAC 动效运行时（motion.js）
   原生 JS，无依赖。所有效果都可降级：
     · <html> 上没有 .js 类时，CSS 里所有"待入场"的隐藏态都不生效
     · prefers-reduced-motion: reduce 时直接落到最终状态
     · 指针是触摸设备时不启用光标 / 磁吸 / 倾斜 / 聚光
   ========================================================================== */
(function () {
    'use strict';

    window.__cacMotion = true;

    var root = document.documentElement;
    var reduced = false;
    try {
        reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* 老浏览器当 false 处理 */ }

    var finePointer = false;
    try {
        finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (e) { /* 同上 */ }

    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };

    /* 把一串高频事件收进一帧里执行，避免滚动/移动时反复触发布局计算 */
    function rafThrottle(fn) {
        var queued = false;
        var lastArgs = null;
        return function () {
            lastArgs = arguments;
            if (queued) { return; }
            queued = true;
            raf(function () {
                queued = false;
                fn.apply(null, lastArgs);
            });
        };
    }

    /* 元素尺寸缓存：pointermove / 滚动里读 getBoundingClientRect() 会每帧强制布局，
       所以只在「指针进入」和「滚动、缩放」时各读一次，其余帧用缓存值。 */
    function rectTracker(el) {
        var cached = null;
        var refresh = function () { cached = el.getBoundingClientRect(); };
        var clear = function () { cached = null; };
        var bind = function () {
            el.addEventListener('pointerenter', refresh, { passive: true });
            window.addEventListener('scroll', clear, { passive: true });
            window.addEventListener('resize', clear);
        };
        bind();
        return {
            get: function () { return cached || (refresh(), cached); },
            refresh: refresh,
        };
    }

    /* 页面级滚动信息的缓存（文章进度条用，读一次就够） */
    function pageMetrics(el) {
        var m = { top: 0, height: 0 };
        var measure = function () {
            var r = el.getBoundingClientRect();
            m.top = r.top + window.scrollY;
            m.height = r.height;
        };
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('load', measure);
        return { get: function () { return m; }, measure: measure };
    }

    /* ── 1 入场：滚动到视口内才动 ──────────────────────────────────────── */
    function initReveal() {
        // [data-shards] 复用同一个观察器：进视口就加 is-in，碎片随即收拢
        var items = [].slice.call(document.querySelectorAll('[data-reveal], [data-shards]'));
        if (!items.length) { return; }

        // 同一父元素下的顺序决定错峰间隔，最多错开 8 档
        items.forEach(function (el) {
            if (el.hasAttribute('data-i')) { return; }
            var parent = el.parentElement;
            if (!parent) { return; }
            var sibs = [].slice.call(parent.children).filter(function (n) { return n.hasAttribute && n.hasAttribute('data-reveal'); });
            var i = sibs.indexOf(el);
            if (i > 0) { el.style.setProperty('--i', Math.min(i, 8)); }
        });

        if (reduced || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('is-in'); });
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

        items.forEach(function (el) { io.observe(el); });
    }

    /* ── 2 标题逐字入场 ────────────────────────────────────────────────── */
    function splitText(el) {
        var text = el.textContent.trim();
        if (!text) { return; }
        el.setAttribute('aria-label', text);
        el.textContent = '';

        var frag = document.createDocumentFragment();
        var chars = Array.from(text);   // 按码点切，中文不会被拆坏
        chars.forEach(function (ch, i) {
            var span = document.createElement('span');
            span.setAttribute('aria-hidden', 'true');
            if (ch === ' ') {
                span.className = 'split__ch split__ch--space';
            } else {
                span.className = 'split__ch';
                span.textContent = ch;
                span.style.setProperty('--ci', i);
            }
            frag.appendChild(span);
        });
        el.appendChild(frag);
        el.classList.add('split');
    }

    function initSplit() {
        var titles = [].slice.call(document.querySelectorAll('[data-split]'));
        if (!titles.length) { return; }

        if (reduced) { return; }   // 不切字，保持原样最稳

        titles.forEach(splitText);

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.2 });

        titles.forEach(function (el) { io.observe(el); });
    }

    /* ── 3 数字滚动 ────────────────────────────────────────────────────── */
    function initCounters() {
        var nodes = [].slice.call(document.querySelectorAll('[data-count]'));
        if (!nodes.length) { return; }

        function run(el) {
            var target = parseFloat(el.getAttribute('data-count')) || 0;
            var suffix = el.getAttribute('data-count-suffix') || '';
            if (reduced) { el.textContent = target + suffix; return; }

            var started = null;
            var dur = 900;
            function step(ts) {
                if (started === null) { started = ts; }
                var p = Math.min(1, (ts - started) / dur);
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased) + suffix;
                if (p < 1) { raf(step); }
            }
            raf(step);
        }

        if (!('IntersectionObserver' in window)) {
            nodes.forEach(run);
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                run(entry.target);
                io.unobserve(entry.target);
            });
        }, { threshold: 0.4 });
        nodes.forEach(function (el) { io.observe(el); });
    }

    /* ── 4 鼠标聚光（把坐标写进 CSS 变量） ─────────────────────────────── */
    function initSpotlight() {
        var hosts = [].slice.call(document.querySelectorAll('[data-spotlight]'));
        if (!hosts.length || reduced || !finePointer) { return; }

        hosts.forEach(function (host) {
            var rect = rectTracker(host);
            var move = rafThrottle(function (e) {
                var r = rect.get();
                host.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
                host.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
            });
            host.addEventListener('pointermove', move, { passive: true });
            host.addEventListener('pointerleave', function () {
                host.style.removeProperty('--mx');
                host.style.removeProperty('--my');
            }, { passive: true });
        });
    }

    /* ── 5 卡片倾斜 ────────────────────────────────────────────────────── */
    function initTilt() {
        var nodes = [].slice.call(document.querySelectorAll('[data-tilt]'));
        if (!nodes.length || reduced || !finePointer) { return; }

        nodes.forEach(function (el) {
            var max = parseFloat(el.getAttribute('data-tilt')) || 5;
            var rect = rectTracker(el);

            var move = rafThrottle(function (e) {
                var r = rect.get();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform = 'perspective(900px) rotateX(' + (-py * max).toFixed(2) + 'deg) rotateY(' + (px * max).toFixed(2) + 'deg) translateY(-4px)';
            });

            el.addEventListener('pointerenter', function () { el.classList.add('is-tilting'); }, { passive: true });
            el.addEventListener('pointermove', move, { passive: true });
            el.addEventListener('pointerleave', function () {
                el.classList.remove('is-tilting');
                el.style.removeProperty('transform');
            }, { passive: true });
        });
    }

    /* ── 6 磁吸按钮 ────────────────────────────────────────────────────── */
    function initMagnetic() {
        var nodes = [].slice.call(document.querySelectorAll('[data-magnetic]'));
        if (!nodes.length || reduced || !finePointer) { return; }

        nodes.forEach(function (el) {
            var strength = parseFloat(el.getAttribute('data-magnetic')) || 6;
            var rect = rectTracker(el);
            var move = rafThrottle(function (e) {
                var r = rect.get();
                var x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
                var y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
                el.style.setProperty('--mag-x', (x * strength).toFixed(1) + 'px');
                el.style.setProperty('--mag-y', (y * strength).toFixed(1) + 'px');
            });
            el.addEventListener('pointermove', move, { passive: true });
            el.addEventListener('pointerleave', function () {
                el.style.removeProperty('--mag-x');
                el.style.removeProperty('--mag-y');
            }, { passive: true });
        });
    }

    /* ── 7 光标氛围（线性插值跟随） ────────────────────────────────────── */
    function initCursorGlow() {
        if (reduced || !finePointer) { return; }
        var glow = document.createElement('div');
        glow.className = 'cursor-glow';
        glow.setAttribute('aria-hidden', 'true');
        document.body.appendChild(glow);

        var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
        var x = tx, y = ty;
        var active = false;

        document.addEventListener('pointermove', function (e) {
            tx = e.clientX; ty = e.clientY;
            if (!active) { active = true; glow.classList.add('is-on'); }
        }, { passive: true });
        document.addEventListener('pointerleave', function () {
            active = false;
            glow.classList.remove('is-on');
        }, { passive: true });

        (function loop() {
            x += (tx - x) * 0.12;
            y += (ty - y) * 0.12;
            glow.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
            raf(loop);
        })();
    }

    /* ── 8 顶部导航的滑动指示器 ────────────────────────────────────────── */
    function initNavInk() {
        var nav = document.querySelector('.nav');
        if (!nav || reduced || !finePointer) { return; }

        var ink = document.createElement('span');
        ink.className = 'nav__ink';
        ink.setAttribute('aria-hidden', 'true');
        nav.appendChild(ink);

        var links = [].slice.call(nav.querySelectorAll('a'));
        var navBox = function () { return nav.getBoundingClientRect(); };

        function moveTo(el) {
            var r = el.getBoundingClientRect();
            var b = navBox();
            ink.style.width = r.width + 'px';
            ink.style.setProperty('--ink-x', (r.left - b.left) + 'px');
            ink.style.setProperty('--ink-y', (r.top - b.top + (r.height - 30) / 2) + 'px');
            ink.classList.add('is-on');
        }

        links.forEach(function (el) {
            el.addEventListener('pointerenter', function () { moveTo(el); }, { passive: true });
        });
        nav.addEventListener('pointerleave', function () { ink.classList.remove('is-on'); }, { passive: true });

        var current = nav.querySelector('a.is-current');
        if (current) { moveTo(current); }
    }

    /* ── 9 文章阅读光束 ────────────────────────────────────────────────── */
    function initReadRail() {
        var rail = document.querySelector('.read-rail');
        if (!rail) { return; }
        var article = document.querySelector('.article');
        if (!article) { return; }

        // 位置只在加载/缩放时量一次，滚动帧里只读 scrollY，不碰布局
        var metrics = pageMetrics(article);
        var update = rafThrottle(function () {
            var m = metrics.get();
            var total = m.height - window.innerHeight + 200;
            if (total <= 0) { rail.style.setProperty('--read', '1'); return; }
            var passed = Math.min(Math.max(window.scrollY - m.top + 120, 0), total);
            rail.style.setProperty('--read', (passed / total).toFixed(4));
        });

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ── 10 首页氛围：聚光跟随指针 ─────────────────────────────────────── */
    function initAtmos() {
        var spot = document.querySelector('.atmos__spot');
        var home = document.querySelector('.layout-home');
        if (!spot || !home || reduced || !finePointer) { return; }

        var rect = rectTracker(home);
        var move = rafThrottle(function (e) {
            var r = rect.get();
            spot.style.setProperty('--px', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
            spot.style.setProperty('--py', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
        });
        home.addEventListener('pointermove', move, { passive: true });
    }

    /* ── 11 走马灯：复制一份轨道内容，接缝才连续 ──────────────────────── */
    function initMarquee() {
        var tracks = [].slice.call(document.querySelectorAll('.marquee__track'));
        tracks.forEach(function (track) {
            var copy = track.cloneNode(true);
            copy.setAttribute('aria-hidden', 'true');
            [].slice.call(copy.children).forEach(function (n) { track.appendChild(n); });
            // 复制完成后把原轨道整体翻倍，动画位移 -50% 正好接上
            void copy;
        });
    }

    /* ── 12 回到顶部 ───────────────────────────────────────────────────── */
    function initToTop() {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'to-top';
        btn.setAttribute('aria-label', '回到顶部');
        btn.innerHTML = '↑';
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        });
        document.body.appendChild(btn);

        var update = rafThrottle(function () {
            btn.classList.toggle('is-on', window.scrollY > 700);
        });
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    /* ── 13 页面转场（不支持 View Transitions 的浏览器用淡出兜底） ────── */
    function initPageTransition() {
        var supportsVT = typeof document.startViewTransition === 'function'
            || (window.CSS && CSS.supports && CSS.supports('view-transition-name: root'));
        if (supportsVT || reduced) { return; }

        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
            var a = e.target.closest && e.target.closest('a');
            if (!a) { return; }
            var href = a.getAttribute('href') || '';
            if (!href || href.charAt(0) === '#' || a.target === '_blank' || a.hasAttribute('download')) { return; }
            if (a.host !== location.host) { return; }
            e.preventDefault();
            root.classList.add('is-leaving');
            setTimeout(function () { location.href = a.href; }, 170);
        });
    }

    /* ── 14 点击火花 ───────────────────────────────────────────────────── */
    function initClickSpark() {
        if (reduced || !finePointer) { return; }

        document.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || !e.target.closest) { return; }
            if (!e.target.closest('a, button')) { return; }

            for (var i = 0; i < 6; i += 1) {
                var spark = document.createElement('span');
                spark.className = 'spark';
                spark.setAttribute('aria-hidden', 'true');
                spark.style.left = e.clientX + 'px';
                spark.style.top = e.clientY + 'px';
                spark.style.setProperty('--a', (i * 60) + 'deg');
                spark.style.animationDelay = (i * 10) + 'ms';
                document.body.appendChild(spark);
                (function (node) {
                    setTimeout(function () { node.remove(); }, 700);
                })(spark);
            }
        }, { passive: true });
    }

    /* ── 15 首屏星场 ───────────────────────────────────────────────────────
       参考 cosmicbroth 的做法：JPG 照片打底 + 真 canvas 星场（约 500 颗），
       鼠标移动时两层按 1.0 : 0.8 的比例错位，形成视差。                        */
    function initHeroField() {
        var hero = document.querySelector('.hero');
        var canvas = document.querySelector('[data-starfield]');
        if (!hero || !canvas || reduced) { return; }
        var ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) { return; }

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var stars = [];
        var w = 0;
        var h = 0;

        function build() {
            var box = hero.getBoundingClientRect();
            w = Math.round(box.width * dpr);
            h = Math.round(box.height * 0.9 * dpr);
            canvas.width = w;
            canvas.height = h;
            // 半径与速度都按视口比例算，换屏不会突然变密或变快
            var maxR = Math.max(0.6, (box.width + box.height) / 2000 * dpr);
            var maxS = Math.max(0.04, (box.width + box.height) / 8000);
            stars = [];
            for (var i = 0; i < 500; i += 1) {
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.35 + Math.random() * maxR,
                    s: 0.15 + Math.random() * maxS * 8,
                    a: 0.22 + Math.random() * 0.6,
                    tw: Math.random() * Math.PI * 2,
                });
            }
        }

        function draw(t) {
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < stars.length; i += 1) {
                var st = stars[i];
                st.y += st.s * dpr;
                if (st.y > h + 2) { st.y = -2; st.x = Math.random() * w; }
                ctx.globalAlpha = st.a * (0.6 + 0.4 * Math.sin(t / 900 + st.tw));
                ctx.beginPath();
                ctx.arc(st.x, st.y, st.r, 0, 6.2832);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        var rafId = 0;
        var last = 0;
        function loop(t) {
            rafId = requestAnimationFrame(loop);
            if (t - last < 40) { return; }   // 约 25fps：够用，也省电
            last = t;
            draw(t);
        }
        function start() { if (!rafId) { rafId = requestAnimationFrame(loop); } }
        function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

        build();
        start();
        window.addEventListener('resize', rafThrottle(build));
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stop(); } else { start(); }
        });

        /* 分层视差：背景 1.0、星场 0.8（照搬参考站的比例） */
        var bg = hero.querySelector('.hero__bg');
        if (finePointer) {
            var parallax = rafThrottle(function (e) {
                var dx = (e.clientX / window.innerWidth - 0.5) * 2;
                if (bg) { bg.style.transform = 'translateX(' + (-dx * 16).toFixed(2) + 'px) scale(1.07)'; }
                canvas.style.transform = 'translateX(' + (-dx * 13).toFixed(2) + 'px)';
            });
            hero.addEventListener('pointermove', parallax, { passive: true });
        }
    }

    /* ── 16 帘幕入场（一次会话只放一次） ──────────────────────────────────
       遮罩 + 细进度线 + 标识；拉起的同时首屏标题才开始逐字上浮。        */
    function initIntro() {
        var curtain = document.querySelector('[data-curtain]');
        if (!curtain) { return; }
        if (reduced) { curtain.remove(); return; }

        var seen = false;
        try { seen = sessionStorage.getItem('cac-intro') === '1'; } catch (e) { /* 忽略 */ }
        if (seen) { curtain.remove(); document.documentElement.classList.add('is-ready'); return; }

        try { sessionStorage.setItem('cac-intro', '1'); } catch (e) { /* 忽略 */ }
        document.documentElement.classList.add('is-loading');
        requestAnimationFrame(function () { curtain.classList.add('is-running'); });

        setTimeout(function () {
            curtain.classList.add('is-done');
            document.documentElement.classList.remove('is-loading');
            document.documentElement.classList.add('is-ready');
        }, 880);
        setTimeout(function () { if (curtain.parentNode) { curtain.parentNode.removeChild(curtain); } }, 2100);
    }

    /* ── 17 跑马灯：基础速度 + 滚动加速 + 倾斜 ────────────────────────────
       参考 mathis-biabiany / retronova 那类站点的处理：滚动越快，字条越快，
       并跟着滚动方向倾斜，回正时带一点回弹。                              */
    function initTicker() {
        var track = document.querySelector('[data-marquee-track]');
        if (!track || reduced) { return; }

        var half = Math.max(1, track.scrollWidth / 2);
        var pos = 0;
        var velocity = 0;      // 平滑后的滚动速度
        var raw = 0;           // 本帧原始速度
        var lastY = window.scrollY;
        var last = performance.now();

        window.addEventListener('scroll', function () {
            var y = window.scrollY;
            raw += y - lastY;
            lastY = y;
        }, { passive: true });
        window.addEventListener('resize', function () { half = Math.max(1, track.scrollWidth / 2); });

        function frame(now) {
            var dt = Math.min(now - last, 48) / 1000;
            last = now;
            velocity = velocity * 0.86 + raw * 0.14;
            raw *= 0.72;

            var speed = 42 + Math.min(320, Math.abs(velocity) * 3.4);
            pos -= speed * dt;
            if (pos <= -half) { pos += half; }

            var skew = Math.max(-8, Math.min(8, velocity * 0.22));
            track.style.transform = 'translate3d(' + pos.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(3) + 'deg)';
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    /* ── 启动 ──────────────────────────────────────────────────────────── */
    /* ── 分区背景：三块各自一套视觉，指针位置写进 CSS 变量 ───────────────── */
    function initZones() {
        var zones = [].slice.call(document.querySelectorAll('[data-zone]'));
        if (!zones.length) { return; }

        zones.forEach(function (zone) {
            var queued = false;
            var px = 0.5;
            var py = 0.5;

            if (!reduced && finePointer) {
                zone.addEventListener('pointermove', function (e) {
                    var r = zone.getBoundingClientRect();
                    if (!r.width || !r.height) { return; }
                    px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                    py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
                    if (queued) { return; }
                    queued = true;
                    requestAnimationFrame(function () {
                        queued = false;
                        zone.style.setProperty('--zx', (px * 100).toFixed(2) + '%');
                        zone.style.setProperty('--zy', (py * 100).toFixed(2) + '%');
                        zone.style.setProperty('--zp', px.toFixed(3));
                        zone.style.setProperty('--zq', py.toFixed(3));
                    });
                }, { passive: true });
            }

            /* 点击：落点放一圈涟漪，900ms 后自己移除（不占 DOM，不留监听） */
            zone.addEventListener('pointerdown', function (e) {
                if (reduced) { return; }
                var r = zone.getBoundingClientRect();
                if (!r.width) { return; }
                var pulse = document.createElement('span');
                pulse.className = 'zone__pulse';
                pulse.style.left = (e.clientX - r.left) + 'px';
                pulse.style.top = (e.clientY - r.top) + 'px';
                zone.appendChild(pulse);
                setTimeout(function () {
                    if (pulse.parentNode) { pulse.parentNode.removeChild(pulse); }
                }, 900);
            }, { passive: true });
        });
    }

    /* ── 分区背景画布：交给 bgfield.js 的引擎 ─────────────────────────────── */
    function initZoneFields() {
        if (!window.CACBg) { return; }
        [].slice.call(document.querySelectorAll('canvas[data-bg]')).forEach(function (el) {
            window.CACBg.create(el, { mode: el.getAttribute('data-bg') });
        });
    }

    function boot() {
        initIntro();
        initReveal();
        initZones();
        initZoneFields();
        initSplit();
        initCounters();
        initSpotlight();
        initTilt();
        initMagnetic();
        initCursorGlow();
        initNavInk();
        initReadRail();
        initAtmos();
        initMarquee();
        initTicker();
        initToTop();
        initPageTransition();
        initClickSpark();
        initHeroField();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
