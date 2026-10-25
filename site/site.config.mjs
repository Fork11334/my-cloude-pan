/* 站点全局配置：改这里就能改站名、导航、配色开关、门禁开关 */

export const site = {
    name: 'CAC 议会',
    mark: 'C·A·C',
    tagline: '控制 · 解析 · 共存',
    description: 'CAC 议会内部资料库：控制、解析、共存三个部门与内部论坛。本站为虚构创作。',
    lang: 'zh-CN',
    /* 部署位置：
       · 用户站点（仓库名是 <用户名>.github.io）→ 留空 ''
       · 项目站点（仓库名是别的）→ 写 '/仓库名'，例如 '/cac-wiki'
       GitHub Actions 会用环境变量 CAC_BASE 自动填好，一般不用手改。 */
    base: '',
    /* 完整部署地址前缀（域名 + base），例如：
         https://fork11334.github.io/caccontect    （项目站点）
         https://你的域名                            （自定义域名）
       留空则不生成 sitemap.xml 与 canonical。
       GitHub Actions 会用环境变量 CAC_SITE_URL 自动填好。 */
    baseUrl: '',

    /* 顶栏右侧头像里的快捷跳转。站点现在只有两页，所以只留真实存在的去处；
       action: 'search' 的条目会打开检索浮层而不是跳转。 */
    menu: [
        { label: '主界面', href: '/' },
        { label: '档案部', href: '/archive/' },
        { label: '论坛', href: '/forum/' },
        { label: '访问校验', href: '/verify/' },
        { label: '站内检索', action: 'search' },
    ],

    /* 底栏文字入口：只是普通链接，不做卡片 */
    footerLinks: [
        { label: '更多服务', href: '/archive/' },
        { label: '声明准则', href: '/#about' },
        { label: '关于我们', href: '/#about' },
    ],

    /* 页脚滚动字符条：只保留三个理念 */
    ticker: [
        { cn: '控制', en: 'CONTROL' },
        { cn: '解析', en: 'ANALYZE' },
        { cn: '共存', en: 'COEXIST' },
    ],

    /* 首屏数据条（大号数字 + 小号标签，编辑式排版） */
    stats: [
        { value: '45', label: '个页面' },
        { value: '17', label: '条控制部档案' },
        { value: '8', label: '篇论坛存档' },
        { value: '3', label: '个部门' },
    ],

    /* 首页「部门」轮播：一次显示一个，含理念与数据成果 */
    departments: [
        {
            label: '控制部', href: '/control/', accent: 'control',
            motto: '先控住，再谈别的。',
            desc: '压制并归档异常项目，留下行动记录与武装力量编制。控制部先到场，之后才谈得上秩序。',
            stats: [
                { value: '17', label: '在册条目' },
                { value: '6', label: '项目档案' },
                { value: '4', label: '支武装编制' },
            ],
        },
        {
            label: '解析部', href: '/analyze/', accent: 'analyze',
            motto: '把现象变成可以复述的话。',
            desc: '拆开现象、找出可以重复的部分，产出研究报告与技术草案。解析部不判断价值，只负责让结论经得起复述。',
            stats: [
                { value: '2', label: '在册条目' },
                { value: '1', label: '份研究报告' },
                { value: '3', label: '次现象复现' },
            ],
        },
        {
            label: '共存部', href: '/coexist/', accent: 'coexist',
            motto: '划一条双方都承受得起的线。',
            desc: '为可沟通的异常建立社会化规程，出具伦理与风险评估。共存部处理最难的那部分：不是消灭，而是相处。',
            stats: [
                { value: '2', label: '在册条目' },
                { value: '1', label: '例在册个案' },
                { value: '6', label: '个月规程谈判' },
            ],
        },
    ],

    /* 首页论坛板块的封面图（按顺序分配给热门话题） */
    forumCovers: [
        '/assets/img/forum-signal.jpg',
        '/assets/img/forum-orbital.jpg',
        '/assets/img/forum-deepfield.jpg',
        '/assets/img/forum-earthview.jpg',
    ],

    /* 侧栏分区标题（由内容的 section 字段决定归属） */
    sections: {
        control: { title: '控制部', accent: 'control', subtitle: '秩序维稳 · 授权人员专用' },
        forum: { title: '论坛', accent: 'analyze', subtitle: '内部频道 · 只读存档' },
        archive: { title: '其他存档', accent: 'coexist', subtitle: '彩蛋页与转载内容' },
        user: { title: '成员档案', accent: 'analyze', subtitle: '议会成员与撰稿人' },
        analyze: { title: '解析部', accent: 'analyze', subtitle: '探究异常本质 · 技术转化' },
        coexist: { title: '共存部', accent: 'coexist', subtitle: '平衡 · 伦理 · 跨物种沟通' },
    },

    /* 配色：cac = 三色（控制蓝/解析紫/共存绿，来自你 3.txt 草稿），
             legacy = 旧站线上那套红黑（#a00/#e66/#b33 + #1e1e1e 卡片）。
       页脚有切换开关，选择记在 localStorage。 */
    appearance: {
        defaultTheme: 'legacy',
        toggle: true,
        themes: { legacy: '旧站红黑', cac: '三色' },
    },

    /* 访问校验：进站前先过 /verify/，可以选访客或本机账号。
       这不是安全措施——静态站点的内容对拿到地址的人都可见，它只是门槛与氛围。 */
    gating: {
        enabled: true,
        store: 'cac-pass',
        route: '/verify/',
        /* 除校验页之外的所有页面都要先通过校验 */
        guardAll: true,
        /* 访客身份存在 sessionStorage，关掉标签页就失效；账号存在 localStorage，长期有效 */
        guestStore: 'cac-pass',
        accountStore: 'cac-session',
    },

    footer: {
        note: '本站为虚构创作，与任何现实机构、事件或人物无关。',
        migrated: '本站在 2026 年由 Wikidot 版本迁移重建，旧站 biwu-cac-cn.wikidot.com 已停止更新。',
    },
};
