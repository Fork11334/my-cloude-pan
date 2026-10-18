/* ==========================================================================
   档案部的粒子引擎（原生 canvas，零依赖）
   两种模式：
     globe  球面点云 + 设施标记，可拖动旋转、可转到指定经纬度
     cloud  在若干「形状」之间散开重组（枪械、投掷物、护具、三张设计图、
            神经网、细胞、思维空间）

   规矩和站点其它动效一致：
     · prefers-reduced-motion 下只画一帧静态画面
     · 切到后台停、回前台续
     · DPR 封顶 2，粒子数按屏幕面积算
     · 指针交互只挂在 (hover: hover) and (pointer: fine) 上
   ========================================================================== */
(function (root) {
    'use strict';

    var TAU = Math.PI * 2;
    var DEG = Math.PI / 180;

    function rnd(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    /* ── 采样工具：都返回 [x, y, z] 数组，大致落在 [-1, 1] ───────────────── */

    function seg(out, a, b, n) {
        for (var i = 0; i < n; i += 1) {
            var t = n === 1 ? 0.5 : i / (n - 1);
            out.push([
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t,
                a[2] + (b[2] - a[2]) * t,
            ]);
        }
    }

    function boxWire(out, w, h, d, n) {
        var x = w / 2, y = h / 2, z = d / 2;
        var c = [
            [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
            [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
        ];
        var edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (var i = 0; i < edges.length; i += 1) {
            seg(out, c[edges[i][0]], c[edges[i][1]], n);
        }
    }

    function cyl(out, r, h, n) {
        var i, a, y = h / 2;
        for (i = 0; i < n; i += 1) {
            a = (i / n) * TAU;
            var cx = Math.cos(a) * r, cz = Math.sin(a) * r;
            out.push([cx, -y, cz]);
            out.push([cx, y, cz]);
        }
        for (i = 0; i < 10; i += 1) {
            a = (i / 10) * TAU;
            seg(out, [Math.cos(a) * r, -y, Math.sin(a) * r], [Math.cos(a) * r, y, Math.sin(a) * r], 6);
        }
    }

    function sphere(out, r, n) {
        for (var i = 0; i < n; i += 1) {
            var phi = Math.acos(1 - (2 * (i + 0.5)) / n);
            var theta = Math.PI * (1 + Math.sqrt(5)) * i;
            out.push([Math.cos(theta) * Math.sin(phi) * r, Math.cos(phi) * r, Math.sin(theta) * Math.sin(phi) * r]);
        }
    }

    function ring(out, r, n, plane) {
        for (var i = 0; i < n; i += 1) {
            var a = (i / n) * TAU;
            var u = Math.cos(a) * r, v = Math.sin(a) * r;
            out.push(plane === 'xz' ? [u, 0, v] : (plane === 'xy' ? [u, v, 0] : [0, u, v]));
        }
    }

    function move(out, dx, dy, dz) {
        for (var i = 0; i < out.length; i += 1) {
            out[i][0] += dx; out[i][1] += dy; out[i][2] += dz;
        }
        return out;
    }

    function tilt(out, ax, deg) {
        var c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
        for (var i = 0; i < out.length; i += 1) {
            var p = out[i];
            var y = p[1] * c - p[2] * s;
            var z = p[1] * s + p[2] * c;
            p[1] = y; p[2] = z;
        }
        return out;
    }

    function scale(out, k) {
        for (var i = 0; i < out.length; i += 1) {
            out[i][0] *= k; out[i][1] *= k; out[i][2] *= k;
        }
        return out;
    }

    /* ── 陆地轮廓（很粗，够在球面上认出五大洲就行）──────────────────────
       坐标系是 [经度, 纬度]，都是度数。 */
    var LAND = [
        /* 非洲 */
        [[-17, 15], [-5, 5], [8, 4], [18, 0], [25, -10], [32, -20], [35, -28], [30, -34], [18, -34], [12, -26], [10, -12], [3, 5], [-8, 5], [-17, 15]],
        /* 欧洲 */
        [[-9, 36], [-9, 44], [0, 48], [10, 54], [20, 55], [30, 60], [40, 59], [40, 46], [28, 40], [16, 38], [6, 36], [-9, 36]],
        /* 亚洲 */
        [[30, 45], [60, 45], [90, 50], [120, 50], [140, 58], [165, 62], [178, 62], [168, 52], [140, 35], [122, 22], [104, 10], [82, 8], [70, 20], [58, 26], [45, 30], [35, 36], [30, 45]],
        /* 北美洲 */
        [[-166, 60], [-140, 70], [-100, 72], [-70, 62], [-54, 48], [-72, 40], [-82, 26], [-100, 20], [-116, 32], [-130, 45], [-142, 55], [-166, 60]],
        /* 南美洲 */
        [[-80, 9], [-60, 10], [-50, 0], [-34, -6], [-42, -22], [-56, -34], [-70, -50], [-76, -40], [-72, -20], [-80, -2], [-80, 9]],
        /* 大洋洲 */
        [[113, -22], [130, -12], [145, -15], [154, -28], [148, -38], [130, -32], [115, -34], [113, -22]],
        /* 南极洲（一条带） */
        [[-180, -72], [-90, -74], [0, -70], [90, -70], [180, -72], [180, -88], [-180, -88], [-180, -72]],
    ];

    /* 经纬度 → 单位球面上的点（y 朝上） */
    function geo(lon, lat) {
        var p = lat * DEG, l = lon * DEG;
        return [Math.cos(p) * Math.cos(l), Math.sin(p), Math.cos(p) * Math.sin(l)];
    }

    /* 射线法判断点是否在多边形内 */
    function inPoly(lon, lat, poly) {
        var inside = false;
        for (var i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
            var xi = poly[i][0], yi = poly[i][1];
            var xj = poly[j][0], yj = poly[j][1];
            if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /* 在多边形外接框里撒点，命中多边形的留下 */
    function landPoints(n) {
        var out = [];
        var guard = 0;
        while (out.length < n && guard < n * 40) {
            guard += 1;
            var lon = rnd(-180, 180);
            var lat = rnd(-85, 85);
            for (var i = 0; i < LAND.length; i += 1) {
                var poly = LAND[i];
                var minLon = -180, maxLon = 180, minLat = -90, maxLat = 90;
                for (var k = 0; k < poly.length; k += 1) {
                    if (poly[k][0] < minLon) { minLon = poly[k][0]; }
                    if (poly[k][0] > maxLon) { maxLon = poly[k][0]; }
                    if (poly[k][1] < minLat) { minLat = poly[k][1]; }
                    if (poly[k][1] > maxLat) { maxLat = poly[k][1]; }
                }
                if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) { continue; }
                if (inPoly(lon, lat, poly)) { out.push(geo(lon, lat)); break; }
            }
        }
        return out;
    }

    /* ── 形状库 ───────────────────────────────────────────────────────────── */
    var shapes = {
        /* 枪械：枪管 + 机匣 + 弹匣 + 握把 + 枪托 */
        gun: function () {
            var o = [];
            boxWire(o, 1.9, 0.16, 0.16, 26);          // 枪管
            move(o, 0.55, 0.05, 0);
            boxWire(o, 0.55, 0.30, 0.22, 16);         // 机匣
            move(o, -0.25, -0.02, 0);
            boxWire(o, 0.18, 0.34, 0.16, 10);         // 弹匣
            move(o, -0.30, -0.34, 0);
            var grip = [];
            boxWire(grip, 0.16, 0.30, 0.14, 10);
            move(grip, -0.62, -0.22, 0);
            o = o.concat(grip);
            boxWire(o, 0.42, 0.16, 0.12, 10);         // 枪托
            move(o, -0.98, -0.06, 0);
            return scale(o, 0.9);
        },

        /* 投掷物：罐体 + 顶部保险 + 拉环 */
        grenade: function () {
            var o = [];
            cyl(o, 0.30, 0.62, 28);
            boxWire(o, 0.22, 0.16, 0.22, 10);
            move(o, 0, 0.38, 0);
            var pin = [];
            ring(pin, 0.16, 22, 'xy');
            move(pin, 0.26, 0.42, 0);
            o = o.concat(pin);
            boxWire(o, 0.06, 0.20, 0.04, 6);
            move(o, 0.10, 0.30, 0);
            return scale(o, 1.05);
        },

        /* 护具：两块胸背板 + 双肩 */
        armor: function () {
            var o = [];
            var plate = function (z) {
                for (var i = 0; i < 30; i += 1) {
                    var a = -0.9 + (i / 29) * 1.8;
                    o.push([Math.sin(a) * 0.52, Math.cos(a) * 0.46, z]);
                    o.push([Math.sin(a) * 0.52, -Math.cos(a) * 0.46, z]);
                }
            };
            plate(0.18); plate(-0.18);
            var sh = [];
            sphere(sh, 0.16, 40);
            o = o.concat(move(sh, 0.56, 0.30, 0));
            var sh2 = [];
            sphere(sh2, 0.16, 40);
            o = o.concat(move(sh2, -0.56, 0.30, 0));
            return o;
        },

        /* 斯克兰顿现实稳定锚：三脚基座 + 立杆 + 锥顶 + 双环 */
        anchor: function () {
            var o = [];
            var foot = [[0.62, 0, 0.36], [-0.31, 0, 0.72], [-0.31, 0, -0.72]];
            for (var i = 0; i < 3; i += 1) {
                seg(o, [0, 0.1, 0], foot[i], 22);
            }
            var base = [];
            ring(base, 0.78, 34, 'xz');
            o = o.concat(base);
            var rod = [];
            boxWire(rod, 0.16, 0.95, 0.16, 18);
            move(rod, 0, 0.62, 0);
            o = o.concat(rod);
            var r1 = [], r2 = [];
            ring(r1, 0.34, 26, 'xz'); move(r1, 0, 0.46, 0);
            ring(r2, 0.26, 22, 'xz'); move(r2, 0, 0.78, 0);
            o = o.concat(r1, r2);
            seg(o, [0, 1.10, 0], [0.18, 1.46, 0], 14);
            seg(o, [0, 1.10, 0], [-0.18, 1.46, 0], 14);
            seg(o, [0.18, 1.46, 0], [-0.18, 1.46, 0], 14);
            return scale(o, 0.92);
        },

        /* K-96 时停应对雷：方体 + 顶置计时器 + 拨杆 */
        k96: function () {
            var o = [];
            boxWire(o, 0.62, 0.46, 0.62, 22);
            var top = [];
            cyl(top, 0.18, 0.22, 20);
            move(top, 0, 0.34, 0);
            o = o.concat(top);
            var lever = [];
            seg(lever, [0.16, 0.30, 0.2], [0.5, 0.52, 0.2], 16);
            o = o.concat(lever);
            var ring2 = [];
            ring(ring2, 0.12, 18, 'xz');
            move(ring2, -0.16, 0.30, 0.28);
            o = o.concat(ring2);
            boxWire(o, 0.5, 0.06, 0.5, 10);
            move(o, 0, -0.26, 0);
            return o;
        },

        /* GOC 白色套装：头 + 躯干 + 四肢 */
        suit: function () {
            var o = [];
            var hd = [];
            sphere(hd, 0.19, 70);
            o = o.concat(move(hd, 0, 0.86, 0));
            boxWire(o, 0.46, 0.62, 0.26, 20); move(o, 0, 0.32, 0);
            boxWire(o, 0.18, 0.16, 0.18, 8); move(o, 0, 0.02, 0);
            var limb = function (x, y, h, w) {
                var a = [];
                boxWire(a, w, h, w, 12);
                move(a, x, y, 0);
                return a;
            };
            o = o.concat(limb(0.36, 0.30, 0.60, 0.13));
            o = o.concat(limb(-0.36, 0.30, 0.60, 0.13));
            o = o.concat(limb(0.14, -0.52, 0.70, 0.15));
            o = o.concat(limb(-0.14, -0.52, 0.70, 0.15));
            return scale(o, 0.94);
        },

        /* 神经思维网络：节点团 + 连线（点沿线段采样） */
        neural: function () {
            var o = [];
            var nodes = [];
            for (var i = 0; i < 26; i += 1) {
                nodes.push([rnd(-1, 1), rnd(-0.8, 0.8), rnd(-0.35, 0.35)]);
            }
            for (var k = 0; k < nodes.length; k += 1) {
                var a = [];
                sphere(a, rnd(0.03, 0.07), 8);
                o = o.concat(move(a, nodes[k][0], nodes[k][1], nodes[k][2]));
            }
            for (var e = 0; e < 34; e += 1) {
                var from = nodes[Math.floor(rnd(0, nodes.length))];
                var to = nodes[Math.floor(rnd(0, nodes.length))];
                seg(o, from, to, 14);
            }
            return o;
        },

        /* 生物细胞：外膜 + 核 + 细胞器 */
        cell: function () {
            var o = [];
            ring(o, 1.0, 90, 'xz');
            var inner = [];
            ring(inner, 0.92, 80, 'xz');
            tilt(inner, 0, 8);
            o = o.concat(inner);
            var core = [];
            sphere(core, 0.34, 120);
            o = o.concat(move(core, 0.12, 0.05, 0));
            for (var i = 0; i < 14; i += 1) {
                var a = [];
                sphere(a, rnd(0.04, 0.10), 10);
                var ang = rnd(0, TAU), rad = rnd(0.45, 0.82);
                o = o.concat(move(a, Math.cos(ang) * rad, Math.sin(ang) * rad * 0.8, rnd(-0.1, 0.1)));
            }
            return o;
        },

        /* 思维空间：螺旋臂 + 少量散点 */
        thought: function () {
            var o = [];
            for (var arm = 0; arm < 4; arm += 1) {
                for (var i = 0; i < 90; i += 1) {
                    var t = i / 90;
                    var a = t * 3.4 + arm * (TAU / 4);
                    var r = 0.16 + t * 0.86;
                    o.push([
                        Math.cos(a) * r + rnd(-0.03, 0.03),
                        Math.sin(a) * r * 0.62 + rnd(-0.03, 0.03),
                        rnd(-0.18, 0.18),
                    ]);
                }
            }
            var haze = [];
            sphere(haze, 0.2, 60);
            o = o.concat(haze);
            return o;
        },
    };

    /* ── 引擎 ─────────────────────────────────────────────────────────────── */
    function create(canvas, options) {
        var opts = options || {};
        var ctx = canvas.getContext('2d');
        if (!ctx) { return null; }

        var reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var fine = root.matchMedia('(hover: hover) and (pointer: fine)').matches;

        var W = 0, H = 0, DPR = 1;
        var mode = opts.mode || 'cloud';
        var parts = [];
        var target = [];
        var markers = [];
        var yaw = 0.4, pitch = -0.18;
        var yawTarget = yaw, pitchTarget = pitch;
        var dragging = false, lastX = 0, lastY = 0;
        var running = false, raf = 0, t0 = 0;
        var pointer = { x: -1e4, y: -1e4, on: false };
        var focal = 1.6;
        var shapeName = opts.shape || null;
        var markersOn = mode === 'globe';

        function resize() {
            DPR = Math.min(root.devicePixelRatio || 1, 2);
            W = canvas.clientWidth || root.innerWidth;
            H = canvas.clientHeight || root.innerHeight;
            canvas.width = Math.round(W * DPR);
            canvas.height = Math.round(H * DPR);
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            focal = Math.min(W, H) * 0.42;
        }

        function seedGlobe() {
            var total = Math.round(clamp((W * H) / 2200, 1200, 2600));
            var landN = Math.round(total * 0.44);
            var ocean = [];
            sphere(ocean, 1, total - landN);
            var land = landPoints(landN);

            parts = [];
            var push = function (list, isLand) {
                for (var i = 0; i < list.length; i += 1) {
                    var p = list[i];
                    parts.push({
                        x: p[0], y: p[1], z: p[2],
                        tx: p[0], ty: p[1], tz: p[2],
                        s: Math.random(),
                        land: isLand,
                    });
                }
            };
            push(ocean, false);
            push(land, true);
            target = parts.map(function (p) { return [p.tx, p.ty, p.tz]; });
        }

        function seedShape(name) {
            var pts = (shapes[name] || shapes.neural)();
            var n = parts.length || Math.round(clamp((W * H) / 3000, 900, 2000));
            if (!parts.length) {
                parts = [];
                for (var i = 0; i < n; i += 1) {
                    parts.push({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(-0.3, 0.3), tx: 0, ty: 0, tz: 0, s: Math.random() });
                }
            }
            target = [];
            for (var k = 0; k < parts.length; k += 1) {
                target.push(pts[k % pts.length]);
            }
            for (var m = 0; m < parts.length; m += 1) {
                parts[m].tx = target[m][0];
                parts[m].ty = target[m][1];
                parts[m].tz = target[m][2];
            }
        }

        function project(p) {
            var cy = Math.cos(yaw), sy = Math.sin(yaw);
            var cp = Math.cos(pitch), sp = Math.sin(pitch);
            var x = p.x * cy - p.z * sy;
            var z = p.x * sy + p.z * cy;
            var y = p.y * cp - z * sp;
            var z2 = p.y * sp + z * cp;
            var k = focal / (focal * 2.1 - z2 * focal * 0.5);
            var cx = W * (opts.centerX == null ? 0.5 : opts.centerX);
            var cyy = H * (opts.centerY == null ? 0.5 : opts.centerY);
            return { x: cx + x * focal * k * 1.35, y: cyy - y * focal * k * 1.35, z: z2, k: k };
        }

        function drawDots() {
            for (var i = 0; i < parts.length; i += 1) {
                var p = parts[i];
                var q = project(p);
                var depth = clamp((q.z + 1.2) / 2.4, 0, 1);
                var alpha = 0.18 + depth * 0.62;
                var size = 0.7 + depth * 1.5;
                if (mode === 'globe' && p.land) {
                    // 陆地：更亮、偏青绿，边缘的那一圈更实
                    ctx.fillStyle = 'rgba(140, 232, 200, ' + (0.16 + depth * 0.72).toFixed(3) + ')';
                    size += 0.35;
                } else if (mode === 'globe') {
                    ctx.fillStyle = 'rgba(110, 165, 205, ' + (0.06 + depth * 0.34).toFixed(3) + ')';
                } else {
                    ctx.fillStyle = 'rgba(150, 204, 232, ' + alpha.toFixed(3) + ')';
                }
                ctx.fillRect(q.x, q.y, size, size);
            }
        }

        function drawMarkers() {
            for (var i = 0; i < markers.length; i += 1) {
                var m = markers[i];
                var p = {
                    x: Math.cos(m.lat * DEG) * Math.cos(m.lon * DEG),
                    y: Math.sin(m.lat * DEG),
                    z: Math.cos(m.lat * DEG) * Math.sin(m.lon * DEG),
                };
                var q = project(p);
                var front = q.z > 0;
                var r = front ? 3.2 : 1.6;
                ctx.beginPath();
                ctx.arc(q.x, q.y, r, 0, TAU);
                ctx.fillStyle = m.color;
                ctx.globalAlpha = front ? 0.95 : 0.3;
                ctx.fill();
                if (front) {
                    ctx.beginPath();
                    ctx.arc(q.x, q.y, r + 5, 0, TAU);
                    ctx.strokeStyle = m.color;
                    ctx.globalAlpha = 0.35;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
        }

        function frame(now) {
            if (!running) { return; }
            raf = root.requestAnimationFrame(frame);
            var dt = t0 ? Math.min(2.5, (now - t0) / 16.67) : 1;
            t0 = now;

            yaw += (yawTarget - yaw) * 0.06 * dt;
            pitch += (pitchTarget - pitch) * 0.06 * dt;
            if (mode === 'globe' && !dragging && !markers.length) { yawTarget += 0.0016 * dt; }

            for (var i = 0; i < parts.length; i += 1) {
                var p = parts[i];
                p.x += (p.tx - p.x) * 0.06 * dt;
                p.y += (p.ty - p.y) * 0.06 * dt;
                p.z += (p.tz - p.z) * 0.06 * dt;
            }

            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            drawDots();
            if (markersOn && markers.length) { drawMarkers(); }
            ctx.globalCompositeOperation = 'source-over';
        }

        function start() {
            if (running || reduced) { return; }
            running = true;
            t0 = 0;
            raf = root.requestAnimationFrame(frame);
        }
        function stop() {
            running = false;
            if (raf) { root.cancelAnimationFrame(raf); raf = 0; }
        }

        function drawStatic() {
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            drawDots();
            if (markersOn && markers.length) { drawMarkers(); }
            ctx.globalCompositeOperation = 'source-over';
        }

        /* 拖动旋转 */
        if (fine && !reduced) {
            canvas.addEventListener('pointerdown', function (e) {
                dragging = true; lastX = e.clientX; lastY = e.clientY;
                if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
            });
            canvas.addEventListener('pointermove', function (e) {
                if (!dragging) { return; }
                yawTarget += (e.clientX - lastX) * -0.006;
                pitchTarget = clamp(pitchTarget + (e.clientY - lastY) * 0.004, -1.1, 1.1);
                lastX = e.clientX; lastY = e.clientY;
            });
            var end = function () { dragging = false; };
            canvas.addEventListener('pointerup', end);
            canvas.addEventListener('pointercancel', end);
            canvas.addEventListener('pointerleave', end);
        }

        var api = {
            resize: function () {
                resize();
                if (mode === 'globe') { seedGlobe(); }
                else if (shapeName) { seedShape(shapeName); }
                if (reduced) { drawStatic(); }
            },
            setMode: function (next) {
                mode = next;
                markersOn = next === 'globe';
                resize();
                if (next === 'globe') { seedGlobe(); } else if (shapeName) { seedShape(shapeName); }
                if (reduced) { drawStatic(); }
            },
            morph: function (name) {
                shapeName = name;
                seedShape(name);
                if (reduced) { drawStatic(); }
            },
            markers: function (list) {
                markers = list || [];
                if (reduced) { drawStatic(); }
            },
            /* 把某个经纬度转到正面：
               点在球面上的 3D 坐标是 (cosφcosλ, sinφ, cosφsinλ)，
               绕 Y 轴转 ψ 后朝向视线的分量正比于 sin(ψ+λ)，
               所以要让它等于 1，ψ = 90° − λ。 */
            focus: function (lat, lon) {
                yawTarget = (90 - lon) * DEG;
                pitchTarget = clamp(lat * DEG, -1.0, 1.0);
                if (reduced) { yaw = yawTarget; pitch = pitchTarget; drawStatic(); }
            },
            start: start,
            stop: stop
        };

        api.resize();
        if (mode === 'globe') { seedGlobe(); } else if (shapeName) { seedShape(shapeName); }
        if (reduced) { drawStatic(); }

        return api;
    }

    root.CACParticles = { create: create, shapes: shapes };
    /* 陆地轮廓也借给 3D 版地球用（同一份数据，不再复制一遍） */
    root.CACLand = LAND;
}(typeof window !== 'undefined' ? window : null));
