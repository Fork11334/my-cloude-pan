/* ==========================================================================
   档案部模板：六个版式 + 设施详情
   数据全部来自 site/data/archive.json，页面本身只负责结构；
   所有列表都在构建时渲染成 HTML，没有 JS 也能读。
   ========================================================================== */

import { esc, fmtDate, pad2 } from './html.mjs';

export const ARCHIVE_LAYOUTS = [
    'archive-home',
    'archive-globe',
    'archive-equipment',
    'archive-projects',
    'archive-papers',
    'archive-timeline',
    'archive-facility',
];

/* 档案部主页的六个入口：路由、标题、一句话、对应的数据键 */
const ENTRIES = [
    { route: '/archive/facilities/', title: '设施列表', desc: 'CAC 在地球上的六处据点：哨站、研究设施、后勤中心、综合基地与前台组织。', key: 'facilities', unit: '处' },
    { route: '/archive/equipment/', title: '装备列表', desc: '常规、特殊、异常三类在册装备，含定制器具的设计图。', key: 'equipment', unit: '类' },
    { route: '/archive/projects/', title: '异常收容物', desc: '在册异常的编号、收容等级与负责部门，可按时间、编号、级别重排。', key: 'projects', unit: '项' },
    { route: '/archive/papers/', title: '研究论文', desc: '解析部与共存部的公开产出，可按作者与专业检索。', key: 'papers', unit: '篇' },
    { route: '/archive/operations/', title: '行动记录', desc: '控制部的现场行动存档，按时间倒序。', key: 'operations', unit: '次' },
    { route: '/archive/evaluations/', title: '评估报告', desc: '共存部对异常的评估结论与风险分级。', key: 'evaluations', unit: '份' },
];

const countOf = (data, key) => {
    if (key === 'facilities') { return (data.facilities?.items || []).length; }
    if (key === 'equipment') { return (data.equipment?.categories || []).length; }
    const value = data[key];
    return Array.isArray(value) ? value.length : 0;
};

const shell = (page, inner, bodyClass) => `
<div class="arc ${bodyClass || ''}" data-archive-page="${page.layout.replace('archive-', '')}">
${inner}
</div>`;

const head = (page, kicker) => `
    <header class="arc-head">
        <p class="arc-kicker">${esc(kicker || '档案部')} · ARCHIVE</p>
        <h1 class="arc-title">${esc(page.title)}</h1>
        ${page.subtitle ? `<p class="arc-sub">${esc(page.subtitle)}</p>` : ''}
    </header>`;

/* ── 主页 ──────────────────────────────────────────────────────────────── */
function archiveHome({ page, body, data }) {
    const cards = ENTRIES.map((entry, i) => {
        const n = countOf(data, entry.key);
        return `
        <a class="arc-card" href="${entry.route}" data-arc-entry data-keywords="${esc(`${entry.title} ${entry.desc}`)}">
            <span class="arc-card__index" aria-hidden="true">${pad2(i + 1)}</span>
            <span class="arc-card__title">${esc(entry.title)}</span>
            <span class="arc-card__desc">${esc(entry.desc)}</span>
            <span class="arc-card__meta">${n} ${esc(entry.unit)}</span>
        </a>`;
    }).join('');

    return shell(page, `
    <canvas class="arc-canvas" data-bg="signal" aria-hidden="true"></canvas>
    <div class="arc-bg arc-bg--home" aria-hidden="true"><i class="arc-bg__grid"></i><i class="arc-bg__glow"></i></div>
${head(page, '档案部')}
    <form class="arc-search" data-arc-search role="search">
        <label class="arc-search__field">
            <span class="arc-search__icon" aria-hidden="true">⌕</span>
            <input type="search" name="q" placeholder="在本部门内检索：设施、装备、项目、论文、行动、评估…" data-arc-q autocomplete="off">
        </label>
        <button class="arc-btn" type="submit">检索</button>
    </form>
    <div class="arc-grid">${cards}
    </div>
    <p class="arc-empty" data-arc-empty hidden>没有匹配的条目。换个词试试。</p>
    <div class="arc-prose prose">${body}</div>
`);
}

