/* ==========================================================================
   模板层共用的最小工具：转义、部署前缀、日期格式。
   单独成文件是为了让 layout.mjs 与 layout-archive.mjs 用同一份实现
   （各自复制一份迟早会分叉）。
   ========================================================================== */

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[c]));

/* 站内绝对路径统一加上部署前缀 */
export const u = (site, path) => (path && path.startsWith('/') ? `${site.base || ''}${path}` : path);

/* 2026-09-21 → 2026.09.21；不是日期就原样返回 */
export const fmtDate = (value) => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : String(value || '');
};

/* 列表里的编号：1 → 01 */
export const pad2 = (n) => String(n).padStart(2, '0');
