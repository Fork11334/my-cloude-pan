/* ==========================================================================
   本地开发服务器（零依赖）
   用法：node site/serve.mjs [端口]     默认 http://127.0.0.1:4173
   行为：目录地址自动找 index.html，找不到就给 404.html，禁用缓存方便刷新。
   ========================================================================== */

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { site } from './site.config.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/* 默认服务 dist/；CAC_SERVE_DIR 可以指向别的产物目录（比如免门禁的预览副本） */
const root = process.env.CAC_SERVE_DIR
    ? join(here, '..', process.env.CAC_SERVE_DIR)
    : join(here, '..', 'dist');
const port = Number(process.argv[2] || 4173);
/* 构建时如果加了 base 前缀（GitHub Pages 项目站点），本地也照同样路径访问 */
const base = String(process.env.CAC_BASE ?? site.base ?? '').replace(/\/+$/, '');

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(root)) {
    console.error('还没有构建产物，先运行：node site/build.mjs');
    process.exit(1);
}

const server = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('..')) { res.writeHead(400).end('Bad request'); return; }
    if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
        pathname = pathname.slice(base.length) || '/';
    }

    let file = join(root, normalize(pathname));
    if (existsSync(file) && statSync(file).isDirectory()) { file = join(file, 'index.html'); }
    if (!existsSync(file) && existsSync(`${file}.html`)) { file = `${file}.html`; }

    if (!existsSync(file)) {
        const fallback = join(root, '404.html');
        const body = existsSync(fallback) ? readFileSync(fallback) : Buffer.from('404');
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(body);
        console.log(`404  ${pathname}`);
        return;
    }

    res.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
    }).end(readFileSync(file));
    console.log(`200  ${pathname}`);
});

server.listen(port, '127.0.0.1', () => {
    console.log(`CAC 本地站点： http://127.0.0.1:${port}${base}/`);
    console.log('（Ctrl+C 停止）');
});
