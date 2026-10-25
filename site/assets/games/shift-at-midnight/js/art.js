/* ==========================================================================
   画面：480×300 的逻辑坐标，2 倍画进 960×600 的画布。
   静态部分（墙、货架、柜台、门窗）只画一次，存进离屏画布；每帧只画动态的
   光线、雨、时钟、人物、手电。人物是纯手绘路径，没有贴图、没有外部资源。
   ========================================================================== */

export const W = 480;
export const H = 300;
export const SCALE = 2;

const KIND = { none: 0, normal: 1, regular: 2, drunk: 3, minor: 4, noid: 5, shady: 6, shadow: 7 };

const WINDOW = { x: 20, y: 58, w: 118, h: 112 };
const DOOR = { x: 352, y: 44, w: 100, h: 164 };
const FLOOR_Y = 214;
const COUNTER_TOP = 212;

const rgba = (r, g, b, a) => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

function rr(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

/* ── 静态层 ────────────────────────────────────────────────────────────── */
function paintStatic(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070b0e');
    bg.addColorStop(0.55, '#0a1317');
    bg.addColorStop(1, '#050809');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#080f13';
    ctx.fillRect(0, 0, W, 26);
    for (const x of [112, 288]) {
        ctx.fillStyle = rgba(120, 170, 180, 0.1);
        rr(ctx, x - 26, 6, 52, 6, 3);
        ctx.fill();
    }

    const wall = ctx.createLinearGradient(0, 26, 0, 208);
    wall.addColorStop(0, '#12222a');
    wall.addColorStop(0.6, '#0f1c22');
    wall.addColorStop(1, '#0b151a');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 26, W, 182);

    ctx.strokeStyle = rgba(120, 170, 180, 0.05);
    ctx.lineWidth = 1;
    for (let x = 12; x < W; x += 48) {
        ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x, 208); ctx.stroke();
    }
    ctx.strokeStyle = rgba(0, 0, 0, 0.35);
    ctx.beginPath(); ctx.moveTo(0, 207); ctx.lineTo(W, 207); ctx.stroke();

    const floor = ctx.createLinearGradient(0, 207, 0, COUNTER_TOP);
    floor.addColorStop(0, '#0d1619');
    floor.addColorStop(1, '#070c0e');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 207, W, COUNTER_TOP - 207);
    ctx.strokeStyle = rgba(120, 180, 180, 0.06);
    for (let i = 0; i < 9; i += 1) {
        const y = 208 + i * 1.6;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    paintWindow(ctx);
    paintDoor(ctx);
    paintShelves(ctx);
    paintCounter(ctx);
    paintRegister(ctx);
    paintProps(ctx);

    /* 挂钟底盘 */
    ctx.fillStyle = '#0e181c';
    ctx.beginPath(); ctx.arc(240, 44, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(150, 200, 200, 0.25);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(240, 44, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(150, 200, 200, 0.18);
    for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(240 + Math.cos(a) * 10.5, 44 + Math.sin(a) * 10.5);
        ctx.lineTo(240 + Math.cos(a) * 12, 44 + Math.sin(a) * 12);
        ctx.stroke();
    }

    /* 吊灯 */
    ctx.strokeStyle = rgba(160, 200, 200, 0.18);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(240, 0); ctx.lineTo(240, 30); ctx.stroke();
    ctx.fillStyle = '#101a1e';
    ctx.beginPath();
    ctx.moveTo(222, 40); ctx.lineTo(258, 40); ctx.lineTo(250, 30); ctx.lineTo(230, 30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(220, 240, 235, 0.5);
    rr(ctx, 230, 38, 20, 3, 1.5); ctx.fill();

    /* 柜台上的杂物 */
    ctx.fillStyle = '#1a262c';
    rr(ctx, 26, 214, 26, 12, 2); ctx.fill();
    ctx.fillStyle = '#0f1a1e';
    rr(ctx, 30, 211, 18, 4, 1); ctx.fill();
    ctx.fillStyle = '#243136';
    rr(ctx, 96, 216, 34, 8, 1); ctx.fill();
    ctx.strokeStyle = rgba(200, 220, 220, 0.12);
    ctx.strokeRect(96.5, 216.5, 33, 7);

    /* 铃铛 */
    ctx.fillStyle = '#3a3020';
    ctx.beginPath(); ctx.arc(70, 216, 5, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#584733';
    ctx.beginPath(); ctx.arc(70, 216, 5.4, Math.PI, 0); ctx.stroke();
}

function paintWindow(ctx) {
    const sky = ctx.createLinearGradient(0, WINDOW.y, 0, WINDOW.y + WINDOW.h);
    sky.addColorStop(0, '#0a1520');
    sky.addColorStop(0.55, '#0c1c26');
    sky.addColorStop(1, '#08131a');
    ctx.fillStyle = sky;
    ctx.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);

    ctx.fillStyle = '#0a1620';
    ctx.beginPath();
    ctx.moveTo(WINDOW.x, WINDOW.y + 82);
    ctx.quadraticCurveTo(WINDOW.x + 40, WINDOW.y + 68, WINDOW.x + 78, WINDOW.y + 84);
    ctx.quadraticCurveTo(WINDOW.x + 104, WINDOW.y + 94, WINDOW.x + WINDOW.w, WINDOW.y + 86);
    ctx.lineTo(WINDOW.x + WINDOW.w, WINDOW.y + WINDOW.h);
    ctx.lineTo(WINDOW.x, WINDOW.y + WINDOW.h);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#0b1a22';
    ctx.fillRect(WINDOW.x, WINDOW.y + 96, WINDOW.w, WINDOW.h - 96);

    /* 路灯 */
    const glow = ctx.createRadialGradient(WINDOW.x + 26, WINDOW.y + 52, 2, WINDOW.x + 26, WINDOW.y + 52, 54);
    glow.addColorStop(0, rgba(255, 214, 150, 0.42));
    glow.addColorStop(0.45, rgba(255, 196, 120, 0.12));
    glow.addColorStop(1, rgba(255, 196, 120, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    ctx.fillStyle = '#2a2a22';
    ctx.fillRect(WINDOW.x + 24, WINDOW.y + 22, 2, 74);
    ctx.fillStyle = rgba(255, 224, 168, 0.8);
    rr(ctx, WINDOW.x + 21, WINDOW.y + 19, 8, 4, 2); ctx.fill();

    /* 路边的车 */
    ctx.fillStyle = '#0d1b22';
    rr(ctx, WINDOW.x + 58, WINDOW.y + 88, 48, 14, 5); ctx.fill();
    rr(ctx, WINDOW.x + 66, WINDOW.y + 78, 26, 12, 4); ctx.fill();
    ctx.fillStyle = rgba(150, 190, 200, 0.1);
    rr(ctx, WINDOW.x + 70, WINDOW.y + 81, 18, 6, 2); ctx.fill();

    /* 窗框 */
    ctx.strokeStyle = '#16242a';
    ctx.lineWidth = 5;
    ctx.strokeRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(WINDOW.x + WINDOW.w / 2, WINDOW.y);
    ctx.lineTo(WINDOW.x + WINDOW.w / 2, WINDOW.y + WINDOW.h);
    ctx.moveTo(WINDOW.x, WINDOW.y + WINDOW.h * 0.55);
    ctx.lineTo(WINDOW.x + WINDOW.w, WINDOW.y + WINDOW.h * 0.55);
    ctx.stroke();

    /* 玻璃反光 */
    ctx.fillStyle = rgba(180, 230, 235, 0.035);
    ctx.beginPath();
    ctx.moveTo(WINDOW.x + 8, WINDOW.y + WINDOW.h);
    ctx.lineTo(WINDOW.x + 44, WINDOW.y);
    ctx.lineTo(WINDOW.x + 60, WINDOW.y);
    ctx.lineTo(WINDOW.x + 24, WINDOW.y + WINDOW.h);
    ctx.closePath(); ctx.fill();
}

function paintDoor(ctx) {
    ctx.fillStyle = '#061017';
    ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    ctx.fillStyle = '#081722';
    ctx.fillRect(DOOR.x + 4, DOOR.y + 4, DOOR.w - 8, DOOR.h - 8);

    ctx.strokeStyle = '#15232a';
    ctx.lineWidth = 6;
    ctx.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    ctx.strokeStyle = '#1c2d34';
    ctx.lineWidth = 3;
    ctx.strokeRect(DOOR.x + 8, DOOR.y + 8, DOOR.w - 16, DOOR.h - 16);

    ctx.fillStyle = '#405058';
    rr(ctx, DOOR.x + 10, DOOR.y + 88, DOOR.w - 20, 5, 2.5); ctx.fill();

    ctx.fillStyle = rgba(200, 90, 70, 0.55);
    rr(ctx, DOOR.x + 14, DOOR.y + 18, 30, 14, 2); ctx.fill();
    ctx.fillStyle = rgba(10, 16, 20, 0.75);
    ctx.font = 'bold 7px "Courier New", monospace';
    ctx.fillText('24H', DOOR.x + 19, DOOR.y + 28);

    ctx.fillStyle = '#26343a';
    rr(ctx, DOOR.x + DOOR.w - 26, DOOR.y + 12, 12, 6, 2); ctx.fill();
}

function paintShelves(ctx) {
    const x0 = 152;
    const x1 = 338;
    const rows = [62, 104, 146];
    const bottom = 196;

    ctx.fillStyle = '#0b1418';
    ctx.fillRect(x0 - 4, rows[0] - 8, (x1 - x0) + 8, (bottom - rows[0]) + 12);
    ctx.fillStyle = rgba(120, 190, 190, 0.08);
    ctx.fillRect(x0, rows[0], x1 - x0, bottom - rows[0]);

    const colors = ['#546c78', '#7a5750', '#3f6d70', '#7a7057', '#55607a', '#7a5f48', '#457071'];
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    for (const y of rows) {
        let x = x0 + 4;
        while (x < x1 - 8) {
            const w = 6 + Math.floor(rand() * 7);
            const h = 12 + Math.floor(rand() * 9);
            const c = colors[Math.floor(rand() * colors.length)];
            ctx.fillStyle = c;
            rr(ctx, x, y + 22 - h, w, h, 1.5);
            ctx.fill();
            ctx.fillStyle = rgba(225, 250, 245, 0.22);
            ctx.fillRect(x + 1, y + 23 - h, Math.max(1, w - 3), 1.5);
            ctx.fillStyle = rgba(0, 0, 0, 0.18);
            ctx.fillRect(x + 1, y + 20, Math.max(1, w - 2), 2);
            x += w + 3 + Math.floor(rand() * 4);
        }
        ctx.fillStyle = '#16232a';
        ctx.fillRect(x0 - 4, y + 22, (x1 - x0) + 8, 4);
        ctx.fillStyle = rgba(200, 230, 230, 0.1);
        ctx.fillRect(x0 - 4, y + 22, (x1 - x0) + 8, 1);
    }

    ctx.fillStyle = '#142026';
    ctx.fillRect(x0 - 6, rows[0] - 10, 5, (bottom - rows[0]) + 16);
    ctx.fillRect(x1 + 1, rows[0] - 10, 5, (bottom - rows[0]) + 16);

    ctx.fillStyle = rgba(220, 230, 220, 0.14);
    for (const y of rows) { ctx.fillRect(x0 + 8, y + 14, 18, 3); }
}

function paintCounter(ctx) {
    const top = ctx.createLinearGradient(0, COUNTER_TOP, 0, COUNTER_TOP + 20);
    top.addColorStop(0, '#1d2b32');
    top.addColorStop(1, '#101a1f');
    ctx.fillStyle = top;
    ctx.fillRect(0, COUNTER_TOP, W, 20);
    ctx.fillStyle = rgba(150, 220, 220, 0.18);
    ctx.fillRect(0, COUNTER_TOP, W, 1.4);

    ctx.fillStyle = '#0b1216';
    ctx.fillRect(0, COUNTER_TOP + 20, W, H - COUNTER_TOP - 20);
    ctx.strokeStyle = rgba(120, 180, 180, 0.08);
    ctx.lineWidth = 1;
    for (const x of [120, 240, 360]) {
        ctx.beginPath(); ctx.moveTo(x, COUNTER_TOP + 22); ctx.lineTo(x, H); ctx.stroke();
    }
    /* 灯从台面溢出的一点暖光 */
    const spill = ctx.createRadialGradient(240, COUNTER_TOP + 6, 10, 240, COUNTER_TOP + 6, 250);
    spill.addColorStop(0, rgba(200, 232, 220, 0.1));
    spill.addColorStop(1, rgba(200, 232, 220, 0));
    ctx.fillStyle = spill;
    ctx.fillRect(0, COUNTER_TOP + 4, W, 60);

    const shade = ctx.createLinearGradient(0, COUNTER_TOP + 20, 0, H);
    shade.addColorStop(0, rgba(0, 0, 0, 0));
    shade.addColorStop(1, rgba(0, 0, 0, 0.62));
    ctx.fillStyle = shade;
    ctx.fillRect(0, COUNTER_TOP + 20, W, H - COUNTER_TOP - 20);

    /* 台面下沿的一道反光，把柜台从地板里分出来 */
    ctx.fillStyle = rgba(150, 220, 220, 0.07);
    ctx.fillRect(0, COUNTER_TOP + 21, W, 2);
}

function paintRegister(ctx) {
    const x = 352;
    const y = 224;
    ctx.fillStyle = '#131d22';
    rr(ctx, x, y, 96, 76, 4); ctx.fill();
    ctx.fillStyle = '#18262c';
    rr(ctx, x + 6, y + 6, 84, 30, 3); ctx.fill();
    ctx.fillStyle = rgba(120, 255, 190, 0.06);
    rr(ctx, x + 10, y + 10, 76, 22, 2); ctx.fill();

    for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 6; c += 1) {
            ctx.fillStyle = rgba(140, 190, 190, 0.16);
            rr(ctx, x + 10 + c * 13, y + 42 + r * 8, 9, 5, 1.4);
            ctx.fill();
        }
    }

    ctx.fillStyle = '#0a1114';
    rr(ctx, x + 20, y + 34, 56, 3, 1.5); ctx.fill();
}

/* 柜台上的东西：纸杯、交接单、小票。全是前景，压在最下面一条。 */
function paintProps(ctx) {
    /* 纸杯 */
    ctx.fillStyle = '#2a3a40';
    ctx.beginPath();
    ctx.moveTo(118, 196);
    ctx.lineTo(134, 196);
    ctx.lineTo(131, 212);
    ctx.lineTo(121, 212);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(220, 235, 230, 0.16);
    ctx.fillRect(119.5, 197, 13, 2);

    /* 交接单 */
    ctx.save();
    ctx.translate(196, 202);
    ctx.rotate(-0.06);
    ctx.fillStyle = rgba(226, 232, 220, 0.86);
    ctx.fillRect(0, 0, 54, 16);
    ctx.strokeStyle = rgba(0, 0, 0, 0.25);
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(4, i * 4);
        ctx.lineTo(i === 3 ? 30 : 48, i * 4);
        ctx.stroke();
    }
    ctx.fillStyle = '#7c8b8e';
    ctx.fillRect(46, -1, 7, 3);
    ctx.restore();

    /* 小票 */
    ctx.fillStyle = rgba(226, 232, 220, 0.7);
    ctx.fillRect(320, 206, 18, 8);
    ctx.fillStyle = rgba(0, 0, 0, 0.2);
    ctx.fillRect(322, 208, 14, 1);
    ctx.fillRect(322, 211, 10, 1);
}

/* ── 动态层 ────────────────────────────────────────────────────────────── */
export function createArt() {
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    paintStatic(layer.getContext('2d'));

    function draw(ctx, s, time) {
        ctx.save();
        ctx.drawImage(layer, 0, 0);

        const flick = 0.82 + Math.sin(time * 6.3) * 0.05 + (Math.sin(time * 21.7) > 0.94 ? -0.35 : 0);
        const sane = Math.max(0, Math.min(100, s.sanity)) / 100;

        drawLamp(ctx, Math.max(0.15, flick) * (0.55 + sane * 0.45));
        drawRain(ctx, WINDOW, time, 22);
        drawRain(ctx, { x: DOOR.x + 8, y: DOOR.y + 8, w: DOOR.w - 16, h: DOOR.h - 16 }, time, 14);
        drawClock(ctx, s.clock);
        drawNeon(ctx, time);
        drawRegisterText(ctx, s.money, time);

        if (s.kind !== KIND.none && s.walk > 0 && s.phase !== 5) {
            /* 顾客站在柜台后面：以台面为界裁一刀，脚和"渗出来的东西"不会压到台面上 */
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W, COUNTER_TOP + 1);
            ctx.clip();
            drawPerson(ctx, s, time);
            ctx.restore();
        }

        if (s.flash > 0) { drawFlash(ctx, s); }
        if (s.phase === 5) { drawKnock(ctx, time); }
        drawVignette(ctx, sane, time);
        ctx.restore();
    }

    return { draw };
}

