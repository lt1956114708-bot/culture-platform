/* ============================================================
   文化产品价值失范综合预警平台 —— 前端主逻辑
   ------------------------------------------------------------
   这个文件的结构，和师兄的 app.js 是**同一套组织方式**：

     ① 工具函数        escapeHtml / pad / 时间格式化
     ② 状态 state      所有页面状态集中放在一个对象里
     ③ 路由 parseRoute 解析 #/xxx?key=value
     ④ 渲染 renderXxx  每个页面一个函数，返回 HTML 字符串
     ⑤ 分发 render()   根据路由决定调用哪个 renderXxx
     ⑥ 事件委托        所有点击统一在 document 上处理

   看懂了这个文件，就基本能看懂师兄那 2859 行的骨架。
   ============================================================ */

(function () {
  "use strict";

  var DATA = window.APP_DATA;

  /* ============================================================
     ① 工具函数
     ============================================================ */

  /* ★ 安全第一：所有要拼进 HTML 的动态内容都必须过这一层。
     否则数据里一旦出现 <script> 之类的字符，浏览器会把它当代码执行（XSS 攻击）。
     师兄的代码里也有一个同名的 escapeHtml，做的是同一件事。 */
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function nowText() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function itemOf(list, key) {
    return DATA.itemOf(list, key) || { label: key, color: "#8b8d98" };
  }

  /* ============================================================
     ② 状态
     ------------------------------------------------------------
     所有会变的东西都放在这里：渲染函数只读它，事件处理只改它。
     这是「单向数据流」的朴素版本 —— 改状态，然后重新渲染。
     ============================================================ */

  var DEFAULT_FILTERS = {
    search: "",
    platform: "all",
    level: "all",
    status: "all",
    sort: "newest",
    page: 1,
  };

  var state = {
    menuOpen: false,
    sidebarCollapsed: false,
    filters: Object.assign({}, DEFAULT_FILTERS),
    pageSize: 8,

    /* 研判中心的状态机：idle（未开始）→ running（研判中）→ done（已完成） */
    analysis: {
      status: "idle",
      sampleId: null,
      progress: 0,
      phaseIndex: 0,
      logs: [],
      result: null,
      timer: null,
    },
  };

  /* ============================================================
     ③ 路由
     ------------------------------------------------------------
     支持三种地址：
       #/overview                       总览
       #/alerts?platform=douyin&page=2  实时预警（带筛选条件）
       #/analysis                       研判中心
     识别不了的地址返回 not-found，交给 render 显示提示页。
     ============================================================ */
  function parseRoute() {
    var hash = typeof location.hash === "string" ? location.hash : "";
    var raw = hash.replace(/^#\/?/, "") || "overview";

    var queryIndex = raw.indexOf("?");
    var path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
    var query = new URLSearchParams(queryIndex === -1 ? "" : raw.slice(queryIndex + 1));

    if (path === "overview") return { name: "overview", query: query };
    if (path === "alerts") return { name: "alerts", query: query };
    if (path === "analysis") return { name: "analysis", query: query };
    return { name: "not-found", path: path, query: query };
  }

  /* 把地址栏里的筛选条件读回 state ——
     这样刷新、粘贴带参数的链接、浏览器后退，筛选状态都能恢复。
     师兄的预警页也是这么做的：URL 是筛选条件的唯一真相源。 */
  function syncFiltersFromRoute(route) {
    if (route.name !== "alerts") return;
    var q = route.query;
    Object.keys(DEFAULT_FILTERS).forEach(function (key) {
      if (key === "page") {
        var p = parseInt(q.get("page"), 10);
        state.filters.page = p > 0 ? p : 1;
      } else if (q.has(key)) {
        state.filters[key] = q.get(key);
      } else {
        state.filters[key] = DEFAULT_FILTERS[key];
      }
    });
  }

  /* 把筛选条件写回地址栏。
     好处：链接可分享、浏览器后退能回到上一次的筛选状态。 */
  function pushFiltersToUrl() {
    var params = new URLSearchParams();
    Object.keys(state.filters).forEach(function (key) {
      var v = state.filters[key];
      if (v !== "" && v !== DEFAULT_FILTERS[key]) params.set(key, v);
    });
    var qs = params.toString();
    location.hash = "#/alerts" + (qs ? "?" + qs : "");
  }

  /* ============================================================
     ④-1 渲染：总览页
     ============================================================ */

  function kpiCard(label, value, unit, hint, tone) {
    return '' +
      '<div class="kpi-card kpi-' + tone + '">' +
        '<span class="kpi-label">' + escapeHtml(label) + '</span>' +
        '<span class="kpi-value">' + escapeHtml(value) +
          (unit ? '<i class="kpi-unit">' + escapeHtml(unit) + '</i>' : '') +
        '</span>' +
        '<span class="kpi-hint">' + escapeHtml(hint) + '</span>' +
      '</div>';
  }

  /* 环形图：用 SVG 的 circle 画。
     原理：圆的周长 C = 2πr。想让一段占 30%，就把它画成周长的 30%：
       · stroke-dasharray="段长 剩余长度"  控制这一段画多长
       · stroke-dashoffset                  把它推到圆周上的正确位置
       · transform="rotate(-90 ...)"        让起点从 12 点方向开始
     师兄的总览页也是这么画的，没有用任何图表库。 */
  function renderRing(domains, total) {
    var R = 68;
    var C = 2 * Math.PI * R;
    var offset = 0;
    var svg = '<svg viewBox="0 0 180 180" class="ring" role="img" aria-label="风险领域分布">';

    /* 先铺一个浅灰整圆作底，各段之间才不会露出空白 */
    svg += '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="#eef1f5" stroke-width="20"/>';

    domains.forEach(function (d) {
      var len = (d.value / total) * C;
      svg += '<circle cx="90" cy="90" r="' + R + '" fill="none" ' +
        'stroke="' + d.color + '" stroke-width="20" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" ' +
        'transform="rotate(-90 90 90)"/>';
      offset += len;
    });
    svg += '</svg>';

    var legend = '<ul class="ring-legend">';
    domains.forEach(function (d) {
      var pct = ((d.value / total) * 100).toFixed(1);
      legend += '<li>' +
        '<i class="dot" style="background:' + d.color + '"></i>' +
        '<span class="legend-label">' + escapeHtml(d.label) + '</span>' +
        '<span class="legend-val">' + d.value + '</span>' +
        '<span class="legend-pct">' + pct + '%</span>' +
        '</li>';
    });
    legend += '</ul>';

    return '<div class="ring-wrap">' +
      '<div class="ring-box">' + svg +
        '<div class="ring-center"><strong>' + total + '</strong><span>预警总量</span></div>' +
      '</div>' + legend +
    '</div>';
  }

  /* 柱状图：用纯 CSS 的高度实现，不用 SVG，代码最短 */
  function renderTrend(trend) {
    var max = 0;
    trend.forEach(function (t) { if (t.value > max) max = t.value; });

    var html = '<div class="bars">';
    trend.forEach(function (t) {
      var h = Math.round((t.value / max) * 100);
      html += '<div class="bar-item" title="' + escapeHtml(t.day) + '：' + t.value + ' 条">' +
        '<span class="bar-val">' + t.value + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="height:' + h + '%"></div></div>' +
        '<span class="bar-day">' + escapeHtml(t.day) + '</span>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  /* 关键词云：字号跟着权重走 */
  function renderKeywords(keywords) {
    var html = '<div class="cloud">';
    keywords.forEach(function (k) {
      var size = 13 + (k.weight / 100) * 15;
      var tone = k.weight > 70 ? "w-high" : (k.weight > 45 ? "w-mid" : "w-low");
      html += '<span class="cloud-word ' + tone + '" style="font-size:' + size.toFixed(1) + 'px">' +
        escapeHtml(k.word) + '</span>';
    });
    html += '</div>';
    return html;
  }

  /* 后端连通性卡片：保留第 1 步的联调成果，放在总览页底部 */
  function renderApiPanel() {
    return '<section class="panel">' +
      '<h2>后端连通性</h2>' +
      '<p class="panel-desc">点击按钮请求后端接口，验证前后端链路是否畅通。</p>' +
      '<button class="primary-button js-call-api" type="button">调用后端接口</button>' +
      '<pre class="api-output" id="api-output">还没有调用过。</pre>' +
    '</section>';
  }

  function renderDomainDetail(domains) {
    var html = '<ul class="domain-list">';
    domains.forEach(function (d) {
      html += '<li>' +
        '<div class="domain-head">' +
          '<i class="dot" style="background:' + d.color + '"></i>' +
          '<strong>' + escapeHtml(d.label) + '</strong>' +
          '<span class="domain-num">' + d.value + '</span>' +
        '</div>' +
        '<div class="chip-row">';
      d.categories.forEach(function (c) {
        html += '<span class="chip">' + escapeHtml(c) + '</span>';
      });
      html += '</div></li>';
    });
    html += '</ul>';
    return html;
  }

  function renderOverview() {
    var s = DATA.getSummary();
    var domains = DATA.riskDomains;
    var total = 0;
    domains.forEach(function (d) { total += d.value; });

    var html = '';
    html += '<div class="page-head"><h1>系统总览</h1>' +
      '<p>数据更新时间：' + nowText() + '</p></div>';

    html += '<div class="kpi-grid">' +
      kpiCard("预警总量", s.total, "条", "当前演示数据", "blue") +
      kpiCard("待处置", s.pending, "条", "需要人工介入", "red") +
      kpiCard("高危预警", s.high, "条", "优先级最高", "amber") +
      kpiCard("已处置", s.handled, "条", "已完成闭环", "teal") +
      '</div>';

    html += '<div class="grid-2">' +
      '<section class="panel"><h2>风险领域分布</h2>' + renderRing(domains, total) + '</section>' +
      '<section class="panel"><h2>领域明细</h2>' + renderDomainDetail(domains) + '</section>' +
      '</div>';

    html += '<section class="panel"><h2>近 12 日预警趋势</h2>' + renderTrend(DATA.trend) + '</section>';
    html += '<section class="panel"><h2>高频关键词</h2>' + renderKeywords(DATA.keywords) + '</section>';
    html += renderApiPanel();

    return html;
  }

  /* ============================================================
     ④-2 渲染：实时预警页
     ============================================================ */

  /* 按 state.filters 过滤出当前要显示的列表。
     这就是师兄 renderAlerts 里那段 filter / sort 的核心。 */
  function filterAlerts() {
    var f = state.filters;
    var list = DATA.alerts.slice();

    if (f.search) {
      var kw = f.search.toLowerCase();
      list = list.filter(function (a) {
        return a.title.toLowerCase().indexOf(kw) > -1 ||
               a.id.toLowerCase().indexOf(kw) > -1 ||
               a.author.toLowerCase().indexOf(kw) > -1;
      });
    }
    if (f.platform !== "all") {
      list = list.filter(function (a) { return a.platform === f.platform; });
    }
    if (f.level !== "all") {
      list = list.filter(function (a) { return a.level === f.level; });
    }
    if (f.status !== "all") {
      list = list.filter(function (a) { return a.status === f.status; });
    }
    if (f.sort === "oldest") list.reverse();   // 原始数据新的在前，reverse 即旧的在先

    return list;
  }

  function optionList(list, current, allLabel) {
    var html = '<option value="all"' + (current === "all" ? " selected" : "") + '>' +
      escapeHtml(allLabel) + '</option>';
    list.forEach(function (item) {
      html += '<option value="' + escapeHtml(item.key) + '"' +
        (current === item.key ? " selected" : "") + '>' + escapeHtml(item.label) + '</option>';
    });
    return html;
  }

  function renderFilterBar() {
    var f = state.filters;
    return '<div class="filter-bar">' +
      '<div class="filter-item filter-search">' +
        '<span class="nav-icon" data-icon="scan"></span>' +
        '<input type="text" class="js-search" placeholder="搜索标题 / 编号 / 账号（回车生效）" value="' +
          escapeHtml(f.search) + '">' +
      '</div>' +
      '<div class="filter-item"><label>平台</label>' +
        '<select class="js-filter" data-key="platform">' + optionList(DATA.platforms, f.platform, "全部平台") + '</select></div>' +
      '<div class="filter-item"><label>等级</label>' +
        '<select class="js-filter" data-key="level">' + optionList(DATA.levels, f.level, "全部等级") + '</select></div>' +
      '<div class="filter-item"><label>状态</label>' +
        '<select class="js-filter" data-key="status">' + optionList(DATA.statuses, f.status, "全部状态") + '</select></div>' +
      '<div class="filter-item"><label>排序</label>' +
        '<select class="js-filter" data-key="sort">' +
          '<option value="newest"' + (f.sort === "newest" ? " selected" : "") + '>最新优先</option>' +
          '<option value="oldest"' + (f.sort === "oldest" ? " selected" : "") + '>最早优先</option>' +
        '</select></div>' +
      '<button class="ghost-button js-reset" type="button">重置</button>' +
    '</div>';
  }

  function renderAlertTable(list) {
    if (!list.length) {
      return '<div class="empty-state">没有符合条件的预警记录，试试调整筛选条件。</div>';
    }

    var html = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>编号</th><th>标题</th><th>平台</th><th>失范类别</th>' +
      '<th>等级</th><th>状态</th><th>发现时间</th>' +
      '</tr></thead><tbody>';

    list.forEach(function (a) {
      var lv = itemOf(DATA.levels, a.level);
      var st = itemOf(DATA.statuses, a.status);
      var pf = itemOf(DATA.platforms, a.platform);
      html += '<tr>' +
        '<td class="mono">' + escapeHtml(a.id) + '</td>' +
        '<td class="td-title" title="' + escapeHtml(a.summary) + '">' + escapeHtml(a.title) + '</td>' +
        '<td>' + escapeHtml(pf.label) + '</td>' +
        '<td><span class="chip chip-sm">' + escapeHtml(a.category) + '</span></td>' +
        '<td><span class="tag" style="--tag:' + lv.color + '">' + escapeHtml(lv.label) + '</span></td>' +
        '<td><span class="tag tag-outline" style="--tag:' + st.color + '">' + escapeHtml(st.label) + '</span></td>' +
        '<td class="mono td-time">' + escapeHtml(a.time) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function renderPager(page, pageCount, totalCount) {
    var html = '<div class="pager">' +
      '<span class="pager-info">共 ' + totalCount + ' 条 · 第 ' + page + ' / ' + pageCount + ' 页</span>' +
      '<div class="pager-btns">' +
        '<button class="ghost-button js-page" data-page="' + (page - 1) + '"' +
          (page <= 1 ? " disabled" : "") + '>上一页</button>';

    for (var p = 1; p <= pageCount; p++) {
      /* 页数多时只显示当前页附近的页码，否则按钮会排成长龙 */
      if (pageCount > 7 && p !== 1 && p !== pageCount && Math.abs(p - page) > 1) {
        if (p === 2 || p === pageCount - 1) html += '<span class="pager-gap">…</span>';
        continue;
      }
      html += '<button class="page-btn js-page' + (p === page ? " is-current" : "") +
        '" data-page="' + p + '">' + p + '</button>';
    }

    html += '<button class="ghost-button js-page" data-page="' + (page + 1) + '"' +
      (page >= pageCount ? " disabled" : "") + '>下一页</button>' +
      '</div></div>';
    return html;
  }

  function renderAlerts() {
    var list = filterAlerts();
    var pageSize = state.pageSize;
    var pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    var page = Math.min(Math.max(1, state.filters.page), pageCount);
    state.filters.page = page;   // 把修正后的页码写回状态，避免越界

    var pageList = list.slice((page - 1) * pageSize, page * pageSize);

    var html = '';
    html += '<div class="page-head"><h1>实时预警</h1>' +
      '<p>共 ' + DATA.alerts.length + ' 条预警记录，当前筛选出 ' + list.length + ' 条</p></div>';
    html += renderFilterBar();
    html += '<section class="panel panel-flush">' + renderAlertTable(pageList) + '</section>';
    html += renderPager(page, pageCount, list.length);
    return html;
  }

  /* ============================================================
     ④-3 渲染：研判中心
     ============================================================ */

  function renderSampleGrid() {
    var a = state.analysis;
    var html = '<div class="sample-grid">';
    DATA.analysisSamples.forEach(function (s) {
      var active = a.sampleId === s.id ? " is-active" : "";
      var lv = itemOf(DATA.levels, s.level);
      html += '<button class="sample-card js-sample' + active + '" type="button" data-id="' + escapeHtml(s.id) + '">' +
        '<span class="sample-thumb" style="--tag:' + lv.color + '">' + escapeHtml(s.title.slice(0, 2)) + '</span>' +
        '<span class="sample-title">' + escapeHtml(s.title) + '</span>' +
        '<span class="sample-text">' + escapeHtml(s.text) + '</span>' +
        '<span class="sample-verdict">' + s.verdict.map(function (v) {
          return '<i class="chip chip-xs">' + escapeHtml(v) + '</i>';
        }).join("") + '</span>' +
        '</button>';
    });
    html += '</div>';
    return html;
  }

  function renderAnalysisStage() {
    var a = state.analysis;

    if (a.status === "idle") {
      return '<div class="stage-body stage-idle">' +
        '<div class="stage-placeholder">' +
          '<span class="nav-icon" data-icon="scan"></span>' +
          '<p>从左侧选择一个样本，开始多智能体协同研判</p>' +
          '<p class="ts">流程：专家匹配 → 独立陈述 → 交叉回应 → 综合研判</p>' +
        '</div></div>';
    }

    var html = '<div class="stage-body">';

    /* 四阶段进度 */
    html += '<div class="phase-track">';
    DATA.analysisPhases.forEach(function (p, i) {
      var cls = i < a.phaseIndex ? "is-done" : (i === a.phaseIndex && a.status === "running" ? "is-doing" : "");
      html += '<div class="phase-step ' + cls + '">' +
        '<span class="phase-idx">' + (i < a.phaseIndex ? "✓" : (i + 1)) + '</span>' +
        '<span class="phase-label">' + escapeHtml(p.label) + '</span>' +
        '</div>';
    });
    html += '</div>';

    /* 总进度条 */
    html += '<div class="progress-line">' +
      '<div class="progress-bar"><i style="width:' + a.progress + '%"></i></div>' +
      '<span class="progress-num">' + a.progress + '%</span>' +
      '</div>';

    /* 实时输出：模拟专家发言逐条出现 */
    html += '<div class="stage-logs">';
    a.logs.forEach(function (line) {
      html += '<p class="log-line log-' + line.tone + '">' +
        (line.who ? '<b>' + escapeHtml(line.who) + '</b>：' : '') +
        escapeHtml(line.text) + '</p>';
    });
    if (a.status === "running") html += '<p class="log-line log-typing"><i class="caret"></i></p>';
    html += '</div>';

    /* 最终结论 */
    if (a.status === "done" && a.result) {
      html += '<div class="verdict-box">' +
        '<h3>研判结论</h3>' +
        '<div class="verdict-tags">' + a.result.verdict.map(function (v) {
          return '<span class="tag tag-solid">' + escapeHtml(v) + '</span>';
        }).join("") + '</div>' +
        '<p class="verdict-text">' + escapeHtml(a.result.text) + '</p>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderAnalysis() {
    return '<div class="page-head"><h1>研判中心</h1>' +
        '<p>选择样本触发多智能体协同研判，由多位领域专家独立判断后综合定性</p></div>' +
      '<div class="analysis-layout">' +
        '<section class="panel"><h2>样本库</h2>' + renderSampleGrid() + '</section>' +
        '<section class="panel"><h2>研判过程</h2><div id="analysis-stage">' +
          renderAnalysisStage() + '</div></section>' +
      '</div>';
  }

  /* 只刷新研判面板，不整页重绘 ——
     研判过程中每 150 毫秒更新一次，整页重绘会不停闪烁、还会丢滚动位置。
     师兄也是这么做的（他的注释里写着 "keep its DOM and patch it instead"）。 */
  function patchAnalysisStage() {
    var box = document.getElementById("analysis-stage");
    if (!box) return;
    box.innerHTML = renderAnalysisStage();
    if (window.hydrateIcons) window.hydrateIcons(box);

    /* 日志区自动滚到底部 —— 否则最新一条专家发言会被藏在滚动条下面，
       看起来像「卡住了不动」，其实是在默默输出。 */
    var logs = box.querySelector(".stage-logs");
    if (logs) logs.scrollTop = logs.scrollHeight;
  }

  /* 把一次研判要说的话，预先按「进度百分比」排好队。
     定时器只需要按当前进度取句子，比一堆 if-else 清楚得多。 */
  function buildScript(sample, experts) {
    var lines = [];
    lines.push({ at: 2, line: { tone: "info", who: "", text: "正在解析样本内容……" } });
    lines.push({ at: 6, line: { tone: "info", who: "", text: "已完成图片与文本的多模态特征提取" } });

    lines.push({ at: 10, line: { tone: "sys", who: "系统", text: "从领域专家库中匹配到 3 位专家" } });
    experts.forEach(function (e, i) {
      lines.push({ at: 12 + i * 2, line: { tone: "sys", who: "系统", text: "已选定：" + e.name } });
    });

    experts.forEach(function (e, i) {
      lines.push({
        at: 20 + i * 8,
        line: {
          tone: "expert", who: e.name,
          text: "我的初步判断是：该内容存在「" + sample.verdict[i % sample.verdict.length] +
                "」方面的风险，主要依据是其表达方式超出了正常讨论的边界。",
        },
      });
    });

    lines.push({ at: 52, line: { tone: "sys", who: "系统", text: "进入交叉回应阶段，专家就分歧点展开讨论" } });
    experts.forEach(function (e, i) {
      lines.push({
        at: 58 + i * 7,
        line: {
          tone: "expert", who: e.name,
          text: "我补充一点：即便创作者无主观恶意，判定仍应以表达方式对公共秩序的实际影响为准。",
        },
      });
    });

    lines.push({ at: 82, line: { tone: "sys", who: "主智能体", text: "正在汇总各方意见，形成最终定性……" } });
    lines.push({ at: 94, line: { tone: "verdict", who: "主智能体", text: "研判完成，结论已生成。" } });

    return lines;
  }

  /* 研判流程的模拟驱动。
     这里没有调用真实 AI，而是用定时器按节奏推进日志 ——
     观感和师兄的流式返回一致，但不消耗任何 API 额度。
     想接真实 AI 时，把这段定时器换成 fetch + 流式读取即可。 */
  function startAnalysis(sampleId) {
    var a = state.analysis;
    if (a.timer) clearInterval(a.timer);

    var sample = null;
    DATA.analysisSamples.forEach(function (s) { if (s.id === sampleId) sample = s; });
    if (!sample) return;

    a.status = "running";
    a.sampleId = sampleId;
    a.progress = 0;
    a.phaseIndex = 0;
    a.logs = [];
    a.result = null;
    patchAnalysisStage();

    var phases = DATA.analysisPhases;
    var script = buildScript(sample, DATA.experts);
    var emitted = 0;

    a.timer = setInterval(function () {
      a.progress += 2;
      if (a.progress > 100) a.progress = 100;

      /* 根据累计进度判断当前处于第几阶段 */
      var acc = 0;
      a.phaseIndex = phases.length - 1;
      for (var i = 0; i < phases.length; i++) {
        acc += phases[i].weight;
        if (a.progress <= acc) { a.phaseIndex = i; break; }
      }

      /* 把这一进度应该出现的话推出来 */
      while (emitted < script.length && script[emitted].at <= a.progress) {
        a.logs.push(script[emitted].line);
        emitted++;
      }

      if (a.progress >= 100) {
        clearInterval(a.timer);
        a.timer = null;
        a.status = "done";
        a.phaseIndex = phases.length;
        a.result = {
          verdict: sample.verdict,
          text: "综合三位专家意见，该内容在「" + sample.verdict.join("、") +
                "」维度上存在失范风险。判定依据：画面与文本中可直接观察到的表达方式，" +
                "以符号化、标签化的手法完成了贬损或误导，超出了正常表达与批评的边界。",
        };
      }

      patchAnalysisStage();
    }, 150);
  }

  /* ============================================================
     ⑤ 渲染分发
     ------------------------------------------------------------
     整个应用只有一个出口：render()。
     任何地方要更新界面，都是「改 state → 调 render()」。
     ============================================================ */
  function render() {
    var route = parseRoute();

    /* 离开研判页时，把还在跑的定时器停掉，否则它会在后台空转 */
    if (route.name !== "analysis" && state.analysis.timer) {
      clearInterval(state.analysis.timer);
      state.analysis.timer = null;
      state.analysis.status = state.analysis.result ? "done" : "idle";
    }

    syncFiltersFromRoute(route);

    var main = document.getElementById("main-content");
    if (!main) return;

    /* 研判进行中不要整页重绘，否则会把正在跑的面板冲掉，只更新导航高亮即可 */
    var keepAnalysis = route.name === "analysis" && state.analysis.status === "running";

    if (!keepAnalysis) {
      if (route.name === "overview") main.innerHTML = renderOverview();
      else if (route.name === "alerts") main.innerHTML = renderAlerts();
      else if (route.name === "analysis") main.innerHTML = renderAnalysis();
      else {
        main.innerHTML = '<div class="page-head"><h1>页面不存在</h1>' +
          '<p>地址 <code>#/' + escapeHtml(route.path || "") + '</code> 没有对应的页面。</p></div>';
      }
      if (window.hydrateIcons) window.hydrateIcons(main);
    }

    /* 顶栏和侧边栏的图标不在 main 里，要单独补一次 */
    if (window.hydrateIcons) {
      window.hydrateIcons(document.querySelector(".topbar"));
      window.hydrateIcons(document.querySelector(".sidebar"));
    }

    /* 导航高亮：当前页面所在的菜单项变蓝 */
    document.querySelectorAll("[data-nav]").forEach(function (nav) {
      nav.classList.toggle("is-active", nav.getAttribute("data-nav") === route.name);
    });

    document.body.classList.toggle("menu-open", state.menuOpen);
    document.querySelector(".app-shell").classList.toggle("is-collapsed", state.sidebarCollapsed);
  }

  /* ============================================================
     ⑥ 侧边栏开关 / 时钟 / 接口调用（第 1 步的原有功能）
     ============================================================ */

  var MOBILE_QUERY = "(max-width: 900px)";
  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function toggleSidebar() {
    if (isMobile()) {
      state.menuOpen = !state.menuOpen;
      document.body.classList.toggle("menu-open", state.menuOpen);
    } else {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      document.querySelector(".app-shell").classList.toggle("is-collapsed", state.sidebarCollapsed);
    }
  }

  var WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  function updateClock() {
    var timeEl = document.getElementById("current-time");
    var dateEl = document.getElementById("current-date");
    if (!timeEl || !dateEl) return;
    var now = new Date();
    timeEl.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    dateEl.textContent = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
      " " + WEEKDAYS[now.getDay()];
  }

  /* 接口地址按部署环境自动切换。
     目前这份代码会在三种地方运行，各需要一个不同的后端地址：

       ① 本地开发      → 后端在本机 5000 端口
       ② GitHub Pages  → 后端在 Render（不同域名，属于跨域）
       ③ 自建服务器    → 前端和后端在同一台机器、同一个源，
                          所以用「相对路径」交给 nginx 转发即可 ——
                          写死 IP 的话，IP 一变就得改代码。

     注意 ③ 的价值：因为是同源，浏览器根本不会触发跨域检查，
     后端连 CORS 响应头都不需要配。这是生产环境常见的做法。 */
  var LOCAL_HOSTS = ["127.0.0.1", "localhost", ""];
  var IS_LOCAL = LOCAL_HOSTS.indexOf(location.hostname) !== -1;

  var API_BASE;
  if (IS_LOCAL) {
    API_BASE = "http://127.0.0.1:5000";                     // ① 本地
  } else if (location.hostname.indexOf("github.io") > -1) {
    API_BASE = "https://culture-platform.onrender.com";     // ② GitHub Pages
  } else {
    API_BASE = "";                                          // ③ 自建服务器：同源相对路径
  }

  function callApi() {
    var output = document.getElementById("api-output");
    if (!output) return;
    output.textContent = "请求中…";

    fetch(API_BASE + "/api/health")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        output.textContent = "✓ 联调成功！\n\n请求地址：" + API_BASE + "/api/health\n后端返回：\n" +
          JSON.stringify(data, null, 2);
      })
      .catch(function (error) {
        output.textContent = "✗ 请求失败：" + error.message +
          "\n\n提示：后端免费实例可能正在冷启动，等 20 秒再点一次。";
      });
  }

  /* ============================================================
     ⑦ 事件绑定（全部挂在 document 上 —— 事件委托）
     ============================================================ */

  document.addEventListener("click", function (event) {
    if (event.target.closest(".js-toggle-menu")) { toggleSidebar(); return; }
    if (event.target.closest(".js-collapse")) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      document.querySelector(".app-shell").classList.toggle("is-collapsed", state.sidebarCollapsed);
      return;
    }
    if (event.target.closest(".js-call-api")) { callApi(); return; }

    /* 分页 */
    var pageBtn = event.target.closest(".js-page");
    if (pageBtn && !pageBtn.disabled) {
      state.filters.page = parseInt(pageBtn.getAttribute("data-page"), 10) || 1;
      pushFiltersToUrl();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    /* 重置筛选条件 */
    if (event.target.closest(".js-reset")) {
      state.filters = Object.assign({}, DEFAULT_FILTERS);
      pushFiltersToUrl();
      render();
      return;
    }

    /* 选择研判样本 */
    var sampleBtn = event.target.closest(".js-sample");
    if (sampleBtn) { startAnalysis(sampleBtn.getAttribute("data-id")); return; }

    /* 移动端：点导航后收起抽屉 */
    if (event.target.closest(".nav-item") && isMobile()) {
      state.menuOpen = false;
      document.body.classList.remove("menu-open");
    }
  });

  /* 下拉筛选和搜索框都用 change 事件。
     搜索没用 input 事件，是为了避免每敲一个字就重绘整页 ——
     那会让输入框失焦、光标跳到开头。（真实项目里可以用防抖 + 局部更新解决） */
  document.addEventListener("change", function (event) {
    var input = event.target.closest(".js-search");
    if (input) {
      state.filters.search = input.value;
      state.filters.page = 1;
      pushFiltersToUrl();
      render();
      return;
    }

    var sel = event.target.closest(".js-filter");
    if (sel) {
      state.filters[sel.getAttribute("data-key")] = sel.value;
      state.filters.page = 1;     // 换了筛选条件，回到第一页
      pushFiltersToUrl();
      render();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      state.menuOpen = false;
      document.body.classList.remove("menu-open");
    }
  });

  /* 地址栏变化 → 重新渲染。这一行就是整个「路由」的驱动源。 */
  window.addEventListener("hashchange", render);

  /* ============================================================
     ⑧ 启动
     ============================================================ */
  if (window.hydrateIcons) window.hydrateIcons(document);
  updateClock();
  setInterval(updateClock, 1000);

  /* 首次进入如果地址栏没有 hash，补一个默认路由 */
  if (!location.hash) location.hash = "#/overview";
  render();

})();
