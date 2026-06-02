---
name: lite-tdd
description: >-
  Lite Flow 编码步骤，等价 /tdd 的 L1 模式。无 tasks.md，直接以 tech_design 的代码改造点为
  执行源，planner 生成单 PLAN-01，executor 实现，final compile 作为交付硬门禁。
---

# Lite TDD — 轻量编码执行

这是 **Lite Flow** 的第三步，等价于 L1 模式下的 `/tdd`。

## 前置门禁

- `.prd/<project>/shared/level.json` 为 `level: "L1"`。
- `04-design/tech_design.md` 存在且 `pending_human_confirm: false`（方案已确认）。
- **无 tasks.md**（Lite 跳过 plan-task），以 tech_design 的代码改造点作为唯一执行源。

不满足时停止，提示先执行并确认 `/lite-design --project <project>`。

## 参数

`--project <项目名>`（必填）；支持 `--full`、`--resume` 等与 /tdd 相同的参数。

## 执行（复用 tdd 的 L1 分支，详见 ../tdd/SKILL.md）

1. **建立执行图**：读 tech_design 的「代码改造点」章节，收敛为单 Wave、单 Plan（PLAN-01），执行范围取改造点涉及文件。
2. **planner**：以 tech_design 改造点为输入，生成 `06-execution/plans/INDEX.md` 与 `PLAN-01.md`，做 Plan 分类（TDD / Standard / test_not_required）与测试规格。生成 execution plan 后 `SubagentStart` 会自动切片，不依赖 tasks.md。
3. **executor**：按 Plan 完成 RED→GREEN（轻量模式，每个 Plan 独立 subAgent）。
4. **final compile（保留，交付硬门禁）**：所有 Plan 完成后由 verifier 统一执行最小必要编译；`compile_gate=passed` 才写 `ready_for_delivery=true`，否则不得提示交付完成。
5. 产出 `06-execution/execution_report.md`。

## 下一步

- TDD 通过后即完成 Lite Flow；可按需提交代码，或运行 `/archive --project <project>` 做归档与知识沉淀（仍受 `compile_gate` 门禁保护）。
