/* ============================================================
 * 长夜便利店 — 第一人称控制器 / 枪
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const M = MS.M, T = MS.T;
  const Player = {};

  const EYE = 1.62;
  const RADIUS = 0.26;

  Player.init = function (camera, canvas, world) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.position = world.PLAYER_START ? world.PLAYER_START.clone() : new THREE.Vector3(2.55, 0, 2.95);
    this.yaw = Math.PI;         // look toward +z
    this.pitch = -0.045;
    this.speed = 2.05;
    this.vel = new THREE.Vector3();
    this.mode = 'play';
    this.enabled = false;
    this.keys = {};
    this.stepAcc = 0;
    this.bobTime = 0;
    this.bobAmt = 0;
    this.shake = 0;
    this.shakeT = 0;
    this.ammo = 6;
    this.maxAmmo = 6;
    this.gunDrawn = false;
    this.drawT = 0;
    this.aiming = false;
    this.fireCooldown = 0;
    this.recoil = 0;
    this.muzzleT = 0;
    this.fovBase = 72;
    this.fovTarget = 72;
    this.fov = 72;
    this.sensitivity = 1.0;
    this.observeHold = 0;
    this.observing = false;
    this.focus = null;
    this.focusTarget = null;
    this.dialogueFocus = null;
    this.flashlightOn = false;
    this.pointerLocked = false;
    this._everLocked = false;
    this.mouseDown = false;
    this.aimDown = false;
    this.onShoot = null;
    this.onEmpty = null;
    this.onToggleGun = null;
    this.onFootstep = null;
    this.buildGun();
    this.buildFlashlight();
    // view-model geometry must not be visible to the CCTV camera
    this.camera.layers.enable(3);
    this.gunGroup.traverse(o => o.layers.set(3));
    this.flashlightBeam.layers.set(3);
    this.bind();
    this.applyCamera(0);
    return this;
  };

  /* ------------------------------------------------------------
   * View-model pistol
   * ------------------------------------------------------------ */
  Player.buildGun = function () {
    const gun = new THREE.Group();
    gun.position.set(0.2, -0.23, -0.42);
    gun.rotation.set(0.02, -0.07, 0);
    this.camera.add(gun);
    this.gunGroup = gun;
    const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.82, roughness: 0.32, envMapIntensity: 0.7 });
    const poly = new THREE.MeshStandardMaterial({ color: 0x111315, metalness: 0.25, roughness: 0.62, envMapIntensity: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, metalness: 0.7, roughness: 0.4 });
    const skin = new THREE.MeshStandardMaterial({ map: T.skin(), color: 0xa98b74, roughness: 0.62, envMapIntensity: 0.2 });
    const fabric = new THREE.MeshStandardMaterial({ map: T.fabric('#1c1f22'), roughness: 0.9 });

    function box(w, h, d, m, x, y, z, rx, ry, rz) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx || 0, ry || 0, rz || 0);
      gun.add(mesh);
      return mesh;
    }
    // slide / frame
    box(0.036, 0.046, 0.19, metal, 0, 0, -0.05);
    box(0.032, 0.028, 0.15, poly, 0, -0.035, -0.03);
    // barrel + muzzle
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.011, 0.06, 10), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.002, -0.155);
    gun.add(barrel);
    // slide serrations
    for (let i = 0; i < 5; i++) box(0.038, 0.042, 0.004, poly, 0, 0, 0.025 + i * 0.012);
    // sights
    box(0.008, 0.008, 0.008, metal, 0, 0.028, -0.13);
    box(0.026, 0.007, 0.008, metal, 0, 0.028, 0.035);
    // grip, angled
    const grip = new THREE.Group();
    grip.position.set(0, -0.075, 0.035);
    grip.rotation.x = 0.24;
    gun.add(grip);
    const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.112, 0.052), poly);
    gripMesh.position.y = -0.05;
    grip.add(gripMesh);
    const gripTex = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.09, 0.054), new THREE.MeshStandardMaterial({ map: T.fabric('#1a1b1d'), roughness: 0.95 }));
    gripTex.position.y = -0.05;
    grip.add(gripTex);
    // magazine base
    box(0.036, 0.01, 0.055, metal, 0, -0.115, 0.045, 0.24);
    // trigger guard
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 6, 12, Math.PI * 1.2), poly);
    guard.position.set(0, -0.045, -0.01);
    guard.rotation.set(Math.PI / 2, 0, 0.2);
    guard.scale.set(1, 0.8, 1);
    gun.add(guard);
    // hands (right grip, left support)
    const handR = new THREE.Group();
    handR.position.set(0.006, -0.055, 0.045);
    handR.rotation.x = 0.24;
    const palmR = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.086, 0.05), skin);
    palmR.position.set(0.023, -0.012, 0.0);
    handR.add(palmR);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.009, 0.055, 6), skin);
      f.rotation.z = Math.PI / 2;
      f.position.set(-0.006, 0.022 - i * 0.021, -0.028);
      handR.add(f);
    }
    const thumbR = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.010, 0.058, 6), skin);
    thumbR.rotation.set(0, 0, 0.9);
    thumbR.position.set(-0.012, -0.006, 0.03);
    handR.add(thumbR);
    gun.add(handR);
    const handL = new THREE.Group();
    handL.position.set(-0.045, -0.065, -0.005);
    handL.rotation.set(0.1, 0.35, -0.5);
    const palmL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.055), skin);
    handL.add(palmL);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0085, 0.05, 6), skin);
      f.rotation.set(0.35, 0, 1.1);
      f.position.set(0.012, 0.02 - i * 0.017, 0.028);
      handL.add(f);
    }
    gun.add(handL);
    // sleeves
    const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.16, 8), fabric);
    sleeveR.rotation.set(Math.PI / 2 - 0.3, 0, 0);
    sleeveR.position.set(0.03, -0.11, 0.14);
    gun.add(sleeveR);
    const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.17, 8), fabric);
    sleeveL.rotation.set(Math.PI / 2 - 0.15, 0, -0.35);
    sleeveL.position.set(-0.08, -0.13, 0.12);
    gun.add(sleeveL);

    // muzzle flash
    const flashMat = new THREE.SpriteMaterial({
      map: T.glow(), color: 0xffd08a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
    });
    const flash = new THREE.Sprite(flashMat);
    flash.scale.set(0.22, 0.22, 1);
    flash.position.set(0, 0.002, -0.20);
    gun.add(flash);
    this.muzzleFlash = flash;
    const smokeMat = new THREE.SpriteMaterial({
      map: T.glow(), color: 0x8899a0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    const smoke = new THREE.Sprite(smokeMat);
    smoke.scale.set(0.25, 0.25, 1);
    smoke.position.set(0, 0.01, -0.22);
    gun.add(smoke);
    this.smoke = smoke;

    gun.visible = false;
    this.gunRest = new THREE.Vector3(0.2, -0.23, -0.42);
    this.gunAim = new THREE.Vector3(0.075, -0.155, -0.3);
  };

  Player.buildFlashlight = function () {
    const spot = new THREE.SpotLight(0xfff1cf, 0, 14, 0.55, 0.55, 1.6);
    spot.position.set(0.08, -0.08, 0.0);
    spot.target.position.set(0.05, -0.15, -6);
    this.camera.add(spot);
    this.camera.add(spot.target);
    this.flashlight = spot;
    // beam mesh
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffeccb, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5, 16, 1, true), beamMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0.02, -0.1, -2.7);
    this.camera.add(beam);
    this.flashlightBeam = beam;
  };

  /* ------------------------------------------------------------
   * Input
   * ------------------------------------------------------------ */
  Player.bind = function () {
    const self = this;
    document.addEventListener('pointerlockchange', () => {
      self.pointerLocked = document.pointerLockElement === self.canvas;
      if (self.pointerLocked) self._everLocked = true;
      if (!self.pointerLocked && self.enabled && self.mode === 'play' && !self._suppressUnlock && self._everLocked) {
        if (MS.Game && MS.Game.onPointerUnlock) MS.Game.onPointerUnlock();
      }
      self._suppressUnlock = false;
    });
    document.addEventListener('pointerlockerror', () => {
      if (MS.Game && MS.Game.onPointerError) MS.Game.onPointerError();
    });
    document.addEventListener('mousemove', (e) => {
      if (!self.pointerLocked || !self.enabled) return;
      if (self.mode !== 'play') return;
      const s = 0.0022 * self.sensitivity;
      self.yaw -= e.movementX * s;
      self.pitch -= e.movementY * s;
      self.pitch = M.clamp(self.pitch, -1.35, 1.25);
    });
    document.addEventListener('mousedown', (e) => {
      if (!self.enabled) return;
      if (self.mode !== 'play') return;
      if (!self.pointerLocked) {
        self.requestLock();
        // still allow firing at the centre of the screen if the browser refuses the lock
      }
      if (e.button === 0) {
        self.mouseDown = true;
        self.tryFire();
      } else if (e.button === 2) {
        self.aimDown = true;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) self.mouseDown = false;
      if (e.button === 2) self.aimDown = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!self.keys[e.code]) self.keys[e.code] = true;
      if (!self.enabled) return;
      if (e.code === 'KeyF' && self.mode === 'play') self.toggleFlashlight();
      if (e.code === 'KeyG' && self.mode === 'play') self.toggleGun();
    });
    document.addEventListener('keyup', (e) => {
      self.keys[e.code] = false;
    });
    document.addEventListener('blur', () => {
      self.keys = {};
      self.mouseDown = false;
      self.aimDown = false;
    });
    this.canvas.addEventListener('click', () => {
      if (self.enabled && self.mode === 'play' && !self.pointerLocked) {
        self.requestLock();
      }
    });
  };

  Player.requestLock = function () {
    if (this.pointerLocked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  };
  Player.releaseLock = function () {
    if (document.pointerLockElement) {
      this._suppressUnlock = true;
      try { document.exitPointerLock(); } catch (e) {}
    }
  };

  Player.setMode = function (mode) {
    this.mode = mode;
    if (mode === 'play') {
      this.enabled = true;
    } else {
      this.keys = {};
      this.mouseDown = false;
      this.aimDown = false;
    }
  };

  Player.toggleGun = function (force) {
    const next = force == null ? !this.gunDrawn : force;
    if (next === this.gunDrawn) return;
    this.gunDrawn = next;
    this.gunGroup.visible = true;
    this.drawT = next ? 0 : 0.28;
    this.drawDir = next ? 1 : -1;
    if (next) {
      this.aiming = false;
      if (MS.Audio) MS.Audio.play('gunDraw');
    } else if (MS.Audio) {
      MS.Audio.play('holster');
    }
  };

  Player.toggleFlashlight = function () {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? 2.2 : 0;
    this.flashlightBeam.visible = this.flashlightOn;
    if (MS.Audio) MS.Audio.play(this.flashlightOn ? 'flashlightOn' : 'flashlightOff');
    if (MS.Game && MS.Game.onFlashlight) MS.Game.onFlashlight(this.flashlightOn);
  };

  Player.tryFire = function () {
    if (this.mode !== 'play' || !this.enabled) return;
    if (!this.gunDrawn) {
      if (MS.Audio) MS.Audio.play('dryClick');
      return;
    }
    if (this.drawT < 0.32 && this.drawDir > 0) return;
    if (this.fireCooldown > 0) return;
    if (this.ammo <= 0) {
      if (MS.Audio) MS.Audio.play('dryClick');
      if (this.onEmpty) this.onEmpty();
      return;
    }
    this.ammo--;
    this.fireCooldown = 0.16;
    this.recoil = 1;
    this.muzzleT = 0.055;
    this.fireFlash = 0.05;
    this.shake = Math.max(this.shake, 0.014);
    this.pitch += 0.035;
    this.yaw += (Math.random() - 0.5) * 0.006;
    if (MS.Audio) MS.Audio.play('gunshot');
    if (this.onShoot) this.onShoot();
  };

  Player.addShake = function (amt, time) {
    try {
      if (MS.Storage.load().settings.shake === false) return;
    } catch (e) {}
    this.shake = Math.max(this.shake, amt || 0.01);
    this.shakeT = Math.max(this.shakeT, time || 0.3);
  };

  Player.isLookingAt = function (pos, maxAngle) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const to = pos.clone().sub(this.camera.position).normalize();
    return dir.dot(to) >= Math.cos(maxAngle == null ? 0.5 : maxAngle);
  };

  Player.getAimRay = function () {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return new THREE.Raycaster(this.camera.position.clone(), dir, 0.05, 40);
  };

  /* ------------------------------------------------------------
   * Update
   * ------------------------------------------------------------ */
  Player.update = function (dt) {
    const keys = this.keys;
    const playing = this.enabled && this.mode === 'play';
    let mx = 0, mz = 0;
    if (playing) {
      if (keys['KeyW']) mz += 1;
      if (keys['KeyS']) mz -= 1;
      if (keys['KeyA']) mx -= 1;
      if (keys['KeyD']) mx += 1;
      if (keys['ShiftLeft'] || keys['ShiftRight']) { /* walk only */ }
    }
    const len = Math.hypot(mx, mz);
    let moving = false;
    if (len > 0) {
      mx /= len; mz /= len;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const speed = this.observing ? this.speed * 0.45 : this.speed;
      const dx = (forward.x * mz + right.x * mx) * speed * dt;
      const dz = (forward.z * mz + right.z * mx) * speed * dt;
      this.tryMove(dx, dz);
      moving = true;
      this.stepAcc += dt * (this.observing ? 0.5 : 1);
      if (this.stepAcc > 0.42) {
        this.stepAcc = 0;
        if (this.onFootstep) this.onFootstep();
      }
    } else {
      this.stepAcc = 0.34;
    }
    // bob
    this.bobTime += dt * (moving ? 8.2 : 1.1);
    const bobTarget = moving ? 1 : 0;
    this.bobAmt = M.damp(this.bobAmt, bobTarget, 6, dt);
    // gun
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.drawT > 0) this.drawT = Math.max(0, this.drawT - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 7);
    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      this.muzzleFlash.material.opacity = Math.max(0, this.muzzleT / 0.055) * 0.95;
      this.smoke.material.opacity = Math.max(0, this.muzzleT / 0.055) * 0.22;
      this.smoke.scale.setScalar(0.2 + (0.055 - this.muzzleT) * 3);
    } else {
      this.muzzleFlash.material.opacity = 0;
      this.smoke.material.opacity = 0;
    }
    // aim / FOV
    const wantAim = this.aimDown && this.gunDrawn && this.mode === 'play';
    this.aiming = wantAim;
    let fovTarget = this.fovBase;
    if (this.observing) fovTarget = 56;
    else if (this.dialogueFocus) fovTarget = 64;
    else if (this.aiming) fovTarget = 55;
    if (this.mode !== 'play') fovTarget = 64;
    this.fov = M.damp(this.fov, fovTarget, 7, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    // dialogue focus
    if (this.dialogueFocus) {
      const to = this.dialogueFocus.clone().sub(this.camera.position);
      const targetYaw = Math.atan2(-to.x, -to.z);
      const targetPitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
      this.yaw += M.wrapAngle(targetYaw - this.yaw) * Math.min(1, dt * 3.2);
      this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 3.2);
    }
    // shake
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.shake = M.damp(this.shake, 0, 7, dt);
    // apply camera
    this.applyCamera(dt, moving);
    // observe hold
    if (playing && keys['KeyQ'] && this.focusTarget && this.focusTarget.kind === 'customer') {
      if (!this.observing && MS.Game && MS.Game.onObserveStart) MS.Game.onObserveStart(this.focusTarget.customer);
      this.observing = true;
      this.observeHold += dt;
      if (MS.Game && MS.Game.onObserveTick) MS.Game.onObserveTick(dt);
    } else {
      if (this.observing && MS.Game && MS.Game.onObserveEnd) MS.Game.onObserveEnd();
      this.observing = false;
      this.observeHold = 0;
    }
    // gun pose
    if (this.gunGroup.visible) this.updateGunPose(dt);
  };

  Player.applyCamera = function (dt, moving) {
    const eye = EYE + Math.sin(this.bobTime) * 0.012 * this.bobAmt;
    const side = Math.cos(this.bobTime * 0.5) * 0.008 * this.bobAmt;
    this.camera.position.set(this.position.x + side * Math.cos(this.yaw), eye, this.position.z - side * Math.sin(this.yaw));
    if (this.shake > 0.0001) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s * 2;
      this.camera.position.y += (Math.random() - 0.5) * s * 2;
      this.camera.position.z += (Math.random() - 0.5) * s * 0.5;
    }
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + (this.recoil * 0.03) + (this.shakeT > 0 ? (Math.random() - 0.5) * this.shake * 0.4 : 0);
    this.camera.rotation.z = Math.sin(this.bobTime * 0.5) * 0.0035 * this.bobAmt - (this.aiming ? 0 : 0);
  };

  Player.updateGunPose = function (dt) {
    const g = this.gunGroup;
    if (!this.gunDrawn && this.drawT <= 0) {
      if (g.visible) g.visible = false;
      return;
    }
    const aim = this.aiming ? 1 : 0;
    const base = this.gunRest.clone().lerp(this.gunAim, aim);
    let y = base.y;
    let x = base.x;
    let z = base.z;
    // draw/holster
    if (this.drawT > 0) {
      const k = 1 - this.drawT / 0.28;
      if (this.drawDir > 0) {
        y = base.y - (1 - MS.Ease.outCubic(M.clamp(k, 0, 1))) * 0.45;
        x = base.x + (1 - k) * 0.06;
      } else {
        y = base.y - MS.Ease.inCubic(k) * 0.45;
      }
    }
    // breathing sway
    const t = performance.now() * 0.001;
    const sway = this.aiming ? 0.0012 : 0.0032;
    x += Math.sin(t * 1.5) * sway;
    y += Math.cos(t * 1.1) * sway * 0.8;
    z += Math.sin(t * 0.7) * 0.002;
    // recoil
    const rc = this.recoil;
    g.position.set(x, y + rc * 0.012, z + rc * 0.07);
    g.rotation.set(0.02 + rc * 0.16, -0.07 + Math.sin(t * 0.6) * 0.002, rc * -0.03);
  };

  Player.tryMove = function (dx, dz) {
    const w = this.world;
    if (!w) return;
    const bounds = w.bounds || { x1: -4.34, x2: 4.34, z1: -7.85, z2: 5.94 };
    const collides = (x, z) => {
      if (x < bounds.x1 || x > bounds.x2 || z < bounds.z1 || z > bounds.z2) return true;
      for (let i = 0; i < w.colliders.length; i++) {
        const c = w.colliders[i];
        if (c.enabled === false) continue;
        if (x > c.x1 - RADIUS && x < c.x2 + RADIUS && z > c.z1 - RADIUS && z < c.z2 + RADIUS) return true;
      }
      return false;
    };
    if (!collides(this.position.x + dx, this.position.z)) this.position.x += dx;
    if (!collides(this.position.x, this.position.z + dz)) this.position.z += dz;
  };

  Player.reset = function (ammo) {
    this.position.copy(this.world.PLAYER_START || new THREE.Vector3(2.55, 0, 2.95));
    this.yaw = Math.PI;
    this.pitch = -0.045;
    this.ammo = ammo == null ? this.maxAmmo : ammo;
    this.gunDrawn = false;
    this.gunGroup.visible = false;
    this.aiming = false;
    this.observing = false;
    this.shake = 0;
    this.stepAcc = 0;
    this.bobTime = 0;
    this.fireCooldown = 0;
    this.recoil = 0;
    this.keys = {};
    this.applyCamera(0);
  };

  MS.Player = Player;
})(window.MS);
