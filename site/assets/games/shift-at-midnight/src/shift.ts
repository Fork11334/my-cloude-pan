/* ==========================================================================
   午夜轮班 · 模拟层（AssemblyScript → WebAssembly）

   这一层只算"班次"：时间推进、来客生成、动作判定、资源结算、结局评级。
   文案与画面全部在前端（js/text.js / js/art.js），所以这里一行中文都没有，
   也不做任何 DOM / 网络操作 —— 传进来的只有 dt 和一个动作号，传出去的只有整数状态。

   编译：npm run build:wasm
   ========================================================================== */

/* ── 阶段 ──────────────────────────────────────────────────────────────── */
const PH_READY: i32 = 7;   // 还没开始（JS 显示开场说明）
const PH_WAIT: i32 = 0;    // 空档，等下一位
const PH_ENTER: i32 = 1;   // 进门、走向柜台
const PH_SERVE: i32 = 2;   // 站在柜台前，等你决定
const PH_REACT: i32 = 3;   // 结算反馈
const PH_EXIT: i32 = 4;    // 离开
const PH_KNOCK: i32 = 5;   // 03:33 后门的敲门
const PH_OVER: i32 = 6;    // 结束

/* ── 来客类型 ──────────────────────────────────────────────────────────── */
const K_NONE: i32 = 0;
const K_NORMAL: i32 = 1;
const K_REGULAR: i32 = 2;
const K_DRUNK: i32 = 3;
const K_MINOR: i32 = 4;
const K_NOID: i32 = 5;
const K_SHADY: i32 = 6;
const K_SHADOW: i32 = 7;

/* ── 动作 ──────────────────────────────────────────────────────────────── */
const A_SELL: i32 = 1;     // 递货 / 收钱
const A_CHECK: i32 = 2;    // 查证件
const A_LIGHT: i32 = 3;    // 手电
const A_REFUSE: i32 = 4;   // 拒绝 / 请他走（敲门事件里是"别出声"）

const BATTERY_MAX: i32 = 8;
const SHIFT_MINUTES: f64 = 360.0;  // 00:00 → 06:00
const MINUTES_PER_SECOND: f64 = 1.2; // 五分钟班次，每小时 50 秒

/* ── 状态 ──────────────────────────────────────────────────────────────── */
let phase: i32 = PH_READY;
let ending: i32 = 0;        // 0 未结束 / 1 天亮 / 2 崩溃
let rank: i32 = 0;          // 1 S / 2 A / 3 B / 4 C
let clockMin: f64 = 0.0;
let money: i32 = 0;
let sanity: i32 = 100;
let battery: i32 = 5;

let kind: i32 = K_NONE;
let demand: i32 = 0;
let walk: f64 = 0.0;        // 0 = 门口 / 1 = 柜台前
let patience: f64 = 0.0;
let patienceMax: f64 = 15.0;
let checked: i32 = 0;

let waitT: f64 = 1.4;
let reactT: f64 = 0.0;
let knockT: f64 = 0.0;
let knockDone: i32 = 0;
let knockPending: i32 = 0;

let feedbackId: i32 = 0;
let feedbackT: f64 = 0.0;
let feedbackTone: i32 = 0;
let lastAct: i32 = 0;
let shake: f64 = 0.0;
let flashT: f64 = 0.0;

let served: i32 = 0;
let refused: i32 = 0;
let incidents: i32 = 0;
let total: i32 = 0;

let radio: i32 = 0;
let lastHour: i32 = 0;
let batteryMark: i32 = 0;
let elapsed: f64 = 0.0;
let drain: f64 = 0.0;

let seed: u32 = 2463534242;

/* ── 工具 ──────────────────────────────────────────────────────────────── */
function clampS(v: i32): i32 { return v < 0 ? 0 : (v > 100 ? 100 : v); }
function mini(a: i32, b: i32): i32 { return a < b ? a : b; }

function rnd(): f64 {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return <f64>(seed & 0x00FFFFFF) / 16777216.0;
}

function rndInt(n: i32): i32 {
    if (n <= 1) { return 0; }
    let v: i32 = <i32>(rnd() * <f64>n);
    if (v >= n) { v = n - 1; }
    if (v < 0) { v = 0; }
    return v;
}

function feed(id: i32, tone: i32): void {
    feedbackId = id;
    feedbackT = 2.6;
    feedbackTone = tone;
}

