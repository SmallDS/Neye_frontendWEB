# 客户工作区

## 目标

客户档案是 Web 端业务操作的统一详情工作区。查看验光单或配镜单时不再产生独立业务标签，操作人员可以在同一客户上下文中连续查看历史验光记录、编辑验光数据和处理配镜单。

## 页面结构

- Vben 标签标题：客户姓名。
- 页面头部：客户编号、手机号、性别、年龄和新建验光单。
- 左侧列表：按验光日期倒序显示验光单，日期相同时按单号倒序。
- 右侧详情：显示并编辑当前验光单，同时列出关联的配镜单。
- 配镜单详情：通过弹窗查看，可在弹窗中编辑或删除。
- 默认选择：未指定验光单时打开最新一张；没有验光单时显示新建入口。

## 全局搜索与快速录入

`apps/web-antd/src/layouts/customer-search.vue` 在页头提供客户搜索，支持姓名、拼音首字母、手机号和客户编号。`Ctrl/Cmd + K` 打开搜索框，方向键循环选择，Enter 进入客户工作区，Escape 关闭。

`apps/web-antd/src/views/neye/optometry-quick-input.ts` 定义验光字段的常用值、粗调/细调步长、数值精度和上下限。验光表格通过 Tab 横向、Enter 纵向移动，越过边界时自动换行，适合连续键盘录入。

## 路由约定

客户工作区基础地址：

```text
/neye/customers/:customerId
```

通过查询参数保存当前工作区状态：

```text
/neye/customers/:customerId?optometryId=:optometryOrderId
/neye/customers/:customerId?optometryId=:optometryOrderId&fittingId=:fittingOrderId
```

客户详情路由设置 `fullPathKey: false`，查询参数变化不会创建新的 Vben 标签。刷新带参数地址后仍会恢复选中的验光单和配镜单弹窗。

旧地址 `/neye/optometry-orders/:id` 和 `/neye/fitting-orders/:id` 保留为兼容入口。兼容页使用现有详情接口查询客户关系后，通过 `router.replace` 进入客户工作区。

## 前端组件

```text
views/neye/customers/detail.vue
  客户工作区、记录选择、动态标签和 URL 状态

views/neye/components/OptometryOrderPanel.vue
  验光单加载、编辑、保存、删除、新增配镜单和未保存保护

views/neye/components/FittingOrderModal.vue
  配镜单查看、编辑和删除弹窗

views/neye/customer-workspace.ts
  日期排序、默认选择和工作区路由生成

layouts/customer-search.vue
  页头客户搜索和键盘选择

views/neye/optometry-quick-input.ts
  常用值、数值步进和键盘网格导航
```

全局验光单列表、全局配镜单列表和租户详情只负责查询。它们的“详情”操作统一生成客户工作区地址。

## 数据接口

客户工作区继续使用以下接口：

```text
GET    /customers/:id
POST   /customers/:id/optometry-orders
GET    /optometry-orders/:id
PATCH  /optometry-orders/:id
DELETE /optometry-orders/:id
POST   /optometry-orders/:id/fitting-orders
GET    /fitting-orders/:id
PATCH  /fitting-orders/:id
DELETE /fitting-orders/:id
GET    /product-items
GET    /system-settings/optometry-style
```

## 交互保护

验光数据修改后会显示“未保存”。切换其他验光单或离开客户页面时，系统会要求确认是否放弃修改。新建、保存或删除记录后会刷新客户记录列表，但不会打开额外标签。

## 验证

```powershell
pnpm exec vitest run --dom apps/web-antd/src/views/neye/customer-workspace.test.ts apps/web-antd/src/layouts/customer-search.test.ts apps/web-antd/src/views/neye/optometry-quick-input.test.ts
pnpm -F @neye/web-admin run typecheck
pnpm -F @neye/web-admin run build
```