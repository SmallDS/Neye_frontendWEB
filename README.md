# NEye Admin Web

NEye 后台管理前端，基于 Vue Vben Admin，实际业务应用是 `apps/web-antd`。

## 本地开发

```powershell
pnpm install
pnpm -F @vben/web-antd run dev
```

默认本地地址通常是：

```text
http://127.0.0.1:5666
```

开发环境接口通过 Vite 代理到本地后端：

```text
/api -> http://127.0.0.1:3100/api
```

## 构建

```powershell
pnpm -F @vben/web-antd run build
```

构建产物：

```text
apps/web-antd/dist
```

## 线上 API 配置

部署到腾讯云 ESA / EdgeOne Pages 时，建议配置环境变量：

```text
VITE_NEYE_API_BASE_URL=https://你的后端域名/api
VITE_GLOB_API_URL=https://你的后端域名/api
NODE_OPTIONS=--max-old-space-size=8192
```

如果使用同域 `/api` 反代到后端，则两个 API 变量都填 `/api`。