/* ── 来客 ──────────────────────────────────────────────────────────────── */
function pickDemand(k: i32): i32 {
    if (k == K_DRUNK) { return 1; }                       // 酒
    if (k == K_MINOR) { return rnd() < 0.45 ? 0 : 1; }    // 烟 / 酒
    if (k == K_NOID) { return rnd() < 0.6 ? 0 : 5; }      // 烟 / 打火机
    if (k == K_SHADY) { return 2 + rndInt(3); }           // 加油 / 问路 / 咖啡
    if (k == K_SHADOW) { return 3; }                      // 问路（它不问）
    if (k == K_REGULAR) { return rnd() < 0.5 ? 4 : 0; }   // 咖啡 / 烟
    return rndInt(6);
}

function spawn(): void {
    total += 1;
    const hour: f64 = clockMin / 60.0;
    const late: f64 = clockMin > 213.0 ? 1.0 : 0.0;
    const r: f64 = rnd();

    let acc: f64 = 0.03 + late * 0.13;                    // 影子
    if (r < acc) { kind = K_SHADOW; }
    else {
        acc += 0.09 + (hour < 5.0 ? hour * 0.015 : 0.075); // 可疑
        if (r < acc) { kind = K_SHADY; }
        else {
            acc += late > 0.0 ? 0.09 : 0.15;               // 醉汉
            if (r < acc) { kind = K_DRUNK; }
            else {
                acc += 0.12;                               // 未成年
                if (r < acc) { kind = K_MINOR; }
                else {
                    acc += 0.10;                           // 缺证
                    if (r < acc) { kind = K_NOID; }
                    else {
                        acc += 0.13;                       // 老顾客
                        kind = r < acc ? K_REGULAR : K_NORMAL;
                    }
                }
            }
        }
    }

    demand = pickDemand(kind);
    checked = 0;
    lastAct = 0;
    feedbackId = 0;
    feedbackT = 0.0;
    walk = 0.0;
    patienceMax = 15.0 - hour * 0.9;
    if (patienceMax < 10.0) { patienceMax = 10.0; }
    patience = patienceMax;
    phase = PH_ENTER;
}

function endCustomer(): void {
    reactT = 1.5;
    phase = PH_REACT;
}

/* ── 判定 ──────────────────────────────────────────────────────────────── */
function sell(): void {
    if (kind == K_NORMAL) {
        money += 40 + rndInt(16);
        served += 1;
        feed(101, 1);
    } else if (kind == K_REGULAR) {
        money += 60 + rndInt(25);
        served += 1;
        feed(102, 1);
    } else if (kind == K_DRUNK) {
        if (rnd() < 0.45) {
            sanity = clampS(sanity - 14);
            money -= 15;
            incidents += 1;
            shake = 1.0;
            feed(104, 2);
        } else {
            money += 45;
            served += 1;
            feed(103, 0);
        }
    } else if (kind == K_MINOR) {
        sanity = clampS(sanity - 16);
        money -= 25;
        incidents += 1;
        shake = 0.8;
        feed(105, 2);
    } else if (kind == K_NOID) {
        sanity = clampS(sanity - 8);
        incidents += 1;
        feed(106, 2);
    } else if (kind == K_SHADY) {
        if (rnd() < 0.5) {
            sanity = clampS(sanity - 18);
            money -= 20;
            incidents += 1;
            shake = 0.9;
            feed(109, 2);
        } else {
            money += 35;
            sanity = clampS(sanity - 5);
            served += 1;
            feed(107, 2);
        }
    } else if (kind == K_SHADOW) {
        sanity = clampS(sanity - 26);
        money -= 40;
        incidents += 1;
        shake = 1.0;
        feed(108, 2);
    }
    endCustomer();
}

function check(): void {
    if (checked == 1) {
        feed(309, 0);
        patience -= 0.6;
        return;
    }
    checked = 1;
    patience -= 1.4;
    if (kind == K_MINOR) { feed(302, 2); }
    else if (kind == K_NOID) { feed(303, 2); }
    else if (kind == K_SHADY) { feed(305, 2); }
    else if (kind == K_SHADOW) { feed(306, 2); sanity = clampS(sanity - 6); }
    else if (kind == K_REGULAR) { feed(307, 0); }
    else if (kind == K_DRUNK) { feed(308, 2); }
    else { feed(304, 0); }
}

