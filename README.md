# 文化产品价值失范综合预警平台 —— 第 1 步：搭出骨架

> 这一步的成果：一个能在浏览器里打开、能点、能折叠、手机上能收成抽屉的**空骨架**。
> 没有任何业务数据、没有路由、没有接口 —— 那些是后面的事。
>
> **后续进展**：骨架之后已经补上后端与部署学习内容，
> 见 **[DEPLOY.md](./DEPLOY.md)**（前后端联调、CORS 排错实录、免费平台部署步骤）。

---

## 一、你现在有什么

```
D:\culture-platform\
├── index.html    页面骨架（顶栏 / 侧边栏 / 主内容区）
├── styles.css    全部样式（布局 + 配色 + 响应式）
├── icons.js      图标字典 + 填充函数
└── app.js        交互逻辑（侧边栏开关 + 时钟）
```

一共 4 个文件、约 800 行（含注释），**零依赖、零构建工具**。

---

## 二、怎么把它跑起来

### 方式 A：用 Python（推荐，你机器上已有）

打开终端（PowerShell 或 CMD），执行：

```powershell
cd D:\culture-platform
python -m http.server 5500
```

然后浏览器打开 **http://127.0.0.1:5500**
用完按 `Ctrl + C` 停止。

### 方式 B：直接用浏览器打开文件

双击 `index.html` 也能看，但**不推荐**——用 `file://` 协议会有一些限制，
将来接入接口时必然踩坑。养成用本地服务器的习惯。

> **为什么不能直接双击？**
> 浏览器的安全策略会限制 `file://` 页面发起网络请求（跨域），
> 而我们第 5 步就要调接口。现在就走 http 协议，后面能省一堆麻烦。

---

## 三、四个文件各自负责什么

| 文件 | 职责 | 一句话理解 |
|---|---|---|
| `index.html` | 结构 | 决定**页面上有什么** |
| `styles.css` | 表现 | 决定**长什么样** |
| `app.js` | 行为 | 决定**点了会怎样** |
| `icons.js` | 图标资源 | 一个图标仓库 |

这就是前端最基础的「结构 / 样式 / 行为」三层分离。
每层只管自己的事，改颜色不用动 HTML，改结构不用动 JS。

---

## 四、三个必须搞懂的知识点

### 知识点 1：用 Grid 一次画好整个后台布局（本节最重要）

后台管理系统的布局几十年没变过：上面一条顶栏，左边一个菜单，右边一块内容区。
传统做法用 `float` 或者 `flex` 嵌套，代码又长又难调。**现在用 Grid 的 8 行就够了**：

```css
.app-shell {
  display: grid;
  grid-template-columns: 232px 1fr;   /* 第一列固定宽，第二列吃掉剩余空间 */
  grid-template-rows: 64px 1fr;       /* 第一行固定高，第二行吃掉剩余空间 */
  grid-template-areas:                /* ★ 核心：用「画图」的方式描述布局 */
    "topbar  topbar"                  /*    第一行：顶栏横跨两列 */
    "sidebar main";                   /*    第二行：左菜单、右内容 */
  min-height: 100vh;
}
```

然后在子元素上把区域名「认领」回去：

```css
.topbar       { grid-area: topbar; }
.sidebar      { grid-area: sidebar; }
.main-content { grid-area: main; }
```

**为什么这个写法好？** 因为 `grid-template-areas` 里那两行字符串，
看起来就是页面的样子。以后要调整布局（比如把侧边栏挪到右边），
只要把那两行字符串改一下就行，不用去算任何坐标。

里面两个单位也很关键：
- `1fr` = 「一份剩余空间」。`232px 1fr` 的意思是：先给第一列固定 232px，剩下的全给第二列。
- `100vh` = 视口高度的 100%，保证内容少的时候页面也撑满一屏。

**折叠功能也藏在同一处**：

```css
.app-shell.is-collapsed {
  grid-template-columns: 68px 1fr;   /* 只改第一列宽度 */
}
```
JS 只负责加/去 `is-collapsed` 这个 class，**具体怎么变全部交给 CSS**。
这是前端的一个核心思想：JS 管状态，CSS 管表现。

---

