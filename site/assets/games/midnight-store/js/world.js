/* ============================================================
 * 长夜便利店 — 场景：便利店、街道、灯光、监控
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const M = MS.M, T = MS.T;
  const World = {};

  const ROOM = { x1: -4.6, x2: 4.6, z1: -6.0, z2: 6.2, h: 3.0 };
  World.room = ROOM;
  World.CUSTOMER_ANCHOR = new THREE.Vector3(2.45, 0, 4.62);
  World.CUSTOMER_FACE = -Math.PI;         // facing -z (toward clerk)
  World.PLAYER_START = new THREE.Vector3(2.55, 0, 2.95);
  World.PLAYER_START_YAW = Math.PI;       // look toward +z
  World.WINDOW_Z = 6.2;
  World.colliders = [];
  World.points = {};
  World.quality = 'medium';

  const G = {};
  const M_ = {};

  function initGeom() {
    G.box = new THREE.BoxGeometry(1, 1, 1);
    G.plane = new THREE.PlaneGeometry(1, 1);
    G.cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    G.cylLow = new THREE.CylinderGeometry(1, 1, 1, 8);
    G.sphere = new THREE.SphereGeometry(1, 18, 12);
    G.sphereLow = new THREE.SphereGeometry(1, 10, 8);
  }

  function box(w, h, d, mat, x, y, z, parent, opts) {
    const m = new THREE.Mesh(G.box, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    if (opts && opts.ry) m.rotation.y = opts.ry;
    if (opts && opts.rx) m.rotation.x = opts.rx;
    if (opts && opts.rz) m.rotation.z = opts.rz;
    (parent || World.root).add(m);
    return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    const m = new THREE.Mesh(G.plane, mat);
    m.scale.set(w, h, 1);
    m.position.set(x, y, z);
    m.rotation.x = rx || 0;
    m.rotation.y = ry || 0;
    (parent || World.root).add(m);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, parent, seg) {
    const g = seg === 'low' ? G.cylLow : G.cyl;
    const m = new THREE.Mesh(g, mat);
    m.scale.set(rt, h, rt);
    m.position.set(x, y, z);
    (parent || World.root).add(m);
    return m;
  }
  function shadowBlob(x, z, sx, sz, opacity, parent) {
    const mat = new THREE.MeshBasicMaterial({
      map: T.shadow(), transparent: true, opacity: opacity == null ? 0.5 : opacity,
      depthWrite: false, blending: THREE.NormalBlending
    });
    const m = new THREE.Mesh(G.plane, mat);
    m.scale.set(sx, sz, 1);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    m.renderOrder = 2;
    (parent || World.root).add(m);
    return m;
  }
  function glowSprite(color, size, x, y, z, opacity, parent) {
    const mat = new THREE.SpriteMaterial({
      map: T.glow(), color: color, transparent: true, opacity: opacity == null ? 0.55 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    (parent || World.root).add(s);
    return s;
  }
  function collider(x1, z1, x2, z2) {
    World.colliders.push({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) });
  }

  function std(opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      roughness: 0.75, metalness: 0.0, envMapIntensity: 0.35
    }, opts || {}));
  }

  /* ============================================================
   * Materials
   * ============================================================ */
  function initMaterials() {
    const floor = T.floor();
    floor.map.repeat.set(4.8, 6.2);
    floor.rough.repeat.set(4.8, 6.2);
    floor.normal.repeat.set(4.8, 6.2);
    const wall = T.wall();
    wall.map.repeat.set(2.2, 1.5);
    wall.rough.repeat.set(2.2, 1.5);
    const ceil = T.ceiling();
    ceil.map.repeat.set(4.6, 6.1);
    const counter = T.counter();
    const metal = T.metal();
    const fridge = T.fridge();

    M_.floor = std({
      map: floor.map, roughnessMap: floor.rough, normalMap: floor.normal,
      normalScale: new THREE.Vector2(0.55, 0.55), roughness: 1.0, metalness: 0.06,
      color: 0x8e8e82, vertexColors: false
    });
    M_.wall = std({ map: wall.map, roughnessMap: wall.rough, roughness: 1.0, color: 0x9a978a });
    M_.wallDark = std({ color: 0x2a2825, roughness: 0.95 });
    M_.ceiling = std({ map: ceil.map, roughness: 0.95, color: 0x8a8a80 });
    M_.counter = std({ map: counter.map, roughnessMap: counter.rough, roughness: 0.9, color: 0x857766 });
    M_.counterDark = std({ color: 0x2a2621, roughness: 0.8 });
    M_.metal = std({ map: metal.map, roughnessMap: metal.rough, roughness: 0.75, metalness: 0.72, color: 0x9aa0a2 });
    M_.metalDark = std({ color: 0x33383a, roughness: 0.5, metalness: 0.8 });
    M_.fridge = std({ map: fridge.map, roughnessMap: fridge.rough, roughness: 0.55, metalness: 0.25, color: 0xb8bab2 });
    M_.plasticWhite = std({ color: 0xd8d5ca, roughness: 0.5 });
    M_.plasticBlack = std({ color: 0x17191a, roughness: 0.42, metalness: 0.1 });
    M_.glass = new THREE.MeshStandardMaterial({
      color: 0x9fb1b4, metalness: 0.72, roughness: 0.07, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.7
    });
    M_.glassDoor = new THREE.MeshStandardMaterial({
      color: 0xcfe3e8, metalness: 0.65, roughness: 0.05, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.9
    });
    M_.wood = std({ color: 0x4a3423, roughness: 0.7 });
    M_.cardboard = std({ color: 0x9c7b4f, roughness: 0.95 });
    M_.rubber = std({ color: 0x141414, roughness: 0.9 });
    M_.paper = std({ color: 0xd8d2c0, roughness: 0.95 });
  }

  /* ============================================================
   * Room shell
   * ============================================================ */
  function buildShell() {
    // floor with vertex AO
    const fg = new THREE.PlaneGeometry(ROOM.x2 - ROOM.x1, ROOM.z2 - ROOM.z1, 14, 20);
    fg.rotateX(-Math.PI / 2);
    const pos = fg.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const dx = Math.min(x - ROOM.x1, ROOM.x2 - x);
      const dz = Math.min(z - ROOM.z1, ROOM.z2 - z);
      const edge = Math.min(dx, dz);
      let ao = 0.62 + 0.38 * M.clamp(edge / 1.4, 0, 1);
      // shelf shadow lanes
      ao *= 1 - 0.18 * Math.exp(-Math.pow((x + 2.2) / 1.2, 2)) * (z > -2.8 && z < 2.9 ? 1 : 0);
      // warm patch near counter lights
      ao += 0.05 * Math.exp(-Math.pow((x - 2.6) / 2.2, 2) - Math.pow((z - 2.6) / 2.6, 2));
      const c = M.clamp(ao, 0.34, 1.12);
      colors[i * 3] = c; colors[i * 3 + 1] = c; colors[i * 3 + 2] = c * 0.985;
    }
    fg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const floorMat = M_.floor.clone();
    floorMat.vertexColors = true;
    floorMat.color.set(0x9a9a8c);
    const floor = new THREE.Mesh(fg, floorMat);
    floor.position.set((ROOM.x1 + ROOM.x2) / 2, 0, (ROOM.z1 + ROOM.z2) / 2);
    World.root.add(floor);

    // ceiling
    const ceil = plane(ROOM.x2 - ROOM.x1, ROOM.z2 - ROOM.z1, M_.ceiling,
      (ROOM.x1 + ROOM.x2) / 2, ROOM.h, (ROOM.z1 + ROOM.z2) / 2, Math.PI / 2, 0);
    // ceiling grid frame
    for (let z = ROOM.z1; z <= ROOM.z2; z += 1.2) {
      box(ROOM.x2 - ROOM.x1, 0.05, 0.035, M_.metalDark, 0, ROOM.h - 0.03, z);
    }
    for (let x = ROOM.x1; x <= ROOM.x2; x += 1.2) {
      box(0.035, 0.05, ROOM.z2 - ROOM.z1, M_.metalDark, x, ROOM.h - 0.03, (ROOM.z1 + ROOM.z2) / 2);
    }

    // walls
    // left wall (x = ROOM.x1) faces +x
    plane(ROOM.z2 - ROOM.z1, ROOM.h, M_.wall, ROOM.x1, ROOM.h / 2, (ROOM.z1 + ROOM.z2) / 2, 0, Math.PI / 2);
    // right wall faces -x
    plane(ROOM.z2 - ROOM.z1, ROOM.h, M_.wall, ROOM.x2, ROOM.h / 2, (ROOM.z1 + ROOM.z2) / 2, 0, -Math.PI / 2);
    // back wall faces +z, with a doorway for the staff room
    const backDoorX = 2.7, backDoorW = 1.05;
    plane((backDoorX - backDoorW / 2) - ROOM.x1, ROOM.h, M_.wall,
      (ROOM.x1 + backDoorX - backDoorW / 2) / 2, ROOM.h / 2, ROOM.z1, 0, 0);
    plane(ROOM.x2 - (backDoorX + backDoorW / 2), ROOM.h, M_.wall,
      (ROOM.x2 + backDoorX + backDoorW / 2) / 2, ROOM.h / 2, ROOM.z1, 0, 0);
    // header above the doorway
    plane(backDoorW, ROOM.h - 2.28, M_.wall, backDoorX, (ROOM.h + 2.28) / 2, ROOM.z1, 0, 0);
    // front wall above glass
    box(ROOM.x2 - ROOM.x1, 0.25, 0.12, M_.wall, 0, ROOM.h - 0.125, ROOM.z2);
    // baseboard strips
    const baseMat = std({ color: 0x35322c, roughness: 0.9 });
    box(0.04, 0.16, ROOM.z2 - ROOM.z1, baseMat, ROOM.x1 + 0.02, 0.08, (ROOM.z1 + ROOM.z2) / 2);
    box(0.04, 0.16, ROOM.z2 - ROOM.z1, baseMat, ROOM.x2 - 0.02, 0.08, (ROOM.z1 + ROOM.z2) / 2);
    box(ROOM.x2 - ROOM.x1, 0.16, 0.04, baseMat, 0, 0.08, ROOM.z1 + 0.02);

    // wall colliders (leave the staff-room doorway walkable until the door blocks it)
    collider(ROOM.x1 - 1, ROOM.z1 - 1, ROOM.x1 + 0.1, ROOM.z2 + 1);
    collider(ROOM.x2 - 0.1, ROOM.z1 - 1, ROOM.x2 + 1, ROOM.z2 + 1);
    collider(ROOM.x1 - 1, ROOM.z1 - 1, backDoorX - backDoorW / 2, ROOM.z1 + 0.1);
    collider(backDoorX + backDoorW / 2, ROOM.z1 - 1, ROOM.x2 + 1, ROOM.z1 + 0.1);
    // front glass / door (player stays inside)
    collider(ROOM.x1 - 1, ROOM.z2 - 0.05, ROOM.x2 + 1, ROOM.z2 + 1.2);

    // scuffs on lower walls: thin dark decal strips
    const scuffMat = new THREE.MeshBasicMaterial({ color: 0x2a2824, transparent: true, opacity: 0.22, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const z = -5 + Math.random() * 10.5;
      const h = 0.05 + Math.random() * 0.24;
      box(0.01, h, 0.5 + Math.random() * 1.2, scuffMat, ROOM.x1 + 0.03, 0.2 + h / 2, z);
    }
  }

  /* ============================================================
   * Front glass / facade
   * ============================================================ */
  function buildFront() {
    const front = new THREE.Group();
    World.root.add(front);
    const glass = M_.glass;
    const frames = M_.metalDark;

    // window sections: left of door, right of door
    const sections = [
      { x1: -4.6, x2: -1.85 },
      { x1: -0.35, x2: 4.6 }
    ];
    for (const s of sections) {
      const w = s.x2 - s.x1;
      const cx = (s.x1 + s.x2) / 2;
      // glass
      plane(w - 0.12, 2.55, glass, cx, 1.55, ROOM.z2, 0, Math.PI, front);
      // lower kick plate
      box(w, 0.22, 0.1, M_.metalDark, cx, 0.11, ROOM.z2, front);
      // mullions
      box(0.10, 2.9, 0.14, frames, s.x1, 1.45, ROOM.z2, front);
      box(0.10, 2.9, 0.14, frames, s.x2, 1.45, ROOM.z2, front);
      // horizontal rail
      box(w, 0.07, 0.12, frames, cx, 2.72, ROOM.z2, front);
      box(w, 0.05, 0.1, frames, cx, 0.22, ROOM.z2, front);
    }
    // door frame + sliding glass door (offset a bit, seen from inside)
    box(0.12, 2.6, 0.2, frames, -1.85, 1.3, ROOM.z2, front);
    box(0.12, 2.6, 0.2, frames, -0.35, 1.3, ROOM.z2, front);
    box(1.5, 0.14, 0.22, frames, -1.1, 2.56, ROOM.z2, front);
    box(1.5, 0.1, 0.14, frames, -1.1, 0.05, ROOM.z2, front);
    const doorGlass = plane(1.38, 2.4, M_.glassDoor, -1.1, 1.3, ROOM.z2 - 0.06, 0, Math.PI, front);
    World.doorGlass = doorGlass;
    doorGlass.userData.homeX = -1.1;
    // door handle
    box(0.03, 0.5, 0.06, M_.metal, -0.55, 1.25, ROOM.z2 - 0.16, front);
    // door frame sticker "营业中"
    const openTex = canvasTextSign('营业中', '#e8f6ff', 'rgba(20,80,120,0.35)', 512, 160, 92, CN_FONT);
    const openMat = new THREE.MeshBasicMaterial({ map: openTex, transparent: true, depthWrite: false });
    plane(0.9, 0.28, openMat, -1.1, 2.25, ROOM.z2 - 0.13, 0, Math.PI, front);

    // reflection smudge overlay
    const smudgeTex = makeSmudgeTexture();
    const smudgeMat = new THREE.MeshBasicMaterial({ map: smudgeTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    plane(8.9, 2.5, smudgeMat, 0, 1.55, ROOM.z2 - 0.01, 0, Math.PI, front);
    // interior reflection: ceiling strips & warm counter glow on the glass
    const glassReflMat = new THREE.MeshBasicMaterial({
      map: makeGlassReflection(), transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    plane(8.9, 2.55, glassReflMat, 0, 1.55, ROOM.z2 - 0.015, 0, Math.PI, front);

    // rain streaks on glass
    T.rainStreak().repeat.set(2.4, 1);
    const rainMat = new THREE.MeshBasicMaterial({
      map: T.rainStreak(), transparent: true, opacity: 0.26, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xa8c8d8
    });
    World.rainGlass = plane(8.8, 2.5, rainMat, 0, 1.55, ROOM.z2 - 0.02, 0, Math.PI, front);

    // posters taped to window (inside)
    const posterMat = new THREE.MeshStandardMaterial({ map: T.posterAds(0), roughness: 0.9, emissive: 0x111111, emissiveIntensity: 0.2 });
    plane(0.66, 0.88, posterMat, 3.55, 1.62, ROOM.z2 - 0.02, 0, Math.PI, front);
    // tape
    const tapeMat = new THREE.MeshBasicMaterial({ color: 0xd8d0b0, transparent: true, opacity: 0.35, depthWrite: false });
    box(0.16, 0.05, 0.01, tapeMat, 3.24, 2.05, ROOM.z2 - 0.035, front);
    box(0.16, 0.05, 0.01, tapeMat, 3.86, 1.19, ROOM.z2 - 0.035, front);
    const posterMat2 = new THREE.MeshStandardMaterial({ map: T.posterAds(1), roughness: 0.9 });
    plane(0.72, 0.96, posterMat2, -2.9, 1.55, ROOM.z2 - 0.02, 0, Math.PI, front);
    // missing person poster taped at left
    const missMat = new THREE.MeshStandardMaterial({ map: T.missingPoster(), roughness: 0.95 });
    plane(0.8, 1.14, missMat, -2.95, 1.6, ROOM.z2 - 0.03, 0, Math.PI, front);
    World.missingPoster = missMat;
    // a second, smaller one by the door
    plane(0.5, 0.71, missMat.clone(), -1.72, 1.75, ROOM.z2 - 0.32, 0, Math.PI, front);

    // exterior facade above glass
    const facadeMat = std({ color: 0x4a4a44, roughness: 0.95 });
    box(9.6, 3.2, 0.35, facadeMat, 0, 4.55, ROOM.z2 + 0.2);
    // facade tile around
    const tileMat = std({ color: 0x5c5a4e, roughness: 0.8 });
    box(0.5, 3.0, 0.4, tileMat, -4.85, 1.5, ROOM.z2 + 0.15);
    box(0.5, 3.0, 0.4, tileMat, 4.85, 1.5, ROOM.z2 + 0.15);
    // awning
    const awningMat = std({ color: 0x22332a, roughness: 0.85 });
    box(9.9, 0.18, 1.3, awningMat, 0, 3.15, ROOM.z2 + 0.6);
    box(9.9, 0.06, 0.1, M_.metalDark, 0, 3.07, ROOM.z2 + 1.22);
    // hanging sign
    const signMat = new THREE.MeshStandardMaterial({
      map: T.storeSign(), emissiveMap: T.storeSign(), emissive: 0x9fe8bc, emissiveIntensity: 1.25, roughness: 0.6
    });
    plane(4.4, 1.1, signMat, 0, 3.95, ROOM.z2 + 0.42, 0, 0);
    World.signMat = signMat;
    glowSprite(0x8fffc0, 5.2, 0, 3.95, ROOM.z2 + 0.7, 0.16);
    // sign tubes
    for (let i = 0; i < 2; i++) {
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xdcffe8, transparent: true, opacity: 0.9 });
      box(2.2, 0.035, 0.035, tubeMat, 0, 4.3 + i * 0.0, ROOM.z2 + 0.75);
    }
    // neon 24h in the right window
    const neonMat = new THREE.MeshBasicMaterial({
      map: T.neon24(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85
    });
    plane(0.7, 0.35, neonMat, 3.8, 2.42, ROOM.z2 - 0.05, 0, Math.PI);
    glowSprite(0xff6a50, 1.4, 3.8, 2.42, ROOM.z2 + 0.06, 0.18);

    // hanging bell above door (animated)
    const bellGroup = new THREE.Group();
    bellGroup.position.set(-1.1, 2.5, ROOM.z2 - 0.18);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 10, 1, true), std({ color: 0xb08a3e, metalness: 0.85, roughness: 0.3 }));
    bell.position.y = -0.12; bell.rotation.x = Math.PI;
    bellGroup.add(bell);
    const bellString = new THREE.Mesh(G.cylLow, M_.metalDark);
    bellString.scale.set(0.005, 0.22, 0.005); bellString.position.y = 0.0;
    bellGroup.add(bellString);
    World.root.add(bellGroup);
    World.bell = bellGroup;

    // exterior street number & small signs
    const numMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c4, emissive: 0x222222, roughness: 0.8 });
    const numTex = canvasTextSign('长夜路 24', '#dfe8e0', 'rgba(0,0,0,0)', 512, 128, 64, CN_FONT);
    plane(1.1, 0.27, new THREE.MeshBasicMaterial({ map: numTex, transparent: true }), -3.9, 2.78, ROOM.z2 - 0.02, 0, Math.PI);
  }

  function makeSmudgeTexture() {
    const c = T.cnv(512, 512), g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 20 + Math.random() * 80;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, `rgba(210,230,235,${0.02 + Math.random() * 0.08})`);
      gr.addColorStop(1, 'rgba(210,230,235,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(220,240,245,${Math.random() * 0.05})`;
      g.lineWidth = 1;
      g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 100, 0, 6.283); g.stroke();
    }
    return T.mkTex(c, { linear: true });
  }

  function makeGlassReflection() {
    const W = 1024, H = 512, c = T.cnv(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) {
      const y = 70 + i * 96;
      const gr = g.createLinearGradient(0, y - 26, 0, y + 26);
      gr.addColorStop(0, 'rgba(150,200,170,0)');
      gr.addColorStop(0.5, `rgba(175,220,190,${0.10 - i * 0.02})`);
      gr.addColorStop(1, 'rgba(150,200,170,0)');
      g.fillStyle = gr; g.fillRect(0, y - 26, W, 52);
      const x = 180 + i * 280;
      const gx = g.createRadialGradient(x, y, 2, x, y, 150);
      gx.addColorStop(0, 'rgba(220,255,230,0.12)');
      gx.addColorStop(0.3, 'rgba(190,235,205,0.04)');
      gx.addColorStop(1, 'rgba(190,235,205,0)');
      g.fillStyle = gx; g.fillRect(x - 150, y - 150, 300, 300);
    }
    const wg = g.createRadialGradient(180, 380, 4, 180, 380, 260);
    wg.addColorStop(0, 'rgba(255,190,120,0.10)');
    wg.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = wg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(200,220,220,${Math.random() * 0.03})`;
      g.lineWidth = 0.7 + Math.random() * 1.4;
      const x = Math.random() * W, y = Math.random() * H;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 40, y + Math.random() * 50); g.stroke();
    }
    return T.mkTex(c, { linear: true });
  }

  const CN_FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
  function makePosTexture() {
    const c = T.cnv(384, 288), g = c.getContext('2d');
    g.fillStyle = '#0a1410'; g.fillRect(0, 0, 384, 288);
    g.fillStyle = '#183a2a'; g.fillRect(0, 0, 384, 44);
    g.fillStyle = '#9fe8c0'; g.font = 'bold 22px ' + CN_FONT; g.textAlign = 'left';
    g.fillText('长夜便利店  POS', 16, 30);
    g.font = '14px ' + CN_FONT; g.fillStyle = 'rgba(150,220,180,0.7)';
    g.fillText('收银员：林岳    班次：夜班', 16, 70);
    g.fillStyle = 'rgba(150,220,180,0.9)'; g.font = '16px ' + CN_FONT;
    g.fillText('商品', 18, 108); g.fillText('金额', 300, 108);
    const rows = [['热美式', '8.00'], ['红双喜', '24.00'], ['——', '——']];
    g.font = '15px ' + CN_FONT; g.fillStyle = 'rgba(170,220,190,0.7)';
    rows.forEach((r, i) => { g.fillText(r[0], 18, 142 + i * 30); g.fillText(r[1], 306, 142 + i * 30); });
    g.strokeStyle = 'rgba(120,190,150,0.3)'; g.beginPath(); g.moveTo(16, 232); g.lineTo(368, 232); g.stroke();
    g.fillStyle = '#cfe8d4'; g.font = 'bold 28px ' + CN_FONT;
    g.fillText('合计', 18, 268); g.fillStyle = '#8fe8b8';
    g.textAlign = 'right'; g.fillText('¥ 0.00', 368, 268);
    return T.mkTex(c);
  }
  function canvasTextSign(text, color, bg, w, h, size, font) {
    const c = T.cnv(w, h), g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (bg && bg !== 'rgba(0,0,0,0)') { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = color;
    g.font = 'bold ' + size + 'px ' + (font || CN_FONT);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    return T.mkTex(c);
  }

  /* ============================================================
   * Counter + POS + monitor
   * ============================================================ */
  function buildCounter() {
    const g = new THREE.Group();
    World.root.add(g);
    // L-shaped long counter, along x
    box(3.6, 1.04, 0.8, M_.counterDark, 2.55, 0.52, 3.8, g);
    // counter top
    box(3.72, 0.06, 0.92, M_.counter, 2.55, 1.07, 3.8, g);
    // front panel
    box(3.6, 0.98, 0.04, M_.counter, 2.55, 0.49, 4.21, g);
    // side return (short)
    box(0.8, 1.04, 1.5, M_.counterDark, 4.15, 0.52, 2.95, g);
    box(0.92, 0.06, 1.62, M_.counter, 4.15, 1.07, 2.95, g);
    // kick plate
    box(3.6, 0.12, 0.03, M_.metalDark, 2.55, 0.08, 4.24, g);
    // collider around counter
    collider(0.65, 3.3, 4.62, 4.3);
    collider(3.65, 2.1, 4.62, 3.4);

    // counter surface props
    // cash register (POS)
    box(0.40, 0.14, 0.34, M_.plasticBlack, 3.45, 1.15, 3.72, g);
    const posScreen = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: makePosTexture() }));
    posScreen.scale.set(0.27, 0.20, 1);
    posScreen.position.set(3.45, 1.33, 3.60);
    posScreen.rotation.x = -0.5;
    posScreen.rotation.y = Math.PI;
    g.add(posScreen);
    box(0.28, 0.05, 0.22, M_.plasticBlack, 3.45, 1.24, 3.62, g);
    // barcode scanner
    box(0.15, 0.065, 0.15, M_.plasticBlack, 3.02, 1.13, 3.62, g);
    box(0.105, 0.008, 0.105, new THREE.MeshBasicMaterial({ color: 0x3a0909 }), 3.02, 1.165, 3.62, g);
    // card reader
    box(0.13, 0.09, 0.10, M_.plasticBlack, 2.78, 1.12, 3.55, g);
    // receipt printer
    box(0.20, 0.13, 0.18, std({ color: 0x6a6d68, roughness: 0.65 }), 2.15, 1.135, 3.55, g);
    box(0.15, 0.012, 0.015, M_.paper, 2.15, 1.20, 3.47, g);
    // small scanner light
    const scanLight = glowSprite(0xff3b30, 0.12, 3.02, 1.17, 3.62, 0.22, g);
    World.scanLight = scanLight;
    // customer-facing price display
    const disp = box(0.26, 0.1, 0.08, M_.plasticBlack, 3.85, 1.22, 4.16, g);
    const dispTex = canvasTextSign('¥ 0.00', '#8fe8b8', 'rgba(5,10,8,0.9)', 256, 96, 52, CN_FONT);
    plane(0.24, 0.09, new THREE.MeshBasicMaterial({ map: dispTex }), 3.85, 1.22, 4.21, 0, 0, g);
    // pen + notepad + buzzer + bell
    box(0.05, 0.012, 0.22, M_.plasticBlack, 1.78, 1.082, 3.55, g);
    box(0.22, 0.012, 0.3, M_.paper, 1.55, 1.078, 3.8, g);
    box(0.09, 0.045, 0.09, M_.plasticBlack, 2.5, 1.095, 4.02, g);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xb08a3e, metalness: 0.8, roughness: 0.3 }));
    bell.position.set(2.5, 1.075, 3.88);
    g.add(bell);
    box(0.02, 0.012, 0.02, M_.metal, 2.5, 1.08, 3.88, g);

    // CCTV monitor (facing player)
    const mg = new THREE.Group();
    mg.position.set(1.25, 1.28, 3.62);
    mg.rotation.y = Math.PI - 0.42;
    box(0.46, 0.36, 0.34, M_.plasticBlack, 0, 0, 0, mg);
    const mt = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: 0x0a0d0a }));
    mt.scale.set(0.36, 0.27, 1); mt.position.set(0, 0.02, 0.18); mg.add(mt);
    World.monitorScreen = mt;
    box(0.08, 0.12, 0.06, M_.plasticBlack, 0, -0.2, 0, mg);
    g.add(mg);
    const stand = box(0.3, 0.04, 0.3, M_.plasticBlack, 1.25, 1.08, 3.62, g);
    // scan overlay
    const scanMat = new THREE.MeshBasicMaterial({ map: T.scanlines(), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const scanPlane = new THREE.Mesh(G.plane, scanMat);
    scanPlane.scale.set(0.36, 0.27, 1);
    scanPlane.position.set(0, 0.02, 0.182);
    mg.add(scanPlane);
    const recGlow = glowSprite(0xff2a1a, 0.16, 0.15, 0.13, 0.19, 0.8, mg);
    World.recGlow = recGlow;

    // gun under counter (invisible anchor)
    World.gunAnchor = new THREE.Object3D();
    World.gunAnchor.position.set(1.7, 0.75, 3.55);
    // radio behind the register
    const radio = new THREE.Group();
    radio.position.set(3.05, 1.12, 3.55);
    radio.rotation.y = -0.3;
    box(0.26, 0.13, 0.16, M_.plasticBlack, 0, 0, 0, radio);
    box(0.1, 0.07, 0.01, new THREE.MeshBasicMaterial({ color: 0x5aa06a }), -0.06, 0.01, 0.085, radio);
    box(0.03, 0.03, 0.02, M_.metal, 0.09, 0.02, 0.085, radio);
    const antenna = new THREE.Mesh(G.cylLow, M_.metal);
    antenna.scale.set(0.003, 0.28, 0.003); antenna.position.set(0.11, 0.2, 0); radio.add(antenna);
    g.add(radio);
    World.points.radio = { pos: new THREE.Vector3(3.05, 0, 3.45), label: '收音机', dist: 1.5 };
    World.points.monitor = { pos: new THREE.Vector3(1.25, 0, 3.45), label: '监控画面', dist: 1.5 };
    World.points.register = { pos: new THREE.Vector3(2.55, 0, 3.5), label: '收银台', dist: 1.5 };
    g.add(World.gunAnchor);

    // cigarette cabinet behind counter (right wall)
    const cab = new THREE.Group();
    cab.position.set(4.52, 1.55, 2.4);
    cab.rotation.y = -Math.PI / 2;
    box(2.4, 1.7, 0.22, M_.wood, 0, 0, 0, cab);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const m = new THREE.MeshStandardMaterial({ map: T.cigPack(), roughness: 0.7 });
        const p = plane(0.12, 0.18, m, -1.05 + col * 0.27, 0.6 - row * 0.3, 0.12, 0, 0, cab);
      }
    }
    box(2.5, 0.08, 0.3, M_.metalDark, 0, 0.88, 0.03, cab);
    World.root.add(cab);
    glowSprite(0xffdca0, 1.2, 4.2, 1.9, 2.4, 0.12);

    // security camera in corner
    const camGroup = new THREE.Group();
    camGroup.position.set(4.2, 2.78, 5.6);
    camGroup.rotation.y = -2.3;
    box(0.16, 0.14, 0.26, M_.plasticWhite, 0, 0, 0, camGroup);
    box(0.09, 0.09, 0.03, M_.plasticBlack, 0, 0, 0.15, camGroup);
    const camLed = glowSprite(0xff2a1a, 0.07, 0.06, 0.06, 0.03, 0.6, camGroup);
    World.root.add(camGroup);
    World.securityCam = camGroup;

    // trash bin
    box(0.44, 0.66, 0.44, M_.metal, 1.0, 0.33, 4.7, g);
    box(0.46, 0.06, 0.46, M_.plasticBlack, 1.0, 0.68, 4.7, g);
    collider(0.72, 4.42, 1.28, 4.98);

    // right-wall dressing (seen on the player's left when facing the window)
    const rulesMat = new THREE.MeshStandardMaterial({ map: T.rulesBoard(), roughness: 0.95 });
    plane(0.52, 0.78, rulesMat, 4.585, 1.7, 4.55, 0, -Math.PI / 2);
    const calTex = canvasTextSign('十二月', '#2a241c', 'rgba(220,210,190,0.94)', 512, 700, 54, CN_FONT);
    plane(0.38, 0.52, new THREE.MeshBasicMaterial({ map: calTex }), 4.585, 2.02, 5.25, 0, -Math.PI / 2);
    const noSmokeTex = canvasTextSign('请勿吸烟', '#f0e4d0', 'rgba(130,30,24,0.9)', 512, 160, 70, CN_FONT);
    plane(0.5, 0.16, new THREE.MeshBasicMaterial({ map: noSmokeTex }), 4.585, 2.42, 4.2, 0, -Math.PI / 2);
    // extinguisher
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.52, 12), std({ color: 0x8a1f18, roughness: 0.55, metalness: 0.15 }));
    ext.position.set(4.3, 0.36, 5.5);
    World.root.add(ext);
    const extTop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), M_.plasticBlack);
    extTop.position.set(4.3, 0.66, 5.5);
    World.root.add(extTop);
    const extLabel = plane(0.12, 0.18, new THREE.MeshBasicMaterial({ color: 0xe8e0c8 }), 4.21, 0.38, 5.5, 0, -Math.PI / 2);
    // a small shelf with spare cups
    box(0.28, 0.03, 0.7, M_.metal, 4.43, 1.92, 5.0);
    for (let i = 0; i < 3; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 8), std({ color: 0xd8d2c4, roughness: 0.8 }));
      cup.position.set(4.43, 1.99, 4.78 + i * 0.22);
      World.root.add(cup);
    }
    // hanging promo above the counter / window
    const promoMat = new THREE.MeshStandardMaterial({ map: T.posterAds(2), roughness: 0.85, side: THREE.DoubleSide });
    plane(0.5, 0.66, promoMat, 1.15, 2.55, 5.35, 0, 0);
    plane(0.5, 0.66, promoMat, 1.15, 2.55, 5.35, 0, Math.PI);
    box(0.008, 0.35, 0.008, M_.metalDark, 0.9, 3.0, 5.35);
    box(0.008, 0.35, 0.008, M_.metalDark, 1.4, 3.0, 5.35);
  }

  /* ============================================================
   * Shelves / products
   * ============================================================ */
  function buildShelves() {
    const labels = T.productLabels();
    const shelfMat = std({ color: 0x8a8c86, metalness: 0.45, roughness: 0.6 });
    const boardMat = std({ color: 0xb8b8ae, roughness: 0.7 });
    const gondolas = [
      { x: -2.75, z: 0.1, len: 5.0, ry: 0 },
      { x: -0.65, z: 0.1, len: 5.0, ry: 0 }
    ];
    let count = 0;
    for (const gd of gondolas) {
      const x = gd.x, z = gd.z, len = gd.len;
      // base
      box(0.9, 0.12, len, M_.metalDark, x, 0.06, z);
      // vertical ends
      box(0.06, 1.95, 0.9, shelfMat, x, 0.98, z - len / 2);
      box(0.06, 1.95, 0.9, shelfMat, x, 0.98, z + len / 2);
      // back panel
      box(0.05, 1.85, len, boardMat, x + 0.2, 0.96, z);
      // shelves
      for (let i = 0; i < 5; i++) {
        const y = 0.28 + i * 0.38;
        box(0.82, 0.03, len - 0.05, boardMat, x, y, z);
        // products (instanced per row side)
        const n = Math.floor((len - 0.3) / 0.14);
        for (const side of [-1, 1]) {
          const instCount = Math.floor(n / 2);
          const geo = new THREE.BoxGeometry(0.11, 0.22 + Math.random() * 0.05, 0.09);
          const label = labels[(i + (side > 0 ? 3 : 0)) % labels.length];
          const mat = new THREE.MeshStandardMaterial({
            map: label, roughness: 0.55, metalness: 0.1,
            color: 0xffffff
          });
          const inst = new THREE.InstancedMesh(geo, mat, instCount);
          inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
          const dummy = new THREE.Object3D();
          for (let k = 0; k < instCount; k++) {
            dummy.position.set(
              x + side * 0.16,
              y + 0.045 + 0.11,
              z - len / 2 + 0.25 + k * 0.27
            );
            dummy.rotation.set(0, side > 0 ? 0 : Math.PI, 0);
            dummy.scale.set(1, 0.96 + Math.random() * 0.08, 1);
            dummy.updateMatrix();
            inst.setMatrixAt(k, dummy.matrix);
          }
          inst.instanceMatrix.needsUpdate = true;
          World.root.add(inst);
          count++;
        }
        // price rail
        box(0.02, 0.05, len - 0.1, M_.plasticWhite, x - 0.24, y - 0.02, z);
        box(0.02, 0.05, len - 0.1, M_.plasticWhite, x + 0.24, y - 0.02, z);
      }
      collider(x - 0.55, z - len / 2, x + 0.55, z + len / 2);
      shadowBlob(x, z, 1.4, len + 0.3, 0.55);
    }
    // end cap promo
    const endMat = new THREE.MeshStandardMaterial({ map: T.posterAds(2), roughness: 0.8 });
    plane(0.8, 1.05, endMat, -2.75, 1.2, 2.62, 0, 0);
    // low baskets near shelves
    box(0.5, 0.24, 0.36, std({ color: 0x8a3a2c, roughness: 0.8 }), -1.65, 0.12, 2.5);
    // fallen price tags
    for (let i = 0; i < 3; i++) {
      plane(0.1, 0.06, new THREE.MeshBasicMaterial({ map: T.priceTag(), transparent: true }), -2 + Math.random() * 3, 0.006, 0.5 + Math.random() * 4, -Math.PI / 2, 0);
    }
  }

  /* ============================================================
   * Fridges (back wall)
   * ============================================================ */
  function buildFridges() {
    const fx1 = -4.45, fx2 = 0.15;
    const w = fx2 - fx1, cx = (fx1 + fx2) / 2;
    const group = new THREE.Group(); World.root.add(group);
    // cabinet shell (open front)
    box(w, 2.15, 0.12, M_.fridge, cx, 1.1, ROOM.z1 + 0.08, group);
    box(0.1, 2.15, 0.8, M_.fridge, fx1 - 0.05, 1.1, ROOM.z1 + 0.4, group);
    box(0.1, 2.15, 0.8, M_.fridge, fx2 + 0.05, 1.1, ROOM.z1 + 0.4, group);
    box(w, 0.1, 0.8, M_.fridge, cx, 2.13, ROOM.z1 + 0.4, group);
    box(w, 0.12, 0.8, M_.fridge, cx, 0.06, ROOM.z1 + 0.4, group);
    // inner glow / diffuser
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xbfe4f2 });
    plane(w - 0.24, 1.85, innerMat, cx, 1.2, ROOM.z1 + 0.16, 0, 0, group);
    World.fridgeGlowMat = innerMat;
    // shelves of bottles
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0xa9d6d0, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.9 });
    const bottleMat2 = new THREE.MeshStandardMaterial({ color: 0xd6b48a, roughness: 0.22 });
    for (let row = 0; row < 5; row++) {
      box(w - 0.3, 0.02, 0.5, M_.metal, cx, 0.42 + row * 0.37, ROOM.z1 + 0.52, group);
      for (let i = 0; i < 22; i++) {
        const m = i % 5 === 0 ? bottleMat2 : bottleMat;
        const b = new THREE.Mesh(G.cylLow, m);
        const s = 0.028 + Math.random() * 0.01;
        b.scale.set(s, 0.22 + Math.random() * 0.06, s);
        b.position.set(fx1 + 0.28 + i * ((w - 0.5) / 22), 0.55 + row * 0.37, ROOM.z1 + 0.52);
        group.add(b);
      }
    }
    // door frames + glass
    const nDoors = 3;
    const dw = w / nDoors;
    for (let i = 0; i <= nDoors; i++) {
      box(0.06, 2.2, 0.06, M_.metalDark, fx1 + i * dw, 1.1, ROOM.z1 + 0.76, group);
    }
    box(w, 0.06, 0.06, M_.metalDark, cx, 2.17, ROOM.z1 + 0.76, group);
    box(w, 0.06, 0.06, M_.metalDark, cx, 0.06, ROOM.z1 + 0.76, group);
    for (let i = 0; i < nDoors; i++) {
      plane(dw - 0.1, 1.98, M_.glassDoor, fx1 + dw / 2 + i * dw, 1.12, ROOM.z1 + 0.77, 0, 0, group);
      // handle
      box(0.035, 0.5, 0.05, M_.metal, fx1 + dw * (i + 1) - 0.13, 1.15, ROOM.z1 + 0.82, group);
    }
    // top light box
    box(w, 0.08, 0.16, new THREE.MeshBasicMaterial({ color: 0xe6faff }), cx, 2.3, ROOM.z1 + 0.6, group);
    glowSprite(0xb8e8ff, 2.6, cx, 1.5, ROOM.z1 + 0.8, 0.18);
    collider(fx1 - 0.1, ROOM.z1, fx2 + 0.1, ROOM.z1 + 0.9);
    shadowBlob(cx, ROOM.z1 + 0.9, w + 1, 1.6, 0.5);

    // fridge light
    const fl = new THREE.PointLight(0xbfe6ff, 0.5, 5.0, 2);
    fl.position.set(-1.8, 1.4, ROOM.z1 + 1.1);
    World.root.add(fl);
    World.lights.fridge = fl;
  }

  /* ============================================================
   * Back room
   * ============================================================ */
  function buildBackRoom() {
    const doorX = 2.7, doorW = 1.05;
    // door
    const doorMesh = box(doorW, 2.2, 0.08, M_.wood, doorX, 1.1, ROOM.z1 + 0.05);
    World.doorMesh = doorMesh;
    box(doorW + 0.12, 0.08, 0.12, M_.metalDark, doorX, 2.24, ROOM.z1 + 0.06);
    box(doorW + 0.12, 0.08, 0.12, M_.metalDark, doorX, 0.02, ROOM.z1 + 0.06);
    // handle
    box(0.05, 0.14, 0.06, M_.metal, doorX - 0.4, 1.05, ROOM.z1 + 0.12);
    // sign
    const staffTex = canvasTextSign('员工专用', '#e8e0cc', 'rgba(30,26,22,0.9)', 512, 160, 76, CN_FONT);
    plane(0.62, 0.2, new THREE.MeshBasicMaterial({ map: staffTex, transparent: true }), doorX, 1.8, ROOM.z1 + 0.11, 0, 0);
    // EXIT sign above
    const exitMat = new THREE.MeshBasicMaterial({ map: T.exitSign(), transparent: false });
    plane(0.8, 0.25, exitMat, doorX, 2.52, ROOM.z1 + 0.12, 0, 0);
    glowSprite(0x7dff9a, 1.2, doorX, 2.52, ROOM.z1 + 0.2, 0.22);
    // door collider blocks unless opened
    World.backRoomDoorCollider = { x1: doorX - doorW / 2, z1: ROOM.z1 - 0.2, x2: doorX + doorW / 2, z2: ROOM.z1 + 0.2 };
    World.backRoomDoorCollider = collider(doorX - doorW / 2, ROOM.z1, doorX + doorW / 2, ROOM.z1 + 0.15);
    World.points.backdoor = { pos: new THREE.Vector3(doorX, 0, ROOM.z1 + 0.7), label: '后仓门', dist: 1.6 };

    // shallow back room interior behind the wall (visual only)
    const br = new THREE.Group();
    br.position.set(doorX, 0, ROOM.z1 - 0.02);
    const brMat = std({ color: 0x37342e, roughness: 0.95 });
    plane(2.6, 2.3, brMat, 0, 1.15, -2.2, 0, 0, br);
    plane(2.6, 0.01, brMat, 0, 0.01, -1.1, -Math.PI / 2, 0, br);
    box(0.1, 2.2, 2.2, brMat, -1.25, 1.1, -1.1, br);
    box(0.1, 2.2, 2.2, brMat, 1.25, 1.1, -1.1, br);
    // fuse box
    box(0.34, 0.5, 0.12, M_.metal, 0.8, 1.55, -2.14, br);
    box(0.28, 0.04, 0.02, M_.plasticBlack, 0.8, 1.67, -2.22, br);
    World.points.fusebox = { pos: new THREE.Vector3(doorX + 0.9, 0, ROOM.z1 - 1.0), label: '配电箱', dist: 1.5 };
    // mop + bucket in back room
    box(0.28, 0.34, 0.28, M_.plasticBlack, -0.6, 0.17, -1.0, br);
    const mopHandle = new THREE.Mesh(G.cylLow, M_.wood);
    mopHandle.scale.set(0.02, 1.3, 0.02); mopHandle.position.set(-0.5, 0.8, -1.0); mopHandle.rotation.z = 0.2;
    br.add(mopHandle);
    // posters / notes
    const noteMat = new THREE.MeshStandardMaterial({ map: T.note(), roughness: 0.95 });
    plane(0.6, 0.8, noteMat, -0.62, 1.6, -2.18, 0, 0, br);
    World.points.noteBack = { pos: new THREE.Vector3(doorX - 0.4, 0, ROOM.z1 - 0.85), label: '墙上的便签', dist: 1.5 };
    // side & rear colliders of the staff room
    collider(doorX - 1.3, ROOM.z1 - 2.3, doorX - 1.15, ROOM.z1);
    collider(doorX + 1.15, ROOM.z1 - 2.3, doorX + 1.3, ROOM.z1);
    collider(doorX - 1.3, ROOM.z1 - 2.35, doorX + 1.3, ROOM.z1 - 2.2);
    // dim light inside
    const brLight = new THREE.PointLight(0xa8c8b8, 0.0, 3.5, 2);
    brLight.position.set(0, 2.0, -1.0); br.add(brLight);
    World.lights.staff = brLight;
    const brPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshBasicMaterial({ color: 0x6f9a80 }));
    brPanel.position.set(0, 2.15, -2.15); br.add(brPanel);
    World.root.add(br);
    br.visible = false;
    World.backRoomGroup = br;

    // back door (rear exit) inside back room, visual
    box(0.9, 2.0, 0.06, M_.metalDark, doorX, 1.0, ROOM.z1 - 2.2, br);
    World.root.add(br);
  }

  /* ============================================================
   * Right wall service area / coffee / warmer
   * ============================================================ */
  function buildServiceWall() {
    const g = new THREE.Group(); World.root.add(g);
    // counter cabinet along right wall
    box(0.55, 0.92, 2.3, M_.counterDark, 4.25, 0.46, 0.2, g);
    box(0.62, 0.05, 2.4, M_.counter, 4.25, 0.95, 0.2, g);
    collider(3.9, -1.0, 4.6, 1.4);
    // coffee machine
    box(0.42, 0.6, 0.46, M_.plasticBlack, 4.2, 1.28, 0.05, g);
    box(0.3, 0.12, 0.06, M_.plasticWhite, 4.2, 1.4, 0.3, g);
    const coffeeLight = glowSprite(0xffb35c, 0.4, 4.0, 1.32, 0.32, 0.35, g);
    box(0.26, 0.05, 0.26, M_.metal, 4.2, 1.0, 0.05, g);
    // cup stack
    for (let i = 0; i < 4; i++) {
      const cup = new THREE.Mesh(G.cylLow, new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.8 }));
      cup.scale.set(0.035, 0.08, 0.035);
      cup.position.set(4.25, 1.03 + i * 0.02, 0.5);
      g.add(cup);
    }
    // hot food warmer
    box(0.56, 0.3, 0.9, M_.metal, 4.2, 1.13, 1.15, g);
    const warmerGlass = new THREE.MeshPhysicalMaterial({ color: 0xd8e8e0, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.0, side: THREE.DoubleSide });
    box(0.52, 0.22, 0.84, warmerGlass, 4.2, 1.2, 1.15, g);
    glowSprite(0xffa050, 0.9, 4.0, 1.2, 1.15, 0.3);
    // sausages
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(G.cylLow, new THREE.MeshStandardMaterial({ color: 0x9c3f26, roughness: 0.5 }));
      s.scale.set(0.018, 0.12, 0.018);
      s.position.set(4.03, 1.16, 0.82 + i * 0.14);
      s.rotation.z = Math.PI / 2;
      g.add(s);
    }
    // menu board above
    const mb = new THREE.MeshStandardMaterial({ map: T.menuBoard(), roughness: 0.7, emissive: 0x1a1208, emissiveIntensity: 0.6 });
    plane(1.0, 1.36, mb, 4.57, 2.0, 0.7, 0, -Math.PI / 2);
    // shelf with cups/lids
    box(0.5, 0.04, 2.0, M_.metal, 4.35, 1.6, 2.85);
    for (let i = 0; i < 6; i++) {
      const cup = new THREE.Mesh(G.cylLow, new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 }));
      cup.scale.set(0.04, 0.12, 0.04);
      cup.position.set(4.35, 1.72, 2.0 + i * 0.28);
      World.root.add(cup);
    }
    // mop bucket & wet floor sign (aisle)
    const bucket = box(0.34, 0.3, 0.34, new THREE.MeshStandardMaterial({ color: 0xc9b52a, roughness: 0.7 }), -1.4, 0.15, 2.2);
    const handle = new THREE.Mesh(G.cylLow, M_.metalDark);
    handle.scale.set(0.012, 0.9, 0.012); handle.position.set(-1.4, 0.6, 2.2); handle.rotation.z = 0.2; World.root.add(handle);
    const mopHead = new THREE.Mesh(G.sphereLow, new THREE.MeshStandardMaterial({ color: 0x8a8168, roughness: 0.95 }));
    mopHead.scale.set(0.12, 0.1, 0.12); mopHead.position.set(-1.36, 0.06, 2.2); World.root.add(mopHead);
    World.points.mop = { pos: new THREE.Vector3(-1.4, 0, 2.2), label: '拖把与水桶', dist: 1.6 };
    // wet floor sign
    const wf = new THREE.Group(); wf.position.set(-1.85, 0, 2.4); wf.rotation.y = 0.5;
    const wfMat = new THREE.MeshStandardMaterial({ color: 0xd8c838, roughness: 0.7 });
    const a = box(0.33, 0.5, 0.02, wfMat, 0, 0.26, 0, wf); a.rotation.x = -0.22;
    const b2 = box(0.33, 0.5, 0.02, wfMat, 0, 0.26, -0.14, wf); b2.rotation.x = 0.22;
    World.root.add(wf);

    // ATM / condom cabinet? ice cream freezer near door
    box(1.0, 0.8, 0.7, M_.plasticWhite, -3.9, 0.4, 4.4);
    box(1.02, 0.06, 0.72, M_.glass, -3.9, 0.82, 4.4);
    collider(-4.45, 4.0, -3.35, 4.8);
    // magazine rack
    const mr = new THREE.Group(); mr.position.set(-4.25, 0, 2.9); mr.rotation.y = Math.PI / 2;
    box(0.12, 1.3, 2.3, M_.metalDark, 0, 0.65, 0, mr);
    for (let i = 0; i < 4; i++) {
      const mm = new THREE.MeshStandardMaterial({ map: T.magazines()[i], roughness: 0.8 });
      const p = plane(0.42, 0.56, mm, 0.09, 1.0, 0.8 - i * 0.5, 0, Math.PI / 2, mr);
    }
    World.root.add(mr);
    collider(-4.45, 1.7, -3.9, 4.1);

    // cardboard boxes stacked near back
    box(0.5, 0.4, 0.5, M_.cardboard, 3.6, 0.2, -3.9);
    box(0.46, 0.36, 0.46, M_.cardboard, 3.55, 0.58, -3.85);
    box(0.5, 0.4, 0.5, M_.cardboard, 4.15, 0.2, -3.4);
    shadowBlob(3.85, -3.7, 1.4, 1.2, 0.45);
  }

  /* ============================================================
   * Ceiling lights
   * ============================================================ */
  function buildLights() {
    const panels = [
      { x: -2.4, z: 3.4 }, { x: 2.1, z: 3.4 },
      { x: -2.4, z: -0.6 }, { x: 2.1, z: -0.6 },
      { x: -0.2, z: -4.2 }
    ];
    World.ceilingPanels = [];
    World.lights.ceiling = [];
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xd8e8d0, emissive: 0xe4f2dc, emissiveIntensity: 2.1, roughness: 0.4
    });
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      const g = new THREE.Group();
      g.position.set(p.x, ROOM.h - 0.08, p.z);
      box(1.15, 0.06, 0.36, M_.metalDark, 0, 0.03, 0, g);
      const lamp = box(1.08, 0.035, 0.3, panelMat.clone(), 0, 0.0, 0, g);
      World.ceilingPanels.push(lamp);
      const gl = glowSprite(0xdcffd6, 3.2, 0, -0.06, 0, 0.16, g);
      World.root.add(g);
      if (i < 4) {
        const l = new THREE.PointLight(0xd6e8d2, 0.85, 8.5, 2);
        l.position.set(p.x, ROOM.h - 0.25, p.z);
        World.root.add(l);
        World.lights.ceiling.push(l);
      }
    }
    // hemisphere + ambient
    const hemi = new THREE.HemisphereLight(0x55646e, 0x0a0806, 0.28);
    World.root.add(hemi);
    const amb = new THREE.AmbientLight(0x1c2428, 0.36);
    World.root.add(amb);
    // warm counter light
    const warm = new THREE.PointLight(0xffc890, 0.9, 4.8, 2);
    warm.position.set(2.65, 2.15, 3.9);
    World.root.add(warm);
    World.lights.warm = warm;
    glowSprite(0xffcf96, 1.5, 2.65, 2.17, 3.9, 0.10);

    // wall clock above window (inside)
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-3.55, 2.55, ROOM.z2 - 0.06);
    clockGroup.rotation.y = Math.PI;
    const faceMat = new THREE.MeshStandardMaterial({ map: T.clockFace(), roughness: 0.8, emissive: 0x1a1814, emissiveIntensity: 0.15 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32), faceMat);
    clockGroup.add(face);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.015, 8, 32), M_.metalDark);
    clockGroup.add(ring);
    const handMat = new THREE.MeshBasicMaterial({ color: 0x1a1816 });
    const hourHand = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.14), handMat);
    hourHand.position.set(0, 0.06, 0.012);
    const minHand = new THREE.Mesh(new THREE.PlaneGeometry(0.013, 0.21), handMat);
    minHand.position.set(0, 0.1, 0.016);
    clockGroup.add(hourHand); clockGroup.add(minHand);
    World.clockHands = { hour: hourHand, minute: minHand };
    World.root.add(clockGroup);

    // hanging promo signs near ceiling
    const promo = new THREE.MeshStandardMaterial({ map: T.posterAds(0), roughness: 0.85, side: THREE.DoubleSide });
    plane(0.5, 0.66, promo, 0.6, 2.35, 1.0, 0, Math.PI);
    plane(0.5, 0.66, promo, 0.6, 2.35, 1.0, 0, 0);
    // hanging from thin wires
    box(0.008, 0.5, 0.008, M_.metalDark, 0.35, 2.75, 1.0);
    box(0.008, 0.5, 0.008, M_.metalDark, 0.85, 2.75, 1.0);

    // exit sign glow
    glowSprite(0x7dff9a, 1.0, 2.7, 2.52, ROOM.z1 + 0.2, 0.14);
  }

  /* ============================================================
   * Outside street
   * ============================================================ */
  function buildOutside() {
    const out = new THREE.Group();
    World.root.add(out);
    World.outside = out;
    const sidewalkTex = T.concrete();
    sidewalkTex.map.repeat.set(4, 3);
    const sidewalkMat = std({ map: sidewalkTex.map, roughness: 0.72, color: 0x666964 });
    const roadTex = T.asphalt();
    roadTex.map.repeat.set(8, 5);
    roadTex.rough.repeat.set(8, 5);
    const roadMat = std({ map: roadTex.map, roughnessMap: roadTex.rough, roughness: 1.0, color: 0x72777a });
    const brickTex = T.brick();
    brickTex.map.repeat.set(2, 3);
    const brickMat = std({ map: brickTex.map, roughness: 0.9, color: 0x9a9088 });

    // sidewalk in front of store
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.0), sidewalkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, -0.14, ROOM.z2 + 1.8);
    out.add(sw);
    // curb
    box(16, 0.2, 0.35, std({ color: 0x4d4e47, roughness: 0.9 }), 0, -0.22, ROOM.z2 + 4.1, out);
    // road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.3, ROOM.z2 + 13);
    out.add(road);
    // road markings
    const markMat = new THREE.MeshBasicMaterial({ color: 0x8a8878, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(G.plane, markMat);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(2.4, 0.14, 1);
      m.position.set(-12 + i * 8, -0.29, ROOM.z2 + 11);
      out.add(m);
    }
    // opposite buildings
    const cityTex = makeCityTexture();
    const cityMat = new THREE.MeshStandardMaterial({ map: cityTex, roughness: 0.95, emissiveMap: cityTex, emissive: 0x4a5a62, emissiveIntensity: 0.35 });
    const city = new THREE.Mesh(new THREE.PlaneGeometry(50, 15), cityMat);
    city.position.set(0, 6.5, ROOM.z2 + 26);
    city.rotation.y = Math.PI;
    out.add(city);
    // side building walls
    box(10, 12, 0.8, brickMat, -13, 5.4, ROOM.z2 + 5, out);
    box(10, 12, 0.8, brickMat, 13, 5.4, ROOM.z2 + 5, out);
    // floors above the shop (behind the facade, not blocking the street)
    box(11, 8, 0.5, std({ color: 0x34322e, roughness: 0.95 }), 0, 9.5, ROOM.z2 + 0.25, out);
    // upper windows
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: i === 1 ? 0x4a3a22 : 0x0a0e10 }));
      win.scale.set(1.1, 1.4, 1);
      win.position.set(-3.5 + i * 3.5, 7.6, ROOM.z2 + 0.53);
      out.add(win);
      if (i === 1) glowSprite(0xffb45c, 2.2, -3.5 + i * 3.5, 7.6, ROOM.z2 + 0.4, 0.10);
    }
    // neighbouring shopfronts (left and right)
    const shopMat = std({ color: 0x24231f, roughness: 0.95 });
    box(6.5, 3.6, 0.4, shopMat, -8.4, 1.8, ROOM.z2 + 0.12, out);
    box(6.5, 3.6, 0.4, shopMat, 8.4, 1.8, ROOM.z2 + 0.12, out);
    // shuttered neighbouring storefront
    const shutterMat = std({ color: 0x45443d, metalness: 0.5, roughness: 0.7 });
    for (let s = 0; s < 16; s++) {
      box(5.4, 0.1, 0.06, shutterMat, 8.4, 0.4 + s * 0.17, ROOM.z2 + 0.36, out);
    }
    const signageL = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ color: 0x173028 }));
    signageL.position.set(-8.4, 3.9, ROOM.z2 + 0.5); out.add(signageL);

    // streetlamp
    const lampGroup = new THREE.Group();
    lampGroup.position.set(4.5, 0, ROOM.z2 + 6.2);
    const poleMat = std({ color: 0x2a2c2a, metalness: 0.6, roughness: 0.6 });
    const pole = new THREE.Mesh(G.cyl, poleMat);
    pole.scale.set(0.07, 5.2, 0.07); pole.position.y = 2.6; lampGroup.add(pole);
    const arm = new THREE.Mesh(G.cyl, poleMat);
    arm.scale.set(0.05, 1.4, 0.05); arm.rotation.z = Math.PI / 2; arm.position.set(-0.65, 5.15, 0); lampGroup.add(arm);
    box(0.5, 0.12, 0.28, M_.metalDark, -1.3, 5.12, 0, lampGroup);
    const bulb = box(0.36, 0.05, 0.2, new THREE.MeshBasicMaterial({ color: 0xffd9a8 }), -1.3, 5.05, 0, lampGroup);
    glowSprite(0xffb060, 4.2, -1.3, 5.0, 0, 0.35, lampGroup);
    const lampLight = new THREE.PointLight(0xffa850, 2.4, 24, 2);
    lampLight.position.set(-1.3, 4.9, 0);
    lampGroup.add(lampLight);
    World.lights.street = lampLight;
    World.streetLampGroup = lampGroup;
    out.add(lampGroup);

    // light cone in rain (fake volumetric)
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffc080, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 5.0, 20, 1, true), coneMat);
    cone.position.set(4.5 - 1.3, 2.55, ROOM.z2 + 6.2);
    out.add(cone);

    // wet patches are handled by the sidewalk roughness; skip bright puddle plates
    // lamp pool + shop spill on the wet sidewalk
    const poolMat = new THREE.MeshBasicMaterial({
      map: T.glow(), color: 0xffb060, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const pool = new THREE.Mesh(G.plane, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(6.5, 4.2, 1);
    pool.position.set(3.2, -0.282, ROOM.z2 + 5.8);
    out.add(pool);
    const spillMat = new THREE.MeshBasicMaterial({
      map: T.glow(), color: 0xa8d8b8, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const spill = new THREE.Mesh(G.plane, spillMat);
    spill.rotation.x = -Math.PI / 2;
    spill.scale.set(8.5, 2.6, 1);
    spill.position.set(0, -0.281, ROOM.z2 + 0.9);
    out.add(spill);
    // faint warm reflection streak under the lamp
    const reflTex0 = makeReflectionTexture();
    const refl0 = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: reflTex0, color: 0xffc080, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    refl0.rotation.x = -Math.PI / 2;
    refl0.scale.set(2.4, 7.0, 1);
    refl0.position.set(2.3, -0.279, ROOM.z2 + 8.0);
    out.add(refl0);
    // wet reflections (additive planes)
    const reflTex = makeReflectionTexture();
    const reflMat = new THREE.MeshBasicMaterial({ map: reflTex, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
    const refl = new THREE.Mesh(G.plane, reflMat);
    refl.rotation.x = -Math.PI / 2;
    refl.scale.set(2.2, 9.5, 1);
    refl.position.set(2.3, -0.28, ROOM.z2 + 9);
    out.add(refl);
    const signRefl = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: reflTex, color: 0x6fffb0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
    signRefl.rotation.x = -Math.PI / 2;
    signRefl.scale.set(1.8, 3.5, 1);
    signRefl.position.set(0.3, -0.279, ROOM.z2 + 6.4);
    out.add(signRefl);

    // bus stop
    const bs = new THREE.Group();
    bs.position.set(-7.5, 0, ROOM.z2 + 2.2);
    box(0.12, 2.6, 0.12, poleMat, -1.3, 1.3, 0, bs);
    box(0.12, 2.6, 0.12, poleMat, 1.3, 1.3, 0, bs);
    box(2.8, 0.08, 0.9, M_.metalDark, 0, 2.55, 0, bs);
    const bsGlass = new THREE.MeshPhysicalMaterial({ color: 0x9ab4bb, transparent: true, opacity: 0.14, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    plane(2.6, 1.9, bsGlass, 0, 1.2, -0.35, 0, 0, bs);
    box(2.8, 0.08, 0.5, M_.metalDark, 0, 0.55, 0, bs);
    box(2.8, 0.5, 0.08, M_.metalDark, 0, 0.28, 0, bs);
    out.add(bs);
    collider(-8.9, ROOM.z2 + 1.7, -6.1, ROOM.z2 + 2.7);

    // parked car
    const car = new THREE.Group();
    car.position.set(8.5, -0.3, ROOM.z2 + 8.2);
    car.rotation.y = -0.15;
    const carMat = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.32, metalness: 0.65, envMapIntensity: 0.9 });
    box(1.85, 0.55, 4.2, carMat, 0, 0.55, 0, car);
    box(1.65, 0.5, 2.2, carMat, 0, 0.98, -0.15, car);
    const carGlass = new THREE.MeshStandardMaterial({ color: 0x05090b, roughness: 0.12, metalness: 0.9 });
    box(1.55, 0.34, 1.9, carGlass, 0, 1.02, -0.15, car);
    for (const dx of [-0.8, 0.8]) for (const dz of [-1.2, 1.2]) {
      const wheel = new THREE.Mesh(G.cyl, M_.rubber);
      wheel.scale.set(0.3, 0.16, 0.3);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(dx, 0.26, dz);
      car.add(wheel);
    }
    const tail = glowSprite(0xff2a1a, 0.35, 0.6, 0.6, 2.1, 0.4, car);
    out.add(car);

    // dumpster
    box(1.4, 0.9, 0.8, std({ color: 0x2c3a2c, roughness: 0.8, metalness: 0.3 }), 6.8, 0.35, ROOM.z2 + 2.5);
    box(1.45, 0.08, 0.85, M_.metalDark, 6.8, 0.83, ROOM.z2 + 2.5);

    // vending machine (its glow sells the street)
    const vend = new THREE.Group();
    vend.position.set(-6.3, 0, ROOM.z2 + 1.9);
    vend.rotation.y = -0.25;
    box(1.0, 1.9, 0.7, std({ color: 0x203240, metalness: 0.25, roughness: 0.45 }), 0, 0.95, 0, vend);
    const vendPanel = new THREE.MeshBasicMaterial({ color: 0xbfe6e0 });
    plane(0.82, 1.2, vendPanel, 0, 1.15, 0.36, 0, 0, vend);
    // fake products behind the lit panel
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const col = [0xc84a3a, 0xd8b23a, 0x4a9a68, 0x2a6a9a][(i + j) % 4];
      box(0.1, 0.22, 0.06, new THREE.MeshBasicMaterial({ color: col }), -0.28 + j * 0.2, 0.85 + i * 0.3, 0.39, vend);
    }
    box(0.82, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0x102028 }), 0, 0.42, 0.36, vend);
    glowSprite(0x9fe0e0, 2.4, 0, 1.1, 0.6, 0.18, vend);
    out.add(vend);

    // utility pole + wires
    const up = new THREE.Mesh(G.cyl, poleMat);
    up.scale.set(0.1, 8, 0.1); up.position.set(-9.5, 4, ROOM.z2 + 3.5); out.add(up);
    box(2.6, 0.1, 0.1, poleMat, -9.5, 7.3, ROOM.z2 + 3.5, out);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x171a1a, transparent: true, opacity: 0.8 });
    for (let w = 0; w < 3; w++) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const x = -9.5 + i * 1.8;
        pts.push(new THREE.Vector3(x, 7.1 + Math.sin(i * 0.5 + w) * 0.25 - i * 0.015, ROOM.z2 + 3.4 + w * 0.15));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      out.add(new THREE.Line(geo, wireMat));
    }

    // distant fog walls
    const fogMat = new THREE.MeshBasicMaterial({ color: 0x0b0f12, transparent: true, opacity: 0.55, depthWrite: false });
    plane(60, 20, fogMat, 0, 6, ROOM.z2 + 30, 0, Math.PI);

    // rain
    buildRain(out);
    // steam from coffee
    buildSteam(out);
    // catch-all invisible ground collider for outside
    collider(-30, ROOM.z2 - 0.05, 30, ROOM.z2 + 0.2);
  }

  function makeCityTexture() {
    const W = 1024, H = 512, c = T.cnv(W, H), g = c.getContext('2d');
    g.fillStyle = '#080b0d'; g.fillRect(0, 0, W, H);
    // building blocks
    for (let b = 0; b < 9; b++) {
      const x = b * 118, w = 96 + Math.random() * 30, h = 180 + Math.random() * 260;
      g.fillStyle = `rgb(${10 + Math.random() * 10},${13 + Math.random() * 10},${15 + Math.random() * 10})`;
      g.fillRect(x, H - h, w, h);
      for (let wy = H - h + 16; wy < H - 14; wy += 28) {
        for (let wx = x + 12; wx < x + w - 12; wx += 24) {
          if (Math.random() < 0.18) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(240,190,110,0.65)' : 'rgba(160,200,220,0.4)';
            g.fillRect(wx, wy, 12, 14);
          } else {
            g.fillStyle = 'rgba(20,28,32,0.8)';
            g.fillRect(wx, wy, 12, 14);
          }
        }
      }
    }
    // drizzle blur
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      d[i] = M.clamp(d[i] + n, 0, 255); d[i + 1] = M.clamp(d[i + 1] + n, 0, 255); d[i + 2] = M.clamp(d[i + 2] + n, 0, 255);
    }
    g.putImageData(img, 0, 0);
    return T.mkTex(c);
  }

  function makeReflectionTexture() {
    const W = 128, H = 512, c = T.cnv(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const w = 2 + Math.random() * 14, h = 10 + Math.random() * 80;
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, `rgba(255,220,170,${0.10 + Math.random() * 0.18})`);
      gr.addColorStop(1, 'rgba(255,220,170,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, w, h);
    }
    return T.mkTex(c, { linear: true });
  }

  function buildRain(parent) {
    const drops = 1100;
    const positions = new Float32Array(drops * 2 * 3);
    const speeds = new Float32Array(drops * 2);
    for (let i = 0; i < drops; i++) {
      const x = -16 + Math.random() * 32;
      const z = 6.6 + Math.random() * 22;
      const y = Math.random() * 16;
      const len = 0.25 + Math.random() * 0.55;
      const s = 8 + Math.random() * 8;
      positions[i * 6] = x; positions[i * 6 + 1] = y; positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x + 0.03; positions[i * 6 + 4] = y - len; positions[i * 6 + 5] = z;
      speeds[i * 2] = s; speeds[i * 2 + 1] = s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x93aebb) }, uOpacity: { value: 0.36 } },
      vertexShader: `
        attribute float aSpeed;
        uniform float uTime;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * aSpeed, 16.0);
          p.x += sin(uTime * 0.7 + position.z) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vFade = smoothstep(45.0, 8.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vFade;
        void main() { gl_FragColor = vec4(uColor, uOpacity * vFade); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    parent.add(lines);
    World.rain = { lines: lines, mat: mat };
  }

  function buildSteam(parent) {
    const steamMat = new THREE.SpriteMaterial({
      map: T.glow(), color: 0xc8d8d8, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    World.steam = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(steamMat.clone());
      s.position.set(4.15, 1.45, 0.05);
      s.scale.set(0.25, 0.25, 1);
      s.userData.life = Math.random();
      parent.add(s);
      World.steam.push(s);
    }
  }

  /* ============================================================
   * Dust motes
   * ============================================================ */
  function buildDust() {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = ROOM.x1 + Math.random() * (ROOM.x2 - ROOM.x1);
      pos[i * 3 + 1] = 0.2 + Math.random() * 2.6;
      pos[i * 3 + 2] = ROOM.z1 + Math.random() * (ROOM.z2 - ROOM.z1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.014, map: T.glow(), color: 0xfff2d0, transparent: true, opacity: 0.36,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    World.root.add(pts);
    World.dust = { points: pts, geo: geo, arr: pos, n: n };
  }

  /* ============================================================
   * CCTV
   * ============================================================ */
  function buildCCTV(renderer) {
    const w = 320, h = 200;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, depthBuffer: true
    });
    rt.texture.encoding = THREE.sRGBEncoding;
    World.cctvRT = rt;
    const cam = new THREE.PerspectiveCamera(62, w / h, 0.1, 30);
    cam.position.set(4.15, 2.72, 5.45);
    cam.lookAt(new THREE.Vector3(-1.8, 0.9, -1.5));
    cam.layers.enable(1);
    World.cctvCam = cam;
    // screen material
    const screenMat = new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xb8c8b0 });
    if (World.monitorScreen) {
      World.monitorScreen.material = screenMat;
      World.monitorScreen.material.needsUpdate = true;
    }
    // watcher: only layer 1 (camera only)
    const watcher = new THREE.Group();
    watcher.layers.set(1);
    const dark = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 });
    let bodyGeo;
    if (THREE.CapsuleGeometry) bodyGeo = new THREE.CapsuleGeometry(0.22, 1.05, 4, 8);
    else bodyGeo = new THREE.CylinderGeometry(0.22, 0.24, 1.4, 8);
    const body = new THREE.Mesh(bodyGeo, dark);
    body.position.y = 0.95; watcher.add(body);
    const head = new THREE.Mesh(G.sphereLow, dark);
    head.scale.set(0.13, 0.16, 0.14); head.position.y = 1.72; watcher.add(head);
    const armL = new THREE.Mesh(G.cylLow, dark); armL.scale.set(0.06, 0.9, 0.06); armL.position.set(-0.28, 1.2, 0); armL.rotation.z = 0.06; watcher.add(armL);
    const armR = new THREE.Mesh(G.cylLow, dark); armR.scale.set(0.06, 0.9, 0.06); armR.position.set(0.28, 1.2, 0); armR.rotation.z = -0.06; watcher.add(armR);
    watcher.position.set(-2.0, 0, -3.4);
    watcher.visible = false;
    watcher.traverse(o => { if (o.isMesh) o.layers.set(1); });
    World.root.add(watcher);
    World.watcher = watcher;
    // also let the real scene camera ignore it by default (main camera layer 0 only)
  }

  /* ============================================================
   * Build
   * ============================================================ */
  World.init = function (scene, renderer, quality) {
    World.quality = quality || 'medium';
    World.root = new THREE.Group();
    World.root.name = 'world';
    scene.add(World.root);
    initGeom();
    initMaterials();
    World.lights = {};
    buildShell();
    buildFront();
    buildCounter();
    buildShelves();
    buildFridges();
    buildBackRoom();
    buildServiceWall();
    buildLights();
    buildOutside();
    buildDust();
    buildCCTV(renderer);

    // Steam sprite color
    World.steam.forEach(s => { s.material.color.set(0xbfd4d4); });

    // Set fog / background
    scene.background = new THREE.Color(0x04070a);
    scene.fog = new THREE.FogExp2(0x06090c, 0.028);
    return World;
  };

  /* ============================================================
   * Interactions & effects
   * ============================================================ */
  World.powerOn = true;
  World.setPower = function (on, emergency) {
    World.powerOn = on;
    for (const l of World.lights.ceiling) l.intensity = on ? 1.0 : 0;
    World.lights.fridge.intensity = on ? 0.7 : 0.0;
    if (World.lights.warmer) World.lights.warmer.intensity = on ? 0.45 : 0.0;
    World.lights.warm.intensity = on ? 0.75 : 0.08;
    for (const p of World.ceilingPanels) {
      const m = p.material;
      m.emissiveIntensity = on ? 1.6 : 0.0;
    }
    if (World.fridgeGlowMat) World.fridgeGlowMat.color.set(on ? 0xbfe4f2 : 0x0a1214);
    if (World.signMat) World.signMat.emissiveIntensity = on ? 1.25 : 0.22;
  };

  World.flicker = function (duration, which) {
    World._flicker = { t: 0, dur: duration || 1.2, which: which == null ? 0 : which };
  };
  World.blackout = function (on) {
    World.setPower(!on);
    if (on) {
      World.lights.warm.intensity = 0.02;
    }
  };

  World.update = function (dt, elapsed) {
    // rain
    if (World.rain) World.rain.mat.uniforms.uTime.value = elapsed;
    if (World.rainGlass) {
      World.rainGlass.material.map.offset.y -= dt * 0.06;
      World.rainGlass.material.map.offset.x = Math.sin(elapsed * 0.05) * 0.02;
    }
    // flicker
    if (World._flicker) {
      const f = World._flicker;
      f.t += dt;
      if (f.t >= f.dur) {
        for (const l of World.lights.ceiling) l.intensity = World.powerOn ? 1.0 : 0;
        for (const p of World.ceilingPanels) p.material.emissiveIntensity = World.powerOn ? 1.6 : 0;
        World._flicker = null;
      } else {
        const on = Math.random() < 0.55;
        const idx = f.which % World.lights.ceiling.length;
        for (let i = 0; i < World.lights.ceiling.length; i++) {
          if (i === idx) World.lights.ceiling[i].intensity = on ? 1.1 : 0.02;
        }
        World.ceilingPanels.forEach((p, i) => {
          if (i === idx) p.material.emissiveIntensity = on ? 2.2 : 0.02;
        });
      }
    }
    // dust drift
    if (World.dust) {
      const a = World.dust.arr;
      for (let i = 0; i < World.dust.n; i++) {
        a[i * 3 + 1] += Math.sin(elapsed * 0.3 + i) * 0.0009;
        a[i * 3] += Math.sin(elapsed * 0.18 + i * 1.7) * 0.0006;
      }
      World.dust.geo.attributes.position.needsUpdate = true;
    }
    // steam
    if (World.steam) {
      for (const s of World.steam) {
        s.userData.life += dt * 0.18;
        if (s.userData.life > 1) {
          s.userData.life = 0;
          s.position.set(4.15 + Math.random() * 0.08, 1.44, 0.02 + Math.random() * 0.06);
        }
        const l = s.userData.life;
        s.position.y += dt * 0.16;
        s.position.x += Math.sin(elapsed * 0.5 + l * 6) * dt * 0.02;
        s.scale.setScalar(0.16 + l * 0.55);
        s.material.opacity = Math.sin(l * Math.PI) * 0.10;
      }
    }
    // CCTV refresh
    World._cctvAcc = (World._cctvAcc || 0) + dt;
    if (World._cctvAcc > 0.10) {
      World._cctvAcc = 0;
      const r = World.renderer;
      if (r) {
        const prev = r.getRenderTarget();
        const screen = World.monitorScreen;
        const wasVisible = screen ? screen.visible : false;
        if (screen) screen.visible = false;
        r.setRenderTarget(World.cctvRT);
        r.clear();
        r.render(World.scene, World.cctvCam);
        r.setRenderTarget(prev);
        if (screen) screen.visible = wasVisible;
      }
    }
    // clock hands
    if (World.clockHands && World.clockMinutes != null) {
      const mins = World.clockMinutes;
      const total = 22 * 60 + mins;
      const hours = total / 60;
      World.clockHands.hour.rotation.z = -((hours % 12) / 12) * Math.PI * 2;
      World.clockHands.minute.rotation.z = -((mins % 60) / 60) * Math.PI * 2;
    }
    // bell sway
    if (World.bell) {
      World.bell.rotation.z = Math.sin(elapsed * 2.2) * 0.03 * (World._bellSwing || 0);
      World._bellSwing = Math.max(0, (World._bellSwing || 0) - dt * 0.8);
    }
  };

  World.ringBell = function () {
    World._bellSwing = 1;
  };

  World.setWatcher = function (visible, x, z) {
    if (!World.watcher) return;
    World.watcher.visible = visible;
    if (x != null) World.watcher.position.set(x, 0, z);
  };

  World.setRenderRefs = function (renderer, scene) {
    World.renderer = renderer;
    World.scene = scene;
  };

  World.buildEnvironment = function (renderer, scene) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x04070a);
      const add = (w, h, color, x, y, z, rx, ry) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.rotation.x = rx || 0; m.rotation.y = ry || 0;
        envScene.add(m);
      };
      // ceiling fluorescent strips (cool)
      add(6, 0.6, new THREE.Color(0.9, 1.2, 0.95), 0, 4, 0, Math.PI / 2, 0);
      add(2.5, 0.4, new THREE.Color(1.1, 1.3, 1.05), -3, 4, 2, Math.PI / 2, 0);
      // warm counter bounce
      add(2.2, 1.0, new THREE.Color(0.7, 0.42, 0.18), 2.5, 1.2, 4, 0, 0);
      // cold street through the glass
      add(5, 2.5, new THREE.Color(0.10, 0.18, 0.26), 0, 1.6, 6.1, 0, Math.PI);
      // sodium lamp outside
      add(1.2, 0.5, new THREE.Color(1.5, 0.85, 0.32), 4.8, 3.5, 8.5, 0, Math.PI);
      const rt = pmrem.fromScene(envScene, 0.06);
      scene.environment = rt.texture;
      pmrem.dispose();
      World.envMap = rt.texture;
    } catch (e) {
      console.warn('env map failed', e);
    }
  };

  MS.World = World;
})(window.MS);


