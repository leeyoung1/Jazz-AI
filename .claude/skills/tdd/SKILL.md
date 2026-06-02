---
name: tdd
description: >-
  正式的 TDD 编排入口。消费已确认的 `tasks.md`，默认执行轻量 TDD：
  planner -> executor -> light verifier -> final compile verifier，产出 execution plans、
  slices、state、execution_report。显式 `--full` 时启用更严格的 test-writer、
  wave verifier 和 global verifier 闭环。
---

# TDD — 轻量编排式测试驱动执行

当前仓库已启用 hooks-first 上下文注入。`tasks.md`、执行计划索引、执行状态和仓库基线会在运行时自动进入上下文；`tech_design.md`、`context.md`、接口图谱和模板索引只在需要更深证据时按需读取。

## 角色定位

- `/tdd` 是正式入口。
- 默认 `/tdd --project <项目名>` 的执行范围不变：执行该项目下目标范围内的 Wave/Plan。
- 主会话只做编排、路由、状态写回和门禁判断，不直接承担业务编码。
- 每个 Plan 的编码必须由独立 subAgent 完成。
- 默认模式目标是“过程轻量、出口强门禁”：不做每 Plan 编译，但最终交付前必须编译通过。
- 显式 `--full` 才启用严格模式：独立 test-writer、wave 重验证、global verifier 和更完整测试门禁。

## Agent 调用约定

`/tdd` 不应把 workflow markdown 当作执行入口。编排阶段必须直接启动对应 subAgent：

- planner：启动 `tdd-planner`
- executor：默认模式下按 Plan 启动 `tdd-executor`
- test writer：仅在 `--full` 或 verifier 判定测试覆盖不足时启动 `tdd-test-writer`
- verifier：启动 `tdd-verifier`，区分 light wave verification 与 final compile verification

主会话只负责组装输入、启动 subAgent、消费结果和做路由决策。

## 参数

- `/tdd --project <项目名>`
- `/tdd --project <项目名> --plan PLAN-01`
- `/tdd --project <项目名> --wave 1`
- `/tdd --project <项目名> --resume`
- `/tdd --project <项目名> --full`
- `/tdd --project <项目名> --skip-qa`

参数语义：

- 不传 `--plan` / `--wave` 时，执行该项目下全部目标 Wave/Plan。
- `--plan` 只执行指定 Plan，最终编译范围优先收窄到该 Plan 涉及模块。
- `--wave` 只执行指定 Wave，最终编译范围优先收窄到该 Wave 涉及模块。
- `--full` 不改变执行范围，只启用严格验证模式。
- 不提供跳过 final compile 的公开参数；最终编译是交付硬门禁。

## 前置门禁

**先读取 `.prd/{project}/shared/level.json` 判断执行模式：**

### Lite Flow（`level: "L1"`）

L1 跳过 plan-task，没有 tasks.md，改以 tech_design.md 作为执行源。开始前校验：

1. `.prd/{project}/04-design/tech_design.md` 存在。
2. `tech_design.md` frontmatter 中 `pending_human_confirm: false`（方案已人工确认）。

不满足时停止，提示先执行并确认 `/tech-design --project {project}`。

### Full Flow（无 level.json 或 `level` 非 L1）

开始前必须校验：

1. `.prd/{project}/05-tasks/tasks.md` 存在。
2. `tasks.md` frontmatter 中 `human_confirmed: true`。
3. 若 `.prd/{project}/04-design/tech_design.md` 存在，则其 `pending_human_confirm: false`。

任一条件不满足时必须停止，不得绕过。

## 产物契约

### 读取

- `05-tasks/tasks.md`：Full Flow 的唯一执行源。**Lite Flow（L1）无此文件，改以 `04-design/tech_design.md` 的代码改造点作为执行源。**
- `06-execution/plans/INDEX.md`、`06-execution/state.json`：如存在优先恢复。
- `04-design/tech_design.md`、`03-context/context.md`：补充实现背景，仅在切片不足时按需读取。
- `.vibe/interfaces/index.md`：仅作为已确认接口边界的补充证据；执行期不重新展开全量图谱。

### 生成

- `06-execution/plans/INDEX.md`
- `06-execution/plans/{planId}.md`
- `06-execution/slices/{planId}.md`
- `06-execution/state.json`
- `06-execution/timing.json`
- `06-execution/execution_report.md`

`06-execution/slices/{planId}.md` 由 hooks 在 `SubagentStart` 时优先基于 execution plan 生成，缺失时再回退到 `tasks.md`。

