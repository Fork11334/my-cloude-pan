/* ==========================================================================
   校验页背景：虚拟粒子海洋 + 鱼群
   原生 canvas，零依赖。规矩和站点动效层一致：
     1. 减少动态效果时只画一帧静态画面，不启动循环、不挂指针监听；
     2. 只画填充与描边，不做逐像素处理；
     3. 切到后台就停，回到前台再续；
     4. DPR 封顶 2，粒子数按面积算（60–150），手机不会硬扛。
   交互：鼠标移动把粒子与鱼推开；点击/触摸炸开一圈涟漪。
   ========================================================================== */
(function () {
    'use strict';

    var canvas = document.querySelector('[data-ocean]');
    if (!canvas) { return; }
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { return; }

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var DPR = 1;
    var W = 0;
    var H = 0;
    var particles = [];
    var fish = [];
    var ripples = [];
    var pointer = { x: -9999, y: -9999, on: false };
    var running = false;
    var raf = 0;
    var last = 0;

    function rand(a, b) { return a + (Math.random() * (b - a)); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    /* ── 尺寸与种子 ────────────────────────────────────────────────────── */
    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth || window.innerWidth;
        H = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = '#05080c';
        ctx.fillRect(0, 0, W, H);
        seed();
        if (reduced) { draw(0); }
    }

    function seed() {
        var count = Math.round(clamp((W * H) / 16000, 60, 150));
        particles = [];
        for (var i = 0; i < count; i += 1) {
            var bvx = rand(-0.14, 0.14);
            var bvy = rand(-0.06, 0.06);
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: bvx,
                vy: bvy,
                bvx: bvx,
                bvy: bvy,
                r: rand(0.7, 2.1),
                a: rand(0.12, 0.46),
                ph: Math.random() * 6.283,
            });
        }

        fish = [];
        var n = W < 720 ? 3 : 5;
        for (var k = 0; k < n; k += 1) {
            fish.push({
                x: rand(0, W),
                y: rand(H * 0.12, H * 0.88),
                vx: rand(0.3, 0.85) * (Math.random() < 0.5 ? -1 : 1),
                vy: rand(-0.07, 0.07),
                size: rand(9, 21),
                ph: Math.random() * 6.283,
                tone: Math.random(),
            });
        }
    }

    /* ── 更新 ──────────────────────────────────────────────────────────── */
    function update(dt, t) {
        var i;
        var p;

        for (i = 0; i < particles.length; i += 1) {
            p = particles[i];

            // 洋流：横向漂 + 一点正弦起伏
            p.vx += (p.bvx - p.vx) * 0.02 * dt;
            p.vy += (p.bvy - p.vy) * 0.02 * dt;
            p.x += (p.vx + Math.sin(t * 0.0006 + p.ph) * 0.06) * dt;
            p.y += (p.vy + Math.cos(t * 0.0005 + p.ph) * 0.05) * dt;

            // 指针推开
            if (pointer.on) {
                var dx = p.x - pointer.x;
                var dy = p.y - pointer.y;
                var d2 = dx * dx + dy * dy;
                if (d2 < 130 * 130 && d2 > 0.01) {
                    var d = Math.sqrt(d2);
                    var f = (1 - d / 130) * 0.9;
                    p.vx += (dx / d) * f;
                    p.vy += (dy / d) * f;
                }
            }

            // 边界：横向绕回，纵向弹回
            if (p.x < -8) { p.x = W + 8; }
            if (p.x > W + 8) { p.x = -8; }
            if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
            if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }
        }

        for (i = 0; i < fish.length; i += 1) {
            var f = fish[i];
            f.ph += 0.02 * dt;

            // 漫游：缓慢转向 + 保持速度
            f.vx += Math.sin(f.ph * 0.7) * 0.006 * dt;
            f.vy += Math.cos(f.ph * 0.5) * 0.005 * dt;
            f.vx = clamp(f.vx, -1.5, 1.5);
            f.vy = clamp(f.vy, -0.55, 0.55);

            // 躲开指针
            if (pointer.on) {
                var fx = f.x - pointer.x;
                var fy = f.y - pointer.y;
                var fd2 = fx * fx + fy * fy;
                if (fd2 < 180 * 180 && fd2 > 0.01) {
                    var fd = Math.sqrt(fd2);
                    var ff = (1 - fd / 180) * 0.55;
                    f.vx += (fx / fd) * ff;
                    f.vy += (fy / fd) * ff;
                }
            }

            f.x += f.vx * dt;
            f.y += f.vy * dt;

            if (f.x < -60) { f.x = W + 40; }
            if (f.x > W + 60) { f.x = -40; }
            if (f.y < 30) { f.y = 30; f.vy = Math.abs(f.vy); }
            if (f.y > H - 30) { f.y = H - 30; f.vy = -Math.abs(f.vy); }
        }

        for (i = ripples.length - 1; i >= 0; i -= 1) {
            ripples[i].r += 5.2 * dt;
            ripples[i].a -= 0.012 * dt;
            if (ripples[i].a <= 0) { ripples.splice(i, 1); }
        }
    }

    /* ── 绘制 ──────────────────────────────────────────────────────────── */
    function draw(t) {
        var i;

        for (i = 0; i < particles.length; i += 1) {
            var p = particles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.fillStyle = 'rgba(126, 196, 226, ' + p.a.toFixed(3) + ')';
            ctx.fill();
        }

        for (i = 0; i < ripples.length; i += 1) {
            var r = ripples[i];
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, 6.283);
            ctx.strokeStyle = 'rgba(150, 210, 240, ' + Math.max(0, r.a).toFixed(3) + ')';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        for (i = 0; i < fish.length; i += 1) { drawFish(fish[i], t); }
    }

    function drawFish(f, t) {
        var dir = f.vx < 0 ? -1 : 1;
        var wag = Math.sin(f.ph * 2.2) * 0.32;
        var s = f.size;
        var body = f.tone > 0.5
            ? 'rgba(104, 172, 208, 0.30)'
            : 'rgba(146, 126, 196, 0.28)';
        var tail = f.tone > 0.5
            ? 'rgba(104, 172, 208, 0.20)'
            : 'rgba(146, 126, 196, 0.18)';

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(dir, 1);

        // 身体
        ctx.beginPath();
        ctx.moveTo(s * 0.95, 0);
        ctx.quadraticCurveTo(s * 0.25, -s * 0.40, -s * 0.45, -s * 0.11);
        ctx.quadraticCurveTo(-s * 0.18, 0, -s * 0.45, s * 0.11);
        ctx.quadraticCurveTo(s * 0.25, s * 0.40, s * 0.95, 0);
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();

        // 尾鳍
        ctx.beginPath();
        ctx.moveTo(-s * 0.38, 0);
        ctx.lineTo(-s * 1.08, -s * 0.30 + wag * s * 0.28);
        ctx.lineTo(-s * 1.08, s * 0.30 + wag * s * 0.28);
        ctx.closePath();
        ctx.fillStyle = tail;
        ctx.fill();

        // 眼
        ctx.beginPath();
        ctx.arc(s * 0.55, -s * 0.05, Math.max(0.9, s * 0.065), 0, 6.283);
        ctx.fillStyle = 'rgba(226, 244, 255, 0.70)';
        ctx.fill();

        ctx.restore();
    }

    /* ── 循环 ──────────────────────────────────────────────────────────── */
    function frame(t) {
        if (!running) { return; }
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(2.5, (t - last) / 16.67) : 1;
        last = t;

        // 半透明重绘 = 拖尾，水感就来自这里
        ctx.fillStyle = 'rgba(5, 8, 12, 0.24)';
        ctx.fillRect(0, 0, W, H);

        update(dt, t);
        draw(t);
    }

    function start() {
        if (running || reduced) { return; }
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
    }

    function stop() {
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    /* ── 交互 ──────────────────────────────────────────────────────────── */
    function burst(x, y) {
        ripples.push({ x: x, y: y, r: 2, a: 0.5 });

        var i;
        for (i = 0; i < particles.length; i += 1) {
            var p = particles[i];
            var dx = p.x - x;
            var dy = p.y - y;
            var d2 = dx * dx + dy * dy;
            if (d2 < 240 * 240 && d2 > 0.01) {
                var d = Math.sqrt(d2);
                var f = (1 - d / 240) * 3.4;
                p.vx += (dx / d) * f;
                p.vy += (dy / d) * f;
            }
        }
        for (i = 0; i < fish.length; i += 1) {
            var fi = fish[i];
            var fxx = fi.x - x;
            var fyy = fi.y - y;
            var fd2 = fxx * fxx + fyy * fyy;
            if (fd2 < 320 * 320 && fd2 > 0.01) {
                var fd = Math.sqrt(fd2);
                var ff = (1 - fd / 320) * 1.6;
                fi.vx += (fxx / fd) * ff;
                fi.vy += (fyy / fd) * ff;
            }
        }

        if (reduced) { draw(0); }
    }

    function onMove(e) {
        var rect = canvas.getBoundingClientRect();
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        pointer.on = true;
    }

    function onLeave() {
        pointer.on = false;
        pointer.x = -9999;
        pointer.y = -9999;
    }

    function onDown(e) {
        var rect = canvas.getBoundingClientRect();
        burst(e.clientX - rect.left, e.clientY - rect.top);
    }

    /* ── 启动 ──────────────────────────────────────────────────────────── */
    resize();

    if (!reduced) {
        start();
        // 指针事件挂在 window 上：卡片会吃掉 canvas 上的事件，挂在 window 才收得到
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerdown', onDown, { passive: true });
        window.addEventListener('pointerleave', onLeave, { passive: true });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stop(); } else { start(); }
        });
    }

    var resizeQueued = false;
    window.addEventListener('resize', function () {
        if (resizeQueued) { return; }
        resizeQueued = true;
        requestAnimationFrame(function () {
            resizeQueued = false;
            resize();
            if (reduced) { draw(0); }
        });
    });
}());
