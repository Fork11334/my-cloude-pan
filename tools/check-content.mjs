/* ==========================================================================
   内容自检：扫一遍 site/content，找出不该出现在正文里的编辑提示词，
   以及 front-matter 里缺字段的页面。
   用法：node tools/check-content.mjs      （有问题的项会让进程以 1 退出，便于接 CI）
   ========================================================================== */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(root, 'site', 'content');

/* 这些词只应该出现在迁移脚本里，不该出现在正文 */
const FORBIDDEN = ['旧站', '待补充', '待建立', '占位', '尚未建立', 'TODO', 'FIXME', '占位符'];
const REQUIRED = ['title'];

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { return walk(full); }
        return name.endsWith('.md') ? [full] : [];
    });
}

const files = walk(CONTENT).sort();
const problems = [];

for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, '/');
    const text = readFileSync(file, 'utf8');

    const matter = text.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!matter) {
        problems.push(`${rel}：缺少 front-matter`);
    } else {
        for (const key of REQUIRED) {
            if (!new RegExp(`^${key}:\\s*\\S`, 'm').test(matter[1])) {
                problems.push(`${rel}：front-matter 缺少 ${key}`);
            }
        }
    }

    text.split('\n').forEach((line, i) => {
        for (const word of FORBIDDEN) {
            if (line.includes(word)) {
                problems.push(`${rel}:${i + 1} 出现「${word}」→ ${line.trim().slice(0, 48)}`);
            }
        }
    });
}

console.log(`内容自检：${files.length} 个 Markdown 文件`);
if (problems.length) {
    console.log(`\n发现 ${problems.length} 处问题：`);
    for (const p of problems) { console.log('  ✗ ' + p); }
    process.exit(1);
}
console.log('未发现编辑提示词残留，front-matter 字段齐全 ✓');
