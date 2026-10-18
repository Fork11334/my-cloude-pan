/* ==========================================================================
   测试用的构建助手：在进程内跑一次 site/build.mjs，产物写进系统临时目录。
   为什么不用子进程：受限沙箱下用管道捕获子进程输出会被拒（EPERM）。
   ========================================================================== */

import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BUILD = new URL('../site/build.mjs', import.meta.url).href;
const ENV_KEYS = ['CAC_OUT', 'CAC_BASE', 'CAC_SITE_URL', 'CAC_NO_GATE'];

let run = 0;

export async function buildToTemp(env = {}) {
    const out = mkdtempSync(join(tmpdir(), 'cac-build-'));
    const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) { delete process.env[k]; }
    process.env.CAC_OUT = out;
    for (const [k, v] of Object.entries(env)) { process.env[k] = v; }

    const log = console.log;
    try {
        console.log = () => {};
        await import(`${BUILD}?run=${++run}`);
    } finally {
        console.log = log;
        for (const k of ENV_KEYS) {
            if (saved[k] === undefined) { delete process.env[k]; } else { process.env[k] = saved[k]; }
        }
    }
    return out;
}

export const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
});

export const read = (out, rel) => readFileSync(join(out, rel), 'utf8');
