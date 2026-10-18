/* ==========================================================================
   档案部各页的交互
   分工：morphfield.js 只负责画粒子；这里只负责「什么时候换形状、换数据」。
   每个版式都在 data-archive-page 上登记，没有匹配到就什么都不做。
   ========================================================================== */
(function () {
    'use strict';

    var page = document.querySelector('[data-archive-page]');
    if (!page) { return; }

    var kind = page.getAttribute('data-archive-page');
    var P = window.CACParticles || null;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = window.matchMedia('(max-width: 720px)').matches;

    /* 全站背景：canvas[data-bg] 用同一个引擎，模式写在属性上 */
    var bgs = [];
    function bindBackgrounds() {
        if (!window.CACBg) { return; }
        [].slice.call(document.querySelectorAll('canvas[data-bg]')).forEach(function (el) {
            var api = window.CACBg.create(el, { mode: el.getAttribute('data-bg') });
            if (api) { el.__api = api; bgs.push(api); }
        });
    }

    function onVisible(canvas, api) {
        document.addEventListener('visibilitychange', function () {
            if (!api) { return; }
            if (document.hidden) { api.stop(); } else { api.start(); }
        });
        var io = null;
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!api) { return; }
                    if (entry.isIntersecting) { api.start(); } else { api.stop(); }
                });
            }, { rootMargin: '120px' });
            io.observe(canvas);
        }
    }

    function mount(canvas, options) {
        if (!canvas || !P) { return null; }
        var api = P.create(canvas, options);
        if (api) { onVisible(canvas, api); }
        return api;
    }

    /* ── 主页：本部门内的即时筛选 ─────────────────────────────────────────── */
    if (kind === 'home') {
        bindBackgrounds();
        var form = page.querySelector('[data-arc-search]');
        var input = page.querySelector('[data-arc-q]');
        var entries = [].slice.call(page.querySelectorAll('[data-arc-entry]'));
        var empty = page.querySelector('[data-arc-empty]');

        var filter = function () {
            var q = (input ? input.value : '').trim().toLowerCase();
            var shown = 0;
            entries.forEach(function (el) {
                var hit = !q || (el.getAttribute('data-keywords') || '').toLowerCase().indexOf(q) !== -1;
                el.hidden = !hit;
                if (hit) { shown += 1; }
            });
            if (empty) { empty.hidden = shown > 0; }
        };

        if (input) { input.addEventListener('input', filter); }
        if (form) {
            form.addEventListener('submit', function (e) { e.preventDefault(); filter(); });
        }
        return;
    }

    /* ── 设施：粒子地球 + 左侧列表 ───────────────────────────────────────── */
    if (kind === 'globe' || kind === 'facility') {
        var canvas = page.querySelector('[data-morph="globe"]');
        if (!canvas) { return; }

        var lockLat = canvas.getAttribute('data-lock-lat');
        var lockLon = canvas.getAttribute('data-lock-lon');
        var api = mount(canvas, {
            mode: 'globe',
            centerX: Number(canvas.getAttribute('data-center-x')) || 0.5,
        });

        if (kind === 'facility') {
            if (api && lockLat !== null && lockLon !== null) {
                api.focus(Number(lockLat), Number(lockLon));
            }
            return;
        }

        var rows = [].slice.call(page.querySelectorAll('[data-fac]'));
        var markerList = rows.map(function (btn) {
            return {
                lat: Number(btn.getAttribute('data-lat')),
                lon: Number(btn.getAttribute('data-lon')),
                color: btn.getAttribute('data-color') || '#8b949e',
            };
        });
        if (api) { api.markers(markerList); }

        var panel = {
            type: page.querySelector('[data-fac-type]'),
            name: page.querySelector('[data-fac-name]'),
            region: page.querySelector('[data-fac-region]'),
            sum: page.querySelector('[data-fac-summary]'),
            coords: page.querySelector('[data-fac-coords]'),
            link: page.querySelector('[data-fac-link]'),
        };

        /* 3D 版地球就绪后接管：藏掉 2D 画布，旋转交给 Three */
        var globe3d = null;
        if (window.CACGlobe3D) {
            window.CACGlobe3D.then(function (g) {
                if (!g) { return; }
                globe3d = g;
                if (canvas) { canvas.hidden = true; }
                if (api) { api.stop(); }
                if (rows[0]) { pick(rows[0]); }
            });
        }

        var pick = function (btn) {
            rows.forEach(function (row) { row.parentNode.classList.toggle('is-on', row === btn); });

            var lat = Number(btn.getAttribute('data-lat'));
            var lon = Number(btn.getAttribute('data-lon'));
            if (api) { api.focus(lat, lon); }
            if (globe3d) { globe3d.focus(lat, lon); }

            if (panel.type) {
                panel.type.textContent = btn.getAttribute('data-type-label') || '';
                panel.type.style.setProperty('--c', btn.getAttribute('data-color') || '#8b949e');
            }
            if (panel.name) { panel.name.textContent = btn.getAttribute('data-name') || ''; }
            if (panel.region) { panel.region.textContent = btn.getAttribute('data-region') || ''; }
            if (panel.sum) { panel.sum.textContent = btn.getAttribute('data-summary') || ''; }
            if (panel.coords) { panel.coords.textContent = lat.toFixed(1) + '° / ' + lon.toFixed(1) + '°'; }
            if (panel.link) { panel.link.setAttribute('href', btn.getAttribute('data-href') || '/archive/facilities/'); }
        };

        rows.forEach(function (btn) {
            btn.addEventListener('pointerenter', function () { pick(btn); });
            btn.addEventListener('focus', function () { pick(btn); });
            btn.addEventListener('click', function () { pick(btn); });
        });

        if (rows[0]) { pick(rows[0]); }
        return;
    }

    /* ── 装备：常规三列 / 特殊设计图循环 ────────────────────────────────── */
    if (kind === 'equipment') {
        var tabs = [].slice.call(page.querySelectorAll('[data-eq-tab]'));
        var panels = [].slice.call(page.querySelectorAll('[data-eq-panel]'));
        var pageCanvas = page.querySelector('canvas[data-morph="equipment"]');
        var designs = [].slice.call(page.querySelectorAll('[data-eq-design]'));

        var designApi = null;
        var designIndex = 0;
        var cycle = null;
        var columnsMounted = false;

        var showPanel = function (id) {
            tabs.forEach(function (t) {
                var on = t.getAttribute('data-eq-tab') === id;
                t.classList.toggle('is-on', on);
                t.setAttribute('aria-selected', String(on));
            });
            panels.forEach(function (p) {
                var on = p.getAttribute('data-eq-panel') === id;
                p.hidden = !on;
                p.classList.toggle('is-on', on);
            });
        };

        var applyDesign = function () {
            designs.forEach(function (d, i) { d.classList.toggle('is-on', i === designIndex); });
            var current = designs[designIndex];
            if (designApi && current) { designApi.morph(current.getAttribute('data-shape') || 'anchor'); }
        };

        var stopCycle = function () { if (cycle) { clearInterval(cycle); cycle = null; } };
        var startCycle = function () {
            stopCycle();
            if (reduced || designs.length < 2) { return; }
            // 每 60 秒散开重组成下一张设计图
            cycle = setInterval(function () {
                designIndex = (designIndex + 1) % designs.length;
                applyDesign();
            }, 60000);
        };

        var mountColumns = function () {
            if (columnsMounted || narrow) { return; }
            columnsMounted = true;
            [].slice.call(page.querySelectorAll('[data-shape-canvas]')).forEach(function (el) {
                mount(el, { mode: 'cloud', shape: el.getAttribute('data-shape-canvas') || 'gun' });
            });
        };

        var activate = function (id) {
            showPanel(id);

            if (id === 'regular') {
                stopCycle();
                if (pageCanvas) { pageCanvas.hidden = true; if (designApi) { designApi.stop(); } }
                mountColumns();
                return;
            }

            if (id === 'special') {
                if (pageCanvas) { pageCanvas.hidden = false; }
                if (!designApi) { designApi = mount(pageCanvas, { mode: 'cloud' }); }
                else { designApi.resize(); designApi.start(); }
                applyDesign();
                startCycle();
                return;
            }

            stopCycle();
            if (pageCanvas) { pageCanvas.hidden = true; }
            if (designApi) { designApi.stop(); }
        };

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () { activate(tab.getAttribute('data-eq-tab')); });
        });

        designs.forEach(function (design, i) {
            design.addEventListener('click', function () {
                designIndex = i;
                applyDesign();
                startCycle();
            });
        });

        activate('regular');
        return;
    }

    /* ── 项目：三种排序 + 三种背景 ──────────────────────────────────────── */
    if (kind === 'projects') {
        bindBackgrounds();
        var list = page.querySelector('[data-proj-list]');
        var buttons = [].slice.call(page.querySelectorAll('[data-sort]'));
        var hint = page.querySelector('[data-sort-hint]');
        var canvas = page.querySelector('canvas[data-bg]');
        var api = canvas && canvas.__api ? canvas.__api : null;

        var MODES = {
            date: { shape: 'neural', hint: '神经思维网络' },
            code: { shape: 'cell', hint: '生物细胞图' },
            level: { shape: 'thought', hint: '思维空间模拟' },
        };

        var sortItems = function (mode) {
            if (!list) { return; }
            var items = [].slice.call(list.children);
            items.sort(function (a, b) {
                if (mode === 'code') {
                    return String(a.dataset.code).localeCompare(String(b.dataset.code));
                }
                if (mode === 'level') {
                    return (Number(a.dataset.rank) - Number(b.dataset.rank))
                        || String(b.dataset.date).localeCompare(String(a.dataset.date));
                }
                return String(b.dataset.date).localeCompare(String(a.dataset.date));
            });
            items.forEach(function (el) { list.appendChild(el); });
        };

        var apply = function (mode) {
            buttons.forEach(function (b) {
                var on = b.getAttribute('data-sort') === mode;
                b.classList.toggle('is-on', on);
                b.setAttribute('aria-pressed', String(on));
            });
            sortItems(mode);
            var meta = MODES[mode] || MODES.date;
            if (hint) { hint.textContent = meta.hint; }
            if (api) { api.mode(meta.shape); }
        };

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () { apply(btn.getAttribute('data-sort')); });
        });

        apply('date');
        return;
    }

    /* ── 论文：作者 / 专业筛选 ─────────────────────────────────────────── */
    if (kind === 'papers') {
        bindBackgrounds();
        var authorInput = page.querySelector('[data-paper-author]');
        var fieldInput = page.querySelector('[data-paper-field]');
        var items = [].slice.call(page.querySelectorAll('[data-paper-list] > li'));
        var empty = page.querySelector('[data-paper-empty]');
        var search = page.querySelector('[data-paper-search]');

        var applyFilter = function () {
            var a = (authorInput ? authorInput.value : '').trim().toLowerCase();
            var f = (fieldInput ? fieldInput.value : '').trim().toLowerCase();
            var shown = 0;
            items.forEach(function (el) {
                var ok = (!a || (el.getAttribute('data-author') || '').toLowerCase().indexOf(a) !== -1)
                    && (!f || (el.getAttribute('data-field') || '').toLowerCase().indexOf(f) !== -1);
                el.hidden = !ok;
                if (ok) { shown += 1; }
            });
            if (empty) { empty.hidden = shown > 0; }
        };

        [authorInput, fieldInput].forEach(function (el) {
            if (el) { el.addEventListener('input', applyFilter); }
        });
        if (search) {
            search.addEventListener('submit', function (e) { e.preventDefault(); applyFilter(); });
            search.addEventListener('reset', function () { setTimeout(applyFilter, 0); });
        }
        return;
    }

    /* 行动记录 / 评估报告：只有背景，没有筛选逻辑 */
    if (kind === 'timeline') { bindBackgrounds(); }
}());
