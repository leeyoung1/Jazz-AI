# JazzAI Hooks Runtime

## Overview

这个目录承载 JazzAI 工作流的项目级 hooks 运行时。

- `router.mjs`：统一事件入口
- `lib/command-parser.mjs`：解析 `/prd-input`、`/tech-design` 等命令
- `lib/stage-registry.mjs`：维护 `command -> stage -> artifacts/prerequisites` 映射
- `lib/artifact-resolver.mjs`：定位并摘要阶段产物
- `lib/context-assembler.mjs`：组装 `systemMessage` 与 `additionalContext`
- `lib/policy-engine.mjs`：做阶段前置校验和轻量工具策略提示
- `lib/session-store.mjs`：维护 `.codeflicker/runtime/sessions/*.json`

## Runtime Contract

hooks 运行时负责两件事：

1. 在用户显式提交 JazzAI 工作流命令后，按当前阶段注入上下文，不再依赖 skill prompt 自觉读取
2. 统一执行阶段门控、会话状态维护和活动期产物追踪

默认情况下，普通 Codeflicker 会话保持安静：`SessionStart` 只透传 `{ continue: true }`，不会扫描 `.prd`、不会恢复历史项目，也不会返回 `systemMessage` 或 `additionalContext`。`UserPromptSubmit` 只有识别到 `/prd-input`、`/tech-design`、`/plan-task`、`/tdd`、`/archive` 等工作流命令，或识别到展开后的 JazzAI skill 执行 prompt 时，才会激活本 session。

session 激活后，普通用户 prompt 仍然透传；只有明确的继续类 prompt（如 `继续`、`continue`、`resume`）才会注入 continuation 上下文。`PostToolUse` 产物追踪、`PreCompact` 和非 meta subAgent 上下文注入也只在活动 session 中执行。`PreToolUse` 不做破坏性命令拦截；`PermissionRequest` 直接放行。

当前 TDD 入口已切换为 `/tdd`（`/tdd-execute` 仅兼容保留）：

- `.prd/{project}/05-tasks/tasks.md` 是确认后的执行源
- `.prd/{project}/06-execution/plans/INDEX.md` 与 `plans/{plan}.md` 是执行期 planner 产物
- `.prd/{project}/06-execution/slices/{plan}.md` 是 subAgent 启动时生成的最小上下文切片
- `.prd/{project}/06-execution/state.json` 记录 Wave 进度与修订状态
- `SubagentStart` 优先基于 execution plan 生成 Plan Slice，再回退到 `tasks.md`

当前实现不会把编码范围严格锁死到 `files_modified`，避免 plan 漏项导致执行阶段被误阻断。

## Local Test

```text
node --test hooks/tests/hook-system.test.mjs
```
