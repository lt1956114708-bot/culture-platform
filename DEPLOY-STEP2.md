# 第二步作战手册：把代码推上 GitHub，再部署到云端

> 前提：里程碑 1（本机联调）已完成，`D:\culture-platform` 能本地跑通。  
> 目标：让别人用手机也能打开你的页面。  
> 预计耗时：2-3 小时（含注册账号）。

---

## 你已经就绪的部分

我在你动手前先把两个最容易踩的坑排掉了：

| 准备项          | 状态                   | 说明                                                  |
| ------------ | -------------------- | --------------------------------------------------- |
| `.gitignore` | ✅ 已创建并验证             | 已确认 `.venv`（17.7 MB / 1372 个文件）会被排除，源文件不会被误伤        |
| WSGI 入口验证    | ✅ 已用 waitress 验证     | `app:app` 这个入口是对的，Render 上换成 `gunicorn app:app` 也能跑 |
| 依赖清单         | ✅ `requirements.txt` | Flask 3.1.3 / flask-cors 6.0.5 / gunicorn 26.2.0    |

**提交到 GitHub 的会是这 9 个文件**：

```
.gitignore              1397 B
DEPLOY.md              10137 B
README.md              11651 B
app.js                  7659 B
icons.js                3434 B
index.html              6807 B
styles.css             15385 B
server/app.py           5709 B
server/requirements.txt   48 B
```

---

## 第 1 步：先把 `git` 命令修好（你会卡在这里）

