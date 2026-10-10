/* ============================================================
   图标字典（第 1 步产出）
   ------------------------------------------------------------
   解决的问题：整个页面要用几十个图标，如果每个地方都把
   完整的 <svg> 代码内联写进 HTML，文件会又长又难维护。

   做法：HTML 里只写一个「占位符」——
        <span data-icon="bell"></span>
   等页面渲染完，再由 hydrateIcons() 统一把占位符换成真正的 SVG。

   两个好处：
     ① HTML 结构干净，一眼能看懂这一块是什么
     ② SVG 代码只有一份，改图标只需改这里
   ============================================================ */

(function () {
  "use strict";

  /* 所有图标都是 24×24 的线性图标。
     统一约定：
       - viewBox="0 0 24 24"
       - fill="none"          不填充
       - stroke="currentColor" 描边色跟随父元素文字颜色（关键！
         这样在侧边栏是深灰、激活时变蓝，不用为每种状态各写一个图标）
       - stroke-width="1.8"   线条粗细 */
  var SVG_OPEN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  var ICONS = {
    /* 总览：房子 */
    house: SVG_OPEN +
      '<path d="M3 10.5 12 3l9 7.5"/>' +
      '<path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/>' +
      "</svg>",

    /* 实时预警：铃铛 */
    bell: SVG_OPEN +
      '<path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 5 2 7 2 7h-15s2-2 2-7"/>' +
      '<path d="M10.2 20a2 2 0 0 0 3.6 0"/>' +
      "</svg>",

    /* 研判中心：扫描镜 + 中心点 */
    scan: SVG_OPEN +
      '<circle cx="11" cy="11" r="7"/>' +
      '<path d="m20.5 20.5-4.2-4.2"/>' +
      '<circle cx="11" cy="11" r="1.6" fill="currentColor" stroke="none"/>' +
      "</svg>",

    /* 重点账号：两个小人 */
    users: SVG_OPEN +
      '<circle cx="9" cy="8" r="3.5"/>' +
      '<path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3A4.5 4.5 0 0 1 15 18.5V20"/>' +
      '<path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6"/>' +
      '<path d="M18 14.2a4.5 4.5 0 0 1 3 4.2V20"/>' +
      "</svg>",

    /* 审批记录：写字板 + 时钟 */
    clipboard: SVG_OPEN +
      '<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>' +
      '<rect x="9" y="2.5" width="6" height="3.5" rx="1"/>' +
      '<path d="M12 11v3.2l2.2 1.3"/>' +
      "</svg>",

    /* 系统设置：简化齿轮 */
    settings: SVG_OPEN +
      '<circle cx="12" cy="12" r="3.2"/>' +
      '<path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6"/>' +
      '<path d="M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8"/>' +
      "</svg>"
  };

  /* 把 root 范围内所有 [data-icon] 占位符替换成对应 SVG。
     root 参数是为了「只处理刚渲染出来的那一块」，
     页面大了以后不必每次全文档扫描。 */
  function hydrateIcons(root) {
    var scope = root || document;
    var slots = scope.querySelectorAll("[data-icon]");
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var name = slot.getAttribute("data-icon");
      var svg = ICONS[name];
      if (svg) slot.innerHTML = svg;
    }
  }

  // 挂到 window 上，让 app.js 和其他文件都能用
  window.ICONS = ICONS;
  window.hydrateIcons = hydrateIcons;

})();