/* ── 设施：粒子地球 + 左侧列表 ─────────────────────────────────────────── */
function archiveGlobe({ page, data }) {
    const fac = data.facilities || { types: {}, items: [] };
    const types = fac.types || {};
    const items = fac.items || [];

    const legend = Object.entries(types).map(([id, meta]) =>
        `<li class="fac-legend__item" data-type="${esc(id)}"><i style="--c:${esc(meta.color)}"></i>${esc(meta.label)}</li>`).join('');

    const rows = items.map((f, i) => {
        const type = types[f.type] || { label: f.type, color: '#8b949e' };
        return `
            <li class="fac-row" data-fac-row="${esc(f.slug)}">
                <button class="fac-row__pick" type="button" data-fac="${esc(f.slug)}"
                        data-lat="${esc(f.lat)}" data-lon="${esc(f.lon)}"
                        data-name="${esc(f.name)}" data-region="${esc(f.region)}"
                        data-summary="${esc(f.summary)}" data-color="${esc(type.color)}"
                        data-type-label="${esc(type.label)}"
                        data-href="/archive/facilities/${esc(f.slug)}/"
                        aria-describedby="fac-detail">
                    <span class="fac-row__index" aria-hidden="true">${pad2(i + 1)}</span>
                    <span class="fac-row__name">${esc(f.name)}</span>
                    <span class="fac-row__type" style="--c:${esc(type.color)}">${esc(type.label)}</span>
                    <span class="fac-row__region">${esc(f.region)}</span>
                </button>
                <a class="fac-row__go" href="/archive/facilities/${esc(f.slug)}/" aria-label="进入 ${esc(f.name)}">→</a>
            </li>`;
    }).join('');

    const first = items[0] || { name: '', summary: '', region: '', type: 'outpost' };

    return shell(page, `
    <div class="arc-bg arc-bg--veil" aria-hidden="true"></div>
    <div class="arc-stage" data-globe3d aria-hidden="true"></div>
    <canvas class="arc-canvas" data-morph="globe" data-center-x="0.68" aria-hidden="true"></canvas>
${head(page, '设施')}
    <div class="globe-layout">
        <div class="globe-side">
            <ol class="fac-list" data-fac-list>${rows}
            </ol>
            <aside class="fac-detail" id="fac-detail" data-fac-detail aria-live="polite">
                <p class="fac-detail__type" data-fac-type style="--c:${esc((types[first.type] || {}).color || '#8b949e')}">${esc((types[first.type] || {}).label || '')}</p>
                <h2 class="fac-detail__name" data-fac-name>${esc(first.name)}</h2>
                <p class="fac-detail__region" data-fac-region>${esc(first.region || '')}</p>
                <p class="fac-detail__sum" data-fac-summary>${esc(first.summary || '')}</p>
                <p class="fac-detail__coords" data-fac-coords></p>
                <a class="arc-btn" data-fac-link href="/archive/facilities/${esc(first.slug)}/">进入设施页面</a>
            </aside>
            <ul class="fac-legend" aria-label="设施类型">${legend}
            </ul>
        </div>
        <div class="globe-stage" aria-hidden="true">
            <p class="globe-stage__hint">拖动地球可以转；悬停左侧条目会转到对应坐标</p>
        </div>
    </div>
`);
}

/* ── 特殊装备的技术图（参考工程制图：线稿 + 编号引线 + 零件表）─────── */
const PARTS = {
    anchor: ['三角基座', '接地环', '立杆', '下稳定环', '上稳定环', '锥形发射极'],
    k96: ['外壳', '计时器', '拨杆', '保险环', '底面触点'],
    suit: ['头部密封罩', '颈环', '躯干外壳', '左臂', '右臂', '左腿', '右腿'],
};

const ART = {
    anchor: `
        <path d="M200 258 L158 292 M200 258 L242 292 M200 258 L200 292"/>
        <rect x="193" y="96" width="14" height="162"/>
        <ellipse cx="200" cy="168" rx="56" ry="15"/>
        <ellipse cx="200" cy="118" rx="44" ry="12"/>
        <path d="M186 96 L200 58 L214 96"/>`,
    k96: `
        <rect x="148" y="150" width="112" height="84" rx="7"/>
        <rect x="160" y="162" width="88" height="60"/>
        <ellipse cx="204" cy="150" rx="27" ry="9"/>
        <path d="M231 150 L231 118 L272 104"/>
        <circle cx="156" cy="172" r="11"/>
        <path d="M148 234 L260 234"/>`,
    suit: `
        <circle cx="200" cy="66" r="19"/>
        <path d="M182 84 Q200 96 218 84"/>
        <path d="M178 108 Q200 96 222 108 L230 178 Q200 194 170 178 Z"/>
        <path d="M178 112 L148 186 M222 112 L252 186"/>
        <path d="M186 186 L182 262 M214 186 L218 262"/>`,
};

