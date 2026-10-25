/* ==========================================================================
   午夜轮班 · 前端控制层
   职责：载入 WASM、每帧推进模拟、把状态画出来、把按钮和键盘接到 act()、
   把中文文案放进 DOM（WASM 只出数字）。
   ========================================================================== */

import { createArt, W, H, SCALE } from './art.js';
import { S, PHASE, KIND, readState } from './state.js';
import * as T from './text.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const dom = {
    board: $('[data-shift-board]'),
    stage: $('[data-shift-stage]'),
    canvas: $('[data-shift-canvas]'),
    clock: $('[data-shift-clock]'),
    hour: $('[data-shift-hour]'),
    track: $('[data-shift-track]'),
    money: $('[data-shift-money]'),
    sanity: $('[data-shift-sanity]'),
    sanityBar: $('[data-shift-sanity-bar]'),
    battery: $('[data-shift-battery]'),
    batteryBar: $('[data-shift-battery-bar]'),
    radio: $('[data-shift-radio]'),
    hint: $('[data-shift-hint]'),
    bubble: $('[data-shift-bubble]'),
    who: $('[data-shift-who]'),
    line: $('[data-shift-line]'),
    idline: $('[data-shift-id]'),
    patience: $('[data-shift-patience-bar]'),
    toast: $('[data-shift-toast]'),
    log: $('[data-shift-log]'),
    actions: $$('[data-shift-act]'),
    veil: $('[data-shift-veil]'),
    veilLoading: $('[data-veil-loading]'),
    veilIntro: $('[data-veil-intro]'),
    veilEnd: $('[data-veil-end]'),
    veilError: $('[data-veil-error]'),
    endRank: $('[data-shift-end-rank]'),
    endTitle: $('[data-shift-end-title]'),
    endText: $('[data-shift-end-text]'),
    endStats: $('[data-shift-end-stats]'),
    alarm: $('[data-shift-alarm]'),
};

/* 覆盖层只有一块，面板轮换显示 —— 别让开场和结算叠在一起 */
function showPanel(which) {
    const panels = { loading: dom.veilLoading, intro: dom.veilIntro, end: dom.veilEnd, error: dom.veilError };
    for (const key of Object.keys(panels)) {
        if (panels[key]) { panels[key].hidden = key !== which; }
    }
    dom.veil.dataset.mode = which || 'none';
    dom.veil.dataset.show = which ? '1' : '0';
}

const state = {
    api: null,
    art: null,
    raf: 0,
    last: 0,
    prevPhase: -1,
    prevKind: -1,
    prevFeedback: -1,
    prevRadio: -1,
    labelMode: '',
    started: false,
    ended: false,
    sound: false,
    audio: null,
};

/* ── 音效（WebAudio，全部现场合成，没有音频文件） ───────────────────────── */
function audio() {
    if (!state.audio) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        state.audio = Ctor ? new Ctor() : null;
    }
    return state.audio;
}

function tone(freq, dur, type, gain, slideTo) {
    const ac = audio();
    if (!ac || !state.sound) { return; }
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) { osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur); }
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain) {
    const ac = audio();
    if (!ac || !state.sound) { return; }
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) { data[i] = (Math.random() * 2 - 1) * (1 - i / len); }
    const src = ac.createBufferSource();
    const amp = ac.createGain();
    amp.gain.value = gain || 0.05;
    src.buffer = buf;
    src.connect(amp).connect(ac.destination);
    src.start();
}

const sfx = {
    bell() { tone(1180, 0.12, 'triangle', 0.05); setTimeout(() => tone(1560, 0.16, 'triangle', 0.04), 90); },
    good() { tone(520, 0.1, 'sine', 0.05); setTimeout(() => tone(780, 0.14, 'sine', 0.045), 80); },
    bad() { tone(150, 0.4, 'sawtooth', 0.05, 60); noise(0.3, 0.04); },
    knock() { tone(90, 0.16, 'square', 0.06); setTimeout(() => tone(88, 0.16, 'square', 0.05), 320); setTimeout(() => tone(86, 0.2, 'square', 0.04), 660); },
    over() { tone(320, 0.9, 'sine', 0.05, 120); },
};

