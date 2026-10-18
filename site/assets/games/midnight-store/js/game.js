/* ============================================================
 * 长夜便利店 — 游戏主逻辑
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const M = MS.M, D = MS.DOM;
  const G = MS.Game = {};
  const Story = () => MS.Story;
  const World = () => MS.World;
  const UI = () => MS.UI;
  const Audio = () => MS.Audio;
  const Player = () => MS.Player;

  G.quality = 'medium';
  G.fps = 60;
  G.fpsMeter = null;

  function defaultState() {
    return {
      mode: 'boot',
      nightId: 1,
      night: null,
      clock: 0,
      realDuration: 420,
      timeline: [],
      eventIndex: 0,
      pendingSpawns: [],
      active: null,
      service: null,
      observe: { on: false, time: 0, seen: [] },
      waitTime: 0,
      lunge: null,
      stats: { served: 0, fakes: 0, humansShot: 0, shots: 0, missed: 0 },
      log: [],
      objective: '',
      started: false,
      ended: false,
      finaleStarted: false,
      finalePending: false,
      finaleOptions: null,
      codeWord: '',
      lastRadio: '',
      hold: { kind: null, t: 0, dur: 0, target: null },
      focus: null,
      doorTween: null,
      flickerT: 0,
      watcher: false,
      tension: 0,
      fear: 0,
      nightTitle: '',
      deathReason: '',
      quality: 'medium',
      debug: false,
      hudAcc: 0,
      introActive: false
    };
  }

  G.state = defaultState();

  /* ------------------------------------------------------------
   * init
   * ------------------------------------------------------------ */
  G.init = function (opts) {
    G.renderer = opts.renderer;
    G.scene = opts.scene;
    G.camera = opts.camera;
    G.canvas = opts.canvas;
    G.state.quality = MS.Storage.load().settings.quality || 'medium';
    G.quality = G.state.quality;
    G.fpsMeter = MS.FpsMeter();

    G.customerRoot = new THREE.Group();
    G.customerRoot.name = 'customers';
    MS.World.root.add(G.customerRoot);
    G.itemRoot = new THREE.Group();
    MS.World.root.add(G.itemRoot);

    const P = MS.Player.init(G.camera, G.canvas, MS.World);
    P.onShoot = () => G.handleShot();
    P.onFootstep = () => { if (MS.Audio) MS.Audio.play('footstep'); };
    P.onEmpty = () => {
      UI().toast('枪里没有子弹了。');
      if (MS.Audio) MS.Audio.play('dryClick');
    };
    G.player = P;

    G.bindKeys();
    UI().init(G);
    UI().applySettingsToUI();

    G.state.mode = 'title';
    G.state.started = false;
    G.setTitleCamera();
    UI().showTitle();
    UI().setAmmo(0, 6);
    if (MS.Audio) {
      MS.Audio.setVolume(MS.Storage.load().settings.volume);
      MS.Audio.setVoice(MS.Storage.load().settings.voice);
    }
    // debug direct night
    const params = new URLSearchParams(location.search);
    if (params.get('night')) {
      const n = parseInt(params.get('night'), 10);
      if (n >= 1 && n <= 5) {
        G.state.debug = true;
        setTimeout(() => { G.startNight(n, { skipBriefing: true }); }, 400);
      }
    }
  };

  G.bindKeys = function () {
    document.addEventListener('keydown', (e) => {
      const s = G.state;
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Escape') {
        if (s.mode === 'id') { G.closeID(); e.preventDefault(); return; }
        if (s.mode === 'paper') { G.closePaper(); e.preventDefault(); return; }
        if (s.mode === 'journal') { G.closeJournal(); e.preventDefault(); return; }
        if (s.mode === 'monitor') { G.closeMonitor(); e.preventDefault(); return; }
        if (s.mode === 'settings') { UI().closeSettings(); G.state.mode = s._prevMode || 'pause'; UI().showPause(true); e.preventDefault(); return; }
        if (s.mode === 'pause') { G.resume(); e.preventDefault(); return; }
        if (s.mode === 'play' && !s.lunge) { G.pause(); e.preventDefault(); return; }
        return;
      }
      if (s.mode === 'id' && (e.code === 'KeyE' || e.code === 'Space')) { G.closeID(); e.preventDefault(); return; }
      if (s.mode === 'paper' && (e.code === 'KeyE' || e.code === 'Space')) { G.closePaper(); e.preventDefault(); return; }
      if (s.mode === 'monitor' && (e.code === 'KeyE' || e.code === 'Space')) { G.closeMonitor(); e.preventDefault(); return; }
      if (s.mode === 'journal' && e.code === 'Tab') { G.closeJournal(); e.preventDefault(); return; }
      if (s.mode === 'briefing' && (e.code === 'Enter' || e.code === 'Space')) {
        if (performance.now() - (s.briefingAt || 0) < 500) return;
        G.beginFromBriefing(); e.preventDefault(); return;
      }
      if (s.mode === 'pause' && (e.code === 'KeyG')) return;
      if (s.mode === 'play' && e.code === 'Tab') { G.openJournal(); e.preventDefault(); return; }
      if ((s.mode === 'dialogue' || s.mode === 'finale') && e.code === 'KeyG') {
        // draw the gun and close the conversation
        G.closeDialogueToPlay(true);
        if (!Player().gunDrawn) Player().toggleGun(true);
        e.preventDefault();
        return;
      }
      if (s.mode === 'finale') {
        // digits handled by UI
        return;
      }
      if (s.mode === 'play' && e.code === 'KeyE') {
        // handled in update edge
      }
      if (s.mode === 'play' && e.code === 'BracketRight') {
        G.debugSkip(30);
      }
    });
    // allow closing settings from title and pause
    document.addEventListener('keyup', () => {});
  };

  /* ------------------------------------------------------------
   * Title
   * ------------------------------------------------------------ */
  G.setTitleCamera = function () {
    const cam = G.camera;
    G.titleCam = {
      pos: new THREE.Vector3(-3.6, 2.55, 14.6),
      look: new THREE.Vector3(1.3, 2.75, 6.2),
      t: 0
    };
    cam.position.copy(G.titleCam.pos);
    cam.rotation.order = 'YXZ';
    G.lookAt(cam, G.titleCam.look);
    cam.fov = 62;
    cam.updateProjectionMatrix();
    if (G.player) { G.player.gunGroup.visible = false; G.player.flashlight.intensity = 0; G.player.flashlightBeam.visible = false; }
  };

  G.lookAt = function (cam, target) {
    const dir = target.clone().sub(cam.position).normalize();
    cam.rotation.y = Math.atan2(-dir.x, -dir.z);
    cam.rotation.x = Math.asin(M.clamp(dir.y, -1, 1));
    cam.rotation.z = 0;
  };

  G.updateTitle = function (dt) {
    if (!G.titleCam) return;
    G.titleCam.t += dt;
    const cam = G.camera;
    const t = G.titleCam.t;
    const px = G.titleCam.pos.x + Math.sin(t * 0.06) * 0.35;
    const py = G.titleCam.pos.y + Math.sin(t * 0.09 + 1.3) * 0.06;
    cam.position.set(px, py, G.titleCam.pos.z + Math.sin(t * 0.043) * 0.25);
    G.lookAt(cam, G.titleCam.look);
    if (MS.World && MS.World.setWatcher) MS.World.setWatcher(false);
  };

  G.showTitleScene = function () {
    G.state.mode = 'title';
    G.state.started = false;
    G.player.enabled = false;
    G.player.setMode('title');
    G.player.releaseLock();
    G.setTitleCamera();
    UI().showTitle();
    UI().showHUD(false);
    UI().hideDialogue();
    UI().hideID();
    UI().hideObserve();
    UI().hideJournal();
    UI().hidePaper();
    UI().hideEnding();
    UI().hideNightEnd();
    UI().hideDead();
    UI().showPause(false);
    UI().hideBriefing();
    UI().setFear(0);
    UI().setAmmo(0, 6);
    if (MS.Audio) MS.Audio.setTension(0);
    G.state.lunge = null;
  };

  G.toTitle = function () {
    G.cleanupCustomer();
    G.state.mode = 'title';
    G.state.started = false;
    G.state.ended = false;
    if (MS.World) {
      MS.World.setPower(true);
      MS.World.setWatcher(false);
    }
    if (G.player) {
      G.player.setMode('title');
      G.player.enabled = false;
      G.player.gunDrawn = false;
      G.player.gunGroup.visible = false;
      G.player.dialogueFocus = null;
      G.player.releaseLock();
    }
    UI().hideJournal(); UI().hidePaper(); UI().hideID(); UI().hideDialogue();
    UI().hideNightEnd(); UI().hideDead(); UI().hideEnding(); UI().hideBriefing();
    UI().showPause(false);
    UI().setFear(0);
    UI().setHold(null);
    UI().setPrompt('', 'E', false);
    UI().showTitle();
    UI().showHUD(false);
    G.setTitleCamera();
    G.state.stats = defaultState().stats;
    G.state.log = [];
    if (MS.Audio) { MS.Audio.setTension(0); MS.Audio.stopSpeaking(); }
    G.refreshNightDoor();
  };

  /* ------------------------------------------------------------
   * Night setup
   * ------------------------------------------------------------ */
  G.newGame = function () {
    if (MS.Audio) MS.Audio.init();
    UI().hideTitle();
    const d = MS.Storage.load();
    if (!d.seenIntro) {
      d.seenIntro = true; MS.Storage.save();
      G.state.mode = 'intro';
      UI().showIntro(
        '三个月前，我妹妹在长夜路下了车。\n\n监控只拍到她走进一条没有出口的巷子。\n\n我接了这家便利店的夜班。\n\n……我只是想等她回来。',
        () => G.startNight(1, { skipBriefing: false })
      );
    } else {
      G.startNight(1, { skipBriefing: false });
    }
  };

  G.continueGame = function () {
    const d = MS.Storage.load();
    const n = M.clamp(d.unlocked || 1, 1, 5);
    UI().hideTitle();
    G.startNight(n, { skipBriefing: false });
  };

  G.startNight = function (id, opts) {
    opts = opts || {};
    if (MS.Audio) MS.Audio.init();
    G.cleanupCustomer();
    G.clearItems();
    G.clearStains();
    const night = MS.Story.NIGHTS[id - 1];
    if (!night) { G.toTitle(); return; }
    G.state = defaultState();
    G.state.nightId = id;
    G.state.night = night;
    G.state.mode = opts.skipBriefing ? 'play' : 'briefing';
    G.state.clock = 0;
    G.state.realDuration = night.realDuration || 420;
    G.state.timeline = (night.timeline || []).map(ev => Object.assign({}, ev, { _time: MS.timeToMinutes(ev.t) })).sort((a, b) => a._time - b._time);
    G.state.nightTitle = '第' + ['一', '二', '三', '四', '五'][id - 1] + '夜 · ' + night.title;
    G.state.codeWord = night.codeWord || '';
    G.state.lastRadio = '';
    G.state.night.code2 = night.code2 || '';
    G.state.stats = { served: 0, fakes: 0, humansShot: 0, shots: 0, missed: 0 };
    G.state.log = [];
    G.state.objective = '在柜台后面等第一位客人。';
    G.state.debug = !!(new URLSearchParams(location.search).get('debug'));

    // reset world
    const W = MS.World;
    W.setPower(true);
    W.setWatcher(false);
    W.opened = false;
    if (W.lights.staff) W.lights.staff.intensity = 0;
    if (W.doorMesh) W.doorMesh.visible = true;
    if (W.backRoomDoorCollider) W.backRoomDoorCollider.enabled = true;
    if (W.backRoomGroup) W.backRoomGroup.visible = false;
    if (W.doorGlass) W.doorGlass.position.x = W.doorGlass.userData.homeX;
    W._flicker = null;
    W._bellSwing = 0;
    if (W.lights.street) W.lights.street.intensity = 2.4;

    // player
    const P = MS.Player;
    P.reset(6);
    P.enabled = false;
    P.setMode('play');
    P.dialogueFocus = null;
    P.flashlightOn = false;
    P.flashlight.intensity = 0;
    P.flashlightBeam.visible = false;
    P.gunDrawn = false;
    P.gunGroup.visible = false;
    P.observing = false;
    P.focusTarget = null;
    G.player = P;

    // ui
    UI().hideTitle();
    UI().showHUD(false);
    UI().hideDead();
    UI().hideEnding();
    UI().hideNightEnd();
    UI().hideDialogue();
    UI().hideID();
    UI().hideObserve();
    UI().hideJournal();
    UI().hidePaper();
    UI().showPause(false);
    UI().setObjective(G.state.objective);
    UI().setAmmo(6, 6);
    UI().setPrompt('', 'E', false);
    UI().setHold(null);
    UI().setFear(0);
    UI().setMood('安静', '#a5dcb6');
    UI().setHUD(G.state.nightTitle, '22:00', '06:00', G.state.objective);
    W.clockMinutes = 0;

    if (opts.skipBriefing || opts.retry) {
      G.beginPlay(true);
    } else {
      G.state.briefingAt = performance.now();
      UI().showBriefing({
        id: id,
        kicker: '第 ' + ['一', '二', '三', '四', '五'][id - 1] + ' 夜 · 22:00',
        title: night.title,
        quote: night.quote,
        bullets: night.bullets,
        sign: '长夜便利店 · 交接记录'
      });
      UI().hideTitle();
    }
  };

  G.beginFromBriefing = async function () {
    if (G.state.mode !== 'briefing') return;
    UI().hideBriefing();
    UI().fade(true);
    G.beginPlay(false);
    setTimeout(() => UI().fade(false), 350);
  };

  G.beginPlay = function (skipFade) {
    const s = G.state;
    s.mode = 'play';
    s.started = true;
    s.ended = false;
    s.clock = 0;
    s.eventIndex = 0;
    s.pendingSpawns = [];
    s.lunge = null;
    s.observe = { on: false, time: 0, seen: [] };
    s.waitTime = 0;
    s.tension = 0;
    s.fear = 0;
    s.hold = { kind: null, t: 0, dur: 0, target: null };
    const P = MS.Player;
    P.enabled = true;
    P.setMode('play');
    P.reset(6);
    P.dialogueFocus = null;
    P.gunGroup.visible = false;
    P.flashlight.intensity = 0;
    P.flashlightOn = false;
    P.flashlightBeam.visible = false;
    P.observing = false;
    P.focusTarget = null;
    UI().showHUD(true);
    UI().hideTitle();
    UI().hideBriefing();
    UI().showPause(false);
    UI().setHUD(s.nightTitle, '22:00', '06:00', s.objective);
    UI().setAmmo(6, 6);
    s.stats = { served: 0, fakes: 0, humansShot: 0, shots: 0, missed: 0 };
    s.log = [];
    if (MS.Audio) {
      MS.Audio.init();
      MS.Audio.setTension(0);
      MS.Audio.startAmbient();
      MS.Audio.speak('值班开始。', 'inner');
    }
    // lock after a user gesture already happened (button click)
    // lock after a user gesture already happened (button click)
    setTimeout(() => {
      if (G.state.mode !== 'play') return;
      if (!MS.Player.pointerLocked) {
        MS.Player.requestLock();
        UI().toast('点击画面以锁定鼠标。', 4200);
      }
    }, 1500);
    setTimeout(() => { if (G.state.mode === 'play') MS.Player.requestLock(); }, 2200);
  };

  G.refreshNightDoor = function () {
    const W = MS.World;
    if (!W) return;
    if (W.doorMesh) W.doorMesh.visible = !W.opened;
    if (W.backRoomDoorCollider) W.backRoomDoorCollider.enabled = !W.opened;
    if (W.backRoomGroup) W.backRoomGroup.visible = !!W.opened;
    if (W.lights.staff) W.lights.staff.intensity = W.opened ? 0.32 : 0;
  };

  G.toggleBackRoom = function () {
    const W = MS.World;
    if (W.powerOff) { UI().toast('太黑了。你需要先找到配电箱。'); return; }
    W.opened = !W.opened;
    G.refreshNightDoor();
    if (MS.Audio) MS.Audio.play('doorLocked');
    if (W.opened) {
      UI().toast('你打开了后仓的门。里面很冷。');
      G.log('后仓门打开');
    } else {
      UI().toast('你把门关上了。');
    }
  };

  /* ------------------------------------------------------------
   * Customer
   * ------------------------------------------------------------ */
  G.cleanupCustomer = function () {
    const s = G.state;
    if (s.active) {
      if (s.active.dispose) s.active.dispose();
      s.active = null;
    }
    // clear leftover groups
    if (G.customerRoot) {
      while (G.customerRoot.children.length) G.customerRoot.remove(G.customerRoot.children[0]);
    }
    s.service = null;
    s.lunge = null;
    s.observe = { on: false, time: 0, seen: [] };
    if (MS.Player) MS.Player.dialogueFocus = null;
    UI().hideObserve();
    UI().hideDialogue();
    UI().hideID();
  };

  G.clearItems = function () {
    if (!G.itemRoot) return;
    while (G.itemRoot.children.length) {
      const c = G.itemRoot.children[0];
      G.itemRoot.remove(c);
    }
  };

  G.clearStains = function () {
    if (!G.customerRoot) return;
  };

  G.spawnCustomer = function (id, opts) {
    opts = opts || {};
    const def = MS.Story.CUSTOMERS[id];
    if (!def) { console.warn('missing customer', id); return; }
    if (!def.portraitData) {
      const po = def.portrait || { kind: def.kind === 'fake' ? 'fake' : 'human' };
      let pk = po.kind || (def.kind === 'fake' ? 'fake' : 'human');
      if (def.kind === 'fake' && def.humanFace) pk = (def.look && def.look.face === 'b') ? 'humanB' : 'human';
      def.portraitData = MS.T.idPortrait(pk, po);
    }
    if (def.id && !def.id.photo) {
      let pk = (def.portrait && def.portrait.kind) || (def.kind === 'fake' ? 'fake' : 'human');
      if (def.kind === 'fake' && def.humanFace) pk = (def.look && def.look.face === 'b') ? 'humanB' : 'human';
      def.id.photo = MS.T.idPortrait(pk, def.portrait || {});
    }
    const c = MS.Customers.create(def);
    c.attachTo(G.customerRoot);
    c.visibleGhost = !opts.outside;
    G.state.active = c;
    G.state.service = {
      greeted: false, requested: false, scanned: false, idChecked: false,
      codeAsked: false, paid: false, items: def.items ? def.items.slice() : [],
      total: (def.items || []).reduce((a, b) => a + b.price, 0),
      codeCorrect: false, codeAskedLine: '',
      clues: [], text: ''
    };
    G.state.waitTime = 0;
    G.state.observe = { on: false, time: 0, seen: [] };
    const anchor = MS.World.CUSTOMER_ANCHOR;
    if (opts.outside) {
      c.setPosition(2.35, 7.15, Math.PI);
      c.state = 'waiting';
      c.visibleGhost = false;
      c.group.visible = true;
      G.state.waitTime = 0;
      return c;
    }
    if (opts.silent || def.entry === 'silent') {
      c.arrive(anchor.x, anchor.z);
      c.visibleGhost = false;
      if (MS.World) { MS.World.flicker(0.8); MS.World.ringBell(); }
      if (MS.Audio) { MS.Audio.play('stinger'); MS.Audio.play('flicker'); }
      G.state.waitTime = 0;
      G.state.tension += 0.25;
      UI().setObjective('柜台前有人。你没有听见门铃。');
      return c;
    }
    c.walkIn(-1.1, 5.9, anchor.x, anchor.z);
    if (MS.World) { MS.World.ringBell(); G.openDoorAnim(); }
    if (MS.Audio) MS.Audio.play('doorChime');
    G.state.waitTime = 0;
    UI().setObjective('有一位客人走进了店里。');
    return c;
  };

  G.openDoorAnim = function () {
    const W = MS.World;
    if (!W || !W.doorGlass) return;
    const glass = W.doorGlass;
    const home = glass.userData.homeX || -1.1;
    if (G.state.doorTween) return;
    G.state.doorTween = { t: 0, phase: 0, home: home };
    if (MS.Audio) MS.Audio.play('doorSlide');
  };

  G.updateDoor = function (dt) {
    const tw = G.state.doorTween;
    const W = MS.World;
    if (!tw || !W || !W.doorGlass) return;
    tw.t += dt;
    const glass = W.doorGlass;
    if (tw.phase === 0) {
      glass.position.x = M.lerp(tw.home, tw.home - 1.22, M.clamp(tw.t / 0.45, 0, 1));
      if (tw.t >= 0.45) { tw.phase = 1; tw.t = 0; }
    } else if (tw.phase === 1) {
      if (tw.t > 1.3) { tw.phase = 2; tw.t = 0; }
    } else {
      glass.position.x = M.lerp(tw.home - 1.22, tw.home, M.clamp(tw.t / 0.55, 0, 1));
      if (tw.t >= 0.55) {
        glass.position.x = tw.home;
        G.state.doorTween = null;
      }
    }
  };

  G.onCustomerArrived = function () {
    const s = G.state;
    if (!s.active) return;
    s.active.state = 'waiting';
    s.active.arrive(MS.World.CUSTOMER_ANCHOR.x, MS.World.CUSTOMER_ANCHOR.z);
    s.waitTime = 0;
    if (s.active.isFake) {
      G.state.tension += 0.12;
      UI().setObjective('柜台前站着一个客人。');
    } else {
      UI().setObjective('柜台前站着一位客人。按 E 接待。');
    }
    if (MS.Audio) MS.Audio.play('stepHuman');
  };

  G.openCustomerDialogue = function () {
    const s = G.state;
    if (!s.active || s.active.state === 'dead' || s.active.state === 'lunging') return;
    if (s.active.state === 'entering' || s.active.state === 'arriving') return;
    if (s.active.isFake && s.lunge) return;
    UI().showPause(false);
    s.mode = 'dialogue';
    const P = MS.Player;
    P.setMode('dialogue');
    P.enabled = false;
    P.releaseLock();
    P.dialogueFocus = new THREE.Vector3(s.active.group.position.x, s.active.headGroupY + 0.03, s.active.group.position.z);
    s.active.state = 'talking';
    s.service.text = s.service.greeted ? (s.active.def.dialogue.remind || '……') : (s.active.def.dialogue.greet || '……');
    if (!s.service.greeted) { s.service.greeted = true; G.log(s.active.def.name + ' · 开始接待'); }
    G.sayCustomer(s.service.text);
    G.showOptions();
    if (MS.Audio) {
      if (s.active.isFake) { MS.Audio.play('fakeVoice'); }
      else MS.Audio.play('uiClick');
      let openKind = 'customer';
      if (s.active.isFake) openKind = (s.active.def.sex === '女') ? 'fakeF' : 'fake';
      else if (s.active.def.sex === '女') openKind = 'customerF';
      MS.Audio.speak(s.service.text, openKind);
    }
  };

  G.sayCustomer = function (text) {
    const s = G.state;
    UI().showDialogue(s.active, s.active.def.name, G.customerSub(), text, s.currentOptions || []);
    UI().updateDialogueClock(MS.clockString(s.clock));
    if (MS.Audio) {
      let kind = 'customer';
      if (s.active.isFake) kind = (s.active.def.sex === '女') ? 'fakeF' : 'fake';
      else if (s.active.def.sex === '女') kind = 'customerF';
      MS.Audio.speak(text, kind);
    }
  };

  G.customerSub = function () {
    const def = G.state.active ? G.state.active.def : null;
    if (!def) return '';
    const tags = def.tags || [];
    return tags.length ? tags.join(' · ') : '站在柜台前';
  };

  G.showOptions = function () {
    const opts = G.buildOptions();
    G.state.currentOptions = opts;
    UI().setDialogueOptions(opts);
  };

  G.buildOptions = function () {
    const s = G.state;
    const sv = s.service;
    const def = s.active.def;
    const opts = [];
    if (!sv.greeted) {
      opts.push({ id: 'greet', label: '“欢迎光临。”', tag: '' });
      return opts;
    }
    if (!sv.requested) {
      opts.push({ id: 'ask', label: def.items && def.items.length ? '“请问需要什么？”' : '“……你在等什么？”' });
    }
    if (!sv.codeAsked) {
      opts.push({ id: 'code', label: '“今晚的口令是什么？”', tag: '核对' });
    }
    if (!sv.idChecked) {
      opts.push({ id: 'id', label: '“能看一下你的证件吗？”', tag: '核对' });
    }
    if (sv.requested && sv.items.length && !sv.scanned) {
      opts.push({ id: 'scan', label: '“我扫一下商品。”', tag: '收银' });
    }
    if (sv.requested && sv.items.length) {
      opts.push({ id: 'pay', label: '“一共 ' + sv.total.toFixed(2) + ' 元。”', tag: '收钱' });
    }
    if (!sv.items.length) {
      opts.push({ id: 'turn', label: '“店里不方便。请你离开。”', danger: true, tag: '拒绝' });
    }
    opts.push({ id: 'stepback', label: '（退后一步，先观察他）', tag: 'Q' });
    if (opts.length > 6) opts.length = 6;
    return opts;
  };

  G.onDialogueOption = function (i) {
    const s = G.state;
    if (s.mode === 'finale') { G.finaleChoice(i); return; }
    if (s.mode !== 'dialogue') return;
    const opt = (s.currentOptions || [])[i];
    if (!opt) return;
    if (MS.Audio) MS.Audio.play('uiClick');
    const sv = s.service;
    const def = s.active.def;
    switch (opt.id) {
      case 'greet':
        sv.greeted = true;
        G.sayCustomer(def.dialogue.greet);
        G.showOptions();
        break;
      case 'ask':
        sv.requested = true;
        G.sayCustomer(def.dialogue.request);
        if (sv.items.length) G.placeItems(sv.items);
        else if (s.active.isFake) { s.tension += 0.08; }
        G.showOptions();
        break;
      case 'code':
        G.doCode();
        break;
      case 'id':
        G.doId();
        break;
      case 'scan':
        sv.scanned = true;
        if (MS.Audio) MS.Audio.play('scanner');
        G.sayCustomer(def.dialogue.scan || '……');
        G.addServiceClue('scan');
        setTimeout(() => { if (MS.Audio) MS.Audio.play('register'); }, 400);
        G.showOptions();
        break;
      case 'pay':
        G.doPay();
        break;
      case 'turn':
        G.doTurn();
        break;
      case 'stepback':
        G.closeDialogueToPlay(false);
        UI().toast('你退后了一步。按住 Q 观察他。');
        break;
      default:
        break;
    }
  };

  G.onDialogueAdvance = function () {};

  G.doCode = function () {
    const s = G.state;
    const sv = s.service;
    const def = s.active.def;
    sv.codeAsked = true;
    const fake = s.active.isFake;
    const knowers = ['n2_silent', 'n3_sister', 'n3_double', 'n5_zhao', 'n5_ma', 'n5_zhou'];
    let text, correct;
    if (!fake) { correct = true; text = def.dialogue.codeOk || '口令是「' + s.codeWord + '」。'; }
    else if (knowers.indexOf(def.id) >= 0) { correct = true; text = def.dialogue.codeOk || '……' + s.codeWord + '。'; }
    else { correct = false; text = def.dialogue.codeBad || '……我不知道你在说什么。'; }
    sv.codeCorrect = correct;
    G.log(def.name + ' · 口令' + (correct ? '正确' : '错误'));
    if (correct) {
      G.addServiceClue('code');
    } else {
      s.tension += 0.18;
      G.addServiceClue('code');
    }
    G.sayCustomer(text);
    G.showOptions();
  };

  G.doId = function () {
    const s = G.state;
    const sv = s.service;
    const def = s.active.def;
    sv.idChecked = true;
    if (!def.id) {
      G.addServiceClue('id');
      s.tension += 0.2;
      G.sayCustomer(def.dialogue.idBad || '我……没有带证件。');
      G.showOptions();
      return;
    }
    s.mode = 'id';
    MS.Player.releaseLock();
    const note = (def.clues && def.clues.id && def.clues.id[0]) || '证件看起来很正常。';
    UI().showID(s.active, note);
    G.log(def.name + ' · 查验证件');
    if (MS.Audio) MS.Audio.play('page');
  };

  G.closeID = function () {
    const s = G.state;
    if (s.mode !== 'id') return;
    UI().hideID();
    s.mode = 'dialogue';
    MS.Player.setMode('dialogue');
    MS.Player.enabled = false;
    G.addServiceClue('id');
    if (s.active) {
      G.sayCustomer('他把证件收了回去。');
      G.showOptions();
    }
    if (MS.Audio) MS.Audio.play('click');
  };

  G.placeItems = function (items) {
    G.clearItems();
    const x0 = MS.World.CUSTOMER_ANCHOR.x + 0.35;
    items.forEach((it, i) => {
      const g = new THREE.Group();
      const labels = MS.T.productLabels();
      const label = labels[(i + 2) % labels.length];
      const mat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.55, metalness: 0.05 });
      const h = it.name.indexOf('面') >= 0 ? 0.13 : 0.15;
      const w = it.name.indexOf('烟') >= 0 ? 0.07 : 0.09;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.6), mat);
      m.position.set(x0 + (i % 3) * 0.14, 1.07 + h / 2, 4.0 + Math.floor(i / 3) * 0.12);
      g.add(m);
      G.itemRoot.add(g);
    });
  };

  G.doPay = function () {
    const s = G.state;
    const sv = s.service;
    const def = s.active.def;
    sv.paid = true;
    G.log(def.name + ' · 收钱 ' + sv.total.toFixed(2) + ' 元');
    if (MS.Audio) MS.Audio.play('cash');
    if (s.active.isFake) {
      // show the line over the scene so the player can draw and fire
      G.state.mode = 'play';
      UI().hideDialogue();
      MS.Player.enabled = true;
      MS.Player.setMode('play');
      MS.Player.dialogueFocus = null;
      MS.Player.requestLock();
      UI().showSubtitle(def.name, def.dialogue.pay || '……', 2200);
      if (MS.Audio) MS.Audio.speak(def.dialogue.pay || '……', 'fake');
      s.tension += 0.3;
      setTimeout(() => {
        if (s.active && s.active.isFake && !s.active.dead) G.triggerLunge();
      }, 1000);
    } else {
      G.sayCustomer(def.dialogue.pay || '谢谢。');
      s.currentOptions = [];
      UI().setDialogueOptions([]);
      s.stats.served++;
      setTimeout(() => {
        if (!G.state.active) return;
        G.closeDialogueToPlay(false);
        G.leaveActiveHuman(def.dialogue.leave || '晚安。');
      }, 1400);
    }
  };

  G.doTurn = function () {
    const s = G.state;
    const def = s.active.def;
    if (s.active.isFake) {
      G.state.mode = 'play';
      UI().hideDialogue();
      MS.Player.enabled = true;
      MS.Player.setMode('play');
      MS.Player.dialogueFocus = null;
      MS.Player.requestLock();
      UI().showSubtitle(def.name, def.dialogue.leave || '你确定？外面……很冷。', 2600);
      if (MS.Audio) MS.Audio.speak(def.dialogue.leave || '你确定？外面很冷。', 'fake');
      s.tension += 0.25;
      setTimeout(() => {
        if (s.active && s.active.isFake && !s.active.dead) G.triggerLunge();
      }, 1600);
    } else {
      G.sayCustomer(def.dialogue.leave || '……那我走了。');
      s.currentOptions = [];
      UI().setDialogueOptions([]);
      G.log(def.name + ' · 没有消费就离开了');
      setTimeout(() => {
        G.closeDialogueToPlay(false);
        G.leaveActiveHuman(def.dialogue.leave || '……');
      }, 700);
    }
  };

  G.closeDialogueToPlay = function (keepCustomer) {
    const s = G.state;
    if (s.mode !== 'dialogue' && s.mode !== 'finale') return;
    s.mode = 'play';
    UI().hideDialogue();
    MS.Player.dialogueFocus = null;
    if (s.active && s.active.state === 'talking') s.active.state = 'waiting';
    if (keepCustomer !== true) {
      // no auto lock here for payment waits; caller decides
    }
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    MS.Player.keys['KeyE'] = true;
    G._ePrev = true;
    MS.Player.requestLock();
  };

  G.leaveActiveHuman = function (line) {
    const s = G.state;
    if (!s.active) return;
    s.active.state = 'leaving';
    s.active.leave();
    G.log(s.active.def.name + ' · 离开');
    if (line) UI().showSubtitle(s.active.def.name, line, 6000);
    if (MS.Audio) MS.Audio.play('doorChime');
    const leaving = s.active;
    setTimeout(() => {
      if (leaving.state === 'leaving' || leaving.state === 'gone') {
        if (leaving.group) leaving.group.parent && leaving.group.parent.remove(leaving.group);
        if (leaving.ghost && leaving.ghost.parent) leaving.ghost.parent.remove(leaving.ghost);
        if (G.state.active === leaving) {
          G.state.active = null;
          G.state.service = null;
          G.clearItems();
          UI().setObjective('等待下一位客人。');
          G.processPending();
          G.checkEnd();
        }
      }
    }, 3200);
    UI().setObjective('客人离开了。');
    G.checkEnd();
  };

  G.clearActiveAfterDeath = function () {
    if (G.state.active && G.state.active.isFake) {
      // leave the oil stain
      if (G.state.active.stain) G.state.active.keepStain = true;
    }
    G.state.active = null;
    G.state.service = null;
    UI().hideDialogue();
    UI().hideObserve();
    UI().setObjective('柜台前空了。');
    G.clearItems();
    G.processPending();
    G.checkEnd();
  };

  /* ------------------------------------------------------------
   * Observation
   * ------------------------------------------------------------ */
  G.onObserveStart = function (customer) {
    if (!customer || G.state.mode !== 'play') return;
    G.state.observe.on = true;
    G.state.observe.time = 0;
    G.state.observe.seen = [];
    customer.observedFor = 0;
    UI().showObserve(customer.def.name);
    // show what the player has already learned while talking
    const known = (G.state.service && G.state.service.clues) || [];
    known.forEach(t => UI().addObservation(t, false));
    if (MS.Audio) MS.Audio.play('obs');
    UI().setMood('注视', '#d8b06a');
  };

  G.onObserveTick = function (dt) {
    const s = G.state;
    if (!s.observe.on || !s.active) return;
    s.observe.time += dt;
    s.active.observe(dt);
    const cl = (s.active.def.clues && s.active.def.clues.observe) || [];
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i];
      if (s.observe.time >= c.delay && s.observe.seen.indexOf(i) < 0) {
        s.observe.seen.push(i);
        UI().addObservation(c.text, !!c.danger);
        G.log(s.active.def.name + ' · ' + c.text);
        if (c.danger) {
          s.tension += 0.14;
          if (s.active.isFake) {
            if (MS.Audio) MS.Audio.play('obsDanger');
            MS.Player.addShake(0.004, 0.4);
          }
        }
      }
    }
    // staring too long
    if (s.observe.time > 13.5) {
      if (s.active.isFake) {
        G.triggerLunge();
      } else {
        G.onObserveEnd();
        if (MS.Audio) MS.Audio.play('uiClick');
        UI().toast('他移开了视线。');
        G.sayNoDialogue('“你……还有事吗？”');
      }
    }
  };

  G.onObserveEnd = function () {
    const s = G.state;
    s.observe.on = false;
    UI().hideObserve();
    UI().setMood('安静', '#a5dcb6');
    if (s.active && s.active.isFake && s.observe.time > 7.5) {
      s.tension += 0.05;
    }
  };

  G.sayNoDialogue = function (text) {
    if (!G.state.active) return;
    UI().showSubtitle(G.state.active.def.name, text, 5000);
  };

  G.addServiceClue = function (kind) {
    const s = G.state;
    if (!s.active || !s.service) return;
    const def = s.active.def;
    const clues = (def.clues && def.clues[kind]) || [];
    if (!clues.length) return;
    const text = clues[0];
    if (s.service.clues.indexOf(text) >= 0) return;
    s.service.clues.push(text);
    G.log(def.name + ' · ' + text);
  };

  G.showServiceClues = function () {
    const s = G.state;
    if (!s.active || !s.service) return;
    const def = s.active.def;
    const list = [];
    if (s.service.codeAsked) {
      const c = (def.clues && def.clues.code) || [];
      if (c[0]) list.push(c[0]);
    }
    if (s.service.idChecked) {
      const c = (def.clues && def.clues.id) || [];
      if (c[0]) list.push(c[0]);
    }
    // not currently used; kept for journal
  };

  /* ------------------------------------------------------------
   * Lunge / shooting / death
   * ------------------------------------------------------------ */
  G.triggerLunge = function () {
    const s = G.state;
    if (!s.active || s.active.state === 'dead' || s.lunge) return;
    const c = s.active;
    s.mode = 'play';
    UI().hideDialogue();
    MS.Player.dialogueFocus = null;
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    MS.Player.requestLock();
    UI().setObjective('它动了。你有两秒钟。');
    const target = new THREE.Vector3(MS.Player.position.x, 1.4, MS.Player.position.z + 0.55);
    c.startLunge(target);
    s.lunge = { t: 0, dur: 2.35, customer: c };
    s.tension = 0.9;
    MS.Player.addShake(0.018, 1.2);
    if (MS.Audio) { MS.Audio.play('lunge'); MS.Audio.setTension(1); }
    UI().showSubtitle(null, '它朝你扑了过来。', 1200);
    if (MS.Audio) MS.Audio.speak('它动了。', 'inner');
  };

  G.handleShot = function () {
    const s = G.state;
    if (!s.started || s.mode === 'dead' || s.mode === 'ending' || s.mode === 'nightend') return;
    s.stats.shots++;
    const ray = MS.Player.getAimRay();
    let hitCustomer = null;
    if (s.active && s.active.hitbox && s.active.group.visible) {
      const hits = ray.intersectObject(s.active.hitbox, false);
      if (hits.length && hits[0].distance < 12) hitCustomer = s.active;
    }
    if (hitCustomer) {
      if (hitCustomer.isFake) {
        G.killFake(hitCustomer);
      } else {
        G.shootHuman(hitCustomer);
      }
      return;
    }
    // environment impact
    G.spawnImpact(ray);
    if (s.lunge) {
      // missed during lunge: no extra timer change, but shake
      s.tension = 1;
    } else if (s.active) {
      if (s.active.isFake) {
        s.stats.missed++;
        s.tension += 0.3;
        UI().toast('你打偏了。');
        setTimeout(() => { if (s.active && s.active.isFake && !s.active.dead && G.state.mode !== 'dead') G.triggerLunge(); }, 900);
      } else {
        UI().toast('客人尖叫着蹲下了。');
        s.tension += 0.2;
        G.log('你开了一枪，没有打中任何人');
        setTimeout(() => {
          if (s.active && !s.active.isFake) {
            G.closeDialogueToPlay(false);
            G.leaveActiveHuman('……你有病吧！');
          }
        }, 900);
      }
    } else {
      UI().toast('枪声在空店里回荡。');
      if (MS.Audio) MS.Audio.play('stinger');
    }
  };

  G.spawnImpact = function (ray) {
    const W = MS.World;
    if (!W) return;
    try {
      const hits = ray.intersectObjects(W.root.children, true);
      const filtered = hits.filter(h => h.object && h.object.visible && h.object.material && h.object.material.visible !== false);
      if (filtered.length) {
        const h = filtered[0];
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: MS.T.glow(), color: 0xffd9a0, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        }));
        s.scale.setScalar(0.12);
        s.position.copy(h.point);
        W.root.add(s);
        let t0 = performance.now();
        const anim = () => {
          const k = (performance.now() - t0) / 240;
          s.material.opacity = Math.max(0, 0.9 * (1 - k));
          s.scale.setScalar(0.12 + k * 0.18);
          if (k < 1) requestAnimationFrame(anim); else W.root.remove(s);
        };
        anim();
      }
    } catch (e) {}
  };

  G.killFake = function (c) {
    const s = G.state;
    s.stats.fakes++;
    s.tension = Math.max(0.2, s.tension - 0.4);
    s.lunge = null;
    s.mode = 'play';
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    G.log('开枪 · ' + c.def.name + ' · 不是人');
    c.kill(false);
    if (MS.Audio) { MS.Audio.play('stinger'); MS.Audio.setTension(0.35); }
    MS.Player.addShake(0.012, 0.6);
    UI().hideDialogue();
    UI().hideObserve();
    UI().setAmmo(MS.Player.ammo, 6);
    UI().setObjective('它倒下了。柜台前面只剩一摊黑色的水。');
    UI().showSubtitle('苏姐', G.killLine(), 7000);
    if (MS.Audio) MS.Audio.speak(G.killLine(), 'radio');
    setTimeout(() => {
      if (s.active === c) {
        if (c.group && c.group.parent) c.group.parent.remove(c.group);
        if (c.ghost && c.ghost.parent) c.ghost.parent.remove(c.ghost);
        G.state.active = null;
        G.state.service = null;
        G.clearItems();
        G.processPending();
        G.checkEnd();
      }
    }, 2600);
  };

  G.killLine = function () {
    const id = G.state.nightId;
    if (id === 1) return '第一班，合格。\n把地上那摊东西冲掉。别用手碰。';
    if (id === 2) return '……你听见它刚才说什么了吗？\n它说的是你的名字。';
    if (id === 3) return '干得好。\n小岳，你越来越熟练了。';
    if (id === 4) return '灯亮了。\n它走了以后，别回头看货架。';
    return '很好。\n现在，柜台前面只剩你了。';
  };

  G.shootHuman = function (c) {
    const s = G.state;
    s.stats.humansShot++;
    s.tension = 1;
    c.kill(true);
    MS.Player.addShake(0.03, 1);
    UI().showSubtitle(null, '你打错了。', 1400);
    if (MS.Audio) { MS.Audio.play('death'); MS.Audio.setTension(1); }
    setTimeout(() => {
      G.die('human', '你打错了人。\n\n店员，你不再是店员了。');
    }, 1400);
  };

  G.die = function (reason, sub) {
    const s = G.state;
    if (s.mode === 'dead') return;
    s.mode = 'dead';
    s.lunge = null;
    MS.Player.enabled = false;
    MS.Player.setMode('dead');
    MS.Player.releaseLock();
    UI().showPause(false);
    UI().showHUD(false);
    UI().hideDialogue();
    UI().hideObserve();
    UI().setFear(1);
    UI().setHold(null);
    if (reason === 'fake') {
      UI().showDead('不要收钱。<br>不要转身。', sub || '你听见自己的声音，从柜台下面传来。');
    } else if (reason === 'human') {
      UI().showDead('你打错了人。', sub || '警笛声从雨里传来，越来越近。');
    } else {
      UI().showDead('天没有亮。', sub || '');
    }
    if (MS.Audio) { MS.Audio.play('death'); MS.Audio.stopSpeaking(); MS.Audio.setTension(1); }
  };

  G.failLunge = function () {
    const s = G.state;
    s.lunge = null;
    UI().flash(0.5, 120);
    G.die('fake', '它没有影子。也没有脸。\n\n它在你的位置上，重新系好了围裙。');
  };

  G.retryNight = function () {
    const n = G.state.nightId;
    UI().hideDead();
    UI().hideEnding();
    UI().hideNightEnd();
    UI().fade(true);
    setTimeout(() => {
      G.startNight(n, { skipBriefing: true, retry: true });
      UI().fade(false);
    }, 400);
  };

  /* ------------------------------------------------------------
   * End of night / endings
   * ------------------------------------------------------------ */
  G.checkEnd = function () {
    const s = G.state;
    if (!s.started || s.ended) return;
    if (s.mode === 'dead' || s.mode === 'ending' || s.mode === 'nightend') return;
    if (s.active || s.pendingSpawns.length) return;
    if (s.clock < 359.9) return;
    G.endNight();
  };

  G.endNight = function () {
    const s = G.state;
    if (s.ended) return;
    s.ended = true;
    s.mode = 'nightend';
    MS.Player.enabled = false;
    MS.Player.setMode('nightend');
    MS.Player.releaseLock();
    UI().showHUD(false);
    UI().hideDialogue();
    UI().hideObserve();
    UI().setFear(0);
    s.clock = 360;
    MS.World.clockMinutes = 360;
    MS.Storage.unlockNight(Math.min(5, s.nightId + 1));
    const d = MS.Storage.load();
    if (d.completed.indexOf(s.nightId) < 0) d.completed.push(s.nightId);
    MS.Storage.save();
    if (MS.Audio) MS.Audio.setTension(0);
    const stats = [
      { label: '接待客人', value: String(s.stats.served) },
      { label: '识破伪人', value: String(s.stats.fakes) },
      { label: '开枪', value: String(s.stats.shots) },
      { label: '剩余子弹', value: String(MS.Player.ammo) }
    ];
    UI().showNightEnd({
      kicker: (s.night.end && s.night.end.kicker) || '04:00',
      title: (s.night.end && s.night.end.title) || '天亮了',
      story: (s.night.end && s.night.end.story) || '',
      stats: stats,
      button: s.nightId >= 5 ? '回到标题' : '继续下一夜'
    });
    if (MS.Audio) MS.Audio.speak('天亮了。', 'inner');
  };

  G.nextNight = function () {
    const s = G.state;
    UI().hideNightEnd();
    if (s.nightId >= 5) { G.toTitle(); return; }
    const next = s.nightId + 1;
    UI().fade(true);
    setTimeout(() => {
      G.startNight(next, { skipBriefing: false });
      UI().fade(false);
    }, 450);
  };

  G.startFinale = function () {
    const s = G.state;
    if (s.finaleStarted) return;
    if (s.active) { s.finalePending = true; return; }
    s.finaleStarted = true;
    s.mode = 'finale';
    UI().showPause(false);
    UI().hideDialogue();
    UI().hideObserve();
    MS.Player.enabled = false;
    MS.Player.setMode('finale');
    MS.Player.releaseLock();
    MS.Player.dialogueFocus = new THREE.Vector3(2.35, 1.6, 7.15);
    // spawn her outside
    const apparition = G.spawnCustomer('n5_su', { outside: true });
    s.apparition = apparition;
    s.active = null;
    s.service = null;
    const def = MS.Story.CUSTOMERS.n5_su;
    if (!def.portraitData) def.portraitData = MS.T.idPortrait('humanB', def.portrait || {});
    const text = '让我进去。我们换班。\n\n你已经在这里坐了十二年了。你不记得了吗？';
    const opts = [
      { id: 'replace', label: '打开后门，和她换班', danger: true },
      { id: 'burn', label: '去仓库，把酒精泼在纸箱上', tag: '点火' },
      { id: 'shoot', label: MS.Player.ammo > 0 ? '举枪，隔着玻璃打她' : '举枪——弹匣是空的', disabled: MS.Player.ammo <= 0, tag: '开枪' }
    ];
    s.finaleOptions = opts;
    s.currentOptions = opts;
    UI().showDialogue({ def: { name: '苏姐', portrait: def.portraitData } }, '苏姐', '玻璃外面 · 03:05', text, opts);
    if (MS.Audio) { MS.Audio.play('radioStatic', 1); MS.Audio.speak(text, 'radio'); }
    UI().setObjective('04:00 之前，做一个决定。');
  };

  G.finaleChoice = function (i) {
    const s = G.state;
    if (s.mode !== 'finale') return;
    const opt = (s.finaleOptions || [])[i];
    if (!opt) return;
    if (opt.id === 'shoot' && MS.Player.ammo <= 0) {
      UI().toast('枪里没有子弹。');
      return;
    }
    if (opt.id === 'replace') {
      G.showEnding('replace');
    } else if (opt.id === 'burn') {
      UI().flash(1, 200);
      if (MS.Audio) MS.Audio.play('lunge');
      setTimeout(() => G.showEnding('burn'), 800);
    } else if (opt.id === 'shoot') {
      MS.Player.ammo--;
      UI().flash(0.8, 150);
      if (MS.Audio) MS.Audio.play('gunshot');
      UI().hideDialogue();
      setTimeout(() => G.showEnding('shoot'), 900);
    }
  };

  G.showEnding = function (id) {
    const s = G.state;
    const e = MS.Story.ENDINGS[id];
    if (!e) { G.toTitle(); return; }
    s.mode = 'ending';
    s.ended = true;
    MS.Player.enabled = false;
    MS.Player.setMode('ending');
    MS.Player.releaseLock();
    UI().showPause(false);
    UI().showHUD(false);
    UI().hideDialogue();
    UI().hideNightEnd();
    MS.Storage.unlockNight(5);
    MS.Storage.addEnding(id);
    const d = MS.Storage.load();
    if (d.completed.indexOf(5) < 0) d.completed.push(5);
    MS.Storage.save();
    UI().showEnding({
      kicker: e.kicker, title: e.title, text: e.text,
      stats: '本夜开枪 ' + s.stats.shots + ' 次 · 识破 ' + s.stats.fakes + ' 个 · 结局 ' + (d.endings.length) + '/3'
    });
    if (MS.Audio) { MS.Audio.play('stinger'); MS.Audio.setTension(0.2); }
  };

  /* ------------------------------------------------------------
   * Interactions
   * ------------------------------------------------------------ */
  G.focusPoints = function () {
    const W = MS.World;
    return [
      { key: 'monitor', p: W.points.monitor, label: '查看监控', type: 'toggle', action: 'monitor' },
      { key: 'radio', p: W.points.radio, label: '听收音机', type: 'toggle', action: 'radio' },
      { key: 'mop', p: W.points.mop, label: '拖地', type: 'hold', dur: 2.2, action: 'mop' },
      { key: 'restock', p: W.points.restock, label: '补货', type: 'hold', dur: 2.4, action: 'restock' },
      { key: 'backdoor', p: W.points.backdoor, label: MS.World.opened ? '关上后仓门' : '打开后仓门', type: 'toggle', action: 'backdoor' },
      { key: 'fusebox', p: W.points.fusebox, label: '合上电闸', type: 'hold', dur: 3.0, action: 'fuse', requiresOpen: true },
      { key: 'noteBack', p: W.points.noteBack, label: '阅读墙上的便签', type: 'toggle', action: 'noteBack', requiresOpen: true }
    ];
  };

  G.findFocus = function () {
    const s = G.state;
    if (s.mode !== 'play' || !s.started) return null;
    if (MS.Player.observing) return null;
    // customer first
    if (s.active && (s.active.state === 'waiting' || s.active.state === 'talking')) {
      const c = s.active;
      const head = new THREE.Vector3(c.group.position.x, c.headGroupY || 1.55, c.group.position.z);
      const dist = MS.Player.position.distanceTo(new THREE.Vector3(c.group.position.x, 0, c.group.position.z));
      if (dist < 2.9 && MS.Player.isLookingAt(head, 0.42)) {
        return { kind: 'customer', customer: c, label: '接待 ' + c.def.name, type: 'customer' };
      }
    }
    // points
    const camPos = MS.Player.camera.position;
    const forward = new THREE.Vector3();
    MS.Player.camera.getWorldDirection(forward);
    let best = null, bestScore = 0;
    for (const pt of G.focusPoints()) {
      if (!pt.p) continue;
      if (pt.requiresOpen && !MS.World.opened) continue;
      const d = MS.Player.position.distanceTo(new THREE.Vector3(pt.p.pos.x, 0, pt.p.pos.z));
      if (d > (pt.p.dist || 1.7) + 0.5) continue;
      const to = new THREE.Vector3(pt.p.pos.x, 1.1, pt.p.pos.z).sub(camPos).normalize();
      const dot = forward.dot(to);
      if (dot < 0.72) continue;
      const score = dot - d * 0.03;
      if (score > bestScore) {
        bestScore = score;
        best = { kind: 'point', point: pt, label: pt.label, type: pt.type, dur: pt.dur };
      }
    }
    return best;
  };

  G.updateFocus = function () {
    const s = G.state;
    if (s.mode !== 'play') {
      MS.Player.focusTarget = null;
      UI().setPrompt('', 'E', false);
      UI().setHold(null);
      s.hold = { kind: null, t: 0, dur: 0, target: null };
      return;
    }
    const focus = G.findFocus();
    s.focus = focus;
    MS.Player.focusTarget = focus;
    if (focus) {
      if (focus.kind === 'customer') UI().setPrompt(focus.label, 'E', true);
      else UI().setPrompt(focus.label, 'E', true);
    } else {
      UI().setPrompt('', 'E', false);
    }
    // interaction hold
    const keys = MS.Player.keys;
    const eDown = !!keys['KeyE'];
    if (focus && focus.type === 'hold' && eDown) {
      if (!s.hold.target || s.hold.target !== focus.point.key) {
        s.hold = { kind: focus.point.action, t: 0, dur: focus.dur, target: focus.point.key };
      }
      s.hold.t += G._dt || 0.016;
      UI().setHold(s.hold.t / s.hold.dur);
      if (s.hold.t >= s.hold.dur) {
        const action = s.hold.kind;
        s.hold = { kind: null, t: 0, dur: 0, target: null };
        UI().setHold(null);
        G.doPointAction(action);
      }
    } else if (s.hold.kind) {
      s.hold = { kind: null, t: 0, dur: 0, target: null };
      UI().setHold(null);
    }
    // E edge
    const ePressed = eDown && !G._ePrev;
    G._ePrev = eDown;
    if (ePressed && focus) {
      if (focus.kind === 'customer') {
        G.openCustomerDialogue();
      } else if (focus.type === 'toggle') {
        G.doPointAction(focus.point.action);
      } else if (focus.type === 'hold') {
        s.hold = { kind: focus.point.action, t: 0, dur: focus.dur, target: focus.point.key };
      }
    }
  };

  G.doPointAction = function (action) {
    const s = G.state;
    switch (action) {
      case 'monitor':
        G.openMonitor();
        break;
      case 'radio':
        if (s.lastRadio) {
          UI().showRadio(s.lastRadio, 9000);
          if (MS.Audio) MS.Audio.speak(s.lastRadio, 'radio');
        } else {
          UI().toast('只有电流声。');
          if (MS.Audio) MS.Audio.play('radioStatic', 0.8);
        }
        break;
      case 'backdoor':
        G.toggleBackRoom();
        break;
      case 'mop':
        G.log('拖了地');
        UI().toast('你把地上的水拖干了。');
        if (MS.Audio) MS.Audio.play('page');
        UI().setObjective('地板干净了。等下一班客人。');
        break;
      case 'restock':
        G.log('补了货');
        UI().toast('你把空着的货架补满了。');
        if (MS.Audio) MS.Audio.play('cash');
        break;
      case 'fuse':
        if (MS.World.powerOn) { UI().toast('电闸已经合上了。'); break; }
        MS.World.setPower(true);
        MS.World.opened = true;
        G.refreshNightDoor();
        if (MS.Audio) MS.Audio.play('powerOn');
        UI().flash(0.5, 300);
        UI().toast('灯亮了。');
        UI().setObjective('灯亮了。回柜台去。');
        G.log('合上了电闸');
        s.tension = Math.max(0, s.tension - 0.3);
        break;
      case 'noteBack':
        G.readNote(['note2', 'note2', 'note3', 'note4', 'note5'][M.clamp(G.state.nightId - 1, 0, 4)], true);
        break;
      default:
        break;
    }
  };

  G.openMonitor = function () {
    const s = G.state;
    if (s.mode !== 'play') return;
    s.mode = 'monitor';
    MS.Player.enabled = false;
    MS.Player.setMode('monitor');
    MS.Player.releaseLock();
    s._camSave = { pos: G.camera.position.clone(), rot: G.camera.rotation.clone(), fov: G.camera.fov };
    const cc = MS.World.cctvCam;
    G.camera.position.copy(cc.position);
    G.camera.rotation.setFromQuaternion(cc.quaternion);
    G.camera.fov = 62;
    G.camera.updateProjectionMatrix();
    G.camera.layers.enable(1);
    UI().showHUD(false);
    UI().showMonitor(true);
    if (MS.Audio) MS.Audio.play('radioStatic', 0.4);
  };

  G.closeMonitor = function () {
    const s = G.state;
    if (s.mode !== 'monitor') return;
    s.mode = 'play';
    UI().showMonitor(false);
    const save = s._camSave;
    if (save) {
      G.camera.position.copy(save.pos);
      G.camera.rotation.copy(save.rot);
      G.camera.fov = save.fov;
      G.camera.updateProjectionMatrix();
    }
    G.camera.layers.disable(1);
    UI().showHUD(true);
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    G._ePrev = true;
    MS.Player.keys['KeyE'] = true;
    MS.Player.requestLock();
    if (MS.World.watcher && MS.World.watcher.visible) {
      // brief scare when leaving the monitor
      G.camera.layers.enable(1);
      MS.Player.addShake(0.01, 0.8);
      if (MS.Audio) MS.Audio.play('stinger');
      setTimeout(() => {
        G.camera.layers.disable(1);
      }, 700);
      UI().toast('你回头看了一眼。');
    }
  };

  G.readNote = function (id, showPaper) {
    const note = (MS.Story.NOTES || []).find(n => n.id === id);
    if (!note) return;
    const isNew = MS.Storage.addNote(id);
    G.log('拾得便签：' + (note.meta || ''));
    if (isNew) UI().toast('你把纸条收进了值班手册（Tab）。');
    if (showPaper) {
      G.state.mode = 'paper';
      MS.Player.enabled = false;
      MS.Player.setMode('paper');
      MS.Player.releaseLock();
      UI().showPaper(note.text, '—— 老陈');
      if (MS.Audio) MS.Audio.speak(note.text.split('\n').slice(0, 3).join(' '), 'inner');
    } else {
      UI().toast('你发现了一张便签（Tab 查看）。');
    }
  };

  G.closePaper = function () {
    if (G.state.mode !== 'paper') return;
    UI().hidePaper();
    G.state.mode = 'play';
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    G.state.hold = { kind: null, t: 0, dur: 0, target: null };
    G._ePrev = true;
    MS.Player.keys['KeyE'] = true;
    MS.Player.requestLock();
  };

  G.openJournal = function () {
    const s = G.state;
    if (s.mode !== 'play') return;
    s.mode = 'journal';
    MS.Player.enabled = false;
    MS.Player.setMode('journal');
    MS.Player.releaseLock();
    UI().showJournal('rules');
    G.state._journalBack = 'play';
  };
  G.closeJournal = function () {
    if (G.state.mode !== 'journal') return;
    UI().hideJournal();
    G.state.mode = 'play';
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    G._ePrev = true;
    MS.Player.keys['KeyE'] = true;
    MS.Player.requestLock();
  };

  G.pause = function () {
    if (G.state.mode !== 'play') return;
    G.state.mode = 'pause';
    MS.Player.enabled = false;
    MS.Player.setMode('pause');
    MS.Player.releaseLock();
    UI().showPause(true);
    UI().hideObserve();
    UI().setHold(null);
    if (MS.Audio) MS.Audio.stopSpeaking();
  };

  G.resume = function () {
    if (G.state.mode !== 'pause') return;
    UI().showPause(false);
    UI().closeSettings();
    G.state.mode = 'play';
    MS.Player.enabled = true;
    MS.Player.setMode('play');
    MS.Player.requestLock();
  };

  G.onPointerUnlock = function () {
    const s = G.state;
    if (s.lunge) return;
    if (s.mode === 'play') G.pause();
  };
  G.onPointerError = function () {
    if (G.state.mode === 'play') UI().toast('点击画面以锁定鼠标。');
  };
  G.onFlashlight = function (on) {
    if (MS.Audio) MS.Audio.play(on ? 'flashlightOn' : 'flashlightOff');
  };
  G.onResize = function () {
    if (!G.renderer) return;
    G.renderer.setSize(window.innerWidth, window.innerHeight);
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
  };

  /* ------------------------------------------------------------
   * Log / interactions / HUD / update
   * ------------------------------------------------------------ */
  G.log = function (text, kind) {
    const s = G.state;
    s.log.push({ time: MS.clockString(s.clock), text: text, kind: kind || '' });
    if (s.log.length > 80) s.log.shift();
  };

  G.processPending = function () {
    const s = G.state;
    if (s.active || s.mode === 'dead' || s.mode === 'ending' || s.mode === 'nightend') return;
    if (!s.pendingSpawns.length) return;
    s.pendingSpawns.sort((a, b) => a._time - b._time);
    const ev = s.pendingSpawns.shift();
    G.spawnCustomer(ev.c, { silent: ev.silent });
    if (ev._time != null) G.state.clock = Math.max(G.state.clock, ev._time);
  };

  G.processTimeline = function () {
    const s = G.state;
    if (s.mode !== 'play' || !s.started) return;
    while (s.eventIndex < s.timeline.length && s.timeline[s.eventIndex]._time <= s.clock) {
      const ev = s.timeline[s.eventIndex++];
      if (ev.type === 'spawn') {
        if (s.active) s.pendingSpawns.push(ev);
        else G.spawnCustomer(ev.c, { silent: ev.silent });
      } else {
        G.handleEvent(ev);
      }
      if (s.mode !== 'play') break;
    }
  };

  G.handleEvent = function (ev) {
    const s = G.state;
    switch (ev.type) {
      case 'radio':
        s.lastRadio = ev.text;
        UI().showRadio(ev.text, 11000);
        if (MS.Audio) MS.Audio.speak(ev.text, 'radio');
        G.log('电台：' + ev.text.replace(/\n/g, ' '));
        if (ev.text.indexOf('口令') >= 0) {
          // record the code word in the journal via log
          G.log('今晚的口令：' + s.codeWord);
        }
        break;
      case 'objective':
        s.objective = ev.text;
        UI().setObjective(ev.text);
        break;
      case 'note':
        G.readNote(ev.note, true);
        break;
      case 'whisper':
        UI().showSubtitle(null, ev.text, 4200);
        if (MS.Audio) { MS.Audio.whisper(0.8); MS.Audio.speak(ev.text, 'inner'); }
        s.tension += 0.12;
        break;
      case 'event':
        G.doEvent(ev.name);
        break;
      case 'finale':
        G.startFinale();
        break;
      case 'end':
        s.endReady = true;
        break;
      default:
        break;
    }
  };

  G.doEvent = function (name) {
    const s = G.state;
    const W = MS.World;
    switch (name) {
      case 'flicker':
        W.flicker(1.6);
        if (MS.Audio) MS.Audio.play('flicker');
        UI().flash(0.15, 80);
        s.tension += 0.1;
        break;
      case 'knock':
        if (MS.Audio) MS.Audio.play('knock');
        UI().showSubtitle('后门', '……咚。……咚。……咚。', 5000);
        UI().setObjective('后门有人在敲。不要开。');
        s.tension += 0.2;
        if (W.points.backdoor) W.points.backdoor.label = '后仓门（有人在敲）';
        break;
      case 'poster':
        UI().toast('门口多了一张新的寻人启事。照片上的人，是你。');
        s.tension += 0.15;
        break;
      case 'recording':
        W.flicker(0.8);
        UI().showRadio('（磁带）……我是林岳。我在长夜路 24 号。\n我没有离开过。', 9000);
        if (MS.Audio) { MS.Audio.play('radioStatic', 1.2); MS.Audio.speak('我是林岳。我在长夜路二十四号。我没有离开过。', 'fake'); }
        s.tension += 0.25;
        break;
      case 'blackout':
        W.setPower(false);
        if (MS.Audio) MS.Audio.play('blackout');
        UI().flash(0.5, 200);
        UI().setObjective('灯灭了。按 F 打开手电，去后仓检查配电箱。');
        s.tension += 0.35;
        if (s.active) s.tension += 0.1;
        break;
      case 'watcher':
        W.setWatcher(true, -2.0, -3.4);
        if (MS.Audio) MS.Audio.play('stinger');
        UI().toast('监控里有东西。去看看柜台上的监控。');
        UI().setObjective('监控画面里多了一个人。按 E 查看监控。');
        s.tension += 0.3;
        break;
      case 'backdoor':
        if (MS.Audio) MS.Audio.play('knock');
        UI().showRadio('林岳，把后门打开。\n我把交接的人带来了。你该休息了。', 10000);
        if (MS.Audio) MS.Audio.speak('林岳，把后门打开。我把交接的人带来了。你该休息了。', 'radio');
        UI().setObjective('不要开后门。');
        s.tension += 0.3;
        break;
      case 'streetlights':
        if (W.lights.street) W.lights.street.intensity = 0.5;
        setTimeout(() => { if (W.lights.street) W.lights.street.intensity = 0; }, 1400);
        if (MS.Audio) MS.Audio.play('flicker');
        s.tension += 0.2;
        break;
      case 'su':
        W.setWatcher(false);
        if (MS.Audio) MS.Audio.play('stinger');
        UI().toast('玻璃外面站着一个人。');
        break;
      default:
        break;
    }
  };

  G.updateClock = function (dt) {
    const s = G.state;
    if (!s.started || s.ended) return;
    if (s.mode === 'play') {
      // only observe/play advance time
      s.clock += dt * (360 / s.realDuration);
      if (s.clock > 360) s.clock = 360;
      MS.World.clockMinutes = s.clock;
    }
    if (s.clock >= 360) {
      // let the current customer resolve, then end
      if (!s.active && !s.pendingSpawns.length) G.checkEnd();
    }
  };

  G.updateWaiting = function (dt) {
    const s = G.state;
    if (!s.active) return;
    if (s.mode !== 'play' && s.mode !== 'dialogue' && s.mode !== 'finale') return;
    if (s.active.state !== 'waiting' && s.active.state !== 'talking') return;
    if (s.mode === 'play') {
      s.waitTime += dt;
      if (s.active.isFake) {
        if (s.waitTime > 95 && !s.lunge) G.triggerLunge();
      } else if (s.waitTime > 160) {
        // human leaves
        const c = s.active;
        if (s.mode === 'dialogue') G.closeDialogueToPlay(false);
        UI().showSubtitle(c.def.name, '……算了，我去别家吧。', 4500);
        G.leaveActiveHuman('……算了，我去别家吧。');
        s.waitTime = 0;
      }
    }
  };

  G.updateTension = function (dt) {
    const s = G.state;
    if (!s.started || s.ended) return;
    let target = 0.06;
    if (s.active) {
      target += s.active.isFake ? 0.25 : 0.05;
      target += M.clamp(s.waitTime / 120, 0, 0.15);
    }
    if (s.observe.on) target += 0.22;
    if (!MS.World.powerOn) target += 0.18;
    if (s.lunge) target = 1;
    target = M.clamp(target + s.tension * 0.45, 0, 1);
    s.tension = M.damp(s.tension, target * 0.55, 0.8, dt);
    s.fear = M.damp(s.fear, s.tension, 1.2, dt);
    if (MS.Audio) MS.Audio.setTension(s.tension);
    UI().setFear(s.fear * 0.65);
    if (s.mode === 'play') {
      const mood = s.lunge ? '快跑' : (s.active && s.active.isFake ? '不对劲' : (s.active ? '有客' : (s.observe.on ? '注视' : '安静')));
      UI().setMood(mood, s.active && s.active.isFake ? '#d8a05a' : '#a5dcb6');
    }
    if (s.lunge) {
      s.lunge.t += dt;
      const P = MS.Player;
      P.addShake(0.012, 0.2);
      UI().setPrompt('', 'E', false);
      if (s.lunge.t > s.lunge.dur) {
        G.failLunge();
      }
    }
  };

  G.updateHUD = function (dt) {
    const s = G.state;
    s.hudAcc += dt;
    if (s.hudAcc < 0.1) return;
    s.hudAcc = 0;
    if (!s.started) return;
    const timeStr = MS.clockString(s.clock);
    const remainMin = Math.max(0, 360 - s.clock);
    const mins = Math.floor(remainMin);
    const remain = MS.M.pad(Math.floor(mins / 60)) + ':' + MS.M.pad(mins % 60);
    UI().setHUD(s.nightTitle, timeStr, remain, s.objective);
    UI().setAmmo(MS.Player.ammo, 6);
    UI().updateDialogueClock(timeStr);
  };

  G.update = function (dt) {
    G._dt = dt;
    const s = G.state;
    const P = MS.Player;
    if (s.mode === 'title') {
      G.updateTitle(dt);
      if (MS.World) MS.World.update(dt, performance.now() / 1000);
      G.fpsMeter.tick(performance.now());
      return;
    }
    // update player movement/camera for all in-night modes except fully paused ones
    const skipPlayer = ['dead', 'ending', 'nightend', 'briefing', 'intro', 'pause', 'monitor'].indexOf(s.mode) >= 0;
    if (!skipPlayer) P.update(dt);
    G.updateDoor(dt);
    G.updateFocus();
    G.updateWaiting(dt);
    if (s.active) {
      s.active.update(dt, performance.now() / 1000);
      if (s.active.state === 'arriving') G.onCustomerArrived();
      if (s.active.state === 'gone') {
        const c = s.active;
        if (c.group && c.group.parent) c.group.parent.remove(c.group);
        s.active = null;
        s.service = null;
        G.clearItems();
        G.processPending();
        G.checkEnd();
      }
      if (s.active && (s.active.state === 'entering')) {
        s.stepTimer = (s.stepTimer || 0) + dt;
        if (s.stepTimer > 0.5) { s.stepTimer = 0; if (MS.Audio) MS.Audio.play('stepHuman'); }
      }
    }
    if (s.mode === 'play') {
      G.updateClock(dt);
      G.processTimeline();
      if (s.finalePending && !s.active) { s.finalePending = false; G.startFinale(); }
    }
    G.updateTension(dt);
    G.updateHUD(dt);
    if (s.mode === 'play' && s.clock >= 360) G.checkEnd();
    if (MS.World) MS.World.update(dt, performance.now() / 1000);
    G.fpsMeter.tick(performance.now());
    G.fps = G.fpsMeter.fps;
  };

  G.debugSkip = function (min) {
    const s = G.state;
    if (s.mode !== 'play') return;
    s.clock = Math.min(359, s.clock + (min || 30));
    UI().toast('（调试）时间 +' + (min || 30) + ' 分钟');
    MS.World.clockMinutes = s.clock;
    G.processTimeline();
  };

  G.applyQuality = function (v) {
    G.state.quality = v;
    if (G.renderer) {
      const dpr = window.devicePixelRatio || 1;
      let scale = 1;
      if (v === 'low') scale = 0.72;
      else if (v === 'high') scale = Math.min(dpr, 1.6);
      else scale = Math.min(dpr, 1.0);
      G.renderer.setPixelRatio(scale);
      G.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  G.clockString = function () { return MS.clockString(G.state.clock); };

  // expose a few helpers for the UI
  G.openSettingsFromTitle = function () {
    G.state._prevMode = 'title';
    G.state.mode = 'settings';
    UI().showSettings();
  };

  MS.Game = G;
})(window.MS);