function light(): void {
    if (battery <= 0) {
        feed(403, 2);
        return;
    }
    battery -= 1;
    flashT = 1.5;
    if (kind == K_SHADOW) {
        sanity = clampS(sanity + 3);
        refused += 1;
        feed(401, 1);
        endCustomer();
        return;
    }
    if (kind == K_SHADY) {
        sanity = clampS(sanity - 4);
        patience -= 1.0;
        feed(404, 0);
        return;
    }
    sanity = clampS(sanity - 6);
    refused += 1;
    feed(402, 2);
    endCustomer();
}

function refuse(): void {
    if (kind == K_SHADOW) {
        sanity = clampS(sanity - 5);
        patience -= 4.0;
        feed(204, 2);
        return;
    }
    refused += 1;
    if (kind == K_DRUNK) {
        sanity = clampS(sanity + 1);
        feed(205, 1);
    } else if (kind == K_NORMAL || kind == K_REGULAR) {
        sanity = clampS(sanity - 3);
        feed(201, 0);
    } else {
        sanity = clampS(sanity + 1);
        feed(203, 1);
    }
    endCustomer();
}

function timeout(): void {
    refused += 1;
    if (kind == K_SHADOW) {
        sanity = clampS(sanity - 8);
        feed(602, 2);
    } else {
        feed(601, 0);
    }
    endCustomer();
}

function finish(e: i32): void {
    if (phase == PH_OVER) { return; }
    phase = PH_OVER;
    ending = e;
    if (e == 2) { rank = 0; return; }
    if (money >= 800 && sanity >= 70) { rank = 1; }
    else if (money >= 600) { rank = 2; }
    else if (money >= 400) { rank = 3; }
    else { rank = 4; }
}

/* ── 导出接口 ──────────────────────────────────────────────────────────── */

/* 重置到"未开始"，参数是随机种子（同一 seed + 同一串动作 = 同一局） */
export function init(seedIn: i32): void {
    phase = PH_READY;
    ending = 0;
    rank = 0;
    clockMin = 0.0;
    money = 0;
    sanity = 100;
    battery = 5;
    kind = K_NONE;
    demand = 0;
    walk = 0.0;
    patience = 0.0;
    patienceMax = 15.0;
    checked = 0;
    waitT = 1.4;
    reactT = 0.0;
    knockT = 0.0;
    knockDone = 0;
    knockPending = 0;
    feedbackId = 0;
    feedbackT = 0.0;
    feedbackTone = 0;
    lastAct = 0;
    shake = 0.0;
    flashT = 0.0;
    served = 0;
    refused = 0;
    incidents = 0;
    total = 0;
    radio = 1;
    lastHour = 0;
    batteryMark = 0;
    elapsed = 0.0;
    drain = 0.0;
    seed = <u32>seedIn;
    if (seed == 0) { seed = 2463534242; }
}

/* 开始这一个班次 */
export function begin(): void {
    if (phase != PH_READY) { return; }
    phase = PH_WAIT;
    waitT = 1.8;
    radio = 1;
    lastHour = 0;
    feed(801, 0);
}

