/* ============================================================
 * 长夜便利店 — 启动 / 渲染循环
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const UI = () => MS.UI;
  const G = () => MS.Game;

  let renderer, scene, camera, clock;
  let started = false;
  let lowFpsTime = 0;
  let quality = 'medium';
  let pixelScale = 1;

  function setQualityFromStore() {
    const s = MS.Storage.load().settings;
    let q = s.quality || 'medium';
    if (q === 'auto') q = 'medium';
    quality = q;
    if (quality === 'low') pixelScale = 0.72;
    else if (quality === 'high') pixelScale = Math.min(window.devicePixelRatio || 1, 1.6);
    else pixelScale = Math.min(window.devicePixelRatio || 1, 1.0);
  }

  function showCrash(msg) {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.innerHTML = '<div class="boot-box"><div class="boot-mark">ERR</div><div class="boot-title" style="font-size:24px">长夜没有开始</div>' +
        '<div class="boot-status" style="height:auto;line-height:2;margin-top:20px">' + msg + '<br><br>请使用最新版 Chrome / Edge 打开，并刷新页面。</div></div>';
    }
  }

  async function boot() {
    try {
      setQualityFromStore();
      MS.UI.bootProgress(0.04, '正在生成长夜…');
      await MS.wait(30);

      renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('gl'),
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false
      });
      renderer.setPixelRatio(pixelScale);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.shadowMap.enabled = false;
      renderer.autoClear = true;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 110);
      camera.rotation.order = 'YXZ';
      scene.add(camera);
      MS.UI.bootProgress(0.10, '正在播放雨声…');
      await MS.wait(20);

      MS.UI.bootProgress(0.16, '正在生成货架与玻璃…');
      await MS.nextFrame();
      await MS.T.init();
      MS.UI.bootProgress(0.48, '正在扫描人脸…');
      await MS.nextFrame();
      try { await MS.Customers.load(); } catch (e) { console.warn('head model failed', e); }
      MS.UI.bootProgress(0.62, '正在开灯…');
      await MS.nextFrame();

      MS.World.init(scene, renderer, quality);
      MS.World.setRenderRefs(renderer, scene);
      MS.World.buildEnvironment(renderer, scene);
      MS.World.clockMinutes = 0;
      MS.UI.bootProgress(0.86, '正在锁后门…');
      await MS.nextFrame();

      MS.Game.init({ renderer: renderer, scene: scene, camera: camera, canvas: document.getElementById('gl') });
      UI().bootProgress(0.94, '正在等天亮…');
      await MS.nextFrame();

      // prewarm post effects / title camera
      G().setTitleCamera();
      renderer.render(scene, camera);
      UI().bootProgress(1, '准备营业');
      await MS.wait(260);
      UI().hideBoot();
      if (MS.Game.state.mode === 'title') UI().showTitle();
      UI().fade(false);
      clock = new THREE.Clock();
      started = true;
      requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      showCrash('初始化失败：' + (e && e.message ? e.message : e));
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!started) return;
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    const g = G();
    try {
      g.update(dt);
    } catch (e) {
      console.error(e);
    }
    renderer.render(scene, camera);
    // adaptive resolution if the machine is struggling
    if (g.state.mode === 'play' && quality !== 'low') {
      if (g.fps < 42) lowFpsTime += dt; else lowFpsTime = 0;
      if (lowFpsTime > 3.5 && pixelScale > 0.78) {
        pixelScale = Math.max(0.75, pixelScale - 0.12);
        renderer.setPixelRatio(pixelScale);
        renderer.setSize(window.innerWidth, window.innerHeight);
        UI().toast('已自动降低一点画质，保持流畅。');
        lowFpsTime = 0;
      }
    }
    // fps display in settings
    if (UI().state && document.getElementById('settings') && !document.getElementById('settings').classList.contains('hidden')) {
      UI().updateFps();
    }
  }

  function onResize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (MS.Game) MS.Game.onResize();
  }

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && MS.Game && MS.Game.state.mode === 'play') {
      MS.Game.pause();
    }
  });
  window.addEventListener('error', (e) => {
    if (MS.UI && MS.UI.toast && MS.UI.state && MS.UI.state.booted !== false) {
      try { MS.UI.toast('出现了一点问题：' + (e.message || '未知错误'), 6000); } catch (err) {}
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('unhandled', e.reason);
  });

  // prevent accidental browser zoom / context menu on the game
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  MS.Main = { boot: boot, getRenderer: () => renderer };
})(window.MS);