/* ── 载入 WASM ─────────────────────────────────────────────────────────── */
async function loadApi() {
    const url = new URL('../shift.wasm', import.meta.url);
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) { throw new Error('WASM 请求失败：HTTP ' + res.status); }
    const env = {
        abort: (msg) => { throw new Error('wasm abort: ' + msg); },
        trace: () => {},
    };
    if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
            const streamed = await WebAssembly.instantiateStreaming(res.clone(), { env });
            return streamed.instance.exports;
        } catch (err) {
            /* 服务器没给 application/wasm 时会失败，退回 ArrayBuffer */}
    }
    const buf = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(buf, { env });
    return instance.exports;
}

/* ── HUD ───────────────────────────────────────────────────────────────── */
function pad2(n) { return String(n).padStart(2, '0'); }

function clockText(minutes) {
    const total = Math.max(0, Math.min(360, minutes));
    const h = Math.floor(total / 60);
    const m = Math.floor(total % 60);
    return pad2(h) + ':' + pad2(m);
}

function setText(el, value) {
    if (el && el.textContent !== value) { el.textContent = value; }
}

function renderHud(s) {
    setText(dom.clock, clockText(s.clock));
    setText(dom.hour, '第 ' + Math.min(6, Math.floor(s.clock / 60) + 1) + ' / 6 小时');
    dom.track.style.width = Math.min(100, (s.clock / 360) * 100).toFixed(2) + '%';

    setText(dom.money, (s.money < 0 ? '-¥' : '¥') + Math.abs(s.money));
    setText(dom.sanity, String(s.sanity));
    setText(dom.battery, String(s.battery) + ' / 8');
    dom.sanityBar.style.width = Math.max(0, Math.min(100, s.sanity)) + '%';
    dom.sanityBar.dataset.level = s.sanity <= 25 ? 'low' : s.sanity <= 55 ? 'mid' : 'ok';
    dom.batteryBar.style.width = Math.max(0, Math.min(100, (s.battery / 8) * 100)) + '%';

    const phaseHint = T.PHASE_HINT[s.phase] || '';
    setText(dom.hint, phaseHint);

    if (s.radio > 0 && s.radio !== state.prevRadio) {
        state.prevRadio = s.radio;
        setText(dom.radio, T.RADIO[Math.min(T.RADIO.length - 1, s.radio - 1)] || '');
    }

    /* 按钮：只有站在柜台前（或敲门）才能按 */
    const live = s.phase === PHASE.serve || s.phase === PHASE.knock;
    const allowed = s.phase === PHASE.knock ? [1, 4] : [1, 2, 3, 4];
    for (const btn of dom.actions) {
        const id = Number(btn.dataset.shiftAct);
        const on = live && allowed.indexOf(id) >= 0;
        if (btn.disabled === on) { btn.disabled = !on; }
        btn.dataset.live = on ? '1' : '0';
    }

    const mode = s.phase === PHASE.knock ? 'knock' : 'normal';
    if (mode !== state.labelMode) {
        state.labelMode = mode;
        const list = mode === 'knock' ? T.ACTIONS_KNOCK : T.ACTIONS;
        for (const btn of dom.actions) {
            const id = Number(btn.dataset.shiftAct);
            const item = list.find((a) => a.id === id);
            btn.dataset.visible = item ? '1' : '0';
            if (item) {
                btn.querySelector('[data-act-label]').textContent = item.label;
                btn.querySelector('[data-act-hint]').textContent = item.hint;
                btn.querySelector('[data-act-key]').textContent = item.key;
            }
        }
    }

    /* 对话气泡 */
    const showBubble = (s.phase === PHASE.enter || s.phase === PHASE.serve) && s.kind !== KIND.none;
    dom.bubble.dataset.show = showBubble ? '1' : '0';
    dom.bubble.dataset.kind = String(s.kind);
    if (showBubble) {
        setText(dom.who, T.KIND_LABEL[s.kind] || '顾客');
        setText(dom.line, T.customerLine(s));
        const idText = T.idLine(s);
        dom.idline.dataset.show = idText ? '1' : '0';
        setText(dom.idline, idText);
        const ratio = s.patienceMax > 0 ? Math.max(0, Math.min(1, s.patience / s.patienceMax)) : 0;
        dom.patience.style.width = (ratio * 100).toFixed(1) + '%';
        dom.patience.dataset.level = ratio < 0.3 ? 'low' : ratio < 0.6 ? 'mid' : 'ok';
    }

    if (dom.alarm) {
        dom.alarm.dataset.show = s.phase === PHASE.knock ? '1' : '0';
    }

    /* 反馈（存进日志 + 顶部飘一句） */
    if (s.feedback > 0 && s.feedback !== state.prevFeedback) {
        state.prevFeedback = s.feedback;
        const fb = T.feedbackText(s.feedback);
        if (fb) {
            pushLog(fb.t, fb.tone);
            setText(dom.toast, fb.t);
            dom.toast.dataset.show = '1';
            dom.toast.dataset.tone = String(fb.tone);
            if (fb.tone === 1) { sfx.good(); } else if (fb.tone === 2) { sfx.bad(); }
        }
    }
    if (s.feedback === 0 || s.feedbackT === 0) {
        if (dom.toast.dataset.show === '1' && s.feedbackT === 0) { dom.toast.dataset.show = '0'; }
    }
}

