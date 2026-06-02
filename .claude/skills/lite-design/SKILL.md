---
name: lite-design
description: >-
  Lite Flow 技术方案步骤，等价 /tech-design 的 L1 模式。基于 prd/context/scope_map 生成
  精简技术方案（概要+接口契约+改造点），保留接口二次确认与方案人工确认，确认后进入 /lite-tdd。
---

# Lite Tech Design — 轻量技术方案

这是 **Lite Flow** 的第二步，等价于 L1 模式下的 `/tech-design`。

## 前置

- `.prd/<project>/shared/level.json` 应为 `level: "L1"`（由 /lite-prd 写入）。若缺失，先按 /lite-prd 补全。
- 依赖 `01-prd/prd.md`、`03-context/context.md`、`shared/scope_map.json`。

## 参数

`--project <项目名>`（必填）。示例：`/lite-design --project order-trace`

## 执行（复用 tech-design 的 L1 分支，详见 ../tech-design/SKILL.md）

1. **加载上下文**：prd + context + scope_map + 模板/接口索引。
2. **跳过**：残留问题决策、实现偏好收集（Lite 无 question_backlog）。
3. **接口二次确认（保留，强制）**：展示 scope_map 的 `confirmed_interfaces`，逐条向用户确认；这是 Lite 接口安全网的关键，不得跳过。
4. **生成精简方案**：只产「方案概要 + 接口契约 + 代码改造点」三段，跳过数据模型/时序/影响/风险。接口契约取自 `confirmed_interfaces`，不重新推断。**代码改造点必须逐文件列清**（/lite-tdd 直接以它为执行工单）。
5. **方案人工确认（保留，强阻断）**：必须等用户明确确认后，才把 `04-design/tech_design.md` 的 frontmatter `pending_human_confirm` 设为 `false`。不得自行标记确认。

## 产物与下一步

- `.prd/<project>/04-design/tech_design.md`（确认后 `pending_human_confirm: false`）

完成后提示：

```
下一步：/lite-tdd --project <project>
```
