/* ==========================================================================
   状态字段号：与 src/shift.ts 的 state(i) 一一对应。
   改一处必须改另一处 —— test/game.test.mjs 会检查字段数是否对得上。
   ========================================================================== */

export const S = {
    phase: 0,
    clock: 1,
    money: 2,
    sanity: 3,
    battery: 4,
    kind: 5,
    demand: 6,
    walk: 7,
    patience: 8,
    checked: 9,
    lastAct: 10,
    feedback: 11,
    feedbackT: 12,
    tone: 13,
    shake: 14,
    served: 15,
    refused: 16,
    incidents: 17,
    total: 18,
    ending: 19,
    rank: 20,
    radio: 21,
    knockDone: 22,
    flash: 23,
    hour: 24,
    knockT: 25,
    patienceMax: 26,
    elapsed: 27,
    knockPending: 28,
};

export const PHASE = {
    ready: 7,
    wait: 0,
    enter: 1,
    serve: 2,
    react: 3,
    exit: 4,
    knock: 5,
    over: 6,
};

export const KIND = {
    none: 0, normal: 1, regular: 2, drunk: 3, minor: 4, noid: 5, shady: 6, shadow: 7,
};

export function readState(api) {
    const s = {};
    for (const [name, index] of Object.entries(S)) { s[name] = api.state(index); }
    return s;
}
