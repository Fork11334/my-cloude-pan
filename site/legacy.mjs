/* 旧站地址 → 新站地址
   两处用到：1) 渲染正文里的站内链接时自动改写 2) 构建时为旧地址生成跳转页

   站点精简之后，除主页面之外的页面都下架了，所以这里只保留指向主页面的入口；
   以前那些 /control/xxx、/forum/xxx 之类的映射随页面一起下架（原文件在
   _local/archive-content/，要恢复的话把内容搬回 site/content/ 再把这些映射加回来）。 */

export const legacyRedirects = {
    '/start': '/',
    '/home': '/',
    '/main': '/',
    '/index': '/',
    '/test': '/',
    '/new': '/',
    '/cac': '/',
    '/gate': '/verify/',
    '/login': '/verify/',
};