### 知识点 2：事件委托 —— 为什么只绑一个监听器

`app.js` 里没有任何 `button.addEventListener`，只有**一个**挂在 `document` 上的监听器：

```js
document.addEventListener("click", function (event) {
  var target = event.target.closest(".js-toggle-menu");
  if (target) { toggleSidebar(); return; }
  // ...
});
```

原理：点击事件会从最内层的元素**一路冒泡**到 `document`。
所以只要在 `document` 上接住，就能处理页面上任意位置的点击。
再用 `event.target.closest(".xxx")` 往上找最近的、带目标 class 的元素，
就能判断「用户点的到底是不是某个按钮」。

**为什么不用给每个按钮单独绑？**
因为以后的页面内容是 JS 动态渲染的，按钮会被反复创建和销毁。
如果在渲染时绑事件，每次重渲染都要重新绑一遍——费性能，还容易漏绑、容易内存泄漏。
事件委托一次绑定、永久生效。

注意 HTML 里那些 `js-` 开头的 class（`js-toggle-menu`、`js-collapse`）：

```html
<button class="hamburger js-toggle-menu" type="button">
```

**CSS 从不用 `js-` 开头的 class**，它是专门给 JS 找元素用的。
这样把「样式钩子」和「行为钩子」分开，改样式时不会误伤 JS 逻辑。

---

### 知识点 3：图标字典 —— 别把 SVG 抄一百遍

整个平台要用几十个图标。如果每个用到的地方都内联一段完整的 `<svg>` 代码，
HTML 会变得又臭又长，改一个图标要改几十处。

我们的做法是两步：

**第一步**，HTML 里只写占位符：
```html
<span class="nav-icon" data-icon="bell"></span>
```

**第二步**，`icons.js` 里集中存所有 SVG，页面加载后统一替换：
```js
function hydrateIcons(root) {
  var slots = (root || document).querySelectorAll("[data-icon]");
  for (var i = 0; i < slots.length; i++) {
    var svg = ICONS[slots[i].getAttribute("data-icon")];
    if (svg) slots[i].innerHTML = svg;
  }
}
```

图标里有个细节要注意：
```html
<svg ... stroke="currentColor" ...>
```
`currentColor` 表示「描边颜色跟随文字颜色」。
所以同一个图标，在侧边栏里是灰色的，激活时自动变蓝，禁用时自动变浅灰——
**一个图标文件，三种颜色，全靠 CSS 控制**：

```css
.nav-item .nav-icon          { color: var(--c-text-muted); }
.nav-item.is-active .nav-icon { color: var(--c-brand); }
.nav-item:disabled .nav-icon  { color: #aab3c0; }
```

---

## 五、我在这步踩的两个坑（都是典型错误）

### 坑 1：折叠侧边栏时，文字没有隐藏

**现象**：侧边栏收窄到 68px，但菜单文字还在，溢出一条。

**原因**：我最初 CSS 写的是
```css
.app-shell.is-collapsed .nav-item > span { display: none; }
```
想着「把 nav-item 里的 span 都藏掉」。但当时 HTML 里文字是裸的文本节点：
```html
<a class="nav-item" href="#/overview">总览</a>   <!-- 文字没被 span 包起来 -->
```
**选择器写得没错，但 HTML 结构不匹配，样式就完全不生效。**

**教训**：凡是需要被 CSS 或 JS 精确控制的元素，都给它一个语义化的 class。
不要依赖 `> span`、`:nth-child` 这种脆弱的标签选择器——
因为菜单项里除了文字，图标和徽标也是 span，用 `> span` 会把图标一起藏掉。

修好之后写成：
```css
.app-shell.is-collapsed .nav-text,
.app-shell.is-collapsed .nav-badge { display: none; }
```

---

### 坑 2：手机上顶栏被挤成两行

**现象**：390px 窄屏下，标题换行、"系统运行正常"竖排、"管理员"变成竖着的三个字。

**原因**：顶栏里的元素太多，窄屏放不下，flex 默认允许换行。

**解决思路是「断舍离」**——定一个取舍优先级，从最不重要的开始砍：

