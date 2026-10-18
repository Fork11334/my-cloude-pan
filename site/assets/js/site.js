/* ==========================================================================
   站点脚本：移动端导航、搜索面板、目录高亮、阅读进度
   零依赖，直接跑在浏览器里。
   ========================================================================== */
(function () {
    'use strict';

    var cfg = window.CAC || {};

    /* ── 界面样式切换：滑块式分段控件 + 扩散切换动画 ───────────────────── */
    var themepick = document.querySelector('[data-themepick]');
    if (themepick) {
        var themeOpts = Array.prototype.slice.call(themepick.querySelectorAll('[data-theme-set]'));
        var themeThumb = themepick.querySelector('.themepick__thumb');
        var themeNow = document.documentElement.dataset.theme
            || cfg.theme
            || (themeOpts[0] && themeOpts[0].getAttribute('data-theme-set'));

        var moveThumb = function (animate) {
            var on = null;
            themeOpts.forEach(function (btn) {
                var isOn = btn.getAttribute('data-theme-set') === themeNow;
                btn.classList.toggle('is-on', isOn);
                btn.setAttribute('aria-checked', String(isOn));
                if (isOn) { on = btn; }
            });
            if (!on || !themeThumb) { return; }
            if (!animate) { themeThumb.style.transition = 'none'; }
            // 先关过渡摆好位置，下一帧再恢复，避免首帧从左边滑过来
            requestAnimationFrame(function () {
                themeThumb.style.width = on.offsetWidth + 'px';
                themeThumb.style.transform = 'translateX(' + on.offsetLeft + 'px)';
                if (!animate) {
                    requestAnimationFrame(function () { themeThumb.style.transition = ''; });
                }
            });
        };

        // 换配色时从按钮位置扩散一圈，把瞬时换色藏在动画里
        var washTo = function (x, y) {
            var wash = document.createElement('div');
            wash.className = 'theme-wash';
            wash.style.setProperty('--wx', x + 'px');
            wash.style.setProperty('--wy', y + 'px');
            document.body.appendChild(wash);
            requestAnimationFrame(function () { wash.classList.add('is-on'); });
            setTimeout(function () { if (wash.parentNode) { wash.parentNode.removeChild(wash); } }, 800);
        };

        themeOpts.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.getAttribute('data-theme-set');
                if (key === themeNow) { return; }
                var r = btn.getBoundingClientRect();
                washTo(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
                themeNow = key;
                document.documentElement.dataset.theme = themeNow;
                try { localStorage.setItem('cac-theme', themeNow); } catch (e) { /* 隐私模式忽略 */ }
                moveThumb(true);
            });
        });

        document.documentElement.dataset.theme = themeNow;
        moveThumb(false);
        window.addEventListener('resize', function () { moveThumb(false); });
    }

    /* ── 顶栏账户状态（账号只存在这台设备的浏览器里，见 /login/） ───────── */
    var session = null;
    try { session = JSON.parse(localStorage.getItem('cac-session') || 'null'); } catch (e) { session = null; }
    if (session && session.user) {
        var avatarEl = document.querySelector('[data-avatar]');
        var nameEl = document.querySelector('[data-account-name]');
        var loginEl = document.querySelector('[data-account-login]');
        var meEl = document.querySelector('[data-account-me]');
        var outEl = document.querySelector('[data-account-out]');
        if (avatarEl) { avatarEl.textContent = String(session.user).slice(0, 1).toUpperCase(); }
        if (nameEl) { nameEl.textContent = session.user; }
        if (loginEl) { loginEl.hidden = true; }
        if (meEl) { meEl.hidden = false; }
        if (outEl) {
            outEl.hidden = false;
            outEl.addEventListener('click', function () {
                try { localStorage.removeItem('cac-session'); } catch (e) { /* 忽略 */ }
                location.href = cfg.base + '/';
            });
        }
    }

    /* ── 移动端导航 ────────────────────────────────────────────────────── */
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('site-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', String(open));
        });
    }

    /* ── 顶栏成员菜单 ──────────────────────────────────────────────────────
       桌面靠 CSS :hover 展开；这里负责点击切换（触屏）、Esc 与点击外部关闭，
       并且同步 aria-expanded，键盘用户也能用。                                */
    var usermenu = document.querySelector('[data-usermenu]');
    if (usermenu) {
        var umBtn = usermenu.querySelector('[data-usermenu-btn]');
        var setMenu = function (open) {
            usermenu.classList.toggle('is-open', open);
            if (umBtn) { umBtn.setAttribute('aria-expanded', String(open)); }
        };
        setMenu(false);

        if (umBtn) {
            umBtn.addEventListener('click', function (e) {
                e.preventDefault();
                setMenu(!usermenu.classList.contains('is-open'));
            });
        }
        document.addEventListener('click', function (e) {
            if (!usermenu.contains(e.target)) { setMenu(false); }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && usermenu.classList.contains('is-open')) {
                setMenu(false);
                if (umBtn) { umBtn.focus(); }
            }
        });
        // 点菜单里的条目后收起来，免得返回时还挂着
        usermenu.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('a')) { setMenu(false); }
        });
    }

    /* ── 部门轮播：自动播放 + 左右箭头 + 指示点 ────────────────────────── */
    var carousel = document.querySelector('[data-carousel]');
    if (carousel) {
        var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-slide]'));
        var slideDots = Array.prototype.slice.call(carousel.querySelectorAll('[data-slide-to]'));
        var slideIndex = 0;
        var slideTimer = null;
        var noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var track = carousel.querySelector('[data-track]');

        /* 钉住序列：宽屏 + 精确指针才把轮播钉住，用滚动推进编号（nodcoding 那种章节推进）；
           其余情况 pinned 为 false，回退成原来的自动播放 + 箭头 + 指示点。 */
        var seq = carousel.closest('[data-dept-seq]');
        var pinMq = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
        var pinned = !!seq && !noMotion && pinMq.matches;

        var showSlide = function (next) {
            if (!slides.length) { return; }
            slideIndex = ((next % slides.length) + slides.length) % slides.length;
            // 横向位移（华为招聘那套：.3s cubic-bezier(.4,0,.2,1)），非激活 slide 压到 opacity .1
            if (track) { track.style.transform = 'translateX(' + (-slideIndex * 100) + '%)'; }
            slides.forEach(function (slide, i) {
                var on = i === slideIndex;
                slide.classList.toggle('is-on', on);
                slide.setAttribute('aria-hidden', String(!on));
            });
            slideDots.forEach(function (dot, i) {
                dot.classList.toggle('is-on', i === slideIndex);
                dot.setAttribute('aria-selected', String(i === slideIndex));
            });
            // 分区背景的三道光束跟着当前部门走
            var zone = seq && seq.closest ? seq.closest('[data-zone]') : null;
            if (zone) { zone.setAttribute('data-dept-index', String(slideIndex)); }
        };
        var stopSlides = function () { if (slideTimer) { clearInterval(slideTimer); slideTimer = null; } };
        var startSlides = function () {
            // 钉住模式下滚动才是唯一的推进器，自动播放必须让位
            if (pinned || noMotion || slides.length < 2) { return; }
            stopSlides();
            slideTimer = setInterval(function () { showSlide(slideIndex + 1); }, 5000);
        };

        carousel.querySelectorAll('[data-slide-next]').forEach(function (btn) {
            btn.addEventListener('click', function () { showSlide(slideIndex + 1); startSlides(); });
        });
        carousel.querySelectorAll('[data-slide-prev]').forEach(function (btn) {
            btn.addEventListener('click', function () { showSlide(slideIndex - 1); startSlides(); });
        });
        slideDots.forEach(function (dot) {
            dot.addEventListener('click', function () {
                showSlide(parseInt(dot.getAttribute('data-slide-to'), 10) || 0);
                startSlides();
            });
        });
        carousel.addEventListener('pointerenter', stopSlides);
        carousel.addEventListener('pointerleave', startSlides);
        carousel.addEventListener('focusin', stopSlides);
        carousel.addEventListener('focusout', startSlides);
        carousel.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') { showSlide(slideIndex + 1); startSlides(); }
            if (e.key === 'ArrowLeft') { showSlide(slideIndex - 1); startSlides(); }
        });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stopSlides(); } else { startSlides(); }
        });

        showSlide(0);
        startSlides();

        /* 滚动进度 → 编号。读写都在 rAF 里，滚动回调只负责排队。 */
        if (pinned && seq) {
            var queued = false;
            var syncFromScroll = function () {
                queued = false;
                if (!pinMq.matches) { return; }
                var total = seq.offsetHeight - window.innerHeight;
                if (total <= 0) { return; }
                var p = Math.min(1, Math.max(0, -seq.getBoundingClientRect().top / total));
                var i = Math.min(slides.length - 1, Math.floor(p * slides.length));
                if (i !== slideIndex) { showSlide(i); }
            };
            var requestSync = function () {
                if (queued) { return; }
                queued = true;
                window.requestAnimationFrame(syncFromScroll);
            };
            window.addEventListener('scroll', requestSync, { passive: true });
            window.addEventListener('resize', requestSync);
            requestSync();
        }
    }

    /* ── 阅读进度 ──────────────────────────────────────────────────────── */
    var progress = document.querySelector('[data-progress]');
    if (progress) {
        var bar = progress.querySelector('span');
        var update = function () {
            var h = document.documentElement.scrollHeight - window.innerHeight;
            var pct = h > 40 ? Math.min(100, (window.scrollY / h) * 100) : 0;
            progress.hidden = pct <= 1;
            bar.style.width = pct + '%';
        };
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ── 目录高亮 ──────────────────────────────────────────────────────── */
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc__list a'));
    if (tocLinks.length && 'IntersectionObserver' in window) {
        var targets = tocLinks
            .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
            .filter(Boolean);
        var seen = new Map();
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
            var current = targets.filter(function (t) { return seen.get(t); })[0];
            tocLinks.forEach(function (a) {
                a.classList.toggle('is-active', !!current && a.getAttribute('href') === '#' + current.id);
            });
        }, { rootMargin: '-88px 0px -70% 0px' });
        targets.forEach(function (t) { observer.observe(t); });
    }

    /* ── 搜索 ──────────────────────────────────────────────────────────── */
    var BASE = cfg.base || '';
    var indexPromise = null;
    function loadIndex() {
        if (!indexPromise) {
            indexPromise = fetch(BASE + '/search-index.json')
                .then(function (r) { return r.ok ? r.json() : []; })
                .catch(function () { return []; });
        }
        return indexPromise;
    }

    function score(item, terms) {
        var title = (item.title || '').toLowerCase();
        var body = ((item.summary || '') + ' ' + (item.text || '')).toLowerCase();
        var total = 0;
        for (var i = 0; i < terms.length; i += 1) {
            var t = terms[i];
            var inTitle = title.indexOf(t);
            var inBody = body.indexOf(t);
            if (inTitle < 0 && inBody < 0) { return 0; }
            total += inTitle >= 0 ? 6 : 0;
            total += inBody >= 0 ? 2 : 0;
        }
        return total;
    }

    function snippet(text, term) {
        var plain = String(text || '').replace(/\s+/g, ' ');
        var at = plain.toLowerCase().indexOf(term);
        var start = at > 60 ? at - 60 : 0;
        var cut = plain.slice(start, start + 170);
        return (start > 0 ? '…' : '') + cut + (plain.length > start + 170 ? '…' : '');
    }

    function highlight(text, terms) {
        var out = String(text || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        terms.forEach(function (t) {
            if (t.length < 1) { return; }
            out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
        });
        return out;
    }

    function search(query) {
        var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) { return []; }
        return loadIndex().then(function (list) {
            return list
                .map(function (item) { return { item: item, s: score(item, terms) }; })
                .filter(function (r) { return r.s > 0; })
                .sort(function (a, b) { return b.s - a.s; })
                .slice(0, 20)
                .map(function (r) { return r.item; });
        });
    }

    /* 面板式搜索 */
    var overlay = document.querySelector('[data-search]');
    if (overlay) {
        var input = overlay.querySelector('[data-search-input]');
        var results = overlay.querySelector('[data-search-results]');
        var active = -1;
        var current = [];

        function render(items, query) {
            current = items;
            active = -1;
            if (!query.trim()) {
                results.innerHTML = '<p class="search__hint">输入关键词开始检索。↑↓ 选择，Enter 打开，Esc 关闭。</p>';
                return;
            }
            if (!items.length) {
                results.innerHTML = '<p class="search__hint">没有找到匹配的页面。</p>';
                return;
            }
            var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
            results.innerHTML = items.map(function (item, i) {
                return '<a class="search__item" style="--i:' + Math.min(i, 12) + '" href="' + item.url + '">' +
                    '<span class="search__section">' + highlight(item.section || item.group || '页面', []) + '</span>' +
                    '<h3>' + highlight(item.title, terms) + '</h3>' +
                    '<p>' + highlight(item.summary || snippet(item.text, terms[0]), terms) + '</p></a>';
            }).join('');
        }

        function move(step) {
            var nodes = results.querySelectorAll('.search__item');
            if (!nodes.length) { return; }
            active = (active + step + nodes.length) % nodes.length;
            Array.prototype.forEach.call(nodes, function (n, i) { n.classList.toggle('is-active', i === active); });
            nodes[active].scrollIntoView({ block: 'nearest' });
        }

        var closeTimer = null;

        function open() {
            clearTimeout(closeTimer);
            overlay.hidden = false;
            input.value = '';
            render([], '');
            // 下一帧再加类，transform/opacity 过渡才会真正播放
            requestAnimationFrame(function () { overlay.classList.add('is-open'); });
            setTimeout(function () { input.focus(); }, 10);
        }
        function close() {
            overlay.classList.remove('is-open');
            clearTimeout(closeTimer);
            closeTimer = setTimeout(function () { overlay.hidden = true; }, 200);
        }

        document.querySelectorAll('[data-search-open]').forEach(function (btn) {
            btn.addEventListener('click', open);
        });
        overlay.querySelectorAll('[data-search-close]').forEach(function (btn) {
            btn.addEventListener('click', close);
        });

        var timer = null;
        input.addEventListener('input', function () {
            clearTimeout(timer);
            var q = input.value;
            timer = setTimeout(function () { search(q).then(function (items) { render(items, q); }); }, 90);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Enter' && current.length) {
                e.preventDefault();
                var node = results.querySelectorAll('.search__item')[active < 0 ? 0 : active];
                if (node) { location.href = node.getAttribute('href'); }
            }
        });

        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                overlay.hidden ? open() : close();
            } else if (e.key === 'Escape' && !overlay.hidden) {
                close();
            }
        });

        // 直接打开 /任意页面#search 也能唤起搜索面板
        if (location.hash === '#search') { open(); }
    }

    /* /search/ 独立页面（无 JS 时至少还能用表单） */
    var pageForm = document.querySelector('[data-search-page]');
    if (pageForm) {
        var pageInput = pageForm.querySelector('input');
        var pageResults = document.querySelector('[data-search-page-results]');
        var params = new URLSearchParams(location.search);
        var initial = params.get('q') || '';

        function run(query) {
            if (!query.trim()) {
                pageResults.innerHTML = '<p class="search__hint">输入关键词，检索全站页面标题与正文。</p>';
                return;
            }
            search(query).then(function (items) {
                if (!items.length) {
                    pageResults.innerHTML = '<p class="search__hint">没有找到匹配的页面。</p>';
                    return;
                }
                var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
                pageResults.innerHTML = items.map(function (item) {
                    return '<a class="search__item" href="' + item.url + '">' +
                        '<span class="search__section">' + (item.section || '页面') + '</span>' +
                        '<h3>' + highlight(item.title, terms) + '</h3>' +
                        '<p>' + highlight(item.summary || snippet(item.text, terms[0]), terms) + '</p></a>';
                }).join('');
            });
        }

        pageForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var q = pageInput.value;
            history.replaceState(null, '', BASE + '/search/' + (q ? '?q=' + encodeURIComponent(q) : ''));
            run(q);
        });
        if (initial) { pageInput.value = initial; run(initial); } else { run(''); }
    }

    /* ── 返回上页 / 回主页 ────────────────────────────────────────────── */
    var backBtn = document.querySelector('[data-back]');
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            if (history.length > 1) { history.back(); }
            else { location.href = BASE + '/'; }
        });
    }
})();