function drawLamp(ctx, power) {
    const g = ctx.createRadialGradient(240, 46, 6, 240, 52, 210);
    const a = 0.14 + power * 0.2;
    g.addColorStop(0, rgba(214, 238, 230, a.toFixed(3)));
    g.addColorStop(0.45, rgba(190, 225, 215, (a * 0.35).toFixed(3)));
    g.addColorStop(1, rgba(190, 225, 215, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 26, W, 200);

    ctx.beginPath();
    ctx.moveTo(226, 42);
    ctx.lineTo(254, 42);
    ctx.lineTo(340, 212);
    ctx.lineTo(140, 212);
    ctx.closePath();
    const cone = ctx.createLinearGradient(0, 42, 0, 212);
    cone.addColorStop(0, rgba(220, 240, 235, (0.05 + power * 0.05).toFixed(3)));
    cone.addColorStop(1, rgba(220, 240, 235, 0));
    ctx.fillStyle = cone;
    ctx.fill();
}

function drawRain(ctx, rect, time, count) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = rgba(150, 195, 220, 0.16);
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i += 1) {
        const seed = i * 131;
        const x = rect.x - 6 + ((seed * 7) % (rect.w + 12));
        const span = rect.h + 24;
        const y = rect.y - 12 + (((seed * 29 + time * 300) % span));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2.2, y + 8);
        ctx.stroke();
    }
    ctx.restore();
}

