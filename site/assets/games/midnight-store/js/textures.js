/* ============================================================
 * 长夜便利店 — 程序化材质 / 贴图
 * 所有图像在本地用 Canvas 生成，双击 file:// 打开也能正常工作。
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const M = MS.M;
  const CN_FONT = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif';
  const SERIF_FONT = '"Songti SC","SimSun","Noto Serif SC",serif';
  const T = {};
  T.cache = {};
  T.ready = false;
  T.faces = {};       // key -> HTMLImageElement
  T.faceTextures = {}; // key -> THREE.Texture

  const ANISO = 4;

  function cnv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function ctx(c) { return c.getContext('2d'); }

  function mkTex(canvas, opts) {
    opts = opts || {};
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (opts.linear) t.encoding = THREE.LinearEncoding; else t.encoding = THREE.sRGBEncoding;
    t.anisotropy = ANISO;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    t.needsUpdate = true;
    return t;
  }
  T.mkTex = mkTex;
  T.cnv = cnv;

  function noiseFill(c, w, h, amount, alpha) {
    const g = ctx(c);
    MS.noiseCanvas(g, w, h, amount, alpha == null ? 1 : alpha);
  }

  function b64ToImage(b64, mime) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = 'data:' + (mime || 'image/jpeg') + ';base64,' + b64;
    });
  }

  T.initFaces = async function () {
    if (T.faces.human) return T.faces;
    const A = MS.ASSETS;
    const keys = [['human', 'faceHuman'], ['humanB', 'faceHumanB'], ['fake', 'faceFake']];
    for (const [k, ak] of keys) {
      T.faces[k] = await b64ToImage(A[ak], 'image/jpeg');
    }
    // head color maps as textures (only when a head is actually built)
    for (const k of Object.keys(T.faces)) {
      const t = new THREE.Texture(T.faces[k]);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = ANISO;
      t.needsUpdate = true;
      T.faceTextures[k] = t;
    }
    return T.faces;
  };

  /* ---------------- floor ---------------- */
  T.floor = function () {
    if (T.cache.floor) return T.cache.floor;
    const W = 1024, H = 1024;
    const c = cnv(W, H), g = ctx(c);
    const tile = W / 4; // 4x4 tiles, texture covers 2m
    g.fillStyle = '#8e8a7e'; g.fillRect(0, 0, W, H);
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const x = tx * tile, y = ty * tile;
        const v = 158 + Math.random() * 22;
        g.fillStyle = `rgb(${v},${v - 4},${v - 13})`;
        g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        // terrazzo speckles
        for (let i = 0; i < 520; i++) {
          const sx = x + 4 + Math.random() * (tile - 8);
          const sy = y + 4 + Math.random() * (tile - 8);
          const r = Math.random() * 2.4 + 0.3;
          const shade = Math.random() < 0.5 ? 92 : 202;
          g.fillStyle = `rgba(${shade},${shade - 4},${shade - 12},${Math.random() * 0.55 + 0.08})`;
          g.beginPath(); g.arc(sx, sy, r, 0, 6.283); g.fill();
        }
        // grout grooves
        g.strokeStyle = 'rgba(58,54,47,0.55)';
        g.lineWidth = 3;
        g.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
        // corner dirt
        const grad = g.createRadialGradient(x + tile / 2, y + tile / 2, tile * 0.15, x + tile / 2, y + tile / 2, tile * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(48,42,34,0.16)');
        g.fillStyle = grad; g.fillRect(x, y, tile, tile);
      }
    }
    // scuffs & scratches
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      g.strokeStyle = `rgba(${40 + Math.random() * 40},${38 + Math.random() * 30},${30 + Math.random() * 30},${Math.random() * 0.25})`;
      g.lineWidth = Math.random() * 2 + 0.4;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 60);
      g.stroke();
    }
    // grime along grid + a few stains
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 110;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, `rgba(54,46,34,${0.03 + Math.random() * 0.10})`);
      gr.addColorStop(1, 'rgba(54,46,34,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // mop streaks (subtle)
    for (let i = 0; i < 7; i++) {
      const y = Math.random() * H;
      g.fillStyle = `rgba(190,195,185,${0.02 + Math.random() * 0.04})`;
      g.beginPath(); g.ellipse(W * Math.random(), y, 60 + Math.random() * 180, 8 + Math.random() * 18, Math.random() * 0.4, 0, 6.283); g.fill();
    }
    noiseFill(c, W, H, 18, 0.55);

    // roughness: wet mop patches are smoother
    const rc = cnv(512, 512), rg = ctx(rc);
    rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 32; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 130;
      const gr = rg.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(32,32,32,0.55)');
      gr.addColorStop(1, 'rgba(32,32,32,0)');
      rg.fillStyle = gr; rg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 4; i++) { // grout lines
      rg.fillStyle = 'rgba(210,210,210,0.7)';
      rg.fillRect(Math.floor(i * 128), 0, 3, 512);
      rg.fillRect(0, Math.floor(i * 128), 512, 3);
    }
    noiseFill(rc, 512, 512, 30, 0.5);

    // height -> normal
    const hc = cnv(512, 512), hg = ctx(hc);
    hg.fillStyle = '#808080'; hg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) {
      hg.fillStyle = '#3a3a3a';
      hg.fillRect(Math.floor(i * 128) - 2, 0, 6, 512);
      hg.fillRect(0, Math.floor(i * 128) - 2, 512, 6);
    }
    for (let i = 0; i < 2200; i++) {
      hg.fillStyle = `rgba(${Math.random() < 0.5 ? 30 : 210},${Math.random() < 0.5 ? 30 : 210},${Math.random() < 0.5 ? 30 : 210},0.18)`;
      hg.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const normal = normalFromHeight(hc, 2.0);

    const res = {
      map: mkTex(c, { repeat: [1, 1] }),
      rough: mkTex(rc, { linear: true }),
      normal: normal
    };
    T.cache.floor = res;
    return res;
  };

  /* ---------------- wall ---------------- */
  T.wall = function () {
    if (T.cache.wall) return T.cache.wall;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#b9b6a9'; g.fillRect(0, 0, W, H);
    // roller stipple
    for (let i = 0; i < 9000; i++) {
      const a = Math.random() * 0.08;
      g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,245,${a})` : `rgba(90,86,74,${a})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // yellowing top
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(126,112,72,0.13)');
    gr.addColorStop(0.25, 'rgba(126,112,72,0.03)');
    gr.addColorStop(1, 'rgba(30,26,20,0.18)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // stains
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * W, y = Math.random() * H * 0.5, r = 20 + Math.random() * 70;
      const s = g.createRadialGradient(x, y, 2, x, y, r);
      s.addColorStop(0, 'rgba(120,96,58,0.10)');
      s.addColorStop(0.7, 'rgba(120,96,58,0.04)');
      s.addColorStop(1, 'rgba(120,96,58,0)');
      g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // scuffs near bottom
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(54,50,44,${Math.random() * 0.18})`;
      g.lineWidth = 1 + Math.random() * 2;
      const x = Math.random() * W, y = H * 0.72 + Math.random() * H * 0.28;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 18); g.stroke();
    }
    noiseFill(c, W, H, 10, 0.5);

    const rc = cnv(256, 256), rg = ctx(rc);
    rg.fillStyle = '#d0d0d0'; rg.fillRect(0, 0, 256, 256);
    noiseFill(rc, 256, 256, 26, 0.6);

    const res = { map: mkTex(c), rough: mkTex(rc, { linear: true }) };
    T.cache.wall = res;
    return res;
  };

  /* ---------------- ceiling ---------------- */
  T.ceiling = function () {
    if (T.cache.ceiling) return T.cache.ceiling;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#c3c3ba'; g.fillRect(0, 0, W, H);
    const tile = 128;
    for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
      const x = tx * tile, y = ty * tile;
      g.fillStyle = 'rgba(255,255,250,0.03)';
      g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      for (let i = 0; i < 34; i++) {
        g.fillStyle = 'rgba(120,118,108,0.16)';
        g.beginPath(); g.arc(x + 6 + Math.random() * (tile - 12), y + 6 + Math.random() * (tile - 12), 0.8 + Math.random() * 1.2, 0, 6.283); g.fill();
      }
      g.strokeStyle = 'rgba(92,90,82,0.55)';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      if (Math.random() < 0.12) {
        const s = g.createRadialGradient(x + tile / 2, y + tile / 2, 2, x + tile / 2, y + tile / 2, tile * 0.6);
        s.addColorStop(0, 'rgba(142,116,64,0.12)');
        s.addColorStop(1, 'rgba(142,116,64,0)');
        g.fillStyle = s; g.fillRect(x, y, tile, tile);
      }
    }
    noiseFill(c, W, H, 8, 0.4);
    const res = { map: mkTex(c) };
    T.cache.ceiling = res;
    return res;
  };

  /* ---------------- counter laminate ---------------- */
  T.counter = function () {
    if (T.cache.counter) return T.cache.counter;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#4a4038'; g.fillRect(0, 0, W, H);
    // wood grain
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * H;
      g.strokeStyle = `rgba(${20 + Math.random() * 60},${16 + Math.random() * 46},${12 + Math.random() * 34},${0.05 + Math.random() * 0.18})`;
      g.lineWidth = 0.6 + Math.random() * 2.4;
      g.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const yy = y + Math.sin(x * 0.02 + i) * 5 + Math.sin(x * 0.005 + i * 2) * 9;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      g.strokeStyle = `rgba(200,190,170,${Math.random() * 0.12})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 6 - 3); g.stroke();
    }
    // cup rings
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 28;
      g.strokeStyle = 'rgba(28,20,14,0.22)'; g.lineWidth = 5;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke();
      g.strokeStyle = 'rgba(20,14,10,0.12)'; g.lineWidth = 12;
      g.beginPath(); g.arc(x, y, r + 3, 0, 6.283); g.stroke();
    }
    noiseFill(c, W, H, 14, 0.4);
    const rc = cnv(256, 256), rg = ctx(rc);
    rg.fillStyle = '#6a6a6a'; rg.fillRect(0, 0, 256, 256);
    noiseFill(rc, 256, 256, 40, 0.6);
    const res = { map: mkTex(c), rough: mkTex(rc, { linear: true }) };
    T.cache.counter = res;
    return res;
  };

  /* ---------------- brushed metal ---------------- */
  T.metal = function () {
    if (T.cache.metal) return T.cache.metal;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#8d9092'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * H;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? 40 : 230},${Math.random() < 0.5 ? 40 : 230},${Math.random() < 0.5 ? 40 : 235},${Math.random() * 0.08})`;
      g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (Math.random() - 0.5) * 2); g.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const y = Math.random() * H;
      g.fillStyle = `rgba(30,30,30,${Math.random() * 0.06})`;
      g.fillRect(0, y, W, 1 + Math.random() * 5);
    }
    const rc = cnv(256, 256), rg = ctx(rc);
    rg.fillStyle = '#5f5f5f'; rg.fillRect(0, 0, 256, 256);
    noiseFill(rc, 256, 256, 34, 0.5);
    const res = { map: mkTex(c), rough: mkTex(rc, { linear: true }) };
    T.cache.metal = res;
    return res;
  };

  /* ---------------- fridge ---------------- */
  T.fridge = function () {
    if (T.cache.fridge) return T.cache.fridge;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#b9bcb6'; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)');
    gr.addColorStop(0.6, 'rgba(120,128,120,0.04)');
    gr.addColorStop(1, 'rgba(40,44,40,0.16)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // frost creeping at edges
    for (let i = 0; i < 40; i++) {
      const x = Math.random() < 0.5 ? Math.random() * 60 : W - Math.random() * 60;
      const y = Math.random() * H;
      const f = g.createRadialGradient(x, y, 1, x, y, 20 + Math.random() * 50);
      f.addColorStop(0, 'rgba(225,240,240,0.20)');
      f.addColorStop(1, 'rgba(225,240,240,0)');
      g.fillStyle = f; g.fillRect(x - 80, y - 80, 160, 160);
    }
    // scratches / dirt
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(50,54,50,${Math.random() * 0.13})`;
      g.lineWidth = 0.7;
      const x = Math.random() * W, y = Math.random() * H;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 8); g.stroke();
    }
    noiseFill(c, W, H, 8, 0.5);
    const rc = cnv(256, 256), rg = ctx(rc);
    rg.fillStyle = '#4a4a4a'; rg.fillRect(0, 0, 256, 256);
    noiseFill(rc, 256, 256, 22, 0.5);
    T.cache.fridge = { map: mkTex(c), rough: mkTex(rc, { linear: true }) };
    return T.cache.fridge;
  };

  /* ---------------- asphalt ---------------- */
  T.asphalt = function () {
    if (T.cache.asphalt) return T.cache.asphalt;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#262a2c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const v = 20 + Math.random() * 70;
      g.fillStyle = `rgba(${v},${v + 2},${v + 4},${0.15 + Math.random() * 0.4})`;
      const s = Math.random() * 2.6 + 0.4;
      g.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = 'rgba(10,12,12,0.5)'; g.lineWidth = 1 + Math.random() * 2;
      let x = Math.random() * W, y = Math.random() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
    // wet sheen patches
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * 90;
      const s = g.createRadialGradient(x, y, 1, x, y, r);
      s.addColorStop(0, 'rgba(80,96,105,0.10)');
      s.addColorStop(1, 'rgba(80,96,105,0)');
      g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    noiseFill(c, W, H, 16, 0.7);

    const rc = cnv(256, 256), rg = ctx(rc);
    rg.fillStyle = '#3a3a3a'; rg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 24; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 18 + Math.random() * 60;
      const s = rg.createRadialGradient(x, y, 1, x, y, r);
      s.addColorStop(0, 'rgba(12,12,12,0.85)');
      s.addColorStop(1, 'rgba(12,12,12,0)');
      rg.fillStyle = s; rg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    noiseFill(rc, 256, 256, 30, 0.6);
    T.cache.asphalt = { map: mkTex(c), rough: mkTex(rc, { linear: true }) };
    return T.cache.asphalt;
  };

  /* ---------------- concrete sidewalk ---------------- */
  T.concrete = function () {
    if (T.cache.concrete) return T.cache.concrete;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#6f716d'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) {
      const v = 60 + Math.random() * 80;
      g.fillStyle = `rgba(${v},${v},${v - 3},${Math.random() * 0.3})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // expansion joints
    g.fillStyle = 'rgba(30,30,28,0.55)';
    g.fillRect(W / 2 - 2, 0, 4, H);
    g.fillRect(0, H / 2 - 2, W, 4);
    // cracks
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = 'rgba(24,24,22,0.5)'; g.lineWidth = 1 + Math.random();
      let x = Math.random() * W, y = Math.random() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 9; k++) { x += (Math.random() - 0.5) * 40; y += Math.random() * 20; g.lineTo(x, y); }
      g.stroke();
    }
    noiseFill(c, W, H, 14, 0.6);
    T.cache.concrete = { map: mkTex(c) };
    return T.cache.concrete;
  };

  /* ---------------- brick ---------------- */
  T.brick = function () {
    if (T.cache.brick) return T.cache.brick;
    const W = 512, H = 512;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#3c3532'; g.fillRect(0, 0, W, H);
    const bw = 128, bh = 42, mortar = 4;
    for (let row = 0; row < H / (bh + mortar) + 1; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < W / (bw + mortar) + 1; col++) {
        const x = col * (bw + mortar) + off, y = row * (bh + mortar);
        const v = 54 + Math.random() * 32;
        g.fillStyle = `rgb(${v + 20},${v},${v - 6})`;
        g.fillRect(x, y, bw, bh);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x, y + bh - 3, bw, 3);
        for (let i = 0; i < 16; i++) {
          g.fillStyle = `rgba(18,14,12,${Math.random() * 0.25})`;
          g.fillRect(x + Math.random() * bw, y + Math.random() * bh, 2 + Math.random() * 8, 1 + Math.random() * 2);
        }
      }
    }
    // grime
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 70;
      const s = g.createRadialGradient(x, y, 1, x, y, r);
      s.addColorStop(0, `rgba(10,10,10,${Math.random() * 0.18})`);
      s.addColorStop(1, 'rgba(10,10,10,0)');
      g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    noiseFill(c, W, H, 16, 0.6);
    T.cache.brick = { map: mkTex(c) };
    return T.cache.brick;
  };

  /* ---------------- fabric ---------------- */
  T.fabric = function (color) {
    const key = 'fabric_' + color;
    if (T.cache[key]) return T.cache[key];
    const W = 256, H = 256;
    const c = cnv(W, H), g = ctx(c);
    g.fillStyle = color || '#22252a'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(255,255,255,${0.012 + Math.random() * 0.012})`;
      g.fillRect(0, y, W, 1);
    }
    for (let x = 0; x < W; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.02})`;
      g.fillRect(x, 0, 1, H);
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1, 3);
    }
    noiseFill(c, W, H, 8, 0.4);
    T.cache[key] = mkTex(c);
    return T.cache[key];
  };

  /* ---------------- glow sprite ---------------- */
  T.glow = function () {
    if (T.cache.glow) return T.cache.glow;
    const S = 256, c = cnv(S, S), g = ctx(c);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.12, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.16)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    T.cache.glow = mkTex(c, { linear: true });
    return T.cache.glow;
  };

  /* ---------------- soft round shadow ---------------- */
  T.shadow = function () {
    if (T.cache.shadow) return T.cache.shadow;
    const S = 256, c = cnv(S, S), g = ctx(c);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.62)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    T.cache.shadow = mkTex(c, { linear: true });
    return T.cache.shadow;
  };

  /* ---------------- rain streak overlay ---------------- */
  T.rainStreak = function () {
    if (T.cache.rainStreak) return T.cache.rainStreak;
    const W = 512, H = 512, c = cnv(W, H), g = ctx(c);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const len = 20 + Math.random() * 100;
      const a = 0.03 + Math.random() * 0.16;
      g.strokeStyle = `rgba(190,215,230,${a})`;
      g.lineWidth = 0.6 + Math.random() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1 + Math.random() * 2, y + len); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 1 + Math.random() * 3;
      g.fillStyle = `rgba(200,225,240,${0.05 + Math.random() * 0.12})`;
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    }
    T.cache.rainStreak = mkTex(c, { linear: true });
    return T.cache.rainStreak;
  };

  /* ---------------- grain for CSS ---------------- */
  T.grainDataURL = function () {
    if (T.cache.grain) return T.cache.grain;
    const S = 160, c = cnv(S, S), g = ctx(c);
    const img = g.createImageData(S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 255;
    }
    g.putImageData(img, 0, 0);
    T.cache.grain = c.toDataURL('image/png');
    return T.cache.grain;
  };

  /* ---------------- signage ---------------- */
  T.storeSign = function () {
    if (T.cache.storeSign) return T.cache.storeSign;
    const W = 1024, H = 256, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#10150f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d2a1b'; g.fillRect(8, 8, W - 16, H - 16);
    // glow tube border
    g.shadowColor = 'rgba(160,240,190,0.8)'; g.shadowBlur = 22;
    g.strokeStyle = 'rgba(196,255,214,0.8)'; g.lineWidth = 4;
    g.strokeRect(20, 20, W - 40, H - 40);
    g.shadowBlur = 0;
    g.fillStyle = '#eaffef';
    g.font = 'bold 112px ' + CN_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(120,255,170,0.9)'; g.shadowBlur = 30;
    g.fillText('长夜便利店', W / 2 - 40, H / 2 + 2);
    g.shadowBlur = 0;
    // english small
    g.fillStyle = 'rgba(190,255,210,0.75)';
    g.font = '24px ' + CN_FONT;
    g.fillText('NIGHTLONG  MART', W / 2 - 40, H - 48);
    // 24H badge
    g.fillStyle = '#b3322a';
    g.fillRect(W - 158, 44, 104, 168);
    g.fillStyle = '#ffe9df';
    g.font = 'bold 54px ' + CN_FONT;
    g.fillText('24H', W - 106, 112);
    g.font = 'bold 22px ' + CN_FONT;
    g.fillText('夜间', W - 106, 160);
    g.fillText('营业', W - 106, 186);
    // scuffs
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
      g.fillRect(Math.random() * W, Math.random() * H, Math.random() * 30, 1);
    }
    T.cache.storeSign = mkTex(c);
    return T.cache.storeSign;
  };

  T.neon24 = function () {
    if (T.cache.neon24) return T.cache.neon24;
    const W = 512, H = 256, c = cnv(W, H), g = ctx(c);
    g.clearRect(0, 0, W, H);
    g.font = 'bold 150px ' + CN_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,90,70,0.95)'; g.shadowBlur = 35;
    g.strokeStyle = '#ffd9cf'; g.lineWidth = 6;
    g.strokeText('24H', W / 2, H / 2);
    g.shadowBlur = 15;
    g.strokeStyle = '#ff6a58'; g.lineWidth = 3;
    g.strokeText('24H', W / 2, H / 2);
    T.cache.neon24 = mkTex(c);
    return T.cache.neon24;
  };

  T.exitSign = function () {
    if (T.cache.exitSign) return T.cache.exitSign;
    const W = 512, H = 160, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#0d2410'; g.fillRect(0, 0, W, H);
    g.shadowColor = 'rgba(90,255,120,0.9)'; g.shadowBlur = 24;
    g.fillStyle = '#c8ffd0';
    g.font = 'bold 78px ' + CN_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('安全出口', W / 2, H / 2 + 4);
    g.shadowBlur = 0;
    g.font = 'bold 26px ' + CN_FONT;
    g.fillText('EXIT', W / 2, H - 18);
    T.cache.exitSign = mkTex(c);
    return T.cache.exitSign;
  };

  T.rulesBoard = function () {
    if (T.cache.rulesBoard) return T.cache.rulesBoard;
    const W = 600, H = 900, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#ded8c8'; g.fillRect(0, 0, W, H);
    // paper texture
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(90,80,60,${Math.random() * 0.04})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    g.strokeStyle = '#7a1d18'; g.lineWidth = 6;
    g.strokeRect(22, 22, W - 44, H - 44);
    g.fillStyle = '#241d16';
    g.font = 'bold 54px ' + SERIF_FONT;
    g.textAlign = 'center';
    g.fillText('夜 班 守 则', W / 2, 104);
    g.font = '22px ' + SERIF_FONT;
    g.textAlign = 'left';
    const lines = [
      '一、二十二点前锁好后门。后门只能从里面开。',
      '二、门铃响，才有客人。没听见门铃的人，',
      '　　不要接待。',
      '三、先问口令，再看证件。口令每晚由电台',
      '　　在二十三点前播报。',
      '四、若客人不眨眼、不呼白气、在玻璃里没有',
      '　　影子，或者说出了你心里想的话——',
      '　　不要收钱，不要转身。去拿枪。',
      '五、枪在柜台下面。弹匣里只有六发。',
      '　　不要打人。打错了，你就不再是店员。',
      '六、不要邀请任何人进入柜台。',
      '七、四点天亮前，不要看后门的猫眼。',
      '八、如果电台里的苏姐开始叫你“小岳”，',
      '　　关掉电台。'
    ];
    let y = 168;
    for (const ln of lines) {
      g.fillStyle = '#241d16';
      g.fillText(ln, 52, y);
      y += 50;
    }
    // red stamp
    g.save();
    g.translate(W - 130, H - 120); g.rotate(-0.18);
    g.strokeStyle = 'rgba(150,30,24,0.75)'; g.lineWidth = 5;
    g.strokeRect(-72, -48, 144, 96);
    g.fillStyle = 'rgba(150,30,24,0.75)';
    g.font = 'bold 36px ' + SERIF_FONT; g.textAlign = 'center';
    g.fillText('已阅', 0, 2);
    g.font = '18px ' + SERIF_FONT;
    g.fillText('值班店员', 0, 34);
    g.restore();
    // stains
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * 90;
      const s = g.createRadialGradient(x, y, 2, x, y, r);
      s.addColorStop(0, 'rgba(110,80,40,0.10)');
      s.addColorStop(1, 'rgba(110,80,40,0)');
      g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    T.cache.rulesBoard = mkTex(c);
    return T.cache.rulesBoard;
  };

  T.priceTag = function () {
    if (T.cache.priceTag) return T.cache.priceTag;
    const W = 256, H = 128, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#f2eee2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c8362c'; g.fillRect(0, 0, W, 30);
    g.fillStyle = '#fff'; g.font = 'bold 22px ' + CN_FONT;
    g.textAlign = 'center'; g.fillText('特 价', W / 2, 23);
    g.fillStyle = '#222'; g.font = 'bold 52px ' + CN_FONT;
    g.fillText('6.5', W / 2 - 18, 92);
    g.font = 'bold 24px ' + CN_FONT;
    g.fillText('元', W / 2 + 44, 92);
    T.cache.priceTag = mkTex(c);
    return T.cache.priceTag;
  };

  /* ---------------- product labels ---------------- */
  T.productLabels = function () {
    if (T.cache.productLabels) return T.cache.productLabels;
    const specs = [
      { bg: '#1b5e8c', fg: '#eaf7ff', accent: '#7fd4ff', cn: '长夜', en: 'PURE WATER', kind: 'water' },
      { bg: '#14352a', fg: '#f2ffe9', accent: '#8adf6a', cn: '北岸', en: 'SODA', kind: 'can' },
      { bg: '#8c2418', fg: '#fff3df', accent: '#ffc94a', cn: '一碗长夜', en: 'NOODLE', kind: 'cup' },
      { bg: '#2a1c3c', fg: '#f6e9ff', accent: '#c68bff', cn: '夜航', en: 'ENERGY', kind: 'can' },
      { bg: '#4a3a12', fg: '#fff6d8', accent: '#ffd35c', cn: '旧街', en: 'BEER', kind: 'can' },
      { bg: '#7d1f26', fg: '#ffe9e4', accent: '#ff8a7a', cn: '雨声', en: 'MINT', kind: 'box' },
      { bg: '#e8e4d8', fg: '#26323a', accent: '#6d8fa8', cn: '白噪', en: 'MILK', kind: 'box' },
      { bg: '#3a2a20', fg: '#ffe9c9', accent: '#b58a56', cn: '烤肠', en: 'SAUSAGE', kind: 'food' }
    ];
    const out = [];
    for (const sp of specs) {
      const W = 256, H = 384, c = cnv(W, H), g = ctx(c);
      g.fillStyle = sp.bg; g.fillRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.30)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = sp.accent; g.fillRect(0, 0, W, 10);
      // band graphics
      g.globalAlpha = 0.22;
      for (let i = 0; i < 7; i++) {
        g.strokeStyle = sp.accent; g.lineWidth = 2 + Math.random() * 8;
        g.beginPath(); g.arc(40 + Math.random() * 180, 160 + Math.random() * 120, 30 + Math.random() * 70, 0, 6.283); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = sp.fg;
      g.textAlign = 'center';
      g.font = 'bold 54px ' + CN_FONT;
      wrapCN(g, sp.cn, 128, 140, 52);
      g.font = 'bold 20px ' + CN_FONT;
      g.fillText(sp.en, W / 2, 300);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
      g.strokeRect(8, 8, W - 16, H - 16);
      // barcode
      g.fillStyle = '#f5f2e8'; g.fillRect(26, H - 52, 118, 28);
      for (let i = 0; i < 22; i++) {
        g.fillStyle = i % 3 === 0 ? '#1a1a1a' : '#333';
        const bx = 30 + i * 5;
        g.fillRect(bx, H - 47, i % 4 === 0 ? 3 : 1.5, 18);
      }
      g.fillStyle = sp.fg; g.font = '14px ' + CN_FONT;
      g.textAlign = 'left'; g.fillText('净含量 500ml', 26, H - 66);
      // price
      g.fillStyle = sp.accent; g.font = 'bold 30px ' + CN_FONT;
      g.textAlign = 'right'; g.fillText('¥6.5', W - 22, H - 28);
      out.push(mkTex(c));
    }
    T.cache.productLabels = out;
    return out;
  };

  function wrapCN(g, text, cx, cy, lh) {
    const chars = text.split('');
    const n = chars.length;
    const startY = cy - (n - 1) * lh / 2;
    for (let i = 0; i < n; i++) g.fillText(chars[i], cx, startY + i * lh);
  }

  /* ---------------- magazine covers ---------------- */
  T.magazines = function () {
    if (T.cache.magazines) return T.cache.magazines;
    const names = ['城市夜行', '看世界', '汽车之友', '桥牌'];
    const cols = [['#1a3a5c', '#e8503a'], ['#3a2438', '#f0c060'], ['#20262a', '#6fb3e0'], ['#2a3a24', '#e0d8a0']];
    const out = [];
    for (let i = 0; i < 4; i++) {
      const W = 256, H = 340, c = cnv(W, H), g = ctx(c);
      g.fillStyle = cols[i][0]; g.fillRect(0, 0, W, H);
      // photographic-ish blob
      const gr = g.createRadialGradient(W * 0.6, H * 0.5, 8, W * 0.6, H * 0.5, 160);
      gr.addColorStop(0, cols[i][1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#f5f2e8';
      g.font = 'bold 40px ' + CN_FONT;
      g.textAlign = 'left';
      g.fillText(names[i], 14, 54);
      g.fillRect(14, 66, 90, 5);
      g.font = '16px ' + CN_FONT;
      g.fillStyle = 'rgba(245,242,232,0.8)';
      g.fillText('第 ' + (12 + i) + ' 期 · 深夜特辑', 14, 96);
      // fake cover lines
      for (let k = 0; k < 4; k++) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillRect(14, H - 120 + k * 22, 120 + Math.random() * 60, 7);
      }
      g.fillStyle = cols[i][1];
      g.fillRect(0, H - 26, W, 26);
      out.push(mkTex(c));
    }
    T.cache.magazines = out;
    return out;
  };

  /* ---------------- cigarette pack ---------------- */
  T.cigPack = function () {
    if (T.cache.cigPack) return T.cache.cigPack;
    const W = 256, H = 384, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#8f1f1b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2e3c0';
    g.font = 'bold 64px ' + CN_FONT; g.textAlign = 'center';
    g.fillText('红塔', W / 2, 110);
    g.font = '18px ' + CN_FONT;
    g.fillText('RED TOWER', W / 2, 142);
    g.fillStyle = '#2a1410'; g.fillRect(20, 180, W - 40, 70);
    g.fillStyle = '#e8d28a'; g.font = 'bold 26px ' + CN_FONT;
    g.fillText('吸烟有害健康', W / 2, 224);
    g.fillStyle = '#f2e3c0'; g.font = 'bold 20px ' + CN_FONT;
    g.fillText('20 支装 · 硬盒', W / 2, 300);
    T.cache.cigPack = mkTex(c);
    return T.cache.cigPack;
  };

  /* ---------------- posters ---------------- */
  T.posterAds = function (idx) {
    const key = 'posterAds' + idx;
    if (T.cache[key]) return T.cache[key];
    const specs = [
      { bg: '#17384e', accent: '#ffcf5c', title: '热咖啡', sub: '凌晨三点，也要醒着', foot: '现磨 · 中杯 ¥8' },
      { bg: '#2a1418', accent: '#ff7a5c', title: '关东煮', sub: '汤一直热着', foot: '任选三串 ¥10' },
      { bg: '#132a20', accent: '#8fe07a', title: '夜班套餐', sub: '泡面 + 咖啡 + 火腿', foot: '特价 ¥15' }
    ];
    const sp = specs[idx % specs.length];
    const W = 600, H = 800, c = cnv(W, H), g = ctx(c);
    g.fillStyle = sp.bg; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.42, 380);
    gr.addColorStop(0, sp.accent + '66'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // product silhouette
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(W / 2, H * 0.44, 170, 200, 0, 0, 6.283); g.fill();
    g.fillStyle = sp.accent;
    g.beginPath(); g.roundRect ? g.roundRect(W / 2 - 74, H * 0.30, 148, 210, 26) : g.rect(W / 2 - 74, H * 0.30, 148, 210);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(W / 2 - 60, H * 0.38, 120, 74);
    g.fillStyle = sp.accent;
    g.font = 'bold 64px ' + CN_FONT; g.textAlign = 'center';
    g.fillText(sp.title, W / 2, H * 0.72);
    g.fillStyle = '#f4efe2';
    g.font = '28px ' + CN_FONT;
    g.fillText(sp.sub, W / 2, H * 0.775);
    g.fillStyle = sp.accent;
    g.font = 'bold 36px ' + CN_FONT;
    g.fillText(sp.foot, W / 2, H * 0.87);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = '20px ' + CN_FONT;
    g.fillText('长夜便利店 · 24H', W / 2, H - 36);
    // paper wear
    noiseFill(c, W, H, 10, 0.4);
    T.cache[key] = mkTex(c);
    return T.cache[key];
  };

  T.missingPoster = function () {
    if (T.cache.missingPoster) return T.cache.missingPoster;
    const W = 700, H = 1000, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#e9e4d5'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#a3241e'; g.fillRect(0, 0, W, 130);
    g.fillStyle = '#fff5ea';
    g.font = 'bold 84px ' + CN_FONT; g.textAlign = 'center';
    g.fillText('寻 人', W / 2, 96);
    // charcoal portrait
    const px = W / 2, py = 400, rw = 190, rh = 250;
    g.save();
    g.beginPath(); g.rect(0, 130, W, 560); g.clip();
    // hair
    g.fillStyle = '#1e1a17';
    g.beginPath(); g.ellipse(px, py - 20, rw * 1.05, rh * 1.05, 0, 0, 6.283); g.fill();
    // face
    const fg = g.createLinearGradient(px - rw, py - rh, px + rw, py + rh);
    fg.addColorStop(0, '#d8d2c4'); fg.addColorStop(0.55, '#c6bfae'); fg.addColorStop(1, '#a8a08e');
    g.fillStyle = fg;
    g.beginPath(); g.ellipse(px, py, rw * 0.62, rh * 0.78, 0, 0, 6.283); g.fill();
    // long hair framing face
    g.fillStyle = '#211b18';
    g.beginPath();
    g.moveTo(px - rw * 0.72, py - rh * 0.55);
    g.quadraticCurveTo(px - rw * 0.95, py + rh * 0.4, px - rw * 0.5, py + rh * 1.0);
    g.lineTo(px - rw * 0.25, py + rh * 0.95);
    g.quadraticCurveTo(px - rw * 0.55, py + rh * 0.35, px - rw * 0.45, py - rh * 0.5);
    g.fill();
    g.beginPath();
    g.moveTo(px + rw * 0.72, py - rh * 0.55);
    g.quadraticCurveTo(px + rw * 0.95, py + rh * 0.4, px + rw * 0.5, py + rh * 1.0);
    g.lineTo(px + rw * 0.25, py + rh * 0.95);
    g.quadraticCurveTo(px + rw * 0.55, py + rh * 0.35, px + rw * 0.45, py - rh * 0.5);
    g.fill();
    // features
    g.fillStyle = 'rgba(40,34,30,0.9)';
    g.beginPath(); g.ellipse(px - 46, py - 12, 22, 10, 0.1, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(px + 46, py - 12, 22, 10, -0.1, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(210,200,185,0.9)';
    g.beginPath(); g.arc(px - 46, py - 11, 5, 0, 6.283); g.fill();
    g.beginPath(); g.arc(px + 46, py - 11, 5, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(30,25,22,0.9)';
    g.beginPath(); g.arc(px - 46, py - 11, 2.4, 0, 6.283); g.fill();
    g.beginPath(); g.arc(px + 46, py - 11, 2.4, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(40,30,26,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(px - 20, py + 66); g.quadraticCurveTo(px, py + 76, px + 20, py + 66); g.stroke();
    g.beginPath(); g.moveTo(px - 24, py + 36); g.quadraticCurveTo(px, py + 28, px + 24, py + 36); g.stroke();
    // nose shadow
    g.strokeStyle = 'rgba(80,64,54,0.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(px, py - 2); g.lineTo(px - 9, py + 22); g.stroke();
    // grain / photocopy
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(20,20,20,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * W, 130 + Math.random() * 560, 1.2, 1.2);
    }
    g.restore();
    // text block
    g.fillStyle = '#241d18'; g.textAlign = 'center';
    g.font = 'bold 62px ' + CN_FONT;
    g.fillText('林 小 舟', W / 2, 760);
    g.font = '30px ' + CN_FONT;
    g.fillText('女 · 24 岁 · 身高 163cm', W / 2, 812);
    g.font = '27px ' + CN_FONT;
    g.fillText('最后出现：长夜路 24H 便利店附近', W / 2, 858);
    g.fillText('2024 年 9 月 14 日 · 凌晨', W / 2, 896);
    g.font = 'bold 28px ' + CN_FONT;
    g.fillStyle = '#8f1f1a';
    g.fillText('如有线索，请联系：138 **** 0617', W / 2, 946);
    // staples / tape
    g.fillStyle = 'rgba(245,240,220,0.5)';
    g.save(); g.translate(W - 34, 150); g.rotate(-0.6); g.fillRect(-60, -18, 120, 36); g.restore();
    g.save(); g.translate(30, 200); g.rotate(-0.6); g.fillRect(-60, -18, 120, 36); g.restore();
    // stains/tear
    const gr2 = g.createRadialGradient(120, 900, 2, 120, 900, 160);
    gr2.addColorStop(0, 'rgba(100,80,50,0.16)'); gr2.addColorStop(1, 'rgba(100,80,50,0)');
    g.fillStyle = gr2; g.fillRect(0, 740, 300, 300);
    noiseFill(c, W, H, 8, 0.5);
    T.cache.missingPoster = mkTex(c);
    return T.cache.missingPoster;
  };

  /* ---------------- note paper ---------------- */
  T.note = function () {
    if (T.cache.note) return T.cache.note;
    const W = 640, H = 860, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#d9d2bd'; g.fillRect(0, 0, W, H);
    for (let y = 60; y < H; y += 44) {
      g.fillStyle = 'rgba(90,100,120,0.18)';
      g.fillRect(36, y, W - 72, 1.5);
    }
    for (let x = 80; x < W; x += 44) {
      g.fillStyle = 'rgba(90,100,120,0.10)';
      g.fillRect(x, 40, 1, H - 80);
    }
    g.fillStyle = 'rgba(60,50,40,0.75)';
    g.font = '26px ' + SERIF_FONT;
    const lines = ['别相信玻璃。', '', '它在学你说话。先学声音，', '再学脸，最后学会等。', '', '如果你看见一个和你一模一样的人，', '别问口令，直接开枪。', '', '——老陈'];
    let y = 130;
    for (const ln of lines) { g.fillText(ln, 70, y); y += 56; }
    // coffee ring
    g.strokeStyle = 'rgba(80,50,20,0.25)'; g.lineWidth = 10;
    g.beginPath(); g.arc(W - 150, H - 150, 68, 0, 6.283); g.stroke();
    noiseFill(c, W, H, 10, 0.5);
    T.cache.note = mkTex(c);
    return T.cache.note;
  };

  /* ---------------- CCTV scan overlay ---------------- */
  T.scanlines = function () {
    if (T.cache.scanlines) return T.cache.scanlines;
    const S = 256, c = cnv(S, S), g = ctx(c);
    g.clearRect(0, 0, S, S);
    for (let y = 0; y < S; y += 3) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, y, S, 1.4);
    }
    T.cache.scanlines = mkTex(c, { linear: true });
    return T.cache.scanlines;
  };

  /* ---------------- clock face ---------------- */
  T.clockFace = function () {
    if (T.cache.clockFace) return T.cache.clockFace;
    const S = 512, c = cnv(S, S), g = ctx(c);
    g.fillStyle = '#e9e6da'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, 6.283); g.fill();
    g.strokeStyle = '#2b2b28'; g.lineWidth = 8;
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 12, 0, 6.283); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283 - Math.PI / 2;
      const r1 = S / 2 - 30, r2 = S / 2 - (i % 3 === 0 ? 62 : 46);
      g.strokeStyle = '#242422'; g.lineWidth = i % 3 === 0 ? 9 : 5;
      g.beginPath();
      g.moveTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1);
      g.lineTo(S / 2 + Math.cos(a) * r2, S / 2 + Math.sin(a) * r2);
      g.stroke();
    }
    g.fillStyle = '#2a2a26';
    g.font = 'bold 30px ' + CN_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = i / 12 * 6.283 - Math.PI / 2;
      g.fillText(String(i), S / 2 + Math.cos(a) * (S / 2 - 92), S / 2 + Math.sin(a) * (S / 2 - 92) + 2);
    }
    g.fillStyle = 'rgba(90,80,60,0.10)';
    g.beginPath(); g.arc(S / 2 - 60, S / 2 + 50, 150, 0, 6.283); g.fill();
    T.cache.clockFace = mkTex(c);
    return T.cache.clockFace;
  };

  /* ---------------- coffee menu ---------------- */
  T.menuBoard = function () {
    if (T.cache.menuBoard) return T.cache.menuBoard;
    const W = 512, H = 700, c = cnv(W, H), g = ctx(c);
    g.fillStyle = '#14100d'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28);
    g.fillStyle = '#f2dfb8'; g.font = 'bold 56px ' + CN_FONT; g.textAlign = 'center';
    g.fillText('热 饮', W / 2, 96);
    g.fillStyle = '#c9a86f'; g.font = '20px ' + CN_FONT;
    g.fillText('HOT DRINKS', W / 2, 128);
    const items = [['美式', '8'], ['拿铁', '12'], ['热可可', '10'], ['关东煮汤', '3'], ['热水', '免费']];
    g.font = '32px ' + CN_FONT; g.textAlign = 'left';
    let y = 200;
    for (const [n, p] of items) {
      g.fillStyle = '#e9dcc4'; g.fillText(n, 56, y);
      g.fillStyle = '#f0b45a'; g.textAlign = 'right'; g.fillText('¥' + p, W - 56, y); g.textAlign = 'left';
      y += 76;
    }
    g.fillStyle = '#88724f'; g.font = '20px ' + CN_FONT; g.textAlign = 'center';
    g.fillText('请自取 · 小心烫', W / 2, H - 40);
    T.cache.menuBoard = mkTex(c);
    return T.cache.menuBoard;
  };

  /* ---------------- blood stain ---------------- */
  T.bloodStain = function () {
    if (T.cache.bloodStain) return T.cache.bloodStain;
    const S = 512, c = cnv(S, S), g = ctx(c);
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      const x = S / 2 + (Math.random() - 0.5) * 170;
      const y = S / 2 + (Math.random() - 0.5) * 170;
      const r = 20 + Math.random() * 80;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, `rgba(${58 + Math.random() * 30},${6 + Math.random() * 8},${4 + Math.random() * 6},${0.35 + Math.random() * 0.3})`);
      gr.addColorStop(0.7, 'rgba(38,4,3,0.2)');
      gr.addColorStop(1, 'rgba(30,3,2,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    T.cache.bloodStain = mkTex(c, { linear: true });
    return T.cache.bloodStain;
  };

  /* ---------------- dark oil stain / body residue ---------------- */
  T.oilStain = function () {
    if (T.cache.oilStain) return T.cache.oilStain;
    const S = 512, c = cnv(S, S), g = ctx(c);
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 36; i++) {
      const x = S / 2 + (Math.random() - 0.5) * 190;
      const y = S / 2 + (Math.random() - 0.5) * 190;
      const r = 20 + Math.random() * 90;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, `rgba(8,8,10,${0.35 + Math.random() * 0.3})`);
      gr.addColorStop(0.7, 'rgba(6,6,8,0.18)');
      gr.addColorStop(1, 'rgba(6,6,8,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    T.cache.oilStain = mkTex(c, { linear: true });
    return T.cache.oilStain;
  };

  /* ---------------- view-model hand skin ---------------- */
  T.skin = function (tone) {
    const key = 'skin_' + (tone || 'default');
    if (T.cache[key]) return T.cache[key];
    const S = 256, c = cnv(S, S), g = ctx(c);
    const base = tone === 'pale' ? [188, 166, 150] : [168, 128, 103];
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = `rgba(${base[0] - 30},${base[1] - 26},${base[2] - 22},${Math.random() * 0.10})`;
      g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = `rgba(${base[0] - 50},${base[1] - 44},${base[2] - 40},${0.08 + Math.random() * 0.12})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(Math.random() * S, Math.random() * S);
      g.lineTo(Math.random() * S, Math.random() * S); g.stroke();
    }
    T.cache[key] = mkTex(c);
    return T.cache[key];
  };

  /* ---------------- normal map from height ---------------- */
  function normalFromHeight(heightCanvas, strength) {
    const w = heightCanvas.width, h = heightCanvas.height;
    const src = ctx(heightCanvas).getImageData(0, 0, w, h).data;
    const out = cnv(w, h);
    const img = ctx(out).createImageData(w, h);
    const d = img.data;
    const S = strength == null ? 2 : strength;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const xl = (x - 1 + w) % w, xr = (x + 1) % w;
        const yu = (y - 1 + h) % h, yd = (y + 1) % h;
        const hl = src[(y * w + xl) * 4] / 255;
        const hr = src[(y * w + xr) * 4] / 255;
        const hu = src[(yu * w + x) * 4] / 255;
        const hd = src[(yd * w + x) * 4] / 255;
        const dx = (hl - hr) * S;
        const dy = (hu - hd) * S;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        d[i] = ((dx / len) * 0.5 + 0.5) * 255;
        d[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        d[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    }
    ctx(out).putImageData(img, 0, 0);
    return mkTex(out, { linear: true });
  }
  T.normalFromHeight = normalFromHeight;

  /* ---------------- ID portrait ---------------- */
  T.idPortrait = function (kind, opts) {
    opts = opts || {};
    const img = T.faces[kind] || T.faces.human;
    const W = 300, H = 380, c = cnv(W, H), g = ctx(c);
    // background
    g.fillStyle = opts.bg || '#8fa3b0';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 5; i++) g.fillRect(0, i * 70, W, 20);
    // crop of the painted face
    const crop = { x: 330, y: 170, w: 380, h: 480 };
    g.save();
    if (opts.flip) { g.translate(W, 0); g.scale(-1, 1); }
    g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 4, 6, W - 8, H - 12);
    g.restore();
    // color grade
    g.fillStyle = opts.tint || 'rgba(210,190,150,0.16)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,20,20,0.06)';
    g.fillRect(0, 0, W, H);
    // print grain
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }
    // vignette
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return c.toDataURL('image/jpeg', 0.9);
  };

  T.sisterSketch = function () { return T.missingPoster(); };

  T.init = async function () {
    await T.initFaces();
    // Warm the most important ones
    T.floor(); T.wall(); T.ceiling(); T.counter(); T.metal(); T.fridge();
    T.asphalt(); T.concrete(); T.brick(); T.glow(); T.shadow(); T.rainStreak();
    T.storeSign(); T.neon24(); T.exitSign(); T.rulesBoard(); T.priceTag();
    T.productLabels(); T.magazines(); T.cigPack(); T.posterAds(0); T.posterAds(1); T.posterAds(2);
    T.missingPoster(); T.note(); T.scanlines(); T.clockFace(); T.menuBoard();
    T.oilStain(); T.skin();
    T.ready = true;
  };

  MS.T = T;
})(window.MS);
