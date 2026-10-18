/* ==========================================================================
   全站可交互背景引擎（原生 canvas，零依赖）
   九个模式共用一套粒子/连线/涟漪内核，每个模式只定义「怎么动、怎么画」：
     signal 星座连线   strata 沉积流线   axis  三轴光柱
     neural 神经网     cell   细胞图     thought 思维螺旋
     paper  纸纤维     radar  雷达扫掠   rings 同心脉冲

   规矩不变：reduced-motion 只画一帧；切后台停；DPR 封顶 2；
   指针交互只在 (hover:hover) and (pointer:fine) 上挂。
   ========================================================================== */
(function (root) {
    'use strict';

    var TAU = Math.PI * 2;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    /* 每个模式：init(w,h,ctx) 生成状态；update(s,dt,t,w,h,ptr)；draw(s,ctx,t,w,h) */
    var MODES = {
        signal: {
            init: function (w, h) {
                var n = Math.round(clamp((w * h) / 9000, 90, 190));
                var ps = [];
                for (var i = 0; i < n; i += 1) {
                    ps.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.14, 0.14), vy: rnd(-0.1, 0.1), r: rnd(0.8, 2.3) });
                }
                return { ps: ps };
            },
            update: function (s, dt, t, w, h, ptr) {
                for (var i = 0; i < s.ps.length; i += 1) {
                    var p = s.ps[i];
                    p.x += p.vx * dt; p.y += p.vy * dt;
                    if (ptr.on) {
                        var dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
                        if (d2 < 200 * 200 && d2 > 1) {
                            var d = Math.sqrt(d2), f = (1 - d / 200) * 0.5;
                            p.x += (dx / d) * f * dt; p.y += (dy / d) * f * dt;
                        }
                    }
                    if (p.x < -20) { p.x = w + 20; } if (p.x > w + 20) { p.x = -20; }
                    if (p.y < -20) { p.y = h + 20; } if (p.y > h + 20) { p.y = -20; }
                }
            },
            draw: function (s, ctx, t, w, h) {
                var max = 132 * 132;
                for (var i = 0; i < s.ps.length; i += 1) {
                    var a = s.ps[i];
                    for (var j = i + 1; j < s.ps.length; j += 1) {
                        var b = s.ps[j];
                        var dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                        if (d2 > max) { continue; }
                        var k = 1 - d2 / max;
                        ctx.strokeStyle = 'rgba(120, 186, 224, ' + (k * 0.22).toFixed(3) + ')';
                        ctx.lineWidth = 0.6;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                for (var p = 0; p < s.ps.length; p += 1) {
                    var q = s.ps[p];
                    ctx.fillStyle = 'rgba(170, 220, 245, .75)';
                    ctx.fillRect(q.x, q.y, q.r, q.r);
                }
            },
        },

        strata: {
            init: function (w, h) {
                var rows = [];
                var n = Math.round(clamp(h / 9, 60, 130));
                for (var i = 0; i < n; i += 1) {
                    rows.push({ y: (i / n) * h, len: rnd(60, 260), off: rnd(0, w), speed: rnd(8, 34), a: rnd(0.05, 0.22) });
                }
                return { rows: rows };
            },
            update: function (s, dt, t, w, h, ptr) {
                for (var i = 0; i < s.rows.length; i += 1) {
                    s.rows[i].off = (s.rows[i].off - s.rows[i].speed * dt) % (w + 300);
                    if (s.rows[i].off < -300) { s.rows[i].off = w + 200; }
                }
            },
            draw: function (s, ctx, t, w, h) {
                for (var i = 0; i < s.rows.length; i += 1) {
                    var r = s.rows[i];
                    var x = r.off < 0 ? r.off : r.off - 300;
                    ctx.strokeStyle = 'rgba(150, 200, 230, ' + r.a.toFixed(3) + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, r.y);
                    ctx.lineTo(x + r.len, r.y);
                    ctx.stroke();
                }
            },
        },

        axis: {
            init: function (w, h) {
                var ps = [];
                var n = Math.round(clamp((w * h) / 14000, 60, 130));
                for (var i = 0; i < n; i += 1) {
                    ps.push({ base: rnd(0, h), rad: rnd(8, 70), ang: rnd(0, TAU), sp: rnd(0.2, 0.8), col: i % 3 });
                }
                return { ps: ps };
            },
            update: function (s, dt, t) {
                for (var i = 0; i < s.ps.length; i += 1) { s.ps[i].ang += s.ps[i].sp * 0.006 * dt; }
            },
            draw: function (s, ctx, t, w, h) {
                var cols = ['rgba(79,163,201,', 'rgba(163,119,207,', 'rgba(111,207,151,'];
                for (var c = 0; c < 3; c += 1) {
                    var x = w * (0.25 + c * 0.25);
                    ctx.strokeStyle = 'rgba(255,255,255,.10)';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                }
                for (var i = 0; i < s.ps.length; i += 1) {
                    var p = s.ps[i];
                    var x = w * (0.25 + p.col * 0.25) + Math.cos(p.ang) * p.rad;
                    var y = p.base + Math.sin(p.ang) * p.rad * 0.6;
                    ctx.fillStyle = cols[p.col] + '.55)';
                    ctx.fillRect(x, y, 1.8, 1.8);
                }
            },
        },

        neural: {
            init: function (w, h) {
                var nodes = [];
                var n = Math.round(clamp((w * h) / 26000, 22, 46));
                for (var i = 0; i < n; i += 1) {
                    nodes.push({ x: rnd(40, w - 40), y: rnd(40, h - 40), vx: rnd(-0.06, 0.06), vy: rnd(-0.05, 0.05), r: rnd(1.6, 3.4) });
                }
                var edges = [];
                for (var k = 0; k < nodes.length; k += 1) {
                    for (var m = k + 1; m < nodes.length; m += 1) {
                        var dx = nodes[k].x - nodes[m].x, dy = nodes[k].y - nodes[m].y;
                        if (dx * dx + dy * dy < 210 * 210 && Math.random() < 0.5) { edges.push({ a: k, b: m, ph: rnd(0, 1) }); }
                    }
                }
                return { nodes: nodes, edges: edges };
            },
            update: function (s, dt, t, w, h, ptr) {
                for (var i = 0; i < s.nodes.length; i += 1) {
                    var n = s.nodes[i];
                    n.x += n.vx * dt; n.y += n.vy * dt;
                    if (ptr.on) {
                        var dx = n.x - ptr.x, dy = n.y - ptr.y, d2 = dx * dx + dy * dy;
                        if (d2 < 240 * 240 && d2 > 1) {
                            var d = Math.sqrt(d2), f = (1 - d / 240) * 0.7;
                            n.x += (dx / d) * f * dt; n.y += (dy / d) * f * dt;
                        }
                    }
                    if (n.x < 20) { n.x = 20; n.vx = Math.abs(n.vx); }
                    if (n.x > w - 20) { n.x = w - 20; n.vx = -Math.abs(n.vx); }
                    if (n.y < 20) { n.y = 20; n.vy = Math.abs(n.vy); }
                    if (n.y > h - 20) { n.y = h - 20; n.vy = -Math.abs(n.vy); }
                }
            },
            draw: function (s, ctx, t, w, h) {
                for (var e = 0; e < s.edges.length; e += 1) {
                    var ed = s.edges[e], a = s.nodes[ed.a], b = s.nodes[ed.b];
                    ctx.strokeStyle = 'rgba(140, 190, 225, .13)';
                    ctx.lineWidth = 0.8;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

                    var pr = ((t * 0.00018 + ed.ph) % 1);
                    ctx.fillStyle = 'rgba(190, 230, 255, .55)';
                    ctx.beginPath();
                    ctx.arc(a.x + (b.x - a.x) * pr, a.y + (b.y - a.y) * pr, 1.6, 0, TAU);
                    ctx.fill();
                }
                for (var i = 0; i < s.nodes.length; i += 1) {
                    var n = s.nodes[i];
                    ctx.fillStyle = 'rgba(175, 220, 245, .8)';
                    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.fill();
                }
            },
        },

        cell: {
            init: function (w, h) {
                var rings = [];
                for (var i = 0; i < 4; i += 1) {
                    rings.push({ r: 0.18 + i * 0.16, sp: (i % 2 ? -1 : 1) * rnd(0.05, 0.13), n: 90 + i * 30 });
                }
                var org = [];
                for (var k = 0; k < 26; k += 1) {
                    org.push({ ang: rnd(0, TAU), rad: rnd(0.3, 0.85), sp: rnd(0.1, 0.4), r: rnd(1.2, 3) });
                }
                return { rings: rings, org: org };
            },
            update: function (s, dt) {
                for (var i = 0; i < s.rings.length; i += 1) { s.rings[i].r += 0; }
                for (var k = 0; k < s.org.length; k += 1) { s.org[k].ang += s.org[k].sp * 0.01 * dt; }
            },
            draw: function (s, ctx, t, w, h) {
                var cx = w * 0.5, cy = h * 0.5;
                var base = Math.min(w, h) * 0.46;
                for (var i = 0; i < s.rings.length; i += 1) {
                    var ring = s.rings[i];
                    var r = ring.r * base * (1 + Math.sin(t * 0.0004 + i) * 0.02);
                    var step = TAU / ring.n;
                    for (var a = 0; a < TAU; a += step) {
                        ctx.fillStyle = 'rgba(150, 205, 225, ' + (0.10 + i * 0.03).toFixed(3) + ')';
                        ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86, 1.4, 1.4);
                    }
                }
                for (var k = 0; k < s.org.length; k += 1) {
                    var o = s.org[k];
                    var x = cx + Math.cos(o.ang) * o.rad * base * 0.8;
                    var y = cy + Math.sin(o.ang) * o.rad * base * 0.66;
                    ctx.fillStyle = 'rgba(190, 160, 235, .55)';
                    ctx.beginPath(); ctx.arc(x, y, o.r, 0, TAU); ctx.fill();
                }
                ctx.fillStyle = 'rgba(120, 180, 220, .16)';
                ctx.beginPath(); ctx.arc(cx, cy, base * 0.24, 0, TAU); ctx.fill();
            },
        },

        thought: {
            init: function (w, h) {
                var ps = [];
                var n = Math.round(clamp((w * h) / 12000, 120, 260));
                for (var i = 0; i < n; i += 1) {
                    ps.push({ arm: i % 5, t: Math.random(), sp: rnd(0.4, 1.1), j: rnd(-0.05, 0.05) });
                }
                return { ps: ps, rot: 0 };
            },
            update: function (s, dt) { s.rot += 0.00018 * dt; },
            draw: function (s, ctx, t, w, h) {
                var cx = w * 0.5, cy = h * 0.5;
                var base = Math.min(w, h) * 0.5;
                for (var i = 0; i < s.ps.length; i += 1) {
                    var p = s.ps[i];
                    var a = s.rot + p.arm * (TAU / 5) + p.t * 3.2;
                    var r = (0.08 + p.t * 0.92) * base;
                    var x = cx + Math.cos(a) * r;
                    var y = cy + Math.sin(a) * r * 0.9 + p.j * base;
                    var alpha = 0.10 + p.t * 0.45;
                    ctx.fillStyle = 'rgba(170, 200, 245, ' + alpha.toFixed(3) + ')';
                    ctx.fillRect(x, y, 1.7, 1.7);
                }
            },
        },

        paper: {
            init: function (w, h) {
                var ps = [];
                var n = Math.round(clamp((w * h) / 11000, 90, 180));
                for (var i = 0; i < n; i += 1) {
                    ps.push({ x: rnd(0, w), y: rnd(0, h), len: rnd(18, 70), sp: rnd(0.06, 0.24), a: rnd(0.05, 0.2) });
                }
                return { ps: ps };
            },
            update: function (s, dt, t, w, h, ptr) {
                for (var i = 0; i < s.ps.length; i += 1) {
                    var p = s.ps[i];
                    p.y -= p.sp * dt;
                    if (p.y < -80) { p.y = h + 40; p.x = rnd(0, w); }
                    if (ptr.on) {
                        var dx = p.x - ptr.x;
                        if (Math.abs(dx) < 160) { p.x += Math.sign(dx) * 0.4 * (1 - Math.abs(dx) / 160) * dt; }
                    }
                }
            },
            draw: function (s, ctx) {
                for (var i = 0; i < s.ps.length; i += 1) {
                    var p = s.ps[i];
                    ctx.strokeStyle = 'rgba(200, 210, 225, ' + p.a.toFixed(3) + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
                }
            },
        },

        radar: {
            init: function (w, h) {
                var contacts = [];
                for (var i = 0; i < 14; i += 1) {
                    contacts.push({ ang: rnd(0, TAU), rad: rnd(0.15, 0.9), ph: rnd(0, 1), speed: rnd(0.05, 0.16), r: rnd(1.2, 2.6) });
                }
                return { contacts: contacts, sweep: 0 };
            },
            update: function (s, dt) {
                s.sweep = (s.sweep + 0.004 * dt) % 1;
                for (var i = 0; i < s.contacts.length; i += 1) { s.contacts[i].ang += s.contacts[i].speed * 0.004 * dt; }
            },
            draw: function (s, ctx, t, w, h) {
                var cx = w * 0.5, cy = h * 0.5;
                var R = Math.min(w, h) * 0.46;
                for (var r = 1; r <= 4; r += 1) {
                    ctx.strokeStyle = 'rgba(120, 200, 180, .10)';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(cx, cy, (R * r) / 4, 0, TAU); ctx.stroke();
                }
                for (var a = 0; a < 8; a += 1) {
                    var ang = (a / 8) * TAU;
                    ctx.strokeStyle = 'rgba(120, 200, 180, .07)';
                    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); ctx.stroke();
                }
                var sa = s.sweep * TAU;
                var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
                grad.addColorStop(0, 'rgba(120, 220, 180, .16)');
                grad.addColorStop(1, 'rgba(120, 220, 180, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, R, sa - 0.5, sa);
                ctx.closePath();
                ctx.fill();
                for (var i = 0; i < s.contacts.length; i += 1) {
                    var c = s.contacts[i];
                    var d = Math.abs(((c.ang - sa) % TAU + TAU) % TAU);
                    var glow = d < 0.6 ? (1 - d / 0.6) : 0.12;
                    var x = cx + Math.cos(c.ang) * c.rad * R;
                    var y = cy + Math.sin(c.ang) * c.rad * R;
                    ctx.fillStyle = 'rgba(150, 240, 200, ' + (0.2 + glow * 0.75).toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(x, y, c.r + glow * 1.6, 0, TAU); ctx.fill();
                }
            },
        },

        rings: {
            init: function () { return { pulses: [], t0: 0 }; },
            update: function (s, dt, t) {
                if (t - s.t0 > 2600) { s.t0 = t; s.pulses.push({ r: 0, a: 0.5 }); }
                for (var i = s.pulses.length - 1; i >= 0; i -= 1) {
                    s.pulses[i].r += 1.6 * dt;
                    s.pulses[i].a -= 0.0022 * dt;
                    if (s.pulses[i].a <= 0) { s.pulses.splice(i, 1); }
                }
            },
            draw: function (s, ctx, t, w, h) {
                var cx = w * 0.5, cy = h * 0.48;
                var R = Math.min(w, h) * 0.46;
                for (var i = 1; i <= 6; i += 1) {
                    ctx.strokeStyle = 'rgba(160, 200, 240, ' + (0.05 + (i % 2) * 0.03).toFixed(3) + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 6, 0, TAU); ctx.stroke();
                }
                for (var p = 0; p < s.pulses.length; p += 1) {
                    var r = s.pulses[p].r;
                    ctx.strokeStyle = 'rgba(190, 220, 255, ' + Math.max(0, s.pulses[p].a).toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(cx, cy, r % (R * 1.1), 0, TAU); ctx.stroke();
                }
            },
        },
    };

    function create(canvas, options) {
        var opts = options || {};
        var ctx = canvas.getContext('2d');
        if (!ctx) { return null; }

        var reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var fine = root.matchMedia('(hover: hover) and (pointer: fine)').matches;
        var mode = MODES[opts.mode] ? opts.mode : 'signal';

        var W = 0, H = 0, DPR = 1;
        var state = null;
        var running = false, raf = 0, t0 = 0;
        var pointer = { x: -1e4, y: -1e4, on: false };
        var bursts = [];

        function resize() {
            DPR = Math.min(root.devicePixelRatio || 1, 2);
            W = canvas.clientWidth || root.innerWidth;
            H = canvas.clientHeight || root.innerHeight;
            canvas.width = Math.round(W * DPR);
            canvas.height = Math.round(H * DPR);
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            state = MODES[mode].init(W, H);
        }

        function drawBursts(dt) {
            for (var i = bursts.length - 1; i >= 0; i -= 1) {
                var b = bursts[i];
                b.r += 2.4 * dt; b.a -= 0.012 * dt;
                if (b.a <= 0) { bursts.splice(i, 1); continue; }
                ctx.strokeStyle = 'rgba(190, 225, 255, ' + Math.max(0, b.a).toFixed(3) + ')';
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
            }
        }

        function frame(now) {
            if (!running) { return; }
            raf = root.requestAnimationFrame(frame);
            var dt = t0 ? Math.min(2.5, (now - t0) / 16.67) : 1;
            t0 = now;
            var m = MODES[mode];
            m.update(state, dt, now, W, H, pointer);
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            m.draw(state, ctx, now, W, H);
            ctx.globalCompositeOperation = 'source-over';
            drawBursts(dt);
        }

        function drawStatic() {
            var m = MODES[mode];
            if (!state) { return; }
            m.update(state, 0, 0, W, H, pointer);
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            m.draw(state, ctx, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
        }

        function start() {
            if (running || reduced) { return; }
            running = true; t0 = 0;
            raf = root.requestAnimationFrame(frame);
        }
        function stop() {
            running = false;
            if (raf) { root.cancelAnimationFrame(raf); raf = 0; }
        }

        if (fine && !reduced) {
            canvas.addEventListener('pointermove', function (e) {
                var r = canvas.getBoundingClientRect();
                pointer.x = e.clientX - r.left;
                pointer.y = e.clientY - r.top;
                pointer.on = true;
            }, { passive: true });
            canvas.addEventListener('pointerleave', function () {
                pointer.on = false; pointer.x = -1e4; pointer.y = -1e4;
            }, { passive: true });
            canvas.addEventListener('pointerdown', function (e) {
                var r = canvas.getBoundingClientRect();
                bursts.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 4, a: 0.55 });
            }, { passive: true });
        }

        resize();
        if (reduced) { drawStatic(); }

        var api = {
            start: start,
            stop: stop,
            resize: function () { resize(); if (reduced) { drawStatic(); } },
            mode: function (next) {
                if (!MODES[next] || next === mode) { return; }
                mode = next; resize();
                if (reduced) { drawStatic(); }
            },
        };

        if ('IntersectionObserver' in root) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) { if (entry.isIntersecting) { start(); } else { stop(); } });
            }, { rootMargin: '160px' });
            io.observe(canvas);
        } else {
            start();
        }
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stop(); } else { start(); }
        });

        return api;
    }

    root.CACBg = { create: create, modes: Object.keys(MODES) };
}(typeof window !== 'undefined' ? window : null));
