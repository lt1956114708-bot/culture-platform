/* ============================================================
   文化产品价值失范综合预警平台 —— 交互（第 1 步产出）
   ------------------------------------------------------------
   这一步的 JS 只做三件小事：
     ① 桌面端：点「收起菜单」折叠侧边栏
     ② 移动端：点三条杠打开抽屉菜单，点遮罩关闭
     ③ 顶栏时钟每秒走一次

   虽然简单，但用的是「事件委托」——
   这是这个项目后面几百个交互都会沿用的模式，先在这里学会它。
   ============================================================ */

/* 用 IIFE（立即执行函数）把代码包起来，避免变量泄漏到全局。
   "use strict" 开启严格模式：把一些容易写错的地方直接报错而不是静默通过。 */
(function () {
  "use strict";

  var shell = document.getElementById("app-shell");

  /* ------------------------------------------------------------
     ① + ② 侧边栏开关
     ------------------------------------------------------------
     这里有个关键判断：桌面端和移动端的行为不一样。
       · 桌面端：切换「折叠 / 展开」，只改宽度，侧边栏始终在
       · 移动端：切换「抽屉打开 / 关闭」，由 body 上的 class 控制

     用 matchMedia 查询当前视口是不是小于 900px，
     这个断点必须和 styles.css 里 @media 写的保持一致。
     ------------------------------------------------------------ */
  var MOBILE_QUERY = "(max-width: 900px)";

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function toggleSidebar() {
    if (isMobile()) {
      // 移动端：给 body 加/去 menu-open，CSS 负责滑动和显示遮罩
      document.body.classList.toggle("menu-open");
    } else {
      // 桌面端：给 app-shell 加/去 is-collapsed，CSS 负责改列宽
      shell.classList.toggle("is-collapsed");
    }
  }

  /* ------------------------------------------------------------
     ③ 时钟
     ------------------------------------------------------------ */
  var WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

  // 数字补零：9 → "09"
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function updateClock() {
    var timeEl = document.getElementById("current-time");
    var dateEl = document.getElementById("current-date");
    if (!timeEl || !dateEl) return;

    var now = new Date();

    timeEl.textContent =
      pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());

    dateEl.textContent =
      now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
      " " + WEEKDAYS[now.getDay()];
  }

  /* ------------------------------------------------------------
     里程碑 1：前后端联调
     ------------------------------------------------------------
     前端跑在 http://127.0.0.1:5500
     后端跑在 http://127.0.0.1:5000

     ★ 端口不一样 = 浏览器眼里的「两个不同的源」★
     浏览器的同源策略规定：只有「协议 + 域名 + 端口」三者完全一致，
     才允许 JS 读取对方的响应。只要有一个不同，就属于跨域请求，
     响应会被浏览器拦截 —— 这就是传说中的 CORS 问题。

     注意一个新手最容易困惑的点：
       浏览器控制台会明确写 "blocked by CORS policy"，
       但下面 catch 里拿到的错误只有 "Failed to fetch"，
       不含 CORS 字样（浏览器故意不告诉 JS 细节，是安全设计）。
       所以排查跨域必须去看 Console，不能只靠这段代码的提示。
     ------------------------------------------------------------ */
  // ------------------------------------------------------------
  //  接口地址：按环境自动切换
  // ------------------------------------------------------------
  //  本地开发时，后端跑在 http://127.0.0.1:5000
  //  部署上线后，后端跑在 Render，本机那个地址根本不存在
  //
  //  为什么不能写死成一个？
  //    · 写死 127.0.0.1  → 线上打开必然失败
  //    · 写死 Render 地址 → 本地开发时请求要绕一圈公网，又慢又难调试
  //
  //  location.hostname 是「当前页面的域名」，据此判断跑在哪个环境：
  //    本地打开 → 127.0.0.1 或 localhost
  //    线上打开 → xxx.github.io 之类
  //
  //  ★ 线上必须用 https://
  //  因为线上前端页面是 https 的，如果这里写 http://，
  //  浏览器会判定为「混合内容」直接拦截 —— 又一个高频坑。
  // ------------------------------------------------------------
  var LOCAL_HOSTS = ["127.0.0.1", "localhost", ""];
  var IS_LOCAL = LOCAL_HOSTS.indexOf(location.hostname) !== -1;

  var API_BASE = IS_LOCAL
    ? "http://127.0.0.1:5000"                        // 本地后端
    : "https://culture-platform.onrender.com";       // 线上后端（Render）

  function callApi() {
    var output = document.getElementById("api-output");
    if (!output) return;

    output.textContent = "请求中…";

    fetch(API_BASE + "/api/health")
      .then(function (response) {
        // fetch 只有在「网络层面失败」时才 reject。
        // 像 404、500 这种 HTTP 错误码，它照样 resolve，
        // 所以必须自己检查 response.ok，这是另一个经典坑。
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        output.textContent =
          "✓ 联调成功！\n\n" +
          "请求地址：" + API_BASE + "/api/health\n" +
          "后端返回：\n" + JSON.stringify(data, null, 2);
      })
      .catch(function (error) {
        output.textContent =
          "✗ 请求失败：" + error.message + "\n\n" +
          "下一步：按 F12 打开控制台，找到红色的报错。\n" +
          "如果看到 \"blocked by CORS policy\"，\n" +
          "就把 server/app.py 里的 ENABLE_CORS 改成 True，重启后端再试。";
      });
  }

  /* ------------------------------------------------------------
     事件绑定：只挂一个监听器在 document 上
     ------------------------------------------------------------
     为什么不直接给每个按钮单独 bind？
     因为将来的页面是 JS 动态渲染出来的，按钮会不断被创建和销毁。
     如果在渲染时绑事件，每次重渲染都要重新绑一遍，很容易漏、也很容易内存泄漏。

     事件委托的思路是：把监听器挂在永远存在的父节点（这里是 document）上，
     点击时顺着 event.target 往上找最近的、带目标 class 的元素。
     无论按钮是新是旧，都能被捕获到。
     ------------------------------------------------------------ */
  document.addEventListener("click", function (event) {
    // closest 会从点击位置向上冒泡查找，找不到返回 null
    var toggleTarget = event.target.closest(".js-toggle-menu");
    if (toggleTarget) {
      toggleSidebar();
      return;
    }

    var collapseTarget = event.target.closest(".js-collapse");
    if (collapseTarget) {
      shell.classList.toggle("is-collapsed");
      return;
    }

    var apiTarget = event.target.closest(".js-call-api");
    if (apiTarget) {
      callApi();
      return;
    }

    // 点击侧边栏里的导航链接时，如果是移动端抽屉，顺手关掉抽屉
    if (event.target.closest(".nav-item") && isMobile()) {
      document.body.classList.remove("menu-open");
    }
  });

  /* ------------------------------------------------------------
     按 Esc 关闭移动端抽屉（小细节，但会让体验好很多）
     ------------------------------------------------------------ */
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      document.body.classList.remove("menu-open");
    }
  });

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */
  // 先把 HTML 里的 [data-icon] 占位符批量换成真正的 SVG，再启动时钟。
  // 顺序反了不会报错，但页面会有一瞬间图标是空的。
  if (typeof window.hydrateIcons === "function") {
    window.hydrateIcons(document);
  }

  updateClock();
  // 每 1000 毫秒执行一次。注意用 setInterval 要记得在页面卸载时清掉，
  // 这里单页应用不会卸载，所以不处理；将来接入路由时要注意这个问题。
  setInterval(updateClock, 1000);

  // 控制台留个记号，方便确认脚本已加载
  console.log("[骨架] app.js 已加载，交互就绪");

})();
