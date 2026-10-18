/* craft-chrome.js —— 只接管浏览器外壳：颗粒、自定义光标、页面过渡。
   不依赖任何页面标记，所以可以安全地挂到现有页面上（loader / 波浪 / 分段在 craft.js 里，
   那些需要专门的 DOM，正式页面换装后再启用）。 */
(function () {
    'use strict';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var raf = window.requestAnimationFrame;

    /* 颗粒 */
    function grain() {
        if (document.querySelector('.grain')) { return; }
        var g = document.createElement('div');
        g.className = 'grain';
        g.setAttribute('aria-hidden', 'true');
        document.body.appendChild(g);
    }

    /* 光标：滞后跟随 + 悬停放大（只动 transform） */
    function cursor() {
        if (!fine || reduced) { return; }
        document.documentElement.classList.add('has-cursor');

        var c = document.createElement('div');
        c.className = 'cursor';
        c.innerHTML = '<span class="cursor__ring"></span>';
        document.body.appendChild(c);

        var x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y, hot = null;
        window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });

        (function loop() {
            x += (tx - x) * 0.16;
            y += (ty - y) * 0.16;
            var el = document.elementFromPoint(tx, ty);
            var next = el && el.closest ? el.closest('a, button, [role="button"], summary') : null;
            if (next !== hot) {
                hot = next;
                c.classList.toggle('is-hot', !!hot);
            }
            c.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
            raf(loop);
        })();
    }

    /* 页面过渡：支持 View Transitions 就交给 CSS，否则淡出再跳 */
    function transitions() {
        if (reduced || 'startViewTransition' in document) { return; }
        document.addEventListener('click', function (e) {
            var a = e.target.closest ? e.target.closest('a') : null;
            if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { return; }
            var href = a.getAttribute('href') || '';
            if (!href || href.charAt(0) === '#' || a.target === '_blank') { return; }
            if (a.host && a.host !== location.host) { return; }
            e.preventDefault();
            document.documentElement.classList.add('is-leaving');
            setTimeout(function () { location.href = a.href; }, 170);
        });
    }

    function boot() {
        grain();
        cursor();
        transitions();
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* ==========================================================================
   首屏 SVG 波线场（独立 IIFE）：接管 .hero，隐藏原 canvas 星场，注入三条波线。
   写法照 Antoine 的路子：每帧重拼 <path> 的 d，正弦叠加 + 指针处高斯隆起。
   ========================================================================== */
(function () {
    'use strict';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function boot() {
        var hero = document.querySelector('.hero');
        if (!hero) { return; }

        // 星场让位（保留元素，只是不显示，便于随时切回）
        var field = hero.querySelector('.hero__field');
        if (field) { field.style.display = 'none'; }
        hero.classList.add('is-waved');

        if (reduced) { return; }

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;inset:0;z-index:0;width:100%;height:100%;pointer-events:none';
        var cfg = [
            { y: .70, amp: .028, freq: 1.10, speed: 0.55, phase: 0.0, w: 1, color: 'rgba(255,255,255,.5)' },
            { y: .82, amp: .040, freq: 0.80, speed: 0.38, phase: 1.7, w: 1, color: 'rgba(255,255,255,.28)' },
            { y: .94, amp: .055, freq: 0.55, speed: 0.26, phase: 3.4, w: 1, color: 'rgba(200,69,47,.42)' }
        ];
        var paths = cfg.map(function (c) {
            var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('fill', 'none');
            p.setAttribute('stroke', c.color);
            p.setAttribute('stroke-width', '1');
            svg.appendChild(p);
            return p;
        });
        hero.appendChild(svg);

        var W = 0, H = 0;
        function size() {
            var r = hero.getBoundingClientRect();
            W = Math.max(1, Math.round(r.width));
            H = Math.max(1, Math.round(r.height));
            svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
            svg.setAttribute('preserveAspectRatio', 'none');
        }
        size();
        window.addEventListener('resize', size);

        var px = -1, py = -1, on = 0, sx = 50, sy = 50;
        if (fine) {
            window.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; on = 1; }, { passive: true });
        }
        var t0 = performance.now();
        (function frame(now) {
            var t = (now - t0) / 1000;
            var tx = on ? Math.max(0, Math.min(100, (px / W) * 100)) : 50;
            var ty = on ? Math.max(0, Math.min(100, (py / H) * 100)) : 50;
            sx += (tx - sx) * 0.055;
            sy += (ty - sy) * 0.055;
            for (var k = 0; k < paths.length; k += 1) {
                var c = cfg[k], d = '', step = Math.max(10, W / 90);
                for (var x = 0; x <= W + step; x += step) {
                    var u = x / W;
                    var y = c.y * H + Math.sin(u * Math.PI * 2 * c.freq + t * c.speed + c.phase) * c.amp * H;
                    var g = Math.exp(-Math.pow((u * 100 - sx) / 22, 2));
                    y -= g * (0.016 * H + sy * 0.0012) * 0.7;
                    d += (x === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(2);
                }
                paths[k].setAttribute('d', d);
            }
            requestAnimationFrame(frame);
        })(t0);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* 页面套框：注入一个固定层（wodniack 的 .site-mount 观感） */
(function () {
    'use strict';
    function boot() {
        if (document.querySelector('.craft-frame')) { return; }
        var f = document.createElement('div');
        f.className = 'craft-frame';
        f.setAttribute('aria-hidden', 'true');
        document.body.appendChild(f);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* 编辑入口：跳到 GitHub 的在线编辑器改这一页的 Markdown（提交后 Actions 自动重建）
   —— 纯静态站能实现「协作编辑」的唯一现实路径，不需要后端。 */
(function () {
    'use strict';
    var REPO = 'Fork11334/caccontect';
    var BRANCH = 'main';

    function boot() {
        var p = location.pathname;
        var base = (window.CAC && window.CAC.base) || '';
        if (base && p.indexOf(base) === 0) { p = p.slice(base.length); }
        p = p.replace(/\/+$/, '');
        if (!p) { p = ''; }
        var file = 'site/content' + p + '/index.md';
        if (p.indexOf('/archive/') === 0) { file = 'site/content' + p + '.md'; }

        var a = document.createElement('a');
        a.className = 'edit-link';
        a.href = 'https://github.com/' + REPO + '/edit/' + BRANCH + '/' + file;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '编辑此页 ↗';
        a.setAttribute('aria-label', '在 GitHub 上编辑这一页的源文件');
        document.body.appendChild(a);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* 套框描边注入：SVG rect + pathLength=1000，配合上面的 keyframes 自己画出来 */
(function () {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';
    function boot() {
        var frame = document.querySelector('.craft-frame');
        if (!frame || frame.querySelector('.craft-frame__ink')) { return; }
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'craft-frame__ink');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        var rect = document.createElementNS(NS, 'rect');
        var inset = 0.5;
        rect.setAttribute('x', inset);
        rect.setAttribute('y', inset);
        rect.setAttribute('width', 'calc(100% - 1px)');
        rect.setAttribute('height', 'calc(100% - 1px)');
        rect.setAttribute('pathLength', '1000');
        svg.appendChild(rect);
        frame.appendChild(svg);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* 档案行逐条揭示：写入 --ri（供三角波 delay 用），进视口后加类 */
(function () {
    'use strict';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    function boot() {
        var rows = [].slice.call(document.querySelectorAll('.layout-archive .arc-card'));
        if (!rows.length || !('IntersectionObserver' in window)) { return; }
        rows.forEach(function (el, i) { el.style.setProperty('--ri', i); });
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) { return; }
                en.target.classList.add('is-revealed');
                io.unobserve(en.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
        rows.forEach(function (el) { io.observe(el); });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* ==========================================================================
   首屏点阵波线（按 wodniack 实测参数重写）
   xGap 10 / yGap 32，水平位移 cos×32、垂直 sin×16，相位用三条互质正弦叠加近似
   perlin（原站是 perlin2），每帧重写 M/L 折线、坐标取 1 位小数。
   替换掉上一版的 3 条长正弦：先移除旧 svg，再挂新的。
   ========================================================================== */
(function () {
    'use strict';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var NS = 'http://www.w3.org/2000/svg';

    function boot() {
        var hero = document.querySelector('.hero');
        if (!hero || reduced) { return; }

        // 移除上一版的三条长正弦（它自己那套 rAF 会继续跑在已卸载的节点上，无副作用）
        var old = hero.querySelector('svg');
        if (old) { old.parentNode.removeChild(old); }

        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;inset:0;z-index:0;width:100%;height:100%;pointer-events:none';
        hero.appendChild(svg);

        var XGAP = 14, YGAP = 40;
        var cols = 0, rows = 0, lines = [], W = 0, H = 0;

        function build() {
            var r = hero.getBoundingClientRect();
            W = Math.max(1, Math.round(r.width));
            H = Math.max(1, Math.round(r.height));
            svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
            svg.setAttribute('preserveAspectRatio', 'none');
            cols = Math.ceil(W / XGAP) + 2;
            rows = Math.max(2, Math.floor((H * 0.30) / YGAP));   // 只铺下半部分
            while (svg.firstChild) { svg.removeChild(svg.firstChild); }
            lines = [];
            for (var y = 0; y < rows; y += 1) {
                var p = document.createElementNS(NS, 'path');
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', y === rows - 1 ? 'rgba(200,69,47,.34)' : 'rgba(255,255,255,' + (0.20 - y * 0.014).toFixed(3) + ')');
                p.setAttribute('stroke-width', '1');
                svg.appendChild(p);
                lines.push(p);
            }
        }
        build();
        window.addEventListener('resize', build);

        var mx = -1e9, my = -1e9;
        if (fine) {
            window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
        }
        var t0 = performance.now();

        (function frame(now) {
            var t = (now - t0) / 1000;
            var baseY = H * 0.62;
            for (var row = 0; row < lines.length; row += 1) {
                var d = '';
                for (var i = 0; i <= cols; i += 1) {
                    var gx = i * XGAP;
                    var gy = baseY + row * YGAP;
                    // 三条互质正弦叠加，近似原站 perlin 相位
                    var ph = Math.sin(gx * 0.0021 + t * 1.25)
                           + Math.sin(gx * 0.0057 - t * 0.83 + row * 0.6)
                           + Math.sin(gx * 0.0131 + t * 0.47 + 1.7);
                    var dx = Math.cos(ph) * 18;
                    var dy = Math.sin(ph * 1.3) * 9;
                    // 指针处每点弹簧：半径 max(175, vs) / 力 .00065 / 张力 .005 / 摩擦 .925
                    if (mx > -1e8) {
                        var vx = gx - mx, vy = gy - my;
                        var dist2 = vx * vx + vy * vy;
                        var R = Math.max(175, W);
                        if (dist2 < R * R) {
                            var f = (1 - Math.sqrt(dist2) / R);
                            var force = f * f * R * 0.00065 * 170;
                            dx += (vx / (Math.sqrt(dist2) + 1)) * force * 0.62;
                            dy += (vy / (Math.sqrt(dist2) + 1)) * force * 0.62;
                        }
                    }
                    d += (i === 0 ? 'M' : 'L') + ((gx + dx).toFixed(1)) + ' ' + ((gy + dy).toFixed(1));
                }
                lines[row].setAttribute('d', d);
            }
            requestAnimationFrame(frame);
        })(t0);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* 行遮罩揭示：给正文段落/列表项加 .mask-in，进视口后按顺序揭开。
   失败安全：类由 JS 加，脚本没跑就不会隐藏任何内容。 */
(function () {
    'use strict';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    function boot() {
        if (!('IntersectionObserver' in window)) { return; }
        var host = document.querySelector('main');
        if (!host) { return; }
        var nodes = [].slice.call(host.querySelectorAll('p, li')).filter(function (el) {
            if (el.closest('.arc-card')) { return false; }
            if (el.closest('[data-split]')) { return false; }
            return (el.textContent || '').trim().length > 24;
        }).slice(0, 24);
        nodes.forEach(function (el, i) {
            el.classList.add('mask-in');
            el.style.setProperty('--mi', i);
        });
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) { return; }
                en.target.classList.add('is-open');
                io.unobserve(en.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        nodes.forEach(function (el) { io.observe(el); });
        // 兜底：2.6s 后仍未揭开的，强制揭开
        setTimeout(function () {
            nodes.forEach(function (el) { el.classList.add('is-open'); });
        }, 2600);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* 部门轮播方向感知：只观察 .is-on 的变化，不改 site.js 的逻辑 */
(function () {
    'use strict';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    function boot() {
        var car = document.querySelector('[data-carousel]');
        if (!car || !('MutationObserver' in window)) { return; }
        var slides = [].slice.call(car.querySelectorAll('[data-slide]'));
        if (slides.length < 2) { return; }
        var prev = -1;
        slides.forEach(function (s, i) { if (s.classList.contains('is-on')) { prev = i; } });

        var mo = new MutationObserver(function () {
            var now = -1;
            slides.forEach(function (s, i) { if (s.classList.contains('is-on')) { now = i; } });
            if (now < 0 || now === prev) { return; }
            var dir = now > prev ? 1 : -1;
            prev = now;
            car.setAttribute('data-dir', String(dir));
            var active = slides[now];
            var pieces = active.querySelectorAll('.slide__num, .slide__label, .slide__motto, .slide__desc');
            [].forEach.call(pieces, function (el, i) { el.style.setProperty('--i', i); });
            active.classList.remove('is-dir');
            void active.offsetWidth;
            active.classList.add('is-dir');
        });
        slides.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['class'] }); });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();

/* ==========================================================================
   论坛：发布新帖 / 回帖
   纯静态站没有后端，所以「提交」= 生成规范的 Markdown + 跳 GitHub 新建或编辑。
   GitHub 的 /new/ 支持 ?filename=&value= 预填，提交后 Actions 自动重建上线。
   ========================================================================== */
(function () {
    'use strict';
    var REPO = 'Fork11334/caccontect';
    var BRANCH = 'main';
    var base = (window.CAC && window.CAC.base) || '';

    function today() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    function slug(title) {
        var s = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
        return 't-' + Date.now().toString(36) + (s ? '-' + s : '');
    }
    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) { n.className = cls; }
        if (html !== undefined) { n.innerHTML = html; }
        return n;
    }
    function say(box, text, kind) {
        box.textContent = text;
        box.className = 'fcompose__msg' + (kind ? ' ' + kind : '');
    }

    function boot() {
        var path = location.pathname;
        if (base && path.indexOf(base) === 0) { path = path.slice(base.length); }
        if (path.indexOf('/forum') !== 0) { return; }

        var main = document.querySelector('main');
        if (!main) { return; }

        var isThread = /^\/forum\/t-/.test(path);
        var filePath = isThread
            ? 'site/content/forum' + path.replace(/^\/forum/, '').replace(/\/$/, '') + '.md'
            : 'site/content/forum/' + slug('new') + '.md';

        var box = el('section', 'fcompose');
        box.innerHTML =
            '<div class="fcompose__head"><p class="fcompose__title">' + (isThread ? '回帖' : '发布新帖') + '</p>' +
            '<span class="fcompose__hint">' + (isThread ? '追加到本帖末尾' : '新建一帖') + ' · 提交后自动重建</span></div>' +
            (isThread ? '' : '<label><span class="fl">标题</span><input data-f-title maxlength="60" placeholder="一句话说清这是什么"></label>' +
                            '<label><span class="fl">频道</span><select data-f-ch"><option>生活信道</option><option>内部频道</option><option>作业频道</option></select></label>') +
            '<label><span class="fl">署名</span><input data-f-name maxlength="20" placeholder="留空则用「匿名」"></label>' +
            '<label><span class="fl">正文</span><textarea data-f-body placeholder="支持 Markdown"></textarea></label>' +
            '<div class="fcompose__row"><button class="fcompose__btn fcompose__btn--primary" data-f-go type="button">生成并去 GitHub</button>' +
            '<button class="fcompose__btn" data-f-copy type="button">复制 Markdown</button>' +
            '<button class="fcompose__btn" data-f-draft type="button">存本地草稿</button></div>' +
            '<p class="fcompose__msg" data-f-msg></p>';

        main.appendChild(box);
        var msg = box.querySelector('[data-f-msg]');

        // 草稿恢复
        try {
            var draft = JSON.parse(localStorage.getItem('cac-forum-draft') || 'null');
            if (draft) {
                var t = box.querySelector('[data-f-title]'); if (t && draft.title) { t.value = draft.title; }
                var b = box.querySelector('[data-f-body]'); if (b && draft.body) { b.value = draft.body; }
                var n = box.querySelector('[data-f-name]'); if (n && draft.name) { n.value = draft.name; }
            }
        } catch (e) { /* 忽略 */ }

        function build() {
            var titleEl = box.querySelector('[data-f-title]');
            var chEl = box.querySelector('[data-f-ch]');
            var nameEl = box.querySelector('[data-f-name]');
            var bodyEl = box.querySelector('[data-f-body]');
            var title = (titleEl ? titleEl.value : '').trim();
            var name = (nameEl ? nameEl.value : '').trim() || '匿名';
            var body = (bodyEl ? bodyEl.value : '').trim();
            if (!body) { return { error: '正文不能为空' }; }
            if (!isThread && !title) { return { error: '新帖需要标题' }; }

            if (isThread) {
                return { text: '\n::: post author="' + name + '" date="' + today() + '"\n' + body + '\n:::\n' };
            }
            var ch = chEl ? chEl.value : '生活信道';
            var text = '---\ntitle: ' + title + '\nsummary: ' + body.replace(/\s+/g, ' ').slice(0, 60) +
                '\nsection: forum\ngroup: ' + ch + '\norder: 99\nupdated: ' + today() +
                '\n---\n\n::: post title="' + title + '" author="' + name + '" date="' + today() + '"\n' + body + '\n:::\n';
            return { text: text, title: title };
        }

        box.querySelector('[data-f-go]').addEventListener('click', function () {
            var r = build();
            if (r.error) { say(msg, r.error, 'bad'); return; }
            var url;
            if (isThread) {
                // 回帖要追加到已有文件，GitHub 编辑页无法预填内容 → 复制 + 打开编辑页
                navigator.clipboard && navigator.clipboard.writeText(r.text);
                url = 'https://github.com/' + REPO + '/edit/' + BRANCH + '/' + filePath;
                say(msg, '回帖内容已复制，粘贴到文件末尾再提交。正在打开编辑页…', 'ok');
            } else {
                url = 'https://github.com/' + REPO + '/new/' + BRANCH +
                      '?filename=' + encodeURIComponent('site/content/forum/' + slug(r.title) + '.md') +
                      '&value=' + encodeURIComponent(r.text);
                say(msg, '正在打开 GitHub 新建页（内容已预填）…', 'ok');
            }
            window.open(url, '_blank', 'noopener');
        });

        box.querySelector('[data-f-copy]').addEventListener('click', function () {
            var r = build();
            if (r.error) { say(msg, r.error, 'bad'); return; }
            if (navigator.clipboard) {
                navigator.clipboard.writeText(r.text).then(function () { say(msg, '已复制到剪贴板', 'ok'); },
                    function () { say(msg, '复制失败，请手动选中文本', 'bad'); });
            } else { say(msg, '此浏览器不支持剪贴板', 'bad'); }
        });

        box.querySelector('[data-f-draft]').addEventListener('click', function () {
            var titleEl = box.querySelector('[data-f-title]');
            var bodyEl = box.querySelector('[data-f-body]');
            var nameEl = box.querySelector('[data-f-name]');
            try {
                localStorage.setItem('cac-forum-draft', JSON.stringify({
                    title: titleEl ? titleEl.value : '',
                    name: nameEl ? nameEl.value : '',
                    body: bodyEl ? bodyEl.value : ''
                }));
                say(msg, '草稿已存在本机', 'ok');
            } catch (e) { say(msg, '本地存储不可用', 'bad'); }
        });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
    else { boot(); }
})();
