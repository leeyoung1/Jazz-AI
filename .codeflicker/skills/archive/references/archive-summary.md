# Archive Summary Reference

### Phase 1：归档前检查

**1.1 检查交付状态**

读取 `.prd/{PROJECT_NAME}/06-execution/execution_report.md`。

- 如果 `compile_gate != passed` 或 `ready_for_delivery != true`：提示用户先完成 `/tdd`，停止归档
- 如果已通过：继续

如果 execution_report.md 不存在：
- 询问用户是否确认代码已验证通过
- 用户确认后继续

**1.2 收集产出物清单**

列出 `.prd/{PROJECT_NAME}/` 下所有文件，按阶段分类：

| 阶段 | 文件 |
|------|------|
| 需求输入 | `.prd/{name}/01-prd/prd.md` |
| 业务探索 | `.prd/{name}/02-biz/discovery.md`, `.prd/{name}/shared/question_backlog.json` |
| 上下文探索 | `.prd/{name}/03-context/context.md`, `.prd/{name}/shared/scope_map.json` |
| 技术方案 | `.prd/{name}/04-design/tech_design.md` |
| 任务拆解 | `.prd/{name}/05-tasks/tasks.md` |
| 执行报告 | `.prd/{name}/06-execution/execution_report.md` |

### Phase 2：生成归档摘要与索引

**2.1 生成归档摘要（在产出物原位）**

在 `.prd/{PROJECT_NAME}/` 下生成归档摘要，作为本次需求的总入口。

保存到：`.prd/{PROJECT_NAME}/07-archive/archive.md`

```markdown
---
project: {PROJECT_NAME}
archived_at: {ISO时间}
archive_date: {YYYY-MM-DD}
prd_url: {原始PRD链接}
status: completed
features_total: {N}
features_completed: {N}
tasks_total: {N}
tasks_succeeded: {N}
compile_gate: passed
---

# {项目名} — 需求归档

> 归档时间: {日期} | PRD: [{标题}]({原始URL})

## 需求概要

- **核心功能**: {一句话总结}
- **改造策略**: {新增/修改/重构}
- **影响范围**: {N} 个模块, {N} 个文件

## 产出物索引

| 阶段 | 文件 | 说明 |
|------|------|------|
| 需求输入 | [prd.md](../01-prd/prd.md) | PRD 主文档 |
| 业务探索 | [discovery.md](../02-biz/discovery.md) | 业务探索 |
| 业务探索 | [question_backlog.json](../shared/question_backlog.json) | 问题待办 |
| 上下文探索 | [context.md](../03-context/context.md) | 上下文分析 |
| 上下文探索 | [scope_map.json](../shared/scope_map.json) | 范围地图 |
| 技术方案 | [tech_design.md](../04-design/tech_design.md) | 技术方案 |
| 任务拆解 | [tasks.md](../05-tasks/tasks.md) | 任务列表 |
| 执行报告 | [execution_report.md](../06-execution/execution_report.md) | 执行报告 |

## 功能点完成情况

| 功能点 | 优先级 | 状态 | 说明 |
|--------|--------|------|------|
| {名称} | 核心 | 完成 | ... |

## 变更记录

### 业务规则变更

| 规则 | 变更类型 | 说明 |
|------|---------|------|
| {规则描述} | 新增/修改 | ... |

### 数据模型变更

| 实体 | 变更 | 说明 |
|------|------|------|
| {实体名} | 新增/修改字段 | ... |

### 接口变更

| 接口 | 变更类型 | 说明 |
|------|---------|------|
| {接口名} | 新增/修改/删除 | ... |

## 代码变更摘要

### 新增文件

- `{路径}` — {说明}

### 修改文件

- `{路径}` — {改动说明}

### 删除文件（如有）

- `{路径}` — {原因}

## 知识沉淀

### 新发现的业务规则

{从代码实现中提炼出的业务规则}

### 新发现的代码模式

{本次开发中使用的新模式、新写法}

### 经验教训

{开发过程中遇到的问题和解决方案}
```

**2.2 更新全局归档索引**

在 `.archive/index.md` 中追加本次归档记录（如果不存在则创建）：

```markdown
# 归档索引

| 日期 | 项目 | 核心功能 | 状态 | 归档位置 |
|------|------|---------|------|---------|
| {YYYY-MM-DD} | {name} | {一句话总结} | 完成 | [查看](../.prd/{name}/07-archive/archive.md) |
```
