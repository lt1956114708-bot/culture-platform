/* ============================================================
   模拟数据层
   ------------------------------------------------------------
   为什么要有这个文件？
   页面要显示预警列表、统计图表，但真实数据在后端/数据库里。
   在把数据接口做完之前，先用「写死的假数据」把页面跑通 ——
   这是很实用的开发策略：先打通「能显示」，再换成真数据。

   导出方式：window.APP_DATA = { ... }
   这样 app.js 里用 window.APP_DATA.alerts 就能直接取到。

   ★ 结构和师兄的 data.js 是一致的：所有数据挂在一个全局对象上，
     页面渲染函数从这里取数，而不是把数据散落在各处。
   ============================================================ */

(function () {
  "use strict";

  /* ------------------------------------------------------------
     1. 风险领域（5 大类）
     ------------------------------------------------------------
     对齐师兄平台的体系：5 个领域，每个领域下有若干具体类别。
     环形图的每一段、筛选器的每个选项，都从这份数据生成。

     ★ 注意这里没有写死 value（数量）。
       数量在文件底部由 computeDomainCounts() 从 alerts 列表里算出来 ——
       否则总览页会出现「KPI 说 60 条、环形图说 8452 条」这种自相矛盾。
       原则：能推导的数据就不要手写，写死的数字迟早会和源头对不上。
     ------------------------------------------------------------ */
  var RISK_DOMAINS = [
    {
      key: "political",
      label: "政治安全风险",
      color: "#e5484d",
      categories: ["政治制度攻击", "历史虚无", "破坏民族团结", "破坏宗教政策"],
    },
    {
      key: "social",
      label: "社会安全风险",
      color: "#f76b15",
      categories: ["违法违规", "暴力恐怖", "宣扬极端"],
    },
    {
      key: "ethics",
      label: "道德风化风险",
      color: "#f5b400",
      categories: ["丑化内容", "低俗内容", "色情淫秽"],
    },
    {
      key: "minor",
      label: "未成年人保护",
      color: "#8e4ec6",
      categories: ["危害未成年人", "诱导消费", "不良行为示范"],
    },
    {
      key: "culture",
      label: "文化信息风险",
      color: "#0d74ce",
      categories: ["歪曲历史", "错误价值导向", "文化亵渎"],
    },
  ];

  /* ------------------------------------------------------------
     2. 内容平台
     ------------------------------------------------------------ */
  var PLATFORMS = [
    { key: "douyin", label: "抖音" },
    { key: "kuaishou", label: "快手" },
    { key: "weibo", label: "微博" },
    { key: "rednote", label: "小红书" },
    { key: "wechat", label: "微信" },
  ];

  /* ------------------------------------------------------------
     3. 风险等级 / 处置状态
     ------------------------------------------------------------
     这两个是「枚举」——只有固定的几种取值。
     定义成数组而不是散落的字符串，好处是：
       · 筛选器的选项直接从数组生成，不会漏
       · 颜色、文字统一在这里维护
     ------------------------------------------------------------ */
  var LEVELS = [
    { key: "high", label: "高危", color: "#e5484d" },
    { key: "medium", label: "中危", color: "#f5b400" },
    { key: "low", label: "低危", color: "#0d74ce" },
  ];

  var STATUSES = [
    { key: "pending", label: "待处置", color: "#e5484d" },
    { key: "reviewing", label: "人工审核中", color: "#f5b400" },
    { key: "approved", label: "已处置", color: "#12a594" },
    { key: "rejected", label: "已驳回", color: "#8b8d98" },
  ];

  /* ------------------------------------------------------------
     4. 预警样本：手写十几条有真实感的，再用它们生成一批
     ------------------------------------------------------------
     为什么要「生成」而不是手写 60 条？
     手写 60 条会让这个文件变得又长又重复，改起来还容易漏。
     用少量真样本 + 循环扩展，代码短、好维护、也更好看懂。
     （师兄是手写的，因为他的数据要和研判样例一一对应）
     ------------------------------------------------------------ */
  var SAMPLE_TITLES = [
    { title: "Same Evil 海报", domain: "political", level: "high" },
    { title: "脱口秀字幕截图", domain: "political", level: "high" },
    { title: "《权力野兽朱元璋》封面", domain: "culture", level: "medium" },
    { title: "科普绘本内页插图", domain: "minor", level: "medium" },
    { title: "街头整蛊短视频", domain: "ethics", level: "low" },
    { title: "历史人物戏说短剧", domain: "culture", level: "medium" },
    { title: "恶搞军旅口号段子", domain: "political", level: "high" },
    { title: "未成年人主播打赏诱导", domain: "minor", level: "high" },
    { title: "低俗擦边直播切片", domain: "ethics", level: "medium" },
    { title: "境外账号历史虚无长图", domain: "political", level: "high" },
    { title: "暴力游戏实况剪辑", domain: "social", level: "medium" },
    { title: "迷信占卜带货视频", domain: "social", level: "low" },
    { title: "民族服饰恶意调侃视频", domain: "political", level: "high" },
    { title: "恐怖游戏直播录屏", domain: "minor", level: "medium" },
    { title: "名人肖像丑化表情包", domain: "ethics", level: "medium" },
  ];

  var AUTHORS = [
    "长风观察", "历史冷知识局", "娱乐扒姐", "梗图制造机", "深夜放映厅",
    "考据小分队", "民间故事汇", "热榜搬运工", "生活观察员", "影像档案室",
  ];

  /* 把「领域 key」映射成「该领域下的某个类别」，用于生成 category 字段 */
  var CATEGORY_POOL = {
    political: ["政治制度攻击", "历史虚无", "破坏民族团结", "破坏宗教政策"],
    social: ["违法违规", "暴力恐怖", "宣扬极端"],
    ethics: ["丑化内容", "低俗内容", "色情淫秽"],
    minor: ["危害未成年人", "诱导消费", "不良行为示范"],
    culture: ["歪曲历史", "错误价值导向", "文化亵渎"],
  };

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /* 用确定性规则生成预警列表（不用随机数，保证每次刷新数据一致） */
  function buildAlerts() {
    var list = [];
    var total = 60;

    for (var i = 0; i < total; i++) {
      var sample = SAMPLE_TITLES[i % SAMPLE_TITLES.length];
      var cats = CATEGORY_POOL[sample.domain];

      // 时间：从 2026-10-11 往前推，每条间隔几小时
      var hoursAgo = i * 3;
      var d = new Date(2026, 9, 11, 12, 0, 0); // 月份从 0 开始，9 = 10 月
      d.setHours(d.getHours() - hoursAgo);

      // 状态按固定节奏轮换，保证四种状态都有样本
      var statusKeys = ["pending", "reviewing", "approved", "rejected"];
      var status = statusKeys[i % 4];

      list.push({
        id: "AL261011-" + pad(100000 + i * 37),
        title: sample.title + (i >= SAMPLE_TITLES.length ? "（第 " + (Math.floor(i / SAMPLE_TITLES.length) + 1) + "批）" : ""),
        domain: sample.domain,
        category: cats[i % cats.length],
        level: sample.level,
        status: status,
        platform: PLATFORMS[i % PLATFORMS.length].key,
        author: AUTHORS[i % AUTHORS.length],
        time: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
              " " + pad(d.getHours()) + ":" + pad(d.getMinutes()),
        summary: "系统通过多模态识别与语义分析，判定该内容在「" +
                 cats[i % cats.length] + "」维度上存在失范风险，已自动生成预警。",
      });
    }
    return list;
  }

  var ALERTS = buildAlerts();

  /* ------------------------------------------------------------
     5. 趋势数据（最近 12 天）
     ------------------------------------------------------------ */
  var TREND = [];
  var trendBase = [5, 8, 6, 11, 9, 13, 15, 10, 12, 16, 14, 18];
  for (var t = 0; t < trendBase.length; t++) {
    TREND.push({
      day: "10-" + pad(t + 1),
      value: trendBase[t],
    });
  }

  /* ------------------------------------------------------------
     6. 关键词（用于词云，weight 决定字号大小）
     ------------------------------------------------------------ */
  var KEYWORDS = [
    { word: "历史虚无", weight: 96 },
    { word: "低俗擦边", weight: 84 },
    { word: "AI 换脸", weight: 78 },
    { word: "诱导打赏", weight: 72 },
    { word: "丑化人物", weight: 68 },
    { word: "标题党", weight: 61 },
    { word: "暴力血腥", weight: 55 },
    { word: "封建迷信", weight: 49 },
    { word: "错误导向", weight: 44 },
    { word: "擦边营销", weight: 38 },
    { word: "戏说历史", weight: 34 },
    { word: "未成年人", weight: 30 },
  ];

  /* ------------------------------------------------------------
     7. 研判样例（研判中心的样例库）
     ------------------------------------------------------------ */
  var ANALYSIS_SAMPLES = [
    { id: "s01", title: "Same Evil 海报", text: "Same Evil", verdict: ["涉政敏感", "丑化内容"], level: "high" },
    { id: "s02", title: "脱口秀字幕截图", text: "作风优良，能打胜仗", verdict: ["涉政敏感"], level: "high" },
    { id: "s03", title: "《权力野兽朱元璋》封面", text: "权力野兽", verdict: ["历史虚无", "丑化内容"], level: "medium" },
    { id: "s04", title: "科普绘本内页", text: "图鉴内页", verdict: ["无失范"], level: "low" },
  ];

  /* ------------------------------------------------------------
     8. 研判中心的四阶段流程定义
     ------------------------------------------------------------
     把它定义成数据而不是写死在渲染函数里，
     是因为阶段名称、顺序、说明将来都可能调整 —— 改数据即可。
     ------------------------------------------------------------ */
  var ANALYSIS_PHASES = [
    { key: "match", label: "专家匹配", desc: "从领域专家库中择优选出 3 位", weight: 15 },
    { key: "statement", label: "独立陈述", desc: "三位专家各自给出独立判断", weight: 35 },
    { key: "cross", label: "交叉回应", desc: "专家之间就分歧点互相回应", weight: 30 },
    { key: "verdict", label: "综合研判", desc: "主智能体汇总并给出最终定性", weight: 20 },
  ];

  /* 研判中心里展示的专家（写死 3 位，够演示用） */
  var EXPERTS = [
    { name: "政治学专家", tag: "政治" },
    { name: "语言学与符号学专家", tag: "语言" },
    { name: "艺术史与视觉文化专家", tag: "艺术" },
  ];

  /* ------------------------------------------------------------
     9. 从预警列表推导出各领域的数量
     ------------------------------------------------------------
     为什么要算而不是手写？
     因为手写就会出现「KPI 卡片说 60 条、环形图说 8452 条」这种矛盾 ——
     我第一版就犯了这个错。凡是能从别处推导的数据，就不要手写。
     ------------------------------------------------------------ */
  function computeDomainCounts() {
    var counts = {};
    RISK_DOMAINS.forEach(function (d) { counts[d.key] = 0; });

    ALERTS.forEach(function (a) {
      if (counts[a.domain] !== undefined) counts[a.domain]++;
    });

    RISK_DOMAINS.forEach(function (d) { d.value = counts[d.key]; });
  }
  computeDomainCounts();

  /* ------------------------------------------------------------
     10. 统一导出
     ------------------------------------------------------------ */
  window.APP_DATA = {
    riskDomains: RISK_DOMAINS,
    platforms: PLATFORMS,
    levels: LEVELS,
    statuses: STATUSES,
    alerts: ALERTS,
    trend: TREND,
    keywords: KEYWORDS,
    analysisSamples: ANALYSIS_SAMPLES,
    analysisPhases: ANALYSIS_PHASES,
    experts: EXPERTS,

    /* 顶部 KPI：直接从预警列表算出来，避免手写数字和列表对不上 */
    getSummary: function () {
      var total = window.APP_DATA.alerts.length;
      var pending = 0, high = 0;
      for (var i = 0; i < total; i++) {
        if (window.APP_DATA.alerts[i].status === "pending") pending++;
        if (window.APP_DATA.alerts[i].level === "high") high++;
      }
      return { total: total, pending: pending, high: high, handled: total - pending };
    },

    /* 按 key 取中文名的工具函数，渲染时到处都用得上 */
    labelOf: function (list, key) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === key) return list[i].label;
      }
      return key;
    },
    itemOf: function (list, key) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === key) return list[i];
      }
      return null;
    },
  };
})();