function pushLog(text, tone) {
    if (!dom.log) { return; }
    const li = document.createElement('li');
    li.className = 'log__row';
    li.dataset.tone = String(tone);
    li.textContent = text;
    dom.log.prepend(li);
    while (dom.log.children.length > 5) { dom.log.removeChild(dom.log.lastElementChild); }
}

/* ── 主循环 ────────────────────────────────────────────────────────────── */
function loop(now) {
    const dt = state.last ? Math.min(0.1, (now - state.last) / 1000) : 0.016;
    state.last = now;

    if (!state.api) { return; }
    state.api.frame(dt);
    const s = readState(state.api);

    if (s.phase !== state.prevPhase) {
        if (s.phase === PHASE.enter) { sfx.bell(); }
        if (s.phase === PHASE.knock) { sfx.knock(); }
        if (s.phase === PHASE.over && s.ending === 2) { sfx.over(); }
        state.prevPhase = s.phase;
    }

    renderHud(s);
    drawScene(s, now / 1000);

    if (s.phase === PHASE.over && s.ending !== 0 && !state.ended) { finish(s); }
    requestAnimationFrame(loop);
}

function drawScene(s, time) {
    const ctx = context();
    if (!ctx) { return; }
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const amp = s.shake / 100;
    if (amp > 0.02) {
        ctx.translate((Math.random() - 0.5) * amp * 7, (Math.random() - 0.5) * amp * 5);
    }
    state.art.draw(ctx, s, time);
}

function context() {
    if (!state.art) { state.art = createArt(); }
    return dom.canvas.getContext('2d');
}

/* ── 结束 ──────────────────────────────────────────────────────────────── */
function finish(s) {
    state.ended = true;
    const broke = s.ending === 2;
    const ending = broke ? T.ENDINGS.broke : T.ENDINGS.dawn;
    const rank = T.RANK[s.rank] || T.RANK[4];

    setText(dom.endRank, broke ? '—' : rank.mark);
    setText(dom.endTitle, broke ? ending.title : rank.title);
    setText(dom.endText, (ending.lines || []).join(' '));
    dom.endStats.innerHTML = [
        '<li><span>营业额</span><b>' + (s.money < 0 ? '-¥' : '¥') + Math.abs(s.money) + '</b></li>',
        '<li><span>接待</span><b>' + s.served + ' 位</b></li>',
        '<li><span>拒绝</span><b>' + s.refused + ' 位</b></li>',
        '<li><span>事故</span><b>' + s.incidents + ' 次</b></li>',
        '<li><span>来客</span><b>' + s.total + ' 位</b></li>',
        '<li><span>理智</span><b>' + s.sanity + '</b></li>',
    ].join('');
    showPanel('end');
}

