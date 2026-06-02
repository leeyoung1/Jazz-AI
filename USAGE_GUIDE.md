# JazzAI Agentic 工作流 — 使用指南

## 目录

- [0. 安装与 CLI 使用](#0-安装与-cli-使用)
- [1. 简介](#1-简介)
- [2. 核心概念](#2-核心概念)
- [3. 快速开始](#3-快速开始)
- [4. 阶段详解](#4-阶段详解)
- [5. Hooks 运行时](#5-hooks-运行时)
- [6. TDD 编排详解](#6-tdd-编排详解)
- [7. 项目产物布局](#7-项目产物布局)
- [8. 常见场景](#8-常见场景)

---

## 0. 安装与 CLI 使用

JazzAI 通过 npm 分发，全局工具名是 `jazz-ai`。npm 负责分发 CLI 和版本管理；真正把工作流资产装进仓库、更新仓库资产、清理受管资产，统一通过 `jazz-ai` 命令显式执行。

### 0.1 安装全局 CLI

```bash
npm install -g jazzai
```

安装完成后可验证版本：

```bash
jazz-ai --version
```

### 0.2 安装到当前仓库

```bash
jazz-ai install
```

这条命令会把 JazzAI 的受管资产安装到当前仓库的 `.codeflicker/` 目录下，并完成这些动作：

- 复制 `.codeflicker/hooks`、`.codeflicker/skills`、`.codeflicker/agents` 等工作流资产
- 写入 `.codeflicker/config.json`
- 写入 `.codeflicker/VERSION` 作为仓库内运行时版本标记
- 创建 `.codeflicker/runtime/` 运行时目录
- 在项目模式下补齐 `.gitignore` 中与 runtime 相关的忽略规则

目标仓库中的工作流目录名固定为：

```text
.codeflicker/
```

### 0.3 常用 CLI 命令

```bash
jazz-ai install [path] [--mode project|global] [--yes]
jazz-ai update [path] [--mode project|global] [--yes]
jazz-ai uninstall [path] [--mode project|global] [--all] [--yes]
jazz-ai doctor [path] [--mode project|global]
jazz-ai whoami
jazz-ai --help
jazz-ai --version
```

命令语义：

- `jazz-ai install`：把当前 CLI 包内的 JazzAI 资产安装到目标仓库
- `jazz-ai update`：把目标仓库里的 `.codeflicker` 资产同步到当前 CLI 版本
- `jazz-ai uninstall`：默认只清理受管 `.codeflicker` 资产
- `jazz-ai uninstall --all`：连 `.prd/.vibe/.archive` 一并清理
- `jazz-ai doctor`：查看当前环境、安装位置与项目/全局安装状态
- `jazz-ai whoami`：输出当前 CLI 包名、版本、registry、安装根目录

### 0.4 CLI 更新和仓库资产更新的区别

这是两层不同的更新：

```bash
# 更新全局 CLI
npm update -g jazzai

# 再把当前仓库里的 .codeflicker 资产更新到这个 CLI 版本
jazz-ai update
```

区别如下：

- `npm update -g jazzai`：更新你机器上的全局 CLI 包
- `jazz-ai update`：更新当前仓库里的 `.codeflicker` 资产，不会升级 CLI 包本身

### 0.5 全局模式与项目模式

- `--mode project`：默认模式。安装到目标仓库下的 `.codeflicker/`
- `--mode global`：安装到共享目录，供多个仓库复用同一套资产

### 0.6 卸载语义

- `jazz-ai uninstall`：删除受管 `.codeflicker` 资产，默认保留 `.prd/.vibe/.archive`
- `jazz-ai uninstall --all`：额外删除 `.prd/.vibe/.archive`
- `npm uninstall -g jazzai`：只移除全局 CLI，不会改任何仓库

---

## 1. 简介

JazzAI 是一套面向 AI 辅助开发的 **分阶段 Agentic 工作流**。它将“从需求到交付”的开发流程拆解为若干个 **严格定义边界的阶段**，每个阶段通过独立的 Skill（`/命令`）触发；Hooks 运行时只会在用户显式进入工作流后按需注入上下文、执行门禁校验、追踪产物状态。

机器可读兼容字段保留 `vibe_code`，用户可见入口、安装说明和品牌文案统一使用 `JazzAI`。

**核心理念：**

- **阶段级稳定契约**：每个阶段有明确的输入、产物和阻断条件，上游未完成时下游不可启动
- **Hooks-first 按需上下文注入**：不再依赖 AI “自觉”读取文件，而是由运行时在显式命令后注入所需上下文
- **人工确认是强阻断**：关键节点如技术方案、任务拆解必须人工确认后才可流转
- **知识闭环**：归档阶段会将新发现的业务规则和代码模式沉淀回知识库，形成持续进化

---

## 2. 核心概念

### 阶段（Stage）

工作流由有序阶段构成，每个阶段对应一个 slash 命令：

```text
前置初始化：/project-init → /domain-input
需求开发：  /prd-input → /explore → /tech-design → /plan-task → /tdd → /archive
```

### 项目（Project）

每个需求是一个 project，用 `--project <名称>` 或 `--name <名称>` 标识，所有产物存放在 `.prd/{project}/` 下。

### 产物（Artifact）

每个阶段产出固定的产物文件（如 `prd.md`、`tech_design.md`、`tasks.md`、`execution_report.md`），作为下游阶段的输入和门禁判断依据。

### 门禁（Gate）

阶段间有强制前置条件。上游产物缺失或未确认时，下游命令会被 Hooks 阻断并提示先完成前置阶段。

---

## 3. 快速开始

### 3.1 首次使用（Day0）

```bash
/project-init
/domain-input
```

- `/project-init`：探索仓库结构，抽取工程规范和模板，生成 `AGENTS.md`；后端仓库自动生成接口图谱
- `/domain-input`：注入业务领域知识，生成 `.vibe/domain.md`

### 3.2 开始一个新需求

完整流程（L2/L3）：

```bash
/prd-input https://example.com/docs/prd-123 --name my-project
/tech-design --project my-project
/plan-task --project my-project
/tdd --project my-project
/archive --project my-project
```

轻量流程（L1，小改动首选）：

```bash
/lite-prd "为 OrderService.createOrder 加 traceId 日志" --name order-trace
/lite-design --project order-trace
/lite-tdd --project order-trace
```

---

## 4. 阶段详解

### 4.1 `/prd-input` — 需求输入与综合探索

新需求主入口。支持三种输入：

```bash
/prd-input https://example.com/docs/prd-123 --name my-project   # URL
/prd-input /path/to/prd.md --name my-project                    # 本地文件
/prd-input 改造权限系统支持服务类型标签 --name permit-tag         # 直接描述
```

录入 PRD 后会判定复杂度档位（L1/L2/L3），然后继续完成业务语义校准、代码范围定位、并行上下文探索和证据驱动人工确认。产出 `prd.md`、`prd_summary.md`、`summary.jsonl`、`discovery.md`、`context.md`、`scope_map.json`、`question_backlog.json`。

> URL 模式需要先用可用的文档抓取方式（浏览器、`curl`/`wget` 或粘贴正文）把文档保存为本地 Markdown，再交给工作流处理。

### 4.2 `/explore` — 综合探索重跑（业务 + 上下文）

针对已有 PRD 的项目重新执行业务探索与代码上下文探索：

```bash
/explore --project my-project
```

新需求优先用 `/prd-input` 一次完成输入与探索；`/explore` 仅用于已有 PRD 项目的探索重跑。旧命令 `/biz-discovery`、`/context-explore` 会自动路由到 `/explore`。

### 4.3 `/tech-design` — 技术方案生成/解析

```bash
# AI 生成方案
/tech-design --project my-project

# 解析已有方案
/tech-design --project my-project --url https://example.com/tech-design
/tech-design --project my-project --file ./docs/tech-design.md
```

基于 `context.md` 生成包含接口契约、改造点、影响分析的技术方案。如果 `scope_map.json` 中存在已确认接口，会作为接口契约的输入源进行二次确认。**人工确认是强阻断**，确认后才会把 `pending_human_confirm` 设为 `false`。

### 4.4 `/plan-task` — 执行契约生成

```bash
/plan-task --project my-project
```

把已确认的技术方案拆解为可执行的 Wave/Plan 执行契约（`tasks.md`），覆盖 `depends_on`、`files_modified`、`requirements`、`must_haves`、`execution_hints` 等字段。`human_confirmed` 默认 `false`，确认后下游 `/tdd` 才可执行。`tasks.md` 只承载执行契约，不承载详细测试规格。

### 4.5 `/tdd` — TDD 编排执行

```bash
# 执行全部
/tdd --project my-project

# 只执行某个 Plan
/tdd --project my-project --plan PLAN-01

# 只执行某个 Wave
/tdd --project my-project --wave 1

# 恢复中断的执行
/tdd --project my-project --resume

# 严格模式（独立 test-writer + wave 重验证 + global verifier）
/tdd --project my-project --full
```

默认轻量模式：planner → executor → light verifier → final compile verifier，产出 execution plans、slices、state、execution_report。每个 Plan 由独立 subAgent 执行。`compile_gate=passed` 且 `ready_for_delivery=true` 是交付硬门禁，通过后提示进入 `/archive`。详见第 6 节。

### 4.6 `/archive` — 归档与知识沉淀

```bash
/archive --project my-project
/archive --project my-project --skip-knowledge
```

需求完成并通过 TDD 最终编译后，在产出物原位生成归档摘要 `07-archive/archive.md`，更新 `.archive/index.md`，并提炼新业务规则、新代码模板，经人工确认后反向更新 `AGENTS.md`、`.vibe/domain.md` 和模板库。归档前会校验 `execution_report.md` 的 `compile_gate=passed`、`ready_for_delivery=true`。

---

## 5. Hooks 运行时

Hooks 运行时是整个工作流的基础设施层，负责 **按需上下文注入** 和 **阶段门禁**。

### 5.1 核心职责

| 职责 | 说明 |
|------|------|
| 上下文注入 | 仅在用户显式进入 JazzAI 工作流后，按阶段将上游产物摘要注入 AI 上下文 |
| 门禁校验 | 检查前置产物是否存在、是否已人工确认 |
| 会话状态 | 维护当前阶段、项目、Plan 等会话信息 |
| 产物追踪 | 在工作流活动期间监听文件写入事件，更新产物注册表 |
| Plan Slice | subAgent 启动时生成最小上下文切片 |
| 工具策略 | 按阶段提供轻量工具策略提示，不执行破坏性命令拦截 |

### 5.2 事件类型

| 事件 | 处理逻辑 |
|------|---------|
| `SessionStart` | 静默透传；不扫描仓库、不恢复历史项目、不注入上下文 |
| `UserPromptSubmit` | 只有识别到工作流命令，或已激活 session 的明确继续类 prompt，才注入阶段上下文 |
| `PreToolUse` | 工具调用前策略提示；不拦截破坏性命令 |
| `PostToolUse` | 仅在活动 session 中追踪产物写入并更新会话状态 |
| `PostToolUseFailure` | 仅在活动 session 中输出工作流失败提示 |
| `SubagentStart` | 带 `VIBE_TDD_PLAN_META` 可显式激活 TDD 子任务上下文；否则仅活动 session 注入 |
| `SubagentStop` | 仅在活动 session 中验证 subAgent 返回结果 |
| `PreCompact` | 仅在活动 session 中注入压缩摘要 |
| `SessionEnd` | 清理会话状态 |

### 5.3 阶段注入的内容

以显式进入 `/tdd` 阶段为例，Hooks 会注入：

- `05-tasks/tasks.md`
- `04-design/tech_design.md`
- `03-context/context.md`
- `06-execution/plans/INDEX.md`
- `06-execution/state.json`
- `.vibe/interfaces/index.md`
- `.vibe/index.md`
- `AGENTS.md` / `.vibe/AGENTS.md`
- `.vibe/domain.md`

### 5.4 门禁校验规则

| 阶段 | 前置检查 |
|------|---------|
| `/explore` | PRD 文档存在 |
| `/tech-design` | `context.md` + `scope_map.json` + PRD 存在 |
| `/plan-task` | `tech_design.md` 已人工确认 |
| `/tdd` | `tasks.md` 已人工确认 + `tech_design.md` 已确认（如存在） |
| `/archive` | `execution_report.md` 存在且 `compile_gate=passed`、`ready_for_delivery=true` |

---

## 6. TDD 编排详解

`/tdd` 是整个工作流中最复杂的阶段，内部通过 4 个专职 Agent 协作完成。

### 6.1 Agent 角色

| Agent | 职责 | 触发时机 |
|-------|------|---------|
| `tdd-planner` | 从 `tasks.md` 反推出测试规格和实现计划 | 每次首次执行或计划失效时 |
| `tdd-test-writer` | 为当前 Wave 写 RED 测试 | 仅 `--full` 或 verifier 判定测试覆盖不足时 |
| `tdd-executor` | 单 Plan 的轻量 RED→GREEN→REFACTOR 微循环 | 默认模式下的核心执行者 |
| `tdd-verifier` | 做 light wave verification 和 final compile verification | 每个 Wave 完成后、全局交付前 |

### 6.2 执行流程

```text
tasks.md
    │
    ▼
┌──────────────┐
│  Phase 0     │ ← 建立 state.json，解析 Wave/Plan
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Phase 1     │ ← tdd-planner 生成 execution plans
└──────┬───────┘
       │
       ▼
   ┌──────────────────────────────────────────────┐
   │               每个 Wave 循环                  │
   │  ┌──────────────┐                            │
   │  │  Phase 2     │ ← 默认按 Plan 启动          │
   │  │  轻量执行     │   tdd-executor             │
   │  └──────┬───────┘                            │
   │         │                                     │
   │         ▼                                     │
   │  ┌──────────────┐                            │
   │  │  Phase 3     │ ← tdd-verifier             │
   │  │  Light 验收   │                            │
   │  └──────┬───────┘                            │
   │         │                                     │
   │         ▼                                     │
   │  ┌──────────────┐                            │
   │  │  Phase 4     │ ← issue 路由与返工          │
   │  │  修订循环     │                            │
   │  └──────┬───────┘                            │
   │         │                                     │
   │    通过？── 否 → 回到 Phase 2 / 补跑 test-writer │
   │         │                                     │
   │        是                                     │
   └─────────┼────────────────────────────────────┘
             │
             ▼
   ┌──────────────┐
   │  Phase 5     │ ← final compile verifier
   │  最终编译门禁  │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  Phase 6     │ ← execution_report.md
   │  写执行报告    │
   └──────────────┘
```

### 6.3 Issue 路由机制

`tdd-verifier` 发现的 issue 按根因分为几类，路由策略不同：

| Issue 维度 | 含义 | 路由动作 |
|-----------|------|---------|
| `implementation` | 测试合理但实现有问题 | 只重跑受影响 Plan 的 executor |
| `test_coverage` | 测试缺失或断言太弱 | 默认先补核心测试；`--full` 或系统性缺失时再重跑 test-writer |
| `requirement_alignment` | 实现偏离需求意图 | 回退到 planner 级，停止编码，重新规划 |
| `compile_failure` | final compile 失败 | 按错误文件映射回受影响 Plan，重新执行 executor |

**收敛规则：**

- 每次进入修订循环都必须先递增 `iteration_count_by_wave`
- 默认轻量模式每个 Wave 最多 2 轮自动返工
- `--full` 模式每个 Wave 最多 3 轮自动返工
- 达到上限后停止自动推进，向用户报告最后 issue 和人工介入建议

### 6.4 Plan Slice 机制

当 subAgent（executor）启动时，Hooks 会：

1. 检测 prompt 中的 `VIBE_TDD_PLAN_META project=<project> plan=<planId>`
2. 优先读取 `.prd/{project}/06-execution/plans/{planId}.md`
3. 若缺失，回退到 `.prd/{project}/05-tasks/tasks.md`
4. 生成最小切片 `.prd/{project}/06-execution/slices/{planId}.md`
5. 只向 subAgent 注入切片 + 仓库级基线，避免塞入整份文档

### 6.5 `state.json` 状态字段

```json
{
  "mode": "light",
  "current_wave": 1,
  "target_plans": ["PLAN-01"],
  "completed_plans": [],
  "failed_plans": [],
  "iteration_count_by_wave": { "1": 0 },
  "previous_issue_count_by_wave": { "1": null },
  "stall_reentry_count_by_wave": { "1": 0 },
  "pending_verification_by_wave": { "1": false },
  "revision_limit_reached_by_wave": { "1": false },
  "resume_from": null,
  "last_verifier_summary_by_wave": {},
  "compile_gate": "pending"
}
```

支持 `--resume` 恢复中断的执行。

---

## 7. 项目产物布局

每个项目（如 `user-growth`）的产物统一存放在 `.prd/{project}/` 下：

```text
.prd/user-growth/
├── 01-prd/
│   ├── prd.md
│   ├── prd_summary.md
│   └── summary.jsonl
├── 02-biz/
│   └── discovery.md
├── 03-context/
│   └── context.md
├── 04-design/
│   └── tech_design.md
├── 05-tasks/
│   └── tasks.md
├── shared/
│   ├── scope_map.json
│   ├── question_backlog.json
│   └── level.json
├── 06-execution/
│   ├── plans/
│   │   ├── INDEX.md
│   │   └── PLAN-01.md
│   ├── slices/
│   │   └── PLAN-01.md
│   ├── state.json
│   └── execution_report.md
└── 07-archive/
    └── archive.md

.vibe/
├── AGENTS.md
├── domain.md
├── index.md
├── interfaces/
│   ├── index.md
│   └── domains/
└── templates/

.archive/
└── index.md

.codeflicker/
├── config.json
├── agents/
├── hooks/
├── skills/
└── runtime/
```

### 布局规则

- `01-` ~ `07-` 前缀表示阶段顺序
- `shared/` 存放跨阶段流转的结构化产物
- 主文档（`.md`）面向人类阅读，结构化支撑（`.json`/`.jsonl`）面向机器流转
- `.vibe/` 是仓库级知识基线，跨项目复用
- `.archive/` 是全局归档索引

---

## 8. 常见场景

### 8.1 轻量流程（Lite Flow，小改动首选）

改动 ≤5 文件、无新增接口、不跨服务的需求：

```bash
/lite-prd "为 OrderService.createOrder 加 traceId 日志" --name order-trace
/lite-design --project order-trace   # 精简方案 + 接口/方案确认（1 道确认）
/lite-tdd --project order-trace      # 直接编码 + final compile 门禁
```

Lite Flow 跳过 plan-task 和归档阶段，把 2 道确认压缩为 1 道，但保留 Hooks 上下文注入、接口安全网、模板复用和最终编译门禁。

### 8.2 恢复中断的 TDD 执行

```bash
/tdd --project my-project --resume
```

优先恢复已有 `state.json`，而不是从头重新估算进度。

### 8.3 只重跑某个 Plan

```bash
/tdd --project my-project --plan PLAN-03
```

最终编译范围优先收窄到该 Plan 涉及模块。

### 8.4 使用已有技术方案

```bash
/tech-design --project my-project --file ./docs/tech-design.md
```

将已有方案解析为标准结构，并与 PRD、探索产物对齐。

### 8.5 补充业务知识

```bash
/domain-input
/domain-input --file ./docs/domain.md
```

接收人工输入的业务领域知识，生成或更新 `.vibe/domain.md`。

### 8.6 重新生成模板索引

```bash
/templates-index
```

扫描 `.vibe/templates/` 重新生成 `.vibe/index.md`。

### 8.7 刷新接口图谱（后端仓库）

```bash
/interface-index
```

重新生成 `.vibe/interfaces/index.md` 和 `.vibe/interfaces/domains/*.md`。
