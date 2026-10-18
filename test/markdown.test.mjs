/* ==========================================================================
   Markdown 渲染器的行为契约
   只测"外部可观察的行为"：标题下推、站内链接改写、容器、转义。
   不测内部实现（函数名、正则、字符串拼接方式），这样渲染器可以随便重构。
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderMarkdown } from '../site/lib/markdown.mjs';

const render = (src, options = {}) => renderMarkdown(src, options);

test('标题按一层下推，并生成可锚定的目录', () => {
    const { html, toc } = render('# 甲\n\n## 乙');

    assert.match(html, /<h2 id="h-1">甲/);
    assert.match(html, /<h3 id="h-2">乙/);
    assert.deepEqual(toc.map((t) => t.level), [2, 3]);
    assert.deepEqual(toc.map((t) => t.text), ['甲', '乙']);
});

test('站内绝对路径补结尾斜杠，并加上部署前缀', () => {
    const { html } = render('[x](/about)', { base: '/repo' });
    assert.match(html, /href="\/repo\/about\/"/);
});

test('带扩展名的站内资源不补斜杠', () => {
    const { html } = render('[x](/a/b.png)', { base: '/repo' });
    assert.match(html, /href="\/repo\/a\/b\.png"/);
});

test('旧地址映射会改写链接目标', () => {
    const { html } = render('[x](/old/)', { base: '', linkMap: { '/old/': '/new/' } });
    assert.match(html, /href="\/new\/"/);
});

test('外链保持原样，只补 target 与 rel', () => {
    const { html } = render('[x](https://example.com/a)', { base: '/repo' });
    assert.match(html, /href="https:\/\/example\.com\/a"/);
    assert.doesNotMatch(html, /\/repo\/https/);
});

test('::: 容器渲染成对应的类名与标题', () => {
    const { html } = render('::: note title="注意"\n正文\n:::');
    assert.match(html, /<aside class="callout callout--note">/);
    assert.match(html, /class="callout__title">注意</);
});

test('正文里的 HTML 被转义，不能执行', () => {
    const { html } = render('正文 <script>alert(1)</script> 结束');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
});

test('代码块内的尖括号逃逸，且语言类名保留', () => {
    const { html } = render("```js\nconst a = '<div>';\n```");
    assert.match(html, /<code class="language-js">/);
    assert.match(html, /&lt;div&gt;/);
});
