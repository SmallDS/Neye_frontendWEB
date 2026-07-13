# NEye Web

NEye 眼镜店客户管理系统 Web 管理端，基于 Vue 3、Vben Admin 和 Ant Design Vue。

## 功能范围

- 客户管理与客户工作区
- 验光单与验光单样式管理
- 配镜单管理（客户工作区内弹窗查看）
- 全局商品字典
- 独立账号管理与账号多租户分配
- 租户、租户数据和导入任务管理
- 个人资料与密码修改

## 多租户账号

管理员在“系统管理 / 账号管理”中独立创建账号，并可一次分配多个租户。普通账号进入业务列表后可切换当前店铺，前端会把选择写入 X-Tenant-Id 请求头；后端仍会验证账号是否属于该租户。删除租户只会清除账号分配关系，不删除账号本身。

## 客户工作区

进入客户档案后，Vben 标签使用客户姓名。页面左侧按验光日期倒序显示该客户的验光记录，右侧直接查看和编辑当前验光单，默认打开最新记录。关联配镜单不再跳转独立详情页，而是在同一客户标签内通过弹窗查看和编辑。

全局验光单、配镜单查询以及租户详情中的业务记录仍可作为检索入口，点击详情后会统一进入对应客户工作区。旧详情 URL 会自动跳转到新的客户工作区，相关路由和组件说明见 [客户工作区设计](docs/customer-workspace.md)。
## 目录

```text
apps/web-antd/        NEye Web 应用
packages/             应用依赖的 Vben 基础包
internal/             构建、TypeScript 与代码规范配置
scripts/              Vben 工作区辅助脚本
```

仓库已移除 Vben 的演示页、仪表盘、其他 UI 框架应用、Mock 服务、官方文档站和发布工作流。`packages` 与 `internal` 是当前应用的直接或传递依赖，不应随意删除。

## 本地开发

要求 Node.js 22.18+、pnpm 11.7+，后端监听 `http://127.0.0.1:3100`。

```powershell
pnpm install
pnpm -F @neye/web-admin run dev
```

访问 `http://127.0.0.1:5666`。开发环境会把 `/api` 代理到本地后端。

## 生产构建

```powershell
$env:VITE_GLOB_API_URL='https://api.example.com/api'
pnpm -F @neye/web-admin run build
```

产物位于 `apps/web-antd/dist`。生产环境默认使用 hash 路由；如切换为 history 路由，静态托管平台必须将非静态、非 `/api/*` 请求回退到 `/index.html`。

## Docker

```powershell
docker build -f apps/web-antd/Dockerfile -t neye-web .
docker run --rm -p 5666:80 neye-web
```

构建远程 API 版本：

```powershell
docker build -f apps/web-antd/Dockerfile `
  --build-arg VITE_GLOB_API_URL=https://api.example.com/api `
  -t neye-web .
```

## 验证

```powershell
pnpm -F @neye/web-admin run typecheck
pnpm -F @neye/web-admin run build
```