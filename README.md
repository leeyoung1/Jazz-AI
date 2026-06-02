# JazzAI

```text
      _                 _____ ___
     | | __ _ ________ |  _  |_ _|
  _  | |/ _` |_  /_  / | |_| || |
 | |_| | (_| |/ / / /  |  _  || |
  \___/ \__,_/___/___| |_| |_|___|
```

一套面向 Claude Code 的 hooks-first 分阶段 AI 编码工作流。

## 安装

```bash
npm install -g jazzai

# 安装到当前仓库
jazz-ai install

# 先更新全局 CLI 包
npm update -g jazzai

# 再同步当前仓库内的 .codeflicker 资产
jazz-ai update
```

`jazz-ai install` 默认把受管资产安装到当前仓库的 `.codeflicker/` 目录；`--mode global` 可安装到共享目录供多个仓库复用。`--yes` 适用于无交互安装。

需要特别区分两层更新：

- `npm update -g jazzai`：更新全局 `jazz-ai` CLI 包
- `jazz-ai update`：把当前仓库已安装的 `.codeflicker` 资产同步到当前 CLI 版本，不会升级 CLI 自身

卸载语义分为两层：

- `jazz-ai uninstall`：清理当前仓库内受管的 `.codeflicker` 资产，默认保留 `.prd/.vibe/.archive`
- `jazz-ai uninstall --all`：连项目产物一并清理
- `npm uninstall -g jazzai`：只卸载全局 CLI 包，不会改任何仓库

## 概述

JazzAI 是一套面向 AI 辅助开发的分阶段工作流，围绕 `.codeflicker` 目录组织 hooks、skills、agents 和运行时配置。它把"需求 → 方案 → 拆解 → 编码 → 归档"沉淀为可恢复、可门控、可注入上下文的 slash 命令工作流，配合 Claude Code 的 hooks 能力按阶段自动注入产物上下文。

- 资产目录：`.codeflicker/`
- 配置字段：`vibe_code`
- slash 命令：`/project-init`、`/prd-input`、`/explore`、`/tech-design`、`/plan-task`、`/tdd`、`/archive`

## 核心工作流

```text
前置初始化（首次进入仓库）：
  仓库规范抽取 → 业务知识注入

需求开发流程：
  需求输入与综合探索 → 技术方案 → 任务拆解 → TDD 执行 → 归档沉淀
```

### 前置初始化阶段（首次进入仓库）

| 阶段 | 命令 | 说明 |
|------|------|------|
| 仓库规范抽取 | `/project-init` | 探索仓库结构，并行抽取工程规范、垂直链路模板和横向能力模板，生成 `AGENTS.md`；后端仓库自动调用 `/interface-index` 生成接口图谱 |
| 业务知识注入 | `/domain-input` | 接收人工输入的业务领域知识，生成 `.vibe/domain.md` |

### 需求开发阶段

| 阶段 | 命令 | 说明 |
|------|------|------|
| 需求输入与综合探索 | `/prd-input` | 解析 PRD，提取核心产品点，并继续完成业务探索、范围定位、代码分析和风险识别 |
| 综合探索重跑 | `/explore` | 针对已有 PRD 项目重新执行业务探索与代码上下文探索 |
| 技术方案 | `/tech-design` | 生成接口契约、改造点、影响分析 |
| 任务拆解 | `/plan-task` | 拆解为可执行的 Wave/Plan 执行契约 |
| TDD 执行 | `/tdd` | 轻量 TDD 编排，核心测试 + 最终编译门禁 |
| 归档沉淀 | `/archive` | 需求完成后的知识沉淀与模板更新 |

> 兼容说明：新需求优先使用 `/prd-input` 一次完成输入与探索（/explore）；旧命令 `/biz-discovery` 和 `/context-explore` 仍可使用，但会自动路由到 `/explore`。

### 轻量流程（Lite Flow）

不是所有需求都值得跑完整流程。JazzAI 按复杂度分三档，小需求可走 **Lite Flow** 三步直达：

| 档位 | 适用 | 流程 | 用户确认 |
|------|------|------|---------|
| **L1 Lite** | ≤5 文件 / 无新增接口 / 不跨服务（改 bug、加字段、加日志） | `/lite-prd → /lite-design → /lite-tdd` | 1 道（方案确认） |
| **L2 / L3 完整** | 跨服务 / 新增接口 / 数据迁移 / 高风险 | `/prd-input → /tech-design → /plan-task → /tdd → /archive` | 2 道 |

Lite Flow 专用命令：

| 命令 | 等价 | 说明 |
|------|------|------|
| `/lite-prd` | `/prd-input --level L1` | 录入需求 + 轻量定位，只产 prd/context/scope_map |
| `/lite-design` | `/tech-design`（L1） | 精简方案，**保留接口二次确认 + 方案人工确认** |
| `/lite-tdd` | `/tdd`（L1） | 无需 plan-task，直接从方案改造点编码，**保留 final compile 门禁** |

Lite Flow 仍享受完整核心能力：Hooks 上下文注入、接口安全网、模板复用、TDD 多 Agent 与最终编译门禁；只是跳过对小需求过重的 plan-task / 归档阶段，并把 2 道确认压缩为 1 道。

> 如果用 `/prd-input` 不带档位、由 AI 自动判定，会在录入后用 AskUserQuestion 让你确认走 Lite 还是完整流程；`/lite-prd` 则直接确定 L1。

## 快速开始

### 0. 首次初始化（新仓库）

```bash
/project-init
/domain-input
```

### 1. 需求输入与综合探索

```bash
/prd-input https://example.com/docs/prd-123 --name my-project
/prd-input /path/to/prd.md --name my-project
/prd-input 改造权限系统支持服务类型标签 --name permit-tag
```

产出文件：

- `AGENTS.md`：仓库工程规范
- `.vibe/templates/`：可复用模板
- `.vibe/index.md`：模板索引
- `.vibe/interfaces/index.md`：接口图谱总索引
- `.vibe/interfaces/domains/*.md`：功能域接口明细
- `.vibe/domain.md`：业务领域知识
- `.prd/{project}/01-prd/prd.md`：PRD 原文
- `.prd/{project}/01-prd/prd_summary.md`：核心产品点摘要
- `.prd/{project}/01-prd/summary.jsonl`：结构化摘要
- `.prd/{project}/02-biz/discovery.md`：业务探索报告
- `.prd/{project}/03-context/context.md`：上下文分析报告
- `.prd/{project}/shared/question_backlog.json`：问题待办
- `.prd/{project}/shared/scope_map.json`：范围定位地图

### 2. 完整流程

```bash
/tech-design --project my-project
/plan-task --project my-project
/tdd --project my-project
/archive --project my-project
```

如需基于已有 PRD 重新生成探索产物，可执行：

```bash
/explore --project my-project
```

### 3. 轻量流程（小需求 / Lite Flow）

改动小、无新增接口、不跨服务的需求，三步直达：

```bash
/lite-prd "为 OrderService.createOrder 加 traceId 日志" --name order-trace
/lite-design --project order-trace   # 精简方案 + 接口/方案确认（1 道确认）
/lite-tdd --project order-trace      # 直接编码 + final compile 门禁
```

产出精简：`prd.md`、`context.md`、`scope_map.json`、`level.json` + TDD 执行产物。

## 目录结构

```text
.codeflicker/
├── config.json
├── agents/
├── hooks/
├── skills/
└── runtime/

.prd/{project}/
├── 01-prd/
├── 02-biz/
├── 03-context/
├── 04-design/
├── 05-tasks/
├── 06-execution/
├── 07-archive/
└── shared/
```

## 核心特性

### Hooks-First 按需上下文注入

安装 hooks 后，普通会话默认保持安静；打开仓库的 `SessionStart` 不会扫描 `.prd`、不会自动选择历史项目，也不会注入 `systemMessage` 或 `additionalContext`。

只有用户显式提交 JazzAI 工作流命令（如 `/prd-input`、`/tech-design`、`/plan-task`、`/tdd`、`/archive`），或提交由 JazzAI skill 展开的执行 prompt 时，hooks 才会激活当前 session 并按阶段注入：

- 阶段产物（`prd.md`、`context.md`、`tech_design.md` 等）
- 仓库规范（`AGENTS.md`、`.vibe/domain.md`）
- 模板索引（`.vibe/index.md`）
- 接口图谱总索引（`.vibe/interfaces/index.md`）

激活后，普通用户 prompt 仍然干净透传；只有明确的继续类 prompt（如 `继续`、`continue`、`resume`）才会注入 continuation 上下文。项目索引刷新和产物追踪只在工作流活动期间执行。

### 阶段门控

每个阶段都有明确的前置条件：

- `tech-design` 需要 `context.md` 和 `scope_map.json`
- `plan-task` 需要 `tech_design.md` 已确认
- `tdd` 需要 `tasks.md` 已确认
- `archive` 需要 `execution_report.md` 中 `compile_gate=passed` 且 `ready_for_delivery=true`

### 接口图谱（后端仓库）

`/project-init` 会为后端仓库自动调用 `/interface-index` 生成轻量接口图谱：

- `.vibe/interfaces/index.md`
- `.vibe/interfaces/domains/*.md`

后续阶段会利用接口图谱将功能点锚定到功能域，减少全量代码搜索。

### 轻量 TDD 与最终编译门禁

`/tdd` 默认走轻量编排：planner → executor → light verifier → final compile verifier。每个 Plan 由独立 subAgent 执行，主会话只做编排、路由和门禁判断。`compile_gate=passed` 且 `ready_for_delivery=true` 是进入 `/archive` 的硬门禁；`--full` 启用更严格的 test-writer 与 wave 验证闭环。

## 本地测试

```bash
npm test
```

## 许可证

MIT