/* ── 动作 ──────────────────────────────────────────────────────────────── */
function doAct(id) {
    if (!state.api || !state.started) { return; }
    const accepted = state.api.act(id);
    if (!accepted) { return; }
    const btn = dom.actions.find((b) => Number(b.dataset.shiftAct) === id);
    if (btn) {
        btn.dataset.pulse = '1';
        setTimeout(() => { btn.dataset.pulse = '0'; }, 240);
    }
}

function start() {
    if (!state.api) { return; }
    const seed = (Date.now() % 2147483647) || 12345;
    state.api.init(seed);
    state.api.begin();
    state.started = true;
    state.ended = false;
    state.prevPhase = -1;
    state.prevKind = -1;
    state.prevFeedback = -1;
    state.prevRadio = -1;
    state.labelMode = '';
    if (dom.log) { dom.log.innerHTML = ''; }
    showPanel('');
    if (state.sound) { tone(440, 0.2, 'sine', 0.04, 660); }
}

/* ── 绑定 ──────────────────────────────────────────────────────────────── */
function bind() {
    for (const btn of dom.actions) {
        btn.addEventListener('click', () => doAct(Number(btn.dataset.shiftAct)));
    }

    document.addEventListener('keydown', (ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.altKey) { return; }
        if (ev.key === '1' || ev.key === '2' || ev.key === '3' || ev.key === '4') {
            ev.preventDefault();
            doAct(Number(ev.key));
            return;
        }
        if (ev.key === ' ' || ev.key === 'Enter') {
            if (dom.veil.dataset.mode === 'intro' || dom.veil.dataset.mode === 'end') {
                ev.preventDefault();
                start();
            }
        }
    });

    const beginBtn = $('[data-shift-begin]');
    if (beginBtn) {
        beginBtn.addEventListener('click', () => {
            if (state.audio && state.audio.state === 'suspended') { state.audio.resume(); }
            start();
        });
    }

    const againBtn = $('[data-shift-again]');
    if (againBtn) { againBtn.addEventListener('click', () => start()); }

    const soundBtn = $('[data-shift-sound]');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            state.sound = !state.sound;
            soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
            soundBtn.textContent = state.sound ? '声音 开' : '声音 关';
            if (state.sound) {
                const ac = audio();
                if (ac && ac.state === 'suspended') { ac.resume(); }
                tone(660, 0.1, 'triangle', 0.04);
            }
        });
    }

    const fullBtn = $('[data-shift-full]');
    if (fullBtn) {
        fullBtn.addEventListener('click', () => {
            if (!document.fullscreenElement && dom.stage.requestFullscreen) {
                dom.stage.requestFullscreen().catch(() => {});
            } else if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        });
    }
}

function showError(err) {
    showPanel('error');
    const detail = dom.veilError.querySelector('[data-shift-error-detail]');
    if (detail) { detail.textContent = String(err && err.message ? err.message : err); }
}

/* ── 启动 ──────────────────────────────────────────────────────────────── */
async function boot() {
    bind();
    try {
        state.api = await loadApi();
    } catch (err) {
        showError(err);
        return;
    }
    state.api.init(12345);
    /* 调试/自动化用：控制台里可以直接 __shiftApi.state(0) 看状态、frame(0.2) 快进 */
    window.__shiftApi = state.api;
    state.art = createArt();
    showPanel('intro');
    requestAnimationFrame((t) => { state.last = t; loop(t); });
}

boot();