| 优先级 | 元素 | 窄屏处理 |
|---|---|---|
| 1（最重要） | 标题 | 保留，超出用省略号 |
| 2 | 管理员 | 保留，禁止换行 |
| 3 | 状态胶囊 | 直接隐藏 |
| 4（最次要） | 时钟 | 直接隐藏 |

```css
@media (max-width: 900px) {
  .clock-block { display: none; }     /* 先砍时钟 */
  .status-chip { display: none; }     /* 再砍状态胶囊 */

  .brand { min-width: 0; }            /* ★ 这行不能少 */
  .brand-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

其中 `min-width: 0` 是个**必须知道的坑**：
flex 子项默认 `min-width: auto`，意思是「我不允许自己被压得比内容还小」。
所以文字永远不会收缩，`text-overflow: ellipsis` 也就永远不会生效。
加一句 `min-width: 0` 解除限制，省略号才会出现。

> 同样是 Grid 的子项，也默认不收缩。所以 `.main-content` 上也写了 `min-width: 0`——
> 将来放一个宽表格进去时，不加这行整个布局会被撑破。

---

## 六、动手练习（强烈建议做一遍）

看完不等于会。下面 5 个练习，每个都只改几行，但能真正把知识变成你的：

1. **改配色**：把主色从蓝色 `#1d4ed8` 换成偏紫的 `#6d28d9`。
   只改 `:root` 里一行，观察全站哪些地方跟着变了。

2. **加一个菜单项**：在「研判中心」下面加一个「内容库」，
   图标自己写一个（比如三本书的简笔 path），观察折叠时行为是否正常。

3. **调整断点**：把响应式断点从 `900px` 改成 `1100px`，
   把浏览器窗口慢慢缩小，观察侧边栏在哪一刻变成抽屉。
   （注意：`styles.css` 的 `@media` 和 `app.js` 里的 `MOBILE_QUERY` **必须同步改**，
   否则会出现「视觉上变抽屉了，但点击逻辑还认为是桌面端」的 bug。）

4. **给菜单加激活态**：打开浏览器控制台（F12），执行
   ```js
   document.querySelector('.nav-item').classList.add('is-active');
   ```
   看第一个菜单项变成蓝色高亮。

5. **挑战题**：让侧边栏折叠状态在刷新后保持。
   提示：`localStorage.setItem('sidebarCollapsed', ...)` + 页面加载时读回来。

---

## 七、自己验证清单

跑起来之后，逐条确认（浏览器按 F12 看 Console 是否有报错）：

- [ ] 顶栏显示：盾牌标识 + 平台名 + 实时时钟（秒数在跳）+ 系统运行正常 + 管理员
- [ ] 时钟显示的确实是当前时间，日期和星期正确
- [ ] 侧边栏 6 个菜单都有图标，前 3 个可点，后 3 个灰色不可点
- [ ] 「实时预警」右侧有红色 `12` 徽标
- [ ] 点击左下角「收起菜单」→ 侧边栏变窄到只剩图标，箭头方向翻转
- [ ] 再点一次 → 恢复原状
- [ ] 把浏览器窗口缩到 900px 以下 → 侧边栏消失，出现三条杠按钮
- [ ] 点三条杠 → 侧边栏从左侧滑出，右侧出现半透明遮罩
- [ ] 点遮罩 或 按 Esc → 抽屉收回
- [ ] 窄屏下顶栏**不换行**，标题超长时显示省略号
- [ ] 页面**没有横向滚动条**（这是布局没撑破的标志）
- [ ] Console 里只有一条 `[骨架] app.js 已加载，交互就绪`，没有任何红色报错

---

## 八、下一步做什么

第 2 步是「**路由与渲染**」，也就是让页面真正能切换。要做三件事：

1. 写 `parseRoute()`：解析 `#/overview`、`#/alerts?page=2` 这样的地址
2. 写一个 `state` 对象集中存页面状态
3. 写 `render()` 统一分发：根据路由决定把什么内容塞进 `<main>`

做完之后，你点侧边栏菜单，主内容区就会真的换内容了。

**现在就可以验证一下这个缺口**：点一下「总览 / 实时预警 / 研判中心」，
你会看到**地址栏在变，但页面纹丝不动**——这正是第 2 步要补上的东西。
