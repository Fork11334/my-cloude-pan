/* ============================================================
 * 长夜便利店 — UI / 叙事界面
 * ============================================================ */
window.MS = window.MS || {};
(function (MS) {
  'use strict';
  const M = MS.M, D = MS.DOM;
  const UI = {};
  UI.state = { booted: false, typing: null, dialogueOpen: false, radioTimer: null, toastTimer: null };
  UI.game = null;

  UI.init = function (game) {
    UI.game = game;
    // grain
    const grain = document.getElementById('fxGrain');
    if (grain) grain.style.backgroundImage = 'url(' + MS.T.grainDataURL() + ')';
    // menu
    D.$$('#titleMenu .menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (MS.Audio) MS.Audio.play('uiClick');
        const act = btn.getAttribute('data-act');
        if (act === 'new') UI.game.newGame();
        else if (act === 'continue') UI.game.continueGame();
        else if (act === 'nights') UI.showNights();
        else if (act === 'settings') UI.showSettings();
        else if (act === 'credits') UI.showCredits();
      });
    });
    // settings buttons
    D.$$('#setQuality button').forEach(b => b.addEventListener('click', () => UI.setQuality(b.getAttribute('data-v'))));
    const sens = document.getElementById('setSens');
    const vol = document.getElementById('setVol');
    if (sens) sens.addEventListener('input', () => {
      const v = parseFloat(sens.value);
      const s = MS.Storage.load().settings; s.sensitivity = v; MS.Storage.save();
      MS.Player.sensitivity = v;
      document.getElementById('setSensVal').textContent = v.toFixed(2);
    });
    if (vol) vol.addEventListener('input', () => {
      const v = parseFloat(vol.value);
      const s = MS.Storage.load().settings; s.volume = v; MS.Storage.save();
      if (MS.Audio) MS.Audio.setVolume(v);
      document.getElementById('setVolVal').textContent = Math.round(v * 100) + '%';
    });
    D.$$('#setVoice button').forEach(b => b.addEventListener('click', () => {
      const on = b.getAttribute('data-v') === 'on';
      const s = MS.Storage.load().settings; s.voice = on; MS.Storage.save();
      if (MS.Audio) MS.Audio.setVoice(on);
      UI.refreshSeg('setVoice', on ? 'on' : 'off');
    }));
    D.$$('#setGrain button').forEach(b => b.addEventListener('click', () => {
      const on = b.getAttribute('data-v') === 'on';
      const s = MS.Storage.load().settings; s.grain = on; MS.Storage.save();
      document.getElementById('fxGrain').style.display = on ? '' : 'none';
      UI.refreshSeg('setGrain', on ? 'on' : 'off');
    }));
    D.$$('#setShake button').forEach(b => b.addEventListener('click', () => {
      const on = b.getAttribute('data-v') === 'on';
      const s = MS.Storage.load().settings; s.shake = on; MS.Storage.save();
      UI.refreshSeg('setShake', on ? 'on' : 'off');
    }));
    D.$$('#setHints button').forEach(b => b.addEventListener('click', () => {
      const on = b.getAttribute('data-v') === 'on';
      const s = MS.Storage.load().settings; s.hints = on; MS.Storage.save();
      UI.refreshSeg('setHints', on ? 'on' : 'off');
      UI.applyHints();
    }));
    document.getElementById('setClose').addEventListener('click', () => UI.closeSettings());
    document.getElementById('setFull').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    });
    document.getElementById('setReset').addEventListener('click', () => {
      if (confirm('清除全部值班记录、结局与设置？此操作不可恢复。')) {
        MS.Storage.reset();
        location.reload();
      }
    });
    document.getElementById('credClose').addEventListener('click', () => D.hide(document.getElementById('credits')));
    document.getElementById('nightsClose').addEventListener('click', () => D.hide(document.getElementById('nights')));
    document.getElementById('nightsBack').addEventListener('click', () => D.hide(document.getElementById('nights')));
    document.getElementById('jrClose').addEventListener('click', () => UI.hideJournal());
    D.$$('#jrTabs button').forEach(b => b.addEventListener('click', () => UI.showJournal(b.getAttribute('data-tab'))));
    document.getElementById('deadRetry').addEventListener('click', () => UI.game.retryNight());
    document.getElementById('deadTitle').addEventListener('click', () => UI.game.toTitle());
    document.getElementById('neGo').addEventListener('click', () => UI.game.nextNight());
    document.getElementById('endBack').addEventListener('click', () => UI.game.toTitle());
    document.getElementById('briefGo').addEventListener('click', () => UI.game.beginFromBriefing());
    document.getElementById('pauseResume').addEventListener('click', () => UI.game.resume());
    document.getElementById('pauseSettings').addEventListener('click', () => UI.showSettings());
    document.getElementById('pauseTitle').addEventListener('click', () => UI.game.toTitle());
    // dialogue option clicks (delegated)
    document.getElementById('dlgOptions').addEventListener('click', (e) => {
      const el = e.target.closest('.dlg-opt');
      if (!el) return;
      const idx = parseInt(el.getAttribute('data-i'), 10);
      if (!isNaN(idx) && UI.game) UI.game.onDialogueOption(idx);
    });
    document.getElementById('dlgText').addEventListener('click', () => UI.skipType());
    // UI key handling for dialogue / overlays
    document.addEventListener('keydown', (e) => {
      if (UI.state.dialogueOpen) {
        if (e.code >= 'Digit1' && e.code <= 'Digit6') {
          const i = parseInt(e.code.slice(5), 10) - 1;
          const btns = D.$$('#dlgOptions .dlg-opt');
          if (btns[i] && !btns[i].classList.contains('done')) {
            e.preventDefault();
            UI.game.onDialogueOption(i);
          }
        } else if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          UI.skipType(true);
        }
      }
    });
    window.addEventListener('resize', () => { if (UI.game) UI.game.onResize(); });
    UI.applySettingsToUI();
  };

  UI.applySettingsToUI = function () {
    const s = MS.Storage.load().settings;
    MS.Player.sensitivity = s.sensitivity;
    if (MS.Audio) MS.Audio.setVolume(s.volume);
    UI.refreshSeg('setQuality', s.quality === 'auto' ? 'medium' : s.quality);
    UI.refreshSeg('setVoice', s.voice ? 'on' : 'off');
    UI.refreshSeg('setGrain', s.grain ? 'on' : 'off');
    UI.refreshSeg('setShake', s.shake ? 'on' : 'off');
    UI.refreshSeg('setHints', (s.hints === false) ? 'off' : 'on');
    const sens = document.getElementById('setSens');
    const vol = document.getElementById('setVol');
    if (sens) { sens.value = s.sensitivity; document.getElementById('setSensVal').textContent = s.sensitivity.toFixed(2); }
    if (vol) { vol.value = s.volume; document.getElementById('setVolVal').textContent = Math.round(s.volume * 100) + '%'; }
    document.getElementById('fxGrain').style.display = s.grain === false ? 'none' : '';
    UI.applyHints();
  };
  UI.applyHints = function () {
    const s = MS.Storage.load().settings;
    const show = s.hints !== false;
    document.getElementById('reticle').style.display = show ? '' : 'none';
    document.getElementById('hudHint').style.display = show ? '' : 'none';
  };
  UI.refreshSeg = function (id, v) {
    const el = document.getElementById(id);
    if (!el) return;
    D.$$('button', el).forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === v));
  };
  UI.setQuality = function (v) {
    const s = MS.Storage.load().settings;
    s.quality = v; MS.Storage.save();
    UI.refreshSeg('setQuality', v);
    if (UI.game) UI.game.applyQuality(v);
  };

  /* ---------------- boot ---------------- */
  UI.bootProgress = function (p, text) {
    const bar = document.getElementById('bootBar');
    if (bar) bar.style.width = Math.round(p * 100) + '%';
    if (text) document.getElementById('bootStatus').textContent = text;
  };
  UI.hideBoot = function () {
    D.hide(document.getElementById('boot'));
  };

  /* ---------------- title ---------------- */
  UI.showTitle = function () {
    D.hide(document.getElementById('hud'));
    D.hide(document.getElementById('briefing'));
    D.hide(document.getElementById('nightEnd'));
    D.hide(document.getElementById('dead'));
    D.hide(document.getElementById('ending'));
    D.hide(document.getElementById('pause'));
    D.hide(document.getElementById('journal'));
    D.hide(document.getElementById('idcard'));
    D.hide(document.getElementById('dialogue'));
    D.show(document.getElementById('title'));
    UI.refreshTitle();
    UI.updateTitleClock();
  };
  UI.hideTitle = function () { D.hide(document.getElementById('title')); };
  UI.refreshTitle = function () {
    const d = MS.Storage.load();
    const done = d.completed.length;
    const info = document.getElementById('saveInfo');
    if (info) info.textContent = done ? ('已完成 ' + done + ' 夜 · 结局 ' + d.endings.length + '/3') : '尚无值班记录';
    const cont = D.$('#titleMenu .menu-btn[data-act="continue"]');
    if (cont) cont.disabled = done === 0 && d.unlocked <= 1;
    const nights = D.$('#titleMenu .menu-btn[data-act="nights"]');
    if (nights) nights.disabled = false;
  };
  UI.updateTitleClock = function () {
    const el = document.getElementById('titleHour');
    if (!el) return;
    // the title screen is frozen at a fixed late-night time
    const base = 3 * 60 + 12;
    const mins = base + Math.floor((Date.now() / 60000) % 50);
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    el.textContent = M.pad(hh) + ':' + M.pad(mm);
  };

  /* ---------------- HUD ---------------- */
  UI.showHUD = function (on) {
    if (on) { D.show(document.getElementById('hud')); UI.applyHints(); }
    else D.hide(document.getElementById('hud'));
  };
  UI.setHUD = function (nightTitle, timeStr, remain, objective) {
    D.setText(document.getElementById('hudNight'), nightTitle);
    D.setText(document.getElementById('hudClock'), timeStr);
    D.setText(document.getElementById('hudRemain'), remain);
    if (objective != null) UI.setObjective(objective);
  };
  UI.setObjective = function (text) {
    const el = document.getElementById('hudObjective');
    if (el) el.querySelector('span').textContent = text;
    if (MS.Game && MS.Game.state) MS.Game.state.objective = text;
  };
  UI.setAmmo = function (cur, max) {
    const el = document.getElementById('hudBullets');
    if (!el) return;
    let html = '';
    for (let i = 0; i < max; i++) {
      html += '<i class="' + (i < cur ? 'has' : 'spent') + '"></i>';
    }
    el.innerHTML = html;
  };
  UI.setPrompt = function (label, key, show) {
    const el = document.getElementById('interact');
    if (!el) return;
    if (!show) { D.hide(el); return; }
    D.show(el);
    el.querySelector('b').textContent = key || 'E';
    el.querySelector('span').textContent = label;
  };
  UI.setHold = function (p) {
    const wrap = document.getElementById('holdRing');
    const arc = document.getElementById('holdArc');
    if (!wrap || !arc) return;
    if (p == null) { D.hide(wrap); return; }
    D.show(wrap);
    arc.style.strokeDashoffset = String(100.5 * (1 - M.clamp(p, 0, 1)));
  };
  UI.setMood = function (text, color) {
    const t = document.getElementById('moodText');
    const d = document.querySelector('.mood-dot');
    if (t) t.textContent = text;
    if (d && color) { d.style.background = color; d.style.color = color; }
  };
  UI.setFear = function (v) {
    const el = document.getElementById('fxFear');
    if (el) el.style.opacity = String(M.clamp(v, 0, 1) * 0.85);
  };
  UI.toast = function (text, ms) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(UI.state.toastTimer);
    UI.state.toastTimer = setTimeout(() => el.classList.remove('on'), ms || 3200);
  };

  /* ---------------- subtitles / radio ---------------- */
  UI.showSubtitle = function (who, text, ms) {
    const wrap = document.getElementById('subtitle');
    const w = document.getElementById('subWho');
    const t = document.getElementById('subText');
    if (!wrap || !t) return;
    if (who) { w.textContent = who; w.style.display = ''; } else { w.style.display = 'none'; }
    t.textContent = text;
    D.show(wrap);
    clearTimeout(UI.state.subTimer);
    if (ms !== 0) UI.state.subTimer = setTimeout(() => D.hide(wrap), ms || 6000);
    if (MS.Audio && who) MS.Audio.speak(text, who === '苏姐' ? 'radio' : 'inner');
  };
  UI.hideSubtitle = function () { D.hide(document.getElementById('subtitle')); };

  UI.showRadio = function (text, ms) {
    const wrap = document.getElementById('radioBox');
    const t = document.getElementById('radioText');
    if (!wrap) return;
    t.textContent = '';
    D.show(wrap);
    UI.typeInto(t, text, 22, 'radio');
    if (MS.Audio) MS.Audio.speak(text, 'radio');
    clearTimeout(UI.state.radioTimer);
    if (ms !== 0) UI.state.radioTimer = setTimeout(() => D.hide(wrap), ms || 9000);
  };
  UI.hideRadio = function () { D.hide(document.getElementById('radioBox')); };

  UI.typeInto = function (el, text, speed, voiceKind) {
    clearInterval(el._timer);
    el.textContent = '';
    let i = 0;
    el._typing = true;
    el._timer = setInterval(() => {
      if (i >= text.length) { clearInterval(el._timer); el._typing = false; return; }
      el.textContent += text.charAt(i++);
      if (i % 3 === 0 && MS.Audio) MS.Audio.play('type');
    }, speed || 18);
  };

  /* ---------------- observation ---------------- */
  UI.showObserve = function (name) {
    const p = document.getElementById('observePanel');
    if (!p) return;
    D.show(p);
    document.getElementById('obsName').textContent = name || '——';
    document.getElementById('obsList').innerHTML = '';
  };
  UI.hideObserve = function () { D.hide(document.getElementById('observePanel')); };
  UI.clearObserve = function () { document.getElementById('obsList').innerHTML = ''; };
  UI.addObservation = function (text, danger) {
    const list = document.getElementById('obsList');
    if (!list) return;
    const el = document.createElement('div');
    el.className = 'obs-item' + (danger ? ' danger' : '');
    el.textContent = text;
    list.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    if (MS.Audio) MS.Audio.play(danger ? 'obsDanger' : 'obs');
  };

  /* ---------------- dialogue ---------------- */
  UI.showDialogue = function (customer, who, sub, text, options) {
    const wrap = document.getElementById('dialogue');
    if (!wrap) return;
    D.show(wrap);
    UI.state.dialogueOpen = true;
    UI.state.dialogueText = text;
    UI.state.dialogueOptions = options || [];
    const avatar = document.getElementById('dlgAvatar');
    const portraitUrl = customer && customer.def ? (customer.def.portraitData || (typeof customer.def.portrait === 'string' ? customer.def.portrait : null)) : null;
    if (portraitUrl) {
      avatar.style.backgroundImage = 'url(' + portraitUrl + ')';
      avatar.style.display = '';
    } else {
      avatar.style.display = 'none';
    }
    document.getElementById('dlgName').textContent = who || (customer ? customer.def.name : '顾客');
    document.getElementById('dlgSub').textContent = sub || '站在柜台前';
    document.getElementById('dlgClock').textContent = MS.Game && MS.Game.clockString ? MS.Game.clockString() : '';
    const t = document.getElementById('dlgText');
    t.textContent = '';
    UI.typeDialogue(t, text, 20);
    const optWrap = document.getElementById('dlgOptions');
    optWrap.innerHTML = '';
    (options || []).forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-opt' + (o.danger ? ' danger' : '') + (o.disabled ? ' done' : '');
      b.setAttribute('data-i', i);
      b.innerHTML = '<b>' + (i + 1) + '</b><span>' + o.label + '</span>' + (o.tag ? '<em>' + o.tag + '</em>' : '');
      if (o.disabled) b.classList.add('done');
      optWrap.appendChild(b);
    });
    if (options && options.length) {
      document.getElementById('dlgHint').textContent = '按 1–' + options.length + ' 选择 · 点击也可';
    } else {
      document.getElementById('dlgHint').textContent = '空格 继续';
    }
    if (customer && customer.def && customer.def.voice) {
      // voice handled by caller via Audio.speak
    }
  };
  UI.typeDialogue = function (el, text, speed) {
    clearInterval(el._timer);
    el.textContent = '';
    UI.state.fullDialogueText = text;
    UI.state.dialogueTyping = true;
    let i = 0;
    el._timer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(el._timer);
        UI.state.dialogueTyping = false;
        return;
      }
      const ch = text.charAt(i++);
      if (ch === '\n') el.appendChild(document.createElement('br'));
      else el.appendChild(document.createTextNode(ch));
      if (i % 2 === 0 && MS.Audio) MS.Audio.play('type');
    }, speed || 20);
  };
  UI.skipType = function () {
    const el = document.getElementById('dlgText');
    if (!el || !UI.state.dialogueTyping) {
      if (UI.game) UI.game.onDialogueAdvance && UI.game.onDialogueAdvance();
      return;
    }
    clearInterval(el._timer);
    el.textContent = UI.state.fullDialogueText || '';
    UI.state.dialogueTyping = false;
  };
  UI.hideDialogue = function () {
    D.hide(document.getElementById('dialogue'));
    UI.state.dialogueOpen = false;
    const el = document.getElementById('dlgText');
    if (el) clearInterval(el._timer);
  };
  UI.setDialogueOptions = function (options) {
    const optWrap = document.getElementById('dlgOptions');
    optWrap.innerHTML = '';
    (options || []).forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'dlg-opt' + (o.danger ? ' danger' : '') + (o.disabled ? ' done' : '');
      b.setAttribute('data-i', i);
      b.innerHTML = '<b>' + (i + 1) + '</b><span>' + o.label + '</span>' + (o.tag ? '<em>' + o.tag + '</em>' : '');
      optWrap.appendChild(b);
    });
    document.getElementById('dlgHint').textContent = options && options.length ? ('按 1–' + options.length + ' 选择 · 点击也可') : '空格 继续';
  };

  /* ---------------- ID card ---------------- */
  UI.showID = function (c, note) {
    const wrap = document.getElementById('idcard');
    const id = c && (c.id || (c.def && c.def.id));
    if (!wrap || !id) return;
    UI.state.dialogueOpen = false;
    D.show(wrap);
    const photo = document.getElementById('idPhoto');
    photo.src = id.photo || (c.def && c.def.portraitData) || '';
    document.getElementById('idName').textContent = id.name || '——';
    document.getElementById('idSex').textContent = id.sex || '——';
    document.getElementById('idDob').textContent = id.dob || '——';
    document.getElementById('idAddr').textContent = id.addr || '——';
    document.getElementById('idNo').textContent = id.no || '——';
    document.getElementById('idValid').textContent = id.valid || '有效期限 2016.03 — 2036.03';
    document.getElementById('idStamp').textContent = id.stamp || '已核验';
    document.getElementById('idNote').textContent = note || '对着光看了看，塑料膜里没有气泡。';
    document.getElementById('idcard').classList.toggle('inspect', !!id.inspect);
  };
  UI.hideID = function () { D.hide(document.getElementById('idcard')); document.getElementById('idcard').classList.remove('inspect'); };

  /* ---------------- journal ---------------- */
  UI.showJournal = function (tab) {
    const jr = document.getElementById('journal');
    if (!jr) return;
    D.show(jr);
    D.$$('#jrTabs button').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    const page = document.getElementById('jrPage');
    const d = MS.Storage.load();
    const story = MS.Story || {};
    if (tab === 'notes') {
      const notes = (story.NOTES || []).filter(n => d.notes.indexOf(n.id) >= 0);
      page.innerHTML = '<h3>拾得便签</h3>' + (notes.length ? notes.map(n =>
        '<div class="paper-note"><span class="pn-meta">' + (n.meta || '') + '</span>' + n.text.replace(/\n/g, '<br>') + '</div>'
      ).join('') : '<div class="empty">你还没有捡到任何纸条。</div>');
    } else if (tab === 'log') {
      const log = (MS.Game && MS.Game.state && MS.Game.state.log) || [];
      page.innerHTML = '<h3>值班日志</h3>' + (log.length ? log.map(l =>
        '<div class="log-item ' + (l.kind || '') + '"><time>' + l.time + '</time><span>' + l.text + '</span></div>'
      ).join('') : '<div class="empty">本夜还没有记录。天亮时它会自己写。</div>');
    } else if (tab === 'controls') {
      page.innerHTML = '<h3>操作说明</h3>' +
        '<div class="ctrl-row"><span>移动 / 环视</span><b>WASD · 鼠标</b></div>' +
        '<div class="ctrl-row"><span>接待 / 交互</span><b>E</b></div>' +
        '<div class="ctrl-row"><span>观察（按住）</span><b>Q</b></div>' +
        '<div class="ctrl-row"><span>拔枪 / 收枪</span><b>G</b></div>' +
        '<div class="ctrl-row"><span>瞄准 / 开枪</span><b>鼠标右键 / 左键</b></div>' +
        '<div class="ctrl-row"><span>手电筒</span><b>F</b></div>' +
        '<div class="ctrl-row"><span>值班手册</span><b>Tab</b></div>' +
        '<div class="ctrl-row"><span>暂停</span><b>Esc</b></div>' +
        '<p style="margin-top:20px;font-size:12px;line-height:2">枪在柜台下面，一个夜班只有六发。<br>不要打人。打错了，你就不再是店员。</p>';
    } else {
      page.innerHTML = '<h3>夜班守则</h3>' + (story.RULES || []).map((r, i) =>
        '<div class="rule-item"><b>' + MS.M.pad(i + 1) + '</b><span>' + r + '</span></div>'
      ).join('') + '<p style="margin-top:22px;font-size:11px;color:#8a7a60">—— 贴在员工休息室门后的复印件</p>';
    }
    if (MS.Audio) MS.Audio.play('page');
  };
  UI.hideJournal = function () { D.hide(document.getElementById('journal')); };

  /* ---------------- paper ---------------- */
  UI.showPaper = function (text, sign) {
    D.show(document.getElementById('paper'));
    document.getElementById('paperText').textContent = text;
    document.getElementById('paperSign').textContent = sign || '';
    if (MS.Audio) MS.Audio.play('page');
  };
  UI.hidePaper = function () { D.hide(document.getElementById('paper')); };

  /* ---------------- briefing ---------------- */
  UI.showBriefing = function (data) {
    const el = document.getElementById('briefing');
    D.show(el);
    document.getElementById('briefNight').textContent = data.kicker || ('第 ' + data.id + ' 夜');
    document.getElementById('briefTitle').textContent = data.title || '';
    document.getElementById('briefQuote').textContent = data.quote || '';
    const list = document.getElementById('briefList');
    list.innerHTML = (data.bullets || []).map(b => '<li>' + b + '</li>').join('');
    document.getElementById('briefSign').textContent = data.sign || '长夜便利店 · 交接记录';
    D.hide(document.getElementById('title'));
  };
  UI.hideBriefing = function () { D.hide(document.getElementById('briefing')); };

  /* ---------------- night end ---------------- */
  UI.showNightEnd = function (data) {
    D.show(document.getElementById('nightEnd'));
    document.getElementById('neKicker').textContent = data.kicker || '04:00';
    document.getElementById('neTitle').textContent = data.title || '天亮了';
    document.getElementById('neStory').textContent = data.story || '';
    const stats = data.stats || [];
    document.getElementById('neStats').innerHTML = stats.map(s => '<div><b>' + s.value + '</b>' + s.label + '</div>').join('');
    document.getElementById('neGo').textContent = data.button || '继续';
  };
  UI.hideNightEnd = function () { D.hide(document.getElementById('nightEnd')); };

  /* ---------------- death ---------------- */
  UI.showDead = function (headline, sub) {
    D.hide(document.getElementById('hud'));
    D.hide(document.getElementById('dialogue'));
    D.show(document.getElementById('dead'));
    document.getElementById('deadGlitch').innerHTML = headline || '不要收钱。<br>不要转身。';
    document.getElementById('deadSub').textContent = sub || '';
    if (MS.Audio) MS.Audio.play('death');
  };
  UI.hideDead = function () { D.hide(document.getElementById('dead')); };

  /* ---------------- ending ---------------- */
  UI.showEnding = function (data) {
    D.show(document.getElementById('ending'));
    document.getElementById('endKicker').textContent = data.kicker || 'ENDING';
    document.getElementById('endTitle').textContent = data.title || '';
    document.getElementById('endText').textContent = data.text || '';
    document.getElementById('endStats').textContent = data.stats || '';
  };
  UI.hideEnding = function () { D.hide(document.getElementById('ending')); };

  /* ---------------- modals ---------------- */
  UI.showSettings = function () {
    D.show(document.getElementById('settings'));
    UI.applySettingsToUI();
    UI.updateFps();
  };
  UI.closeSettings = function () {
    D.hide(document.getElementById('settings'));
    if (MS.Storage.load().settings.quality !== MS.Game.quality) {
      UI.toast('画质已调整。');
    }
  };
  UI.showCredits = function () { D.show(document.getElementById('credits')); };
  UI.showNights = function () {
    D.show(document.getElementById('nights'));
    const d = MS.Storage.load();
    const list = document.getElementById('nightsList');
    const meta = (MS.Story && MS.Story.NIGHTS_META) || [];
    list.innerHTML = meta.map(n => {
      const locked = n.id > d.unlocked;
      const done = d.completed.indexOf(n.id) >= 0;
      return '<button class="night-row ' + (locked ? 'locked' : '') + ' ' + (done ? 'done' : '') + '" data-night="' + n.id + '">' +
        '<b>' + MS.M.pad(n.id) + '</b><div><div class="nr-name">' + n.title + '</div><div class="nr-sub">' + n.sub + '</div></div>' +
        '<span class="nr-tag">' + (locked ? '未解锁' : (done ? '已完成' : '可值班')) + '</span></button>';
    }).join('');
    D.$$('#nightsList .night-row').forEach(row => {
      if (row.classList.contains('locked')) return;
      row.addEventListener('click', () => {
        UI.hide(document.getElementById('nights'));
        UI.game.startNight(parseInt(row.getAttribute('data-night'), 10), { replay: true });
      });
    });
    document.getElementById('nightsStats').textContent = '完成 ' + d.completed.length + ' 夜 · 结局 ' + d.endings.length + '/3';
  };
  UI.showPause = function (on) {
    if (on) { D.show(document.getElementById('pause')); D.hide(document.getElementById('settings')); }
    else D.hide(document.getElementById('pause'));
  };

  UI.showMonitor = function (on) {
    const el = document.getElementById('cctv');
    if (!el) return;
    el.classList.toggle('hidden', !on);
    if (on) {
      const t = document.getElementById('cctvTime');
      if (t && MS.Game) t.textContent = MS.Game.clockString();
      if (MS.Audio) MS.Audio.play('radioStatic', 0.3);
    }
  };
  UI.updateFps = function () {
    const el = document.getElementById('setFps');
    if (!el) return;
    const fps = MS.Game && MS.Game.fps ? MS.Game.fps : 0;
    el.textContent = fps ? (fps + ' fps') : '——';
  };

  /* ---------------- fade / intro ---------------- */
  UI.fade = function (on) {
    const el = document.getElementById('fade');
    if (!el) return;
    el.classList.toggle('on', !!on);
  };
  UI.showIntro = function (text, cb) {
    const el = document.getElementById('intro');
    D.show(el);
    const t = document.getElementById('introText');
    t.textContent = text;
    if (MS.Audio) MS.Audio.speak(text, 'inner');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      D.hide(el);
      if (cb) cb();
    };
    const timer = setTimeout(finish, Math.max(5000, text.length * 95));
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); finish(); }
    };
    document.addEventListener('keydown', onKey);
  };

  UI.flash = function (opacity, ms) {
    const el = document.getElementById('fxFlash');
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = String(opacity);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity ' + (ms || 300) + 'ms ease';
      el.style.opacity = '0';
    });
  };

  UI.updateDialogueClock = function (str) {
    const el = document.getElementById('dlgClock');
    if (el) el.textContent = str;
  };

  MS.UI = UI;
})(window.MS);
