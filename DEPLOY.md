# 前后端部署学习手册

> 面向零基础。目标：把「前后端部署」完整走一遍，并且**遇到 bug 能自己定位**。
>
> **后续**：本文件是部署总览（含排错方法论与十大坑速查）。
> 具体动手的第二步——推 GitHub + 部署到 Render——见 **[DEPLOY-STEP2.md](./DEPLOY-STEP2.md)**。

---

## 一、先把作业拆成四个里程碑

一次性"部署"会让人无从下手。拆成四步，每步都有明确的完成标志：

| # | 里程碑 | 完成标志 | 状态 |
|---|---|---|---|
| 1 | **本机联调** | 浏览器能通过 fetch 拿到后端数据 | ✅ **已完成** |
| 2 | 后端上云 | 公网能访问 `/api/health` | 待做 |
| 3 | 前端上云 | 公网能打开页面，且接口通 | 待做 |
| 4 | 收尾 | 限制 CORS 来源、加日志、配自定义域名 | 进阶 |

**第 1 步最关键**，因为它是唯一不花钱、不依赖任何外部条件、今天就能做完的一步。
而且它会让你踩到人生第一个部署类 bug：**跨域（CORS）**。

---

## 二、里程碑 1 已经替你跑通了

### 现在的项目结构

```
D:\culture-platform\
├── index.html          前端页面
├── styles.css
├── app.js              多了一段"调用后端接口"的逻辑
├── icons.js
├── README.md           第 1 步的操作手册
├── DEPLOY.md           本文件
└── server\             ← 新增：后端
    ├── app.py             Flask 服务（2 个接口）
    ├── requirements.txt   依赖清单
    └── .venv\             虚拟环境（不要提交到 git）
```

### 怎么跑起来（两个终端）

**终端 1 —— 起后端：**
```powershell
cd D:\culture-platform\server
.venv\Scripts\python.exe app.py
```
看到 `Running on http://0.0.0.0:5000` 就成功了。

**终端 2 —— 起前端：**
```powershell
cd D:\culture-platform
python -m http.server 5500
```

然后浏览器打开 **http://127.0.0.1:5500**，点「调用后端接口」按钮。

> 为什么服务端和前端要开两个终端？因为它们本质上是**两个独立的程序**，
> 只是碰巧都在你这台机器上跑。上了云之后，它们会分别在两台服务器上。

---

## 三、复现并修掉 CORS（这是核心练习）

这一步建议你**亲手做一遍**，比看十篇文章都有用。

### 第 1 步：把开关关掉

打开 `server/app.py`，找到：
```python
ENABLE_CORS = True      # 改成 False
```
改成 `False`，**重启后端**（Ctrl+C 停掉，重新运行）。

### 第 2 步：观察现象

刷新页面，点「调用后端接口」。你会看到：

- 页面上：`✗ 请求失败：Failed to fetch`
- F12 → Console 里：红色的
  ```
  Access to fetch at 'http://127.0.0.1:5000/api/health'
  from origin 'http://127.0.0.1:5500' has been blocked by CORS policy:
  No 'Access-Control-Allow-Origin' header is present on the requested resource.
  ```

### 第 3 步：这是新手最困惑的地方

**后端明明是好的。** 你可以自己验证——打开一个新终端执行：

```powershell
curl http://127.0.0.1:5000/api/health
```

会正常返回 `{"ok":true,...}`，状态码 200。

**那问题出在哪？** 出在**浏览器**。

浏览器的「同源策略」规定：只有**协议 + 域名 + 端口**三者完全一致，JS 才允许读取对方的响应。

| | 前端 | 后端 | 是否同源 |
|---|---|---|---|
| 协议 | http | http | ✅ |
| 域名 | 127.0.0.1 | 127.0.0.1 | ✅ |
| 端口 | **5500** | **5000** | ❌ |

端口不同 → 不同源 → 浏览器拦截。

### 第 4 步：还有个小陷阱

注意 `catch` 里拿到的错误只有 `Failed to fetch`，**不含 CORS 字样**。

这是浏览器的安全设计：它故意不告诉 JS 具体原因，防止恶意脚本探测内网。
所以**排查跨域必须去看 Console**，不能只依赖代码里的错误提示。

### 第 5 步：修复

把 `ENABLE_CORS` 改回 `True`，重启后端，再点一次按钮：

```
✓ 联调成功！
请求地址：http://127.0.0.1:5000/api/health
后端返回：
{
  "ok": true,
  "service": "alert-platform",
  "version": "0.1.0"
}
```

用 `curl -i http://127.0.0.1:5000/api/health` 可以看到多了一个响应头：
```
Access-Control-Allow-Origin: *
```
**就是这一个头，让浏览器放行了。**

> `flask_cors` 这个库做的事其实就这么简单——自动帮你加几个响应头。
> 你也可以不用库，自己写：
> ```python
> @app.after_request
> def add_cors(resp):
>     resp.headers["Access-Control-Allow-Origin"] = "*"
>     return resp
> ```

### 第 6 步：想清楚几个问题

做完上面的实验，试着回答（这些是面试常问的）：

1. 为什么 `curl` 能拿到数据，浏览器却不行？
2. CORS 是后端的问题还是前端的问题？
3. 为什么 POST 请求有时会先发一个 `OPTIONS` 请求？

第 3 题的答案叫「预检请求」——当请求带了自定义头或用了 `Content-Type: application/json` 时，
浏览器会先发一个 OPTIONS 问问服务器"我能这么干吗"，服务器同意了才发真正的请求。

---

## 四、里程碑 2 & 3：免费平台部署