**现状**：你机器上的 Git 是 WorkBuddy **自带的便携版**，藏在  
`D:\WB\WorkBuddy\resources\vendor\PortableGit\`，**没有注册到系统 PATH**。  
所以在 PowerShell 里敲 `git` 会提示"无法识别"。

### 方案 A：装官方 Git（推荐，10 分钟）

1. 打开 <https://git-scm.com/download/win> ，下载会**自动开始**
2. 双击安装，**一路默认选项**即可
   - 唯一要留意的页面是 "Adjusting your PATH environment"，  
     保持默认的 **"Git from the command line and also from 3rd-party software"**
3. 装完**重新打开一个新的 PowerShell**（旧窗口读不到新的 PATH）
4. 验证：

```powershell
git --version
```

出现 `git version 2.x.x` 就成功了。

> **为什么推荐装官方版？** 便携版在 WorkBuddy 目录里，  
> 将来软件升级、卸载或重装，这个 git 就没了。而且服务器上你必须用命令行 git，  
> 现在装好是长期投资。

### 方案 B：不装，临时借用便携版

如果暂时不想装，可以在每个终端会话开头先定义一下：

```powershell
$git = "D:\WB\WorkBuddy\resources\vendor\PortableGit\mingw64\bin\git.exe"
```

之后所有命令把 `git` 换成 `& $git`，例如：

```powershell
& $git --version
& $git init
& $git add .
```

能用，但每次都要带这个前缀，很啰嗦。**只建议应急。**

---

## 第 2 步：告诉 git 你是谁

git 需要知道每次提交的作者是谁。**只需要配置一次，以后永久生效。**

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

- 名字随便写，会显示在提交记录里
- 邮箱**建议用你注册 GitHub 的邮箱**（这样 GitHub 能把提交和你的账号关联起来）

验证：

```powershell
git config --global user.name
git config --global user.email
```

> 如果这一步报错说 `git` 不是命令，说明第 1 步没做好，回去重来。

---

## 第 3 步：在本地建立仓库并首次提交

```powershell
cd D:\culture-platform
git init
```

会提示 `Initialized empty Git repository in D:\culture-platform\.git\`。

然后：

```powershell
git add .
```

**这一步之后，立刻做验收检查**（关键）：

```powershell
git status --short
```

**你应该看到大约 9-10 行，每行以 `A` 开头**，比如：

```
A  .gitignore
A  README.md
A  app.js
A  index.html
A  server/app.py
A  server/requirements.txt
...
```

**绝对不能出现任何带 `venv` 的行。** 如果出现了，说明 `.gitignore` 没生效，  
**立刻停下**——否则你会把 1372 个 Windows 版的依赖文件传上去。

想更保险，用这条命令数一下文件数量：

```powershell
git ls-files | Measure-Object -Line
```

**应该是 9 左右，不应该是 1300+。**

确认无误后提交：

```powershell
git commit -m "feat: 初始提交 —— 前端骨架 + Flask 后端"
```

---

## 第 4 步：注册 GitHub 并推送

### 4.1 建远程仓库

1. 打开 <https://github.com> 注册/登录
2. 右上角 **`+`** → **New repository**
3. 填写：
   - **Repository name**：`culture-platform`
   - **Description**：随便写，比如"文化产品价值失范预警平台"
   - 可见性选 **Public**（免费部署要求公开仓库）
   - ⚠️ **不要勾选** "Add a README file" —— 本地已经有文件了，勾了会冲突
4. 点 **Create repository**

### 4.2 关联并推送

创建完页面会显示一段命令，用这段（把 `你的用户名` 换成实际的）：

```powershell
git remote add origin https://github.com/你的用户名/culture-platform.git
git branch -M main
git push -u origin main
```

**推送时会弹窗要求登录 GitHub**：

- 通常会自动弹出浏览器，点授权即可（官方 Git 自带的 Credential Manager 会处理）
- 如果没有弹窗、而是让你输用户名密码：**密码栏不能填你的登录密码**，  
  GitHub 早就不支持密码推送了。需要去  
  `GitHub → Settings → Developer settings → Personal access tokens` 生成一个 Token，  
  用它当密码。
- ⚠️ **国内网络访问 GitHub 可能超时**。如果卡住不动，多半是网络问题，  
  不是命令写错了。

### 4.3 验收

刷新你的 GitHub 仓库页面，应该能看到 9 个文件，**而且没有 `.venv` 文件夹**。

顺手确认一下总大小——仓库应该只有几百 KB。如果显示几十 MB，说明 `.venv` 传上去了。

---

## 第 5 步：部署后端到 Render

### 5.1 注册

打开 <https://render.com> ，用 GitHub 账号直接登录（最省事）。

### 5.2 创建 Web Service

1. 控制台点 **New** → **Web Service**
2. 选择 **Build and deploy from a Git repository** → Next
3. 连接你的 `culture-platform` 仓库
4. 逐项填写（**这几项填错就是 502，仔细核对**）：

| 配置项                | 填什么                               | 为什么                     |
| ------------------ | --------------------------------- | ----------------------- |
| **Name**           | `culture-platform-api`            | 会变成你的域名前缀               |
| **Region**         | `Singapore`                       | 离中国最近，延迟最低              |
| **Branch**         | `main`                            |                         |
| **Root Directory** | **`server`**                      | ★ 代码在子目录里，不填就找不到 app.py |
| **Runtime**        | `Python 3`                        |                         |
| **Build Command**  | `pip install -r requirements.txt` |                         |
| **Start Command**  | **`gunicorn app:app`**            | ★ 这就是你本地验证过的那个入口        |
| **Instance Type**  | `Free`                            |                         |

1. 点 **Create Web Service**

### 5.3 等待并验收

部署大概需要 2-5 分钟。日志会滚动，最后出现 `Your service is live` 就成功了。

你会得到一个地址，形如 `https://culture-platform-api.onrender.com`。

**验收**：浏览器直接访问

```
https://culture-platform-api.onrender.com/api/health
```

应该看到 `{"ok":true,"service":"alert-platform","version":"0.1.0"}`。

### 5.4 关于免费实例的休眠

**Render 免费实例 15 分钟没有请求会自动休眠。** 下次访问要等 30-60 秒冷启动。

这不是 bug，是免费版的限制。**演示给老师看之前，先去访问一下唤醒它**，否则第一眼看到的是加载很久甚至超时。

---

## 第 6 步：部署前端

代码已经在 GitHub 上了，所以有三个选择。**按省事程度排序**：

### 方案 1：GitHub Pages（最省事，推荐先用这个）

不用注册任何新平台：

1. 打开你的仓库 → **Settings** → 左侧 **Pages**
2. **Source** 选 `Deploy from a branch`
3. **Branch** 选 `main`，目录选 `/ (root)`，点 Save
4. 等 1-2 分钟，页面顶部会显示你的网址：  
   `https://你的用户名.github.io/culture-platform/`