function drawClock(ctx, minutes) {
    const total = minutes % 720;
    const minuteA = ((total % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    const hourA = (((total / 60) % 12) / 12) * Math.PI * 2 - Math.PI / 2;

    ctx.strokeStyle = rgba(220, 240, 235, 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(240, 44); ctx.lineTo(240 + Math.cos(hourA) * 6.4, 44 + Math.sin(hourA) * 6.4); ctx.stroke();
    ctx.strokeStyle = rgba(220, 240, 235, 0.8);
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(240, 44); ctx.lineTo(240 + Math.cos(minuteA) * 9.6, 44 + Math.sin(minuteA) * 9.6); ctx.stroke();
    ctx.fillStyle = rgba(240, 255, 250, 0.8);
    ctx.beginPath(); ctx.arc(240, 44, 1.4, 0, Math.PI * 2); ctx.fill();
}

function drawNeon(ctx, time) {
    const on = Math.sin(time * 3.3) > 0.08 && Math.sin(time * 11.7) > -0.85;
    ctx.save();
    ctx.shadowColor = rgba(255, 90, 70, 0.75);
    ctx.shadowBlur = on ? 12 : 2;
    ctx.fillStyle = rgba(255, 120, 96, on ? 0.85 : 0.12);
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText('OPEN', DOOR.x + 14, DOOR.y - 6);
    ctx.restore();
}

function drawRegisterText(ctx, money, time) {
    const text = (money < 0 ? '-' : '') + '¥' + Math.abs(money);
    ctx.save();
    ctx.fillStyle = rgba(130, 245, 190, 0.72);
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(text, 424, 246);
    ctx.textAlign = 'left';
    const blink = Math.sin(time * 4) > -0.2 ? 1 : 0.2;
    ctx.fillStyle = rgba(130, 245, 190, 0.5 * blink);
    ctx.fillRect(364, 238, 4, 4);
    ctx.restore();
}

/* ── 人 ────────────────────────────────────────────────────────────────── */
function easeWalk(v) {
    const t = Math.max(0, Math.min(1, v));
    return t * t * (3 - 2 * t);
}

function drawPerson(ctx, s, time) {
    const kind = s.kind;
    const t = easeWalk(s.walk / 1000);
    const x = 402 + (266 - 402) * t;
    const alpha = Math.min(1, (s.walk / 1000) * 2.2);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = rgba(0, 0, 0, 0.45);
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 1, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (kind === KIND.shadow) { drawShadowBeing(ctx, x, time); ctx.restore(); return; }

    const scale = kind === KIND.minor ? 0.95 : 1.12;
    const sway = kind === KIND.drunk ? Math.sin(time * 1.6) * 2.2 : Math.sin(time * 1.1) * 0.6;
    const lean = kind === KIND.drunk ? Math.sin(time * 1.3) * 0.05 : 0;

    ctx.translate(x + sway, FLOOR_Y);
    ctx.rotate(lean);
    ctx.scale(scale, scale);
    ctx.translate(-x, -FLOOR_Y);

    const bodyTop = 148;
    const bodyBottom = FLOOR_Y + 2;
    const shoulder = kind === KIND.regular ? 18 : 15;

    const body = new Path2D();
    body.moveTo(x - shoulder, bodyTop + 6);
    body.quadraticCurveTo(x - shoulder - 1, 176, x - 14, 198);
    body.quadraticCurveTo(x - 12, bodyBottom - 2, x - 11, bodyBottom);
    body.lineTo(x + 11, bodyBottom);
    body.quadraticCurveTo(x + 12, bodyBottom - 2, x + 14, 198);
    body.quadraticCurveTo(x + shoulder + 1, 176, x + shoulder, bodyTop + 6);
    body.quadraticCurveTo(x, bodyTop - 9, x - shoulder, bodyTop + 6);
    body.closePath();

    /* 两条胳膊：不画出来会像一块招牌 */
    ctx.fillStyle = kind === KIND.shady ? '#080d10' : '#151f24';
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * (shoulder - 3), bodyTop + 8);
        ctx.quadraticCurveTo(x + side * (shoulder + 3), 172, x + side * (shoulder - 1), 191);
        ctx.lineTo(x + side * (shoulder - 8), 191);
        ctx.quadraticCurveTo(x + side * (shoulder - 6), 172, x + side * (shoulder - 8), bodyTop + 10);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = kind === KIND.shady ? '#0c1317' : (kind === KIND.drunk ? '#2b3a41' : '#28363d');
    ctx.fill(body);

    /* 顶光：吊灯在头顶，肩膀最亮 */
    const topLight = ctx.createLinearGradient(0, bodyTop - 10, 0, 200);
    topLight.addColorStop(0, rgba(220, 245, 238, 0.16));
    topLight.addColorStop(1, rgba(0, 0, 0, 0.1));
    ctx.fillStyle = topLight;
    ctx.fill(body);

    /* 衣领与腰带：两笔就能让人从柱子变回人 */
    ctx.strokeStyle = rgba(0, 0, 0, 0.35);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 5, bodyTop + 2);
    ctx.lineTo(x, bodyTop + 9);
    ctx.lineTo(x + 5, bodyTop + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 11, 193);
    ctx.lineTo(x + 11, 193);
    ctx.stroke();

    /* 侧光：左边冷、右边更暗，人物立刻有体积 */
    const shade = ctx.createLinearGradient(x - shoulder - 2, 0, x + shoulder + 2, 0);
    shade.addColorStop(0, rgba(130, 225, 210, 0.14));
    shade.addColorStop(0.42, rgba(0, 0, 0, 0));
    shade.addColorStop(1, rgba(0, 0, 0, 0.32));
    ctx.fillStyle = shade;
    ctx.fill(body);

    ctx.strokeStyle = rgba(0, 0, 0, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, bodyTop + 2);
    ctx.lineTo(x, bodyBottom);
    ctx.stroke();

    if (kind === KIND.regular) {
        ctx.fillStyle = rgba(200, 220, 220, 0.16);
        rr(ctx, x - 9, bodyTop + 16, 18, 4, 1); ctx.fill();
    }
    if (kind === KIND.noid) {
        ctx.strokeStyle = rgba(180, 200, 200, 0.2);
        ctx.beginPath();
        ctx.moveTo(x - 11, bodyTop + 8);
        ctx.lineTo(x - 8, bodyBottom - 6);
        ctx.moveTo(x + 11, bodyTop + 8);
        ctx.lineTo(x + 8, bodyBottom - 6);
        ctx.stroke();
    }

    ctx.strokeStyle = rgba(150, 240, 225, 0.42);
    ctx.lineWidth = 1.4;
    ctx.stroke(body);

    const headY = bodyTop - 15 + (kind === KIND.drunk ? Math.sin(time * 1.9) * 1.2 : 0);
    const headR = 11.5;
    ctx.fillStyle = '#0d1518';
    ctx.fillRect(x - 4, headY + 8, 8, 9);
    ctx.fillStyle = rgba(0, 0, 0, 0.45);
    ctx.beginPath();
    ctx.ellipse(x, headY + headR - 1, headR * 0.9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kind === KIND.shady ? '#070c0e' : '#111b1f';
    ctx.beginPath(); ctx.arc(x, headY, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(130, 225, 210, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, headY, headR, 0, Math.PI * 2); ctx.stroke();

    if (kind === KIND.shady) {
        const hood = new Path2D();
        hood.moveTo(x - 16, bodyTop + 6);
        hood.quadraticCurveTo(x - 18, headY - 20, x, headY - 19);
        hood.quadraticCurveTo(x + 18, headY - 20, x + 16, bodyTop + 6);
        hood.quadraticCurveTo(x, bodyTop - 4, x - 16, bodyTop + 6);
        hood.closePath();
        ctx.fillStyle = '#0a1114';
        ctx.fill(hood);
        ctx.strokeStyle = rgba(120, 200, 190, 0.14);
        ctx.stroke(hood);
        ctx.fillStyle = rgba(0, 0, 0, 0.75);
        ctx.beginPath();
        ctx.ellipse(x, headY + 1, headR - 1, headR - 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(210, 230, 225, 0.3);
        ctx.fillRect(x - 5, headY - 1, 3, 1.6);
        ctx.fillRect(x + 2, headY - 1, 3, 1.6);
    }

    if (kind === KIND.regular) {
        ctx.fillStyle = '#1d2a30';
        ctx.beginPath();
        ctx.arc(x, headY - 2, headR - 0.5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#243238';
        rr(ctx, x - headR - 1, headY - 3, headR * 2 + 2, 2.6, 1.2); ctx.fill();
    }

    if (kind === KIND.minor) {
        ctx.strokeStyle = rgba(150, 190, 190, 0.2);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, bodyTop + 2, 11, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
    }

    if (kind !== KIND.shady) {
        ctx.fillStyle = rgba(210, 235, 230, 0.22);
        ctx.fillRect(x - 5, headY - 2, 3, 1.4);
        ctx.fillRect(x + 2, headY - 2, 3, 1.4);
    }

    ctx.restore();
}

function drawShadowBeing(ctx, x, time) {
    const top = 104;
    const bottom = FLOOR_Y + 4;

    const aura = ctx.createRadialGradient(x, 160, 8, x, 160, 62);
    aura.addColorStop(0, rgba(0, 0, 0, 0.65));
    aura.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(x - 70, 90, 140, 140);

    ctx.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        const rx = 17 + Math.sin(a * 3 + time * 3.1) * 2.6;
        const ry = 48 + Math.sin(a * 4 + time * 2.3) * 3.4;
        const px = x + Math.cos(a) * rx;
        const py = 156 + Math.sin(a) * ry;
        if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
    }
    ctx.closePath();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.strokeStyle = rgba(120, 90, 180, 0.22);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, top + 18, 13 + Math.sin(time * 2.7) * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.strokeStyle = rgba(120, 90, 180, 0.18);
    ctx.stroke();

    const blink = (Math.sin(time * 1.7) > 0.85) ? 0.15 : 1;
    ctx.save();
    ctx.shadowColor = rgba(255, 60, 50, 0.9);
    ctx.shadowBlur = 8;
    ctx.fillStyle = rgba(255, 70, 55, 0.85 * blink);
    ctx.fillRect(x - 7, top + 16, 4, 1.8);
    ctx.fillRect(x + 3, top + 16, 4, 1.8);
    ctx.restore();

    ctx.strokeStyle = rgba(0, 0, 0, 0.75);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
        const dx = -14 + i * 9;
        const len = 6 + Math.abs(Math.sin(time * 1.4 + i)) * 9;
        ctx.beginPath();
        ctx.moveTo(x + dx, bottom);
        ctx.lineTo(x + dx, bottom + len);
        ctx.stroke();
    }
}

/* ── 特效 ──────────────────────────────────────────────────────────────── */
function drawFlash(ctx, s) {
    const a = Math.min(1, s.flash / 120);
    ctx.save();
    const g = ctx.createLinearGradient(20, 280, 280, 150);
    g.addColorStop(0, rgba(235, 255, 250, 0.16 * a));
    g.addColorStop(1, rgba(235, 255, 250, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(16, 300);
    ctx.lineTo(96, 300);
    ctx.lineTo(320, 118);
    ctx.lineTo(228, 92);
    ctx.closePath();
    ctx.fill();

    const spot = ctx.createRadialGradient(300, 150, 4, 300, 150, 90);
    spot.addColorStop(0, rgba(255, 255, 255, 0.22 * a));
    spot.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.fillStyle = spot;
    ctx.fillRect(180, 40, 240, 240);
    ctx.restore();
}

function drawKnock(ctx, time) {
    ctx.save();
    ctx.fillStyle = rgba(0, 0, 0, 0.52);
    ctx.fillRect(0, 0, W, H);

    const pulse = 0.35 + Math.sin(time * 5) * 0.18;
    const g = ctx.createRadialGradient(W, H, 20, W, H, 220);
    g.addColorStop(0, rgba(190, 40, 30, pulse.toFixed(2)));
    g.addColorStop(1, rgba(120, 20, 15, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}

function drawVignette(ctx, sane, time) {
    const g = ctx.createRadialGradient(240, 150, 100, 240, 150, 300);
    g.addColorStop(0, rgba(0, 0, 0, 0));
    g.addColorStop(1, rgba(0, 0, 0, 0.62));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const fear = 1 - sane;
    if (fear > 0.02) {
        const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
        const r = ctx.createRadialGradient(240, 150, 120, 240, 150, 290);
        r.addColorStop(0, rgba(120, 10, 10, 0));
        r.addColorStop(1, rgba(150, 20, 16, fear * 0.45 * (0.7 + pulse * 0.3)));
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, W, H);
    }
}
