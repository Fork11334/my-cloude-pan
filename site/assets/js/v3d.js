/* ==========================================================================
   真 3D 地球（Three.js，运行时从 CDN 动态 import）
   为什么这样放：GitHub Pages 只有静态文件，没有构建步骤也能跑；
   加载失败（离线 / CDN 被墙）时静默返回 null，页面继续用原来的 2D 点云地球。

   只用 three 核心，不用 addons —— 旋转是自己写的 yaw/pitch，少一个依赖少一处风险。
   ========================================================================== */
(function (root) {
    'use strict';

    var stage = document.querySelector('[data-globe3d]');
    if (!stage) { return; }

    var reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = root.innerWidth < 760;
    /* 手机与减少动效都不上 3D：交给 2D 点云，省的发热 */
    if (reduced || narrow) { return; }

    var CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

    root.CACGlobe3D = import(CDN)
        .then(function (THREE) { return build(THREE); })
        .catch(function () { return null; });

    function build(THREE) {
        var W = stage.clientWidth || root.innerWidth;
        var H = stage.clientHeight || root.innerHeight;

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
        renderer.setSize(W, H);
        stage.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
        camera.position.set(0, 0.35, 3.5);

        var group = new THREE.Group();
        /* 地球放在视口右侧 2/3 处，左边留给列表 */
        group.position.x = 0.55;
        scene.add(group);

        /* ── 地表贴图：用同一份陆地轮廓画一张等距圆柱投影 ────────────── */
        function earthTexture() {
            var w = 2048;
            var h = 1024;
            var cv = document.createElement('canvas');
            cv.width = w;
            cv.height = h;
            var g = cv.getContext('2d');

            g.fillStyle = '#06121a';
            g.fillRect(0, 0, w, h);

            // 经纬网
            g.strokeStyle = 'rgba(120, 190, 220, .10)';
            g.lineWidth = 1;
            for (var lon = -180; lon <= 180; lon += 30) {
                var x = ((lon + 180) / 360) * w;
                g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
            }
            for (var lat = -60; lat <= 60; lat += 30) {
                var y = ((90 - lat) / 180) * h;
                g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
            }

            var land = root.CACLand || [];
            var project = function (p) {
                return [((p[0] + 180) / 360) * w, ((90 - p[1]) / 180) * h];
            };

            for (var i = 0; i < land.length; i += 1) {
                var poly = land[i];
                if (!poly || !poly.length) { continue; }
                g.beginPath();
                var first = project(poly[0]);
                g.moveTo(first[0], first[1]);
                for (var k = 1; k < poly.length; k += 1) {
                    var pt = project(poly[k]);
                    g.lineTo(pt[0], pt[1]);
                }
                g.closePath();
                g.fillStyle = 'rgba(28, 92, 78, .55)';
                g.fill();
                g.strokeStyle = 'rgba(122, 226, 190, .75)';
                g.lineWidth = 3;
                g.stroke();
            }

            var tex = new THREE.CanvasTexture(cv);
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        }

        /* 五大洋的名字直接画进贴图：球面上写文字比在 3D 里摆标签稳 */
        function paintOceans() {
            var cv = document.createElement('canvas');
            cv.width = 2048;
            cv.height = 1024;
            var g = cv.getContext('2d');
            g.clearRect(0, 0, cv.width, cv.height);
            g.font = '600 30px "Microsoft YaHei", "PingFang SC", sans-serif';
            g.fillStyle = 'rgba(138, 208, 240, .42)';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            [
                ['太平洋', -150, 8], ['太平洋', 170, 28],
                ['大西洋', -28, 26], ['印度洋', 78, -22],
                ['北冰洋', 10, 80], ['南大洋', 20, -62],
            ].forEach(function (o) {
                var x = ((o[1] + 180) / 360) * cv.width;
                var y = ((90 - o[2]) / 180) * cv.height;
                g.fillText(o[0], x, y);
            });
            return new THREE.CanvasTexture(cv);
        }

        var earth = new THREE.Mesh(
            new THREE.SphereGeometry(1, 96, 96),
            new THREE.MeshBasicMaterial({ map: earthTexture() }),
        );
        group.add(earth);

        /* 海名单独一层，免得被陆地描边盖住 */
        var ocean = new THREE.Mesh(
            new THREE.SphereGeometry(1.001, 96, 96),
            new THREE.MeshBasicMaterial({ map: paintOceans(), transparent: true, depthWrite: false }),
        );
        group.add(ocean);

        /* 大气层：比地球大一圈的背面球，叠一层很淡的蓝 */
        var halo = new THREE.Mesh(
            new THREE.SphereGeometry(1.055, 64, 64),
            new THREE.MeshBasicMaterial({
                color: 0x2f7fb0,
                transparent: true,
                opacity: 0.16,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
            }),
        );
        scene.add(halo);

        /* ── 设施标记：小球 + 光晕 ───────────────────────────────────── */
        var markers = [];
        var glowTex = (function () {
            var cv = document.createElement('canvas');
            cv.width = 64; cv.height = 64;
            var g = cv.getContext('2d');
            var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, 'rgba(255,255,255,0.85)');
            grad.addColorStop(0.4, 'rgba(255,255,255,0.28)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(cv);
        }());

        function toVec(lat, lon, r) {
            var p = (lat * Math.PI) / 180;
            var l = (lon * Math.PI) / 180;
            return new THREE.Vector3(
                Math.cos(p) * Math.cos(l) * r,
                Math.sin(p) * r,
                Math.cos(p) * Math.sin(l) * r,
            );
        }

        function addMarker(lat, lon, color, id) {
            var pos = toVec(lat, lon, 1.008);
            var dot = new THREE.Mesh(
                new THREE.SphereGeometry(0.018, 12, 12),
                new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }),
            );
            dot.position.copy(pos);
            group.add(dot);

            var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTex,
                color: new THREE.Color(color),
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            }));
            sprite.position.copy(pos);
            sprite.scale.set(0.16, 0.16, 1);
            group.add(sprite);

            markers.push({ id: id, dot: dot, sprite: sprite, pos: pos, color: color });
        }

        var nodes = [].slice.call(document.querySelectorAll('[data-fac]'));
        nodes.forEach(function (el) {
            addMarker(
                Number(el.getAttribute('data-lat')),
                Number(el.getAttribute('data-lon')),
                el.getAttribute('data-color') || '#8b949e',
                el.getAttribute('data-fac'),
            );
        });

        /* ── 旋转：自己的 yaw/pitch，拖拽 + 自动慢转 ─────────────────── */
        var yaw = 0.4;
        var pitch = -0.18;
        var yawTarget = yaw;
        var pitchTarget = pitch;
        var dragging = false;
        var lastX = 0;
        var lastY = 0;
        var auto = true;

        var el = renderer.domElement;
        el.style.cursor = 'grab';
        el.addEventListener('pointerdown', function (e) {
            dragging = true;
            auto = false;
            lastX = e.clientX;
            lastY = e.clientY;
            el.style.cursor = 'grabbing';
            if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
        });
        el.addEventListener('pointermove', function (e) {
            if (!dragging) { return; }
            yawTarget += (e.clientX - lastX) * 0.005;
            pitchTarget = Math.max(-1.1, Math.min(1.1, pitchTarget + (e.clientY - lastY) * 0.004));
            lastX = e.clientX;
            lastY = e.clientY;
        });
        var endDrag = function () {
            dragging = false;
            el.style.cursor = 'grab';
            setTimeout(function () { auto = true; }, 2600);
        };
        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);
        el.addEventListener('pointerleave', endDrag);

        function focus(lat, lon) {
            /* 让该点转到正面：绕 Y 轴 ψ = 90° − λ */
            yawTarget = ((90 - lon) * Math.PI) / 180;
            pitchTarget = Math.max(-1.0, Math.min(1.0, (lat * Math.PI) / 180));
            auto = false;
            setTimeout(function () { auto = true; }, 4200);
        }

        function resize() {
            var w = stage.clientWidth || root.innerWidth;
            var h = stage.clientHeight || root.innerHeight;
            if (!w || !h) { return; }
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

        var running = true;
        var raf = 0;
        var last = 0;

        function frame(now) {
            if (!running) { return; }
            raf = root.requestAnimationFrame(frame);
            var dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
            last = now;

            if (auto && !dragging) { yawTarget += 0.0012 * dt; }
            yaw += (yawTarget - yaw) * 0.055 * dt;
            pitch += (pitchTarget - pitch) * 0.055 * dt;

            group.rotation.y = yaw;
            group.rotation.x = pitch;

            /* 标记在背面时淡出，别糊在球面上 */
            for (var i = 0; i < markers.length; i += 1) {
                var m = markers[i];
                var world = m.pos.clone().applyEuler(group.rotation);
                var front = Math.max(0, world.z / m.pos.length());
                m.sprite.material.opacity = 0.12 + front * 0.8;
                m.dot.material.opacity = 1;
                m.sprite.scale.setScalar(0.12 + front * 0.08);
            }

            renderer.render(scene, camera);
        }

        root.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                running = false;
                if (raf) { root.cancelAnimationFrame(raf); raf = 0; }
            } else if (!running) {
                running = true;
                last = 0;
                raf = root.requestAnimationFrame(frame);
            }
        });

        raf = root.requestAnimationFrame(frame);

        return { focus: focus, ready: true };
    }
}(typeof window !== 'undefined' ? window : null));