/* 编号引线：[数字位置x, 数字位置y, 引到的x, 引到的y] */
const CALLS = {
    anchor: [[126, 122, 186, 118], [268, 180, 256, 168], [124, 214, 160, 244], [272, 92, 214, 96]],
    k96: [[118, 142, 160, 162], [256, 92, 231, 118], [110, 222, 148, 232], [262, 240, 260, 234]],
    suit: [[118, 66, 181, 66], [290, 122, 230, 140], [116, 200, 148, 186], [292, 244, 218, 262]],
};

function blueprint(item, index, total) {
    const shape = item.shape;
    const parts = PARTS[shape] || [];
    const calls = CALLS[shape] || [];

    const marks = calls.map((c, i) => `
                <g class="bp__call">
                    <line x1="${c[0]}" y1="${c[1]}" x2="${c[2]}" y2="${c[3]}"/>
                    <circle cx="${c[0]}" cy="${c[1]}" r="10"/>
                    <text x="${c[0]}" y="${c[1] + 3.6}">${i + 1}</text>
                </g>`).join('');

    const list = parts.map((p, i) => `<li><b>${pad2(i + 1)}</b><span>${esc(p)}</span></li>`).join('');

    return `
            <figure class="bp" data-bp="${esc(shape)}">
                <div class="bp__head">
                    <span class="bp__no">图 ${pad2(index + 1)} / ${pad2(total)}</span>
                    <span class="bp__scale">比例 1:20 · 侧视</span>
                </div>
                <svg class="bp__svg" viewBox="0 0 400 320" role="img" aria-label="${esc(item.name)} 技术图">
                    <g class="bp__grid">
                        <path d="M0 40 H400 M0 80 H400 M0 120 H400 M0 160 H400 M0 200 H400 M0 240 H400 M0 280 H400"/>
                        <path d="M40 0 V320 M80 0 V320 M120 0 V320 M160 0 V320 M200 0 V320 M240 0 V320 M280 0 V320 M320 0 V320 M360 0 V320"/>
                    </g>
                    <g class="bp__art">${ART[shape] || ''}</g>
                    <g class="bp__calls">${marks}
                    </g>
                    <path class="bp__dim" d="M132 300 H268 M132 294 V306 M268 294 V306"/>
                    <text class="bp__dimtext" x="200" y="314">200 mm</text>
                </svg>
                <figcaption class="bp__cap">
                    <h3 class="bp__name">${esc(item.name)}</h3>
                    <p class="bp__spec">${esc(item.spec)}</p>
                    <p class="bp__note">${esc(item.note)}</p>
                </figcaption>
                <ol class="bp__parts">${list}</ol>
            </figure>`;
}

function archiveEquipment({ page, data }) {
    const eq = data.equipment || {};
    const cats = eq.categories || [];
    const reg = eq.regular || {};
    const col = (title, list, shape) => `
            <section class="eq-col">
                <canvas class="eq-col__bg" data-shape-canvas="${esc(shape)}" aria-hidden="true"></canvas>
                <h3 class="eq-col__title">${esc(title)}</h3>
                <ul class="eq-list">${(list || []).map((item) => `
                    <li class="eq-item">
                        <p class="eq-item__name">${esc(item.name)}</p>
                        <p class="eq-item__spec">${esc(item.spec)}</p>
                        <p class="eq-item__note">${esc(item.note)}</p>
                    </li>`).join('')}
                </ul>
            </section>`;

    const tabs = cats.map((c, i) =>
        `<button class="eq-tab${i === 0 ? ' is-on' : ''}" type="button" role="tab" aria-selected="${i === 0}" data-eq-tab="${esc(c.id)}">${esc(c.label)}</button>`).join('');

    const designs = (eq.special || []).map((item, i) => `
        <article class="eq-design" data-eq-design="${esc(item.id)}" data-shape="${esc(item.shape)}">
            ${blueprint(item, i, (eq.special || []).length)}
        </article>`).join('');

    const anomalies = (eq.anomalous || []).map((item) => `
            <li class="eq-anomaly"><p class="eq-anomaly__name">${esc(item.name)}</p><p class="eq-anomaly__note">${esc(item.note)}</p></li>`).join('');

    return shell(page, `
    <canvas class="arc-canvas" data-morph="equipment" aria-hidden="true"></canvas>
    <div class="arc-bg arc-bg--veil" aria-hidden="true"></div>
${head(page, '装备')}
    <div class="eq-tabs" role="tablist" aria-label="装备分类">${tabs}
    </div>

    <section class="eq-panel is-on" data-eq-panel="regular" role="tabpanel">
        <p class="eq-lead">${esc((cats[0] || {}).desc || '')}</p>
        <div class="eq-cols">${col('武器列表', reg.firearms, 'gun')}${col('投掷物列表', reg.throwables, 'grenade')}${col('护具列表', reg.armor, 'armor')}
        </div>
    </section>

    <section class="eq-panel" data-eq-panel="special" role="tabpanel" hidden>
        <p class="eq-lead">${esc((cats[1] || {}).desc || '')}</p>
        <div class="eq-designs">${designs}
        </div>
        <p class="eq-hint">背景每 60 秒散开重组成下一张设计图；点任意一张可以立刻切过去。</p>
    </section>

    <section class="eq-panel" data-eq-panel="anomalous" role="tabpanel" hidden>
        <p class="eq-lead">${esc((cats[2] || {}).desc || '')}</p>
        <ul class="eq-anomalies">${anomalies}
        </ul>
    </section>
`);
}

