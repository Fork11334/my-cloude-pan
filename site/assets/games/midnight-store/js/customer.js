/* ============================================================
 * 长夜便利店 — 顾客 / 伪人
 * 写实人头模型 + 程序化身体、手、服装、倒影与微动作
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const M = MS.M, T = MS.T;
  const Customers = {};
  const HEAD_SCALE = 0.061;
  const CLIP_Y = -1.95;
  let headTemplate = null;
  let headNormalTex = null;
  const sharedGeo = {};
  const sharedMat = {};

  function gem(name, make) {
    if (!sharedGeo[name]) sharedGeo[name] = make();
    return sharedGeo[name];
  }
  function bg() { return gem('unitBox', () => new THREE.BoxGeometry(1, 1, 1)); }
  function pg() { return gem('unitPlane', () => new THREE.PlaneGeometry(1, 1)); }
  function mat(name, make) {
    if (!sharedMat[name]) sharedMat[name] = make();
    return sharedMat[name];
  }

  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  Customers.load = function () {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      try {
        loader.parse(b64ToBuf(MS.ASSETS.headMaleGLB), '', (gltf) => {
          let mesh = null;
          gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
          if (!mesh) { reject(new Error('no head mesh')); return; }
          mesh.geometry.computeBoundingBox();
          headTemplate = mesh.geometry;
          const img = new Image();
          img.onload = () => {
            headNormalTex = new THREE.Texture(img);
            headNormalTex.needsUpdate = true;
            headNormalTex.encoding = THREE.LinearEncoding;
            headNormalTex.anisotropy = 4;
            Customers.ready = true;
            resolve(true);
          };
          img.onerror = () => { Customers.ready = true; resolve(true); };
          img.src = 'data:image/jpeg;base64,' + MS.ASSETS.headMaleNormal;
        }, (err) => reject(err));
      } catch (e) { reject(e); }
    });
  };
  Customers.ready = false;

  /* ------------------------------------------------------------
   * Materials & parts
   * ------------------------------------------------------------ */
  function skinMat(tone, wet) {
    const key = 'skin_' + tone + (wet ? '_wet' : '');
    return mat(key, () => new THREE.MeshStandardMaterial({
      map: T.skin(tone === 'pale' ? 'pale' : 'default'),
      roughness: wet ? 0.42 : 0.62,
      metalness: 0.0,
      envMapIntensity: 0.25,
      color: tone === 'pale' ? 0xcfc7bf : 0xb99580
    }));
  }

  function clothingMat(color, opts) {
    opts = opts || {};
    const key = 'cloth_' + color + (opts.wet ? 'w' : '') + (opts.rough || '');
    return mat(key, () => new THREE.MeshStandardMaterial({
      map: T.fabric(color),
      color: 0xffffff,
      roughness: opts.wet ? 0.5 : (opts.rough || 0.88),
      metalness: opts.metal || 0.0,
      envMapIntensity: opts.wet ? 0.55 : 0.18
    }));
  }

  function headMaterial(kind, tint, isFake) {
    const faceTex = T.faceTextures[kind] || T.faceTextures.human;
    const m = new THREE.MeshStandardMaterial({
      map: faceTex,
      normalMap: headNormalTex || null,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: isFake ? 0.42 : 0.58,
      metalness: 0.0,
      envMapIntensity: isFake ? 0.42 : 0.28,
      color: tint || 0xffffff
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vHeadY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadY = position.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHeadY;')
        .replace('#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nif (vHeadY < ' + CLIP_Y.toFixed(2) + ') discard;');
    };
    m.customProgramCacheKey = () => 'headclip1';
    return m;
  }

  function limb(a, b, r, material, radial) {
    const dir = b.clone().sub(a);
    const len = Math.max(0.001, dir.length());
    const geo = new THREE.CylinderGeometry(r * 0.86, r, len, radial || 8);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  }

  function ball(r, material, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(gem('sphere_' + r + '_12', () => new THREE.SphereGeometry(r, 12, 9)), material);
    m.position.set(x, y, z);
    if (sx != null) m.scale.set(sx, sy, sz);
    return m;
  }

  function boxM(w, h, d, material, x, y, z, parent) {
    const m = new THREE.Mesh(bg(), material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    (parent || null);
    return m;
  }

  function makeHand(skin, side, fingers) {
    // hand local: palm flat on counter, fingers pointing +z
    const g = new THREE.Group();
    const palm = new THREE.Mesh(bg(), skin);
    palm.scale.set(0.082, 0.026, 0.10);
    palm.position.set(0, 0, 0.05);
    g.add(palm);
    // wrist
    const wrist = new THREE.Mesh(bg(), skin);
    wrist.scale.set(0.062, 0.04, 0.06);
    wrist.position.set(0, 0.002, -0.02);
    g.add(wrist);
    const count = fingers || 5;
    const positions = [-0.032, -0.014, 0.004, 0.022, 0.04];
    if (count > 5) positions.splice(4, 0, 0.036);
    for (let i = 0; i < positions.length; i++) {
      const x = positions[i];
      const len = 0.055 + Math.sin(i * 1.7 + (side > 0 ? 0.4 : 0)) * 0.012;
      const f = new THREE.Mesh(bg(), skin);
      f.scale.set(0.0125, 0.017, len);
      f.position.set(x, -0.002, 0.10 + len * 0.5);
      f.rotation.x = (i === 0 ? 0.06 : 0.02);
      g.add(f);
      const tip = new THREE.Mesh(bg(), skin);
      tip.scale.set(0.012, 0.016, 0.013);
      tip.position.set(x, -0.003, 0.10 + len);
      g.add(tip);
      // nail
      const nail = new THREE.Mesh(bg(), mat('nail', () => new THREE.MeshStandardMaterial({
        color: 0xd8c6b8, roughness: 0.45
      })));
      nail.scale.set(0.008, 0.002, 0.011);
      nail.position.set(x, 0.011, 0.10 + len - 0.006);
      g.add(nail);
    }
    // thumb
    const thumb = new THREE.Mesh(bg(), skin);
    thumb.scale.set(0.02, 0.018, 0.055);
    thumb.position.set(side > 0 ? -0.058 : 0.058, -0.002, 0.045);
    thumb.rotation.y = side > 0 ? 0.65 : -0.65;
    g.add(thumb);
    return g;
  }

  function hairCap(color, style) {
    const g = new THREE.Group();
    const hairMat = mat('hair_' + color, () => new THREE.MeshStandardMaterial({
      color: color, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.05
    }));
    // The face occupies the front of the head; the hair is a back shell + a
    // crown cap so it never covers the eyes.
    if (style === 'hood') {
      const hoodMat = clothingMat(color, { wet: true });
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(4.0, 18, 12, Math.PI / 2 + 0.72, Math.PI * 2 - 1.44, 0, Math.PI * 0.70),
        hoodMat
      );
      shell.position.set(0, 0.5, -0.45);
      g.add(shell);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(3.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.38), hoodMat);
      crown.position.set(0, 1.2, -0.2);
      g.add(crown);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.17, 8, 24), hoodMat);
      rim.position.set(0, 1.55, 2.35);
      rim.scale.set(1.0, 1.0, 0.9);
      g.add(rim);
    } else if (style === 'cap') {
      const capMat = mat('capfab_' + color, () => new THREE.MeshStandardMaterial({
        color: color, roughness: 0.85, envMapIntensity: 0.1
      }));
      const dome = new THREE.Mesh(gem('capDome2', () => new THREE.SphereGeometry(3.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.44)), capMat);
      dome.position.set(0, 1.35, -0.25);
      g.add(dome);
      const brim = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20, Math.PI * 0.15, Math.PI * 0.7), capMat);
      brim.rotation.x = -Math.PI / 2;
      brim.position.set(0, 2.02, 0.55);
      g.add(brim);
    } else if (style === 'beanie') {
      const knit = mat('knit_' + color, () => new THREE.MeshStandardMaterial({
        map: T.fabric('#22252a'), color: color, roughness: 0.95, envMapIntensity: 0.05
      }));
      const dome = new THREE.Mesh(gem('beanieDome2', () => new THREE.SphereGeometry(3.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)), knit);
      dome.position.set(0, 1.5, -0.3);
      g.add(dome);
      const band = new THREE.Mesh(gem('beanieBand2', () => new THREE.CylinderGeometry(3.42, 3.42, 0.62, 20, 1, true)), knit);
      band.position.set(0, 2.2, -0.3);
      g.add(band);
    } else {
      // short hair: open at the front, covering back, sides and crown
      const back = new THREE.Mesh(
        new THREE.SphereGeometry(3.35, 20, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.60),
        hairMat
      );
      back.position.set(0, 0.95, -0.25);
      g.add(back);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(3.22, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.38),
        hairMat
      );
      crown.position.set(0, 1.15, -0.25);
      g.add(crown);
      for (const sx of [-1, 1]) {
        const sb = new THREE.Mesh(bg(), hairMat);
        sb.scale.set(0.38, 1.5, 0.7);
        sb.position.set(sx * 2.85, 1.25, 1.15);
        g.add(sb);
      }
      // forehead fringe hides the shell rim
      const fringe = new THREE.Mesh(bg(), hairMat);
      fringe.scale.set(3.0, 0.5, 0.5);
      fringe.position.set(0, 2.42, 1.95);
      fringe.rotation.x = -0.18;
      g.add(fringe);
    }
    return g;
  }

  function makeGlasses() {
    const g = new THREE.Group();
    const frameMat = mat('glassframe', () => new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, metalness: 0.7, roughness: 0.35
    }));
    const centers = [-0.59, 0.41];
    for (let i = 0; i < 2; i++) {
      const cx = centers[i];
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.055, 6, 16), frameMat);
      rim.position.set(cx, 1.7, 2.04);
      g.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.66, 16), mat('lens', () => new THREE.MeshPhysicalMaterial({
        color: 0xbfd0d0, transparent: true, opacity: 0.10, roughness: 0.05, metalness: 0.0, side: THREE.DoubleSide
      })));
      lens.position.set(cx, 1.7, 2.03);
      g.add(lens);
      const temple = new THREE.Mesh(bg(), frameMat);
      temple.scale.set(0.07, 0.06, 2.7);
      temple.position.set(i === 0 ? -1.55 : 1.37, 1.72, 0.8);
      temple.rotation.y = i === 0 ? 0.15 : -0.15;
      g.add(temple);
    }
    const bridge = new THREE.Mesh(bg(), frameMat);
    bridge.scale.set(0.36, 0.06, 0.06);
    bridge.position.set(-0.09, 1.74, 2.05);
    g.add(bridge);
    return g;
  }

  function makeScarf(color) {
    const g = new THREE.Group();
    const m = mat('scarf_' + color, () => new THREE.MeshStandardMaterial({
      map: T.fabric(color), roughness: 0.9, color: color
    }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 14), m);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.44;
    g.add(ring);
    const tail = new THREE.Mesh(bg(), m);
    tail.scale.set(0.11, 0.3, 0.03);
    tail.position.set(0.1, 1.28, 0.12);
    tail.rotation.z = -0.15;
    g.add(tail);
    return g;
  }

  /* ------------------------------------------------------------
   * Customer
   * ------------------------------------------------------------ */
  function Customer(def) {
    this.def = def;
    this.kind = def.kind;
    this.isFake = def.kind === 'fake';
    this.look = def.look || {};
    this.state = 'idle';
    this.observedFor = 0;
    this.observationCooldown = 0;
    this.time = 0;
    this.talkTime = 0;
    this.blinkTimer = 3 + Math.random() * 3;
    this.fakeJerk = 5 + Math.random() * 5;
    this.extraFinger = !!this.look.extraFinger;
    this.fingers = this.extraFinger ? 6 : 5;
    this.moved = 0;
    this.stain = null;
    this.handTap = 0;
    this.lungeT = -1;
    this.dead = false;
    this.build();
  }

  Customer.prototype.build = function () {
    const look = this.look;
    const H = look.height || (this.isFake ? 1.82 + Math.random() * 0.12 : 1.62 + Math.random() * 0.2);
    this.H = H;
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    this.group = group;
    const skinTone = look.pale ? 'pale' : 'default';
    const skin = skinMat(skinTone, look.wet);
    this.skinMat = skin;
    const coatColor = look.coat || '#22262b';
    const coat = clothingMat(coatColor, { wet: look.wet });
    const pantsColor = look.pants || '#1a1c1f';
    const pants = clothingMat(pantsColor, { rough: 0.95 });
    const width = look.build === 'heavy' ? 1.16 : (look.build === 'slim' ? 0.9 : 1.0);

    const shoulderY = H - 0.36;
    this.shoulderY = shoulderY;
    this.headGroupY = H - 0.205;
    const chestY = shoulderY - 0.28;

    // legs / hips (mostly hidden by counter, visible from the side)
    for (const sx of [-1, 1]) {
      const hip = new THREE.Vector3(sx * 0.1, 0.9, 0);
      const foot = new THREE.Vector3(sx * 0.115, 0.03, 0.06);
      group.add(limb(hip, foot, 0.085 * width, pants));
      const shoe = boxM(0.11, 0.08, 0.25, mat('shoe', () => new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.55, metalness: 0.1 })), sx * 0.115, 0.04, 0.08);
      shoe.rotation.y = sx * 0.06;
      group.add(shoe);
    }
    // torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.215 * width, 0.255 * width, 0.56, 14), coat);
    torso.position.set(0, chestY, 0);
    torso.scale.z = 0.72;
    group.add(torso);
    // shoulders
    const shoulder = new THREE.Mesh(gem('shoulder', () => new THREE.SphereGeometry(1, 14, 10)), coat);
    shoulder.scale.set(0.245 * width, 0.09, 0.175);
    shoulder.position.set(0, shoulderY - 0.03, 0);
    group.add(shoulder);
    // collar lining / undershirt
    const lining = new THREE.Mesh(pg(), clothingMat(look.shirt || '#2e2a26'));
    lining.scale.set(0.10, 0.13, 1);
    lining.position.set(0, chestY + 0.205, 0.175);
    group.add(lining);
    // chest/coat closure
    const zipper = new THREE.Mesh(bg(), mat('zipperMat', () => new THREE.MeshStandardMaterial({ color: 0x6a6257, metalness: 0.55, roughness: 0.4 })));
    zipper.scale.set(0.012, 0.44, 0.012);
    zipper.position.set(0.0, chestY + 0.02, 0.195);
    group.add(zipper);
    // lapels
    for (const sx of [-1, 1]) {
      const lapel = boxM(0.08, 0.26, 0.015, coat, sx * 0.08, chestY + 0.14, 0.19);
      lapel.rotation.z = sx * 0.35;
      group.add(lapel);
    }
    // collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.032, 6, 14), coat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = shoulderY + 0.075;
    group.add(collar);
    // neck
    const neck = new THREE.Mesh(bg(), skin);
    neck.scale.set(0.078, 0.17, 0.08);
    neck.position.set(0, shoulderY + 0.09, 0.005);
    group.add(neck);

    // head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, this.headGroupY, 0.045);
    headGroup.scale.setScalar(HEAD_SCALE * (look.headScale || 1));
    this.headGroup = headGroup;
    if (headTemplate) {
      const faceKey = this.isFake
        ? (this.def.humanFace ? (look.face === 'b' ? 'humanB' : 'human') : 'fake')
        : (look.face === 'b' ? 'humanB' : 'human');
      const headMesh = new THREE.Mesh(headTemplate, headMaterial(faceKey, look.tint, this.isFake));
      headGroup.add(headMesh);
      this.headMesh = headMesh;
    } else {
      // fallback: procedural head
      const fallback = new THREE.Mesh(gem('fallbackHead', () => new THREE.SphereGeometry(3.2, 16, 12)), skin);
      fallback.position.y = 1.2;
      fallback.scale.set(1, 1.25, 1.05);
      headGroup.add(fallback);
    }
    // hair / hat
    const hairStyle = look.hat || 'hair';
    const hairColor = look.hairColor || '#1a1512';
    if (hairStyle === 'none') {
      // bald
    } else {
      const hair = hairCap(hairStyle === 'hood' ? (look.coat || '#1a1c1e') : hairColor, hairStyle === 'hair' ? 'short' : hairStyle);
      headGroup.add(hair);
    }
    if (look.longHair) {
      const hm = mat('hair_long_' + hairColor, () => new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.92 }));
      for (const sx of [-1, 1]) {
        const strand = boxM(0.7, 7.0, 0.5, hm, sx * 3.15, -0.8, -1.3);
        strand.rotation.z = sx * 0.06;
        headGroup.add(strand);
      }
      const back = boxM(5.2, 7.0, 0.7, hm, 0, -0.6, -2.4);
      headGroup.add(back);
    }
    if (look.glasses) headGroup.add(makeGlasses());
    // fake: no eyebrows? painted. add a twitchable jaw shadow
    if (this.isFake && look.mark) {
      const markMat = mat('mark', () => new THREE.MeshBasicMaterial({ color: 0x5a1010, transparent: true, opacity: 0.5, depthWrite: false }));
      const mark = new THREE.Mesh(pg(), markMat);
      mark.scale.set(1.4, 0.18, 1);
      mark.position.set(-1.5, 0.4, 2.65);
      mark.rotation.z = 0.3;
      headGroup.add(mark);
    }
    group.add(headGroup);

    // breath fog (humans only)
    this.breath = null;
    if (!this.isFake) {
      const bm = new THREE.SpriteMaterial({
        map: T.glow(), color: 0xcfe0e4, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const br = new THREE.Sprite(bm);
      br.scale.set(0.18, 0.13, 1);
      br.position.set(0, (this.headGroupY - 0.06), 0.16);
      group.add(br);
      this.breath = br;
    }

    // arms + hands
    this.hands = [];
    const wristY = 1.12;
    for (const sx of [-1, 1]) {
      const shoulderP = new THREE.Vector3(sx * 0.205 * width, shoulderY - 0.03, 0.02);
      const elbowP = new THREE.Vector3(sx * 0.255 * width, shoulderY - 0.235, 0.13);
      const wristP = new THREE.Vector3(sx * 0.205, wristY + 0.025, 0.34);
      group.add(limb(shoulderP, elbowP, 0.062, coat));
      group.add(limb(elbowP, wristP, 0.052, coat));
      group.add(ball(0.064, coat, elbowP.x, elbowP.y, elbowP.z));
      // cuff
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 10), coat);
      cuff.position.copy(wristP);
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), elbowP.clone().sub(wristP).normalize());
      group.add(cuff);
      // wrist joint fills the gap between sleeve and hand
      group.add(ball(0.04, skin, sx * 0.205, wristY + 0.024, 0.365));
      group.add(limb(new THREE.Vector3(sx * 0.205, wristY + 0.03, 0.34), new THREE.Vector3(sx * 0.205, wristY, 0.39), 0.033, skin));
      const hand = makeHand(skin, sx, this.fingers);
      hand.position.set(sx * 0.205, wristY, 0.36);
      hand.rotation.y = sx * 0.05;
      hand.scale.setScalar(1.12);
      group.add(hand);
      this.hands.push(hand);
    }

    // accessories
    if (look.scarf) group.add(makeScarf(look.scarf));
    if (look.badge) {
      const badgeMat = mat('badge', () => new THREE.MeshStandardMaterial({ color: 0xd8d8cc, roughness: 0.7 }));
      const badge = boxM(0.075, 0.035, 0.006, badgeMat, 0.13, shoulderY - 0.18, 0.2);
      badge.rotation.z = -0.05;
      group.add(badge);
    }
    if (look.bag) {
      const strap = boxM(0.035, 0.72, 0.02, clothingMat('#2a2118'), -0.14, shoulderY - 0.32, 0.19);
      strap.rotation.z = 0.5;
      group.add(strap);
    }

    // blob shadow
    const shMat = new THREE.MeshBasicMaterial({
      map: T.shadow(), transparent: true, opacity: 0.55, depthWrite: false
    });
    const shadow = new THREE.Mesh(pg(), shMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(0.8, 0.55, 1);
    shadow.position.set(0, 0.014, 0.1);
    group.add(shadow);
    this.shadow = shadow;

    // hitbox
    const hitGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.34, 0.72, 4, 8)
      : new THREE.CylinderGeometry(0.34, 0.34, 1.4, 8);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    hit.position.set(0, 1.28, 0.1);
    hit.userData.customer = this;
    group.add(hit);
    this.hitbox = hit;

    // reflection ghost (faint, only persons)
    this.ghost = null;
    if (!this.isFake) {
      const ghost = new THREE.Group();
      const gm = new THREE.MeshBasicMaterial({
        color: 0x9fb2b8, transparent: true, opacity: 0.15, depthWrite: false, fog: false
      });
      const ghostBodyGeo = THREE.CapsuleGeometry
        ? new THREE.CapsuleGeometry(0.26, 0.55, 4, 8)
        : new THREE.CylinderGeometry(0.26, 0.28, 1.1, 8);
      const body = new THREE.Mesh(ghostBodyGeo, gm);
      body.position.y = 1.16;
      ghost.add(body);
      const head = new THREE.Mesh(gem('ghostHead', () => new THREE.SphereGeometry(0.105, 10, 8)), gm);
      head.position.y = this.headGroupY + 0.02;
      ghost.add(head);
      const sh = new THREE.Mesh(gem('ghostShoulder', () => new THREE.SphereGeometry(1, 10, 8)), gm);
      sh.scale.set(0.31, 0.1, 0.18);
      sh.position.y = shoulderY;
      ghost.add(sh);
      ghost.visible = false;
      ghost.position.set(0, 0, 12.4);
      this.ghost = ghost;
    }

    // stains
    this.stain = null;
  };

  Customer.prototype.attachTo = function (worldRoot) {
    worldRoot.add(this.group);
    if (this.ghost) worldRoot.add(this.ghost);
  };

  Customer.prototype.setPosition = function (x, z, rotY) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = rotY == null ? Math.PI : rotY;
    this.syncGhost();
  };

  Customer.prototype.syncGhost = function () {
    if (!this.ghost) return;
    const g = this.group;
    this.ghost.position.set(g.position.x, 0, 12.4 - g.position.z);
    this.ghost.rotation.y = -g.rotation.y;
  };

  Customer.prototype.setGhostVisible = function (v) {
    if (this.ghost) this.ghost.visible = v;
  };

  Customer.prototype.update = function (dt, elapsed) {
    if (this.dead) return;
    this.time += dt;
    const t = this.time;
    const isFake = this.isFake;
    // breathing & idle sway
    if (this.state === 'waiting' || this.state === 'talking') {
      const breathe = Math.sin(t * (isFake ? 0.55 : 1.25) + 0.4);
      if (!isFake) {
        this.group.position.y = breathe * 0.0035;
        this.group.rotation.z = Math.sin(t * 0.37) * 0.005;
        if (this.breath) {
          const cycle = (t * 0.36) % 1;
          const puff = Math.max(0, Math.sin(cycle * Math.PI * 2)) * 0.032;
          this.breath.material.opacity = puff;
          this.breath.scale.setScalar(0.13 + puff * 3.2);
          this.breath.position.z = 0.16 + Math.sin(t * 0.36) * 0.01;
        }
      } else {
        this.group.position.y = 0;
        this.group.rotation.z = 0;
      }
      // head motion
      const hg = this.headGroup;
      if (hg) {
        if (isFake) {
          // too still, then a jerky correction
          this.fakeJerk -= dt;
          let tilt = Math.sin(t * 0.11) * 0.0;
          if (this.fakeJerk < 0) {
            this.fakeJerk = 6 + Math.random() * 7;
            this.jerk = 0.12;
            if (MS.Game && MS.Game.onFakeJerk) MS.Game.onFakeJerk(this);
          }
          this.jerk = Math.max(0, (this.jerk || 0) - dt);
          hg.rotation.z = Math.sin(t * 0.35) * 0.035 + (this.jerk > 0 ? this.jerk * 0.9 : 0);
          hg.rotation.x = -0.01;
          hg.rotation.y = Math.sin(t * 0.2) * 0.012;
        } else {
          hg.rotation.y = Math.sin(t * 0.29) * 0.10 + Math.sin(t * 1.3) * 0.006;
          hg.rotation.x = Math.sin(t * 0.43) * 0.025 - 0.02;
          hg.rotation.z = Math.sin(t * 0.23) * 0.02;
          // shoulder fidget
          if (this.hands[0]) {
            this.hands[0].rotation.z = Math.sin(t * 0.6) * 0.015;
            this.hands[0].position.y = 1.085 + Math.max(0, Math.sin(t * 0.8)) * 0.004;
          }
        }
      }
      // look toward the player when observation is intense
      if (this.observedFor > 1.2 && hg) {
        const k = M.clamp((this.observedFor - 1.2) * 0.9, 0, 1);
        if (isFake) {
          hg.rotation.y = M.lerp(hg.rotation.y, 0, k * 0.2);
          hg.rotation.x = M.lerp(hg.rotation.x, 0.0, k * 0.2);
        }
      }
    }
    // walking
    if (this.state === 'entering' || this.state === 'leaving') {
      const speed = this.state === 'entering' ? 0.85 : 1.15;
      this.walkT = (this.walkT || 0) + dt;
      const dir = this.state === 'entering' ? 1 : -1;
      // move along a simple path using the target
      if (this.path) {
        const target = this.path[this.pathIndex];
        if (target) {
          const dx = target.x - this.group.position.x;
          const dz = target.z - this.group.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.05) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
              this.state = this.state === 'entering' ? 'arriving' : 'gone';
            }
          } else {
            const step = Math.min(dist, speed * dt);
            this.group.position.x += dx / dist * step;
            this.group.position.z += dz / dist * step;
            const targetRot = Math.atan2(dx, dz);
            this.group.rotation.y = M.wrapAngle(this.group.rotation.y + M.wrapAngle(targetRot - this.group.rotation.y) * Math.min(1, dt * 4));
          }
        }
      }
      // bob & arm swing
      this.group.position.y = Math.abs(Math.sin(this.walkT * 5.2)) * 0.022;
      if (this.hands[0] && this.hands[1]) {
        this.hands[0].position.y = 1.085 + Math.sin(this.walkT * 5.2) * 0.06;
        this.hands[1].position.y = 1.085 - Math.sin(this.walkT * 5.2) * 0.06;
      }
      this.syncGhost();
    }
    // lunge
    if (this.state === 'lunging') {
      this.lungeT += dt;
      const k = M.clamp(this.lungeT / 0.7, 0, 1);
      const tgt = this.lungeTarget || new THREE.Vector3(2.5, 1.3, 4.0);
      this.group.position.x = M.lerp(this.lungeStart.x, tgt.x, MS.Ease.inCubic(k));
      this.group.position.z = M.lerp(this.lungeStart.z, tgt.z, MS.Ease.inCubic(k));
      this.group.position.y = Math.sin(k * Math.PI * 0.5) * 0.1;
      this.group.rotation.y = M.lerp(this.lungeStartRot, Math.atan2(tgt.x - this.lungeStart.x, tgt.z - this.lungeStart.z), k);
      if (this.headGroup) {
        this.headGroup.rotation.z = 0.3 * k;
        this.headGroup.rotation.x = -0.1 * k;
        const s = 1 + 0.25 * k;
        this.headGroup.scale.setScalar(HEAD_SCALE * (this.look.headScale || 1) * s);
      }
      // arms up
      if (this.hands[0] && this.hands[1]) {
        this.hands[0].position.set(-0.3, 1.35 + k * 0.3, 0.34);
        this.hands[1].position.set(0.3, 1.35 + k * 0.3, 0.34);
      }
    }
    // ghost visibility
    if (this.ghost) {
      this.ghost.visible = this.visibleGhost !== false && (this.state === 'waiting' || this.state === 'talking' || this.state === 'entering');
      this.syncGhost();
    }
  };

  Customer.prototype.observe = function (dt) {
    this.observedFor += dt;
  };

  Customer.prototype.walkIn = function (fromX, fromZ, toX, toZ) {
    this.state = 'entering';
    this.path = [
      { x: fromX, z: fromZ },
      { x: fromX + (toX - fromX) * 0.45, z: fromZ - 0.6 },
      { x: toX, z: toZ }
    ];
    this.pathIndex = 0;
    this.group.position.set(fromX, 0, fromZ);
    this.group.rotation.y = Math.PI;
    this.syncGhost();
  };

  Customer.prototype.arrive = function (x, z) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = Math.PI;
    this.state = 'waiting';
    this.syncGhost();
  };

  Customer.prototype.leave = function (toX, toZ) {
    this.state = 'leaving';
    this.path = [
      { x: this.group.position.x, z: this.group.position.z },
      { x: -1.1, z: 5.0 },
      { x: toX == null ? -1.1 : toX, z: toZ == null ? 6.4 : toZ }
    ];
    this.pathIndex = 1;
  };

  Customer.prototype.faceAngle = function (y) {
    this.group.rotation.y = y;
  };

  Customer.prototype.startLunge = function (target) {
    if (this.state === 'dead') return;
    this.state = 'lunging';
    this.lungeT = 0;
    this.lungeStart = this.group.position.clone();
    this.lungeStartRot = this.group.rotation.y;
    this.lungeTarget = target || new THREE.Vector3(2.5, 1.3, 3.4);
  };

  Customer.prototype.kill = function (isHuman) {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.dead = true;
    if (this.ghost) { this.ghost.visible = false; }
    if (this.breath) this.breath.material.opacity = 0;
    // collapse
    const g = this.group;
    const startY = g.position.y;
    const t0 = performance.now();
    const self = this;
    const dir = this.isFake ? 1 : -1;
    function anim() {
      const k = M.clamp((performance.now() - t0) / (self.isFake ? 1400 : 1100), 0, 1);
      g.rotation.z = dir * MS.Ease.inCubic(k) * 1.25;
      g.position.y = startY - k * 0.7;
      if (self.headGroup) self.headGroup.rotation.x = k * 0.6;
      if (k < 1) requestAnimationFrame(anim);
      else {
        g.visible = false;
        self.spawnStain();
      }
    }
    anim();
  };

  Customer.prototype.spawnStain = function () {
    const mat = new THREE.MeshBasicMaterial({
      map: this.isFake ? T.oilStain() : T.bloodStain(),
      transparent: true, opacity: this.isFake ? 0.9 : 0.8, depthWrite: false,
      color: this.isFake ? 0x101014 : 0xffffff
    });
    const m = new THREE.Mesh(pg(), mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1.2, 1.2, 1);
    m.position.set(this.group.position.x, 0.016, this.group.position.z - 0.3);
    this.stain = m;
    this.group.parent.add(m);
  };

  Customer.prototype.dispose = function () {
    if (this.group && this.group.parent) this.group.parent.remove(this.group);
    if (this.ghost && this.ghost.parent) this.ghost.parent.remove(this.ghost);
    if (this.stain && this.stain.parent) this.stain.parent.remove(this.stain);
    if (this.headMesh) this.headMesh.material.dispose();
  };

  Customer.prototype.setHands = function (pose) {
    // reserved for future poses
  };

  Customers.Customer = Customer;
  Customers.create = function (def) { return new Customer(def); };

  MS.Customers = Customers;
})(window.MS);