你没有服务器，用免费平台完全够交作业。

### 推荐组合

| 部分 | 平台 | 免费额度 | 说明 |
|---|---|---|---|
| 前端 | **Cloudflare Pages** 或 **Vercel** | 无限流量 | 静态站，最好用 |
| 后端 | **Render** | 每月 750 小时 | 支持 Python，配置简单 |
| 数据库（如需要） | **Neon** / **Supabase** | 免费 Postgres | 以后再说 |

> **真实提醒**：Render 免费实例 **15 分钟无请求会自动休眠**，
> 下次访问要等 30-60 秒冷启动。这不是 bug，是免费版的限制。
> 演示前记得先访问一下唤醒它。

### 前置：把代码推到 GitHub

平台都是通过 GitHub 仓库自动部署的，所以先做这一步：

```powershell
cd D:\culture-platform
git init
# 关键：把虚拟环境和缓存排除掉，别把几百 MB 的依赖传上去
echo "server/.venv/" > .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
git add .
git commit -m "first commit"
```

然后在 GitHub 上建一个空仓库，按提示关联并推送。

### 部署后端（Render）

1. 注册 Render，New → **Web Service**
2. 连接你的 GitHub 仓库
3. 关键配置：
   - **Root Directory**：`server` ← 代码在子目录里，必须填
   - **Runtime**：Python 3
   - **Build Command**：`pip install -r requirements.txt`
   - **Start Command**：`gunicorn app:app`
4. 点 Deploy，等 2-3 分钟

部署完成后你会拿到一个地址，形如 `https://xxx.onrender.com`。
浏览器访问 `https://xxx.onrender.com/api/health`，应该看到 JSON。

> **`gunicorn` 是什么？** 它是生产环境的 WSGI 服务器。
> Flask 自带的开发服务器性能差、不稳定，官方明确说不能用于生产。
> `gunicorn app:app` 的意思是「用 gunicorn 跑 app.py 里那个叫 app 的对象」。

### 部署前端（Cloudflare Pages / Vercel）

1. 导入同一个仓库
2. 配置：**Root Directory 留空**（前端文件在根目录）
3. **Build Command 留空**，**Output Directory** 填 `.`
   （因为这是纯静态站，不需要构建）
4. Deploy

### ★ 部署完必须改的一处代码

前端 `app.js` 里的 `API_BASE` 现在写死指向本机：

```js
var API_BASE = "http://127.0.0.1:5000";   // 线上必须改
```

改成能自动判断环境：

```js
// 本地开发用本机后端，线上用云端后端
var isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
var API_BASE = isLocal
  ? "http://127.0.0.1:5000"
  : "https://xxx.onrender.com";     // 换成你自己的 Render 地址
```

**另外注意**：线上前端是 `https://`，后端也必须是 `https://`。
如果后端写成 `http://`，浏览器会当作「混合内容」直接拦截——这是另一个高频坑。

---

## 五、部署排错十大坑（速查表）

出问题时先查这张表，十个里有八个能对上。

| 现象 | 真实原因 | 怎么查 |
|---|---|---|
| 打开是 nginx 默认欢迎页 | 站点配置没生效 / `root` 路径写错 | `nginx -T` 看最终生效配置 |
| **502 Bad Gateway** | 后端没起 / 端口写错 / 后端崩了 | 看后端进程和日志 |
| 403 Forbidden | 目录权限不对 / 缺 index.html | `ls -l` 看权限 |
| 前端能开但接口 404 | 反向代理路径没配 / 路由前缀不对 | 对比前后端路径 |
| 接口报 CORS 错误 | 后端没发 `Access-Control-Allow-Origin` | F12 看响应头 |
| 你能访问，别人打不开 | **安全组**没放行端口 | 云控制台的安全组规则 |
| 关了终端服务就挂 | 用前台方式起的进程 | 改用 systemd / pm2 / 平台托管 |
| 本地能跑，服务器报错 | 环境或依赖版本不一致 | 对比 Python/Node 版本 |
| 改了代码不生效 | 浏览器缓存 / CDN 缓存 | 强制刷新 / 加 `?v=` |
| ssh 连不上 | 密钥、端口、安全组 | 云控制台的 VNC 登录 |

---

## 六、排查故障的唯一心法

**顺着请求的路径，一层一层往下切。**

```
用户浏览器 → 网络/安全组 → 反向代理 → 后端进程 → 代码
```

每层都有独立的验证手段：

| 层 | 怎么验证 |
|---|---|
| 浏览器 | F12 → Network，看请求的状态码和响应头 |
| 网络 | 从别的机器 `curl` 你的公网地址 |
| 反向代理 | `nginx -T` 看配置 + 查 error.log |
| 后端进程 | `ps aux \| grep python`、看日志 |
| 代码 | 在本地跑一遍 |

**最有用的一招**——在服务器上执行：

```bash
curl http://127.0.0.1:5000/api/health
```

- **通** → 后端活着，问题在反向代理 / 网络那一层
- **不通** → 反向代理是无辜的，问题在后端自身

就这一条命令，能瞬间砍掉一半排查范围。

**新手最常见的错误**：盯着配置文件改半小时，其实后端进程压根没起来。

---

## 七、你的下一步

1. **先亲手把第三节的 CORS 实验做一遍**（关掉开关 → 看报错 → 打开 → 复现成功）
2. 把代码推到 GitHub
3. 接着做里程碑 2：后端部署到 Render
4. 遇到问题，回到第五节的速查表对照

做完记得回来告诉我卡在哪一步，我们一个一个排。