/* ── 项目：可重排的列表 ────────────────────────────────────────────────── */
function archiveProjects({ page, data }) {
    const items = data.projects || [];

    const rows = items.map((p) => `
            <li class="proj" data-date="${esc(p.date)}" data-code="${esc(p.code)}" data-rank="${esc(p.levelRank)}">
                <p class="proj__meta">
                    <span class="proj__code">${esc(p.code)}</span>
                    <time datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time>
                    <span class="proj__level" data-level="${esc(p.levelRank)}">${esc(p.level)}</span>
                </p>
                <h2 class="proj__title">${esc(p.title)}</h2>
                <p class="proj__lead">${esc(p.lead)}</p>
                <p class="proj__sum">${esc(p.summary)}</p>
            </li>`).join('');

    return shell(page, `
    <canvas class="arc-canvas" data-bg="neural" aria-hidden="true"></canvas>
    <div class="arc-bg arc-bg--veil" aria-hidden="true"></div>
${head(page, '收容物')}
    <div class="sortbar" role="group" aria-label="列表排序">
        <span class="sortbar__label">排序</span>
        <button class="sortbar__btn is-on" type="button" data-sort="date" aria-pressed="true">按时间</button>
        <button class="sortbar__btn" type="button" data-sort="code" aria-pressed="false">按编号</button>
        <button class="sortbar__btn" type="button" data-sort="level" aria-pressed="false">按级别</button>
        <span class="sortbar__hint" data-sort-hint>神经思维网络</span>
    </div>
    <ol class="proj-list" data-proj-list>${rows}
    </ol>
`);
}

/* ── 论文：作者 / 专业检索 ─────────────────────────────────────────────── */
function archivePapers({ page, data }) {
    const items = data.papers || [];

    const rows = items.map((p) => `
            <li class="paper" data-author="${esc(p.author)}" data-field="${esc(p.field)}">
                <p class="paper__meta"><span class="paper__field">${esc(p.field)}</span><time>${esc(p.year)}</time><span class="paper__author">${esc(p.author)}</span></p>
                <h2 class="paper__title">${esc(p.title)}</h2>
                <p class="paper__sum">${esc(p.summary)}</p>
            </li>`).join('');

    const fields = [...new Set(items.map((p) => p.field))];

    return shell(page, `
    <canvas class="arc-canvas" data-bg="paper" aria-hidden="true"></canvas>
    <div class="arc-bg arc-bg--paper" aria-hidden="true"><i class="arc-bg__rule"></i><i class="arc-bg__glow"></i></div>
${head(page, '论文')}
    <form class="paper-search" data-paper-search role="search">
        <label class="paper-search__field">作者
            <input type="search" name="author" data-paper-author list="paper-authors" placeholder="例如 林澈" autocomplete="off">
        </label>
        <label class="paper-search__field">专业
            <input type="search" name="field" data-paper-field list="paper-fields" placeholder="例如 伦理学" autocomplete="off">
        </label>
        <button class="arc-btn" type="reset" data-paper-reset>清空</button>
        <datalist id="paper-authors">${[...new Set(items.map((p) => p.author))].map((a) => `<option value="${esc(a)}"></option>`).join('')}</datalist>
        <datalist id="paper-fields">${fields.map((f) => `<option value="${esc(f)}"></option>`).join('')}</datalist>
    </form>
    <ol class="paper-list" data-paper-list>${rows}
    </ol>
    <p class="arc-empty" data-paper-empty hidden>没有匹配的论文。</p>
`);
}