## 状态字段

创建或恢复 `06-execution/state.json`，固定包含：

- `mode`: `light` 或 `full`
- `current_wave`
- `target_plans`
- `completed_plans`
- `failed_plans`
- `iteration_count_by_wave`
- `previous_issue_count_by_wave`
- `stall_reentry_count_by_wave`
- `pending_verification_by_wave`
- `revision_limit_reached_by_wave`
- `resume_from`
- `last_verifier_summary_by_wave`
- `compile_gate`: `pending | passed | failed`
- `final_compile_command`
- `final_compile_errors`
- `compile_attempts`
- `test_not_required_plans`
- `verification_cache`
- `timing`

`--resume` 时优先恢复已有 `state.json`，而不是重新从头估算进度。`state.json` 损坏时提示不可恢复，并按首次执行重建；不得静默沿用脏状态。

## Phase 0：建立执行图

> **Lite Flow（L1）**：没有 tasks.md，跳过下面第 1 步的 tasks 解析，改为读取 `04-design/tech_design.md` 的「代码改造点」章节，把本次改动收敛为单个 Wave、单个 Plan（`PLAN-01`），执行范围取改造点涉及文件。其余步骤（state.json、planner 衔接）不变。

1. 读取 `tasks.md`，解析 Wave、Plan、依赖和执行范围。
2. 根据 `--plan` / `--wave` 过滤目标范围；不传时执行项目下全部目标范围。
3. 初始化或恢复 `state.json`。
4. 如果已有 execution plans 且与目标范围匹配，优先复用；否则进入 planner。

## Phase 1：planner 生成 execution plans

主会话直接启动 `tdd-planner`，生成或刷新：

- `06-execution/plans/INDEX.md`
- `06-execution/plans/{planId}.md`

> **Lite Flow（L1）**：planner 的输入是 `tech_design.md` 的代码改造点（而非 tasks.md）。把本次改动收敛为单个 `PLAN-01` 执行计划，仍按下方规则做 Plan 分类（TDD / Standard / test_not_required）与测试规格。生成 execution plan 后，`SubagentStart` 会自动从它切片，不依赖 tasks.md。

planner 必须为每个 Plan 分类：

- `TDD`：核心业务逻辑、接口契约、状态流转、数据转换、关键分支。
- `Standard`：需要实现但不适合严格 TDD 的胶水、配置或迁移类改动。
- `test_not_required`：DTO、enum、常量、简单 mapper、getter/setter、无业务分支的样板代码。

执行计划必须记录：

- `core_behavior_tests`：真正需要测试的业务行为。
- `excluded_low_value_tests`：明确不测的 DTO/enum/样板项及原因。
- `compile_scope_hint`：可用于 final compile 的模块或目录提示。

## Phase 2：按 Plan 轻量执行

默认模式：

1. Wave 内每个 Plan 独立启动 `tdd-executor`。
2. subAgent 只拿当前 Plan 的最小上下文：
   - `VIBE_TDD_PLAN_META`
   - `06-execution/slices/{planId}.md`
   - 需要时再按需读取 `06-execution/plans/{planId}.md`、`tech_design.md`、`context.md`、`tasks.md`
3. `TDD` Plan 由 executor 在单 Plan 内完成最小 RED 测试与 GREEN 实现。
4. `Standard` / `test_not_required` Plan 不强制写测试，但必须返回明确的 `test_not_required_reason` 或 `standard_reason`。
5. executor 禁止主动运行 Maven/Gradle/npm/pnpm/yarn/go/cargo 等重型编译、构建或全量测试命令。

`--full` 模式：

- 在 executor 前按 Wave 启动 `tdd-test-writer` 写 RED 测试。
- test-writer 也禁止运行重型编译或全量测试。

## Phase 3：light wave verifier

每个 Wave 完成后启动 `tdd-verifier` 做 light verification：

- 检查有核心行为的 Plan 是否有测试或合理阻断。
- 检查 `test_not_required` 是否只用于 DTO、enum、常量、简单 mapper、无分支胶水代码。
- 检查实现是否存在明显假实现、硬编码捷径、漏接线、占位符或孤儿代码。
- 默认不运行重型编译。

Wave 通过条件：

- 无 blocker issue。
- 必测 Plan 的测试文件存在或明确阻断。
- 可豁免 Plan 有具体豁免原因。
- `pending_verification_by_wave[wave]` 不为 true。

## Phase 4：修订路由

对于 verifier 返回的 issue，固定按根因路由：

