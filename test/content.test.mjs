/* ==========================================================================
   内容层的单元测试：front-matter 解析、路径 → 网址、正文抽文本。
   这些函数现在不依赖文件系统（除 loadPages），可以拿字符串直接测。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { parseFrontMatter, routeOf, textOf } from '../site/lib/content.mjs';

test('front-matter 解析出字符串、引号、布尔与数字', () => {
    const { data, body } = parseFrontMatter(
        '---\ntitle: 甲\nauthor: "Fersolution"\nquote: \'单引号\'\norder: 5\nlocked: true\nnoindex: false\n---\n正文',
    );

    assert.deepEqual(data, {
        title: '甲',
        author: 'Fersolution',
        quote: '单引号',
        order: 5,
        locked: true,
        noindex: false,
    });
    assert.equal(body, '正文');
});

test('没有 front-matter 时整篇都是正文', () => {
    const { data, body } = parseFrontMatter('就是一段正文');
    assert.deepEqual(data, {});
    assert.equal(body, '就是一段正文');
});

test('嵌套行被忽略，不会把数组塞进 data', () => {
    const { data } = parseFrontMatter('---\ntitle: 甲\n  - 子项\n---\n');
    assert.deepEqual(data, { title: '甲' });
});

test('index.md 是目录首页，其余每个文件一个目录', () => {
    const dir = join('C:', 'site', 'content');

    assert.equal(routeOf(dir, join(dir, 'index.md')), '/');
    assert.equal(routeOf(dir, join(dir, '404.md')), '/404/');
    assert.equal(routeOf(dir, join(dir, 'control', 'cac-project-042.md')), '/control/cac-project-042/');
    assert.equal(routeOf(dir, join(dir, 'control', 'index.md')), '/control/');
});

test('抽文本会去掉标签、脚本与多余空白', () => {
    const text = textOf('<h2>标题</h2><script>var a=1</script><p>正文 &amp; 结尾</p>');
    assert.equal(text, '标题 正文 结尾');
});