/* ── 行动记录 / 评估报告：时间轴 ───────────────────────────────────────── */
function archiveTimeline({ page, data }) {
    const kind = page.dataset === 'evaluations' ? 'evaluations' : 'operations';
    const items = (data[kind] || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const rows = items.map((item) => {
        const meta = kind === 'evaluations'
            ? `<span class="tl__risk" data-risk="${esc(item.risk)}">风险 ${esc(item.risk)}</span><span class="tl__status">${esc(item.status)}</span>`
            : `<span class="tl__unit">${esc(item.unit)}</span><span class="tl__result" data-result="${esc(item.result)}">${esc(item.result)}</span>`;
        return `
            <li class="tl__item">
                <time class="tl__date" datetime="${esc(item.date)}">${esc(fmtDate(item.date))}</time>
                <div class="tl__body">
                    <p class="tl__meta"><span class="tl__code">${esc(item.code)}</span>${meta}</p>
                    <h2 class="tl__title">${esc(kind === 'evaluations' ? item.subject : item.title)}</h2>
                    <p class="tl__sum">${esc(item.summary)}</p>
                </div>
            </li>`;
    }).join('');

    return shell(page, `
    <canvas class="arc-canvas" data-bg="${kind === 'evaluations' ? 'rings' : 'radar'}" aria-hidden="true"></canvas>
    <div class="arc-bg arc-bg--${esc(kind)}" aria-hidden="true"><i class="arc-bg__scan"></i></div>
${head(page, '共存评估')}
    <ol class="tl" data-timeline="${esc(kind)}">${rows}
    </ol>
`, `arc--${kind}`);
}

/* ── 设施详情 ──────────────────────────────────────────────────────────── */
function archiveFacility({ page, body, data }) {
    const f = page.facility || {};
    const types = data.facilities?.types || {};
    const type = types[f.type] || { label: f.type, color: '#8b949e' };
    const prose = body && body.trim()
        ? body
        : `<p>${esc(f.summary || '')}</p>
<p class="arc-note">该处的完整档案尚未归档，先留这段提要。</p>`;

    return shell(page, `
    <canvas class="arc-canvas arc-canvas--detail" data-morph="globe" data-lock-lat="${esc(f.lat)}" data-lock-lon="${esc(f.lon)}" aria-hidden="true"></canvas>
    <div class="arc-bg arc-bg--veil" aria-hidden="true"></div>
    <nav class="arc-crumbs" aria-label="位置"><a href="/archive/">档案部</a><span aria-hidden="true">/</span><a href="/archive/facilities/">设施</a><span aria-hidden="true">/</span><span aria-current="page">${esc(f.name || page.title)}</span></nav>
    <header class="arc-head">
        <p class="arc-kicker">${esc(type.label)} · FACILITY</p>
        <h1 class="arc-title">${esc(f.name || page.title)}</h1>
        <p class="arc-sub">${esc(f.region || '')}</p>
    </header>
    <dl class="fac-spec">
        <div><dt>类型</dt><dd style="--c:${esc(type.color)}">${esc(type.label)}</dd></div>
        <div><dt>坐标</dt><dd>${esc(f.lat)}° / ${esc(f.lon)}°</dd></div>
        <div><dt>编号</dt><dd>${esc(String(f.slug || '').toUpperCase())}</dd></div>
    </dl>
    <div class="arc-prose prose">${prose}</div>
`);
}

/* ── 入口 ──────────────────────────────────────────────────────────────── */
export function archiveMarkup(layout, ctx) {
    const { page, body, data } = ctx;
    switch (layout) {
        case 'archive-home': return archiveHome({ page, body, data });
        case 'archive-globe': return archiveGlobe({ page, data });
        case 'archive-equipment': return archiveEquipment({ page, data });
        case 'archive-projects': return archiveProjects({ page, data });
        case 'archive-papers': return archivePapers({ page, data });
        case 'archive-timeline': return archiveTimeline({ page, data });
        case 'archive-facility': return archiveFacility({ page, body, data });
        default: return '';
    }
}