/* 推进 dt 秒 */
export function frame(dt: f64): void {
    if (dt > 0.2) { dt = 0.2; }
    if (dt < 0.0) { dt = 0.0; }
    elapsed += dt;
    shake -= dt * 2.4;
    if (shake < 0.0) { shake = 0.0; }
    flashT -= dt;
    if (flashT < 0.0) { flashT = 0.0; }
    if (feedbackT > 0.0) {
        feedbackT -= dt;
        if (feedbackT < 0.0) { feedbackT = 0.0; }
    }

    if (phase == PH_READY || phase == PH_OVER) { return; }

    clockMin += dt * MINUTES_PER_SECOND;
    if (clockMin > SHIFT_MINUTES) { clockMin = SHIFT_MINUTES; }

    /* 夜里待着本身就掉理智：慢，但一整班下来要掉十几个点。
       理智是整数，先攒够一点再扣，否则每帧都会被取整吃掉。 */
    if (phase != PH_KNOCK) {
        drain += dt * 0.06;
        if (drain >= 1.0) {
            const d: i32 = <i32>drain;
            sanity = clampS(sanity - d);
            drain -= <f64>d;
        }
    }

    const hour: i32 = <i32>(clockMin / 60.0);
    if (hour != lastHour) {
        lastHour = hour;
        radio = hour + 1;
    }

    if (batteryMark == 0 && clockMin >= 180.0) {
        batteryMark = 1;
        battery = mini(battery + 2, BATTERY_MAX);
    }
    if (batteryMark == 1 && clockMin >= 300.0) {
        batteryMark = 2;
        battery = mini(battery + 2, BATTERY_MAX);
    }
    if (knockDone == 0 && knockPending == 0 && clockMin >= 213.0) { knockPending = 1; }

    if (sanity <= 0) { finish(2); return; }
    if (clockMin >= SHIFT_MINUTES) { finish(1); return; }

    if (phase == PH_WAIT) {
        if (knockPending == 1) {
            knockPending = 0;
            knockT = 9.0;
            kind = K_NONE;
            phase = PH_KNOCK;
            feed(501, 2);
            return;
        }
        waitT -= dt;
        if (waitT <= 0.0) { spawn(); }
    } else if (phase == PH_ENTER) {
        walk += dt / 1.7;
        if (walk >= 1.0) {
            walk = 1.0;
            phase = PH_SERVE;
            patience = patienceMax;
        }
    } else if (phase == PH_SERVE) {
        patience -= dt;
        if (patience <= 0.0) {
            patience = 0.0;
            timeout();
        }
    } else if (phase == PH_REACT) {
        reactT -= dt;
        if (reactT <= 0.0) { phase = PH_EXIT; }
    } else if (phase == PH_EXIT) {
        walk -= dt / 1.4;
        if (walk <= 0.0) {
            walk = 0.0;
            kind = K_NONE;
            phase = PH_WAIT;
            waitT = 1.0 + rnd() * 1.8;
        }
    } else if (phase == PH_KNOCK) {
        knockT -= dt;
        if (knockT <= 0.0) {
            knockDone = 1;
            sanity = clampS(sanity - 8);
            feed(504, 2);
            phase = PH_WAIT;
            waitT = 1.4;
        }
    }
}

/* 玩家动作：1 递货 / 2 查证 / 3 手电 / 4 拒绝（敲门时 4 别出声、1 开门） */
export function act(a: i32): i32 {
    if (phase == PH_KNOCK) {
        if (a == A_SELL) {
            feed(503, 2);
            sanity = clampS(sanity - 30);
            shake = 1.0;
        } else if (a == A_REFUSE || a == A_LIGHT || a == A_CHECK) {
            feed(502, 1);
            sanity = clampS(sanity + 5);
        } else {
            return 0;
        }
        knockDone = 1;
        phase = PH_WAIT;
        waitT = 1.6;
        kind = K_NONE;
        return 1;
    }

    if (phase != PH_SERVE) { return 0; }

    lastAct = a;
    if (a == A_SELL) { sell(); return 1; }
    if (a == A_CHECK) { check(); return 1; }
    if (a == A_LIGHT) { light(); return 1; }
    if (a == A_REFUSE) { refuse(); return 1; }
    return 0;
}

/* 读一个状态字段（字段号见 js/state.js 的 S） */
export function state(i: i32): i32 {
    if (i == 0) { return phase; }
    if (i == 1) { return <i32>clockMin; }
    if (i == 2) { return money; }
    if (i == 3) { return sanity; }
    if (i == 4) { return battery; }
    if (i == 5) { return kind; }
    if (i == 6) { return demand; }
    if (i == 7) { return <i32>(walk * 1000.0); }
    if (i == 8) { return <i32>(patience * 100.0); }
    if (i == 9) { return checked; }
    if (i == 10) { return lastAct; }
    if (i == 11) { return feedbackId; }
    if (i == 12) { return <i32>(feedbackT * 100.0); }
    if (i == 13) { return feedbackTone; }
    if (i == 14) { return <i32>(shake * 100.0); }
    if (i == 15) { return served; }
    if (i == 16) { return refused; }
    if (i == 17) { return incidents; }
    if (i == 18) { return total; }
    if (i == 19) { return ending; }
    if (i == 20) { return rank; }
    if (i == 21) { return radio; }
    if (i == 22) { return knockDone; }
    if (i == 23) { return <i32>(flashT * 100.0); }
    if (i == 24) { return <i32>(clockMin / 60.0); }
    if (i == 25) { return <i32>(knockT * 100.0); }
    if (i == 26) { return <i32>(patienceMax * 100.0); }
    if (i == 27) { return <i32>(elapsed * 100.0) % 100000; }
    if (i == 28) { return knockPending; }
    return 0;
}

export function version(): i32 { return 3; }