- `implementation`：只重跑受影响 Plan 的 `tdd-executor`。
- `test_coverage`：默认先重跑受影响 Plan 的 `tdd-executor` 补核心测试；`--full` 或 wave 级系统性缺失时才重跑 `tdd-test-writer`。
- `requirement_alignment`：回退到 `tdd-planner` 级，停止当前编码，要求重新规划。
- `compile_failure`：final compile 失败后，只重跑错误文件映射到的 Plan executor。

闭环硬规则：

- 每进入一次修订循环，必须先将 `iteration_count_by_wave[wave]` 加 1 并写回 `state.json`。
- 默认轻量模式每个 Wave 最多 2 轮自动返工；`--full` 最多 3 轮。
- 返工 subAgent 完成后，必须设置 `pending_verification_by_wave[wave]=true` 并写回 `state.json`。
- 返工完成后必须回到 light verifier 或 final compile verifier；不得直接进入下一阶段或 execution_report。
- 达到上限后停止，向用户报告最后 issue、错误文件和人工介入建议。

## Phase 5：final compile verifier

所有目标 Plan 完成后，必须启动 `tdd-verifier` 做 final compile verification。

final compile 是交付硬门禁：

- `compile_gate=passed` 才能写 `ready_for_delivery=true`。
- `compile_gate!=passed` 时不得提示 `/archive`。
- final compile 失败时按错误文件、模块、测试文件映射回受影响 Plan，最多自动返工 2 轮。

Java/Maven 默认命令优先级：

1. 能定位模块时：
   `mvn -pl <changed-module> -am -DskipTests -Dcheckstyle.skip=true -Dspotbugs.skip=true -Dpmd.skip=true test-compile`
2. 不能定位模块时，使用仓库已有最小编译命令，但仍跳过 checkstyle/spotbugs/pmd。
3. 不默认执行 `install`、`package`、`verify` 或全量 test。

其他语言生态也遵循同一原则：使用最小必要编译或类型检查命令，不默认跑全量测试套件。

## Phase 6：execution_report

最后写 `06-execution/execution_report.md`，至少包含：

- 执行范围与完成时间
- `mode`
- 每个 Plan 的分类和状态
- `unit_test_gate`
- `test_not_required_reason` / `standard_reason`
- `must_have_gate`
- 测试文件路径
- light verifier issue 摘要
- `compile_gate`
- `final_compile_command`
- `final_compile_errors`
- `compile_attempts`
- `ready_for_delivery`

报告 frontmatter 必须包含：

```yaml
compile_gate: passed
ready_for_delivery: true
```

只有 final compile 通过时才允许写入上述通过状态。否则必须写 `compile_gate: failed` 和 `ready_for_delivery: false`，并给出阻断原因。

## 明确边界

- `/tdd` 负责 Plan 级轻量 TDD、final compile 门禁和执行报告。
- 不要把详细测试规格写回 `tasks.md`。
- 不要在主会话里直接改业务代码来绕过 subAgent。
- 轻量模式不等价于全量回归；高风险改动使用 `--full`。

## 提示下一步

仅当 `compile_gate=passed` 且 `ready_for_delivery=true` 时输出：

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TDD COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**{project} — TDD 执行完成**

| 产出文件 | 路径 |
|---------|------|
| 执行计划索引 | `.prd/{project}/06-execution/plans/INDEX.md` |
| 执行状态 | `.prd/{project}/06-execution/state.json` |
| 执行报告 | `.prd/{project}/06-execution/execution_report.md` |

**执行概要：**
- mode: light | full
- Wave: {N} 个
- Plan: {N} 个
- compile_gate: passed
- ready_for_delivery: true

下一步建议：
  /archive --project {project}    ← 归档与知识沉淀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 成功标准

- [ ] 已消费执行源：Full Flow 消费确认后的 `tasks.md`；Lite Flow（L1）消费确认后的 `tech_design.md` 代码改造点
- [ ] 已生成 `06-execution/plans/INDEX.md`
- [ ] 已生成目标 Plan 的 `06-execution/plans/{planId}.md`
- [ ] 已生成或刷新 `06-execution/slices/{planId}.md`
- [ ] 已创建或恢复 `06-execution/state.json`
- [ ] 已完成目标 Plan 的 executor 执行
- [ ] light verifier 已通过或已给出阻断问题
- [ ] final compile verifier 已执行
- [ ] `compile_gate=passed`
- [ ] 已生成 `06-execution/execution_report.md`
