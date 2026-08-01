# NEye Web

NEye 眼镜店客户管理系统 Web 管理端，基于 Vue 3、Vben Admin、Ant Design Vue 和 TypeScript。

## 功能范围

- 管理概览、运行状态、租户、账号和系统配置
- 客户管理、全局客户搜索与客户工作区
- 验光单、验光快速录入和按门店管理验光单样式（支持拖动、按钮和键盘调整字段顺序）
- 配镜单管理（在客户工作区内查看和编辑）
- 全局商品字典
- 独立账号管理与账号多租户分配
- 大批量客户验光数据导入、校验、发布、取消和错误报告下载
- 个人资料与密码修改

## 管理后台

管理员可在仪表盘查看租户、账号、客户和导入任务概览，在“系统状态”查看服务可用性、数据库就绪状态、进程运行时间与内存信息。页面不会展示环境变量、AppSecret 或其他密钥。

租户、账号等危险操作继续要求明确确认。审计日志页面、接口和“操作原因”输入已移除；关键权限边界仍由后端管理员角色、租户归属校验和 JWT 鉴权保证。

## 多租户账号

管理员在“系统管理 / 账号管理”中独立创建账号，并可一次分配多个租户。普通账号进入业务列表后可切换当前店铺，前端会把选择写入 `X-Tenant-Id` 请求头，后端仍会验证账号是否属于该租户。删除租户只清除账号分配关系，不删除账号本身。

## 客户工作区

进入客户档案后，页面左侧按验光日期倒序显示历史记录，右侧直接查看和编辑当前验光单，默认打开最新记录。关联配镜单在同一客户标签页内通过弹窗查看和编辑。

全局验光单、配镜单查询以及租户详情中的业务记录仍可作为检索入口，点击详情后会统一进入对应客户工作区。详细路由和组件说明见 [客户工作区设计](docs/customer-workspace.md)。

## 全局搜索与快速录入

页头“顾客搜索”支持姓名、完整拼音/拼音首字母、手机号和客户编号，`Ctrl/Cmd + K` 可快速打开，方向键选择结果并回车进入客户工作区。

验光表格支持常用值预设、粗调/细调和键盘网格导航。球镜、柱镜、轴位、棱镜、瞳距等字段按各自步长及范围处理，Tab 横向移动，Enter 纵向移动并自动换行。

## 大批量导入

导入界面支持上传、预检、确认发布、取消、失败重试和 CSV 错误报告下载。当前后端动态上限为单文件 50 MB、50,000 行、80 列、10 个工作表，按 750 行分批处理；发布采用全有或全无事务，失败不会留下部分业务数据。

同一文件的“重试上传”复用幂等标识，避免重复创建任务；重新选择文件会生成新标识。中文文件名、工作表名和表头按 UTF-8 处理，下载文件使用 ASCII 兼容回退名和 RFC 5987 `filename*`，避免浏览器保存时乱码。

## 目录

```text
apps/web-antd/        NEye Web 应用
packages/             应用依赖的 Vben 基础包
internal/             构建、TypeScript 与代码规范配置
scripts/              Vben 工作区辅助脚本
```

仓库已移除 Vben 演示页、其他 UI 框架应用、Mock 服务、官方文档站和发布工作流。`packages` 与 `internal` 是当前应用的直接或传递依赖，不应随意删除。

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

产物位于 `apps/web-antd/dist`。生产环境默认使用 hash 路由；如切换为 history 路由，静态托管平台必须将非静态、非 `/api/*` 请求回退到 `index.html`。

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
pnpm exec vitest run --dom apps/web-antd/src/api/neye.test.ts apps/web-antd/src/views/neye/system/governance.test.ts apps/web-antd/src/layouts/customer-search.test.ts apps/web-antd/src/views/neye/optometry-quick-input.test.ts
pnpm -F @neye/web-admin run typecheck
pnpm -F @neye/web-admin run build
```