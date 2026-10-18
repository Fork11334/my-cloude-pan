/* ============================================================
 * 长夜便利店 — 核心工具
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';

  const TAU = Math.PI * 2;

  MS.M = {
    TAU: TAU,
    clamp: (v, a, b) => v < a ? a : (v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (v - a) / (b - a),
    smooth: (t) => t * t * (3 - 2 * t),
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    wrapAngle: (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; },
    deg: (d) => d * Math.PI / 180,
    dist2: (x1, z1, x2, z2) => Math.hypot(x2 - x1, z2 - z1),
    pad: (n) => n < 10 ? '0' + n : '' + n
  };

  MS.Ease = {
    inOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    outElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1
  };

  /** Deterministic PRNG (mulberry32) */
  MS.Rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  MS.DOM = {
    $: (sel, root) => (root || document).querySelector(sel),
    $$: (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel)),
    el: (tag, cls, html) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      return e;
    },
    show: (e) => { if (e) e.classList.remove('hidden'); },
    hide: (e) => { if (e) e.classList.add('hidden'); },
    setText: (e, t) => { if (e && e.textContent !== t) e.textContent = t; }
  };

  MS.Storage = {
    KEY: 'MS_NIGHT_SAVE_V1',
    data: null,
    load: function () {
      if (this.data) return this.data;
      let d = null;
      try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { d = null; }
      this.data = Object.assign({
        unlocked: 1,          // highest unlocked night (1..5)
        completed: [],        // night ids completed
        endings: [],          // ending ids
        notes: [],            // note ids collected
        settings: {
          quality: 'medium',  // low | medium | high
          sensitivity: 1.0,
          volume: 0.85,
          voice: true,
          grain: true,
          shake: true
        },
        stats: { shots: 0, fakes: 0, humansSaved: 0, mistakes: 0 },
        seenIntro: false
      }, d || {});
      // nested defaults
      this.data.settings = Object.assign({
        quality: 'auto', sensitivity: 1.0, volume: 0.85, voice: true, grain: true, shake: true
      }, this.data.settings || {});
      this.data.stats = Object.assign({ shots: 0, fakes: 0, humansSaved: 0, mistakes: 0 }, this.data.stats || {});
      return this.data;
    },
    save: function () {
      try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* file:// may deny */ }
    },
    unlockNight: function (n) {
      const d = this.load();
      if (n > d.unlocked) d.unlocked = Math.min(5, n);
      if (d.completed.indexOf(n) < 0) d.completed.push(n);
      this.save();
    },
    addNote: function (id) {
      const d = this.load();
      if (d.notes.indexOf(id) < 0) { d.notes.push(id); this.save(); return true; }
      return false;
    },
    addEnding: function (id) {
      const d = this.load();
      if (d.endings.indexOf(id) < 0) { d.endings.push(id); this.save(); return true; }
      return false;
    },
    reset: function () {
      try { localStorage.removeItem(this.KEY); } catch (e) {}
      this.data = null;
      return this.load();
    }
  };

  MS.clockString = function (minutes) {
    // minutes since 22:00 of the shift. 22:00 + 360 = 04:00
    const total = 22 * 60 + Math.floor(minutes);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return MS.M.pad(h) + ':' + MS.M.pad(m);
  };

  MS.timeToMinutes = function (str) {
    // "22:35" -> minutes since 22:00
    const p = String(str).split(':');
    let h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (h < 6) h += 24;
    return (h - 22) * 60 + m;
  };

  MS.wait = (ms) => new Promise(r => setTimeout(r, ms));
  MS.nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  /** Tiny 2D value-noise for canvas gen */
  MS.valueNoise = function (w, h, cells) {
    const rng = MS.Rng(1337 + cells);
    const cw = Math.max(2, cells | 0), ch = Math.max(2, cells | 0);
    const grid = new Float32Array((cw + 1) * (ch + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const gy = y / h * ch, y0 = Math.floor(gy), ty = gy - y0, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const gx = x / w * cw, x0 = Math.floor(gx), tx = gx - x0, sx = tx * tx * (3 - 2 * tx);
        const a = grid[y0 * (cw + 1) + x0];
        const b = grid[y0 * (cw + 1) + x0 + 1];
        const c = grid[(y0 + 1) * (cw + 1) + x0];
        const d = grid[(y0 + 1) * (cw + 1) + x0 + 1];
        const v1 = a + (b - a) * sx, v2 = c + (d - c) * sx;
        out[y * w + x] = v1 + (v2 - v1) * sy;
      }
    }
    return out;
  };

  /** Add a pixel-level noise wash */
  MS.noiseCanvas = function (ctx, w, h, amount, alpha) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const a = alpha == null ? 1 : alpha;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount * a;
      d[i] = MS.M.clamp(d[i] + n, 0, 255);
      d[i + 1] = MS.M.clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = MS.M.clamp(d[i + 2] + n, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
  };

  MS.formatMoney = (v) => '¥' + Number(v).toFixed(2);
  MS.now = () => performance.now();

  // FPS meter
  MS.FpsMeter = function () {
    return {
      last: performance.now(), acc: 0, frames: 0, fps: 60,
      tick: function (now) {
        this.acc += now - this.last; this.last = now; this.frames++;
        if (this.acc >= 500) { this.fps = Math.round(this.frames * 1000 / this.acc); this.acc = 0; this.frames = 0; }
        return this.fps;
      }
    };
  };
})(window.MS);