因为你的 `index.html` 用的是相对路径（`href="styles.css"`），所以部署在子目录下也能正常工作。

### 方案 2：Cloudflare Pages

1. <https://pages.cloudflare.com> → Connect to Git
2. 选仓库
3. 配置：**Framework preset** 选 `None`，**Build command 留空**，**Build output directory** 填 `/`
4. Save and Deploy

### 方案 3：Vercel

1. <https://vercel.com> → Add New → Project → 导入仓库
2. **Framework Preset** 选 `Other`
3. Build Command 和 Output Directory 都**留空**
4. Deploy

---

## 第 7 步：打通前后端（最容易漏的一步）

前端部署好了，但你点"调用后端接口"会发现**还是失败**——因为 `app.js` 里写死了本机地址：

```js
var API_BASE = "http://127.0.0.1:5000";
```

线上环境根本不存在 `127.0.0.1:5000`，必须改成能自动判断环境的写法。打开 `app.js` 找到那行，改成：

```js
// 本地开发用本机后端，线上用 Render 的后端
var isLocal =
  location.hostname === "127.0.0.1" ||
  location.hostname === "localhost";

var API_BASE = isLocal
  ? "http://127.0.0.1:5000"
  : "https://culture-platform-api.onrender.com";   // ← 换成你自己的 Render 地址
```

改完提交推送，平台会自动重新部署：

```powershell
git add .
git commit -m "fix: 前端接口地址按环境自动切换"
git push
```

### ⚠️ 两个必须注意的点

1. **必须是 `https://`**。线上前端是 https，如果后端写成 `http://`，  
   浏览器会当作"混合内容"直接拦截——又一个高频坑。
2. **Render 地址别写错**，注意是 `onrender.com` 不是 `render.com`。

---

## 验收清单

全部打勾才算做完：

- [ ] `git --version` 能输出版本号
- [ ] `git config --global user.name` 有值
- [ ] `git status --short` 里**没有** `venv` 相关行
- [ ] GitHub 仓库里能看到 9 个文件，**没有 `.venv`**
- [ ] Render 部署日志显示成功
- [ ] 访问 `https://你的后端/api/health` 返回 JSON
- [ ] 前端页面能打开
- [ ] 页面上点"调用后端接口"显示 ✓ 联调成功
- [ ] **用手机流量打开前端页面，再点一次按钮**（这一步能验证它真的上了公网）

---

## 常见报错速查

| 报错                                           | 原因                             | 怎么解决                               |
| -------------------------------------------- | ------------------------------ | ---------------------------------- |
| `git: 无法将"git"项识别为...`                       | 没装官方 Git / 没重开终端               | 回到第 1 步                            |
| 推送卡住不动                                       | 国内网络访问 GitHub 慢                | 多试几次，或换个时间段                        |
| 推送时要密码但登录密码无效                                | GitHub 不支持密码推送                 | 生成 Personal Access Token 当密码       |
| Render 构建失败 `No such file: requirements.txt` | **Root Directory 没填 `server`** | 改配置，重新部署                           |
| Render 启动失败 `gunicorn: command not found`    | requirements.txt 里没写 gunicorn  | 确认文件里有 `gunicorn==26.2.0`          |
| 后端地址打不开（502）                                 | 启动命令写错 / 服务崩了                  | 看 Render 的 Logs 标签页                |
| 前端能开但接口报 CORS                                | 后端没启用 CORS                     | 确认 `app.py` 里 `ENABLE_CORS = True` |
| 接口报"混合内容"错误                                  | 用了 `http://` 访问后端              | 改成 `https://`                      |
| 页面样式丢失                                       | 用了绝对路径 `/styles.css`           | 检查 HTML 里是相对路径                     |

---

## 学习重点：这一步你到底在学什么

不是"记住了几个命令"，而是三件事：

1. **代码如何从本地走到公网** —— Git 是中转站，平台负责构建和运行
2. **开发环境和生产环境的差异** —— 启动方式不同（`python app.py` vs `gunicorn app:app`）、地址不同（`127.0.0.1` vs 域名）、安全要求不同
3. **配置即排错线索** —— Render 那 8 个配置项，每一项填错都会产生**不同**的报错。  
   你能从报错反推是哪一项错了，就真正会部署了。
