/* ============================================================
 * 长夜便利店 — 程序化音频
 * 全部由 WebAudio 实时合成；语音使用系统中文 TTS（可关闭）。
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const A = {};
  let ac = null, master = null, comp = null, reverb = null, sfxBus = null, ambBus = null, musicBus = null;
  let noiseBuf = null, brownBuf = null, impulse = null;
  let started = false, ambientOn = false, voiceOn = true;
  let tension = 0, tensionTarget = 0;
  let heartbeatTimer = null, whisperTimer = null, musicTimer = null;
  let rainGain = null, droneGain = null, humGain = null;
  let voices = [], voicesReady = false;
  let volume = 0.85;
  let fakeVoiceSeed = 0;
  let lastSpeak = 0;

  A.available = false;

  function ensure() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return true;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      ac = new Ctx();
    } catch (e) { return false; }
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.28;
    master = ac.createGain();
    master.gain.value = volume;
    master.connect(comp);
    comp.connect(ac.destination);

    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.4; musicBus.connect(master);

    // reverb impulse
    const len = Math.floor(ac.sampleRate * 2.4);
    impulse = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (1 - Math.exp(-t * 60));
      }
    }
    reverb = ac.createConvolver();
    reverb.buffer = impulse;
    const revGain = ac.createGain(); revGain.gain.value = 0.32;
    reverb.connect(revGain); revGain.connect(master);
    A.reverb = reverb;
    A.revSend = ac.createGain(); A.revSend.gain.value = 0.5; A.revSend.connect(reverb);

    // noise buffers
    const nlen = ac.sampleRate * 2;
    noiseBuf = ac.createBuffer(1, nlen, ac.sampleRate);
    brownBuf = ac.createBuffer(1, nlen, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0), bd = brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nlen; i++) {
      nd[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      bd[i] = last * 3.2;
    }
    A.available = true;
    loadVoices();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
    return true;
  }

  function loadVoices() {
    if (!window.speechSynthesis) return;
    try {
      voices = speechSynthesis.getVoices() || [];
      voicesReady = voices.length > 0;
    } catch (e) { voices = []; }
  }

  function now() { return ac ? ac.currentTime : 0; }

  function gainNode(v, bus) {
    const g = ac.createGain();
    g.gain.value = v;
    g.connect(bus || sfxBus);
    return g;
  }

  function noise(dur, opts) {
    opts = opts || {};
    const src = ac.createBufferSource();
    src.buffer = opts.brown ? brownBuf : noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.frequency.value = opts.freq || 1000;
    f.Q.value = opts.q == null ? 1 : opts.q;
    const g = ac.createGain();
    const t = now();
    const peak = opts.gain == null ? 0.12 : opts.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    if (opts.send) { const s = ac.createGain(); s.gain.value = opts.send; g.connect(s); s.connect(A.revSend); }
    src.start(t);
    src.stop(t + dur + 0.05);
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
    return { src, filter: f, gain: g };
  }

  function tone(freq, dur, opts) {
    opts = opts || {};
    const o = ac.createOscillator();
    o.type = opts.type || 'sine';
    const g = ac.createGain();
    const t = now();
    const peak = opts.gain == null ? 0.1 : opts.gain;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    if (opts.pan != null) {
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
      if (p) { p.pan.value = opts.pan; g.connect(p); p.connect(opts.bus || sfxBus); }
      else g.connect(opts.bus || sfxBus);
    } else {
      g.connect(opts.bus || sfxBus);
    }
    if (opts.send) { const s = ac.createGain(); s.gain.value = opts.send; g.connect(s); s.connect(A.revSend); }
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
    return { osc: o, gain: g };
  }

  function bell(freq, dur, gainVal) {
    const t = now();
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.01;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal || 0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ac.createGain();
    g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(sfxBus);
    const s = ac.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(A.revSend);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
    o.onended = () => { try { o.disconnect(); o2.disconnect(); g.disconnect(); g2.disconnect(); } catch (e) {} };
  }

  /* ------------------------------------------------------------
   * Ambient
   * ------------------------------------------------------------ */
  A.startAmbient = function () {
    if (!ensure() || ambientOn) return;
    ambientOn = true;
    const t = now();
    // rain outdoors
    const rainSrc = ac.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
    const rainF = ac.createBiquadFilter(); rainF.type = 'bandpass'; rainF.frequency.value = 2200; rainF.Q.value = 0.5;
    const rainF2 = ac.createBiquadFilter(); rainF2.type = 'highpass'; rainF2.frequency.value = 600;
    rainGain = ac.createGain(); rainGain.gain.value = 0.075;
    rainSrc.connect(rainF); rainF.connect(rainF2); rainF2.connect(rainGain); rainGain.connect(ambBus);
    rainSrc.start(t);
    // slow rain swell
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.045;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain); lfoGain.connect(rainGain.gain); lfo.start(t);
    // low drone
    droneGain = ac.createGain(); droneGain.gain.value = 0.05;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 0.9;
    droneGain.connect(lp); lp.connect(ambBus);
    for (const [f, d] of [[41, 0], [41.55, 7], [55, -4]]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      const g = ac.createGain(); g.gain.value = 0.09;
      o.connect(g); g.connect(droneGain); o.start(t);
    }
    // fluorescent hum
    humGain = ac.createGain(); humGain.gain.value = 0.012;
    const humLP = ac.createBiquadFilter(); humLP.type = 'lowpass'; humLP.frequency.value = 900;
    humGain.connect(humLP); humLP.connect(ambBus);
    for (const [f, gv] of [[100, 1], [200, 0.5], [300, 0.22], [400, 0.1]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ac.createGain(); g.gain.value = gv;
      o.connect(g); g.connect(humGain); o.start(t);
    }
    // brown noise room tone
    const brown = ac.createBufferSource(); brown.buffer = brownBuf; brown.loop = true;
    const bg = ac.createGain(); bg.gain.value = 0.02;
    const bf = ac.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 400;
    brown.connect(bf); bf.connect(bg); bg.connect(ambBus); brown.start(t);
    // music / bells
    scheduleMusic();
    scheduleWhisper();
  };

  A.stopAmbient = function () {
    if (!ac || !ambientOn) return;
    ambientOn = false;
    clearTimeout(musicTimer); clearTimeout(whisperTimer);
    if (rainGain) { rainGain.gain.linearRampToValueAtTime(0.0001, now() + 0.8); }
  };

  function scheduleMusic() {
    if (!ambientOn) return;
    const t = now();
    const notes = [110, 130.81, 146.83, 164.81, 196, 220, 246.94];
    const f = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1);
    // FM bell
    const car = ac.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = ac.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2.71;
    const modGain = ac.createGain(); modGain.gain.value = f * 0.6;
    mod.connect(modGain); modGain.connect(car.frequency);
    const env = ac.createGain();
    const dur = 5.5 + Math.random() * 3;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.028 + Math.random() * 0.02, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(env); env.connect(musicBus);
    const s = ac.createGain(); s.gain.value = 0.55; env.connect(s); s.connect(A.revSend);
    car.start(t); mod.start(t); car.stop(t + dur); mod.stop(t + dur);
    musicTimer = setTimeout(scheduleMusic, 9000 + Math.random() * 14000);
  }

  function scheduleWhisper() {
    if (!ambientOn) return;
    if (Math.random() < 0.35 + tension * 0.4) {
      A.whisper(0.4 + Math.random() * 0.6);
    }
    whisperTimer = setTimeout(scheduleWhisper, 8000 + Math.random() * 14000);
  }

  A.whisper = function (strength) {
    if (!ensure()) return;
    const dur = 1.1 + Math.random() * 1.5;
    const t = now();
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900 + Math.random() * 900; f1.Q.value = 6;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2100 + Math.random() * 1300; f2.Q.value = 9;
    const g = ac.createGain();
    const peak = 0.012 + strength * 0.018;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // syllable wobble
    const lfo = ac.createOscillator(); lfo.frequency.value = 3.2 + Math.random() * 2;
    const lfoG = ac.createGain(); lfoG.gain.value = 0.008;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = (Math.random() - 0.5) * 1.4; g.connect(p); p.connect(ambBus); }
    else g.connect(ambBus);
    src.start(t); lfo.start(t); src.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    src.onended = () => { try { src.disconnect(); f1.disconnect(); f2.disconnect(); g.disconnect(); } catch (e) {} };
  };

  A.setTension = function (v) {
    tensionTarget = M_clamp(v, 0, 1);
    if (droneGain) droneGain.gain.setTargetAtTime(0.05 + tensionTarget * 0.12, now(), 1.5);
    updateHeartbeat();
  };
  function M_clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function updateHeartbeat() {
    if (!ambientOn) return;
    if (tensionTarget < 0.12) {
      if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
      return;
    }
    if (!heartbeatTimer) beat();
  }
  function beat() {
    if (!ambientOn) { heartbeatTimer = null; return; }
    const strength = tensionTarget;
    thump(0.035 + strength * 0.05, 48, 0.08);
    setTimeout(() => thump(0.022 + strength * 0.04, 40, 0.09), 180);
    const interval = 900 - strength * 420;
    heartbeatTimer = setTimeout(beat, interval);
  }
  function thump(gainVal, freq, dur) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, now());
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, now() + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.linearRampToValueAtTime(gainVal, now() + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    o.connect(g); g.connect(ambBus);
    o.start(); o.stop(now() + dur + 0.02);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
  }

  /* ------------------------------------------------------------
   * SFX
   * ------------------------------------------------------------ */
  const SFX = {
    uiClick() { tone(520, 0.05, { type: 'triangle', gain: 0.035 }); },
    page() { noise(0.22, { filter: 'highpass', freq: 1800, gain: 0.035 }); },
    type() { tone(1200 + Math.random() * 500, 0.018, { type: 'square', gain: 0.006 }); },
    obs() { tone(320, 0.35, { type: 'sine', gain: 0.025, to: 260 }); },
    obsDanger() { tone(120, 0.6, { type: 'sine', gain: 0.05, to: 70, send: 0.3 }); noise(0.2, { freq: 1200, gain: 0.02 }); },
    gunDraw() { noise(0.12, { filter: 'bandpass', freq: 2600, q: 2, gain: 0.05 }); tone(180, 0.1, { type: 'square', gain: 0.02 }); },
    holster() { noise(0.1, { filter: 'bandpass', freq: 1800, q: 2, gain: 0.035 }); },
    dryClick() { noise(0.03, { filter: 'highpass', freq: 3000, gain: 0.06 }); },
    gunshot() {
      noise(0.25, { filter: 'lowpass', freq: 1600, gain: 0.55 });
      noise(0.06, { filter: 'highpass', freq: 3000, gain: 0.35 });
      tone(90, 0.35, { type: 'sine', gain: 0.35, to: 38, send: 0.6 });
      tone(190, 0.12, { type: 'square', gain: 0.08, to: 60, send: 0.4 });
      // tail
      setTimeout(() => noise(1.1, { filter: 'lowpass', freq: 900, gain: 0.045, send: 0.6 }), 40);
    },
    cash() { tone(1400, 0.05, { type: 'square', gain: 0.03 }); noise(0.4, { filter: 'bandpass', freq: 3200, q: 3, gain: 0.035 }); },
    scanner() { setTimeout(() => tone(1900, 0.07, { type: 'square', gain: 0.04 }), 0); setTimeout(() => tone(2300, 0.06, { type: 'square', gain: 0.035 }), 110); },
    register() { tone(880, 0.08, { type: 'square', gain: 0.03 }); setTimeout(() => tone(1200, 0.1, { type: 'square', gain: 0.025 }), 90); },
    doorChime() {
      bell(1046.5, 1.5, 0.10);
      setTimeout(() => bell(784, 2.1, 0.085), 190);
      noise(0.15, { filter: 'highpass', freq: 4000, gain: 0.02 });
    },
    doorSlide() { noise(0.7, { filter: 'lowpass', freq: 700, gain: 0.03 }); },
    footstep(variant) {
      noise(0.09, { filter: 'bandpass', freq: 380 + Math.random() * 160, q: 1.2, gain: 0.05 });
      tone(90 + Math.random() * 20, 0.07, { type: 'sine', gain: 0.03, to: 55 });
    },
    stepHuman() {
      noise(0.08, { filter: 'bandpass', freq: 300 + Math.random() * 200, q: 1, gain: 0.035 });
      tone(80, 0.09, { type: 'sine', gain: 0.02, to: 48 });
    },
    flicker() {
      noise(0.5, { filter: 'bandpass', freq: 3000, q: 1, gain: 0.03 });
      tone(100, 0.4, { type: 'sawtooth', gain: 0.015 });
    },
    humOn() { tone(100, 1.2, { type: 'sine', gain: 0.02 }); },
    knock() {
      for (let i = 0; i < 3; i++) setTimeout(() => {
        noise(0.14, { filter: 'lowpass', freq: 300, gain: 0.16 });
        tone(60, 0.18, { type: 'sine', gain: 0.07, to: 40 });
      }, i * 260);
    },
    doorLocked() { noise(0.08, { filter: 'bandpass', freq: 1000, gain: 0.05 }); tone(70, 0.2, { type: 'sine', gain: 0.05 }); },
    death() {
      noise(1.2, { filter: 'lowpass', freq: 500, gain: 0.1, send: 0.6 });
      for (const f of [55, 58.2, 82, 116, 155]) tone(f, 2.4, { type: 'sawtooth', gain: 0.018, to: f * 0.5, send: 0.5 });
      setTimeout(() => noise(0.5, { filter: 'highpass', freq: 4000, gain: 0.05 }), 80);
    },
    stinger() {
      for (const [f, d] of [[220, 0], [233, 14], [311, -9], [466, 22]]) {
        tone(f, 1.8, { type: 'sawtooth', gain: 0.02, detune: d, send: 0.65 });
      }
      noise(0.35, { filter: 'highpass', freq: 2500, gain: 0.045, send: 0.4 });
    },
    blackout() {
      noise(0.4, { filter: 'lowpass', freq: 200, gain: 0.1 });
      tone(50, 1.2, { type: 'sine', gain: 0.05, to: 28, send: 0.4 });
      setTimeout(() => noise(0.15, { filter: 'highpass', freq: 3000, gain: 0.03 }), 320);
    },
    powerOn() { tone(100, 0.6, { type: 'sine', gain: 0.04 }); setTimeout(() => tone(200, 0.3, { type: 'sine', gain: 0.02 }), 300); },
    flashlightOn() { noise(0.06, { filter: 'highpass', freq: 4000, gain: 0.05 }); tone(800, 0.04, { type: 'square', gain: 0.02 }); },
    flashlightOff() { noise(0.05, { filter: 'highpass', freq: 3000, gain: 0.03 }); },
    radioStatic(dur) { noise(dur || 0.4, { filter: 'bandpass', freq: 1800, q: 0.7, gain: 0.035 }); },
    thunder() {
      noise(2.5, { filter: 'lowpass', freq: 300, gain: 0.12, send: 0.8 });
      noise(0.4, { filter: 'lowpass', freq: 900, gain: 0.08 });
    },
    whisperSoft() { A.whisper(0.5); },
    fakeVoice() {
      // formant-ish murmur
      noise(0.45, { filter: 'bandpass', freq: 700, q: 4, gain: 0.03 });
      tone(120, 0.4, { type: 'sawtooth', gain: 0.012, to: 90 });
    },
    lunge() {
      noise(0.5, { filter: 'highpass', freq: 800, gain: 0.16 });
      tone(70, 0.6, { type: 'sawtooth', gain: 0.08, to: 160, send: 0.4 });
      A.whisper(0.9);
    },
    safe() { tone(520, 0.5, { type: 'sine', gain: 0.02, to: 660, send: 0.3 }); },
    click() { noise(0.02, { filter: 'highpass', freq: 2000, gain: 0.03 }); }
  };

  A.play = function (name) {
    if (!ensure()) return;
    const f = SFX[name];
    if (f) { try { f(); } catch (e) { /* ignore */ } }
  };

  /* ------------------------------------------------------------
   * Voice
   * ------------------------------------------------------------ */
  A.speak = function (text, kind) {
    if (!voiceOn || !window.speechSynthesis || !text) return;
    const nowMs = performance.now();
    if (nowMs - lastSpeak < 150) return;
    lastSpeak = nowMs;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/（[^）]*）/g, '').replace(/[「」]/g, ''));
      u.lang = 'zh-CN';
      const v = pickVoice(kind);
      if (v) u.voice = v;
      if (kind === 'radio') { u.rate = 0.93; u.pitch = 0.98; u.volume = 0.9 * volume; }
      else if (kind === 'fake') { u.rate = 0.68; u.pitch = 0.3; u.volume = 0.92 * volume; }
      else if (kind === 'fakeF') { u.rate = 0.84; u.pitch = 0.72; u.volume = 0.92 * volume; }
      else if (kind === 'customerF') { u.rate = 1.0; u.pitch = 1.12; u.volume = 0.9 * volume; }
      else if (kind === 'inner') { u.rate = 0.92; u.pitch = 0.85; u.volume = 0.6 * volume; }
      else { u.rate = 1.0; u.pitch = 1.0; u.volume = 0.9 * volume; }
      u.onstart = () => { if (kind === 'radio' || kind === 'fake') A.play('radioStatic'); };
      u.onerror = () => {};
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };
  function pickVoice(kind) {
    if (!voices.length) loadVoices();
    const zh = voices.filter(v => /^zh/i.test(v.lang) || /Chinese|Huihui|Xiaoxiao|Yunxi|Yunyang|Kangkang|Tingting|Meijia/i.test(v.name));
    if (!zh.length) return null;
    if (kind === 'radio' || kind === 'inner' || kind === 'customerF' || kind === 'fakeF') {
      return zh.find(v => /female|Huihui|Xiaoxiao|Tingting|Meijia/i.test(v.name)) || zh[0];
    }
    return zh[(fakeVoiceSeed = (fakeVoiceSeed + 1) % zh.length)];
  }
  A.stopSpeaking = function () {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  };
  A.setVoice = function (on) {
    voiceOn = !!on;
    if (!on) A.stopSpeaking();
  };
  A.setVolume = function (v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(volume, now(), 0.1);
  };
  A.init = function () {
    if (started) { ensure(); return; }
    started = true;
    ensure();
    A.startAmbient();
  };
  A.resume = function () { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); };
  A.suspend = function () { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); };
  A.isRunning = () => !!ac && ac.state === 'running';

  // auto-start on first interaction
  const kick = () => {
    A.init();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
  };
  window.addEventListener('pointerdown', kick, { once: true });
  window.addEventListener('keydown', kick, { once: true });

  MS.Audio = A;
})(window.MS);
