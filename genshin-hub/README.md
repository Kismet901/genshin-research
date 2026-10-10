# 提瓦特纪行 · 原神资讯站

基于原神官方网站实时数据的一站式资讯站，包含新闻、角色、玩家评价、游戏故事与站内搜索。

## 本地运行

```powershell
cd D:\文件\genshin-hub
python server.py
```

浏览器打开 http://127.0.0.1:8000/

`server.py` 会托管静态页面，并提供 `/api/live`、`/api/search` 两个实时接口（服务端抓取原神官网数据）。

## 上线到 Netlify

项目已经配好 `netlify.toml` 和两个 Netlify Functions（`/api/live`、`/api/search`），两种方式任选：

### 方式 A：拖拽部署（最简单，无需命令行）

1. 打开 https://app.netlify.com/drop
2. 把 `D:\文件\genshin-hub` 整个文件夹拖进去
3. 完成后得到一个 `https://xxx.netlify.app` 网址

> 注意：拖拽部署只上传静态文件，Netlify Functions 不会生效，所以「实时更新」会回退为站内快照数据，其余功能（浏览、搜索、详情、评价）都正常。

### 方式 B：Git / CLI 部署（推荐，保留实时更新）

需要本机安装 Node.js 18.14+ 并登录 Netlify：

```powershell
cd D:\文件\genshin-hub

# 1) 安装并登录 Netlify CLI
npm install -g netlify-cli
netlify login

# 2) 关联或新建站点（首次会引导）
netlify init --manual

# 3) 部署到正式环境
netlify deploy --prod
```

部署后，`/api/live` 和 `/api/search` 会由 Netlify Functions 提供，实时数据同步与实时搜索即可生效。

## 目录结构

- `index.html` 页面骨架
- `css/style.css` 样式
- `js/app.js` 前端逻辑与渲染
- `data/*.json` 内置快照数据（离线回退用）
- `server.py` 本地 Python 服务器
- `netlify.toml` Netlify 构建配置
- `netlify/functions/` Netlify 无服务器函数（实时数据代理）
